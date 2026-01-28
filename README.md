# state.js

An HTML - javascript framework that re-introduces the MVC (Model-View-Controller) architectural pattern into modern web applications.

## Features

#### MVC
State.js follows the philosphy that even the simplest web application, like any other standalone application, features:
- a View (the HTML document),
- a Controller (the javascript code controlling the View)
- a Model (the javascript code defining content and processes relevant to the application).  

State.js handles interactions between the *View* and the *Controller*. Interactions between the *Controller* and the *Model*
may be sufficiently handled by existing frameworks (e.g. *Redux* for complex cases) or custom javascript code (for simple cases),
and are thus **out of scope of this framewrok**.

#### The Passive View
State.js introduces the concept of a **Passive View** - A *View* defined only by it's **layout** and **state**, which specifically **does not define any logic**.  
All **logic** that controls how the *state* or *layout* of the *View* is transformed throughout it's lifecycle is **delegated to the Controller**,
and should be **decoupled and separate from the View**.

This concept stands in stark contrast to leading web development frameworks like:
- *React* - Where the *View's layout* and *state* are tightly intertwined with the *Controller's logic* inside JSX components.
- *Angular*, *Vue* - Where *View* and *Controller* separation exists, however *logic* may easily leak into the *View's layout* 
through even simple directive expressions like `<div *ngIf="isLoaded && getDataItems() > 0"></div>`. Such leaks dramatically increase
the complexity of the *View - Controller Contract*, and thus introduce tight coupling between the *View* and *Controller*.

#### The View State: a View - Controller Contract

State.js introduces the **View State** - A JSON object defined in the *View*, that serves as a Contract between the *View* and the *Controller*. Hence:
- The *Controller* may implement crucial transformations of the *View's layout* required by the web application exclusively by updating the **View state**.
- The *View* may define crucial endpoints for *Controller* interaction exclusively by defining the **View State**.
- A **UI/UX designer** is able to develop and test the *View's layout* without a coupled *Controller* by manually modifying the **View State** of a rendered *View*.
- A **web developer** is able to develop and test the *Controller's logic* without touching the *View's* layout, or by working on a stub View that defines an equivalent **View State**.

### State.js feature summary

- Enables full decoupling of the View (HTML) from the Controller (javascript code) in web applications.
- Introduces the *View State* - a Contract between the View and the Controller, stored within the DOM tree as a JSON object.
- The *View State* is defined within the View (HTML), using sytnax similar to JSONpath queries in special HTML attribures or HTML elements.
- The Controller (javascript code) may retrieve and update the *view state* at any time.
- Supports web components
- Features a *Visual Studio Code extension* to automatically generate .d.ts Contracts for HTML files (Views) 
for typescript and type-aware javascript Controller development.
- Features a *Google Chrome extension* to manually manipulate the *View State* of a HTML file (View) without 
a coupled Controller for interactive, Controllerless View design (also compatible with MS Edge).

## Installation

Install throught npm

```bash
npm install statejs
```

Or include the minified version directly in your *View's* layout:

```html
<script src="https://cdn.todo.com/statejs/lts/state.min.js" defer></script>
```

## Usage

Consider a basic View `index.html`...

