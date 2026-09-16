import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  getClientMeta,
  hashOtp,
  jsonError,
  normalizeEmail,
  safeEqual,
  setSessionCookie,
} from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(12),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Invalid email or code.");

    const email = normalizeEmail(parsed.data.email);
    const code = parsed.data.code.trim();
    const now = new Date();

    const challenge = await prisma.otpChallenge.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge || challenge.expiresAt < now) {
      return jsonError("Code expired or not found. Request a new one.");
    }

    if (challenge.attempts >= env.otpMaxAttempts) {
      return jsonError("Too many attempts. Request a new code.", 429);
    }

    const ok = safeEqual(challenge.codeHash, hashOtp(code));
    if (!ok) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      return jsonError("Incorrect code.");
    }

    const user = await prisma.user.upsert({
      where: { email },
      create: { email, loginCount: 1, lastLoginAt: now },
      update: { loginCount: { increment: 1 }, lastLoginAt: now },
    });

    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    });

    const { ip, userAgent } = getClientMeta(req);
    await prisma.loginEvent.create({
      data: { userId: user.id, ip, userAgent },
    });

    const token = await createSessionToken({ sub: user.id, email: user.email });
    await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("verify-otp", err);
    return jsonError("Could not verify code.", 500);
  }
}
