import { describe, expect, it, vi } from "vitest";

import { loadGraphqlSchema } from "../../cli/load-graphql";

const schema = { queryType: { name: "Query" }, types: [{ kind: "OBJECT", name: "Article", fields: [] }] };
const okResponse = () => new Response(JSON.stringify({ data: { __schema: schema } }), { status: 200 });

describe("loadGraphqlSchema", () => {
	it("posts an introspection query and returns the schema", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(okResponse());
		expect(await loadGraphqlSchema({ url: "http://h/graphql", fetch: fetchImpl })).toEqual(schema);
		const [url, init] = fetchImpl.mock.calls[0] ?? [];
		expect(url).toBe("http://h/graphql");
		expect(init?.method).toBe("POST");
		const query = JSON.parse(String(init?.body)).query as string;
		expect(query).toMatch(/__schema/);
		// Without args the root fields would look like they take none.
		expect(query).toMatch(/args \{ name type \{ \.\.\.TypeRef \} \}/);
	});

	it("sends a bearer token when given one", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(okResponse());
		await loadGraphqlSchema({ url: "http://h/graphql", token: "tok", fetch: fetchImpl });
		expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer tok");
	});

	it("explains a 404 as a missing plugin", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }));
		await expect(loadGraphqlSchema({ url: "http://h/graphql", fetch: fetchImpl })).rejects.toThrow(/@strapi\/plugin-graphql/);
	});

	it("reports other HTTP failures with their status", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
		await expect(loadGraphqlSchema({ url: "http://h/graphql", fetch: fetchImpl })).rejects.toThrow(/500/);
	});

	it("reports GraphQL errors, e.g. introspection turned off", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: "GraphQL introspection is not allowed" }] }), { status: 200 }));
		await expect(loadGraphqlSchema({ url: "http://h/graphql", fetch: fetchImpl })).rejects.toThrow(/introspection is not allowed/);
	});

	it("reports a body that is not JSON", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>nope</html>", { status: 200 }));
		await expect(loadGraphqlSchema({ url: "http://h/graphql", fetch: fetchImpl })).rejects.toThrow(/did not answer JSON/);
	});

	it("rejects a body with no __schema", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
		await expect(loadGraphqlSchema({ url: "http://h/graphql", fetch: fetchImpl })).rejects.toThrow(/__schema/);
	});
});
