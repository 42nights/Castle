"use client";

// Client component required: reads/writes localStorage and document.classList
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  // Sync from the class that the blocking inline script may have already set
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("castle-theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={[
        "inline-flex items-center justify-center h-7 w-7 rounded-sm",
        "text-ink-3 hover:bg-surface-1 hover:text-ink",
        "transition-colors duration-quick outline-none",
        "focus-visible:shadow-[var(--shadow-focus)]",
      ].join(" ")}
    >
      {isDark ? (
        <Sun size={15} strokeWidth={1.75} aria-hidden />
      ) : (
        <Moon size={15} strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}
