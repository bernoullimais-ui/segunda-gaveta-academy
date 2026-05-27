-- Função para criar uma organização e vincular o usuário atual como admin
-- Usada no fluxo de Onboarding (Self-Service)

CREATE OR REPLACE FUNCTION public.create_organization_and_admin(
    p_nome_organizacao TEXT,
    p_nome_admin TEXT
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_org_id UUID;
    v_existing_user UUID;
    v_source_org_id UUID;
BEGIN
    -- Obter o ID do usuário autenticado
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    -- Obter o email do usuário
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    -- Verificar se o usuário já existe na tabela usuarios
    SELECT id INTO v_existing_user FROM public.usuarios WHERE id = v_user_id;
    
    IF v_existing_user IS NOT NULL THEN
        RAISE EXCEPTION 'Usuário já possui um perfil vinculado';
    END IF;

    -- Encontrar a organização do super admin (ou a primeira organização) para copiar os dados base
    SELECT organizacao_id INTO v_source_org_id FROM public.usuarios WHERE is_super_admin = TRUE LIMIT 1;
    
    IF v_source_org_id IS NULL THEN
        -- Fallback para a organização mais antiga se não houver super admin
        SELECT id INTO v_source_org_id FROM public.organizacoes ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- 1. Criar a organização
    INSERT INTO public.organizacoes (nome)
    VALUES (p_nome_organizacao)
    RETURNING id INTO v_org_id;

    -- 2. Criar o perfil do usuário como admin dessa organização
    INSERT INTO public.usuarios (id, organizacao_id, email, nome, role)
    VALUES (v_user_id, v_org_id, v_user_email, p_nome_admin, 'admin');

    -- 3. Copiar Técnicas
    IF v_source_org_id IS NOT NULL THEN
        INSERT INTO public.tecnicas (nome, grupo, fase, organizacao_id)
        SELECT nome, grupo, fase, v_org_id
        FROM public.tecnicas
        WHERE organizacao_id = v_source_org_id;

        -- 4. Copiar Katas
        INSERT INTO public.katas (nome, ordem, organizacao_id)
        SELECT nome, ordem, v_org_id
        FROM public.katas
        WHERE organizacao_id = v_source_org_id;
    END IF;

    -- Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'organizacao_id', v_org_id,
        'usuario_id', v_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
