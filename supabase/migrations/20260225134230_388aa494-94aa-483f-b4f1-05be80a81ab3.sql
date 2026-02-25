-- Remove sensitive secret columns from razorpay_config table
-- Edge functions already use Deno.env.get() for these secrets
ALTER TABLE public.razorpay_config DROP COLUMN IF EXISTS test_key_secret;
ALTER TABLE public.razorpay_config DROP COLUMN IF EXISTS live_key_secret;
ALTER TABLE public.razorpay_config DROP COLUMN IF EXISTS webhook_secret;

-- Add comment documenting that secrets are managed via edge function environment variables
COMMENT ON TABLE public.razorpay_config IS 'Non-sensitive Razorpay configuration only. All secrets (API keys, webhook secrets) are stored as edge function environment variables, not in the database.';