import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listCourses,
  refreshAccessToken,
  type ClassroomCourse,
} from "@/lib/classroom/client";

/**
 * Importa las asignaturas (cursos) de Google Classroom a Supabase.
 * - Solo cursos → subjects (clave: classroom_course_id).
 * - Las tareas/entregas NO se importan para no arrastrar todo el historial;
 *   las novedades llegan por notificación (Edge Function check-classroom).
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

    // 2) Importar SOLO asignaturas (cursos activos). Las tareas no se
    // importan para no traer todo el historial (tareas antiguas ya hechas);
    // las novedades llegan por notificación (Edge Function check-classroom).
    const { courses = [] } = await listCourses(accessToken);

    let importedSubjects = 0;
    const errors: string[] = [];

    for (const course of courses) {
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
        if (subject) importedSubjects += 1;
      } catch (err) {
        errors.push(
          `asignatura "${course.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      courses: importedSubjects,
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
