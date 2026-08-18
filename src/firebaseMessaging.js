import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "./firebase";

export const requestNotificationPermission = async () => {
  try {
    if (!('Notification' in window) || !messaging) {
      console.log("This browser does not support notifications or messaging is uninitialized.");
      return null;
    }
    
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "BMi4WOvwwzgiCpfLZj4rtSWDM0bHHL1ciowr6sbaGD6aQjSWsrkKae0Cfale0Q-Z8huo8grneu2XI5pEzfREgVA";
      const token = await getToken(messaging, { vapidKey });
      console.log("FCM Token:", token);
      return token;
    }
  } catch (err) {
    console.warn("FCM permission request error:", err.message);
  }
  return null;
};

export const listenNotification = () => {
  try {
    if (!messaging) {
      console.log("Messaging not supported, skipping onMessage listener.");
      return;
    }
    onMessage(messaging, (payload) => {
      console.log("Notification Received:", payload);
    });
  } catch (err) {
    console.warn("FCM listener error:", err.message);
  }
};
