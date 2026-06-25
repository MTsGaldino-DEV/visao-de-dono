const fs = require('fs');
const path = require('path');

const dir = 'c:/APPWEB/visao-de-dono/src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

for (const file of files) {
  const fullPath = path.join(dir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  let newContent = content.replace(/placaMontada/g, 'placamontada');
  newContent = newContent.replace(/enviadoSupervisor/g, 'enviadosupervisor');
  
  if (content !== newContent) {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
}
