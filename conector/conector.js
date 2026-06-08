/**
 * conector.js — Visão de Dono × Sistema CEMIG (GDIS)
 * Executa: node conector.js
 * Requer:  npm install playwright express cors
 *          npx playwright install msedge
 */

const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
const PORT = 3333;

// ── Configurações fixas ───────────────────────────────────────────────────────
const CONFIG = {
  cnpj: '00.000.000/0000-00',           // ← substitua pelo CNPJ real
  inscEstadual: '0000000000000',          // ← substitua pela Inscrição Estadual real
  bairroPadrao: 'VD-ESPAÇADOR',
  tipoServico: 'NSIS',                    // value do <option> no ns.jsp
  tipoTurma: 'D',                         // D = DUPLA (fixo conforme solicitado)
  observacao: 'DUVIDAS LIGAR PARA MATHEUS NEC 31 99914-8716',
  baseUrl: 'http://192.168.1.110',
  loginUrl: 'http://192.168.1.110/contratadaweb/login.jsp',
  nsUrl: 'http://192.168.1.110/contratadaweb/servicos/despachante/ns.jsp',
  malha: 'DL',
};

app.use(cors());
app.use(express.json());

// Estado global da sessão
let browser = null;
let page = null;
let sessaoOk = false;
let jobAtual = null; // lista de serviços em andamento

// ── SSE: stream de status em tempo real ──────────────────────────────────────
let sseClients = [];

function broadcast(evento) {
  const data = `data: ${JSON.stringify(evento)}\n\n`;
  sseClients.forEach(res => res.write(data));
}

function debug(msg, id = null) {
  broadcast({ tipo: 'debug', msg, id });
  console.log(`[DEBUG] ${msg}`);
}

app.get('/status-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.push(res);
  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/ping', (req, res) => {
  res.json({ ok: true, sessaoOk });
});

