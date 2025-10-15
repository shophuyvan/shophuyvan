import { corsHeaders } from '../lib/response.js';export function handleCORS(req){if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(req)});return null;}
