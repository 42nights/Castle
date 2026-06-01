import type { DigestSections } from "@/convex/dailyDigests";

type EmailRow = DigestSections["starredUnread"][number];

export function StarredUnread({ emails }: { emails: EmailRow[] }) {
  return (
    <section aria-label="Starred unread emails">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="t-h2">Starred unread</h2>
        <span className="t-caption">{emails.length} messages</span>
      </div>
      <div className="rounded-lg bg-canvas shadow-[var(--shadow-base)] overflow-hidden">
        {emails.map((email, i) => (
          <div
            key={i}
            className={`px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}
          >
            <div className="flex items-baseline gap-2 mb-0.5">
              {/* Unread dot */}
              <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-accent mt-0.5" aria-hidden />
              <span className="text-[13px] font-medium text-ink leading-snug">{email.sender}</span>
              <span className="flex-1 min-w-0 text-[13px] text-ink truncate">{email.subject}</span>
            </div>
            <p className="text-[12px] text-ink-3 leading-snug pl-3.5 truncate">{email.preview}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
