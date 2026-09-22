import { describe, expect, expectTypeOf, it } from "vitest";

import { generateConfig, type GenerateConfig } from "../index";

describe("generateConfig", () => {
	it("hands the config straight back", () => {
		const config = generateConfig({ types: { url: "https://cms.example.com" } });
		expect(config).toEqual({ types: { url: "https://cms.example.com" } });
	});

	it("types every section", () => {
		const config = generateConfig({
			types: { dir: "../cms", output: "src/strapi-types.ts", includePlugins: true },
			routes: { openapi: "https://cms.example.com/documentation/v1.0.0", password: "pw" },
			graphql: { url: "https://cms.example.com/graphql", token: "tok" },
		});
		expectTypeOf(config).toEqualTypeOf<GenerateConfig>();
	});

	it("rejects a types section naming both sources", () => {
		// @ts-expect-error dir and url are alternatives
		generateConfig({ types: { dir: "../cms", url: "https://cms.example.com" } });
	});

	it("rejects a section that names no source", () => {
		// @ts-expect-error types needs dir or url
		generateConfig({ types: { output: "src/strapi-types.ts" } });
		// @ts-expect-error routes needs an openapi source
		generateConfig({ routes: { output: "src/strapi-routes.ts" } });
		// @ts-expect-error graphql needs a url
		generateConfig({ graphql: { token: "tok" } });
		// @ts-expect-error there is no such section
		generateConfig({ nope: {} });
	});
});
