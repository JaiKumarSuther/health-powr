import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.EXPOSE_LAN === "true" ? "0.0.0.0" : "127.0.0.1",
    port: 5000,
    hmr: true,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — always needed
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          
          // Supabase — needed early for auth
          'vendor-supabase': ['@supabase/supabase-js'],
          
          // Heavy UI libs — split out so they don't block initial load
          'vendor-maps': ['leaflet', 'react-leaflet'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
          'vendor-query': ['@tanstack/react-query'],
          
          // Icons — large, rarely changes
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'lucide-react',
    ],
  },
});
