"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RenderJob } from "@/lib/types";
import type { SaveStatus } from "@/hooks/useProjectSession";

export function StudioTopbar({
  canUndo,
  canRedo,
  saveStatus,
  renderJob,
  busyRender,
  clipsEmpty,
  historyFlash,
  onUndo,
  onRedo,
  onExport,
  onCancelExport,
}: {
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: SaveStatus;
  renderJob: RenderJob | null;
  busyRender: boolean;
  clipsEmpty: boolean;
  /** Bump id to flash undo/redo chrome */
  historyFlash?: { kind: "undo" | "redo"; id: number } | null;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onCancelExport?: () => void;
}) {
  const [flashKind, setFlashKind] = useState<"undo" | "redo" | null>(null);

  useEffect(() => {
    if (!historyFlash) return;
    setFlashKind(historyFlash.kind);
    const t = setTimeout(() => setFlashKind(null), 520);
    return () => clearTimeout(t);
  }, [historyFlash]);

  const exporting =
    busyRender ||
    renderJob?.status === "rendering" ||
    renderJob?.status === "queued";
  const progress =
    renderJob?.status === "rendering" || renderJob?.status === "queued"
      ? Math.min(100, Math.max(0, Math.round(renderJob.progress || 0)))
      : busyRender
        ? 4
        : 0;
  const exportLabel =
    renderJob?.status === "queued"
      ? "Queued…"
      : progress > 4
        ? `Export ${progress}%`
        : "Exporting…";

  return (
    <header className="mso-topbar">
      <div className="mso-topbar-left">
        <Link href="/" className="mso-logo" title="Back to library">
          MSO7 <span className="beta">Beta</span>
        </Link>
        <div
          className={`mso-history${flashKind ? ` is-flash-${flashKind}` : ""}`}
        >
          <button
            type="button"
            className={`mso-chrome-btn${flashKind === "undo" ? " is-flash" : ""}`}
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            type="button"
            className={`mso-chrome-btn${flashKind === "redo" ? " is-flash" : ""}`}
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            Redo
          </button>
          <span
            className={`mso-save-pill mso-save-${saveStatus}`}
            aria-live="polite"
          >
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "Saved"
                : saveStatus === "error"
                  ? "Save failed"
                  : "Ready"}
          </span>
        </div>
      </div>
      <div className="mso-export-slot">
        {renderJob?.status === "ready" && renderJob.outputUrl ? (
          <a className="mso-btn-ghost" href={renderJob.outputUrl} download>
            Download
          </a>
        ) : null}
        {exporting && onCancelExport ? (
          <button
            type="button"
            className="mso-btn-ghost"
            onClick={onCancelExport}
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          className={`mso-export${exporting ? " is-exporting" : ""}`}
          onClick={onExport}
          disabled={exporting || clipsEmpty}
          aria-busy={exporting}
        >
          {exporting ? (
            <>
              <span
                className="mso-export-fill"
                style={{ width: `${Math.max(6, progress)}%` }}
                aria-hidden
              />
              <span className="mso-export-label">{exportLabel}</span>
            </>
          ) : (
            <span className="mso-export-label">Export</span>
          )}
        </button>
      </div>
    </header>
  );
}
