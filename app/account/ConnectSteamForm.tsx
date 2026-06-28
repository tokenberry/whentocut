"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConnectSteamForm({ connected }: { connected: boolean }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function connect() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webApiKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg(`Connected — key can access ${data.appCount} app(s).`);
      setKey("");
      router.refresh();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fetch("/api/connect", { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (connected) {
    return (
      <div>
        <p className="sale-yes">✓ Steamworks key connected.</p>
        <button className="link-btn" onClick={disconnect} disabled={busy}>
          {busy ? "…" : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="muted">
        Paste a Steamworks publisher/financial Web API key (needs the “Sales Data”
        permission) to unlock your private revenue &amp; wishlist data. Stored encrypted;
        never shown again.
      </p>
      <div className="row">
        <input
          type="text"
          placeholder="Steamworks Web API key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button onClick={connect} disabled={busy || key.trim().length < 16}>
          {busy ? "Validating…" : "Connect"}
        </button>
      </div>
      {msg && <p className="sale-yes">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
