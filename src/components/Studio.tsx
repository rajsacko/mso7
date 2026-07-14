"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import type { PlayerRef } from "@remotion/player";
import type {
  BrandKit,
  CaptionLanguage,
  FormatId,
  LookId,
  Project,
  ProjectClip,
  ProjectOverlay,
  RenderJob,
  TransitionId,
} from "@/lib/types";
import { TRANSITION_META } from "@/lib/types";
import { LOOK_LIST } from "@/lib/looks";
import { isMockCaptionSet } from "@/lib/captions";
import {
  createOverlay,
  normalizeClip,
  playheadToClipLocalMs,
  presetLeadInMs,
  setClipTransition,
  splitClipAt,
} from "@/lib/editing";
import { clipsTimelineMs, usableClipDurationMs } from "@/lib/timeline";
import { useProjectSession } from "@/hooks/useProjectSession";
import { CustomFontFaces } from "./CustomFontFaces";
import { PreviewPlayer } from "./PreviewPlayer";
import { MicVoiceRecorder } from "./MicVoiceRecorder";
import { StudioTimeline } from "./studio/StudioTimeline";
import { StudioTopbar } from "./studio/StudioTopbar";
import { StudioTransport } from "./studio/StudioTransport";

type MobileTab = "media" | "edit" | "text" | "style" | "captions";

function normalizeProject(p: Project): Project {
  return {
    ...p,
    showTitle: p.showTitle ?? false,
    showCaptionOverlay: p.showCaptionOverlay ?? true,
    lookId: p.lookId ?? "none",
    overlays: p.overlays ?? [],
    previewPreset: false,
    defaultTransition: p.defaultTransition ?? "crossfade",
    musicStartMs: p.musicStartMs ?? 0,
    musicEndMs: p.musicEndMs ?? 0,
    musicVolume: typeof p.musicVolume === "number" ? p.musicVolume : 0.22,
    clips: (p.clips || []).map(normalizeClip),
  };
}

