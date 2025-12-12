"use client";

import type { UserDTO } from "@backend/contracts/users";
import { useUserStore } from "@/lib/hooks/use-user";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "./ui/responsive-modal";
import { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { apiClient } from "@/lib/api-client";

export default function NameModal() {
  const hasUser = useUserStore((state) => state.hasUser());
  const storeUser = useUserStore((state) => state.setUser);
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      const res = await apiClient.api.users.$post({
        json: { name: trimmedName },
      });

      if (!res.ok) {
        console.error("Failed to create user", await res.text());
        return;
      }

      const createdUser = (await res.json()) as UserDTO;
      storeUser(createdUser.id, createdUser.name);
      setName("");
    } catch (error) {
      console.error("Error creating user:", error);
    }
  };

  return (
    <ResponsiveModal open={!hasUser}>
      <ResponsiveModalContent className="space-y-4">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Indica tu nombre</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Este será tu nombre en los chats a partir de ahora
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <ResponsiveModalFooter>
          <form className="flex gap-2 w-full" onSubmit={handleSubmit}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
            />
            <Button disabled={!name}>Guardar</Button>
          </form>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
