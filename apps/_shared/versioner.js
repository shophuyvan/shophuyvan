
// /apps/_shared/versioner.js - simple cache buster loader
(function(){
  window.__SHV_BUILD__ = (window.__SHV_BUILD__ || (Date.now()+''));
  window.loadModule = function(path){
    const s = document.createElement('script');
    s.type = 'module';
    const sep = path.includes('?') ? '&' : '?';
    s.src = path + sep + 'v=' + window.__SHV_BUILD__;
    document.head.appendChild(s);
  };
})();
