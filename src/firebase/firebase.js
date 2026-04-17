import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD_qvbe6h42ch_ZT0rEsHtQzE_dNFu2CwI",
  authDomain: "visao-de-dono-2c18b.firebaseapp.com",
  projectId: "visao-de-dono-2c18b",
  storageBucket: "visao-de-dono-2c18b.firebasestorage.app",
  messagingSenderId: "1045776876294",
  appId: "1:1045776876294:web:6e587be27a552e0450d487",
  measurementId: "G-TZM6VVBN2H"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

console.log("✅ Firebase configurado com sucesso!");