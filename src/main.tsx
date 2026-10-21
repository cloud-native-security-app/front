import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import "./index.css";
import { initTheme } from "./theme";

initTheme();

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("No se encontró el elemento #root en index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
