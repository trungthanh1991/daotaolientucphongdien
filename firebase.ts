import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBRGDuQG-Nln-xwdezcGXlYIdyp-qWUZPk",
  authDomain: "dtltpdien.firebaseapp.com",
  projectId: "dtltpdien",
  storageBucket: "dtltpdien.firebasestorage.app",
  messagingSenderId: "571071073763",
  appId: "1:571071073763:web:f9bd296c8bc8eed876e4d6",
  measurementId: "G-Z8L5QNSL95"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth instance to be used in other parts of the app
export const auth = getAuth(app);
// Export firestore instance
export const db = getFirestore(app);
