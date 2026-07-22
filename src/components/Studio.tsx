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
import {
  clampLayersToTimeline,
  clipPositionsOnTimeline,
  clipsTimelineMs,
  magnetizeTimelineRatio,
  rippleShiftTimedLayers,
  stepPlayheadToJoin,
  usableClipDurationMs,
} from "@/lib/timeline";
import { snapOverlayAxis } from "@/lib/overlaySnap";
import { useProjectSession } from "@/hooks/useProjectSession";
import { CustomFontFaces } from "./CustomFontFaces";
import { PreviewPlayer } from "./PreviewPlayer";
import { MicVoiceRecorder } from "./MicVoiceRecorder";
import { ClipThumb } from "./studio/ClipThumb";
import { StudioTimeline } from "./studio/StudioTimeline";
import { StudioTopbar } from "./studio/StudioTopbar";
import { StudioTransport } from "./studio/StudioTransport";

type MobileTab = "media" | "edit" | "text" | "style" | "captions";

type StudioToast = {
  text: string;
  tone: "ok" | "err" | "info";
  href?: string;
  hrefLabel?: string;
};

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
    voiceOverStartMs: p.voiceOverStartMs ?? 0,
    voiceOverEndMs: p.voiceOverEndMs ?? 0,
    voiceOverVolume:
      typeof p.voiceOverVolume === "number" ? p.voiceOverVolume : 1,
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
  const [toast, setToast] = useState<StudioToast | null>(null);
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
  const musicVolMem = useRef(initialProject.musicVolume ?? 0.22);
  const voiceVolMem = useRef(initialProject.voiceOverVolume ?? 1);
  const brandSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandPending = useRef<Partial<BrandKit>>({});
  const [showKbTips, setShowKbTips] = useState(true);
  const [playhead, setPlayhead] = useState(0);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(() => {
    if (typeof window === "undefined") return 1;
    try {
      const z = Number(localStorage.getItem("mso-tl-zoom"));
      if (Number.isFinite(z) && z >= 1 && z <= 4) {
        return Math.round(z * 100) / 100;
      }
    } catch {
      /* ignore */
    }
    return 1;
  });
  const [historyFlash, setHistoryFlash] = useState<{
    kind: "undo" | "redo";
    id: number;
  } | null>(null);
  const historyFlashId = useRef(0);
  const [opacityHud, setOpacityHud] = useState<number | null>(null);
  const opacityHudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [enhanceStrength, setEnhanceStrength] = useState<
    "light" | "medium" | "strong"
  >(() => {
    if (typeof window === "undefined") return "medium";
    try {
      const s = localStorage.getItem("mso-enhance-strength");
      if (s === "light" || s === "medium" || s === "strong") return s;
    } catch {
      /* ignore */
    }
    return "medium";
  });

  function flashHistory(kind: "undo" | "redo") {
    historyFlashId.current += 1;
    setHistoryFlash({ kind, id: historyFlashId.current });
  }

  const setMessage = useCallback((text: string | null, tone: StudioToast["tone"] = "info") => {
    if (!text) {
      setToast(null);
      return;
    }
    setToast({ text, tone });
  }, []);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
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
    try {
      localStorage.setItem("mso-enhance-strength", enhanceStrength);
    } catch {
      /* ignore */
    }
  }, [enhanceStrength]);

  useEffect(() => {
    try {
      if (localStorage.getItem("mso-kb-tips") === "0") setShowKbTips(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("mso-tl-zoom", String(timelineZoom));
    } catch {
      /* ignore */
    }
  }, [timelineZoom]);

  useEffect(() => {
    if (
      !renderJob ||
      renderJob.status === "ready" ||
      renderJob.status === "error" ||
      renderJob.status === "cancelled"
    ) {
      return;
    }
    const timer = setInterval(async () => {
      const res = await fetch(`/api/render/${renderJob.id}`);
      const data = await res.json();
      if (data.job) setRenderJob(data.job);
    }, 650);
    return () => clearInterval(timer);
  }, [renderJob]);

  useEffect(() => {
    if (renderJob?.status === "error") {
      setMessage(renderJob.error || "Export failed.", "err");
      setBusy(null);
    }
    if (renderJob?.status === "cancelled") {
      setBusy(null);
      setMessage("Export cancelled.");
    }
    if (renderJob?.status === "ready") {
      setBusy(null);
      setToast({
        text: "Export ready",
        tone: "ok",
        href: renderJob.outputUrl || undefined,
        hrefLabel: "Download",
      });
    }
  }, [renderJob?.status, renderJob?.error, renderJob?.outputUrl, setMessage]);

  useEffect(() => {
    playerRef.current?.setVolume(muted ? 0 : 1);
  }, [muted]);

  useEffect(() => {
    if (!toast) return;
    const ms = toast.href ? 9000 : toast.tone === "err" ? 6200 : 4200;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast]);

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

  function persistClips(clips: ProjectClip[]) {
    const ms = Math.max(
      1000,
      clipsTimelineMs(clips, project.defaultTransition || "crossfade"),
    );
    const clamped = clampLayersToTimeline({ ...project, clips }, ms);
      persist({
        clips,
        overlays: clamped.overlays as ProjectOverlay[],
        captions: clamped.captions,
        musicStartMs: clamped.musicStartMs,
        musicEndMs: clamped.musicEndMs,
        voiceOverStartMs: clamped.voiceOverStartMs,
        voiceOverEndMs: clamped.voiceOverEndMs,
      });
  }
  const overlaySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Instant canvas updates — history + disk flush after a short pause. */
  function updateOverlay(id: string, partial: Partial<ProjectOverlay>) {
    let nextOverlays: ProjectOverlay[] = [];
    setProject((prev) => {
      nextOverlays = (prev.overlays || []).map((o) =>
        o.id === id ? { ...o, ...partial } : o,
      );
      return { ...prev, overlays: nextOverlays };
    });
    if (overlaySaveTimer.current) clearTimeout(overlaySaveTimer.current);
    overlaySaveTimer.current = setTimeout(() => {
      apply({ overlays: nextOverlays });
    }, 280);
  }

  /** Scrub opacity with a live % HUD twin on the canvas. */
  function scrubOverlayOpacity(id: string, opacity: number) {
    updateOverlay(id, { opacity });
    setOpacityHud(opacity);
    if (opacityHudTimer.current) clearTimeout(opacityHudTimer.current);
    opacityHudTimer.current = setTimeout(() => setOpacityHud(null), 700);
  }

  async function onUploadClips(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setMessage(null);
    try {
      const uploaded: ProjectClip[] = [];
      let convertedAny = false;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const looksPhone =
          /\.(mov|m4v|hevc)$/i.test(file.name) ||
          file.type === "video/quicktime";
        if (looksPhone) {
          setMessage(`Converting ${file.name} to H.264 MP4 for preview…`);
        }
        const durationMs = await probeDuration(file);
        const form = new FormData();
        form.append("file", file);
        form.append("durationMs", String(durationMs));
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        if (data.converted) convertedAny = true;
        uploaded.push({
          ...data.clip,
          order: project.clips.length + i,
        });
      }
      const clips = [...project.clips, ...uploaded].map((c, order) => ({
        ...c,
        order,
      }));
      persistClips(clips);
      setSelectedClipId(uploaded[0]?.id ?? selectedClipId);
      setMessage(
        convertedAny
          ? "Clips ready — phone .MOV was converted for Chrome/Remotion."
          : "Clips added.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed", "err");
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
      const audioMs = await probeDuration(file);
      const form = new FormData();
      form.append("file", file);
      form.append("durationMs", String(audioMs));
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Music upload failed");
      const bedMs = Math.min(audioMs, timelineMs);
      persist({
        musicUrl: data.clip.url,
        musicName: file.name,
        musicStartMs: 0,
        musicEndMs: Math.max(500, bedMs),
        musicVolume: project.musicVolume ?? 0.22,
      });
      setMessage(`Music: ${file.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Music failed", "err");
    } finally {
      setBusy(null);
    }
  }

  function reorderClips(fromId: string, toId: string) {
    if (fromId === toId) return;
    const list = [...sortedClips];
    const from = list.findIndex((c) => c.id === fromId);
    const to = list.findIndex((c) => c.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    persistClips(list.map((c, order) => ({ ...c, order })));
  }

  async function generateCaptions(
    language: CaptionLanguage = project.captionLanguage,
  ) {
    setBusy("captions");
    setMessage("Preparing speech audio…");
    try {
      const res = await fetch("/api/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          language,
          enhanceAudio: true,
        }),
      });

      const ctype = res.headers.get("content-type") || "";
      if (!res.ok && !ctype.includes("ndjson")) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "Caption failed",
        );
      }

      if (!res.body) {
        throw new Error("Caption stream unavailable");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let doneProject: Project | null = null;
      let count = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop() || "";
        for (const line of parts) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as {
            type: string;
            error?: string;
            index?: number;
            total?: number;
            name?: string;
            phase?: string;
            project?: Project;
            count?: number;
          };
          if (ev.type === "error") {
            throw new Error(ev.error || "Caption failed");
          }
          if (ev.type === "clip") {
            const n = (ev.index ?? 0) + 1;
            const phase =
              ev.phase === "transcribe" ? "Transcribing" : "Cleaning audio";
            setMessage(`${phase} ${n}/${ev.total} · ${ev.name || "clip"}`);
          } else if (ev.type === "clip_done") {
            setMessage(
              `Clip ${(ev.index ?? 0) + 1}/${ev.total} done · packing lines…`,
            );
          } else if (ev.type === "done" && ev.project) {
            doneProject = ev.project;
            count = ev.count ?? ev.project.captions?.length ?? 0;
          }
        }
      }

      if (!doneProject) {
        throw new Error("Caption generation ended without results");
      }
      ingest(normalizeProject(doneProject));
      setActiveCaptionIndex(0);
      setMessage(`Captions ready · ${count} lines from your speech.`, "ok");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Caption failed", "err");
    } finally {
      setBusy(null);
    }
  }

  async function enhanceAudio(opts: {
    clipId?: string;
    allClips?: boolean;
    voiceOver?: boolean;
    restore?: boolean;
    strength?: "light" | "medium" | "strong";
  }) {
    setBusy("enhance");
    setMessage(
      opts.restore
        ? "Restoring original audio…"
        : `Reducing noise (${opts.strength || enhanceStrength})…`,
    );
    try {
      const res = await fetch("/api/audio/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          clipId: opts.clipId,
          allClips: opts.allClips,
          voiceOver: opts.voiceOver,
          restore: opts.restore,
          strength: opts.strength || enhanceStrength,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enhance failed");
      ingest(normalizeProject(data.project));
      if (opts.restore) {
        setMessage("Original audio restored.", "ok");
      } else if (opts.voiceOver) {
        setMessage("Voice take cleaned.", "ok");
      } else {
        setMessage(
          opts.allClips
            ? `Noise reduced on ${data.count ?? "all"} clips.`
            : "Background noise reduced on this clip.",
          "ok",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Enhance failed",
        "err",
      );
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
      /* Progress lives on the Export button — no start toast. */
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Render failed", "err");
    } finally {
      setBusy(null);
    }
  }

  async function cancelRender() {
    const id = renderJob?.id;
    if (!id) return;
    try {
      const res = await fetch(`/api/render/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.job) setRenderJob(data.job);
      else setRenderJob(null);
      setBusy(null);
    } catch {
      setMessage("Could not cancel export.", "err");
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
    persistClips(clips.map((c, order) => ({ ...c, order })));
    setSelectedClipId(right.id);
    setMessage(note);
  }, [
    sortedClips,
    selectedClipId,
    playheadMs,
    project.defaultTransition,
    project,
  ]);

  const selectedClipIdRef = useRef(selectedClipId);
  const selectedOverlayIdRef = useRef(selectedOverlayId);
  const projectRef = useRef(project);
  const playheadMsRef = useRef(playheadMs);
  selectedClipIdRef.current = selectedClipId;
  selectedOverlayIdRef.current = selectedOverlayId;
  projectRef.current = project;
  playheadMsRef.current = playheadMs;

  const removeClip = useCallback(
    (id: string, ripple = false) => {
      const prev = projectRef.current;
      const fallback = prev.defaultTransition || "crossfade";
      const positions = clipPositionsOnTimeline(prev.clips, fallback);
      const pos = positions.find((p) => p.id === id);
      const clips = prev.clips
        .filter((c) => c.id !== id)
        .map((c, order) => ({ ...c, order }));
      const ms = Math.max(1000, clipsTimelineMs(clips, fallback));
      let next = { ...prev, clips };
      if (ripple && pos) {
        next = rippleShiftTimedLayers(next, pos.startMs, pos.durationMs);
      }
      const clamped = clampLayersToTimeline(next, ms);
      persist({
        clips,
        overlays: clamped.overlays as ProjectOverlay[],
        captions: clamped.captions,
        musicStartMs: clamped.musicStartMs,
        musicEndMs: clamped.musicEndMs,
        voiceOverStartMs: clamped.voiceOverStartMs,
        voiceOverEndMs: clamped.voiceOverEndMs,
      });
      if (selectedClipIdRef.current === id) {
        setSelectedClipId(clips[0]?.id ?? null);
      }
      if (ripple && pos) {
        setMessage("Ripple delete · gap closed");
      }
    },
    [persist, setMessage],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          Boolean(target.closest("[contenteditable=true]")));
      if (typing) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (redo()) {
            setMessage("Redone");
            flashHistory("redo");
          }
        } else if (undo()) {
          setMessage("Undone");
          flashHistory("undo");
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        if (redo()) {
          setMessage("Redone");
          flashHistory("redo");
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setTimelineZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        setTimelineZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        setTimelineZoom(1);
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
      if (
        selectedOverlayIdRef.current &&
        (e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown")
      ) {
        e.preventDefault();
        const id = selectedOverlayIdRef.current;
        const prev = projectRef.current;
        const o = (prev.overlays || []).find((x) => x.id === id);
        if (!o) return;
        const step = e.shiftKey ? 2 : 0.5;
        let offsetX = o.offsetX;
        let offsetY = o.offsetY;
        if (e.key === "ArrowLeft") offsetX -= step;
        if (e.key === "ArrowRight") offsetX += step;
        if (e.key === "ArrowUp") offsetY -= step;
        if (e.key === "ArrowDown") offsetY += step;
        offsetX = snapOverlayAxis(offsetX);
        offsetY = snapOverlayAxis(offsetY);
        const overlays = (prev.overlays || []).map((x) =>
          x.id === id ? { ...x, offsetX, offsetY } : x,
        );
        setProject({ ...prev, overlays });
        if (overlaySaveTimer.current) clearTimeout(overlaySaveTimer.current);
        overlaySaveTimer.current = setTimeout(() => {
          persist({ overlays });
        }, 280);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const prev = projectRef.current;
        const fallback = prev.defaultTransition || "crossfade";
        const total = Math.max(
          1000,
          clipsTimelineMs(prev.clips, fallback),
        );
        const nextMs = stepPlayheadToJoin(
          playheadMsRef.current,
          e.key === "ArrowRight" ? 1 : -1,
          prev.clips,
          total,
          fallback,
        );
        const ratio = nextMs / total;
        playerRef.current?.seekTo(Math.round((nextMs / 1000) * 30));
        setPlayhead(ratio);
        setPlayheadMs(nextMs);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const overlayId = selectedOverlayIdRef.current;
        const clipId = selectedClipIdRef.current;
        if (overlayId) {
          e.preventDefault();
          const prev = projectRef.current;
          persist({
            overlays: (prev.overlays || []).filter((o) => o.id !== overlayId),
          });
          setSelectedOverlayId(null);
          return;
        }
        if (clipId) {
          e.preventDefault();
          removeClip(clipId, e.shiftKey);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, undo, redo, splitSelectedAtPlayhead, persist, setProject, removeClip]);

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
    setEditRequestId(overlay.id);
    setMobileTab("text");
    setMessage("Text on canvas — type now. Click again later to edit.");
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
          ? "Logo on canvas — drag · corner to resize · tint color in panel."
          : `${kind === "image" ? "Image" : "Video"} on canvas — drag · corner to resize.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Overlay upload failed",
        "err",
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
      setMessage(error instanceof Error ? error.message : "Font failed", "err");
    } finally {
      setBusy(null);
    }
  }

  async function applyFontRole(role: "displayFont" | "bodyFont", family: string) {
    patchBrand({ [role]: family });
    setMessage(
      role === "displayFont" ? "Title font updated." : "Caption font updated.",
    );
  }

  function patchBrand(partial: Partial<BrandKit>) {
    setBrand((prev) => ({ ...prev, ...partial }));
    brandPending.current = { ...brandPending.current, ...partial };
    if (brandSaveTimer.current) clearTimeout(brandSaveTimer.current);
    brandSaveTimer.current = setTimeout(async () => {
      const payload = brandPending.current;
      brandPending.current = {};
      try {
        const res = await fetch("/api/brand", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Brand save failed");
        if (data.brand) setBrand(data.brand);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Brand save failed",
          "err",
        );
      }
    }, 420);
  }

  function onTrimHandlePointerDown(
    e: ReactPointerEvent,
    clipId: string,
    edge: "in" | "out",
  ) {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    const track = handle.closest(".mso-track-clips") as HTMLElement | null;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!track || !clip) return;

    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

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

    const onUp = (ev: PointerEvent) => {
      try {
        handle.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      persistClips(latest);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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
    <div className="mso-studio" data-mobile-tab={mobileTab ?? "closed"}>
      <CustomFontFaces fonts={brand.customFonts || []} />
      <StudioTopbar
        canUndo={canUndo}
        canRedo={canRedo}
        saveStatus={saveStatus}
        renderJob={renderJob}
        busyRender={busy === "render"}
        clipsEmpty={sortedClips.length === 0}
        historyFlash={historyFlash}
        onUndo={() => {
          if (undo()) {
            setMessage("Undone");
            flashHistory("undo");
          }
        }}
        onRedo={() => {
          if (redo()) {
            setMessage("Redone");
            flashHistory("redo");
          }
        }}
        onExport={startRender}
        onCancelExport={cancelRender}
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
        <p className="mso-hint">
          Phone .MOV is auto-converted to H.264 MP4. Prefer MP4 when you can.
        </p>
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
              <ClipThumb src={clip.url} trimStartMs={clip.trimStartMs} />
              {clip.audioEnhanced ? (
                <span className="mso-thumb-badge" title="Audio enhanced">
                  Clean
                </span>
              ) : null}
              <button
                type="button"
                className="remove"
                aria-label="Remove clip"
                onClick={(e) => {
                  e.stopPropagation();
                  removeClip(clip.id, e.shiftKey);
                }}
                title="Delete clip · Shift+click to ripple close gap"
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
          <button
            type="button"
            className="mso-btn"
            onClick={() => selectedClip && removeClip(selectedClip.id, true)}
            disabled={!selectedClip || sortedClips.length < 1}
            title="Delete clip and close the gap · Shift+Delete on timeline"
          >
            Ripple delete
          </button>

          <h2 className="mso-section-title" style={{ marginTop: "1.1rem" }}>
            Audio
          </h2>
          <div className="mso-lang" role="group" aria-label="Noise reduce strength">
            {(
              [
                ["light", "Light"],
                ["medium", "Medium"],
                ["strong", "Strong"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={enhanceStrength === id ? "active" : ""}
                onClick={() => setEnhanceStrength(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mso-btn"
            onClick={() =>
              selectedClip &&
              enhanceAudio({
                clipId: selectedClip.id,
                strength: enhanceStrength,
              })
            }
            disabled={!selectedClip || busy === "enhance"}
            title="Remove background noise and clear speech on the selected clip"
          >
            {busy === "enhance"
              ? "Enhancing…"
              : selectedClip?.audioEnhanced
                ? "Re-enhance selected clip"
                : "Reduce noise on clip"}
          </button>
          {selectedClip?.audioEnhanced || selectedClip?.originalUrl ? (
            <button
              type="button"
              className="mso-btn"
              onClick={() =>
                selectedClip &&
                enhanceAudio({ clipId: selectedClip.id, restore: true })
              }
              disabled={!selectedClip || busy === "enhance"}
            >
              Restore original audio
            </button>
          ) : null}
          <button
            type="button"
            className="mso-btn"
            onClick={() =>
              enhanceAudio({ allClips: true, strength: enhanceStrength })
            }
            disabled={sortedClips.length === 0 || busy === "enhance"}
          >
            Enhance all clips
          </button>
          <p className="mso-hint">
            Spectral denoise + speech polish. Originals kept for restore.
            {selectedClip?.audioEnhanced ? " · This clip is enhanced." : ""}
          </p>
          <p className="mso-hint">
            Timeline: trim · transition · Ctrl+B · Shift+Delete ripples
          </p>
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
              <span>
                Music volume{" "}
                <button
                  type="button"
                  className="mso-linkish"
                  onClick={() => {
                    const cur = project.musicVolume ?? 0.22;
                    if (cur > 0.001) {
                      musicVolMem.current = cur;
                      persist({ musicVolume: 0 });
                    } else {
                      persist({
                        musicVolume: musicVolMem.current || 0.22,
                      });
                    }
                  }}
                >
                  {(project.musicVolume ?? 0.22) < 0.001 ? "Unmute" : "Mute"}
                </button>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((project.musicVolume ?? 0.22) * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  if (v > 0.001) musicVolMem.current = v;
                  setProject((prev) => ({ ...prev, musicVolume: v }));
                }}
                onPointerUp={(e) => {
                  const v =
                    Number((e.target as HTMLInputElement).value) / 100;
                  persist({ musicVolume: v });
                }}
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
          onRecorded={async (url, name) => {
            let takeMs = Math.min(timelineMs, 15000);
            try {
              const res = await fetch(url);
              const blob = await res.blob();
              const file = new File([blob], name || "vo.webm", {
                type: blob.type || "audio/webm",
              });
              takeMs = Math.min(timelineMs, await probeDuration(file));
            } catch {
              /* keep fallback */
            }
            persist({
              voiceOver: {
                text: name,
                url,
                status: "ready",
              },
              voiceOverStartMs: 0,
              voiceOverEndMs: Math.max(500, takeMs),
              voiceOverVolume: project.voiceOverVolume ?? 1,
            });
            setMessage("Voice on the VO rail — drag edges to place.");
          }}
        />
        {project.voiceOver?.status === "ready" && project.voiceOver.url ? (
          <>
            <p className="mso-hint">
              Mic take attached ·{" "}
              <button
                type="button"
                className="mso-linkish"
                onClick={() =>
                  persist({
                    voiceOver: { text: "", status: "idle" },
                    voiceOverStartMs: 0,
                    voiceOverEndMs: 0,
                  })
                }
              >
                Remove
              </button>
              {" · "}
              <button
                type="button"
                className="mso-linkish"
                disabled={busy === "enhance"}
                onClick={() =>
                  enhanceAudio({
                    voiceOver: true,
                    strength: enhanceStrength,
                  })
                }
              >
                {project.voiceOver.audioEnhanced
                  ? "Re-enhance VO"
                  : "Clean VO noise"}
              </button>
              {project.voiceOver.audioEnhanced ||
              project.voiceOver.originalUrl ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="mso-linkish"
                    disabled={busy === "enhance"}
                    onClick={() =>
                      enhanceAudio({ voiceOver: true, restore: true })
                    }
                  >
                    Restore VO
                  </button>
                </>
              ) : null}
            </p>
            <label className="mso-field">
              <span>
                VO volume{" "}
                <button
                  type="button"
                  className="mso-linkish"
                  onClick={() => {
                    const cur = project.voiceOverVolume ?? 1;
                    if (cur > 0.001) {
                      voiceVolMem.current = cur;
                      persist({ voiceOverVolume: 0 });
                    } else {
                      persist({
                        voiceOverVolume: voiceVolMem.current || 1,
                      });
                    }
                  }}
                >
                  {(project.voiceOverVolume ?? 1) < 0.001 ? "Unmute" : "Mute"}
                </button>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((project.voiceOverVolume ?? 1) * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  if (v > 0.001) voiceVolMem.current = v;
                  setProject((prev) => ({ ...prev, voiceOverVolume: v }));
                }}
                onPointerUp={(e) => {
                  const v =
                    Number((e.target as HTMLInputElement).value) / 100;
                  persist({ voiceOverVolume: v });
                }}
              />
              <span className="mso-field-val">
                {Math.round((project.voiceOverVolume ?? 1) * 100)}%
              </span>
            </label>
            <p className="mso-hint">
              Music auto-ducks under VO during preview and export.
            </p>
          </>
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
          <div className="mso-overlay-style">
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
            <label className="mso-field">
              <span>Font</span>
              <select
                className="mso-select"
                value={
                  activeOverlay.fontFamily ||
                  brand.displayFont ||
                  "Cabinet Grotesk"
                }
                onChange={(e) =>
                  updateOverlay(activeOverlay.id, {
                    fontFamily: e.target.value,
                  })
                }
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
              <span>Size · {activeOverlay.fontSize || 36}px</span>
              <input
                type="range"
                min={16}
                max={96}
                step={1}
                value={activeOverlay.fontSize || 36}
                onChange={(e) =>
                  updateOverlay(activeOverlay.id, {
                    fontSize: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="mso-field">
              <span>Color</span>
              <input
                type="color"
                className="mso-input-color"
                value={activeOverlay.color || "#ffffff"}
                onChange={(e) =>
                  updateOverlay(activeOverlay.id, { color: e.target.value })
                }
              />
            </label>
            <label className="mso-check">
              <input
                type="checkbox"
                checked={
                  activeOverlay.hasPlate === true ||
                  (activeOverlay.hasPlate !== false &&
                    activeOverlay.kind === "badge")
                }
                onChange={(e) =>
                  updateOverlay(activeOverlay.id, {
                    hasPlate: e.target.checked,
                  })
                }
              />
              <span>Background plate</span>
            </label>
            <label className="mso-field">
              <span>
                Opacity · {Math.round((activeOverlay.opacity ?? 1) * 100)}%
              </span>
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                value={Math.round((activeOverlay.opacity ?? 1) * 100)}
                onChange={(e) =>
                  scrubOverlayOpacity(
                    activeOverlay.id,
                    Number(e.target.value) / 100,
                  )
                }
              />
            </label>
            <p className="mso-hint">Alt+scroll on canvas to nudge opacity.</p>
          </div>
        ) : null}

        {activeOverlay && activeOverlay.kind === "logo" ? (
          <div className="mso-overlay-style">
            <label className="mso-field">
              <span>Logo tint</span>
              <input
                type="color"
                className="mso-input-color"
                value={activeOverlay.fillColor || "#ffffff"}
                onChange={(e) =>
                  updateOverlay(activeOverlay.id, {
                    fillColor: e.target.value,
                  })
                }
              />
            </label>
            <label className="mso-field">
              <span>
                Opacity · {Math.round((activeOverlay.opacity ?? 1) * 100)}%
              </span>
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                value={Math.round((activeOverlay.opacity ?? 1) * 100)}
                onChange={(e) =>
                  scrubOverlayOpacity(
                    activeOverlay.id,
                    Number(e.target.value) / 100,
                  )
                }
              />
            </label>
            <p className="mso-hint">
              Works best on SVG / transparent marks. Drag the corner on the
              canvas to resize. Alt+scroll opacity.
            </p>
          </div>
        ) : null}

        {activeOverlay &&
        (activeOverlay.kind === "image" || activeOverlay.kind === "video") ? (
          <div className="mso-overlay-style">
            <label className="mso-field">
              <span>
                Opacity · {Math.round((activeOverlay.opacity ?? 1) * 100)}%
              </span>
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                value={Math.round((activeOverlay.opacity ?? 1) * 100)}
                onChange={(e) =>
                  scrubOverlayOpacity(
                    activeOverlay.id,
                    Number(e.target.value) / 100,
                  )
                }
              />
            </label>
            <p className="mso-hint">Alt+scroll on canvas to nudge opacity.</p>
          </div>
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
              onOpacityOverlay={scrubOverlayOpacity}
              opacityHud={opacityHud}
              onChangeOverlayText={(id, text) => updateOverlay(id, { text })}
              editRequestId={editRequestId}
              onEditRequestConsumed={() => setEditRequestId(null)}
              onAddClips={() => setMobileTab("media")}
            />
          </div>
          <StudioTransport
            muted={muted}
            playing={playing}
            isFullscreen={isFullscreen}
            playheadMs={playheadMs}
            timelineMs={timelineMs}
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

        <h2 className="mso-section-title">Brand on cut</h2>
        <label className="mso-field">
          <span>Wordmark</span>
          <input
            type="text"
            className="mso-input"
            value={brand.wordmark}
            onChange={(e) => patchBrand({ wordmark: e.target.value })}
          />
        </label>
        <label className="mso-field">
          <span>Accent</span>
          <input
            type="color"
            className="mso-input-color"
            value={brand.accent || "#5C5C5C"}
            onChange={(e) => patchBrand({ accent: e.target.value })}
          />
        </label>
        <label className="mso-field">
          <span>Foreground</span>
          <input
            type="color"
            className="mso-input-color"
            value={brand.foreground || "#000000"}
            onChange={(e) => patchBrand({ foreground: e.target.value })}
          />
        </label>
        <p className="mso-hint">
          Live on preview ·{" "}
          <Link href="/brand" className="mso-linkish">
            Full kit
          </Link>
        </p>
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
            title="Transcribe speech from your clips and burn captions on the timeline"
          >
            {busy === "captions" ? "Generating…" : "Generate from speech"}
          </button>
        </div>
        <label className="mso-check">
          <input
            type="checkbox"
            checked={Boolean(project.showCaptionOverlay)}
            onChange={(e) =>
              persist({ showCaptionOverlay: e.target.checked })
            }
          />
          <span>Show captions on video</span>
        </label>
        <textarea
          className="mso-caption-box"
          value={captionBoxValue}
          placeholder="Captions appear here after generate. One line per beat — edit freely."
          onChange={(e) => updateCaptionTextFromBox(e.target.value)}
        />
        <p className="mso-hint">
          Streams per clip with cleaned audio, timeline sync, and word-timed
          karaoke highlight. Needs OPENAI_API_KEY.
        </p>
        </div>
      </aside>

      <StudioTimeline
        project={project}
        sortedClips={sortedClips}
        timelineMs={timelineMs}
        playheadRatio={playhead}
        playheadMs={playheadMs}
        selectedClipId={selectedClipId}
        selectedOverlayId={selectedOverlayId}
        activeCaptionIndex={activeCaptionIndex}
        playerRef={playerRef}
        onSeekRatio={(ratio) => {
          const snapped = magnetizeTimelineRatio(
            ratio,
            timelineMs,
            sortedClips,
            project.defaultTransition || "crossfade",
          );
          const frame = Math.round(
            snapped * Math.max(1, (timelineMs / 1000) * 30),
          );
          playerRef.current?.seekTo(frame);
          setPlayhead(snapped);
          setPlayheadMs(Math.round(snapped * timelineMs));
        }}
        onSeekClip={seekToClip}
        onSplit={splitSelectedAtPlayhead}
        onSetClipTransition={(clipId, id) =>
          persist({
            defaultTransition: id,
            clips: setClipTransition(project.clips, clipId, id),
          })
        }
        onTrimPointerDown={onTrimHandlePointerDown}
        onMusicRangeLive={(startMs, endMs) =>
          setProject((prev) => ({
            ...prev,
            musicStartMs: startMs,
            musicEndMs: endMs,
          }))
        }
        onMusicRangeCommit={(startMs, endMs) =>
          persist({ musicStartMs: startMs, musicEndMs: endMs })
        }
        onVoiceRangeLive={(startMs, endMs) =>
          setProject((prev) => ({
            ...prev,
            voiceOverStartMs: startMs,
            voiceOverEndMs: endMs,
          }))
        }
        onVoiceRangeCommit={(startMs, endMs) =>
          persist({ voiceOverStartMs: startMs, voiceOverEndMs: endMs })
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
        onCaptionRangeLive={(index, startMs, endMs) =>
          setProject((prev) => ({
            ...prev,
            captions: prev.captions.map((c, i) =>
              i === index ? { ...c, startMs, endMs } : c,
            ),
          }))
        }
        onCaptionRangeCommit={(index, startMs, endMs) => {
          const captions = projectRef.current.captions.map((c, i) =>
            i === index ? { ...c, startMs, endMs } : c,
          );
          persist({ captions });
        }}
        timelineZoom={timelineZoom}
        onTimelineZoom={setTimelineZoom}
      />

      <div className="mso-credit">
        <div>Product by Maison Sacko</div>
        <div className="light">Credit: Raj Sacko</div>
      </div>

      {showKbTips ? (
        <div className="mso-kb-strip" role="note">
          <span>
            <kbd>Space</kbd> play
          </span>
          <span>
            <kbd>Ctrl</kbd>
            <kbd>B</kbd> split
          </span>
          <span>
            <kbd>⇧</kbd>
            <kbd>Del</kbd> ripple
          </span>
          <span>
            <kbd>←</kbd>
            <kbd>→</kbd> snap
          </span>
          <button
            type="button"
            className="mso-kb-dismiss"
            aria-label="Hide shortcuts"
            onClick={() => {
              setShowKbTips(false);
              try {
                localStorage.setItem("mso-kb-tips", "0");
              } catch {
                /* ignore */
              }
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      {mobileTab ? (
        <button
          type="button"
          className="mso-sheet-backdrop"
          aria-label="Close tools"
          onClick={() => setMobileTab(null)}
        />
      ) : null}

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
            onClick={() =>
              setMobileTab((tab) => (tab === id ? null : id))
            }
          >
            <span className="mso-dock-dot" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {toast ? (
        <div
          className={`mso-toast tone-${toast.tone}`}
          role={toast.tone === "err" ? "alert" : "status"}
        >
          <span className="mso-toast-text">{toast.text}</span>
          {toast.href ? (
            <a className="mso-toast-action" href={toast.href} download>
              {toast.hrefLabel || "Download"}
            </a>
          ) : null}
          <button
            type="button"
            className="mso-toast-dismiss"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

function probeDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audioLike =
      file.type.startsWith("audio/") ||
      /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);
    const media = audioLike
      ? new Audio()
      : document.createElement("video");
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      const ms = Math.round((media.duration || 5) * 1000);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(ms) ? ms : 5000);
    };
    media.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(5000);
    };
    media.src = url;
  });
}
