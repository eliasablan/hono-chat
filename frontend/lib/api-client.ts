import { hc } from "hono/client";
import type { AppType } from "../../backend/src/app";

export const apiClient = hc<AppType>("http://localhost:8787");
