import { store, fetchInitialDataMock, incrementAndSaveMock, decrementAndSaveMock, selectCounterViewState, updateCounterViewState } from './store.js';

document.addEventListener('StateLoaded', () => {

    document.state.listener({
        handleIncrement: () => store.dispatch(incrementAndSaveMock()),
        handleDecrement: () => store.dispatch(decrementAndSaveMock()),
    });

    document.state.update({
        onIncrement: { 'click': 'handleIncrement' },
        onDecrement: { 'click': 'handleDecrement' }
    }, 'counter-controller');

    store.subscribe(() => {
        document.state.update(selectCounterViewState(store.getState()), 'counter-controller');
    });

    document.addEventListener('StateUpdated', (event) => {
        if (event.detail?.origin !== 'counter-controller') {
            store.dispatch(updateCounterViewState(document.state.current()));
        }
    });

    store.dispatch(fetchInitialDataMock());
});