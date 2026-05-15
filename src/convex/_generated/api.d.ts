/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _services_auth_landing_resolver from "../_services/auth/landing_resolver.js";
import type * as _services_membership_lifecycle_memberships from "../_services/membership_lifecycle/memberships.js";
import type * as _services_tenant_provisioning_tenants from "../_services/tenant_provisioning/tenants.js";
import type * as _services_user_onboarding_users from "../_services/user_onboarding/users.js";
import type * as _testing_functions from "../_testing/functions.js";
import type * as admin_membership_dashboard_memberships from "../admin/membership_dashboard/memberships.js";
import type * as admin_membership_dashboard_users from "../admin/membership_dashboard/users.js";
import type * as admin_tenant_dashboard_tenants from "../admin/tenant_dashboard/tenants.js";
import type * as auth from "../auth.js";
import type * as auth_current_user from "../auth/current_user.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as tenant_selection_memberships from "../tenant_selection/memberships.js";
import type * as test_helpers_membership from "../test_helpers/membership.js";
import type * as test_helpers_tenant from "../test_helpers/tenant.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_services/auth/landing_resolver": typeof _services_auth_landing_resolver;
  "_services/membership_lifecycle/memberships": typeof _services_membership_lifecycle_memberships;
  "_services/tenant_provisioning/tenants": typeof _services_tenant_provisioning_tenants;
  "_services/user_onboarding/users": typeof _services_user_onboarding_users;
  "_testing/functions": typeof _testing_functions;
  "admin/membership_dashboard/memberships": typeof admin_membership_dashboard_memberships;
  "admin/membership_dashboard/users": typeof admin_membership_dashboard_users;
  "admin/tenant_dashboard/tenants": typeof admin_tenant_dashboard_tenants;
  auth: typeof auth;
  "auth/current_user": typeof auth_current_user;
  functions: typeof functions;
  http: typeof http;
  init: typeof init;
  "tenant_selection/memberships": typeof tenant_selection_memberships;
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
