// src/lib/fallback.js
import { NO_IMAGE } from './media.js';

const PLACEHOLDER_HOSTS = new Set(['via.placeholder.com', 'placehold.co']);

function shouldReplace(img){
  try {
    if(!img || img.tagName !== 'IMG') return true;
    if(!img.getAttribute('src')) return true;
    const u = new URL(img.src, location.href);
    if(PLACEHOLDER_HOSTS.has(u.hostname)) return true;
  } catch(e){ return true; }
  return false;
}

function fix(img){
  if(!img) return;
  if(shouldReplace(img)){
    img.src = NO_IMAGE;
    img.removeAttribute('srcset');
  }
  img.onerror = () => {
    img.onerror = null;
    img.src = NO_IMAGE;
    img.removeAttribute('srcset');
  };
}

function sweep(root=document){
  root.querySelectorAll('img').forEach(fix);
}

// initial
sweep();

// dynamic content
const mo = new MutationObserver((muts)=>{
  for(const m of muts){
    m.addedNodes && m.addedNodes.forEach(n=>{
      if(n.nodeType===1){
        if(n.tagName==='IMG') fix(n);
        else sweep(n);
      }
    });
  }
});
mo.observe(document.documentElement, {subtree:true, childList:true});
