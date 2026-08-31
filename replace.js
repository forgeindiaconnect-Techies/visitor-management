const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, 'server');
const pattern = /io\.emit\('new_notification',\s*([a-zA-Z0-9_]+)\);?/g;

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules') {
        processDirectory(fullPath);
      }
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      if (content.includes("io.emit('new_notification'")) {
        const newContent = content.replace(pattern, (match, varName) => {
          return `io.to(\`company:\${${varName}.companyId}\`).emit('new_notification', ${varName});`;
        });
        
        if (newContent !== content) {
          fs.writeFileSync(fullPath, newContent, 'utf8');
          console.log(`Updated ${fullPath}`);
        }
      }
    }
  }
}

processDirectory(serverDir);
console.log("Done.");
