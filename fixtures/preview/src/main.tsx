import * as React from "react";
import { createRoot } from "react-dom/client";

import { installServiceStub } from "./service-stub.js";
import { PreviewApp } from "./preview-app.js";
import "./preview.css";

// Installed before the first render so no view can reach the real network,
// even briefly.
installServiceStub();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element for the astro-media-m8 preview fixture");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>
);
