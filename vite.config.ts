import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { projectApi } from './engine/vite-project-api.ts';

export default defineConfig({
  plugins: [react(), tailwindcss(), projectApi()],
  optimizeDeps: {
    exclude: ['@remotion/whisper-webgpu', '@huggingface/transformers'],
  },
  worker: { format: 'es' },
});
