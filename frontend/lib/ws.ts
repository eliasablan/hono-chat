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
    process.env.NODE_ENV === "production"
      ? fallbackWsUrl
      : "ws://localhost:8787/ws";
  const ws = new WebSocket(url);
  const pending: ClientToServerEvent[] = [];
  let isOpen = false;

  ws.addEventListener("open", () => {
    isOpen = true;
    while (pending.length > 0) {
      const ev = pending.shift();
      if (ev) ws.send(JSON.stringify(ev));
    }
  });

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data) as ServerToClientEvent;
    onEvent(data);
  };

  function send(ev: ClientToServerEvent) {
    if (isOpen && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(ev));
      return;
    }

    pending.push(ev);
  }

  function close() {
    pending.length = 0;
    ws.close();
  }

  return { send, close };
}
