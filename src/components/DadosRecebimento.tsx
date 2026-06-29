import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Landmark, Loader2, Check } from 'lucide-react';

interface DadosRecebimentoProps {
  loggedUser?: any;
  onSave?: () => void;
}

export function DadosRecebimento({ loggedUser, onSave }: DadosRecebimentoProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome_recebedor: '',
    documento: '',
    banco_codigo: '',
    agencia: '',
    agencia_dv: '',
    conta: '',
    conta_dv: '',
    tipo_conta: 'checking_account',
    tipo_chave_pix: 'cpf',
    chave_pix: '',
    pagarme_recipient_id: ''
  });

  useEffect(() => {
    async function loadData() {
      if (!loggedUser?.id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('curriculo_json')
          .eq('id', loggedUser.id)
          .single();

        if (!error && data?.curriculo_json?.dados_recebimento) {
          setFormData({
            ...formData,
            ...data.curriculo_json.dados_recebimento
          });
        }
      } catch (err) {
        console.error("Erro ao carregar dados de recebimento:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [loggedUser?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedUser?.id) return;
    setSaving(true);
    try {
      // 1. Chamar a nossa nova rota para criar/atualizar no Pagar.me
      const res = await fetch('/api/pagarme/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: loggedUser.id,
          dados_bancarios: formData
        })
      });

      const pagarmeData = await res.json();
      
      if (!res.ok) {
        // Erro retornado pelo Pagar.me ou nossa API
        let errorMsg = pagarmeData.error || 'Erro desconhecido';
        if (pagarmeData.details?.errors) {
          // Extrai o primeiro erro legível do Pagar.me
          const firstKey = Object.keys(pagarmeData.details.errors)[0];
          errorMsg = pagarmeData.details.errors[firstKey][0];
        } else if (pagarmeData.details?.message) {
          errorMsg = pagarmeData.details.message;
        }
        throw new Error(errorMsg);
      }

      const newRecipientId = pagarmeData.recipient_id;

      // 2. Atualizar o curriculo_json do usuário com o recipientId
      const { data: userRow } = await supabase
        .from('usuarios')
        .select('curriculo_json')
        .eq('id', loggedUser.id)
        .single();

      const currentCurriculo = userRow?.curriculo_json || {};
      const newFormData = { ...formData, pagarme_recipient_id: newRecipientId || formData.pagarme_recipient_id };
      setFormData(newFormData);
      
      const newCurriculo = {
        ...currentCurriculo,
        dados_recebimento: newFormData
      };

      const { error } = await supabase
        .from('usuarios')
        .update({ curriculo_json: newCurriculo })
        .eq('id', loggedUser.id);

      if (error) throw error;
      alert("Dados de recebimento salvos com sucesso e integrados ao Pagar.me!");
      if (onSave) onSave();
    } catch (err: any) {
      console.error("Erro ao salvar dados de recebimento:", err);
      alert("Erro ao integrar com Pagar.me: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-slate-555 text-sm font-medium">Carregando dados de recebimento...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8 animate-in fade-in">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
          <Landmark className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">Dados de Recebimento</h2>
          <p className="text-slate-500 text-sm">Configure sua conta bancária e chave Pix para receber seus repasses de coprodução.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {/* Nome / Razão Social */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Nome Completo / Razão Social</label>
            <input 
              type="text"
              required
              value={formData.nome_recebedor}
              onChange={e => setFormData({...formData, nome_recebedor: e.target.value})}
              placeholder="Como registrado no banco"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800"
            />
          </div>

          {/* CPF / CNPJ */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">CPF ou CNPJ</label>
            <input 
              type="text"
              required
              value={formData.documento}
              onChange={e => setFormData({...formData, documento: e.target.value})}
              placeholder="Apenas números"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800"
            />
          </div>

          {/* Tipo de Conta */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Tipo de Conta</label>
            <select 
              value={formData.tipo_conta}
              onChange={e => setFormData({...formData, tipo_conta: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800 cursor-pointer"
            >
              <option value="checking_account">Conta Corrente</option>
              <option value="savings_account">Conta Poupança</option>
            </select>
          </div>

          {/* Banco, Agência, Conta */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="space-y-2 md:col-span-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Banco (Código)</label>
              <input 
                type="text"
                required
                value={formData.banco_codigo}
                onChange={e => setFormData({...formData, banco_codigo: e.target.value})}
                placeholder="Ex: 341 (Itaú), 237 (Bradesco), 260 (Nubank)..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800"
              />
            </div>
            
            <div className="space-y-2 md:col-span-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Agência</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  required
                  value={formData.agencia}
                  onChange={e => setFormData({...formData, agencia: e.target.value})}
                  placeholder="Número"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800"
                />
                <input 
                  type="text"
                  value={formData.agencia_dv}
                  onChange={e => setFormData({...formData, agencia_dv: e.target.value})}
                  placeholder="DV"
                  className="w-16 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800 text-center"
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Conta</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  required
                  value={formData.conta}
                  onChange={e => setFormData({...formData, conta: e.target.value})}
                  placeholder="Número"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800"
                />
                <input 
                  type="text"
                  required
                  value={formData.conta_dv}
                  onChange={e => setFormData({...formData, conta_dv: e.target.value})}
                  placeholder="DV"
                  className="w-16 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800 text-center"
                />
              </div>
            </div>
          </div>

          {/* Pix Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Tipo de Chave Pix</label>
              <select 
                value={formData.tipo_chave_pix}
                onChange={e => setFormData({...formData, tipo_chave_pix: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800 cursor-pointer"
              >
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="telefone">Celular</option>
                <option value="email">E-mail</option>
                <option value="aleatoria">Chave Aleatória</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Chave Pix</label>
              <input 
                type="text"
                required
                value={formData.chave_pix}
                onChange={e => setFormData({...formData, chave_pix: e.target.value})}
                placeholder="Digite a chave pix"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800"
              />
            </div>
          </div>

          {/* M14: Recipient ID Pagar.me */}
          <div className="pt-4 border-t border-slate-100">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                Recipient ID Pagar.me 
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px]">Marketplace</span>
              </label>
              <input 
                type="text"
                value={formData.pagarme_recipient_id}
                onChange={e => setFormData({...formData, pagarme_recipient_id: e.target.value})}
                placeholder="Ex: re_xxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800"
              />
              <p className="text-[10px] text-slate-400">Preencha apenas se a organização for um Marketplace credenciado no Pagar.me.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar Dados Financeiros
          </button>
        </div>
      </form>
    </div>
  );
}