export function Studio({
  initialProject,
  initialBrand,
}: {
  initialProject: Project;
  initialBrand: BrandKit;
}) {
  const {
    project,
    setProject,
    apply,
    ingest,
    undo,
    redo,
    canUndo,
    canRedo,
    saveStatus,
  } = useProjectSession(initialProject, normalizeProject);
  const [brand, setBrand] = useState(initialBrand);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(
    initialProject.clips[0]?.id ?? null,
  );
  const [selectedOverlay, setSelectedOverlay] = useState<
    "title" | "caption" | null
  >(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    null,
  );
  const [activeCaptionIndex, setActiveCaptionIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("media");
  const playerRef = useRef<PlayerRef>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Strip decorative mock captions left from early builds
  useEffect(() => {
    if (!isMockCaptionSet(project.captions)) return;
    apply({ captions: [] }, { skipHistory: true });
    setMessage("Cleared placeholder captions. Extract speech from your video.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      !renderJob ||
      renderJob.status === "ready" ||
      renderJob.status === "error"
    ) {
      return;
    }
    const timer = setInterval(async () => {
      const res = await fetch(`/api/render/${renderJob.id}`);
      const data = await res.json();
      if (data.job) setRenderJob(data.job);
    }, 1500);
    return () => clearInterval(timer);
  }, [renderJob]);

  useEffect(() => {
    playerRef.current?.setVolume(muted ? 0 : 1);
  }, [muted]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4200);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    const onFs = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isPlaying()) p.pause();
    else p.play();
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }, []);

  const sortedClips = useMemo(
    () => [...project.clips].sort((a, b) => a.order - b.order),
    [project.clips],
  );

  const timelineMs = Math.max(
    1000,
    clipsTimelineMs(sortedClips, project.defaultTransition || "crossfade"),
  );

  const persist = apply;

  async function onUploadClips(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setMessage(null);
    try {
      const uploaded: ProjectClip[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const durationMs = await probeDuration(file);
        const form = new FormData();
        form.append("file", file);
        form.append("durationMs", String(durationMs));
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        uploaded.push({
          ...data.clip,
          order: project.clips.length + i,
        });
      }
      const clips = [...project.clips, ...uploaded].map((c, order) => ({
        ...c,
        order,
      }));
      persist({ clips });
      setSelectedClipId(uploaded[0]?.id ?? selectedClipId);
      setMessage("Clips added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function onUploadMusic(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy("music");
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("durationMs", "0");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Music upload failed");
      persist({
        musicUrl: data.clip.url,
        musicName: file.name,
        musicStartMs: 0,
        musicEndMs: Math.max(timelineMs, 5000),
        musicVolume: project.musicVolume ?? 0.22,
      });
      setMessage(`Music: ${file.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Music failed");
    } finally {
      setBusy(null);
    }
  }

  function removeClip(id: string) {
    const clips = project.clips
      .filter((c) => c.id !== id)
      .map((c, order) => ({ ...c, order }));
    persist({ clips });
    if (selectedClipId === id) setSelectedClipId(clips[0]?.id ?? null);
  }

  function reorderClips(fromId: string, toId: string) {
    if (fromId === toId) return;
    const list = [...sortedClips];
    const from = list.findIndex((c) => c.id === fromId);
    const to = list.findIndex((c) => c.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    persist({ clips: list.map((c, order) => ({ ...c, order })) });
  }

  async function generateCaptions(
    language: CaptionLanguage = project.captionLanguage,
  ) {
    setBusy("captions");
    setMessage(null);
    try {
      const res = await fetch("/api/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Caption failed");
      ingest(normalizeProject(data.project));
      setActiveCaptionIndex(0);
      setMessage("Captions extracted from video speech.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Caption failed");
    } finally {
      setBusy(null);
    }
  }

  async function startRender() {
    setBusy("render");
    setMessage(null);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Render failed");
      setRenderJob(data.job);
      setMessage("Export started.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Render failed");
    } finally {
      setBusy(null);
    }
  }

  function setFormat(format: FormatId) {
    persist({ format });
  }

  const selectedClip = useMemo(
    () => sortedClips.find((c) => c.id === selectedClipId) ?? null,
    [sortedClips, selectedClipId],
  );

  const activeOverlay = useMemo(
    () =>
      (project.overlays || []).find((o) => o.id === selectedOverlayId) ?? null,
    [project.overlays, selectedOverlayId],
  );

  const splitSelectedAtPlayhead = useCallback(() => {
    const clip =
      sortedClips.find((c) => c.id === selectedClipId) ?? null;
    if (!clip) {
      setMessage("Select a clip first.");
      return;
    }
    const leadIn = presetLeadInMs();
    let localMs = playheadToClipLocalMs(
      sortedClips,
      clip.id,
      playheadMs,
      leadIn,
      project.defaultTransition || "crossfade",
    );
    const usable = usableClipDurationMs(clip);
    let note = "Clip split.";
    if (localMs == null || localMs < 400 || localMs > usable - 400) {
      localMs = usable / 2;
      note = "Playhead outside clip — split in half.";
    }
    const parts = splitClipAt(clip, localMs!);
    if (!parts) {
      setMessage("Clip is too short to split here.");
      return;
    }
    const [left, right] = parts;
    const clips = sortedClips.flatMap((c) =>
      c.id === clip.id ? [left, right] : [c],
    );
    persist({ clips: clips.map((c, order) => ({ ...c, order })) });
    setSelectedClipId(right.id);
    setMessage(note);
  }, [
    sortedClips,
    selectedClipId,
    playheadMs,
    project.defaultTransition,
    persist,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        splitSelectedAtPlayhead();
        return;
      }
      if (e.key === "Escape") {
        if (document.fullscreenElement) void document.exitFullscreen();
        setSelectedOverlay(null);
        setSelectedOverlayId(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedOverlayId) {
          e.preventDefault();
          removeOverlay(selectedOverlayId);
          return;
        }
        if (selectedClipId) {
          e.preventDefault();
          removeClip(selectedClipId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    togglePlay,
    undo,
    redo,
    selectedClipId,
    selectedOverlayId,
    splitSelectedAtPlayhead,
  ]);

  function addOverlay(kind: Extract<ProjectOverlay["kind"], "text" | "badge">) {
    const overlay = createOverlay({
      kind,
      text:
        kind === "badge"
          ? brand.atelierLine || "Atelier"
          : brand.wordmark || "Maison Sacko",
      durationMs: timelineMs,
    });
    persist({ overlays: [...(project.overlays || []), overlay] });
    setSelectedOverlayId(overlay.id);
    setMobileTab("text");
    setMessage("Text layer added — drag it on the preview.");
  }

  async function uploadMediaOverlay(
    files: FileList | null,
    kind: "image" | "video" | "logo",
  ) {
    const file = files?.[0];
    if (!file) return;
    setBusy("overlay");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("durationMs", String(timelineMs));
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const overlay = createOverlay({
        kind,
        imageUrl:
          kind === "image" || kind === "logo" ? data.clip.url : undefined,
        videoUrl: kind === "video" ? data.clip.url : undefined,
        durationMs: timelineMs,
        text: file.name.replace(/\.[^.]+$/, ""),
      });
      persist({ overlays: [...(project.overlays || []), overlay] });
      setSelectedOverlayId(overlay.id);
      setMobileTab("text");
      setMessage(
        kind === "logo"
          ? "Logo on the cut — drag to place."
          : `${kind === "image" ? "Image" : "Video"} overlay added — drag to place.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Overlay upload failed",
      );
    } finally {
      setBusy(null);
    }
  }

  async function uploadFont(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy("font");
    try {
      const form = new FormData();
      form.append("font", file);
      const res = await fetch("/api/brand", { method: "PUT", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Font upload failed");
      setBrand(data.brand);
      const newest = data.brand.customFonts?.[data.brand.customFonts.length - 1];
      if (newest) {
        await fetch("/api/brand", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayFont: newest.family,
            bodyFont: newest.family,
          }),
        }).then(async (r) => {
          const j = await r.json();
          if (j.brand) setBrand(j.brand);
        });
      }
      setMessage(`Font loaded: ${file.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Font failed");
    } finally {
      setBusy(null);
    }
  }

  async function applyFontRole(role: "displayFont" | "bodyFont", family: string) {
    try {
      const res = await fetch("/api/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [role]: family }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not apply font");
      setBrand(data.brand);
      setMessage(role === "displayFont" ? "Title font updated." : "Caption font updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Font apply failed");
    }
  }

  function onTrimHandlePointerDown(
    e: ReactPointerEvent,
    clipId: string,
    edge: "in" | "out",
  ) {
    e.preventDefault();
    e.stopPropagation();
    const track = (e.currentTarget as HTMLElement).closest(
      ".mso-track-clips",
    ) as HTMLElement | null;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!track || !clip) return;

    const trackWidth = track.getBoundingClientRect().width;
    const startX = e.clientX;
    const startIn = clip.trimStartMs;
    const startOut =
      clip.trimEndMs > 0 ? clip.trimEndMs : clip.durationMs;
    const pxToMs = timelineMs / Math.max(1, trackWidth);
    let latest = project.clips;

    const onMove = (ev: PointerEvent) => {
      const deltaMs = (ev.clientX - startX) * pxToMs;
      latest = latest.map((c) => {
        if (c.id !== clipId) return c;
        if (edge === "in") {
          const trimStartMs = Math.max(
            0,
            Math.min(
              (c.trimEndMs > 0 ? c.trimEndMs : c.durationMs) - 500,
              Math.round(startIn + deltaMs),
            ),
          );
          return { ...c, trimStartMs };
        }
        const trimEndMs = Math.max(
          c.trimStartMs + 500,
          Math.min(c.durationMs, Math.round(startOut + deltaMs)),
        );
        return { ...c, trimEndMs };
      });
      setProject((prev) => ({ ...prev, clips: latest }));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      persist({ clips: latest });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function updateOverlay(id: string, partial: Partial<ProjectOverlay>) {
    const overlays = (project.overlays || []).map((o) =>
      o.id === id ? { ...o, ...partial } : o,
    );
    persist({ overlays });
  }

  function removeOverlay(id: string) {
    persist({
      overlays: (project.overlays || []).filter((o) => o.id !== id),
    });
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  }

  function updateCaptionTextFromBox(value: string) {
    if (!value.trim()) {
      persist({ captions: [] });
      return;
    }
    const lines = value.split("\n");
    const captions = lines.map((text, index) => {
      const existing = project.captions[index];
      return {
        text,
        startMs: existing?.startMs ?? index * 2500,
        endMs: existing?.endMs ?? index * 2500 + 2300,
        words: existing?.words,
      };
    });
    persist({ captions });
  }

  function onChangeCaption(index: number, value: string) {
    if (!project.captions.length) {
      persist({
        captions: [{ text: value, startMs: 0, endMs: 3000 }],
        showCaptionOverlay: true,
      });
      return;
    }
    const captions = project.captions.map((c, i) =>
      i === index ? { ...c, text: value } : c,
    );
    persist({ captions });
  }

  function seekToClip(clipId: string) {
    setSelectedClipId(clipId);
    const leadIn = presetLeadInMs();
    let offset = leadIn;
    for (const clip of sortedClips) {
      const dur = usableClipDurationMs(clip);
      if (clip.id === clipId) {
        const frame = Math.round((offset / 1000) * 30);
        playerRef.current?.seekTo(frame);
        break;
      }
      offset += dur;
      const tid = clip.transitionOut || project.defaultTransition || "none";
      const frames =
        tid === "none" ? 0 : (TRANSITION_META[tid]?.frames ?? 18);
      offset -= (frames / 30) * 1000;
    }
  }

  const captionBoxValue = project.captions.map((c) => c.text).join("\n");
  const playheadLeft = `${playhead * 100}%`;

  return (
    <div className="mso-studio" data-mobile-tab={mobileTab}>
      <CustomFontFaces fonts={brand.customFonts || []} />
      <StudioTopbar
        canUndo={canUndo}
        canRedo={canRedo}
        saveStatus={saveStatus}
        renderJob={renderJob}
        busyRender={busy === "render"}
        clipsEmpty={sortedClips.length === 0}
        onUndo={undo}
        onRedo={redo}
        onExport={startRender}
      />

      {/* Left */}
      <aside className="mso-panel mso-panel-left" aria-label="Media and edit">
        <div className="mso-block" data-block="media">
        <h2 className="mso-section-title">Clips</h2>
        <label className="mso-btn">
          <input
            type="file"
            accept="video/*"
            multiple
            onChange={(e) => onUploadClips(e.target.files)}
          />
          {busy === "upload" ? "Uploading…" : "Add Clips"}
        </label>
        <div className="mso-clip-grid">
          {sortedClips.map((clip) => (
            <div
              key={clip.id}
              className={`mso-thumb${selectedClipId === clip.id ? " selected" : ""}${dragId === clip.id ? " dragging" : ""}${dragOverId === clip.id ? " drag-over" : ""}`}
              draggable
              onDragStart={() => setDragId(clip.id)}
              onDragEnd={() => {
                setDragId(null);
                setDragOverId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverId(clip.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) reorderClips(dragId, clip.id);
                setDragId(null);
                setDragOverId(null);
              }}
              onClick={() => {
                seekToClip(clip.id);
                setMobileTab("edit");
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  seekToClip(clip.id);
                  setMobileTab("edit");
                }
              }}
            >
              <video src={clip.url} muted preload="metadata" />
              <button
                type="button"
                className="remove"
                aria-label="Remove clip"
                onClick={(e) => {
                  e.stopPropagation();
                  removeClip(clip.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {sortedClips.length > 1 ? (
          <p className="mso-hint">Drag thumbnails to reorder</p>
        ) : null}
        </div>

        <div className="mso-block" data-block="edit">
          <h2 className="mso-section-title">Edit</h2>
          <button
            type="button"
            className="mso-btn"
            onClick={splitSelectedAtPlayhead}
            disabled={!selectedClip}
          >
            Split at playhead
          </button>
          <p className="mso-hint">Timeline: trim edges · transition · Ctrl+B</p>
        </div>

        <div className="mso-block" data-block="media">
        <h2 className="mso-section-title">Music</h2>
        <label className="mso-btn">
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => onUploadMusic(e.target.files)}
          />
          {busy === "music" ? "Uploading…" : "Add Music"}
        </label>
        {project.musicUrl ? (
          <>
            <p className="mso-hint">
              {project.musicName || "Music bed loaded"} ·{" "}
              <button
                type="button"
                className="mso-linkish"
                onClick={() =>
                  persist({
                    musicUrl: undefined,
                    musicName: undefined,
                    musicEndMs: 0,
                  })
                }
              >
                Remove
              </button>
            </p>
            <label className="mso-field">
              <span>Music volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((project.musicVolume ?? 0.22) * 100)}
                onChange={(e) =>
                  persist({ musicVolume: Number(e.target.value) / 100 })
                }
              />
              <span className="mso-field-val">
                {Math.round((project.musicVolume ?? 0.22) * 100)}%
              </span>
            </label>
          </>
        ) : (
          <p className="mso-hint">No music bed yet</p>
        )}

        <h2 className="mso-section-title">Voiceover</h2>
        <MicVoiceRecorder
          disabled={busy === "voice"}
          onRecorded={(url, name) => {
            persist({
              voiceOver: {
                text: name,
                url,
                status: "ready",
              },
            });
            setMessage("Voice recorded onto this piece.");
          }}
        />
        {project.voiceOver?.status === "ready" && project.voiceOver.url ? (
          <p className="mso-hint">
            Mic take attached ·{" "}
            <button
              type="button"
              className="mso-linkish"
              onClick={() =>
                persist({
                  voiceOver: { text: "", status: "idle" },
                })
              }
            >
              Remove
            </button>
          </p>
        ) : null}
        </div>

        <div className="mso-block" data-block="text">
        <h2 className="mso-section-title">On video</h2>
        <button
          type="button"
          className="mso-btn"
          onClick={() => addOverlay("text")}
        >
          Add text
        </button>
        <label className="mso-btn">
          <input
            type="file"
            accept=".svg,.png,.webp,.jpg,.jpeg,image/svg+xml,image/png,image/webp,image/jpeg"
            onChange={(e) => {
              uploadMediaOverlay(e.target.files, "logo");
              e.target.value = "";
            }}
          />
          {busy === "overlay" ? "Uploading…" : "Add logo"}
        </label>
        <div className="mso-btn-row mso-btn-row-2">
          <label className="mso-btn">
            <input
              type="file"
              accept="image/*,.svg,image/svg+xml"
              onChange={(e) => {
                uploadMediaOverlay(e.target.files, "image");
                e.target.value = "";
              }}
            />
            Image
          </label>
          <label className="mso-btn">
            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                uploadMediaOverlay(e.target.files, "video");
                e.target.value = "";
              }}
            />
            Video
          </label>
        </div>

        {(project.overlays || []).length ? (
          <ul className="mso-overlay-list">
            {(project.overlays || []).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={selectedOverlayId === o.id ? "active" : ""}
                  onClick={() => {
                    setSelectedOverlayId(o.id);
                    setMobileTab("text");
                  }}
                >
                  {o.kind === "logo"
                    ? `Logo · ${o.text || "mark"}`
                    : o.kind === "text" || o.kind === "badge"
                      ? o.text || "Text"
                      : `${o.kind} · ${o.text || "layer"}`}
                </button>
                <button
                  type="button"
                  className="mso-icon-x"
                  aria-label="Remove overlay"
                  onClick={() => removeOverlay(o.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {activeOverlay &&
        (activeOverlay.kind === "text" || activeOverlay.kind === "badge") ? (
          <label className="mso-field">
            <span>Copy</span>
            <input
              type="text"
              className="mso-input"
              value={activeOverlay.text}
              onChange={(e) =>
                updateOverlay(activeOverlay.id, { text: e.target.value })
              }
            />
          </label>
        ) : null}

        <h2 className="mso-section-title">Fonts</h2>
        <label className="mso-btn">
          <input
            type="file"
            accept=".woff2,.woff,.ttf,.otf,font/woff2,font/ttf"
            onChange={(e) => uploadFont(e.target.files)}
          />
          {busy === "font" ? "Uploading…" : "Upload Font"}
        </label>
        {(brand.customFonts || []).length ? (
          <ul className="mso-font-list">
            {(brand.customFonts || []).map((f) => (
              <li key={f.id} style={{ fontFamily: f.family }}>
                {f.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mso-hint">Upload .woff2 / .ttf / .otf typefaces</p>
        )}
        <label className="mso-field">
          <span>Title font</span>
          <select
            className="mso-select"
            value={brand.displayFont}
            onChange={(e) => applyFontRole("displayFont", e.target.value)}
          >
            <option value="Cabinet Grotesk">Cabinet Grotesk</option>
            {(brand.customFonts || []).map((f) => (
              <option key={f.id} value={f.family}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mso-field">
          <span>Caption font</span>
          <select
            className="mso-select"
            value={brand.bodyFont}
            onChange={(e) => applyFontRole("bodyFont", e.target.value)}
          >
            <option value="Cabinet Grotesk">Cabinet Grotesk</option>
            {(brand.customFonts || []).map((f) => (
              <option key={f.id} value={f.family}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        </div>
      </aside>

      {/* Center */}
      <section className="mso-center">
        <div className="mso-stage" ref={stageRef}>
          <div className="mso-preview-slot">
            <PreviewPlayer
              project={project}
              brand={brand}
              playerRef={playerRef}
              selectedOverlay={selectedOverlay}
              onSelectOverlay={setSelectedOverlay}
              onChangeHook={(value) =>
                persist({ hook: value, showTitle: Boolean(value) })
              }
              onChangeCaption={onChangeCaption}
              activeCaptionIndex={activeCaptionIndex}
              onActiveCaptionChange={setActiveCaptionIndex}
              onProgress={(ratio, ms) => {
                setPlayhead(ratio);
                setPlayheadMs(ms);
              }}
              onPlayingChange={setPlaying}
              showTitle={Boolean(project.showTitle)}
              showCaptionOverlay={Boolean(project.showCaptionOverlay)}
              selectedOverlayId={selectedOverlayId}
              onSelectOverlayId={setSelectedOverlayId}
              onMoveOverlay={(id, offsetX, offsetY) =>
                updateOverlay(id, { offsetX, offsetY })
              }
              onScaleOverlay={(id, scale) => updateOverlay(id, { scale })}
            />
          </div>
          <StudioTransport
            muted={muted}
            playing={playing}
            isFullscreen={isFullscreen}
            onToggleMute={() => setMuted((m) => !m)}
            onTogglePlay={togglePlay}
            onToggleFullscreen={toggleFullscreen}
          />
        </div>
      </section>

      {/* Right */}
      <aside className="mso-panel mso-panel-right" aria-label="Style and captions">
        <div className="mso-block" data-block="style">
        <h2 className="mso-section-title">Format</h2>
        <div className="mso-format-shapes">
          <button
            type="button"
            className={`mso-format-opt${project.format === "reel" || project.format === "story" ? " active" : ""}`}
            onClick={() => setFormat("reel")}
            aria-label="Reel 9:16"
          >
            <span className="shape portrait" />
            <span className="mso-format-caption">Reel 9:16</span>
          </button>
          <button
            type="button"
            className={`mso-format-opt${project.format === "youtube" ? " active" : ""}`}
            onClick={() => setFormat("youtube")}
            aria-label="YouTube 16:9"
          >
            <span className="shape landscape" />
            <span className="mso-format-caption">YouTube 16:9</span>
          </button>
        </div>

        <h2 className="mso-section-title">Looks</h2>
        <div className="mso-looks">
          {LOOK_LIST.map((look) => (
            <button
              key={look.id}
              type="button"
              className={`mso-look${(project.lookId || "none") === look.id ? " active" : ""}`}
              onClick={() => persist({ lookId: look.id as LookId })}
              title={look.description}
            >
              <span className={`mso-look-swatch look-${look.id}`} />
              <span className="mso-look-name">{look.name}</span>
            </button>
          ))}
        </div>
        </div>

        <div className="mso-block" data-block="captions">
        <h2 className="mso-section-title">Captions</h2>
        <div className="mso-caption-actions">
          <div className="mso-lang">
            {(["en", "fr", "bilingual"] as CaptionLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                className={project.captionLanguage === lang ? "active" : ""}
                onClick={() => persist({ captionLanguage: lang })}
              >
                {lang === "bilingual" ? "Auto" : lang.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mso-btn"
            onClick={() => generateCaptions()}
            disabled={busy === "captions" || sortedClips.length === 0}
          >
            {busy === "captions" ? "Extracting…" : "Extract from Video"}
          </button>
        </div>
        <textarea
          className="mso-caption-box"
          value={captionBoxValue}
          placeholder="Speech captions appear here after extract. One line per segment."
          onChange={(e) => updateCaptionTextFromBox(e.target.value)}
        />
        <p className="mso-hint">Extract speech when OPENAI_API_KEY is set.</p>
        </div>
      </aside>

      <StudioTimeline
        project={project}
        sortedClips={sortedClips}
        timelineMs={timelineMs}
        playheadRatio={playhead}
        selectedClipId={selectedClipId}
        selectedOverlayId={selectedOverlayId}
        activeCaptionIndex={activeCaptionIndex}
        playerRef={playerRef}
        onSeekClip={seekToClip}
        onSplit={splitSelectedAtPlayhead}
        onSetClipTransition={(clipId, id) =>
          persist({
            defaultTransition: id,
            clips: setClipTransition(project.clips, clipId, id),
          })
        }
        onTrimPointerDown={onTrimHandlePointerDown}
        onMusicRangeChange={(startMs, endMs) =>
          persist({ musicStartMs: startMs, musicEndMs: endMs })
        }
        onSelectOverlay={(id) => {
          setSelectedOverlayId(id);
          setMobileTab("text");
        }}
        onOverlayRangeChange={(id, startMs, endMs) =>
          updateOverlay(id, { startMs, endMs })
        }
        onSelectCaption={(index) => {
          setActiveCaptionIndex(index);
          setSelectedOverlay("caption");
          setMobileTab("captions");
        }}
        onCaptionRangeChange={(index, startMs, endMs) => {
          const captions = project.captions.map((c, i) =>
            i === index ? { ...c, startMs, endMs } : c,
          );
          persist({ captions });
        }}
      />

      <div className="mso-credit">
        <div>Product by Maison Sacko</div>
        <div className="light">Credit: Raj Sacko</div>
      </div>

      <nav className="mso-dock" aria-label="Studio tools">
        {(
          [
            ["media", "Media"],
            ["edit", "Edit"],
            ["text", "Text"],
            ["style", "Style"],
            ["captions", "Caps"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`mso-dock-btn${mobileTab === id ? " active" : ""}`}
            onClick={() => setMobileTab(id)}
          >
            <span className="mso-dock-dot" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {message ? (
        <div className="mso-toast" role="status">
          {message}
        </div>
      ) : null}
    </div>
  );
}

function probeDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const ms = Math.round((video.duration || 5) * 1000);
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(5000);
    };
    video.src = url;
  });
}
