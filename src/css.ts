// Per-page stylesheet loader. Each page ships the original Elementor/Sonaar CSS
// (~0.5 MB). To avoid a flash of unstyled content when navigating, the page swap
// is gated on the target stylesheet finishing loading (see App).

export function ensureCss(slug: string): Promise<void> {
  const existing = document.querySelector<HTMLLinkElement>(`link[data-page-css="${slug}"]`);
  if (existing) {
    if (existing.dataset.loaded === "1") return Promise.resolve();
    return new Promise((res) => {
      existing.addEventListener("load", () => res(), { once: true });
      existing.addEventListener("error", () => res(), { once: true });
    });
  }
  return new Promise((res) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/site/${slug}/page.css`;
    link.dataset.pageCss = slug;
    const done = () => { link.dataset.loaded = "1"; res(); };
    link.addEventListener("load", done, { once: true });
    link.addEventListener("error", done, { once: true });
    document.head.appendChild(link);
  });
}

// Remove every page stylesheet except the one in use (called after the swap, so
// the outgoing page's CSS is dropped only once the new page is on screen).
export function pruneCss(keepSlug: string): void {
  document.querySelectorAll<HTMLLinkElement>("link[data-page-css]").forEach((l) => {
    if (l.dataset.pageCss !== keepSlug) l.remove();
  });
}
