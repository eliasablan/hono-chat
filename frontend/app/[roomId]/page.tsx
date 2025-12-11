import { Chat } from "@/components/chat";

export default async function Page(props: PageProps<"/[roomId]">) {
  const { roomId } = await props.params;

  return (
    <main>
      <h1>Chat Room: {roomId}</h1>
      <Chat roomId={roomId} />
    </main>
  );
}
