// Deterministic reconstruction pipeline.
// For every in-scope captured page it: bundles the original Elementor CSS,
// copies fonts/images/frames verbatim, rewrites relative asset URLs and internal
// links, strips the builder JS runtime + SingleFile chrome, and emits the body
// markup as raw HTML that the React page renders through html-react-parser.
import { parse } from "node-html-parser";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "_source");
const PUB = path.join(ROOT, "public", "site");
const DATA = path.join(ROOT, "src", "data");

// captured dir -> { route, slug }
const PAGES = [
  { dir: "Home___33_Black", route: "/", slug: "home" },
  { dir: "About___33_Black", route: "/about-us/", slug: "about-us" },
  { dir: "Become_a_member___33_Black", route: "/become-a-member/", slug: "become-a-member" },
  { dir: "Listen___33_Black", route: "/listen/", slug: "listen" },
  { dir: "Upcoming_Events_____33_Black", route: "/events/", slug: "events" },
  { dir: "LYRICS___33_Black", route: "/lyrics/", slug: "lyrics" },
  { dir: "Contact___33_Black", route: "/contact/", slug: "contact" },
];

// internal page paths we serve as SPA routes
const ROUTES = new Set(PAGES.map((p) => p.route));

fs.mkdirSync(PUB, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    if (e.isDirectory()) n += copyDir(s, d);
    else { fs.copyFileSync(s, d); n++; }
  }
  return n;
}

