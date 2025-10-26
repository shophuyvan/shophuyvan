/* addr-shared.js: one shared address module for PDP + Checkout */
;(function(w){
  'use strict';
  const LS_KEY = 'shv:addr';
  function noAccent(s){ try { return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''); } catch(e){ return s||''; } }
  function getSaved(){ try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : {}; } catch(e){ return {}; } }
  function save(addr){ try { localStorage.setItem(LS_KEY, JSON.stringify(addr||{})); } catch(e){} }
  function applyToForm(root){
    root = root || document; const a = getSaved();
    const sel = {name:'#addr_name,[name="addr_name"],#name,[name="name"]',phone:'#addr_phone,[name="addr_phone"],#phone,[name="phone"]',street:'#addr_street,[name="addr_street"],#street,[name="street"]',province:'#addr_province,[name="addr_province"],#province,[name="province"]',district:'#addr_district,[name="addr_district"],#district,[name="district"]',ward:'#addr_ward,[name="addr_ward"],#ward,[name="ward"]'};
    Object.entries(sel).forEach(([k,q])=>{ const el = root.querySelector(q); if(!el) return; if(a[k]!=null){ el.value=a[k]; try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){} } });
  }
  function populateProvinces(){} function populateDistricts(){} function populateWards(){}
  const Address = w.Address = w.Address || {};
  Object.assign(Address,{LS_KEY,noAccent,getSaved,save,applyToForm,populateProvinces,populateDistricts,populateWards,loadSaveAddr:getSaved,saveAddr:save});
  w.loadSaveAddr = w.loadSaveAddr || Address.loadSaveAddr;
  w.saveAddr     = w.saveAddr     || Address.saveAddr;
  w.populateDistricts = w.populateDistricts || Address.populateDistricts;
  w.populateWards     = w.populateWards     || Address.populateWards;
})(window);
// marker


