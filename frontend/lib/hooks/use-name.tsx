import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface NameStore {
  id: string | null;
  name: string;
  setUser: (id: string, name: string) => void;
  hasUser: () => boolean;
  clear: () => void;
}

export const useNameStore = create(
  persist<NameStore>(
    (set, get) => ({
      id: null,
      name: "",
      setUser: (id, name) => {
        set({ id, name });
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
