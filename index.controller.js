document.addEventListener('StateLoaded', () => {

    let number = 0;

    let subState = document.state;
    subState.update({ 
        stateArray: [ 
            { text: 'aaa', numberArray: [{ number: 111 }], onRemove: { 'click': removeItem } },
            { text: 'bbb', numberArray: [{ number: 222, numberClass: 'red' }], onRemove: { 'click': removeItem } }
        ],
        showList: true,
        onButtonClick: { 'click': buttonClicked },
        onToggleList: { 'click': onToggleList }
    });

    let contract = subState.contract();

    function buttonClicked() {
        subState.update({
            someText: `Lorem ipsum dolor sit amet ${++number}`,
            stateArray: subState.current().stateArray.concat([ { 
                text: 'added',
                numberArray: [{ number: 303, numberClass: 'red' }, { number: 404 }],
                onRemove: { 'click': removeItem }
            }])
        });
    }

    function buttonClicked2() {
        subState.update({
            someText: `This is a different event listener ${++number}`,
            stateArray: subState.current().stateArray.concat([ { 
                text: 'added',
                numberArray: [{ number: 303, numberClass: 'red' }, { number: 404 }],
                onRemove: { 'click': removeItem }
            }])
        });
    }

    function onToggleList() {
        subState.update({ showList: !subState.current().showList });
    }

    function removeItem(event) {
        const toRemove = subState.scopeOf(event.target).$index;
        subState.update({ stateArray: subState.current().stateArray.filter((o,i) => i !== toRemove) });
    }

    setInterval(() => subState.update({ 
        showMVC2: !subState.current().showMVC2,
        buttonClass: subState.current().showMVC2 ? 'red' : '',
        onButtonClick: { 'click': subState.current().showMVC2 ? buttonClicked : buttonClicked2 }
    }), 2000);

    class MyComponent extends HTMLElement {
        connectedCallback() {
            this.state.update({ componentContent: 'Filled in by the component state!' });
            setInterval(() => this.state.update({ contentClass: this.state.current().contentClass ? null : 'red' }), 500);
        }
    }
    customElements.define('app-my-component', MyComponent);
});