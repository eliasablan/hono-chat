import { ChatMain } from "@/components/chat";

export default async function Page(props: PageProps<"/[roomId]">) {
  const { roomId } = await props.params;

  return (
    <main className="w-full h-dvh p-4">
      <ChatMain roomId={roomId} />
    </main>
  );
}
