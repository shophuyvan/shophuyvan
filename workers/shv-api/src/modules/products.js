import { json, errorResponse } from '../lib/response.js';
export async function handle(req, env, ctx){const url=new URL(req.url);if(url.pathname==='/products'&&req.method==='GET')return json({ok:true,items:[]}, {}, req);return errorResponse('Not found',404,req);}
