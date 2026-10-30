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
  escuro (OpenStreetMap escurecido por CSS; a CARTO Dark exige chave de API e
  apareceu em produção com "API KEY REQUIRED"), áreas = envoltória convexa dos serviços de ponta, e abre área nova
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
- O DetalheModal (z 200) abria por trás do mapa. O container do mapa usa
  `isolation: isolate` para prender os z-index do Leaflet; não remover.

## Decisão: menu por origem dos dados (28/10/2026)

- Despacho: Serviços · **Serviços diversos** · Espaçadores · Instalações · Mapa.
  "Serviços diversos" é `ServicosTable filterType="diversos"`, ou seja, todos os
  serviços menos os de espaçador. É o complemento exato da lista de Espaçadores:
  as duas usam `isEspacador` de `src/lib/espacadores.js` (regex na descrição).
- Novo grupo **"App de campo"** (`id: 'campo'`) para telas que só têm conteúdo
  quando o app Android envia dados. Hoje só contém **Levantamentos**. O app grava
  apenas em `levantamentos` e `servicos`, e Serviços também é alimentada pelo web,
  por isso fica no Despacho. Nova tela dependente do app vai para esse grupo.

## Decisão: equipe e apropriação nas Instalações (30/10/2026)

- **Equipe** = número digitado (texto livre, escolha do Matheus; não é lista de
  Colaboradores). Fica em `vaos.equipe` e é **obrigatória**: na Nova instalação e em
  `pendenciasInstalacao` (instalação reaberta sem equipe não é enviada). Pode ser editada
  no VaoCard em "Em instalação".
- **Apropriação** = nº digitado pelo fechamento **depois da NSPR**, com o serviço já em
  "Pago": ação `apropriacao` (pago → pago, não mexe em `dt_etapa`), botão
  "Informar apropriação" na linha. Fica em `servicos.apropriacao`.
  Não é puxada da planilha da aba Faturamento.
- Colunas da lista: … NSMP · NSPR · **Equipe** (sempre) · Desde · **Apropriação**
  (só nos filtros Pago e Todas) · Ações.
- Script `supabase/migrations/instalacao_equipe_apropriacao.sql`. Só acrescenta colunas e
  precisa rodar no SQL Editor **antes** de publicar: sem a coluna `vaos.equipe` a Nova
  instalação falha.

## Decisão: quem fecha corrige tudo + Excel por etapa (30/10/2026)

- Quem tem `permissoesFluxo().fechar` (fechamento e dono) corrige a instalação inteira
  em **qualquer etapa**, por "Ver detalhes" ou "Revisar", sem mudar a etapa.
  Isso inclui o quadro "Dados do serviço" (trafo, localidade e os números que a etapa já
  alcançou, via `camposCorrigiveis`), fotos, coordenadas, quantidade e equipe. Um único
  "Salvar alterações" grava tudo (`corrigirInstalacao`) e registra no histórico
  "Instalação corrigida: campo: antes → depois". Troca de foto também vai para o histórico.
  NSMP/NSPR informadas não podem ser apagadas; a apropriação pode ficar vazia.
  Na revisão, Aprovar exige salvar antes.
- O modo `revisao` do VaoCard (só a quantidade) e `corrigirQuantidade`/`montarPayloadQuantidade`
  foram removidos: a correção completa os substitui.
- **"Baixar Excel"** na lista de Instalações gera um `.xlsx` real (lib `xlsx`) da etapa
  na tela, com a busca aplicada. Colunas em `linhasPlanilhaInstalacoes`, incluindo coordenadas
  e links das fotos. A lista de Serviços continua exportando CSV.

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

**Commit (lei de Matheus):** a mensagem é somente
`Corrigimos alguns erros e melhoramos a experiência geral. Até breve, Matheus`,
sem título, sem descrição e sem `Co-Authored-By`. Ver o perfil APPWEB.
Os commits `1934f35`, `5873e36`, `dba60c3`, `da81fc5` e `7c3be2a` (28/10) saíram
fora desse padrão e já estavam publicados. Não foram reescritos porque isso
exigiria force push na `main`.

A alteração preexistente em `scripts/limpar-instalacoes-teste.sql` e o arquivo
`.ignore` foram preservados. Esta tarefa só adicionou memória e instruções.

28/10/2026 (Mapa de cobertura): `npx vitest run` (112 testes) e `vite build`
passaram. O cálculo de áreas com 1.700 pontos leva ~100 ms. **Não houve validação
no navegador com login real** nem leitura do banco, que exige login. Os formatos
reais de coordenada foram inferidos do código e do relato de Matheus.
O ESLint acusa erros antigos em `DetalheModal.jsx`/`ServicosTable.jsx` que não
vieram desta mudança.

30/10/2026 (equipe e apropriação): `npx vitest run` (116 testes), `vite build` e ESLint
dos arquivos de espaçadores passaram. Lista, Nova instalação e VaoCard foram conferidos
em capturas headless com dados simulados. Matheus rodou o SQL no SQL Editor; as colunas
foram confirmadas pela API. Commit `e85a617` enviado e site publicado em 30/10. O bundle
no ar tem "Nº da equipe" e "Nº apropriação". Não houve teste com login real.
O `gh-pages` grava o commit da branch `gh-pages` com a mensagem padrão dele ("Updates").
Para seguir a lei de commit, publicar com `npx gh-pages -d dist -m "<frase>"` depois do build.

30/10/2026 (correção por quem fecha + Excel): 120 testes, build e ESLint dos arquivos de
espaçadores passaram. Lista com "Baixar Excel" e modal como fechamento (Pago e Em revisão)
foram conferidos em capturas headless com dados e API simulados. Não houve teste com login
real nem download real do arquivo.

