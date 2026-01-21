import { get, ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { database } from './firebase-config.js';
import { state, setSelectedRole, SUPERVISOR_PASSWORDS } from './state.js';
import * as UI from './ui.js';
import * as Auth from './auth.js';
import * as Chat from './chat.js';

// Init UI
UI.populatePASelect();
UI.showChatOverlay();

// Event Listeners

UI.elements.profileItems.forEach((item) => {
  item.addEventListener("click", () => {
    UI.elements.profileItems.forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    const role = item.dataset.role;
    setSelectedRole(role);
    
    UI.elements.detailsSection.classList.remove("hidden");

    if (role === "supervisao_civil") {
      UI.elements.supervisorPasswordSection.classList.remove("hidden");
      UI.elements.passwordHint.textContent = "Senha: SUPERCIV";
    } else if (role === "supervisao_militar") {
      UI.elements.supervisorPasswordSection.classList.remove("hidden");
      UI.elements.passwordHint.textContent = "Senha: SUPERMIL";
    } else if (role === "supervisao_cobom") {
      UI.elements.supervisorPasswordSection.classList.remove("hidden");
      UI.elements.passwordHint.textContent = "Senha: SUPERCOBOM";
    } else {
      UI.elements.supervisorPasswordSection.classList.add("hidden");
      UI.elements.passwordHint.textContent = "";
    }
  });
});

UI.elements.startChatBtn.addEventListener("click", async () => {
  const name = UI.elements.userNameInput.value.trim();
  const pa = UI.elements.userPAInput.value.trim();

  if (!state.selectedRole) {
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

  if (["supervisao_civil", "supervisao_militar", "supervisao_cobom"].includes(state.selectedRole)) {
    const password = UI.elements.supervisorPasswordInput.value.trim();
    if (password.toLowerCase() !== SUPERVISOR_PASSWORDS[state.selectedRole].toLowerCase()) {
      alert("Senha incorreta. A senha correta é: " + SUPERVISOR_PASSWORDS[state.selectedRole].toUpperCase());
      return;
    }
  }

  await Auth.enterChat(name, pa, state.selectedRole);
});

UI.elements.chatCloseBtn.addEventListener("click", Auth.logout);

UI.elements.clearChatBtn.addEventListener("click", () => {
  UI.clearMessages();
});

UI.elements.chatMinimizeBtn.addEventListener("click", UI.hideChatOverlay);
UI.elements.floatingChatBtn.addEventListener("click", UI.showChatOverlay);

UI.elements.messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = UI.elements.messageInput.value.trim().toUpperCase();
  const imageFile = UI.elements.imageInput.files[0];
  
  await Chat.sendMessage(text, imageFile);
  
  UI.elements.messageInput.value = "";
  UI.elements.imageInput.value = "";
});

if (UI.elements.resetFilterBtn) {
  UI.elements.resetFilterBtn.addEventListener("click", () => {
    UI.setChatFilter(null);
  });
}

// Auto-login check
window.addEventListener('load', async () => {
  const savedSession = localStorage.getItem('chatUserSession');
  if (savedSession) {
    try {
      const session = JSON.parse(savedSession);
      if (session.name && session.pa && session.role) {
        await Auth.enterChat(session.name, session.pa, session.role);
      }
    } catch (e) {
      console.error("Erro ao restaurar sessão:", e);
      localStorage.removeItem('chatUserSession');
    }
  }
});