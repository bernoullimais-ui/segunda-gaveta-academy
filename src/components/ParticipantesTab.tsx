/**
 * ParticipantesTab — Aba de participantes do curso admin
 *
 * Extraído de CursosAdmin.tsx para reduzir o tamanho do mega-componente.
 * Exibe estatísticas de participação e lista filtrada de participantes.
 */
import React, { useState } from 'react';
import { Users, BarChart2, CheckCircle, Clock, Search, Download, Award } from 'lucide-react';
import { generateCertificatePDF } from '../lib/certificateUtils';

interface CourseStats {
  total: number;
  andamento: number;
  concluido: number;
  taxa: number;
}

interface ParticipantesTabProps {
  stats: CourseStats;
  participants: any[];
  curso: any;
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export function ParticipantesTab({ stats, participants, curso, onShowToast }: ParticipantesTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  const filtered = participants.filter(p => {
    const name = (p.usuarios?.nome || '').toLowerCase();
    const email = (p.usuarios?.email || '').toLowerCase();
    const query = search.toLowerCase();
    const matchSearch = !search || name.includes(query) || email.includes(query);
    const matchStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDownloadCertificate = async (participant: any) => {
    if (!curso?.certificado_template) {
      onShowToast('Este curso não possui um template de certificado configurado.', 'error');
      return;
    }
    try {
      const participantData = {
        id: participant.id,
        nome: participant.usuarios?.nome || participant.usuarios?.email || 'Participante',
        dataConclusao: new Date(participant.updated_at).toLocaleDateString('pt-BR'),
        titulo: curso.nome || 'Certificado de Conclusão',
        cargaHoraria: curso.carga_horaria
      };
      await generateCertificatePDF(curso.certificado_template, participantData);
    } catch {
      onShowToast('Erro ao gerar o certificado. Tente novamente.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: <Users className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
          { label: 'Em Andamento', value: stats.andamento, icon: <Clock className="w-5 h-5" />, color: 'text-yellow-600 bg-yellow-50' },
          { label: 'Concluídos', value: stats.concluido, icon: <CheckCircle className="w-5 h-5" />, color: 'text-green-600 bg-green-50' },
          { label: 'Taxa de Conclusão', value: `${stats.taxa}%`, icon: <BarChart2 className="w-5 h-5" />, color: 'text-purple-600 bg-purple-50' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.color}`}>{card.icon}</div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{card.value}</div>
              <div className="text-xs text-slate-500">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
            placeholder="Buscar participante..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="todos">Todos os status</option>
          <option value="andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
          <option value="inscrito">Inscrito</option>
          <option value="pendente">Pendente</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum participante encontrado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Email</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Status</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Progresso</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {p.usuarios?.nome || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.usuarios?.email || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      p.status === 'concluido' ? 'bg-green-100 text-green-700' :
                      p.status === 'andamento' ? 'bg-yellow-100 text-yellow-700' :
                      p.status === 'inscrito'  ? 'bg-blue-100 text-blue-700' :
                                                  'bg-slate-100 text-slate-600'
                    }`}>
                      {p.status === 'concluido' ? 'Concluído' :
                       p.status === 'andamento' ? 'Em andamento' :
                       p.status === 'inscrito'  ? 'Inscrito' : p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full"
                          style={{ width: `${p.progresso || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-8 text-right">{p.progresso || 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.status === 'concluido' && curso?.certificado_template && (
                      <button
                        onClick={() => handleDownloadCertificate(p)}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        title="Baixar Certificado"
                      >
                        <Award className="w-4 h-4" />
                        Certificado
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Export button */}
      {filtered.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              const csv = ['Nome,Email,Status,Progresso']
                .concat(filtered.map(p =>
                  `"${p.usuarios?.nome || ''}","${p.usuarios?.email || ''}","${p.status || ''}","${p.progresso || 0}%"`
                ))
                .join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'participantes.csv';
              a.click();
            }}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      )}
    </div>
  );
}
