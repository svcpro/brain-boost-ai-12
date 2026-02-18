
-- Add Twilio Content SID column for approved template sending
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS twilio_content_sid TEXT DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.whatsapp_templates.twilio_content_sid IS 'Twilio Content Template SID (e.g. HXXXXXXXXXXX) for sending approved WhatsApp templates via ContentSid instead of freeform Body';
