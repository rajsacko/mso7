"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FORMAT_SIZES } from "@/lib/types";
import type { FormatId } from "@/lib/types";

const formats = (["reel", "youtube"] as FormatId[]).map((id) => [
  id,
  FORMAT_SIZES[id],
] as const);

export default function NewPiecePage() {
  const router = useRouter();
  const [format, setFormat] = useState<FormatId>("reel");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create");
      router.push(`/studio/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
      setBusy(false);
    }
  }

  return (
    <div className="mso-page">
      <div className="mso-page-header">
        <Link href="/" className="mso-logo">
          MSO7 <span className="beta">Beta</span>
        </Link>
        <Link href="/" className="mso-link-quiet">
          Library
        </Link>
      </div>

      <p className="mso-page-kicker">New piece</p>
      <h1>Start a cut</h1>
      <p className="lead">
        Pick a format, then drop clips, add text overlays, and export.
      </p>

      <p className="mso-section-title" style={{ marginTop: "2rem" }}>
        Format
      </p>
      <div className="mso-format-grid">
        {formats.map(([id, meta]) => (
          <button
            key={id}
            type="button"
            className={`mso-format-card${format === id ? " is-active" : ""}`}
            onClick={() => setFormat(id)}
          >
            <div
              className={`shape ${id === "reel" ? "portrait" : "landscape"}`}
              style={{
                background: "#fff",
                marginBottom: 12,
                borderRadius: 2,
                width: id === "reel" ? 28 : 52,
                height: id === "reel" ? 50 : 28,
              }}
            />
            <div style={{ fontWeight: 500 }}>{meta.label}</div>
          </button>
        ))}
      </div>

      <div className="mso-field-stack" style={{ marginTop: 0 }}>
        <label>
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled piece"
          />
        </label>
      </div>

      {error ? (
        <p style={{ color: "#8a2a2a", marginTop: "1rem" }}>{error}</p>
      ) : null}

      <button
        type="button"
        className="mso-export"
        style={{ marginTop: "1.5rem", width: "100%", maxWidth: 280 }}
        onClick={create}
        disabled={busy}
      >
        {busy ? "Opening…" : "Open studio"}
      </button>

      <div className="mso-credit">
        <div>Product by Maison Sacko</div>
        <div className="light">Credit: Raj Sacko</div>
      </div>
    </div>
  );
}
