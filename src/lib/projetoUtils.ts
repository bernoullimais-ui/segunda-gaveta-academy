import { jsPDF } from 'jspdf';
import type { ProjetoTemplate, ProjetoMissao, ProjetoResposta, CampoConfig } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(campo: CampoConfig, valor: any): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  switch (campo.tipo) {
    case 'checkbox':
      return Array.isArray(valor) ? valor.join(', ') || '—' : String(valor);
    case 'selecao_unica':
      return String(valor);
    case 'numero': {
      const num = String(valor);
      if (campo.unidade === '%') return `${num}%`;
      if (campo.unidade) return `${campo.unidade} ${num}`;
      return num;
    }
    case 'tabela': {
      if (!Array.isArray(valor)) return '—';
      const cols = campo.colunas || [];
      return valor
        .filter(row => row.some((c: string) => c.trim()))
        .map(row => cols.map((col, i) => `${col}: ${row[i] || '—'}`).join(' | '))
        .join('\n') || '—';
    }
    case 'upload': {
      if (typeof valor === 'object' && valor?.nome) return valor.nome;
      return 'Arquivo enviado';
    }
    case 'data':
      if (!valor) return '—';
      try {
        return new Date(valor + 'T00:00:00').toLocaleDateString('pt-BR');
      } catch { return valor; }
    default:
      return String(valor);
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function exportarProjetoPDF(params: {
  template: ProjetoTemplate;
  missoes: ProjetoMissao[];
  respostas: ProjetoResposta[];
  nomeAluno: string;
  nomeCurso: string;
}): Promise<void> {
  const { template, missoes, respostas, nomeAluno, nomeCurso } = params;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ── Cores & Fontes ──
  const BLUE_DARK = [15, 23, 42] as [number, number, number];
  const BLUE_MID = [37, 99, 235] as [number, number, number];
  const BLUE_LIGHT = [239, 246, 255] as [number, number, number];
  const SLATE_600 = [71, 85, 105] as [number, number, number];
  const SLATE_200 = [226, 232, 240] as [number, number, number];
  const AMBER_50 = [255, 251, 235] as [number, number, number];
  const AMBER_700 = [180, 83, 9] as [number, number, number];
  const WHITE = [255, 255, 255] as [number, number, number];

  const newPage = () => {
    pdf.addPage();
    y = margin;
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageH - margin) newPage();
  };

  // ─────────────────────────────────────────────────────────
  // CAPA
  // ─────────────────────────────────────────────────────────
  pdf.setFillColor(...BLUE_DARK);
  pdf.rect(0, 0, pageW, pageH, 'F');

  // Faixa azul lateral esquerda
  pdf.setFillColor(...BLUE_MID);
  pdf.rect(0, 0, 8, pageH, 'F');

  // Título do projeto
  pdf.setTextColor(...WHITE);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(26);
  pdf.text(template.titulo, margin, 70, { maxWidth: contentW });

  // Nome do curso
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.setTextColor(148, 163, 184); // slate-400
  pdf.text(nomeCurso, margin, 88, { maxWidth: contentW });

  // Linha separadora
  pdf.setDrawColor(...BLUE_MID);
  pdf.setLineWidth(0.5);
  pdf.line(margin, 95, margin + 60, 95);

  // Aluno
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...WHITE);
  pdf.text(nomeAluno, margin, 106);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(148, 163, 184);
  pdf.text(new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' }), margin, 114);

  // Descrição
  if (template.descricao) {
    pdf.setFontSize(10);
    pdf.setTextColor(203, 213, 225); // slate-300
    const descLines = pdf.splitTextToSize(template.descricao, contentW);
    pdf.text(descLines, margin, pageH - 50);
  }

  // Resultado esperado
  pdf.setFillColor(30, 41, 59); // slate-800
  pdf.rect(margin, pageH - 40, contentW, 28, 'F');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...WHITE);
  pdf.text('RESULTADO ESPERADO AO FINAL DO PREENCHIMENTO', margin + 6, pageH - 31);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(148, 163, 184);
  pdf.text([
    '1. Identificar o maior gargalo comercial',
    '2. Encontrar uma oportunidade clara',
    '3. Definir uma ação prática',
  ], margin + 6, pageH - 25);

  // ─────────────────────────────────────────────────────────
  // MISSÕES
  // ─────────────────────────────────────────────────────────
  const sortedMissoes = [...missoes].sort((a, b) => a.ordem - b.ordem);

  sortedMissoes.forEach((missao, mIdx) => {
    pdf.addPage();
    y = 0;

    // Header da missão — fundo azul escuro
    pdf.setFillColor(...BLUE_DARK);
    pdf.rect(0, 0, pageW, 32, 'F');
    pdf.setFillColor(...BLUE_MID);
    pdf.rect(0, 0, 8, 32, 'F');

    // Número da missão (lateral vertical) 
    pdf.setFillColor(...BLUE_MID);
    pdf.rect(0, 32, 8, pageH - 32, 'F');
    pdf.setTextColor(...WHITE);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    // Texto rotacionado — índice da missão
    pdf.text(`MISSÃO ${mIdx + 1}`, 6, pageH / 2 + 20, { angle: 90 });

    // Índice numérico
    pdf.setFontSize(22);
    pdf.setTextColor(...WHITE);
    pdf.text(String(mIdx + 1).padStart(2, '0'), margin, 22);

    // Título da missão
    pdf.setFontSize(15);
    pdf.setFont('helvetica', 'bold');
    pdf.text(missao.titulo, margin + 16, 14, { maxWidth: contentW - 20 });

    // Subtítulo / descrição curta
    if (missao.descricao) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(203, 213, 225);
      pdf.text(missao.descricao, margin + 16, 22, { maxWidth: contentW - 20 });
    }

    y = 42;

    // Resposta desta missão
    const resposta = respostas.find(r => r.missao_id === missao.id);
    const respostasJson: Record<string, any> = resposta?.respostas_json || {};
    const feedbacksJson: Record<string, string> = resposta?.feedbacks_campos_json || {};

    // Status badge
    pdf.setFillColor(...BLUE_LIGHT);
    pdf.roundedRect(margin, y, 45, 7, 2, 2, 'F');
    pdf.setTextColor(...BLUE_MID);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    const statusLabel = !resposta ? 'Não preenchida'
      : resposta.status === 'com_feedback' ? 'Com Feedback'
      : resposta.status === 'submetido' ? 'Submetida'
      : 'Rascunho';
    pdf.text(statusLabel.toUpperCase(), margin + 4, y + 5);
    y += 12;

    // Campos
    missao.campos_json.forEach(campo => {
      checkPageBreak(22);

      // Label
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...SLATE_600);
      pdf.text(campo.label + (campo.obrigatorio ? ' *' : ''), margin, y);
      y += 5;

      // Valor
      const raw = respostasJson[campo.id];
      const formatted = formatValue(campo, raw);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...BLUE_DARK);

      if (campo.tipo === 'tabela' && Array.isArray(raw) && raw.length > 0) {
        // Renderiza tabela
        const cols = campo.colunas || [];
        const colW = contentW / Math.max(cols.length, 1);
        // Header
        pdf.setFillColor(...BLUE_LIGHT);
        pdf.rect(margin, y, contentW, 6, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...BLUE_DARK);
        cols.forEach((col, ci) => {
          pdf.text(col, margin + ci * colW + 2, y + 4.5);
        });
        y += 6;
        raw.filter((row: string[]) => row.some(c => c?.trim())).forEach((row: string[]) => {
          checkPageBreak(8);
          pdf.setDrawColor(...SLATE_200);
          pdf.line(margin, y, margin + contentW, y);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(...BLUE_DARK);
          cols.forEach((_col, ci) => {
            pdf.text(String(row[ci] || '—'), margin + ci * colW + 2, y + 5);
          });
          y += 7;
        });
        y += 2;
      } else {
        const lines = pdf.splitTextToSize(formatted, contentW);
        const lineH = 5;
        const blockH = lines.length * lineH + 4;
        checkPageBreak(blockH + 4);

        // Fundo do campo
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(...SLATE_200);
        pdf.roundedRect(margin, y, contentW, blockH, 1.5, 1.5, 'FD');
        pdf.setTextColor(...BLUE_DARK);
        pdf.text(lines, margin + 3, y + 5);
        y += blockH + 2;
      }

      // Feedback inline do especialista
      const fbCampo = feedbacksJson[campo.id];
      if (fbCampo && resposta?.feedback_publicado) {
        checkPageBreak(12);
        pdf.setFillColor(...AMBER_50);
        pdf.setDrawColor(251, 191, 36);
        const fbLines = pdf.splitTextToSize(`💬 ${fbCampo}`, contentW - 8);
        const fbH = fbLines.length * 5 + 6;
        pdf.roundedRect(margin, y, contentW, fbH, 1.5, 1.5, 'FD');
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(8);
        pdf.setTextColor(...AMBER_700);
        pdf.text(fbLines, margin + 4, y + 5);
        y += fbH + 3;
      }

      y += 5;
    });

    // Feedback geral da missão
    if (resposta?.feedback_geral && resposta.feedback_publicado) {
      checkPageBreak(30);
      y += 4;
      pdf.setFillColor(254, 243, 199);
      pdf.setDrawColor(252, 211, 77);
      const fbLines = pdf.splitTextToSize(resposta.feedback_geral, contentW - 12);
      const fbH = fbLines.length * 5 + 14;
      pdf.roundedRect(margin, y, contentW, fbH, 2, 2, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...AMBER_700);
      pdf.text('Feedback do Especialista', margin + 5, y + 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.text(fbLines, margin + 5, y + 15);
      y += fbH + 4;
    }
  });

  // ─────────────────────────────────────────────────────────
  // Salvar
  // ─────────────────────────────────────────────────────────
  const safeName = nomeAluno.replace(/[^a-zA-ZÀ-ú0-9\s]/g, '').trim().replace(/\s+/g, '_');
  const safeTitle = template.titulo.replace(/[^a-zA-ZÀ-ú0-9\s]/g, '').trim().replace(/\s+/g, '_');
  pdf.save(`${safeTitle}_${safeName}.pdf`);
}
