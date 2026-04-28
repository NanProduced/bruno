import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isGenerating: false,
  candidates: [],
  error: null,
  showPanel: false,
  originalBody: ''
};

const aiMockSlice = createSlice({
  name: 'aiMock',
  initialState,
  reducers: {
    startGeneration: (state, action) => {
      state.isGenerating = true;
      state.error = null;
      state.showPanel = true;
      state.originalBody = action.payload?.originalBody || '';
    },
    generationSuccess: (state, action) => {
      state.isGenerating = false;
      state.candidates = action.payload.candidates || [];
      state.error = null;
    },
    generationFailure: (state, action) => {
      state.isGenerating = false;
      state.error = action.payload.error;
    },
    addCandidate: (state, action) => {
      state.candidates.push(...(action.payload.candidates || []));
    },
    dismissPanel: (state) => {
      state.showPanel = false;
      state.candidates = [];
      state.error = null;
      state.originalBody = '';
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

export const {
  startGeneration,
  generationSuccess,
  generationFailure,
  addCandidate,
  dismissPanel,
  clearError
} = aiMockSlice.actions;

export default aiMockSlice.reducer;
