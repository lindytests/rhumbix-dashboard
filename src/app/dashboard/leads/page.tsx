export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getLeads, getAppSettings } from "@/lib/db/queries";
import LeadsClient from "./leads-client";

export default async function LeadsPage() {
  const [leads, settings] = await Promise.all([
    getLeads(),
    getAppSettings(),
  ]);

  return (
    <Suspense>
      <LeadsClient
        leads={leads}
        autoSendEnabled={settings.auto_send_enabled}
      />
    </Suspense>
  );
}