```html
<!doctype html>
<html lang="en">
    <head>
        <title>Hello state.js</title>
        <script src="https://cdn.todo.com/statejs/lts/state.min.js" defer></script>
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

```js
document.addEventListener('StateLoaded', () => {

    document.state.listener('toggleSubheader': toggleSubheader);

    document.state.update({
        headerMessage: 'Hello World',
        showSubheader: true,
        subHeaderMessage: 'from state.js',
        onToggleSubheader: { 'click': 'toggleSubheader' }
    });

    function toggleSubheader(event) {
        document.state.update({ showSubheader: !document.state.current().showSubheader }); 
    }
});
```
Based on the path definitions (similar to JSONpath queries) defined in the special HTML attributes `state-content`, `state-if`, `state-if-not` and `state-listen`,
the initial **View State** of the *View* `index.html` is defined as:
```json
{
    "headerMessage": "Hello",
    "showSubheader": false,
    "subHeaderMessage": "",
    "onToggleSubheader": {}
}
```
Once the **View State** is fully loaded and the `StateLoaded` event if dispatched from the `window.document` object,
the *Controller* `index.controller.js` may:
- retrieve the current **View State** by calling `document.state.current()`
- update the **View State** by calling `document.state.update(myNewState)`.

Notice how upon the first `document.state.update(...)` call, the **View State** is updated by the Controller to:
```json
{
    "headerMessage": "Hello World",
    "showSubheader": true,
    "subHeaderMessage": "from state.js",
    "onToggleSubheader": { "click": "toggleSubheader" }
}
```
State.js automatically propagates the updated **View State** across the View's layout.  
In particular:
- The `state-if="@.showSubheader"` attribute adds or removes it's element from the DOM tree based on the truthiness of the `showSubheader` state field.
- The `state-content="@.subHeaderMessage"` attribute renders text content in it's parent element based on the value of the `subHeaderMessage` state field.
- The `state-listen="@.onToggleSubheader"` attribute attaches DOM event listeners to it's parent element based on the keys and values of the `onToggleSubheader` state field.
- The `<state>` tag allows defining `state-` attributes on text blocks without wrapping them in any other HTML tag.

## View API

### `state-content="[path]"` (html attribute)

Renders the value of the state field at `[path]` as this DOM element's text content.  
The state field `[path]` is initialized to a `string` containing this DOM element's text content.

#### Example:
```html
<p state-content="@.myParagraph">
    Initial paragraph text
</p>
```

---
### `state-if="[path]"` (html attribute)

Removes this DOM element and it's subtree from the DOM if the state field at `[path]` evaluates to falsy.  
The state field at `[path]` is initialized to `false`.

#### Example:
```html
<p state-if="@.loading">
    <progress> loading... </progress>
</p>
```

#### Remarks

When the state field at `[path]` evaluates to falsy, the DOM element and it's subtree is not deleted.  
It is instead wrapped in a `<template state-if="[path]" state-placeholder></template>` element at the same position in the DOM tree.  
Conversely, this placeholder element's content is unwrapped when `[path]` evaluates to truthy.

---
### `state-if-not="[path]"` (html attribute)

Removes this DOM element and it's subtree from the DOM if the state field at `[path]` evaluates to truthy.  
The state field at `[path]` is initialized to `false`.

#### Example:
```html
<p state-if-not="@.loading">
    <div state-content=@.loadedContent></div>
</p>
```

#### Remarks

When the state field at `[path]` evaluates to truthy, the DOM element and it's subtree is not deleted.  
It is instead wrapped in a `<template state-if="[path]" state-placeholder></template>` element at the same position in the DOM tree.  
Conversely, this placeholder element's content is unwrapped when `[path]` evaluates to falsy.

---
### `state-foreach="[path]"` (html attribute)

Renders this DOM element and it's subtree for each element of the array at the state field `[path]`.  
If `[path]` is not an array but is truthy, it is treated as na array with 1 element.  
The state field at `[path]` is initialized to an empty array `[]`.

#### Example:
```html
<ul state-foreach="@.myList">
    <li>
        <span state-content="@.$index">0</span>
        <span state-content="@.listItem">list item text here</span>
    </li>
</ul>
```

#### Remarks

When the View's *layout* is analyzed to load the initial *View State*, state.js will wrap any DOM elements
containing the `state-foreach` attribute in a `<tempalte state-foreach="[path]" state-placeholder>[...]</tempalte>`
tag at the same position in the DOM tree.  
The DOM subtree of this placeholder element will subsequently be cloned after it for each element of the array at `[path]`.

Paths starting with `@.` (of any `state-` attributes inside the `state-foreach` element's DOM subtree)
will be resolved relative to their respective array item, (i.e. their paths within the *View State* object will start at the array item).  
To reference state fields beyond the array item, start the `state-` attribute's path with `$.`. This will always resolve the state attribute's path
relative to the root of the *View State* object regardless of *scope* (see `state-scope="[path]"` for more information).

##### Example:
```html
<ul state-foreach="@.myList">
    <li>
        <span state-content="@.listItemText">
            Updated with document.state.currrent().myList[...].listItemText
            (varies per item)
        </span>
        <span state-content="$.footer">
            Updated with document.state.current().footer
            (equal for all items)
        </span>
    </li>
