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