// Quote unquoted HTML attribute values (tag-scoped) so a value ending in "/>"
// isn't mistaken for a self-closing tag. Already-quoted attrs are left alone.
function quoteAttrs(html) {
  return html.replace(/<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^<>"'])*)>/g, (m, tag, attrs) => {
    const fixed = attrs.replace(/(\s[a-zA-Z_:][\w:.-]*)=(?!["'])([^\s"'<>]+)/g, '$1="$2"');
    return "<" + tag + fixed + ">";
  });
}

// numeric-aware sort so stylesheet_2 < stylesheet_10 (original document order)
function numSort(a, b) {
  const na = +(a.match(/(\d+)/)?.[1] ?? 0);
  const nb = +(b.match(/(\d+)/)?.[1] ?? 0);
  return na - nb;
}

// Rewrite href="https://33.black/x/" (or /x/) that matches a served route -> route path.
function rewriteInternalLink(href) {
  if (!href) return href;
  let m = href.match(/^https?:\/\/(?:www\.)?33\.black(\/[^"']*)?$/i);
  let p = m ? (m[1] || "/") : (href.startsWith("/") && !href.startsWith("//") ? href : null);
  if (p == null) return href; // external / mailto / tel / hash
  // normalise trailing slash lookups
  const cand = p.endsWith("/") ? p : p + "/";
  if (ROUTES.has(cand)) return cand;
  if (ROUTES.has(p)) return p;
  return href; // internal but not a served route (e.g. /shop, wp-login) -> keep original
}

const manifest = [];

for (const pg of PAGES) {
  const dir = path.join(SRC, pg.dir);
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");

  // 1. bundle CSS: external stylesheet_*.css (doc order) + every inline <style>
  const cssFiles = fs.readdirSync(dir).filter((f) => /^stylesheet_\d+\.css$/.test(f)).sort(numSort);
  let css = cssFiles.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n\n");
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) css += "\n\n" + m[1];
  // neutralise Elementor entrance-invisibility (JS runtime is removed) so the
  // page matches its fully-loaded live appearance.
  css += `\n\n/* reconstruction overrides */
.elementor-invisible{opacity:1!important;visibility:visible!important;}
/* Self-contained mobile menu. The theme's own hamburger lives inside an
   .elementor-hidden-mobile section, so on phones it is display:none along with
   the desktop nav and the menu vanishes entirely. enhancePage() builds a
   .recon-mnav from the page's nav items and appends it; it shows only where the
   desktop nav is hidden (<=767px), matching the theme breakpoint. */
.recon-mnav{display:none;}
@media (max-width:767px){
  .recon-mnav{display:block;position:fixed;top:12px;right:12px;z-index:99999;}
  .recon-mnav-btn{display:block;width:46px;height:40px;padding:8px 7px;background:rgba(255,251,211,.9);border:0;border-radius:4px;cursor:pointer;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,.15);}
  .recon-mnav-btn span{display:block;width:100%;height:4px;margin-bottom:6px;background:#111111;border-radius:1px;transition:transform .3s ease,opacity .2s ease;}
  .recon-mnav-btn span:last-child{margin-bottom:0;}
  .recon-mnav-list{display:none;list-style:none;margin:8px 0 0;padding:0;position:absolute;top:100%;right:0;min-width:210px;box-shadow:0 8px 26px rgba(0,0,0,.22);}
  .recon-mnav.open .recon-mnav-list{display:block;}
  .recon-mnav-list li{margin:0;}
  .recon-mnav-list a{display:block;padding:12px 18px;background:#e4c74f;color:#ffffff;text-decoration:none;font-family:"Poppins",sans-serif;font-size:16px;border-bottom:.8px solid #e8e8e8;}
  .recon-mnav.open .recon-mnav-btn span:nth-child(1){transform:translateY(10px) rotate(45deg);}
  .recon-mnav.open .recon-mnav-btn span:nth-child(2){opacity:0;}
  .recon-mnav.open .recon-mnav-btn span:nth-child(3){transform:translateY(-10px) rotate(-45deg);}
}
`;

  const outDir = path.join(PUB, pg.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "page.css"), css);

  // 2. copy verbatim asset folders next to page.css so url(fonts/..)/url(images/..) resolve
  const nFonts = copyDir(path.join(dir, "fonts"), path.join(outDir, "fonts"));
  const nImgs = copyDir(path.join(dir, "images"), path.join(outDir, "images"));
  const nFrames = copyDir(path.join(dir, "frames"), path.join(outDir, "frames"));

  // 3. body element — node-html-parser flattens head/body, so slice the body
  // fragment textually and parse only that.
  const bOpen = html.match(/<body\b[^>]*>/i);
  const bStart = bOpen ? bOpen.index + bOpen[0].length : 0;
  const bEnd = html.toLowerCase().lastIndexOf("</body>");
  const bodyFragment = html.slice(bStart, bEnd === -1 ? undefined : bEnd);
  // SingleFile emits unquoted attribute values; node-html-parser then mis-reads
  // an unquoted value ending in "/>" (e.g. href=https://33.black/jointheband/)
  // as a self-closing tag and ejects the element's children. Quote unquoted
  // attribute values (tag-scoped) first so buttons/links keep their content.
  const body = parse(quoteAttrs(bodyFragment), { comment: false });
  // strip builder runtime + capture chrome
  body.querySelectorAll("script,noscript,link,template").forEach((n) => n.remove());
  body.querySelectorAll('[class*="single-file"],[id*="single-file"],[class*="singlefile"]').forEach((n) => n.remove());
  // capture-only cruft: Unyson framework flash message from a failed server-side
  // include during capture (never present on the live site).
  body.querySelectorAll(".fw-flash-messages").forEach((n) => n.remove());
  // SingleFile captured at desktop width force-hid the mobile nav (sf-hidden).
  // Un-hide ONLY that subtree so the site's own 767px responsive CSS can show
  // the hamburger on phones; other sf-hidden nodes stay as captured.
  body.querySelectorAll(".wpr-mobile-nav-menu-container, .wpr-mobile-nav-menu-container *").forEach((n) => {
    if (n.classList && n.classList.contains("sf-hidden")) n.classList.remove("sf-hidden");
  });
  // Note: the Events page's decorative "33BLACK" logo band lives in a two-widget
  // Elementor responsive setup whose desktop variant SingleFile captured empty
  // (sf-hidden). It is left as captured rather than reconstructed from the mobile
  // variant, which would render at the wrong size — see README known differences.

  const base = `/site/${pg.slug}`;

  // Resolve captured iframes (SingleFile saved their inner page under frames/N)
  // back to their real origin embed URL so video actually plays. Media stays on
  // the origin (Vimeo/YouTube), per the media rule.
  for (const frame of body.querySelectorAll("iframe")) {
    const src = frame.getAttribute("src") || "";
    const fm = src.match(/frames\/(\d+)\//);
    if (!fm) continue;
    const framePath = path.join(dir, "frames", fm[1], "index.html");
    let realSrc = "";
    if (fs.existsSync(framePath)) {
      const fh = fs.readFileSync(framePath, "utf8");
      const vimeo = fh.match(/player\.vimeo\.com\/video\/(\d+)/);
      const yt = fh.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]+)/);
      const isBg = (frame.getAttribute("class") || "").includes("elementor-background-video-embed");
      if (vimeo) {
        realSrc = isBg
          ? `https://player.vimeo.com/video/${vimeo[1]}?background=1&autoplay=1&loop=1&muted=1&app_id=58479`
          : `https://player.vimeo.com/video/${vimeo[1]}`;
      } else if (yt) {
        realSrc = isBg
          ? `https://www.youtube.com/embed/${yt[1]}?autoplay=1&loop=1&mute=1&controls=0&playlist=${yt[1]}`
          : `https://www.youtube.com/embed/${yt[1]}`;
      }
    }
    if (realSrc) frame.setAttribute("src", realSrc);
  }

  const rewriteUrlToken = (u) => {
    let s = u.trim().replace(/^['"]|['"]$/g, "");
    if (/^(https?:|data:|blob:|#|mailto:|tel:|\/site\/)/i.test(s)) return s;
    if (/^(fonts|images|frames)\//.test(s)) return `${base}/${s}`;
    return s;
  };

  for (const el of body.querySelectorAll("*")) {
    for (const attr of ["src", "data-src", "poster"]) {
      const v = el.getAttribute(attr);
      if (v && /^(fonts|images|frames)\//.test(v.trim())) el.setAttribute(attr, rewriteUrlToken(v));
    }
    for (const attr of ["srcset", "data-srcset"]) {
      const v = el.getAttribute(attr);
      if (v && /(fonts|images|frames)\//.test(v)) {
        el.setAttribute(attr, v.split(",").map((part) => {
          const [url, ...rest] = part.trim().split(/\s+/);
          return [rewriteUrlToken(url), ...rest].join(" ");
        }).join(", "));
      }
    }
    const href = el.getAttribute("href");
    if (href) {
      if (/^(fonts|images|frames)\//.test(href.trim())) el.setAttribute("href", rewriteUrlToken(href));
      else if (el.tagName === "A") el.setAttribute("href", rewriteInternalLink(href));
    }
    const style = el.getAttribute("style");
    if (style && /url\(\s*['"]?(fonts|images|frames)\//.test(style)) {
      el.setAttribute("style", style.replace(/url\(\s*(['"]?)(fonts|images|frames)\/([^)'"]+)\1\s*\)/g,
        (_m, q, folder, rest) => `url(${q}${base}/${folder}/${rest}${q})`));
    }
  }

  // (The mobile menu is built at runtime by enhancePage as a self-contained
  // .recon-mnav, because the theme's own hamburger is trapped inside an
  // .elementor-hidden-mobile section and never shows on phones.)

  let bodyHtml = body.innerHTML;
  fs.writeFileSync(path.join(DATA, `${pg.slug}.html`), bodyHtml);

  // capture <html> and <body> tag attributes (theme/Elementor CSS targets them,
  // e.g. body background colour and per-page elementor-page-* selectors).
  const htmlTag = html.match(/<html\b([^>]*)>/i)?.[1] || "";
  const bodyTag = bOpen?.[0] || "";
  const attrOf = (tag, name) => tag.match(new RegExp(`${name}=("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  const grab = (tag, name) => { const m = attrOf(tag, name); return m ? (m[2] ?? m[3] ?? m[4] ?? "") : ""; };
  pg._htmlClass = grab(htmlTag, "class");
  pg._bodyClass = grab(bodyTag, "class");
  pg._bodyId = grab(bodyTag, "id");
  pg._bodyStyle = grab(bodyTag, "style");

  // diagnostics: internal links still pointing off-route
  const internal = [...new Set([...bodyHtml.matchAll(/href="(https?:\/\/(?:www\.)?33\.black[^"]*|\/[^"/][^"]*)"/g)].map((m) => m[1]))];
  manifest.push({ slug: pg.slug, route: pg.route, title: pg.dir, htmlClass: pg._htmlClass, bodyClass: pg._bodyClass, bodyId: pg._bodyId, bodyStyle: pg._bodyStyle });
  console.log(`\n[${pg.slug}] css=${cssFiles.length} fonts=${nFonts} images=${nImgs} frames=${nFrames} body=${(bodyHtml.length/1024|0)}KB`);
  console.log("  internal links:", internal.slice(0, 12).join("  ") || "(none)");
}

fs.writeFileSync(path.join(DATA, "pages.json"), JSON.stringify(manifest, null, 2));
console.log("\nDONE. pages:", manifest.length);
