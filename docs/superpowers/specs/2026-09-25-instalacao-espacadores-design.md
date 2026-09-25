# Instalação de Espaçadores por Vão + Fechamento (NSMP/NSMC)

**Data:** 2026-09-25
**Status:** aprovado em conversa, aguardando revisão do documento

## Objetivo

Hoje a instalação de espaçadores depende do app de celular, que não funciona bem, e guarda
fotos soltas no serviço, sem noção de vão. O objetivo é que o **despachante** registre a
instalação direto no Visão de Dono, organizada por **vão** (foto de antes, foto de depois e
croqui em PDF de cada vão), e que um novo perfil **Fechamento** revise, informe a **NSMP**
(pedido de pagamento à Cemig) e depois a **NSMC** (confirmação de pagamento).

## Processo real (contexto)

1. O técnico de campo levanta onde é preciso instalar espaçadores e manda pelo WhatsApp o
   local e uma foto com coordenada e horário.
2. O escritório cadastra o levantamento no Visão de Dono. **É um serviço por transformador.**
   A aba Duplicidade existe para cancelar os serviços que foram criados um por vão.
3. A equipe instala e manda fotos de antes e depois, e o croqui da rede, pelo WhatsApp.
4. O despachante anexa tudo por vão, **de 1 a 20 vãos** por transformador.
5. O fechamento revisa, gera a NSMP e depois recebe a NSMC.

## Decisões

| Tema | Decisão |
|---|---|
| Vínculo com serviços existentes | A instalação é anexada ao serviço de espaçador existente do trafo. Se não houver nenhum, um serviço novo é cadastrado. |
| Vãos | De 1 a 20 por serviço, adicionados manualmente. |
| Anexos por vão | Várias fotos de antes, várias fotos de depois e **um** PDF de croqui. |
| NSMP | É o mesmo número que hoje entra em "Gerar OS", e fica no campo `numServ`. |
| NSMC | É um campo novo, informado depois da NSMP. |
| Quem faz o quê | O Despachante faz tudo até o croqui. O Fechamento revisa, informa a NSMP e informa a NSMC. |
| Perfil novo | `fechamento`. Enxerga só a aba Fechamento. O Dono vê tudo. |
| Fluxo antigo do app | Continua funcionando. Serviços sem `etapa_espacador` seguem nas seções atuais sem nenhuma mudança. |
| Armazenamento dos vãos | Tabela nova `vaos`, uma linha por vão. |

## Etapas (`servicos.etapa_espacador`)

| Valor | Rótulo | Quem age | Transição |
|---|---|---|---|
| `instalacao` | Em instalação | Despachante | "Enviar para fechamento" leva a `revisao`. |
| `revisao` | Em revisão | Fechamento | Aprovar leva a `aguardando_nsmp`. Reprovar (com motivo) volta para `instalacao`. |
| `aguardando_nsmp` | Aguardando NSMP | Fechamento | Informar a NSMP grava `numServ` e leva a `aguardando_nsmc`. |
| `aguardando_nsmc` | Aguardando NSMC | Fechamento | Informar a NSMC grava `nsmc` e leva a `pago`. |
| `pago` | Pago | — | Fim. |

Regras:

- Toda transição atualiza `dt_etapa` e acrescenta uma entrada em `hist` (`who`, `matricula`,
  `when`, `msg`), no mesmo formato de hoje.
- Reprovar grava `motivo_reprovacao_fechamento`. Reenviar para revisão limpa esse campo.
- Ao passar para `revisao` pela primeira vez, o `status` do serviço vira `concluido`, porque a
  instalação em campo já foi feita. Isso mantém o Painel e o Mapa coerentes.
- O serviço entra no fluxo novo quando recebe `etapa_espacador = 'instalacao'`, seja ao ser
  escolhido em "Nova instalação" ou ao ser criado por ela.

## Telas

### Despacho → Espaçadores → seção nova "Instalações" (Despachante e Dono)

- Botão **"+ Nova instalação"**.
- Lista dos serviços com etapa `instalacao`, mostrando ID, trafo, localidade, quantidade de
  vãos, quantos vãos já estão completos e a data da etapa. Os reprovados aparecem com um selo
  "Reprovado" e o motivo.
- A seção Lista de Serviços, que é a lista geral, continua mostrando todos os serviços.
- As seções do fluxo do app (Aguardando Aprovação, Aguardando OS e Concluídos) continuam iguais
  e passam a **ignorar** explicitamente os serviços que têm `etapa_espacador`.

