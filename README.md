# state.js

An HTML - javascript framework that re-introduces the MVC (Model-View-Controller) architectural pattern into modern web applications.

#### MVC
State.js follows the philosphy that even the simplest web application, like any other standalone application, features:
- a View (the HTML document),
- a Controller (the javascript code controlling the View)
- a Model (the javascript code defining content and processes relevant to the application).  

State.js handles interactions between the *View* and the *Controller*. Interactions between the *Controller* and the *Model* are **out of scope of this framewrok**.

#### The Passive View
State.js introduces the concept of a **Passive View** - A *View* that defines it's **layout** and **state**, but **does not define any logic**.  
All **logic** that controls how the *state* or *layout* of the *View* is transformed throughout it's lifecycle is **delegated to the Controller**,
and should be **decoupled and separate from the View**.

#### The View State: a View - Controller Contract

State.js introduces the **View State** - A JSON object defined in the *View*, that serves as a Contract between the *View* and the *Controller*. Hence:
- The *Controller* may implement crucial transformations of the *View's layout* required by the web application exclusively by updating the **View state**.
- The *View* may define crucial endpoints for *Controller* interaction exclusively by defining the **View State**.
- A UI/UX designer is able to develop and test the *View's layout* without a coupled *Controller* by manually modifying the **View State**
- A web developer is able to develop and test the *Controllers logic* without touching the *View's* layout, or by working on a stub View that definines an equivalent **View State**.



## Features

- Enables full decoupling of the View (HTML) from the Controller (javascript code) in web applications.
- Introduces the *view state* a contract between the View and the Controller, stored within the DOM tree in JSON format.
- The *view state* is defined within the View (HTML), using special HTML attribures, tags and JSONPath queries.
- The Controller (javascript code) may retrieve and update the *view state* at any time.
- Supports web components

## Installation

Install throught npm

```
npm install statejs
```

Or link the minified version directly

```
https://cdn.todo.com/statejs/lts/state.min.js
```

## Usage

Consider a basic View `index.html`...

```
<!doctype html>
<html lang="en">
    <head>
        <title>Hello state.js</title>
        <script src="/dist/state.min.js" defer></script>
        <script src="index.controller.js" defer></script>
    </head>
    <body>
        <h1 state-content="@.headerMessage">Hello</h1>
        <h2 state-if="@.showSubheader" state-content="@.subHeaderMessage"></h2>
        
        <button state-listen="@.onToggleSubheader">
            <state state-if="@.showSubheader">Hide subheader</state>
            <state state-if-not="@.showSubheader">Show subheader</state>
        </button>
    </body>
</html>
```

And a coupled Controller `index.controller.js`...

```
document.addEventListener('StateLoaded', () => {

    document.state.update({
        headerMessage: 'Hello World',
        showSubheader: false,
        subHeaderMessage: 'from state.js',
        onToggleSubheader: { 'click': toggleSubheader }
    });

    function toggleSubheader(event) {
        document.state.update({ showSubheader: !document.state.current().showSubheader }); 
    }
});
```
Based on the JSONPath queries defined in the special HTML attributes `state-content`, `state-if`, `state-if-not` and `state-listen`,
the **View State** of the *View* `index.html` is defined as:
```
{
    "headerMessage": "Hello",
    "showSubheader": false,
    "subHeaderMessage": "",
    "onToggleSubheader": {}
}
```
Once the **View State** is fully loaded and the `StateLoaded` event if dispatched from the `window.document` object,
the *Controller* index.controller.js may:
- retrieve the current **View State** by calling `document.state.current()`
- update the **View State** by calling `document.state.update(myNewState)`.

Notice how:
- The `state-if="@.showSubheader"` attribute enables adding or removing it's element from the DOM tree based on the truthiness of the `showSubheader` state field.
- The `state-content="@.subHeaderMessage"` attribute enables displaying text content in it's parent element based on the `subHeaderMessage` state field.
- The `state-listen="@.onToggleSubheader"` attribute enables attaching DOM event listeners to it's parent element based on the `onToggleSubheader` state field.

## View API

### `state-content="[JSONpath]"` (html attribute)

### `state-if="[JSONpath]"` (html attribute)

### `state-if-not="[JSONpath]"` (html attribute)

### `state-foreach="[JSONpath]"` (html attribute)

### `state-listen="[JSONpath]"` (html attribute)

### `state-attr-[name]="[JSONpath]"` (html attribute)

### `state-attr-[name]-if="[JSONpath]"` (html attribute)

### `state-attr-[name]-if-not="[JSONpath]"` (html attribute)

### `state-class-[name]-if="[JSONpath]"` (html attribute)

### `state-class-[name]="[JSONpath]"` (html attribute)

### `state-class-[name]-if-not="[JSONpath]"` (html attribute)

### `<state></state>` (html tag)

### `<state-compose tag="[tag]" src="[uri]"></state-compose>` (html tag)

### `state-pass="[JSONPath]"` (html attribute)

### `state-ignore` (html attribute)

### `state-scope="[JSONpath]"` (html attribute)

## Controller API

### `[element].state` (DOM element property)

### `[element].state.current()` (state object method)

### `[element].state.update(newState)` (state object method)

### `[element].state.scopeOf(element)` (state object method)

### `[element].state.create(element)` (state object method)

### `[element].state.contract(namespace, className, wrap)` (state object method)
