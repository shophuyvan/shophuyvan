// Minimal tracking wrapper, fill IDs in runtime if needed.
window.ShopTrack = {
  viewContent: (data) => { console.debug('[Track] ViewContent', data); },
  addToCart: (data) => { console.debug('[Track] AddToCart', data); },
  purchase: (order) => { console.debug('[Track] Purchase', order); }
};
