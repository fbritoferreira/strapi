import { describe, expectTypeOf, it } from "vitest";

import type {
	FetchInit,
	StrapiContentTypes,
	StrapiDocument,
	StrapiErrorBody,
	StrapiMedia,
	StrapiPagination,
	StrapiResponse,
	StrapiSingleResponse,
} from "../types";

describe("types", () => {
	it("StrapiDocument has Strapi 5 system fields", () => {
		expectTypeOf<StrapiDocument>().toHaveProperty("documentId").toEqualTypeOf<string>();
		expectTypeOf<StrapiDocument>().toHaveProperty("publishedAt").toEqualTypeOf<string | null>();
		expectTypeOf<StrapiDocument["locale"]>().toEqualTypeOf<string | undefined>();
	});

	it("responses carry optional meta", () => {
		expectTypeOf<StrapiResponse<{ a: 1 }>["data"]>().toEqualTypeOf<{ a: 1 }[]>();
		expectTypeOf<StrapiSingleResponse<{ a: 1 }>["data"]>().toEqualTypeOf<{ a: 1 }>();
		expectTypeOf<StrapiResponse<unknown>["meta"]>().toEqualTypeOf<
			{ pagination?: StrapiPagination } | undefined
		>();
	});

	it("error body matches Strapi 5", () => {
		expectTypeOf<StrapiErrorBody["error"]["name"]>().toEqualTypeOf<string>();
		expectTypeOf<StrapiErrorBody["error"]["details"]>().toEqualTypeOf<unknown>();
	});

	it("FetchInit accepts Next.js options", () => {
		const init: FetchInit = { next: { revalidate: 60, tags: ["a"] }, cache: "no-store" };
		expectTypeOf(init).toMatchTypeOf<RequestInit>();
	});

	it("registry has only the brand key until augmented", () => {
		expectTypeOf<Exclude<keyof StrapiContentTypes, "__brand">>().toEqualTypeOf<never>();
	});

	it("StrapiMedia has url and mime", () => {
		expectTypeOf<StrapiMedia["url"]>().toEqualTypeOf<string>();
		expectTypeOf<StrapiMedia["mime"]>().toEqualTypeOf<string>();
	});
});
