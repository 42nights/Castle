import { describe, expect, it } from "vitest";
import { slugify } from "./util";
import { checkSlug } from "./bounds";

describe("slugify", () => {
  it("lowercases and replaces runs of non-alnum with single dashes", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("a   b")).toBe("a-b");
    expect(slugify("Foo!!!Bar")).toBe("foo-bar");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("!!!cool!!!")).toBe("cool");
    expect(slugify("---abc---")).toBe("abc");
  });

  it("DECOMPOSES accented Latin chars (was a bug — silently dropped)", () => {
    expect(slugify("José")).toBe("jose");
    expect(slugify("Café")).toBe("cafe");
    expect(slugify("Zoë Smith")).toBe("zoe-smith");
  });

  it("falls back to 'x' for purely non-alnum (e.g. CJK-only)", () => {
    expect(slugify("東京")).toBe("x");
    expect(slugify("!!!")).toBe("x");
    expect(slugify("")).toBe("x");
  });

  it("DOES NOT reintroduce trailing dash after truncation (was a bug)", () => {
    const s = "a".repeat(63) + "!b";
    // Replaces "!" with "-" → 63 a's + "-b", length 65 → slice(0,64)
    // would land on the dash before "b". Now we trim after slice.
    expect(slugify(s).endsWith("-")).toBe(false);
  });

  it("caps at 64 chars", () => {
    const long = "x".repeat(120);
    expect(slugify(long).length).toBeLessThanOrEqual(64);
  });
});

describe("checkSlug", () => {
  it("accepts canonical slugs slugify produces", () => {
    expect(checkSlug("slug", "abc")).toBe("abc");
    expect(checkSlug("slug", "hello-world")).toBe("hello-world");
    expect(checkSlug("slug", "test-customer-2")).toBe("test-customer-2");
  });

  it("REJECTS double-dashes and trailing dashes (was permissive)", () => {
    expect(() => checkSlug("slug", "a--b")).toThrow(/canonical/);
    expect(() => checkSlug("slug", "abc-")).toThrow(/canonical/);
    expect(() => checkSlug("slug", "-abc")).toThrow(/canonical/);
  });

  it("rejects empty string and non-string input", () => {
    expect(() => checkSlug("slug", "")).toThrow(/cannot be empty/);
    expect(() =>
      checkSlug("slug", null as unknown as string),
    ).toThrow();
  });
});
