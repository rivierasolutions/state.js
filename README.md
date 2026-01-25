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
- A **UI/UX designer** is able to develop and test the *View's layout* without a coupled *Controller* by manually modifying the **View State** of a rendered *View*.
- A **web developer** is able to develop and test the *Controller's logic* without touching the *View's* layout, or by working on a stub View that defines an equivalent **View State**.



## Features

- Enables full decoupling of the View (HTML) from the Controller (javascript code) in web applications.
- Introduces the *view state* a contract between the View and the Controller, stored within the DOM tree in JSON format.
- The *view state* is defined within the View (HTML), using special HTML attribures, tags and JSONPath queries.
- The Controller (javascript code) may retrieve and update the *view state* at any time.
- Supports web components

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
the *Controller* index.controller.js may:
- retrieve the current **View State** by calling `document.state.current()`
- update the **View State** by calling `document.state.update(myNewState)`.

Notice how:
- The `state-if="@.showSubheader"` attribute enables adding or removing it's element from the DOM tree based on the truthiness of the `showSubheader` state field.
- The `state-content="@.subHeaderMessage"` attribute enables displaying text content in it's parent element based on the value of the `subHeaderMessage` state field.
- The `state-listen="@.onToggleSubheader"` attribute enables attaching DOM event listeners to it's parent element based on the keys and values of the `onToggleSubheader` state field.
- The `<state>` tag allows defining `state-` attributes on text blocks without wrapping them in any other HTML tag.

## View API

### `state-content="[JSONpath]"` (html attribute)

Renders the value of the state field at `[JSONpath]` as this DOM element's text content.  
The state field `[JSONpath]` is initialized to a `string` containing this DOM element's text content.

#### Example:
```html
<p state-content="@.myParagraph">
    Initial paragraph text
</p>
```


### `state-if="[JSONpath]"` (html attribute)

Removes this DOM element and it's subtree from the DOM if the state field at `[JSONpath]` evaluates to falsy.  
The state field at `[JSONpath]` is initialized to `false`.

#### Example:
```html
<p state-if="@.loading">
    <progress> loading... </progress>
</p>
```

#### Remarks

When the state field at `[JSONpath]` evaluates to falsy, the DOM element and it's subtree is not deleted.  
It is instead wrapped in a `<template state-if="[JSONpath]" state-placeholder></template>` element at the same position in the DOM tree.  
Conversely, this placeholder element's content is unwrapped when `[JSONpath]` evaluates to truthy.

### `state-if-not="[JSONpath]"` (html attribute)

Removes this DOM element and it's subtree from the DOM if the state field at `[JSONpath]` evaluates to truthy.  
The state field at `[JSONpath]` is initialized to `false`.

#### Example:
```html
<p state-if-not="@.loading">
    <div state-content=@.loadedContent></div>
</p>
```

#### Remarks

When the state field at `[JSONpath]` evaluates to truthy, the DOM element and it's subtree is not deleted.  
It is instead wrapped in a `<template state-if="[JSONpath]" state-placeholder></template>` element at the same position in the DOM tree.  
Conversely, this placeholder element's content is unwrapped when `[JSONpath]` evaluates to falsy.

### `state-foreach="[JSONpath]"` (html attribute)

Renders this DOM element and it's subtree for each element of the array at the state field `[JSONpath]`.  
If `[JSONpath]` is not an array but is truthy, it is treated as na array with 1 element.  
The state field at `[JSONpath]` is initialized to an empty array `[]`.

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
containing the `state-foreach` attribute in a `<tempalte state-foreach="[JSONpath]" state-placeholder>[...]</tempalte>`
tag at the same position in the DOM tree.  
The DOM subtree of this placeholder element will subsequently be cloned after it for each element of the array at `[JSONpath]`.

