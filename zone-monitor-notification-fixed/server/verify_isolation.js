const http = require('http');

const makeRequest = (companyId) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/visitors',
      method: 'GET',
      headers: {
        'X-Company-Id': companyId,
        'X-User-Role': 'Super Admin'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });

    req.on('error', reject);
    req.end();
  });
};

async function run() {
  try {
    console.log('Testing FIC001...');
    const ficVisitors = await makeRequest('FIC001');
    console.log(`FIC001 Visitors: ${ficVisitors.length}`);
    
    console.log('Testing ACM741 (Test company)...');
    const acmeVisitors = await makeRequest('ACM741');
    console.log(`ACM741 Visitors: ${acmeVisitors.length}`);

    // Let's create a visitor for ACM741
    console.log('Creating visitor for ACM741...');
    const postOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/visitors',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Company-Id': 'ACM741',
        'X-User-Role': 'Security'
      }
    };

    const req = http.request(postOptions, async (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        console.log('Created visitor:', JSON.parse(data).visitorName);
        
        console.log('Re-testing ACM741...');
        const acmeVisitors2 = await makeRequest('ACM741');
        console.log(`ACM741 Visitors now: ${acmeVisitors2.length}`);

        console.log('Re-testing FIC001 to ensure isolation...');
        const ficVisitors2 = await makeRequest('FIC001');
        console.log(`FIC001 Visitors now: ${ficVisitors2.length}`);

        if (ficVisitors.length === ficVisitors2.length) {
          console.log('✅ Tenant isolation verified successfully!');
        } else {
          console.log('❌ Tenant isolation failed! FIC001 visitor count changed.');
        }
      });
    });

    req.write(JSON.stringify({
      visitorName: 'Isol Test',
      mobileNumber: '9999999999',
      hostName: 'Test Host',
      purpose: 'Testing',
      branch: 'All Branches',
      visitDate: new Date().toISOString().split('T')[0]
    }));
    req.end();

  } catch (e) {
    console.error(e);
  }
}

run();
