import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBONYAtgtNCfI5haoFZ3SrhUgSqfrrzJqc",
  authDomain: "visitors-f425c.firebaseapp.com",
  projectId: "visitors-f425c",
  storageBucket: "visitors-f425c.firebasestorage.app",
  messagingSenderId: "13762660060",
  appId: "1:13762660060:web:8c55fdc80b9554ba461619",
  measurementId: "G-M0LVMSPD34"
};

const app = initializeApp(firebaseConfig);

export let messaging = null;
import { isSupported } from "firebase/messaging";
isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  }
}).catch(console.error);

export { app };
