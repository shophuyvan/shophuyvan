// cat-menu.js v34 — chắc chắn xổ danh mục con + không còn hộp trắng
import api from './lib/api.js';

(function(){
  document.addEventListener('DOMContentLoaded', init, {once:true});

  async function init(){
    const trigger = findTrigger();
    if(!trigger) return;

    const panel = document.createElement('div');
    panel.id = '__shv_cat_panel';
    Object.assign(panel.style, {
      position:'fixed', zIndex: 99999, minWidth: '260px', minHeight:'120px',
      background:'#fff', border:'1px solid rgba(0,0,0,.1)', borderRadius:'10px',
      boxShadow:'0 10px 30px rgba(0,0,0,.12)', padding:'8px', overflow:'auto', display:'none'
    });
    document.body.appendChild(panel);

    let open=false;
    trigger.addEventListener('click', async (e)=>{
      e.preventDefault(); e.stopPropagation();
      panel.innerHTML = '<div style="padding:6px;color:#6b7280;font-size:14px">Đang tải…</div>';
      position(trigger, panel);
      panel.style.display='block'; open=true;

      const cats = await loadCategories();
      panel.innerHTML = cats.length ? renderTree(buildTree(cats)) : '<div style="padding:6px;color:#6b7280;font-size:14px">Chưa có danh mục</div>';
    });

    window.addEventListener('click', (e)=>{ if(open && !panel.contains(e.target)){ panel.style.display='none'; open=false; } });
    window.addEventListener('scroll', ()=>{ if(open){ panel.style.display='none'; open=false; }});
    window.addEventListener('resize', ()=>{ if(open){ position(trigger,panel);} });
  }

  function findTrigger(){
    return document.getElementById('catBtn')
      || document.querySelector('.menu-cat,[data-cat-menu]')
      || Array.from(document.querySelectorAll('a,button')).find(el => (el.textContent||'').trim().toLowerCase().startsWith('danh mục'));
  }

  function position(trigger, panel){
    const r = trigger.getBoundingClientRect();
    const w = Math.min(320, Math.max(260, window.innerWidth - 20));
    panel.style.minWidth = w+'px';
    panel.style.left = Math.min(r.left, window.innerWidth - w - 10) + 'px';
    panel.style.top  = (r.bottom + 8) + 'px';
  }

  async function loadCategories(){
    try{
      if(Array.isArray(window.CATEGORIES) && window.CATEGORIES.length) return window.CATEGORIES;
      // ưu tiên endpoint public
      const paths = ['/public/categories','/categories','/public/categories?all=1'];
      for(const p of paths){
        try{
          const r = await api.get(p);
          const arr = r?.items || r?.data || r?.categories || [];
          if(Array.isArray(arr) && arr.length){ window.CATEGORIES = arr; return arr; }
        }catch{}
      }
    }catch{}
    return [];
  }

  function buildTree(items){
    if (!Array.isArray(items)) return [];
    if (items.some(it => Array.isArray(it.children) && it.children.length)) return items;
    const by = new Map(); items.forEach(it => by.set(it.id || it.slug || it.name, { ...it, children: [] }));
    const roots = [];
    items.forEach(it => {
      const id  = it.id || it.slug || it.name;
      const pid = it.parent || it.parent_id || it.parentId || it.pid || null;
      if (pid && by.has(pid)) by.get(pid).children.push(by.get(id));
      else roots.push(by.get(id));
    });
    return roots;
  }

  function renderTree(nodes){
    const ul = document.createElement('ul'); ul.style.listStyle='none'; ul.style.padding='4px'; ul.style.margin='0';
    nodes.forEach(n => ul.appendChild(renderNode(n)));
    return ul.outerHTML;
  }

  function renderNode(n, depth=0){
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = `${'— '.repeat(Math.min(depth,3))}${n.name||n.title||''}`;
    a.href = `/c/${encodeURIComponent(n.slug || n.id || '')}`;
a.addEventListener('click', (e) => {
  e.preventDefault();
  // Nếu muốn mở ngay trong trang hiện tại:
  window.location.href = `/c/${encodeURIComponent(n.slug || n.id || '')}`;
});
    Object.assign(a.style, {display:'block', padding:'6px 8px', borderRadius:'8px', color:'#111827', textDecoration:'none'});
    a.addEventListener?.('mouseover', ()=> a.style.background='#f3f4f6');
    a.addEventListener?.('mouseout',  ()=> a.style.background='transparent');
    li.appendChild(a);

    const kids = Array.isArray(n.children)?n.children:[];
    if(kids.length){
      const ul = document.createElement('ul'); ul.style.marginLeft='10px'; ul.style.borderLeft='1px solid #e5e7eb'; ul.style.paddingLeft='10px';
      kids.forEach(k => ul.appendChild(renderNode(k, depth+1)));
      li.appendChild(ul);
    }
    return li;
  }
})();