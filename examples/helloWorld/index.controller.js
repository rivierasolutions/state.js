document.addEventListener('StateLoaded', () => {
    document.state.update({
        headerMessage: 'Hello World',
        onToggleSubheader: { 'click': toggleSubheader }
    });

    function toggleSubheader() {
    document.state.update({ showSubheader: !document.state.current().showSubheader }); 
    }
});