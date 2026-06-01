"use client";

// Tool-result renderer registry.
// Maps normalized tool name → renderer component.
// "Normalized" = strip "castle." or "castle_" prefix, lowercase.

import type { ReactNode } from "react";

export type RendererCtx = {
  /** How many turns ago this tool ran. Used for auto-collapse. */
  turnsAgo: number;
};

export type ToolRenderer = (result: unknown, ctx: RendererCtx) => ReactNode;

// Strip "castle." or "castle_" prefix from a raw tool name.
export function normalizeToolName(raw: string): string {
  return raw.replace(/^castle[._]/i, "").toLowerCase();
}

// The registry itself — populated in tool-result.tsx where the actual
// React component imports live. This module exports only types + the
// normalize helper so it can be imported in non-React contexts.
const registry = new Map<string, ToolRenderer>();

export function registerRenderer(name: string, renderer: ToolRenderer): void {
  registry.set(name, renderer);
}

export function getRenderer(rawName: string): ToolRenderer | undefined {
  const key = normalizeToolName(rawName);
  return registry.get(key);
}
