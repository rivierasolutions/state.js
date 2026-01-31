import { configureStore, createSlice, createSelector } from '@reduxjs/toolkit';

const counterSlice = createSlice({
  name: 'counter',
  initialState: {
    value: 0,
    status: 'idle',
    lastUpdated: null
  },
  reducers: {
    increment: (state) => {
      state.value += 1;
      state.lastUpdated = new Date().toLocaleTimeString();
    },
    decrement: (state) => {
      state.value -= 1;
      state.lastUpdated = new Date().toLocaleTimeString();
    },
    reset: (state) => {
      state.value = 0;
    }
  }
});

const selectCounterBase = (state) => state.counter;

export const selectCounterViewState = createSelector(
    [selectCounterBase],
    (counter) => ({
        countDisplay: counter.value,
        timestamp: counter.lastUpdated
    })
);

export const { increment, decrement, reset } = counterSlice.actions;

export const store = configureStore({
  reducer: {
    counter: counterSlice.reducer
  }
});