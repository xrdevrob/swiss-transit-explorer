import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      // Suppress HMR errors in iframe context (inspector widget preview)
      overlay: false,
    },
  },
});

