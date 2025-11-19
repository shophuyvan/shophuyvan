// cat-menu.js v40 – Đồng bộ với Admin categories
// Đường dẫn: apps/fe/src/cat-menu.js
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

  /**
   * ✅ Load categories từ API (ưu tiên /public/categories)
   */
async function loadCategories(){
  try{
    // Kiểm tra cache
    if(Array.isArray(window.CATEGORIES) && window.CATEGORIES.length) return window.CATEGORIES;
    
    const endpoints = [
      '/public/categories',
      '/categories'
    ];
      
      for(const path of endpoints){
        try{
          const response = await api.get(path);
          
          // ✅ Xử lý response giống backend trả về
          const items = response?.items || response?.data || response?.categories || response;
          
                    if(Array.isArray(items) && items.length > 0){
            // ✅ Sắp xếp theo order như admin
            const sorted = items.sort((a, b) => 
              (Number(a.order) || 0) - (Number(b.order) || 0)
            );

            // ✅ Ẩn 4 danh mục không dùng trên menu ALL (lọc theo slug)
            const blacklistSlugs = new Set([
              'thiet-bi-dien-nuoc',
              'nha-cua-doi-song',
              'hoa-chat-gia-dung',
              'dung-cu-tien-ich'
            ]);
            const filtered = sorted.filter(it => !blacklistSlugs.has(it.slug));

            window.CATEGORIES = filtered;
            console.log('✅ Loaded categories (filtered):', filtered.length, 'from', path);
            return filtered;
          }
        }catch(err){
          console.warn('Failed to load from', path, err);
        }
      }
      
      console.warn('⚠️ No categories found from API');
      return [];
      
    }catch(err){
      console.error('❌ Error loading categories:', err);
      return [];
    }
  }

  /**
   * ✅ Build tree giống admin (parent/children)
   */
  function buildTree(items){
    if (!Array.isArray(items) || items.length === 0) return [];
    
    // Nếu đã có children thì return luôn
    if (items.some(it => Array.isArray(it.children) && it.children.length)) return items;
    
    // Build tree map
    const byId = new Map();
    items.forEach(item => {
      byId.set(item.id || item.slug, { 
        ...item, 
        children: [] 
      });
    });
    
    const roots = [];
    
    items.forEach(item => {
      const id = item.id || item.slug;
      const parentId = item.parent || item.parent_id || item.parentId;
      
      const node = byId.get(id);
      
      if (parentId && byId.has(parentId)) {
        // Có parent -> thêm vào children của parent
        byId.get(parentId).children.push(node);
      } else {
        // Không có parent -> là root
        roots.push(node);
      }
    });
    
    // ✅ Sắp xếp children theo order
    function sortChildren(nodes) {
      nodes.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    }
    
    sortChildren(roots);
    
    return roots;
  }

  /**
   * ✅ Render tree HTML
   */
  function renderTree(nodes){
    const ul = document.createElement('ul');
    ul.style.listStyle='none';
    ul.style.padding='4px';
    ul.style.margin='0';
    
    nodes.forEach(node => ul.appendChild(renderNode(node)));
    
    return ul.outerHTML;
  }

  /**
   * ✅ Render single node với children
   */
  function renderNode(node, depth=0){
    const li = document.createElement('li');
    const a = document.createElement('a');
    
    // Icon dựa vào có children hay không
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const icon = hasChildren ? '📁' : '📄';
    const indent = '  '.repeat(depth);
    
    a.textContent = `${indent}${icon} ${node.name || node.title || ''}`;
    a.href = `/category.html?c=${encodeURIComponent(node.slug || node.id || '')}`;
    
    // Style
    Object.assign(a.style, {
      display:'block',
      padding:'6px 8px',
      borderRadius:'8px',
      color:'#111827',
      textDecoration:'none',
      transition: 'background 0.2s'
    });
    
    // Hover effects
    a.addEventListener('mouseover', ()=> a.style.background='#f3f4f6');
    a.addEventListener('mouseout',  ()=> a.style.background='transparent');
    
    // ✅ Click navigation
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = `/category.html?c=${encodeURIComponent(node.slug || node.id || '')}`;
      // Đóng panel
      const panel = document.getElementById('__shv_cat_panel');
      if (panel) panel.style.display = 'none';
    });
    
    li.appendChild(a);
    
    // ✅ Render children recursively
    if(hasChildren){
      const ul = document.createElement('ul');
      ul.style.marginLeft='12px';
      ul.style.borderLeft='2px solid #e5e7eb';
      ul.style.paddingLeft='8px';
      ul.style.listStyle='none';
      
      node.children.forEach(child => ul.appendChild(renderNode(child, depth + 1)));
      li.appendChild(ul);
    }
    
    return li;
  }
})();

console.log('✅ cat-menu.js v40 loaded - Synced with Admin categories');