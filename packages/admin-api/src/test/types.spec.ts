import { describe, expectTypeOf, it } from "vitest";

import type {
	FetchInit,
	SortField,
	StrapiDocument,
	StrapiErrorBody,
	StrapiMedia,
	StrapiPagination,
	StrapiResponse,
	StrapiSingleResponse,
} from "../types";
import type { RegistryKey, Uid } from "../strapi";

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

	it("RegistryKey drops the brand marker", () => {
		expectTypeOf<RegistryKey<{ readonly __brand?: never }>>().toEqualTypeOf<never>();
		expectTypeOf<RegistryKey<{ readonly __brand?: never; articles: { a: 1 } }>>().toEqualTypeOf<"articles">();
	});

	it("Uid falls back to string while the registry is empty", () => {
		expectTypeOf<Uid<{ readonly __brand?: never }>>().toEqualTypeOf<string>();
	});

	it("Uid narrows to the registry keys once augmented", () => {
		expectTypeOf<Uid<{ readonly __brand?: never; articles: { a: 1 } }>>().toEqualTypeOf<"articles">();
	});

	it("SortField accepts document keys, directions and relation paths", () => {
		interface Doc {
			title: string;
			author: { name: string };
		}
		const sort: SortField<Doc>[] = ["title", "title:asc", "author.name:asc"];
		expectTypeOf(sort).toEqualTypeOf<SortField<Doc>[]>();
	});

	it("SortField rejects a field the document does not have", () => {
		interface Doc {
			title: string;
		}
		// @ts-expect-error "ttile" is not a key of Doc
		const sort: SortField<Doc>[] = ["ttile:asc"];
		expectTypeOf(sort).toEqualTypeOf<SortField<Doc>[]>();
	});

	it("StrapiMedia has url and mime", () => {
		expectTypeOf<StrapiMedia["url"]>().toEqualTypeOf<string>();
		expectTypeOf<StrapiMedia["mime"]>().toEqualTypeOf<string>();
	});
});
