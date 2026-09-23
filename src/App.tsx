import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Page from "./Page";
import { PAGES, type PageMeta } from "./data";
import { ensureCss } from "./css";

function matchMeta(pathname: string): PageMeta {
  const withSlash = pathname.endsWith("/") ? pathname : pathname + "/";
  return (
    PAGES.find((p) => p.route === withSlash) ||
    PAGES.find((p) => p.route === pathname) ||
    PAGES[0]
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const target = matchMeta(location.pathname);

  // `rendered` lags `target` until the target page's stylesheet has loaded, so
  // navigation never paints a page before its CSS is ready (no FOUC / glitch).
  const [rendered, setRendered] = useState<PageMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureCss(target.slug).then(() => {
      if (!cancelled) setRendered(target);
    });
    return () => { cancelled = true; };
  }, [target.slug]);

  // Intercept clicks on internal <a> (rendered from the captured markup) so
  // same-site navigation stays client-side; external links behave normally.
  useEffect(() => {
    const routes = new Set(PAGES.map((p) => p.route));
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      const path = href.startsWith("/") && !href.startsWith("//") ? href : null;
      if (!path) return;
      const withSlash = path.endsWith("/") ? path : path + "/";
      if (routes.has(withSlash) || routes.has(path)) {
        e.preventDefault();
        navigate(routes.has(withSlash) ? withSlash : path);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate]);

  if (!rendered) return null; // brief, styled by the base background in index.html
  return <Page meta={rendered} />;
}
