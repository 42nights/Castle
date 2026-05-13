"use client";

import { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders assistant text as markdown with chat-appropriate styling.
 *
 * - Headings sit at body-size to avoid breaking the chat flow.
 * - Code blocks get a panel border and mono font.
 * - Lists, bold, italic, links rendered with Castle's ink palette.
 * - Whitespace preserved between block elements via tailwind margins.
 */
export function ChatMarkdown({
  children,
  tail,
}: {
  children: string;
  /** Optional element appended after the last block — used for the
   *  blinking streaming caret so it sits at the actual end of text. */
  tail?: ReactNode;
}) {
  return (
    <div className="text-[13.5px] leading-[22px] text-ink space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="whitespace-pre-wrap">{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-ink underline underline-offset-2 decoration-line hover:decoration-ink"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 space-y-0.5">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 space-y-0.5">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-ink">{children}</li>,
          h1: ({ children }) => (
            <h3 className="text-[14px] font-semibold text-ink mt-2">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-[13.5px] font-semibold text-ink mt-2">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h3 className="text-[13px] font-semibold text-ink mt-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[12.5px] font-semibold text-ink-2 uppercase tracking-[0.04em] mt-2">
              {children}
            </h4>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-line pl-3 text-ink-2 italic">
              {children}
            </blockquote>
          ),
          code: (props: { inline?: boolean; children?: ReactNode }) => {
            const { inline, children } = props;
            if (inline) {
              return (
                <code className="num text-[12.5px] bg-surface text-ink px-1 py-px rounded-sm">
                  {children}
                </code>
              );
            }
            return (
              <code className="num text-[12.5px] text-ink block">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="rounded-sm border border-line bg-surface p-2.5 overflow-x-auto text-[12.5px] leading-[18px]">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-line">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="text-left px-2 py-1 font-semibold text-ink uppercase text-[10.5px] tracking-[0.06em]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1 border-b border-line text-ink">
              {children}
            </td>
          ),
          hr: () => <hr className="border-line my-2" />,
        }}
      >
        {children}
      </ReactMarkdown>
      {tail}
    </div>
  );
}
