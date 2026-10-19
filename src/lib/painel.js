// Cálculos do Painel

// Anotações do histórico que de fato concluem um serviço. Não basta conter "conclu":
// "descartado pela aba de concluídos" ou anotações de restauração não são conclusão.
const CONCLUSAO = [
  /^Serviço concluído/i,
  /^Status alterado para "Concluído"/i,
  /^Instalação enviada para o fechamento/i, // fluxo de espaçadores: o status vira concluído aqui
];

// Data da última anotação de conclusão, ou null
export const dataConclusao = (hist) => {
  const entrada = [...(hist || [])].reverse().find(h => CONCLUSAO.some(re => re.test(h?.msg || '')));
  if (!entrada?.when) return null;
  const d = new Date(entrada.when);
  return isNaN(d.getTime()) ? null : d;
};
