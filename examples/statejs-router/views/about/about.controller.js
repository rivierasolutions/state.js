
export class AboutController extends HTMLElement {
    routeParams = {};
    connectedCallback() {
        this.routeParams = JSON.parse(this.getAttribute('state-route-params')) ?? {};
        this.addEventListener('StateLoaded', () => this.stateLoaded());
    }
    stateLoaded() {
        this.state.update({ about: `About content inserted by state.js. The residual path is: ${this.routeParams['*']}` });
    }
}