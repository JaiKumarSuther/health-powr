import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.EXPOSE_LAN === "true" ? "0.0.0.0" : "127.0.0.1",
    port: 5000,
    // Keep host checks enabled by default. If you need LAN testing, set EXPOSE_LAN=true.
  },
});
