/**
 * SplitsTab — Aba de configuração de split de receita e comissão de afiliados
 *
 * Extraído de CursosAdmin.tsx para reduzir o mega-componente.
 * Permite configurar coproduções (divisão de receita) e comissão para afiliados.
 */
import React, { useState } from 'react';
import { DollarSign, Plus, Trash2, Save } from 'lucide-react';

interface SplitEntry {
  usuario_id: string;
  porcentagem: number;
}

interface SplitsTabProps {
  orgUsers: any[];
  splits: SplitEntry[];
  affiliateCommission: number;
  isSaving: boolean;
  onSave: (splits: SplitEntry[], affiliateComm: number) => Promise<void>;
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export function SplitsTab({
  orgUsers,
  splits,
  affiliateCommission,
  isSaving,
  onSave,
  onShowToast
}: SplitsTabProps) {
  const [localSplits, setLocalSplits] = useState<SplitEntry[]>(splits);
  const [localAffiliate, setLocalAffiliate] = useState(affiliateCommission);
  const [selectedUser, setSelectedUser] = useState('');
  const [newPct, setNewPct] = useState('');

  const totalPct = localSplits.reduce((acc, s) => acc + s.porcentagem, 0);

  const handleAdd = () => {
    const userId = selectedUser;
    const pct = Number(newPct);

    if (!userId || isNaN(pct) || pct <= 0) {
      onShowToast('Por favor, selecione um especialista e digite uma porcentagem válida.', 'error');
      return;
    }
    if (totalPct + pct > 100) {
      onShowToast(
        `A soma das porcentagens não pode ultrapassar 100% (atual: ${totalPct}% + novo: ${pct}% = ${totalPct + pct}%).`,
        'error'
      );
      return;
    }

    setLocalSplits(prev => [...prev, { usuario_id: userId, porcentagem: pct }]);
    setSelectedUser('');
    setNewPct('');
  };

  const handleRemove = (idx: number) => {
    setLocalSplits(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    await onSave(localSplits, localAffiliate);
  };

  const getUserName = (userId: string) => {
    const user = orgUsers.find(u => u.id === userId);
    return user ? `${user.nome} (${user.email})` : userId;
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Affiliate commission */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-indigo-500" />
          Comissão de Afiliados
        </h3>
        <p className="text-sm text-slate-500">
          Percentual pago automaticamente ao afiliado que originou a venda (via link de indicação).
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            max="100"
            value={localAffiliate}
            onChange={e => setLocalAffiliate(Number(e.target.value))}
            className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
          />
          <span className="text-sm text-slate-600">% de comissão por venda</span>
        </div>
      </div>

      {/* Co-producers split */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-500" />
          Coproduções (Split de Receita)
        </h3>
        <p className="text-sm text-slate-500">
          Configure como a receita líquida (após comissão de afiliados) é dividida entre os membros da organização.
        </p>

        {/* Current splits */}
        {localSplits.length > 0 && (
          <div className="space-y-2">
            {localSplits.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2 text-sm">
                <span className="text-slate-700">{getUserName(s.usuario_id)}</span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-800">{s.porcentagem}%</span>
                  <button
                    onClick={() => handleRemove(idx)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <div className="text-right text-xs text-slate-500 pr-2">
              Total distribuído: <span className={`font-bold ${totalPct > 100 ? 'text-red-600' : 'text-slate-700'}`}>{totalPct}%</span>
            </div>
          </div>
        )}

        {/* Add new split */}
        <div className="flex gap-2">
          <select
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
          >
            <option value="">Selecione um especialista...</option>
            {orgUsers
              .filter(u => !localSplits.find(s => s.usuario_id === u.id))
              .map(u => (
                <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>
              ))}
          </select>
          <input
            type="number"
            min="1"
            max="100"
            placeholder="%"
            value={newPct}
            onChange={e => setNewPct(e.target.value)}
            className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
          />
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        <Save className="w-4 h-4" />
        {isSaving ? 'Salvando...' : 'Salvar Configurações'}
      </button>
    </div>
  );
}
