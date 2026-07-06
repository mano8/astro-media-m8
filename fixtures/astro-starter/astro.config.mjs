import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import faMedia from "@mano8/astro-media-m8";

export default defineConfig({
  integrations: [
    react(),
    faMedia({
      mode: "starter",
      apiBase: "/media",
      v1Base: "/v1",
      auth: { provider: "none" },
      routes: {
        object: false
      }
    })
  ]
});
