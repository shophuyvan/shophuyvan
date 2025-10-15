import { json, errorResponse } from '../lib/response.js';
import { readBody } from '../lib/utils.js';
import { validate, SCH } from '../lib/validator.js';
import { idemGet, idemSet } from '../lib/idempotency.js';
export async function handle(req, env, ctx){const url=new URL(req.url);const p=url.pathname;if(p==='/api/orders'&&req.method==='POST')return createOrder(req,env);if(p==='/api/orders'&&req.method==='GET')return json({ok:true,items:[]}, {}, req);return errorResponse('Not found',404,req);}
async function createOrder(req, env){const idem=await idemGet(req,env);if(idem.hit)return new Response(idem.body,{status:200});const body=await readBody(req)||{};const v=validate(SCH.orderCreate,body);if(!v.ok)return json({ok:false,error:'VALIDATION_FAILED',details:v.errors},{status:400},req);const id=body.id||crypto.randomUUID().replace(/-/g,'');const order={id,createdAt:Date.now(),items:body.items||[],status:'confirmed'};const res=json({ok:true,id,order}, {}, req);await idemSet(id,env,res);return res;}
