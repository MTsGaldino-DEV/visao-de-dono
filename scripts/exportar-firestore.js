import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Carregar variáveis de ambiente usando dotenv
// O config carrega o .env (onde estão as credenciais do Firebase de fato)
// e o .env.local (por garantia, caso exista alguma sobreposição).
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Lendo a configuração com os exatos mesmos nomes de variável usados no src/firebase/firebase.js
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// 4. Imprimir o Project ID para confirmação
console.log(`\n=== CONFIGURAÇÕES DO FIREBASE ===`);
console.log(`Project ID em uso: ${firebaseConfig.projectId}`);
console.log(`=================================\n`);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function exportCollection(collectionName) {
  console.log(`Iniciando exportação da coleção: ${collectionName}...`);
  const snapshot = await getDocs(collection(db, collectionName));
  const data = [];
  
  // 3. Para cada documento, incluir o id junto com todos os campos
  snapshot.forEach(doc => {
    data.push({
      id: doc.id,
      ...doc.data()
    });
  });

  const exportsDir = path.resolve(__dirname, '../exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const outputPath = path.resolve(exportsDir, `${collectionName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log(`✅ Coleção '${collectionName}' exportada com sucesso!`);
  console.log(`   Total de documentos: ${data.length}`);
  console.log(`   Salvo em: exports/${collectionName}.json\n`);
}

async function main() {
  try {
    await exportCollection('usuarios');
    await exportCollection('servicos');
    console.log("🎉 Exportação do Firestore concluída!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro durante a exportação:", error);
    process.exit(1);
  }
}

main();
