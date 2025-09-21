/*
  SHV: minimal, defensive PDP script (patched to avoid syntax errors).
  Original file had parse errors in some deployments.
*/
(()=>{
  "use strict";
  const $ = (sel, ctx=document)=>ctx.querySelector(sel);
  const $$ = (sel, ctx=document)=>Array.from(ctx.querySelectorAll(sel));

  // Ensure cart badge update doesn't break
  function setCartCount(n){
    const badge=$('#shv-cart-badge');
    if(badge) badge.textContent=String(n||0);
  }

  // Wire basic CTA buttons if present
  function initCTAs(){
    const addBtn = document.querySelector('[data-cta="add-to-cart"]') || document.querySelector('#cta-add');
    const buyBtn = document.querySelector('[data-cta="buy-now"]') || document.querySelector('#cta-buy');
    const qtyInp = document.querySelector('#shv-cta-qty');
    const variantSel = document.querySelector('#shv-variant');
    const getQty = ()=> qtyInp ? Math.max(1, parseInt(qtyInp.value||"1",10)) : 1;

    function addToCart(){
      try{
        const item = {
          id: document.body.dataset.pid || location.search || location.pathname,
          qty: getQty(),
          variant: variantSel ? variantSel.value : null
        };
        // Persist in localStorage for demo
        const cart = JSON.parse(localStorage.getItem("shv_cart")||"[]");
        const idx = cart.findIndex(x=>x.id===item.id && x.variant===item.variant);
        if(idx>-1) cart[idx].qty += item.qty; else cart.push(item);
        localStorage.setItem("shv_cart", JSON.stringify(cart));
        setCartCount(cart.reduce((s,x)=>s+x.qty,0));
        document.dispatchEvent(new CustomEvent("shv:cart:add",{detail:item}));
      }catch(e){ console.error("addToCart failed", e); }
    }
    function buyNow(){
      addToCart();
      try{ location.href = "/cart.html"; }catch(e){}
    }
    if(addBtn) addBtn.addEventListener("click", addToCart);
    if(buyBtn) buyBtn.addEventListener("click", buyNow);
  }

  function init(){
    try{
      initCTAs();
      setCartCount((JSON.parse(localStorage.getItem("shv_cart")||"[]")).reduce((s,x)=>s+x.qty,0));
    }catch(e){ console.error(e); }
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();