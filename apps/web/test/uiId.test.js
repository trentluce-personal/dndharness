import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createUiId } from '../src/uiId.js';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('native randomUUID is preferred and called with its crypto receiver', () => {
  let calls = 0;
  const crypto = {
    randomUUID() {
      assert.equal(this, crypto);
      calls++;
      return '01234567-89ab-4def-8123-456789abcdef';
    },
    getRandomValues() { assert.fail('Native UUIDs must not use the fallback'); },
  };
  assert.equal(createUiId(crypto), '01234567-89ab-4def-8123-456789abcdef');
  assert.equal(calls, 1);
});

test('HTTP-compatible fallback formats deterministic bytes and sets version/variant bits', () => {
  const crypto = {
    getRandomValues(bytes) {
      assert.equal(this, crypto);
      assert.ok(bytes instanceof Uint8Array);
      assert.equal(bytes.length, 16);
      bytes.set(Array.from({ length: 16 }, (_, index) => index));
      return bytes;
    },
  };
  assert.equal(createUiId(crypto), '00010203-0405-4607-8809-0a0b0c0d0e0f');
});

test('fallback masks arbitrary source version/variant bits while preserving other bits', () => {
  for (let value = 0; value <= 255; value++) {
    const id = createUiId({ getRandomValues(bytes) { return bytes.fill(value); } });
    assert.match(id, uuidV4);
    const bytes = id.replaceAll('-', '').match(/../g).map((hex) => Number.parseInt(hex, 16));
    assert.equal(bytes[6], (value & 0x0f) | 0x40);
    assert.equal(bytes[8], (value & 0x3f) | 0x80);
    assert.equal(bytes[0], value);
    assert.equal(bytes[15], value);
  }
});

test('native and fallback generate distinct UUID v4 values using real cryptographic randomness', () => {
  for (const crypto of [webcrypto, { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) }]) {
    const ids = Array.from({ length: 1000 }, () => createUiId(crypto));
    ids.forEach((id) => assert.match(id, uuidV4));
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('default provider uses browser global crypto', () => {
  assert.match(createUiId(), uuidV4);
});

test('missing cryptographic randomness fails with an explicit meaningful error', () => {
  for (const crypto of [null, {}, { randomUUID: undefined }, { randomUUID: false, getRandomValues: false }]) {
    assert.throws(() => createUiId(crypto), /Cannot generate a UI ID: cryptographic randomness \(crypto\.getRandomValues\) is unavailable/);
  }
});
