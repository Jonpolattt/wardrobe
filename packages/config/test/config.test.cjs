const { test } = require('node:test'); const assert = require('node:assert/strict');
const { apiEndpoint, assetUrl } = require('../dist');
test('release API needs explicit HTTPS and rejects embedded credentials', () => {
  assert.throws(() => apiEndpoint(undefined));
  assert.throws(() => apiEndpoint('http://localhost:4000/graphql', true));
  assert.throws(() => apiEndpoint('https://user:password@example.test/graphql', true));
  assert.equal(apiEndpoint('https://api.example.test/graphql', true), 'https://api.example.test/graphql');
});
test('relative uploads resolve against backend origin and unsafe schemes are refused', () => {
  assert.equal(assetUrl('/uploads/a.png', 'https://api.example.test/graphql'), 'https://api.example.test/uploads/a.png');
  assert.equal(assetUrl('file:///secret.png', 'https://api.example.test/graphql'), undefined);
  assert.equal(assetUrl('javascript:alert(1)', 'https://api.example.test/graphql'), undefined);
});
