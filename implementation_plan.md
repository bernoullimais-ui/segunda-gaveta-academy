# Implementação: Entrar como Usuário (Impersonate)

## Objetivo
Criar a funcionalidade para o `super_admin` acessar a plataforma simulando a visão e as funcionalidades de outro usuário selecionado na lista de Membros & Equipe.

## Proposta
1. **PerfisAdmin.tsx**:
   - Adicionar o botão 'Acessar como' (ícone de LogIn ou Eye) ao lado das ações (lápis, lixeira) do usuário.
   - Quando o botão for clicado, disparar um evento (ex: `window.dispatchEvent`) ou usar um estado global/LocalStorage para definir o `impersonatedUserId`.
   
2. **App.tsx (Raiz)**:
   - Escutar o estado de `impersonatedUser`.
   - Se houver um usuário sendo impersonado, o `App.tsx` substituirá o `loggedUser` principal pelas informações do usuário selecionado.
   - Exibir uma barra fixa no topo ou rodapé da tela: **"Você está visualizando a plataforma como [Nome]. [Voltar para Super Admin]"**.
   - Todos os componentes filhos vão receber o `role` e as informações do usuário impersonado, alterando as permissões e telas visíveis.

> [!WARNING]
> Como a plataforma não troca a sessão real de login por questões de segurança (para você não precisar saber a senha deles), algumas ações que dependem de checagem do banco de dados na hora de salvar (ex: envio de mensagens no chat) continuarão registrando que foi o seu *usuário real* (o seu e-mail) que fez a ação no banco, embora a interface seja a do usuário escolhido. Essa abordagem é feita para permitir a validação visual sem comprometer a segurança.

## Você aprova essa abordagem?
