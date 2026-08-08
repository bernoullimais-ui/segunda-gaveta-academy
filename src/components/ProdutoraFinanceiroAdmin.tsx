import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Edit3, 
  X, 
  RefreshCw, 
  Building2, 
  Percent, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';

export interface ProdutoraReceita {
  id: string;
  tipo: 'percentual_curso' | 'landing_page' | 'producao_video' | 'mentoria_consultoria' | 'setup_onboarding' | 'gestao_mensal' | 'outro';
  descricao: string | null;
  organizacao_id: string | null;
  compra_id: string | null;
  valor: number;
  percentual_aplicado: number | null;
  data_referencia: string;
  status: 'recebido' | 'a_receber' | 'cancelado';
  observacoes: string | null;
  created_at: string;
  organizacoes?: { nome: string } | null;
  compras?: { 
    valor_pago: number; 
    valor_liquido: number; 
    cursos?: { nome: string } | null; 
    usuarios?: { nome: string; email: string } | null;
  } | null;
}

export interface ProdutoraDespesa {
  id: string;
  categoria: 'aplicativo_saas' | 'contabilidade' | 'equipe_interna' | 'prestador_servico' | 'imposto_taxa' | 'marketing_anuncio' | 'infraestrutura' | 'outro';
  descricao: string;
  fornecedor: string | null;
  valor: number;
  recorrente: boolean;
  periodicidade: 'mensal' | 'trimestral' | 'anual' | 'unico' | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: 'pago' | 'pendente' | 'cancelado';
  observacoes: string | null;
  recorrencia_origem_id: string | null;
  created_at: string;
}

const TIPO_RECEITA_LABELS: Record<string, string> = {
  percentual_curso: 'Venda de Curso (Percentual)',
  landing_page: 'Criação de Landing Page',
  producao_video: 'Produção / Edição de Vídeo',
  mentoria_consultoria: 'Mentoria / Consultoria',
  setup_onboarding: 'Taxa de Setup / Onboarding',
  gestao_mensal: 'Gestão Mensal de Plataforma',
  outro: 'Outra Receita'
};

