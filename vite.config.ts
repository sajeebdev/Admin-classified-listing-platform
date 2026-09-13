import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  // `@classified-marketplace/shared` is an npm-workspace package, resolved
  // via a symlink into node_modules. Vite's dev-server dependency
  // optimizer does not pre-bundle linked/symlinked workspace packages by
  // default — only "real" (copied) node_modules dependencies. Since
  // `shared` is compiled to CommonJS (see shared/tsconfig.json), an
  // un-bundled `import { UserRole } from "@classified-marketplace/shared"`
  // is served straight to the browser as-is and fails at the native ESM
  // loader with "does not provide an export named ...", because a plain
  // CommonJS file has no statically-analyzable named exports. Explicitly
  // including it here forces esbuild to pre-bundle it (through the same
  // CJS-to-ESM interop every other dependency already gets), which is
  // what actually fixes it. `npm run build` (Rollup) was never affected —
  // Rollup's CommonJS interop applies unconditionally.
  optimizeDeps: {
    include: ["@classified-marketplace/shared"],
  },
});
