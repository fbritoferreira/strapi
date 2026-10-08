/**
 * The Recipes section of the README, compiled. Type-checked by
 * `tsconfig.cli-fixture.json` and never executed: if an example here stops
 * compiling, the README is wrong.
 */
import { Strapi, type StrapiDocument, type StrapiMedia } from "@fbritoferreira/strapi";

interface Article extends StrapiDocument {
	readonly __populatable?: "cover" | "author";
	title: string;
	slug: string;
	body: string;
	cover?: StrapiMedia | null;
	author?: { documentId: string; name: string } | null;
}

const strapi = new Strapi({ baseURL: "http://localhost:1337", defaultLocale: "en" });
const articles = strapi.collection<Article>("articles");

// 1. Search, then walk every page
export async function search(term: string) {
	const [err, all] = await articles.findMany({
		params: { _q: term, sort: ["publishedAt:desc"], pagination: { pageSize: 100 } },
		all: true,
	});
	if (err) return [];
	return all;
}

// 2. A list view only needs a few columns
export async function listing() {
	const [err, rows] = await articles.findMany({
		params: { fields: ["title", "slug"], populate: ["cover"], pagination: { pageSize: 20 } },
	});
	if (err) throw new Error(err.message);
	return rows.map((row) => ({ title: row.title, href: `/blog/${row.slug}`, image: row.cover?.url }));
}

// 3. Upsert by slug
export async function publish(slug: string, title: string) {
	const [err, article] = await articles.upsert({
		payload: { data: { slug, title, body: "…" } },
		filters: { slug: { $eq: slug } },
		params: { status: "published" },
	});
	if (err) throw new Error(err.message);
	return article;
}

// 4. Upload a file and attach it in one call
export async function attachCover(documentId: string, file: File) {
	const [err, uploaded] = await strapi.files.upload({
		files: file,
		ref: "api::article.article",
		refId: documentId,
		field: "cover",
	});
	if (err) throw new Error(err.message);
	return uploaded[0];
}

// 5. Sign in, keep the session, refresh it later
export async function signIn(identifier: string, password: string) {
	const [err, session] = await strapi.auth.login({ identifier, password });
	if (err) throw new Error(err.message);
	strapi.setToken(session.jwt);

	if (session.refreshToken !== undefined) {
		const [refreshErr, refreshed] = await strapi.auth.refresh({ refreshToken: session.refreshToken });
		if (!refreshErr) strapi.setToken(refreshed.jwt);
	}
	return session.user;
}

// 6. Next.js: cache a read and revalidate it by tag
export async function cachedArticles() {
	const [err, data] = await articles.findMany({
		params: { fields: ["title", "slug"] },
		init: { next: { revalidate: 3600, tags: ["articles"] } },
	});
	if (err) throw new Error(err.message);
	return data;
}

// 7. One localization at a time
export async function translate(documentId: string, title: string) {
	return articles.update({ documentId, payload: { data: { title } }, locale: "fr" });
}
