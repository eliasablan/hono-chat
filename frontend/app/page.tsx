"use client";

import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserStore } from "@/lib/hooks/use-user";
import { UserIcon, XIcon } from "lucide-react";

type Room = {
  id: string;
  name: string;
};

export default function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoom, setNewRoom] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const userName = useUserStore((state) => state.name);

  useEffect(() => {
    apiClient.api.rooms
      .$get()
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as Room[];
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

      const created = (await res.json()) as Room;
      setRooms((prev) => [...prev, created]);
      setNewRoom("");
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  const handleDelete = async (roomId: string) => {
    try {
      const res = await apiClient.api.rooms[":roomId"].$delete({
        param: { roomId },
      });
      if (!res.ok) {
        console.error("Failed to delete room", await res.text());
        return;
      }

      const deleted = (await res.json()) as Room;
      setRooms((prev) => prev.filter((room) => room.id !== deleted.id));
      setNewRoom("");
    } catch (error) {
      console.error("Error deleting room:", error);
    }
  };

  return (
    <main className="w-full h-dvh p-4">
      <div className="flex h-full bg-background flex-1 flex-col rounded-lg shadow-sm mx-auto max-w-md">
        <div className="flex items-center justify-between  border-b p-4">
          <div className="w-full flex justify-between items-center gap-4">
            <h1 className="text-xl font-semibold">Salas de Chat</h1>
            <p className="text-accent-foreground items-center gap-2 italic inline-flex">
              <UserIcon className="size-4" />
              {userName}
            </p>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              placeholder="Nueva sala"
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
            />
            <Button disabled={!newRoom}>Crear</Button>
          </form>
          {loadingRooms ? (
            <p>Loading...</p>
          ) : rooms.length === 0 ? (
            <p>No hay salas disponibles.</p>
          ) : (
            <ul>
              {rooms.map((room, idx) => (
                <li
                  className="flex justify-between items-center gap-2"
                  key={room.id}
                >
                  <Button variant="link" asChild>
                    <Link href={`/${room.id}`}>
                      {idx + 1}. {room.name}
                    </Link>
                  </Button>
                  <Button
                    size="icon-sm"
                    title="Borrar chat"
                    variant="link"
                    onClick={() => handleDelete(room.id)}
                  >
                    <XIcon className="text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
