-- Prevent the same email number from being sent to the same lead more than once.
-- This is the hard DB-level safety net backing the application-level guards.
CREATE UNIQUE INDEX IF NOT EXISTS send_logs_lead_email_sent_unique
  ON send_logs (lead_id, email_number)
  WHERE status = 'sent';
