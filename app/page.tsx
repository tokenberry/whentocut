"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  { appid: 1145360, name: "Hades" },
  { appid: 367520, name: "Hollow Knight" },
  { appid: 413150, name: "Stardew Valley" },
];

/** Parse an appid from a raw number or a Steam store URL. */
function parseAppid(input: string): number | null {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/app\/(\d+)/);
  const candidate = fromUrl ? fromUrl[1] : trimmed;
  const n = Number(candidate);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export default function Home() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function go(raw: string) {
    const appid = parseAppid(raw);
    if (!appid) {
      setError("Enter a numeric Steam appID or a store URL.");
      return;
    }
    router.push(`/dashboard/${appid}`);
  }

  return (
    <div className="container">
      <h1 className="tagline" style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
        Know when to discount your Steam game — and by how much.
      </h1>
      <p className="tagline">
        Based on price level, rivals, player numbers, and Steam&apos;s own discount rules.
      </p>

      <div className="panel">
        <h2>Check a game</h2>
        <p className="muted">Paste a Steam appID or store URL.</p>
        <div className="row">
          <input
            type="text"
            placeholder="e.g. 1145360 or https://store.steampowered.com/app/1145360"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && go(value)}
          />
          <button onClick={() => go(value)}>Analyze</button>
        </div>
        {error && <p className="error">{error}</p>}
        <p className="muted examples" style={{ marginTop: 16 }}>
          Try:{" "}
          {EXAMPLES.map((e) => (
            <a key={e.appid} href={`/dashboard/${e.appid}`}>
              {e.name}
            </a>
          ))}
        </p>
      </div>

      <p className="muted" style={{ marginTop: 24, fontSize: 13 }}>
        WhenToCut is advisory. Steam has no API to apply discounts — we tell you what to
        do and when; you schedule it in Steamworks.
      </p>
    </div>
  );
}
