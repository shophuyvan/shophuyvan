"use strict";Object.defineProperty(exports, "__esModule", {value: true});/** @type {import('tailwindcss').Config} */
exports. default = {
  content: ['./index.html','./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        card: '0 8px 24px rgba(2, 132, 199, 0.08)',
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [require('@tailwindcss/line-clamp')],
};
 /* v7-69062e520a0d82e9 */