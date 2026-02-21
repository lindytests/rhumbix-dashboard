-- Add soft-delete column to leads table
ALTER TABLE leads ADD COLUMN deleted_at timestamptz;

-- Partial index: quickly find non-deleted leads
CREATE INDEX idx_leads_deleted_at ON leads (deleted_at) WHERE deleted_at IS NULL;
