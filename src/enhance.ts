// Progressive enhancement for the reconstructed pages. The Elementor / Sonaar JS
// runtime is intentionally NOT shipped; the few behaviours that matter are
// re-implemented here.

const ANIMATIONS = new Set([
  "fadeIn", "fadeInUp", "fadeInDown", "fadeInLeft", "fadeInRight",
  "fadeInUpBig", "fadeInDownBig", "fadeInLeftBig", "fadeInRightBig",
  "zoomIn", "zoomInUp", "zoomInDown", "zoomInLeft", "zoomInRight",
  "slideInUp", "slideInDown", "slideInLeft", "slideInRight",
  "bounceIn", "bounceInUp", "bounceInDown", "bounceInLeft", "bounceInRight",
  "bounce", "flash", "pulse", "rubberBand", "shake", "swing", "tada", "wobble",
  "lightSpeedIn", "rotateIn", "rollIn", "flipInX", "flipInY",
]);

// Canonical nav (fallback for pages whose header has no desktop menu, e.g. Events).
const NAV: Array<[string, string]> = [
  ["Home", "/"], ["About", "/about-us/"], ["Members", "/become-a-member/"],
  ["Listen", "/listen/"], ["Events", "/events/"], ["LYRICS", "/lyrics/"],
  ["Shop", "https://33-black-2.creator-spring.com/"], ["Contact", "/contact/"],
];

export function enhancePage(root: HTMLElement | null): () => void {
  if (!root) return () => {};
  const disposers: Array<() => void> = [];

  // --- Entrance animations (replay Elementor's on-scroll reveal) ---
  // Elements are only ever hidden while actively animating in; if an observer
  // callback is missed, content stays visible (never stuck invisible).
  // Retrigger each element's Elementor entrance animation once, on load. The
  // capture froze elements in the finished ".animated <name>" state; removing the
  // classes, forcing a reflow and re-adding them replays the animation. We never
  // set opacity:0 ourselves and every entrance animation ends at opacity:1 (and
  // the base opacity is 1), so content can never be left stuck/hidden.
  root.querySelectorAll<HTMLElement>(".animated").forEach((el) => {
    if (el.dataset.reconAnim) return; // already replayed (dev re-invoke)
    const anim = [...el.classList].find((c) => ANIMATIONS.has(c));
    if (!anim) return;
    el.dataset.reconAnim = anim;
    el.classList.remove("animated", anim);
    void el.offsetWidth; // reflow so the animation restarts
    el.classList.add("animated", anim);
  });

  // --- Self-contained mobile menu ---
  const items = (() => {
    const src = root.querySelectorAll<HTMLAnchorElement>(".wpr-nav-menu > li > a, .wpr-nav-menu li a");
    if (src.length) {
      const seen = new Set<string>();
      const list: Array<[string, string]> = [];
      src.forEach((a) => {
        const label = a.textContent?.trim() || "";
        const href = a.getAttribute("href") || "#";
        if (label && !seen.has(label)) { seen.add(label); list.push([label, href]); }
      });
      return list.length ? list : NAV;
    }
    return NAV;
  })();

  const nav = document.createElement("nav");
  nav.className = "recon-mnav";
  nav.setAttribute("aria-label", "Mobile menu");
  nav.innerHTML =
    `<button class="recon-mnav-btn" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>` +
    `<ul class="recon-mnav-list">${items
      .map(([label, href]) => `<li><a href="${href}">${label}</a></li>`)
      .join("")}</ul>`;
  document.body.appendChild(nav);
  const btn = nav.querySelector<HTMLButtonElement>(".recon-mnav-btn")!;
  const onToggle = (e: Event) => {
    e.preventDefault();
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  };
  btn.addEventListener("click", onToggle);
  // close after choosing a destination
  const onPick = (e: Event) => {
    if ((e.target as HTMLElement).closest("a")) nav.classList.remove("open");
  };
  nav.addEventListener("click", onPick);
  disposers.push(() => { btn.removeEventListener("click", onToggle); nav.remove(); });

  return () => disposers.forEach((d) => d());
}
