import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AgentPanel } from "@/components/agent-panel";
import { CommandPalette } from "@/components/command-palette";
import { ConvexClientProvider } from "@/components/convex-provider";
import { TopNav } from "@/components/top-nav";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Castle — 42nights",
  description: "42nights operator console.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-page text-ink font-sans">
        <ConvexClientProvider>
          <TopNav />
          {children}
          <CommandPalette />
          <AgentPanel />
          <Toaster position="bottom-right" />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
