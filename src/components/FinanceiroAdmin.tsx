import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Loader2, 
  DollarSign, 
  Tag, 
  Percent, 
  TrendingUp, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Users
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';

export function FinanceiroAdmin({ orgId }: { orgId?: string }) {
  const [compras, setCompras] = useState<any[]>([]);
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pago' | 'pendente'>('todos');

  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, role');
      if (!error && data) {
        setOrgUsers(data);
      }
    }
    fetchUsers();
  }, []);

  useEffect(() => {
    async function fetchCompras() {
      setIsLoading(true);
      try {
        // M3: Filter by organization in the DB query (not in JS)
        // We use a two-step query: get curso/trilha IDs for this org first, then filter compras
        let query = supabase
          .from('compras')
          .select(`
            *,
            usuarios!compras_usuario_id_fkey (nome, email),
            cursos (nome, organizacao_id, configuracao_json),
            trilhas (nome, organizacao_id, configuracao_json)
          `)
          .order('criado_em', { ascending: false });

        // Apply server-side org filter when orgId is available
        if (orgId) {
          // Fetch org's curso IDs and trilha IDs to filter compras
          const [cursosRes, trilhasRes] = await Promise.all([
            supabase.from('cursos').select('id').eq('organizacao_id', orgId),
            supabase.from('trilhas').select('id').eq('organizacao_id', orgId)
          ]);

          const cursoIds = (cursosRes.data || []).map((c: any) => c.id);
          const trilhaIds = (trilhasRes.data || []).map((t: any) => t.id);
          const allItemIds = [...cursoIds, ...trilhaIds];

          if (allItemIds.length === 0) {
            setCompras([]);
            setIsLoading(false);
            return;
          }

          query = query.in('item_id', allItemIds);
        }

        const { data, error } = await query;
        if (error) throw error;
        setCompras(data || []);
      } catch (err) {
        console.error('Erro ao carregar compras:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCompras();
  }, [orgId]);

  // Filtered transactions for the list
  const displayCompras = compras.filter(compra => {
    const matchesSearch = 
      (compra.usuarios?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (compra.usuarios?.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (compra.cupom_codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (compra.tipo || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === 'todos' ? true : compra.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate KPIs based on ALL purchases (not filtered by search/status for accuracy)
  const approvedPurchases = compras.filter(c => c.status === 'pago');
  const totalRevenue = approvedPurchases.reduce((acc, c) => acc + Number(c.valor_pago || 0), 0);
  const totalNetRevenue = approvedPurchases.reduce((acc, c) => acc + Number(c.valor_liquido || c.valor_pago || 0), 0);
  const totalDiscounts = approvedPurchases.reduce((acc, c) => acc + Number(c.desconto_aplicado || 0), 0);
  const averageTicket = approvedPurchases.length > 0 ? totalRevenue / approvedPurchases.length : 0;
  
  const purchasesWithCoupon = approvedPurchases.filter(c => c.cupom_codigo);
  const couponConversionRate = approvedPurchases.length > 0 
    ? (purchasesWithCoupon.length / approvedPurchases.length) * 100 
    : 0;
  
  const totalAffiliateCommissions = approvedPurchases.reduce((acc, c) => acc + Number(c.comissao_afiliado || 0), 0);
  const estornos = compras.filter(c => c.status === 'estornado').length;

  // Coupon Performance aggregation
  const couponStats: { [code: string]: { code: string; count: number; totalRevenue: number; totalDiscounts: number } } = {};
  approvedPurchases.forEach(compra => {
    if (compra.cupom_codigo) {
      const code = compra.cupom_codigo.toUpperCase().trim();
      if (!couponStats[code]) {
        couponStats[code] = {
          code,
          count: 0,
          totalRevenue: 0,
          totalDiscounts: 0
        };
      }
      couponStats[code].count += 1;
      couponStats[code].totalRevenue += Number(compra.valor_pago || 0);
      couponStats[code].totalDiscounts += Number(compra.desconto_aplicado || 0);
    }
  });
  const couponList = Object.values(couponStats).sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Group by Month for Recharts Bar Chart (last 6 months)
  const monthlyDataMap: { [month: string]: number } = {};
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  
  // Initialize last 6 months
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
    monthlyDataMap[key] = 0;
  }

  // 1. Saldo a liberar nos próximos 30 dias (D+30 para CC, D+1 para Pix/Boleto)
  const currentDate = new Date();
  let pendingReleaseTotal = 0;

  // Initialize projection dates (30 days ahead)
  const projectionsMap: { [dateStr: string]: number } = {};
  const dateList: string[] = [];
  for (let i = 1; i <= 30; i++) {
    const d = new Date();
    d.setDate(currentDate.getDate() + i);
    const dateKey = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    projectionsMap[dateKey] = 0;
    dateList.push(dateKey);
  }

  // Calculate split statistics
  // splitStats maps user_id to { name, email, role, faturado, projetado }
  const splitStats: { [userId: string]: { id: string; nome: string; email: string; role: string; faturado: number; projetado: number } } = {};

  // Populate actual data and calculate projections & splits
  approvedPurchases.forEach(compra => {
    const date = new Date(compra.criado_em);
    const key = `${monthNames[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
    if (monthlyDataMap[key] !== undefined) {
      monthlyDataMap[key] += Number(compra.valor_pago || 0);
    }

    // Determine release date
    const createdDate = new Date(compra.criado_em);
    const isCC = (compra.metodo_pagamento || '').toLowerCase().includes('cartao');
    const daysToAdd = isCC ? 30 : 1;
    const releaseDate = new Date(createdDate.getTime());
    releaseDate.setDate(releaseDate.getDate() + daysToAdd);

    const feePct = isCC ? 0.0499 : 0.0199;
    const feeFlat = isCC ? 1.00 : 0.00;
    const gross = Number(compra.valor_pago || 0);
    const net = Math.max(0, gross * (1 - feePct) - feeFlat);

    const isFuture = releaseDate > currentDate;
    if (isFuture) {
      pendingReleaseTotal += net;
      // If it falls within the next 30 days, add to map
      const diffTime = releaseDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 1 && diffDays <= 30) {
        const dateKey = `${String(releaseDate.getDate()).padStart(2, '0')}/${String(releaseDate.getMonth() + 1).padStart(2, '0')}`;
        if (projectionsMap[dateKey] !== undefined) {
          projectionsMap[dateKey] += net;
        }
      }
    }

    // Process Splits for this course/trilha
    const splits = compra.cursos?.configuracao_json?.splits || compra.trilhas?.configuracao_json?.splits || [];
    if (splits.length > 0) {
      splits.forEach((split: any) => {
        const userId = split.usuario_id;
        const pct = Number(split.porcentagem || 0);
        if (pct > 0) {
          const splitShare = gross * (pct / 100);
          if (!splitStats[userId]) {
            const user = orgUsers.find(u => u.id === userId);
            splitStats[userId] = {
              id: userId,
              nome: user?.nome || 'Usuário Desconhecido',
              email: user?.email || '',
              role: user?.role || 'especialista',
              faturado: 0,
              projetado: 0
            };
          }
          if (isFuture) {
            splitStats[userId].projetado += splitShare;
          } else {
            splitStats[userId].faturado += splitShare;
          }
        }
      });
    }
  });

  const chartData = Object.entries(monthlyDataMap).map(([name, faturamento]) => ({
    name,
    Faturamento: parseFloat(faturamento.toFixed(2))
  }));

  const projectedChartData = dateList.map(date => ({
    name: date,
    Projetado: parseFloat(projectionsMap[date].toFixed(2))
  }));

  const splitList = Object.values(splitStats).sort((a, b) => b.faturado - a.faturado);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Aluno', 'E-mail', 'Produto', 'Tipo', 'Método', 'Parcelas', 'Cupom', 'Desconto', 'Valor Bruto', 'Valor Líquido', 'Comissão Afiliado', 'Status'];
    const rows = compras.map(c => [
      new Date(c.criado_em).toLocaleDateString('pt-BR'),
      c.usuarios?.nome || 'N/A',
      c.usuarios?.email || 'N/A',
      c.tipo === 'curso' ? c.cursos?.nome : c.tipo === 'trilha' ? c.trilhas?.nome : 'Acesso Total',
      c.tipo,
      c.metodo_pagamento || '',
      c.installments || '1',
      c.cupom_codigo || '',
      c.desconto_aplicado || '0',
      c.valor_pago,
      c.valor_liquido || c.valor_pago,
      c.comissao_afiliado || '0',
      c.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_financeiro_${orgId || 'geral'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-slate-500 font-medium">Carregando painel financeiro...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-fadeIn">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Painel Financeiro</h2>
          <p className="text-slate-500 mt-1">Acompanhe a receita, transações e desempenho de cupons em tempo real.</p>
        </div>
        <button 
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm font-semibold transition-all text-sm duration-200 active:scale-95 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Exportar Relatório
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {/* KPI 1 — Faturamento Bruto */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Faturamento Bruto</span>
            <div className="text-xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</div>
            <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
              <TrendingUp className="w-3 h-3" />
              <span>Total pago</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2 — Receita Líquida */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Receita Líquida</span>
            <div className="text-xl font-bold text-slate-900">{formatCurrency(totalNetRevenue)}</div>
            <div className="text-slate-400 text-xs font-medium">Após taxas Pagar.me</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3 — Saldo a Liberar */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500">A Liberar (D+30)</span>
            <div className="text-xl font-bold text-slate-900">{formatCurrency(pendingReleaseTotal)}</div>
            <div className="text-slate-400 text-xs font-medium">Liberações futuras</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4 — Ticket Médio */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Ticket Médio</span>
            <div className="text-xl font-bold text-slate-900">{formatCurrency(averageTicket)}</div>
            <div className="text-slate-400 text-xs font-medium">Por venda aprovada</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 5 — Descontos */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Descontos</span>
            <div className="text-xl font-bold text-slate-950">{formatCurrency(totalDiscounts)}</div>
            <div className="text-slate-400 text-xs font-medium">Cupons aplicados</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 6 — Conversão de Cupons */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Uso de Cupons</span>
            <div className="text-xl font-bold text-slate-900">{couponConversionRate.toFixed(1)}%</div>
            <div className="text-slate-400 text-xs font-medium">Vendas com cupom</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 7 — Comissões Afiliados */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Comissões Afil.</span>
            <div className="text-xl font-bold text-slate-900">{formatCurrency(totalAffiliateCommissions)}</div>
            <div className="text-slate-400 text-xs font-medium">{estornos > 0 ? `${estornos} estorno(s)` : 'Total pago'}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>


      {/* Charts and Coupon Performance Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Monthly Revenue Chart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Evolução do Faturamento</h3>
              <p className="text-slate-400 text-xs mt-0.5">Faturamento mensal consolidado dos últimos 6 meses</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip 
                  cursor={{ fill: '#F8FAFC' }}
                  formatter={(value: any) => [formatCurrency(value), 'Faturamento']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="Faturamento" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Coupon Desempenho */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Desempenho de Cupons</h3>
                <p className="text-slate-400 text-xs mt-0.5">Vendas acumuladas por cupom ativo</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Tag className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
              {couponList.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-100 rounded-xl">
                  <Tag className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-slate-400 text-xs font-medium">Nenhum cupom utilizado até o momento.</p>
                </div>
              ) : (
                couponList.map((coupon) => (
                  <div key={coupon.code} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl hover:bg-slate-100/80 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          {coupon.code}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {coupon.count} {coupon.count === 1 ? 'uso' : 'usos'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Descontos: <span className="font-semibold text-rose-600">{formatCurrency(coupon.totalDiscounts)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">{formatCurrency(coupon.totalRevenue)}</div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Vendas</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="pt-4 border-t border-slate-50 text-[11px] text-slate-400 text-center">
            * Somente transações no status "Pago"
          </div>
        </div>
      </div>

      {/* Projections and Split Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: 30-Day Projections Area Chart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Previsão de Recebíveis (30 Dias)</h3>
              <p className="text-slate-400 text-xs mt-0.5">Valores líquidos projetados para liberação diária</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProjetado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip 
                  formatter={(value: any) => [formatCurrency(value), 'Saldo a Liberar']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="Projetado" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorProjetado)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Coproducer Repasses */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Repasses de Coprodução</h3>
                <p className="text-slate-400 text-xs mt-0.5">Saldo distribuído para co-produtores</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
              {splitList.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-150 rounded-xl">
                  <Users className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-slate-400 text-xs font-semibold">Nenhum repasse de split registrado até o momento.</p>
                </div>
              ) : (
                splitList.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all duration-200">
                    <div>
                      <div className="text-xs font-black text-slate-900">{item.nome}</div>
                      <div className="text-[10px] text-slate-450 font-medium truncate max-w-[120px]">{item.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-emerald-600">{formatCurrency(item.faturado)} <span className="text-[9px] text-slate-400 font-semibold uppercase">Pago</span></div>
                      <div className="text-[10px] font-bold text-purple-600">{formatCurrency(item.projetado)} <span className="text-[9px] text-slate-400 font-semibold uppercase">Liberar</span></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="pt-4 border-t border-slate-50 text-[11px] text-slate-400 text-center">
            * Divisões aplicadas de acordo com as regras de split configuradas
          </div>
        </div>
      </div>

      {/* Transactions Table with Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Filters and Search Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">Histórico de Transações</h3>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por aluno, cupom..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700 transition-shadow"
              />
            </div>

            {/* Filter Select */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700 cursor-pointer"
              >
                <option value="todos">Todos Status</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table layout */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold text-xs uppercase border-b border-slate-100">
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Aluno</th>
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">Cupom Utilizado</th>
                <th className="px-6 py-4 text-right">Desconto</th>
                <th className="px-6 py-4 text-right">Valor Pago</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayCompras.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <p className="font-medium">Nenhuma transação encontrada.</p>
                      <p className="text-xs text-slate-400">Tente ajustar seus termos de busca ou filtros.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayCompras.map(compra => (
                  <tr key={compra.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(compra.criado_em).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{compra.usuarios?.nome || 'Usuário'}</div>
                      <div className="text-slate-400 text-xs">{compra.usuarios?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">
                        {compra.tipo === 'curso' 
                          ? compra.cursos?.nome 
                          : compra.tipo === 'trilha' 
                            ? compra.trilhas?.nome 
                            : 'Acesso Total'}
                      </div>
                      <span className="inline-block text-[10px] bg-slate-100 text-slate-500 font-bold rounded px-1.5 py-0.25 uppercase mt-0.5">
                        {compra.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {compra.cupom_codigo ? (
                        <span className="font-mono text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.75 rounded-md font-bold border border-emerald-100">
                          {compra.cupom_codigo.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-rose-600">
                      {Number(compra.desconto_aplicado) > 0 ? (
                        `-${formatCurrency(Number(compra.desconto_aplicado))}`
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-indigo-600 whitespace-nowrap">
                      {formatCurrency(Number(compra.valor_pago))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize ${
                        compra.status === 'pago' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {compra.status === 'pago' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {compra.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
