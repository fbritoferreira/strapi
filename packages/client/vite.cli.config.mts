import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";

export default defineConfig({
	build: {
		emptyOutDir: false,
		lib: {
			entry: fileURLToPath(new URL("./src/cli/entry.ts", import.meta.url)),
			formats: ["es"],
			fileName: () => "cli.mjs",
		},
		rollupOptions: {
			external: [...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
		},
		sourcemap: false,
		minify: false,
		target: "node20",
	},
});
