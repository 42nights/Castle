"use client";

// EmptyState — shown when messages.length === 0.
// Extracted from chat-landing.tsx.

type Props = {
  suggestions: string[];
  onPick: (s: string) => void;
};

export function EmptyState({ suggestions, onPick }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
          What needs handling?
        </h1>
        <p className="mt-1 text-[12.5px] text-ink-3 leading-snug">
          Each chat in the left rail has its own session, so memory is scoped per thread.
        </p>
      </div>
      <ul className="flex flex-col gap-1">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="group w-full text-left rounded-sm border border-line bg-page px-3 py-2 text-[13px] text-ink-2 hover:text-ink hover:border-line-strong flex items-center justify-between transition-colors"
            >
              <span>{s}</span>
              <span className="text-ink-3 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
