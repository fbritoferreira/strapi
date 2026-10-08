import { defineConfig } from "vitepress";

export default defineConfig({
	title: "@fbritoferreira/strapi",
	description:
		"TypeScript client for the Strapi 5 REST and GraphQL APIs. Typed collections, auth, uploads and custom routes, with types generated from your schema.",
	base: "/strapi/packages/client/",
	lang: "en-US",
	lastUpdated: true,
	cleanUrls: false,
	themeConfig: {
		outline: [2, 3],
		search: { provider: "local" },
		nav: [
			{ text: "Guide", link: "/guide/installation" },
			{ text: "Codegen", link: "/codegen/content-types" },
			{ text: "GraphQL", link: "/graphql/" },
			{ text: "Reference", link: "/reference/configuration" },
		],
		sidebar: {
			"/guide/": [
				{
					text: "Start",
					items: [
						{ text: "Installation", link: "/guide/installation" },
						{ text: "Quick start", link: "/guide/quick-start" },
						{ text: "Configuration", link: "/guide/configuration" },
					],
				},
				{
					text: "REST",
					items: [
						{ text: "Collections", link: "/guide/collections" },
						{ text: "Single types", link: "/guide/single-types" },
						{ text: "Querying", link: "/guide/querying" },
						{ text: "Writing", link: "/guide/writing" },
						{ text: "Pagination", link: "/guide/pagination" },
						{ text: "i18n", link: "/guide/i18n" },
					],
				},
				{
					text: "Plugins",
					items: [
						{ text: "Authentication", link: "/guide/authentication" },
						{ text: "Users", link: "/guide/users" },
						{ text: "Uploads", link: "/guide/uploads" },
					],
				},
				{
					text: "Transport",
					items: [
						{ text: "Errors", link: "/guide/errors" },
						{ text: "Retries", link: "/guide/retries" },
						{ text: "Fetch, Next.js and abort", link: "/guide/fetch" },
					],
				},
			],
			"/codegen/": [
				{
					text: "Generating types",
					items: [
						{ text: "Content types", link: "/codegen/content-types" },
						{ text: "One config file", link: "/codegen/config" },
						{ text: "Watch mode", link: "/codegen/watch" },
						{ text: "OpenAPI routes", link: "/codegen/openapi" },
					],
				},
			],
			"/graphql/": [
				{
					text: "GraphQL",
					items: [{ text: "Operations", link: "/graphql/" }],
				},
			],
			"/reference/": [
				{
					text: "Reference",
					items: [
						{ text: "Configuration", link: "/reference/configuration" },
						{ text: "CLI", link: "/reference/cli" },
						{ text: "Types", link: "/reference/types" },
						{ text: "Recipes", link: "/reference/recipes" },
						{ text: "Migrating from 0.4", link: "/reference/migrating" },
					],
				},
			],
		},
		socialLinks: [{ icon: "github", link: "https://github.com/fbritoferreira/strapi" }],
		footer: {
			message: "Released under the MIT License.",
			copyright: "Copyright © Filipe Brito Ferreira",
		},
		editLink: {
			pattern: "https://github.com/fbritoferreira/strapi/edit/main/docs/:path",
			text: "Edit this page",
		},
	},
});
