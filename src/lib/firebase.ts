// Import the functions you need from the SDKs you need

import { initializeApp } from "firebase/app";

import { getAuth, GoogleAuthProvider } from "firebase/auth";

import { getFirestore } from "firebase/firestore";


// TODO: Add SDKs for Firebase products that you want to use

// https://firebase.google.com/docs/web/setup#available-libraries


// Your web app's Firebase configuration

// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {

  apiKey: "AIzaSyAzoQpd8KrvsgZQZ0NbdZI6BC4LswWHDbo",

  authDomain: "projeto-31b8d.firebaseapp.com",

  projectId: "projeto-31b8d",

  storageBucket: "projeto-31b8d.firebasestorage.app",

  messagingSenderId: "19688541087",

  appId: "1:19688541087:web:b928ce3d0f046aebe10baa",

  measurementId: "G-MVZB848NH1"

};


// Initialize Firebase

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();