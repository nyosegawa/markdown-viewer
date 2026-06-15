import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      html2canvas: fileURLToPath(
        new URL("./src/lib/pdf-export/html2canvas-stub.ts", import.meta.url),
      ),
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    target: "es2022",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/]react(-dom)?[\\/]/.test(id)) return "react";
          if (
            /[\\/](react-markdown|remark-[^/]+|rehype-[^/]+|unified|hast-[^/]+|mdast-[^/]+)[\\/]/.test(
              id,
            )
          )
            return "markdown";
          if (/[\\/]@shikijs|[\\/]shiki[\\/]/.test(id)) return "shiki";
          if (/[\\/](@codemirror|codemirror)[\\/]/.test(id)) return "codemirror";
          return undefined;
        },
      },
    },
  },
}));
