import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // Paste your Firebase web configuration values here.
  apiKey: "AIzaSyAxYHTa6OXIOoHvIHLX5BrKQbSOCSVDFqk",
  authDomain: "stoic-discipline.firebaseapp.com",
  projectId: "stoic-discipline",
  storageBucket: "stoic-discipline.firebasestorage.app",
  messagingSenderId: "571393339211",
  appId: "1:571393339211:web:0455dbd2d0f94f428302ce"
};

const app = initializeApp(firebaseConfig);

export const firebaseConfigured = true;
export const auth = getAuth(app);
export const db = getFirestore(app);
