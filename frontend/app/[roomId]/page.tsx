import { Chat } from "@/components/chat";
import { getQueryClient } from "@/lib/get-query-client";
import { roomMessagesOptions, roomOptions } from "@/query-options/rooms";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export default async function Page(props: PageProps<"/[roomId]">) {
  const { roomId } = await props.params;
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(roomOptions(roomId));
  void queryClient.prefetchQuery(roomMessagesOptions(roomId));

  return (
    <main className="h-dvh w-full p-4">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Chat roomId={roomId} />
      </HydrationBoundary>
    </main>
  );
}
