/* Shim. Replaced by `npx convex dev` codegen. */
import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const api: FilterApi<
  ApiFromModules<Record<string, never>>,
  FunctionReference<any, "public">
>;
declare const internal: FilterApi<
  ApiFromModules<Record<string, never>>,
  FunctionReference<any, "internal">
>;

export { api, internal };
