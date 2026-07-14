"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { BrandKit } from "@/lib/types";
import { DEFAULT_BRAND } from "@/lib/types";

export default function BrandPage() {
  const [brand, setBrand] = useState<BrandKit>(DEFAULT_BRAND);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((data) => {
        if (data.brand) setBrand(data.brand);
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/brand", { method: "PUT", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setBrand(data.brand);
      setMessage("Brand kit saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mso-page" style={{ maxWidth: 560 }}>
      <div className="mso-page-header">
        <Link href="/" className="mso-logo">
          MSO7 <span className="beta">Beta</span>
        </Link>
        <Link href="/" className="mso-link-quiet">
          Library
        </Link>
      </div>

      <p className="mso-page-kicker">Brand kit</p>
      <h1 style={{ fontSize: "2.75rem" }}>One kit. Every cut.</h1>
      <p className="lead">
        Wordmark, palette, logo, and music bed. UI type is Cabinet Grotesk.
      </p>

      <form onSubmit={onSubmit} className="mso-field-stack">
        {(
          [
            ["wordmark", "Wordmark"],
            ["atelierLine", "Atelier line"],
            ["displayFont", "Display font"],
            ["bodyFont", "Body font"],
            ["background", "Background"],
            ["foreground", "Foreground"],
            ["accent", "Accent"],
            ["muted", "Muted"],
          ] as const
        ).map(([name, label]) => (
          <label key={name}>
            <span>{label}</span>
            <input
              name={name}
              defaultValue={String(brand[name] ?? "")}
              key={brand.updatedAt + name}
            />
          </label>
        ))}
        <label>
          <span>Logo</span>
          <input name="logo" type="file" accept="image/*,.svg,image/svg+xml" />
        </label>
        <label>
          <span>Music bed</span>
          <input name="music" type="file" accept="audio/*" />
        </label>
        {message ? <p className="mso-toast">{message}</p> : null}
        <button
          type="submit"
          className="mso-export"
          style={{ width: 200, marginTop: 8 }}
          disabled={busy}
        >
          {busy ? "Saving…" : "Save brand kit"}
        </button>
      </form>

      <div className="mso-credit">
        <div>Product by Maison Sacko</div>
        <div className="light">Credit: Raj Sacko</div>
      </div>
    </div>
  );
}
