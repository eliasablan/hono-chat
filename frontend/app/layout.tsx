import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NameModal from "@/components/name-modal";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/providers/query-client";
import { ThemeProvider } from "@/providers/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hono Chat",
  description:
    "App de chat por salas con mensajería en vivo, API en Hono y persistencia en PostgreSQL, construida con Next.js + TypeScript.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "dark:bg-background bg-primary antialiased",
          geistSans.variable,
          geistMono.variable,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
            <NameModal />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
