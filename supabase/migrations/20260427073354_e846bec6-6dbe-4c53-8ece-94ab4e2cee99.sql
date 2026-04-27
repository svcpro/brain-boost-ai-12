ALTER TABLE public.sms_messages
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_messages_idempotency_key_unique
ON public.sms_messages (idempotency_key)
WHERE idempotency_key IS NOT NULL;