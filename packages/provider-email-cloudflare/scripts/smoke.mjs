/**
 * Exercises the built package on the oldest Node this provider supports, where
 * the test runner itself cannot run: vitest needs Node 22.12 or newer.
 *
 * Strapi loads a provider with `require()`, so this must load `dist/index.js`
 * as CommonJS. Runs offline against a stubbed fetch.
 */
import { strict as assert } from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Exactly how Strapi loads it: package entry -> init(providerOptions, settings).
const provider = require("../strapi-provider.js");

const checks = [];
const check = async (name, fn) => {
	await fn();
	checks.push(name);
};

let lastCall;
globalThis.fetch = async (url, init) => {
	lastCall = { url, init };
	return new Response(
		JSON.stringify({ success: true, errors: [], result: { delivered: ["a@example.com"] } }),
		{ status: 200, headers: { "content-type": "application/json" } },
	);
};

assert.equal(provider.name, "cloudflare");

await check("init refuses to boot without credentials", () => {
	assert.throws(() => provider.init({ apiToken: "", accountId: "acct" }), /apiToken/);
	assert.throws(() => provider.init({ apiToken: "token", accountId: "" }), /accountId/);
});

await check("send maps options and returns the delivery result", async () => {
	const instance = provider.init(
		{ apiToken: "token-123", accountId: "acct-456" },
		{ defaultFrom: "no-reply@example.com" },
	);

	const result = await instance.send({
		to: "A Recipient <a@example.com>",
		subject: "Welcome",
		html: "<h1>Welcome</h1>",
		text: "Welcome",
	});

	assert.deepEqual(result, { delivered: ["a@example.com"] });
	assert.equal(lastCall.url, "https://api.cloudflare.com/client/v4/accounts/acct-456/email/sending/send");
	assert.equal(lastCall.init.headers.authorization, "Bearer token-123");

	const body = JSON.parse(lastCall.init.body);
	assert.deepEqual(body.to, { address: "a@example.com", name: "A Recipient" });
	assert.equal(body.from, "no-reply@example.com");
	assert.equal(body.text, "Welcome");
});

await check("a Cloudflare error becomes a thrown error", async () => {
	globalThis.fetch = async () =>
		new Response(
			JSON.stringify({
				success: false,
				errors: [{ code: 10101, message: "email.sending.error.authentication.unauthorized" }],
			}),
			{ status: 401 },
		);

	const instance = provider.init({ apiToken: "bad", accountId: "acct-456" });
	await assert.rejects(
		() => instance.send({ from: "no-reply@example.com", to: "a@example.com", subject: "Hi", text: "Hi" }),
		/10101 email\.sending\.error\.authentication\.unauthorized/,
	);
});

console.log(`smoke: ${checks.length} checks passed`);
for (const name of checks) console.log(`  ✓ ${name}`);
