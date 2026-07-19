/**
 * Utilitário para interpretar e avaliar fórmulas estilo Excel
 */

export function evaluateFormula(formulaStr: string, valuesMap: Record<string, any>): number {
  if (!formulaStr) return 0;
  
  let expr = formulaStr.trim();
  if (expr.startsWith('=')) {
    expr = expr.substring(1);
  }

  // Substituir os campos visuais [NOME] por variáveis seguras (_v0, _v1...)
  let varCounter = 0;
  const varMap: Record<string, any> = {};
  
  expr = expr.replace(/\[([^\]]+)\]/g, (match, fieldName) => {
    let val = valuesMap[fieldName];
    if (val === undefined || val === null || val === '') {
      val = 0;
    }
    const varName = `_v${varCounter++}`;
    varMap[varName] = val;
    return varName;
  });

  // Funções disponíveis
  const context = {
    SE: (cond: boolean, a: any, b: any) => (cond ? a : b),
    MÁXIMO: (...args: number[]) => Math.max(...args),
    MÍNIMO: (...args: number[]) => Math.min(...args),
    SOMA: (...args: any[]) => {
      let sum = 0;
      const flat = args.flat(Infinity);
      for (const val of flat) {
        sum += (Number(val) || 0);
      }
      return sum;
    },
    ...varMap
  };

  // Substituir ponto-e-vírgula por vírgula (formato brasileiro do Excel)
  expr = expr.replace(/;/g, ',');
  
  try {
    const keys = Object.keys(context);
    const values = Object.values(context);
    
    // Evaluates expression in an isolated scope with only the defined context variables
    const fn = new Function(...keys, `return ${expr};`);
    const result = fn(...values);
    
    if (isNaN(result) || !isFinite(result)) {
      return 0; // Fallback seguro para erros matemáticos (ex: divisão por zero)
    }
    return Number(result);
  } catch (err) {
    console.error('Formula evaluation error:', err);
    return 0;
  }
}

export function buildGlobalValuesMap(
  missoes: any[], 
  respostasMap: Record<string, any>, 
  currentMissaoId?: string, 
  rascunhoCurrent?: Record<string, any>
): Record<string, any> {
  const map: Record<string, any> = {};

  // 1. Coletar todos os valores base (não calculados)
  missoes.forEach(m => {
    const respostas = (m.id === currentMissaoId && rascunhoCurrent) 
      ? rascunhoCurrent 
      : (respostasMap[m.id]?.respostas_json || {});
      
    (m.campos_json || []).forEach((c: any) => {
      if (c.tipo !== 'calculado') {
        if (c.tipo === 'tabela' && Array.isArray(respostas[c.id])) {
          // Extrair colunas para permitir [id:0], [id:1]
          const tableData: any[][] = respostas[c.id];
          const numCols = c.colunas?.length || 0;
          for (let colIdx = 0; colIdx < numCols; colIdx++) {
            map[`${c.id}:${colIdx}`] = tableData.map(row => row[colIdx]);
          }
        } else {
          map[c.id] = respostas[c.id];
        }
      }
    });
  });

  // 2. Avaliar campos calculados (em múltiplas passagens para dependências em cascata)
  // Max 3 passagens para evitar loops infinitos
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    missoes.forEach(m => {
      (m.campos_json || []).forEach((c: any) => {
        if (c.tipo === 'calculado' && c.formula) {
          const result = evaluateFormula(c.formula, map);
          if (map[c.id] !== result) {
            map[c.id] = result;
            changed = true;
          }
        }
      });
    });
    if (!changed) break;
  }

  return map;
}
