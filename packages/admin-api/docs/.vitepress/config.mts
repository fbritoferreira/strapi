import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Strapi Admin API',
  description: 'Plugin to manage Strapi admin users and tokens via REST API',
  base: '/strapi/packages/admin-api/',
  lang: 'en-US',
  lastUpdated: true,
  themeConfig: {
    nav: [{ text: 'API Reference', link: '/api.md' }],
    sidebar: [
      {
        text: 'Overview',
        items: [{ text: 'Installation', link: '/index.md' }, { text: 'API Reference', link: '/api.md' }],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/fbritoferreira/strapi' }],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Filipe Brito Ferreira',
    },
    editLink: false,
  },
})
