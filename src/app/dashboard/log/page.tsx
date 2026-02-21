export const dynamic = "force-dynamic";

import { getSendLogs, getCampaigns } from "@/lib/db/queries";
import LogClient from "./log-client";

export default async function LogPage() {
  const [logs, campaigns] = await Promise.all([
    getSendLogs(),
    getCampaigns(),
  ]);

  return <LogClient logs={logs} campaigns={campaigns} />;
}
