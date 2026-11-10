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
- **Coordenada do vão (30/10/2026, Matheus):** formato obrigatório
  **`-18,844040 -41,957216`**, com vírgula nos decimais e espaço entre latitude e longitude.
  Uma 1ª versão exigia "lat, lng" com ponto: foi engano de interpretação, corrigido.
  Vale para digitar (Nova instalação, edição e correção; `validarCoordenadaVao`, motivo
  `virgula`, também barra coordenada fora do Brasil), mostrar, exportar no Excel e **gravar em
  `vaos.coord_antes/coord_depois`** (`coordenadaComVirgula`). Vãos antigos continuam com ponto
  no banco até alguém corrigir; tudo lê pelos dois formatos com `lerCoordenada`. O `servicos.coord`
  de serviço criado pela Nova instalação continua no padrão do sistema (`formatarCoordenada`).
  O cadastro geral de serviços não mudou.
- **"Baixar Excel"** na lista de Instalações gera um `.xlsx` real (lib `xlsx`) da etapa
  na tela, com a busca aplicada. Colunas em `linhasPlanilhaInstalacoes`, incluindo coordenadas
  e links das fotos. A lista de Serviços continua exportando CSV.

## Decisão: lista de Instalações em grade estilo Excel (06/11/2026)

- Pedido de Matheus, com a Conferência do central-neo como referência. Colunas separadas
  (ID e Localidade não ficam mais na mesma célula), uma linha por registro, cabeçalho fixo.
- Cada coluna tem o menu ▾ do Excel: ordenar, pesquisar e marcar valores. Os filtros rodam no
  navegador, porque a tela já carrega tudo. Regras em `src/lib/listaInstalacoes.js`; menu em
  `FiltroColunaInstalacoes.jsx`, num portal para a tabela com overflow não cortar.
- Vazios ficam no fim nos dois sentidos. Clicar de novo na ordem atual volta à ordem padrão
  da etapa (fila do mais antigo; reprovados primeiro). Filtro de coluna oculta é ignorado.
- Pesquisa no menu funciona como no Excel: os resultados vêm todos marcados e OK ou Enter filtra
  só por eles, trocando o filtro anterior da coluna. Pesquisa sem resultado não faz nada.
  A 1ª versão publicada ignorava a pesquisa e limpava o filtro (relato de Matheus, 06/11).
- **"Baixar Excel" agora respeita também os filtros e a ordem das colunas.**
- Clique na linha abre o mesmo destino do botão principal, exceto com texto selecionado
  (para poder copiar célula). Ações fica congelada à direita a partir de 900 px.
- O motivo da reprovação fica em uma linha com reticências; o texto inteiro está no `title`
  e no modal. Os filtros de coluna não vão para a URL nem para o `localStorage`.

## Decisão: etapa SF antes do Pago (06/11/2026)

- Fluxo de Matheus: … Aguardando NSPR → **SF** (`etapa_espacador = 'sf'`) → Pago, que é o fim do
  fluxo. Só muda para Pago ao informar o SalesForce: **data de lançamento**
  (`servicos.data_lancamento_sf`, DATE), **valor da nota** (`servicos.valor_nota`, NUMERIC 12,2)
  e **nº da apropriação**, todos obrigatórios. Ação `salesforce`; formulário em
  `InformarSalesforceModal.jsx`; perfil `fechar`.
- Isto substitui a decisão de 30/10 sobre a apropriação: a ação `apropriacao` e o botão
  "Informar apropriação" no Pago **saíram**. As colunas Apropriação, Lançamento SF e Valor da nota
  aparecem em Pago e Todas.
- **Serviços que já estavam em Pago ficam em Pago**, sem migração. Os dados de SF podem ser
  completados em "Ver detalhes", sem obrigar; o que já foi preenchido não pode ser apagado.
