"use client";

import { TrashIcon } from "@/components/ui/TrashIcon";
import { useActionMessage, ActionNotice, useActionFeedback } from "@/components/ui/ActionNotice";
import { useRef, useCallback, useId, useState } from "react";
import { LANDING_IMAGE_ACCEPT, validateLandingImageInput } from "@/lib/landing/imageUploadPolicy";

interface ImageUploaderProps {
  /** URLs de preview (públicas de Supabase o blob/data URLs). */
  value: string[];
  onChange: (urls: string[]) => void;
  /** Si se pasa, las imágenes se suben a Supabase y se guardan URLs públicas. */
  onUpload?: (file: File) => Promise<string>;
  multiple?: boolean;
  label?: string;
  maxFiles?: number;
}

/**
 * Subida de imágenes. Con onUpload sube a Supabase Storage y devuelve URLs públicas.
 * Optimiza imágenes estáticas y conserva el original al subir.
 */
export function ImageUploader({
  value,
  onChange,
  onUpload,
  multiple = false,
  label,
  maxFiles,
}: ImageUploaderProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError, uploadErrorNoticeKey] = useActionMessage<string | null>(null);
  const notify = useActionFeedback();

  const revokeUrls = useCallback((urls: string[]) => {
    urls.forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    try {
      files.forEach(validateLandingImageInput);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Elegí una imagen válida.");
      e.target.value = "";
      return;
    }

    e.target.value = "";
    setUploadError(null);

    if (multiple && typeof maxFiles === "number" && maxFiles > 0) {
      if (value.length >= maxFiles) {
        setUploadError(`Ya alcanzaste el máximo de ${maxFiles} imágenes.`);
        return;
      }
      const availableSlots = maxFiles - value.length;
      if (files.length > availableSlots) {
        setUploadError(`Solo podés agregar ${availableSlots} imagen${availableSlots === 1 ? "" : "es"} más (máximo ${maxFiles}).`);
        return;
      }
    }

    if (onUpload) {
      setUploading(true);
      try {
        const newUrls: string[] = [];
        for (const file of files) newUrls.push(await onUpload(file));
        if (multiple) {
          onChange([...value, ...newUrls]);
        } else {
          onChange(newUrls.length > 0 ? [newUrls[0]!] : []);
        }
        notify(files.length > 1 ? "Imágenes listas para usar en la landing." : "Imagen lista para usar en la landing.");
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
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-zinc-200"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={LANDING_IMAGE_ACCEPT}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
        disabled={uploading}
        aria-describedby={uploadError ? errorId : undefined}
      />
      {uploadError && (
        <>
        <span id={errorId} className="sr-only">{uploadError}</span>
        <ActionNotice message={uploadError} tone={"error"} noticeKey={uploadErrorNoticeKey} />
        </>
      )}
      {multiple && typeof maxFiles === "number" && maxFiles > 0 && (
        <p className="text-[11px] text-zinc-500">
          Máximo {maxFiles} imágenes.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {uploading
            ? "Optimizando y subiendo..."
            : multiple
              ? "Seleccionar imágenes"
              : "Seleccionar imagen"}
        </button>
        {value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={uploading}
            className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-70 disabled:cursor-not-allowed ui-button-danger inline-flex items-center gap-1.5"
          >
              <TrashIcon />
            Quitar todas
          </button>
        )}
      </div>
      {onUpload && <p className="text-[11px] text-zinc-500">JPG, PNG, WebP o AVIF estáticas, hasta 4 MB. Se comprimen automáticamente y se conserva el original.</p>}
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
                className="cursor-pointer absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white hover:bg-black disabled:opacity-70 disabled:cursor-not-allowed ui-button-danger inline-flex items-center gap-1.5"
              >
              <TrashIcon />
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
