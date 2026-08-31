const http = require('http');

const data = JSON.stringify({
  status: 'Inside',
  currentZone: 'Reception',
  entryTime: '11:20 AM'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/visitors/6a3d17d69d02c6ca51f72d77/zone', // Using SABARI's ID from earlier
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log(`BODY: ${responseData}`);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
