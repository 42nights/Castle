/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentActions from "../agentActions.js";
import type * as agentMessageChunks from "../agentMessageChunks.js";
import type * as agentMessages from "../agentMessages.js";
import type * as agentToolEvents from "../agentToolEvents.js";
import type * as agentTurns from "../agentTurns.js";
import type * as assistantActions from "../assistantActions.js";
import type * as assistantWorkflows from "../assistantWorkflows.js";
import type * as attention from "../attention.js";
import type * as auth from "../auth.js";
import type * as captureInbox from "../captureInbox.js";
import type * as clearAll from "../clearAll.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as dailyDigests from "../dailyDigests.js";
import type * as dashboard from "../dashboard.js";
import type * as deploymentEvents from "../deploymentEvents.js";
import type * as deployments from "../deployments.js";
import type * as emailAllowlist from "../emailAllowlist.js";
import type * as engagements from "../engagements.js";
import type * as fdes from "../fdes.js";
import type * as founderHours from "../founderHours.js";
import type * as http from "../http.js";
import type * as lib_assertOperator from "../lib/assertOperator.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_bounds from "../lib/bounds.js";
import type * as lib_conversationAuth from "../lib/conversationAuth.js";
import type * as lib_org from "../lib/org.js";
import type * as lib_util from "../lib/util.js";
import type * as lib_writeToken from "../lib/writeToken.js";
import type * as migrations from "../migrations.js";
import type * as organizations from "../organizations.js";
import type * as patternExtractions from "../patternExtractions.js";
import type * as seed from "../seed.js";
import type * as suggestions from "../suggestions.js";
import type * as templates from "../templates.js";
import type * as userPreferences from "../userPreferences.js";
import type * as userRecents from "../userRecents.js";
import type * as workflowRuns from "../workflowRuns.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentActions: typeof agentActions;
  agentMessageChunks: typeof agentMessageChunks;
  agentMessages: typeof agentMessages;
  agentToolEvents: typeof agentToolEvents;
  agentTurns: typeof agentTurns;
  assistantActions: typeof assistantActions;
  assistantWorkflows: typeof assistantWorkflows;
  attention: typeof attention;
  auth: typeof auth;
  captureInbox: typeof captureInbox;
  clearAll: typeof clearAll;
  crons: typeof crons;
  customers: typeof customers;
  dailyDigests: typeof dailyDigests;
  dashboard: typeof dashboard;
  deploymentEvents: typeof deploymentEvents;
  deployments: typeof deployments;
  emailAllowlist: typeof emailAllowlist;
  engagements: typeof engagements;
  fdes: typeof fdes;
  founderHours: typeof founderHours;
  http: typeof http;
  "lib/assertOperator": typeof lib_assertOperator;
  "lib/audit": typeof lib_audit;
  "lib/bounds": typeof lib_bounds;
  "lib/conversationAuth": typeof lib_conversationAuth;
  "lib/org": typeof lib_org;
  "lib/util": typeof lib_util;
  "lib/writeToken": typeof lib_writeToken;
  migrations: typeof migrations;
  organizations: typeof organizations;
  patternExtractions: typeof patternExtractions;
  seed: typeof seed;
  suggestions: typeof suggestions;
  templates: typeof templates;
  userPreferences: typeof userPreferences;
  userRecents: typeof userRecents;
  workflowRuns: typeof workflowRuns;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
