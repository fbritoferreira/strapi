import { describe, expect, it } from "vitest";

import { loadFromDir } from "../../cli/load-dir";
import { normalize, pascalCase } from "../../cli/normalize";
import { MEDIA_UID, type ComponentEntry, type ContentTypeEntry, type SchemaSet } from "../../cli/schema";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../../cli/__fixtures__/project", import.meta.url));

function field(model: ReturnType<typeof normalize>, typeName: string, fieldName: string) {
	const type = model.types.find((t) => t.name === typeName);
	if (!type) throw new Error(`no type ${typeName}`);
	const f = type.fields.find((x) => x.name === fieldName);
	if (!f) throw new Error(`no field ${typeName}.${fieldName}`);
	return f;
}

describe("pascalCase", () => {
	it.each([
		["article", "Article"],
		["blog-post", "BlogPost"],
		["blog_post", "BlogPost"],
		["blogPost", "BlogPost"],
		["seo", "Seo"],
		["2fa-code", "_2faCode"],
	])("%s → %s", (input, expected) => {
		expect(pascalCase(input)).toBe(expected);
	});
});

describe("normalize (fixture project)", () => {
	it("names and orders types: components first, then content types", async () => {
		const model = normalize(await loadFromDir(project), { includePlugins: false });
		expect(model.types.map((t) => `${t.kind}:${t.name}`)).toEqual([
			"component:BlocksHero",
			"component:BlocksQuote",
			"component:SharedSeo",
			"collection:Article",
			"collection:Author",
			"single:Homepage",
			"collection:Tag",
		]);
	});

	it("builds the registry from pluralName / singularName", async () => {
		const model = normalize(await loadFromDir(project), { includePlugins: false });
		expect(model.collections).toEqual([
			{ key: "articles", typeName: "Article" },
			{ key: "authors", typeName: "Author" },
			{ key: "tags", typeName: "Tag" },
		]);
		expect(model.singles).toEqual([{ key: "homepage", typeName: "Homepage" }]);
	});

	it("maps scalar attributes", async () => {
		const model = normalize(await loadFromDir(project), { includePlugins: false });
		expect(field(model, "Article", "title")).toMatchObject({ tsType: "string", optional: false });
		expect(field(model, "Article", "slug")).toMatchObject({ tsType: "string", optional: false });
		expect(field(model, "Article", "summary")).toMatchObject({ tsType: "string", optional: true });
		expect(field(model, "Article", "readingTime").tsType).toBe("number");
		expect(field(model, "Article", "price").tsType).toBe("number");
		expect(field(model, "Article", "views").tsType).toBe("string");
		expect(field(model, "Article", "featured")).toMatchObject({ tsType: "boolean", optional: false });
		expect(field(model, "Article", "publishedOn").tsType).toBe("string");
		expect(field(model, "Article", "metadata").tsType).toBe("unknown");
		expect(field(model, "Article", "body").tsType).toBe("StrapiBlock[]");
		expect(field(model, "Article", "status")).toMatchObject({ tsType: '"draft" | "review" | "live"', optional: false });
	});

	it("maps media, relations, components and dynamic zones as optional populated fields", async () => {
		const model = normalize(await loadFromDir(project), { includePlugins: false });
		expect(field(model, "Article", "cover")).toMatchObject({ tsType: "StrapiMedia | null", optional: true });
		expect(field(model, "Article", "gallery").tsType).toBe("StrapiMedia[]");
		expect(field(model, "Article", "author")).toMatchObject({ tsType: "Author | null", optional: true, doc: "relation manyToOne → api::author.author" });
		expect(field(model, "Article", "tags").tsType).toBe("Tag[]");
		expect(field(model, "Article", "createdByUser").tsType).toBe("StrapiUser | null");
		expect(field(model, "Article", "seo").tsType).toBe("SharedSeo | null");
		expect(field(model, "Author", "links").tsType).toBe("SharedSeo[]");
		expect(field(model, "Article", "blocks").tsType).toBe(
			'Array<(BlocksHero & { __component: "blocks.hero" }) | (BlocksQuote & { __component: "blocks.quote" })>'
		);
		expect(field(model, "Author", "articles").tsType).toBe("Article[]");
		expect(field(model, "Homepage", "featuredArticle").tsType).toBe("Article | null");
	});

	it("marks localized content types and usage flags", async () => {
		const model = normalize(await loadFromDir(project), { includePlugins: false });
		expect(model.types.find((t) => t.name === "Article")?.localized).toBe(true);
		expect(model.types.find((t) => t.name === "Tag")?.localized).toBe(false);
		expect(model.types.find((t) => t.name === "SharedSeo")?.localized).toBe(false);
		expect(model.usesMedia).toBe(true);
		expect(model.usesUser).toBe(true);
		expect(model.usesBlocks).toBe(true);
	});
});

