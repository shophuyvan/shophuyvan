import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: {
        index:    resolve(__dirname, 'index.html'),
        product:  resolve(__dirname, 'product.html'),
        cart:     resolve(__dirname, 'cart.html'),
        checkout: resolve(__dirname, 'checkout.html'),
        admin:    resolve(__dirname, 'admin.html'),
        uploader: resolve(__dirname, 'uploader.html')
      }
    }
  }
});
