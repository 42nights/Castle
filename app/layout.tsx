import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AgentPanel } from "@/components/agent-panel";
import { CommandPalette } from "@/components/command-palette";
import { ConvexClientProvider } from "@/components/convex-provider";
import { TopNav } from "@/components/top-nav";
import { Toaster } from "@/components/ui/sonner";
import { getToken } from "@/lib/auth-server";
import { ChatProvider } from "@/lib/chat-context";

export const metadata: Metadata = {
  title: "Castle — 42nights",
  description: "42nights operator console.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Preload the Better Auth token so the first useQuery already runs
  // with the right identity attached. Returns null when signed out.
  const token = await getToken().catch(() => null);
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-page text-ink font-sans">
        <ConvexClientProvider initialToken={token}>
          <ChatProvider>
            <TopNav />
            {children}
            <CommandPalette />
            <AgentPanel />
            <Toaster position="bottom-right" />
          </ChatProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
