import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, RefreshCw, Download, AlertCircle, FileText, CheckCircle2, XCircle } from 'lucide-react';

interface Invoice {
  id: string;
  transaction_id: string;
  buyer_name: string;
  buyer_email: string;
  amount: number;
  focus_nf_status: string;
  focus_nf_numero?: string;
  xml_url?: string;
  pdf_url?: string;
  error_message?: string;
  created_at: string;
}

interface NotasEmitidasListProps {
  loggedUser: any;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function NotasEmitidasList({ loggedUser, showToast }: NotasEmitidasListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [reprocessing, setReprocessing] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [filterStatus]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      let query = supabase.from('invoices').select('*').order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('focus_nf_status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvoices(data || []);
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao carregar notas fiscais', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleReprocess(transactionId: string) {
    if (!confirm('Deseja reagendar o processamento para todas as notas com falha nesta transação?')) return;
    setReprocessing(transactionId);
    
    try {
      // 1. Delete as notas dessa transação que deram erro para que o job as recrie limpas
      // (Isso é opcional, mas garante que o job não pule se houver lixo)
      await supabase.from('invoices').delete().eq('transaction_id', transactionId).eq('focus_nf_status', 'ERROR');
      
      // 2. Voltar o Job para PENDING
      const { error } = await supabase
        .from('invoice_jobs')
        .update({ status: 'PENDING', attempts: 0, scheduled_for: new Date().toISOString() })
        .eq('transaction_id', transactionId);

      if (error) throw error;
      
      showToast('Transação enviada para reprocessamento!', 'success');
      fetchInvoices();
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao reprocessar: verifique permissões ou contate o suporte.', 'error');
    } finally {
      setReprocessing(null);
    }
  }

  const filteredInvoices = invoices.filter(inv => 
    inv.buyer_name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.buyer_email?.toLowerCase().includes(search.toLowerCase()) ||
    inv.transaction_id?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AUTHORIZED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><CheckCircle2 size={14}/> Autorizada</span>;
      case 'ERROR':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800"><AlertCircle size={14}/> Erro</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800"><XCircle size={14}/> Cancelada</span>;
      case 'PROCESSING':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"><Loader2 size={14} className="animate-spin"/> Processando</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800"><Loader2 size={14} className="animate-spin"/> Pendente</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Buscar por cliente, e-mail ou transação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 pl-10 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
          />
          <div className="absolute left-3 top-2.5 text-slate-400">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex gap-2">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm font-medium text-slate-700"
          >
            <option value="all">Todos os Status</option>
            <option value="AUTHORIZED">Autorizadas</option>
            <option value="ERROR">Com Erro</option>
            <option value="PENDING">Pendentes</option>
            <option value="PROCESSING">Processando</option>
          </select>
          <button 
            onClick={fetchInvoices}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-600"
            title="Atualizar"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Transação / Data</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                    Carregando fila...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                    Nenhuma nota fiscal encontrada na fila.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-900 truncate max-w-[150px]" title={invoice.transaction_id}>
                        {invoice.transaction_id}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(invoice.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900">{invoice.buyer_name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[150px]">{invoice.buyer_email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-800">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2 items-start">
                        {getStatusBadge(invoice.focus_nf_status)}
                        {invoice.error_message && (
                          <div className="text-[10px] text-red-600 max-w-[180px] break-words leading-tight bg-red-50 p-1.5 rounded border border-red-100">
                            {invoice.error_message.substring(0, 80)}{invoice.error_message.length > 80 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {invoice.pdf_url && (
                          <a href={invoice.pdf_url} target="_blank" rel="noreferrer" className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Baixar PDF">
                            <FileText size={18} />
                          </a>
                        )}
                        {invoice.xml_url && (
                          <a href={invoice.xml_url} target="_blank" rel="noreferrer" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Baixar XML">
                            <Download size={18} />
                          </a>
                        )}
                        {invoice.focus_nf_status === 'ERROR' && (
                          <button 
                            onClick={() => handleReprocess(invoice.transaction_id)}
                            disabled={reprocessing === invoice.transaction_id}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Reprocessar Fila"
                          >
                            <RefreshCw size={18} className={reprocessing === invoice.transaction_id ? 'animate-spin' : ''} />
                          </button>
                        )}
                      </div>
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
