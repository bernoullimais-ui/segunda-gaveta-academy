-- Add trilha_participantes table and columns
create table if not exists public.trilha_participantes (
    id uuid primary key default uuid_generate_v4(),
    trilha_id uuid references public.trilhas(id) on delete cascade,
    usuario_id uuid references public.usuarios(id) on delete cascade,
    status text default 'andamento' check (status in ('andamento', 'inscrito', 'pendente', 'concluido', 'suspenso')),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(trilha_id, usuario_id)
);

-- Enable RLS
alter table public.trilha_participantes enable row level security;
create policy "Enable all access for now" on public.trilha_participantes for all using (true);
