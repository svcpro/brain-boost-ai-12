
-- Fix overly permissive RLS policy on discussion_recommendations
DROP POLICY IF EXISTS "Service role can manage recommendations" ON public.discussion_recommendations;

-- Allow inserts/updates/deletes only for the user's own recommendations
CREATE POLICY "Users can manage their own recommendations"
ON public.discussion_recommendations FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
