"use client";

import type { RoomDTO } from "@backend/contracts/rooms";
import { PlusIcon, Search, UserIcon, XIcon, Loader } from "lucide-react";
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

export default function Chats() {
  const [searchInput, setSearchInput] = useState("");

  const userName = useUserStore((state) => state.name);
  const queryClient = useQueryClient();

  const {
    data: rooms = [],
    isLoading: loadingRooms,
    error: roomsError,
  } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await apiClient.api.rooms.$get();
      if (!res.ok) {
        console.error(await res.json());
        throw new Error("No se pueden recuperar las salas en este momento.");
      }
      return (await res.json()) as RoomDTO[];
    },
    retry: false,
  });

  const { mutate: deleteRoom, isPending: isPendingDeleteRoom } = useMutation({
    mutationFn: async (roomId: string) => {
      const res = await apiClient.api.rooms[":roomId"].$delete({
        param: { roomId },
      });
      if (!res.ok) {
        throw new Error("Failed to delete room");
      }
      return (await res.json()) as RoomDTO;
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

  const filteredRooms: RoomDTO[] = useMemo(() => {
    if (!searchInput) {
      return rooms;
    }
    const lowerCaseSearch = searchInput.toLowerCase();
    return rooms.filter((room) =>
      room.name.toLowerCase().includes(lowerCaseSearch),
    );
  }, [rooms, searchInput]);

  return (
    <Card className="bg-popover relative mx-auto h-full max-w-md flex-1 gap-0 overflow-hidden py-0">
      <CardHeader className="bg-muted flex h-17 items-center justify-between border-b p-4!">
        <CardTitle>Salas de Chat</CardTitle>
        <div className="text-accent inline-flex items-center gap-2 italic">
          <UserIcon className="size-4" />
          <span className="leading-none">{userName}</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 overflow-y-auto p-4!">
        {loadingRooms ? (
          <p className="text-sm italic">Cargando...</p>
        ) : roomsError ? (
          <p className="text-sm italic">Error recuperando las salas.</p>
        ) : filteredRooms.length === 0 ? (
          <p className="mx-auto text-sm italic">No existen salas.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <InputGroup className="bg-muted">
                <InputGroupInput
                  placeholder="Buscar..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupAddon align="inline-end">
                  {filteredRooms.length} resultado
                  {filteredRooms.length !== 1 && "s"}
                </InputGroupAddon>
              </InputGroup>
            </div>
            <ul>
              {filteredRooms.map((room) => (
                <Link
                  href={`/${room.id}`}
                  className="hover:bg-accent hover:text-accent-foreground group flex items-center justify-between gap-2"
                  key={room.id}
                >
                  <span className="px-2 text-sm">{room.name}</span>
                  <Button
                    size="icon-sm"
                    className="cursor-pointer"
                    title="Borrar chat"
                    variant="link"
                    onClick={(e) => handleDelete(e, room.id)}
                    disabled={isPendingDeleteRoom}
                  >
                    <XIcon className="text-destructive group-hover:text-primary-foreground" />
                  </Button>
                </Link>
              ))}
            </ul>
          </>
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

  const { mutate, isPending, reset, isError, error } = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiClient.api.rooms.$post({ json: { name } });
      if (!res.ok) {
        throw new Error("No se pueden crear salas en este momento.");
      }
      return (await res.json()) as RoomDTO;
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
          className="absolute right-4 bottom-4 cursor-pointer rounded-full"
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
            disabled={isPending || isError}
            onChange={(e) => {
              setNewRoom(e.target.value);
            }}
          />
          <Button
            className={cn(isPending && "animate-pulse")}
            disabled={!newRoom || isPending || isError}
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
