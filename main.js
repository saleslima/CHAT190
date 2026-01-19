const chatOverlay = document.getElementById("chat-overlay");
const chatWindow = document.querySelector(".chat-window");
const userSetup = document.getElementById("userSetup");
const chatContent = document.getElementById("chatContent");
const startChatBtn = document.getElementById("startChatBtn");
const userNameInput = document.getElementById("userName");
const userPAInput = document.getElementById("userPA");
const chatUserLabel = document.getElementById("chatUserLabel");
const messagesContainer = document.getElementById("messagesContainer");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const imageInput = document.getElementById("imageInput");
const chatMinimizeBtn = document.getElementById("chatMinimizeBtn");
const floatingChatBtn = document.getElementById("floatingChatBtn");
const supervisorPasswordSection = document.getElementById("supervisorPasswordSection");
const supervisorPasswordInput = document.getElementById("supervisorPassword");
const supervisorControls = document.getElementById("supervisorControls");
const targetSelect = document.getElementById("targetSelect");
const detailsSection = document.getElementById("detailsSection");
const profileItems = document.querySelectorAll(".profile-item");

let currentUser = null;
let selectedRole = null;
const attendantsRegistry = new Map(); // key: pa, value: { name, pa }
const supervisorsRegistry = new Map(); // key: pa, value: { name, pa }
const SUPERVISOR_PASSWORD = "superv190cop";
let lastIncomingAttendantPA = null;

const STORAGE_KEY_MESSAGES = "chatMessages";
const STORAGE_KEY_OUTGOING = "chatOutgoingMessages";
let messagesHistory = [];
let messageIdCounter = Date.now();

/**
 * Registra um atendente logado na lista global.
 */
function registerAttendant(name, pa) {
  if (!pa) return;
  attendantsRegistry.set(pa, { name, pa });
  if (currentUser && currentUser.role === "supervisao") {
    populateSupervisorTargets();
  }
}

/**
 * Registra um supervisor logado na lista global.
 */
function registerSupervisor(name, pa) {
  if (!pa) return;
  supervisorsRegistry.set(pa, { name, pa });
}

/**
 * Popula o combo de destinos da supervisão com a lista de atendentes logados.
 * Inclui a opção "Todos atendentes" para enviar para todos os logados.
 */
function populateSupervisorTargets() {
  if (!supervisorControls || !targetSelect) return;

  const previouslySelected = targetSelect.value;

  targetSelect.innerHTML = "";

  // Opção para enviar para todos os atendentes logados
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Todos atendentes";
  targetSelect.appendChild(allOption);

  // Opções individuais para cada atendente logado
  attendantsRegistry.forEach((att, pa) => {
    const option = document.createElement("option");
    option.value = pa;
    option.textContent = `${att.name} (P.A ${att.pa})`;
    targetSelect.appendChild(option);
  });

  // Tenta manter a seleção anterior, ou selecionar o último atendente que enviou mensagem
  if (lastIncomingAttendantPA && attendantsRegistry.has(lastIncomingAttendantPA)) {
    targetSelect.value = lastIncomingAttendantPA;
  } else if (previouslySelected && (previouslySelected === "all" || attendantsRegistry.has(previouslySelected))) {
    targetSelect.value = previouslySelected;
  } else {
    targetSelect.value = "all";
  }
}

/**
 * Marca que a última mensagem recebida pela supervisão veio de um atendente específico.
 * Em um cenário real isso seria chamado quando uma mensagem de um atendente chegar no supervisor.
 */
function markLastIncomingFromAttendant(pa) {
  if (!pa) return;
  lastIncomingAttendantPA = pa;
  if (currentUser && currentUser.role === "supervisao") {
    populateSupervisorTargets();
  }
}

function applyRoleUI() {
  if (!selectedRole) {
    detailsSection.classList.add("hidden");
    supervisorPasswordSection.classList.add("hidden");
    supervisorPasswordInput.value = "";
    return;
  }

  detailsSection.classList.remove("hidden");

  if (selectedRole === "supervisao") {
    supervisorPasswordSection.classList.remove("hidden");
  } else {
    supervisorPasswordSection.classList.add("hidden");
    supervisorPasswordInput.value = "";
  }
}

function getSelectedRole() {
  return selectedRole || "atendente";
}

// Força o chat a aparecer em primeiro plano
function bringChatToFront() {
  chatOverlay.classList.remove("hidden");
  floatingChatBtn.classList.add("hidden");
}

