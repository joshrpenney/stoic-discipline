import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages hosts the production app under /stoic-discipline/.
// Cloudflare Pages hosts this test build at the origin root.
const base = process.env.CF_PAGES ? "/" : "/stoic-discipline/";

export default defineConfig({
  plugins: [react()],
  base
});
