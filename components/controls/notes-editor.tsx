"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

type LiveEngagement = {
  _id: string;
  notes_current: string;
  notes_version: number;
};

const STORAGE_PREFIX = "castle.notes-client-id:";

function getOrCreateClientId(engagementSlug: string): string {
  if (typeof window === "undefined") return "ssr";
  const key = STORAGE_PREFIX + engagementSlug;
  let v = sessionStorage.getItem(key);
  if (!v) {
    v = crypto.randomUUID();
    sessionStorage.setItem(key, v);
  }
  return v;
}

export function NotesEditor({
  engagementSlug,
  initialBody,
  initialVersion,
}: {
  engagementSlug: string;
  initialBody: string;
  initialVersion: number;
}) {
  const [actorSlug] = useActorSlug();
  const live = useQuery(api.engagements.getBySlug, { slug: engagementSlug }) as
    | LiveEngagement
    | null
    | undefined;
  const actorFde = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.engagements.saveNotes);

  const [body, setBody] = useState(initialBody);
  const [baseVersion, setBaseVersion] = useState(initialVersion);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const clientId = useMemo(() => getOrCreateClientId(engagementSlug), [engagementSlug]);
  const lastSavedRef = useRef(initialBody);

  // Sync incoming Convex state if our local copy hasn't diverged.
  useEffect(() => {
    if (!live) return;
    if (live.notes_current === lastSavedRef.current) {
      // External update — adopt it.
      if (live.notes_version !== baseVersion) {
        setBaseVersion(live.notes_version);
        setBody(live.notes_current);
        lastSavedRef.current = live.notes_current;
      }
    }
  }, [live, baseVersion]);

  const save = useCallback(async () => {
    if (body === lastSavedRef.current) return;
    if (!actorFde || !live) {
      toast.error(
        !actorFde ? "Pick an actor FDE first." : "Engagement not in Convex.",
      );
      return;
    }
    setSaving(true);
    const result = (await run(
      {
        id: live._id as never,
        actor_fde_id: actorFde._id as never,
        body,
        base_version: baseVersion,
        client_id: clientId,
      },
      { loading: "Saving notes…", success: "Notes saved." },
    )) as { version: number } | undefined;
    setSaving(false);
    if (result) {
      setBaseVersion(result.version);
      lastSavedRef.current = body;
      setSavedAt(new Date());
    }
  }, [body, actorFde, live, baseVersion, clientId, run]);

  // Debounced autosave.
  useEffect(() => {
    if (body === lastSavedRef.current) return;
    const handle = setTimeout(() => {
      void save();
    }, 800);
    return () => clearTimeout(handle);
  }, [body, save]);

  return (
    <div className="border border-line rounded-md bg-page">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        spellCheck={false}
        rows={6}
        className="w-full resize-y bg-page text-ink text-[14.5px] leading-relaxed p-5 focus:outline-none placeholder:text-ink-3 rounded-md"
        placeholder="What's actually happening this week? Be honest with future-you."
      />
      <div className="border-t border-line px-4 py-2 flex items-center justify-between t-caption">
        <span className="text-ink-3">
          v<span className="num">{baseVersion}</span>
          {savedAt && (
            <>
              {" "}
              · saved <span className="num">{savedAt.toLocaleTimeString()}</span>
            </>
          )}
          {saving && " · saving…"}
        </span>
        <button
          onClick={save}
          disabled={saving || body === lastSavedRef.current}
          className="h-6 px-2 rounded-sm border border-line bg-page text-ink-2 hover:text-ink hover:bg-surface disabled:opacity-40 text-[11px]"
        >
          save now
        </button>
      </div>
    </div>
  );
}
