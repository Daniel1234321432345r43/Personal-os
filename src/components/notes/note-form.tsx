"use client";

import { useRef, useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, inputClass, labelClass } from "@/components/forms/ui";
import { Paperclip, X } from "lucide-react";
import type { Note } from "@/lib/types";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB para no agotar localStorage.
const TEXT_TYPES = ["text/plain", "text/markdown", "text/md"];
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

interface Attachment {
  file_name: string;
  file_type: string;
  file_data: string;
}

export function NoteForm({
  note,
  onDone,
}: {
  note?: Note | null;
  onDone?: () => void;
}) {
  const { actions } = useData();
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [attachment, setAttachment] = useState<Attachment | null>(
    note?.file_data
      ? {
          file_name: note.file_name ?? "archivo",
          file_type: note.file_type ?? "application/octet-stream",
          file_data: note.file_data,
        }
      : null,
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && !content.trim()) return;

    const input = {
      title: title.trim() || "Nota sin título",
      content: content.trim(),
      file_name: attachment?.file_name ?? null,
      file_type: attachment?.file_type ?? null,
      file_data: attachment?.file_data ?? null,
    };

    if (note) actions.updateNote(note.id, input);
    else actions.addNote(input);

    setTitle("");
    setContent("");
    setAttachment(null);
    setFileError(null);
    onDone?.();
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFileError(null);

    if (file.size > MAX_FILE_BYTES) {
      setFileError("El archivo supera 2 MB y no puede guardarse en el navegador.");
      return;
    }

    const reader = new FileReader();

    // Texto plano / markdown → se vuelca como contenido.
    if (TEXT_TYPES.includes(file.type) || /\.(txt|md|markdown)$/i.test(file.name)) {
      reader.onload = () => {
        setContent((prev) =>
          (prev ? prev + "\n\n" : "") + String(reader.result ?? ""),
        );
      };
      reader.readAsText(file);
      return;
    }

    // Imágenes y otros → adjunto (data URL).
    reader.onload = () => {
      setAttachment({
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_data: String(reader.result ?? ""),
      });
    };
    reader.readAsDataURL(file);
  }

  const isImage = attachment?.file_type.startsWith("image/");

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className={fieldClass}>
        <label className={labelClass} htmlFor="note-title">
          Título
        </label>
        <input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej. Apuntes de Historia — Tema 3"
          className={inputClass}
        />
      </div>

      <div className={fieldClass}>
        <label className={labelClass} htmlFor="note-content">
          Contenido (markdown)
        </label>
        <textarea
          id="note-content"
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Pega o escribe tus apuntes aquí…"
          className={inputClass}
        />
      </div>

      {/* Adjunto */}
      <div className={fieldClass}>
        <label className={labelClass}>Adjunto (opcional)</label>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          accept=".txt,.md,.markdown,image/png,image/jpeg,image/webp,image/gif,.pdf,.doc,.docx"
        />
        {attachment ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2.5">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachment.file_data}
                alt={attachment.file_name}
                className="h-14 w-14 rounded-md object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Paperclip className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{attachment.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {attachment.file_type}
                {!isImage && " · no se analiza su contenido en esta versión"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setAttachment(null)}
              title="Quitar adjunto"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            Subir archivo
          </Button>
        )}
        {fileError && <p className="text-xs text-destructive">{fileError}</p>}
        <p className="text-xs text-muted-foreground">
          .txt y .md se convierten en texto. Las imágenes se guardan como adjunto.
          La IA usa el texto de las notas.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit">{note ? "Guardar cambios" : "Añadir nota"}</Button>
      </div>
    </form>
  );
}
