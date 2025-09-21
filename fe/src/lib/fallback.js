// shv-fe/src/lib/fallback.js
// Swap any broken <img> to an inline NO_IMAGE placeholder and keep watching for new nodes.
import { NO_IMAGE } from './media.js';

function useFallback(img) {
  if (!img || img.dataset && img.dataset._fallbackDone === '1') return;
  // Avoid infinite loop
  img.dataset._fallbackDone = '1';
  // Only replace if current src is empty or already failed
  img.src = NO_IMAGE;
  img.srcset = '';
  img.removeAttribute('srcset');
  img.style.objectFit = img.style.objectFit || 'contain';
  img.style.background = img.style.background || '#f3f4f6';
}

// Handle resource error on IMG
function onError(e) {
  const t = e.target;
  if (t && t.tagName === 'IMG') {
    useFallback(t);
  }
}

// Proactively replace images that are in error/empty state
function scan() {
  document.querySelectorAll('img').forEach(img => {
    // Replace obvious empty src
    if (!img.getAttribute('src') || img.getAttribute('src') === '#' ) {
      useFallback(img);
      return;
    }
    // If image is already in 'broken' state (naturalWidth==0 after load)
    if (img.complete && img.naturalWidth === 0) {
      useFallback(img);
    }
  });
}

// Observe future <img> insertions
const mo = new MutationObserver((mutations) => {
  for (const m of mutations) {
    m.addedNodes && m.addedNodes.forEach(n => {
      if (n && n.tagName === 'IMG') {
        // Delay a microtask for browsers to attempt load once
        queueMicrotask(() => {
          if (n.naturalWidth === 0 || !n.getAttribute('src')) useFallback(n);
        });
      } else if (n && n.querySelectorAll) {
        n.querySelectorAll('img').forEach(img => {
          queueMicrotask(() => {
            if (img.naturalWidth === 0 || !img.getAttribute('src')) useFallback(img);
          });
        });
      }
    });
  }
});

function init() {
  window.addEventListener('error', onError, true);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  // Initial scan
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan, { once: true });
  } else {
    scan();
  }
}

// Auto-init
init();
