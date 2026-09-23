# CLAUDE.md — Website Reconstruction (React)

**How to use:** copy this file into the project folder. Say: **"Rebuild https://example.com. Follow CLAUDE.md."**
Nothing in this file needs editing.

This file exists because a previous reconstruction took 8+ hours instead of 1. Every rule below prevents a
specific failure that actually happened. Follow it literally.

---

## INPUTS

Take these from whatever the user said. **Use the default for anything they didn't mention. Do not ask.**

| Input | Default if unsaid |
|---|---|
| Reference URL | the URL in their message — required, ask only if there isn't one |
| Local source | any zips/exports/HTML already in the folder; otherwise work from the live site |
| Routes | discover from sitemap + nav + internal links |
| Stack | React + TypeScript + Vite + CSS modules + a global tokens file |
| Host | Netlify — write the config with SPA fallback + every redirect found |
| Forms | Netlify Forms, same field names as the original, real states, never a fake success |
| Media (video/audio) | **stays on the origin server — see Rule 1** |
| Images | copy locally |
| Viewports | 1440×1000, 768×1024, 390×844 |
| Out-of-scope routes | exclude unlinked leftovers (theme demos, unused shop, demo blog) → 404. Tell the user, don't wait for an answer. |
| Copy, branding, URLs, phone/address/email, image choices | never change them |

---

## THE CLOCK — a hard requirement, not a guideline

| Phase | Budget | Output |
|---|---|---|
| 1. Inventory | 10 min | `inventory/pages/*.json`, `INVENTORY.md` (terse) |
| 2. Scaffold | 5 min | routing, tokens, fonts, global CSS, images copied, host config |
| 3. Build | 30 min | 4 parallel agents, all pages |
| 4. QA | 10 min | 3 viewports vs live, fix Critical/High only |
| 5. Repo | 5 min | commit + push |
| **Total** | **60 min** | reviewed, running site |

**Scale the Build phase only.** Under 8 routes → 20 min. Over 20 routes or 4+ templates → 45 min.
Everything else stays fixed.

**Checkpoint at 30 minutes.** State what's done, what's left, and whether you'll make 60. If you'll miss it,
say so then — not at the end. Missing an estimate is fine. Discovering it late is not.

---

## HARD RULES

### 1. NEVER DOWNLOAD MEDIA. EVER.

Video and audio stay pointed at the origin server. No exceptions, no "just this one", no background job.

Create `src/data/mediaSrc.ts` on day one:

```ts
const ORIGIN = "https://example.com";
/** Media is served from the origin. Migrate to local/CDN at cutover, not during the build. */
export const media = (path: string) => `${ORIGIN}${path}`;
```

Every `<video>`/`<audio>` src goes through it. One constant to change at cutover.

**Why:** a previous project pulled 1.6 GB from a host serving 33 KB/s. It cost ~2 hours, corrupted 9 files
through a bad resume loop, and none of it could be committed anyway (GitHub rejects files >100 MB).
Self-hosting media later is a **separate task the user schedules**, after the site ships.

Images are different: small, needed for layout, copy them locally. If the source uses a CDN
(`i0.wp.com`, `cdn.shopify.com`), strip the CDN prefix and query string to get the original URL, and fetch
**only** ones not already local. Cap the whole image fetch at 5 minutes; use what you have when the cap hits.

### 2. No orchestration ceremony

- **Never** put one agent in front of everything. A serial gate blocks all parallelism.
- **Never** run multi-round critic/verification loops. One QA pass.
- **Never** spawn more than 5 agents total.
- Scout inline yourself first (list files, read the sitemap, grep the HTML). Delegate only the parallel build.

### 3. Write the boring parts yourself

Inventory scripts, scaffolding, config, data files: write these directly. Faster than briefing an agent.
Agents are for the 4 parallel page builds and one QA pass. Nothing else.

### 4. Build agents measure for 5 minutes, maximum

Every agent prompt ends with: *"Spend at most 5 minutes measuring the live page, then write code. Do not read
more source CSS after that — make it look right and move on."* Without this they read for 25 minutes.

### 5. Preserve content exactly

Verbatim copy including typos. Original images, crops, aspect ratios. All states: dropdowns, drawers,
carousels, hover, focus, breakpoint-hidden variants. No `dangerouslySetInnerHTML` for whole pages. No
screenshot-as-background. No page-builder runtime (Elementor, Divi, Slider Revolution, WPBakery) in the output.

---

## PHASE 1 — INVENTORY (10 min)

Do this yourself, with scripts. No agents.

1. If given exports: unzip them. Check each manifest's `originalUrl` — **zip filenames lie**. Name folders
   from the real URL, not the zip.
2. Fetch the sitemap (`/sitemap.xml`, `/wp-sitemap.xml`, `/sitemap_index.xml`) and `robots.txt`.
   Status-check every candidate route: `curl -o /dev/null -w "%{http_code} %{num_redirects}"`.
3. Write ONE cheerio script dumping per page: title, header nav (labels + hrefs + dropdown children),
   footer columns, sections in document order (kind, headings, paragraphs, images with dimensions, buttons,
   videos, forms, background images), breakpoint-hidden elements, external links, tel/mailto.
