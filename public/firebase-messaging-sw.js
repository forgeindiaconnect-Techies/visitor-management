importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyReplaceInProd",
  authDomain: "fic-vms.firebaseapp.com",
  projectId: "fic-vms",
  storageBucket: "fic-vms.appspot.com",
  messagingSenderId: "105555555555",
  appId: "1:105555555555:web:abcdef123456"
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
