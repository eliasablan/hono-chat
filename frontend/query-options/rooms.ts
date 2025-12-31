import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { GetRoomResponse, ListRoomsResponse } from "@backend/contracts/rooms";
import { ListRoomMessagesResponse } from "@backend/contracts/chat";

export const roomsOptions = () =>
  queryOptions({
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

export const roomMessagesOptions = (roomId: string) =>
  queryOptions({
    queryKey: ["room-messages", roomId],
    queryFn: async () => {
      const res = await apiClient.api.rooms[":roomId"].messages.$get({
        param: { roomId },
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return (await res.json()) as ListRoomMessagesResponse;
    },
  });

export const roomOptions = (roomId: string) =>
  queryOptions({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const res = await apiClient.api.rooms[":roomId"].$get({
        param: { roomId },
      });
      if (!res.ok) throw new Error("Failed to fetch room");
      return (await res.json()) as GetRoomResponse;
    },
  });
