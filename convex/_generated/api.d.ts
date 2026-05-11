/* Shim. Replaced by `npx convex dev` codegen.
 *
 * Declares the api/internal shape for cross-module references during the
 * pre-Convex transition. Once `convex dev` runs, this file is overwritten
 * with strictly-typed FunctionReferences derived from the actual function
 * exports. The shim uses `any` payloads — that's fine for compilation,
 * real types arrive after codegen.
 */

import type { FunctionReference } from "convex/server";

type AnyQuery = FunctionReference<"query", "public", any, any>;
type AnyMutation = FunctionReference<"mutation", "public", any, any>;
type AnyAction = FunctionReference<"action", "public", any, any>;
type AnyInternalQuery = FunctionReference<"query", "internal", any, any>;
type AnyInternalMutation = FunctionReference<"mutation", "internal", any, any>;
type AnyInternalAction = FunctionReference<"action", "internal", any, any>;

export declare const api: {
  dashboard: { overview: AnyQuery };
  fdes: {
    list: AnyQuery;
    getBySlug: AnyQuery;
    create: AnyMutation;
    update: AnyMutation;
    setCapacity: AnyMutation;
    logHours: AnyMutation;
    remove: AnyMutation;
  };
  customers: {
    list: AnyQuery;
    getBySlug: AnyQuery;
    create: AnyMutation;
    update: AnyMutation;
    setHealth: AnyMutation;
    setStatus: AnyMutation;
    setMrr: AnyMutation;
    remove: AnyMutation;
  };
  engagements: {
    list: AnyQuery;
    getBySlug: AnyQuery;
    listAssignments: AnyQuery;
    listUpdatesByEngagement: AnyQuery;
    listNotesByEngagement: AnyQuery;
    create: AnyMutation;
    update: AnyMutation;
    markTouched: AnyMutation;
    movePhase: AnyMutation;
    setProgress: AnyMutation;
    setHealth: AnyMutation;
    reassign: AnyMutation;
    saveNotes: AnyMutation;
    remove: AnyMutation;
  };
  templates: {
    list: AnyQuery;
    getBySlug: AnyQuery;
    listCapabilities: AnyQuery;
    create: AnyMutation;
    update: AnyMutation;
    addCapability: AnyMutation;
    updateCapability: AnyMutation;
    reorderCapability: AnyMutation;
    removeCapability: AnyMutation;
    remove: AnyMutation;
  };
  deployments: {
    list: AnyQuery;
    listByEngagement: AnyQuery;
    listByTemplate: AnyQuery;
    create: AnyMutation;
    update: AnyMutation;
    remove: AnyMutation;
  };
  patternExtractions: {
    list: AnyQuery;
    listByTemplate: AnyQuery;
    listReuses: AnyQuery;
    listAllReuses: AnyQuery;
    extract: AnyMutation;
    update: AnyMutation;
    addReusedCustomer: AnyMutation;
    removeReusedCustomer: AnyMutation;
    remove: AnyMutation;
  };
  founderHours: {
    list: AnyQuery;
    upsertMonth: AnyMutation;
    remove: AnyMutation;
  };
  attention: {
    list: AnyQuery;
    listDismissals: AnyQuery;
    listManualItems: AnyQuery;
    snooze: AnyMutation;
    resolve: AnyMutation;
    clearSnooze: AnyMutation;
    createManualItem: AnyMutation;
    resolveManualItem: AnyMutation;
  };
};

export declare const internal: {
  seed: {
    importPayload: AnyInternalMutation;
  };
};

// Surfaces used only by some imports to silence "unused" warnings:
export type _AnyAction = AnyAction;
export type _AnyInternalQuery = AnyInternalQuery;
export type _AnyInternalAction = AnyInternalAction;
