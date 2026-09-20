import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StrapiClient } from "../client";
import { CollectionClient } from "../clients/collection";
import { installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

interface Article {
	documentId: string;
	title: string;
}

describe("StrapiClient shorthand", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = installFetchMock();
	});

	afterEach(() => vi.restoreAllMocks());

	it("is a CollectionClient bound to uid", async () => {
		const client = new StrapiClient<Article>({ baseURL: "http://h", defaultLocale: "en", uid: "articles", token: "t" });
		expect(client).toBeInstanceOf(CollectionClient);
		expect(client.uid).toBe("articles");
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ documentId: "a", title: "A" }] }));
		const [err, data] = await client.findMany({ locale: "fr" });
		expect(err).toBeNull();
		expect(data).toEqual([{ documentId: "a", title: "A" }]);
		expect(lastCall(fetchMock).url).toBe("http://h/api/articles?locale=fr");
		expect(new Headers(lastCall(fetchMock).init.headers).get("authorization")).toBe("Bearer t");
	});

	it("validates config like Strapi", () => {
		expect(() => new StrapiClient({ baseURL: "http://h", defaultLocale: "", uid: "x" })).toThrow(TypeError);
	});
});
