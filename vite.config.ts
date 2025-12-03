import { defineConfig } from "vite";
import { resolve } from "node:path";
import dts from "vite-plugin-dts";
import packageJson from "./package.json";

const externals = Object.keys(packageJson.dependencies);

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "StrapiClient",
      formats: ["es", "cjs"],
      fileName: (format) => `strapi.${format}.js`,
    },
    rollupOptions: {
      external: externals,
      output: {
        preserveModules: false,
      },
    },
    sourcemap: true,
    minify: true,
    target: "node14",
  },
  define: {
    global: "globalThis",
  },
});
