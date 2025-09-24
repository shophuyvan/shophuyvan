/* Address shared module for PDP & Checkout */
;(function(w){
  'use strict';
  const LS_KEY = 'shv:addr';

  function noAccent(s){
    try { return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
    catch(e){ return s||''; }
  }

  function getSaved(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }
    catch(e){ return {}; }
  }

  function save(addr){
    try { localStorage.setItem(LS_KEY, JSON.stringify(addr || {})); } catch(e){}
  }

  // Apply saved values to common inputs if they exist
  function applyToForm(root){
    root = root || document;
    const a = getSaved();
    const map = {
      name:     '#addr_name, [name="addr_name"], #name, [name="name"]',
      phone:    '#addr_phone, [name="addr_phone"], #phone, [name="phone"]',
      street:   '#addr_street, [name="addr_street"], #street, [name="street"]',
      province: '#addr_province, [name="addr_province"], #province, [name="province"]',
      district: '#addr_district, [name="addr_district"], #district, [name="district"]',
      ward:     '#addr_ward, [name="addr_ward"], #ward, [name="ward"]'
    };
    Object.entries(map).forEach(([k,sel])=>{
      const el = root.querySelector(sel);
      if(!el) return;
      const v = a[k];
      if(v!=null){
        el.value = v;
        try{ el.dispatchEvent(new Event('change', { bubbles: true })); }catch(e){}
      }
    });
  }

  // Stubs: app can override these to actually populate select options using its dataset
  function populateProvinces(){ /* no-op by default */ }
  function populateDistricts(){ /* no-op by default */ }
  function populateWards(){ /* no-op by default */ }

  w.Address = w.Address || {};
  Object.assign(w.Address, {
    LS_KEY, noAccent, getSaved, save,
    applyToForm,
    populateProvinces, populateDistricts, populateWards,
    loadSaveAddr: getSaved,
    saveAddr: save
  });

  // Backward-compat: expose globals expected by old code
  w.populateDistricts = w.populateDistricts || w.Address.populateDistricts;
  w.populateWards     = w.populateWards     || w.Address.populateWards;
  w.loadSaveAddr      = w.loadSaveAddr      || w.Address.loadSaveAddr;
  w.saveAddr          = w.saveAddr          || w.Address.saveAddr;
})(window);
