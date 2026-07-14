"use client";

import { useCallback, useRef, useState } from "react";

type Phase = "idle" | "recording" | "uploading";

/**
 * Record voice from the system microphone and return an uploaded media URL.
 * No AI generation — your voice on the timeline.
 */
export function MicVoiceRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (url: string, name: string) => void;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const elapsedRef = useRef(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const rec = mediaRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        setPhase("uploading");
        const durationGuess = Math.max(1, elapsedRef.current) * 1000;
        try {
          const blob = new Blob(chunksRef.current, { type: mime });
          const file = new File([blob], `vo-${Date.now()}.webm`, {
            type: mime,
          });
          const form = new FormData();
          form.append("file", file);
          form.append("durationMs", String(durationGuess));
          const res = await fetch("/api/upload", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upload failed");
          onRecorded(data.clip.url, file.name);
          setPhase("idle");
          setElapsed(0);
          elapsedRef.current = 0;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed");
          setPhase("idle");
        } finally {
          cleanup();
        }
      };
      recorder.start(200);
      setPhase("recording");
      setElapsed(0);
      elapsedRef.current = 0;
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Microphone permission is required",
      );
      cleanup();
      setPhase("idle");
    }
  }, [cleanup, onRecorded]);

  return (
    <div className="mso-mic">
      {phase === "recording" ? (
        <button type="button" className="mso-btn mso-btn-rec" onClick={stop}>
          Stop · {elapsed}s
        </button>
      ) : (
        <button
          type="button"
          className="mso-btn"
          disabled={disabled || phase === "uploading"}
          onClick={start}
        >
          {phase === "uploading" ? "Uploading…" : "Record with mic"}
        </button>
      )}
      <p className="mso-hint">
        Talk while you watch the cut. Noise suppression is on in the browser.
      </p>
      {error ? (
        <p className="mso-hint" style={{ color: "#8a2a2a" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
