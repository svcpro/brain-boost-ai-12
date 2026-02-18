
-- Add action_url and priority columns to notification_history
ALTER TABLE public.notification_history 
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

-- Add index for faster unread queries
CREATE INDEX IF NOT EXISTS idx_notification_history_user_unread 
  ON public.notification_history (user_id, read, created_at DESC);
