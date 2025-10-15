import { json, errorResponse } from '../../lib/response.js';import { adminOK } from '../../lib/auth.js';
export async function createWaybill(req,env){if(!(await adminOK(req,env)))return errorResponse('Unauthorized',401,req);return json({ok:true,code:'DUMMY'}, {}, req);}
