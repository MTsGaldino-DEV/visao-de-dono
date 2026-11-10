/**
 * extrair-medicoes.js — lê a lista de serviços em ../medicoes.md, consulta cada
 * um no GDIS (servico_detalhe.jsp) e gera uma planilha .xlsx com os campos:
 *   Nº Serviço, Número Eqpto Medição, Observação, Local, Veículo, Mat. Executor.
 *
 * Uso:   cd conector && node extrair-medicoes.js
 * Refazer só os erros de uma planilha anterior:
 *   $env:RETOMAR="../import/medicoes_XXXX.xlsx"; node extrair-medicoes.js
 * Opções (variáveis de ambiente):
 *   GDIS_BASE=http://192.168.122.110   (padrão)
 *   LISTA=../medicoes.md               (padrão)
 *
 * Fluxo: abre o Edge na tela de login → você loga (senha + reCAPTCHA) →
 * aperta ENTER no terminal → o script consulta tudo e salva a planilha.
 * Nada de senha/CNPJ é gravado no script.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');
const XLSX = require('xlsx');

const BASE = process.env.GDIS_BASE || 'http://192.168.122.110';
const LISTA = path.resolve(__dirname, process.env.LISTA || '../medicoes.md');
const LOGIN_URL = `${BASE}/contratadaweb/login.jsp`;
const detalheUrl = (n) => `${BASE}/contratadaweb/consultas/historico/servico_detalhe.jsp?NumServ=${n}`;
const PASTA_SAIDA = path.resolve(__dirname, '../import');
const SALVAR_A_CADA = 25;

// Rótulo exibido na página (sem acento/pontuação) → nome da coluna na planilha
const CAMPOS = [
  ['numero eqpto medicao', 'Número Eqpto Medição'],
  ['observacao', 'Observação'],
  ['local', 'Local'],
  ['veiculo', 'Veículo'],
  ['mat. executor', 'Mat. Executor'],
];

/**
 * Roda dentro da página: acha cada <th> cujo texto (normalizado, sem ":")
 * bate com o rótulo e devolve o texto do <td> logo ao lado.
 * Também devolve `numServ` (campo "Nº Serviço") para detectar página sem dados.
 */
