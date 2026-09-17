import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateOtp,
  hashOtp,
  jsonError,
  normalizeEmail,
  normalizePhone,
} from "@/lib/auth";
import { env } from "@/lib/env";
import { sendOtpEmail } from "@/lib/email";
import { sendOtpSms } from "@/lib/sms";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  companyName: z.string().trim().min(1, "Company name is required").max(160),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date();
    const channel = env.otpChannel;

    const profile = profileSchema.safeParse(body);
    if (!profile.success) {
      return jsonError(profile.error.issues[0]?.message || "Name and company are required.");
    }
    const { name, companyName } = profile.data;

    let identifier: string;
    let userId: string;

    if (channel === "email") {
      const parsed = z.object({ email: z.string().email() }).safeParse(body);
      if (!parsed.success) return jsonError("Enter a valid email address.");
      identifier = normalizeEmail(parsed.data.email);

      const recent = await prisma.otpChallenge.findFirst({
        where: {
          identifier,
          createdAt: { gt: new Date(now.getTime() - env.otpResendSeconds * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (recent) {
        return jsonError(
          `Wait ${env.otpResendSeconds} seconds before requesting another code.`,
          429,
        );
      }

      const user = await prisma.user.upsert({
        where: { email: identifier },
        create: { email: identifier, name, companyName },
        update: { name, companyName },
      });
      userId = user.id;
    } else {
      const parsed = z.object({ phone: z.string().min(9).max(20) }).safeParse(body);
      if (!parsed.success) return jsonError("Enter a valid Ethiopian mobile number.");
      const phone = normalizePhone(parsed.data.phone);
      if (!phone) {
        return jsonError("Enter a valid Ethiopian mobile (e.g. 09xxxxxxxx or 2519xxxxxxxx).");
      }
      identifier = phone;

      const recent = await prisma.otpChallenge.findFirst({
        where: {
          identifier,
          createdAt: { gt: new Date(now.getTime() - env.otpResendSeconds * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (recent) {
        return jsonError(
          `Wait ${env.otpResendSeconds} seconds before requesting another code.`,
          429,
        );
      }

      const user = await prisma.user.upsert({
        where: { phone: identifier },
        create: { phone: identifier, name, companyName },
        update: { name, companyName },
      });
      userId = user.id;
    }

    const code = generateOtp();
    const expiresAt = new Date(now.getTime() + env.otpExpiryMinutes * 60 * 1000);

    await prisma.otpChallenge.create({
      data: {
        identifier,
        codeHash: hashOtp(code),
        expiresAt,
        userId,
      },
    });

    const delivery =
      channel === "email"
        ? await sendOtpEmail(identifier, code)
        : await sendOtpSms(identifier, code);

    const sentMsg =
      channel === "email"
        ? "Check your email for a login code."
        : "Check your phone for a login code.";
    const loggedMsg =
      channel === "email"
        ? "Code generated. Check the server console (email not configured)."
        : "Code generated. Check the server console (SMS not configured).";

    return NextResponse.json({
      ok: true,
      delivery,
      channel,
      message: delivery === "sent" ? sentMsg : loggedMsg,
    });
  } catch (err) {
    console.error("request-otp", err);
    return jsonError("Could not send login code. Check server configuration.", 500);
  }
}
