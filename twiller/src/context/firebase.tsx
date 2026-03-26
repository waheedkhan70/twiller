
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAfdeOi7AQFWShrP-JUPQv5GX2WJZMPwvg",
  authDomain: "twiller-5e300.firebaseapp.com",
  projectId: "twiller-5e300",
  storageBucket: "twiller-5e300.firebasestorage.app",
  messagingSenderId: "700525772512",
  appId: "1:700525772512:web:0e7381da066f5003d45a85"
};




const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export default app;