- Valor: `lerValorNota` aceita "1.234,56", "1234,56", "1234.56" e "1.234", e recusa ponto fora do
  lugar ("1.50,00") para não gravar valor errado. O Excel recebe número. A data é `AAAA-MM-DD`:
  mostrar com `formatarDataDia`; `new Date` voltaria um dia pelo fuso.
- **Suposição a confirmar:** o valor é por serviço. Se uma nota cobrir vários serviços e o mesmo
  valor for digitado em cada um, uma soma futura contaria em dobro. Não há soma na tela hoje.
- Script `supabase/migrations/instalacao_etapa_sf.sql`: acrescenta colunas e amplia a CHECK de
  etapas, sem alterar dados. **Precisa rodar no SQL Editor antes de publicar**: sem ele, informar a
  NSPR falha, porque o banco recusa a etapa `sf`. O script sozinho não afeta o site atual.
- O app `visao-de-dono-app` não usa `etapa_espacador`, e o Painel conta por `status`: sem impacto.

## Decisão: poda de árvore na aba Instalações (06/11/2026)

- Pedido de Matheus: botão e formulário viram **"Novo serviço"**, com seleção obrigatória do tipo
  (Espaçador ou Poda de árvore). Na poda só muda a quantidade ("Árvores podadas"); fotos, coordenadas,
  equipe e todas as etapas são as mesmas. A busca pelo trafo vincula a serviço com "poda" na descrição
  ou cria um novo (`desc` "Poda de árvore", `tipo` NSIS; o NSIS foi escolha do Claude, a confirmar).
- O tipo vem de `servicos.desc`: `isPoda`, `tipoServicoDe` e `TIPOS_SERVICO` em `espacadores.js`.
  Se a descrição citar os dois, vale espaçador.
- **Sem migration:** a quantidade de árvores fica em `vaos.qtd_espacadores` e a etapa em
  `etapa_espacador`, sem renomear, como já acontece com `nsmc` = NSPR. Escolha do Claude para não mudar o
  contrato de dados. Uma soma futura de `qtd_espacadores` precisa filtrar pelo tipo.
- Painel: o bloco Espaçadores não conta poda, e não há bloco de poda (escolha de Matheus, por enquanto).
- Poda fica em Serviços diversos, fora de Gerar OS, que só trata espaçador, e fora de Duplicidade (vários
  no mesmo trafo são esperados; escolha do Claude, para não sugerir cancelamento indevido).
- Grade: coluna "Serviço" e coluna "Quantidade" (cabeçalho "Qtd."); o Excel troca "Espaçadores" por
  "Tipo de serviço" e "Quantidade". Espaço lateral das células reduzido para 6 px, para o Valor da nota
  caber em 1440 px com valores comuns. Valores ou localidades maiores usam a rolagem da tabela.

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
**Build é sempre `npm run build`** (pedido de Matheus, 06/11/2026), não `npx vite build`.

30/10/2026 (correção por quem fecha + Excel): 120 testes, build e ESLint dos arquivos de
espaçadores passaram. Lista com "Baixar Excel" e modal como fechamento (Pago e Em revisão)
foram conferidos em capturas headless com dados e API simulados. Não houve teste com login
real nem download real do arquivo.

06/11/2026 (grade estilo Excel): 154 testes, build e ESLint dos arquivos alterados passaram.
App real conferido no Chrome headless com Supabase todo simulado, em 1440 px, 1280 px e 390 px,
como dono e fechamento: filtro, ordem, cabeçalho fixo, menu com 1 linha, clique na linha, número
na linha e Excel baixado de verdade (só as linhas filtradas). Não houve teste com login real,
dados reais nem celular físico. Commit enviado e site publicado em 06/11 a pedido de Matheus.

06/11/2026 (pesquisa no menu da coluna): defeito reproduzido antes da correção. 156 testes, build e
ESLint passaram; pesquisa + OK, pesquisa + Enter e pesquisa sem resultado conferidos no Chrome
headless com Supabase simulado. Commit e publicação a pedido de Matheus.
A publicação falhou no GitHub ("Deployment failed, try again later"), embora o `gh-pages` dissesse
"Published". Depois de publicar, conferir a tarefa em Actions e o arquivo servido no site.

