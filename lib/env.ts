function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get sessionHours() {
    return intEnv("SESSION_HOURS", 6);
  },
  get otpLength() {
    return intEnv("OTP_LENGTH", 6);
  },
  get otpExpiryMinutes() {
    return intEnv("OTP_EXPIRY_MINUTES", 10);
  },
  get otpMaxAttempts() {
    return intEnv("OTP_MAX_ATTEMPTS", 5);
  },
  get otpResendSeconds() {
    return intEnv("OTP_RESEND_SECONDS", 30);
  },
  /** sms | email — default sms */
  get otpChannel(): "sms" | "email" {
    const raw = (process.env.OTP_CHANNEL || "sms").trim().toLowerCase();
    return raw === "email" ? "email" : "sms";
  },
  get geezSmsToken() {
    return process.env.GEEZSMS_TOKEN || "";
  },
  get geezSmsShortcodeId() {
    return process.env.GEEZSMS_SHORTCODE_ID || "";
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
  get adminSessionMinutes() {
    return intEnv("ADMIN_SESSION_MINUTES", 30);
  },
  get smtpHost() {
    return process.env.SMTP_HOST || "";
  },
  get smtpPort() {
    return intEnv("SMTP_PORT", 587);
  },
  get smtpSecure() {
    const raw = process.env.SMTP_SECURE;
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
    // Port 465 typically uses implicit TLS
    return intEnv("SMTP_PORT", 587) === 465;
  },
  get smtpUser() {
    return process.env.SMTP_USER || "";
  },
  get smtpPass() {
    return process.env.SMTP_PASS || "";
  },
  get emailFrom() {
    return process.env.EMAIL_FROM || "Ankuaru <noreply@example.com>";
  },
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  },
};
