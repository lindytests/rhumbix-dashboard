export const dynamic = "force-dynamic";

import { getSenderInboxes, getInboxStats } from "@/lib/db/queries";
import SendersClient from "./senders-client";

export default async function SendersPage() {
  const [inboxes, inboxStats] = await Promise.all([
    getSenderInboxes(),
    getInboxStats(),
  ]);

  return <SendersClient inboxes={inboxes} inboxStats={inboxStats} />;
}
