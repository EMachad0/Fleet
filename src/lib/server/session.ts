export type Session = {
  userId: string;
  tenantId?: string;
  tenantType?: string;
  tenantName?: string;
};

export function parseSessionFromJwt(token: string): Session | null {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      tenantId: payload.tenantId ?? undefined,
      tenantType: payload.tenantType ?? undefined,
      tenantName: payload.tenantName ?? undefined,
    };
  } catch {
    return null;
  }
}
