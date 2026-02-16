
-- Chat messages table for persistent AI conversation history
CREATE TABLE public.ai_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  voice_used BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_ai_chat_messages_user_created ON public.ai_chat_messages (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own messages
CREATE POLICY "Users can view their own chat messages"
ON public.ai_chat_messages FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own messages
CREATE POLICY "Users can insert their own chat messages"
ON public.ai_chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages (clear history)
CREATE POLICY "Users can delete their own chat messages"
ON public.ai_chat_messages FOR DELETE
USING (auth.uid() = user_id);
