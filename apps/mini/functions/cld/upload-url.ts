export const onRequestPost: PagesFunction<{
  CLOUDINARY_CLOUD: string,
  CLOUDINARY_UPLOAD_PRESET?: string,
  CLOUDINARY_API_KEY?: string,
  CLOUDINARY_API_SECRET?: string,
}> = async ({ request, env }) => {
  const headers = { "content-type": "application/json" };
  try {
    const { src, folder = "products", resource_type = "auto" } = await request.json();
    if (!src) return new Response(JSON.stringify({ error: "src required" }), { status: 400, headers });

    if (/^https:\/\/res\.cloudinary\.com\//i.test(src)) {
      return new Response(JSON.stringify({ secure_url: src }), { headers });
    }

    const origin = await fetch(src);
    if (!origin.ok) return new Response(JSON.stringify({ error: `origin ${origin.status}` }), { status: 502, headers });
    const blob = await origin.blob();

    const fd = new FormData();
    fd.set("file", blob, "media");
    fd.set("folder", folder);

    if (env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
      const ts = Math.floor(Date.now() / 1000).toString();
      fd.set("timestamp", ts);
      fd.set("api_key", env.CLOUDINARY_API_KEY);
      const toSign = new URLSearchParams({ folder, timestamp: ts }).toString();
      const signature = await signHmacSha1(toSign + env.CLOUDINARY_API_SECRET);
      fd.set("signature", signature);
    } else if (env.CLOUDINARY_UPLOAD_PRESET) {
      fd.set("upload_preset", env.CLOUDINARY_UPLOAD_PRESET);
    } else {
      return new Response(JSON.stringify({ error: "Missing Cloudinary credentials" }), { status: 500, headers });
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD}/${resource_type}/upload`;
    const up = await fetch(uploadUrl, { method: "POST", body: fd });
    const json = await up.json();
    return new Response(JSON.stringify(json), { status: up.status, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers });
  }
};

async function signHmacSha1(input: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(""), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}