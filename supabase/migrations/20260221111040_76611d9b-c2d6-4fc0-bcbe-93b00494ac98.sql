
-- Add unique index on question_bank to prevent duplicate questions
-- Using a hash of the question text + exam_type + subject to allow same question across different exams
CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_unique_question 
ON public.question_bank (exam_type, subject, md5(question));

-- Clean up any existing duplicates first (keep the earliest inserted)
DELETE FROM public.question_bank a
USING public.question_bank b
WHERE a.id > b.id
  AND a.exam_type = b.exam_type
  AND a.subject = b.subject
  AND md5(a.question) = md5(b.question);