06/11/2026 (etapa SF): 208 testes, `npm run build` e ESLint passaram. Fluxo conferido no Chrome
headless com Supabase simulado e estado em memória, conferindo o que seria gravado: NSPR → SF →
Pago, erros do formulário, data sem desvio de fuso, correção, Excel, despachante sem botão e celular.
Não houve teste com login real, e o SQL não foi rodado por mim. Não publicado até aqui.
(Atualizado em 09/11/2026: ver o registro de publicação no fim deste arquivo.)

06/11/2026 (poda de árvore): 218 testes e `npm run build` passaram. ESLint sem erros novos (segue o
erro antigo de `fetchServicos` em `DuplicidadeTab.jsx`). Formulário, vínculo, criação de serviço, troca
de tipo, grade em Pago e modal conferidos no Chrome headless com Supabase simulado, em 1440 px e 390 px,
incluindo o que seria gravado. Sem login real nem dados reais. Consulta de leitura em 06/11 mostrou
que `servicos.data_lancamento_sf` e `valor_nota` ainda não existem: **o SQL da etapa SF não foi rodado**.
Poda e SF estão nos mesmos arquivos, então publicar a poda leva a SF junto.

06/11/2026 (etapa SF + poda juntas): 218 testes, `npm run build` e ESLint de `espacadores.js`,
`listaInstalacoes.js` e `components/espacadores` passaram. Verificação da grade e fluxo SF repetidos no
Chrome headless com Supabase simulado, tudo OK; em Pago, a 1440 px, Lançamento SF e Valor da nota aparecem
sem rolar. Sem commit nem publicação: falta Matheus rodar o SQL e autorizar a publicação conjunta.


09/11/2026 (publicação de poda + etapa SF): a pedido de Matheus, commit `d51a30d` na `main`, push feito e
`npm run deploy` concluído (218 testes passaram antes). Matheus informou que **rodou o SQL**
`supabase/migrations/instalacao_etapa_sf.sql` no SQL Editor (não conferi por consulta). O `gh-pages` disse
"Published"; o CLI `gh` não está instalado, e a execução de Pages vista pela API pública era do branch
`gh-pages`, sem ligação certa com este deploy. Pendente: conferir em Actions e no site servido, e testar
NSPR → SF → Pago com login real. Continuam a confirmar: NSIS para poda e valor da nota por serviço.

## Decisão: tipo de equipe e hover no "Novo serviço" (09/11/2026)

- Pedido de Matheus: o "Novo serviço" ganha o **tipo de equipe**, obrigatório, para Espaçador e Poda:
  **UMPLA, DUPLA ou MOTO** (grafia de Matheus). Valores gravados em minúsculo em `vaos.tipo_equipe`
  ('umpla', 'dupla', 'moto'). O campo Equipe (nº digitado) continua como estava.
- Registros antigos ficam com `tipo_equipe` NULL e **não são bloqueados**: `pendenciasInstalacao` não
  exige o tipo. Só o Novo serviço exige (`registrarInstalacao` recusa sem tipo válido). No VaoCard e no
  modal o tipo aparece junto da Equipe e é um `<select>` opcional onde a Equipe é editável.
- Lista: coluna "Tipo de equipe" (cabeçalho "Tipo eq.") após Equipe, com filtro/ordem; entra no Excel.
- Script `supabase/migrations/instalacao_tipo_equipe.sql` (só acrescenta coluna e CHECK). Matheus informou
  em 09/11 que **já rodou**. Sem ele, o Novo serviço falha ao gravar o vão.
