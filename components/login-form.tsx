"use client";

import { FormEvent, useState } from "react";

type Step = "email" | "otp";

export function LoginForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
        body: JSON.stringify({ email, code }),
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
        <div className="shell-inner masthead-inner">
          <div className="brand-lockup">
            <div className="brand">Ankuaru</div>
            <div className="kicker">Ledger Workspace</div>
          </div>
          <div className="masthead-copy">
            <h1>Sign in to continue</h1>
            <p>Enter your email for a one-time code. Sessions last 6 hours.</p>
          </div>
        </div>
      </header>

      <main className="login-main">
        {step === "email" ? (
          <form onSubmit={requestOtp} className="login-card">
            <h2 className="section-title">Email</h2>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            {error && <p className="warn-note">{error}</p>}
            {message && <p className="helper-note">{message}</p>}
            <button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send login code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="login-card">
            <h2 className="section-title">Enter code</h2>
            <p className="helper-note">
              We sent a code to <b>{email}</b>.{" "}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
              >
                Change email
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
                {busy ? "Verifying…" : "Sign in"}
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
