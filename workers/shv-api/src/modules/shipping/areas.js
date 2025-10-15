import { json } from '../../lib/response.js';
export async function handle(req,env,ctx){const url=new URL(req.url);const path=url.pathname;
  if(path==='/shipping/provinces')return json({ok:true,items:[]}, {}, req);
  if(path==='/shipping/districts')return json({ok:true,items:[]}, {}, req);
  if(path==='/shipping/wards')return json({ok:true,items:[]}, {}, req);
  return json({ok:false,error:'Not found'},{status:404},req);
}
