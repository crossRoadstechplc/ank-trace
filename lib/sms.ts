import { env } from "@/lib/env";

export async function sendOtpSms(phone: string, code: string): Promise<"sent" | "logged"> {
  const msg = `Your Ankuaru login code is ${code}. It expires in ${env.otpExpiryMinutes} minutes.`;

  if (!env.geezSmsToken) {
    console.log(
      `[OTP SMS] ${phone} → ${code} (console delivery; set GEEZSMS_TOKEN to send SMS)`,
    );
    return "logged";
  }

  try {
    const form = new FormData();
    form.append("token", env.geezSmsToken);
    form.append("phone", phone);
    form.append("msg", msg);
    if (env.geezSmsShortcodeId) {
      form.append("shortcode_id", env.geezSmsShortcodeId);
    }

    const res = await fetch("https://api.geezsms.com/api/v1/sms/send", {
      method: "POST",
      body: form,
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("[OTP SMS] GeezSMS HTTP error:", res.status, text);
      console.log(`[OTP SMS] Fallback console delivery for ${phone} → ${code}`);
      return "logged";
    }

    try {
      const data = JSON.parse(text) as { error?: boolean | string; message?: string };
      if (data.error === true || data.error === "true") {
        console.error("[OTP SMS] GeezSMS API error:", data);
        console.log(`[OTP SMS] Fallback console delivery for ${phone} → ${code}`);
        return "logged";
      }
    } catch {
      // Non-JSON success body is fine
    }

    return "sent";
  } catch (err) {
    console.error("[OTP SMS] GeezSMS request failed:", err);
    console.log(`[OTP SMS] Fallback console delivery for ${phone} → ${code}`);
    return "logged";
  }
}
