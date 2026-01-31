import { store, fetchInitialDataMock, updateCounterOnServerMock, selectCounterViewState } from './store.js';

document.addEventListener('StateLoaded', () => {

    document.state.listener({
        handleIncrement: () => store.dispatch(updateCounterOnServerMock((store.getState().counter.value) + 1)),
        handleDecrement: () => store.dispatch(updateCounterOnServerMock((store.getState().counter.value) - 1)),
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