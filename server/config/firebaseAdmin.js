const adminModule = require('firebase-admin');
const admin = (adminModule && adminModule.apps) ? adminModule : (adminModule.default || adminModule);

const apps = (admin && admin.apps) ? admin.apps : [];

if (apps.length === 0) {
  try {
    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch (e) {
        console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON, using discrete env vars');
      }
    }

    if (!serviceAccount) {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
      };
    }

    if (serviceAccount && (serviceAccount.projectId || serviceAccount.project_id) && serviceAccount.privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin SDK initialized successfully.');
    } else {
      console.warn('Firebase Admin SDK configuration missing or incomplete.');
    }
  } catch (err) {
    console.error('Firebase Admin SDK initialization error:', err.message);
  }
}

module.exports = admin;
