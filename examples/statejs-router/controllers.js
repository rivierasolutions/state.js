import { HomeController } from "./views/home/home.controller.js";
import { DetailsController } from "./views/details/details.controller.js";
import { AboutController } from "./views/about/about.controller.js";

document.addEventListener('StateLoaded', () => {

    window.customElements.define('app-home', HomeController);
    window.customElements.define('app-details', DetailsController);
    window.customElements.define('app-about', AboutController);
});