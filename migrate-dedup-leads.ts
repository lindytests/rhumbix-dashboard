import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL as string);

async function dedupLeads() {
  console.log("=== Step 1: Find duplicate active leads ===");

  // Find email addresses that have more than one active (non-completed,
  // non-failed, non-deleted) lead row
  const dupes = await sql`
    SELECT lower(email) as email, count(*) as cnt,
           array_agg(id ORDER BY created_at ASC) as ids
    FROM leads
    WHERE status NOT IN ('completed', 'failed')
      AND deleted_at IS NULL
    GROUP BY lower(email)
    HAVING count(*) > 1
  `;

  if (dupes.length === 0) {
    console.log("No duplicate active leads found.");
  } else {
    console.log(`Found ${dupes.length} email addresses with duplicate active leads:`);
    let totalDeleted = 0;

    for (const row of dupes) {
      const ids: string[] = row.ids;
      // Keep the first (oldest) lead, soft-delete the rest
      const keepId = ids[0];
      const deleteIds = ids.slice(1);
      console.log(
        `  ${row.email}: ${ids.length} rows — keeping ${keepId}, soft-deleting ${deleteIds.length}`
      );

      await sql`
        UPDATE leads
        SET deleted_at = now(), updated_at = now()
        WHERE id = ANY(${deleteIds})
      `;
      totalDeleted += deleteIds.length;
    }

    console.log(`Soft-deleted ${totalDeleted} duplicate lead rows.`);
  }

  console.log("\n=== Step 2: Normalize email casing ===");

  // Lowercase all email addresses for consistency
  const caseResult = await sql`
    UPDATE leads
    SET email = lower(email), updated_at = now()
    WHERE email != lower(email)
  `;
  console.log(`Normalized ${caseResult.count} email addresses to lowercase.`);

  console.log("\n=== Step 3: Create partial unique index ===");

  // Drop if it already exists (idempotent)
  await sql`
    DROP INDEX IF EXISTS leads_email_active_unique
  `;

  // Partial unique index: only one active lead per email address
  // "Active" = not completed, not failed, and not soft-deleted
  await sql`
    CREATE UNIQUE INDEX leads_email_active_unique
    ON leads (lower(email))
    WHERE status NOT IN ('completed', 'failed') AND deleted_at IS NULL
  `;
  console.log("Created partial unique index: leads_email_active_unique");

  console.log("\n=== Done ===");
  await sql.end();
}

dedupLeads().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
