// src/lib/media.js
export const NO_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <rect width="100%" height="100%" fill="#f3f4f6"/>
    <g fill="#9ca3af" font-family="Arial,sans-serif" font-size="64" text-anchor="middle">
      <text x="50%" y="50%" dy="0.35em">No image</text>
    </g>
  </svg>`);
