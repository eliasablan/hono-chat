import Link from "next/link";
import { apiClient } from "@/lib/api-client";

export default async function HomePage() {
  const res = await apiClient.api.rooms.$get();
  const rooms = res.ok ? ((await res.json()) as Room[]) : [];

  return (
    <main>
      <h1>Chat Rooms</h1>
      {rooms.length === 0 ? (
        <p>No hay salas disponibles.</p>
      ) : (
        <ul>
          {rooms.map((room) => (
            <li key={room.id}>
              <Link href={`/${room.id}`}>{room.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

type Room = {
  id: string;
  name: string;
};
