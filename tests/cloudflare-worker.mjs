import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const env = {
  SUPABASE_URL: 'https://db.example.test',
  SUPABASE_ANON_KEY: 'publishable-test-key',
  ASSETS: { fetch: async request => new Response(`asset:${new URL(request.url).pathname}`) },
};
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  return new Response(JSON.stringify({ result: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const request = (path, { method = 'POST', body, headers = {} } = {}) => new Request(`https://shop.example.test${path}`, {
  method,
  headers: { Origin: 'https://shop.example.test', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

let response = await worker.fetch(request('/api/rpc/pilot_public_catalogue', { body: {} }), env);
assert.equal(response.status, 200);
assert.equal(new Headers(calls.at(-1).init.headers).get('apikey'), env.SUPABASE_ANON_KEY);
assert.equal(new Headers(calls.at(-1).init.headers).get('authorization'), null);

response = await worker.fetch(request('/api/rpc/pilot_is_staff', { body: {} }), env);
assert.equal(response.status, 403);
response = await worker.fetch(request('/api/rpc/pilot_is_staff', {
  body: {}, headers: { Authorization: 'Bearer staff-test-token' },
}), env);
assert.equal(response.status, 200);
assert.equal(new Headers(calls.at(-1).init.headers).get('authorization'), 'Bearer staff-test-token');

response = await worker.fetch(request('/api/orders', {
  body: { request: { name: 'Test Customer' }, key: '77bc162a-3131-4bcc-9b1c-0c5bc4459af5' },
}), env);
assert.equal(response.status, 200);
assert.equal(calls.at(-1).url, 'https://db.example.test/rest/v1/rpc/pilot_create_booking_v2');
assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
  p_request: { name: 'Test Customer' }, p_key: '77bc162a-3131-4bcc-9b1c-0c5bc4459af5',
});

response = await worker.fetch(request('/api/rpc/not_allowed', { body: {} }), env);
assert.equal(response.status, 403);
response = await worker.fetch(request('/api/rpc/pilot_public_catalogue', {
  body: {}, headers: { Origin: 'https://attacker.example' },
}), env);
assert.equal(response.status, 403);
response = await worker.fetch(request('/api/orders', {
  body: { request: {}, key: 'invalid' },
}), env);
assert.equal(response.status, 400);

response = await worker.fetch(request('/api/health', { method: 'GET' }), env);
assert.equal(response.status, 200);
assert.equal(calls.at(-1).init.method, 'POST');
response = await worker.fetch(new Request('https://shop.example.test/api/health'), env);
assert.equal(response.status, 200);
let scheduled;
await worker.scheduled({}, env, { waitUntil: promise => { scheduled = promise; } });
await scheduled;
assert.equal(calls.at(-1).url, 'https://db.example.test/rest/v1/rpc/pilot_public_catalogue');
response = await worker.fetch(request('/', { method: 'GET' }), env);
assert.equal(response.status, 302);
assert.equal(response.headers.get('Location'), 'https://shop.example.test/book/');
response = await worker.fetch(request('/book/status.html', { method: 'GET' }), env);
assert.equal(await response.text(), 'asset:/book/status.html');

console.log('PASS: public and staff RPC allowlists, token forwarding, order mapping, origin rejection, input checks, health endpoint and daily cron, redirects, and static asset fallback.');
