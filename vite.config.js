import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        assetsDir: 'assets'
    },
    server: {
        host: '0.0.0.0',
        port: 3000,
        allowedHosts: true,
        proxy: {
            '/parties': {
                target: 'http://127.0.0.1:8787',
                ws: true,
                changeOrigin: true
            },
            '/party': {
                target: 'http://127.0.0.1:8787',
                ws: true,
                changeOrigin: true
            }
        }
    }
});
