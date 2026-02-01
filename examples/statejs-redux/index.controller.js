import { store, fetchInitialDataMock, incrementAndSaveMock, decrementAndSaveMock, selectCounterViewState, updateCounterViewState } from './store.js';

function connect(viewStateRoot, store, selector, updater, updatesOrigin) {
    let lastStoreState = null;
    store.subscribe(() => {
        const nextState = selector(store.getState());
        if (nextState !== lastStoreState) {
            viewStateRoot.state.update(nextState, updatesOrigin);
        }
    });

    viewStateRoot.addEventListener('StateUpdated', (event) => {
        if (event.detail?.origin !== updatesOrigin) {
            store.dispatch(updater(document.state.current()));
        }
    });
}

document.addEventListener('StateLoaded', () => {

    document.state.listener({
        handleIncrement: () => store.dispatch(incrementAndSaveMock()),
        handleDecrement: () => store.dispatch(decrementAndSaveMock()),
    });

    document.state.update({
        onIncrement: { 'click': 'handleIncrement' },
        onDecrement: { 'click': 'handleDecrement' }
    }, 'counter-controller');

    connect(document, store, selectCounterViewState, updateCounterViewState, 'counter-controller');

    store.dispatch(fetchInitialDataMock());
});