JSONpaths starting with `@` (of any `state-` attributes inside the `state-foreach` element's DOM subtree)
will be resolved relative to their respective array item, (i.e. their paths within the *View State* object will start at the array item).  
To reference state fields beyond the array item, start the `state-` attribute's JSON path with `$`. This will always resolve the state attribute's value
at the root of the *View State* object regardless of *scope* (see `state-scope=[JSONpath]` for more information).

##### Example:
```html
<ul state-foreach="@.myList">
    <li>
        <span state-content="@.listItem">Updated with document.state.currrent().myList[$index].listItem</span>
        <span state-content="$.myText">Updated with document.state.current().myText</span>
    </li>
</ul>
```

The special `$index` field, containing the array item's current index will be appended to each array item of state field `[JSONpath]`.

### `state-listen="[JSONpath]"` (html attribute)

Initializes the given state field with this DOM element's "id" attribute. If the element does not have an "id" attribute a unique id will be generated.

### `state-attr-[name]="[JSONpath]"` (html attribute)

Set's the value of attribute `[name]` on this DOM element to the value of the state field at `[JSONpath]`.  
The state field at `[JSONpath]` is initialized the value of attribute `[name]` on this DOM element.

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
- `<input>` with `type="file"` and `files`: `<input type="file" state-attr-files="@.filesToUpload">`
- `<details>` and `open`: `<details state-attr-open-if="@.isOpen">[...]</details>`
- any tag with the `contenteditable` attribute and `value`: `<div contenteditable state-attr-value="@.myEditable" >Edit me.../div>`

### `state-attr-[name]-if="[JSONpath]"` (html attribute)

Add the attribute `[name]` to this DOM element if the value of the state field at `[JSONpath]` is truthy. Remove the attribute otherwise.  
The state field at `[JSONpath]` is initialized to `false`.

#### Example:
```html
<input name="myCheckbox" type="checkbox" state-attr-checked-if="@.isChecked">
```

### `state-attr-[name]-if-not="[JSONpath]"` (html attribute)

Add the attribute `[name]` to this DOM element if the value of the state field at `[JSONpath]` is falsy. Remove the attribute otherwise.  
The state field at `[JSONpath]` is initialized to `false`.

#### Example:
```html
<input name="myCheckbox" type="checkbox" state-attr-checked-if-not="@.notChecked">
```

### `state-class-[name]-if="[JSONpath]"` (html attribute)

Add the CSS class `[name]` to this DOM elements `class` attribute if the value of the state field at `[JSONpath]` is truthy. Remove the CSS class otherwise.
The state field at `[JSONpath]` is initialized to `true` if the DOM element contains CSS class `[name]`, `false` otherwise.

#### Example:
```html
<p state-class-error-if="@.hasError">
    This text will be styled in case of an error.
</p>
```

### `state-class-[name]="[JSONpath]"` (html attribute)

Alias of `state-class-[name]-if="[JSONpath]"`.

#### Example:
```html
<p state-class-error="@.hasError">
    This text will be styled in case of an error.
</p>
```

### `state-class-[name]-if-not="[JSONpath]"` (html attribute)

Add the CSS class `[name]` to this DOM elements `class` attribute if the value of the state field at `[JSONpath]` is falsy. Remove the CSS class otherwise.
The state field at `[JSONpath]` is initialized to `false` if the DOM element contains CSS class `[name]`, `true` otherwise.

#### Example:
```html
<p state-class-error-if-not="@.hasError">
    This text will be styled if there are no errors.
</p>
```

### `<state></state>` (html tag)

A transparent container for defining state attributes.

#### Example:
```html
<p>
   Hello <state state-content="@.helloWhat">World</state>
</p>
```

### `<state-compose tag="[tag]" src="[uri]"></state-compose>` (html tag)

### `state-pass="[JSONPath]"` (html attribute)

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

### `state-scope="[JSONpath]"` (html attribute)

### `state-placeholder` (html attribute)

## Controller API

### `[element].state` (DOM element property)

### `[element].state.current()` (state object method)

### `[element].state.update(newState)` (state object method)

### `[element].state.scopeOf(element)` (state object method)

### `[element].state.create(element)` (state object method)

### `[element].state.contract(namespace, className, wrap)` (state object method)
