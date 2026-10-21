# Instalação de espaçadores: uma instalação = um vão

**Data:** 2026-10-21
**Status:** aprovado em conversa, aguardando revisão do documento
**Substitui em parte:** `2026-09-25-instalacao-espacadores-design.md` (vários vãos por serviço e croqui
feito pelo despachante)

## Por quê

Desde 2026-10-19 cada serviço de espaçador representa **um vão** do transformador, e um trafo
pode ter vários serviços. Hoje o fluxo de instalação ainda faz o contrário: um serviço com até 20
vãos dentro. Além disso, o croqui deixa de ser feito pelo escritório e passa a ser
responsabilidade de quem cuida do **Fechamento**.

O objetivo é que cada "Nova instalação" registre um vão: o trafo, a foto de antes e a de depois,
cada uma com a coordenada digitada à mão, e a quantidade de espaçadores instalados. A instalação
é vinculada sozinha ao serviço de espaçador (o levantamento) daquele trafo que estiver mais
perto, e o Fechamento anexa o croqui na revisão.

## Decisões do usuário

| Tema | Decisão |
|---|---|
| Unidade | Uma instalação = um vão = um serviço de espaçador. |
| Onde procurar o levantamento | Nos **serviços de espaçador** já cadastrados (tabela `servicos`), não na aba Levantamentos. |
| Vários serviços no mesmo trafo | O sistema sugere o mais perto da **coordenada do antes**, e o despachante pode trocar. |
| Nenhum serviço, ou o mais perto longe demais | Cria um serviço novo e vincula a instalação a ele. Se o mais perto estiver longe, o despachante escolhe entre usá-lo e criar um novo. |
| Fotos | **Uma** foto de antes e **uma** de depois, cada uma com a sua coordenada digitada logo abaixo. |
| Quantidade de espaçadores | O despachante informa, e o Fechamento pode corrigir na revisão. |
| Croqui | **Um PDF por vão**, anexado pelo Fechamento na etapa **Revisão**. Só dá para aprovar com o croqui anexado. |
| Instalações antigas | São 3, todas de teste do usuário. Podem ser excluídas. |

## Escolhas minhas (o usuário pode corrigir)

- **Limite de distância: 100 m.** Até 100 m o mais perto já vem selecionado. Acima disso, ou
  quando nenhum candidato tem coordenada válida, aparece o aviso com as duas opções.
- **Serviço novo pede só a Localidade.** O trafo e a coordenada (a do antes) vêm da instalação.
- **Salvar já envia para o fechamento.** O formulário tem todos os dados obrigatórios, então o
  botão final é "Enviar para fechamento". A etapa `instalacao` passa a ser usada só para
  reprovados e para envios que falharam no meio (ver Erros).
- **A coordenada do serviço existente não é sobrescrita.** Ela é a do levantamento. As
  coordenadas da instalação ficam no vão.
- **Os dados do vão ficam na tabela `vaos`**, que já existe, com uma linha por serviço
  (`numero = 1`). Isso reaproveita o envio de arquivos, o tempo real e as permissões.
- **Excluir a instalação devolve o serviço** ao estado anterior em vez de cancelá-lo sempre
  (ver Excluir). Um serviço vinculado por engano é um levantamento real e não pode sumir.
- **Na revisão, o Fechamento vê a distância** entre a coordenada do levantamento e a do antes,
  para conferir se o vínculo faz sentido.

## Fluxo do despachante: modal "Nova instalação"

Campos, nesta ordem:

1. **Número do trafo** e botão **Buscar** (Enter também busca). A busca é a de hoje,
   `buscarServicosPorTrafo`.
2. **Foto do antes**: escolhe um arquivo de imagem e mostra a miniatura. Pode trocar.
   Logo abaixo, o campo **Coordenada do antes**.
3. **Foto do depois** e, logo abaixo, o campo **Coordenada do depois**.
4. **Espaçadores instalados neste vão**: número inteiro maior que zero.
5. Quadro **Serviço vinculado** (ver abaixo).
6. Botão **Enviar para fechamento**. Só fica ativo quando todos os campos são válidos e há um
   vínculo decidido.

As coordenadas aceitam os mesmos formatos do Mapa (`-18.844040 -41.957216`,
`-18.844040, -41.957216`, `-18.844040;-41.957216`). Uma coordenada que não puder ser lida aparece
em vermelho com a mensagem "Coordenada inválida". As duas coordenadas são obrigatórias.

### Como o vínculo é escolhido

Os **candidatos** são os resultados da busca que:

- não têm `etapa_espacador` (ainda não têm instalação); e
- não têm `bloqueioNovaInstalacao` (já têm OS ou foram executados pelo app antigo).

