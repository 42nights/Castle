"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChatMarkdown } from "@/components/chat-markdown";

interface DigestDoc {
  _id: string;
  user_id: string;
  date: string;
  markdown: string;
  created_at: string;
}

/** Client island: renders the latest digest or triggers generation. */
export function AssistantDigestView({
  userId,
  initialDigest,
}: {
  userId: string;
  initialDigest: DigestDoc | null;
}) {
  const latest = useQuery(api.dailyDigests.latestForUser, { user_id: userId });
  const runMorningBrief = useAction(api.assistantActions.runMorningBrief);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digest = latest ?? initialDigest;

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      await runMorningBrief({ user_id: userId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (digest) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-ink-3 font-mono mb-1">
              Morning brief
            </p>
            <p className="text-[12px] text-ink-2">{digest.date}</p>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="text-[12px] px-3 py-1.5 rounded border border-line text-ink-2 hover:border-line-strong hover:text-ink transition-colors disabled:opacity-40"
          >
            {generating ? "Generating…" : "Regenerate"}
          </button>
        </div>

        <div className="rounded-lg border border-line bg-surface p-6">
          <ChatMarkdown>{digest.markdown}</ChatMarkdown>
        </div>

        {error && (
          <p className="mt-4 text-[12px] text-bad">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-20 px-4 flex flex-col items-center gap-6 text-center">
      <div className="space-y-1">
        <p className="text-[14px] font-semibold text-ink">No brief yet today</p>
        <p className="text-[12px] text-ink-2">
          Generate your morning brief to see today&apos;s calendar, follow-ups,
          and Castle attention items.
        </p>
      </div>

      <button
        onClick={generate}
        disabled={generating}
        className="px-4 py-2 rounded bg-ink text-page text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {generating ? "Generating…" : "Generate today's brief"}
      </button>

      {error && (
        <p className="text-[12px] text-bad">{error}</p>
      )}
    </div>
  );
}
