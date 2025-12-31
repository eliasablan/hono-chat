"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { connectChatWS } from "@/lib/ws";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/hooks/use-user";
import type { ClientToServerEvent } from "@backend/contracts/events";
import type { ListRoomMessagesResponse } from "@backend/contracts/chat";
import type { GetRoomResponse } from "@backend/contracts/rooms";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import TextareaAutosize from "react-textarea-autosize";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const formatter = new Intl.DateTimeFormat("es-ES", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

type BubbleMessage = ListRoomMessagesResponse[number];

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
          <Avatar className="h-8 w-8 shadow-lg">
            <AvatarImage src="/placeholder.svg" alt="User Avatar" />
            <AvatarFallback className="capitalize">
              {message.authorName[0]}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent
          className="shadow-lg"
          side={isUserMessage ? "left" : "right"}
        >
          <p>{message.authorName}</p>
          <p>{formatter.format(new Date(message.createdAt))}</p>
        </TooltipContent>
      </Tooltip>
      <div
        className={cn(
          "max-w-[70%] rounded-lg p-3 shadow-lg",
          isUserMessage
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-muted-foreground text-muted rounded-bl-none",
        )}
      >
        <p className="text-sm">{message.content}</p>
      </div>
    </div>
  );
};

export function Chat({ roomId }: { roomId: string }) {
  const [content, setContent] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const userId = useUserStore((state) => state.id);
  const socketRef = useRef<ReturnType<typeof connectChatWS> | null>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading: loadingMessages } =
    useQuery<ListRoomMessagesResponse>({
      queryKey: ["room-messages", roomId],
      queryFn: async () => {
        const res = await apiClient.api.rooms[":roomId"].messages.$get({
          param: { roomId },
        });
        if (!res.ok) throw new Error("Failed to fetch messages");
        return (await res.json()) as ListRoomMessagesResponse;
      },
    });

  const { data: room, isLoading: loadingRoomName } = useQuery<GetRoomResponse>({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const res = await apiClient.api.rooms[":roomId"].$get({
        param: { roomId },
      });
      if (!res.ok) throw new Error("Failed to fetch room");
      return (await res.json()) as GetRoomResponse;
    },
  });
  const roomName = room?.name || "";

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
    // actualizar mensajes por evento del WS del servidor
    const connection = connectChatWS((ev) => {
      if (ev.type === "message-created") {
        queryClient.setQueryData(
          ["room-messages", roomId],
          (old: BubbleMessage[] | undefined) => {
            if (!old) return [ev.message];
            // Evitar duplicados si el evento llega antes que el refetch (optimistic updates si hubieran)
            if (old.some((m) => m.id === ev.message.id)) return old;
            return [...old, ev.message];
          },
        );
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
  }, [roomId, queryClient]); // Re-subscribe if roomId changes

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    requestAnimationFrame(updateScrollButtonVisibility);
    el.addEventListener("scroll", updateScrollButtonVisibility);

    return () => {
      el.removeEventListener("scroll", updateScrollButtonVisibility);
    };
  }, [updateScrollButtonVisibility]);

  useEffect(() => {
    requestAnimationFrame(() => updateScrollButtonVisibility());
  }, [messages.length, updateScrollButtonVisibility]);

  return (
    <Card className="bg-popover inset-shadow-lg relative mx-auto h-full max-w-md flex-1 gap-0 overflow-hidden rounded-none py-0 shadow-none">
      <CardHeader className="bg-muted flex h-17 items-center justify-between border-b p-6 shadow">
        <Button
          size="icon-sm"
          variant="outline"
          className="dark:hover:bg-accent-foreground dark:hover:text-accent cursor-pointer bg-transparent"
          asChild
        >
          <Link href="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="leading-none font-semibold">{roomName}</h1>
      </CardHeader>

      <CardContent
        className="flex-1 space-y-4 overflow-y-auto p-6"
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

      <CardFooter className="bg-transparent p-6">
        <form onSubmit={handleSend} className="flex w-full items-center gap-3">
          <InputGroup className="border-border! border bg-transparent! shadow-none">
            <TextareaAutosize
              value={content}
              onChange={(e) => setContent(e.target.value)}
              data-slot="input-group-control"
              className="flex field-sizing-content max-h-32 min-h-16 w-full resize-none rounded-md px-3 py-2.5 outline-none md:text-sm"
              placeholder="Escribe tu mensaje aquí..."
            />
            <InputGroupAddon align="block-end">
              <InputGroupButton
                disabled={content.trim().length === 0}
                type="submit"
                className="ml-auto shadow-lg"
                variant="default"
                size="sm"
              >
                Enviar
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </CardFooter>
    </Card>
  );
}
