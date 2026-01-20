import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  query,
  limitToLast,
  set,
  get,
  remove,
  onDisconnect
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
const usersRef = ref(database, 'users');
console.log("Firebase initialized successfully");

let messagesHistory = [];
let messageIdCounter = Date.now();
let isFirstLoad = true;
let activeUsers = {};
let usersUnsubscribe = null;
let messagesUnsubscribe = null;

const chatOverlay = document.getElementById("chat-overlay");
const floatingChatBtn = document.getElementById("floatingChatBtn");
const chatMinimizeBtn = document.getElementById("chatMinimizeBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const chatCloseBtn = document.getElementById("chatCloseBtn");
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
  supervisao_militar: "supermil",
  supervisao_cobom: "supercobom"
};

// Check if message is older than 2 hours
function isMessageExpired(timestamp) {
  if (!timestamp) return false;
  const twoHours = 2 * 60 * 60 * 1000;
  return (Date.now() - new Date(timestamp).getTime()) > twoHours;
}

// Check if message is relevant to current user
function isMessageRelevant(message) {
  if (isMessageExpired(message.timestamp)) return false;

  const myPA = currentUser.pa;
  const myName = currentUser.name.toUpperCase();

  // 1. Sent by me (Strict Check: Must match PA and Name)
  if (message.from === myPA) {
    return message.fromName === myName;
  }

  // 2. Sent to me
  
  // Broadcast
  if (message.target === 'all') return true;

  // Targeted at my PA
  if (message.target === myPA) {
    // If targetName exists, it MUST match the current user name
    if (message.targetName && message.targetName !== myName) {
      return false;
    }
    return true;
  }

  // Targeted at my Role (I am supervisor receiving from Atendente)
  if (["supervisao_civil", "supervisao_militar", "supervisao_cobom"].includes(currentUser.role)) {
     if (message.supervisorType === currentUser.role) return true;
  }

  return false;
}

