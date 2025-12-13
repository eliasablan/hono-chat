"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { connectChatWS } from "@/lib/ws";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/hooks/use-user";
import type { ClientToServerEvent } from "@backend/contracts/events";
import { type MessageDTO } from "@backend/contracts/chat";
import type { RoomDTO } from "@backend/contracts/rooms";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

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
        isUserMessage && "flex-row-reverse",
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
        <TooltipContent side={isUserMessage ? "left" : "right"}>
          <p>{message.authorName}</p>
          <p>{formatter.format(new Date(message.createdAt))}</p>
        </TooltipContent>
      </Tooltip>
      <div
        className={cn(
          "max-w-[70%] rounded-lg p-3",
          isUserMessage
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-secondary text-secondary-foreground rounded-bl-none",
        )}
      >
        <p className="text-sm">{message.content}</p>
      </div>
    </div>
  );
};

export function ChatMain({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<BubbleMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);

  const [roomName, setRoomName] = useState("");
  const [loadingRoomName, setLoadingRoomName] = useState(true);

  const [content, setContent] = useState("");

  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const userId = useUserStore((state) => state.id);
  const socketRef = useRef<ReturnType<typeof connectChatWS> | null>(null);

  const updateScrollButtonVisibility = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const canScroll = el.scrollHeight > el.clientHeight;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 150;
    setShowScrollButton(canScroll && !isAtBottom);
  }, []);

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
        const data = (await res.json()) as BubbleMessage[];
        setMessages(data);
        setLoadingMessages(false);
      });

    // cargar nombre de la sala desde HTTP
    apiClient.api.rooms[":roomId"]
      .$get({ param: { roomId } })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as RoomDTO;
        setRoomName(data.name ?? "");
        setLoadingRoomName(false);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    updateScrollButtonVisibility();
    el.addEventListener("scroll", updateScrollButtonVisibility);

    return () => {
      el.removeEventListener("scroll", updateScrollButtonVisibility);
    };
  }, [updateScrollButtonVisibility]);

  useEffect(() => {
    requestAnimationFrame(() => updateScrollButtonVisibility());
  }, [messages.length, updateScrollButtonVisibility]);

  return (
    <Card className="relative mx-auto h-full max-w-md flex-1 gap-0 py-0">
      <CardHeader className="flex items-center justify-between border-b p-4!">
        <Button size="icon-sm" variant="ghost" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="leading-none font-semibold">{roomName}</h1>
      </CardHeader>

      <CardContent
        className="flex-1 space-y-4 overflow-y-auto p-4!"
        ref={messagesContainerRef}
      >
        {(!messages || messages.length === 0) &&
          !loadingMessages &&
          !loadingRoomName && (
            <div className="w-full text-center">
              <p className="text-lg font-medium italic">
                Bienvenido a la sala <b>{roomName}</b>
              </p>
            </div>
          )}
        {loadingMessages ? (
          <p className="text-sm italic">Cargando...</p>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {showScrollButton && (
        <Button
          size="icon"
          className="bg-primary/70 absolute right-1/2 bottom-24 translate-x-1/2 shadow"
          onClick={() =>
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <ArrowDown />
        </Button>
      )}

      <CardFooter className="border-t p-4!">
        <form onSubmit={handleSend} className="flex w-full items-center gap-3">
          <Input
            placeholder="Escribe tu mensaje aquí..."
            className="flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button size="icon" className="rounded-full">
            <ArrowRight />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
