// Mail configuration status API (DEC-996 amendment, wave 43). Route files
// export a named Hono sub-app; only src/index.ts mounts it (DEC-012). This
// surfaces mailConfigStatus so a missing key is discoverable without a
// 500 -- never echoes the key itself.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { mailConfigStatus } from "../../server/env";
import { requireOrganizer } from "../../server/middleware";

export const mailStatusRoutes = new Hono<AppEnv>();

// GET /api/v1/mail-status
mailStatusRoutes.get("/mail-status", requireOrganizer, async (c) => {
  const status = mailConfigStatus(c.env);
  return c.json(status);
});
