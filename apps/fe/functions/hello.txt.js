export function onRequest() {
  return new Response("hello", { headers: { "content-type": "text/plain" }});
}