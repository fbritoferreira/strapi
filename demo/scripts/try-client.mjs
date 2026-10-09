// Exercise @fbritoferreira/strapi against the running demo app.
// Reads work anonymously (the demo grants public read); writes need STRAPI_TOKEN.
import { Strapi } from '@fbritoferreira/strapi';

const strapi = new Strapi({
  baseURL: process.env.STRAPI_URL ?? 'http://localhost:1337',
  defaultLocale: 'en',
  ...(process.env.STRAPI_TOKEN && { token: process.env.STRAPI_TOKEN }),
});

const fail = (err) => {
  console.error(`${err.name} (${err.status}): ${err.message}`);
  process.exit(1);
};

const [err, articles, meta] = await strapi.collection('articles').findMany({ all: true });
if (err) fail(err);
console.log(`articles: ${articles.length} of ${meta?.pagination?.total}`);
for (const a of articles) console.log(`  - ${a.title}`);

const [homeErr, home] = await strapi.single('homepage').find();
if (homeErr) fail(homeErr);
console.log(`homepage: ${home.title}`);

const [gqlErr, gql] = await strapi.graphql('{ articles { documentId title } }');
if (gqlErr) fail(gqlErr);
console.log(`graphql articles: ${gql.articles.length}`);

if (process.env.STRAPI_TOKEN) {
  const [createErr, created] = await strapi
    .collection('articles')
    .create({ payload: { data: { title: `From the client ${new Date().toISOString()}` } } });
  if (createErr) fail(createErr);
  console.log(`created: ${created.documentId}`);
}
