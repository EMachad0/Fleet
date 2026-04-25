import type { JWTPayload } from 'jose';
import { decodeJwt } from 'jose';

export type Session = {
  userId: string;
  tenantId?: string;
  tenantType?: string;
  tenantName?: string;
  role?: string;
};

function stringClaim(claims: JWTPayload, key: string): string | undefined {
  const v = claims[key];
  return typeof v === 'string' ? v : undefined;
}

export function parseSessionFromJwt(token: string): Session | null {
  try {
    const claims = decodeJwt(token);
    if (!claims.sub) return null;
    return {
      userId: claims.sub,
      tenantId: stringClaim(claims, 'tenantId'),
      tenantType: stringClaim(claims, 'tenantType'),
      tenantName: stringClaim(claims, 'tenantName'),
      role: stringClaim(claims, 'role'),
    };
  } catch {
    return null;
  }
}
