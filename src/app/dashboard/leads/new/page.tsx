export const dynamic = "force-dynamic";

import { getCampaigns } from "@/lib/db/queries";
import NewLeadClient from "./new-lead-client";

export default async function NewLeadPage() {
  const campaigns = await getCampaigns();
  return <NewLeadClient campaigns={campaigns} />;
}
