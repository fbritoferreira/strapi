import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import dts from "vite-plugin-dts";
import packageJson from "./package.json" with { type: "json" };

const externals = Object.keys(packageJson.dependencies);

export default defineConfig({
	plugins: [
		dts({
			bundleTypes: true,
			outDirs: [
				{ dir: "dist", moduleFormat: "esm" },
				{ dir: "dist", moduleFormat: "cjs" },
			],
		}),
	],
	build: {
		lib: {
			entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
			name: "StrapiClient",
			formats: ["es", "cjs"],
			fileName: (format) => (format === "es" ? "strapi.mjs" : "strapi.cjs"),
		},
		rollupOptions: {
			external: externals,
		},
		sourcemap: true,
		minify: true,
		target: "node20",
	},
});
