-- Drop the unused razorpay_credentials table that stores secrets in plaintext
-- All Razorpay integration code uses environment variables instead
DROP TABLE IF EXISTS public.razorpay_credentials;