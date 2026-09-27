import { afterEach, describe, expect, it, vi } from "vitest";

import { acceptSchemaChange, timedFetch } from "../../cli/sections";

describe("acceptSchemaChange", () => {
	it.each([
		[null, true],
		["api", true],
		["api/article", true],
		["api/article/content-types", true],
		["api/article/content-types/article/schema.json", true],
		["api\\article\\content-types\\article\\schema.json", true],
		["components", true],
		["components/shared", true],
		["components/shared/seo.json", true],
		["api/article/controllers/article.ts", false],
		["api/article/routes", false],
		["components/shared/README.md", false],
		["index.ts", false],
		["admin/app.tsx", false],
	])("%s -> %s", (filename, expected) => {
		expect(acceptSchemaChange(filename)).toBe(expected);
	});
});

describe("timedFetch", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("adds a timeout signal and keeps the rest of the request", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
		await timedFetch(1000)("http://localhost:1337/graphql", { method: "POST" });
		const init = fetchMock.mock.calls[0]?.[1];
		expect(init?.method).toBe("POST");
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});
});
