"use server";

import { cookies } from "next/headers";
import { DATASET_COOKIE, ORG_COOKIE } from "./selection";

const ONE_YEAR = 60 * 60 * 24 * 365;

const cookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: ONE_YEAR,
};

/** Persist the selected organization. Membership is still enforced by RLS. */
export async function selectOrganization(
  organizationId: string,
): Promise<void> {
  const store = await cookies();
  store.set(ORG_COOKIE, organizationId, cookieOptions);
}

/** Persist the selected dataset. Access is still enforced by RLS. */
export async function selectDataset(datasetId: string): Promise<void> {
  const store = await cookies();
  store.set(DATASET_COOKIE, datasetId, cookieOptions);
}
