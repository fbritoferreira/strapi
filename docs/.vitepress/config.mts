import { defineConfig } from 'vitepress'
import fg from 'fast-glob'
import path from 'node:path'

const docsRoot = path.resolve(__dirname, '..')

// Find all packages
const packages = fg
  .sync('packages/*/index.md', {
    cwd: docsRoot,
    onlyFiles: true
  })
  .map((file) => {
    const pkgName = file.split('/')[1]
    return {
      name: pkgName,
      path: path.join(docsRoot, 'packages', pkgName, 'index.md')
    }
  })

const titleize = (value: string) =>
  value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const sidebar = {}

// Build sidebar for each package
packages.forEach((pkg) => {
  const pages = fg
    .sync(`packages/${pkg.name}/**/*.md`, {
      cwd: docsRoot,
      onlyFiles: true,
      ignore: [`packages/${pkg.name}/index.md`, `packages/${pkg.name}/docs/index.md`]
    })
    .sort()
    .map((file) => {
      const relative = file
        .replace(`packages/${pkg.name}/`, '')
        .replace(/\.md$/, '')
        .replace(/\/index$/, '')

      return {
        text: titleize(path.basename(relative)),
        link: `/packages/${pkg.name}/${relative}`
      }
    })

  sidebar[`/packages/${pkg.name}/`] = [
    {
      text: titleize(pkg.name),
      items: [
        { text: 'Overview', link: `/packages/${pkg.name}/` },
        ...pages
      ]
    }
  ]
})

export default defineConfig({
  // Build to root docs
  outDir: path.join(docsRoot, 'docs', '.vitepress', 'dist'),

  themeConfig: {
    nav: [
      {
        text: 'Packages',
        items: packages.map((pkg) => ({
          text: titleize(pkg.name),
          link: `/packages/${pkg.name}/`
        }))
      }
    ],
    sidebar,
    // Edit link
    editLink: false,
    // Social icons
    socialLinks: [
      { icon: 'github', link: 'https://github.com/fbritoferreira/strapi' }
    ],
    // Search
    search: {
      provider: 'local'
    },
    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Filipe Brito Ferreira'
    }
  }
})
