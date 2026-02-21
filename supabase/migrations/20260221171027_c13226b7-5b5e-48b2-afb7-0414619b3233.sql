
-- Study Pods table
CREATE TABLE public.study_pods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  exam_type TEXT,
  subject TEXT,
  difficulty_level TEXT DEFAULT 'mixed',
  max_members INTEGER DEFAULT 8,
  is_active BOOLEAN DEFAULT true,
  is_ai_created BOOLEAN DEFAULT false,
  ai_matching_criteria JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Study Pod Members
CREATE TABLE public.study_pod_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id UUID NOT NULL REFERENCES public.study_pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pod_id, user_id)
);

-- Study Pod Messages (for pod chat)
CREATE TABLE public.study_pod_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id UUID NOT NULL REFERENCES public.study_pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_ai_message BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.study_pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_pod_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_pod_messages ENABLE ROW LEVEL SECURITY;

-- study_pods: anyone authenticated can view active pods
CREATE POLICY "Anyone can view active pods" ON public.study_pods FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage pods" ON public.study_pods FOR ALL USING (public.is_admin(auth.uid()));

-- study_pod_members: members can view, users can join/leave
CREATE POLICY "Anyone can view pod members" ON public.study_pod_members FOR SELECT USING (true);
CREATE POLICY "Users can join pods" ON public.study_pod_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave pods" ON public.study_pod_members FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage pod members" ON public.study_pod_members FOR ALL USING (public.is_admin(auth.uid()));

-- study_pod_messages: pod members can read and write
CREATE POLICY "Pod members can view messages" ON public.study_pod_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.study_pod_members WHERE pod_id = study_pod_messages.pod_id AND user_id = auth.uid()));
CREATE POLICY "Pod members can send messages" ON public.study_pod_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.study_pod_members WHERE pod_id = study_pod_messages.pod_id AND user_id = auth.uid()));
CREATE POLICY "Admins manage messages" ON public.study_pod_messages FOR ALL USING (public.is_admin(auth.uid()));

-- Enable realtime for pod messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_pod_messages;

-- Triggers for updated_at
CREATE TRIGGER update_study_pods_updated_at BEFORE UPDATE ON public.study_pods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
