// Exercise the CSV import/export plugin against the running demo app through
// its admin API: import scripts/articles.csv twice and check the second run
// updates instead of creating, then export and read the job history.
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';

const base = process.env.STRAPI_URL ?? 'http://localhost:1337';
const email = process.env.ADMIN_EMAIL ?? 'admin@demo.local';
const password = process.env.ADMIN_PASSWORD ?? 'DemoPass123';
const ARTICLE = 'api::article.article';

const login = await fetch(`${base}/admin/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
assert.equal(login.status, 200, `admin login failed; create the admin first (see README)`);
const { token } = (await login.json()).data;

const request = async (bearer, method, path, body) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const api = async (method, path, body) => {
  const res = await request(token, method, `/csv-import-export${path}`, body);
  assert.ok(res.status < 300, `${method} ${path} -> ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
};

/** Real imports are logged, so each one needs a running job. */
const importWithJob = async (config, rows) => {
  const { data: job } = await api('POST', '/jobs', {
    uid: ARTICLE,
    status: config.status,
    fileName: 'try-csv',
    totalRows: rows.length,
    config,
  });
  const { data: result } = await api('POST', `/import/${ARTICLE}`, { ...config, dryRun: false, jobId: job.id, rowOffset: 0, rows });
  await api('POST', `/jobs/${job.id}/finish`, { state: result.aborted ? 'failed' : 'completed' });
  return result;
};

// The fixture has no quoted fields, so a plain split is enough here.
const [header, ...lines] = (await readFile(new URL('./articles.csv', import.meta.url), 'utf8')).trim().split('\n');
const columns = header.split(',');
const rows = lines.map((line) => Object.fromEntries(line.split(',').map((cell, i) => [columns[i], cell])));

const runImport = async () => {
  const config = {
    status: 'published',
    matchField: 'slug',
    mapping: { slug: 'slug', title: 'title', views: 'views', featured: 'featured', category: 'category', tags: 'tags' },
    relations: { category: { matchOn: 'slug' }, tags: { matchOn: 'label' } },
    onMissingRelation: 'skip',
  };
  const { data: job } = await api('POST', '/jobs', {
    uid: ARTICLE,
    status: config.status,
    fileName: 'articles.csv',
    totalRows: rows.length,
    config,
  });
  const { data: result } = await api('POST', `/import/${ARTICLE}`, { ...config, dryRun: false, jobId: job.id, rowOffset: 0, rows });
  await api('POST', `/jobs/${job.id}/finish`, { state: 'completed' });
  const { data: logged } = await api('GET', `/jobs/${job.id}`);
  const count = (action) => result.results.filter((r) => r.action === action).length;
  return { result, logged, created: count('created'), updated: count('updated'), skipped: count('skipped'), errored: count('error') };
};

const first = await runImport();
console.log('first import', { created: first.created, updated: first.updated, skipped: first.skipped, errored: first.errored });
for (const r of first.result.results.filter((r) => r.error)) console.log(`  row ${r.row}: ${r.action}: ${r.error}`);

const second = await runImport();
console.log('second import', { created: second.created, updated: second.updated, skipped: second.skipped, errored: second.errored });

assert.equal(second.created, 0, 'second import must not create anything');
assert.equal(second.updated, first.created + first.updated, 'second import must update every row the first one wrote');
assert.equal(second.skipped, 1, 'missing-category row is skipped');
assert.equal(second.errored, 1, 'bad-views row is an error');
assert.equal(second.logged.state, 'completed');
assert.equal(second.logged.updated, second.updated, 'job log counts match the batch result');
assert.equal(second.logged.errors.length, 2, 'job log keeps the skipped and failed rows only');

const { data: exported } = await api('POST', `/export/${ARTICLE}`, {
  status: 'published',
  columns: [
    { field: 'slug', header: 'slug' },
    { field: 'title', header: 'title' },
    { field: 'category', header: 'category', matchOn: 'slug' },
    { field: 'tags', header: 'tags', matchOn: 'label' },
  ],
});
const { csv } = exported;
assert.match(csv, /^slug,title,category,tags\r\n/);
// Relations landed on the published version, read back through the export.
assert.match(csv, /csv-import,CSV import,sport,(csv\|typescript|typescript\|csv)\r\n/);
assert.match(csv, /hello-strapi,Hello Strapi \(imported\),news,strapi\r\n/);
assert.doesNotMatch(csv, /missing-category|bad-views/, 'skipped and failed rows were never written');
console.log(`export: ${csv.trim().split('\r\n').length - 1} rows`);

