import { describe, expect, it } from "vitest";
import {
  formatHours,
  formatMonth,
  formatNumber,
  formatPct,
  formatRelativeDays,
  formatUsd,
  formatUsdCompact,
} from "./format";

describe("formatUsdCompact", () => {
  it("$0 for zero", () => {
    expect(formatUsdCompact(0)).toBe("$0");
  });

  it("renders <$1K as raw dollars", () => {
    expect(formatUsdCompact(500)).toBe("$500");
    expect(formatUsdCompact(999)).toBe("$999");
  });

  it("renders $1K–$9.9K with 1 decimal", () => {
    expect(formatUsdCompact(1_000)).toBe("$1.0K");
    expect(formatUsdCompact(1_500)).toBe("$1.5K");
    expect(formatUsdCompact(9_999)).toBe("$10.0K");
  });

  it("renders $10K–$999K rounded to whole K", () => {
    expect(formatUsdCompact(10_000)).toBe("$10K");
    expect(formatUsdCompact(406_200)).toBe("$406K");
    expect(formatUsdCompact(999_400)).toBe("$999K");
  });

  it("ESCALATES boundary $999.5K+ to $1M (was a bug: rendered $1000K)", () => {
    expect(formatUsdCompact(999_500)).toBe("$1M");
    expect(formatUsdCompact(999_999)).toBe("$1M");
  });

  it("renders $1M+ with M suffix", () => {
    expect(formatUsdCompact(1_000_000)).toBe("$1M");
    expect(formatUsdCompact(1_500_000)).toBe("$1.50M");
    expect(formatUsdCompact(12_300_000)).toBe("$12.30M");
  });

  it("handles negatives via abs", () => {
    expect(formatUsdCompact(-406_200)).toBe("$-406K");
  });
});

describe("formatUsd", () => {
  it("renders en-US currency with no decimals", () => {
    expect(formatUsd(1234)).toBe("$1,234");
    expect(formatUsd(0)).toBe("$0");
  });
});

describe("formatPct", () => {
  it("renders fraction × 100 with optional digits", () => {
    expect(formatPct(0.5)).toBe("50%");
    expect(formatPct(0.123, 1)).toBe("12.3%");
    expect(formatPct(0)).toBe("0%");
  });
});

describe("formatHours", () => {
  it("rounds and adds h suffix", () => {
    expect(formatHours(42)).toBe("42h");
    expect(formatHours(42.6)).toBe("43h");
    expect(formatHours(1234)).toBe("1,234h");
  });
});

describe("formatNumber", () => {
  it("locale-string with commas", () => {
    expect(formatNumber(1_000_000)).toBe("1,000,000");
  });
});

describe("formatMonth", () => {
  it("renders YYYY-MM as 'Mon ’YY'", () => {
    expect(formatMonth("2026-05")).toBe("May ’26");
    expect(formatMonth("2025-12")).toBe("Dec ’25");
  });
});

describe("formatRelativeDays", () => {
  const today = new Date("2026-05-11T12:00:00Z");
  it("renders 'today' / 'yesterday' / 'Nd ago'", () => {
    expect(formatRelativeDays("2026-05-11T12:00:00Z", today)).toBe("today");
    expect(formatRelativeDays("2026-05-10T12:00:00Z", today)).toBe("yesterday");
    expect(formatRelativeDays("2026-05-04T12:00:00Z", today)).toBe("7d ago");
  });
  it("renders 'in Nd' for near-future dates", () => {
    expect(formatRelativeDays("2026-05-13T12:00:00Z", today)).toBe("in 2d");
  });
});
