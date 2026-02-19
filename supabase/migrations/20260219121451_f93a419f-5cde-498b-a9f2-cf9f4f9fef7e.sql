
-- Question Bank: Last 5 Years Official Questions
CREATE TABLE public.question_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT,
  year INTEGER NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer INTEGER NOT NULL,
  explanation TEXT,
  previous_year_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Predicted Questions
CREATE TABLE public.predicted_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer INTEGER NOT NULL,
  explanation TEXT,
  probability_level TEXT NOT NULL DEFAULT 'high',
  probability_score INTEGER NOT NULL DEFAULT 80,
  trend_weight NUMERIC(3,2) DEFAULT 0.8,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User practice progress tracking
CREATE TABLE public.practice_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL,
  question_source TEXT NOT NULL DEFAULT 'bank',
  is_correct BOOLEAN,
  selected_answer INTEGER,
  time_taken_seconds INTEGER,
  practiced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predicted_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_progress ENABLE ROW LEVEL SECURITY;

-- Question bank and predicted questions are readable by all authenticated users
CREATE POLICY "Authenticated users can read question bank" ON public.question_bank FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read predicted questions" ON public.predicted_questions FOR SELECT TO authenticated USING (true);

-- Practice progress is user-scoped
CREATE POLICY "Users can read own practice progress" ON public.practice_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own practice progress" ON public.practice_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own practice progress" ON public.practice_progress FOR UPDATE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_question_bank_exam_type ON public.question_bank(exam_type);
CREATE INDEX idx_question_bank_subject ON public.question_bank(subject);
CREATE INDEX idx_question_bank_year ON public.question_bank(year);
CREATE INDEX idx_predicted_questions_exam_type ON public.predicted_questions(exam_type);
CREATE INDEX idx_practice_progress_user ON public.practice_progress(user_id);
