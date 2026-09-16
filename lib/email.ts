import nodemailer from "nodemailer";
import { env } from "@/lib/env";

function smtpConfigured(): boolean {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

export async function sendOtpEmail(email: string, code: string): Promise<"sent" | "logged"> {
  if (!smtpConfigured()) {
    console.log(
      `[OTP] ${email} → ${code} (console delivery; set SMTP_HOST, SMTP_USER, SMTP_PASS to send email)`,
    );
    return "logged";
  }

  try {
    const transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });

    await transporter.sendMail({
      from: env.emailFrom,
      to: email,
      subject: "Your Ankuaru login code",
      text: `Your Ankuaru login code is ${code}. It expires in ${env.otpExpiryMinutes} minutes.`,
      html: `<p>Your Ankuaru login code is <strong>${code}</strong>.</p><p>It expires in ${env.otpExpiryMinutes} minutes.</p>`,
    });

    return "sent";
  } catch (err) {
    console.error("[OTP] Nodemailer error:", err);
    console.log(`[OTP] Fallback console delivery for ${email} → ${code}`);
    return "logged";
  }
}
