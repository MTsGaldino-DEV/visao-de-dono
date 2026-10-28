# Mapa de cobertura e validação de coordenadas — design

Data: 28/10/2026 · Pedido de Matheus · Status: aprovado e implementado em 28/10/2026

## Intenção

O Mapa existe para mostrar **onde o levantamento de serviço já passou**. Hoje ele
só espalha pins num mapa claro, e o pedido é ver a área coberta. A ideia
é ligar os serviços mais nas pontas e pintar o que fica dentro, sobre um fundo
escuro. Quando há serviços longe do resto, o mapa abre outra área em vez de
esticar uma só sobre bairros onde ninguém passou.

No caminho apareceu um problema de dados: há coordenadas gravadas com vírgula
ou ponto e com separadores diferentes. Algumas caem fora do Brasil, no meio do
Atlântico, provavelmente porque a latitude foi digitada sem o sinal de menos.
Hoje três leitores diferentes interpretam esses textos, cada um à sua maneira.
A importação compara a coordenada pelo texto exato, então o mesmo ponto
escrito de outro jeito escapa da checagem de repetidos.

## Objetivos

1. Substituir o Mapa atual pelo mapa de cobertura.
2. Uma única leitura de coordenada para o sistema todo.
3. Barrar coordenada ilegível ou fora do Brasil na entrada (cadastro, edição e
   importação) e sinalizar as que já estão gravadas, na lista e no mapa.

## Não objetivos

- Separar a cobertura por levantador. O campo "Técnico de origem" (`orig`)
  existe, mas Matheus disse que por enquanto não precisa.
- Mudar o app de campo (`visao-de-dono-app`). O que chega de lá, via
  Levantamentos, é só sinalizado no web.
- Corrigir em massa as coordenadas já gravadas. Elas são sinalizadas para
  correção manual.
- Trajeto percorrido. Só interessa a área cercada pelos serviços de ponta.
- A aba "serviços sem espaçador" é o próximo projeto, separado deste.

## Anti-objetivos (falha mesmo que funcione)

- Uma coordenada ruim derrubar a tela ou travar o cadastro de outro jeito que
  não seja a mensagem do campo.
- Uma coordenada errada abrir uma "área" no oceano ou puxar o zoom para o mundo
  inteiro.
- Pins poluindo o mapa. Matheus rejeitou o pin em gota grande.

## Decidido por Matheus

- **Fundo escuro**, com as áreas na identidade do site (azuis), não em vermelho.
- **Área = serviços de ponta ligados e pintados por dentro** (envoltória convexa).
- **Nova área a partir de 1 km.** Dois serviços a até 1 km um do outro, em
  cadeia, ficam na mesma área. O valor vai ser ajustado com o uso.
- **Pin = bolinha na cor do status**, com a mesma paleta de `STATUS_COLORS` do
  Mapa atual. É preciso dar para saber qual serviço é cada pin.
- **Esta tela substitui o Mapa atual**, mantém o nome "Mapa" e passa para o
  grupo **Despacho**.
- **Coordenada fora do Brasil = coordenada incorreta.**
- **Coordenada inválida é barrada no cadastro e sinalizada na lista de Serviços.**

## Como fica

### Leitura única de coordenada — `src/lib/coordenadas.js` (novo)

- `lerCoordenada(texto)`: `{ lat, lng }` ou `null`. Migra a função de
  `src/lib/espacadores.js:47`, que hoje é a mais segura, e acrescenta o caso de 4 pedaços
  separados só por vírgula (`-18,85,-41,95` → `-18.85`, `-41.95`).
  Formatos aceitos:
  `-18.85 -41.95` · `-18.85, -41.95` · `-18.85,-41.95` · `-18,85 -41,95` ·
  `-18,85; -41,95` · `-18,85, -41,95` · `-18,85,-41,95`.
- `validarCoordenada(texto)`: `{ ok: true, lat, lng }` ou
  `{ ok: false, motivo }`. O motivo é `'vazia'`, `'formato'` ou `'fora_brasil'`.
  Fora do Brasil = fora da caixa lat −33,8…5,3 / lng −74,0…−34,7.
- `formatarCoordenada(texto)`: devolve `"lat lng"` com ponto e 6 casas. É o formato
  que o Mapa e os Espaçadores já gravam e leem.
- `distanciaMetros` também vem para cá.
- `espacadores.js` reexporta `lerCoordenada`, `formatarCoordenada` e
  `distanciaMetros` de `coordenadas.js`, para não quebrar quem já importa de lá.
- Testes em `src/lib/coordenadas.test.js` (Vitest, no mesmo padrão dos outros
  `*.test.js`): cada formato acima, os inválidos (texto, 1 ou 3 números, vazio),
  fora do Brasil (`18.85 -41.95`, `0 0`, lat/lng trocadas `-41.95 -18.85`) e
  arredondamento do formato gravado.

### Entrada de coordenada

