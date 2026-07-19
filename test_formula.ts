import { evaluateFormula, buildGlobalValuesMap } from './src/lib/formulaParser';

const missoes = [{
  id: 'missao1',
  campos_json: [
    {
      id: 'w7bfey9k',
      tipo: 'tabela',
      colunas: ['Item', 'Resultado']
    },
    {
      id: 'calc1',
      tipo: 'calculado',
      formula: '=MÁXIMO([w7bfey9k:0:0]; [w7bfey9k:1:1])'
    }
  ]
}];

const respostasMap = {
  missao1: {
    respostas_json: {
      w7bfey9k: [
        ['Fat Atual', '40000'],
        ['Meta', '44000']
      ]
    }
  }
};

const map = buildGlobalValuesMap(missoes, respostasMap);
console.log(map);

