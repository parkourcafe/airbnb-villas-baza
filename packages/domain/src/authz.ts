import type { MemberRole } from "./enums";

/**
 * Role capability model. Authorization is enforced in the database with RLS;
 * these helpers mirror those rules on the server/UI so mutation controls can be
 * hidden or disabled for roles that the database would reject anyway. They must
 * never be the ONLY gate on a mutation.
 */

/** Roles that may change organization settings and manage membership. */
export function canManageOrganization(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/** Owners and admins manage members and dataset access. */
export function canManageMembers(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Roles that may create/edit working data (watchlists, leads, notes, imports).
 * Viewers are read-only (see AUTH-04). Import/collection is further gated in
 * later milestones.
 */
export function canMutateData(role: MemberRole): boolean {
  return role !== "viewer";
}

/** True only for the read-only role. */
export function isReadOnly(role: MemberRole): boolean {
  return role === "viewer";
}
