import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// DEC-001 scaffold only: this proves the admin SPA bundle builds to
// public/admin/. The real admin screens and routing (react-router-dom) are a
// later task's scope and are deliberately not designed here.
const root = document.getElementById("root");
if (!root) {
  throw new Error("admin SPA mount point #root missing from index.html");
}

createRoot(root).render(
  <StrictMode>
    <h1>Chautauqua Admin</h1>
  </StrictMode>,
);
