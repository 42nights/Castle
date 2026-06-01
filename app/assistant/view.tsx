"use client";

// Client island: needs useQuery, useAction, useState, useCallback, browser TTS.

import { useAction, useQuery } from "convex/react";
import { Mic, Send, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useCallback } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { MetricStrip } from "@/components/assistant/metric-strip";
import { CalendarList } from "@/components/assistant/calendar-list";
import { PeopleCards } from "@/components/assistant/people-cards";
import { FollowUps } from "@/components/assistant/follow-ups";
import { AttentionRows } from "@/components/assistant/attention-rows";
import { StarredUnread } from "@/components/assistant/starred-unread";
import type { DigestSections } from "@/convex/dailyDigests";

interface DigestDoc {
  _id: string;
  user_id: string;
  date: string;
  markdown: string;
  sections_json?: string;
  created_at: string;
}

function formatDate(isoOrDateStr: string): string {
  try {
    // YYYY-MM-DD strings are parsed as UTC midnight; force local-date display
    // by appending T12:00:00 so no timezone shift flips the day.
    const input = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDateStr)
      ? `${isoOrDateStr}T12:00:00`
      : isoOrDateStr;
    const d = new Date(input);
    if (isNaN(d.getTime())) return isoOrDateStr;
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoOrDateStr;
  }
}

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Editorial markdown renderer for the morning brief — newspaper register */
function DigestMarkdown({ content }: { content: string }) {
  return (
    <div className="digest-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2
              className="font-display text-[28px] font-normal leading-[1.15] tracking-[-0.015em] text-ink mt-10 mb-3 first:mt-0"
              style={{
                fontFamily: "var(--font-display, Georgia, serif)",
                fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0',
              }}
            >
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h2
              className="text-[20px] font-normal leading-[1.2] tracking-[-0.015em] text-ink mt-8 mb-2 first:mt-0"
              style={{
                fontFamily: "var(--font-display, Georgia, serif)",
                fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0',
              }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[16px] font-semibold text-ink mt-6 mb-1.5 tracking-[-0.01em]">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-[16px] leading-[1.65] text-ink mb-5 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 space-y-1.5 mb-5 text-[16px] leading-[1.65]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 space-y-1.5 mb-5 text-[16px] leading-[1.65]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-ink">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-ink-2">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-accent pl-4 my-5 text-ink-2 italic text-[16px] leading-[1.65]">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-line my-8" />,
          code: ({ className, children }) => {
            const isBlock = !!className && /^language-/.test(className);
            if (!isBlock) {
              return (
                <code className="font-mono text-[14px] bg-surface-1 text-ink px-1.5 py-0.5 rounded-sm">
                  {children}
                </code>
              );
            }
            return <code className="font-mono text-[14px] text-ink">{children}</code>;
          },
          pre: ({ children }) => (
            <pre className="rounded-md border border-line bg-surface-1 p-4 overflow-x-auto text-[14px] leading-relaxed mb-5">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Widget layout rendered when sections_json is present. */
function DigestWidgets({
  sections,
  weather,
}: {
  sections: DigestSections;
  weather: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      {/* Company weather banner */}
      <div className="rounded-lg bg-accent-soft border border-[rgba(201,133,31,0.18)] px-5 py-3.5 flex items-start gap-3">
        <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-accent mt-1.5" aria-hidden />
        <p className="text-[14px] text-accent-ink leading-[1.55]">{weather}</p>
      </div>

      {/* Metric tiles */}
      <MetricStrip metrics={sections.metrics} />

      {/* Two-column grid: calendar + people */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 items-start">
        <CalendarList events={sections.calendar} />
        <PeopleCards people={sections.people} />
      </div>

      {/* Follow-ups */}
      <FollowUps items={sections.followUps} />

      {/* Attention */}
      <AttentionRows items={sections.attention} />

      {/* Starred unread */}
      <StarredUnread emails={sections.starredUnread} />
    </div>
  );
}

/** Client island: renders the latest digest or triggers generation. */
export function AssistantDigestView({
  userId,
  initialDigest,
}: {
  userId: string;
  initialDigest: DigestDoc | null;
}) {
  const userLatest = useQuery(api.dailyDigests.latestForUser, { user_id: userId });
  const mostRecent = useQuery(api.dailyDigests.mostRecent, {});
  const runMorningBrief = useAction(api.assistantActions.runMorningBrief);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  // Prefer user-specific digest; fall back to most-recent across all users
  // (covers the dev-bypass session where the auth user_id != "dev-operator").
  const digest: DigestDoc | null =
    (userLatest as DigestDoc | null | undefined) ??
    (mostRecent as DigestDoc | null | undefined) ??
    initialDigest;

  // Parse sections_json once — null means fall back to markdown
  const sections: DigestSections | null = (() => {
    if (!digest?.sections_json) return null;
    try {
      return JSON.parse(digest.sections_json) as DigestSections;
    } catch {
      return null;
    }
  })();

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

  const readAloud = useCallback(() => {
    if (!digest) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = digest.markdown
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*{1,2}(.+?)\*{1,2}/g, "$1")
      .replace(/\[(.+?)\]\(.+?\)/g, "$1")
      .replace(/`{1,3}(.+?)`{1,3}/g, "$1")
      .replace(/^[-*]\s+/gm, "")
      .replace(/\n+/g, ". ");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, [digest, speaking]);

  const sendToSlack = useCallback(() => {
    if (!digest) return;
    const subject = encodeURIComponent(`Morning Brief — ${digest.date}`);
    const body = encodeURIComponent(digest.markdown);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }, [digest]);

  if (digest) {
    const generatedTime = digest.created_at ? formatTime(digest.created_at) : "6:00 AM";

    return (
      <div className="max-w-[720px] mx-auto px-6 pt-24 pb-20">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="t-meta text-ink-3 mb-3">Morning brief</p>
            <h1
              className="text-[32px] font-normal leading-[1.15] tracking-[-0.02em] text-ink"
              style={{
                fontFamily: "var(--font-display, Georgia, serif)",
                fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 0',
              }}
            >
              {formatDate(digest.date)}
            </h1>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={readAloud}
              aria-label={speaking ? "Stop reading aloud" : "Read aloud"}
              aria-pressed={speaking}
            >
              <Mic size={14} aria-hidden="true" />
              {speaking ? "Stop" : "Read aloud"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={sendToSlack}
              aria-label="Send brief via email"
            >
              <Send size={14} aria-hidden="true" />
              Send to Slack
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={generate}
              disabled={generating}
              aria-label="Regenerate brief"
            >
              <RefreshCw
                size={14}
                className={generating ? "animate-spin" : ""}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-line mb-8" />

        {/* Brief body — widget layout if sections_json exists, else markdown */}
        <article aria-label="Morning brief content">
          {sections ? (
            <DigestWidgets sections={sections} weather={sections.weather} />
          ) : (
            <DigestMarkdown content={digest.markdown} />
          )}
        </article>

        {error && (
          <p role="alert" className="mt-6 text-sm text-health-bad">
            {error}
          </p>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-line">
          <p className="t-caption text-ink-3">
            Generated {generatedTime === "" ? "6:00 AM" : generatedTime} · Castle + Hermes
          </p>
        </footer>
      </div>
    );
  }

  // Empty state — no brief yet
  return (
    <div className="max-w-[720px] mx-auto px-6 pt-24 pb-20 flex flex-col items-center text-center">
      <p className="t-meta text-ink-3 mb-3">Morning brief</p>
      <h1
        className="text-[32px] font-normal leading-[1.15] tracking-[-0.02em] text-ink mb-4"
        style={{
          fontFamily: "var(--font-display, Georgia, serif)",
          fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 0',
        }}
      >
        {formatDate(new Date().toISOString())}
      </h1>
      <p className="text-[16px] text-ink-2 leading-[1.6] mb-8 max-w-[400px]">
        No brief generated yet today. Run it to see your calendar, open follow-ups, and Castle
        attention items.
      </p>
      <Button onClick={generate} disabled={generating} loading={generating} size="lg">
        Generate today&#39;s brief
      </Button>
      {error && (
        <p role="alert" className="mt-4 text-sm text-health-bad">
          {error}
        </p>
      )}
    </div>
  );
}
