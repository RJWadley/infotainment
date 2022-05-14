import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      includeAssets: ["assets/favicon.ico", "assets/apple-touch-icon.png"],
      manifest: {
        name: "Cartainment",
        short_name: "car",
        description: "car stuff for myself",
        theme_color: "purple",
        icons: [
          {
            src: "/assets/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/assets/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    https: true,
  },
});
