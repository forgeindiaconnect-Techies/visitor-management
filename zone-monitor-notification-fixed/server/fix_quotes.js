const fs = require('fs');
const path = require('path');

function fix(dir) {
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if(fs.statSync(p).isDirectory()) {
      fix(p);
    } else if(p.endsWith('.js') || p.endsWith('.jsx')) {
      let c = fs.readFileSync(p, 'utf8');
      if(c.includes('http://${window.location.hostname}')) {
        c = c.replace(/['"]http:\/\/\$\{window\.location\.hostname\}:5000(.*?)['"]/g, '`http://${window.location.hostname}:5000$1`');
        fs.writeFileSync(p, c);
        console.log('fixed', p);
      }
    }
  });
}

fix('e:/Antigravity/Pooja/src');
