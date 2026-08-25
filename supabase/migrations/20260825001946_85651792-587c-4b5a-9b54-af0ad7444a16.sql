CREATE TYPE public.palpite_status AS ENUM ('pendente', 'green', 'red');

CREATE TABLE public.palpites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id INTEGER,
  team_name TEXT NOT NULL,
  team_logo TEXT,
  market TEXT NOT NULL,
  rate NUMERIC(5,1),
  sample INTEGER,
  match_date DATE,
  note TEXT,
  status public.palpite_status NOT NULL DEFAULT 'pendente',
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.palpites TO authenticated;
GRANT ALL ON public.palpites TO service_role;

ALTER TABLE public.palpites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own palpites"
  ON public.palpites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own palpites"
  ON public.palpites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own palpites"
  ON public.palpites FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own palpites"
  ON public.palpites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX palpites_user_created_idx ON public.palpites (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_palpites_updated_at
BEFORE UPDATE ON public.palpites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();