-- Função para excluir uma organização e todos os seus dados vinculados
CREATE OR REPLACE FUNCTION delete_organization(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    is_admin BOOLEAN;
BEGIN
    -- Verificar se o usuário atual é super admin
    SELECT is_super_admin INTO is_admin FROM public.usuarios WHERE id = auth.uid();
    
    IF is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Apenas super admins podem excluir organizações.';
    END IF;

    -- Não permitir excluir a organização padrão (FEBAJU)
    IF org_id = '00000000-0000-0000-0000-000000000000' THEN
        RAISE EXCEPTION 'Não é possível excluir a organização padrão.';
    END IF;

    -- Deletar usuários da organização do auth.users
    -- O ON DELETE CASCADE na tabela usuarios vai limpar a tabela usuarios
    FOR user_record IN SELECT id FROM public.usuarios WHERE organizacao_id = org_id LOOP
        DELETE FROM auth.users WHERE id = user_record.id;
    END LOOP;

    -- Deletar dados de outras tabelas (já que não temos ON DELETE CASCADE no organizacao_id)
    -- Tabelas de Avaliação
    DELETE FROM public.avaliacao_alta_graduacao WHERE organizacao_id = org_id;
    DELETE FROM public.avaliacao_kata WHERE organizacao_id = org_id;
    DELETE FROM public.avaliacao_kihon WHERE organizacao_id = org_id;
    DELETE FROM public.avaliacao_waza WHERE organizacao_id = org_id;
    DELETE FROM public.avaliacoes WHERE organizacao_id = org_id;
    
    -- Tabelas de Provas Teóricas (se existirem)
    DELETE FROM public.prova_respostas WHERE organizacao_id = org_id;
    DELETE FROM public.prova_questoes WHERE organizacao_id = org_id;
    DELETE FROM public.prova_resultados WHERE organizacao_id = org_id;
    DELETE FROM public.provas_teoricas WHERE organizacao_id = org_id;
    DELETE FROM public.questoes_teoricas WHERE organizacao_id = org_id;
    DELETE FROM public.avaliacoes_teoricas WHERE organizacao_id = org_id;
    
    -- Tabelas de Treinamento
    DELETE FROM public.treinamento_avaliacoes WHERE organizacao_id = org_id;
    DELETE FROM public.treinamento_tecnicas WHERE organizacao_id = org_id;
    DELETE FROM public.treinamento_participantes WHERE organizacao_id = org_id;
    DELETE FROM public.treinamentos WHERE organizacao_id = org_id;
    
    -- Tabelas Base
    DELETE FROM public.modulos_avaliacao WHERE organizacao_id = org_id;
    DELETE FROM public.katas WHERE organizacao_id = org_id;
    DELETE FROM public.tecnicas WHERE organizacao_id = org_id;
    DELETE FROM public.avaliadores WHERE organizacao_id = org_id;
    DELETE FROM public.candidatos WHERE organizacao_id = org_id;

    -- Finalmente, deletar a organização
    DELETE FROM public.organizacoes WHERE id = org_id;
END;
$$;

-- Função para promover ou rebaixar um usuário a super admin
CREATE OR REPLACE FUNCTION toggle_super_admin(user_id UUID, make_super_admin BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    -- Verificar se o usuário atual é super admin
    SELECT is_super_admin INTO is_admin FROM public.usuarios WHERE id = auth.uid();
    
    IF is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Apenas super admins podem alterar privilégios de super admin.';
    END IF;

    -- Não permitir que o usuário remova seu próprio privilégio de super admin
    IF user_id = auth.uid() AND make_super_admin = FALSE THEN
        RAISE EXCEPTION 'Você não pode remover seu próprio privilégio de super admin.';
    END IF;

    UPDATE public.usuarios SET is_super_admin = make_super_admin WHERE id = user_id;
END;
$$;
