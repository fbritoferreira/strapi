import { describe, expectTypeOf, it } from "vitest";

import { Strapi } from "../index";
import type {
	DeleteQueryParams,
	FindQueryParams,
	ListQueryParams,
	PublicationFilter,
	QueryParams,
	WriteQueryParams,
} from "../types";

interface Article {
	documentId: string;
	title: string;
}

const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });
const articles = strapi.collection<Article>("articles");
const homepage = strapi.single<Article>("homepage");

describe("query params follow the route contract", () => {
	it("PublicationFilter matches the values Strapi accepts", () => {
		expectTypeOf<PublicationFilter>().toEqualTypeOf<
			| "never-published"
			| "has-published-version"
			| "modified"
			| "unmodified"
			| "never-published-document"
			| "has-published-version-document"
			| "published-without-draft"
			| "published-with-draft"
		>();
	});

	it("rejects a publicationFilter Strapi answers with a 400", () => {
		// @ts-expect-error "all" is not one of Strapi's publication cohorts
		const params: QueryParams<Article> = { publicationFilter: "all" };
		expectTypeOf(params).toEqualTypeOf<QueryParams<Article>>();
	});

	it("carries the _q search param", () => {
		expectTypeOf<QueryParams<Article>["_q"]>().toEqualTypeOf<string | undefined>();
	});

	it("gives list routes pagination, sort and _q", () => {
		expectTypeOf<keyof ListQueryParams<Article>>().toEqualTypeOf<
			| "fields"
			| "filters"
			| "sort"
			| "populate"
			| "pagination"
			| "_q"
			| "locale"
			| "status"
			| "publicationFilter"
			| "hasPublishedVersion"
			| "publicationState"
		>();
		articles.findMany({ params: { pagination: { pageSize: 10 }, sort: ["title:asc"], _q: "hi" } });
	});

	it("keeps pagination and _q off the single-document read route", () => {
		expectTypeOf<keyof FindQueryParams<Article>>().toEqualTypeOf<
			| "fields"
			| "filters"
			| "sort"
			| "populate"
			| "locale"
			| "status"
			| "publicationFilter"
			| "hasPublishedVersion"
			| "publicationState"
		>();
		// @ts-expect-error GET /api/<uid>/<documentId> takes no pagination
		articles.find({ documentId: "a", params: { pagination: { pageSize: 10 } } });
		// @ts-expect-error GET /api/<uid>/<documentId> takes no _q
		articles.find({ documentId: "a", params: { _q: "hi" } });
	});

	it("keeps reads off the write routes", () => {
		expectTypeOf<keyof WriteQueryParams<Article>>().toEqualTypeOf<
			"fields" | "populate" | "locale" | "status" | "publicationFilter" | "hasPublishedVersion" | "publicationState"
		>();
		// @ts-expect-error POST /api/<uid> takes no sort
		articles.create({ payload: { data: { title: "a" } }, params: { sort: ["title:asc"] } });
		// @ts-expect-error PUT /api/<uid>/<documentId> takes no filters
		articles.update({ documentId: "a", payload: { data: {} }, params: { filters: { title: "a" } } });
	});

	it("gives delete routes filters but no sort", () => {
		expectTypeOf<keyof DeleteQueryParams<Article>>().toEqualTypeOf<
			"fields" | "filters" | "populate" | "locale" | "status" | "publicationFilter" | "hasPublishedVersion" | "publicationState"
		>();
	});

	it("applies the same contract to single types", () => {
		// @ts-expect-error GET /api/<uid> for a single type takes no pagination
		homepage.find({ params: { pagination: { pageSize: 1 } } });
		// @ts-expect-error PUT /api/<uid> for a single type takes no sort
		homepage.update({ payload: { data: {} }, params: { sort: ["title:asc"] } });
	});
});
