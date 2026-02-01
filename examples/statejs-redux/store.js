import { configureStore, createSlice, createSelector, createAsyncThunk } from '@reduxjs/toolkit';

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const fetchInitialDataMock = createAsyncThunk('counter/fetch', async () => {
    await delay(500);
    const data = localStorage.getItem('app_counter_data');
    return data ? JSON.parse(data) : { value: 0, lastUpdated: null, comment: "" };
});

const updateCounterOnServerMock = createAsyncThunk('counter/update', async (newValue) => {
    await delay(500);
    const result = {
        value: newValue.count,
        lastUpdated: new Date().toLocaleTimeString(),
        comment: newValue.comment
    };
    localStorage.setItem('app_counter_data', JSON.stringify(result));
    return result;
});

export const incrementAndSaveMock = createAsyncThunk(
    'counter/incrementAndSave',
    async (_, { getState, dispatch }) => {
        const currentValue = getState().counter.value;
        const comment = getState().counter.comment;
        
        return dispatch(updateCounterOnServerMock({ count: currentValue + 1, comment })).unwrap();
    }
);

export const decrementAndSaveMock = createAsyncThunk(
    'counter/decrementAndSave',
    async (_, { getState, dispatch }) => {
        const currentValue = getState().counter.value;
        const comment = getState().counter.comment;
        return dispatch(updateCounterOnServerMock({ count: currentValue - 1, comment })).unwrap();
    }
);

const counterSlice = createSlice({
  name: 'counter',
  initialState: {
    value: 0,
    status: 'idle',
    lastUpdated: null,
    comment: ""
  },
  reducers: {
    updateCounterViewState: (state, action) => {
        state.comment = action.payload.comment;
    }
  },
  extraReducers: (builder) => {
    builder
        .addCase(fetchInitialDataMock.pending, (state) => { state.status = 'loading'; })
        .addCase(fetchInitialDataMock.fulfilled, (state,action) => { 
            state.status = 'idle'; 
            state.value = action.payload.value;
            state.comment = action.payload.comment;
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

export const { updateCounterViewState } = counterSlice.actions;

export const selectCounterViewState = createSelector(
    [selectCounterBase],
    (counter) => ({
        countDisplay: counter.value,
        comment: counter.comment,
        timestamp: counter.lastUpdated,
        isLoading: counter.status !== 'idle'
    })
);

export const store = configureStore({
  reducer: {
    counter: counterSlice.reducer
  }
});