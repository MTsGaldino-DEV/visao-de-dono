# Memória compartilhada — Visão de Dono web

Atualizada em 28/10/2026. Continuidade entre Claude e Codex.
[Perfil geral](../MEMORIA_COMPARTILHADA.md) · [Catálogo](../CATALOGO_FUNCIONALIDADES.md).

## Entrada e evidências

README é curto; começar por `src/pages/home.jsx`, `src/lib/navegacao.js`,
`src/components/Sidebar.jsx` e esta memória. Regras maiores estão em
`docs/superpowers/specs/` e `plans/`.
Fontes analisadas: manifesto, navegação, tabela de serviços, arquivos de domínio,
spec atual de instalação, histórico recente e memória do Claude.
Não houve validação de navegador, banco ou operação em campo.

## Propósito e arquitetura

Gestão web de serviços de campo CEMIG: cadastro, despacho, acompanhamento,
levantamentos, mapa, fechamento/faturamento e instalação de espaçadores.
Companheiro de `../visao-de-dono-app`, com o mesmo backend Supabase.

- React 19, JS/JSX ESM, Vite 8, React Router 7, Supabase e Realtime.
- Há MUI/Emotion, Chart.js, Leaflet, xlsx e Tailwind nas dependências;
  muita UI real usa estilos inline/CSS local. Não deduzir um único framework visual.
- Entrada das telas é `src/pages/home.jsx`; navegação por chave persistida
  em `localStorage` (`vd_tela`), com adaptação das antigas abas.
- Algumas telas ficam montadas e alternam `display`, para preservar estado
  e listeners. Não trocar isso por desmontagem sem avaliar o efeito.
- Login por matrícula em `src/context/AuthContext.jsx`; permissões e cadastro
  em `src/lib/colaboradores.js`/`gerenciarUsuarios.js`.
  Conferir papéis atuais no código, inclusive `fechamento`.

## Design e componentes de referência

- Família de UI: navy `#0F2544`, azul de ação, fundo claro, cartões brancos,
  tabelas densas, status colorido, filtros e modais.
- Não há design system único equivalente ao Warefly: consultar
  `src/components/Sidebar.css`, componentes existentes e estilos inline.
  `src/index.css` é só uma base simples e não descreve o visual inteiro.
- `src/components/ServicosTable.jsx`: filtros/status/postos/localidades,
  multiselect, paginação de 50, edição/transição por perfil, exportação Excel,
  importação com prévia e atualização Realtime.
- `DetalheModal.jsx`: detalhes do serviço; `MapaTab.jsx`: mapa operacional.
- `LevantamentosTab.jsx`: tratamento de levantamentos vindos do campo.
- `Paineltab.jsx`/`src/lib/painel.js`: indicadores.
- `src/components/espacadores/`: fluxo, nova instalação, revisão e vão;
  domínio em `src/lib/espacadores.js` e acesso em `espacadoresApi.js`.
- `src/lib/navegacao.js` centraliza telas/perfis; não duplicar controle de acesso
  só na sidebar. Há testes de domínio/navegação no projeto.

## Decisão crítica: espaçadores

**Desde 19/10/2026: 1 serviço = 1 vão. Um trafo pode ter vários serviços.**
A memória do Claude registra abandono explícito da regra antiga de um serviço
por transformador. A Duplicidade ignora espaçadores nesse critério.
Não reativar cancelamento por repetição do trafo.

Spec atual: `docs/superpowers/specs/2026-10-21-instalacao-um-vao-design.md`,
com ressalvas do código/histórico posterior:

- Uma instalação por vão: foto antes/depois e coordenadas separadas, quantidade,
  vínculo com serviço de espaçador em `servicos`, não na aba Levantamentos.
- Sugestão de vínculo pelo serviço mais próximo da coordenada do antes;
  100 m é escolha de implementação documentada, não regra universal da CEMIG.
