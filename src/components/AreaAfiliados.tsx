import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Share2, 
  Copy, 
  Check, 
  TrendingUp, 
  BookOpen, 
  DollarSign, 
  ExternalLink, 
  AlertCircle, 
  Landmark, 
  Lock,
  ListOrdered
} from 'lucide-react';
import { DadosRecebimento } from './DadosRecebimento';

interface AreaAfiliadosProps {
  loggedUser: any;
  orgSlug: string;
  organizacaoId: string;
}

type SubTabType = 'links' | 'extrato' | 'dados';

export function AreaAfiliados({ loggedUser, orgSlug, organizacaoId }: AreaAfiliadosProps) {
  const [courses, setCourses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('links');
  const [hasBankDetails, setHasBankDetails] = useState(false);

  useEffect(() => {
    fetchData();
  }, [organizacaoId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch active courses of organization
      const { data: courseData } = await supabase
        .from('cursos')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .eq('status', 'Publicado');

      if (courseData) setCourses(courseData);

      // 2. Fetch referred sales
      const { data: salesData } = await supabase
        .from('compras')
        .select('*, usuarios(nome, email), cursos(nome)')
        .eq('affiliate_id', loggedUser.id)
        .eq('status', 'pago')
        .order('criado_em', { ascending: false });

      if (salesData) setSales(salesData);

      // 2.5 Fetch clicks for funnel metrics (M7/M15)
      const { count: clicksCount } = await supabase
        .from('clicks_afiliados')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', loggedUser.id);
      
      setTotalClicks(clicksCount || 0);

      // 3. Fetch user financial details to verify configuration
      const { data: userData } = await supabase
        .from('usuarios')
        .select('curriculo_json')
        .eq('id', loggedUser.id)
        .single();

      const rec = userData?.curriculo_json?.dados_recebimento;
      const isValid = !!(
        rec?.nome_recebedor?.trim() &&
        rec?.documento?.trim() &&
        rec?.banco?.trim() &&
        rec?.agencia?.trim() &&
        rec?.conta?.trim() &&
        rec?.chave_pix?.trim()
      );
      setHasBankDetails(isValid);
    } catch (err) {
      console.error('Error fetching affiliate data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = (courseId: string) => {
    if (!hasBankDetails) return;
    const affiliateUrl = `${window.location.origin}/public/curso/${courseId}?ref=${loggedUser.id}`;
    navigator.clipboard.writeText(affiliateUrl);
    setCopiedId(courseId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalCommissions = sales.reduce((sum, sale) => sum + (Number(sale.comissao_afiliado) || 0), 0);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-5xl mx-auto">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
        Carregando painel de afiliados...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Share2 className="text-indigo-600 w-8 h-8" />
          Área de Afiliados
        </h1>
        <p className="text-slate-500 mt-1 font-medium">Promova nossos cursos e fature comissões automáticas diretamente por indicação.</p>
      </div>

      {/* Warning Banner if bank details are not configured */}
      {!hasBankDetails && (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-[24px] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3 text-amber-800">
            <AlertCircle className="w-6 h-6 shrink-0 text-amber-600" />
            <div>
              <div className="font-bold text-sm">Dados Financeiros Pendentes</div>
              <div className="text-xs text-amber-700 font-medium">
                Você precisa cadastrar seus dados de recebimento para liberar os links de divulgação e garantir o recebimento das comissões.
              </div>
            </div>
          </div>
          <button 
            onClick={() => setActiveSubTab('dados')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
          >
            Configurar Agora
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 rounded-[24px] text-white shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-semibold opacity-90 uppercase tracking-wider text-[10px]">Saldo Acumulado</div>
            <div className="text-2xl font-black mt-0.5">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCommissions)}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Vendas</div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">{sales.length}</div>
          </div>
        </div>

        {/* M7/M15: Funnel Metrics */}
        <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center relative z-10">
            <ExternalLink className="w-6 h-6" />
          </div>
          <div className="relative z-10">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Cliques Totais</div>
            <div className="flex items-end gap-2 mt-0.5">
              <span className="text-2xl font-black text-slate-800">{totalClicks}</span>
              <span className="text-xs font-bold text-slate-400 mb-1.5">
                {totalClicks > 0 ? `${((sales.length / totalClicks) * 100).toFixed(1)}% conv.` : '0% conv.'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Cursos Disponíveis</div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">
              {courses.filter(c => c.configuracao_json?.comissao_afiliado > 0).length}
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveSubTab('links')}
          className={`pb-4 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'links'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Links de Divulgação
        </button>
        <button
          onClick={() => setActiveSubTab('extrato')}
          className={`pb-4 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'extrato'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          Extrato de Indicações
        </button>
        <button
          onClick={() => setActiveSubTab('dados')}
          className={`pb-4 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'dados'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Landmark className="w-4 h-4" />
          Dados de Recebimento
          {!hasBankDetails && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>}
        </button>
      </div>

      {/* Sub Tabs Content */}
      <div className="animate-in fade-in duration-200">
        {activeSubTab === 'links' && (
          <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-black text-xl text-slate-900">Seus Links Exclusivos</h3>
            <p className="text-slate-500 text-sm -mt-4">Divulgue os cursos abaixo para receber comissões diretamente em sua conta cadastrada.</p>

            {!hasBankDetails ? (
              <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center space-y-4 max-w-lg mx-auto bg-slate-50/50">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-base">Links Bloqueados</h4>
                  <p className="text-slate-500 text-xs mt-1">
                    Preencha seus dados de recebimento na aba ao lado para liberar seus links de divulgação.
                  </p>
                </div>
                <button
                  onClick={() => setActiveSubTab('dados')}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Cadastrar Dados Bancários
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {courses
                  .filter(c => Number(c.configuracao_json?.comissao_afiliado) > 0)
                  .map(course => {
                    const commissionPct = Number(course.configuracao_json.comissao_afiliado) || 0;
                    const courseVal = parseFloat(course.valor) || 0;
                    const estimatedCom = (courseVal * commissionPct) / 100;
                    const affiliateUrl = `${window.location.origin}/public/curso/${course.id}?ref=${loggedUser.id}`;

                    return (
                      <div key={course.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-800 text-base">{course.nome}</h4>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs text-slate-500 font-medium">Preço: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(courseVal)}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              Comissão: {commissionPct}% ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estimatedCom)})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 max-w-md w-full md:w-auto">
                          <input 
                            type="text" 
                            readOnly 
                            value={affiliateUrl} 
                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-500 flex-1 outline-none min-w-[200px]"
                          />
                          <button
                            onClick={() => handleCopyLink(course.id)}
                            className={`p-2 rounded-lg border transition-all cursor-pointer ${
                              copiedId === course.id 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                            }`}
                            title="Copiar link"
                          >
                            {copiedId === course.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <a 
                            href={affiliateUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-2 rounded-lg border bg-white border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                            title="Visualizar Página de Vendas"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    );
                  })}

                {courses.filter(c => Number(c.configuracao_json?.comissao_afiliado) > 0).length === 0 && (
                  <div className="py-8 text-center text-slate-400 italic">
                    Não existem cursos com o programa de afiliados ativado pela curadoria neste momento.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'extrato' && (
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-black text-xl text-slate-900 font-sans">Extrato de Indicações</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="p-4 pl-6">Aluno</th>
                    <th className="p-4">Curso Comprado</th>
                    <th className="p-4 text-center">Data</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right pr-6">Sua Comissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sales.map((sale, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-bold text-slate-800">{sale.usuarios?.nome || 'Aluno'}</div>
                        <div className="text-xs text-slate-400">{sale.usuarios?.email}</div>
                      </td>
                      <td className="p-4 font-semibold text-slate-800">{sale.cursos?.nome || 'N/A'}</td>
                      <td className="p-4 text-center text-xs text-slate-500">
                        {sale.criado_em ? new Date(sale.criado_em).toLocaleDateString('pt-BR') : 'N/A'}
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          Pago
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6 font-black text-emerald-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(sale.comissao_afiliado) || 0)}
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                        Nenhuma comissão de indicação faturada por enquanto. Compartilhe seus links para começar!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'dados' && (
          <DadosRecebimento 
            loggedUser={loggedUser}
            onSave={fetchData}
          />
        )}
      </div>
    </div>
  );
}