/* === Address dataset + populate logic === */
;(function(w){
  'use strict';
  const Address = w.Address = w.Address || {};
  let _dataset = null;
  let _loading = null;

  async function loadDataset(){
    if(_dataset) return _dataset;
    if(_loading) return _loading;
    const candidates = [
      '/src/addr-vn.json',
      '/src/addr-vn.min.json',
      '/src/addr-vn.sample.json',
      'https://cdn.jsdelivr.net/gh/madnh/hanhchinhvn/dist/hanhchinhvn.min.json',
      'https://raw.githubusercontent.com/madnh/hanhchinhvn/master/dist/hanhchinhvn.min.json'
    ];
    _loading = (async () => {
      for(const url of candidates){
        try{
          const res = await fetch(url, {mode:'cors'});
          if(res.ok){
            const data = await res.json();
            let norm = null;
            if(Array.isArray(data?.provinces)) norm = data;
            else if(data?.tinh && data?.huyen && data?.xa){
              const provinces = Object.values(data.tinh).map(p => ({
                code: p.code || p.id || p.level1_id || '',
                name: p.name,
                districts: []
              }));
              const huyenByTinh = {};
              Object.values(data.huyen).forEach(d=>{
                const pid = d.parent_code || d.tinh_id || d.level1_id || d.parent_id;
                (huyenByTinh[pid] ||= []).push({ code: d.code||d.id, name: d.name, _code:d.code });
              });
              const xaByHuyen = {};
              Object.values(data.xa).forEach(x=>{
                const did = x.parent_code || x.huyen_id || x.level2_id || x.parent_id;
                (xaByHuyen[did] ||= []).push({ code: x.code||x.id, name: x.name });
              });
              provinces.forEach(p=>{
                const dists = (huyenByTinh[p.code]||[]).map(d => ({ code: d.code, name: d.name, wards: xaByHuyen[d._code]||[] }));
                p.districts = dists;
              });
              norm = { provinces };
            }
            if(norm){
              _dataset = norm;
              return norm;
            }
          }
        }catch(e){ /* try next */ }
      }
      try {
        const res = await fetch('/src/addr-vn.sample.json');
        if(res.ok){ _dataset = await res.json(); return _dataset; }
      }catch{}
      _dataset = { provinces: [] };
      return _dataset;
    })();
    return _loading;
  }

  function find(root, selector){ return (root||document).querySelector(selector); }
  function setOptions(selectEl, arr, savedVal){
    if(!selectEl) return;
    const val = savedVal ?? selectEl.value;
    // HOÀN TÁC: Trả về value="${o.name}"
    selectEl.innerHTML = '<option value="">-- Chọn --</option>' + (arr||[]).map(o=>`<option value="${o.name}">${o.name}</option>`).join('');
    if(val){ selectEl.value = val; }
    selectEl.dispatchEvent(new Event('change',{bubbles:true}));
  }

  async function populateProvinces(root){
    root = root || document;
    const provinceSelect = find(root, '#province, [name="province"], #addr_province, [name="addr_province"]');
    if(!provinceSelect) return;
    const data = await loadDataset();
    const list = (data?.provinces||[]).map(p => ({name:p.name, code:p.code}));
    const saved = (Address.getSaved?.()||{}).province;
    setOptions(provinceSelect, list, saved);
  }

  async function populateDistricts(root){
    root = root || document;
    const provinceSelect = find(root, '#province, [name="province"], #addr_province, [name="addr_province"]');
    const districtSelect = find(root, '#district, [name="district"], #addr_district, [name="addr_district"]');
    if(!provinceSelect || !districtSelect) return;
    const data = await loadDataset();
    const pv = provinceSelect.value || (Address.getSaved?.()||{}).province || '';
    const p = (data?.provinces||[]).find(x => x.name === pv);
    const list = (p?.districts||[]).map(d => ({name:d.name, code:d.code}));
    const saved = (Address.getSaved?.()||{}).district;
    setOptions(districtSelect, list, saved);
  }

  async function populateWards(root){
    root = root || document;
    const districtSelect = find(root, '#district, [name="district"], #addr_district, [name="addr_district"]');
    const wardSelect = find(root, '#ward, [name="ward"], #addr_ward, [name="addr_ward"]');
    if(!districtSelect || !wardSelect) return;
    const data = await loadDataset();
    const pv = (find(root,'#province, [name="province"], #addr_province, [name="addr_province"]')||{}).value || (Address.getSaved?.()||{}).province || '';
    const dv = districtSelect.value || (Address.getSaved?.()||{}).district || '';
    const p = (data?.provinces||[]).find(x => x.name === pv);
    const d = (p?.districts||[]).find(x => x.name === dv);
    const list = (d?.wards||[]).map(w => ({name:w.name, code:w.code}));
    const saved = (Address.getSaved?.()||{}).ward;
    setOptions(wardSelect, list, saved);
  }

  function attachListeners(root){
    root = root || document;
    const provinceSelect = find(root, '#province, [name="province"], #addr_province, [name="addr_province"]');
    const districtSelect = find(root, '#district, [name="district"], #addr_district, [name="addr_district"]');
    const wardSelect = find(root, '#ward, [name="ward"], #addr_ward, [name="addr_ward"]');
    if(!provinceSelect) return;

    provinceSelect.addEventListener('change', async ()=>{
      const cur = (Address.getSaved?.()||{});
      cur.province = provinceSelect.value||'';
      Address.save?.(cur);
      await populateDistricts(root);
      await populateWards(root);
    });
    districtSelect?.addEventListener('change', async ()=>{
      const cur = (Address.getSaved?.()||{});
      cur.district = districtSelect.value||'';
      Address.save?.(cur);
      await populateWards(root);
    });
    wardSelect?.addEventListener('change', ()=>{
      const cur = (Address.getSaved?.()||{});
      cur.ward = wardSelect.value||'';
      Address.save?.(cur);
    });
  }

  async function init(root){
    attachListeners(root);
    await populateProvinces(root);
    await populateDistricts(root);
    await populateWards(root);
    try{ Address.applyToForm(root); }catch{}
  }

  Object.assign(Address, { loadDataset, populateProvinces, populateDistricts, populateWards, init });

  if(document && (document.querySelector('#province,[name="province"],[name="addr_province"]') || document.querySelector('#district,[name="district"],[name="addr_district"]'))){
    document.addEventListener('DOMContentLoaded', ()=>{ init(document); });
  }
})(window);
