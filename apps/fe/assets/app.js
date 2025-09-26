
// == shophuyvan small JS ==
const btn = document.getElementById('mobile-menu-btn');
const drawer = document.getElementById('mobile-drawer');
if (btn && drawer){
  btn.addEventListener('click', () => drawer.setAttribute('data-open','true'));
  drawer.addEventListener('click', (e)=>{
    if(e.target === drawer) drawer.removeAttribute('data-open');
  });
}
// Smooth anchor scroll for in-page links
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click', (e)=>{
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth', block:'start'}); }
  });
});
