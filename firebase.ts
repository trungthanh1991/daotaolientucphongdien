import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = { 
  apiKey : "AIzaSyCmWDep7GDYQlerzPsumy8S6eUIhhLbE80" , 
  authDomain : "dtltpdien-e49e4.firebaseapp.com" , 
  projectId : "dtltpdien-e49e4" , 
  storageBucket : "dtltpdien-e49e4.appspot.com" , 
  messagingSenderId : "279733704965" , 
  appId : "1:279733704965:web:fb90e63b82a56a8ed0bf6c" , 
  measurementId : "G-QMCK63H8XY" 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth instance to be used in other parts of the app
export const auth = getAuth(app);
// Export firestore instance
export const db = getFirestore(app);