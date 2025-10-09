// Lightweight Markdown/PlainText -> HTML for product descriptions
export function renderDescription(input: any): string {
  if (input == null) return '';
  let src = String(input);

  // If looks like HTML already, just return
  if (/[<][a-zA-Z][\s\S]*[>]/.test(src)) {
    // But still unescape \n to real newline inside text nodes via <br>
    return src.replace(/\\n/g, '<br/>');
  }

  // Unescape literal \n to real newline
  src = src.replace(/\\n/g, '\n');

  const lines = src.split(/\r?\n/);
  const out: string[] = [];

  let i = 0;
  function consumeList(ordered: boolean) {
    const items: string[] = [];
    while (i < lines.length) {
      const L = lines[i];
      const m1 = /^\s*[-*•]\s+(.*)$/.exec(L);
      const m2 = /^\s*\d+[\.)]\s+(.*)$/.exec(L);
      const mm = ordered ? m2 : m1;
      if (!mm) break;
      items.push(mm[1]);
      i++;
    }
    if (!items.length) return false;
    const inner = items.map(x => `<li>${inline(x)}</li>`).join('');
    out.push(ordered ? `<ol>${inner}</ol>` : `<ul>${inner}</ul>`);
    return true;
  }

  function inline(s: string) {
    // **bold**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // *italic*
    s = s.replace(/(^|\s)\*(?!\s)([^*]+?)\*(?=\s|$)/g, '$1<em>$2</em>');
    // Convert remaining single backslashes-n to <br> later
    return s;
  }

  while (i < lines.length) {
    const L = lines[i];
    if (!L.trim()) { i++; continue; }

    // Headings
    let m;
    if ((m = /^\s*###\s+(.*)$/.exec(L))) { out.push(`<h4>${inline(m[1])}</h4>`); i++; continue; }
    if ((m = /^\s*##\s+(.*)$/.exec(L)))  { out.push(`<h3>${inline(m[1])}</h3>`); i++; continue; }
    if ((m = /^\s*#\s+(.*)$/.exec(L)))   { out.push(`<h2>${inline(m[1])}</h2>`); i++; continue; }

    // Lists
    if (consumeList(false)) continue;
    if (consumeList(true)) continue;

    // Paragraph: collect until blank line
    const buf: string[] = [L];
    i++;
    while (i < lines.length && lines[i].trim()) {
      buf.push(lines[i]);
      i++;
    }
    const p = inline(buf.join(' ')).replace(/\n/g, '<br/>');
    out.push(`<p>${p}</p>`);
  }

  return out.join('\n');
}
