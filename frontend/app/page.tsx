import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import Chats from "@/components/chats-list";
import { roomsOptions } from "@/query-options/rooms";
import { getQueryClient } from "@/lib/get-query-client";

export default function HomePage() {
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(roomsOptions());

  return (
    <main className="h-dvh w-full p-4">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Chats />
      </HydrationBoundary>
    </main>
  );
}
