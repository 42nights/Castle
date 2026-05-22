import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  Customer,
  Deployment,
  Engagement,
  FDE,
  FounderHoursEntry,
  PatternExtraction,
  Template,
} from "./types";

const DATA_DIR = join(process.cwd(), "data");

/**
 * Defensive JSON loader. A missing or malformed fixture file should NOT
 * crash an entire page render — log and return an empty default. The
 * page degrades to "no data" instead of a 500.
 */
function read<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, file), "utf8")) as T;
  } catch (err) {
    console.error(`[lib/data] failed to read ${file}:`, err);
    return fallback;
  }
}

export function loadFdes(): FDE[] {
  // tags column is newer than the JSON fixture; default to [] so the
  // shape is uniform downstream (FDE.tags is required after this read).
  const raw = read<Array<Omit<FDE, "tags"> & { tags?: string[] }>>(
    "fdes.json",
    [],
  );
  return raw.map((f) => ({ ...f, tags: f.tags ?? [] }));
}
export function loadCustomers(): Customer[] {
  return read<Customer[]>("customers.json", []);
}
export function loadEngagements(): Engagement[] {
  return read<Engagement[]>("engagements.json", []);
}
export function loadTemplates(): Template[] {
  // tags column is newer than the fixture; coerce missing → [] so the
  // shape is uniform downstream.
  const raw = read<Array<Omit<Template, "tags"> & { tags?: string[] }>>(
    "templates.json",
    [],
  );
  return raw.map((t) => ({ ...t, tags: t.tags ?? [] }));
}
export function loadDeployments(): Deployment[] {
  return read<Deployment[]>("deployments.json", []);
}
export function loadPatternExtractions(): PatternExtraction[] {
  return read<PatternExtraction[]>("pattern_extractions.json", []);
}
export function loadFounderHours(): FounderHoursEntry[] {
  return read<FounderHoursEntry[]>("founder_hours.json", []);
}

export function loadAll() {
  return {
    fdes: loadFdes(),
    customers: loadCustomers(),
    engagements: loadEngagements(),
    templates: loadTemplates(),
    deployments: loadDeployments(),
    patternExtractions: loadPatternExtractions(),
    founderHours: loadFounderHours(),
  };
}
