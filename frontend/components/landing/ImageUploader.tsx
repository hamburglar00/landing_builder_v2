"use client";

import { useRef, useCallback, useState } from "react";

const ACCEPT = "image/avif,.avif";

interface ImageUploaderProps {
  /** URLs de preview (públicas de Supabase o blob/data URLs). */
  value: string[];
  onChange: (urls: string[]) => void;
  /** Si se pasa, las imágenes se suben a Supabase y se guardan URLs públicas. */
  onUpload?: (file: File) => Promise<string>;
  multiple?: boolean;
  label?: string;
}

/**
 * Subida de imágenes. Con onUpload sube a Supabase Storage y devuelve URLs públicas.
 * Formato obligatorio .avif.
 */
export function ImageUploader({
  value,
  onChange,
  onUpload,
  multiple = false,
  label,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const revokeUrls = useCallback((urls: string[]) => {
    urls.forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const valid = files.every((f) => f.name.toLowerCase().endsWith(".avif"));
    if (!valid) {
      alert("Solo se permiten imágenes en formato .avif");
      e.target.value = "";
      return;
    }

    e.target.value = "";
    setUploadError(null);

    if (onUpload) {
      setUploading(true);
      try {
        const newUrls = await Promise.all(files.map((f) => onUpload(f)));
        if (multiple) {
          onChange([...value, ...newUrls]);
        } else {
          onChange(newUrls.length > 0 ? [newUrls[0]!] : []);
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Error al subir");
      } finally {
        setUploading(false);
      }
      return;
    }

    revokeUrls(value);
    const newUrls = files.map((f) => URL.createObjectURL(f));
    if (multiple) {
      onChange([...value, ...newUrls]);
    } else {
      onChange(newUrls.length > 0 ? [newUrls[0]!] : []);
    }
  };

  const handleRemove = (index: number) => {
    const newUrls = value.filter((_, i) => i !== index);
    revokeUrls([value[index]!]);
    onChange(newUrls);
  };

  const handleClear = () => {
    revokeUrls(value);
    onChange([]);
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-medium text-zinc-200">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
        disabled={uploading}
      />
      {uploadError && (
        <p className="text-xs text-red-400" role="alert">
          {uploadError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-70"
        >
          {uploading
            ? "Subiendo..."
            : multiple
              ? "Seleccionar imágenes (.avif)"
              : "Seleccionar imagen (.avif)"}
        </button>
        {value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={uploading}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-70"
          >
            Quitar todas
          </button>
        )}
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((url, index) => (
            <div
              key={url}
              className="relative inline-block rounded-lg border border-zinc-700 overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Preview ${index + 1}`}
                className="h-20 w-20 object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={uploading}
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white hover:bg-black disabled:opacity-70"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
