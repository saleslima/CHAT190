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
const SUPERVISOR_PASSWORD = "superv190cop";
let lastIncomingAttendantPA = null;

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
 * Popula o combo de destinos da supervisão com "Todos atendentes"
 * e a lista de atendentes logados.
 */
function populateSupervisorTargets() {
  if (!supervisorControls || !targetSelect) return;

  targetSelect.innerHTML = "";

  // Para supervisão, apenas a opção "Todos atendentes" deve ficar disponível
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Todos atendentes";
  targetSelect.appendChild(allOption);
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
function appendMessage({ text, imageURL, type, metaLabel }) {
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
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  meta.textContent = `${metaLabel ? metaLabel + " • " : ""}${hh}:${mm}`;
  bubble.appendChild(meta);

  row.appendChild(bubble);
  messagesContainer.appendChild(row);

  // Rolagem para ver a última mensagem
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Ao receber uma mensagem, colocar o chat em primeiro plano
  bringChatToFront();
}

 // Simula uma resposta do sistema para mostrar "mensagem recebida"
function simulateReply() {
  setTimeout(() => {
    appendMessage({
      text: "Mensagem recebida.",
      imageURL: null,
      type: "received",
      metaLabel: "Sistema"
    });
  }, 600);
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

  if (role === "supervisao") {
    const targetValue = targetSelect.value || "all";
    if (targetValue === "all") {
      metaLabel = "Você → Todos atendentes";
    } else if (attendantsRegistry.has(targetValue)) {
      const att = attendantsRegistry.get(targetValue);
      metaLabel = `Você → ${att.name} (P.A ${att.pa})`;
    } else {
      metaLabel = "Você → Atendente";
    }
  } else {
    metaLabel = "Você → Supervisão";
    if (currentUser?.pa) {
      markLastIncomingFromAttendant(currentUser.pa);
    }
  }

  appendMessage({
    text,
    imageURL,
    type: "sent",
    metaLabel
  });

  // Limpa campos
  messageInput.value = "";
  imageInput.value = "";

  // Simula mensagem recebida para que a janela suba em primeiro plano
  simulateReply();
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
}

init();