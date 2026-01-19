const STORAGE_KEY_MESSAGES = "chatMessages";
let messagesHistory = [];
let messageIdCounter = Date.now();
const messageChannel = new BroadcastChannel('chat_messages');

const chatOverlay = document.getElementById("chat-overlay");
const floatingChatBtn = document.getElementById("floatingChatBtn");
const chatMinimizeBtn = document.getElementById("chatMinimizeBtn");
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
const targetSelect = document.getElementById("targetSelect");
const chatUserLabel = document.getElementById("chatUserLabel");

let currentUser = null;
let selectedRole = null;

const SUPERVISOR_PASSWORD = "supervisor123";

// Listen for messages from other tabs and same tab
function setupStorageListener() {
  messageChannel.onmessage = (event) => {
    handleIncomingMessage(event.data);
  };
}

// Send a message to other tabs via BroadcastChannel
function sendMessageToOtherTabs(messageData) {
  try {
    const messageWithId = {
      ...messageData,
      id: `${currentUser.pa}_${messageIdCounter++}`,
      timestamp: new Date().toISOString()
    };
    messageChannel.postMessage(messageWithId);
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

// Handle incoming message from another tab
function handleIncomingMessage(message) {
  if (!currentUser) return;

  // Don't process our own messages
  if (message.from === currentUser.pa) return;

  const shouldReceive = shouldReceiveMessage(message);
  if (shouldReceive) {
    addMessageToHistory(message);
    displayMessage(message);
    showChatOverlay();
  }
}

// Determine if current user should receive this message
function shouldReceiveMessage(message) {
  if (!currentUser) return false;

  // If message is from atendente, all supervisors should receive
  if (message.fromRole === "atendente" && currentUser.role === "supervisao") {
    return true;
  }

  // If message is from supervisor to specific target
  if (message.fromRole === "supervisao") {
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

// Save messages to localStorage
function saveMessages() {
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messagesHistory));
  } catch (err) {
    console.error("Error saving messages:", err);
  }
}

// Load messages from localStorage
function loadMessages() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (stored) {
      messagesHistory = JSON.parse(stored);
    }
  } catch (err) {
    console.error("Error loading messages:", err);
  }
}

// Add message to history
function addMessageToHistory(message) {
  messagesHistory.push(message);
  saveMessages();
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

    if (selectedRole === "supervisao") {
      supervisorPasswordSection.classList.remove("hidden");
    } else {
      supervisorPasswordSection.classList.add("hidden");
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

  if (selectedRole === "supervisao") {
    const password = supervisorPasswordInput.value.trim();
    if (password !== SUPERVISOR_PASSWORD) {
      alert("Senha de supervisão incorreta.");
      return;
    }
    // Hide password section after successful login
    supervisorPasswordSection.classList.add("hidden");
  }

  currentUser = {
    name,
    pa,
    role: selectedRole,
  };

  chatUserLabel.textContent = `P.A: ${pa} • ${name}`;

  userSetup.classList.add("hidden");
  chatContent.classList.remove("hidden");

  if (selectedRole === "supervisao") {
    supervisorControls.classList.remove("hidden");
    updateTargetSelect();
  } else {
    supervisorControls.classList.add("hidden");
  }

  loadMessages();
  displayRelevantMessages();
  setupStorageListener();
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

  const text = messageInput.value.trim();
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
    fromName: currentUser.name,
    fromRole: currentUser.role,
    text: text || "",
    image: imageData,
  };

  // For supervisor, set target
  if (currentUser.role === "supervisao") {
    messageData.target = targetSelect.value;
  } else {
    // Atendente messages go to all supervisors
    messageData.target = "supervisao";
  }

  // Display own message immediately
  const displayData = {
    ...messageData,
    id: `${currentUser.pa}_${messageIdCounter++}`,
    timestamp: new Date().toISOString(),
  };
  addMessageToHistory(displayData);
  displayMessage(displayData);

  // Send to other tabs
  sendMessageToOtherTabs(messageData);

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