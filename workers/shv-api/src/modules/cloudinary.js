/* SHV safe patch header */
export async function sha1Hex(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const buf = await crypto.subtle.digest('SHA-1', data);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function handleUpload(req, env) {
  const { folder = 'shv', upload_preset } = await req.json();
  const timestamp = Math.floor(Date.now()/1000);
  // Build the string to sign with params sorted by key
  // Include only params that you will send to Cloudinary (excluding file)
  const params = new URLSearchParams();
  if (folder) params.append('folder', folder);
  if (upload_preset) params.append('upload_preset', upload_preset);
  params.append('timestamp', String(timestamp));
  const toSign = Array.from(params.keys()).sort().map(k => `${k}=${params.getAll(k).join(',')}`).join('&');
  const signature = await sha1Hex(toSign + env.CLOUDINARY_API_SECRET);

  return new Response(JSON.stringify({
    signature,
    timestamp,
    api_key: env.CLOUDINARY_API_KEY,
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    upload_preset: upload_preset || env.CLOUDINARY_UPLOAD_PRESET,
    folder
  }), { headers: { 'content-type':'application/json' }});
}
