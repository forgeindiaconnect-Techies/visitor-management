const http = require('http');

http.get('http://localhost:5000/api/zones', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(data);
  });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});
