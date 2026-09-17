import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { StartClient } from "@tanstack/react-start/client";
import { isStaticPages } from "@/lib/static-pages";
import { getRouter } from "./router";

startTransition(() => {
  if (isStaticPages) {
    const el = document.getElementById("app");
    if (!el) throw new Error("Cha Caddy Pages shell is missing #app.");
    createRoot(el).render(
      <StrictMode>
        <RouterProvider router={getRouter()} />
      </StrictMode>,
    );
    return;
  }
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
