import type { ServerWebSocket } from "bun";

export type RoomId = string;
export type Socket = ServerWebSocket;

export const roomSockets = new Map<RoomId, Set<Socket>>();

export function getOrCreateRoomClients(roomId: RoomId): Set<Socket> {
  const existing = roomSockets.get(roomId);
  if (existing) return existing;

  const clients = new Set<Socket>();
  roomSockets.set(roomId, clients);
  return clients;
}

export function removeSocketFromAllRooms(socket: Socket) {
  for (const [roomId, clients] of roomSockets) {
    if (!clients.delete(socket)) continue;
    if (clients.size === 0) roomSockets.delete(roomId);
  }
}

export function broadcastToRoom(roomId: RoomId, payload: unknown) {
  const clients = roomSockets.get(roomId);
  if (!clients) return;

  const message = JSON.stringify(payload);

  for (const client of clients) {
    if (client.readyState !== 1) {
      clients.delete(client);
      continue;
    }

    try {
      const status = client.send(message);
      if (status === 0) clients.delete(client);
    } catch {
      clients.delete(client);
    }
  }

  if (clients.size === 0) roomSockets.delete(roomId);
}

export function getRoomConnectionCount(roomId: RoomId): number {
  return roomSockets.get(roomId)?.size ?? 0;
}
