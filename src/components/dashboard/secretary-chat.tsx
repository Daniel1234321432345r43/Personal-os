"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { useSettings } from "@/components/providers/settings-provider";
import { useData } from "@/components/providers/data-provider";
import type {
  SubjectInput,
  TaskInput,
  WorkoutInput,
  HabitInput,
  TransactionInput,
  PlannedExpenseInput,
  NoteInput,
  GradeInput,
} from "@/components/providers/data-provider";
import { buildSecretaryContext } from "@/lib/ai/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Sparkles,
  Send,
  Settings,
  BookOpen,
  CheckCircle2,
  Dumbbell,
  Flame,
  Wallet,
  Clock,
  FileText,
  Award,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDesktop, useIsMobile } from "@/lib/use-is-mobile";

/**
 * Forma de la parte de UI de una herramienta. El SDK expone `input` como
 * `unknown`, así que lo tipamos con los tipos reales de entrada de la app.
 */
type ToolUIPartShape = {
  toolCallId?: string;
  input?: {
    subjects?: SubjectInput[];
    tasks?: TaskInput[];
    workouts?: WorkoutInput[];
    habits?: HabitInput[];
    transactions?: TransactionInput[];
    plannedExpenses?: PlannedExpenseInput[];
    notes?: NoteInput[];
    grades?: GradeInput[];
    task_ids?: string[];
    task_titles?: string[];
    subject_ids?: string[];
    subject_names?: string[];
    grade_ids?: string[];
    grade_titles?: string[];
  };
};

