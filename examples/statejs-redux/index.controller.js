import { store, increment, decrement } from './store.js';

document.addEventListener('StateLoaded', () => {

    document.state.listener({
        handleIncrement: () => store.dispatch(increment()),
        handleDecrement: () => store.dispatch(decrement())
    });

    document.state.update({
        countDisplay: store.getState().counter.value,
        timestamp: 'No activity yet',
        onIncrement: { 'click': 'handleIncrement' },
        onDecrement: { 'click': 'handleDecrement' }
    });

    store.subscribe(() => {
        const reduxState = store.getState().counter;
        
        document.state.update({
            countDisplay: reduxState.value,
            timestamp: reduxState.lastUpdated
        });
        
        console.log('View State synchronized with Redux');
    });
});