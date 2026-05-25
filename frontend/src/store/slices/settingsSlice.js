import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { settingsAPI } from '../../services/api';

export const fetchSettings = createAsyncThunk('settings/fetch', async () => {
  const res = await settingsAPI.get();
  return res.data.data;
});

const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    aiChatbotEnabled: true,
    loaded: false,
  },
  reducers: {
    applySettingsUpdate: (state, action) => {
      if (action.payload.aiChatbotEnabled !== undefined) {
        state.aiChatbotEnabled = action.payload.aiChatbotEnabled;
      }
      state.loaded = true;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchSettings.fulfilled, (state, action) => {
      state.aiChatbotEnabled = action.payload.aiChatbotEnabled;
      state.loaded = true;
    });
  },
});

export const { applySettingsUpdate } = settingsSlice.actions;

export const selectAiChatbotEnabled = (state) => state.settings.aiChatbotEnabled;
export const selectSettingsLoaded   = (state) => state.settings.loaded;

export default settingsSlice.reducer;
