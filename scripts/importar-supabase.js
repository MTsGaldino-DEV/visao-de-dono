import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Carregar o .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_KEY não definidos no .env.local");
  process.exit(1);
}

// 2. Conectar no Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Utilitário para formatar datas do Firestore
function convertDate(value) {
  if (!value) return undefined;
  // Se for objeto Timestamp do Firestore (com _seconds)
  if (typeof value === 'object' && '_seconds' in value) {
    return new Date(value._seconds * 1000).toISOString();
  }
  // Se já for string ISO ou Date
  if (typeof value === 'string' || value instanceof Date) {
    return new Date(value).toISOString();
  }
  return value;
}

// Limpar propriedades undefined para o Supabase não reclamar
function cleanObj(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

// 5. Processar em lotes
async function upsertInBatches(tableName, data, mapFn, batchSize = 50) {
  console.log(`\nIniciando importação de ${data.length} registros para a tabela '${tableName}'...`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const mappedBatch = batch.map(mapFn);

    const { error } = await supabase.from(tableName).upsert(mappedBatch);

    if (error) {
      // Se o lote falhar, processamos um por um para logar exatamente qual registro falhou
      console.warn(`⚠️ Erro no lote ${i} a ${i + batchSize}. Tentando um a um para detalhar erros...`);
      for (const item of mappedBatch) {
        const { error: singleError } = await supabase.from(tableName).upsert(item);
        if (singleError) {
          console.error(`❌ Erro ao inserir registro (ID: ${item.id || item.uid}):`, singleError.message);
          errorCount++;
        } else {
          successCount++;
        }
      }
    } else {
      successCount += batch.length;
      // 6. Logar o progresso
      console.log(`✅ Lote processado: ${Math.min(i + batchSize, data.length)} / ${data.length}`);
    }
  }

  return { successCount, errorCount };
}

async function main() {
  let totalSuccess = 0;
  let totalError = 0;

  try {
    const exportsDir = path.resolve(__dirname, '../exports');

    // ==========================================
    // 3. Importar exports/usuarios.json
    // ==========================================
    const usuariosPath = path.resolve(exportsDir, 'usuarios.json');
    if (fs.existsSync(usuariosPath)) {
      const usuariosData = JSON.parse(fs.readFileSync(usuariosPath, 'utf-8'));

      const mapUsuario = (u) => cleanObj({
        uid: u.uid || u.id,
        nome: u.nome,
        matricula: u.matricula,
        role: u.role,
        equipe: u.equipe,
        ativo: u.ativo !== undefined ? u.ativo : true,
        dt_criacao: convertDate(u.dtCriacao || u.dt_criacao),
        ultimo_acesso: convertDate(u.ultimoAcesso || u.ultimo_acesso),
        session_expiry: convertDate(u.sessionExpiry || u.session_expiry)
      });

      const { successCount, errorCount } = await upsertInBatches('usuarios', usuariosData, mapUsuario);
      totalSuccess += successCount;
      totalError += errorCount;
    } else {
      console.log(`\n⚠️ Arquivo usuarios.json não encontrado. Ignorando.`);
    }

    // ==========================================
    // 4. Importar exports/servicos.json
    // ==========================================
    const servicosPath = path.resolve(exportsDir, 'servicos.json');
    if (fs.existsSync(servicosPath)) {
      const servicosData = JSON.parse(fs.readFileSync(servicosPath, 'utf-8'));

      const mapServico = (s) => cleanObj({
        id: s.id,
        localidade: s.localidade,
        tipo: s.tipo,
        descricao: s.descricao,
        equipamento: s.equipamento,
        status: s.status || 'pendente',
        coord: typeof s.coord === 'object' && s.coord !== null ? JSON.stringify(s.coord) : s.coord,
        foto: s.foto,
        atribuido_para: s.atribuidoPara || s.atribuido_para,
        dt_atribuicao: convertDate(s.dtAtribuicao || s.dt_atribuicao),
        dt_acionamento: convertDate(s.dtAcionamento || s.dt_acionamento),
        motivo_reprovacao: s.motivoReprovacao || s.motivo_reprovacao,
        execucao: s.execucao,
        hist: s.hist,
        dt_criacao: convertDate(s.dtCriacao || s.dt_criacao)
      });

      const { successCount, errorCount } = await upsertInBatches('servicos', servicosData, mapServico);
      totalSuccess += successCount;
      totalError += errorCount;
    } else {
      console.log(`\n⚠️ Arquivo servicos.json não encontrado. Ignorando.`);
    }

    // 7. Imprimir resumo final
    console.log(`\n🎉 Importação concluída!`);
    console.log(`=================================`);
    console.log(`✅ Sucessos: ${totalSuccess}`);
    console.log(`❌ Falhas: ${totalError}`);
    console.log(`=================================\n`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro fatal durante a importação:", error);
    process.exit(1);
  }
}

main();
