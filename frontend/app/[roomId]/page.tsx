import { Chat } from "@/components/chat";

export default async function Page(props: PageProps<"/[roomId]">) {
  const { roomId } = await props.params;

  return (
    <main className="h-dvh w-full p-4">
      <Chat roomId={roomId} />
    </main>
  );
}
