# Graph Report - personal-os  (2026-08-25)

## Corpus Check
- 116 files · ~45,661 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 645 nodes · 1410 edges · 32 communities (26 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `152712a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- academic-client.tsx
- cn
- chat/route.ts
- data-provider.tsx
- test-web-push.mjs
- dependencies
- classroom/client.ts
- compilerOptions
- devDependencies
- push-manager.tsx
- useData
- components.json
- ai-assistant.tsx
- web_push.js
- Next.js Default Starter Asset Set
- Next.js Agent Rules
- vapid-public-key/route.ts
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- generate-vapid-keys.mjs
- calendar-client.tsx
- Núcleo — Tu Sistema Operativo Personal
- app-shell.tsx
- subject-grades-sheet.tsx
- avatar.tsx
- tabs.tsx
- badge.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 77 edges
2. `useData()` - 41 edges
3. `todayKey()` - 31 edges
4. `Button()` - 27 edges
5. `compilerOptions` - 16 edges
6. `DataProvider()` - 15 edges
7. `formatDate()` - 15 edges
8. `DashboardData` - 14 edges
9. `createClient()` - 14 edges
10. `Núcleo — Tu Sistema Operativo Personal` - 14 edges

## Surprising Connections (you probably didn't know these)
- `App Favicon (Sparkle)` --conceptually_related_to--> `Next.js Default Starter Asset Set`  [INFERRED]
  src/app/icon.svg → public/next.svg
- `handleGoogle()` --calls--> `createClient()`  [EXTRACTED]
  src/app/(auth)/login/page.tsx → src/lib/supabase/client.ts
- `SubjectGradesSheetProps` --references--> `Subject`  [EXTRACTED]
  src/components/academic/subject-grades-sheet.tsx → src/lib/types.ts
- `AvatarImage()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/avatar.tsx → src/lib/utils.ts
- `AvatarBadge()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/avatar.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Next.js App Icon Asset Set** — public_file_file_icon, public_globe_globe_icon, public_next_nextjs_logo, public_vercel_vercel_logo, public_window_window_icon, src_app_icon_app_favicon [INFERRED 0.75]

## Communities (32 total, 6 thin omitted)

### Community 0 - "academic-client.tsx"
Cohesion: 0.07
Nodes (32): metadata, metadata, metadata, metadata, metadata, features, AcademicClient(), priorityClass (+24 more)

### Community 1 - "cn"
Cohesion: 0.11
Nodes (18): CardAction(), CardFooter(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator() (+10 more)

### Community 2 - "chat/route.ts"
Cohesion: 0.07
Nodes (43): adviceSchema, maxDuration, POST(), GET(), maxDuration, POST(), maxDuration, POST() (+35 more)

### Community 3 - "data-provider.tsx"
Cohesion: 0.09
Nodes (48): priorityBadge, priorityLabel, typeLabel, GradeFormProps, DataActions, DataContext, DataContextValue, DataProvider() (+40 more)

### Community 4 - "test-web-push.mjs"
Cohesion: 0.07
Nodes (22): asJwk, asPublic, authMatch, authSecret, body, ciphertext, decrypted, enc (+14 more)

### Community 5 - "dependencies"
Cohesion: 0.05
Nodes (37): ai, @ai-sdk/anthropic, @ai-sdk/google, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, lucide-react (+29 more)

### Community 6 - "classroom/client.ts"
Cohesion: 0.11
Nodes (25): GET(), GET(), GET(), pickColor(), POST(), POST(), maxDuration, POST() (+17 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+21 more)

### Community 8 - "devDependencies"
Cohesion: 0.07
Nodes (28): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+20 more)

### Community 9 - "push-manager.tsx"
Cohesion: 0.16
Nodes (17): LoginPage(), handleGoogle(), ClassroomConnect(), PushManager(), handleSubscribe(), handleUnsubscribe(), Status, isSupabaseConfigured() (+9 more)

### Community 10 - "useData"
Cohesion: 0.09
Nodes (30): metadata, BudgetForm(), GradeForm(), EMOJIS, HabitForm(), COLORS, SubjectForm(), PRIORITIES (+22 more)

### Community 11 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "ai-assistant.tsx"
Cohesion: 0.12
Nodes (15): AiAssistant(), daysUntil(), priorityBadge, priorityLabel, categoryStyles, PlanDelDia(), messageText(), SecretaryChat() (+7 more)

### Community 13 - "web_push.js"
Cohesion: 0.10
Nodes (29): RFC-8030, RFC-8291, RFC-8292, d1, d2, d3, dMidnight, collectUpcoming() (+21 more)

### Community 14 - "Next.js Default Starter Asset Set"
Cohesion: 0.33
Nodes (7): Next.js Default Starter Asset Set, File UI Icon, Globe UI Icon, Next.js Logo Icon, Vercel Logo Icon, Window UI Icon, App Favicon (Sparkle)

### Community 15 - "Next.js Agent Rules"
Cohesion: 0.50
Nodes (4): generate-agent-files.js, next/dist/docs guides, Next.js Agent Rules, CLAUDE.md @AGENTS.md include

### Community 25 - "calendar-client.tsx"
Cohesion: 0.12
Nodes (20): metadata, buildCalendarMatrix(), CalendarClient(), handleGoToday(), DayCell, FilterType, MONTH_NAMES, toDateKey() (+12 more)

### Community 26 - "Núcleo — Tu Sistema Operativo Personal"
Cohesion: 0.11
Nodes (18): Aplicar el esquema, Configuración de IA, Configuración de Supabase, Cómo funciona la sincronización, Despliegue en Netlify, Diagnóstico de sincronización, Estructura, Google Classroom opcional (+10 more)

### Community 27 - "app-shell.tsx"
Cohesion: 0.16
Nodes (11): AppShell(), handleSignOut(), bottomNavItems, navItems, createClient(), PullRefreshHandlers, PullRefreshState, usePullRefresh() (+3 more)

### Community 28 - "subject-grades-sheet.tsx"
Cohesion: 0.22
Nodes (9): SubjectGradesSheetProps, Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle() (+1 more)

### Community 29 - "avatar.tsx"
Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 30 - "tabs.tsx"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

## Knowledge Gaps
- **220 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+215 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `academic-client.tsx`, `useData`, `ai-assistant.tsx`, `calendar-client.tsx`, `app-shell.tsx`, `subject-grades-sheet.tsx`, `avatar.tsx`, `tabs.tsx`, `badge.tsx`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `useData()` connect `useData` to `academic-client.tsx`, `chat/route.ts`, `data-provider.tsx`, `ai-assistant.tsx`, `calendar-client.tsx`, `subject-grades-sheet.tsx`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `Button()` connect `useData` to `academic-client.tsx`, `cn`, `push-manager.tsx`, `ai-assistant.tsx`, `calendar-client.tsx`, `app-shell.tsx`, `subject-grades-sheet.tsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _220 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `academic-client.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07486338797814207 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.10967741935483871 - nodes in this community are weakly interconnected._
- **Should `chat/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06874669487043893 - nodes in this community are weakly interconnected._