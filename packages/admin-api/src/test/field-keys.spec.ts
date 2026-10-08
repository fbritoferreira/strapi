import { describe, expectTypeOf, it } from "vitest";

import type { Populate, PopulatableKey, QueryParams, ScalarKey, SortField, StrapiMedia } from "../types";

/** Shape the generator emits: populatable fields listed on the `__populatable` marker. */
interface Article {
	readonly __populatable?: "cover" | "author";
	documentId: string;
	title: string;
	views?: number;
	cover?: StrapiMedia | null;
	author?: { documentId: string; name: string } | null;
}

/** Hand-written type with no marker, as users had before the generator existed. */
interface Plain {
	documentId: string;
	title: string;
	author?: { name: string } | null;
}

describe("scalar and populatable keys", () => {
	it("splits a generated type on its marker", () => {
		expectTypeOf<ScalarKey<Article>>().toEqualTypeOf<"documentId" | "title" | "views">();
		expectTypeOf<PopulatableKey<Article>>().toEqualTypeOf<"cover" | "author">();
	});

	it("treats every key of an unmarked type as selectable", () => {
		expectTypeOf<ScalarKey<Plain>>().toEqualTypeOf<"documentId" | "title" | "author">();
		expectTypeOf<PopulatableKey<Plain>>().toEqualTypeOf<"documentId" | "title" | "author">();
	});

	it("keeps populatable fields out of `fields`", () => {
		const params: QueryParams<Article> = { fields: ["title", "views"] };
		expectTypeOf(params).toEqualTypeOf<QueryParams<Article>>();
		// @ts-expect-error `cover` is populatable; select it with `populate`
		const bad: QueryParams<Article> = { fields: ["cover"] };
		expectTypeOf(bad).toEqualTypeOf<QueryParams<Article>>();
	});

	it("keeps the marker itself out of `fields`", () => {
		// @ts-expect-error `__populatable` is a marker, not a Strapi field
		const bad: QueryParams<Article> = { fields: ["__populatable"] };
		expectTypeOf(bad).toEqualTypeOf<QueryParams<Article>>();
	});

	it("keeps scalar fields out of `populate`", () => {
		expectTypeOf<Populate<Article>>().toMatchTypeOf<unknown>();
		const params: QueryParams<Article> = { populate: ["cover", "author"] };
		expectTypeOf(params).toEqualTypeOf<QueryParams<Article>>();
		// @ts-expect-error `title` is scalar; select it with `fields`
		const bad: QueryParams<Article> = { populate: ["title"] };
		expectTypeOf(bad).toEqualTypeOf<QueryParams<Article>>();
	});

	it("sorts on scalar fields and relation paths", () => {
		const sort: SortField<Article>[] = ["title", "views:desc", "author.name:asc"];
		expectTypeOf(sort).toEqualTypeOf<SortField<Article>[]>();
		// @ts-expect-error `cover` is populatable, not a sortable column
		const bad: SortField<Article>[] = ["cover:asc"];
		expectTypeOf(bad).toEqualTypeOf<SortField<Article>[]>();
	});

	it("keeps the marker out of write payloads", () => {
		expectTypeOf<keyof NonNullable<QueryParams<Article>["filters"]>>().not.toEqualTypeOf<"__populatable">();
	});
});
