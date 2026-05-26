"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { useActorSlug } from "@/lib/use-actor";
import {
  useHermesChat,
  type ChatMessage,
  type ChatStatus,
  type ToolActivity,
} from "@/lib/use-hermes-chat";

/**
 * Hoists chat-stream state above the route tree so it survives page
 * navigation. Without this, leaving `/` (chat) mid-stream unmounts
 * ChatLanding, throws away all the local `streamingText` / `tools` /
 * `status` / `thought` state, and when the operator returns they see
 * a blank chat until the assistant turn finally lands in Convex history.
 *
 * The fetch itself never cared about the component — it runs on the
 * server and persists the final assistant text on `done`. The bug is
 * purely a render-side one: state died with the component. Holding it
 * in a context provider that mounts at `app/layout.tsx` lets a
 * remount of ChatLanding pick up exactly where it left off.
 *
 * Side benefit: `conversationId` (which chat is selected) also lives
 * here, so flipping to /customers and back doesn't reset to "no chat
 * selected".
 */

type ChatContextValue = {
  // Conversation selection
  conversationId: Id<"agent_conversations"> | null;
  setConversationId: (id: Id<"agent_conversations"> | null) => void;
  actorSlug: string | null;
  // Chat stream state
  messages: ChatMessage[];
  status: ChatStatus;
  error: string | null;
  thought: string;
  tools: ToolActivity[];
  sendMessage: (
    text: string,
    attachments?: Array<{
      storageId: string;
      name: string;
      contentType?: string;
      size?: number;
    }>,
  ) => Promise<void>;
  stop: () => void;
  regenerate: () => Promise<void>;
  canRegenerate: boolean;
};

const Ctx = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [actorSlug] = useActorSlug();
  const [conversationId, setConversationId] =
    useState<Id<"agent_conversations"> | null>(null);
  const chat = useHermesChat({ actorSlug, conversationId });
  return (
    <Ctx.Provider
      value={{
        conversationId,
        setConversationId,
        actorSlug,
        ...chat,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useChatContext must be inside <ChatProvider>");
  return ctx;
}
