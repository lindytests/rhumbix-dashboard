ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;
