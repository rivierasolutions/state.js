
export class HomeController extends HTMLElement {
    connectedCallback() {
        this.addEventListener('StateLoaded', () => this.stateLoaded())
    }
    stateLoaded() {
        this.state.update({ home: "Home content inserted by state.js" });
    }
}