import { createSlice } from '@reduxjs/toolkit';

import { readStoredPromoBannersVisible } from './homeUiStorage.js';

const homeUiSlice = createSlice({
  name: 'homeUi',
  initialState: {
    arePromoBannersVisible: readStoredPromoBannersVisible(),
  },
  reducers: {
    setPromoBannersVisible(state, action) {
      state.arePromoBannersVisible = Boolean(action.payload);
    },
  },
});

export const { setPromoBannersVisible } = homeUiSlice.actions;

export const selectPromoBannersVisible = state => state.homeUi.arePromoBannersVisible;

export default homeUiSlice.reducer;