</ul>
```

The special `$index` field, containing the array item's current index will be appended to each array item of state field `[path]`.

---
### `state-listen="[path]"` (html attribute)

Attaches DOM Event listeners defined in the state field `[path]` to this DOM element.  
This provides any *Controller* attached to this *View* a way to interact with this element's input.

#### Example:
```html
<button state-listen="@.onButtonEvents">My Button</button>
```
```javascript
document.state.listener({
    'onClick': (event, context) => console.log(`Clicked button: ${context.id}`),
    'onHover': (event, context) => console.log(`Hovered over button: ${context.id}`)
});

document.state.update({
    onButtonEvents: { 
        'click': 'onClick',
        'mouseover': 'onHover',
        context: { id: 'My-Wonderfull-Button' }
    }
});
```

#### Remarks

The `[path]` state field is assumed to be an `Object` containing keys defined as DOM event names,
and values defined as names of javascript `functions` that will be triggered on the respective DOM event.  
All functions used in `[path]` field must first have their names declared using the `[element].state.listener()`
method (see `[element].state.listener(nameOrDict, fn)` for details).

The special `context` field of the `[path]` state field will be passed as the 2nd argument of the called 
listener `function` (the 1st argument being the DOM event itself).

Event listeners are added to DOM elements based on the *keys* and *values* in the `[path]` state field `Object` using:
```javascript
DOMelement.addEventListener(key, getListenerByName(value));
```
If a key-value pair is removed, or a value is updated to a different function reference,
the previous event listener will be automatically removed by state.js.

---
### `state-attr-[name]="[path]"` (html attribute)

Set's the value of attribute `[name]` on this DOM element to the value of the state field at `[path]`.  
The state field at `[path]` is initialized the value of attribute `[name]` on this DOM element.

#### Example:
```html
<input name="myInput" type="text" state-attr-id="@.myInputId" state-attr-value="@.myInputValue">
```

#### Remarks

Some attributes, like the `value` attribute for `<input>` tags, define initial values for special DOM element properties,
which will subsequently be updated based on user interaction.  
State.js automatically handles two-way updates between these properties and the respective *View State* fields 
for the following HTML element - attribute pairs:
- `<input>` and `value`: `<input type="text" state-attr-value="@.myValue">`
- `<textarea>` and `value`: `<textarea state-attr-value="@.myText">`
- `<select>` and `value`: `<select state-attr-value="@.mySelectedItem">`
- `<input>` with `type="checkbox"` and `checked`: `<input type="checkbox" state-attr-checked-if="@.isChecked">`
- `<input>` with `type="file"` and `value`: `<input type="file" state-attr-value="@.filesToUpload">`
- `<details>` and `open`: `<details state-attr-open-if="@.isOpen">[...]</details>`
- any tag with the `contenteditable` attribute and `value`: `<div contenteditable state-attr-value="@.myEditable" >Edit me.../div>`

---
### `state-attr-[name]-if="[path]"` (html attribute)

Add the attribute `[name]` to this DOM element if the value of the state field at `[path]` is truthy. Remove the attribute otherwise.  
The state field at `[path]` is initialized to `false`.

#### Example:
```html
<input name="myCheckbox" type="checkbox" state-attr-checked-if="@.isChecked">
```

---
### `state-attr-[name]-if-not="[path]"` (html attribute)

Add the attribute `[name]` to this DOM element if the value of the state field at `[path]` is falsy. Remove the attribute otherwise.  
The state field at `[path]` is initialized to `false`.

#### Example:
```html
<input name="myCheckbox" type="checkbox" state-attr-checked-if-not="@.notChecked">
```

---
### `state-class-[name]-if="[path]"` (html attribute)

Add the CSS class `[name]` to this DOM elements `class` attribute if the value of the state field at `[path]` is truthy. Remove the CSS class otherwise.
The state field at `[path]` is initialized to `true` if the DOM element contains CSS class `[name]`, `false` otherwise.

#### Example:
```html
<p state-class-error-if="@.hasError">
    This text will be styled in case of an error.
</p>
```

---
### `state-class-[name]="[path]"` (html attribute)

Alias of `state-class-[name]-if="[path]"`.

#### Example:
```html
<p state-class-error="@.hasError">
    This text will be styled in case of an error.
