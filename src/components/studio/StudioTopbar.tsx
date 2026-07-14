"use client";

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
  onUndo,
  onRedo,
  onExport,
}: {
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: SaveStatus;
  renderJob: RenderJob | null;
  busyRender: boolean;
  clipsEmpty: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}) {
  return (
    <header className="mso-topbar">
      <div className="mso-topbar-left">
        <Link href="/" className="mso-logo" title="Back to library">
          MSO7 <span className="beta">Beta</span>
        </Link>
        <div className="mso-history">
          <button
            type="button"
            className="mso-chrome-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            type="button"
            className="mso-chrome-btn"
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
        <button
          type="button"
          className="mso-export"
          onClick={onExport}
          disabled={busyRender || clipsEmpty}
        >
          {busyRender
            ? "Exporting…"
            : renderJob?.status === "rendering"
              ? `Export ${renderJob.progress}%`
              : "Export"}
        </button>
      </div>
    </header>
  );
}