// ── 1. Iniciar sessão: abre o Edge e navega até o login ───────────────────────
app.post('/iniciar-sessao', async (req, res) => {
  try {
    if (browser) await browser.close().catch(() => { });

    browser = await chromium.launch({
      channel: 'msedge',
      headless: false,
      args: ['--start-maximized', '--disable-popup-blocking'],
    });

    const context = await browser.newContext();
    
    // POLYFILL para IE: Permite que document.getElementById encontre elementos pelo atributo 'name'
    // Sistemas legados usam $('nome_do_campo') esperando que funcione sem atributo id (comportamento do IE).
    await context.addInitScript(() => {
      const originalGetElementById = document.getElementById;
      document.getElementById = function(id) {
        let el = originalGetElementById.call(document, id);
        if (!el) {
          const elements = document.getElementsByName(id);
          if (elements && elements.length > 0) {
            el = elements[0];
          }
        }
        return el;
      };
    });

    page = await context.newPage();
    await page.goto(CONFIG.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Preenche CNPJ e Inscrição Estadual automaticamente
    await preencherCampoSeExistir(page, '[name="cnpj"], #cnpj, input[placeholder*="CNPJ"]', CONFIG.cnpj);
    await preencherCampoSeExistir(page, '[name="inscEstadual"], #inscEstadual, input[placeholder*="nscri"]', CONFIG.inscEstadual);

    sessaoOk = false;
    broadcast({ tipo: 'aguardando_captcha', msg: 'Preencha sua senha e resolva o reCAPTCHA, depois clique em Continuar no app.' });

    res.json({ ok: true, msg: 'Navegador aberto. Aguarde o usuário resolver o reCAPTCHA.' });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ── 2. Continuar após reCAPTCHA ───────────────────────────────────────────────
app.post('/continuar-apos-captcha', async (req, res) => {
  try {
    // Verifica se já está logado tentando acessar ns.jsp
    await page.goto(CONFIG.nsUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const url = page.url();

    if (url.includes('login') || url.includes('Login')) {
      return res.status(400).json({ ok: false, erro: 'Ainda na tela de login. Verifique se o reCAPTCHA foi resolvido e tente novamente.' });
    }

    sessaoOk = true;
    broadcast({ tipo: 'sessao_ok', msg: 'Sessão iniciada. Pronto para gerar serviços.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ── 3. Gerar serviços ─────────────────────────────────────────────────────────
app.post('/gerar-servicos', async (req, res) => {
  if (!sessaoOk) return res.status(400).json({ ok: false, erro: 'Sessão não iniciada.' });

  const { servicos } = req.body;
  // servicos: [{ _docId, id, desc, transformador, executor }]

  if (!servicos || servicos.length === 0) {
    return res.status(400).json({ ok: false, erro: 'Nenhum serviço enviado.' });
  }

  jobAtual = servicos;
  res.json({ ok: true, msg: `Iniciando geração de ${servicos.length} serviços.` });

  // Executa em background
  executarLote(servicos);
});

// ── 4. Cancelar job atual ─────────────────────────────────────────────────────
app.post('/cancelar', (req, res) => {
  jobAtual = null;
  broadcast({ tipo: 'cancelado', msg: 'Geração cancelada pelo usuário.' });
  res.json({ ok: true });
});

// ── Lógica principal de geração ───────────────────────────────────────────────
async function executarLote(servicos) {
  broadcast({ tipo: 'inicio_lote', total: servicos.length });

  for (let i = 0; i < servicos.length; i++) {
    if (!jobAtual) break; // cancelado

    const s = servicos[i];
    broadcast({ tipo: 'iniciando', index: i, id: s.id, msg: `Gerando ${s.id}...` });

    try {
      const resultado = await gerarUmServico(s);
      broadcast({ tipo: 'sucesso', index: i, id: s.id, docId: s._docId, numGerado: resultado.numGerado, msg: resultado.msg });
    } catch (err) {
      broadcast({ tipo: 'erro', index: i, id: s.id, docId: s._docId, msg: err.message });
    }

    // Pequena pausa entre serviços
    await sleep(1500);
  }

  broadcast({ tipo: 'fim_lote', msg: 'Lote finalizado.' });
  jobAtual = null;
}

async function gerarUmServico(s) {
  debug(`Navegando para ns.jsp...`, s.id);
  // Navega para o formulário de novo serviço
  await page.goto(CONFIG.nsUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(800);

  // ── Passo 1: Abrir popup de busca do Transformador ──
  debug(`Iniciando abertura do popup de transformadores...`, s.id);

  let popup;
  try {
    // 1. Tenta clicar pelo método padrão do Playwright
    const btnBuscarTrafo = await page.$('input[name="btnTrafo"]');
    if (btnBuscarTrafo) {
      await btnBuscarTrafo.scrollIntoViewIfNeeded().catch(() => {});
      await btnBuscarTrafo.focus().catch(() => {});
      const [p] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 15000 }),
        btnBuscarTrafo.click(),
      ]);
      popup = p;
    } else {
      throw new Error('Botão btnTrafo físico não localizado.');
    }
  } catch (err) {
    debug(`Clique físico falhou ou timeout excedido (${err.message}). Tentando executar a função buscaTrafo() diretamente via JS...`, s.id);
    try {
      // 2. Fallback definitivo: executa a função global buscaTrafo() do site da CEMIG
      const [p] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 20000 }),
        page.evaluate(() => {
          if (typeof window.buscaTrafo === 'function') {
            window.buscaTrafo();
          } else {
            const btn = document.querySelector('input[name="btnTrafo"]');
            if (btn) btn.click();
          }
        })
      ]);
      popup = p;
    } catch (err2) {
      throw new Error(`Não foi possível abrir o popup do transformador de nenhuma forma: ${err2.message}`);
    }
  }

  debug(`Popup de transformadores aberto com sucesso.`, s.id);
  await popup.waitForLoadState('domcontentloaded');
  await sleep(800);

  // Preenche o número do transformador no popup e clica Buscar
  const inputTrafoPopup = await popup.$('#Numero, input[name="Numero"]');
  if (inputTrafoPopup) {
    debug(`Preenchendo transformador no popup: ${s.transformador}`, s.id);
    await inputTrafoPopup.fill('');
    await inputTrafoPopup.type(String(s.transformador), { delay: 30 });
  } else {
    throw new Error('Campo do número do transformador (#Numero) não encontrado no popup.');
  }

  // ── NOVO: Seleciona a malha ──
  debug(`Selecionando a Malha ${CONFIG.malha || 'DL'} no popup...`, s.id);
  const selectMalha = await popup.$('#Superin, select[name="Superin"]');
  if (selectMalha) {
    await selectMalha.selectOption({ value: CONFIG.malha || 'DL' });
    await sleep(300);
  } else {
    debug('AVISO: Campo de Malha (Superin) não encontrado no popup.', s.id);
  }

  const btnBuscarPopup = await popup.$('#BotaoConsultar, input[name="BotaoConsultar"]');
  if (!btnBuscarPopup) throw new Error('Botão Buscar (#BotaoConsultar) não encontrado no popup.');
  
  debug(`Clicando em Buscar no popup...`, s.id);
  await btnBuscarPopup.click();
  await popup.waitForLoadState('domcontentloaded');
  await sleep(800);

  // Lê os resultados — procura linhas com Região = GV
  const linhas = await popup.$$('#resultadoConsultaTrafo table tr:not(:first-child)');
  debug(`Popup retornou ${linhas.length} linha(s) de resultados.`, s.id);
  const gvLinhas = [];

  for (const linha of linhas) {
    const colunas = await linha.$$('td');
    if (colunas.length === 0) continue;
    const regiao = await colunas[colunas.length - 1].innerText();
    if (regiao.trim().toUpperCase() === 'GV') {
      gvLinhas.push(linha);
    }
  }

  debug(`Encontrado(s) ${gvLinhas.length} resultado(s) com Região = GV.`, s.id);

  if (gvLinhas.length === 0) {
    await popup.close();
    throw new Error(`Nenhum transformador com região GV encontrado para "${s.transformador}".`);
  }

  if (gvLinhas.length > 1) {
    debug(`AVISO: Múltiplos resultados GV encontrados. O sistema da CEMIG retornou ${gvLinhas.length} entradas. Selecionando a primeira automaticamente.`, s.id);
  }

  // Clica no radio button da primeira linha GV encontrada
  debug(`Selecionando o radio button da linha...`, s.id);
  const radio = await gvLinhas[0].$('input[type="radio"]');
  if (!radio) throw new Error('Radio button não encontrado na linha do transformador.');
  await radio.click();
  await sleep(500);

  // Aguarda o popup fechar e os campos serem preenchidos na página principal
  debug(`Aguardando popup fechar...`, s.id);
  await popup.waitForEvent('close', { timeout: 8000 }).catch(() => { });
  await sleep(1000);

  // ── Passo 2: Corrigir o campo Bairro ──
  debug(`Preenchendo Bairro: ${CONFIG.bairroPadrao}`, s.id);
  await preencherCampoSeExistir(page, 'input[name="bairro"]', CONFIG.bairroPadrao);

  // ── Passo 3: Tipo de Serviço ──
  debug(`Selecionando Tipo de Serviço: ${CONFIG.tipoServico}`, s.id);
  const selectTipo = await page.$('select[name="tiposerv"], #tiposerv');
  if (selectTipo) {
    await selectTipo.selectOption({ value: CONFIG.tipoServico });
    await sleep(400);
  } else {
    debug(`AVISO: select tiposerv não encontrado!`, s.id);
  }

  // ── Passo 4: Serviço a ser Executado (Desc_Serv) ──
  debug(`Preenchendo Desc_Serv...`, s.id);
  await preencherCampoSeExistir(page, 'textarea[name="Desc_Serv"], #Desc_Serv', s.desc);

  // ── Passo 5: Observação (Observ) ──
  debug(`Preenchendo Observação...`, s.id);
  await preencherCampoSeExistir(page, 'textarea[name="Observ"]', CONFIG.observacao);

  // ── Passo 6: Executor (Projeta) ──
  const valorExecutor = s.executor === 'COD' ? 'E' : 'R';
  debug(`Selecionando Executor: ${s.executor} → value="${valorExecutor}"`, s.id);
  const selectExecutor = await page.$('select[name="Projeta"], #Projeta');
  if (selectExecutor) {
    await selectExecutor.selectOption({ value: valorExecutor });
    await sleep(300);
  } else {
    debug(`AVISO: select Projeta não encontrado!`, s.id);
  }

  // ── Passo 7: Tipo de Turma (TipoTurma) — sempre DUPLA ──
  debug(`Selecionando Tipo de Turma: DUPLA (${CONFIG.tipoTurma})`, s.id);
  const selectTurma = await page.$('select[name="TipoTurma"]');
  if (selectTurma) {
    await selectTurma.selectOption({ value: CONFIG.tipoTurma });
    await sleep(300);
  } else {
    debug(`AVISO: select TipoTurma não encontrado!`, s.id);
  }

  // ── Passo 8: Clicar Cadastrar ──
  debug(`Clicando em Cadastrar...`, s.id);
  const btnCadastrar = await page.$('input[name="inserir"], input[value="Cadastrar"]');
  if (!btnCadastrar) throw new Error('Botão Cadastrar não encontrado.');
  await btnCadastrar.click();
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await sleep(800);

  // Tenta capturar o número do serviço gerado na página de confirmação
  debug(`Lendo número do serviço gerado na página de confirmação...`, s.id);
  const corpo = await page.innerText('body').catch(() => '');
  const match = corpo.match(/n[úu]mero[:\s]*(\d{6,12})/i) || corpo.match(/(\d{9,12})/);
  const numGerado = match ? match[1] : null;
  debug(numGerado ? `Número capturado: ${numGerado}` : `AVISO: número não encontrado no corpo da página.`, s.id);

  return { msg: 'Criado com sucesso.', numGerado };
}

// ── Utilitários ───────────────────────────────────────────────────────────────
async function preencherCampoSeExistir(pg, seletor, valor) {
  try {
    const el = await pg.$(seletor);
    if (el) {
      await el.fill('');
      await el.type(String(valor), { delay: 30 });
    }
  } catch (_) { }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Inicia o servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Conector Visão de Dono × CEMIG (GDIS)      ║');
  console.log(`║   Rodando em http://localhost:${PORT}        ║`);
  console.log('║                                              ║');
  console.log('║   Deixe esta janela aberta enquanto usa.     ║');
  console.log('║   Para parar: Ctrl + C                       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});