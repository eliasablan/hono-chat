"use client";

import type { UserDTO } from "@backend/contracts/users";
import { Loader } from "lucide-react";
import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useUserStore } from "@/lib/hooks/use-user";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "./ui/responsive-modal";
import { useMutation } from "@tanstack/react-query";

export default function NameModal() {
  const hasUser = useUserStore((state) => state.hasUser());
  const storeUser = useUserStore((state) => state.setUser);
  const [userName, setUserName] = useState("");

  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiClient.api.users.$post({
        json: { name },
      });

      if (!res.ok) {
        throw new Error("No se pueden crear usuarios en este momento.");
      }

      return (await res.json()) as UserDTO;
    },
    onSuccess: (created) => {
      storeUser(created);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = userName.trim();
    if (!trimmed) return;

    mutate(trimmed);
  };

  return (
    <ResponsiveModal open={!hasUser}>
      <ResponsiveModalContent side="top" className="space-y-4">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Regístrate</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Este será tu nombre de usuario en los chats a partir de ahora
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        {isError && (
          <p className="text-destructive text-sm italic">{error.message}</p>
        )}
        <ResponsiveModalFooter>
          <form className="flex w-full gap-2" onSubmit={handleSubmit}>
            <Input
              placeholder="Nombre"
              value={userName}
              disabled={isPending || isError}
              onChange={(e) => setUserName(e.target.value)}
            />
            <Button disabled={!userName || isPending || isError}>
              {isPending ? (
                <>
                  <Loader className="animate-spin" />
                  Creando
                </>
              ) : (
                "Crear"
              )}
            </Button>
          </form>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
