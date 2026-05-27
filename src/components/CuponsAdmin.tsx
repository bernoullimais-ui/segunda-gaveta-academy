import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Ticket, Plus, Trash2, Calendar, DollarSign, Percent, Loader2, 
  CheckCircle2, XCircle, AlertCircle, BookOpen, Award, ToggleLeft, ToggleRight, Search
} from 'lucide-react';

interface CuponsAdminProps {
  orgId: string;
  corPrimaria?: string;
  showToast?: (text: string, type: 'success' | 'error' | 'info') => void;
}

export function CuponsAdmin({ orgId, corPrimaria = '#6366f1', showToast }: CuponsAdminProps) {
  const [cupons, setCupons] = useState<any[]>([]);
  const [cursos, setCursos] = useState<any[]>([]);
  const [trilhas, setTrilhas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [codigo, setCodigo] = useState('');
  const [tipoDesconto, setTipoDesconto] = useState<'percentual' | 'fixo'>('percentual');
  const [valor, setValor] = useState<number>(0);
  const [limiteUsosTotal, setLimiteUsosTotal] = useState<string>('');
  const [dataExpiracao, setDataExpiracao] = useState<string>('');
  const [cursoId, setCursoId] = useState<string>('');
  const [trilhaId, setTrilhaId] = useState<string>('');
  
  // Form Validation Message
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) {
      fetchData();
    }
  }, [orgId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Coupons
      const { data: cuponsData, error: cuponsError } = await supabase
        .from('cupons')
        .select(`
          *,
          cursos (nome),
          trilhas (nome)
        `)
        .eq('organizacao_id', orgId)
        .order('created_at', { ascending: false });

      if (cuponsError) throw cuponsError;
      setCupons(cuponsData || []);

      // 2. Fetch Courses for scope restrictions
      const { data: cursosData, error: cursosError } = await supabase
        .from('cursos')
        .select('id, nome')
        .eq('organizacao_id', orgId)
        .order('nome');

      if (cursosError) throw cursosError;
      setCursos(cursosData || []);

      // 3. Fetch Trails for scope restrictions
      const { data: trilhasData, error: trilhasError } = await supabase
        .from('trilhas')
        .select('id, nome')
        .eq('organizacao_id', orgId)
        .order('nome');

      if (trilhasError) throw trilhasError;
      setTrilhas(trilhasData || []);

    } catch (err: any) {
      console.error('Error fetching coupon admin data:', err);
      if (showToast) {
        showToast('Erro ao carregar dados dos cupons.', 'error');
      } else {
        alert('Erro ao carregar cupons: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('cupons')
        .update({ ativo: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      setCupons(prev => prev.map(c => c.id === id ? { ...c, ativo: !currentStatus } : c));
      if (showToast) {
        showToast(`Cupom ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`, 'success');
      }
    } catch (err: any) {
      console.error('Error toggling coupon active status:', err);
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const handleDeleteCoupon = async (id: string, code: string) => {
    if (!window.confirm(`Tem certeza de que deseja excluir permanentemente o cupom "${code}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('cupons')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCupons(prev => prev.filter(c => c.id !== id));
      if (showToast) {
        showToast('Cupom excluído com sucesso!', 'success');
      }
    } catch (err: any) {
      console.error('Error deleting coupon:', err);
      alert('Erro ao excluir cupom: ' + err.message);
    }
  };

  const resetForm = () => {
    setCodigo('');
    setTipoDesconto('percentual');
    setValor(0);
    setLimiteUsosTotal('');
    setDataExpiracao('');
    setCursoId('');
    setTrilhaId('');
    setFormError(null);
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    const cleanCode = codigo.trim().toUpperCase();
    if (!cleanCode) {
      setFormError('Por favor, informe o código do cupom.');
      return;
    }
    if (valor <= 0) {
      setFormError('O valor do desconto deve ser maior que zero.');
      return;
    }
    if (tipoDesconto === 'percentual' && valor > 100) {
      setFormError('O desconto percentual não pode ser maior que 100%.');
      return;
    }
    if (cursoId && trilhaId) {
      setFormError('O cupom só pode ser restringido a um Curso OU a uma Trilha, não a ambos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        organizacao_id: orgId,
        codigo: cleanCode,
        tipo_desconto: tipoDesconto,
        valor: Number(valor),
        limite_usos_total: limiteUsosTotal ? parseInt(limiteUsosTotal, 10) : null,
        data_expiracao: dataExpiracao ? new Date(dataExpiracao).toISOString() : null,
        curso_id: cursoId || null,
        trilha_id: trilhaId || null,
        ativo: true
      };

      const { data, error } = await supabase
        .from('cupons')
        .insert([payload])
        .select(`
          *,
          cursos (nome),
          trilhas (nome)
        `)
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Já existe um cupom com o código "${cleanCode}" nesta organização.`);
        }
        throw error;
      }

      if (data) {
        setCupons(prev => [data, ...prev]);
        setIsModalOpen(false);
        resetForm();
        if (showToast) {
          showToast('Cupom criado com sucesso!', 'success');
        }
      }
    } catch (err: any) {
      console.error('Error creating coupon:', err);
      setFormError(err.message || 'Erro ao criar cupom. Verifique os dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCupons = cupons.filter(c => 
    c.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Ticket className="w-6 h-6 text-slate-700" style={{ color: corPrimaria }} />
            Cupons de Desconto e Promoções
          </h2>
          <p className="text-sm text-slate-500 font-medium">Crie cupons promocionais para alavancar suas vendas.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-md cursor-pointer"
          style={{ backgroundColor: corPrimaria }}
        >
          <Plus size={18} />
          Criar Novo Cupom
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código do cupom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all text-sm font-medium"
            style={{ '--tw-ring-color': corPrimaria } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Desconto</th>
                <th className="px-6 py-4">Restrições / Escopo</th>
                <th className="px-6 py-4">Usos</th>
                <th className="px-6 py-4">Validade</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-400" style={{ color: corPrimaria }} />
                      <span className="text-slate-400 font-semibold">Carregando cupons...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                        <Ticket size={32} />
                      </div>
                      <div>
                        <p className="text-slate-700 font-bold">Nenhum cupom cadastrado</p>
                        <p className="text-slate-400 text-xs mt-1">Crie seu primeiro cupom para oferecer descontos aos alunos.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCupons.map((cupom) => {
                  const isExpired = cupom.data_expiracao && new Date(cupom.data_expiracao) < new Date();
                  const isMaxed = cupom.limite_usos_total !== null && cupom.usos_atual >= cupom.limite_usos_total;
                  
                  return (
                    <tr key={cupom.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 tracking-wider">
                        <span className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
                          {cupom.codigo}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {cupom.tipo_desconto === 'percentual' ? (
                          <span className="inline-flex items-center gap-1">
                            {cupom.valor}% <Percent size={14} className="text-slate-400" />
                          </span>
                        ) : (
                          <span>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cupom.valor)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {cupom.curso_id ? (
                          <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-semibold bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md max-w-max">
                            <BookOpen size={13} />
                            Curso: {cupom.cursos?.nome || 'N/A'}
                          </div>
                        ) : cupom.trilha_id ? (
                          <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-100 px-2 py-1 rounded-md max-w-max">
                            <Award size={13} />
                            Trilha: {cupom.trilhas?.nome || 'N/A'}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                            Geral (Todos)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-700 font-bold">
                          {cupom.usos_atual} / {cupom.limite_usos_total ?? '∞'}
                        </div>
                        {isMaxed && (
                          <div className="text-[10px] text-red-500 font-bold">Limite alcançado</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {cupom.data_expiracao ? (
                          <div className={`flex items-center gap-1 text-xs ${isExpired ? 'text-red-500 font-bold' : 'text-slate-600'}`}>
                            <Calendar size={13} />
                            {new Date(cupom.data_expiracao).toLocaleDateString('pt-BR')}
                            {isExpired && ' (Expirado)'}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Sem expiração</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          cupom.ativo && !isExpired && !isMaxed 
                            ? 'bg-green-50 text-green-700' 
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {cupom.ativo && !isExpired && !isMaxed ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleActive(cupom.id, cupom.ativo)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title={cupom.ativo ? 'Desativar Cupom' : 'Ativar Cupom'}
                          >
                            {cupom.ativo ? (
                              <ToggleRight size={22} className="text-green-600" />
                            ) : (
                              <ToggleLeft size={22} className="text-slate-400" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteCoupon(cupom.id, cupom.codigo)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Cupom"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-indigo-600" style={{ color: corPrimaria }} />
                Novo Cupom de Desconto
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <AlertCircle size={16} className="shrink-0" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Código do Cupom *
                  </label>
                  <input
                    type="text"
                    required
                    value={codigo}
                    onChange={e => setCodigo(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                    placeholder="Ex: PROMO10, GAVETAPRO"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 outline-none font-bold text-slate-800 uppercase tracking-wider"
                    style={{ '--tw-ring-color': corPrimaria } as React.CSSProperties}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Apenas letras e números. Salvo em letras maiúsculas.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tipo de Desconto *
                  </label>
                  <select
                    value={tipoDesconto}
                    onChange={e => {
                      setTipoDesconto(e.target.value as 'percentual' | 'fixo');
                      setValor(0);
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-sm text-slate-800"
                  >
                    <option value="percentual">Percentual (%)</option>
                    <option value="fixo">Fixo (R$)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Valor do Desconto *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold text-sm">
                      {tipoDesconto === 'percentual' ? '%' : 'R$'}
                    </span>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0.01"
                      value={valor || ''}
                      onChange={e => setValor(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 outline-none font-bold text-slate-800"
                      style={{ '--tw-ring-color': corPrimaria } as React.CSSProperties}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Limite Geral de Usos
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={limiteUsosTotal}
                    onChange={e => setLimiteUsosTotal(e.target.value)}
                    placeholder="Sem limite (∞)"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 outline-none font-medium text-sm text-slate-800"
                    style={{ '--tw-ring-color': corPrimaria } as React.CSSProperties}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Total de inscrições com este cupom.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Data de Expiração
                  </label>
                  <input
                    type="date"
                    value={dataExpiracao}
                    onChange={e => setDataExpiracao(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 outline-none font-medium text-sm text-slate-800"
                    style={{ '--tw-ring-color': corPrimaria } as React.CSSProperties}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Deixe em branco para tempo indeterminado.</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Restrição de Aplicabilidade (Opcional)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Restringir a Curso</label>
                    <select
                      value={cursoId}
                      onChange={e => {
                        setCursoId(e.target.value);
                        if (e.target.value) setTrilhaId(''); // Exclusive restriction
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800"
                    >
                      <option value="">Nenhum (Qualquer curso)</option>
                      {cursos.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Restringir a Trilha</label>
                    <select
                      value={trilhaId}
                      onChange={e => {
                        setTrilhaId(e.target.value);
                        if (e.target.value) setCursoId(''); // Exclusive restriction
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800"
                    >
                      <option value="">Nenhuma (Qualquer trilha)</option>
                      {trilhas.map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Selecione apenas um se desejar limitar a um produto específico.</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 p-6 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-white font-bold rounded-xl flex items-center gap-2 hover:opacity-90 transition-all shadow-md cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: corPrimaria }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Confirmar Criação
                    </>
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