// Listen for messages from Firebase
function setupFirebaseListener() {
  if (messagesUnsubscribe) messagesUnsubscribe();

  const messagesQuery = query(messagesRef, limitToLast(100));
  
  messagesUnsubscribe = onValue(messagesQuery, (snapshot) => {
    if (!currentUser) return;
    
    const messages = [];
    snapshot.forEach((childSnapshot) => {
      messages.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    
    // Filter messages globally for expiration
    const validMessages = messages.filter(msg => !isMessageExpired(msg.timestamp));
    
    if (isFirstLoad) {
      messagesHistory = validMessages;
      displayRelevantMessages();
      isFirstLoad = false;
    } else {
      // Find new messages
      const newMessages = validMessages.filter(msg => 
        !messagesHistory.find(m => m.id === msg.id || (m.id && m.id.startsWith('temp_')))
      );
      
      messagesHistory = validMessages;
      
      newMessages.forEach(message => {
        if (message.from !== currentUser.pa && isMessageRelevant(message)) {
           displayMessage(message);
           // If message is received, ensure chat is open/visible to user
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



// Display a message in the UI
function displayMessage(message) {
  const isSent = message.from === currentUser.pa;
  const messageRow = document.createElement("div");
  messageRow.className = `message-row ${isSent ? "sent" : "received"}`;

  const messageBubble = document.createElement("div");
  messageBubble.className = "message-bubble";

  // Sender Info
  const senderInfo = document.createElement("div");
  senderInfo.className = "message-sender-info";
  senderInfo.textContent = `${message.fromName || 'Usuario'} (P.A ${message.from})`;
  messageBubble.appendChild(senderInfo);

  if (message.text) {
    const textDiv = document.createElement("div");
    textDiv.textContent = message.text;
    messageBubble.appendChild(textDiv);
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
  
  // Click to reply for supervisors
  if (!isSent && ["supervisao_civil", "supervisao_militar", "supervisao_cobom"].includes(currentUser.role)) {
    messageBubble.style.cursor = 'pointer';
    messageBubble.title = 'Clique para responder a este usuário';
    messageBubble.addEventListener('click', () => {
       // Check if option exists in dropdown
       const option = targetSelect.querySelector(`option[value="${message.from}"]`);
       if (option) {
         targetSelect.value = message.from;
         messageInput.focus();
         // Visual feedback
         messageBubble.style.opacity = '0.7';
         setTimeout(() => messageBubble.style.opacity = '1', 200);
       } else {
         alert("Usuário não está online/disponível na lista de ativos.");
       }
    });
  }

  messageRow.appendChild(messageBubble);
  messagesContainer.appendChild(messageRow);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Initialize PA field (Removed IP logic, now manual)
function populatePASelect() {
  userPAInput.innerHTML = '<option value="" disabled selected>Selecione o P.A</option>';
  for (let i = 1; i <= 208; i++) {
    const val = i.toString().padStart(3, '0');
    const option = document.createElement('option');
    option.value = val;
    option.textContent = `P.A ${val}`;
    userPAInput.appendChild(option);
  }
}
populatePASelect();

function setupUsersListener() {
  const usersQuery = query(usersRef);
  usersUnsubscribe = onValue(usersQuery, (snapshot) => {
    activeUsers = snapshot.val() || {};
    updateTargetSelect();
  });
}

function updateTargetSelect() {
  // Only for supervisors
  if (!currentUser || !['supervisao_civil', 'supervisao_militar', 'supervisao_cobom'].includes(currentUser.role)) return;
  
  const currentVal = targetSelect.value;
  targetSelect.innerHTML = '<option value="" disabled selected>Selecione o destinatário</option>';
  
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'TODOS';
  targetSelect.appendChild(allOption);
  
  // Sort by PA
  Object.keys(activeUsers).sort().forEach(paKey => {
     // Don't list myself
     if (paKey === currentUser.pa) return;
     
     const user = activeUsers[paKey];
     const option = document.createElement('option');
     option.value = paKey;
     option.textContent = `P.A ${paKey} - ${user.name} (${formatRole(user.role)})`;
     targetSelect.appendChild(option);
  });
  
  if (currentVal && targetSelect.querySelector(`option[value="${currentVal}"]`)) {
    targetSelect.value = currentVal;
  }
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
    } else if (selectedRole === "supervisao_cobom") {
      supervisorPasswordSection.classList.remove("hidden");
      passwordHint.textContent = "Senha: SUPERCOBOM";
    } else {
      supervisorPasswordSection.classList.add("hidden");
      passwordHint.textContent = "";
    }
  });
});

async function enterChat(name, pa, role) {
  currentUser = { name, pa, role };
  selectedRole = role;

  // Save session for reload persistence
  localStorage.setItem('chatUserSession', JSON.stringify({ name, pa, role }));

  // Register user presence
  const userRef = ref(database, `users/${pa}`);
  // Overwrite presence (handles re-login on refresh)
  await set(userRef, {
    name,
    role,
    loginTime: Date.now()
  });
  
  // Remove user on disconnect
  onDisconnect(userRef).remove();
  
  // Attempt clean removal on window close
  window.addEventListener('beforeunload', () => {
    // We only remove if explicitly quitting, but for refresh we rely on the new session overwriting.
    // However, to keep active list clean, we remove. The next load will re-add.
    remove(userRef);
  });

  const roleLabel = role === "atendente" ? "Atendente" : 
                    role === "supervisao_civil" ? "Sup. Civil" : 
                    role === "supervisao_cobom" ? "Sup. COBOM" : "Sup. Militar";
  chatUserLabel.textContent = `P.A: ${pa} • ${name} • ${roleLabel}`;

  userSetup.classList.add("hidden");
  chatContent.classList.remove("hidden");
  clearChatBtn.classList.remove("hidden");
  
  // Ensure supervisor password section is hidden if it was open
  supervisorPasswordSection.classList.add("hidden");

  if (["supervisao_civil", "supervisao_militar", "supervisao_cobom"].includes(role)) {
    supervisorControls.classList.remove("hidden");
    atendenteControls.classList.add("hidden");
    setupUsersListener(); 
  } else if (role === "atendente") {
    supervisorControls.classList.add("hidden");
    atendenteControls.classList.remove("hidden");
  }

  // Ensure chat is visible (in case it was minimized or hidden)
  showChatOverlay();

  displayRelevantMessages();
  setupFirebaseListener();
}

// Check for saved session on load
window.addEventListener('load', async () => {
  const savedSession = localStorage.getItem('chatUserSession');
  if (savedSession) {
    try {
      const session = JSON.parse(savedSession);
      if (session.name && session.pa && session.role) {
        // Auto-login
        await enterChat(session.name, session.pa, session.role);
      }
    } catch (e) {
      console.error("Erro ao restaurar sessão:", e);
      localStorage.removeItem('chatUserSession');
    }
  }
});

// Start chat manually
startChatBtn.addEventListener("click", async () => {
  const name = userNameInput.value.trim();
  const pa = userPAInput.value.trim();

  if (!selectedRole) {
    alert("Por favor, selecione um perfil.");
    return;
  }

  if (!pa) {
    alert("Por favor, digite seu P.A.");
    return;
  }

  if (!name) {
    alert("Por favor, digite seu nome.");
    return;
  }

  // Check if PA is already in use
  try {
    const userSnapshot = await get(ref(database, `users/${pa}`));
    if (userSnapshot.exists()) {
      alert(`O P.A. ${pa} já está em uso por outro usuário.`);
      return;
    }
  } catch (error) {
    console.error("Erro ao verificar usuário:", error);
    alert("Erro de conexão. Tente novamente.");
    return;
  }

  if (["supervisao_civil", "supervisao_militar", "supervisao_cobom"].includes(selectedRole)) {
    const password = supervisorPasswordInput.value.trim();
    if (password.toLowerCase() !== SUPERVISOR_PASSWORDS[selectedRole].toLowerCase()) {
      alert("Senha incorreta. A senha correta é: " + SUPERVISOR_PASSWORDS[selectedRole].toUpperCase());
      return;
    }
  }

  await enterChat(name, pa, selectedRole);
});

function logout() {
  // Clear stored session
  localStorage.removeItem('chatUserSession');

  if (currentUser) {
    try {
      remove(ref(database, `users/${currentUser.pa}`));
    } catch(e) { console.error(e); }
  }
  
  if (usersUnsubscribe) {
    usersUnsubscribe();
    usersUnsubscribe = null;
  }
  if (messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }
  
  activeUsers = {};
  currentUser = null;
  selectedRole = null;
  messagesHistory = [];
  messagesContainer.innerHTML = "";
  chatUserLabel.textContent = "";
  isFirstLoad = true; // Reset for next login
  
  userNameInput.value = "";
  supervisorPasswordInput.value = "";
  messageInput.value = "";
  userPAInput.value = "";
  
  chatContent.classList.add("hidden");
  userSetup.classList.remove("hidden");
  clearChatBtn.classList.add("hidden");
  detailsSection.classList.add("hidden");
  supervisorPasswordSection.classList.add("hidden");
  
  profileItems.forEach(item => item.classList.remove("active"));
  
  showChatOverlay(); // Ensure overlay is visible for login form
}

chatCloseBtn.addEventListener("click", logout);

clearChatBtn.addEventListener("click", () => {
  // Clear local view only
  messagesContainer.innerHTML = '';
  // We don't delete from DB, just clear screen as requested
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

function formatRole(role) {
  if (role === 'atendente') return 'Atendente';
  if (role === 'supervisao_civil') return 'Sup. Civil';
  if (role === 'supervisao_militar') return 'Sup. Militar';
  if (role === 'supervisao_cobom') return 'Sup. COBOM';
  return role;
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
  if (["supervisao_civil", "supervisao_militar", "supervisao_cobom"].includes(currentUser.role)) {
    if (!targetSelect.value) {
      alert("Selecione um destinatário.");
      return;
    }
    messageData.target = targetSelect.value;
    
    // Attach target name for strict visibility matching
    if (messageData.target !== 'all' && activeUsers[messageData.target]) {
      messageData.targetName = activeUsers[messageData.target].name.toUpperCase();
    }
  } else if (currentUser.role === "atendente") {
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
showChatOverlay();