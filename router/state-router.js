
document.addEventListener("StateLoaded", () => {

    function matchRoute(allRoutes, pathname) {
        for (const r of allRoutes) {
            const match = pathname.match(r.pattern);
            if (match) {
                const params = [...r.path.matchAll(/:([^\/]+)|(\*)/g)]
                    .map(k => k[1] || k[2])
                    .reduce((obj, key, index) => {
                        obj[key] = match[index + 1];
                        return obj;
                    }, {});
                return { nextRoute: r, params };
            }
        }
        return { nextRoute: undefined, params: undefined };
    }

    const allRoutes = [];
    const allContentNodes = [];

    function navigate(allRoutes, allContentNodes) {
        const { nextRoute, params } = matchRoute(allRoutes, window.location.pathname);
        if (!nextRoute) {
            return;
        }
        window.history.pushState({}, '', window.location.pathname);
        allContentNodes.forEach(el => {
            el.innerHTML = "";
            const view = document.createElement(nextRoute.tag);
            view.setAttribute('state-route-params', JSON.stringify(params));
            el.appendChild(view);
            document.state.create(el);
        });
    }

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a');

        if (link && link.href.startsWith(window.location.origin)) {
            event.preventDefault();
            window.history.pushState({}, '', link.getAttribute('href'));
            navigate(allRoutes, allContentNodes);
        }
    });

    window.addEventListener("popstate", () => navigate(allRoutes, allContentNodes));

    class StateRouterElement extends HTMLElement {
        connectedCallback() {
            const routes = Array.from(this.querySelectorAll("state-route"))
                .map(el => ({
                    path: el.getAttribute("path"),
                    pattern: new RegExp(`^${el.getAttribute("path").replace(/\//g, '\\/').replace(/:[^\/]+/g, '([^\\/]+)').replace(/\*/g, '(.*)')}\\/?$`, 'i'),
                    tag: el.getAttribute("tag") 
                }));

            allRoutes.push(...routes);
            const contentNodes = Array.from(this.querySelectorAll("state-route-content"));
            allContentNodes.push(...contentNodes);

            navigate(allRoutes, contentNodes);
        }
    }
    window.customElements.define('state-router', StateRouterElement);
});