import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminToken,
  jsonError,
  safeEqual,
  setAdminCookie,
} from "@/lib/auth";
import { env } from "@/lib/env";

const bodySchema = z.object({
  password: z.string().min(1),
});

const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 20;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) return jsonError("Too many attempts. Try again later.", 429);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Password required.");

    if (!safeEqual(parsed.data.password, env.adminPassword)) {
      return jsonError("Incorrect password.", 401);
    }

    const token = await createAdminToken();
    await setAdminCookie(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin unlock", err);
    return jsonError("Could not unlock admin panel.", 500);
  }
}
