import { state } from './state.js';

export function isMessageExpired(timestamp) {
  if (!timestamp) return false;
  const twoHours = 2 * 60 * 60 * 1000;
  return (Date.now() - new Date(timestamp).getTime()) > twoHours;
}

export function isMessageRelevant(message) {
  if (isMessageExpired(message.timestamp)) return false;
  if (!state.currentUser) return false;

  const myPA = state.currentUser.pa;
  const myName = state.currentUser.name.toUpperCase();

  // 1. Sent by me
  if (message.from === myPA) {
    return message.fromName === myName;
  }

  // 2. Sent to me
  
  // Broadcast
  if (message.target === 'all') return true;

  // Targeted at my PA
  if (message.target === myPA) {
    if (message.targetName && message.targetName !== myName) {
      return false;
    }
    return true;
  }

  // Targeted at my Role
  if (["supervisao_civil", "supervisao_militar", "supervisao_cobom"].includes(state.currentUser.role)) {
     if (message.supervisorType === state.currentUser.role) return true;
  }

  return false;
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}