</p>
```

---
### `state-class-[name]-if-not="[path]"` (html attribute)

Add the CSS class `[name]` to this DOM elements `class` attribute if the value of the state field at `[path]` is falsy. Remove the CSS class otherwise.
The state field at `[path]` is initialized to `false` if the DOM element contains CSS class `[name]`, `true` otherwise.

#### Example:
```html
<p state-class-error-if-not="@.hasError">
    This text will be styled if there are no errors.
</p>
```

---
### `<state></state>` (html element)

A transparent container for defining state attributes.

#### Example:
```html
<p>
   Hello <state state-content="@.helloWhat">World</state>
</p>
```

---
### `<state-compose tag="[tagName]" src="[uri]"></state-compose>` (html element)

Declares that each custom HTML element `<[tagName]>` will be filled with the View defined at `[uri]`.  
The `[uri]` may be a URL to an external HTML document, as well as an ID of a `<template>` element within 
this HTML document.

#### Example:
```html
<html>
    <head>
        <state-compose tag="app-my-element" src="my-element"></state-compose>
        <state-compose tag="app-my-other-element" src="/compoonents/myOtherElement.html"></state-compose>
    </head>
    <body>
        <app-my-elemment></app-my-elemment>

        <app-my-other-elemment></app-my-other-elemment>

        <template id="my-element">
            <p state-content="@.componentStateContent">My own state!</p>
        </template>
    </body>
</html>
```

#### Remarks

A new *View State* will be created of each element `<[tagName]>` (see `[element].state.create(element)` for details).  
While the created *View State* is independent from the parent View's state by default, it may be referenced 
in the parent *View State* using the `state-pass` attributte (see `state-pass="[path]"` for details).  

`state-compose` elements may be defined anywhere in the View's layout (not necessarily in the `<head>` element).  
When a `state-compose` element is defined multiple times for the same `[tagName]` in a View, the last 
`state-compose` element is considered valid.

Cirular dependecies between Views declared with `state-compose` may cause infinite nesting (e.g. View *A* uses `state-compose` to include View *B*,
which in turn uses `state-compose` to include View *A*). To protect against such scenarios, state.js defines the **maximum nesting depth = 20**,
beyond which HTML elements with `state-compose` declarations will be ignored.

---
### `state-pass="[path]"` (html attribute)

When defined on a custom HTML element declared in `<state-compose>`, this attribute will reference this custom element's 
*View State* in this View's state at `[path]`. This means that:
- The entire *View State* of this custom HTML element will be included in the parent *View State* at `[path]`.
- When the state field `[path]` is updated in the parent *View State*, those 
updates will be propagated to this custom HTML element's *View State*
- WHen this custom HTML element's *View State* is updated, those updates will be propagated to the parent View's *View State*.

#### Example:
```html
<html>
    <head>
        <state-compose tag="app-my-element" src="my-element"></state-compose>
    </head>
    <body>
        <h1 state-content="@.myHeader"></h1>

        <app-my-elemment state-pass="@.myElementState"></app-my-elemment>

        <template id="my-element">
            <p>
                <state state-content="@.sommeText"></state>
                <state state-content="@.someNumber"></state>
            </p>
        </template>
    </body>
</html>
```
```javascript
await document.state.update({
    myHeader: 'Hello World',
    myElementState: {
        sommeText: 'Text inside my element',
        someNumber: 123
    }
});

const state = document.state.current();
// state is equal to:
// {
//   myHeader: 'Hello World',
//   myElementState: {
//     sommeText: 'Text inside my element',
//     someNumber: 123
//   }
// }
```

#### Remarks

See `<state-compose tag="[tagName]" src="[uri]"></state-compose>` for further details.

---
### `state-ignore` (html attribute)

When the View's *layout* is analyzed to load the initial *View State*, state.js will not analyze this DOM element or it's subtree.

#### Example:
```html
<div state-ignore>
    <ul>
        <li>This element will be ignored by state.js</li>
        <li>This one as well</li>
    </ul>
    <div>And this one</div>
