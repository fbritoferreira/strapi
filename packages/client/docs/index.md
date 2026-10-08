---
layout: home

hero:
  name: "@fbritoferreira/strapi"
  text: A typed client for Strapi 5
  tagline: REST, GraphQL, auth, uploads and custom routes. Types come from your schema. Every call returns a tuple instead of throwing.
  actions:
    - theme: brand
      text: Get started
      link: /packages/client/guide/installation
    - theme: alt
      text: Generate types
      link: /packages/client/codegen/content-types

features:
  - title: Tuples, not throws
    details: Every method answers [error, data, meta]. A failed request is a value you handle, not an exception you remember to catch.
  - title: Types from your schema
    details: strapi-client generate reads a Strapi project or a running instance and writes the interfaces plus a registry, so collection uids are checked.
  - title: Params checked against the route
    details: Each method accepts only the query params its Strapi route declares. fields and populate are told apart, and the result type follows the selection.
  - title: The rest of the API
    details: Auth, users, uploads, custom and plugin routes from an OpenAPI document, and GraphQL, including operations that do not require writing a query.
---
