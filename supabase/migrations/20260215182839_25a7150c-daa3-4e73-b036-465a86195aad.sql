
-- Allow admins to view all user subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.user_subscriptions
FOR SELECT
USING (is_admin(auth.uid()));

-- Allow admins to update user subscriptions (plan changes, status)
CREATE POLICY "Admins can update subscriptions"
ON public.user_subscriptions
FOR UPDATE
USING (is_admin(auth.uid()));

-- Allow admins to insert subscriptions (manual plan assignment)
CREATE POLICY "Admins can insert subscriptions"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Allow admins to view all study logs for analytics
CREATE POLICY "Admins can view all study logs"
ON public.study_logs
FOR SELECT
USING (is_admin(auth.uid()));

-- Allow admins to update user profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_admin(auth.uid()));

-- Allow admins to view all subjects
CREATE POLICY "Admins can view all subjects"
ON public.subjects
FOR SELECT
USING (is_admin(auth.uid()));

-- Allow admins to view all topics
CREATE POLICY "Admins can view all topics"
ON public.topics
FOR SELECT
USING (is_admin(auth.uid()));
