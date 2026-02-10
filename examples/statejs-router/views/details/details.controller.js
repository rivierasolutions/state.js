
export class DetailsController extends HTMLElement {
    routeParams = {}
    connectedCallback() {
        this.routeParams = JSON.parse(this.getAttribute('state-route-params')) ?? {};
        this.addEventListener('StateLoaded', () => this.stateLoaded())
    }
    stateLoaded() {
        this.state.update({ details: `Details content inserted by state.js, your route param was: ${this.routeParams.text ?? ''}` });
    }
}