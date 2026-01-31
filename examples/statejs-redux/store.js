import { configureStore, createSlice, createSelector, createAsyncThunk } from '@reduxjs/toolkit';

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const fetchInitialDataMock = createAsyncThunk('counter/fetch', async () => {
    await delay(500);
    const data = localStorage.getItem('app_counter_data');
    return data ? JSON.parse(data) : { value: 0, lastUpdated: null };
});

export const updateCounterOnServerMock = createAsyncThunk('counter/update', async (newValue) => {
    await delay(500);
    const result = {
        value: newValue,
        lastUpdated: new Date().toLocaleTimeString()
    };
    localStorage.setItem('app_counter_data', JSON.stringify(result));
    return result;
});

const counterSlice = createSlice({
  name: 'counter',
  initialState: {
    value: 0,
    status: 'idle',
    lastUpdated: null
  },
  extraReducers: (builder) => {
    builder
        .addCase(fetchInitialDataMock.pending, (state) => { state.status = 'loading'; })
        .addCase(fetchInitialDataMock.fulfilled, (state,action) => { 
            state.status = 'idle'; 
            state.value = action.payload.value;
            state.lastUpdated = action.payload.lastUpdated;
        })
        .addCase(updateCounterOnServerMock.pending, (state) => { state.status = 'updating'; })
        .addCase(updateCounterOnServerMock.fulfilled, (state,action) => {
            state.status = 'idle';
            state.value = action.payload.value;
            state.lastUpdated = action.payload.lastUpdated;
        });
  }
});

const selectCounterBase = (state) => state.counter;

export const selectCounterViewState = createSelector(
    [selectCounterBase],
    (counter) => ({
        countDisplay: counter.value,
        timestamp: counter.lastUpdated,
        isLoading: counter.status !== 'idle'
    })
);

export const { increment, decrement, reset } = counterSlice.actions;

export const store = configureStore({
  reducer: {
    counter: counterSlice.reducer
  }
});