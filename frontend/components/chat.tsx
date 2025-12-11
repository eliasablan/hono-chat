"use client";

import { useEffect, useState } from "react";
import type { ClientToServerEvent } from "@shared/schemas/events";
import type { MessageDTO } from "@shared/schemas/chat";
import { connectChatWS } from "@/lib/ws";
import { apiClient } from "@/lib/api-client";

export function Chat({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [content, setContent] = useState("");

  useEffect(() => {
    // cargar historial inicial desde HTTP
    apiClient.api.rooms[":roomId"].messages
      .$get({ param: { roomId } })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as MessageDTO[];
        setMessages(data);
      });

    const { send, close } = connectChatWS((ev) => {
      if (ev.type === "message-created") {
        setMessages((prev) => [...prev, ev.message]);
      }
    });

    const joinEvent: ClientToServerEvent = {
      type: "join-room",
      roomId,
    };
    send(joinEvent);

    return () => {
      const leaveEvent: ClientToServerEvent = {
        type: "leave-room",
        roomId,
      };
      send(leaveEvent);
      close();
    };
  }, [roomId]);

  const handleSend = () => {
    if (!content.trim()) return;
    const ev: ClientToServerEvent = {
      type: "send-message",
      roomId,
      content,
    };

    const { send } = connectChatWS(() => {});
    send(ev);
    setContent("");
  };

  return (
    <main>
      <h1>Chat Room</h1>
      <div>
        {messages.map((m) => (
          <div key={m.id}>
            <strong>{m.authorId}</strong>: {m.content}
          </div>
        ))}
      </div>
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Escribe un mensaje..."
      />
      <button onClick={handleSend}>Enviar</button>
    </main>
  );
}
