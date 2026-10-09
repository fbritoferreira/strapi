export default ({ env }) => ({
  // @fbritoferreira/strapi-admin-api, linked from packages/admin-api
  'admin-api': { enabled: true },

  // @fbritoferreira/strapi-csv-import-export, linked from packages/csv-import-export
  'csv-import-export': { enabled: true },

  graphql: {
    config: {
      landingPage: true,
      depthLimit: 10,
      defaultLimit: 25,
      maxLimit: 100,
    },
  },

  // @fbritoferreira/strapi-provider-email-cloudflare, linked from
  // packages/provider-email-cloudflare. The provider refuses to boot without
  // credentials, so Strapi stays on its default sendmail provider until
  // CLOUDFLARE_API_TOKEN is set.
  ...(env('CLOUDFLARE_API_TOKEN') && {
    email: {
      config: {
        provider: '@fbritoferreira/strapi-provider-email-cloudflare',
        providerOptions: {
          apiToken: env('CLOUDFLARE_API_TOKEN'),
          accountId: env('CLOUDFLARE_ACCOUNT_ID'),
        },
        settings: {
          defaultFrom: env('EMAIL_FROM'),
          defaultReplyTo: env('EMAIL_REPLY_TO'),
          testAddress: env('EMAIL_TEST_ADDRESS'),
        },
      },
    },
  }),
});
