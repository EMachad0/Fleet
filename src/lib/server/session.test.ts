import { expect, test } from 'vitest';
import { parseSessionFromJwt } from './session';

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

test('extracts userId and tenant fields from a JWT', () => {
  const token = fakeJwt({
    sub: 'user-1',
    tenantId: 'tenant-1',
    tenantType: 'consumer',
    tenantName: 'Acme',
    role: 'owner',
  });

  const session = parseSessionFromJwt(token);

  expect(session).toEqual({
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantType: 'consumer',
    tenantName: 'Acme',
    role: 'owner',
  });
});

test('returns session without tenant fields when they are absent', () => {
  const token = fakeJwt({ sub: 'user-1' });

  const session = parseSessionFromJwt(token);

  expect(session).toEqual({ userId: 'user-1' });
  expect(session?.tenantId).toBeUndefined();
});

test('returns null for a malformed token', () => {
  expect(parseSessionFromJwt('not-a-jwt')).toBeNull();
  expect(parseSessionFromJwt('')).toBeNull();
});
