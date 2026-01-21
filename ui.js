import { state } from './state.js';

// DOM Elements
export const elements = {
  chatOverlay: document.getElementById("chat-overlay"),
  floatingChatBtn: document.getElementById("floatingChatBtn"),
  chatMinimizeBtn: document.getElementById("chatMinimizeBtn"),
  clearChatBtn: document.getElementById("clearChatBtn"),
  chatCloseBtn: document.getElementById("chatCloseBtn"),
  userSetup: document.getElementById("userSetup"),
  chatContent: document.getElementById("chatContent"),
  detailsSection: document.getElementById("detailsSection"),
  supervisorPasswordSection: document.getElementById("supervisorPasswordSection"),
  userPAInput: document.getElementById("userPA"),
  userNameInput: document.getElementById("userName"),
  supervisorPasswordInput: document.getElementById("supervisorPassword"),
  profileItems: document.querySelectorAll(".profile-item"),
  startChatBtn: document.getElementById("startChatBtn"),
  messagesContainer: document.getElementById("messagesContainer"),
  messageForm: document.getElementById("messageForm"),
  messageInput: document.getElementById("messageInput"),
  imageInput: document.getElementById("imageInput"),
  supervisorControls: document.getElementById("supervisorControls"),
  atendenteControls: document.getElementById("atendenteControls"),
  targetSelect: document.getElementById("targetSelect"),
  supervisorTypeSelect: document.getElementById("supervisorTypeSelect"),
  chatUserLabel: document.getElementById("chatUserLabel"),
  passwordHint: document.getElementById("passwordHint"),
  conversationQueue: document.getElementById("conversationQueue"),
  resetFilterBtn: document.getElementById("resetFilterBtn")
};

export function showChatOverlay() {
  elements.chatOverlay.classList.remove("hidden");
  elements.floatingChatBtn.classList.add("hidden");
}

export function hideChatOverlay() {
  elements.chatOverlay.classList.add("hidden");
  elements.floatingChatBtn.classList.remove("hidden");
}

export function clearMessages() {
  elements.messagesContainer.innerHTML = "";
}

export function formatRole(role) {
  if (role === 'atendente') return 'Atendente';
  if (role === 'supervisao_civil') return 'Sup. Civil';
  if (role === 'supervisao_militar') return 'Sup. Militar';
  if (role === 'supervisao_cobom') return 'Sup. COBOM';
  return role;
}

export function displayMessage(message) {
  if (!state.currentUser) return;
  
  const isSent = message.from === state.currentUser.pa;
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
  if (!isSent && ["supervisao_civil", "supervisao_militar", "supervisao_cobom"].includes(state.currentUser.role)) {
    messageBubble.style.cursor = 'pointer';
    messageBubble.title = 'Clique para responder a este usuário';
    messageBubble.addEventListener('click', () => {
       setChatFilter(message.from);
       elements.messageInput.focus();
    });
  }

  messageRow.appendChild(messageBubble);
  elements.messagesContainer.appendChild(messageRow);
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

export function populatePASelect() {
  elements.userPAInput.innerHTML = '<option value="" disabled selected>Selecione o P.A</option>';
  for (let i = 1; i <= 208; i++) {
    const val = i.toString().padStart(3, '0');
    const option = document.createElement('option');
    option.value = val;
    option.textContent = `P.A ${val}`;
    elements.userPAInput.appendChild(option);
  }
}

export function updateTargetSelect() {
  if (!state.currentUser || !['supervisao_civil', 'supervisao_militar', 'supervisao_cobom'].includes(state.currentUser.role)) return;
  
  // If we are locked to a filter, don't rebuild significantly or lose value
  const currentVal = elements.targetSelect.value;
  elements.targetSelect.innerHTML = '<option value="" disabled selected>Selecione...</option>';
  
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = '📣 ENVIAR PARA TODOS';
  elements.targetSelect.appendChild(allOption);
  
  Object.keys(state.activeUsers).sort().forEach(paKey => {
     if (paKey === state.currentUser.pa) return;
     
     const user = state.activeUsers[paKey];
     const option = document.createElement('option');
     option.value = paKey;
     option.textContent = `P.A ${paKey} - ${user.name} (${formatRole(user.role)})`;
     elements.targetSelect.appendChild(option);
  });
  
  if (state.chatFilter) {
    // Ensure the filtered user is available in the dropdown even if offline
    if (!elements.targetSelect.querySelector(`option[value="${state.chatFilter}"]`)) {
       const option = document.createElement('option');
       option.value = state.chatFilter;
       option.textContent = `P.A ${state.chatFilter}`;
       elements.targetSelect.appendChild(option);
    }
    elements.targetSelect.value = state.chatFilter;
    elements.targetSelect.disabled = true;
  } else {
    elements.targetSelect.disabled = false;
    if (currentVal && elements.targetSelect.querySelector(`option[value="${currentVal}"]`)) {
      elements.targetSelect.value = currentVal;
    }
  }
}

export function updateConversationQueue() {
  if (!state.currentUser || !['supervisao_civil', 'supervisao_militar', 'supervisao_cobom'].includes(state.currentUser.role)) return;

  const queueContainer = elements.conversationQueue;
  queueContainer.innerHTML = '';
  
  if (state.conversations.size === 0) {
    queueContainer.innerHTML = '<span style="font-size:11px; color:#999; padding:4px;">Nenhuma conversa recente</span>';
    return;
  }

  state.conversations.forEach(pa => {
    const btn = document.createElement('button');
    btn.className = `queue-item ${state.chatFilter === pa ? 'active' : ''}`;
    btn.textContent = `P.A ${pa}`;
    btn.title = `Abrir conversa com P.A ${pa}`;
    
    btn.onclick = () => {
      setChatFilter(pa);
    };
    
    queueContainer.appendChild(btn);
  });
}

export function setChatFilter(pa) {
  state.chatFilter = pa;
  
  if (pa) {
    // Reply Mode
    elements.resetFilterBtn.classList.remove('hidden');
    
    // Ensure option exists before setting value (for offline users)
    if (!elements.targetSelect.querySelector(`option[value="${pa}"]`)) {
       const option = document.createElement('option');
       option.value = pa;
       option.textContent = `P.A ${pa}`;
       elements.targetSelect.appendChild(option);
    }

    elements.targetSelect.value = pa;
    elements.targetSelect.disabled = true;
    
    // Highlight in queue
    Array.from(elements.conversationQueue.children).forEach(child => {
      if (child.textContent.includes(pa)) child.classList.add('active');
      else child.classList.remove('active');
    });

  } else {
    // Initiate Mode
    elements.resetFilterBtn.classList.add('hidden');
    elements.targetSelect.disabled = false;
    elements.targetSelect.value = ""; // Reset selection
    
    Array.from(elements.conversationQueue.children).forEach(child => {
       child.classList.remove('active');
    });
  }
  
  // Refresh messages to show only filtered
  import('./chat.js').then(module => {
    module.displayRelevantMessages();
  }).catch(err => console.error("Failed to refresh messages:", err));
}

export function resetLoginForm() {
  elements.userNameInput.value = "";
  elements.supervisorPasswordInput.value = "";
  elements.messageInput.value = "";
  elements.userPAInput.value = "";
  elements.profileItems.forEach(item => item.classList.remove("active"));
}