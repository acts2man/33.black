import { useEffect, useLayoutEffect, useRef } from "react";
import parse from "html-react-parser";
import { bodyHtml, PAGES, type PageMeta } from "./data";
import { enhancePage } from "./enhance";
import { ensureCss, pruneCss } from "./css";

export default function Page({ meta }: { meta: PageMeta }) {
  const ref = useRef<HTMLDivElement>(null);

  // Apply the captured <html>/<body> classes (theme/Elementor selectors, page
  // background, per-page rules) and drop other pages' stylesheets. App has
  // already loaded this page's CSS before rendering it, so no flash here.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.className;
    const prevBody = body.className;
    ensureCss(meta.slug);
    pruneCss(meta.slug);
    html.className = meta.htmlClass;
    body.className = meta.bodyClass;
    if (meta.bodyStyle) body.setAttribute("style", meta.bodyStyle);
    window.scrollTo(0, 0);
    return () => {
      html.className = prevHtml;
      body.className = prevBody;
      if (meta.bodyStyle) body.removeAttribute("style");
    };
  }, [meta.slug]);

  useEffect(() => enhancePage(ref.current), [meta.slug]);

  return <div ref={ref}>{parse(bodyHtml(meta.slug))}</div>;
}

export { PAGES };
