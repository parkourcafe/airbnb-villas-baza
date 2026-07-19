import type { AccessLevel, DatasetStatus, MemberRole } from "./enums";

/**
 * Identity and tenancy entity shapes (Milestone 1). These are the domain-level
 * representations; the database row types live in `@bai/db`.
 */
export interface Profile {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  timezone: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  planCode: string;
  defaultTimezone: string;
}

export interface OrganizationMembership {
  organizationId: string;
  userId: string;
  role: MemberRole;
}

/** An organization the current user belongs to, with their role in it. */
export interface OrganizationWithRole extends Organization {
  role: MemberRole;
}

export interface Dataset {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: DatasetStatus;
  isDemo: boolean;
}

/** A dataset the current organization can reach, with the access level. */
export interface DatasetWithAccess extends Dataset {
  accessLevel: AccessLevel;
}
