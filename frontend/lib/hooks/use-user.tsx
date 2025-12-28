import { UserDTO } from "@backend/contracts/users";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface UserStore {
  id: string | null;
  name: string;
  setUser: (user: UserDTO) => void;
  hasUser: () => boolean;
  clear: () => void;
}

export const useUserStore = create(
  persist<UserStore>(
    (set, get) => ({
      id: null,
      name: "",
      setUser: (user) => {
        set(user);
      },
      hasUser: () => {
        return !!get().id && !!get().name;
      },
      clear: () => {
        set({ id: null, name: "" });
      },
    }),
    {
      name: "chat-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
