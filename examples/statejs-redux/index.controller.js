import { store, increment, decrement, selectCounterViewState } from './store.js';

document.addEventListener('StateLoaded', () => {

    document.state.listener({
        handleIncrement: () => store.dispatch(increment()),
        handleDecrement: () => store.dispatch(decrement())
    });

    document.state.update({
        onIncrement: { 'click': 'handleIncrement' },
        onDecrement: { 'click': 'handleDecrement' }
    });

    store.subscribe(() => {
        document.state.update(selectCounterViewState(store.getState()))
    });
});