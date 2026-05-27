-- Create traffic events tracking table
CREATE TABLE IF NOT EXISTS public.traffic_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id UUID REFERENCES public.organizacoes(id) ON DELETE CASCADE NOT NULL,
    curso_id UUID REFERENCES public.cursos(id) ON DELETE SET NULL,
    trilha_id UUID REFERENCES public.trilhas(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'checkout_initiated')),
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    visitor_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on traffic_events
ALTER TABLE public.traffic_events ENABLE ROW LEVEL SECURITY;

-- Allow public insertion (for anonymous web traffic)
DROP POLICY IF EXISTS "traffic_events_insert_public" ON public.traffic_events;
CREATE POLICY "traffic_events_insert_public" ON public.traffic_events FOR INSERT WITH CHECK (true);

-- Allow viewing for members of the organization or super_admins
DROP POLICY IF EXISTS "traffic_events_select_policy" ON public.traffic_events;
CREATE POLICY "traffic_events_select_policy" ON public.traffic_events FOR SELECT USING (
    get_user_organizacao_id() = organizacao_id OR get_current_user_role() = 'super_admin'
);

-- Add UTM columns to compras table
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