const CATEGORIA_DESPESA_LABELS: Record<string, string> = {
  aplicativo_saas: 'Aplicativos & SaaS',
  contabilidade: 'Contabilidade & BPO',
  equipe_interna: 'Equipe Interna',
  prestador_servico: 'Prestador de Serviço / Freelancer',
  imposto_taxa: 'Impostos & Taxas',
  marketing_anuncio: 'Marketing & Anúncios',
  infraestrutura: 'Infraestrutura & Servidores',
  outro: 'Outra Despesa'
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#64748b'];

export function ProdutoraFinanceiroAdmin({ loggedUser }: { loggedUser?: any }) {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'receitas' | 'despesas'>('dashboard');
  const [receitas, setReceitas] = useState<ProdutoraReceita[]>([]);
  const [despesas, setDespesas] = useState<ProdutoraDespesa[]>([]);
  const [organizacoes, setOrganizacoes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all'); // 'all' or 'YYYY-MM'
  const [searchFilter, setSearchFilter] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('todas');
  const [tipoReceitaFilter, setTipoReceitaFilter] = useState('todos');
  const [statusDespesaFilter, setStatusDespesaFilter] = useState('todos');

  // Modals
  const [showReceitaModal, setShowReceitaModal] = useState(false);
  const [showDespesaModal, setShowDespesaModal] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Partial<ProdutoraReceita> | null>(null);
  const [editingDespesa, setEditingDespesa] = useState<Partial<ProdutoraDespesa> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states - Receita
  const [formReceita, setFormReceita] = useState({
    tipo: 'landing_page',
    descricao: '',
    organizacao_id: '',
    valor: '',
    data_referencia: new Date().toISOString().split('T')[0],
    status: 'recebido',
    observacoes: ''
  });

  // Form states - Despesa
  const [formDespesa, setFormDespesa] = useState({
    categoria: 'aplicativo_saas',
    descricao: '',
    fornecedor: '',
    valor: '',
    recorrente: false,
    periodicidade: 'mensal',
    data_vencimento: new Date().toISOString().split('T')[0],
    data_pagamento: new Date().toISOString().split('T')[0],
    status: 'pago',
    observacoes: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [recRes, despRes, orgsRes] = await Promise.all([
        supabase
          .from('produtora_receitas')
          .select('*, organizacoes(nome), compras(valor_pago, valor_liquido, cursos(nome), usuarios!compras_usuario_id_fkey(nome, email))')
          .order('data_referencia', { ascending: false }),
        supabase
          .from('produtora_despesas')
          .select('*')
          .order('data_vencimento', { ascending: false }),
        supabase.from('organizacoes').select('id, nome').order('nome')
      ]);

      if (recRes.data) setReceitas(recRes.data as any);
      if (despRes.data) setDespesas(despRes.data as any);
      if (orgsRes.data) setOrganizacoes(orgsRes.data);

      // Perform historical sync & recurring expense auto-generation
      await syncHistoricalCompras(recRes.data || []);
      await checkRecurringExpenses(despRes.data || []);

    } catch (err) {
      console.error('Erro ao buscar dados do financeiro da produtora:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 1. Sync historical compras to produtora_receitas automatically
  const syncHistoricalCompras = async (existingReceitas: any[]) => {
    try {
      setIsSyncing(true);
      const existingCompraIds = new Set(existingReceitas.filter(r => r.compra_id).map(r => r.compra_id));

      const { data: compras, error } = await supabase
        .from('compras')
        .select('*, cursos(nome, organizacao_id), trilhas(nome, organizacao_id)')
        .eq('status', 'pago');

      if (error || !compras) return;

      const newReceitasToInsert: any[] = [];

      for (const compra of compras) {
        if (!existingCompraIds.has(compra.id)) {
          // Calculate Produtora revenue
          const valorLiquido = Number(compra.valor_liquido || compra.valor_pago || 0);
          const comissoesCoprodutores = Array.isArray(compra.comissao_coprodutores) ? compra.comissao_coprodutores : [];
          const totalCoprodutores = comissoesCoprodutores.reduce((sum: number, item: any) => sum + Number(item.valor || 0), 0);
          const valorProdutora = Math.max(0, valorLiquido - totalCoprodutores);

          const percentualEfetivo = compra.valor_pago > 0 
            ? ((valorProdutora / compra.valor_pago) * 100).toFixed(2)
            : 0;

          const orgId = compra.cursos?.organizacao_id || compra.trilhas?.organizacao_id || null;
          const cursoNome = compra.cursos?.nome || compra.trilhas?.nome || 'Curso/Trilha';

          newReceitasToInsert.push({
            tipo: 'percentual_curso',
            descricao: `Comissão Venda: ${cursoNome}`,
            organizacao_id: orgId,
            compra_id: compra.id,
            valor: valorProdutora,
            percentual_aplicado: parseFloat(String(percentualEfetivo)),
            data_referencia: (compra.criado_em || new Date().toISOString()).split('T')[0],
            status: 'recebido',
            observacoes: `Calculado automaticamente da compra ${compra.id.slice(0, 8)}`
          });
        }
      }

      if (newReceitasToInsert.length > 0) {
        const { error: insertErr } = await supabase.from('produtora_receitas').insert(newReceitasToInsert);
        if (!insertErr) {
          // Refresh receitas list
          const { data: updatedRec } = await supabase
            .from('produtora_receitas')
            .select('*, organizacoes(nome), compras(valor_pago, valor_liquido, cursos(nome), usuarios!compras_usuario_id_fkey(nome, email))')
            .order('data_referencia', { ascending: false });
          if (updatedRec) setReceitas(updatedRec as any);
        }
      }
    } catch (err) {
      console.error('Erro na sincronização de compras:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Check and generate recurring expenses for current month
  const checkRecurringExpenses = async (existingDespesas: any[]) => {
    try {
      const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
      const recurringBases = existingDespesas.filter(d => d.recorrente && !d.recorrencia_origem_id);

      const newDespesasToInsert: any[] = [];

      for (const base of recurringBases) {
        // Check if there is already a despesa for this base in the current month
        const hasForThisMonth = existingDespesas.some(d => 
          (d.id === base.id || d.recorrencia_origem_id === base.id) &&
          (d.data_vencimento || d.data_pagamento || '').startsWith(currentMonthStr)
        );

        if (!hasForThisMonth) {
          const dayOfVenc = base.data_vencimento ? base.data_vencimento.slice(8, 10) : '05';
          const newVencDate = `${currentMonthStr}-${dayOfVenc}`;

          newDespesasToInsert.push({
            categoria: base.categoria,
            descricao: base.descricao,
            fornecedor: base.fornecedor,
            valor: base.valor,
            recorrente: true,
            periodicidade: base.periodicidade,
            data_vencimento: newVencDate,
            data_pagamento: null,
            status: 'pendente',
            observacoes: `Gerado automaticamente para ${currentMonthStr}`,
            recorrencia_origem_id: base.id
          });
        }
      }

      if (newDespesasToInsert.length > 0) {
        const { error: insErr } = await supabase.from('produtora_despesas').insert(newDespesasToInsert);
        if (!insErr) {
          const { data: updatedDesp } = await supabase
            .from('produtora_despesas')
            .select('*')
            .order('data_vencimento', { ascending: false });
          if (updatedDesp) setDespesas(updatedDesp as any);
        }
      }
    } catch (err) {
      console.error('Erro ao gerar despesas recorrentes:', err);
    }
  };

  // Available Periods for Dropdown
  const availablePeriods = useMemo(() => {
    const periods = new Set<string>();
    receitas.forEach(r => {
      if (r.data_referencia) periods.add(r.data_referencia.slice(0, 7));
    });
    despesas.forEach(d => {
      const date = d.data_vencimento || d.data_pagamento;
      if (date) periods.add(date.slice(0, 7));
    });

    const sorted = Array.from(periods).sort().reverse();
    return sorted;
  }, [receitas, despesas]);

  // Filtered Receitas & Despesas based on selected period and search
  const filteredReceitas = useMemo(() => {
    return receitas.filter(r => {
      const matchPeriod = selectedPeriod === 'all' ? true : (r.data_referencia && r.data_referencia.startsWith(selectedPeriod));
      const matchTipo = tipoReceitaFilter === 'todos' ? true : r.tipo === tipoReceitaFilter;
      const search = searchFilter.toLowerCase();
      const matchSearch = !search ? true : (
        (r.descricao || '').toLowerCase().includes(search) ||
        (r.organizacoes?.nome || '').toLowerCase().includes(search) ||
        (TIPO_RECEITA_LABELS[r.tipo] || '').toLowerCase().includes(search)
      );
      return matchPeriod && matchTipo && matchSearch;
    });
  }, [receitas, selectedPeriod, tipoReceitaFilter, searchFilter]);

  const filteredDespesas = useMemo(() => {
    return despesas.filter(d => {
      const date = d.data_vencimento || d.data_pagamento || d.created_at;
      const matchPeriod = selectedPeriod === 'all' ? true : (date && date.startsWith(selectedPeriod));
      const matchCat = categoriaFilter === 'todas' ? true : d.categoria === categoriaFilter;
      const matchStatus = statusDespesaFilter === 'todos' ? true : d.status === statusDespesaFilter;
      const search = searchFilter.toLowerCase();
      const matchSearch = !search ? true : (
        (d.descricao || '').toLowerCase().includes(search) ||
        (d.fornecedor || '').toLowerCase().includes(search) ||
        (CATEGORIA_DESPESA_LABELS[d.categoria] || '').toLowerCase().includes(search)
      );
      return matchPeriod && matchCat && matchStatus && matchSearch;
    });
  }, [despesas, selectedPeriod, categoriaFilter, statusDespesaFilter, searchFilter]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const activeReceitas = filteredReceitas.filter(r => r.status === 'recebido');
    const activeDespesas = filteredDespesas.filter(d => d.status === 'pago');

    const totalReceitas = activeReceitas.reduce((sum, r) => sum + Number(r.valor || 0), 0);
    const totalDespesas = activeDespesas.reduce((sum, d) => sum + Number(d.valor || 0), 0);
    const saldo = totalReceitas - totalDespesas;
    const margemPercent = totalReceitas > 0 ? ((saldo / totalReceitas) * 100).toFixed(1) : '0';

    const receitasPendentes = filteredReceitas.filter(r => r.status === 'a_receber').reduce((sum, r) => sum + Number(r.valor || 0), 0);
    const despesasPendentes = filteredDespesas.filter(d => d.status === 'pendente').reduce((sum, d) => sum + Number(d.valor || 0), 0);

    return {
      totalReceitas,
      totalDespesas,
      saldo,
      margemPercent,
      receitasPendentes,
      despesasPendentes
    };
  }, [filteredReceitas, filteredDespesas]);

  // Chart 1: Last 6 Months Receitas vs Despesas (Bar Chart)
  const monthlyComparisonChartData = useMemo(() => {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const now = new Date();
    const result: { monthKey: string; name: string; Receitas: number; Despesas: number; Saldo: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const monthKey = `${yyyy}-${mm}`;
      const name = `${monthNames[d.getMonth()]}/${String(yyyy).slice(-2)}`;

      const monthRec = receitas
        .filter(r => r.status === 'recebido' && r.data_referencia && r.data_referencia.startsWith(monthKey))
        .reduce((sum, r) => sum + Number(r.valor || 0), 0);

      const monthDesp = despesas
        .filter(d => d.status === 'pago' && (d.data_vencimento || d.data_pagamento || '').startsWith(monthKey))
        .reduce((sum, d) => sum + Number(d.valor || 0), 0);

      result.push({
        monthKey,
        name,
        Receitas: monthRec,
        Despesas: monthDesp,
        Saldo: monthRec - monthDesp
      });
    }

    return result;
  }, [receitas, despesas]);

  // Chart 2: Receitas por Tipo (Pie Chart)
  const receitasPieData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredReceitas.filter(r => r.status === 'recebido').forEach(r => {
      const label = TIPO_RECEITA_LABELS[r.tipo] || r.tipo;
      map[label] = (map[label] || 0) + Number(r.valor || 0);
    });

    return Object.keys(map).map((name) => ({
      name,
      value: map[name]
    })).sort((a, b) => b.value - a.value);
  }, [filteredReceitas]);

  // Chart 3: Despesas por Categoria (Pie Chart)
  const despesasPieData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredDespesas.filter(d => d.status === 'pago').forEach(d => {
      const label = CATEGORIA_DESPESA_LABELS[d.categoria] || d.categoria;
      map[label] = (map[label] || 0) + Number(d.valor || 0);
    });

    return Object.keys(map).map((name) => ({
      name,
      value: map[name]
    })).sort((a, b) => b.value - a.value);
  }, [filteredDespesas]);

  // Alert Badge: Upcoming pending expenses due in 7 days
  const pendingUpcomingDespesas = useMemo(() => {
    const today = new Date();
    const in7Days = new Date();
    in7Days.setDate(today.getDate() + 7);

    const todayStr = today.toISOString().split('T')[0];
    const in7DaysStr = in7Days.toISOString().split('T')[0];

    return despesas.filter(d => 
      d.status === 'pendente' && 
      d.data_vencimento && 
      d.data_vencimento >= todayStr && 
      d.data_vencimento <= in7DaysStr
    );
  }, [despesas]);

  // CRUD Handlers - Receita
  const handleSaveReceita = async () => {
    if (!formReceita.valor || isNaN(Number(formReceita.valor))) return;
    setIsSaving(true);
    try {
      const payload: any = {
        tipo: formReceita.tipo,
        descricao: formReceita.descricao.trim() || TIPO_RECEITA_LABELS[formReceita.tipo],
        organizacao_id: formReceita.organizacao_id || null,
        valor: parseFloat(formReceita.valor),
        data_referencia: formReceita.data_referencia,
        status: formReceita.status,
        observacoes: formReceita.observacoes || null
      };

      if (editingReceita?.id) {
        await supabase.from('produtora_receitas').update(payload).eq('id', editingReceita.id);
      } else {
        await supabase.from('produtora_receitas').insert(payload);
      }

      setShowReceitaModal(false);
      setEditingReceita(null);
      await fetchData();
    } catch (err) {
      console.error('Erro ao salvar receita:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReceita = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta receita?')) return;
    await supabase.from('produtora_receitas').delete().eq('id', id);
    await fetchData();
  };

  // CRUD Handlers - Despesa
  const handleSaveDespesa = async () => {
    if (!formDespesa.descricao.trim() || !formDespesa.valor || isNaN(Number(formDespesa.valor))) return;
    setIsSaving(true);
    try {
      const payload: any = {
        categoria: formDespesa.categoria,
        descricao: formDespesa.descricao.trim(),
        fornecedor: formDespesa.fornecedor.trim() || null,
        valor: parseFloat(formDespesa.valor),
        recorrente: formDespesa.recorrente,
        periodicidade: formDespesa.recorrente ? formDespesa.periodicidade : 'unico',
        data_vencimento: formDespesa.data_vencimento || null,
        data_pagamento: formDespesa.status === 'pago' ? (formDespesa.data_pagamento || formDespesa.data_vencimento) : null,
        status: formDespesa.status,
        observacoes: formDespesa.observacoes || null
      };

      if (editingDespesa?.id) {
        await supabase.from('produtora_despesas').update(payload).eq('id', editingDespesa.id);
      } else {
        await supabase.from('produtora_despesas').insert(payload);
      }

      setShowDespesaModal(false);
      setEditingDespesa(null);
      await fetchData();
    } catch (err) {
      console.error('Erro ao salvar despesa:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDespesa = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta despesa?')) return;
    await supabase.from('produtora_despesas').delete().eq('id', id);
    await fetchData();
  };

  // CSV Exporters
  const exportReceitasCSV = () => {
    const headers = ['Data', 'Tipo', 'Descrição', 'Organização', 'Valor (R$)', 'Status', 'Observações'];
    const rows = filteredReceitas.map(r => [
      r.data_referencia,
      TIPO_RECEITA_LABELS[r.tipo] || r.tipo,
      `"${r.descricao || ''}"`,
      `"${r.organizacoes?.nome || 'N/A'}"`,
      r.valor.toFixed(2),
      r.status,
      `"${r.observacoes || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `produtora_receitas_${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
  };

  const exportDespesasCSV = () => {
    const headers = ['Vencimento', 'Categoria', 'Descrição', 'Fornecedor', 'Valor (R$)', 'Recorrente', 'Status', 'Observações'];
    const rows = filteredDespesas.map(d => [
      d.data_vencimento || 'N/A',
      CATEGORIA_DESPESA_LABELS[d.categoria] || d.categoria,
      `"${d.descricao || ''}"`,
      `"${d.fornecedor || 'N/A'}"`,
      d.valor.toFixed(2),
      d.recorrente ? 'Sim' : 'Não',
      d.status,
      `"${d.observacoes || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `produtora_despesas_${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-sm font-semibold text-slate-600">Carregando financeiro da produtora...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub-Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl shadow-md">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Financeiro da Produtora</h2>
              <p className="text-xs text-slate-500 font-medium">Gestão de Receitas, Despesas e Margem Líquida da Segunda Gaveta</p>
            </div>
          </div>
        </div>

        {/* Global Controls & Period Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {isSyncing && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold animate-pulse">
              <Sparkles className="w-3.5 h-3.5" /> Sincronizando vendas...
            </div>
          )}

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500 ml-2" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none pr-3 cursor-pointer py-1"
            >
              <option value="all">Todo o Histórico</option>
              {availablePeriods.map(p => {
                const [yyyy, mm] = p.split('-');
                const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                return (
                  <option key={p} value={p}>
                    {monthNames[parseInt(mm) - 1]} / {yyyy}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex gap-2 bg-slate-200/60 p-1 rounded-xl max-w-max border border-slate-300/40">
        <button
          onClick={() => setActiveSubTab('dashboard')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeSubTab === 'dashboard'
              ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Visão Geral
        </button>
        <button
          onClick={() => setActiveSubTab('receitas')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeSubTab === 'receitas'
              ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-600" /> Receitas ({filteredReceitas.length})
        </button>
        <button
          onClick={() => setActiveSubTab('despesas')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all relative ${
            activeSubTab === 'despesas'
              ? 'bg-white text-red-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingDown className="w-4 h-4 text-red-600" /> Despesas ({filteredDespesas.length})
          {pendingUpcomingDespesas.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute top-2 right-2" />
          )}
        </button>
      </div>

      {/* SUB-TAB 1: DASHBOARD */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Saldo Líquido */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Líquido</span>
                <div className={`p-2 rounded-xl ${kpis.saldo >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <p className={`text-2xl font-black ${kpis.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                R$ {kpis.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">Receitas - Despesas (Confirmadas)</p>
            </div>

            {/* Receita Total */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Receita Total</span>
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">
                R$ {kpis.totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                + R$ {kpis.receitasPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a receber
              </p>
            </div>

            {/* Total Despesas */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Despesas</span>
                <div className="p-2 rounded-xl bg-red-50 text-red-600">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">
                R$ {kpis.totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                + R$ {kpis.despesasPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendentes
              </p>
            </div>

            {/* Margem Líquida % */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Margem Líquida</span>
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Percent className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{kpis.margemPercent}%</p>
              <p className="text-[11px] text-slate-400 font-medium">Lucratividade sobre receita</p>
            </div>
          </div>

          {/* Alert Banner for Upcoming Despesas */}
          {pendingUpcomingDespesas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-amber-900 shadow-sm">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold">
                    {pendingUpcomingDespesas.length} despesa(s) a vencer nos próximos 7 dias!
                  </p>
                  <p className="text-xs text-amber-700">
                    Total: R$ {pendingUpcomingDespesas.reduce((acc, d) => acc + Number(d.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveSubTab('despesas');
                  setStatusDespesaFilter('pendente');
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                Ver Despesas
              </button>
            </div>
          )}

          {/* Main Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Receitas vs Despesas por Mês (2 cols) */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Receitas vs Despesas (Últimos 6 Meses)</h3>
                  <p className="text-xs text-slate-500 font-medium">Comparativo mensal acumulado</p>
                </div>
              </div>

              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyComparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(val) => `R$${val}`} />
                    <Tooltip
                      formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Evolução do Saldo (Line Chart) (1 col) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Evolução do Saldo</h3>
                <p className="text-xs text-slate-500 font-medium">Resultado líquido mensal</p>
              </div>

              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyComparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <Tooltip
                      formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Saldo']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Line type="monotone" dataKey="Saldo" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: '#3b82f6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Pie Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart: Receitas por Tipo */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-base">Composição de Receitas por Tipo</h3>
              {receitasPieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Nenhuma receita no período</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={receitasPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {receitasPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                      <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Pie Chart: Despesas por Categoria */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-base">Composição de Despesas por Categoria</h3>
              {despesasPieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Nenhuma despesa no período</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={despesasPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {despesasPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                      <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: RECEITAS */}
      {activeSubTab === 'receitas' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar receita ou cliente..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                />
              </div>

              {/* Filter Tipo */}
              <select
                value={tipoReceitaFilter}
                onChange={(e) => setTipoReceitaFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="todos">Todos os Tipos</option>
                {Object.keys(TIPO_RECEITA_LABELS).map(key => (
                  <option key={key} value={key}>{TIPO_RECEITA_LABELS[key]}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={exportReceitasCSV}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                <Download className="w-4 h-4" /> Exportar CSV
              </button>

              <button
                onClick={() => {
                  setEditingReceita(null);
                  setFormReceita({
                    tipo: 'landing_page',
                    descricao: '',
                    organizacao_id: '',
                    valor: '',
                    data_referencia: new Date().toISOString().split('T')[0],
                    status: 'recebido',
                    observacoes: ''
                  });
                  setShowReceitaModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors"
              >
                <Plus className="w-4 h-4" /> Nova Receita Manual
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Data</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4">Cliente / Organização</th>
                  <th className="p-4">Valor (R$)</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReceitas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">Nenhuma receita encontrada.</td>
                  </tr>
                ) : (
                  filteredReceitas.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 text-slate-600 font-medium whitespace-nowrap">
                        {rec.data_referencia ? new Date(rec.data_referencia + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="p-4 font-semibold text-slate-800 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs border border-emerald-200">
                          {TIPO_RECEITA_LABELS[rec.tipo] || rec.tipo}
                        </span>
                      </td>
                      <td className="p-4 text-slate-800 font-medium">
                        {rec.descricao || '-'}
                        {rec.percentual_aplicado && (
                          <span className="ml-2 text-xs text-slate-400 font-normal">({rec.percentual_aplicado}% da venda)</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 font-medium">
                        {rec.organizacoes?.nome ? (
                          <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
                            <Building2 className="w-3.5 h-3.5" /> {rec.organizacoes.nome}
                          </span>
                        ) : (
                          <span className="text-slate-400">Sem Vínculo</span>
                        )}
                      </td>
                      <td className="p-4 font-black text-slate-900 whitespace-nowrap">
                        R$ {Number(rec.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          rec.status === 'recebido'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rec.status === 'a_receber'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {rec.status === 'recebido' ? 'Recebido' : rec.status === 'a_receber' ? 'A Receber' : 'Cancelado'}
                        </span>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {!rec.compra_id && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingReceita(rec);
                                setFormReceita({
                                  tipo: rec.tipo,
                                  descricao: rec.descricao || '',
                                  organizacao_id: rec.organizacao_id || '',
                                  valor: String(rec.valor),
                                  data_referencia: rec.data_referencia,
                                  status: rec.status,
                                  observacoes: rec.observacoes || ''
                                });
                                setShowReceitaModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteReceita(rec.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DESPESAS */}
      {activeSubTab === 'despesas' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar despesa ou fornecedor..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                />
              </div>

              {/* Filter Categoria */}
              <select
                value={categoriaFilter}
                onChange={(e) => setCategoriaFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="todas">Todas as Categorias</option>
                {Object.keys(CATEGORIA_DESPESA_LABELS).map(key => (
                  <option key={key} value={key}>{CATEGORIA_DESPESA_LABELS[key]}</option>
                ))}
              </select>

              {/* Filter Status */}
              <select
                value={statusDespesaFilter}
                onChange={(e) => setStatusDespesaFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="todos">Todos Status</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={exportDespesasCSV}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                <Download className="w-4 h-4" /> Exportar CSV
              </button>

              <button
                onClick={() => {
                  setEditingDespesa(null);
                  setFormDespesa({
                    categoria: 'aplicativo_saas',
                    descricao: '',
                    fornecedor: '',
                    valor: '',
                    recorrente: false,
                    periodicidade: 'mensal',
                    data_vencimento: new Date().toISOString().split('T')[0],
                    data_pagamento: new Date().toISOString().split('T')[0],
                    status: 'pago',
                    observacoes: ''
                  });
                  setShowDespesaModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors"
              >
                <Plus className="w-4 h-4" /> Nova Despesa
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Vencimento</th>
                  <th className="p-4">Categoria</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4">Fornecedor</th>
                  <th className="p-4">Valor (R$)</th>
                  <th className="p-4">Recorrente</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDespesas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">Nenhuma despesa encontrada.</td>
                  </tr>
                ) : (
                  filteredDespesas.map((desp) => (
                    <tr key={desp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 text-slate-600 font-medium whitespace-nowrap">
                        {desp.data_vencimento ? new Date(desp.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 font-semibold">
                          {CATEGORIA_DESPESA_LABELS[desp.categoria] || desp.categoria}
                        </span>
                      </td>
                      <td className="p-4 text-slate-800 font-semibold">{desp.descricao}</td>
                      <td className="p-4 text-slate-600 font-medium">{desp.fornecedor || '-'}</td>
                      <td className="p-4 font-black text-slate-900 whitespace-nowrap">
                        R$ {Number(desp.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {desp.recorrente ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">
                            Mensal
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Único</span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          desp.status === 'pago'
                            ? 'bg-emerald-100 text-emerald-800'
                            : desp.status === 'pendente'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {desp.status === 'pago' ? 'Pago' : desp.status === 'pendente' ? 'Pendente' : 'Cancelado'}
                        </span>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingDespesa(desp);
                              setFormDespesa({
                                categoria: desp.categoria,
                                descricao: desp.descricao,
                                fornecedor: desp.fornecedor || '',
                                valor: String(desp.valor),
                                recorrente: desp.recorrente,
                                periodicidade: desp.periodicidade || 'mensal',
                                data_vencimento: desp.data_vencimento || new Date().toISOString().split('T')[0],
                                data_pagamento: desp.data_pagamento || new Date().toISOString().split('T')[0],
                                status: desp.status,
                                observacoes: desp.observacoes || ''
                              });
                              setShowDespesaModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDespesa(desp.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL RECEITA MANUAL */}
      {showReceitaModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                {editingReceita ? 'Editar Receita' : 'Nova Receita Manual'}
              </h3>
              <button onClick={() => setShowReceitaModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tipo de Receita</label>
                <select
                  value={formReceita.tipo}
                  onChange={(e) => setFormReceita({ ...formReceita, tipo: e.target.value as any })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.keys(TIPO_RECEITA_LABELS).map(key => (
                    <option key={key} value={key}>{TIPO_RECEITA_LABELS[key]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Criação de Landing Page do Curso de Vendas"
                  value={formReceita.descricao}
                  onChange={(e) => setFormReceita({ ...formReceita, descricao: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Cliente / Organização (Opcional)</label>
                <select
                  value={formReceita.organizacao_id}
                  onChange={(e) => setFormReceita({ ...formReceita, organizacao_id: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sem Organização Vinculada</option>
                  {organizacoes.map(org => (
                    <option key={org.id} value={org.id}>{org.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formReceita.valor}
                    onChange={(e) => setFormReceita({ ...formReceita, valor: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Data</label>
                  <input
                    type="date"
                    value={formReceita.data_referencia}
                    onChange={(e) => setFormReceita({ ...formReceita, data_referencia: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status</label>
                <select
                  value={formReceita.status}
                  onChange={(e) => setFormReceita({ ...formReceita, status: e.target.value as any })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="recebido">Recebido</option>
                  <option value="a_receber">A Receber</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Detalhes adicionais..."
                  value={formReceita.observacoes}
                  onChange={(e) => setFormReceita({ ...formReceita, observacoes: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowReceitaModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveReceita}
                disabled={isSaving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Salvar Receita'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DESPESA */}
      {showDespesaModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                {editingDespesa ? 'Editar Despesa' : 'Nova Despesa'}
              </h3>
              <button onClick={() => setShowDespesaModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Categoria</label>
                <select
                  value={formDespesa.categoria}
                  onChange={(e) => setFormDespesa({ ...formDespesa, categoria: e.target.value as any })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.keys(CATEGORIA_DESPESA_LABELS).map(key => (
                    <option key={key} value={key}>{CATEGORIA_DESPESA_LABELS[key]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Assinatura Mensal Supabase Database"
                  value={formDespesa.descricao}
                  onChange={(e) => setFormDespesa({ ...formDespesa, descricao: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fornecedor (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Vercel Inc / Contador"
                  value={formDespesa.fornecedor}
                  onChange={(e) => setFormDespesa({ ...formDespesa, fornecedor: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formDespesa.valor}
                    onChange={(e) => setFormDespesa({ ...formDespesa, valor: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Vencimento</label>
                  <input
                    type="date"
                    value={formDespesa.data_vencimento}
                    onChange={(e) => setFormDespesa({ ...formDespesa, data_vencimento: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="recorrenteCheck"
                  checked={formDespesa.recorrente}
                  onChange={(e) => setFormDespesa({ ...formDespesa, recorrente: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="recorrenteCheck" className="text-sm font-bold text-slate-700 cursor-pointer">
                  Despesa Recorrente (Gerar automaticamente todo mês)
                </label>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status de Pagamento</label>
                <select
                  value={formDespesa.status}
                  onChange={(e) => setFormDespesa({ ...formDespesa, status: e.target.value as any })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Detalhes adicionais..."
                  value={formDespesa.observacoes}
                  onChange={(e) => setFormDespesa({ ...formDespesa, observacoes: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowDespesaModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDespesa}
                disabled={isSaving}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Salvar Despesa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
