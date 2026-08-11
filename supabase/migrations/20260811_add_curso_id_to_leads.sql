-- Migration: Adiciona curso_id, trilha_id e origem na tabela leads_contato
ALTER TABLE public.leads_contato ADD COLUMN IF NOT EXISTS curso_id uuid REFERENCES public.cursos(id) ON DELETE SET NULL;
ALTER TABLE public.leads_contato ADD COLUMN IF NOT EXISTS trilha_id uuid REFERENCES public.trilhas(id) ON DELETE SET NULL;
ALTER TABLE public.leads_contato ADD COLUMN IF NOT EXISTS origem text DEFAULT 'contato';
