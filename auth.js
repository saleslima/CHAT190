import { set, get, remove, onDisconnect, query, onValue, ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { database, usersRef } from './firebase-config.js';
import { state, setCurrentUser, setActiveUsers } from './state.js';
import * as UI from './ui.js';
import { setupFirebaseListener, displayRelevantMessages } from './chat.js';

export function setupUsersListener() {
  const usersQuery = query(usersRef);
  state.usersUnsubscribe = onValue(usersQuery, (snapshot) => {
    setActiveUsers(snapshot.val());
    UI.updateTargetSelect();
  });
}

export async function enterChat(name, pa, role) {
  setCurrentUser({ name, pa, role });
  state.selectedRole = role; // ensuring consistency with state

  localStorage.setItem('chatUserSession', JSON.stringify({ name, pa, role }));

  const userRef = ref(database, `users/${pa}`);
  await set(userRef, {
    name,
    role,
    loginTime: Date.now()
  });
  
  onDisconnect(userRef).remove();
  
  window.addEventListener('beforeunload', () => {
    remove(userRef);
  });

  const roleLabel = UI.formatRole(role);
  UI.elements.chatUserLabel.textContent = `P.A: ${pa} • ${name} • ${roleLabel}`;

  UI.elements.userSetup.classList.add("hidden");
  UI.elements.chatContent.classList.remove("hidden");
  UI.elements.clearChatBtn.classList.remove("hidden");
  UI.elements.supervisorPasswordSection.classList.add("hidden");

  if (["supervisao_civil", "supervisao_militar", "supervisao_cobom"].includes(role)) {
    UI.elements.supervisorControls.classList.remove("hidden");
    UI.elements.atendenteControls.classList.add("hidden");
    setupUsersListener(); 
  } else if (role === "atendente") {
    UI.elements.supervisorControls.classList.add("hidden");
    UI.elements.atendenteControls.classList.remove("hidden");
  }

  UI.showChatOverlay();
  displayRelevantMessages();
  setupFirebaseListener();
}

export function logout() {
  localStorage.removeItem('chatUserSession');

  if (state.currentUser) {
    try {
      remove(ref(database, `users/${state.currentUser.pa}`));
    } catch(e) { console.error(e); }
  }
  
  if (state.usersUnsubscribe) {
    state.usersUnsubscribe();
    state.usersUnsubscribe = null;
  }
  if (state.messagesUnsubscribe) {
    state.messagesUnsubscribe();
    state.messagesUnsubscribe = null;
  }
  
  setActiveUsers({});
  setCurrentUser(null);
  state.selectedRole = null;
  state.messagesHistory = [];
  state.isFirstLoad = true;
  
  UI.elements.chatUserLabel.textContent = "";
  UI.resetLoginForm();
  
  UI.elements.chatContent.classList.add("hidden");
  UI.elements.userSetup.classList.remove("hidden");
  UI.elements.clearChatBtn.classList.add("hidden");
  UI.elements.detailsSection.classList.add("hidden");
  UI.elements.supervisorPasswordSection.classList.add("hidden");
  
  UI.showChatOverlay();
}