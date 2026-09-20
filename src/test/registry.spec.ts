import { describe, expectTypeOf, it } from "vitest";

import { Strapi, type CollectionClient, type SingleTypeClient } from "../index";

interface Article {
	documentId: string;
	title: string;
}
interface Homepage {
	documentId: string;
	heading: string;
}

declare module "../index" {
	interface StrapiContentTypes {
		articles: Article;
	}
	interface StrapiSingleTypes {
		homepage: Homepage;
	}
}

describe("registry augmentation", () => {
	const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });

	it("infers T from StrapiContentTypes", () => {
		expectTypeOf(strapi.collection("articles")).toEqualTypeOf<CollectionClient<Article>>();
		expectTypeOf(strapi.single("homepage")).toEqualTypeOf<SingleTypeClient<Homepage>>();
	});

	it("still allows an explicit type argument and unknown uids", () => {
		expectTypeOf(strapi.collection<Homepage>("articles")).toEqualTypeOf<CollectionClient<Homepage>>();
		expectTypeOf(strapi.collection("not-registered")).toEqualTypeOf<CollectionClient<object>>();
	});
});
