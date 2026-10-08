import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { Strapi } from "../index";
import type { ListQueryParams, SelectedDoc, StrapiDocument, StrapiMedia, StrapiUser } from "../types";
import { installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

/** Shapes the generator emits, markers included. */
interface Category extends StrapiDocument {
	readonly __populatable?: "parent" | "articles";
	readonly __relations?: "parent" | "articles";
	name: string;
	slug: string;
	parent?: Category | null;
	articles?: Article[];
}

interface Author extends StrapiDocument {
	readonly __populatable?: "avatar" | "articles" | "account";
	readonly __relations?: "avatar" | "articles" | "account";
	name: string;
	email?: string;
	avatar?: StrapiMedia | null;
	articles?: Article[];
	account?: StrapiUser | null;
}

interface Hero {
	id: number;
	readonly __populatable?: "image";
	readonly __relations?: "image";
	title: string;
	image?: StrapiMedia | null;
}

interface Quote {
	id: number;
	text: string;
}

interface Article extends StrapiDocument {
	readonly __populatable?: "cover" | "author" | "categories" | "editor" | "blocks";
	readonly __relations?: "cover" | "author" | "categories" | "editor";
	title: string;
	slug: string;
	views?: number;
	cover?: StrapiMedia | null;
	author?: Author | null;
	categories?: Category[];
	editor?: StrapiUser | null;
	blocks?: Array<(Hero & { __component: "blocks.hero" }) | (Quote & { __component: "blocks.quote" })>;
}

type Params = ListQueryParams<Article>;

describe("object-form populate takes per-relation options", () => {
	it("accepts fields and a nested populate with its own fields", () => {
		const params: Params = {
			populate: { categories: { fields: ["name"], populate: { parent: { fields: ["slug"] } } } },
		};
		expectTypeOf(params).toEqualTypeOf<Params>();
	});

	it("accepts filters, sort and count on a populated relation", () => {
		const params: Params = {
			populate: {
				categories: { filters: { slug: { $eq: "news" } }, sort: ["name:asc"] },
				author: { populate: { articles: { count: true } } },
			},
		};
		expectTypeOf(params).toEqualTypeOf<Params>();
	});

	it("types the options against the related document", () => {
		// @ts-expect-error `title` is a field of Article, not of Category
		const badField: Params = { populate: { categories: { fields: ["title"] } } };
		// @ts-expect-error `parent` is populatable, so it belongs in `populate`
		const populatable: Params = { populate: { categories: { fields: ["parent"] } } };
		// @ts-expect-error Category has no `author` to populate
		const badPopulate: Params = { populate: { categories: { populate: { author: true } } } };
		// @ts-expect-error `views` is a field of Article, not of Category
		const badFilter: Params = { populate: { categories: { filters: { views: 1 } } } };
		// @ts-expect-error count is a boolean
		const badCount: Params = { populate: { categories: { count: 1 } } };
		expectTypeOf([badField, populatable, badPopulate, badFilter, badCount]).toEqualTypeOf<Params[]>();
	});

	it("still accepts true, the wildcard and a nested populate list", () => {
		const params: Params = { populate: { author: true, cover: "*", categories: { populate: ["parent"] } } };
		expectTypeOf(params).toEqualTypeOf<Params>();
	});

	it("targets dynamic zone components with `on`", () => {
		const params: Params = {
			populate: { blocks: { on: { "blocks.hero": { populate: { image: { fields: ["url"] } } }, "blocks.quote": true } } },
		};
		const wildcard: Params = { populate: { blocks: { populate: "*" } } };
		// @ts-expect-error `blocks.card` is not one of the zone's components
		const badComponent: Params = { populate: { blocks: { on: { "blocks.card": true } } } };
		expectTypeOf([params, wildcard, badComponent]).toEqualTypeOf<Params[]>();
	});

	it("keeps `on` off a relation that is not a dynamic zone", () => {
		// @ts-expect-error fragments are only for dynamic zones
		const params: Params = { populate: { author: { on: { "blocks.hero": true } } } };
		expectTypeOf(params).toEqualTypeOf<Params>();
	});
});

describe("relation filters take operators at every depth", () => {
	it("accepts operators on a to-one relation's id and documentId", () => {
		const params: Params = {
			filters: { author: { id: { $eq: 1 } }, cover: { documentId: { $in: ["a", "b"] } } },
		};
		expectTypeOf(params).toEqualTypeOf<Params>();
	});

	it("accepts operators on a relation to the users-permissions user", () => {
		const params: Params = { filters: { editor: { id: { $eq: 1 }, email: { $endsWith: "@example.com" } } } };
		const deep: Params = { filters: { author: { account: { username: { $eqi: "ada" } } } } };
		expectTypeOf([params, deep]).toEqualTypeOf<Params[]>();
	});

	it("accepts operators two levels down and on to-many relations", () => {
		const params: Params = {
			filters: {
				categories: { parent: { slug: { $eq: "news" } } },
				author: { articles: { slug: { $startsWith: "intro" } } },
			},
		};
		expectTypeOf(params).toEqualTypeOf<Params>();
	});

	it("accepts $and, $or and $not inside a relation", () => {
		const params: Params = {
			filters: {
				author: {
					$or: [{ name: { $eq: "Ada" } }, { account: { blocked: false } }],
					$not: { email: { $null: true } },
				},
				categories: { $and: [{ slug: "a" }, { parent: { name: { $containsi: "x" } } }] },
			},
		};
		expectTypeOf(params).toEqualTypeOf<Params>();
	});

	it("accepts $null on an optional scalar", () => {
		const params: Params = { filters: { views: { $null: true }, author: { email: { $notNull: true } } } };
		expectTypeOf(params).toEqualTypeOf<Params>();
	});

	it("still rejects fields the related document does not have", () => {
		// @ts-expect-error Author has no `slug`
		const bad: Params = { filters: { author: { slug: { $eq: "a" } } } };
		// @ts-expect-error the generator's markers are not filterable
		const marker: Params = { filters: { author: { __relations: "avatar" } } };
		// @ts-expect-error `$eq` on a numeric id takes a number
		const wrongValue: Params = { filters: { author: { id: { $eq: "one" } } } };
		expectTypeOf([bad, marker, wrongValue]).toEqualTypeOf<Params[]>();
	});
});

describe("nested populate narrows the populated documents", () => {
	it("keeps only the nested fields, plus id and documentId", () => {
		type Selected = SelectedDoc<Article, { populate: { author: { fields: ["name"] } } }>;
		expectTypeOf<Selected["author"]>().toEqualTypeOf<{ id: number; documentId: string; name: string } | null>();
	});

	it("narrows to-many relations element by element, at every depth", () => {
		type Selected = SelectedDoc<
			Article,
			{ populate: { categories: { fields: ["name"]; populate: { parent: { fields: ["slug"] } } } } }
		>;
		type Row = Selected["categories"][number];
		expectTypeOf<Row["name"]>().toEqualTypeOf<string>();
		expectTypeOf<Row["parent"]>().toEqualTypeOf<{ id: number; documentId: string; slug: string } | null>();
		expectTypeOf<Row>().not.toHaveProperty("slug");
		expectTypeOf<Row>().not.toHaveProperty("articles");
	});

	it("answers a count for a relation populated with count", () => {
		type Selected = SelectedDoc<Article, { populate: { categories: { count: true } } }>;
		expectTypeOf<Selected["categories"]>().toEqualTypeOf<{ count: number }>();
	});

	it("keeps the related document whole for true, the wildcard and a dynamic zone", () => {
		type Selected = SelectedDoc<Article, { populate: { author: true; cover: "*"; blocks: { on: { "blocks.quote": true } } } }>;
		expectTypeOf<Selected["author"]>().toEqualTypeOf<Author | null>();
		expectTypeOf<Selected["cover"]>().toEqualTypeOf<StrapiMedia | null>();
		expectTypeOf<Selected["blocks"]>().toEqualTypeOf<NonNullable<Article["blocks"]>>();
	});
});

describe("nested params on the wire", () => {
	let fetchMock: FetchMock;
	const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });
	const articles = strapi.collection<Article>("articles");

	beforeEach(() => {
		fetchMock = installFetchMock();
	});
	afterEach(() => vi.restoreAllMocks());

	it("serialises nested populate options and relation operators the way Strapi reads them", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ data: [{ id: 1, documentId: "a", title: "A", slug: "a", author: { id: 2, documentId: "b", name: "Ada" } }] })
		);
		const [err, data] = await articles.findMany({
			params: {
				fields: ["title"],
				populate: { author: { fields: ["name"], populate: { articles: { count: true } } } },
				filters: { editor: { id: { $eq: 1 } } },
			},
		});
		if (err) throw new Error(err.message);
		expectTypeOf(data[0]?.author?.articles).toEqualTypeOf<{ count: number } | undefined>();
		expect(data[0]?.author?.name).toBe("Ada");
		expect(decodeURIComponent(lastCall(fetchMock).url)).toBe(
			"http://h/api/articles?fields[0]=title&populate[author][fields][0]=name&populate[author][populate][articles][count]=true&filters[editor][id][$eq]=1"
		);
	});
});
