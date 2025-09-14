(function(){
  const rows=document.getElementById('rows');
  const btnSave=document.getElementById('btnSave');
  const btnAdd=document.getElementById('btnAdd');
  const statusEl=document.getElementById('status');

  function makeRow(it={}){
    const d=document.createElement('div'); d.className='row';
    d.innerHTML=`
      <input class="title" placeholder="Tiêu đề" value="${(it.title||'').replace(/"/g,'&quot;')}">
      <input class="desc" placeholder="Mô tả" value="${(it.desc||'').replace(/"/g,'&quot;')}">
      <select class="enabled"><option value="true"${it.enabled!==false?' selected':''}>Bật</option><option value="false"${it.enabled===false?' selected':''}>Tắt</option></select>
      <input class="icon" placeholder="Biểu tượng (ví dụ: ⚡)" value="${(it.icon||'⚡').replace(/"/g,'&quot;')}">
      <button class="del">Xoá</button>
    `;
    d.querySelector('.del').onclick=()=>d.remove();
    rows.appendChild(d);
  }

  async function load(){
    status('Đang tải...');
    try{
      const res = await SHV_AUTH.shvApiFetch('/public/promos');
      const list = await res.json().catch(()=>[]);
      rows.innerHTML='';
      (list && Array.isArray(list) ? list : []).forEach(makeRow);
      if(!rows.children.length){ makeRow({title:'',desc:'',enabled:true,icon:'⚡'}); }
      status('');
    }catch(e){
      console.warn(e); status('Không tải được dữ liệu.');
      if(!rows.children.length){ makeRow({title:'',desc:'',enabled:true,icon:'⚡'}); }
    }
  }

  async function save(){
    const arr = [...rows.children].map(r=>({
      title: r.querySelector('.title').value.trim(),
      desc: r.querySelector('.desc').value.trim(),
      enabled: r.querySelector('.enabled').value === 'true',
      icon: r.querySelector('.icon').value || '⚡'
    }));
    status('Đang lưu...');
    const res = await SHV_AUTH.shvApiFetch('/admin/promos', {
      method:'PUT',
      headers:{'content-type':'application/json'},
      body: JSON.stringify(arr)
    });
    if(!res.ok){
      status('Lưu thất bại ('+res.status+').');
      return;
    }
    status('Đã lưu!');
    setTimeout(()=>status(''), 1500);
  }

  function status(t){ statusEl.textContent=t||''; }

  btnAdd.onclick = ()=> makeRow({title:'',desc:'',enabled:true,icon:'⚡'});
  btnSave.onclick = save;

  document.addEventListener('shv:auth-ok', load, { once:true });
  if(window.SHV_AUTH){ setTimeout(load, 0); }
})();