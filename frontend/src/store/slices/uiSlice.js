import { createSlice } from '@reduxjs/toolkit';

// Read persisted preference; default to dark so existing users see no change
const savedTheme = localStorage.getItem('theme') || 'dark';

// Apply immediately before first render so there's no flash
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen:    true,
    theme:          savedTheme,
    chatbotOpen:    false,
    chatbotAppType: 'other',
  },
  reducers: {
    toggleSidebar:  (state) => { state.sidebarOpen = !state.sidebarOpen; },
    setSidebarOpen: (state, action) => { state.sidebarOpen = action.payload; },

    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', state.theme);
      if (state.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    },

    toggleChatbot:    (state) => { state.chatbotOpen = !state.chatbotOpen; },
    setChatbotOpen:   (state, action) => { state.chatbotOpen   = action.payload; },
    setChatbotAppType:(state, action) => { state.chatbotAppType = action.payload; },
  },
});

export const {
  toggleSidebar, setSidebarOpen,
  toggleTheme,
  toggleChatbot, setChatbotOpen,
  setChatbotAppType,
} = uiSlice.actions;

export const selectSidebarOpen    = (state) => state.ui.sidebarOpen;
export const selectTheme          = (state) => state.ui.theme;
export const selectChatbotOpen    = (state) => state.ui.chatbotOpen;
export const selectChatbotAppType = (state) => state.ui.chatbotAppType;

export default uiSlice.reducer;
