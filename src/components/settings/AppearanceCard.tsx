"use client";

import { useRef, useState, useTransition } from "react";
import { updateHubBackground, removeHubBackground } from "@/lib/actions/branding";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export default function AppearanceCard({
  initialEnabled,
  initialScrim,
  initialMode,
  version,
}: {
  initialEnabled: boolean;
  initialScrim: number;
  initialMode: string;
  version: number;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [scrim, setScrim] = useState(initialScrim);
  const [mode, setMode] = useState(initialMode);
  const [dataBase64, setDataBase64] = useState<string | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(`/branding/background?v=${version}`);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setMsg("Please use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setMsg("That image is over 4 MB — please use a smaller file.");
      return;
    }
    setMime(file.type);
    setPreviewUrl(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      setDataBase64(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
    setMsg(null);
  }

  function save() {
    setMsg(null);
    start(async () => {
      try {
        await updateHubBackground({ dataBase64, mime, scrim, mode, enabled });
        setMsg("Saved. Reload to see it across the Hub.");
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Could not save.");
      }
    });
  }

  function remove() {
    start(async () => {
      try {
        await removeHubBackground();
        setDataBase64(null);
        setMime(null);
        setPreviewUrl("/branding/sample-bg.jpg");
        setMsg("Reverted to the sample image.");
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Could not remove.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative overflow-hidden rounded-xl border border-glass-border"
        style={{ aspectRatio: "16 / 6" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="Hub background preview" className="h-full w-full object-cover" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `rgba(8,12,20,${scrim / 100})` }}
        />
        <div className="absolute bottom-3 left-4 text-sm font-semibold text-white drop-shadow">
          Preview · sample text over your background
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
          Upload / replace image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFile}
        />
        <button type="button" className="btn-secondary" onClick={remove} disabled={pending}>
          Remove (use sample)
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="bg-scrim">
            Scrim (darkness over image) · {scrim}%
          </label>
          <input
            id="bg-scrim"
            type="range"
            min={0}
            max={70}
            value={scrim}
            onChange={(e) => setScrim(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="label" htmlFor="bg-mode">
            Show background in
          </label>
          <select
            id="bg-mode"
            className="input"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="light">Light mode</option>
            <option value="dark">Dark mode</option>
            <option value="both">Both themes</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enable Hub background image
      </label>

      <p className="hh-caption">
        Light mode uses this image with white text — dark, photographic images look best. Raise the
        scrim if text is hard to read.
      </p>

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        {msg && <span className="hh-caption">{msg}</span>}
      </div>
    </div>
  );
}
