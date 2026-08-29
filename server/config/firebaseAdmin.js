const adminModule = require('firebase-admin');
const { getApps, initializeApp, cert } = require('firebase-admin/app');

const apps = getApps();

if (apps.length === 0) {
  try {
    let serviceAccount;

    const fs = require('fs');
    const path = require('path');
    const localServiceAccountPath = path.join(__dirname, 'firebase-service-account.json');

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch (e) {
        console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON, using discrete env vars');
      }
    }

    if (!serviceAccount && fs.existsSync(localServiceAccountPath)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(localServiceAccountPath, 'utf8'));
      } catch (e) {
        console.warn('Failed to read firebase-service-account.json file');
      }
    }

    if (!serviceAccount) {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
      };
    }

    const projectId = serviceAccount?.projectId || serviceAccount?.project_id;
    const clientEmail = serviceAccount?.clientEmail || serviceAccount?.client_email;
    const rawPrivateKey = serviceAccount?.privateKey || serviceAccount?.private_key;
    const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined;

    if (projectId && clientEmail && privateKey) {
      const certHandler = cert || adminModule?.credential?.cert;
      const initHandler = initializeApp || adminModule?.initializeApp;

      if (certHandler && initHandler) {
        initHandler({
          credential: certHandler({
            projectId,
            clientEmail,
            privateKey
          })
        });
        console.log('Firebase Admin SDK initialized successfully.');
      } else {
        console.warn('Firebase Admin SDK could not resolve cert or initializeApp handler.');
      }
    } else {
      console.warn('Firebase Admin SDK configuration missing or incomplete.');
    }
  } catch (err) {
    console.error('Firebase Admin SDK initialization error:', err.message);
  }
}

module.exports = admin;
