"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { connectChatWS } from "@/lib/ws";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/hooks/use-user";
import type { ClientToServerEvent } from "@contracts/events";
import { type MessageDTO } from "@contracts/chat";
import type { RoomDTO } from "@contracts/rooms";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

const formatter = new Intl.DateTimeFormat("es-ES", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

interface BubbleMessage extends MessageDTO {
  authorName: string;
}

const MessageBubble = ({ message }: { message: BubbleMessage }) => {
  const isUserMessage = useUserStore((state) => state.id) === message.authorId;

  return (
    <div
      className={cn(
        "flex items-end gap-3",
        isUserMessage && "flex-row-reverse"
      )}
    >
      <Tooltip>
        <TooltipTrigger>
          <Avatar className="h-8 w-8">
            <AvatarImage src="/placeholder.svg" alt="User Avatar" />
            <AvatarFallback className="capitalize">
              {message.authorName[0]}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{message.authorName}</p>
          <p>{formatter.format(new Date(message.createdAt))}</p>
        </TooltipContent>
      </Tooltip>
      <div
        className={cn(
          "max-w-[70%] rounded-lg p-3",
          isUserMessage
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-accent rounded-bl-none"
        )}
      >
        <p className="text-sm">{message.content}</p>
      </div>
    </div>
  );
};

export function ChatMain({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<BubbleMessage[]>([]);
  const [roomName, setRoomName] = useState("");
  const [content, setContent] = useState("");
  const userId = useUserStore((state) => state.id);
  const socketRef = useRef<ReturnType<typeof connectChatWS> | null>(null);

  // enviar mensaje al servidor por WS
  const handleSend = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!content.trim()) return;
    if (!userId) {
      console.error("User id missing, cannot send message");
      return;
    }
    if (!socketRef.current) {
      console.error("WebSocket connection not ready");
      return;
    }

    const ev: ClientToServerEvent = {
      type: "send-message",
      roomId,
      content,
      authorId: userId,
    };
    socketRef.current.send(ev);
    setContent("");
  };

  useEffect(() => {
    // cargar historial inicial desde HTTP
    apiClient.api.rooms[":roomId"].messages
      .$get({ param: { roomId } })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setMessages(data);
      });

    // cargar nombre de la sala desde HTTP
    apiClient.api.rooms[":roomId"]
      .$get({ param: { roomId } })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as RoomDTO;
        setRoomName(data.name ?? "");
      });

    // actualizar mensajes por evento del WS del servidor
    const connection = connectChatWS((ev) => {
      if (ev.type === "message-created") {
        setMessages((prev) => [...prev, ev.message]);
      }
    });
    socketRef.current = connection;

    // abrir conexión con WS del servidor
    const joinEvent: ClientToServerEvent = {
      type: "join-room",
      roomId,
    };
    connection.send(joinEvent);

    // cerrar conexión con WS
    return () => {
      const leaveEvent: ClientToServerEvent = {
        type: "leave-room",
        roomId,
      };
      connection.send(leaveEvent);
      connection.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full bg-background flex-1 flex-col rounded-lg shadow-sm mx-auto max-w-md">
      <div className="flex items-center justify-between  border-b p-4">
        <div className="w-full flex justify-between items-center gap-4">
          <Button size="icon" variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">{roomName}</h1>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-3  border-t p-4"
      >
        <Input
          placeholder="Escribe tu mensaje..."
          className="flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button size="icon" className="rounded-full">
          <ArrowRight />
        </Button>
      </form>
    </div>
  );
}
