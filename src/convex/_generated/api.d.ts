/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as functions from "../functions.js";
import type * as functions_test_helper from "../functions_test_helper.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as membership_test_helper from "../membership_test_helper.js";
import type * as memberships from "../memberships.js";
import type * as tenant_test_helper from "../tenant_test_helper.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  functions: typeof functions;
  functions_test_helper: typeof functions_test_helper;
  http: typeof http;
  init: typeof init;
  membership_test_helper: typeof membership_test_helper;
  memberships: typeof memberships;
  tenant_test_helper: typeof tenant_test_helper;
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
