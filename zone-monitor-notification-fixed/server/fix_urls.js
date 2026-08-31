const fs = require('fs');
const path = require('path');

const directoryPath = 'e:/Antigravity/Pooja/src';

function replaceInFiles(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInFiles(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('http://localhost:5000')) {
        content = content.replace(/http:\/\/localhost:5000/g, 'http://${window.location.hostname}:5000');
        
        // Wait, if it's replaced inside quotes like 'http://localhost:5000/api', it will become 'http://${window.location.hostname}:5000/api' which is literally ${...} instead of template literal.
        // It's better to fix the quotes to backticks if they are single quotes.
        // Actually, let's use a regex to handle single/double quotes to backticks.
        content = content.replace(/['"]http:\/\/localhost:5000(.*?)['"]/g, '`http://${window.location.hostname}:5000$1`');

        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

replaceInFiles(directoryPath);
