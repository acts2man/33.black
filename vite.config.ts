import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static assets (captured CSS, fonts, images) live under /public/site and are
// served verbatim so the original Elementor stylesheets resolve their own
// relative url(fonts/..) / url(images/..) references without rewriting.
export default defineConfig({
  plugins: [react()],
  server: { port: 5233 },
});