- **Cadastrar** (`CadastroForm.jsx`) e **editar** (`DetalheModal.jsx`):
  coordenada vazia continua permitida como hoje. Se vier preenchida e inválida,
  o envio não grava. O campo fica em vermelho com uma mensagem curta ("Não deu
  para ler a coordenada" / "Coordenada fora do Brasil — confira o sinal de
  menos"), no mesmo estilo dos campos obrigatórios. O botão continua clicável e
  destaca o que falta, seguindo a decisão já registrada para Espaçadores.
- **Importação de planilha** (`ServicosTable.jsx`, prévia): a linha com coordenada
  inválida aparece marcada na prévia como erro e não é importada.
- **Ao gravar**, a coordenada válida é salva já no formato padrão
  (`formatarCoordenada`). A checagem de repetidos da importação passa a comparar
  a coordenada normalizada, não o texto cru.

### Sinalização do que já está gravado

- **Lista de Serviços:** um selo "Coordenada incorreta" na linha do serviço cuja
  coordenada está preenchida mas não passa em `validarCoordenada`. Vazia não
  ganha selo. "Sem coordenada" é outra situação e já aparece no Mapa como
  contagem.
- **Busca por proximidade da lista de Serviços** (ordenar pela distância de um
  serviço de referência, `calcularDistancia` em `ServicosTable.jsx:1089`, usada em
  `:1272`): passa a usar `lerCoordenada` + `distanciaMetros` comuns, e o
  leitor local é removido. Serviço com coordenada vazia ou incorreta vai para o
  fim da lista. Se a coordenada incorreta for a do serviço de referência,
  aparece um aviso em vez de uma ordenação sem sentido.

### Mapa (`MapaTab.jsx`, reescrito)

- **Navegação:** o item `mapa` sai do grupo "Mapa", que deixa de existir, e entra no
  grupo Despacho, depois de Levantamentos. Os perfis continuam `ESCRITORIO`.
  A chave continua `mapa`, então a tela salva em `vd_tela` segue funcionando.
  Ajustar `navegacao.test.js`.
- **Dados:** os mesmos de hoje. Busca com `fetchAll`, sem cancelados, e atualiza
  via Realtime no canal `servicos_mapa`. Só entram serviços com
  `validarCoordenada(...).ok`.
- **Fundo:** tiles do OpenStreetMap escurecidos por CSS (`.mapa-escuro`: invert +
  hue-rotate), com atribuição OSM. *Mudou em 28/10 após publicar:* a CARTO Dark
  Matter passou a devolver "API KEY REQUIRED" vindo do GitHub Pages. Não voltar
  para a CARTO sem chave.
- **Áreas:** agrupamento por ligação simples com régua D (padrão 1000 m) e
  envoltória convexa de cada grupo, pintada (preenchimento ~0,28, borda 2,5 px)
  em tons de azul que se alternam entre as áreas. Um serviço sozinho vira um círculo
  de ~60 m, e dois serviços viram uma faixa larga entre eles. O tooltip mostra
  "Área N: X serviços · Y km²".
- **Pins:** bolinha de 10 px na cor do status, com borda branca translúcida. A de
  ponta tem 16 px, borda branca sólida e um halo leve. Ao passar o mouse aparece
  "VD0123 · Tipo". Ao clicar abre o popup com id, status, selo "Ponta", tipo,
  local, técnico de origem e "Ver detalhes →", que abre o `DetalheModal` existente.
- **Controles:** régua de distância (200 m–2 km, passo 50, começa em 1 km),
  "Mostrar serviços" e "Só os de ponta". A legenda de status com filtro, que
  já existe hoje, é mantida.
- **Painel lateral:** número de áreas, km² cobertos, serviços no mapa, "sem
  coordenada" e "coordenada incorreta". Os incorretos ficam numa lista de ids
  clicáveis que abrem o `DetalheModal` para correção. Abaixo vem a lista de áreas,
  e clicar numa área leva o mapa até ela.
- **Enquadramento inicial:** usa só os serviços válidos, então um ponto ruim não
  afasta o zoom.
- As contas de agrupar, contornar e medir área ficam em `src/lib/cobertura.js`
  (funções puras), com `cobertura.test.js`.

Modelo aprovado na conversa:
`.superpowers/brainstorm/124-1793191869/content/mapa-cobertura-v3.html`
(estilo "C · bolinha").

## Restrições

- Não mudar o esquema do banco. `coord` continua texto.
- O app lê a mesma tabela `servicos`. O formato gravado (`"lat lng"`, ponto) já é
  o usado por Espaçadores, então não muda o contrato.
- O agrupamento é O(n²). Com ~1.700 serviços dá ~1,4 milhão de distâncias por
  mudança na régua, o que é aceitável. Se ficar lento, aplicar debounce na régua
  antes de pensar em índice espacial.

## Escolhas minhas (Claude), para conferir

- Caixa retangular para "Brasil" em vez do contorno real do país. É simples e
  pega o caso do oceano no hemisfério norte, mas aceita pontos em países
  vizinhos dentro da caixa.
- Gravar a coordenada já normalizada nas entradas novas e editadas. As antigas
  ficam como estão até alguém editar.
- Coordenada vazia continua permitida no cadastro, como hoje.
- Os tons das áreas e o tamanho do círculo/faixa para grupos de 1–2 serviços.
- A régua fica visível para todos que veem o Mapa.

## Deixado para quem constrói

- Layout fino do painel no celular (empilhar abaixo do mapa).
- Texto exato das mensagens de erro, dentro do tom acima.
- Debounce da régua, se for preciso.
- Conferir `GerarServicosTab.jsx`, que só repassa `coord`, e os componentes de
  Espaçadores. Eles devem continuar funcionando com a reexportação.
