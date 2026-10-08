import { describe, expectTypeOf, it } from "vitest";

import type { CreatePayload, DeepPartial, StrapiDocument, StrapiMedia, WriteData } from "../types";

interface Seo {
	id: number;
	metaTitle: string;
}

/** Shape the generator emits: relations and media are listed on `__relations` too. */
interface Article extends StrapiDocument {
	readonly __populatable?: "cover" | "gallery" | "author" | "tags" | "seo";
	readonly __relations?: "cover" | "gallery" | "author" | "tags";
	title: string;
	cover?: StrapiMedia | null;
	gallery?: StrapiMedia[];
	author?: { documentId: string; name: string } | null;
	tags?: { documentId: string; label: string }[];
	seo?: Seo | null;
}

/** Hand-written type with no markers. */
interface Plain {
	documentId: string;
	title: string;
	author?: { name: string } | null;
}

describe("WriteData", () => {
	it("takes a documentId for a to-one relation", () => {
		const data: WriteData<Article> = { title: "A", author: "doc-1" };
		expectTypeOf(data).toEqualTypeOf<WriteData<Article>>();
	});

	it("takes the longhand, with locale, status and position", () => {
		const data: WriteData<Article> = {
			author: { documentId: "doc-1", locale: "fr", status: "published" },
			cover: { id: 7, position: { end: true } },
		};
		expectTypeOf(data).toEqualTypeOf<WriteData<Article>>();
	});

	it("takes arrays for a to-many relation", () => {
		const data: WriteData<Article> = { tags: ["t1", "t2"], gallery: [{ id: 1 }, { id: 2 }] };
		expectTypeOf(data).toEqualTypeOf<WriteData<Article>>();
	});

	it("takes connect, disconnect and set", () => {
		const data: WriteData<Article> = {
			tags: { connect: [{ documentId: "t1", position: { start: true } }], disconnect: ["t2"] },
			author: { set: "doc-2" },
		};
		expectTypeOf(data).toEqualTypeOf<WriteData<Article>>();
	});

	it("clears a to-one relation with null", () => {
		const data: WriteData<Article> = { author: null };
		expectTypeOf(data).toEqualTypeOf<WriteData<Article>>();
	});

	it("refuses an embedded document for a relation", () => {
		// @ts-expect-error Strapi takes a reference here, not the related document
		const data: WriteData<Article> = { author: { name: "Ada" } };
		expectTypeOf(data).toEqualTypeOf<WriteData<Article>>();
	});

	it("refuses an array for a to-one relation", () => {
		// @ts-expect-error author is a to-one relation
		const data: WriteData<Article> = { author: ["doc-1", "doc-2"] };
		expectTypeOf(data).toEqualTypeOf<WriteData<Article>>();
	});

	it("keeps components nested, since they are embedded rather than related", () => {
		const data: WriteData<Article> = { seo: { metaTitle: "Hello" } };
		expectTypeOf(data).toEqualTypeOf<WriteData<Article>>();
	});

	it("keeps the markers out of the payload", () => {
		expectTypeOf<keyof WriteData<Article>>().toEqualTypeOf<
			"id" | "documentId" | "createdAt" | "updatedAt" | "publishedAt" | "locale" | "title" | "cover" | "gallery" | "author" | "tags" | "seo"
		>();
	});

	it("leaves a type with no markers on the old behaviour", () => {
		expectTypeOf<WriteData<Plain>>().toEqualTypeOf<DeepPartial<Plain>>();
	});

	it("is what create and update payloads carry", () => {
		expectTypeOf<CreatePayload<Article>["data"]>().toEqualTypeOf<WriteData<Article>>();
	});
});
