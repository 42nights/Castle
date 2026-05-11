"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  // Track what we successfully wrote last; backing this with state (not a ref)
  // means React re-renders when it changes, so the "save now" disabled flag
  // and the autosave guard observe up-to-date values.
  const [lastSaved, setLastSaved] = useState(initialBody);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const clientId = useMemo(
    () => getOrCreateClientId(engagementSlug),
    [engagementSlug],
  );

  // Adopt incoming Convex state when our local copy hasn't diverged.
  //
  // Track by `notes_version` rather than the Doc reference — Convex
  // returns a fresh object on every query refresh, so the reference
  // changes constantly even when content doesn't.
  //
  // Adoption rule: if the live version is newer than our base AND the
  // user hasn't typed past their last save (body === lastSaved), pull
  // the new content in. This catches "another tab wrote A→B while I had
  // no local edits" even when live.notes_current differs from lastSaved.
  const [prevVersion, setPrevVersion] = useState<number | null>(null);
  if (live && live.notes_version !== prevVersion) {
    setPrevVersion(live.notes_version);
    const noLocalEdits = body === lastSaved;
    const liveIsNewer = live.notes_version > baseVersion;
    if (noLocalEdits && liveIsNewer) {
      setBaseVersion(live.notes_version);
      setBody(live.notes_current);
      setLastSaved(live.notes_current);
    }
  }

  const save = useCallback(async () => {
    if (body === lastSaved) return;
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
      setLastSaved(body);
      setSavedAt(new Date());
    }
  }, [body, lastSaved, actorFde, live, baseVersion, clientId, run]);

  // Debounced autosave — setTimeout callback is fine; rule only flags
  // synchronous setState within the effect body.
  useEffect(() => {
    if (body === lastSaved) return;
    const handle = setTimeout(() => {
      void save();
    }, 800);
    return () => clearTimeout(handle);
  }, [body, lastSaved, save]);

  const dirty = body !== lastSaved;

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
          disabled={saving || !dirty}
          className="h-6 px-2 rounded-sm border border-line bg-page text-ink-2 hover:text-ink hover:bg-surface disabled:opacity-40 text-[11px]"
        >
          save now
        </button>
      </div>
    </div>
  );
}
