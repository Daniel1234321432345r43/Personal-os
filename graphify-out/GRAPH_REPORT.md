# Graph Report - personal-os  (2026-08-25)

## Corpus Check
- 118 files · ~48,563 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 678 nodes · 1442 edges · 31 communities (25 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `152712a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- calendar-client.tsx
- cn
- chat/route.ts
- data-provider.tsx
- test-web-push.mjs
- dependencies
- classroom/client.ts
- compilerOptions
- devDependencies
- pomodoro-client.tsx
- useData
- components.json
- utils.ts
- test-reminder-time.mjs
- Next.js Default Starter Asset Set
- Next.js Agent Rules
- vapid-public-key/route.ts
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- generate-vapid-keys.mjs
- Framer Motion Animator
- Núcleo — Tu Sistema Operativo Personal
- app-shell.tsx
- subject-grades-sheet.tsx
- plan-del-dia.tsx
- tabs.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 77 edges
2. `useData()` - 41 edges
3. `todayKey()` - 31 edges
4. `Button()` - 27 edges
5. `compilerOptions` - 16 edges
6. `DataProvider()` - 15 edges
7. `formatDate()` - 15 edges
8. `Núcleo — Tu Sistema Operativo Personal` - 15 edges
9. `DashboardData` - 14 edges
10. `createClient()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `App Favicon (Sparkle)` --conceptually_related_to--> `Next.js Default Starter Asset Set`  [INFERRED]
  src/app/icon.svg → public/next.svg
- `handleGoogle()` --calls--> `createClient()`  [EXTRACTED]
  src/app/(auth)/login/page.tsx → src/lib/supabase/client.ts
- `SubjectGradesSheetProps` --references--> `Subject`  [EXTRACTED]
  src/components/academic/subject-grades-sheet.tsx → src/lib/types.ts
- `handleGoToday()` --calls--> `todayKey()`  [EXTRACTED]
  src/components/calendar/calendar-client.tsx → src/lib/format.ts
- `ScrollBar()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/scroll-area.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Next.js App Icon Asset Set** — public_file_file_icon, public_globe_globe_icon, public_next_nextjs_logo, public_vercel_vercel_logo, public_window_window_icon, src_app_icon_app_favicon [INFERRED 0.75]

## Communities (31 total, 6 thin omitted)

### Community 0 - "calendar-client.tsx"
Cohesion: 0.05
Nodes (48): metadata, metadata, metadata, metadata, metadata, metadata, features, AcademicClient() (+40 more)

### Community 1 - "cn"
Cohesion: 0.10
Nodes (21): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), CardAction(), CardFooter() (+13 more)

### Community 2 - "chat/route.ts"
Cohesion: 0.07
Nodes (44): adviceSchema, maxDuration, POST(), GET(), maxDuration, POST(), maxDuration, POST() (+36 more)

### Community 3 - "data-provider.tsx"
Cohesion: 0.08
Nodes (50): AiAssistant(), daysUntil(), priorityBadge, priorityLabel, GradeFormProps, DataActions, DataContext, DataContextValue (+42 more)

### Community 4 - "test-web-push.mjs"
Cohesion: 0.05
Nodes (40): RFC-8030, RFC-8291, RFC-8292, asJwk, asPublic, authMatch, authSecret, body (+32 more)

### Community 5 - "dependencies"
Cohesion: 0.05
Nodes (39): ai, @ai-sdk/anthropic, @ai-sdk/google, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, framer-motion (+31 more)

### Community 6 - "classroom/client.ts"
Cohesion: 0.11
Nodes (25): GET(), GET(), GET(), pickColor(), POST(), POST(), maxDuration, POST() (+17 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+21 more)

### Community 8 - "devDependencies"
Cohesion: 0.07
Nodes (28): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+20 more)

### Community 9 - "pomodoro-client.tsx"
Cohesion: 0.09
Nodes (27): metadata, LoginPage(), handleGoogle(), ClassroomConnect(), fmt(), Mode, playChime(), PomodoroClient() (+19 more)

### Community 10 - "useData"
Cohesion: 0.10
Nodes (31): BudgetForm(), GradeForm(), EMOJIS, HabitForm(), COLORS, SubjectForm(), addDays(), PRIORITIES (+23 more)

### Community 11 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "utils.ts"
Cohesion: 0.18
Nodes (8): messageText(), SecretaryChat(), suggestions, Input(), ScrollArea(), ScrollBar(), Separator(), useIsMobile()

### Community 13 - "test-reminder-time.mjs"
Cohesion: 0.25
Nodes (11): d1, d2, d3, dMidnight, collectUpcoming(), ReminderItem, TASK_LABELS, dateKeyInTz() (+3 more)

### Community 14 - "Next.js Default Starter Asset Set"
Cohesion: 0.33
Nodes (7): Next.js Default Starter Asset Set, File UI Icon, Globe UI Icon, Next.js Logo Icon, Vercel Logo Icon, Window UI Icon, App Favicon (Sparkle)

### Community 15 - "Next.js Agent Rules"
Cohesion: 0.50
Nodes (4): generate-agent-files.js, next/dist/docs guides, Next.js Agent Rules, CLAUDE.md @AGENTS.md include

### Community 25 - "Framer Motion Animator"
Cohesion: 0.07
Nodes (28): AnimatedContainer, AnimatedList, Animation Hooks, Basic Animations, Best Practices, Core Workflow, Drag, Exit Animations with AnimatePresence (+20 more)

### Community 26 - "Núcleo — Tu Sistema Operativo Personal"
Cohesion: 0.10
Nodes (19): Animaciones e interacción, Aplicar el esquema, Configuración de IA, Configuración de Supabase, Cómo funciona la sincronización, Despliegue en Netlify, Diagnóstico de sincronización, Estructura (+11 more)

### Community 27 - "app-shell.tsx"
Cohesion: 0.14
Nodes (13): AppShell(), handleSignOut(), bottomNavItems, navItems, pillSpring, SheetTrigger(), createClient(), PullRefreshHandlers (+5 more)

### Community 28 - "subject-grades-sheet.tsx"
Cohesion: 0.24
Nodes (8): SubjectGradesSheetProps, Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 30 - "tabs.tsx"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

## Knowledge Gaps
- **243 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+238 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `calendar-client.tsx`, `pomodoro-client.tsx`, `useData`, `utils.ts`, `app-shell.tsx`, `subject-grades-sheet.tsx`, `plan-del-dia.tsx`, `tabs.tsx`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `useData()` connect `useData` to `calendar-client.tsx`, `chat/route.ts`, `data-provider.tsx`, `pomodoro-client.tsx`, `utils.ts`, `subject-grades-sheet.tsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `Button()` connect `useData` to `calendar-client.tsx`, `cn`, `data-provider.tsx`, `pomodoro-client.tsx`, `utils.ts`, `app-shell.tsx`, `subject-grades-sheet.tsx`, `plan-del-dia.tsx`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _243 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `calendar-client.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05292702485966319 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.09879032258064516 - nodes in this community are weakly interconnected._
- **Should `chat/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0670762928827445 - nodes in this community are weakly interconnected._