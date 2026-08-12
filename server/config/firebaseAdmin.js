const { initializeApp, cert } = require("firebase-admin/app");

let serviceAccount = null;
let app = null;

try {
  serviceAccount = require("./firebase-service-account.json");
} catch (err) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (jsonErr) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env variable as JSON:", jsonErr.message);
    }
  } else {
    console.warn("Missing FIREBASE_SERVICE_ACCOUNT environment variable and local credentials file");
  }
}

if (serviceAccount) {
  try {
    app = initializeApp({
      credential: cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (initErr) {
    console.error("Error initializing Firebase Admin SDK:", initErr.message);
  }
} else {
  console.warn("Firebase Admin SDK not initialized: Service account credentials missing or invalid.");
}

module.exports = app;