### Modal "Nova instalação"

1. Campo **Trafo**. Busca serviços de espaçador (tipo NSIS com "espaçador" na descrição, pela
   mesma regra de `ServicosTable`), com `status` diferente de `cancelado`, cujo `equip` contém o
   texto digitado, sem diferenciar maiúsculas e minúsculas e sem espaços nas pontas.
   - **1 resultado:** mostra o serviço e o botão "Usar este serviço".
   - **Vários resultados:** mostra a lista para escolher, com o aviso "Há mais de um serviço
     para este trafo — considere resolver na aba Duplicidade".
   - **Serviço que já tem etapa:** em vez de reiniciar, abre a instalação existente.
   - **Nenhum resultado:** abre um formulário curto com Trafo (pré-preenchido), Localidade e
     Coordenada, e o botão "Cadastrar e continuar". O serviço é criado com o ID sequencial `VD`
     (mesma lógica de `CadastroForm`), `tipo = 'NSIS'`, `desc = 'Instalação de espaçador'`,
     `status = 'cadastrado'`, `dtCadastro`, `autor` e `matriculaAutor` do usuário.
2. Em seguida abre a tela da instalação.

### Tela da instalação (modal grande)

- **Cabeçalho:** ID, trafo, localidade e o selo da etapa. Se houver motivo de reprovação, ele
  aparece num aviso vermelho no topo.
- **Um cartão por vão ("Vão N")**, com três áreas:
  - **Fotos antes:** miniaturas que ampliam ao clicar, botão para adicionar (aceita vários
    arquivos de uma vez) e um "×" em cada foto para remover.
  - **Fotos depois:** igual à área de fotos antes.
  - **Croqui (PDF):** botão para anexar, link para abrir numa nova aba e opção de trocar.
  - Um indicador mostra se o vão está completo (✓) ou pendente, dizendo o que falta.
  - Um botão remove o vão, pedindo confirmação.
- **"+ Adicionar Vão":** cria o próximo número (`max(numero) + 1`). Fica desativado quando a
  instalação chega a 20 vãos.
- **"Enviar para fechamento":** só fica ativo se houver pelo menos 1 vão e todos os vãos
  tiverem ao menos 1 foto de antes, 1 foto de depois e o croqui.
- A tela é **somente leitura** em qualquer etapa diferente de `instalacao`: não aparecem os
  botões de adicionar, remover ou enviar.

### Aba nova "Fechamento" (Fechamento e Dono)

A aba tem quatro seções com contador: **Revisão**, **Aguardando NSMP**, **Aguardando NSMC** e
**Pagos**. Todas têm busca por ID, trafo ou localidade.

- **Revisão:** "Revisar" abre a tela da instalação em modo leitura, com o rodapé **Aprovar** /
  **Reprovar**. Reprovar exige um motivo.
- **Aguardando NSMP:** a própria linha tem um campo para o número e um botão "Salvar" (Enter
  salva, Esc cancela), igual ao "Gerar OS" de hoje. Também tem o botão "Ver detalhes".
- **Aguardando NSMC:** mesmo formato da seção anterior, e a linha mostra a NSMP.
- **Pagos:** lista com a NSMP, a NSMC e a data. Tem o botão "Ver detalhes".

### Navegação (`home.jsx`)

- `fechamento`: vê só a aba **Fechamento**, que é a aba padrão desse perfil.
- `dono`: vê tudo o que já via, mais a aba **Fechamento**.
- `despachante`: continua como hoje, e a seção Instalações aparece dentro de Espaçadores.

### Usuários

- A tela Usuários ganha a opção "Fechamento" no cadastro, no filtro e na troca de perfil, e
  um selo com cor própria.
- A função `gerenciar-usuarios` repassa o perfil sem validar, então não precisa mudar.

## Dados

### Tabela nova `vaos`

```sql
CREATE TABLE vaos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id   TEXT NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  numero       INT  NOT NULL CHECK (numero BETWEEN 1 AND 20),
  fotos_antes  TEXT[] NOT NULL DEFAULT '{}',
  fotos_depois TEXT[] NOT NULL DEFAULT '{}',
  croqui_url   TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (servico_id, numero)
);
```

Os números podem ficar com buracos depois que um vão é removido (1, 2, 4). Isso é aceitável:
o vão continua identificado pelo número que tinha em campo.

### Colunas novas em `servicos`

`etapa_espacador TEXT`, `motivo_reprovacao_fechamento TEXT`, `nsmc TEXT` e `dt_etapa TIMESTAMPTZ`.

