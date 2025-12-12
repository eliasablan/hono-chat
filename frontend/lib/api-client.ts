import { hc } from "hono/client";
import type { AppType } from "@backend/app";

const baseUrl =
  process.env.NODE_ENV === "production" ? "" : process.env.NEXT_PUBLIC_API_URL!;

export const apiClient = hc<AppType>(baseUrl);
