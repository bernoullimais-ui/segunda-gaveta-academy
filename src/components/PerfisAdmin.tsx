import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, User, Mail, Shield, UserPlus, Trash2, Edit2, Filter, ChevronRight, MoreHorizontal, Users, Link, Save, Copy, Plus, X, FileText, Clipboard } from 'lucide-react';

interface PerfisAdminProps {
  loggedUser?: any;
  loggedRole?: string;
}

export function PerfisAdmin({ loggedUser, loggedRole }: PerfisAdminProps) {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');

  // Configuração do Link de Convite Público (apenas super_admin)
  const [inviteSlug, setInviteSlug] = useState('');
  const [isSavingSlug, setIsSavingSlug] = useState(false);

  // Configuração de Convites a Especialista (Customizados)
  const [subTab, setSubTab] = useState<'usuarios' | 'convites'>('usuarios');
  const [convites, setConvites] = useState<any[]>([]);
  const [isConviteModalOpen, setIsConviteModalOpen] = useState(false);
  const [editingConvite, setEditingConvite] = useState<any>(null);
  
  // Form states para o convite customizado
  const [conviteSlug, setConviteSlug] = useState('');
  const [conviteDescricao, setConviteDescricao] = useState('');
  const [perguntasPerfil, setPerguntasPerfil] = useState<any[]>([]);
  const [contratoTexto, setContratoTexto] = useState('');
  const [taxaAdesaoReais, setTaxaAdesaoReais] = useState('0.00');
  const [isSavingConvite, setIsSavingConvite] = useState(false);

  useEffect(() => {
    fetchUsers();
    if (loggedRole === 'super_admin') {
      const loadSlug = async () => {
        try {
          const { data, error } = await supabase.from('configuracoes_plataforma').select('link_convite_especialista').eq('id', 1).maybeSingle();
          if (data && data.link_convite_especialista) {
            setInviteSlug(data.link_convite_especialista);
          } else {
            // fallback
            const saved = localStorage.getItem('sg_invite_slug');
            if (saved) setInviteSlug(saved);
          }
        } catch (e) {
          const saved = localStorage.getItem('sg_invite_slug');
          if (saved) setInviteSlug(saved);
        }
      };
      loadSlug();
      fetchConvites();
    }
  }, [loggedRole]);

  const fetchConvites = async () => {
    try {
      const { data, error } = await supabase
        .from('convites_especialista')
        .select('*')
        .order('criado_em', { ascending: false });
      if (!error && data) {
        setConvites(data);
      }
    } catch (e) {
      console.warn('Erro ao carregar convites do banco, tabela pode não existir ainda.', e);
    }
  };

  const handleSaveSlug = async () => {
    if (!inviteSlug.trim()) {
      alert('Por favor, informe um texto para o link.');
      return;
    }
    setIsSavingSlug(true);
    try {
      const { error } = await supabase.from('configuracoes_plataforma').upsert({ id: 1, link_convite_especialista: inviteSlug.trim() });
      if (error) {
        console.warn('Tabela configuracoes_plataforma não encontrada, usando localStorage apenas.', error);
      }
      localStorage.setItem('sg_invite_slug', inviteSlug.trim());
      alert('Link de convite configurado com sucesso!');
    } catch (e) {
      console.error(e);
      localStorage.setItem('sg_invite_slug', inviteSlug.trim());
    } finally {
      setIsSavingSlug(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('usuarios')
        .select('*');

      if (loggedRole !== 'super_admin' && loggedUser?.organizacao_id) {
        query = query.eq('organizacao_id', loggedUser.organizacao_id);
      }

      const { data, error } = await query.order('nome');

      if (error) throw error;
      setUsuarios(data || []);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = usuarios.filter(u => {
    const matchesSearch = 
      (u.nome && u.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'todos' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const [isConvidarModalOpen, setIsConvidarModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<any>(null);
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', role: 'membro' });
  const [conviteGerado, setConviteGerado] = useState<string | null>(null);

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o usuário ${nome}?`)) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('usuarios').delete().eq('id', id);
      if (error) throw error;
      fetchUsers();
    } catch (err: any) {
      alert('Erro ao remover usuário: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({
          nome: usuarioSelecionado.nome,
          email: usuarioSelecionado.email,
          role: usuarioSelecionado.role
        })
        .eq('id', usuarioSelecionado.id);
      if (error) throw error;
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      alert('Erro ao atualizar usuário: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvidar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { error } = await supabase
        .from('usuarios')
        .insert([{
          nome: novoUsuario.nome,
          email: novoUsuario.email,
          role: novoUsuario.role,
          organizacao_id: loggedUser?.organizacao_id || null,
          codigo_convite: codigo
        }]);

      if (error) throw error;
      
      setConviteGerado(codigo);
      fetchUsers();
    } catch (err: any) {
      alert('Erro ao convidar: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateConvite = (convite?: any) => {
    if (convite) {
      setEditingConvite(convite);
      setConviteSlug(convite.slug);
      setConviteDescricao(convite.descricao || '');
      setPerguntasPerfil(convite.perguntas_perfil || []);
      setContratoTexto(convite.contrato_texto || '');
      setTaxaAdesaoReais(((convite.taxa_adesao_cents || 0) / 100).toFixed(2));
    } else {
      setEditingConvite(null);
      setConviteSlug('');
      setConviteDescricao('');
      setPerguntasPerfil([]);
      setContratoTexto('');
      setTaxaAdesaoReais('0.00');
    }
    setIsConviteModalOpen(true);
  };

  const handleSaveConvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conviteSlug.trim()) {
      alert('Por favor, informe o slug do convite.');
      return;
    }
    setIsSavingConvite(true);
    const cents = Math.round(parseFloat(taxaAdesaoReais || '0') * 100);
    const cleanSlug = conviteSlug.trim().toUpperCase().replace(/[^a-zA-Z0-9-]/g, '');
    const payload = {
      slug: cleanSlug,
      descricao: conviteDescricao.trim(),
      perguntas_perfil: perguntasPerfil,
      contrato_texto: contratoTexto.trim(),
      taxa_adesao_cents: cents
    };

    try {
      let error;
      if (editingConvite) {
        const { error: err } = await supabase
          .from('convites_especialista')
          .update(payload)
          .eq('id', editingConvite.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from('convites_especialista')
          .insert([payload]);
        error = err;
      }

      if (error) throw error;
      alert('Convite salvo com sucesso!');
      setIsConviteModalOpen(false);
      fetchConvites();
    } catch (err: any) {
      alert('Erro ao salvar convite: ' + err.message);
    } finally {
      setIsSavingConvite(false);
    }
  };

  const handleDeleteConvite = async (id: string, slug: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o convite "${slug}"?`)) return;
    try {
      const { error } = await supabase.from('convites_especialista').delete().eq('id', id);
      if (error) throw error;
      fetchConvites();
    } catch (err: any) {
      alert('Erro ao excluir convite: ' + err.message);
    }
  };

  const addPergunta = () => {
    setPerguntasPerfil([
      ...perguntasPerfil,
      { id: Math.random().toString(36).substring(2, 6).toUpperCase(), label: '', type: 'text', required: true, options: '' }
    ]);
  };

  const updatePergunta = (id: string, field: string, value: any) => {
    setPerguntasPerfil(
      perguntasPerfil.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const removePergunta = (id: string) => {
    setPerguntasPerfil(perguntasPerfil.filter(p => p.id !== id));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
      {/* Tab Switcher for Super Admin */}
      {loggedRole === 'super_admin' && (
        <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 gap-2">
          <button
            onClick={() => setSubTab('usuarios')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              subTab === 'usuarios'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Users size={16} />
            Usuários e Equipe
          </button>
          <button
            onClick={() => {
              setSubTab('convites');
              fetchConvites();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              subTab === 'convites'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Link size={16} />
            Convite a Especialista
          </button>
        </div>
      )}

      {subTab === 'usuarios' ? (
        <>
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-6 h-6 text-indigo-600" />
                Gerenciamento de Usuários
              </h2>
              <p className="text-sm text-slate-500 font-medium">{usuarios.length} usuários registrados no sistema</p>
            </div>
            <button 
              onClick={() => {
                setConviteGerado(null);
                setIsConvidarModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <UserPlus size={18} />
              Convidar Usuário
            </button>
          </div>

          {loggedRole === 'super_admin' && (
            <div className="p-6 bg-indigo-50/50 border-b border-indigo-100 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-1">
                    <Link size={18} className="text-indigo-600" />
                    Link Público para Cadastro de Instituições (Especialistas)
                  </h3>
                  <p className="text-sm text-indigo-700">Configure a URL pública para que novos especialistas possam criar suas contas.</p>
                </div>
                <div className="flex w-full md:w-auto items-stretch gap-2">
                  <div className="flex items-center bg-white border border-indigo-200 rounded-xl overflow-hidden shadow-sm flex-1 md:w-80">
                    <span className="bg-slate-50 text-slate-500 text-sm px-3 py-2 border-r border-indigo-200 font-medium select-none">
                      /convite/
                    </span>
                    <input 
                      type="text" 
                      value={inviteSlug}
                      onChange={(e) => setInviteSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                      placeholder="ex: PROMO2026"
                      className="w-full px-3 py-2 outline-none text-sm font-bold text-slate-800"
                    />
                  </div>
                  <button 
                    onClick={handleSaveSlug}
                    disabled={isSavingSlug}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
                  >
                    {isSavingSlug ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <><Save size={16} /> Salvar</>
                    )}
                  </button>
                </div>
              </div>
              
              {inviteSlug.trim() && (
                <div className="bg-white border border-indigo-100 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-wider shrink-0">Link de Convite:</span>
                    <span className="text-sm font-mono font-semibold text-slate-700 truncate select-all">
                      {window.location.origin}/convite/{inviteSlug.trim()}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/convite/${inviteSlug.trim()}`);
                      alert('Link de convite copiado para a área de transferência!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 self-stretch sm:self-auto justify-center"
                  >
                    <Copy size={14} />
                    Copiar Link
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="p-6 bg-slate-50/50 flex flex-col md:flex-row gap-4 border-b border-slate-100">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700"
              >
                <option value="todos">Todos os Papéis</option>
                <option value="membro">Membros (Alunos)</option>
                <option value="especialista">Especialistas</option>
                <option value="curador">Curadores</option>
                <option value="design">Designers</option>
                <option value="gestor">Gestores</option>
                <option value="professor_convidado">Professores Convidados</option>
                <option value="super_admin">Super Admins</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Função</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p className="text-slate-400 text-sm font-medium">Carregando usuários...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <p className="text-slate-400 font-medium">Nenhum usuário encontrado.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                            <User size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{user.nome || 'Sem nome'}</div>
                            <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                              <Mail size={12} />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                          Ativo
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Shield size={14} className={user.role === 'admin' || user.role === 'super_admin' ? 'text-indigo-600' : 'text-slate-400'} />
                          <span className={`text-sm font-bold capitalize ${user.role === 'admin' || user.role === 'super_admin' ? 'text-indigo-700' : 'text-slate-600'}`}>
                            {user.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setUsuarioSelecionado(user);
                              setIsEditModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" 
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(user.id, user.nome)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                            title="Remover"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                            <MoreHorizontal size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Convites customizados */}
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Link className="w-6 h-6 text-indigo-600" />
                Convites Personalizados para Especialistas
              </h2>
              <p className="text-sm text-slate-500 font-medium">Crie links de convites com questionários, contratos e taxas sob medida.</p>
            </div>
            <button 
              onClick={() => openCreateConvite()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Plus size={18} />
              Criar Convite Customizado
            </button>
          </div>

          <div className="p-6">
            {convites.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Link className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-bold text-slate-700 text-lg">Nenhum convite customizado criado</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto mt-1 mb-6">
                  Crie seu primeiro link de convite personalizado para cadastrar novos especialistas com taxas, contratos e levantamento de perfil customizados.
                </p>
                <button
                  onClick={() => openCreateConvite()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all"
                >
                  Criar Primeiro Convite
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {convites.map((c) => (
                  <div key={c.id} className="border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all bg-white flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg">
                            /convite/{c.slug}
                          </span>
                          {!c.ativo && (
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Inativo</span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-800 text-md mt-2">{c.descricao || 'Sem descrição'}</h4>
                      </div>
                      <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/convite/${c.slug}`);
                            alert('Link de convite copiado para a área de transferência!');
                          }}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="Copiar Link"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => openCreateConvite(c)}
                          className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteConvite(c.id, c.slug)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-sm">
                      <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                        <Clipboard size={16} className="text-indigo-500" />
                        <div>
                          <div className="text-xs text-slate-400 font-bold">Levantamento</div>
                          <div className="font-bold text-slate-700">
                            {c.perguntas_perfil?.length || 0} pergunta(s)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                        <FileText size={16} className="text-indigo-500" />
                        <div>
                          <div className="text-xs text-slate-400 font-bold">Contrato</div>
                          <div className="font-bold text-slate-700 truncate max-w-[150px]">
                            {c.contrato_texto ? 'Configurado' : 'Não exigido'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-md font-bold text-indigo-500 font-mono">R$</span>
                        <div>
                          <div className="text-xs text-slate-400 font-bold">Taxa de Adesão</div>
                          <div className="font-bold text-slate-700">
                            {c.taxa_adesao_cents > 0 ? `R$ ${(c.taxa_adesao_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Gratuito'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Convite (Equipe/Membro) */}
      {isConvidarModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
              <h3 className="text-lg font-bold text-slate-800">Convidar Novo Usuário</h3>
              <button onClick={() => setIsConvidarModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8">
              {!conviteGerado ? (
                <form onSubmit={handleConvidar} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={novoUsuario.nome}
                      onChange={e => setNovoUsuario({...novoUsuario, nome: e.target.value})}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">E-mail</label>
                    <input
                      type="email"
                      required
                      value={novoUsuario.email}
                      onChange={e => setNovoUsuario({...novoUsuario, email: e.target.value})}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Papel / Função</label>
                    <select
                      value={novoUsuario.role}
                      onChange={e => setNovoUsuario({...novoUsuario, role: e.target.value})}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                    >
                      <option value="membro">Membro (Aluno)</option>
                      <option value="especialista">Especialista</option>
                      <option value="curador">Curador</option>
                      <option value="design">Designer</option>
                      <option value="gestor">Gestor</option>
                      <option value="professor_convidado">Professor Convidado</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100"
                  >
                    Gerar Convite
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <Shield size={32} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900">Convite Criado!</h4>
                    <p className="text-slate-500 text-sm mt-1">Envie o código abaixo para o colaborador:</p>
                  </div>
                  <div className="bg-slate-100 p-6 rounded-2xl border-2 border-dashed border-slate-200">
                    <span className="text-4xl font-black tracking-widest text-indigo-700">{conviteGerado}</span>
                  </div>
                  <button
                    onClick={() => setIsConvidarModalOpen(false)}
                    className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição (Usuário Comum) */}
      {isEditModalOpen && usuarioSelecionado && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
              <h3 className="text-lg font-bold text-slate-800">Editar Usuário</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8">
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={usuarioSelecionado.nome || ''}
                    onChange={e => setUsuarioSelecionado({...usuarioSelecionado, nome: e.target.value})}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">E-mail</label>
                  <input
                    type="email"
                    required
                    value={usuarioSelecionado.email || ''}
                    onChange={e => setUsuarioSelecionado({...usuarioSelecionado, email: e.target.value})}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Papel / Função</label>
                  <select
                    value={usuarioSelecionado.role || 'membro'}
                    onChange={e => setUsuarioSelecionado({...usuarioSelecionado, role: e.target.value})}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                  >
                    <option value="membro">Membro (Aluno)</option>
                    <option value="especialista">Especialista</option>
                    <option value="curador">Curador</option>
                    <option value="design">Designer</option>
                    <option value="gestor">Gestor</option>
                    <option value="professor_convidado">Professor Convidado</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100"
                >
                  Salvar Alterações
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração do Convite Customizado */}
      {isConviteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden my-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30 bg-indigo-50/20">
              <h3 className="text-lg font-bold text-slate-800">
                {editingConvite ? 'Editar Convite Especialista' : 'Criar Convite Especialista'}
              </h3>
              <button onClick={() => setIsConviteModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveConvite} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Informações Básicas */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  Informações Básicas do Link
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">SLUG (URL do Convite)</label>
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <span className="bg-slate-50 text-slate-400 text-xs px-3 py-2 border-r border-slate-200 font-medium">/convite/</span>
                      <input
                        type="text"
                        required
                        disabled={!!editingConvite}
                        value={conviteSlug}
                        onChange={e => setConviteSlug(e.target.value.toUpperCase().replace(/[^a-zA-Z0-9-]/g, ''))}
                        className="w-full px-3 py-2 text-sm font-bold text-slate-800 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                        placeholder="EX: SLUG-CONVITE"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Descrição Interna</label>
                    <input
                      type="text"
                      value={conviteDescricao}
                      onChange={e => setConviteDescricao(e.target.value)}
                      className="w-full p-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Identificação interna do convite (ex: Campanha Junho 2026)"
                    />
                  </div>
                </div>
              </div>

              {/* Levantamento de Perfil */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    Levantamento de Perfil (Questionário)
                  </h4>
                  <button
                    type="button"
                    onClick={addPergunta}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold text-xs rounded-lg transition-colors border border-indigo-100"
                  >
                    <Plus size={14} /> Adicionar Pergunta
                  </button>
                </div>
                
                {perguntasPerfil.length === 0 ? (
                  <p className="text-slate-400 text-xs italic">Nenhuma pergunta configurada. O onboarding pulará esta etapa.</p>
                ) : (
                  <div className="space-y-3">
                    {perguntasPerfil.map((p, idx) => (
                      <div key={p.id} className="bg-white p-4 border border-slate-200 rounded-xl space-y-3 relative shadow-sm">
                        <button
                          type="button"
                          onClick={() => removePergunta(p.id)}
                          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
                          <div className="sm:col-span-6">
                            <label className="block text-xxs font-bold text-slate-400 mb-0.5">Pergunta {idx + 1}</label>
                            <input
                              type="text"
                              required
                              value={p.label}
                              onChange={e => updatePergunta(p.id, 'label', e.target.value)}
                              className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Qual o nicho do seu curso ou infoproduto?"
                            />
                          </div>
                          
                          <div className="sm:col-span-3">
                            <label className="block text-xxs font-bold text-slate-400 mb-0.5">Tipo de Campo</label>
                            <select
                              value={p.type}
                              onChange={e => updatePergunta(p.id, 'type', e.target.value)}
                              className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="text">Texto livre</option>
                              <option value="select">Seleção (Múltiplas opções)</option>
                              <option value="number">Número</option>
                            </select>
                          </div>

                          <div className="sm:col-span-3 flex items-center h-full pt-4">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={p.required}
                                onChange={e => updatePergunta(p.id, 'required', e.target.checked)}
                                className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span className="text-xs font-bold text-slate-600">Obrigatória</span>
                            </label>
                          </div>
                        </div>

                        {p.type === 'select' && (
                          <div className="pt-1">
                            <label className="block text-xxs font-bold text-slate-400 mb-0.5">Opções de Seleção (Separadas por vírgula)</label>
                            <input
                              type="text"
                              required
                              value={p.options || ''}
                              onChange={e => updatePergunta(p.id, 'options', e.target.value)}
                              className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="ex: Saúde/Fitness, Negócios, Idiomas, Outros"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contrato de Parceria */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  Contrato de Parceria & Aceite Digital
                </h4>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Cláusulas e Termos do Contrato (Markdown ou Texto Livre)</label>
                  <textarea
                    value={contratoTexto}
                    onChange={e => setContratoTexto(e.target.value)}
                    rows={6}
                    className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="Escreva aqui os termos da parceria. Este texto será exibido no onboarding e exigirá assinatura digital (checkbox de aceite + CPF/CNPJ + Nome)."
                  />
                  <p className="text-slate-400 text-xxs mt-1">Se deixado em branco, a etapa do contrato não será exigida no onboarding.</p>
                </div>
              </div>

              {/* Taxa de Adesão */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  Taxa de Adesão ao Projeto
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Valor da Taxa (R$)</label>
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white max-w-[200px]">
                      <span className="bg-slate-50 text-slate-500 text-xs px-3 py-2 border-r border-slate-200 font-bold font-mono">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={taxaAdesaoReais}
                        onChange={e => setTaxaAdesaoReais(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-slate-400 text-xxs mt-1">Defina como 0.00 se o convite for gratuito (sem taxa de adesão).</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsConviteModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingConvite}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-70"
                >
                  {isSavingConvite ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Salvar Configurações'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
