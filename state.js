export const SUPERVISOR_PASSWORDS = {
  supervisao_civil: "superciv",
  supervisao_militar: "supermil",
  supervisao_cobom: "supercobom"
};

export const state = {
  currentUser: null,
  selectedRole: null,
  activeUsers: {},
  messagesHistory: [],
  isFirstLoad: true,
  usersUnsubscribe: null,
  messagesUnsubscribe: null,
  chatFilter: null, // PA of the user we are currently replying to
  conversations: new Set() // Set of PAs interacting with supervisor
};

export function setChatFilter(pa) {
  state.chatFilter = pa;
}

export function setCurrentUser(user) {
  state.currentUser = user;
}

export function setSelectedRole(role) {
  state.selectedRole = role;
}

export function setActiveUsers(users) {
  state.activeUsers = users || {};
}