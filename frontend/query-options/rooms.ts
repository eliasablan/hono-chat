import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ListRoomsResponse } from "@backend/contracts/rooms";

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
