"use client";

import { useCallback, useRef, useState } from "react";
import type { Project } from "@/lib/types";

const MAX_HISTORY = 40;

function cloneProject(p: Project): Project {
  return JSON.parse(JSON.stringify(p)) as Project;
}

async function patchProject(id: string, body: Partial<Project>) {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Save failed");
  return data.project as Project;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Undo/redo + serialized persistence for the studio project. */
export function useProjectSession(
  initial: Project,
  normalize: (p: Project) => Project,
) {
  const [project, setProjectState] = useState(() => normalize(initial));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const historyRef = useRef<Project[]>([cloneProject(normalize(initial))]);
  const indexRef = useRef(0);
  const queueRef = useRef(Promise.resolve());
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncFlags = useCallback(() => {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < historyRef.current.length - 1);
  }, []);

  const pushSnap = useCallback(
    (next: Project) => {
      const cur = historyRef.current[indexRef.current];
      if (JSON.stringify(cur) === JSON.stringify(next)) return;
      const stack = historyRef.current.slice(0, indexRef.current + 1);
      stack.push(cloneProject(next));
      while (stack.length > MAX_HISTORY) stack.shift();
      historyRef.current = stack;
      indexRef.current = stack.length - 1;
      syncFlags();
    },
    [syncFlags],
  );

  const enqueueSave = useCallback((snapshot: Project) => {
    setSaveStatus("saving");
    queueRef.current = queueRef.current
      .then(async () => {
        await patchProject(snapshot.id, snapshot);
        setSaveStatus("saved");
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveStatus("idle"), 1600);
      })
      .catch(() => {
        setSaveStatus("error");
      });
  }, []);

  const apply = useCallback(
    (partial: Partial<Project>, opts?: { skipHistory?: boolean }) => {
      setProjectState((prev) => {
        const next = normalize({ ...prev, ...partial, id: prev.id });
        if (!opts?.skipHistory) pushSnap(next);
        enqueueSave(next);
        return next;
      });
    },
    [enqueueSave, normalize, pushSnap],
  );

  /** Local-only UI updates (typing, live trim) — no history, no save. */
  const setProject = useCallback(
    (value: Project | ((prev: Project) => Project)) => {
      setProjectState((prev) => {
        const raw = typeof value === "function" ? value(prev) : value;
        return normalize(raw);
      });
    },
    [normalize],
  );

  /** After server actions (captions extract) — history yes, save no. */
  const ingest = useCallback(
    (p: Project) => {
      const next = normalize(p);
      pushSnap(next);
      setProjectState(next);
    },
    [normalize, pushSnap],
  );

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return false;
    indexRef.current -= 1;
    const snap = cloneProject(historyRef.current[indexRef.current]);
    setProjectState(snap);
    enqueueSave(snap);
    syncFlags();
    return true;
  }, [enqueueSave, syncFlags]);

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return false;
    indexRef.current += 1;
    const snap = cloneProject(historyRef.current[indexRef.current]);
    setProjectState(snap);
    enqueueSave(snap);
    syncFlags();
    return true;
  }, [enqueueSave, syncFlags]);

  return {
    project,
    setProject,
    apply,
    ingest,
    undo,
    redo,
    canUndo,
    canRedo,
    saveStatus,
  };
}
