/// <reference path="./index.html.d.ts" />

document.addEventListener('StateLoaded', () => {

    let number = 0;
    let itemIdSequence = 0;
    let subState = document.state;

    subState.listener({
        removeItem,
        buttonClicked,
        buttonClicked2,
        onToggleList
    });

    subState.update({ 
        stateArray: [
            { text: 'aaa', numberArray: [{ number: 111 }], onRemove: { 'click': 'removeItem', context: { id: ++itemIdSequence } } },
            { text: 'bbb', numberArray: [{ number: 222, numberClass: 'red' }], onRemove: { 'click': 'removeItem', context: { id: ++itemIdSequence } } }
        ],
        showList: true,
        onButtonClick: { 'click': 'buttonClicked' },
        onToggleList: { 'click': 'onToggleList' }
    });

    let contract = subState.contract();

    function buttonClicked() {
        subState.update({
            someText: `Lorem ipsum dolor sit amet ${++number}`,
            stateArray: subState.current().stateArray.concat([ { 
                text: 'added',
                numberArray: [{ number: 303, numberClass: 'red' }, { number: 404 }],
                onRemove: { 'click': 'removeItem', context: { id: ++itemIdSequence } },
                component: { componentContent: `created at: ${new Date().toISOString()}` },
            }])
        });
    }

    function buttonClicked2() {
        subState.update({
            someText: `This is a different event listener ${++number}`,
            stateArray: subState.current().stateArray.concat([ { 
                text: 'added',
                numberArray: [{ number: 303, numberClass: 'red' }, { number: 404 }],
                onRemove: { 'click': 'removeItem', context: { id: ++itemIdSequence } },
                component: { componentContent: `created at: ${new Date().toISOString()}` },
            }])
        });
    }

    function onToggleList() {
        subState.update({ showList: !subState.current().showList });
    }

    function removeItem(event, context) {
        subState.update({ stateArray: subState.current().stateArray.filter((o) => o.onRemove.context.id !== context.id) });
    }

    setInterval(() => subState.update({ 
        showMVC2: !subState.current().showMVC2,
        onButtonClick: { 'click': subState.current().showMVC2 ? 'buttonClicked' : 'buttonClicked2' },
        myComponentState: { componentContent: new Date().toISOString() }
    }), 2000);

    class MyComponent extends HTMLElement {
        connectedCallback() {
            this.addEventListener('StateLoaded', () => this.stateLoaded());
            this.addEventListener('StateUnloaded', () => this.stateUnloaded());
        }
        stateLoaded() {
            if (!this.state.current().componentContent) {
                this.state.update({ componentContent:  'Filled in by the component state!' });
            }
            this.interval = setInterval(() => this.state.update({ contentClass: this.state.current().contentClass ? null : 'red' }), 500);
        }
        stateUnloaded() {
            clearInterval(this.interval);
        }
    }
    customElements.define('app-my-component', MyComponent);
});