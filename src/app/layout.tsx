import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlayerSkins — Streamer Raffle",
  description: "Plataforma cinematográfica de sorteios para streamers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <head>
        <link rel="icon" href="/favicon-logo.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-[#050816]">
        {children}
      </body>
    </html>
  );
}
