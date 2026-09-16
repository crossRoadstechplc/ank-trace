import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateOtp,
  hashOtp,
  jsonError,
  normalizeEmail,
} from "@/lib/auth";
import { env } from "@/lib/env";
import { sendOtpEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError("Enter a valid email address.");

    const email = normalizeEmail(parsed.data.email);
    const now = new Date();

    const recent = await prisma.otpChallenge.findFirst({
      where: {
        email,
        createdAt: { gt: new Date(now.getTime() - env.otpResendSeconds * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return jsonError(`Wait ${env.otpResendSeconds} seconds before requesting another code.`, 429);
    }

    const user = await prisma.user.upsert({
      where: { email },
      create: { email },
      update: {},
    });

    const code = generateOtp();
    const expiresAt = new Date(now.getTime() + env.otpExpiryMinutes * 60 * 1000);

    await prisma.otpChallenge.create({
      data: {
        email,
        codeHash: hashOtp(code),
        expiresAt,
        userId: user.id,
      },
    });

    const delivery = await sendOtpEmail(email, code);

    return NextResponse.json({
      ok: true,
      delivery,
      message:
        delivery === "sent"
          ? "Check your email for a login code."
          : "Code generated. Check the server console (email not configured).",
    });
  } catch (err) {
    console.error("request-otp", err);
    return jsonError("Could not send login code. Check server configuration.", 500);
  }
}
