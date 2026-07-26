import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Loader2, FileText, Building2, Hash, MapPin } from 'lucide-react';

interface DadosFiscaisProps {
  loggedUser: any;
  isAdmin?: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function DadosFiscais({ loggedUser, isAdmin, showToast }: DadosFiscaisProps) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('');
  const [regimeTributario, setRegimeTributario] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [emailFiscal, setEmailFiscal] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    async function fetchDados() {
      try {
        const orgId = loggedUser?.organizacao_id;
        if (!orgId) return;
        const { data } = await supabase
          .from('organizacoes')
          .select('dados_fiscais')
          .eq('id', orgId)
          .maybeSingle();
        if (data?.dados_fiscais) {
          const df = data.dados_fiscais;
          setRazaoSocial(df.razao_social || '');
          setCnpj(df.cnpj || '');
          setInscricaoEstadual(df.inscricao_estadual || '');
          setInscricaoMunicipal(df.inscricao_municipal || '');
          setRegimeTributario(df.regime_tributario || '');
          setEndereco(df.endereco || '');
          setCep(df.cep || '');
          setCidade(df.cidade || '');
          setEstado(df.estado || '');
          setEmailFiscal(df.email_fiscal || '');
          setObservacoes(df.observacoes || '');
        }
      } catch (err) {
        console.error('Erro ao buscar dados fiscais:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDados();
  }, [loggedUser]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const orgId = loggedUser?.organizacao_id;
      if (!orgId) throw new Error('Organização não encontrada.');
      const dados_fiscais = {
        razao_social: razaoSocial,
        cnpj,
        inscricao_estadual: inscricaoEstadual,
        inscricao_municipal: inscricaoMunicipal,
        regime_tributario: regimeTributario,
        endereco,
        cep,
        cidade,
        estado,
        email_fiscal: emailFiscal,
        observacoes,
      };
      const { error } = await supabase
        .from('organizacoes')
        .update({ dados_fiscais })
        .eq('id', orgId);
      if (error) throw error;
      showToast('Dados fiscais salvos com sucesso!', 'success');
    } catch (err: any) {
      showToast('Erro ao salvar dados fiscais: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-900">Dados Fiscais</h3>
          <p className="text-sm text-slate-500">Informações para emissão de notas fiscais e documentos legais.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
            <Building2 className="w-4 h-4" />Razão Social
          </label>
          <input type="text" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)}
            placeholder="Empresa Ltda."
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
            <Hash className="w-4 h-4" />CNPJ
          </label>
          <input type="text" value={cnpj} onChange={e => setCnpj(e.target.value)}
            placeholder="00.000.000/0001-00"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Regime Tributário</label>
          <select value={regimeTributario} onChange={e => setRegimeTributario(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white">
            <option value="">Selecione...</option>
            <option value="simples_nacional">Simples Nacional</option>
            <option value="lucro_presumido">Lucro Presumido</option>
            <option value="lucro_real">Lucro Real</option>
            <option value="mei">MEI</option>
            <option value="autonomo">Autônomo / Pessoa Física</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Inscrição Estadual</label>
          <input type="text" value={inscricaoEstadual} onChange={e => setInscricaoEstadual(e.target.value)}
            placeholder="Opcional"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Inscrição Municipal</label>
          <input type="text" value={inscricaoMunicipal} onChange={e => setInscricaoMunicipal(e.target.value)}
            placeholder="Opcional"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
            <MapPin className="w-4 h-4" />Endereço Completo
          </label>
          <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)}
            placeholder="Rua, número, complemento, bairro"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">CEP</label>
          <input type="text" value={cep} onChange={e => setCep(e.target.value)}
            placeholder="00000-000"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Cidade</label>
          <input type="text" value={cidade} onChange={e => setCidade(e.target.value)}
            placeholder="São Paulo"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Estado (UF)</label>
          <input type="text" value={estado} onChange={e => setEstado(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="SP" maxLength={2}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">E-mail para NF</label>
          <input type="email" value={emailFiscal} onChange={e => setEmailFiscal(e.target.value)}
            placeholder="fiscal@empresa.com.br"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Observações Fiscais</label>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
            placeholder="Informações adicionais para notas fiscais..." rows={3}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none" />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50 shadow-sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Dados Fiscais
        </button>
      </div>
    </div>
  );
}
