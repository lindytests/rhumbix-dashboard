export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getLeads, getCampaigns, getAppSettings } from "@/lib/db/queries";
import LeadsClient from "./leads-client";

export default async function LeadsPage() {
  const [leads, campaigns, settings] = await Promise.all([
    getLeads(),
    getCampaigns(),
    getAppSettings(),
  ]);

  return (
    <Suspense>
      <LeadsClient
        leads={leads}
        campaigns={campaigns}
        autoSendEnabled={settings.auto_send_enabled}
      />
    </Suspense>
  );
}