// Minimizar / esconder janela do chat
function minimizeChat() {
  chatOverlay.classList.add("hidden");
  floatingChatBtn.classList.remove("hidden");
}

// Obter IP público e preencher P.A automaticamente
async function autoFillPA() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    if (!response.ok) throw new Error("Falha ao obter IP");
    const data = await response.json();
    const ip = data.ip || "";

    // Tenta usar o último octeto do IPv4 e extrair os 3 últimos dígitos
    const octets = ip.split(".");
    let paValue = "000";

    if (octets.length === 4) {
      const lastOctet = octets[octets.length - 1].replace(/\D/g, "");
      if (lastOctet) {
        const last3 = lastOctet.slice(-3);
        paValue = last3.padStart(3, "0");
      }
    } else {
      // Fallback genérico caso não seja um IPv4 padrão
      const digitsOnly = ip.replace(/\D/g, "");
      const last3 = digitsOnly.slice(-3);
      if (last3) {
        paValue = last3.padStart(3, "0");
      }
    }

    userPAInput.value = paValue;
  } catch (e) {
    userPAInput.value = "000";
  }
}

 // Cria uma mensagem na interface
function appendMessage(message, options = {}) {
  const { text, imageURL, type, metaLabel, timestamp } = message;
  const { save = true } = options;

  const usedTimestamp = timestamp || new Date().toISOString();

  const row = document.createElement("div");
  row.className = `message-row ${type}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (text) {
    const textNode = document.createElement("div");
    textNode.textContent = text;
    bubble.appendChild(textNode);
  }

  if (imageURL) {
    const img = document.createElement("img");
    img.className = "message-image";
    img.src = imageURL;
    img.alt = "Imagem enviada";
    bubble.appendChild(img);
  }

  const meta = document.createElement("div");
  meta.className = "message-meta";
  const timeLabel = formatTime(usedTimestamp);
  meta.textContent = `${metaLabel ? metaLabel + " • " : ""}${timeLabel}`;
  bubble.appendChild(meta);

  row.appendChild(bubble);
  messagesContainer.appendChild(row);

  // Rolagem para ver a última mensagem
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Persiste a mensagem no histórico/localStorage, se necessário
  if (save) {
    const storedMessage = {
      text: text || null,
      imageURL: imageURL || null,
      type: type || "received",
      metaLabel: metaLabel || "",
      timestamp: usedTimestamp
    };
    messagesHistory.push(storedMessage);
    saveMessages();
  }

  // Ao receber uma mensagem, colocar o chat em primeiro plano
  bringChatToFront();
}

function formatTime(timestamp) {
  try {
    const date = timestamp ? new Date(timestamp) : new Date();
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    messagesHistory = parsed;
    parsed.forEach((msg) => {
      appendMessage(msg, { save: false });
    });
  } catch (e) {
    console.error("Erro ao carregar mensagens:", e);
  }
}

function saveMessages() {
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messagesHistory));
  } catch (e) {
    console.error("Erro ao salvar mensagens:", e);
  }
}



 // Envio de mensagem
messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  const file = imageInput.files[0];

  if (!text && !file) {
    return;
  }

  let imageURL = null;
  if (file) {
    imageURL = URL.createObjectURL(file);
  }

  const role = currentUser?.role || getSelectedRole();
  let metaLabel = "";
  let toRole = "";
  let toPA = "";

  if (role === "supervisao") {
    const targetValue = targetSelect.value;
    if (targetValue === "all") {
      metaLabel = "Você → Todos atendentes";
      toRole = "atendente";
      toPA = "all";
    } else if (targetValue && attendantsRegistry.has(targetValue)) {
      const att = attendantsRegistry.get(targetValue);
      metaLabel = `Você → ${att.name} (P.A ${att.pa})`;
      toRole = "atendente";
      toPA = att.pa;
    } else {
      metaLabel = "Você → Atendente";
      toRole = "atendente";
      toPA = "all";
    }
  } else {
    // Atendente envia para supervisão; mensagem será recebida por todos supervisores logados
    metaLabel = "Você → Supervisão";
    toRole = "supervisao";
    toPA = "all";
  }

  appendMessage({
    text,
    imageURL,
    type: "sent",
    metaLabel
  });

  // Send message to other tabs
  sendMessageToOtherTabs({
    fromRole: role,
    fromPA: currentUser.pa,
    fromName: currentUser.name,
    toRole,
    toPA,
    text,
    imageURL
  });

  // Limpa campos
  messageInput.value = "";
  imageInput.value = "";
});

profileItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedRole = btn.dataset.role;
    profileItems.forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    applyRoleUI();
  });
});

// Início do chat após informar nome e P.A
startChatBtn.addEventListener("click", () => {
  const name = userNameInput.value.trim();
  const pa = userPAInput.value.trim();
  const role = getSelectedRole();

  if (!name) {
    userNameInput.focus();
    return;
  }

  if (role === "supervisao") {
    const enteredPassword = supervisorPasswordInput.value;
    if (enteredPassword !== SUPERVISOR_PASSWORD) {
      supervisorPasswordInput.value = "";
      supervisorPasswordInput.focus();
      return;
    }

    // Oculta o campo de senha após validação
    supervisorPasswordSection.classList.add("hidden");
    supervisorPasswordInput.value = "";

    // Configura opções de envio apenas para supervisão
    supervisorControls.classList.remove("hidden");
    populateSupervisorTargets();
  } else {
    supervisorControls.classList.add("hidden");
    targetSelect.innerHTML = "";
  }

  currentUser = { name, pa, role };

  if (role === "atendente") {
    registerAttendant(name, pa);
  } else if (role === "supervisao") {
    registerSupervisor(name, pa);
  }
  // Após entrar no chat, o cabeçalho mostra apenas nome e P.A
  chatUserLabel.textContent = `${name} • P.A ${pa}`;

  userSetup.classList.add("hidden");
  chatContent.classList.remove("hidden");

  appendMessage({
    text: `Olá, ${name}! Seu atendimento foi iniciado.`,
    imageURL: null,
    type: "received",
    metaLabel: "Sistema"
  });

  bringChatToFront();
});

// Minimizar chat
chatMinimizeBtn.addEventListener("click", () => {
  minimizeChat();
});

// Reabrir chat pelo botão flutuante
floatingChatBtn.addEventListener("click", () => {
  bringChatToFront();
});

// Inicialização
function init() {
  bringChatToFront();
  autoFillPA();
  applyRoleUI();
  loadMessages();
  setupStorageListener();
}

// Listen for messages from other tabs
function setupStorageListener() {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY_OUTGOING && e.newValue) {
      try {
        const message = JSON.parse(e.newValue);
        handleIncomingMessage(message);
      } catch (err) {
        console.error("Error parsing incoming message:", err);
      }
    }
  });
}

// Handle incoming messages from other tabs
function handleIncomingMessage(message) {
  if (!currentUser) return;

  const { fromRole, fromPA, fromName, toRole, toPA, text, imageURL, timestamp, id } = message;

  // Skip if this is our own message
  if (fromPA === currentUser.pa && fromRole === currentUser.role) {
    return;
  }

  let shouldReceive = false;
  let metaLabel = "";

  if (currentUser.role === "supervisao") {
    // Supervisors receive messages from attendants
    if (fromRole === "atendente") {
      shouldReceive = true;
      metaLabel = `${fromName} (P.A ${fromPA})`;
      // Mark this attendant as the last one to send a message
      markLastIncomingFromAttendant(fromPA);
      // Register the attendant if not already registered
      registerAttendant(fromName, fromPA);
    }
    // Supervisors also receive messages from other supervisors if targeted to them
    else if (fromRole === "supervisao" && toPA === currentUser.pa) {
      shouldReceive = true;
      metaLabel = `${fromName} (Supervisor)`;
    }
  } else if (currentUser.role === "atendente") {
    // Attendants receive messages from supervisors directed to them or to all
    if (fromRole === "supervisao" && (toPA === currentUser.pa || toPA === "all")) {
      shouldReceive = true;
      metaLabel = `${fromName} (Supervisor)`;
    }
  }

  if (shouldReceive) {
    appendMessage(
      {
        text,
        imageURL,
        type: "received",
        metaLabel,
        timestamp
      },
      { save: true }
    );
  }
}

// Send a message to other tabs via localStorage
function sendMessageToOtherTabs(messageData) {
  try {
    const messageWithId = {
      ...messageData,
      id: `${currentUser.pa}_${messageIdCounter++}`,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY_OUTGOING, JSON.stringify(messageWithId));
    // Clear it immediately so the same message can be sent again
    setTimeout(() => {
      localStorage.removeItem(STORAGE_KEY_OUTGOING);
    }, 100);
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

init();