importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyBONYAtgtNCfI5haoFZ3SrhUgSqfrrzJqc",
  authDomain: "visitors-f425c.firebaseapp.com",
  projectId: "visitors-f425c",
  storageBucket: "visitors-f425c.firebasestorage.app",
  messagingSenderId: "13762660060",
  appId: "1:13762660060:web:8c55fdc80b9554ba461619"
};

if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("Background FCM message received:", payload);

  const title = payload.notification?.title || payload.data?.title || "Visitor Management";
  const body = payload.notification?.body || payload.data?.message || payload.data?.body || "New visitor notification";

  self.registration.showNotification(title, {
    body,
    icon: "/favicon.ico",
    data: payload.data || {},
  });
});