</div>
```

---
### `state-scope="[path]"` (html attribute)

For internal use only. When this attribute is defined on an HTML element, paths of all `state-` attributes defined
on this element and it's subtree starting with `@.` will be resolved as relative to `[path]`.  
`[path]` is then defined as the *scope* of this element's DOM tree in the *View State*.  
Paths starting with `$.` will always be treated as 'absolute' paths, i.e. resolved relative to the root
of the *View State* object.  
A Path starting with `@.` that does not have a `state-scope` attribute on any of it's parent elements 
will be resolved as if it would start with `$.` (i.e. relative to the root of the *View State* object).

#### Example:
```html
<body>
    <h1 state-content="@.header"></h1>
    <div state-scope="@.myContent.myScope">

        <h2 state-content="$.header"><h2>
        <span state-content="@.text"></span>

        <div state-scope="@.mySubScope">

            <h3 state-content="$.header"><h3>
            <span state-content="@.subtext"></span>
        </div>
    <div>
</body>
```
```javascript
document.addEventListener('StateLoaded', () => {

    document.state.update({ 
        header: 'Hello from all headers!',
        myContent: {
            myScope: {
                text: 'Hello from a scope!',
                mySubScope: {
                    subtext: 'Hello from a sub-scope!'
                }
            }
        }
    });
});
```
#### Remarks

When DOM subtrees are inserted for items of an `Array` referenced in a `state-foreach` attribute, the root element
of each subtree will automatically receive a `state-scope` attribute with a path pointing it's respective array item.

#### Example:
View definition:
```html
<ul>
    <li state-foreach="@.items">
        <span state-content="@.$index"></span>:
        <span state-content="@.text"></span>
    </li>
<ul>
```
Live View with applied *View State*:
```html
<ul>
    <template state-foreach="@.items" state-placeholder>
        <li>
            <span state-content="@.$index"></span>:
            <span state-content="@.text"></span>
        </li>
    </template>
    <li state-scope="$.items[0]">
        <span state-content="@.$index">0</span>:
        <span state-content="@.text">Hello</span>
    </li>
    <li state-scope="$.items[1]">
        <span state-content="@.$index">1</span>:
        <span state-content="@.text">World</span>
    </li>
    <li state-scope="$.items[2]">
        <span state-content="@.$index">2</span>:
        <span state-content="@.text">From state.js!</span>
    </li>