4. Extract design tokens: `:root` variables, body font/size/line-height, heading rules, breakpoints,
   container max-widths.
5. Write `INVENTORY.md`: routes table, page families, header/footer content, per-page section lists, asset
   counts, form fields, interactions, redirects. **One page per topic. Not an essay.**

**Gotchas that cost real time before:**
- Exports captured at desktop width have mobile-only content stripped (SingleFile marks it `sf-hidden`).
  Fetch the live HTML too and merge; that's where the mobile drawer and form hidden inputs live.
- A page whose `<title>` is "Home" may not be the homepage. Trust `originalUrl`.
- Loaded ≠ used. A slider plugin's CSS can load with no slider on the page. Grep the rendered DOM before
  building a carousel that doesn't exist.

## PHASE 2 — SCAFFOLD (5 min)

`npm create vite@latest . -- --template react-ts`, then write directly:

- `src/styles/tokens.css` — measured colors, fonts, spacing, breakpoints, z-index layers
- `src/styles/global.css` — reset, body, headings, `.container`, focus-visible, `prefers-reduced-motion`
- `src/styles/fonts.css` — `@font-face` for local fonts; Google Fonts link in `index.html` for the rest
- `src/data/site.ts` — contact details, nav tree, social, badges. Single source of truth.
- `src/data/mediaSrc.ts` — see Rule 1
- `src/App.tsx` — all routes, trailing-slash canonicalization, scroll reset, redirects
- Placeholder components so the tree type-checks before agents start
- Host config with SPA fallback + every redirect found
- Copy images to `public/`; **skip video entirely**

Verify `npx tsc -b` passes before launching agents.

## PHASE 3 — BUILD (30 min, 4 agents in parallel)

Strict file ownership, no overlaps:

| Agent | Owns |
|---|---|
| **shell** | `components/layout/**` (header, nav, dropdowns, mobile drawer, footer), `components/ui/Button`, `components/ui/Icon` |
| **home** | `pages/HomePage`, `components/home/**`, `data/home.ts` |
| **template** | the repeated page family (service/product/article) + its data file, shared media components |
| **pages** | remaining standalone pages (about, contact, legal, 404) + all forms |

Each prompt must contain: the inventory path, the page JSON path, the asset map, its own dev-server port,
the 5-minute measuring cap, its file ownership list, and "run `npx tsc -b` before returning."

The shell agent creates `Button` and `Icon` first so others can import them. Others build a local fallback
if it isn't there yet and swap at the end.

## PHASE 4 — QA (10 min)

Screenshot every route at all 3 viewports against the live site. Check: page height within ~20 px, section
order, fonts, container width, no horizontal overflow at 320/375/390, no console errors, no broken images,
every link resolves, forms validate without faking success.

Ledger: Route | Viewport | Region | Mismatch | Severity | Fix | Verified.

**Fix Critical and High only.** Missing sections, wrong fonts, broken mobile menu and horizontal overflow are
High. A 6 px offset is Low — write it down, don't chase it.

## PHASE 5 — REPO (5 min)

`.gitignore` must exclude, **before the first commit**: `node_modules`, `dist`, source exports, original
assets, QA screenshots (`qa/**/*.png`), and all video. Check for files >50 MB before committing; GitHub
hard-rejects over 100 MB. Scan for secrets. Write a real README. Commit, then ask for the remote URL if
there's no `gh` CLI.

---

## PLATFORM GOTCHAS (Windows / Git Bash)

- **Don't write files with bash heredocs.** Quoting breaks on long content. Use the Write tool.
- **Don't put regex in `node -e` inside bash.** The shell mangles it. Write a `.js` file and run it.
- If you must download anything: **never `curl -C -`**. Some servers answer a resume with a full 200 body and
  curl appends it, silently corrupting the file. Use explicit `-r start-end`, verify against `Content-Length`,
  and probe the result before trusting it.
- Never `sleep`/`Start-Sleep` to wait on a background job. Use the background-task mechanism.
- Check `PIPESTATUS[0]` when piping a command whose exit code matters (`npx tsc -b 2>&1 | tail`).

---

## COMMUNICATION

- Say what you're doing before a long step, and report when it finishes.
- **When a deliverable the user asked for is done, say it's done and say what you're moving to.** Never keep
  working silently on adjacent work — the user can't see tool calls and will assume you're stuck.
- Report in minutes, not hours. Numbers, not adjectives.
- Don't claim something works because a path resolves. Verify the artifact itself.

---

## DONE MEANS

Every route renders and every link resolves. Content complete and verbatim. Images load with correct crops.
Desktop, tablet and mobile match the reference. Interactions work by mouse, keyboard and touch. Type-check,
lint and production build pass. No console errors. Forms submit for real or the limitation is documented.
Remaining differences listed concretely — no invented percentage scores.

## DO NOT

Redesign it · simplify a hard section · guess mobile from desktop · substitute fonts silently ·
ship builder runtime · fake form success · download media · run critic loops · build a 20-agent pipeline ·
claim "98% match" · report done without screenshots
