"use client";

import { useState, type FormEvent } from "react";
import { api } from "./api";

export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const [method, setMethod] = useState<"key" | "email">(supabaseUrl && supabaseKey ? "email" : "key");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      let token = String(data.get("token") ?? "").trim();
      if (method === "email") {
        const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: supabaseKey ?? "", "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
        const result = await response.json();
        if (!response.ok || !result.access_token) throw new Error(result.msg || result.error_description || "Sign-in failed. Check your email and password.");
        token = result.access_token;
      }
      await api("/api/session", { method: "POST", body: JSON.stringify({ token }) });
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
      setBusy(false);
    }
  }

  return <section className="login-panel">
    {supabaseUrl && supabaseKey && <div className="login-methods"><button className={method === "email" ? "selected" : ""} onClick={() => setMethod("email")}>Email</button><button className={method === "key" ? "selected" : ""} onClick={() => setMethod("key")}>Workspace key</button></div>}
    <form onSubmit={submit}>
      {method === "key" ? <label>Workspace API key<input name="token" type="password" required autoComplete="off" placeholder="Enter your workspace key"/><small>Use the key provided by your workspace administrator. It is never saved in browser storage.</small></label> : <><label>Email<input name="email" type="email" autoComplete="username" required/></label><label>Password<input name="password" type="password" autoComplete="current-password" required/></label></>}
      <button className="button" disabled={busy}>{busy ? "Signing in…" : "Continue to workspace"}</button>
      {error && <p className="form-message error" role="alert">{error}</p>}
    </form>
    <div className="login-help"><h2>Running locally?</h2><p>Run <code>npm run setup</code> in the project to create your sandbox and workspace key.</p></div>
  </section>;
}
