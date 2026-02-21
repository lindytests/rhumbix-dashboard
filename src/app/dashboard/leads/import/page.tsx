export const dynamic = "force-dynamic";

import { getCampaigns } from "@/lib/db/queries";
import ImportClient from "./import-client";

export default async function ImportPage() {
  const campaigns = await getCampaigns();
  return <ImportClient campaigns={campaigns} />;
}
