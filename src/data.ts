import manifest from "./data/pages.json";

// Raw captured body markup for every route (loaded verbatim, rendered as real
// React elements via html-react-parser).
const raw = import.meta.glob("./data/*.html", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type PageMeta = {
  slug: string;
  route: string;
  title: string;
  htmlClass: string;
  bodyClass: string;
  bodyId: string;
  bodyStyle: string;
};

export const PAGES = manifest as PageMeta[];

export function bodyHtml(slug: string): string {
  return raw[`./data/${slug}.html`] ?? "";
}
