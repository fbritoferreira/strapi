import { describe, expectTypeOf, it } from "vitest";

import { StrapiClient } from "../client";
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
		"registry-test-articles": Article;
	}
	interface StrapiSingleTypes {
		"registry-test-homepage": Homepage;
	}
}

describe("registry augmentation", () => {
	const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });

	it("infers T from StrapiContentTypes", () => {
		expectTypeOf(strapi.collection("registry-test-articles")).toEqualTypeOf<CollectionClient<Article>>();
		expectTypeOf(strapi.single("registry-test-homepage")).toEqualTypeOf<SingleTypeClient<Homepage>>();
	});

	it("still allows an explicit type argument", () => {
		expectTypeOf(strapi.collection<Homepage>("registry-test-articles")).toEqualTypeOf<
			CollectionClient<Homepage>
		>();
	});

	it("rejects a uid the registry does not declare", () => {
		// @ts-expect-error "not-registered" is not a key of StrapiContentTypes
		strapi.collection("not-registered");
		// @ts-expect-error "not-registered" is not a key of StrapiSingleTypes
		strapi.single("not-registered");
	});

	it("takes an unregistered uid with an explicit type argument", () => {
		expectTypeOf(strapi.collection<Article>("not-registered")).toEqualTypeOf<CollectionClient<Article>>();
		expectTypeOf(strapi.single<Homepage>("not-registered")).toEqualTypeOf<SingleTypeClient<Homepage>>();
	});

	it("constrains the StrapiClient uid to the registry", () => {
		const config = { baseURL: "http://h", defaultLocale: "en" };
		expectTypeOf(new StrapiClient<Article>({ ...config, uid: "registry-test-articles" })).toEqualTypeOf<
			StrapiClient<Article>
		>();
		// @ts-expect-error "not-registered" is not a key of StrapiContentTypes
		new StrapiClient<Article>({ ...config, uid: "not-registered" });
	});
});
