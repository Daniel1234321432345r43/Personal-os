"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useData } from "@/components/providers/data-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { FormReveal, CardItem, AnimateCards } from "@/components/ui/animate";
import { NoteForm } from "./note-form";
import { Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import type { Note } from "@/lib/types";

function LoadingState() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-48" />
    </div>
  );
}

export function NotesClient() {
  const { data, hydrated, actions } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

  if (!hydrated) return <LoadingState />;

  const sorted = [...data.notes].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Notas</h1>
        <p className="text-sm text-muted-foreground">
          Tus apuntes y material de estudio.
        </p>
      </header>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">
            {editing ? "Editar nota" : "Nueva nota"}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setShowForm((v) => !v);
            }}
          >
            <Plus className="h-4 w-4" />
            {showForm || editing ? "Cerrar" : "Nueva"}
          </Button>
        </CardHeader>
        <CardContent>
          <FormReveal open={showForm || !!editing}>
            <div className="mb-4 rounded-lg border bg-muted/30 p-4">
              <NoteForm
                note={editing}
                onDone={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              />
            </div>
          </FormReveal>

          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tienes notas todavía. Añade la primera para que la IA las tenga
              en cuenta.
            </p>
          ) : (
            <AnimateCards className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence initial={false}>
              {sorted.map((note) => (
                <CardItem
                  key={note.id}
                  layout
                  className="flex flex-col gap-2 rounded-lg border bg-card p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{note.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(note.updated_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setShowForm(false);
                          setEditing(note);
                        }}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => actions.deleteNote(note.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {note.content && (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {note.content}
                    </p>
                  )}

                  {note.file_data && (
                    <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      {note.file_type?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={note.file_data}
                          alt={note.file_name ?? "adjunto"}
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <span className="truncate">{note.file_name}</span>
                      )}
                    </div>
                  )}
                </CardItem>
              ))}
              </AnimatePresence>
            </AnimateCards>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
