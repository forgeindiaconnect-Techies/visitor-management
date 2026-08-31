const http = require('http');

http.get('http://localhost:5000/api/visitors', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const visitors = JSON.parse(data);
    const sabari = visitors.find(v => v.visitorId === 'VMS-2026-0004' || v.visitorName === 'SABARI');
    console.log(JSON.stringify(sabari, null, 2));
  });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});
