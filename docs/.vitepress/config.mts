import { defineConfig } from 'vitepress'
import fg from 'fast-glob'
import path from 'node:path'

// docsRoot = repo root (this config lives at docs/.vitepress/config.mts,
// and vitepress is invoked with `docs` as the root).
const repoRoot = path.resolve(__dirname, '../..')

// Discover packages that have their own docs/index.md
const packages = fg
  .sync('packages/*/docs/index.md', { cwd: repoRoot, onlyFiles: true })
  .map((file) => file.split('/')[1])

const titleize = (value) =>
  value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const sidebar = {}

packages.forEach((pkg) => {
  const pages = fg
    .sync(`packages/${pkg}/docs/**/*.md`, {
      cwd: repoRoot,
      onlyFiles: true,
      ignore: [`packages/${pkg}/docs/index.md`],
    })
    .sort()
    .map((file) => {
      const relative = file
        .replace(`packages/${pkg}/docs/`, '')
        .replace(/\.md$/, '')
        .replace(/\/index$/, '/')

      return {
        text: titleize(path.basename(relative)),
        link: `/packages/${pkg}/${relative}`,
      }
    })

  sidebar[`/packages/${pkg}/`] = [
    {
      text: titleize(pkg),
      items: [{ text: 'Overview', link: `/packages/${pkg}/` }, ...pages],
    },
  ]
})

// Map on-disk locations to clean URLs:
//   packages/<pkg>/docs/foo.md  -> /packages/<pkg>/foo
//   docs/foo.md                 -> /foo
const rewrites = {
  'packages/:pkg/docs/:rest(.*)': 'packages/:pkg/:rest',
  'docs/:rest(.*)': ':rest',
}

export default defineConfig({
  title: 'Strapi Tooling',
  description:
    'Typed Strapi 5 client and an admin API plugin for managing admin users and tokens over REST.',

  // The site is served from the custom domain root (strapi.fbritoferreira.com).
  // PR previews land at /pr-preview/pr-N/ — DOCS_BASE lets CI override the
  // base per build so asset and nav URLs resolve in both.
  base: process.env.DOCS_BASE || '/',

  // Serve files from the repo root so packages/*/docs/** is reachable.
  srcDir: '..',
  srcExclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
    '**/coverage/**',
    '.changeset/**',
    '.github/**',
    'research_notes/**',
    'reports/**',
    // Repo readmes are for GitHub, not the docs site — their relative links
    // point at repo paths, not docs routes.
    '**/README.md',
    '**/LICENCE.md',
    '**/CHANGELOG.md',
    '**/MIGRATION.md',
    'CLA.md',
    'SECURITY.md',
  ],
  rewrites,

  themeConfig: {
    nav: [
      {
        text: 'Packages',
        items: packages.map((pkg) => ({
          text: titleize(pkg),
          link: `/packages/${pkg}/`,
        })),
      },
    ],
    sidebar,
    editLink: false,
    socialLinks: [{ icon: 'github', link: 'https://github.com/fbritoferreira/strapi' }],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Filipe Brito Ferreira',
    },
    docFooter: {
      prev: 'Prev',
      next: 'Next',
    },
  },
})
