import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  getClientMeta,
  hashOtp,
  jsonError,
  normalizeEmail,
  normalizePhone,
  safeEqual,
  setSessionCookie,
} from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const codeParsed = z.object({ code: z.string().min(4).max(12) }).safeParse(body);
    if (!codeParsed.success) return jsonError("Invalid code.");

    const code = codeParsed.data.code.trim();
    const now = new Date();
    const channel = env.otpChannel;

    let identifier: string;
    let contactForSession: string;

    if (channel === "email") {
      const parsed = z.object({ email: z.string().email() }).safeParse(body);
      if (!parsed.success) return jsonError("Invalid email or code.");
      identifier = normalizeEmail(parsed.data.email);
      contactForSession = identifier;
    } else {
      const parsed = z.object({ phone: z.string().min(9).max(20) }).safeParse(body);
      if (!parsed.success) return jsonError("Invalid phone or code.");
      const phone = normalizePhone(parsed.data.phone);
      if (!phone) return jsonError("Invalid phone or code.");
      identifier = phone;
      contactForSession = phone;
    }

    const challenge = await prisma.otpChallenge.findFirst({
      where: { identifier, consumedAt: null },
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

    const user =
      channel === "email"
        ? await prisma.user.upsert({
            where: { email: identifier },
            create: { email: identifier, loginCount: 1, lastLoginAt: now },
            update: { loginCount: { increment: 1 }, lastLoginAt: now },
          })
        : await prisma.user.upsert({
            where: { phone: identifier },
            create: { phone: identifier, loginCount: 1, lastLoginAt: now },
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

    const token = await createSessionToken({
      sub: user.id,
      email: contactForSession,
      name: user.name ?? undefined,
      companyName: user.companyName ?? undefined,
    });
    await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("verify-otp", err);
    return jsonError("Could not verify code.", 500);
  }
}
