/**
 * Compile-time proof that generated types and the client agree. Type-checked by
 * `tsconfig.cli-fixture.json`, never executed: the registry augmentation in
 * `expected-output.ts` has to make `collection("articles")` return an Article
 * client, and the `__populatable` marker has to split `fields` from `populate`.
 */
import { Strapi } from "@fbritoferreira/strapi";

import "./expected-output";

const strapi = new Strapi({ baseURL: "http://localhost:1337", defaultLocale: "en" });
const articles = strapi.collection("articles");
const homepage = strapi.single("homepage");

export async function narrowed() {
	const [, list] = await articles.findMany({ params: { fields: ["title", "slug"] } });
	const first = list?.[0];
	// Only the selected fields, plus the id pair Strapi always returns.
	const shape: { id: number; documentId: string; title: string; slug: string } | undefined = first;

	const [, populated] = await articles.findMany({ params: { populate: ["author"] } });
	const withAuthor = populated?.[0];
	const author: { name: string } | null | undefined = withAuthor?.author;

	return [shape, author] as const;
}

export async function writes() {
	// Relations and media by reference; components inline.
	await articles.create({
		payload: {
			data: {
				title: "Hello",
				slug: "hello",
				author: "author-document-id",
				tags: ["tag-1", "tag-2"],
				cover: { id: 7 },
				seo: { metaTitle: "Hello" },
			},
		},
	});

	// The longhand, including ordering.
	await articles.update({
		documentId: "a",
		payload: { data: { tags: { connect: [{ documentId: "tag-3", position: { end: true } }], disconnect: ["tag-1"] } } },
	});
}

export async function rejectedWrites() {
	// @ts-expect-error a relation takes a reference, not the related document
	await articles.create({ payload: { data: { author: { name: "Ada" } } } });
	// @ts-expect-error author is a to-one relation
	await articles.create({ payload: { data: { author: ["a", "b"] } } });
}

export async function rejectedSelections() {
	const [, list] = await articles.findMany();
	// @ts-expect-error author was not populated, so Strapi does not return it
	void list?.[0]?.author;
	const [, selected] = await articles.findMany({ params: { fields: ["title"] } });
	// @ts-expect-error slug was not selected
	void selected?.[0]?.slug;
}

export async function reads() {
	const [, list] = await articles.findMany({
		params: {
			fields: ["title", "slug"],
			populate: ["author", "tags", "cover"],
			sort: ["title:asc", "author.name:desc"],
			filters: { featured: true },
			pagination: { pageSize: 10 },
			status: "draft",
		},
	});
	const [, page] = await homepage.find({ params: { populate: { hero: { populate: ["image"] } } } });
	return [list?.[0]?.title, page?.heading] as const;
}

export async function nested() {
	const [, list] = await articles.findMany({
		params: {
			fields: ["title"],
			populate: {
				author: { fields: ["name"], populate: { articles: { fields: ["slug"], sort: ["slug:asc"] } } },
				tags: { count: true },
				blocks: { on: { "blocks.hero": { populate: { image: { fields: ["url"] } } }, "blocks.quote": true } },
			},
			filters: {
				createdByUser: { id: { $eq: 1 } },
				author: { documentId: { $in: ["a", "b"] }, articles: { slug: { $startsWith: "intro" } } },
				$or: [{ tags: { label: { $eqi: "news" } } }, { seo: { metaTitle: { $null: true } } }],
			},
		},
	});
	const author: { name: string; articles: { slug: string }[] } | null | undefined = list?.[0]?.author;
	const tags: { count: number } | undefined = list?.[0]?.tags;
	return [author, tags] as const;
}

export async function rejected() {
	// @ts-expect-error `cover` is populatable, so it is not a `fields` entry
	await articles.findMany({ params: { fields: ["cover"] } });
	// @ts-expect-error `title` is scalar, so it is not a `populate` entry
	await articles.findMany({ params: { populate: ["title"] } });
	// @ts-expect-error the marker is not a Strapi field
	await articles.findMany({ params: { fields: ["__populatable"] } });
	// @ts-expect-error unknown uid; the registry declares articles, authors and tags
	strapi.collection("aritcles");
}
