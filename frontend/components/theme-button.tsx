"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import React from "react";

export function ThemeButton() {
  const { setTheme, resolvedTheme } = useTheme();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (resolvedTheme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      className="dark:hover:bg-accent-foreground dark:hover:text-accent cursor-pointer bg-transparent"
      size="icon"
    >
      {/* Icono de Sol: Visible en light, oculto en dark */}
      <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />

      {/* Icono de Luna: Oculto en light, visible en dark */}
      <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />

      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
