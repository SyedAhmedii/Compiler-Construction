import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// In development, /api is proxied to the Express server, so no CORS setup is needed locally.
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': 'http://localhost:4000' } } });
