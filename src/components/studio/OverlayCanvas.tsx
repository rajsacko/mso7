"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { snapOverlayPosition } from "@/lib/overlaySnap";
import type { BrandKit, ProjectOverlay } from "@/lib/types";
import { overlayUsesPlate, textOverlayChrome } from "@/lib/overlayChrome";

function posStyle(o: ProjectOverlay): CSSProperties {
  return {
    left: `${50 + o.offsetX}%`,
    top: `${50 + o.offsetY}%`,
    transform: `translate(-50%, -50%) scale(${o.scale || 1})`,
    opacity: typeof o.opacity === "number" ? o.opacity : 1,
  };
}

function LogoVisual({ overlay }: { overlay: ProjectOverlay }) {
  const url = overlay.imageUrl || "";
  const tint = overlay.fillColor;
  if (tint && overlay.kind === "logo") {
    return (
      <span
        className="mso-ov-logo-tint"
        style={{
          backgroundColor: tint,
          WebkitMaskImage: `url(${url})`,
          maskImage: `url(${url})`,
        }}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" draggable={false} />;
}

function OverlayVideo({
  src,
  localMs,
}: {
  src: string;
  localMs: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = Math.max(0, localMs / 1000);
    try {
      if (Math.abs(el.currentTime - t) > 0.12) el.currentTime = t;
    } catch {
      /* not ready */
    }
  }, [localMs, src]);
  return <video ref={ref} src={src} muted playsInline preload="metadata" />;
}

export function OverlayCanvas({
  overlays,
  brand,
  selectedId,
  playheadMs,
  editRequestId,
  onEditRequestConsumed,
  onSelect,
  onMove,
  onScale,
  onOpacity,
  opacityHud,
  onChangeText,
}: {
  overlays: ProjectOverlay[];
  brand: BrandKit;
  selectedId: string | null;
  playheadMs: number;
  /** Newly added text — focus once so user can type immediately */
  editRequestId?: string | null;
  onEditRequestConsumed?: () => void;
  onSelect: (id: string | null) => void;
  onMove: (id: string, offsetX: number, offsetY: number) => void;
  onScale: (id: string, scale: number) => void;
  onOpacity?: (id: string, opacity: number) => void;
  /** Live opacity readout while scrubbing the inspector slider */
  opacityHud?: number | null;
  onChangeText: (id: string, text: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [scaleHud, setScaleHud] = useState<number | null>(null);
  const [guides, setGuides] = useState<{
    vertical: number | null;
    horizontal: number | null;
  } | null>(null);
  const dragRef = useRef<{
    mode: "move" | "resize" | "pending";
    id: string;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
    scale: number;
    w: number;
    h: number;
    lastX?: number;
    lastY?: number;
    wantEdit?: boolean;
  } | null>(null);

  const visible = overlays.filter(
    (o) =>
      o.id === selectedId ||
      o.id === draggingId ||
      (playheadMs >= o.startMs && playheadMs <= o.endMs),
  );

  useEffect(() => {
    if (selectedId && editingId && editingId !== selectedId) {
      setEditingId(null);
    }
  }, [selectedId, editingId]);

  useEffect(() => {
    if (!editRequestId) return;
    onSelect(editRequestId);
    setEditingId(editRequestId);
    onEditRequestConsumed?.();
  }, [editRequestId, onSelect, onEditRequestConsumed]);

  /* Alt+wheel nudges opacity on the selected overlay (CapCut muscle memory). */
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !onOpacity) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.altKey || !selectedId) return;
      e.preventDefault();
      const o = overlays.find((x) => x.id === selectedId);
      if (!o) return;
      const step = e.deltaY > 0 ? -0.03 : 0.03;
      const next = Math.min(
        1,
        Math.max(0.1, Math.round(((o.opacity ?? 1) + step) * 100) / 100),
      );
      if (next !== (o.opacity ?? 1)) onOpacity(o.id, next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [selectedId, overlays, onOpacity]);

  useEffect(() => {
    const el = editRef.current;
    if (!el || !editingId) return;
    const o = overlays.find((x) => x.id === editingId);
    if (!o) return;
    if (el.textContent !== (o.text || "Type here")) {
      el.textContent = o.text || "Type here";
    }
    requestAnimationFrame(() => {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  function bindDrag() {
    const onMovePtr = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.mode === "pending") {
        const dist = Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY);
        if (dist < 5) return;
        d.mode = "move";
        d.wantEdit = false;
        setDraggingId(d.id);
      }
      if (d.mode === "move") {
        const dx = ((ev.clientX - d.startX) / d.w) * 100;
        const dy = ((ev.clientY - d.startY) / d.h) * 100;
        const snapped = snapOverlayPosition(d.ox + dx, d.oy + dy);
        d.lastX = snapped.x;
        d.lastY = snapped.y;
        setGuides(snapped.guides);
        onMove(d.id, snapped.x, snapped.y);
      } else if (d.mode === "resize") {
        const delta = (ev.clientX - d.startX) / d.w;
        const next = Math.min(3.5, Math.max(0.2, d.scale + delta * 2.2));
        const rounded = Math.round(next * 100) / 100;
        setScaleHud(rounded);
        onScale(d.id, rounded);
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d?.mode === "pending" && d.wantEdit) {
        const o = overlays.find((x) => x.id === d.id);
        if (o) startEditing(o);
      } else if (d?.mode === "move" && d.lastX != null && d.lastY != null) {
        const snapped = snapOverlayPosition(d.lastX, d.lastY, 1.2);
        onMove(d.id, snapped.x, snapped.y);
      }
      dragRef.current = null;
      setDraggingId(null);
      setScaleHud(null);
      setGuides(null);
      window.removeEventListener("pointermove", onMovePtr);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMovePtr);
    window.addEventListener("pointerup", onUp);
  }

  function beginMove(e: ReactPointerEvent, o: ProjectOverlay) {
    if ((e.target as HTMLElement).closest(".mso-ov-resize")) return;
    if (editingId === o.id) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const isText = o.kind === "text" || o.kind === "badge";
    const secondClick = selectedId === o.id && isText;
    onSelect(o.id);
    if (secondClick) {
      dragRef.current = {
        mode: "pending",
        id: o.id,
        startX: e.clientX,
        startY: e.clientY,
        ox: o.offsetX,
        oy: o.offsetY,
        scale: o.scale || 1,
        w: rect.width,
        h: rect.height,
        lastX: o.offsetX,
        lastY: o.offsetY,
        wantEdit: true,
      };
      bindDrag();
      return;
    }
    setDraggingId(o.id);
    dragRef.current = {
      mode: "move",
      id: o.id,
      startX: e.clientX,
      startY: e.clientY,
      ox: o.offsetX,
      oy: o.offsetY,
      scale: o.scale || 1,
      w: rect.width,
      h: rect.height,
      lastX: o.offsetX,
      lastY: o.offsetY,
    };
    bindDrag();
  }

  function beginResize(e: ReactPointerEvent, o: ProjectOverlay) {
    e.preventDefault();
    e.stopPropagation();
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    onSelect(o.id);
    setDraggingId(o.id);
    setScaleHud(o.scale || 1);
    dragRef.current = {
      mode: "resize",
      id: o.id,
      startX: e.clientX,
      startY: e.clientY,
      ox: o.offsetX,
      oy: o.offsetY,
      scale: o.scale || 1,
      w: rect.width,
      h: rect.height,
    };
    bindDrag();
  }

  function startEditing(o: ProjectOverlay) {
    onSelect(o.id);
    setEditingId(o.id);
  }

  return (
    <div ref={rootRef} className="mso-ov-canvas">
      {guides ? (
        <div className="mso-ov-guides" aria-hidden>
          {guides.vertical != null ? (
            <span
              className="mso-ov-guide v"
              style={{ left: `${50 + guides.vertical}%` }}
            />
          ) : null}
          {guides.horizontal != null ? (
            <span
              className="mso-ov-guide h"
              style={{ top: `${50 + guides.horizontal}%` }}
            />
          ) : null}
        </div>
      ) : null}
      {visible.map((o) => {
        const selected = selectedId === o.id;
        const isText = o.kind === "text" || o.kind === "badge";
        const usePlate = overlayUsesPlate(o);
        const editing = editingId === o.id;
        const isMedia =
          (o.kind === "logo" || o.kind === "image") && Boolean(o.imageUrl);
        const isVideo = o.kind === "video" && Boolean(o.videoUrl);

        return (
          <div
            key={o.id}
            className={`mso-ov-node${selected ? " is-selected" : ""}${draggingId === o.id ? " is-dragging" : ""}${isText ? " is-text" : ""}${o.kind === "badge" ? " is-badge" : ""}${isMedia || isVideo ? " is-media" : ""}`}
            style={posStyle(o)}
            onPointerDown={(e) => beginMove(e, o)}
          >
            {isText ? (
              editing ? (
                <div
                  ref={editRef}
                  className={`mso-ov-text${usePlate ? " has-plate" : ""}`}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  style={textOverlayChrome(o, brand)}
                  onBlur={(e) => {
                    const text =
                      e.currentTarget.textContent?.trim() || "Type here";
                    if (text !== o.text) onChangeText(o.id, text);
                    setEditingId(null);
                  }}
                  onInput={(e) => {
                    onChangeText(o.id, e.currentTarget.textContent || "");
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ) : (
                <div
                  className={`mso-ov-text${usePlate ? " has-plate" : ""}`}
                  style={textOverlayChrome(o, brand)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEditing(o);
                  }}
                  title="Click again to type · drag to move"
                >
                  {o.text || "Type here"}
                </div>
              )
            ) : null}

            {isMedia ? <LogoVisual overlay={o} /> : null}

            {isVideo && o.videoUrl ? (
              <OverlayVideo
                src={o.videoUrl}
                localMs={Math.max(0, playheadMs - o.startMs)}
              />
            ) : null}

            {selected &&
            ((scaleHud != null && draggingId === o.id) ||
              opacityHud != null) ? (
              <span className="mso-ov-scale-hud" aria-hidden>
                {scaleHud != null && draggingId === o.id
                  ? `${Math.round(scaleHud * 100)}%`
                  : `Opacity ${Math.round((opacityHud ?? 1) * 100)}%`}
              </span>
            ) : null}

            {selected ? (
              <button
                type="button"
                className="mso-ov-resize"
                aria-label="Resize"
                onPointerDown={(e) => beginResize(e, o)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
