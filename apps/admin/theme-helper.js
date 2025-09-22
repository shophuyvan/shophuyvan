
/* Enhance existing admin with theme hooks without touching current logic */
export function applyTheme(){
  document.documentElement.style.setProperty('--vh', `${window.innerHeight*0.01}px`);
}
window.addEventListener('resize', applyTheme);
document.addEventListener('DOMContentLoaded', applyTheme);
