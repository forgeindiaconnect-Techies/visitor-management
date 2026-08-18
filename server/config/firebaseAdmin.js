const admin = require('firebase-admin');

if (!admin.apps.length) {
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
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      };
    }

    if (serviceAccount && (serviceAccount.projectId || serviceAccount.project_id)) {
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
