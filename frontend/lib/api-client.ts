import { hc } from "hono/client";
import type { AppType } from "@backend/app";

const baseUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8787");

export const apiClient = hc<AppType>(baseUrl, {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      return await fetch(input, init);
    } catch {
      throw new Error(
        "No se pudo conectar con el servidor. Verifica tu conexión.",
      );
    }
  },
});
