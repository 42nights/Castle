/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attention from "../attention.js";
import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as deployments from "../deployments.js";
import type * as engagements from "../engagements.js";
import type * as fdes from "../fdes.js";
import type * as founderHours from "../founderHours.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_bounds from "../lib/bounds.js";
import type * as lib_util from "../lib/util.js";
import type * as patternExtractions from "../patternExtractions.js";
import type * as seed from "../seed.js";
import type * as templates from "../templates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attention: typeof attention;
  customers: typeof customers;
  dashboard: typeof dashboard;
  deployments: typeof deployments;
  engagements: typeof engagements;
  fdes: typeof fdes;
  founderHours: typeof founderHours;
  "lib/audit": typeof lib_audit;
  "lib/bounds": typeof lib_bounds;
  "lib/util": typeof lib_util;
  patternExtractions: typeof patternExtractions;
  seed: typeof seed;
  templates: typeof templates;
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

export declare const components: {};
