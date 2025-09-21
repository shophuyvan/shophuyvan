// shv-fe/src/lib/media.js
// Minimal media helpers used by fallback.js
// NO_IMAGE: an inline SVG data URL used as a placeholder when images fail to load
export const NO_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f2f4f8"/>
      <stop offset="100%" stop-color="#e5e7eb"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g fill="none" stroke="#9ca3af" stroke-width="6" stroke-linecap="round">
    <rect x="100" y="80" width="600" height="440" rx="16" ry="16"/>
    <path d="M160 460 L320 320 L420 420 L520 340 L640 460" stroke="#9ca3af" stroke-width="10"/>
    <circle cx="260" cy="220" r="36" stroke="#9ca3af" />
  </g>
  <text x="50%" y="92%" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'" font-size="32" fill="#6b7280">
    No image
  </text>
</svg>
`)}`;
