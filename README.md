# 33 Black — website reconstruction

A faithful React reconstruction of **https://33.black/** (an Elementor / Sonaar
WordPress site for the alt-rock band 33 Black).

The goal was an **exact** reproduction — fonts, spacing, colours, sections and
copy identical to the live site — so rather than re-author the design by hand
(which drifts for an Elementor site), each page's original generated CSS, fonts
and images are reused verbatim and the captured DOM is rendered as real React
elements. The page-builder JavaScript runtime is **not** shipped; the few
behaviours that need JS (mobile hamburger menu, entrance-animation visibility)
are re-implemented in a handful of lines.

## Stack

- React + TypeScript + Vite
- `react-router-dom` for client-side routing (SPA)
- `html-react-parser` to turn each captured page body into real React nodes
- Original Elementor/Sonaar CSS, fonts (Highline, Laredo, Palmer, Poppins,
  Font Awesome) and images served verbatim from `public/site/<page>/`

## Routes

| Route | Page |
|---|---|
| `/` | Home (featured music, new single, video) |
| `/about-us/` | About |
| `/become-a-member/` | Members / Join the band |
| `/listen/` | Listen |
| `/events/` | Upcoming Events (The Events Calendar) |
| `/lyrics/` | Lyrics |
| `/contact/` | Contact |

The **Shop** nav item links to the band's external Spring store, and
Members-area / login / privacy / terms links point at the live origin (those
pages were out of scope and were not captured). `/wp-login.php` (WordPress
admin) is intentionally excluded.

## Project layout

```
_source/            original SingleFile captures (git-ignored, not shipped)
scripts/extract.mjs deterministic pipeline: bundles each page's CSS, copies
                    fonts/images, rewrites asset URLs + internal links, strips
                    the builder runtime + capture cruft, rebuilds the mobile menu
src/data/*.html     extracted page bodies (rendered via html-react-parser)
src/data/pages.json per-page route + <html>/<body> classes
public/site/<page>/ page.css + fonts/ + images/ + frames/ (served verbatim)
src/App.tsx         routes + internal-link interception
src/Page.tsx        applies body classes, swaps the page stylesheet, renders body
src/enhance.ts      mobile menu toggle (WPR hamburger) + fallbacks
```

## Develop

```bash
npm install
npm run extract   # (re)build src/data + public/site from _source captures
npm run dev       # http://localhost:5233
```

## Build & deploy

```bash
npm run build     # type-check + vite build -> dist/
```

Deploys to Netlify (`netlify.toml`) with an SPA fallback so every route serves
the app. Media (video/audio) stays pointed at the origin server.

## Known differences from live

- **Events page** has a large decorative "33BLACK" page-title band on the live
  site. In the capture that block was empty and flagged `sf-hidden` (SingleFile
  strips desktop-hidden regions), so it is not reproduced. All event content
  (search, list/month/day, past events) is present.
- **Contact** and **Listen** show sparse/empty content areas — this matches the
  live site, where the contact form and listen embeds render empty.
- The mobile menu is a small self-contained hamburger (`.recon-mnav`, built at
  runtime in `enhance.ts`) styled to match the live menu (gold items, white
  text, Poppins). The theme's own mobile menu is nested inside an
  `elementor-hidden-mobile` section, so on the live site it is hidden along with
  the desktop nav and the menu vanishes on phones — this reconstruction fixes
  that so the menu is reachable at every width.
- Entrance animations replay on page load (each element's original Elementor
  animation is re-triggered once) rather than on scroll. Elements are never
  pre-hidden, so content can never be left invisible.
