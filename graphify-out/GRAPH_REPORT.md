# Graph Report - personal-os  (2026-08-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 616 nodes · 1371 edges · 25 communities (20 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `52be353c`
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
- academic-client.tsx
- pomodoro-client.tsx
- components.json
- ai-assistant.tsx
- test-reminder-time.mjs
- Next.js Default Starter Asset Set
- Next.js Agent Rules
- vapid-public-key/route.ts
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- generate-vapid-keys.mjs

## God Nodes (most connected - your core abstractions)
1. `cn()` - 77 edges
2. `useData()` - 41 edges
3. `todayKey()` - 31 edges
4. `Button()` - 27 edges
5. `compilerOptions` - 16 edges
6. `formatDate()` - 15 edges
7. `PomodoroClient()` - 15 edges
8. `DataProvider()` - 15 edges
9. `DashboardData` - 14 edges
10. `createClient()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `App Favicon (Sparkle)` --conceptually_related_to--> `Next.js Default Starter Asset Set`  [INFERRED]
  src/app/icon.svg → public/next.svg
- `SubjectGradesSheetProps` --references--> `Subject`  [EXTRACTED]
  src/components/academic/subject-grades-sheet.tsx → src/lib/types.ts
- `File UI Icon` --conceptually_related_to--> `Next.js Default Starter Asset Set`  [INFERRED]
  public/file.svg → public/next.svg
- `Globe UI Icon` --conceptually_related_to--> `Next.js Default Starter Asset Set`  [INFERRED]
  public/globe.svg → public/next.svg
- `Vercel Logo Icon` --conceptually_related_to--> `Next.js Default Starter Asset Set`  [INFERRED]
  public/vercel.svg → public/next.svg

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Next.js App Icon Asset Set** — public_file_file_icon, public_globe_globe_icon, public_next_nextjs_logo, public_vercel_vercel_logo, public_window_window_icon, src_app_icon_app_favicon [INFERRED 0.75]

## Communities (25 total, 5 thin omitted)

### Community 0 - "calendar-client.tsx"
Cohesion: 0.05
Nodes (66): metadata, metadata, metadata, metadata, metadata, features, buildCalendarMatrix(), CalendarClient() (+58 more)

### Community 1 - "cn"
Cohesion: 0.06
Nodes (42): SubjectGradesSheetProps, navItems, Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage() (+34 more)

### Community 2 - "chat/route.ts"
Cohesion: 0.07
Nodes (44): adviceSchema, maxDuration, POST(), GET(), maxDuration, POST(), maxDuration, POST() (+36 more)

### Community 3 - "data-provider.tsx"
Cohesion: 0.09
Nodes (48): priorityBadge, priorityLabel, typeLabel, GradeFormProps, DataActions, DataContext, DataContextValue, DataProvider() (+40 more)

### Community 4 - "test-web-push.mjs"
Cohesion: 0.05
Nodes (40): RFC-8030, RFC-8291, RFC-8292, asJwk, asPublic, authMatch, authSecret, body (+32 more)

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

### Community 9 - "academic-client.tsx"
Cohesion: 0.09
Nodes (16): metadata, LoginPage(), handleGoogle(), AcademicClient(), priorityClass, typeLabel, ClassroomConnect(), SubjectGradesSheet() (+8 more)

### Community 10 - "pomodoro-client.tsx"
Cohesion: 0.13
Nodes (21): metadata, fmt(), Mode, playChime(), PomodoroClient(), handleTestNotification(), requestPermissionIfNeeded(), toggleRunning() (+13 more)

### Community 11 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "ai-assistant.tsx"
Cohesion: 0.15
Nodes (12): AiAssistant(), daysUntil(), priorityBadge, priorityLabel, categoryStyles, PlanDelDia(), messageText(), SecretaryChat() (+4 more)

### Community 13 - "test-reminder-time.mjs"
Cohesion: 0.25
Nodes (11): d1, d2, d3, dMidnight, collectUpcoming(), ReminderItem, TASK_LABELS, dateKeyInTz() (+3 more)

### Community 14 - "Next.js Default Starter Asset Set"
Cohesion: 0.33
Nodes (7): Next.js Default Starter Asset Set, File UI Icon, Globe UI Icon, Next.js Logo Icon, Vercel Logo Icon, Window UI Icon, App Favicon (Sparkle)

### Community 15 - "Next.js Agent Rules"
Cohesion: 0.50
Nodes (4): generate-agent-files.js, next/dist/docs guides, Next.js Agent Rules, CLAUDE.md @AGENTS.md include

## Knowledge Gaps
- **200 isolated node(s):** `DayCell`, `FilterType`, `Attachment`, `Mode`, `Status` (+195 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `calendar-client.tsx`, `academic-client.tsx`, `pomodoro-client.tsx`, `ai-assistant.tsx`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `useData()` connect `calendar-client.tsx` to `cn`, `chat/route.ts`, `data-provider.tsx`, `academic-client.tsx`, `pomodoro-client.tsx`, `ai-assistant.tsx`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `todayKey()` connect `calendar-client.tsx` to `data-provider.tsx`, `ai-assistant.tsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `DayCell`, `FilterType`, `Attachment` to the rest of the system?**
  _200 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `calendar-client.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05107902499611861 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.06201923076923077 - nodes in this community are weakly interconnected._
- **Should `chat/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0670762928827445 - nodes in this community are weakly interconnected._