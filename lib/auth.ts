import { createHash, randomInt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  ADMIN_COOKIE,
  SESSION_COOKIE,
  createAdminToken,
  createSessionToken,
  verifyAdminToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session";

export {
  SESSION_COOKIE,
  ADMIN_COOKIE,
  createSessionToken,
  verifySessionToken,
  createAdminToken,
  verifyAdminToken,
  type SessionPayload,
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateOtp(length = env.otpLength): string {
  const max = 10 ** length;
  const n = randomInt(0, max);
  return n.toString().padStart(length, "0");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(env.sessionHours * 60 * 60));
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setAdminCookie(token: string) {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, sessionCookieOptions(env.adminSessionMinutes * 60));
}

export async function clearAdminCookie() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", sessionCookieOptions(0));
}

export async function isAdminUnlocked(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

export function getClientMeta(req: Request) {
  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
  const userAgent = headers.get("user-agent");
  return { ip, userAgent };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
