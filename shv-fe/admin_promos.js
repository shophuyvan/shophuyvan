// admin_promos.js - SHV Admin Promos Manager
(function(){
  const rows = document.getElementById('rows');
  const btnAdd = document.getElementById('btnAdd');
  const btnReload = document.getElementById('btnReload');
  const btnSave = document.getElementById('btnSave');
  const btnClear = document.getElementById('btnClear');
  const btnExport = document.getElementById('btnExport');
  const fileImport = document.getElementById('fileImport');
  const toast = document.getElementById('toast');

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(()=>toast.classList.add('hidden'), 2500);
  }

  function rowTemplate(item={}, idx=0){
    const icon = item.icon || '⚡';
    const title = item.title || '';
    const desc = item.desc || '';
    const enabled = item.enabled !== false;

    const root = document.createElement('div');
    root.className = 'grid row';
    root.innerHTML = `
      <input class="emoji" maxlength="4" value="${icon}"/>
      <input class="title" type="text" placeholder="Tiêu đề..." value="${title}"/>
      <textarea class="desc" placeholder="Mô tả...">${desc}</textarea>
      <div class="right"><input class="enabled" type="checkbox" ${enabled ? 'checked': ''}></div>
      <div class="right flex">
        <button data-act="up">↑</button>
        <button data-act="down">↓</button>
        <button data-act="del" class="danger">Xoá</button>
      </div>
    `;
    root.querySelector('[data-act="up"]').onclick = () => {
      const prev = root.previousElementSibling;
      if (prev) rows.insertBefore(root, prev);
    };
    root.querySelector('[data-act="down"]').onclick = () => {
      const next = root.nextElementSibling;
      if (next) rows.insertBefore(next, root);
    };
    root.querySelector('[data-act="del"]').onclick = () => root.remove();
    return root;
  }

  function collect(){
    const out = [];
    for (const r of rows.children){
      out.push({
        icon: r.querySelector('.emoji').value.trim() || '⚡',
        title: r.querySelector('.title').value.trim(),
        desc: r.querySelector('.desc').value.trim(),
        enabled: r.querySelector('.enabled').checked
      });
    }
    return out;
  }

  function render(list){
    rows.innerHTML = '';
    (list || []).forEach((it, i)=> rows.appendChild(rowTemplate(it, i)));
  }

  async function apiGetPublic(path){
    const url = '/api' + '/' + String(path).replace(/^\/+/, '');
    const res = await fetch(url, { method:'GET', mode:'cors', credentials:'omit', cache:'no-store' });
    if (!res.ok) throw new Error('GET ' + path + ' ' + res.status);
    try { return await res.json(); } catch { return []; }
  }

  async function apiPutAdmin(path, data){
    const res = await SHV_AUTH.shvApiFetch(path, {
      method:'PUT', headers:{ 'content-type':'application/json' }, body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('PUT ' + path + ' ' + res.status);
    try { return await res.json(); } catch { return {ok:true}; }
  }

  async function reload(){
    const list = await apiGetPublic('/public/promos');
    render(list);
    showToast('Đã nạp lại từ API');
  }

  async function save(){
    const data = collect();
    await apiPutAdmin('/admin/promos', data);
    showToast('Đã lưu khuyến mại');
  }

  btnAdd.onclick = () => rows.appendChild(rowTemplate());
  btnReload.onclick = reload;
  btnSave.onclick = save;
  btnClear.onclick = () => { rows.innerHTML = ''; };

  btnExport.onclick = () => {
    const blob = new Blob([JSON.stringify(collect(), null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'promos.json';
    a.click();
  };
  fileImport.onchange = async () => {
    const f = fileImport.files[0]; if(!f) return;
    const txt = await f.text();
    try { const arr = JSON.parse(txt); render(arr); showToast('Đã nhập JSON'); }
    catch { showToast('JSON không hợp lệ'); }
  };

  document.addEventListener('shv:auth-ok', reload, { once: true });
})();