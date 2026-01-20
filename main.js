import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  query,
  limitToLast
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
console.log("Firebase initialized successfully");

let messagesHistory = [];
let messageIdCounter = Date.now();
let isFirstLoad = true;

const chatOverlay = document.getElementById("chat-overlay");
const floatingChatBtn = document.getElementById("floatingChatBtn");
const chatMinimizeBtn = document.getElementById("chatMinimizeBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userSetup = document.getElementById("userSetup");
const chatContent = document.getElementById("chatContent");
const detailsSection = document.getElementById("detailsSection");
const supervisorPasswordSection = document.getElementById("supervisorPasswordSection");

const userPAInput = document.getElementById("userPA");
const userNameInput = document.getElementById("userName");
const supervisorPasswordInput = document.getElementById("supervisorPassword");
const profileItems = document.querySelectorAll(".profile-item");
const startChatBtn = document.getElementById("startChatBtn");

const messagesContainer = document.getElementById("messagesContainer");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const imageInput = document.getElementById("imageInput");

const supervisorControls = document.getElementById("supervisorControls");
const atendenteControls = document.getElementById("atendenteControls");
const targetSelect = document.getElementById("targetSelect");
const supervisorTypeSelect = document.getElementById("supervisorTypeSelect");
const chatUserLabel = document.getElementById("chatUserLabel");
const passwordHint = document.getElementById("passwordHint");

let currentUser = null;
let selectedRole = null;

const SUPERVISOR_PASSWORDS = {
  supervisao_civil: "superciv",
  supervisao_militar: "supermil"
};

// Listen for messages from Firebase
function setupFirebaseListener() {
  const messagesQuery = query(messagesRef, limitToLast(100));
  
  onValue(messagesQuery, (snapshot) => {
    if (!currentUser) return;
    
    const messages = [];
    snapshot.forEach((childSnapshot) => {
      messages.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    
    if (isFirstLoad) {
      // On first load, just display relevant messages
      messagesHistory = messages;
      displayRelevantMessages();
      isFirstLoad = false;
    } else {
      // For new messages, check if they should trigger notification
      const newMessages = messages.filter(msg => 
        !messagesHistory.find(m => m.id === msg.id || (m.id && m.id.startsWith('temp_')))
      );
      
      messagesHistory = messages;
      
      newMessages.forEach(message => {
        // Only display if it's from someone else and relevant
        if (message.from !== currentUser.pa && shouldReceiveMessage(message)) {
          displayMessage(message);
          showChatOverlay();
        }
      });
    }
  });
}

// Send a message to Firebase
async function sendMessageToFirebase(messageData) {
  try {
    const messageWithTimestamp = {
      ...messageData,
      timestamp: new Date().toISOString()
    };
    const result = await push(messagesRef, messageWithTimestamp);
    console.log("Mensagem salva no banco de dados com sucesso:", result.key);
    return result;
  } catch (err) {
    console.error("Erro ao salvar mensagem no banco de dados:", err);
    alert("Erro ao enviar mensagem. Por favor, tente novamente.");
    throw err;
  }
}

// Determine if current user should receive this message
function shouldReceiveMessage(message) {
  if (!currentUser) return false;

  // If message is from atendente to specific supervisor type
  if (message.fromRole === "atendente") {
    if (message.supervisorType === currentUser.role) {
      return true;
    }
  }

  // If message is from supervisor to specific target
  if (message.fromRole === "supervisao_civil" || message.fromRole === "supervisao_militar") {
    if (message.target === "all") {
      // All logged in users receive
      return true;
    } else if (message.target === currentUser.pa) {
      // Specific target
      return true;
    }
  }

  return false;
}



// Display a message in the UI
function displayMessage(message) {
  const isSent = message.from === currentUser.pa;
  const messageRow = document.createElement("div");
  messageRow.className = `message-row ${isSent ? "sent" : "received"}`;

  const messageBubble = document.createElement("div");
  messageBubble.className = "message-bubble";

  if (message.text) {
    const textNode = document.createTextNode(message.text);
    messageBubble.appendChild(textNode);
  }

  if (message.image) {
    const img = document.createElement("img");
    img.src = message.image;
    img.className = "message-image";
    messageBubble.appendChild(img);
  }

  const meta = document.createElement("div");
  meta.className = "message-meta";
  const time = new Date(message.timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  meta.textContent = time;
  messageBubble.appendChild(meta);

  messageRow.appendChild(messageBubble);
  messagesContainer.appendChild(messageRow);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Get last 3 digits of IPv4
async function getLastThreeDigitsOfIP() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    const ip = data.ip;
    const parts = ip.split(".");
    if (parts.length === 4) {
      return parts[3];
    }
  } catch (err) {
    console.error("Error fetching IP:", err);
  }
  return Math.floor(100 + Math.random() * 900).toString();
}

// Initialize PA field
async function initializePA() {
  const pa = await getLastThreeDigitsOfIP();
  userPAInput.value = pa;
}

// Profile selection
profileItems.forEach((item) => {
  item.addEventListener("click", () => {
    profileItems.forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    selectedRole = item.dataset.role;
    detailsSection.classList.remove("hidden");

    if (selectedRole === "supervisao_civil") {
      supervisorPasswordSection.classList.remove("hidden");
      passwordHint.textContent = "Senha: SUPERCIV";
    } else if (selectedRole === "supervisao_militar") {
      supervisorPasswordSection.classList.remove("hidden");
      passwordHint.textContent = "Senha: SUPERMIL";
    } else {
      supervisorPasswordSection.classList.add("hidden");
      passwordHint.textContent = "";
    }
  });
});

// Start chat
startChatBtn.addEventListener("click", () => {
  const name = userNameInput.value.trim();
  const pa = userPAInput.value;

  if (!selectedRole) {
    alert("Por favor, selecione um perfil.");
    return;
  }

  if (!name) {
    alert("Por favor, digite seu nome.");
    return;
  }

  if (selectedRole === "supervisao_civil" || selectedRole === "supervisao_militar") {
    const password = supervisorPasswordInput.value.trim();
    // Verifica a senha ignorando maiúsculas/minúsculas para evitar erros
    if (password.toLowerCase() !== SUPERVISOR_PASSWORDS[selectedRole].toLowerCase()) {
      alert("Senha incorreta. A senha correta é: " + SUPERVISOR_PASSWORDS[selectedRole].toUpperCase());
      return;
    }
    supervisorPasswordSection.classList.add("hidden");
  }

  currentUser = {
    name,
    pa,
    role: selectedRole,
  };

  const roleLabel = selectedRole === "atendente" ? "Atendente" : 
                    selectedRole === "supervisao_civil" ? "Superv Civil" : "Superv Militar";
  chatUserLabel.textContent = `P.A: ${pa} • ${name} • ${roleLabel}`;

  userSetup.classList.add("hidden");
  chatContent.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");

  if (selectedRole === "supervisao_civil" || selectedRole === "supervisao_militar") {
    supervisorControls.classList.remove("hidden");
    atendenteControls.classList.add("hidden");
    updateTargetSelect();
  } else if (selectedRole === "atendente") {
    supervisorControls.classList.add("hidden");
    atendenteControls.classList.remove("hidden");
  }

  displayRelevantMessages();
  setupFirebaseListener();
});

// Logout
logoutBtn.addEventListener("click", () => {
  // Reset user state
  currentUser = null;
  selectedRole = null;
  messagesHistory = [];
  
  // Clear UI
  messagesContainer.innerHTML = "";
  chatUserLabel.textContent = "";
  
  // Reset inputs
  userNameInput.value = "";
  supervisorPasswordInput.value = "";
  messageInput.value = "";
  
  // Reset views
  chatContent.classList.add("hidden");
  userSetup.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
  detailsSection.classList.add("hidden");
  supervisorPasswordSection.classList.add("hidden");
  
  // Deselect profile items
  profileItems.forEach(item => item.classList.remove("active"));
});

// Display relevant messages for current user
function displayRelevantMessages() {
  messagesContainer.innerHTML = "";
  messagesHistory.forEach((message) => {
    if (isMessageRelevant(message)) {
      displayMessage(message);
    }
  });
}

// Check if message is relevant to current user
function isMessageRelevant(message) {
  // User's own messages
  if (message.from === currentUser.pa) {
    return true;
  }

  // Messages directed to this user
  if (shouldReceiveMessage(message)) {
    return true;
  }

  return false;
}

// Update target select for supervisors
function updateTargetSelect() {
  targetSelect.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Todos";
  targetSelect.appendChild(allOption);

  // In a real scenario, you'd get logged in users from a server
  // For now, we'll just show option for "all"
}

// Send message
messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = messageInput.value.trim().toUpperCase();
  const imageFile = imageInput.files[0];
  let imageData = null;

  if (imageFile) {
    imageData = await fileToBase64(imageFile);
  }

  if (!text && !imageData) {
    return;
  }

  const messageData = {
    from: currentUser.pa,
    fromName: currentUser.name.toUpperCase(),
    fromRole: currentUser.role,
    text: text || "",
    image: imageData,
  };

  // For supervisor, set target
  if (currentUser.role === "supervisao_civil" || currentUser.role === "supervisao_militar") {
    messageData.target = targetSelect.value;
  } else if (currentUser.role === "atendente") {
    // Atendente messages go to selected supervisor type
    messageData.supervisorType = supervisorTypeSelect.value;
  }

  // Add timestamp and display immediately
  const messageWithId = {
    ...messageData,
    id: `temp_${Date.now()}`,
    timestamp: new Date().toISOString()
  };
  
  // Display sent message immediately
  displayMessage(messageWithId);
  messagesHistory.push(messageWithId);
  
  // Send to Firebase and wait for confirmation
  try {
    await sendMessageToFirebase(messageData);
    console.log("Mensagem enviada e salva:", messageData);
  } catch (err) {
    console.error("Falha ao enviar mensagem:", err);
  }

  messageInput.value = "";
  imageInput.value = "";
});

// File to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Show chat overlay
function showChatOverlay() {
  chatOverlay.classList.remove("hidden");
  floatingChatBtn.classList.add("hidden");
}

// Hide chat overlay
function hideChatOverlay() {
  chatOverlay.classList.add("hidden");
  floatingChatBtn.classList.remove("hidden");
}

// Minimize chat
chatMinimizeBtn.addEventListener("click", () => {
  hideChatOverlay();
});

// Reopen chat
floatingChatBtn.addEventListener("click", () => {
  showChatOverlay();
});

// Initialize
initializePA();
showChatOverlay();