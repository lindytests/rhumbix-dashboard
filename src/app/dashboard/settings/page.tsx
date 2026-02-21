export const dynamic = "force-dynamic";

import { getAppSettings } from "@/lib/db/queries";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const settings = await getAppSettings();

  return (
    <SettingsClient
      autoSendEnabled={settings.auto_send_enabled}
      testMode={settings.test_mode}
    />
  );
}
