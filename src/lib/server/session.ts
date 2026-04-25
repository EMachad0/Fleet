import { decodeJwt } from 'jose';

export type Session = {
  userId: string;
  tenantId?: string;
  tenantType?: string;
  tenantName?: string;
};

export function parseSessionFromJwt(token: string): Session | null {
  try {
    const claims = decodeJwt(token);
    if (!claims.sub) return null;
    return {
      userId: claims.sub,
      tenantId: typeof claims.tenantId === 'string' ? claims.tenantId : undefined,
      tenantType: typeof claims.tenantType === 'string' ? claims.tenantType : undefined,
      tenantName: typeof claims.tenantName === 'string' ? claims.tenantName : undefined,
    };
  } catch {
    return null;
  }
}
