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
      tenantId: (claims.tenantId as string) ?? undefined,
      tenantType: (claims.tenantType as string) ?? undefined,
      tenantName: (claims.tenantName as string) ?? undefined,
    };
  } catch {
    return null;
  }
}
