import type {
  ServerToClientEvent,
  ClientToServerEvent,
} from "@backend/contracts/events";

const fallbackWsUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${
        window.location.host
      }/ws`
    : "ws://localhost:8787/ws";

export function connectChatWS(onEvent: (ev: ServerToClientEvent) => void): {
  send: (ev: ClientToServerEvent) => void;
  close: () => void;
} {
  const url =
    process.env.NEXT_PUBLIC_WS_URL ||
    (process.env.NODE_ENV === "production"
      ? fallbackWsUrl
      : "ws://localhost:8787/ws");

  let ws: WebSocket | null = null;
  const pending: ClientToServerEvent[] = [];
  let stickyJoin: ClientToServerEvent | null = null;
  let joinSentForSocket = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closedByClient = false;

  function flush() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (stickyJoin && !joinSentForSocket) {
      try {
        ws.send(JSON.stringify(stickyJoin));
        joinSentForSocket = true;
      } catch {
        pending.unshift(stickyJoin);
        return;
      }
    }

    while (pending.length > 0) {
      const ev = pending.shift();
      if (!ev) continue;

      if (
        stickyJoin?.type === "join-room" &&
        ev.type === "join-room" &&
        ev.roomId === stickyJoin.roomId
      ) {
        continue;
      }

      try {
        ws.send(JSON.stringify(ev));
      } catch {
        pending.unshift(ev);
        try {
          ws.close();
        } catch {}
        return;
      }
    }
  }

  function scheduleReconnect() {
    if (closedByClient) return;
    if (reconnectTimer) return;

    const baseDelayMs = 500;
    const maxDelayMs = 30_000;
    const exponentialDelay = Math.min(
      baseDelayMs * 2 ** reconnectAttempt,
      maxDelayMs,
    );
    const jitter = Math.floor(Math.random() * 250);
    const delay = exponentialDelay + jitter;

    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (closedByClient) return;
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    ws = new WebSocket(url);
    joinSentForSocket = false;

    ws.addEventListener("open", () => {
      reconnectAttempt = 0;
      flush();
    });

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data) as unknown;
        if (!data || typeof data !== "object") return;

        const type = (data as { type?: unknown }).type;
        if (type === "error") {
          console.error("WS server error:", data);
          return;
        }

        onEvent(data as ServerToClientEvent);
      } catch (error) {
        console.error("WS message parse error:", error);
      }
    });

    ws.addEventListener("close", () => {
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      scheduleReconnect();
    });
  }

  connect();

  function send(ev: ClientToServerEvent) {
    if (ev.type === "join-room") {
      stickyJoin = ev;
      joinSentForSocket = false;
    }
    if (
      ev.type === "leave-room" &&
      stickyJoin?.type === "join-room" &&
      stickyJoin.roomId === ev.roomId
    ) {
      stickyJoin = null;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      if (stickyJoin && !joinSentForSocket && ev.type !== "join-room") {
        pending.push(ev);
        flush();
        return;
      }

      try {
        ws.send(JSON.stringify(ev));
        if (ev.type === "join-room") joinSentForSocket = true;
        return;
      } catch {
        pending.push(ev);
        try {
          ws.close();
        } catch {}
        return;
      }
    }

    pending.push(ev);
    connect();
  }

  function close() {
    closedByClient = true;
    pending.length = 0;
    stickyJoin = null;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    try {
      ws?.close();
    } catch {}
  }

  return { send, close };
}
