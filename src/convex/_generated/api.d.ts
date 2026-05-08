/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _testing_functions from "../_testing/functions.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as memberships from "../memberships.js";
import type * as test_helpers_membership from "../test_helpers/membership.js";
import type * as test_helpers_tenant from "../test_helpers/tenant.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_testing/functions": typeof _testing_functions;
  admin: typeof admin;
  auth: typeof auth;
  functions: typeof functions;
  http: typeof http;
  init: typeof init;
  memberships: typeof memberships;
  "test_helpers/membership": typeof test_helpers_membership;
  "test_helpers/tenant": typeof test_helpers_tenant;
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
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
