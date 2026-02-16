
-- Add a bookmarked column to ai_chat_messages
ALTER TABLE public.ai_chat_messages ADD COLUMN bookmarked boolean NOT NULL DEFAULT false;
