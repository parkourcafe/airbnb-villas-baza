import { cookies } from "next/headers";

export const ORG_COOKIE = "bai_org";
export const DATASET_COOKIE = "bai_dataset";

export interface Selection {
  organizationId: string | null;
  datasetId: string | null;
}

/** Read the persisted organization/dataset selection from cookies. */
export async function readSelection(): Promise<Selection> {
  const store = await cookies();
  return {
    organizationId: store.get(ORG_COOKIE)?.value ?? null,
    datasetId: store.get(DATASET_COOKIE)?.value ?? null,
  };
}
