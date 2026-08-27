// Cliente ligero de la API de Google Classroom (v1) usando fetch.
// Scopes: classroom.courses.readonly + classroom.coursework.me.readonly.
// Evita la dependencia pesada de `googleapis`.

export const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
];

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const API_URL = "https://classroom.googleapis.com/v1";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  courseState?: string;
}

export interface ClassroomCourseWork {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  dueDate?: { year: number; month: number; day: number };
  workType?: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO
}

/** Construye la URL de consentimiento de Google para iniciar el flujo OAuth. */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLASSROOM_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: CLASSROOM_SCOPES.join(" "),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Intercambia el `code` de autorización por tokens. */
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLASSROOM_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLASSROOM_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error("No se pudo intercambiar el código de autorización.");
  }
  return res.json();
}

/** Refresca el access token usando el refresh token. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLASSROOM_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLASSROOM_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error("No se pudo refrescar el token de Google Classroom.");
  }
  return res.json();
}

async function apiGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Classroom API error (${res.status}): ${body}`);
  }
  return res.json();
}

export interface CourseListResponse {
  courses?: ClassroomCourse[];
}

export interface CourseWorkListResponse {
  courseWork?: ClassroomCourseWork[];
}

export function listCourses(accessToken: string): Promise<CourseListResponse> {
  return apiGet<CourseListResponse>(accessToken, "/courses?courseStates=ACTIVE");
}

export function listCourseWork(
  accessToken: string,
  courseId: string,
): Promise<CourseWorkListResponse> {
  return apiGet<CourseWorkListResponse>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/courseWork`,
  );
}

/** Convierte dueDate de Classroom (año/mes/día) a una fecha ISO (YYYY-MM-DD). */
export function dueDateToISO(
  due?: { year: number; month: number; day: number },
): string | null {
  if (!due) return null;
  const m = String(due.month).padStart(2, "0");
  const d = String(due.day).padStart(2, "0");
  return `${due.year}-${m}-${d}`;
}
