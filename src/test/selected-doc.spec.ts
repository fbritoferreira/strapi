import { describe, expectTypeOf, it } from "vitest";

import type { ListQueryParams, SelectedDoc, StrapiDocument, StrapiMedia } from "../types";

/** Shape the generator emits. */
interface Article extends StrapiDocument {
	readonly __populatable?: "cover" | "author";
	title: string;
	views?: number;
	cover?: StrapiMedia | null;
	author?: { documentId: string; name: string } | null;
}

/** Hand-written type: no marker, so nothing is narrowed. */
interface Plain {
	documentId: string;
	title: string;
	author?: { name: string } | null;
}

describe("SelectedDoc", () => {
	it("drops populatable fields when nothing is populated", () => {
		expectTypeOf<keyof SelectedDoc<Article, object>>().toEqualTypeOf<
			"id" | "documentId" | "createdAt" | "updatedAt" | "publishedAt" | "locale" | "title" | "views"
		>();
	});

	it("keeps only the selected fields, plus id and documentId", () => {
		expectTypeOf<SelectedDoc<Article, { fields: readonly ["title"] }>>().toEqualTypeOf<{
			id: number;
			documentId: string;
			title: string;
		}>();
	});

	it("adds populated relations, no longer optional", () => {
		type Selected = SelectedDoc<Article, { fields: readonly ["title"]; populate: readonly ["author"] }>;
		expectTypeOf<Selected["author"]>().toEqualTypeOf<{ documentId: string; name: string } | null>();
		expectTypeOf<Selected["title"]>().toEqualTypeOf<string>();
	});

	it("takes the first segment of a dotted populate path", () => {
		type Selected = SelectedDoc<Article, { populate: readonly ["author.avatar"] }>;
		expectTypeOf<Selected["author"]>().toEqualTypeOf<{ documentId: string; name: string } | null>();
	});

	it("populates everything for a wildcard", () => {
		type Selected = SelectedDoc<Article, { populate: "*" }>;
		expectTypeOf<Selected["cover"]>().toEqualTypeOf<StrapiMedia | null>();
		expectTypeOf<Selected["author"]>().toEqualTypeOf<{ documentId: string; name: string } | null>();
	});

	it("reads a populate map by its keys", () => {
		type Selected = SelectedDoc<Article, { populate: { author: true } }>;
		expectTypeOf<Selected["author"]>().toEqualTypeOf<{ documentId: string; name: string } | null>();
		expectTypeOf<Selected>().not.toHaveProperty("cover");
	});

	it("keeps every field when the params are not literal", () => {
		expectTypeOf<SelectedDoc<Article, ListQueryParams<Article>>>().toEqualTypeOf<Article>();
	});

	it("leaves a type with no marker alone", () => {
		expectTypeOf<SelectedDoc<Plain, { fields: readonly ["title"] }>>().toEqualTypeOf<Plain>();
	});
});