function messageText(message: UIMessage): string {
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

function ToolPartView({ part }: { part: Parameters<typeof isToolUIPart>[0] }) {
  if (!isToolUIPart(part)) return null;
  const toolName = getToolName(part);
  const input = (part as ToolUIPartShape).input;
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
          {input.subjects.map((s, i) => (
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
          {input.tasks.map((t, i) => {
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
    const workouts = input.workouts;
    return (
      <div className="mb-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5 text-xs">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
          <Dumbbell className="h-3.5 w-3.5" />
          <span>
            Entrenamiento{workouts.length > 1 ? "s" : ""} registrado
            {workouts.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="text-muted-foreground">
          {workouts.map((w, i) => (
            <span key={i}>
              {w.activity_type} ({w.duration_minutes} min)
              {i < workouts.length - 1 ? ", " : ""}
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
          {input.habits.map((h, i) => (
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
          {input.transactions.map((tr, i) => (
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
    toolName === "addPlannedExpenses" &&
    Array.isArray(input.plannedExpenses) &&
    input.plannedExpenses.length > 0
  ) {
    return (
      <div className="mb-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
          <Clock className="h-3.5 w-3.5" />
          <span>Gasto previsto planificado</span>
        </div>
        <div className="text-muted-foreground">
          {input.plannedExpenses.map((pe, i) => (
            <span key={i}>
              ~{pe.amount}€ {pe.description ? `(${pe.description})` : `(${pe.category})`}
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
          {input.notes.map((n) => n.title).join(", ")}
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
          {input.grades.map((g, i) => {
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

/** En móvil, el chat arranca colapsado; en escritorio, expandido. */
const SECRETARY_COLLAPSED_KEY = "nucleo:secretary-collapsed";

export function SecretaryChat() {
  const { settings, configured } = useSettings();
  const { data, actions } = useData();
  const [input, setInput] = useState("");

  const context = useMemo(() => buildSecretaryContext(data), [data]);

  // Referencia estable para enviar siempre el contexto y ajustes más recientes.
  const latestRef = useRef({ context, settings });
  useEffect(() => {
    latestRef.current = { context, settings };
  }, [context, settings]);

  const transport = useMemo(
    () =>
      // Lectura diferida: body() se ejecuta al enviar, no durante el render.
      // eslint-disable-next-line react-hooks/refs
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => latestRef.current,
      }),
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
          const toolCallId = (part as ToolUIPartShape).toolCallId;
          if (toolCallId && !processedToolsRef.current.has(toolCallId)) {
            processedToolsRef.current.add(toolCallId);
            const toolName = getToolName(part);
            const input = (part as ToolUIPartShape).input;
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
            } else if (
              toolName === "addPlannedExpenses" &&
              Array.isArray(input.plannedExpenses)
            ) {
              actions.addPlannedExpenses(input.plannedExpenses);
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

  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(SECRETARY_COLLAPSED_KEY);
    if (stored !== null) return stored === "true";
    // Primera visita: colapsado en móvil, expandido en escritorio
    return window.innerWidth < 768;
  });

  useEffect(() => {
    localStorage.setItem(SECRETARY_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const loading = status === "submitted" || status === "streaming";
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  /** Desplaza SOLO el historial del chat hasta el último mensaje. */
  const scrollChatToBottom = useCallback((smooth = true) => {
    const el = scrollAreaRef.current;
    if (!el) return;
    el.scrollTo?.({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  /** Devuelve la página a la posición del chat (al cerrar el teclado o enviar). */
  const restoreChatCardInView = useCallback(() => {
    const card = scrollAreaRef.current?.closest('[data-slot="card"]');
    if (!card) return;
    const top = card.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, top - 72), behavior: "smooth" });
  }, []);

  // Si el usuario sube para releer el historial, no volver a anclar abajo.
  // Se re-engancha al expandir el chat y muestra el último mensaje.
  useEffect(() => {
    if (collapsed && !isDesktop) return;
    const el = scrollAreaRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setUserScrolledUp(!nearBottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // Al expandir, anclar al final (último mensaje visible).
    el.scrollTop = el.scrollHeight;
    return () => el.removeEventListener("scroll", onScroll);
  }, [collapsed, isDesktop]);

  function toggleCollapsed() {
    // Al expandir, el chat debe mostrar el último mensaje.
    setCollapsed((v) => !v);
    setUserScrolledUp(false);
  }

  // Seguir el final del chat solo si el usuario no está leyendo historial.
  useEffect(() => {
    if (!userScrolledUp) scrollChatToBottom(true);
  }, [messages.length, status, userScrolledUp, scrollChatToBottom]);

  // Teclado móvil: al cerrarse, el visual viewport vuelve a crecer; limpiamos
  // la posición del scroll para no quedarnos “colgados” en mitad de la página.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let lastHeight = vv.height;
    const onChange = () => {
      const keyboardClosed = vv.height > lastHeight + 60;
      lastHeight = vv.height;
      if (keyboardClosed) {
        requestAnimationFrame(() => {
          scrollChatToBottom(true);
          restoreChatCardInView();
        });
      }
    };
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
    };
  }, [scrollChatToBottom, restoreChatCardInView]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !configured || loading) return;
    sendMessage({ text });
    setInput("");
    // Cerrar el teclado y re-anclar el chat al final (evita quedar colgado abajo).
    (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.blur();
    requestAnimationFrame(() => scrollChatToBottom(true));
  }

  const assistantName = settings.assistantName?.trim() || "Núcleo";

  return (
    <Card className="bg-muted/40 lg:col-span-2">
      {/* Cabecera SIEMPRE visible: el botón de colapsar nunca cambia de sitio */}
      <CardHeader className="pb-3">
        <div className="lg:hidden">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-medium leading-snug">
                  Secretario {assistantName}
                </span>
                {collapsed && (
                  <span className="block truncate text-xs text-muted-foreground">
                    Toca para hablar con tu asistente…
                  </span>
                )}
              </span>
            </span>
            <motion.span
              animate={{ rotate: collapsed ? 0 : 180 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground active:scale-95"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </button>
        </div>
        <div className="hidden items-center gap-2.5 lg:flex">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-base font-medium leading-snug">
            Secretario {assistantName}
          </span>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
      {(isDesktop || !collapsed) && (
        <motion.div
          initial={{ height: 0, opacity: 0, y: -4 }}
          animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -4 }}
          transition={{
            height: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] },
            opacity: { duration: 0.3 },
            y: { duration: 0.3 },
          }}
          className="overflow-hidden"
        >
          <CardContent className="pt-0">
            <div className="flex h-[min(420px,55dvh)] flex-col">
              <div
                ref={scrollAreaRef}
                className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-3"
              >
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

        {/* Mensaje de bienvenida (sin avatar: la cabecera de la tarjeta ya
            muestra la identidad del asistente) */}
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            ¡Hola! Soy {assistantName}, tu Secretario IA.
          </p>
        )}

        <div className="space-y-3">
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
                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/70 text-foreground">
                    <span className="text-xs font-semibold">Tú</span>
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    isUser ? "bg-primary text-primary-foreground" : "bg-muted/70",
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

              </div>

              {/* Entrada: siempre fija abajo */}
              <form
                onSubmit={handleSubmit}
                className="flex shrink-0 items-center gap-2 border-t pt-3"
              >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isMobile ? "Escribe tu mensaje…" : "Ej: Tengo examen de Matemáticas el 15 sep y entrega de Redes el viernes..."}
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
            </CardContent>
        </motion.div>
      )}
      </AnimatePresence>
    </Card>
  );
}