describe("normalize (edge cases)", () => {
	const base = (
		attributes: Record<string, unknown>,
		extra: { contentTypes?: [string, ContentTypeEntry][]; components?: [string, ComponentEntry][] } = {}
	): SchemaSet => ({
		contentTypes: new Map([
			["api::thing.thing", { uid: "api::thing.thing", schema: { kind: "collectionType", info: { singularName: "thing", pluralName: "things", displayName: "Thing" }, attributes: attributes as never } }],
			...(extra.contentTypes ?? []),
		]),
		components: new Map(extra.components ?? []),
	});

	it("skips private attributes", () => {
		const model = normalize(base({ secret: { type: "string", private: true }, shown: { type: "string" } }), { includePlugins: false });
		expect(model.types[0]?.fields.map((f) => f.name)).toEqual(["shown"]);
	});

	it("falls back to unknown for unsupported types, unknown relation targets and unknown components", () => {
		const model = normalize(
			base({
				weird: { type: "customThing", customField: "plugin::color-picker.color" },
				rel: { type: "relation", relation: "oneToOne", target: "api::missing.missing" },
				comp: { type: "component", component: "nope.nope" },
				zone: { type: "dynamiczone", components: ["nope.nope"] },
			}),
			{ includePlugins: false }
		);
		const fields = Object.fromEntries(model.types[0]!.fields.map((f) => [f.name, f]));
		expect(fields["weird"]).toMatchObject({ tsType: "unknown", doc: "unsupported attribute type customThing" });
		expect(fields["rel"]).toMatchObject({ tsType: "unknown", doc: "relation oneToOne → api::missing.missing (not generated)" });
		expect(fields["comp"]).toMatchObject({ tsType: "unknown", doc: "component nope.nope (not generated)" });
		expect(fields["zone"]?.tsType).toBe("unknown[]");
	});

	it("enumeration without values becomes string", () => {
		const model = normalize(base({ e: { type: "enumeration" } }), { includePlugins: false });
		expect(model.types[0]?.fields[0]?.tsType).toBe("string");
	});

	it("includes plugin content types only with includePlugins, never media or user", () => {
		const withPlugins = base(
			{},
			{
				contentTypes: [
					["plugin::users-permissions.role", { uid: "plugin::users-permissions.role", schema: { kind: "collectionType", info: { singularName: "role", pluralName: "roles", displayName: "Role" }, attributes: { name: { type: "string" } } } }],
					["plugin::upload.file", { uid: "plugin::upload.file", schema: { kind: "collectionType", info: { singularName: "file", pluralName: "files", displayName: "File" }, attributes: {} } }],
					["plugin::users-permissions.user", { uid: "plugin::users-permissions.user", schema: { kind: "collectionType", info: { singularName: "user", pluralName: "users", displayName: "User" }, attributes: {} } }],
				],
			}
		);
		expect(normalize(withPlugins, { includePlugins: false }).types.map((t) => t.name)).toEqual(["Thing"]);
		expect(normalize(withPlugins, { includePlugins: true }).types.map((t) => t.name)).toEqual(["Role", "Thing"]);
	});

	it("throws on a type-name collision naming both uids", () => {
		const set = base(
			{},
			{
				contentTypes: [["api::other.thing", { uid: "api::other.thing", schema: { kind: "collectionType", info: { singularName: "thing", pluralName: "other-things", displayName: "Thing 2" }, attributes: {} } }]],
			}
		);
		expect(() => normalize(set, { includePlugins: false })).toThrow(/api::thing\.thing.*api::other\.thing|api::other\.thing.*api::thing\.thing/);
	});

	it("does not mutate the input set", () => {
		const set = base({ a: { type: "string" } });
		const before = JSON.stringify([...set.contentTypes]);
		normalize(set, { includePlugins: false });
		expect(JSON.stringify([...set.contentTypes])).toBe(before);
	});

	it("covers a component uid without a dot, a relation to media, and dynamiczones with no or empty components", () => {
		const set = base(
			{
				mediaRel: { type: "relation", relation: "manyToOne", target: MEDIA_UID },
				emptyZone: { type: "dynamiczone", components: [] },
				noComponentsKey: { type: "dynamiczone" },
				noComponentUid: { type: "component" },
			},
			{
				components: [["solo", { uid: "solo", category: "solo", schema: { info: { displayName: "Solo" }, attributes: {} } }]],
			}
		);
		const model = normalize(set, { includePlugins: false });
		const thing = model.types.find((t) => t.name === "Thing");
		if (!thing) throw new Error("no type Thing");
		const fields = Object.fromEntries(thing.fields.map((f) => [f.name, f]));
		expect(fields["mediaRel"]).toMatchObject({ tsType: "StrapiMedia | null" });
		expect(fields["emptyZone"]?.tsType).toBe("unknown[]");
		expect(fields["noComponentsKey"]?.tsType).toBe("unknown[]");
		expect(fields["noComponentUid"]).toMatchObject({ tsType: "unknown" });
		expect(model.types.find((t) => t.name === "Solo")).toBeDefined();
	});
});
