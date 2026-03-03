import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL as string);

async function migrateData() {
  // Copy campaign email content to all existing leads that have a campaign_id
  const result = await sql`
    UPDATE leads
    SET
      email_1_subject = c.email_1_subject,
      email_1_body = c.email_1_body,
      wait_after_email_1 = c.wait_after_email_1,
      email_2_subject = c.email_2_subject,
      email_2_body = c.email_2_body,
      wait_after_email_2 = c.wait_after_email_2,
      email_3_subject = c.email_3_subject,
      email_3_body = c.email_3_body,
      wait_after_email_3 = c.wait_after_email_3,
      email_4_subject = c.email_4_subject,
      email_4_body = c.email_4_body,
      wait_after_email_4 = c.wait_after_email_4,
      email_5_subject = c.email_5_subject,
      email_5_body = c.email_5_body
    FROM campaigns c
    WHERE leads.campaign_id = c.id
      AND leads.email_1_subject IS NULL
  `;

  console.log(`Data migration complete: ${result.count} leads updated with campaign email content`);
  await sql.end();
}

migrateData().catch((e) => {
  console.error(e);
  process.exit(1);
});
