export function logEntry(req){try{const url=new URL(req.url);console.log(`[IN] ${req.method} ${url.pathname}`);}catch{}}
