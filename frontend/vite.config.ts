import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

const backendUrl =  "http://backend:3000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  server: {
    proxy: {
      "/api": backendUrl,
      "/socket.io": {
        target: backendUrl,
        ws: true,
      },
    },
  },
});