- Hover dos botões Espaçador/Poda: classes `.ni-tipo` e `.ni-seg` em `CSS_NOVO_SERVICO`
  (`NovaInstalacaoModal.jsx`); elevação, sombra azul e escala só com `hover: hover`, sem movimento com
  `prefers-reduced-motion`. Tipo de equipe usa radiogroup acessível.
- Verificação (09/11): 226 testes, `npm run build` e ESLint dos arquivos tocados passaram. Hover e radiogroup
  foram conferidos só por revisão de código, não no navegador. Sem commit nem publicação até aqui.

## Decisão: etapa SF passa a se chamar "SalesForce" e pagos voltam para ela (09/11/2026)

- Pedido de Matheus: o rótulo da etapa `sf` (`ETAPAS.sf.label` em `src/lib/espacadores.js`) deixa de ser "SF" e
  vira **"SalesForce"**. A chave interna continua `sf`. Os nomes de campo/coluna "Lançamento SF" não mudaram.
- Os serviços em **Pago** devem voltar para a etapa SalesForce: script de uso único
  `supabase/migrations/devolver_pagos_para_salesforce.sql` (muda `etapa_espacador` para 'sf', renova `dt_etapa`,
  acrescenta linha no `hist`; preserva data de lançamento, valor da nota e apropriação). **Rodar no SQL Editor.**
- Verificação (09/11): 226 testes passaram.

## Decisão: ordem das colunas da lista de instalações e Situação enxuta (09/11/2026)

- Pedido de Matheus: na grade, ordem **NSPR, Valor, Tipo eq., Equipe** (depois Desde, Aprop., Lanç. SF).
  Valor continua só em Pago/Todas. A ordem do Excel (`espacadores.js`) não mudou.
- Situação mostra só a etiqueta (ex.: "Reprovado"), sem o motivo embaixo, para diminuir a grade; o motivo fica
  no `title` da etiqueta e no modal da instalação.
- Verificação (09/11): 226 testes e `npm run build` passaram; visual não conferido no navegador.

## Decisão: etapa Apropriação depois do SalesForce (10/11/2026)

- Pedido de Matheus: no SalesForce **não se informa mais o nº da apropriação**; ele vem em outra etapa, depois.
  Fluxo agora: … Aguardando NSPR → **SalesForce** (`sf`: data de lançamento + valor da nota) →
  **Apropriação** (`etapa_espacador = 'apropriacao'`: só o nº da apropriação) → Pago (fim).
  Isto substitui a parte da decisão de 06/11 que exigia a apropriação no formulário do SalesForce.
- Ações em `TRANSICOES` (`espacadores.js`): `salesforce` sf → apropriacao (não grava `apropriacao`, mesmo que
  venha no payload); nova `apropriacao` apropriacao → pago, número obrigatório. Formulário novo:
  `InformarApropriacaoModal.jsx` (perfil `fechar`, botão "Informar apropriação"); `InformarSalesforceModal.jsx`
  perdeu o campo. O modal vem pré-preenchido com `servicos.apropriacao` se já houver (serviços devolvidos ao
  SalesForce pelo script de 09/11 guardaram o valor).
- Grade: Lançamento SF, Valor da nota e Apropriação aparecem em Apropriação, Pago e Todas. `camposCorrigiveis`:
  data e valor corrigíveis em `apropriacao` e `pago`; o campo apropriação só em `pago`.
- Sem coluna nova. Script `supabase/migrations/instalacao_etapa_apropriacao.sql` só amplia a CHECK de etapas.
  **Precisa rodar no SQL Editor antes de publicar**: sem ele, informar o SalesForce falha (banco recusa
  `apropriacao`). Matheus ainda não confirmou que rodou.
- Serviços que já estão em Pago ou em SalesForce não são migrados. Suposição minha, a confirmar: Pago continua
  sendo o fim do fluxo depois da Apropriação, e a cor da etapa (índigo) é escolha minha.
- Verificação (10/11): 227 testes e `npm run build` passaram. UI conferida só por revisão do diff; não houve teste
  no navegador, login real, commit nem publicação.
