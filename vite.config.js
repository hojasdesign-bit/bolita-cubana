import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // El DS vive fuera de este proyecto; sin dedupe, Vite empaquetaría
    // dos copias de React (una por cada node_modules) y los hooks fallarían.
    dedupe: ['react', 'react-dom'],
  },
})
