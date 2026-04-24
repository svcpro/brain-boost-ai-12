
-- 1. Add 'sms' to notification_channel enum if not already present
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'sms' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_channel')
  ) THEN
    ALTER TYPE notification_channel ADD VALUE 'sms';
  END IF;
END $$;