- Manter escolha manual; não sobrescrever coordenada original do levantamento.
- Croqui pertence ao Fechamento na revisão, não à coleta da instalação.
- **O código/commit recente mudou a UX da spec:** botão de envio permanece
  clicável e destaca em vermelho campos faltantes. Não restaurar botão
  desabilitado só porque o documento de 21/10 dizia isso.
- Texto de interface passou de NSMC para NSPR sem renomear o banco.
- Quantidades antigas de instalações/cancelamentos nos documentos são snapshots,
  não autorização atual para apagar registros.

## Decisão: Mapa de cobertura e coordenadas (28/10/2026)

Spec: `docs/superpowers/specs/2026-10-28-mapa-cobertura-coordenadas-design.md`.

- O Mapa (`MapaTab.jsx`, chave `mapa`) virou **mapa de cobertura de
  levantamento** e saiu do grupo próprio para o grupo **Despacho**. Ele tem fundo
  escuro (CARTO), áreas = envoltória convexa dos serviços de ponta, e abre área nova
  a partir de **1 km** (régua na tela, valor a ajustar com o uso). Os pins são
  **bolinhas na cor do status**. O pin em gota grande foi rejeitado por poluir.
- Por enquanto não há filtro por levantador (`orig`); Matheus disse que não precisa.
- **Leitura única de coordenada em `src/lib/coordenadas.js`**: `lerCoordenada`,
  `validarCoordenada` (vazia/formato/fora_brasil), `formatarCoordenada`,
  `distanciaMetros`. `espacadores.js` só reexporta. Não criar outro parser.
- **Fora do Brasil = coordenada incorreta** (caixa lat −33,8…5,3 / lng −74…−34,7).
  Havia serviços no Atlântico Norte, com latitude sem sinal de menos.
- Coordenada preenchida e incorreta é barrada no Cadastro, na edição
  (DetalheModal) e na importação de planilha. Coordenadas novas e editadas são gravadas
  normalizadas (`"lat lng"`, ponto, 6 casas). As antigas não foram reescritas e
  ganham o selo "Coordenada incorreta" na lista de Serviços e a lista
  "Corrigir coordenada" no painel do Mapa.
- A checagem de repetidos da importação e a busca por proximidade usam a
  coordenada normalizada.
- **Próximo pedido (não iniciado):** uma aba com os serviços que **não** são de
  espaçador, ao lado de "Serviços" (todos) e "Espaçadores". Ainda precisa de
  brainstorming com Matheus.

## Integrações e cuidados

- Mudanças em `servicos`, fotos, atribuição/status e levantamentos podem afetar
  o app. Consultar a memória dele antes de mudar o contrato.
- Realtime pede limpeza de canais e cuidado para não perder filtros/estado
  ao atualizar. `fetchAll` existe em `src/lib/supabase.js` para paginar leitura.
- Não tratar código Firebase remanescente em `src/firebase/` como backend
  principal sem verificar consumidores.
- Conector em `conector/` é separado da aplicação web; não confundir com o
  conector TraceOne ou Warefly.

## Comandos e estado desta tarefa

`npm.cmd run dev`, `npm.cmd run build`, `npm.cmd test`.
`graft` (índice do código em `graft/`) é um atalho para o CLI `trail`
(`@trailhq/trail-code`, instalado global). Instalar `@nanonets/graft` falha neste
Windows porque o build nativo exige Visual Studio.
Vitest cobre partes de domínio. Há arquivo ESLint, mas não script `lint`
no manifesto lido. `npm.cmd run deploy` publica via gh-pages e não é um teste.

A alteração preexistente em `scripts/limpar-instalacoes-teste.sql` e o arquivo
`.ignore` foram preservados. Esta tarefa só adicionou memória e instruções.

28/10/2026 (Mapa de cobertura): `npx vitest run` (112 testes) e `vite build`
passaram. O cálculo de áreas com 1.700 pontos leva ~100 ms. **Não houve validação
no navegador com login real** nem leitura do banco, que exige login. Os formatos
reais de coordenada foram inferidos do código e do relato de Matheus.
O ESLint acusa erros antigos em `DetalheModal.jsx`/`ServicosTable.jsx` que não
vieram desta mudança.

