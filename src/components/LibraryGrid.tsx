"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FORMAT_SIZES, type FormatId } from "@/lib/types";

export type LibraryPiece = {
  id: string;
  title: string;
  format: FormatId;
  clipCount: number;
};

export function LibraryGrid({ projects }: { projects: LibraryPiece[] }) {
  const router = useRouter();
  const [items, setItems] = useState(projects);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(projects);
  }, [projects]);

  async function removePiece(piece: LibraryPiece) {
    const label = piece.title.trim() || "this piece";
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) {
      return;
    }
    setError(null);
    setBusyId(piece.id);
    try {
      const res = await fetch(`/api/projects/${piece.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "Delete failed");
      }
      const next = items.filter((p) => p.id !== piece.id);
      setItems(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <section>
        <p className="mso-page-kicker">Maison Sacko · Studio</p>
        <h1>MSO7</h1>
        <p className="lead">
          Upload clips. Lay text on the frame. Export a branded piece —
          without a heavy editor.
        </p>
        <div className="mso-page-actions">
          <Link href="/new" className="mso-export">
            <span className="mso-export-label">New piece</span>
          </Link>
          <Link href="/brand" className="mso-btn">
            Brand kit
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="mso-library-head">
        <div>
          <p className="mso-page-kicker">Library</p>
          <h1 style={{ fontSize: "2.75rem" }}>Your pieces</h1>
        </div>
        <Link href="/new" className="mso-export">
          <span className="mso-export-label">New piece</span>
        </Link>
      </div>

      {error ? (
        <p className="mso-library-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mso-card-grid">
        {items.map((project) => (
          <article key={project.id} className="mso-card">
            <Link href={`/studio/${project.id}`} className="mso-card-link">
              <div>
                <div className="mso-card-title">{project.title}</div>
                <div className="mso-card-meta">
                  {FORMAT_SIZES[project.format].label}
                </div>
              </div>
              <div className="mso-card-foot">
                {project.clipCount} clip
                {project.clipCount === 1 ? "" : "s"}
              </div>
            </Link>
            <button
              type="button"
              className="mso-card-delete"
              aria-label={`Delete ${project.title}`}
              title="Delete piece"
              disabled={busyId === project.id}
              onClick={() => removePiece(project)}
            >
              ×
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