<ul>
```

---
### `state-placeholder` (html attribute)

For internal use only. This attribute will be included in `<template>` elements added to the DOM by state.js
to store temporary DOM subtrees (e.g. to support the functionality of `state-if` or `state-foreach` attributes).

---
### Are path expressions in state.js JSONPath?

Though very similar as first glance, path expressions in state.js **are not** JSONPath expressions (as defined in [RFC 9535](https://www.rfc-editor.org/rfc/rfc9535)).
Key differences include:
- All path expressions in `state-` attributes must start with `$.` or `@.`.
- The `@` selector is valid at the start of any path expression, and serves as the identifier of the current *scope's* root (see `state-scope="[path]"`).
- All path expressions in `state-` attributes must resolve with a single object or value. This means that:
    - Array ranges `$.list[2:3]` and selections `$.list[2,3,4]` **are not allowed**.
    - Array filters of any kind `$.customer[?(@.age > 18)]` **are not allowed**.
    - The "all children" operator `$.parentNode.*` **is not allowed**.
    - The "all children named..." operator `$..anyChildNode` **is not allowed**.
- Output mapping `$.[].{Name:name, Age:age, Hobbies:details.hobbies}` in `state-` attributes **is not allowed**.
- Segments may only use *bracket notation* for array indices (i.e. `$['store']['book'][0]['title']` **is not allowed**, use `$.store.book[0].title` instead).

#### Remarks

Path expressions yielding multiple items (e.g. array ranges or filters) or remapping the output would 
introduce *logic* into the *View*, which is exactly what state.js is trying to prevent (see "The Passive View").

While the `@` selector serves a similar purpose, it's JSONPath counterpart is defined as "valid only within filter selectors",
hence it's use at the start of a JSONPath would be invalid in the context of [RFC 9535](https://www.rfc-editor.org/rfc/rfc9535).  

*Bracket notation* is only allowed for array indices for the sake of notation simplicity.

## Controller API

### `[element].state` (DOM element property)

The `state` object is the primary endpoint of state.js' Controller API. `state` objects are appended as properties
to `Elements` in the View's (i.e. a HTML document's) DOM.  
`state` objects allow the Controller to interact with a *View State* initialized and loaded for a given DOM subtree.  
When state.js is succesfully loaded, a `state` object is guaranteed to be appended to the `window.document` property.
This represents the root *View State* for the entire View.

#### Example:
```javascript
document.addEventListener('StateLoaded', () => {

    const initialState = document.state.current();

    document.state.update({ header: 'Hello World' });
});
```

#### Remarks

The `state` object will also be appended to any elements for which `[element].state.create(element)` was called.
See `[element].state.create(element)` for details.

---
### `[element].state.current()` (state object method)

Returns the current *View State* as a readonly JSON object.

#### Return Type

`{ [key:string]: any }` - the current *View State*.

#### Example:

```javascript
document.addEventListener('StateLoaded', () => {

    const initialState = document.state.current();
});
```

#### Remarks

The `Object` returned by `document.state.current()` and all of it's properties are deep frozen using `Object.freeze()`.

---
### `[element].state.update(newState)` (state object method)

Updates the current *View State* with either a partial `object` or an `Array` of paths and values.

#### Arguments
- `newState: { [key:string]:any } | [ { path: string, value: any } ]` - Either a partial `object` that will
be merged into the current *View State*, or an `Array` of path's within the *View State* to modify,
and their respective new values.

#### Return type

`Promise<void>` - The promise fulfills once the *View State* is completely updated.

#### Example: 
```javascript
document.addEventListener('StateLoaded', async () => {

    const initialState = document.state.current();

    await document.state.update({ header: 'Hello World' });

    document.state.update([
        { path: '$.header', value: 'Hello Again!' }
    ]);
});
```

---
### `[element].state.listener(nameOrDict, fn)` (state object method)

Register a new listener function (or a collection of functions) for use with `state-listen` attributes.

#### Arguments
- `nameOrDict: string|{ [key:string]: Function }` - When set to a `string`, defines the name of `fn`. 
When set to an `Object`, defines a dictionary of `functions` to register (values) and thier names (keys).
- `fn: Function|undefined` - Defines the `function` to register under `nameOrDict` (when set to a `string`).
Ignored if `nameOrDict` is set to an `Object`.

#### Return Type
`void`

#### Example:
```html
<button state-listen="$.onAddButton">Add Item</button>
<ul>
    <li state-foreach="$.items">
        <state state-content="@.text">Stub text</state>
        <button state-listen="@.onUpdateButton">Update</button>
        <button state-listen="@.onRemoveButton">Remove</button>
    </li>
<ul>
```
```javascript
document.addEventListener('StateLoaded', async () => {

    document.state.listener('removeItem', removeItem);

    document.state.listener({
        addItem,
        updateItem
    });

    let itemIdSequence = 0;
    const items = [  _newItem('Hello'), _newItem('World') ];

    document.state.update({ items, onAddButton: { 'click': 'addItem' } });

    function addItem(event, context) {
        items.push(_newItem('Added Item'));
        document.state.update({ items });
    }

    function removeItem(event, context) {
        const index = items.findIndex(i => i.id === context.id);
        items.splice(index, 1);
        document.state.update({ items });
    }

    function updateItem(event, context) {
        const item = items.find(i => i.id === context.id);
        item.text = 'Updated Item';
        document.state.update({ items });
    }

    function _newItem(text) {
        const id = ++itemIdSequence;
        return { 
            id
            text,
            onUpdateButton: { 'click': 'updateItem', context: { id } },
            onRemoveButton: { 'click': 'removeItem', context: { id } }
        };
    }
});
```

#### Remarks

The `state-listen` attribute assumes the updated value to be an `Object` containing keys defined as DOM event names,
and values defined as names of javascript `functions` that will be triggered on the respective DOM event.  
All functions passed to `state-listen` attributes must first have their names declared using `[element].state.listener(nameOrDict, fn)`

The special `context` field of the `Object` passed to `state-listen` attributes will be passed as the 2nd argument of the called 
listener `function` (the 1st argument being the dispatched DOM event).

Event listeners are added to DOM elements based on the *keys* and *values* in the `[path]` state field `Object` using:
```javascript
DOMelement.addEventListener(key, getListenerByName(value));
```
If a key-value pair is removed, or a value is updated to a different function reference,
the previous event listener will be automatically removed by state.js.

---
### `[element].state.create(element)` (state object method)



### `[element].state.contract(namespace, className, wrap)` (state object method)
