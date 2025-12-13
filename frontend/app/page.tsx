"use client";

import Link from "next/link";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  ResponsiveModal,
  ResponsiveModalTrigger,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import { useUserStore } from "@/lib/hooks/use-user";
import { PlusIcon, Search, UserIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { RoomDTO } from "@backend/contracts/rooms";

export default function HomePage() {
  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [searchInput, setSearchInput] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [newRoom, setNewRoom] = useState("");

  const userName = useUserStore((state) => state.name);

  const router = useRouter();

  useEffect(() => {
    apiClient.api.rooms
      .$get()
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as RoomDTO[];
        setRooms(data);
        setLoadingRooms(false);
      })
      .catch((err) => console.error("Error fetching rooms", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = newRoom.trim();
    if (!trimmed) return;

    try {
      const res = await apiClient.api.rooms.$post({ json: { name: trimmed } });
      if (!res.ok) {
        console.error("Failed to create room", await res.text());
        return;
      }

      const created = (await res.json()) as RoomDTO;
      router.push(`/${created.id}`);
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  const handleDelete = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    roomId: string,
  ) => {
    e.preventDefault();

    try {
      const res = await apiClient.api.rooms[":roomId"].$delete({
        param: { roomId },
      });
      if (!res.ok) {
        console.error("Failed to delete room", await res.text());
        return;
      }

      const deleted = (await res.json()) as RoomDTO;
      setRooms((prev) => prev.filter((room) => room.id !== deleted.id));
      setNewRoom("");
    } catch (error) {
      console.error("Error deleting room:", error);
    }
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
    <main className="h-dvh w-full p-4">
      <Card className="relative mx-auto h-full max-w-md flex-1 gap-0 py-0">
        <CardHeader className="flex items-center justify-between border-b p-4!">
          <CardTitle>Salas de Chat</CardTitle>
          <CardAction className="text-accent inline-flex items-center gap-2 italic">
            <UserIcon className="size-4" />
            <span className="leading-none">{userName}</span>
          </CardAction>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 overflow-y-auto p-4!">
          {loadingRooms ? (
            <p className="text-sm italic">Cargando...</p>
          ) : filteredRooms.length === 0 ? (
            <p className="text-sm italic">No existen salas.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <InputGroup>
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
                    {filteredRooms.length > 1 && "s"}
                  </InputGroupAddon>
                </InputGroup>
              </div>
              <ul>
                {filteredRooms.map((room) => (
                  <Link
                    href={`/${room.id}`}
                    className="hover:bg-muted flex items-center justify-between gap-2"
                    key={room.id}
                  >
                    <span className="px-2 text-sm">{room.name}</span>
                    <Button
                      size="icon-sm"
                      className="cursor-pointer"
                      title="Borrar chat"
                      variant="link"
                      onClick={(e) => handleDelete(e, room.id)}
                    >
                      <XIcon className="text-destructive" />
                    </Button>
                  </Link>
                ))}
              </ul>
            </>
          )}
        </CardContent>

        <ResponsiveModal open={modalOpen} onOpenChange={setModalOpen}>
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
              <ResponsiveModalTitle>
                Crear nueva sala de chat
              </ResponsiveModalTitle>
              <ResponsiveModalDescription>
                Asigna un nombre a la sala
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>
            <form
              onSubmit={handleSubmit}
              className="flex w-full items-center gap-2"
            >
              <Input
                placeholder="Nueva sala"
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
              />
              <Button disabled={!newRoom}>Crear</Button>
            </form>
          </ResponsiveModalContent>
        </ResponsiveModal>
      </Card>
    </main>
  );
}
