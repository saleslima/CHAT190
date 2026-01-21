import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDf-3RT8HR8htaehLq1o2i0dU0taWhwDxE",
  authDomain: "chat190.firebaseapp.com",
  databaseURL: "https://chat190-default-rtdb.firebaseio.com",
  projectId: "chat190",
  storageBucket: "chat190.firebasestorage.app",
  messagingSenderId: "431619161317",
  appId: "1:431619161317:web:9d8fc873d2aa63e857a80c"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const messagesRef = ref(database, 'messages');
const usersRef = ref(database, 'users');

console.log("Firebase initialized successfully");

export { database, messagesRef, usersRef };