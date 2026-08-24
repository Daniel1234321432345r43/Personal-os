# Graph Report - personal-os  (2026-08-20)

## Corpus Check
- Corpus is ~15,799 words - fits in a single context window. You may not need a graph.

## Summary
- 418 nodes · 831 edges · 23 communities (20 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.8)
- Token cost: 68,673 input · 0 output

## Community Hubs (Navigation)
- App Pages & Clients
- Data Provider & Layout
- Package Dependencies
- Project Docs & Concepts
- TypeScript Config
- Google Classroom Integration
- Build Tooling
- shadcn UI Primitives
- shadcn Config
- App Shell & Auth
- Auth & Feature Wiring
- Data Entry Forms
- AI Routes & Prompts
- Secretary Chat UI
- UI Utilities
- App Icon Assets
- Tabs Component
- ESLint Config
- Next Config
- PostCSS Config

## God Nodes (most connected - your core abstractions)
1. `cn()` - 71 edges
2. `useData()` - 23 edges
3. `Button()` - 18 edges
4. `todayKey()` - 17 edges
5. `compilerOptions` - 16 edges
6. `DashboardData` - 12 edges
7. `Núcleo` - 12 edges
8. `DataProvider()` - 9 edges
9. `isSupabaseConfigured()` - 9 edges
10. `isAiConfigured()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `App Favicon (Sparkle)` --conceptually_related_to--> `Next.js Default Starter Asset Set`  [INFERRED]
  src/app/icon.svg → public/next.svg
- `Next.js 16` --conceptually_related_to--> `Next.js Agent Rules`  [INFERRED]
  README.md → AGENTS.md
- `handleGoogle()` --calls--> `createClient()`  [EXTRACTED]
  src/app/(auth)/login/page.tsx → src/lib/supabase/client.ts
- `Label()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/label.tsx → src/lib/utils.ts
- `ScrollBar()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/scroll-area.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Modules of the Núcleo personal OS** — readme_dashboard_secretario_ia, readme_estudios, readme_deporte, readme_finanzas [EXTRACTED 1.00]
- **Configurable AI provider layer** — readme_vercel_ai_sdk_v7, readme_openai, readme_google_gemini, readme_ai_provider [INFERRED 0.85]
- **Google OAuth integration flow** — readme_google_classroom_api, readme_oauth2, readme_api_classroom, readme_supabase [INFERRED 0.75]
- **Next.js App Icon Asset Set** — public_file_file_icon, public_globe_globe_icon, public_next_nextjs_logo, public_vercel_vercel_logo, public_window_window_icon, src_app_icon_app_favicon [INFERRED 0.75]

## Communities (23 total, 3 thin omitted)

### Community 0 - "App Pages & Clients"
Cohesion: 0.07
Nodes (39): metadata, metadata, metadata, metadata, features, AcademicClient(), priorityClass, typeLabel (+31 more)

### Community 1 - "Data Provider & Layout"
Cohesion: 0.09
Nodes (40): geistMono, geistSans, metadata, viewport, priorityBadge, priorityLabel, DataActions, DataContext (+32 more)

### Community 2 - "Package Dependencies"
Cohesion: 0.06
Nodes (33): ai, @ai-sdk/google, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, lucide-react, next (+25 more)

### Community 3 - "Project Docs & Concepts"
Cohesion: 0.09
Nodes (29): generate-agent-files.js, next/dist/docs guides, Next.js Agent Rules, CLAUDE.md @AGENTS.md include, AI_PROVIDER, API chat route, API classroom route, API plan route (+21 more)

### Community 4 - "TypeScript Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 5 - "Google Classroom Integration"
Cohesion: 0.14
Nodes (21): GET(), GET(), GET(), pickColor(), POST(), GET(), apiGet(), buildAuthUrl() (+13 more)

### Community 6 - "Build Tooling"
Cohesion: 0.08
Nodes (25): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+17 more)

### Community 7 - "shadcn UI Primitives"
Cohesion: 0.12
Nodes (18): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), CardAction(), CardFooter() (+10 more)

### Community 8 - "shadcn Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 9 - "App Shell & Auth"
Cohesion: 0.14
Nodes (12): AppShell(), handleSignOut(), navItems, Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader() (+4 more)

### Community 10 - "Auth & Feature Wiring"
Cohesion: 0.18
Nodes (11): LoginPage(), handleGoogle(), ClassroomConnect(), categoryStyles, PlanDelDia(), Button(), buttonVariants, isAiConfigured() (+3 more)

### Community 11 - "Data Entry Forms"
Cohesion: 0.26
Nodes (10): EMOJIS, COLORS, PRIORITIES, TYPES, CATEGORIES, fieldClass, inputClass, labelClass (+2 more)

### Community 12 - "AI Routes & Prompts"
Cohesion: 0.24
Nodes (10): maxDuration, POST(), maxDuration, planSchema, POST(), buildPlanPrompt(), SECRETARY_SYSTEM_PROMPT, getModel() (+2 more)

### Community 13 - "Secretary Chat UI"
Cohesion: 0.27
Nodes (6): messageText(), SecretaryChat(), suggestions, Input(), ScrollArea(), ScrollBar()

### Community 14 - "UI Utilities"
Cohesion: 0.22
Nodes (4): Label(), Progress(), Separator(), Textarea()

### Community 15 - "App Icon Assets"
Cohesion: 0.33
Nodes (7): Next.js Default Starter Asset Set, File UI Icon, Globe UI Icon, Next.js Logo Icon, Vercel Logo Icon, Window UI Icon, App Favicon (Sparkle)

### Community 16 - "Tabs Component"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

## Knowledge Gaps
- **136 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+131 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `shadcn UI Primitives` to `App Pages & Clients`, `Data Provider & Layout`, `App Shell & Auth`, `Auth & Feature Wiring`, `Data Entry Forms`, `Secretary Chat UI`, `UI Utilities`, `Tabs Component`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Package Dependencies` to `Build Tooling`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `Button()` connect `Auth & Feature Wiring` to `App Pages & Clients`, `shadcn UI Primitives`, `App Shell & Auth`, `Data Entry Forms`, `Secretary Chat UI`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _136 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Pages & Clients` be split into smaller, more focused modules?**
  _Cohesion score 0.075 - nodes in this community are weakly interconnected._
- **Should `Data Provider & Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.08599290780141844 - nodes in this community are weakly interconnected._
- **Should `Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._