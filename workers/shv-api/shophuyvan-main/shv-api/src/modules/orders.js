/* SHV safe patch header */
export async function handleOrders(req, env, fire) {
  const body = await req.json();
  // TODO: write to Firestore and update users revenue
  const orderId = 'ORD' + Date.now();
  return new Response(JSON.stringify({ orderId }), { headers: { 'content-type':'application/json' }});
}
