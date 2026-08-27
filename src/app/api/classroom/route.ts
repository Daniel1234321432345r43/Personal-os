import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listCourses,
  listCourseWork,
  refreshAccessToken,
  dueDateToISO,
  type ClassroomCourse,
} from "@/lib/classroom/client";

/**
 * Importa asignaturas y tareas de Google Classroom a Supabase.
 * - Las asignaturas se guardan en `subjects` (clave: classroom_course_id).
 * - Las entregas se guardan en `tasks` (clave: classroom_id, type = assignment).
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 1) Obtener tokens y refrescar si expiraron.
    const { data: tokenRow } = await supabase
      .from("google_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tokenRow?.access_token) {
      return NextResponse.json(
        { error: "Google Classroom no está conectado" },
        { status: 400 },
      );
    }

    let accessToken = tokenRow.access_token;
    if (
      tokenRow.expires_at &&
      new Date(tokenRow.expires_at).getTime() < Date.now() &&
      tokenRow.refresh_token
    ) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      accessToken = refreshed.access_token;
      await supabase
        .from("google_tokens")
        .update({
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("user_id", user.id);
    }

    // 2) Importar asignaturas (cursos activos).
    const { courses = [] } = await listCourses(accessToken);

    let importedSubjects = 0;
    let importedTasks = 0;
    const errors: string[] = [];
    const subjectIdByCourse = new Map<string, string>();

    for (const course of courses) {
      // 3) Importar entregas (courseWork) de cada curso. Si un curso falla,
      // se registra el error y se continúa con el resto.
      let subjectId: string | null = null;
      try {
        const { data: subject, error: subjectError } = await supabase
          .from("subjects")
          .upsert(
            {
              user_id: user.id,
              name: course.name,
              classroom_course_id: course.id,
              classroom_name: course.name,
              color: pickColor(course.id),
            },
            { onConflict: "user_id,classroom_course_id" },
          )
          .select()
          .single();

        if (subjectError) {
          errors.push(`asignatura "${course.name}": ${subjectError.message}`);
          continue;
        }
        subjectId = subject?.id ?? null;
        importedSubjects += 1;
        subjectIdByCourse.set(course.id, subject!.id);
      } catch (err) {
        errors.push(
          `asignatura "${course.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }

      let courseWork: { id: string; title: string; description?: string; dueDate?: { year: number; month: number; day: number } }[] = [];
      try {
        const res = await listCourseWork(accessToken, course.id);
        courseWork = res.courseWork ?? [];
      } catch (err) {
        errors.push(
          `entregas de "${course.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }

      for (const cw of courseWork) {
        const due = dueDateToISO(cw.dueDate);
        const { error: taskError } = await supabase.from("tasks").upsert(
          {
            user_id: user.id,
            title: cw.title,
            description: cw.description ?? null,
            type: "assignment",
            category: "academic",
            subject_id: subjectId,
            classroom_id: cw.id,
            due_date: due ? new Date(`${due}T23:59:59`).toISOString() : null,
            status: "pending",
          },
          { onConflict: "user_id,classroom_id" },
        );
        if (taskError) {
          errors.push(`tarea "${cw.title}": ${taskError.message}`);
        } else {
          importedTasks += 1;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      courses: importedSubjects,
      tasks: importedTasks,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (err) {
    console.error("[classroom] error importando:", err);
    return NextResponse.json(
      {
        error: `Error al importar: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }
}

/** Color estable por curso (para el badge de la asignatura). */
function pickColor(seed: string): string {
  const palette = [
    "#6366f1",
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

// Desconecta Google Classroom: elimina el token asociado al usuario.
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { error } = await supabase
      .from("google_tokens")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[classroom] error desconectando:", err);
    return NextResponse.json(
      {
        error: `Error al desconectar: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }
}

// También permitimos ver el estado de conexión vía GET (para el botón).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ connected: false });
  }

  const { data } = await supabase
    .from("google_tokens")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ connected: Boolean(data) });
}

export type { ClassroomCourse };
