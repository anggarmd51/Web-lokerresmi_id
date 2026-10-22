-- RLS does not protect TRUNCATE. Neither client role needs trigger creation.
-- Preserve every other grant and all existing RLS policies.
REVOKE TRUNCATE, TRIGGER ON TABLE public.profiles FROM anon, authenticated;
