import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ank_session";
export const ADMIN_COOKIE = "ank_admin";

export type SessionPayload = {
  sub: string;
  email: string;
  name?: string;
  companyName?: string;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload,
  hours = Number(process.env.SESSION_HOURS || 6),
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name || "",
    companyName: payload.companyName || "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${hours}h`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : undefined,
      companyName: typeof payload.companyName === "string" ? payload.companyName : undefined,
    };
  } catch {
    return null;
  }
}

export async function createAdminToken(
  minutes = Number(process.env.ADMIN_SESSION_MINUTES || 30),
): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .sign(secretKey());
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.sub === "admin" && payload.role === "admin";
  } catch {
    return false;
  }
}
