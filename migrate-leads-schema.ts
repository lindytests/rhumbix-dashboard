import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL as string);

async function migrate() {
  // Add per-lead email content columns
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_1_subject TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_1_body TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS wait_after_email_1 INTEGER`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_2_subject TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_2_body TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS wait_after_email_2 INTEGER`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_3_subject TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_3_body TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS wait_after_email_3 INTEGER`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_4_subject TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_4_body TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS wait_after_email_4 INTEGER`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_5_subject TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_5_body TEXT`;

  // Make campaign_id nullable and change FK to SET NULL
  await sql`ALTER TABLE leads ALTER COLUMN campaign_id DROP NOT NULL`;
  await sql`ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_campaign_id_campaigns_id_fk`;
  await sql`ALTER TABLE leads ADD CONSTRAINT leads_campaign_id_campaigns_id_fk FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL`;

  console.log("Schema migration complete: 13 email columns added, campaign_id made nullable");
  await sql.end();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
