import { jtAdapter } from './providers/jt.js';
import { ahaAdapter } from './providers/aha.js';
import { grabAdapter } from './providers/grab.js';
import { spxAdapter } from './providers/spx.js';
import { xanhsmAdapter } from './providers/xanhsm.js';

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type':'application/json', 'access-control-allow-origin':'*' }});

export async function handleShipping(req, env, fire, requireAdmin) {
  const url = new URL(req.url);
  if (url.pathname === '/shipping/quote' && req.method === 'GET') {
    const weight = Number(url.searchParams.get('weight')||0);
    // TODO: respect settings.enabled and origin; call adapters' quote
    const items = [
      { provider:'jtexpress', service_code:'JT-FAST', name:'J&T Nhanh', fee: Math.max(15000, Math.ceil(weight/500)*3000), eta: '1-2 ngày', icon:'' },
      { provider:'ahamove', service_code:'AHA-GRAB', name:'Ahamove Nội thành', fee: 25000, eta: 'Trong ngày', icon:'' }
    ];
    return json(200, items);
  }
  if (url.pathname === '/shipping/create' && req.method === 'POST') {
    requireAdmin(req, env);
    const body = await req.json();
    return json(200, { tracking_code:'TRK'+Date.now(), label_url:'', fee: body.fee||0, eta:'1-3 ngày' });
  }
  if (url.pathname === '/shipping/cancel' && req.method === 'POST') {
    requireAdmin(req, env);
    return json(200, { ok: true });
  }
  if (url.pathname.startsWith('/shipping/webhook/')) {
    const provider = url.pathname.split('/').pop();
    // TODO: map provider statuses to standard ones
    return json(200, { ok: true, provider });
  }
  if (url.pathname === '/shipping/health' && req.method === 'GET') {
    requireAdmin(req, env);
    return json(200, { ok: true, provider: url.searchParams.get('provider') });
  }
  return json(404, { error: 'Not Found' });
}
