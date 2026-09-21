"use client";

import { FormEvent, useState } from "react";
import { BusyLabel } from "@/components/spinner";

type Step = "details" | "otp";

const channel =
  (process.env.NEXT_PUBLIC_OTP_CHANNEL || "sms").trim().toLowerCase() === "email"
    ? "email"
    : "sms";

export function LoginForm() {
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const contact = channel === "email" ? email : phone;

  async function requestOtp(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload =
        channel === "email"
          ? { name, companyName, email }
          : { name, companyName, phone };
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send code.");
        return;
      }
      setMessage(data.message || "Code sent.");
      setStep("otp");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          channel === "email" ? { email, code } : { phone, code },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not verify code.");
        return;
      }
      window.location.href = "/select-role";
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <header className="masthead">
        <div className="auth-inner masthead-auth">
          <div className="brand-lockup">
            <div className="brand">Ankuaru</div>
          </div>
          <div className="masthead-copy">
            <h1>Sign in</h1>
            <p>We&apos;ll send a one-time code. Sessions last 6 hours.</p>
          </div>
        </div>
      </header>

      <main className="login-main">
        {step === "details" ? (
          <form onSubmit={requestOtp} className="login-card">
            <h2 className="section-title">Your details</h2>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="field">
              <label htmlFor="companyName">Company name</label>
              <input
                id="companyName"
                type="text"
                autoComplete="organization"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company or organization"
              />
            </div>
            {channel === "email" ? (
              <div className="field">
                <label htmlFor="email">Work email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="phone">Mobile number</label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xxxxxxxx"
                />
              </div>
            )}
            {error && <p className="warn-note">{error}</p>}
            {message && <p className="helper-note">{message}</p>}
            <button type="submit" disabled={busy}>
              <BusyLabel busy={busy} busyText="Sending…">
                Send login code
              </BusyLabel>
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="login-card">
            <h2 className="section-title">Enter code</h2>
            <p className="helper-note">
              We sent a code to <b>{contact}</b>.{" "}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setStep("details");
                  setCode("");
                  setError(null);
                }}
              >
                Edit details
              </button>
            </p>
            <div className="field">
              <label htmlFor="code">One-time code</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
              />
            </div>
            {error && <p className="warn-note">{error}</p>}
            {message && <p className="helper-note">{message}</p>}
            <div className="btn-row">
              <button type="submit" disabled={busy}>
                <BusyLabel busy={busy} busyText="Verifying…">
                  Sign in
                </BusyLabel>
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void requestOtp()}
              >
                Resend code
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
