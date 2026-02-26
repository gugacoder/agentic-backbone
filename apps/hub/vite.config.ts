import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../../", "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
              },
            },
          ],
        },
        manifest: {
          name: "Agentic Backbone Hub",
          short_name: "Hub",
          description: "Management panel for Agentic Backbone",
          theme_color: "#0a0a0a",
          background_color: "#0a0a0a",
          display: "standalone",
          icons: [
            { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
            { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: Number(env.HUB_PORT),
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://localhost:${env.BACKBONE_PORT}`,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
