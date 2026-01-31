import { store, fetchInitialDataMock, incrementAndSaveMock, decrementAndSaveMock, selectCounterViewState } from './store.js';

document.addEventListener('StateLoaded', () => {

    document.state.listener({
        handleIncrement: () => store.dispatch(incrementAndSaveMock()),
        handleDecrement: () => store.dispatch(decrementAndSaveMock()),
    });

    document.state.update({
        onIncrement: { 'click': 'handleIncrement' },
        onDecrement: { 'click': 'handleDecrement' }
    });

    store.subscribe(() => {
        document.state.update(selectCounterViewState(store.getState()));
    });

    store.dispatch(fetchInitialDataMock());
});