Os resultados que já têm etapa aparecem numa linha informativa ("Já instalados neste trafo:
VD0040, VD0041"), sem poder ser escolhidos. Os bloqueados aparecem com o motivo, como hoje.

Quando a busca já foi feita e a coordenada do antes é válida, cada candidato recebe a distância
até ela (Haversine). Candidatos sem coordenada válida ficam no fim, com "sem coordenada".

- **Mais perto até 100 m:** fica selecionado. O quadro mostra "Serviço vinculado: VD1042 (18 m)"
  e os outros candidatos com a distância, e um link "trocar" abre a lista para escolher outro ou
  "Criar serviço novo".
- **Mais perto acima de 100 m, ou nenhum candidato com coordenada:** aviso amarelo "O serviço
  mais próximo está a 340 m" (ou "Nenhum serviço deste trafo tem coordenada"), com a lista dos
  candidatos e a opção **Criar serviço novo**. Nada vem selecionado.
- **Nenhum candidato:** o quadro já vem em "Criar serviço novo".
- **Criar serviço novo:** mostra o campo **Localidade** (a mesma lista `TODAS_LOCALIDADES`), que
  passa a ser obrigatório.

Se a coordenada do antes mudar depois da busca, as distâncias e a sugestão são recalculadas, mas
uma escolha que o despachante fez à mão é mantida.

### O que acontece ao enviar

Em ordem, com o botão mostrando "Enviando…":

1. Se for serviço novo: `criarServicoEspacador({ equip, local, coord: coordAntes })`.
2. `iniciarInstalacao(servico)`, que já falha se outra pessoa assumiu o serviço no meio-tempo.
   Grava também `status_antes_instalacao` (ver Dados).
3. Cria a linha em `vaos` com `numero = 1`, `coord_antes`, `coord_depois` e `qtd_espacadores`.
4. Envia a foto do antes e a do depois e grava as URLs em `fotos_antes` e `fotos_depois`
   (arrays com um único item).
5. `aplicarTransicao(servico, 'enviar')`.

Ao terminar, o modal fecha e a lista mostra a instalação em "Em revisão".

## Tela da instalação (`InstalacaoModal`)

Mostra um único vão. O cartão de vão deixa de ter "Adicionar vão" e "Remover vão".

- **Cabeçalho:** ID, trafo, localidade, selo da etapa, NSMP e NSMC (como hoje). Acrescenta a
  coordenada do levantamento (`servico.coord`) e a distância até a coordenada do antes.
- **Corpo:** foto do antes com a coordenada embaixo, foto do depois com a coordenada embaixo,
  quantidade de espaçadores e croqui.

### Modo edição (despachante, etapa `instalacao`)

Acontece quando a instalação foi reprovada ou quando um envio falhou no meio.

- Pode trocar cada foto (a nova substitui a antiga no array), editar as duas coordenadas e a
  quantidade. Coordenadas e quantidade são salvas com um botão **Salvar alterações**.
- Não vê nem anexa o croqui.
- **Enviar para fechamento** fica ativo quando o vão tem foto de antes, foto de depois, as duas
  coordenadas válidas e quantidade maior que zero.
- **Excluir instalação** continua no rodapé (ver Excluir).

### Modo revisão (Fechamento, etapa `revisao`)

- Fotos e coordenadas em modo leitura.
- **Quantidade de espaçadores** editável, com um botão **Salvar**. Quando o valor muda, entra
  uma linha no `hist`: "Quantidade de espaçadores corrigida de 3 para 4".
- **Croqui (PDF):** anexar, abrir numa nova aba e trocar.
- **Aprovar** só fica ativo com o croqui anexado. Desativado, ele mostra "Anexe o croqui para
  aprovar". **Reprovar** continua igual, com motivo obrigatório.

### Modo leitura (demais etapas)

Mostra tudo, sem botões de edição, inclusive o croqui.

## Lista de instalações (`FluxoInstalacoes`)

- A coluna **Vãos** ("2/3 completos") vira **Espaçadores**, com a quantidade do vão.
- Nas linhas em `revisao`, um selo "Sem croqui" mostra o que falta para o Fechamento.
- O resto continua igual: filtros por etapa, busca, NSMP e NSMC na própria linha.

## Excluir instalação

Só é possível na etapa `instalacao`, como hoje. A exclusão:

1. Apaga a linha de `vaos` do serviço. Os arquivos ficam no bucket, como já é a regra.
2. Atualiza o serviço com `etapa_espacador = null`, `dt_etapa = null`,
   `motivo_reprovacao_fechamento = null` e `status = status_antes_instalacao`, e acrescenta no
   `hist` a linha "Instalação de espaçadores excluída".

`status_antes_instalacao` é gravado no vínculo:

- serviço já existente: o `status` que ele tinha naquele momento;
- serviço criado pela Nova instalação: `'cancelado'`, para que ele não fique como um levantamento
  em aberto que nunca existiu.

Se `status_antes_instalacao` estiver vazio (instalações antigas), o serviço é cancelado, que é o
comportamento de hoje.

## Dados

### Migração nova `supabase/migrations/instalacao_um_vao.sql` (o usuário roda no SQL Editor)

Só acrescenta coisas, como a anterior:

```sql
ALTER TABLE vaos
  ADD COLUMN IF NOT EXISTS coord_antes     TEXT,
  ADD COLUMN IF NOT EXISTS coord_depois    TEXT,
  ADD COLUMN IF NOT EXISTS qtd_espacadores INT CHECK (qtd_espacadores > 0);

ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS status_antes_instalacao TEXT;
```

E recria a política `espacadores_upload` de `storage.objects` incluindo o perfil `fechamento`,
que agora envia o croqui. Hoje ela só aceita `dono` e `despachante`.

A restrição `UNIQUE (servico_id, numero)` com `numero = 1` já garante um vão por serviço. A
coluna `croqui_url` continua em `vaos`.

### Código puro em `src/lib/espacadores.js` (com testes em `espacadores.test.js`)

- `lerCoordenada(texto)`: devolve `{ lat, lng }` ou `null`, nos formatos do Mapa.
- `distanciaMetros(a, b)`: Haversine em metros.
- `sugerirVinculo(candidatos, coordAntes)`: devolve os candidatos ordenados pela distância
  (os sem coordenada no fim) e a sugestão, que só existe se o mais perto estiver a até
  `LIMITE_VINCULO_M = 100` metros.
- `pendenciasInstalacao(vao)`: o que falta para o despachante enviar (foto de antes, foto de
  depois, coordenada do antes, coordenada do depois, quantidade). Substitui `pendenciasVao`.
- `podeAprovar(vao)`: verdadeiro se há croqui.
- `montarPayloadInicio` passa a receber e gravar `status_antes_instalacao`.
- `montarPayloadExclusao` passa a devolver o serviço ao status anterior, como descrito acima.
- Saem `MAX_VAOS`, `proximoNumeroVao`, `resumoVaos` e `podeEnviarParaFechamento` com vários
  vãos, junto com os testes deles.

### `src/lib/espacadoresApi.js`

- `adicionarVao` e `removerVao` saem. Entram `criarVaoInstalacao(servicoId, dados)` e
  `atualizarVao(vaoId, campos)`.
- `trocarFoto(vao, tipo, file)` substitui `anexarFotos` e `removerFoto`.
- `anexarCroqui` continua igual.

## Limpeza das 3 instalações de teste

Antes de mexer no banco, listar para o usuário os serviços com `etapa_espacador` não nulo e os
vãos de cada um, e **confirmar com ele** quais apagar. Depois:

- apagar as linhas de `vaos` desses serviços;
- serviço criado pela Nova instalação (`desc = 'Instalação de espaçador'` e a linha de cadastro
  no `hist`): `status = 'cancelado'`;
- serviço que já existia: `etapa_espacador`, `dt_etapa`, `motivo_reprovacao_fechamento`, `nsmc`
  e `numServ` (se foi informado no fluxo novo) voltam a nulo e vazio, e o `status` volta a
  `cadastrado`.

Isso é feito com um script SQL que o usuário revisa e roda.

## Erros

- Mesmo padrão de hoje: toda chamada confere `error` e mostra `alert`.
- Se o envio parar entre os passos 2 e 5, o serviço fica em "Em instalação" com o vão
  incompleto. O despachante abre pela lista, completa o que faltou e envia. A mensagem de erro
  diz isso: "A instalação foi salva incompleta em VD1042. Abra-a em Em instalação para terminar."
- Se o serviço sugerido tiver sido assumido por outra pessoa, `iniciarInstalacao` já falha. O
  modal refaz a busca e mostra o erro, sem perder fotos nem campos preenchidos.
- Fotos só aceitam `image/*` e o croqui só aceita `application/pdf`, como hoje.

## Fora do escopo

- O app de celular e as seções do fluxo antigo (Aguardando Aprovação, Aguardando OS,
  Concluídos).
- A aba Levantamentos.
- Mudanças no Painel. Ele já conta um serviço como um vão. Somar a quantidade de espaçadores
  instalados pode vir depois.
- Ler a coordenada de dentro da foto (EXIF). A coordenada é digitada.

## Verificação

1. `npm test` passa, com testes novos para `lerCoordenada`, `distanciaMetros`, `sugerirVinculo`,
   `pendenciasInstalacao`, `podeAprovar`, `montarPayloadInicio` e `montarPayloadExclusao`.
2. `vite build` sem erros.
3. Percorrer no app, rodando localmente:
   - trafo com um serviço a menos de 100 m (vincula sozinho);
   - trafo com dois serviços (sugere o mais perto, e trocar funciona);
   - trafo com serviço a mais de 100 m (aparece o aviso);
   - trafo sem serviço (cria um novo, pedindo a localidade);
   - coordenada inválida (bloqueia o envio);
   - Fechamento corrige a quantidade (entra no `hist`), tenta aprovar sem croqui (bloqueado),
     anexa o croqui, aprova, informa NSMP e NSMC;
   - reprovar, corrigir no modo edição e reenviar;
   - excluir uma instalação vinculada a um serviço existente (o serviço volta ao status
     anterior e reaparece como candidato).
4. Conferir que um usuário `fechamento` consegue enviar o croqui, o que depende da migração.
