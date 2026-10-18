@AGENTS.md

# Instrucciones Rápidas para Claude

- Consulta `@AGENTS.md` para conocer la arquitectura completa, stack, módulos y reglas del proyecto Núcleo.
- Para verificar cambios antes de dar por terminada una tarea:
  - `npm run lint` (comprobar reglas de código)
  - `npm run build` (verificar tipos y compilación en Next.js 16)
- Respeta la compatibilidad offline (`localStorage` primero) y el sistema de tombstones para borrado (`sync-tombstones.ts`).
- En Next.js 16, recuerda que `params` y `searchParams` son asíncronos (`await`).
