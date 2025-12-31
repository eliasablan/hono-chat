"use client";

import {
  PlusIcon,
  Loader,
  Trash2Icon,
  SearchIcon,
  MessageSquareTextIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal";
import { apiClient } from "@/lib/api-client";
import { useUserStore } from "@/lib/hooks/use-user";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import type {
  CreateRoomResponse,
  DeleteRoomResponse,
  ListRoomsResponse,
} from "@backend/contracts/rooms";
import { Item, ItemGroup } from "@/components/ui/item";
import { ThemeButton } from "./theme-button";

type RoomItem = ListRoomsResponse[number];

export default function Chats() {
  const [searchInput, setSearchInput] = useState("");

  const userId = useUserStore((state) => state.id);
  const userName = useUserStore((state) => state.name);
  const queryClient = useQueryClient();

  const {
    data: rooms = [],
    isLoading: loadingRooms,
    error: roomsError,
  } = useQuery<ListRoomsResponse>({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await apiClient.api.rooms.$get();
      if (!res.ok) {
        console.error(await res.json());
        throw new Error("No se pueden recuperar las salas en este momento.");
      }
      return (await res.json()) as ListRoomsResponse;
    },
    refetchInterval: 10000,
    retry: false,
  });

  const { mutate: deleteRoom, isPending: isPendingDeleteRoom } = useMutation<
    DeleteRoomResponse,
    Error,
    string
  >({
    mutationFn: async (roomId: string) => {
      const res = await apiClient.api.rooms[":roomId"].$delete({
        param: { roomId },
      });
      if (!res.ok) {
        throw new Error("Failed to delete room");
      }
      return (await res.json()) as DeleteRoomResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const handleDelete = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    roomId: string,
  ) => {
    e.preventDefault();
    deleteRoom(roomId);
  };

  const filteredRooms: RoomItem[] = useMemo(() => {
    if (!searchInput) {
      return rooms;
    }
    const lowerCaseSearch = searchInput.toLowerCase();
    return rooms.filter((room) =>
      room.name.toLowerCase().includes(lowerCaseSearch),
    );
  }, [rooms, searchInput]);

  return (
    <Card className="bg-popover inset-shadow-lg relative mx-auto h-full max-w-md flex-1 gap-0 overflow-hidden rounded-none py-0 shadow-none">
      <CardHeader className="bg-muted flex h-17 items-center justify-between border-b pt-6 shadow">
        <CardTitle>Hola, {userName} 👋</CardTitle>
        <ThemeButton />
      </CardHeader>

      <CardContent className="flex-1 space-y-6 overflow-y-auto py-6">
        {loadingRooms ||
          (!roomsError && (
            <div className="flex items-center justify-between gap-4">
              <InputGroup className="border-border rounded-full px-1 py-5 shadow-none dark:bg-transparent">
                <InputGroupInput
                  className="placeholder:text-muted-foreground"
                  placeholder="Buscar..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <InputGroupAddon>
                  {searchInput.length > 0 ? (
                    <XIcon
                      className="text-destructive cursor-pointer"
                      onClick={() => setSearchInput("")}
                    />
                  ) : (
                    <SearchIcon />
                  )}
                </InputGroupAddon>
                <InputGroupAddon align="inline-end">
                  {filteredRooms.length} resultado
                  {filteredRooms.length !== 1 && "s"}
                </InputGroupAddon>
              </InputGroup>
            </div>
          ))}

        {loadingRooms ? (
          <p className="text-sm italic">Cargando...</p>
        ) : roomsError ? (
          <p className="text-sm italic">Error recuperando las salas.</p>
        ) : filteredRooms.length === 0 ? (
          <p className="mx-auto text-sm italic">Sin resultados.</p>
        ) : (
          <ItemGroup className="space-y-4">
            {filteredRooms.map((room) => (
              <Item
                className="[a]:hover:bg-muted/50 bg-muted flex items-center justify-between gap-4 rounded-xl border p-4 shadow-lg"
                variant="outline"
                key={room.id}
                asChild
              >
                <Link
                  href={`/${room.id}`}
                  // className="hover:bg-muted/70 bg-muted text-muted-foreground group border-muted-froreground/70 flex items-center justify-between gap-2 rounded-xl border p-4 shadow-lg"
                >
                  <div className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-full text-sm uppercase">
                    {room.name.slice(0, 3)}
                  </div>
                  <div className="flex flex-1 flex-col items-start justify-between gap-1">
                    <h4>{room.name}</h4>
                    <div className="flex gap-1">
                      <Badge variant="default">
                        {room.activeConnections}
                        <UsersIcon className="size-5" />
                      </Badge>
                      <Badge variant="secondary">
                        {room.messages.length}
                        <MessageSquareTextIcon className="size-5" />
                      </Badge>
                    </div>
                  </div>
                  {room.createdBy === userId && (
                    <Button
                      size="icon"
                      className="text-destructive hover:text-accent cursor-pointer duration-100"
                      title="Borrar sala"
                      variant="link"
                      onClick={(e) => handleDelete(e, room.id)}
                      disabled={isPendingDeleteRoom}
                    >
                      <Trash2Icon className="size-4.5" />
                    </Button>
                  )}
                </Link>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
      <CreateRoom />
    </Card>
  );
}

function CreateRoom() {
  const [newRoom, setNewRoom] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useUserStore((state) => state.id);

  const { mutate, isPending, reset, isError, error } = useMutation<
    CreateRoomResponse,
    Error,
    string
  >({
    mutationFn: async (name: string) => {
      if (!userId) {
        throw new Error("Falta el usuario, vuelve a iniciar sesión.");
      }
      const res = await apiClient.api.rooms.$post({
        json: { name, createdBy: userId },
      });
      if (!res.ok) {
        throw new Error("No se pueden crear salas en este momento.");
      }
      return (await res.json()) as CreateRoomResponse;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setModalOpen(false);
      setNewRoom("");
      router.push(`/${created.id}`);
    },
  });

  const handleOpenChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      reset();
      setNewRoom("");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = newRoom.trim();
    if (!trimmed) return;
    mutate(trimmed);
  };

  return (
    <ResponsiveModal open={modalOpen} onOpenChange={handleOpenChange}>
      <ResponsiveModalTrigger asChild>
        <Button
          className="absolute right-6 bottom-6 scale-150 cursor-pointer rounded-full shadow-xl"
          size="icon-lg"
        >
          <PlusIcon />
        </Button>
      </ResponsiveModalTrigger>
      <ResponsiveModalContent className="space-y-4">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Crear nueva sala de chat</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Asigna un nombre a la sala
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {isError && (
          <p className="text-destructive text-sm italic">{error.message}</p>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex w-full items-center gap-2"
        >
          <Input
            placeholder="Nueva sala"
            value={newRoom}
            disabled={isPending || isError || !userId}
            onChange={(e) => {
              setNewRoom(e.target.value);
            }}
          />
          <Button
            className={cn(isPending && "animate-pulse")}
            disabled={!newRoom || isPending || isError || !userId}
          >
            {isPending ? (
              <>
                <Loader className="animate-spin" />
                Creando
              </>
            ) : (
              "Crear"
            )}
          </Button>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
