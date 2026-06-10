import fs from 'fs';

const files = [
  "src/firebase/firebase.js",
  "src/context/AuthContext.jsx",
  "src/components/CadastroForm.jsx",
  "src/components/DetalheModal.jsx",
  "src/components/Faturamentotab.jsx",
  "src/components/GerarServicosTab.jsx",
  "src/components/LogsTab.jsx",
  "src/components/LotesPlacas.jsx",
  "src/components/Paineltab.jsx",
  "src/components/PlacasTab.jsx",
  "src/components/ServicosTable.jsx",
  "src/pages/home.jsx"
];

const out = {};

for (const f of files) {
  try {
    out[f] = fs.readFileSync(f, 'utf8');
  } catch(e) {
    out[f] = "ERROR: " + e.message;
  }
}

fs.writeFileSync('codigo_completo.json', JSON.stringify(out, null, 2), 'utf8');
console.log("Arquivo JSON criado com sucesso!");
