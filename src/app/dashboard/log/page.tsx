export const dynamic = "force-dynamic";

import { getSendLogs } from "@/lib/db/queries";
import LogClient from "./log-client";

export default async function LogPage() {
  const logs = await getSendLogs();
  return <LogClient logs={logs} />;
}
