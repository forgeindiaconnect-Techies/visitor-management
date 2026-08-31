const http = require('http');

const request = (method, path, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

(async () => {
  console.log("Test 1: GET (Super Admin)");
  console.log(await request('GET', '/api/approval-permissions', { 'x-user-role': 'SUPER_ADMIN' }));

  console.log("\nTest 2: PUT IT -> true");
  console.log(await request('PUT', '/api/approval-permissions/IT', { 'x-user-role': 'SUPER_ADMIN' }, { canApprove: true }));

  console.log("\nTest 3: PUT SECURITY -> 400");
  console.log(await request('PUT', '/api/approval-permissions/SECURITY', { 'x-user-role': 'SUPER_ADMIN' }, { canApprove: true }));

  console.log("\nTest 4: GET (HR) -> 403");
  console.log(await request('GET', '/api/approval-permissions', { 'x-user-role': 'HR' }));
})();
