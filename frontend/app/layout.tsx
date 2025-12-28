import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NameModal from "@/components/name-modal";
import { Providers } from "@/providers/query-client";

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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-muted antialiased`}
      >
        <Providers>
          {children}
          <NameModal />
        </Providers>
      </body>
    </html>
  );
}
