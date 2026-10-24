"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/catalog";
import { getDict } from "@/i18n";

type Current = { kind: "audio" | "video" | "text"; text: string | null; url: string; qrSvg: string } | null;
type Tab = "audio" | "video" | "text" | "file";

const LIMIT_MS = { audio: 120_000, video: 60_000 };
const MAX_BYTES = 50 * 1024 * 1024;

function pickMime(kind: "audio" | "video") {
  const options =
    kind === "audio"
      ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
      : ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

async function api(body: object) {
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "generic");
  return json;
}

export function Recorder({ lang }: { lang: Locale }) {
  const t = getDict(lang).msg;
  const sp = useSearchParams();
  const orderId = sp.get("id") ?? "";
  const token = sp.get("t") ?? "";
  const auth = { orderId, token };

  const [recipient, setRecipient] = useState("");
  const [current, setCurrent] = useState<Current>(null);
  const [tab, setTab] = useState<Tab>("audio");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [text, setText] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const live = useRef<HTMLVideoElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((code: string) => setError(t.errors[code] ?? t.errors.generic), [t.errors]);

  useEffect(() => {
    api({ action: "status", ...{ orderId, token } })
      .then((r) => {
        setRecipient(r.recipient);
        setCurrent(r.message);
      })
      .catch((e: Error) => showError(e.message));
  }, [orderId, token, showError]);

  const stopStream = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };
  useEffect(() => () => stopStream(), []);

  function reset() {
    setBlob(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setStatus("");
    setError("");
  }

  async function startRecording(kind: "audio" | "video") {
    reset();
    try {
      stream.current = await navigator.mediaDevices.getUserMedia(
        kind === "audio" ? { audio: true } : { audio: true, video: { width: 640, height: 480, facingMode: "user" } },
      );
    } catch {
      setError(t.noMic);
      return;
    }
    if (kind === "video" && live.current) {
      live.current.srcObject = stream.current;
      void live.current.play();
    }
    const mimeType = pickMime(kind);
    const rec = new MediaRecorder(stream.current, mimeType ? { mimeType, videoBitsPerSecond: 1_000_000 } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stopStream();
      const b = new Blob(chunks, { type: rec.mimeType || mimeType || (kind === "audio" ? "audio/webm" : "video/webm") });
      setBlob(b);
      setPreview(URL.createObjectURL(b));
      setRecording(false);
    };
    recorder.current = rec;
    rec.start(1000);
    setRecording(true);
    timer.current = setTimeout(() => rec.state === "recording" && rec.stop(), LIMIT_MS[kind]);
  }

  function stopRecording() {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function uploadBlob(file: Blob) {
    if (file.size > MAX_BYTES) return showError("TOO_LARGE");
    setBusy(true);
    setError("");
    try {
      const up = await api({ action: "upload", ...auth, mimeType: file.type, size: file.size });
      const put = await fetch(up.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": up.contentType, "x-upsert": "false", "Cache-Control": "max-age=3600" },
        body: file,
      });
      if (!put.ok) throw new Error("UPLOAD_MISSING");
      const r = await api({ action: "commit", ...auth, messageId: up.messageId });
      setCurrent(r.message);
      reset();
      setStatus(t.saved);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveText() {
    setBusy(true);
    setError("");
    try {
      const r = await api({ action: "text", ...auth, body: text });
      setCurrent(r.message);
      setStatus(t.saved);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!orderId || !token) return <p role="alert">{t.errors.NOT_FOUND}</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl sm:text-5xl">{t.title}</h1>
          {recipient && <p className="mt-3 text-lg text-muted">{t.intro(recipient)}</p>}
        </div>
        <p className="rounded-2xl bg-cream p-4 text-sm">{t.privacy}</p>

        <div role="tablist" aria-label={t.title} className="flex flex-wrap gap-2">
          {(["audio", "video", "text", "file"] as Tab[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => {
                stopRecording();
                reset();
                setTab(k);
              }}
              className={`rounded-full px-4 py-2 font-semibold ${tab === k ? "bg-ink text-white" : "ring-1 ring-black/20"}`}
            >
              {t.tabs[k]}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="space-y-4 rounded-3xl p-6 ring-1 ring-black/10">
          {(tab === "audio" || tab === "video") && (
            <>
              <p className="text-sm text-muted">{tab === "audio" ? t.maxAudio : t.maxVideo}</p>
              {tab === "video" && !preview && (
                <video ref={live} muted playsInline className="aspect-video w-full rounded-2xl bg-ink" aria-hidden="true" />
              )}
              {preview &&
                (tab === "audio" ? (
                  <audio src={preview} controls className="w-full" />
                ) : (
                  <video src={preview} controls playsInline className="aspect-video w-full rounded-2xl bg-ink" />
                ))}
              <div className="flex flex-wrap gap-3">
                {!recording ? (
                  <button type="button" className="btn btn-ghost" onClick={() => startRecording(tab)} disabled={busy}>
                    ● {preview ? t.again : t.start}
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={stopRecording}>
                    ■ {t.stop}
                  </button>
                )}
                {blob && !recording && (
                  <button type="button" className="btn btn-primary" onClick={() => uploadBlob(blob)} disabled={busy}>
                    {busy ? t.saving : t.send}
                  </button>
                )}
              </div>
            </>
          )}

          {tab === "text" && (
            <>
              <label htmlFor="msg-text" className="block font-medium">
                {t.textLabel}
              </label>
              <textarea
                id="msg-text"
                rows={6}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full rounded-xl border border-black/25 px-4 py-3"
              />
              <button type="button" className="btn btn-primary" onClick={saveText} disabled={busy || !text.trim()}>
                {busy ? t.saving : t.send}
              </button>
            </>
          )}

          {tab === "file" && (
            <>
              <label htmlFor="msg-file" className="block font-medium">
                {t.fileLabel}
              </label>
              <input
                id="msg-file"
                type="file"
                accept="audio/*,video/*"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadBlob(f);
                }}
                className="block w-full text-sm"
              />
              {busy && <p>{t.saving}</p>}
            </>
          )}

          {current && <p className="text-sm text-muted">{t.replace}</p>}
          {error && (
            <p role="alert" className="font-medium text-red-dark">
              {error}
            </p>
          )}
          {status && (
            <p role="status" className="font-medium">
              ✓ {status}
            </p>
          )}
        </div>
      </div>

      {current && (
        <aside className="h-fit space-y-4 rounded-3xl bg-cream p-6">
          <p className="font-display text-xl font-black">{t.qrTitle}</p>
          <div
            className="mx-auto w-48 rounded-xl bg-white p-2"
            role="img"
            aria-label={t.qrTitle}
            // Generated on our server from our own URL.
            dangerouslySetInnerHTML={{ __html: current.qrSvg }}
          />
          <p className="text-sm">
            {t.current}: {t.tabs[current.kind]}
          </p>
          <a href={current.url} target="_blank" className="btn btn-ghost w-full">
            {t.open} ↗
          </a>
        </aside>
      )}
    </div>
  );
}
