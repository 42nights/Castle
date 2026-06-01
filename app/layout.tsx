import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Editorial display — Fraunces variable, optical-size axis for the
// soft/wonky letterforms the investor pages lean on.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-display-src",
});
// UI everywhere — Inter variable.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-src",
});
// IDs, timestamps, money, tabular numbers — JetBrains Mono variable.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-src",
});
import { AgentPanel } from "@/components/agent-panel";
import { CommandPalette } from "@/components/command-palette";
import { ConvexClientProvider } from "@/components/convex-provider";
import { Footer } from "@/components/footer";
import { KeyboardHelp } from "@/components/keyboard-help";
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
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-page text-ink font-sans">
        <ConvexClientProvider initialToken={token}>
          <ChatProvider>
            <TopNav />
            {children}
            <Footer />
            <CommandPalette />
            <KeyboardHelp />
            <AgentPanel />
            <Toaster position="bottom-right" />
          </ChatProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
