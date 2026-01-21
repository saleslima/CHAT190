import { push, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { messagesRef } from './firebase-config.js';
import { state } from './state.js';
import * as UI from './ui.js';
import { isMessageRelevant, isMessageExpired, fileToBase64 } from './utils.js';

export function displayRelevantMessages() {
  UI.clearMessages();
  state.messagesHistory.forEach((message) => {
    if (isMessageRelevant(message)) {
      // Filter logic for Supervisors in specific chat mode
      if (state.chatFilter) {
        // Show only messages involving the selected PA
        // Either Sent BY filtered PA, or Sent TO filtered PA
        const isFromFilter = message.from === state.chatFilter;
        const isToFilter = message.target === state.chatFilter;
        
        if (isFromFilter || isToFilter) {
          UI.displayMessage(message);
        }
      } else {
        // Show all
        UI.displayMessage(message);
      }
    }
  });
}

export function setupFirebaseListener() {
  if (state.messagesUnsubscribe) state.messagesUnsubscribe();

  const messagesQuery = query(messagesRef, limitToLast(100));
  
  state.messagesUnsubscribe = onValue(messagesQuery, (snapshot) => {
    if (!state.currentUser) return;
    
    const messages = [];
    snapshot.forEach((childSnapshot) => {
      messages.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    
    const validMessages = messages.filter(msg => !isMessageExpired(msg.timestamp));
    state.messagesHistory = validMessages;

    // Update Conversation Queue (Supervisors only)
    if (['supervisao_civil', 'supervisao_militar', 'supervisao_cobom'].includes(state.currentUser.role)) {
       const activePAs = new Set();
       validMessages.forEach(msg => {
         // Determine the "other" party
         if (isMessageRelevant(msg)) {
            if (msg.from !== state.currentUser.pa) {
              // Incoming message from user
              activePAs.add(msg.from);
            } else if (msg.target && msg.target !== 'all' && msg.target !== state.currentUser.pa) {
              // Outgoing message to specific user
              activePAs.add(msg.target);
            }
         }
       });
       state.conversations = activePAs;
       UI.updateConversationQueue();
    }

    // Refresh Display
    displayRelevantMessages();
    
    // Notifications for new messages
    if (!state.isFirstLoad) {
       const recentMessage = validMessages[validMessages.length - 1];
       // If valid, relevant, and not from me
       if (recentMessage && 
           recentMessage.from !== state.currentUser.pa && 
           isMessageRelevant(recentMessage) && 
           !state.messagesHistory.some(m => m.id === recentMessage.id && m.id.startsWith('temp_'))) {
           
           UI.showChatOverlay();
       }
    }
    state.isFirstLoad = false;
  });
}

export async function sendMessage(text, imageFile) {
  let imageData = null;

  if (imageFile) {
    imageData = await fileToBase64(imageFile);
  }

  if (!text && !imageData) return;

  const messageData = {
    from: state.currentUser.pa,
    fromName: state.currentUser.name.toUpperCase(),
    fromRole: state.currentUser.role,
    text: text || "",
    image: imageData,
  };

  // Supervisor target logic
  if (["supervisao_civil", "supervisao_militar", "supervisao_cobom"].includes(state.currentUser.role)) {
    if (!UI.elements.targetSelect.value) {
      alert("Selecione um destinatário.");
      return;
    }
    messageData.target = UI.elements.targetSelect.value;
    
    if (messageData.target !== 'all' && state.activeUsers[messageData.target]) {
      messageData.targetName = state.activeUsers[messageData.target].name.toUpperCase();
    }
  } else if (state.currentUser.role === "atendente") {
    messageData.supervisorType = UI.elements.supervisorTypeSelect.value;
  }

  // Temp display
  const messageWithId = {
    ...messageData,
    id: `temp_${Date.now()}`,
    timestamp: new Date().toISOString()
  };
  
  UI.displayMessage(messageWithId);
  state.messagesHistory.push(messageWithId);
  
  try {
    const msgToSend = {
      ...messageData,
      timestamp: new Date().toISOString()
    };
    await push(messagesRef, msgToSend);
    console.log("Mensagem enviada");
  } catch (err) {
    console.error("Falha ao enviar mensagem:", err);
    alert("Erro ao enviar mensagem.");
  }
}