// A row whose relation target is missing aborts its whole batch with onMissingRelation: fail.
const failed = await importWithJob(
  {
    status: 'draft',
    matchField: 'slug',
    mapping: { slug: 'slug', category: 'category' },
    relations: { category: { matchOn: 'slug' } },
    onMissingRelation: 'fail',
  },
  [
    { slug: 'should-not-exist', category: 'news' },
    { slug: 'missing-category', category: 'cooking' },
  ]
);
assert.equal(failed.aborted, true, 'fail mode aborts the batch');
const check = await api('POST', `/export/${ARTICLE}`, { status: 'draft', columns: [{ field: 'slug', header: 'slug' }] });
assert.doesNotMatch(check.data.csv, /should-not-exist/, 'nothing in an aborted batch is written');
console.log('fail mode: batch aborted, nothing written');

// Round trip: the export re-imports on documentId with no creates.
const roundTrip = await api('POST', `/export/${ARTICLE}`, {
  status: 'published',
  columns: [
    { field: 'documentId', header: 'documentId' },
    { field: 'views', header: 'views' },
  ],
});
const [, ...exportedLines] = roundTrip.data.csv.trim().split('\r\n');
const reimport = await importWithJob(
  {
    status: 'published',
    matchField: 'documentId',
    mapping: { documentId: 'documentId', views: 'views' },
    relations: {},
    onMissingRelation: 'skip',
  },
  exportedLines.map((line) => {
    const [documentId, views] = line.split(',');
    return { documentId, views };
  })
);
assert.ok(reimport.results.every((r) => r.action === 'updated'), 'every exported row updates its own entry');
console.log(`round trip on documentId: ${reimport.results.length} updated, 0 created`);

// Field-level permissions: an editor who may read only title and slug cannot export views.
const EDITOR = { email: 'csv-editor@demo.local', password: 'EditorPass123' };
const roles = (await request(token, 'GET', '/admin/roles')).body.data;
let role = roles.find((r) => r.name === 'CSV editor');
if (!role) {
  role = (await request(token, 'POST', '/admin/roles', { name: 'CSV editor', description: 'try-csv' })).body.data;
}
await request(token, 'PUT', `/admin/roles/${role.id}/permissions`, {
  permissions: [
    {
      action: 'plugin::content-manager.explorer.read',
      subject: ARTICLE,
      properties: { fields: ['title', 'slug'] },
      conditions: [],
    },
    { action: 'plugin::csv-import-export.export', subject: null, properties: {}, conditions: [] },
  ],
});
let editorLogin = await request('', 'POST', '/admin/login', EDITOR);
if (editorLogin.status !== 200) {
  const invited = await request(token, 'POST', '/admin/users', {
    email: EDITOR.email,
    firstname: 'CSV',
    lastname: 'Editor',
    roles: [role.id],
  });
  await request('', 'POST', '/admin/register', {
    registrationToken: invited.body.data.registrationToken,
    userInfo: { firstname: 'CSV', lastname: 'Editor', password: EDITOR.password },
  });
  editorLogin = await request('', 'POST', '/admin/login', EDITOR);
}
const editorToken = editorLogin.body.data.token;
const exportAs = (columns) =>
  request(editorToken, 'POST', `/csv-import-export/export/${ARTICLE}`, { status: 'published', columns });
const allowed = await exportAs([{ field: 'title', header: 'title' }]);
assert.equal(allowed.status, 200, `editor exports title: ${JSON.stringify(allowed.body)}`);
const refused = await exportAs([
  { field: 'title', header: 'title' },
  { field: 'views', header: 'views' },
]);
assert.equal(refused.status, 403, 'editor cannot export a field outside the role');
const importRefused = await request(editorToken, 'POST', '/csv-import-export/jobs', {
  uid: ARTICLE,
  status: 'draft',
  totalRows: 1,
  config: {},
});
assert.equal(importRefused.status, 403, 'editor without the import permission cannot start an import');
console.log(`permissions: editor export of title ${allowed.status}, of views ${refused.status}, import ${importRefused.status}`);

const { data: history, meta } = await api('GET', `/jobs?uid=${ARTICLE}`);
assert.ok(history.length >= 3, 'history lists both imports and the export');
assert.ok(!('errors' in history[0]), 'history list omits the error rows');
console.log(`history: ${meta.pagination.total} jobs, latest ${history[0].kind} ${history[0].state}`);

console.log('csv import/export ok');
