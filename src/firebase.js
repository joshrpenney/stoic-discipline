import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // Paste your Firebase web configuration values here.
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_AUTH_DOMAIN",
  projectId: "stoic-discipline",
  storageBucket: "PASTE_STORAGE_BUCKET",
  messagingSenderId: "57139339211",
  appId: "PASTE_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const firebaseConfigured = true;
export const auth = getAuth(app);
export const db = getFirestore(app);