function extrairNaPagina(rotulos) {
  const norm = (s) =>
    s.replace(/ /g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/:\s*$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const out = { campos: {}, numServ: null };
  for (const th of document.querySelectorAll('th')) {
    const chave = norm(th.textContent);
    let td = th.nextElementSibling;
    while (td && td.tagName !== 'TD') td = td.nextElementSibling;
    const valor = td ? td.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim() : '';
    if (/^n.{0,2} servico$/.test(chave) && out.numServ === null) out.numServ = valor;
    if (rotulos.includes(chave) && !(chave in out.campos)) out.campos[chave] = valor;
  }
  return out;
}

function lerLista() {
  const brutas = fs.readFileSync(LISTA, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const vistos = new Set();
  const lista = [];
  let duplicados = 0;
  for (const n of brutas) {
    if (!/^\d+$/.test(n)) continue;
    if (vistos.has(n)) { duplicados++; continue; }
    vistos.add(n);
    lista.push(n);
  }
  return { lista, duplicados };
}

function perguntar(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(msg, () => { rl.close(); r(); }));
}

const estaNoLogin = (page) => /login/i.test(page.url());

async function garantirLogin(page, primeiroNumero) {
  for (;;) {
    await page.goto(detalheUrl(primeiroNumero), { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!estaNoLogin(page)) return;
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await perguntar('\n>> Faça login no navegador (senha + reCAPTCHA) e aperte ENTER aqui... ');
  }
}

function salvar(linhas, caminho) {
  const cabecalho = ['Nº Serviço', ...CAMPOS.map(([, nome]) => nome), 'Status'];
  const aoa = [cabecalho, ...linhas.map((l) => [l.numServ, ...CAMPOS.map(([, nome]) => l[nome] ?? ''), l.status])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [14, 24, 40, 12, 12, 16, 22].map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: `A1:G${aoa.length}` };
  // Nº do serviço e do medidor como texto, para o Excel não virar notação científica
  for (let r = 1; r < aoa.length; r++) {
    for (const c of [0, 1]) {
      const cel = ws[XLSX.utils.encode_cell({ r, c })];
      if (cel && cel.v !== '') cel.t = 's';
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Medições');
  XLSX.writeFile(wb, caminho);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// O GDIS às vezes deixa a conexão cair/pendurar. Depois de um erro, o Edge fica
// numa página de erro (chrome-error) e os próximos goto() falham em cascata.
// Por isso: volta para about:blank, espera e tenta de novo.
async function irPara(page, url, tentativas = 4) {
  let ultimo;
  for (let t = 1; t <= tentativas; t++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return;
    } catch (e) {
      ultimo = e;
      await page.goto('about:blank').catch(() => { });
      await dormir(3000 * t);
    }
  }
  throw ultimo;
}

async function consultar(page, numero) {
  await irPara(page, detalheUrl(numero));
  if (estaNoLogin(page)) return { sessaoExpirada: true };
  const rotulos = CAMPOS.map(([k]) => k);
  const r = await page.evaluate(extrairNaPagina, rotulos);
  return { r };
}

async function main() {
  const { lista, duplicados } = lerLista();
  if (!lista.length) throw new Error(`Nenhum número de serviço em ${LISTA}`);
  console.log(`Lista: ${lista.length} serviços (${duplicados} duplicados ignorados).`);

  const browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  // A página dispara alert() se a consulta de fotos falhar; sem isso o script trava.
  page.on('dialog', (d) => d.dismiss().catch(() => { }));

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await perguntar('\n>> Faça login no navegador (senha + reCAPTCHA) e aperte ENTER aqui... ');
  await garantirLogin(page, lista[0]);
  console.log('Sessão OK. Consultando...\n');

  fs.mkdirSync(PASTA_SAIDA, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const saida = path.join(PASTA_SAIDA, `medicoes_${stamp}.xlsx`);
  const linhas = [];

  // RETOMAR=<planilha.xlsx>: reaproveita as linhas já resolvidas e refaz só as com ERRO.
  const anteriores = new Map();
  if (process.env.RETOMAR) {
    const ws = XLSX.readFile(path.resolve(process.env.RETOMAR)).Sheets['Medições'];
    for (const r of XLSX.utils.sheet_to_json(ws)) {
      const l = { numServ: String(r['Nº Serviço']), status: String(r.Status ?? '') };
      for (const [, nome] of CAMPOS) l[nome] = r[nome] == null ? '' : String(r[nome]);
      anteriores.set(l.numServ, l);
    }
    console.log(`Retomando: ${[...anteriores.values()].filter((l) => !l.status.startsWith('ERRO')).length} já resolvidos serão mantidos.`);
  }
  let errosSeguidos = 0;

  for (let i = 0; i < lista.length; i++) {
    const numero = lista[i];
    const antes = anteriores.get(numero);
    if (antes && !antes.status.startsWith('ERRO')) { linhas.push(antes); continue; }
    let linha = { numServ: numero, status: '' };
    try {
      let res = await consultar(page, numero);
      if (res.sessaoExpirada) {
        console.log('\nSessão expirou.');
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
        await perguntar('>> Faça login de novo e aperte ENTER... ');
        res = await consultar(page, numero);
      }
      if (res.sessaoExpirada) throw new Error('sessão expirada');
      const { campos, numServ } = res.r;
      if (!numServ) {
        linha.status = 'SERVIÇO NÃO ENCONTRADO';
      } else {
        for (const [k, nome] of CAMPOS) linha[nome] = campos[k] ?? '';
        linha.status = linha['Número Eqpto Medição'] ? 'OK' : 'SEM Nº EQPTO MEDIÇÃO';
      }
    } catch (e) {
      linha.status = `ERRO: ${e.message.split('\n')[0]}`;
    }
    linhas.push(linha);
    console.log(`[${i + 1}/${lista.length}] ${numero} → ${linha['Número Eqpto Medição'] || '-'}  (${linha.status})`);
    if ((i + 1) % SALVAR_A_CADA === 0) salvar(linhas, saida);
    errosSeguidos = linha.status.startsWith('ERRO') ? errosSeguidos + 1 : 0;
    if (errosSeguidos >= 3) {
      salvar(linhas, saida);
      await perguntar('\n>> 3 erros seguidos: rede/servidor GDIS parece fora (VPN?). Confira e aperte ENTER para continuar... ');
      errosSeguidos = 0;
    }
  }

  salvar(linhas, saida);
  await browser.close();

  const cont = {};
  for (const l of linhas) { const k = l.status.startsWith('ERRO') ? 'ERRO' : l.status; cont[k] = (cont[k] || 0) + 1; }
  console.log('\nResumo:', cont);
  console.log('Planilha:', saida);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { extrairNaPagina, CAMPOS, salvar, lerLista };
