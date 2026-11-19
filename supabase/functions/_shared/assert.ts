// Minimal assertion helpers over node:assert, so tests do not depend on jsr.io being reachable.
import assert from 'node:assert/strict';

export function assert_(cond: unknown, msg?: string): asserts cond {
  assert.ok(cond, msg);
}
export { assert_ as assert };
export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  assert.deepStrictEqual(actual, expected, msg);
}
export function assertNotEquals<T>(actual: T, expected: T, msg?: string): void {
  assert.notDeepStrictEqual(actual, expected, msg);
}
