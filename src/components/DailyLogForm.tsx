"use client";

import React, { useState, useRef, useEffect } from "react";
import DailyLogStructuredFields from "@/components/DailyLogStructuredFields";
import { Camera, X, Loader2, Image as ImageIcon } from "lucide-react";

interface DailyLogFormProps {
  addLogAction: (formData: FormData) => Promise<void>;
}

export default function DailyLogForm({ addLogAction }: DailyLogFormProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setError(null);

    if (files.length + selectedFiles.length > 5) {
      setError("Maximum of 5 photos allowed per daily log.");
      return;
    }

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of selectedFiles) {
      if (!file.type.startsWith("image/")) {
        setError(`File "${file.name}" is not an image. Only image files are allowed.`);
        continue;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
      setPreviews((prev) => [...prev, ...newPreviews]);
    }

    // Reset file input value to allow selecting the same file again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const notes = String(formData.get("notes") || "").trim();
    if (!notes) {
      setError("Notes are required.");
      return;
    }

    setIsPending(true);
    setError(null);

    // Append our validated files manually
    formData.delete("photos");
    files.forEach((file) => {
      formData.append("photos", file);
    });

    try {
      await addLogAction(formData);
      
      // Reset form on success
      form.reset();
      previews.forEach((url) => URL.revokeObjectURL(url));
      setFiles([]);
      setPreviews([]);
    } catch (err: any) {
      setError(err?.message || "An error occurred while posting the daily log.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-b border-glass-border px-5 py-4">
      {error && (
        <div className="rounded-md bg-rose-50 p-2.5 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <textarea
          name="notes"
          rows={2}
          className="input min-h-[70px] resize-y"
          placeholder="What happened on site today?"
          required
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <input
          name="weather"
          className="input text-sm"
          placeholder="Weather (e.g. Sunny, 72°F)"
          disabled={isPending}
        />
        <input
          name="crew"
          className="input text-sm"
          placeholder="Crew on site"
          disabled={isPending}
        />
        <input
          name="hours"
          type="number"
          step="0.5"
          className="input text-sm"
          placeholder="Crew hours"
          disabled={isPending}
        />
      </div>


      {/* P7: structured fields */}
      <DailyLogStructuredFields mode="form" />
      {/* Photo Previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-5 gap-2 pt-1">
          {previews.map((url, index) => (
            <div key={index} className="group relative aspect-square w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Preview ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute right-1 top-1 rounded-full bg-slate-900/60 p-1 text-white opacity-90 transition-opacity hover:bg-slate-950 focus:outline-none"
                disabled={isPending}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-glass-border pt-3">
        <div className="flex items-center gap-3">
          {/* File Input trigger */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
            disabled={isPending || files.length >= 5}
          >
            <Camera size={14} />
            <span>Add Photos</span>
            {files.length > 0 && <span className="hh-caption">({files.length}/5)</span>}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="image/*"
            className="hidden"
            name="photos"
          />

          <label className="flex items-center gap-2 hh-secondary cursor-pointer select-none">
            <input
              type="checkbox"

              name="clientVisible"
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              disabled={isPending}
            />
            <span>Share with client</span>
          </label>
        </div>

        <button
          type="submit"
          className="btn-primary flex items-center gap-1.5 text-xs px-4 py-2 font-medium"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Posting...</span>
            </>
          ) : (
            <span>Post log</span>
          )}
        </button>
      </div>
    </form>
  );
}
