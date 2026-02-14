
CREATE TABLE public.notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notification_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications read"
ON public.notification_history FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.notification_history FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_notification_history_user_created
ON public.notification_history (user_id, created_at DESC);
