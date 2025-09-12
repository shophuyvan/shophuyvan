// src/hotfix/fallback.js
import { NO_IMAGE } from '../lib/media.js';

function apply(img) {
  if (!img || img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = '1';
  img.addEventListener('error', () => { img.src = NO_IMAGE; });
  const src = img.getAttribute('src') || '';
  if (!src || /via\.placeholder\.com/i.test(src)) { img.src = NO_IMAGE; }
}
function scan(){ document.querySelectorAll('img').forEach(apply); }
document.addEventListener('DOMContentLoaded', scan);
new MutationObserver((list)=>{
  for(const m of list){
    for(const n of m.addedNodes){
      if(n && n.tagName==='IMG') apply(n);
      else if(n && n.querySelectorAll) n.querySelectorAll('img').forEach(apply);
    }
  }
}).observe(document.documentElement,{childList:true,subtree:true});
