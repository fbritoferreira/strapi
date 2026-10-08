// Strapi resolves an email provider with `require(modulePath)` and calls
// `provider.init(...)` on the result, so the default export compiled by
// TypeScript has to be unwrapped to `module.exports`.
module.exports = require('./dist/index.js').default;
