document.addEventListener('StateLoaded', () => {

    document.state.listener('toggleSubheader', toggleSubheader);

    document.state.update({
        headerMessage: 'Hello World',
        subHeaderMessage: 'from state.js',
        onToggleSubheader: { 'click': 'toggleSubheader' }
    });

    function toggleSubheader() {
        document.state.update({ showSubheader: !document.state.current().showSubheader }); 
    }
});