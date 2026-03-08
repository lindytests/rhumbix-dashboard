export const dynamic = "force-dynamic";

import { getAppSettings, getLeadStats } from "@/lib/db/queries";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const [settings, leadStats] = await Promise.all([
    getAppSettings(),
    getLeadStats(),
  ]);

  return (
    <SettingsClient
      autoSendEnabled={settings.auto_send_enabled}
      testMode={settings.test_mode}
      inProgressCount={leadStats.in_progress}
    />
  );
}
