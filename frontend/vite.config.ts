import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  return {
    // base: "https://cdn.example.com/", // CDN Base URL (Uncomment for production)
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon-32.png", "favicon-64.png", "apple-touch-icon.png", "og-preview.png"],
        manifest: {
          name: "Quad",
          short_name: "Quad",
          description:
            "The next-generation campus social platform. Express yourself with stories, polls, and real-time chat.",
          theme_color: "#0a0f1b",
          background_color: "#0a0f1b",
          display: "standalone",
          start_url: "/",
          icons: [
            { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/pwa-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // Enable code splitting
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks for better caching
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "clerk-vendor": ["@clerk/clerk-react"],
            "ui-vendor": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-slot",
            ],
            "form-vendor": ["react-hook-form", "zod", "@hookform/resolvers"],
            "editor-vendor": ["@tiptap/react", "@tiptap/starter-kit"],
            "motion-vendor": ["framer-motion"],
            "content-vendor": [
              "dompurify",
              "react-hot-toast",
              "react-icons",
              "tailwind-merge",
            ],
            utils: ["axios", "socket.io-client", "zustand"],
          },
        },
      },
      // Enable minification
      minify: isProduction ? "esbuild" : false,
      // No production consumer is configured for source maps.
      sourcemap: false,
      // Target modern browsers for smaller bundle
      target: "es2020",
      // Optimize CSS
      cssCodeSplit: true,
      cssMinify: isProduction,
      // Report compressed size
      reportCompressedSize: true,
    },
    // Optimize dependencies
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "axios",
        "socket.io-client",
        "zustand",
        "@tiptap/react",
        "@tiptap/starter-kit",
      ],
      // Exclude large dependencies that should be loaded on demand
      exclude: [],
    },
    // Performance optimizations
    esbuild: {
      // Drop console and debugger in production
      drop: isProduction ? ["console", "debugger"] : [],
      // Optimize for modern browsers
      target: "es2020",
    },
  };
});
