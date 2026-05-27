-- Academia Digital - Schema Setup
-- Author: AI Coding Agent
-- Description: Base schema for the generic courses platform, compatible with existing components.

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. ORGANIZATIONS (TENANTS)
create table if not exists public.organizacoes (
    id uuid primary key default uuid_generate_v4(),
    nome text not null,
    logo_url text,
    cor_primaria text default '#6366f1',
    config_json jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now()
);

-- 3. USERS (PROFILES)
create table if not exists public.usuarios (
    id uuid primary key default uuid_generate_v4(), -- Starts as a random UUID if pre-created
    email text not null unique,
    nome text,
    role text not null check (role in ('gestor', 'curador', 'design', 'especialista', 'professor_convidado', 'membro', 'super_admin', 'aluno')),
    organizacao_id uuid references public.organizacoes(id),
    telefone text,
    cpf text,
    avatar_url text,
    codigo_convite text unique, -- Code to find this row during first access
    auth_id uuid references auth.users(id) on delete cascade unique, -- Linked after signup
    bio text,
    curriculo_json jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 4. COURSES
create table if not exists public.cursos (
    id uuid primary key default uuid_generate_v4(),
    organizacao_id uuid references public.organizacoes(id) on delete cascade,
    nome text not null,
    descricao text,
    thumbnail_url text,
    categoria text,
    status text default 'rascunho', -- rascunho, publicado, arquivado, em_breve
    especialista_id uuid references public.usuarios(id),
    professor_nome text,
    professor_titulo text,
    professor_foto_url text,
    preco text default 'gratuito', -- gratuito, pago
    valor decimal(10,2),
    ritmo text default 'proprio', -- proprio, programado
    tempo text default 'sem_limite', -- sem_limite, com_limite
    duracao integer,
    duracao_tipo text default 'Dias',
    carga_horaria text,
    em_breve boolean default false,
    tem_certificado boolean default true,
    curriculo_json jsonb default '[]'::jsonb, -- Stores modules and lessons as a single JSON
    configuracao_json jsonb default '{}'::jsonb,
    certificado_template jsonb default '{}'::jsonb,
    ordem integer default 0,
    created_at timestamp with time zone default now()
);

-- 5. TRILHAS (TRAILS / LEARNING PATHS)
create table if not exists public.trilhas (
    id uuid primary key default uuid_generate_v4(),
    organizacao_id uuid references public.organizacoes(id) on delete cascade,
    nome text not null,
    descricao text,
    capa_url text,
    preco decimal(10,2) default 0.00,
    em_breve boolean default false,
    ativo boolean default true,
    ordem integer default 0,
    created_at timestamp with time zone default now()
);

-- 6. TRILHA_CURSOS (JUNCTION)
create table if not exists public.trilha_cursos (
    id uuid primary key default uuid_generate_v4(),
    trilha_id uuid references public.trilhas(id) on delete cascade,
    curso_id uuid references public.cursos(id) on delete cascade,
    ordem integer default 0,
    unique(trilha_id, curso_id)
);

-- 7. THEORETICAL QUESTIONS (FOR QUIZZES)
create table if not exists public.questoes_teoricas (
    id uuid primary key default uuid_generate_v4(),
    titulo text,
    tema text,
    dificuldade text,
    enunciado text,
    opcoes jsonb default '[]'::jsonb, -- Array of strings or objects {text, isCorrect}
    correta text, -- index or reference to the correct option
    created_at timestamp with time zone default now()
);

-- 8. ENROLLMENTS & PROGRESS (MATCHING CODE)
create table if not exists public.curso_participantes (
    id uuid primary key default uuid_generate_v4(),
    curso_id uuid references public.cursos(id) on delete cascade,
    usuario_id uuid references public.usuarios(id) on delete cascade,
    status text default 'andamento' check (status in ('andamento', 'concluido', 'inscrito', 'pendente', 'suspenso')),
    progresso numeric default 0,
    completed_steps jsonb default '[]'::jsonb, -- Store list of completed lesson IDs
    quiz_scores jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(curso_id, usuario_id)
);

-- 8.1 TRILHA PARTICIPANTS
create table if not exists public.trilha_participantes (
    id uuid primary key default uuid_generate_v4(),
    trilha_id uuid references public.trilhas(id) on delete cascade,
    usuario_id uuid references public.usuarios(id) on delete cascade,
    status text default 'andamento' check (status in ('andamento', 'inscrito', 'pendente', 'concluido', 'suspenso')),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(trilha_id, usuario_id)
);

-- 9. COMMUNITY POSTS
create table if not exists public.community_posts (
    id uuid primary key default uuid_generate_v4(),
    organizacao_id uuid references public.organizacoes(id) on delete cascade,
    autor_id uuid references public.usuarios(id) on delete cascade,
    titulo text,
    conteudo text not null,
    midia_url text,
    tags text[],
    pinned boolean default false,
    likes_count integer default 0,
    comments_count integer default 0,
    created_at timestamp with time zone default now()
);

-- 10. COMMUNITY COMMENTS
create table if not exists public.community_comments (
    id uuid primary key default uuid_generate_v4(),
    post_id uuid references public.community_posts(id) on delete cascade,
    autor_id uuid references public.usuarios(id) on delete cascade,
    conteudo text not null,
    created_at timestamp with time zone default now()
);

-- 11. COMMUNITY LIKES
create table if not exists public.community_likes (
    id uuid primary key default uuid_generate_v4(),
    post_id uuid references public.community_posts(id) on delete cascade,
    usuario_id uuid references public.usuarios(id) on delete cascade,
    created_at timestamp with time zone default now(),
    unique(post_id, usuario_id)
);

-- 12. RLS POLICIES (Example)

alter table public.organizacoes enable row level security;
alter table public.usuarios enable row level security;
alter table public.cursos enable row level security;
alter table public.trilhas enable row level security;
alter table public.trilha_cursos enable row level security;
alter table public.questoes_teoricas enable row level security;
alter table public.curso_participantes enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;

-- DEFAULT POLICIES
drop policy if exists "Enable public access for now" on public.organizacoes;
create policy "Enable all access for now" on public.organizacoes for all using (true);

drop policy if exists "Enable all access for now" on public.usuarios;
create policy "Enable all access for now" on public.usuarios for all using (true);

drop policy if exists "Enable all access for now" on public.cursos;
create policy "Enable all access for now" on public.cursos for all using (true);

drop policy if exists "Enable all access for now" on public.trilhas;
create policy "Enable all access for now" on public.trilhas for all using (true);

drop policy if exists "Enable all access for now" on public.trilha_cursos;
create policy "Enable all access for now" on public.trilha_cursos for all using (true);

drop policy if exists "Enable all access for now" on public.questoes_teoricas;
create policy "Enable all access for now" on public.questoes_teoricas for all using (true);

drop policy if exists "Enable all access for now" on public.curso_participantes;
create policy "Enable all access for now" on public.curso_participantes for all using (true);

drop policy if exists "Enable all access for now" on public.community_posts;
create policy "Enable all access for now" on public.community_posts for all using (true);

drop policy if exists "Enable all access for now" on public.community_comments;
create policy "Enable all access for now" on public.community_comments for all using (true);

drop policy if exists "Enable all access for now" on public.community_likes;
create policy "Enable all access for now" on public.community_likes for all using (true);

-- 13. REAL-TIME
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_posts') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_comments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_likes') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.community_likes;
    END IF;
END $$;

-- 14. DATA INITIALIZATION (OPTIONAL)
-- Insert a test organization and a super admin invitation code
-- insert into public.organizacoes (id, nome) values ('00000000-0000-0000-0000-000000000000', 'Academia Digital Demo');
-- insert into public.usuarios (nome, email, role, organizacao_id, codigo_convite) 
-- values ('Super Admin', 'admin@demo.com', 'super_admin', '00000000-0000-0000-0000-000000000000', 'SUPER123');
