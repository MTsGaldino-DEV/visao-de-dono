import { useState, useEffect, useCallback } from 'react';
import { agruparVaos, ativosNoFluxo } from '../../lib/espacadores';
import { carregarServicosFluxo, carregarTodosVaos, assinarMudancas } from '../../lib/espacadoresApi';

// Serviços do fluxo novo (com etapa) + vãos agrupados por serviço, com realtime
export const useFluxoEspacadores = (canal) => {
  const [servicos, setServicos] = useState([]);
  const [vaosPorServico, setVaosPorServico] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const recarregar = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([carregarServicosFluxo(), carregarTodosVaos()]);
      setServicos(ativosNoFluxo(s));
      setVaosPorServico(agruparVaos(v));
      setErro(null);
    } catch (e) {
      console.error('Erro ao carregar instalações:', e);
      setErro(e.message || String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
    return assinarMudancas(canal, recarregar);
  }, [canal, recarregar]);

  return { servicos, vaosPorServico, carregando, erro };
};
