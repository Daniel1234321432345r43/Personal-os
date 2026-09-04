import { tool } from "ai";
import { z } from "zod";

export const secretaryTools = {
  addSubjects: tool({
    description:
      "Añade una o más asignaturas nuevas al sistema operativo personal del usuario.",
    inputSchema: z.object({
      subjects: z
        .array(
          z.object({
            name: z
              .string()
              .describe(
                "Nombre de la asignatura (ej. Matemáticas, Física, Programación)",
              ),
            color: z
              .string()
              .optional()
              .describe(
                "Color hex representativo (ej. #6366f1, #0ea5e9, #10b981, #f59e0b, #ef4444, #ec4899, #8b5cf6, #14b8a6)",
              ),
          }),
        )
        .describe("Lista de asignaturas a crear"),
    }),
    execute: async ({ subjects }) => {
      return {
        success: true,
        action: "addSubjects",
        count: subjects.length,
        subjects,
      };
    },
  }),

  addTasks: tool({
    description:
      "Añade una o más tareas, entregas (trabajos/prácticas/deberes), exámenes o sesiones de estudio al sistema.",
    inputSchema: z.object({
      tasks: z
        .array(
          z.object({
            title: z
              .string()
              .describe(
                "Título descriptivo (ej. Examen Parcial de Álgebra, Entrega Práctica 1 de Redes, Ejercicios Tema 3)",
              ),
            type: z
              .enum(["task", "assignment", "exam", "study_session"])
              .describe(
                "Tipo de elemento: 'exam' para exámenes/controles; 'assignment' para entregas/trabajos/prácticas; 'study_session' para sesiones de estudio; 'task' para tareas generales",
              ),
            category: z
              .enum(["academic", "personal", "sport", "finance"])
              .optional()
              .default("academic")
              .describe("Categoría temática"),
            priority: z
              .enum(["low", "medium", "high", "urgent"])
              .optional()
              .default("medium")
              .describe("Prioridad o urgencia"),
            due_date: z
              .string()
              .nullable()
              .optional()
              .describe(
                "Fecha límite o fecha del examen en formato ISO YYYY-MM-DD (ej. 2026-09-15)",
              ),
            start_time: z
              .string()
              .nullable()
              .optional()
              .describe(
                "Hora de inicio en formato HH:MM (ej. 17:30). Úsala cuando el usuario diga a qué hora empieza o cuándo tiene algo, para poder avisarle antes.",
              ),
            remind_before_minutes: z
              .union([z.literal(5), z.literal(10), z.literal(15)])
              .optional()
              .describe(
                "Minutos de antelación de la notificación antes de la hora de inicio (5, 10 o 15). Usa 10 si el usuario no dice cuánto antes quiere que le avisen.",
              ),
            session_dates: z
              .array(z.string())
              .optional()
              .describe(
                "Si la sesión de estudio o trabajo se extiende durante varios días o sesiones (ej. 'estudiar geografía en 2 días: hoy y mañana', '3 días de estudio'), proporciona la lista de fechas en formato ISO YYYY-MM-DD para cada sesión. El sistema creará automáticamente las tareas divididas en partes '1/2', '2/2', etc.",
              ),
            estimated_minutes: z
              .number()
              .nullable()
              .optional()
              .describe("Minutos estimados de dedicación o duración (ej. 60, 120)"),
            subject_name: z
              .string()
              .nullable()
              .optional()
              .describe(
                "Nombre de la asignatura asociada (debe coincidir con una asignatura existente o que se esté creando)",
              ),
            description: z
              .string()
              .nullable()
              .optional()
              .describe("Descripción, temario o notas adicionales"),
          }),
        )
        .describe("Lista de tareas, entregas o exámenes a añadir"),
    }),
    execute: async ({ tasks }) => {
      return {
        success: true,
        action: "addTasks",
        count: tasks.length,
        tasks,
      };
    },
  }),

  deleteTasks: tool({
    description:
      "Elimina una o más tareas o exámenes usando sus IDs o títulos.",
    inputSchema: z.object({
      task_ids: z
        .array(z.string())
        .optional()
        .describe("Lista de IDs de tareas a eliminar"),
      task_titles: z
        .array(z.string())
        .optional()
        .describe("Lista de títulos de tareas a eliminar"),
    }),
    execute: async (args) => {
      return {
        success: true,
        action: "deleteTasks",
        ...args,
      };
    },
  }),

  deleteSubjects: tool({
    description: "Elimina una o más asignaturas por su ID o nombre.",
    inputSchema: z.object({
      subject_ids: z
        .array(z.string())
        .optional()
        .describe("Lista de IDs de asignaturas a eliminar"),
      subject_names: z
        .array(z.string())
        .optional()
        .describe("Lista de nombres de asignaturas a eliminar"),
    }),
    execute: async (args) => {
      return {
        success: true,
        action: "deleteSubjects",
        ...args,
      };
    },
  }),

  addWorkouts: tool({
    description: "Añade uno o más entrenamientos deportivos.",
    inputSchema: z.object({
      workouts: z.array(
        z.object({
          activity_type: z
            .string()
            .describe(
              "Tipo de actividad (ej. Gimnasio, Correr, Natación, Fútbol, Yoga)",
            ),
          duration_minutes: z.number().describe("Duración en minutos"),
          date: z
            .string()
            .optional()
            .describe("Fecha en formato YYYY-MM-DD"),
          start_time: z
            .string()
            .nullable()
            .optional()
            .describe(
              "Hora de inicio en formato HH:MM (ej. 18:00). Úsala cuando el usuario diga a qué hora entrena.",
            ),
          title: z.string().optional().nullable().describe("Título opcional"),
          notes: z.string().optional().nullable().describe("Notas opcionales"),
        }),
      ),
    }),
    execute: async ({ workouts }) => {
      return {
        success: true,
        action: "addWorkouts",
        count: workouts.length,
        workouts,
      };
    },
  }),

  addHabits: tool({
    description: "Añade uno o más hábitos diarios para seguimiento.",
    inputSchema: z.object({
      habits: z.array(
        z.object({
          name: z
            .string()
            .describe("Nombre del hábito (ej. Beber 2L de agua, Meditar, Leer 20 min)"),
          emoji: z
            .string()
            .optional()
            .default("✨")
            .describe("Emoji representativo del hábito"),
        }),
      ),
    }),
    execute: async ({ habits }) => {
      return {
        success: true,
        action: "addHabits",
        count: habits.length,
        habits,
      };
    },
  }),

  addTransactions: tool({
    description:
      "Añade transacciones financieras (ingresos o gastos del presupuesto).",
    inputSchema: z.object({
      transactions: z.array(
        z.object({
          type: z
            .enum(["income", "expense"])
            .describe("Tipo: 'income' (ingreso) o 'expense' (gasto)"),
          amount: z.number().describe("Importe numérico en euros/moneda local"),
          category: z
            .string()
            .describe("Categoría (ej. Comida, Transporte, Ocio, Universidad, Nómina)"),
          date: z
            .string()
            .optional()
            .describe("Fecha en formato YYYY-MM-DD"),
          description: z
            .string()
            .optional()
            .nullable()
            .describe("Concepto o detalle"),
        }),
      ),
    }),
    execute: async ({ transactions }) => {
      return {
        success: true,
        action: "addTransactions",
        count: transactions.length,
        transactions,
      };
    },
  }),

  addPlannedExpenses: tool({
    description:
      "Añade gastos futuros previstos o planificados al presupuesto mensual (compras futuras, recibos, etc.).",
    inputSchema: z.object({
      plannedExpenses: z.array(
        z.object({
          amount: z.number().describe("Importe previsto en euros"),
          category: z
            .string()
            .describe("Categoría (ej. Alimentación, Ocio, Vivienda, Transporte)"),
          description: z
            .string()
            .optional()
            .nullable()
            .describe("Concepto o motivo del gasto planificado"),
          date: z
            .string()
            .optional()
            .describe("Fecha prevista aproximada en formato YYYY-MM-DD"),
        }),
      ),
    }),
    execute: async ({ plannedExpenses }) => {
      return {
        success: true,
        action: "addPlannedExpenses",
        count: plannedExpenses.length,
        plannedExpenses,
      };
    },
  }),

  addNotes: tool({
    description: "Añade una o más notas o apuntes.",
    inputSchema: z.object({
      notes: z.array(
        z.object({
          title: z.string().describe("Título del apunte o nota"),
          content: z
            .string()
            .describe("Contenido en texto o formato markdown"),
        }),
      ),
    }),
    execute: async ({ notes }) => {
      return {
        success: true,
        action: "addNotes",
        count: notes.length,
        notes,
      };
    },
  }),

  addGrades: tool({
    description:
      "Añade o registra una o más notas/calificaciones académicas obtenidas por el usuario en exámenes, trabajos, prácticas o asignaturas, incluyendo la nota sacada y el porcentaje que cuenta sobre la nota final.",
    inputSchema: z.object({
      grades: z
        .array(
          z.object({
            subject_name: z
              .string()
              .describe(
                "Nombre de la asignatura (ej. Matemáticas, Física, Historia, Programación)",
              ),
            title: z
              .string()
              .describe(
                "Título o concepto del examen/evaluación (ej. Examen Parcial de Matemáticas, Examen Tema 3, Trabajo Final, Práctica 1)",
              ),
            score: z
              .number()
              .describe(
                "Nota o puntuación obtenida (ej. 8, 8.5, 9, 6.75)",
              ),
            max_score: z
              .number()
              .optional()
              .default(10)
              .describe(
                "Puntuación máxima posible de la evaluación (por defecto 10)",
              ),
            weight_percentage: z
              .number()
              .nullable()
              .optional()
              .describe(
                "Porcentaje que cuenta o pondera esta nota sobre el total de la asignatura (ej. 20 para un 20%, 30 para un 30%, 15 para un 15%)",
              ),
            date: z
              .string()
              .optional()
              .describe(
                "Fecha de la prueba o calificación en formato YYYY-MM-DD",
              ),
            task_title: z
              .string()
              .nullable()
              .optional()
              .describe(
                "Título de la tarea o examen existente relacionado si lo hay (para marcarlo como completado)",
              ),
            notes: z
              .string()
              .nullable()
              .optional()
              .describe("Comentarios, observaciones o desglose de la nota"),
          }),
        )
        .describe("Lista de notas/calificaciones a registrar"),
    }),
    execute: async ({ grades }) => {
      return {
        success: true,
        action: "addGrades",
        count: grades.length,
        grades,
      };
    },
  }),

  deleteGrades: tool({
    description:
      "Elimina una o más notas/calificaciones por ID o título.",
    inputSchema: z.object({
      grade_ids: z
        .array(z.string())
        .optional()
        .describe("Lista de IDs de calificaciones a eliminar"),
      grade_titles: z
        .array(z.string())
        .optional()
        .describe("Lista de títulos de calificaciones a eliminar"),
    }),
    execute: async (args) => {
      return {
        success: true,
        action: "deleteGrades",
        ...args,
      };
    },
  }),
};

