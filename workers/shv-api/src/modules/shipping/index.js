import { json } from '../../lib/response.js';
import * as areas from './areas.js';import * as waybill from './waybill.js';import * as pricing from './pricing.js';import * as warehouses from './warehouses.js';
export async function handle(req, env, ctx){const url=new URL(req.url);const p=url.pathname;
  if(p.startsWith('/shipping/areas')||p.startsWith('/shipping/provinces')||p.startsWith('/shipping/districts')||p.startsWith('/shipping/wards')) return areas.handle(req,env,ctx);
  if(p.startsWith('/shipping/warehouses')) return warehouses.handle(req,env,ctx);
  if(p.startsWith('/shipping/price')||p.startsWith('/shipping/quote')) return pricing.handle(req,env,ctx);
  if(p.startsWith('/admin/shipping/create')) return waybill.createWaybill(req,env,ctx);
  return json({ok:false,error:'Not found'},{status:404},req);
}
