"use client";

// Composer — the input area at the bottom of the chat.
// Extracted from chat-landing.tsx. Handles textarea, attachment chips,
// upload, send/stop, clear, and the actor/status footer row.

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { ChatStatus } from "@/lib/use-hermes-chat";
import type { Id } from "@/convex/_generated/dataModel";

type StagedAttachment = {
  storageId: string;
  name: string;
  contentType?: string;
  size?: number;
};

type Props = {
  draft: string;
  setDraft: (v: string) => void;
  clearDraft: () => void;
  conversationId: Id<"agent_conversations"> | null;
  actorSlug: string | null;
  status: ChatStatus;
  hasMessages: boolean;
  onSend: (text: string, attachments?: StagedAttachment[]) => void;
  onStop: () => void;
  onClear: () => void;
};

export function Composer({
  draft,
  setDraft,
  clearDraft,
  conversationId,
  actorSlug,
  status,
  hasMessages,
  onSend,
  onStop,
  onClear,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<StagedAttachment[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const generateUploadUrl = useMutation(api.agentMessages.generateAttachmentUploadUrl);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [draft]);

  // Focus when conversation changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingCount((n) => n + files.length);
    const uploaded: StagedAttachment[] = [];
    for (const file of Array.from(files)) {
      try {
        const url = await generateUploadUrl({});
        const res = await fetch(url, {
          method: "POST",
          headers: file.type ? { "Content-Type": file.type } : undefined,
          body: file,
        });
        if (!res.ok) throw new Error(`upload ${res.status}`);
        const { storageId } = (await res.json()) as { storageId: string };
        uploaded.push({ storageId, name: file.name, contentType: file.type || undefined, size: file.size });
      } catch (err) {
        toast.error(`Couldn't upload ${file.name}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
    setUploadingCount((n) => Math.max(0, n - files.length));
    if (uploaded.length > 0) setPendingAttachments((prev) => [...prev, ...uploaded]);
  };

  const removeAttachment = (storageId: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.storageId !== storageId));
  };

  const submit = () => {
    const text = draft.trim();
    if ((!text && pendingAttachments.length === 0) || status === "streaming" || uploadingCount > 0) return;
    onSend(text, pendingAttachments.length ? pendingAttachments : undefined);
    clearDraft();
    setPendingAttachments([]);
  };

  return (
    <div className="shrink-0 border-t border-line bg-page">
      <div className="mx-auto max-w-[720px] px-6 py-3">
        <div className="rounded-md border border-line bg-page focus-within:border-ink-2 transition-colors">
          {(pendingAttachments.length > 0 || uploadingCount > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
              {pendingAttachments.map((a) => (
                <span
                  key={a.storageId}
                  className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-sm border border-line bg-surface text-[11.5px] text-ink"
                  title={a.size ? `${a.name} · ${Math.round(a.size / 1024)} KB` : a.name}
                >
                  <span className="truncate max-w-[160px]">{a.name}</span>
                  <button
                    onClick={() => removeAttachment(a.storageId)}
                    className="text-ink-3 hover:text-accent text-[12px] px-0.5"
                    aria-label={`Remove ${a.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {uploadingCount > 0 && (
                <span className="text-[11px] text-ink-3 num">uploading {uploadingCount}…</span>
              )}
            </div>
          )}
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder={conversationId ? "Ask Castle anything…" : "Pick or start a chat from the left."}
            rows={1}
            disabled={!conversationId}
            aria-label="Chat message"
            className="block w-full resize-none bg-transparent text-[14px] leading-[22px] text-ink placeholder:text-ink-3 outline-none px-3 pt-2.5 pb-1 min-h-[42px] max-h-[200px] disabled:opacity-50"
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
            aria-label="Attach files"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[11px] text-ink-3 inline-flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!conversationId}
                className="text-ink-3 hover:text-ink disabled:opacity-40"
                aria-label="Attach files"
                title="Attach files"
              >
                📎
              </button>
              <span>
                castle ·{" "}
                <span className="text-ink-2">{actorSlug ?? "no actor"}</span>
              </span>
              {hasMessages && (
                <button
                  onClick={onClear}
                  className="text-ink-3 hover:text-accent underline underline-offset-2 decoration-line"
                >
                  clear
                </button>
              )}
            </span>
            {status === "streaming" ? (
              <button
                onClick={onStop}
                className="h-7 px-3 rounded-sm border border-line text-[12px] text-ink-2 hover:text-ink"
              >
                stop
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={(!draft.trim() && pendingAttachments.length === 0) || !conversationId}
                className="h-7 px-3 rounded-sm bg-ink text-page text-[12px] disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                send <kbd className="num text-[10px] opacity-70">⏎</kbd>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