### Arquivos

Ficam no bucket `levantamentos`, que é público e já é usado pelas fotos manuais:

- `espacadores/{servicoId}/vao-{numero}/antes-{timestamp}.{ext}`
- `espacadores/{servicoId}/vao-{numero}/depois-{timestamp}.{ext}`
- `espacadores/{servicoId}/vao-{numero}/croqui-{timestamp}.pdf`

Remover uma foto ou trocar o croqui tira a URL do banco. O arquivo antigo fica no bucket, para
não correr o risco de apagar algo que ainda esteja referenciado em outro lugar.

### Tempo real

`ALTER PUBLICATION supabase_realtime ADD TABLE vaos;` A tela da instalação e as listas escutam
as mudanças em `servicos` e `vaos`.

## Permissões — `supabase/migrations/add_instalacao_espacadores.sql`

A migração só **acrescenta** coisas, sem alterar as políticas existentes, porque o banco em
produção pode ter diferenças em relação aos arquivos do repositório:

1. Acrescenta as colunas em `servicos`.
2. Cria a tabela `vaos` com RLS ligado:
   - Política para `dono`, `despachante` e `fechamento`: `FOR ALL`.
3. Acrescenta em `servicos` uma política nova, `fechamento_servicos`, `FOR ALL` para o perfil
   `fechamento`.
4. Troca a CHECK de `usuarios.role` para incluir `fechamento`. O nome da constraint é
   descoberto em tempo de execução, num bloco `DO`.
5. Acrescenta `vaos` ao tempo real.

**O usuário roda esse script manualmente no SQL Editor do Supabase.**

## Tratamento de erros

- Toda chamada ao Supabase verifica `error` e mostra `alert` com a mensagem, no mesmo padrão do
  resto do app. Não é feita atualização otimista de etapa.
- Uploads mostram um indicador de "Enviando…" no vão e bloqueiam um novo envio no mesmo campo
  até terminar.
- Se o upload do arquivo falhar, o banco não é alterado. Se o upload der certo mas a gravação no
  banco falhar, o erro é mostrado e o arquivo fica órfão no bucket (aceitável).
- O croqui só aceita `application/pdf`. As fotos só aceitam `image/*`.
- Adicionar um vão em duas abas ao mesmo tempo esbarra na restrição `UNIQUE`. Nesse caso o app
  recarrega os vãos e tenta de novo com o próximo número.

## Organização do código

- `src/lib/espacadores.js`: constantes das etapas e rótulos, `isEspacador`, a regra de "vão
  completo" e as funções de acesso ao Supabase (buscar e criar serviço, carregar e criar vãos,
  enviar arquivos e mudar de etapa, sempre gravando o `hist`).
- `src/components/espacadores/NovaInstalacaoModal.jsx`: busca do trafo e cadastro.
- `src/components/espacadores/InstalacaoModal.jsx`: tela da instalação (edição e leitura).
- `src/components/espacadores/VaoCard.jsx`: cartão de um vão.
- `src/components/espacadores/InstalacoesSection.jsx`: seção dentro de Espaçadores.
- `src/components/FechamentoTab.jsx`: aba Fechamento.
- Mudanças pequenas em `EspacadoresTab.jsx` (seção nova e filtro), `home.jsx` (aba e perfil) e
  `UsuariosTab.jsx` (perfil novo).

O estilo segue o do app: estilos inline, a mesma paleta (`#0f2544`, `#e2e8f0`, …) e `alert` e
`confirm` nativos.

## Fora do escopo

- O app de celular.
- A migração dos serviços antigos para vãos.
- Mudanças no Painel e no Faturamento.
- Notificações.

## Verificação

O projeto não tem testes automáticos. A verificação consiste em:

1. `vite build` sem erros.
2. Rodar o app localmente e percorrer o fluxo completo: nova instalação num trafo existente e
   num trafo inexistente; adicionar 3 vãos; enviar fotos e croqui; tentar enviar com um vão
   incompleto (o botão deve estar bloqueado); enviar; reprovar; ver o motivo; corrigir e
   reenviar; aprovar; informar NSMP; informar NSMC; ver em Pagos.
3. Conferir no banco `etapa_espacador`, `numServ`, `nsmc`, `hist` e as linhas de `vaos`.
4. Conferir que as seções do fluxo do app (Aguardando Aprovação, Aguardando OS e Concluídos)
   não mostram os serviços do fluxo novo e continuam mostrando os do app.
5. Conferir que um usuário `fechamento` vê só a aba Fechamento.
