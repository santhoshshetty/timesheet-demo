import { webcrypto } from 'node:crypto';
import { newIdempotencyKey } from '../../src/api/idempotencyKey';

const V4_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newIdempotencyKey', () => {
  it('uses crypto.randomUUID when available', () => {
    const randomUUID = jest.fn(() => '11111111-1111-4111-8111-111111111111');
    const key = newIdempotencyKey({ randomUUID, getRandomValues: (array) => array });
    expect(key).toBe('11111111-1111-4111-8111-111111111111');
    expect(randomUUID).toHaveBeenCalled();
  });

  it('builds a v4 UUID from getRandomValues when randomUUID is unavailable (plain HTTP)', () => {
    const getRandomValues = jest.fn((array: Uint8Array<ArrayBuffer>) => array.fill(0xff));
    const key = newIdempotencyKey({ getRandomValues });
    expect(key).toMatch(V4_UUID);
    expect(getRandomValues).toHaveBeenCalled();
  });

  it('produces different keys on each call', () => {
    const insecure = {
      getRandomValues: (array: Uint8Array<ArrayBuffer>) => webcrypto.getRandomValues(array),
    };
    expect(newIdempotencyKey(insecure)).not.toBe(newIdempotencyKey(insecure));
  });
});
