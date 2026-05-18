"use client";

import { Fragment, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Sentinel appended to the streaming text so the caret rides along with
// the last rendered glyph — regardless of whether that glyph is in a
// paragraph, a table cell, a list item, or a heading. A sibling-after-
// the-markdown caret lands at the bottom of the last block element,
// which is wrong for anything other than a trailing paragraph.
const STREAM_CARET = "CASTLE_STREAM_CARET";

function injectCaret(children: ReactNode, animate: boolean): ReactNode {
  if (typeof children === "string") {
    if (!children.includes(STREAM_CARET)) return children;
    const parts = children.split(STREAM_CARET);
    return parts.map((p, i) => (
      <Fragment key={i}>
        {p}
        {i < parts.length - 1 && (
          <span
            className={[
              "inline-block ml-0.5 w-[2px] h-[14px] -mb-[2px] bg-ink align-baseline",
              animate ? "animate-pulse" : "",
            ].join(" ")}
            aria-hidden
          />
        )}
      </Fragment>
    ));
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => (
      <Fragment key={i}>{injectCaret(c, animate)}</Fragment>
    ));
  }
  return children;
}

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
  streaming,
}: {
  children: string;
  /** When true, append an in-flow blinking caret to the end of the
   *  rendered text. Replaces the old `tail` prop, which positioned the
   *  caret as a sibling after the entire markdown block — that landed
   *  below tables / lists / etc., not where the text actually ends. */
  streaming?: boolean;
}) {
  const source = streaming ? `${children}${STREAM_CARET}` : children;
  const k = (n: ReactNode) => injectCaret(n, !!streaming);
  return (
    <div className="text-[13.5px] leading-[22px] text-ink space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{k(children)}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-ink underline underline-offset-2 decoration-line hover:decoration-ink"
            >
              {k(children)}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{k(children)}</strong>
          ),
          em: ({ children }) => <em className="italic">{k(children)}</em>,
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
          li: ({ children }) => <li className="text-ink">{k(children)}</li>,
          h1: ({ children }) => (
            <h3 className="text-[14px] font-semibold text-ink mt-2">
              {k(children)}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-[13.5px] font-semibold text-ink mt-2">
              {k(children)}
            </h3>
          ),
          h3: ({ children }) => (
            <h3 className="text-[13px] font-semibold text-ink mt-2">
              {k(children)}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[12.5px] font-semibold text-ink-2 uppercase tracking-[0.04em] mt-2">
              {k(children)}
            </h4>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-line pl-3 text-ink-2 italic">
              {k(children)}
            </blockquote>
          ),
          code: (props: { className?: string; children?: ReactNode }) => {
            // react-markdown v10 removed the `inline` prop — discriminate
            // by className (fenced blocks get `language-*`, inline code
            // gets nothing). Treating everything as block forces inline
            // `like-this` to render as a block element with surrounding
            // line breaks, which is what was making chat replies look
            // shattered.
            const { className, children } = props;
            const isBlock = !!className && /^language-/.test(className);
            if (!isBlock) {
              return (
                <code className="num text-[12.5px] bg-surface text-ink px-1 py-px rounded-sm">
                  {k(children)}
                </code>
              );
            }
            return (
              <code className="num text-[12.5px] text-ink block">
                {k(children)}
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
              {k(children)}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1 border-b border-line text-ink">
              {k(children)}
            </td>
          ),
          hr: () => <hr className="border-line my-2" />,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
