import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@remotion/whisper-webgpu', '@huggingface/transformers'],
  },
  worker: { format: 'es' },
});
