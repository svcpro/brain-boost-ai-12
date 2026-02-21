-- Allow public read of basic institution info for subdomain routing
CREATE POLICY "Public can read active institutions by slug"
ON public.institutions
FOR SELECT
USING (is_active = true);