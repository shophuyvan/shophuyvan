export async function handlePricing(req, env) {
  const { items = [], shipping_fee = 0, voucher_code = null } = await req.json();
  const subtotal = items.reduce((s,it)=> s + (it.price||0) * (it.qty||1), 0);
  let discount_product = 0, discount_shipping = 0;
  if (voucher_code) {
    // Simple demo: 10% off up to 30k
    discount_product = Math.min(subtotal * 0.1, 30000);
  }
  const total = Math.max(0, subtotal + (shipping_fee||0) - discount_product - discount_shipping);
  return new Response(JSON.stringify({ subtotal, shippingFee: shipping_fee, discount_product, discount_shipping, total }), { headers: { 'content-type':'application/json' }});
}
