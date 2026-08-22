"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { useSettings } from "@/components/providers/settings-provider";
import { useData } from "@/components/providers/data-provider";
import { buildSecretaryContext } from "@/lib/ai/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Send,
  Settings,
  BookOpen,
  CheckCircle2,
  Dumbbell,
  Flame,
  Wallet,
  FileText,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

function messageText(message: UIMessage): string {
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

function ToolPartView({ part }: { part: any }) {
  if (!isToolUIPart(part)) return null;
  const toolName = getToolName(part);
  const input = part.input as any;
  if (!input) return null;

  if (
    toolName === "addSubjects" &&
    Array.isArray(input.subjects) &&
    input.subjects.length > 0
  ) {
    return (
      <div className="mb-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5 text-xs">
        <div className="mb-1.5 flex items-center gap-1.5 font-medium text-primary">
          <BookOpen className="h-3.5 w-3.5" />
          <span>
            {input.subjects.length === 1
              ? "Asignatura añadida"
              : `${input.subjects.length} asignaturas añadidas`}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {input.subjects.map((s: any, i: number) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium"
              style={{
                backgroundColor: s.color ? `${s.color}22` : undefined,
                color: s.color || "inherit",
                border: s.color ? `1px solid ${s.color}44` : undefined,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: s.color || "currentColor" }}
              />
              {s.name}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (
    toolName === "addTasks" &&
    Array.isArray(input.tasks) &&
    input.tasks.length > 0
  ) {
    return (
      <div className="mb-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs">
        <div className="mb-1.5 flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>
            {input.tasks.length === 1
              ? "Elemento añadido al calendario"
              : `${input.tasks.length} elementos añadidos al calendario`}
          </span>
        </div>
        <ul className="space-y-1">
          {input.tasks.map((t: any, i: number) => {
            const typeLabel =
              t.type === "exam"
                ? "Examen"
                : t.type === "assignment"
                  ? "Entrega"
                  : t.type === "study_session"
                    ? "Estudio"
                    : "Tarea";
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded bg-background/60 px-2 py-1"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{t.title}</span>
                  {t.subject_name && (
                    <span className="ml-1 text-muted-foreground">
                      ({t.subject_name})
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                    {typeLabel}
                  </span>
                  {t.due_date && <span>📅 {t.due_date}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (
    toolName === "addWorkouts" &&
    Array.isArray(input.workouts) &&
    input.workouts.length > 0
  ) {
    return (
      <div className="mb-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5 text-xs">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
          <Dumbbell className="h-3.5 w-3.5" />
          <span>
            Entrenamiento{input.workouts.length > 1 ? "s" : ""} registrado
            {input.workouts.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="text-muted-foreground">
          {input.workouts.map((w: any, i: number) => (
            <span key={i}>
              {w.activity_type} ({w.duration_minutes} min)
              {i < input.workouts.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (
    toolName === "addHabits" &&
    Array.isArray(input.habits) &&
    input.habits.length > 0
  ) {
    return (
      <div className="mb-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
          <Flame className="h-3.5 w-3.5" />
          <span>
            Hábito{input.habits.length > 1 ? "s" : ""} añadido
            {input.habits.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {input.habits.map((h: any, i: number) => (
            <span key={i} className="rounded bg-background/60 px-1.5 py-0.5">
              {h.emoji || "✨"} {h.name}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (
    toolName === "addTransactions" &&
    Array.isArray(input.transactions) &&
    input.transactions.length > 0
  ) {
    return (
      <div className="mb-2 rounded-xl border border-purple-500/20 bg-purple-500/5 p-2.5 text-xs">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-purple-600 dark:text-purple-400">
          <Wallet className="h-3.5 w-3.5" />
          <span>Transacción financiera registrada</span>
        </div>
        <div className="text-muted-foreground">
          {input.transactions.map((tr: any, i: number) => (
            <span key={i}>
              {tr.type === "expense" ? "-" : "+"}
              {tr.amount}€ ({tr.category})
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (
    toolName === "addNotes" &&
    Array.isArray(input.notes) &&
    input.notes.length > 0
  ) {
    return (
      <div className="mb-2 rounded-xl border border-zinc-500/20 bg-zinc-500/5 p-2.5 text-xs">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span>
            Nota{input.notes.length > 1 ? "s" : ""} creada
            {input.notes.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="text-muted-foreground">
          {input.notes.map((n: any) => n.title).join(", ")}
        </div>
      </div>
    );
  }

  if (
    toolName === "addGrades" &&
    Array.isArray(input.grades) &&
    input.grades.length > 0
  ) {
    return (
      <div className="mb-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs">
        <div className="mb-1.5 flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
          <Award className="h-3.5 w-3.5" />
          <span>
            {input.grades.length === 1
              ? "Calificación registrada"
              : `${input.grades.length} calificaciones registradas`}
          </span>
        </div>
        <ul className="space-y-1.5">
          {input.grades.map((g: any, i: number) => {
            const scoreNum = Number(g.score);
            const scoreColor =
              scoreNum >= 7
                ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                : scoreNum >= 5
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-red-600 dark:text-red-400 font-semibold";
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded bg-background/60 px-2 py-1"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{g.title}</span>
                  {g.subject_name && (
                    <span className="ml-1 text-muted-foreground">
                      ({g.subject_name})
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <span className={scoreColor}>
                    {g.score}/{g.max_score ?? 10}
                  </span>
                  {g.weight_percentage != null && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                      {g.weight_percentage}%
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return null;
}

const suggestions = [
  "He sacado un 8 en el examen de Mates que cuenta un 20%",
  "Tengo examen de Matemáticas el 15 de septiembre y entrega de Historia el viernes",
  "¿Cuándo tengo cada examen y entrega?",
  "¿Qué tareas y exámenes tengo pendientes?",
];

export function SecretaryChat() {
  const { settings, configured } = useSettings();
  const { data, actions } = useData();
  const [input, setInput] = useState("");

  const context = useMemo(() => buildSecretaryContext(data), [data]);

  // Referencia estable para enviar siempre el contexto y ajustes más recientes.
  const latestRef = useRef({ context, settings });
  latestRef.current = { context, settings };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => latestRef.current,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { messages, status, sendMessage, error } = useChat({
    transport,
    onError: (err) => {
      console.error("Error en chat del secretario:", err);
    },
  });

  // Procesar y aplicar ejecuciones de herramientas recibidas desde el streaming del servidor
  const processedToolsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant" || !message.parts) continue;
      for (const part of message.parts) {
        if (isToolUIPart(part) && part.state === "output-available") {
          const toolCallId = (part as any).toolCallId;
          if (toolCallId && !processedToolsRef.current.has(toolCallId)) {
            processedToolsRef.current.add(toolCallId);
            const toolName = getToolName(part);
            const input = (part as any).input;
            if (!input) continue;

            if (toolName === "addSubjects" && Array.isArray(input.subjects)) {
              actions.addSubjects(input.subjects);
            } else if (toolName === "addTasks" && Array.isArray(input.tasks)) {
              actions.addTasks(input.tasks);
            } else if (toolName === "deleteTasks") {
              actions.deleteTasks(input.task_ids, input.task_titles);
            } else if (toolName === "deleteSubjects") {
              actions.deleteSubjects(input.subject_ids, input.subject_names);
            } else if (
              toolName === "addWorkouts" &&
              Array.isArray(input.workouts)
            ) {
              actions.addWorkouts(input.workouts);
            } else if (
              toolName === "addHabits" &&
              Array.isArray(input.habits)
            ) {
              actions.addHabits(input.habits);
            } else if (
              toolName === "addTransactions" &&
              Array.isArray(input.transactions)
            ) {
              actions.addTransactions(input.transactions);
            } else if (toolName === "addNotes" && Array.isArray(input.notes)) {
              actions.addNotes(input.notes);
            } else if (
              toolName === "addGrades" &&
              Array.isArray(input.grades)
            ) {
              actions.addGrades(input.grades);
            } else if (toolName === "deleteGrades") {
              actions.deleteGrades(input.grade_ids, input.grade_titles);
            }
          }
        }
      }
    }
  }, [messages, actions]);

  const loading = status === "submitted" || status === "streaming";
  const bottomRef = useRef<HTMLDivElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !configured || loading) return;
    sendMessage({ text });
    setInput("");
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, status]);

  const assistantName = settings.assistantName?.trim() || "Núcleo";

  return (
    <div className="flex h-[560px] flex-col">
      <ScrollArea className="flex-1 pr-3">
        {!configured && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            <Settings className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              La IA no está configurada. Ve a{" "}
              <Link href="/settings" className="font-medium underline">
                Ajustes
              </Link>{" "}
              y añade tu API key para hablar con {assistantName}.
            </span>
          </div>
        )}

        {/* Mensaje de bienvenida */}
        {messages.length === 0 && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Secretario {assistantName}</p>
              <p className="text-sm text-muted-foreground">
                ¡Hola! Soy {assistantName}, tu Secretario IA. Puedes decirme directamente tus
                asignaturas, exámenes, notas o tareas pendientes (ej.{" "}
                <em>
                  &ldquo;He sacado un 8 en el examen de Mates que cuenta un 20%&rdquo;
                </em>{" "}
                o{" "}
                <em>
                  &ldquo;Tengo examen de Física el 10 de octubre&rdquo;
                </em>
                ) y los registraré automáticamente en tu sistema. 👋
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((message) => {
            const isUser = message.role === "user";
            const text = messageText(message);
            const toolParts = !isUser
              ? message.parts.filter((p) => isToolUIPart(p))
              : [];

            if (!text && toolParts.length === 0) return null;

            return (
              <div
                key={message.id}
                className={cn(
                  "flex items-start gap-3",
                  isUser && "flex-row-reverse",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    isUser
                      ? "bg-muted text-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {isUser ? (
                    <span className="text-xs font-semibold">Tú</span>
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    isUser ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {toolParts.map((part, idx) => (
                    <ToolPartView key={idx} part={part} />
                  ))}
                  {text && <p className="whitespace-pre-wrap">{text}</p>}
                </div>
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" />
            </span>
            Pensando…
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <span>
              {error.message || "Error al comunicarse con el Secretario."}
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </ScrollArea>

      {/* Sugerencias rápidas */}
      {messages.length === 0 && configured && (
        <div className="flex flex-wrap gap-2 py-3">
          {suggestions.map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              className="rounded-full text-xs text-left h-auto py-1.5 px-3"
              onClick={() => sendMessage({ text: s })}
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      {/* Entrada */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t pt-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ej: Tengo examen de Matemáticas el 15 sep y entrega de Redes el viernes..."
          disabled={!configured || loading}
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!configured || loading || !input.trim()}
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Enviar</span>
        </Button>
      </form>
    </div>
  );
}
