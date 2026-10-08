import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		typecheck: {
			enabled: true,
			include: ["src/test/**/*.spec.ts"],
			tsconfig: "./tsconfig.test.json",
		},
		coverage: {
			reporter: ["json-summary", "json", "html-spa"],
			provider: "v8",
			exclude: ["src/test/**", "src/cli/__fixtures__/**", "src/cli/entry.ts"],
			thresholds: {
				lines: 100,
				branches: 100,
				functions: 100,
				statements: 100,
			},
		},
	},
});
