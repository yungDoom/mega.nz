/* Bundle Includes:
 *   js/ui/mcomponents/classes/MComponent.js
 *   js/ui/mcomponents/classes/MButton.js
 *   js/ui/mcomponents/classes/MCheckbox.js
 *   js/ui/mcomponents/classes/MContextMenu.js
 *   js/ui/mcomponents/classes/MDialog.js
 *   js/ui/mcomponents/classes/MEmptyPad.js
 *   js/ui/mcomponents/classes/MHint.js
 *   js/ui/mcomponents/classes/MMenuSelect.js
 *   js/ui/mcomponents/classes/MMenuSelectItem.js
 *   js/ui/mcomponents/classes/MSidebarButton.js
 *   js/ui/mcomponents/classes/MTab.js
 *   js/ui/mcomponents/classes/MTabs.js
 *   js/vendor/megaDynamicList.js
 *   js/fm/quickfinder.js
 *   js/fm/selectionManager2.js
 *   js/fm.js
 *   js/fm/backupsUI.js
 *   js/fm/dashboard.js
 *   js/fm/recents.js
 *   js/time_checker.js
 *   js/ui/contextMenu.js
 *   js/ui/dragselect.js
 *   js/ui/onboarding.js
 *   js/ui/sms.js
 */

class MComponent {
    /**
     * @param {String|HtmlElement} parent Either DOM element or a query selector
     * @param {Boolean} [appendToParent=true] Append to parent right away or skip
     */
    constructor(parent, appendToParent = true) {
        this.disposeEvents = {};

        this.buildElement();

        if (typeof parent === 'string') {
            parent = document.querySelector(parent);
        }

        if (parent) {
            if (appendToParent) {
                parent.appendChild(this.el);
            }

            this._parent = parent;
        }

        if (this.el) {
            this.el.mComponent = this;
        }
    }

    /**
     * Attaching an event to the directly related element (this.el)
     * @param {String} eventName Event name to work with as per `addeventlistener` documentation
     * @param {Function} handler Handler for the element click
     * @param {any} [options] Options as per AddEventListener guidelines
     * @param {HTMLElement} [domNode] A specific DOM node to attach the event to
     */
    attachEvent(eventName, handler, options, domNode) {
        this.disposeEvent(eventName);
        this.disposeEvents[eventName] = MComponent.listen(
            domNode || this.el,
            eventName.split('.')[0],
            handler,
            options
        );
    }

    /**
     * Detaching an event by name if any
     * @param {String} eventName Event name to listen
     * @returns {void}
     */
    disposeEvent(eventName) {
        if (typeof this.disposeEvents[eventName] === 'function') {
            this.disposeEvents[eventName]();
        }
    }

    /**
     * Detaching this.el
     * This removes this.el reference,
     * so it is better to use it before complete removal or resetting with buildElement()
     */
    detachEl() {
        if (!this.el) {
            return;
        }

        const parent = this.el.parentNode;

        if (parent) {
            parent.removeChild(this.el);
        }

        // Disposing all events attached via MComponent.listen()
        const eventNames = Object.keys(this.disposeEvents);

        for (let i = 0; i < eventNames.length; i++) {
            this.disposeEvent(eventNames[i]);
        }

        $(this.el).off('dialog-closed.mDialog');

        delete this.el;
    }

    appendCss(classes) {
        if (classes) {
            this.el.classList.add(...classes.split(' '));
        }
    }

    /**
     * Listening for an event and conveniently removing listener disposer
     * @param {HTMLElement|String} node DOM element to listen the event on
     * @param {Event} event An event to listen
     * @param {Function} handler A callback to trigger
     * @param {Object} options Event options as per MDN for addEventListener
     * @returns {Function} Returning function should be called when the listener needs to be disposed
     */
    static listen(node, event, handler, options) {
        if (typeof node === 'string') {
            node = document.querySelector(node);
        }

        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }

    /**
     * Resetting array of specific internal elements
     * @param {MComponent} mComponent The ref to mComponent
     * @param {String} key Key of the list to reset
     * @param {String|Boolean} [containerKey] The this.ref of the DOM element to clear (if any)
     * @returns {void}
     */
    static resetSubElements(mComponent, key, containerKey = 'el') {
        if (!Array.isArray(mComponent[key])) {
            mComponent[key] = [];
            return;
        }

        for (let i = 0; i < mComponent[key].length; i++) {
            if (mComponent[key][i].remove) {
                mComponent[key][i].remove();
            }

            delete mComponent[key][i];
        }

        if (containerKey) {
            const container = mComponent[containerKey];

            if (container) {
                while (container.firstChild) {
                    container.removeChild(container.firstChild);
                }
            }
        }

        mComponent[key] = [];
    }
}

class MButton extends MComponent {
    /**
     * @param {String} label Main text of the button
     * @param {String} leftIcon The icon on the left of the text
     * @param {Function} clickFn The callback to trigger
     * @param {String} additionalClasses Additional classes to use along with the main ones
     */
    constructor(label, leftIcon, clickFn, additionalClasses) {
        super();

        if (label) {
            this.label = label;
        }

        if (typeof clickFn === 'function') {
            this.attachEvent('click', (e) => {
                clickFn(this, e);
            });
        }

        if (leftIcon) {
            this.setLeftIcon(leftIcon);
        }

        this.appendCss(additionalClasses);
        this._loading = false;
    }

    /**
     * @param {Boolean} status Whether to truncate the overlapping text or not
     */
    set truncateOverflowText(status) {
        if (!this.textSpan) {
            return;
        }

        const truncateClasses = ['text-ellipsis', 'w-full'];

        if (status === true) {
            this.textSpan.classList.add(...truncateClasses);
        }
        else {
            this.textSpan.classList.remove(...truncateClasses);
        }
    }

    get label() {
        return this.textSpan ? this.textSpan.textContent : '';
    }

    /**
     * @param {String} label Label to set withing the button
     */
    set label(label) {
        if (!this.textSpan) {
            this.textSpan = document.createElement('span');
            this.el.appendChild(this.textSpan);
        }

        this.textSpan.textContent = label;
    }

    /**
     * @param {Boolean} status Loading status
     */
    set loading(status) {
        if (status === this.loading) {
            return;
        }

        if (status) {
            this.el.style.width = this.el.offsetWidth + 'px';

            if (this.textSpan) {
                this.el.removeChild(this.textSpan);
            }

            this.loadingEl = document.createElement('i');
            this.loadingEl.className = 'sprite-fm-theme icon-loading-spinner mx-auto rotating';
            this.el.appendChild(this.loadingEl);

            this.disable();
        }
        else {
            if (this.loadingEl) {
                this.el.removeChild(this.loadingEl);
            }

            if (this.textSpan) {
                this.el.appendChild(this.textSpan);
            }

            this.el.style.width = null;
            this.enable();
        }
    }

    disable() {
        if (!this.el.disabled) {
            this.el.classList.add('disabled');
            this.el.disabled = true;
        }
    }

    enable() {
        if (this.el.disabled) {
            this.el.classList.remove('disabled');
            this.el.disabled = false;
        }
    }

    removeLeftIcon() {
        if (this.leftIcon) {
            this.leftIcon.parentNode.removeChild(this.leftIcon);
        }
    }

    setLeftIcon(icon) {
        this.removeLeftIcon();

        this.leftIcon = document.createElement('i');
        this.leftIcon.className = 'sprite-fm-mono ' + icon;

        const div = document.createElement('div');
        div.appendChild(this.leftIcon);

        this.el.prepend(div);
    }

    buildElement() {
        this.el = document.createElement('button');
    }

    setActive() {
        this.el.classList.add('active');
    }

    unsetActive() {
        this.el.classList.remove('active');
    }
}

class MCheckbox extends MComponent {
    /**
     * @constructor
     * @param {Object.<String, String|Boolean>} data An enclosing data object
     * @param {String} data.id Id for Input and Label
     * @param {String} data.name Input name
     * @param {String} data.label Label for the checkbox
     * @param {String} [data.classes] Additional classes to add
     * @param {Boolean} [data.checked] Whether checked or not on init
     * @param {Boolean} [data.passive] Whether checkbox should or shouldn't change state on click right away
     */
    constructor({
        label,
        id,
        name,
        checked,
        classes,
        disabled,
        passive
    }) {
        super();

        this.prepareInput(id, name, checked === true, passive === true);

        if (label) {
            this.label = label;
        }

        this.appendCss(classes);
        this.disabled = disabled === true;
    }

    get checked() {
        return this._checked;
    }

    /**
     * @param {Boolean} status Status to change to
     */
    set checked(status) {
        this._checked = status === true;

        const classes = ['checkboxOn', 'checkboxOff'];
        const toggle = (this._checked) ? classes : classes.reverse();

        this.checkDiv.classList.add(toggle[0]);
        this.checkDiv.classList.remove(toggle[1]);

        this.inputEl.checked = this._checked;
    }

    /**
     * @param {Boolean} status Whether the checkbox is available for interactions or not
     */
    set disabled(status) {
        if (status) {
            this.el.classList.add('opacity-50', 'pointer-events-none');
        }
        else {
            this.el.classList.remove('opacity-50', 'pointer-events-none');
        }
    }

    /**
     * @param {Function} fn Callback to fire when checkbox changes state
     */
    set onChange(fn) {
        this._onChange = fn;
    }

    /**
     * @param {String?} label Label to set
     */
    set label(label) {
        if (!label) {
            if (this.labelEl) {
                this.el.removeChild(this.labelEl);
            }

            return;
        }

        if (!this.labelEl) {
            this.labelEl = document.createElement('label');
            this.labelEl.className = 'radio-txt cursor-pointer pl-1 max-w-full';
            this.labelEl.htmlFor = this.inputEl.id;

            this.el.insertBefore(this.labelEl, this.inputEl.nextSibling);
        }

        this.labelEl.textContent = label;
    }

    buildElement() {
        this.el = document.createElement('div');
        this.el.className = 'key';

        this.checkDiv = document.createElement('div');
        this.checkDiv.className = 'checkdiv';

        this.inputEl = document.createElement('input');
        this.inputEl.type = 'checkbox';

        this.checkDiv.appendChild(this.inputEl);
        this.el.appendChild(this.checkDiv);
    }

    prepareInput(id, name, checked, passive) {
        if (id) {
            this.inputEl.id = id;
        }
        else {
            console.warn('Cannot use m-checkbox without an id...');
        }

        this.inputEl.name = name || id;
        this.checked = checked === true;

        if (passive) {
            this.attachEvent(
                'click',
                (evt) => {
                    evt.preventDefault();

                    if (this._onChange) {
                        this._onChange(!this.checked);
                    }
                },
                this.inputEl
            );
        }
        else {
            this.attachEvent(
                'change',
                (evt) => {

                    this.checked = evt.target.checked;

                    if (this._onChange) {
                        this._onChange(this.checked);
                    }
                },
                this.inputEl
            );
        }
    }
}

class MContextMenu extends MComponent {
    /**
     * @param {HTMLElement|String?} target DOM object or query selector to the DOM object
     * @param {Boolean} [ignoreOutsideClick] Whether to react to the clicks outside or not
     */
    constructor(target, ignoreOutsideClick = false) {
        super(target, false);
        this.isShowing = false;
        this.ignoreOutsideClick = ignoreOutsideClick;
    }

    buildElement() {
        this.el = document.createElement('div');
        this.el.className = 'dropdown body context m-context-menu tooltip-popin';
    }

    /**
     * @param {Number} width Width of the popup block
     */
    set width(width) {
        this._minWidth = parseInt(width);
    }

    /**
     * @param {Number} x Global X pos
     * @param {Number} y Global Y pos
     * @param {Number} [proposeX] Proposed X pos on the left, if the standard work out does not fit on the right
     * @param {Number} [proposeY] Proposed Y pos at the top, if the standard work out does not fit at the bottom
     * @returns {void}
     */
    show(x, y, proposeX, proposeY) {
        this.isShowing = true;

        document.body.appendChild(this.el);

        if (Number.isNaN(parseInt(x)) || Number.isNaN(parseInt(y))) {
            this.setPositionByTarget();
        }
        else {
            this.setPositionByCoordinates(x, y, proposeX, proposeY);
        }

        if (!this.ignoreOutsideClick) {
            this.disposeOutsideClick = MComponent.listen(document, 'mousedown', ({ target }) => {
                while (target) {
                    if (target.parentNode && target.classList.contains('m-context-menu')) {
                        break;
                    }

                    target = target.parentNode;
                }

                if (!target) {
                    this.hide(true);
                }
            });
        }

        this.pageChangeListener = mBroadcaster.addListener('beforepagechange', () => {
            if (this.ignorePageNavigationOnce) {
                this.ignorePageNavigationOnce = false;
            }
            else {
                this.hide();
            }
        });

        this.toggleScrolls(false);
    }

    hide(hideSiblings) {
        if (!this.isShowing) {
            return;
        }

        this.isShowing = false;

        if (this.el.parentNode) {
            this.el.parentNode.removeChild(this.el);
        }

        if (this.disposeOutsideClick) {
            this.disposeOutsideClick();
            delete this.disposeOutsideClick;
        }

        if (this.pageChangeListener) {
            mBroadcaster.removeListener(this.pageChangeListener);
            delete this.pageChangeListener;
        }

        if (hideSiblings) {
            const siblingMenus = document.body.querySelectorAll(':scope > div.m-context-menu');

            for (let i = 0; i < siblingMenus.length; i++) {
                const el = siblingMenus[i];

                if (el.mComponent && el.mComponent.isShowing && el !== this.el) {
                    el.mComponent.hide();
                }
            }
        }

        this.toggleScrolls(true);
    }

    /**
     * @param {Boolean} status Whether PS scrolls should be enabled or not
     * @returns {void}
     */
    toggleScrolls(status) {
        const scrollablePointers = document.querySelectorAll('.ps');
        const method = (status) ? 'remove' : 'add';

        if (scrollablePointers.length) {
            for (let i = 0; i < scrollablePointers.length; i++) {
                scrollablePointers[i].classList[method]('ps-disabled');
            }
        }
    }

    toggle() {
        this[this.isShowing ? 'hide' : 'show']();
    }

    setPositionByCoordinates(x, y, proposeX, proposeY) {
        if (this._minWidth > 0) {
            this.el.style.minWidth = this._minWidth + 'px';
        }

        if (x + this.el.offsetWidth > window.innerWidth) {
            x = (proposeX === undefined)
                ? window.innerWidth - this.el.offsetWidth - MContextMenu.offsetHoriz * 3
                : proposeX - this.el.offsetWidth;
        }

        if (y + this.el.offsetHeight > window.innerHeight) {
            y = (proposeY === undefined)
                ? window.innerHeight - this.el.offsetHeight - MContextMenu.offsetVert * 3
                : proposeY - this.el.offsetHeight;
        }

        this.el.style.left = x + 'px';
        this.el.style.top = y + 'px';
    }

    setPositionByTarget() {
        if (!this._parent) {
            return;
        }

        const rect = this._parent.getBoundingClientRect();

        this.el.style.top = (rect.top + this._parent.offsetHeight + MContextMenu.offsetVert) + 'px';
        this.el.style.left = rect.left + 'px';

        if (this._minWidth > 0) {
            this.el.style.minWidth = this._minWidth + 'px';
        }

        if (locale === 'ar') {
            this.el.style.left = `${rect.right - this.el.getBoundingClientRect().width}px`;
        }
    }
}

/**
 * Menu vertical offset in pixels
 * @type {Number}
 */
MContextMenu.offsetVert = 5;

/**
 * Menu horizontal offset in pixels
 * @type {Number}
 */
MContextMenu.offsetHoriz = 5;

class MDialog extends MComponent {
    /**
     * @param {Object.<String, any>} data An enclosing data object
     * @param {Boolean|{label: String, callback: Function?, classes: String}} data.ok
     * @param {Boolean|{label: String, callback: Function?, classes: String}} data.cancel
     * @param {String} [data.dialogClasses] Additional classes for dialog
     * @param {String} [data.contentClasses] Additional classes for dialog content
     * @param {String} [data.leftIcon] Classes for the side icon on the left
     * @param {Function} [onclose] Callback to trigger when the dialog is closed
     */
    constructor({ ok, cancel, dialogClasses, contentClasses, leftIcon, onclose, doNotShowCheckboxText, dialogName }) {
        super('section.mega-dialog-container:not(.common-container)', false);

        this._ok = ok;
        this._cancel = cancel;
        this._contentClasses = contentClasses;

        this._title = document.createElement('h3');
        this._title.className = 'text-ellipsis';

        this.onclose = onclose;

        this._doNotShowCheckboxText = doNotShowCheckboxText;

        this._dialogName = dialogName || 'm-dialog';

        if (leftIcon) {
            this.leftIcon = document.createElement('i');
            this.leftIcon.className = 'icon-left ' + leftIcon;
        }

        this.appendCss(dialogClasses);
    }

    get slot() {
        return this._slot;
    }

    /**
     * Providing the internal contents of the dialog
     * @param {HTMLElement} slot DOM element to insert within the dialog
     * @returns {void}
     */
    set slot(slot) {
        this._slot = slot;
    }

    /**
     * Filling the title text
     * @param {String} text Text to fill the title with
     * @returns {void}
     */
    set title(text) {
        this._title.textContent = text;
    }

    /**
     * @param {Function(any):boolean} getFn
     * @param {Function(any):void} setFn
     * @returns {void}
     */
    addConfirmationCheckbox(getFn, setFn) {
        this._doNotShowGetFn = getFn;
        this._doNotShowSetFn = setFn;
    }

    /**
     * Filling the text underneath the dialog
     * @param {String} text Text to fill with
     * @returns {void}
     */
    set actionTitle(text) {
        this._actionTitle.textContent = text;
    }

    buildElement() {
        this.el = document.createElement('div');
        this.el.className = 'mega-dialog m-dialog dialog-template-main';
    }

    triggerCancelAction() {
        if (typeof this._cancel === 'function') {
            this._cancel();
        }
        else if (this._cancel.callback) {
            this._cancel.callback();
        }

        this.hide();
    }

    show() {
        // use *unique* names per dialog
        M.safeShowDialog(this._dialogName, () => {
            this._show();

            if (this.onMDialogShown) {
                onIdle(() => this.onMDialogShown());
            }

            return $(this.el).rebind('dialog-closed.mDialog', () => {
                delete this.isShowing;
                this.detachEl();

                if (typeof this.onclose === 'function') {
                    this.onclose();
                }
            });
        });
    }

    _show() {
        this.setWrapper();

        if (this._ok || this._cancel) {
            this.setButtons();
        }

        if (this._parent) {
            this._parent.appendChild(this.el);

            const overlay = this._parent.querySelector('.fm-dialog-overlay');
            overlay.classList.add('m-dialog-overlay');

            this.attachEvent(
                'click.dialog.overlay',
                () => {
                    this.hide();
                },
                null,
                overlay
            );

            this.attachEvent(
                'keyup.dialog.escape',
                ({ key }) => {
                    if (key === 'Escape') {
                        this.hide();
                    }
                },
                null,
                document
            );
        }

        if (this._slot) {
            this._contentWrapper.appendChild(this._slot);
        }

        if (this.leftIcon) {
            this.el.prepend(this.leftIcon);
            this.el.classList.add('with-icon');
            this._contentWrapper.classList.add('px-6');

            if (this._aside) {
                this._aside.classList.add('-ml-18');
            }
        }
        else {
            this.el.classList.remove('with-icon');
            this._contentWrapper.classList.remove('px-6');

            if (this._aside) {
                this._aside.classList.remove('-ml-18');
            }
        }

        this.isShowing = true;
    }

    hide(ignoreNewOnes = false) {
        if (!this.isShowing) {
            return;
        }

        const nextDialog = this.el.nextElementSibling;

        if (!ignoreNewOnes && nextDialog && nextDialog.classList.contains('m-dialog')) {
            return; // No need to close this dialog, as it will be closed by the new opened one
        }

        if (this._doNotShowCheckbox) {
            this._doNotShowCheckbox.detachEl();

            delete this._aside;
            delete this._doNotShowCheckbox;
        }

        assert($.dialog === this._dialogName);
        closeDialog();
    }

    disable() {
        if (this.okBtn && !this.okBtn.el.disabled) {
            this.okBtn.disable();
        }
    }

    enable() {
        if (this.okBtn && this.okBtn.el.disabled === true) {
            this.okBtn.enable();
        }
    }

    setWrapper() {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close m-dialog-close';
        this.el.appendChild(closeBtn);

        const closeIcon = document.createElement('i');
        closeIcon.className = 'sprite-fm-mono icon-dialog-close';
        closeBtn.appendChild(closeIcon);

        this.el.appendChild(this._title);

        const content = document.createElement('section');
        content.className = 'content';
        this.el.appendChild(content);

        this._contentWrapper = document.createElement('div');
        this._contentWrapper.className = (typeof this._contentClasses === 'string') ? this._contentClasses : '';
        content.appendChild(this._contentWrapper);

        this.attachEvent(
            'click.dialog.close',
            () => {
                this.triggerCancelAction();
            },
            null,
            closeBtn
        );
    }

    setButtons() {
        const footer = document.createElement('footer');
        const footerContainer = document.createElement('div');
        footerContainer.className = 'p-6 flex justify-end items-center';
        footer.appendChild(footerContainer);
        this.el.appendChild(footer);

        this._actionTitle = document.createElement('div');
        this._actionTitle.className = 'flex flex-1';
        footerContainer.appendChild(this._actionTitle);

        if (this._cancel) {
            this.cancelBtn = new MButton(
                this._cancel.label || l[1597],
                null,
                () => {
                    this.triggerCancelAction();
                },
                (this._cancel.classes) ? this._ok.classes.join(' ') : 'mega-button'
            );

            footerContainer.appendChild(this.cancelBtn.el);
        }

        if (this._ok) {
            this.okBtn = new MButton(
                this._ok.label || l[1596],
                null,
                async() => {
                    let result = true;

                    if (typeof this._ok === 'function') {
                        result = this._ok();
                    }
                    else if (this._ok.callback && this._ok.callback[Symbol.toStringTag] === 'AsyncFunction') {
                        result = await this._ok.callback();
                    }
                    else if (this._ok.callback) {
                        result = this._ok.callback();
                    }

                    if (result !== false) {
                        if (this._doNotShowCheckbox && this._doNotShowSetFn) {
                            this._doNotShowSetFn(this._doNotShowCheckbox.checked);
                        }

                        this.hide();
                    }
                },
                this._ok.classes ? this._ok.classes.join(' ') : 'mega-button positive'
            );

            footerContainer.appendChild(this.okBtn.el);

            this.attachEvent(
                'keyup.dialog.enter',
                (evt) => {
                    if (this.okBtn.el.disabled) {
                        return;
                    }

                    if (evt.key === 'Enter') {
                        this.okBtn.el.click();
                        return false;
                    }
                },
                null,
                document
            );
        }

        if (this._doNotShowGetFn) {
            this._aside = document.createElement('aside');
            this._aside.className = 'align-start with-condition';

            this._doNotShowCheckbox = new MCheckbox({
                label: this._doNotShowCheckboxText || l[229],
                id: 'do-not-show-again-confirmation',
                checked: !!this._doNotShowGetFn && this._doNotShowGetFn()
            });

            this._aside.appendChild(this._doNotShowCheckbox.el);
            footer.appendChild(this._aside);
        }
    }
}

class MEmptyPad extends MComponent {
    buildElement() {
        this.el = document.createElement('div');
        this.el.className = 'fm-empty-pad text-center';
    }

    static createTxt(text, className) {
        const el = document.createElement('div');
        el.className = className;
        el.textContent = text;

        return el;
    }

    static createIcon(className) {
        const icon = document.createElement('i');
        icon.className = className;
        return icon;
    }

    static createOptionItem(text, iconClasses) {
        const el = document.createElement('div');
        el.className = 'fm-empty-options-item';

        el.appendChild(MEmptyPad.createIcon(iconClasses));
        el.append(text);

        return el;
    }

    /**
     * @param {[text: string, icon: string]} array Options array
     */
    appendOptions(array) {
        const options = document.createElement('div');
        options.setAttribute('class', 'fm-empty-options');

        for (let i = 0; i < array.length; i++) {
            const [text, icon] = array[i];
            options.appendChild(MEmptyPad.createOptionItem(text, icon));
        }

        this.el.appendChild(options);
    }

    remove() {
        this.el.parentNode.removeChild(this.el);
    }
}

class MHint extends MComponent {
    /**
     * @param {Object.<String, any>} data An enclosing data object
     * @param {String} data.title Title of the hint
     * @param {String} data.text Main description text
     * @param {String} data.img Image to show above the title (css classes)
     * @param {String} data.link Link to go to on `Learn more` click
     * @param {String} [data.classes] Additional classes to add
     */
    constructor({
        title,
        text,
        img,
        link,
        classes
    }) {
        super();

        this.img = img;
        this.title = title;
        this.text = text;
        this.link = link;

        this.appendCss(classes);

        this.attachEvent('mouseenter.tipPosition', () => {
            this._triggerHovered = true;
            this.show();
        });

        this.attachEvent('mouseleave.tipPosition', () => {
            this._triggerHovered = false;
            delay('hint:hide', () => {
                this.hide();
            });
        });

        this._tooltipHovered = false;
        this._triggerHovered = false;
    }

    buildElement() {
        this.el = document.createElement('div');

        const icon = document.createElement('i');
        icon.className = 'sprite-fm-theme icon-question-grey';

        this.el.appendChild(icon);
    }

    buildTooltip() {
        if (this._tooltip) {
            return;
        }

        this._tooltip = new MContextMenu(null, true);
        this._tooltip.el.classList.add(
            'dropdown',
            'body',
            'dropdown-arrow',
            'keys-tip',
            'left-arrow',
            'w-80',
            'text-center'
        );

        const arrow = document.createElement('i');
        arrow.className = 'dropdown-white-arrow';
        const img = document.createElement('div');
        img.className = this.img;
        const title = document.createElement('div');
        title.className = 'tip-header';
        title.textContent = this.title;
        const text = document.createElement('div');
        text.className = 'tip-text mx-2';
        text.textContent = this.text;
        const link = document.createElement('a');
        link.className = 'tip-link';
        link.textContent = l[8742];
        link.href = this.link;
        link.rel = 'noopener noreferrer';
        link.target = '_blank';

        this._tooltip.el.appendChild(arrow);
        this._tooltip.el.appendChild(img);
        this._tooltip.el.appendChild(title);
        this._tooltip.el.appendChild(text);
        this._tooltip.el.appendChild(link);

        this.attachEvent(
            'mouseenter.tipPosition.tooltip',
            () => {
                this._tooltipHovered = true;

                delay('hint:hide', () => {
                    this.hide();
                });
            },
            null,
            this._tooltip.el
        );

        this.attachEvent(
            'mouseleave.tipPosition.tooltip',
            () => {
                this._tooltipHovered = false;

                delay('hint:hide', () => {
                    this.hide();
                });
            },
            null,
            this._tooltip.el
        );
    }

    show() {
        this.buildTooltip();

        const { x, y, right, bottom } = this.el.getBoundingClientRect();
        this._tooltip.show(right + 12, y - 48, x, bottom + MContextMenu.offsetVert);
    }

    hide() {
        if (!this._tooltipHovered && !this._triggerHovered && this._tooltip) {
            this._tooltip.hide();
            delete this._tooltip;
        }
    }
}

class MMenuSelect extends MContextMenu {
    /**
     * @param {HTMLElement|String?} parent Parent element to attach the menu to
     * @param {String[]} additionalItemClasses Additional classes to use for all items enclosed
     * @param {Boolean} [autoDismiss] Whether to close the popup on option click or not
     */
    constructor(parent, additionalItemClasses, autoDismiss = true) {
        super(parent);

        this.el.classList.add('m-menu-select');
        this.additionalItemClasses = additionalItemClasses;
        this.autoDismiss = autoDismiss;
    }

    get options() {
        return this._options || [];
    }

    /**
     * @param {Object[]} list Options to work with
     * @param {String|function(): String|HTMLElement} list[].label Label of the option
     * @param {Function} list[].click A specific behaviour when option is clicked
     * @param {Boolean} list[].selected Checking if the option is selected initially
     * @param {Boolean} list[].selectable Checking if the option is actually selectable
     * @param {Boolean} list[].icon Icon on the left for the item
     * @param {Boolean} list[].iconRight Icon on the right for the item
     * @param {String[]} list[].classes Additional classes for a single option
     * @param {MMenuSelectItem[]} list[].children Sub items in the context menu
     * @returns {void}
     */
    set options(list) {
        this.resetOptions();

        if (!this.el) {
            this.buildElement();
        }

        let section = null;

        for (let i = 0; i < list.length; i++) {
            const {
                label,
                click,
                selected,
                selectable,
                icon,
                iconRight,
                classes,
                children
            } = list[i];

            // Creating a new section here
            if (!i || typeof click !== 'function') {
                if (section) {
                    section.appendChild(document.createElement('hr'));
                }

                section = document.createElement('div');
                section.setAttribute('class', 'dropdown-section');
                this.el.appendChild(section);
            }

            const itemClasses = [];

            if (this.additionalItemClasses) {
                itemClasses.push(...this.additionalItemClasses);
            }

            if (classes) {
                itemClasses.push(...classes);
            }

            const item = new MMenuSelectItem({
                label,
                selectFn: typeof click === 'function' ? (item) => this.onItemSelect(i, item, click) : null,
                selected,
                selectable,
                leftIcon: icon,
                rightIcon: iconRight,
                additionalClasses: itemClasses,
                children
            });

            this._options.push(item);

            if (selected === true) {
                this.selectedIndex = i;
            }

            section.appendChild(item.el);
        }
    }

    resetOptions() {
        MComponent.resetSubElements(this, '_options');
    }

    onItemSelect(index, item, clickFn) {
        if (index === this.selectedIndex) {
            return;
        }

        item.selectItem();

        for (let i = 0; i < this._options.length; i++) {
            if (item.el !== this._options[i].el) {
                this._options[i].deselectItem();
            }
        }

        this.selectedIndex = index;

        if (this.autoDismiss) {
            this.hide(true);
        }

        if (typeof clickFn === 'function') {
            clickFn();
        }
    }

    selectItem(index) {
        if (index !== this.selectedIndex && this._options[index]) {
            this.onItemSelect(index, this._options[index]);
        }
    }

    hide(hideSiblings) {
        for (let i = 0; i < this._options.length; i++) {
            if (this._options[i].subMenu) {
                this._options[i].subMenu.hide();
            }
        }

        super.hide(hideSiblings);
    }
}

/**
 * @type {Number}
 */
MMenuSelect.selectedIndex = -1;

class MMenuSelectItem extends MComponent {
    /**
     * Creating the menu item
     * @param {Object.<String, any>} props Item Options
     * @param {String|function(): String|HTMLElement} props.label Main item text
     * @param {Function} props.selectFn Callback to trigger when the item is clicked
     * @param {Boolean} props.selected Whether to render the item as selected from the beginning or not
     * @param {String} props.leftIcon Icon on the left of the text
     * @param {String} props.rightIcon Icon on the right of the text
     * @param {String} props.additionalClasses Additional classes to add to the item along with global ones
     * @param {MMenuSelectItem} props.children Additional items to render when hovering above the item
     */
    constructor({
        label,
        selectFn,
        selected,
        selectable,
        leftIcon,
        rightIcon,
        additionalClasses,
        children
    }) {
        super();

        this.selectable = selectable === true;

        // This is a clickable item
        if (typeof selectFn === 'function') {
            this.el.classList.add('m-dropdown-item', 'border-radius-1');

            if (Array.isArray(additionalClasses) && additionalClasses.length) {
                this.el.classList.add(...additionalClasses);
            }

            this.attachEvent('click', (e) => {
                selectFn(this, e);
            });
        }
        else { // This is just a label
            this.el.classList.add('px-2');
            this.el.classList.add('m-dropdown-item-label');
        }

        const labelDiv = document.createElement('div');
        labelDiv.className = 'flex flex-1 text-ellipsis';

        if (label) {
            if (typeof label === 'function') {
                label = label();
            }

            if (label instanceof HTMLElement) {
                labelDiv.appendChild(label);
            }
            else if (typeof label === 'string') {
                labelDiv.textContent = label;
            }
        }

        this.el.append(labelDiv);

        if (leftIcon) {
            this.addLeftIcon(leftIcon);
        }

        if (rightIcon) {
            this.addRightIcon(leftIcon);
        }

        if (selected === true) {
            this.selectItem();
        }
        else if (this.selectable) {
            this.deselectItem();
        }

        if (Array.isArray(children) && children.length) {
            this.children = children;
            this.el.classList.add('contains-submenu', 'sprite-fm-mono-after', 'icon-arrow-right-after');
        }

        this.attachEvent('pointerenter', () => {
            const contextMenu = this.el.parentNode.parentNode;

            const items = contextMenu.querySelectorAll('a');

            for (let i = 0; i < items.length; i++) {
                const otherItem = items[i];

                if (
                    otherItem !== this.el
                    && otherItem.mComponent
                    && otherItem.mComponent.subMenu
                ) {
                    otherItem.mComponent.subMenu.hide();
                    otherItem.classList.remove('opened');
                    delete otherItem.mComponent.subMenu;
                    break;
                }
            }

            if (!Array.isArray(this.children) || !this.children.length || this.subMenu) {
                return;
            }

            const { x, y, right, bottom } = this.el.getBoundingClientRect();

            this.subMenu = new MMenuSelect();
            this.subMenu.parentItem = this;

            this.subMenu.options = children;
            this.subMenu.show(right + MContextMenu.offsetHoriz, y - 8, x - MContextMenu.offsetHoriz, bottom);
            this.el.classList.add('opened');
        });
    }

    buildElement() {
        this.el = document.createElement('a');
        this.el.setAttribute('class', 'flex flex-row items-center');
    }

    createCheck() {
        if (!this.checkEl) {
            this.checkEl = document.createElement('div');
            this.el.prepend(this.checkEl);
        }
    }

    removeCheck() {
        if (this.checkEl) {
            this.el.removeChild(this.checkEl);
            delete this.checkEl;
        }
    }

    selectItem() {
        this.createCheck();
        this.checkEl.className = 'radioOn';
    }

    deselectItem() {
        if (this.selectable) {
            this.createCheck();
            this.checkEl.className = 'radioOff';
        }
        else {
            this.removeCheck();
        }
    }

    addLeftIcon(icon) {
        const i = document.createElement('i');
        i.className = 'mr-4 ml-0 sprite-fm-mono icon-' + icon;

        this.el.prepend(i);
    }

    addRightIcon(icon) {
        const i = document.createElement('i');
        i.className = 'ml-3 mr-0 sprite-fm-mono icon-' + icon;

        this.el.appendChild(i);
    }

    remove() {
        this.disposeEvent('pointerenter');
        this.detachEl();
    }
}

class MSidebarButton extends MButton {
    /**
     * @param {String} label Main button text
     * @param {String} leftIcon Icon on the left of the text
     * @param {Function} clickFn Callback to trigger on click
     * @param {String} additionalClasses Additional classes to use along with the main ones
     */
    constructor(label, leftIcon, clickFn, additionalClasses) {
        super(
            label,
            leftIcon,
            clickFn,
            'btn-galleries js-lpbtn' + (additionalClasses ? ' ' + additionalClasses : '')
        );
    }

    get isExpandable() {
        return this._expandable;
    }

    /**
     * Adding expandable feature to the item
     * @param {Boolean} status Indicating whether the button should be expandable or not
     */
    set isExpandable(status) {
        if (status) {
            if (!this._expandable) {
                const i = document.createElement('i');
                i.className = 'sprite-fm-mono icon-dropdown';
                i.style.marginRight = '0';

                this.el.prepend(i);
                this.el.classList.add('expansion-btn');
                this._expandable = true;
            }
        }
        else {
            const i = this.el.querySelector('i.icon-dropdown');

            if (i) {
                this.el.removeChild(i);
            }

            this._expandable = false;
        }
    }

    get isShared() {
        return !!this.shareIcon;
    }

    /**
     * @param {Boolean} value Share status
     */
    set isShared(value) {
        if (value === this.isShared) {
            return;
        }

        if (value) {
            this.shareIcon = document.createElement('i');
            this.shareIcon.className = 'sprite-fm-mono icon-link-small pointer-events-none icon-size-6';
            this.el.classList.add('is-shared');

            this.el.appendChild(this.shareIcon);
        }
        else {
            this.el.removeChild(this.shareIcon);
            this.el.classList.remove('is-shared');
            delete this.shareIcon;
        }
    }
}

class MTab extends MComponent {
    /**
     * @param {String} label Main text inside the tab
     * @param {Function} clickFn Callback to trigger when tab is clicked
     */
    constructor(label, clickFn) {
        super();

        this.el.textContent = label;

        if (typeof clickFn === 'function') {
            this.attachEvent('click', clickFn);
        }
    }

    buildElement() {
        this.el = document.createElement('div');
        this.el.className = 'py-2 px-6 cursor-pointer';
    }
}

class MTabs extends MComponent {
    buildElement() {
        this.el = document.createElement('div');
        this.el.className = 'm-tabs flex items-center justify-center';
    }

    /**
     * @param {Number} index Current index to set to active
     */
    set activeTab(index) {
        if (this._activeTab === index) {
            return;
        }

        this._activeTab = index;

        for (let i = 0; i < this._tabs.length; i++) {
            this._tabs[i].el.classList[i === index ? 'add' : 'remove']('active');
        }
    }

    /**
     * @param {Object[]} tabs Array of Tab objects to work with
     * @param {String} tabs[].label - Label of the option
     * @param {Function} tabs[].click - A specific behaviour when option is clicked
     */
    set tabs(tabs) {
        this.resetTabs();

        for (let i = 0; i < tabs.length; i++) {
            const { label, click } = tabs[i];

            const tab = new MTab(label, click);

            this._tabs.push(tab);
            this.el.appendChild(tab.el);
        }
    }

    resetTabs() {
        MComponent.resetSubElements(this, '_tabs');
    }
}

(function(scope, $) {
    var isFirefox = navigator.userAgent.indexOf("Firefox") > -1;
    var isIE = navigator.userAgent.indexOf('Edge/') > -1 || navigator.userAgent.indexOf('Trident/') > -1;

    /**
     * Internal/private helper method for doing 'assert's.
     *
     * @param val {boolean}
     * @param msg {String}
     */
    var assert = function(val, msg) {
        if (!val) {
            throw new Error(msg ? msg : "Assertion Failed.");
        }
    };

    /**
     * DOM utilities
     *
     * @type {{}}
     */
    var DOMUtils = {};

    /**
     * Optimised/faster DOM node removal method
     *
     * @param node
     */
    DOMUtils.removeNode = function(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
        // else - parentNode is already removed.
    };

    /**
     * Helper for .appendAfter
     *
     * @param newElement
     * @param targetElement
     */
    DOMUtils.appendAfter = function(newElement, targetElement) {
        // target is what you want it to go after. Look for this elements parent.
        var parent = targetElement.parentNode;

        if (!parent) {
            // TODO: fix me properly...
            console.warn('The target element got detached from the DOM...', [targetElement]);
            return false;
        }

        // if the parents lastchild is the targetElement...
        if (parent.lastElementChild === targetElement) {
            // add the newElement after the target element.
            parent.appendChild(newElement);
        } else {
            // else the target has siblings, insert the new element between the target and it's next sibling.
            parent.insertBefore(newElement, targetElement.nextElementSibling);
        }
    };

    /**
     * Helper for .prepend
     *
     * @param newElement
     * @param targetElement
     */
    DOMUtils.prepend = function(newElement, targetElement) {
        if (targetElement.prepend) {
            targetElement.prepend(newElement)
        }
        else {
            if (targetElement.firstElementChild) {
                targetElement.insertBefore(newElement, targetElement.firstElementChild);
            }
            else {
                targetElement.appendChild(newElement);
            }
        }
    };

    var SETTINGS = {

        /**
         * Callback should return the height of item at id.
         * Callback should satisfy the signature function(id) -> height (int)
         */
        'itemHeightCallback': false,

        /**
         * A Callback function, that receives 1 argument - itemID (string/int) and should return a DOM Object, HTML
         * String or a jQuery object that is the actual DOM node to be rendered/appended to the list.
         */
        'itemRenderFunction': false,

        /**
         * Pass any PerfectScrollbar options here.
         */
        'perfectScrollOptions': {},

        /**
         * Force MegaDynamicList to trigger a 'onUserScroll' jQuery Event if needed.
         */
        'enableUserScrollEvent': false,

        /**
         * Triggered when the content is updated.
         */
        'onContentUpdated': false,

        /**
         * Offscreen buffer to keep rendered in px.
         */
        'viewPortBuffer': 50,

        /**
         * Custom callback for when the view changes.
         */
        'onViewChange': false,

        /**
         * Custom callback only triggeed when new nodes are inserted into the DOM.
         * Can satisfy signature (Array injectedIds) => void
         */
        'onNodeInjected': false,

        /**
         * Custom classes to add to the contentContainer. (The actual content div that gets scrolled.
         */
        'contentContainerClasses': false,

        /**
         * Optional resize callback.
         */
        'onResize': false,

        /**
         * On scroll callback.
         */
        'onScroll': false,

        /**
         * Initial scroll position.
         */
        'initialScrollY': false
    };

    /**
     * Helper variable, that create unique IDs by auto incrementing for every new MegaDynamicList that gets initialised.
     *
     * @type {number}
     */
    var listId = 0;

    /**
     * MegaDynamicList allows for rendering a list inside of a viewport. Only items which are within the visible range
     * will be rendered.
     *
     * @param listContainer {String|jQuery|DOMNode} the container, which would be used to append list items
     * @param options {Object} see SETTINGS for defaults and available options.
     * @constructor
     */
    var MegaDynamicList = function (listContainer, options) {
        assert(options.itemRenderFunction, 'itemRenderFunction was not provided.');
        assert(options.itemHeightCallback, 'itemHeightCallback was not provided.');

        this.listId = listId++;

        this.$listContainer = $(listContainer);
        this.$listContainer
            .css({'position': 'relative'})
            .addClass("MegaDynamicList");
        this.listContainer = this.$listContainer[0];
        this.prepusher = null;

        this._lastScrollPosY = -1;

        var items = options.items;
        delete options.items;
        if (!items) {
            items = [];
        }
        this.items = items;

        // Maintains the height of each item in the list.
        this._heights = {};

        // Maintains the top-offset for each item in the list.
        this._offsets = {};

        this._wasRendered = false;

        /**
         * A dynamic cache to be used as a width/height/numeric calculations
         *
         * @type {{}}
         * @private
         */
        this._calculated = {};

        // Remember the last range before scrolling.
        this._lastFirstPos = 0;
        this._lastLastPos = 0;
        this._lastFirstItem = null;
        this._lastLastItem = null;

        // Indicates if this list is currently rendered and listening for events.
        this.active = true;

        // Saved state such that when we resume we can restore to the same position.
        this._state = {};

        /**
         * A map of IDs which are currently rendered (cached as a map, so that we can reduce access to the DOM)
         *
         * @type {Array}
         * @private
         */
        this._currentlyRendered = {};

        this.options = $.extend({}, SETTINGS, options);

        this._debug = d || 0;
    };

    /**
     * Do the initial render, setting up the content container and scrolling.
     */
    MegaDynamicList.prototype.initialRender = function() {
        assert(this._wasRendered === false, 'This MegaDynamicList is already rendered');

        if (!this.$content) {
            this.$content = $('<div class="MegaDynamicList-content"><div class="pre-pusher"></div></div>');
            this.$content.css({
                'position': 'relative'
            });

            if (this.options.contentContainerClasses) {
                this.$content.addClass(this.options.contentContainerClasses);
            }

            this.content = this.$content[0];

            this.listContainer.appendChild(this.content);
            this.prepusher = this.$content.find(".pre-pusher")[0];
        }

        // init PS
        Ps.initialize(this.listContainer, this.options.perfectScrollOptions);
        this._wasRendered = true;
        this._isUserScroll = true;



        this._onContentUpdated();

        // bind events
        this._bindEvents();
        this._calculateHeightAndOffsets(true);
        if (this.options.initialScrollY) {
            this.listContainer.scrollTop = this.options.initialScrollY;
        }
        this._calculateScrollValues();
        this._viewChanged(true);
    };

    /**
     * Calculate the total height + offsets of each item on screen.
     * @private
     */
    MegaDynamicList.prototype._calculateHeightAndOffsets = function (applyHeight) {
        'use strict';
        var totalHeight = 0;
        for (var i = 0; i < this.items.length; i++) {
            var key = this.items[i];
            if (!this._heights[key]) {
                this._heights[key] = this.options.itemHeightCallback(key);
            }
            this._offsets[key] = totalHeight;
            totalHeight += this._heights[key];
            this._heights[key] = this._heights[key];
        }
        this._calculated['contentHeight'] = totalHeight;
        if (applyHeight) {
            this.content.style.height = this._calculated['contentHeight'] + "px";
            Ps.update(this.listContainer);
        }
    };

    /**
     * Should be triggered when an items render properties are changed (eg Height).
     * @param index
     */
    MegaDynamicList.prototype.itemRenderChanged = function(id, domCheck) {
        'use strict';
        this._updateHeight(id);
        this._viewChanged(domCheck);
    };

    /**
     * Force a DOM element to be re-collected from the collector function if it is in view.
     * @param id
     */
    MegaDynamicList.prototype.itemChanged = function(id) {
        'use strict';
        if (this.active && this._currentlyRendered[id]) {
            this._removeItemFromView(id);
            this._updateHeight(id);
            this._viewChanged(true);
        }
    };

    /**
     * Handle when an items height changes.
     * @param index
     * @private
     */
    MegaDynamicList.prototype._updateHeight = function(id) {
        'use strict';

        let list;

        if (id) {
            list = [id];
        }
        else {
            list = this.items;
        }

        for (var i = 0; i < list.length; i++) {
            var key = list[i];

            var newHeight = this.options.itemHeightCallback(key);
            this._calculated['contentHeight'] += newHeight - this._heights[key];
            this._heights[key] = newHeight;
        }
        this.content.style.height = this._calculated['contentHeight'] + "px";
        this._calculateHeightAndOffsets(true);

        // scrolled out of the viewport if the last item in the list was removed? scroll back a little bit...
        if (this._calculated['scrollHeight'] + this._calculated['scrollTop'] > this._calculated['contentHeight']) {

            this.listContainer.scrollTop = this._calculated['contentHeight'] - this._calculated['scrollHeight'];
            this._isUserScroll = false;
            Ps.update(this.listContainer);
            this._isUserScroll = true;
        }
    };

    /**
     * Update all offsets below the start index.
     * @param startIndex Index to start at.
     * @param offset The offset for the first item.
     * @private
     */
    MegaDynamicList.prototype._updateOffsetsFrom = function(startIndex, offset) {
        'use strict';
        for (var i = startIndex; i < this.items.length; i++) {
            var id = this.items[i];
            this._offsets[id] = offset;
            if (!this._heights[id]) {
                this._heights[id] = this.options.itemHeightCallback(id);
            }
            offset += this._heights[id];
        }
    };

    /**
     * Calculate the scroll offset and viewport height.
     * @private
     */
    MegaDynamicList.prototype._calculateScrollValues = function() {
        'use strict';
        this._calculated['scrollTop'] = this.listContainer.scrollTop;
        this._calculated['scrollHeight'] = this.$listContainer.innerHeight();
    };

    /**
     * Calculate the first and last items visible on screen.
     * @private
     */
    MegaDynamicList.prototype._calculateFirstLast = function() {
        'use strict';
        var viewportTop = this._calculated['scrollTop'] - this.options.viewPortBuffer;
        var viewportBottom = viewportTop + this._calculated['scrollHeight'] + this.options.viewPortBuffer;
        var i = 0;
        while (this._offsets[this.items[i]] < viewportTop && i < this.items.length - 1) {
            i++;
        }
        var top = i;
        if (this._offsets[this.items[i]] > viewportTop) {
            top = Math.max(0, i - 1);
        }
        while (this._offsets[this.items[i]] < viewportBottom && i < this.items.length - 1) {
            i++;
        }
        this._calculated['firstItemPos'] = top;
        this._calculated['lastItemPos'] = i;
        this._calculated['firstItem'] = this.items[top];
        this._calculated['lastItem'] = this.items[i];
    };

    /**
     * Triggered when the view is changed.
     * @private
     */
    MegaDynamicList.prototype._viewChanged = function(forceDOMCheck) {
        'use strict';
        this._calculateScrollValues();
        this._calculateFirstLast();
        if (forceDOMCheck
            || this._calculated['firstItemPos'] !== this._lastFirstPos || this._calculated['lastItemPos'] !== this._lastLastPos
            || this._calculated['firstItem'] !== this._lastFirstItem || this._calculated['lastItem'] !== this._lastLastItem
        ) {
            this._applyDOMChanges();
        }
        this._lastFirstPos = this._calculated['firstItemPos'];
        this._lastLastPos = this._calculated['lastItemPos'];
        this._lastFirstItem = this._calculated['firstItem'];
        this._lastLastItem = this._calculated['lastItem'];

        if (this.options.onViewChange) {
            this.options.onViewChange();
        }
    };

    /**
     * Apply any required DOM Changes.
     * @private
     */
    MegaDynamicList.prototype._applyDOMChanges = function() {
        var contentHasChanged = false;
        var nodeInjected = [];
        var low = this._calculated['firstItemPos'];
        var high = this._calculated['lastItemPos'];
        if (high < this.items.length) {
            high += 1;
        }

        for (var i = 0; i < this.items.length; i++) {
            var id = this.items[i];
            if (this._currentlyRendered[id] !== undefined && (i < low || i > high)) {
                this._removeItemFromView(id);
                contentHasChanged = true;
            }
        }
        for (var i = low; i < high; i++) {
            var id = this.items[i];
            if (!this._currentlyRendered[id]) {
                this._currentlyRendered[id] = this.options.itemRenderFunction(id, i);
                this._currentlyRendered[id].classList.add("MegaDynamicListItem");
                var afterTarget;
                if (this._currentlyRendered[this.items[i - 1]]) {
                    afterTarget = this._currentlyRendered[this.items[i - 1]];
                } else {
                    afterTarget = this.prepusher;
                }
                DOMUtils.appendAfter(this._currentlyRendered[id], afterTarget);
                contentHasChanged = true;
                nodeInjected.push(id);
            }
        }
        this.prepusher.style.height = this._offsets[this.items[low]] + "px";
        if (contentHasChanged) {
            this._onContentUpdated();
            if (nodeInjected) {
                this._onNodeInjected(nodeInjected);
            }
        }
    };

    MegaDynamicList.prototype.add = function (item) {
        'use strict';
        this.batchAdd([item]);
    };

    /**
     * Optimised adding of entries, less DOM updates
     *
     * @param itemIdsArray {Array} Array of item IDs (Strings)
     */
    MegaDynamicList.prototype.batchAdd = function (itemIdsArray) {
        var self = this;
        itemIdsArray.forEach(function(itemId) {
            self.items.push(itemId);
        });
    };

    /**
     * Internal method to trigger when the dom content is changed.
     * @private
     */
    MegaDynamicList.prototype._onContentUpdated = function() {
        'use strict';
        if (this.options.onContentUpdated) {
            this.options.onContentUpdated();
        }
    };

    /**
     * Similiar to onContentUpdated but will only trigger if a new node added to the view not if a node is removed.
     * @private
     */
    MegaDynamicList.prototype._onNodeInjected = function(itemId) {
        if (this.options.onNodeInjected) {
            this.options.onNodeInjected(itemId);
        }
    };

    /**
     * Internal method used for generating unique (per MegaDynamicList) instance namespace string. (not prepended with "."!)
     *
     * @returns {string}
     * @private
     */
    MegaDynamicList.prototype._generateEventNamespace = function() {
        return "MegaDynamicList" + this.listId;
    };

    /**
     * Should be called when the list container is resized.
     * This method would be automatically called on window resize, so no need to do that in the implementing code.
     */
    MegaDynamicList.prototype.resized = function () {
        'use strict';
        this._calculateScrollValues();
        this._viewChanged();

        if (this.options.onResize) {
            this.options.onResize();
        }

        // all done, trigger a resize!
        $(this).trigger('resize');
    };

    MegaDynamicList.prototype._actualOnScrollCode = function(e) {
        var self = this;
        if (self.options.onScroll) {
            self.options.onScroll();
        }
        self._onScroll(e);
    };

    MegaDynamicList.prototype.throttledOnScroll = function(e) {
        var self = this;
        delay('megadynamiclist:scroll:' + this.listId, function() {
            if (self._isUserScroll === true && self.listContainer === e.target) {
                if (self.options.enableUserScrollEvent) {
                    self.trigger('onUserScroll', e);
                }
                self._onScroll(e);
            }
        }, 1);
    };

    /**
     * Internal method that gets called when the user scrolls.
     *
     * @param e {Event}
     * @private
     */
    MegaDynamicList.prototype._onScroll = function(e) {
        this._calculateScrollValues();
        this._viewChanged();
    };

    /**
     * Internal method that would be called when the MegaDynamicList renders to the DOM UI and is responsible for binding
     * the DOM events.
     *
     * @private
     */
    MegaDynamicList.prototype._bindEvents = function () {
        var self = this;
        var ns = self._generateEventNamespace();

        $(window).rebind("resize." + ns, function() {
            self.resized();
        });

        $('.ps').rebind('ps-scroll-y.ps' + ns, self.throttledOnScroll.bind(self));
    };

    /**
     * Called when .destroy is triggered. Should unbind any DOM events added by this MegaDynamicList instance.
     *
     * @private
     */
    MegaDynamicList.prototype._unbindEvents = function () {
        var ns = this._generateEventNamespace();

        $(window).off("resize." + ns);
        $('.ps').off('ps-scroll-y.ps' + ns);
    };

    /**
     * Insert a new item into the list.
     * @param after
     * @param id
     */
    MegaDynamicList.prototype.insert = function(after, id, renderUpdate) {
        'use strict';
        if (renderUpdate !== false) {
            renderUpdate = true;
        }

        var position;
        if (!after) {
            position = 0;
        } else {
            position = this.items.indexOf(after) + 1;
        }
        
        if (Array.isArray(id) === false) {
            id = [id];
        }

        [].splice.apply(this.items, [position, 0].concat(id));
        this._calculateHeightAndOffsets(true);
        if (renderUpdate) {
            this._viewChanged(true);
        }
    };

    /**
     * Remove an item from the list.
     * @param id
     */
    MegaDynamicList.prototype.remove = function(id, renderUpdate) {
        'use strict';
        if (renderUpdate !== false) {
            renderUpdate = true;
        }

        if (!Array.isArray(id)) {
            id = [id];
        }
        var position = this.items.indexOf(id[0]);
        this.items.splice(position, id.length);

        // Ensure that they are not currently rendered.
        for (var i =0; i < id.length; i++) {
            this._removeItemFromView(id[i]);
        }
        this._calculateHeightAndOffsets(true);
        if (renderUpdate) {
            this._viewChanged(true);
        }

    };

    /**
     * Remove an item from the view.
     * @param id
     * @private
     */
    MegaDynamicList.prototype._removeItemFromView = function(id) {
        'use strict';
        if (this._currentlyRendered[id]) {
            DOMUtils.removeNode(this._currentlyRendered[id]);
            delete this._currentlyRendered[id];
        }
    };

    /**
     * Destroy this instance.
     */
    MegaDynamicList.prototype.destroy = function() {
        'use strict';
        this._unbindEvents();
        this.items = [];
        this._wasRendered = false;
        Ps.destroy(this.listContainer);
        DOMUtils.removeNode(this.content);
        this.$listContainer.html("");
        this.$content = this.content = undefined;
    };

    /**
     * Should be triggered when the list is no longer in view.
     */
    MegaDynamicList.prototype.pause = function() {
        'use strict';
        this.active = false;
        this._state = this._calculated;
        this._unbindEvents();
        Ps.destroy(this.listContainer);
        var currentlyRenderedKeys = Object.keys(this._currentlyRendered);
        for (var i = 0; i < currentlyRenderedKeys.length; i++) {
            this._removeItemFromView(currentlyRenderedKeys[i]);
        }
    };

    /**
     * Resume state, should be called when the list is brought back into view.
     */
    MegaDynamicList.prototype.resume = function() {
        'use strict';
        this.active = true;
        this._wasRendered = false;
        this.initialRender();
    };

    /**
     * Returns the current top position of the scrollable area
     *
     * @returns {number|*|Number|undefined}
     */
    MegaDynamicList.prototype.getScrollTop = function() {
        return this.listContainer.scrollTop;
    };

    MegaDynamicList.prototype.getFirstItemPosition = function() {
        'use strict';
        return this._calculated['firstItemPos'];
    };

    MegaDynamicList.prototype.scrollToItemPosition = function(position) {
        'use strict';
        this.listContainer.scrollTop = this._offsets[this.items[position]] + (this.options.viewPortBuffer * 2);
        this._viewChanged(true);
    };

    MegaDynamicList.prototype.scrollToItem = function(item) {
        'use strict';
        this.listContainer.scrollTop = this._offsets[item]
        this._viewChanged(true);
    };

    MegaDynamicList.prototype.scrollToYPosition = function(value) {

        'use strict';

        this.listContainer.scrollTop = value;
        this._viewChanged(true);
    }

    scope.MegaDynamicList = MegaDynamicList;
})(window, jQuery);

/**
 * Simple way for searching for nodes by their first letter.
 *
 * PS: This is meant to be somehow reusable.
 *
 * @param searchable_elements selector/elements a list/selector of elements which should be searched for the user
 * specified key press character
 * @param containers selector/elements a list/selector of containers to which the input field will be centered
 * (the code will dynamically detect and pick the :visible container)
 *
 * @returns {*}
 * @constructor
 */
var QuickFinder = function(searchable_elements, containers) {
    'use strict'; /* jshint -W074 */

    var self = this;

    var DEBUG = false;

    self._is_active = false; // defined as a prop of this. so that when in debug mode it can be easily accessed from
    // out of this scope

    var last_key = null;
    var next_idx = 0;

    // Defined allowed dialogs' name
    var allowedDialogs = {'copy':true, 'move':true};

    // hide on page change
    if (QuickFinder._pageChangeListenerId) {
        mBroadcaster.removeListener(QuickFinder._pageChangeListenerId);
    }
    QuickFinder._pageChangeListenerId = mBroadcaster.addListener('pagechange', function () {
        if (self.is_active()) {
            self.deactivate();
        }
        // Clear the repeat key press setting if change the page
        last_key = null;
    });

    $(window).rebind('keypress.quickFinder', function(e) {
        if (!window.M || M.chat) {
            return;
        }

        e = e || window.event;
        // DO NOT start the search in case that the user is typing something in a form field... (eg.g. contacts -> add
        // contact field)
        if ($(e.target).is("input, textarea, select") || ($.dialog && !allowedDialogs[$.dialog])) {
            return;
        }

        var charCode = e.which || e.keyCode; // ff

        if (
            (charCode >= 48 && charCode <= 57) ||
            (charCode >= 65 && charCode <= 123) ||
            charCode > 255
        ) {
            var charTyped = String.fromCharCode(charCode);

            // get the currently visible container
            var $container = $(containers).filter(":visible");
            if (!$container.length) {
                // no active container, this means that we are receiving events for a page, for which we should not
                // do anything....
                return;
            }

            self._is_active = true;

            $(self).trigger("activated");
            self.was_activated();


            var foundIds = [];
            var isCopyToChat = false;

            charTyped = charTyped.toLowerCase();

            var nodesList = M.v;
            if ($.dialog && allowedDialogs[$.dialog]) {
                // Assign different nodes list depending on different panels
                var activePanel = $('.dialog-content-block').closest('.fm-picker-dialog-tree-panel.active');
                if (activePanel.hasClass('cloud-drive')) {
                    nodesList = Object.values(M.tree[M.RootID]);
                }
                else if (activePanel.hasClass('shared-with-me')) {
                    nodesList = Object.values(M.tree.shares);
                }
                else if (activePanel.hasClass('conversations')) {
                    isCopyToChat = true;
                    nodesList = [];
                    var allContactElements = $('span.nw-contact-item', activePanel).get();

                    for (var c = 0; c < allContactElements.length; c++) {
                        var $contactElement = $(allContactElements[c]);
                        var contactHandle = $contactElement.attr('id').replace('cpy-dlg-chat-itm-spn-', '');
                        var contactName = $('span.nw-contact-name', $contactElement).text();
                        nodesList.push({name: contactName, h: contactHandle});
                    }
                }
                else {
                    // Other panels rather than cloud-drive, share-with-me and send-to-chat
                    return;
                }

                if (!isCopyToChat) {
                    // Sort the node list by name except for the conversations panel
                    nodesList.sort(function(a, b) {
                        var aName = a.name.toUpperCase();
                        var bName = b.name.toUpperCase();
                        return M.compareStrings(aName, bName, d);
                    });
                }
            }

            foundIds = nodesList.filter(function(v) {
                var nameStr = "";
                if (v.name) {
                    nameStr = v.name;
                }
                else if (v.firstName) {
                    nameStr = v.firstName;
                }
                else if (v.m) {
                    // ipc and opc
                    nameStr = v.m;
                }

                if (nameStr && nameStr[0] && nameStr[0].toLowerCase() === charTyped) {
                    return true;
                }

                return false;
            });

            if ($.dialog && allowedDialogs[$.dialog]) {
                if (foundIds.length > 0) {
                    // Fetch the first node after quick finding
                    var dialogQuickIndex = 0;
                    var $dialogQuickFindNode;

                    if (isCopyToChat) {
                        // When it's in the conversations panel
                        $dialogQuickFindNode = $('#cpy-dlg-chat-itm-spn-' + foundIds[0].h);
                    }
                    else {
                        // When it's in the cloud-drive or share-with-me panel
                        for (var i = 0; i < foundIds.length; i++) {
                            $dialogQuickFindNode = $('.nw-fm-tree-item#mctreea_' + foundIds[dialogQuickIndex].h);
                            if (!$dialogQuickFindNode.hasClass('disabled')) {
                                // cloud-drive panel: Acquire the first node except for $.selected itself
                                // share-with-me panel: Acquire the first node with the write permission
                                break;
                            }
                            $dialogQuickFindNode = null;
                            dialogQuickIndex++;
                        }
                    }

                    if ($dialogQuickFindNode && !$dialogQuickFindNode.hasClass('selected')) {
                        $dialogQuickFindNode.trigger('click');
                    }
                }
                return;
            }

            if (
                /* repeat key press, but show start from the first element */
            (last_key != null && (foundIds.length - 1) <= next_idx)
            ||
            /* repeat key press is not active, should reset the target idx to always select the first
             element */
            (last_key == null)
            ) {
                next_idx = 0;
                last_key = null;
            } else if (last_key == charTyped) {
                next_idx++;
            } else if (last_key != charTyped) {
                next_idx = 0;
            }
            last_key = charTyped;
            if (foundIds[next_idx]) {
                var nextId = selectionManager.resetTo(foundIds[next_idx], true);

                if (!M.megaRender.megaList) {
                    $(searchable_elements).parents(".ui-selectee, .ui-draggable").removeClass('ui-selected');

                    var $target_elm = $('#' + nextId);

                    $target_elm.parents(".ui-selectee, .ui-draggable").addClass("ui-selected");

                    const $scrollBlock = $target_elm.closest('.ps');
                    if ($scrollBlock.length) {
                        let $scrolled_elm = $target_elm.parent('a');

                        if (!$scrolled_elm.length) { // not in icon view, its a list view, search for a tr
                            $scrolled_elm = $target_elm.parents('tr:first');
                        }
                        $scrollBlock.scrollTop($scrolled_elm.position().top + $scrollBlock.scrollTop());
                    }

                    $(self).trigger('search');
                }
            }
        }
        else if (charCode >= 33 && charCode <= 36)
        {
            var elem = '.files-grid-view.fm';
            if (M.viewmode == 1) {
                elem = '.fm-blocks-view.fm';
            }

            if (M.megaRender && M.megaRender.megaList) {
                switch (charCode) {
                    case 33: /* Page Up   */
                        M.megaRender.megaList.scrollPageUp();
                        break;
                    case 34: /* Page Down */
                        M.megaRender.megaList.scrollPageDown();
                        break;
                    case 35: /* End       */
                        M.megaRender.megaList.scrollToBottom();
                        break;
                    case 36: /* Home      */
                        M.megaRender.megaList.scrollToTop();
                        break;
                }
            }
            else if ($(`${elem}:visible`).length) {
                elem = $('.grid-scrolling-table:visible, .file-block-scrolling:visible');
                const $scrollBlock = elem.closest('.ps');

                if ($scrollBlock.length) {
                    switch (charCode) {
                        case 33: /* Page Up   */
                            $scrollBlock.scrollTop($scrollBlock.scrollTop() - elem.height());
                            break;
                        case 34: /* Page Down */
                            $scrollBlock.scrollTop($scrollBlock.scrollTop() + elem.height());
                            break;
                        case 35: /* End       */
                            $scrollBlock.scrollTop($scrollBlock.prop('scrollHeight'));
                            break;
                        case 36: /* Home      */
                            $scrollBlock.scrollTop(0);
                            break;
                    }
                }
            }
        }
    });

    self.was_activated = function() {
        // hide the search field when the user had clicked somewhere in the document
        $(document.body).on('mousedown.qfinder', '> *', function () {
            if (!is_fm()) {
                return;
            }
            if (self.is_active()) {
                self.deactivate();
                return false;
            }
        });
    };

    // use events as a way to communicate with this from the outside world.
    self.deactivate = function() {
        self._is_active = false;
        $(self).trigger("deactivated");
        $(document.body).off('mousedown.qfinder', '> *');
    };

    self.is_active = function() {
        return self._is_active;
    };

    self.disable_if_active = function() {
        if (self.is_active()) {
            self.deactivate();
        }
    };

    return this;
};

var quickFinder = new QuickFinder(
    '.tranfer-filetype-txt, .file-block-title, li span.nw-fm-tree-folder',
    '.files-grid-view, .fm-blocks-view.fm, .fm-picker-dialog .dialog-content-block'
);

/**
 * Base class for selection managers.
 * Don't use directly.
 *
 * @abstract
 */
class SelectionManager2Base {
    constructor(eventHandlers) {
        var idx = ++mIncID;

        this.idx = idx;

        this.debugMode = !!localStorage.selectionManagerDebug;

        this.idMapper = n => n.h || String(n);

        /**
         * Store all selected items in an _ordered_ array.
         *
         * @type {Array}
         */
        this.selected_list = [];
        this.removing_list = [];

        this.selected_totalSize = 0;

        this.last_selected = null;
        this.eventHandlers = eventHandlers || {};
        this.eventHandlers.onSelectedUpdated = this.eventHandlers.onSelectedUpdated || nop;

        this.NOT_IMPLEMENTED_STR = "Not implemented.";
        this.CLS_UI_SELECTED = "ui-selected";
    }


    /**
     * Should be implemented by classes. Would be called when scrolling is required to specific
     * node handle
     *
     * @abstract
     * @param {String} nodeHandle the actual node handle
     */
    scrollToElementProxyMethod(nodeHandle) {
        console.error("Not implemented. Arg: ", nodeHandle);
    }


    /**
     * Used by grid math, to calculate how much items are shown per rown in the UI
     *
     * @abstract
     */
    get items_per_row() {
        console.error(this.NOT_IMPLEMENTED_STR);
        return 0;
    }

    /**
     * Helper func to clear old reset state from other icons.
     */
    clear_last_selected() {
        if (this.last_selected) {
            this.last_selected = null;
        }
    }

    /**
     * Clears the whole selection
     */
    clear_selection() {
        const res = this.selected_list;

        this.selected_list = [];
        this.clear_last_selected();

        this.eventHandlers.onSelectedUpdated(this.selected_list);
        delete this.shiftFirst;

        return res;
    }

    /**
     * Clear the current selection and select only the pointed item instead
     * @param {Array|String|MegaNode} item Either a MegaNode, and array of them, or its handle.
     * @param {Boolean} [scrollTo] Whether the item shall be scrolled into view.
     * @returns {String} The node handle
     */
    resetTo(item, scrollTo) {
        this.clear_selection();
        return this.set_currently_selected(item, scrollTo);
    }

    /**
     * The idea of this method is to _validate_ and return the .currently-selected element.
     *
     * @returns {String|Boolean} node id
     */
    get_currently_selected() {
        if (this.last_selected) {
            return this.last_selected;
        }
        else {
            return false;
        }
    }

    /**
     * Get safe list item..
     * @param {Array|String|MegaNode} item Either a MegaNode, and array of them, or its handle.
     * @returns {String|Boolean} Either the node handle as an string or false if unable to determine.
     * @private
     */
    _getSafeListItem(item) {
        if (typeof item !== 'string') {
            if (!(item instanceof MegaNode)) {
                item = item && item[item.length - 1] || false;
            }

            if (item && typeof item !== 'string') {
                item = this.idMapper(item) || false;
            }
        }
        return item;
    }

    /**
     * Used from the shortcut keys code.
     *
     * @param nodeId
     */
    set_currently_selected(nodeId, scrollTo) {
        this.clear_last_selected();

        nodeId = this._getSafeListItem(nodeId);
        if (!nodeId || !this.selected_list.includes(nodeId)) {
            if (nodeId) {
                this.add_to_selection(nodeId, scrollTo);
            }
            return nodeId;
        }
        this.last_selected = nodeId;

        if (scrollTo) {
            this.scrollToElementProxyMethod(nodeId);
        }

        // If info panel is open change its attributes by current selected node
        mega.ui.mInfoPanel.reRenderIfVisible($.selected);

        return nodeId;
    }

    /**
     * Add an item (`nodeId`) to selection
     *
     * @param {String} nodeId the id of the node
     * @param {boolean} [scrollTo] true/false if SelectionManager should scroll to that item
     * @param {boolean} [alreadySorted] true/false if requires sorting or its already sorted
     * @returns {boolean} true/false if added
     */
    add_to_selection(nodeId, scrollTo, alreadySorted) {
        var tmp = this._getSafeListItem(nodeId);
        if (!tmp) {
            console.error("Unable to determine item type...", nodeId);
            return false;
        }
        nodeId = tmp;

        if (!this.selected_list.includes(nodeId)) {
            this.selected_list.push(nodeId);

            this.set_currently_selected(nodeId, scrollTo);

            if (!alreadySorted) {
                // shift + up/down requires the selected_list to be in the same order as in this.items
                // (e.g. render order)
                var currentViewOrderMap = {};
                const items = this.items;
                for (var j = 0; j < items.length; ++j) {
                    currentViewOrderMap[this.idMapper(items[j])] = j;
                }

                // sort this.selected_list as in this.items
                this.selected_list.sort(function(a, b) {
                    var aa = currentViewOrderMap[a];
                    var bb = currentViewOrderMap[b];
                    if (aa < bb) {
                        return -1;
                    }
                    if (aa > bb) {
                        return 1;
                    }

                    return 0;
                });
            }
        }
        this.eventHandlers.onSelectedUpdated(this.selected_list);
        if (this.debugMode) {
            console.error("commit: ", JSON.stringify(this.selected_list), self);
        }
        return true;
    }

    /**
     * Remove item from selection
     * @param {String} nodeId the id of the node
     */
    remove_from_selection(nodeId) {
        var foundIndex = this.selected_list.indexOf(nodeId);

        if (foundIndex > -1) {
            this.selected_list.splice(foundIndex, 1);
            if (this.last_selected === nodeId) {
                this.last_selected = null;
            }
            this.eventHandlers.onSelectedUpdated(this.selected_list);
            if (this.debugMode) {
                console.error("commit: ", JSON.stringify(this.selected_list));
            }

            this.removing_list.push(nodeId);
        }
        else if (this.debugMode) {
            console.error("can't remove:", nodeId, JSON.stringify(this.selected_list), JSON.stringify($.selected));
        }
    }

    /**
     * Simple helper func, for selecting all elements in the current view in a performant way.
     */
    select_all() {
        this.selected_list = this.items.map(this.idMapper);
        this.eventHandlers.onSelectedUpdated(this.selected_list);
    }

    /**
     * Select next item in list view
     *
     * @param {boolean} shiftKey
     * @param {boolean} scrollTo
     */
    select_next(shiftKey, scrollTo) {
        this._select_pointer(1, shiftKey, scrollTo);
    }

    /**
     * Select previous item in list view
     *
     * @param {boolean} shiftKey
     * @param {boolean} scrollTo
     */
    select_prev(shiftKey, scrollTo) {
        this._select_pointer(-1, shiftKey, scrollTo);
    }

    _select_pointer(ptr, shiftKey, scrollTo) {
        var nextId = null;
        var currentViewIds = this.items.map(this.idMapper);
        var current = this.get_currently_selected();
        var nextIndex = currentViewIds.indexOf(current);

        if (ptr === -1) {
            // up

            // allow selection to go backwards, e.g. start selecting from the end of the list
            nextIndex = nextIndex <= 0 ? currentViewIds.length - Math.max(nextIndex, 0) : nextIndex;

            if (nextIndex > -1 && nextIndex - 1 >= 0) {
                nextId = currentViewIds[nextIndex - 1];

                // clear old selection if no shiftKey
                if (!shiftKey) {
                    this.resetTo(nextId, scrollTo);
                }
                else if (nextIndex < currentViewIds.length) {
                    // shift key selection logic
                    if (
                        this.selected_list.length > 0 &&
                        this.selected_list.includes(nextId)
                    ) {
                        // get first item from the list
                        var firstItemId = this.selected_list[0];

                        // modify selection
                        this.shift_select_to(nextId, scrollTo, false, false);
                    }
                    else {
                        this.add_to_selection(nextId, scrollTo, false);

                        if (!this.shiftFirst) {
                            this.shiftFirst = current;
                        }
                    }

                    // Rerender if info panel is visible when selecting node via shorcut
                    mega.ui.mInfoPanel.reRenderIfVisible($.selected);
                }
            }
        }
        else if (ptr === 1) {
            // down

            // allow selection to go back at the start of the list if current = last selected
            nextIndex = (
                nextIndex + 1 >= currentViewIds.length ? -1 : nextIndex
            );

            if (nextIndex + 1 < currentViewIds.length) {
                nextId = currentViewIds[nextIndex + 1];

                // clear old selection if no shiftKey
                if (!shiftKey) {
                    this.resetTo(nextId, scrollTo);
                }
                else if (nextIndex > -1) {
                    // shift key selection logic

                    if (
                        this.selected_list.length > 1 &&
                        this.selected_list.includes(nextId)
                    ) {
                        // get last item from the list
                        var fromFirstItemId = this.selected_list[1];
                        var lastItemId = this.selected_list[this.selected_list.length - 1];


                        // modify selection
                        this.shift_select_to(nextId, scrollTo, false, false);
                        this.last_selected = fromFirstItemId;
                    }
                    else {
                        this.add_to_selection(nextId, scrollTo, false);

                        if (!this.shiftFirst) {
                            this.shiftFirst = current;
                        }
                    }
                }
            }
        }
    }

    _select_ptr_grid(ptr, shiftKey, scrollTo) {
        const items = this.items;
        if (!Object(items).length) {
            // Nothing to do here.
            return;
        }

        if (this.selected_list.length === 0) {
            this.set_currently_selected(this.idMapper(items[0]), scrollTo);
            return;
        }

        var currentViewIds = items.map(this.idMapper);
        var items_per_row = this.items_per_row;
        var current = this.get_currently_selected();

        var current_idx = currentViewIds.indexOf(current);
        var target_element_num;

        if (ptr === -1) { // up
            // handle the case when the users presses UP and the current row is the first row
            target_element_num = Math.max(current_idx - items_per_row, 0);
        }
        else if (ptr === 1) { // down

            // if user is already in the last row just ignore this.
            if ((current_idx / items_per_row | 0) === (items.length / items_per_row | 0)) {
                return;
            }

            // handle the case when the users presses DOWN and the current row is one before the last row
            target_element_num = Math.min(current_idx + items_per_row, currentViewIds.length - 1);
        }
        else {
            assert('selectionManager._select_ptr_grid received invalid pointer: ' + ptr);
        }

        if (shiftKey) {
            this.shift_select_to(currentViewIds[target_element_num], scrollTo, false, false);
        }
        else {
            this.clear_selection();
            this.set_currently_selected(currentViewIds[target_element_num], scrollTo);
        }
    }

    /**
     * Select one item up in list view
     *
     * @param {boolean} shiftKey
     * @param {boolean} scrollTo
     */
    select_grid_up(shiftKey, scrollTo) {
        this._select_ptr_grid(-1, shiftKey, scrollTo);
    }

    /**
     * Select one item down in list view
     *
     * @param {boolean} shiftKey
     * @param {boolean} scrollTo
     */
    select_grid_down(shiftKey, scrollTo) {
        this._select_ptr_grid(1, shiftKey, scrollTo);
    }

    shift_select_to(lastId, scrollTo, isMouseClick, clear) {
        assert(lastId, 'missing lastId for selectionManager.shift_select_to');

        var currentViewIds = this.items.map(this.idMapper);
        var current = this.get_currently_selected();
        var current_idx = currentViewIds.indexOf(current);
        var last_idx = currentViewIds.indexOf(lastId);

        if (clear) {
            this.clear_selection();
        }

        // Very first node start shift + select
        if (!this.shiftFirst) {
            if ($.selected && $.selected[0]) {
                this.shiftFirst = $.selected[0];
            }
            else {
                // always select very first node of shift if $.selected is empty, following Windows explorer behaviour
                this.shiftFirst = currentViewIds[0];
                current_idx = 0;
            }
        }

        if (current_idx !== -1 && last_idx !== -1) {

            if (last_idx > current_idx) {

                // direction - down
                const first = Math.min(current_idx, currentViewIds.length - 1);

                for (let i = first + 1; i <= last_idx; i++) {

                    if (this.selected_list.includes(currentViewIds[i])) {

                        this.remove_from_selection(currentViewIds[i]);

                        if (i === first + 1) {
                            this.remove_from_selection(currentViewIds[first]);
                        }
                    }
                    else {
                        this.add_to_selection(currentViewIds[i], false, i !== first + 1);
                    }
                }
            }
            else {
                const first = Math.max(0, current_idx);

                // direction - up
                for (let i = first - 1; i >= last_idx; i--) {

                    if (this.selected_list.includes(currentViewIds[i])) {
                        this.remove_from_selection(currentViewIds[i]);

                        if (i === first - 1) {
                            this.remove_from_selection(currentViewIds[first]);
                        }
                    }
                    else {
                        this.add_to_selection(currentViewIds[i], false, i !== first - 1 && i !== last_idx);
                    }
                }
            }
        }

        // always select very first node of shift, following Windows explorer behaviour
        this.add_to_selection(this.shiftFirst, false, true);

        if (lastId) {
            this.set_currently_selected(lastId, scrollTo);
        }
    }

    /**
     * Returns a list of all selected node ids
     *
     * @returns {Array}
     */
    get_selected() {
        return this.selected_list;
    }

    /**
     * Should be called to destroy any event listeners and cleanup stuff when a selection manager becomes redundant
     */
    destroy() {
        oDestroy(this);
    }
}

/**
 * Implementation class of SelectionManager2 for usage in FM's DOM
 */
class SelectionManager2_DOM extends SelectionManager2Base {
    /**
     * @param {jQuery} $selectable
     * @param {Object} eventHandlers (see `SelectionManager2Base.constructor`)
     */
    constructor($selectable, eventHandlers) {
        super(eventHandlers);
        this.currentdirid = M.currentdirid;
        this._boundEvents = [];
        this.init();
        this.$selectable = $selectable;
    }

    get items() {
        return M.v;
    }

    get items_per_row() {
        return Math.floor(
            $('.data-block-view:visible').parent().outerWidth() / $('.data-block-view:visible:first').outerWidth(true)
        );
    }

    init() {
        var $uiSelectable = $('.fm-right-files-block .ui-selectable:visible:not(.hidden)');

        if ($uiSelectable.length === 1) {
            this.bindJqSelectable($uiSelectable);
        }

        const $fmRightFilesBlock = $('.fm-right-files-block');

        $fmRightFilesBlock.rebind('selectablereinitialized.sm', (e) => {
            this.bindJqSelectable(e.target);
        });

        this._boundEvents.push([$fmRightFilesBlock, 'selectablereinitialized.sm']);

        this.reinitialize();
    }

    destroy() {
        for (const [$obj, eventName] of this._boundEvents) {
            $obj.off(eventName);
        }

        super.destroy();
    }

    /**
     * Initializes jQuery.selectable
     * @param target
     */
    bindJqSelectable(target) {
        var $jqSelectable = $(target);

        if (this.debugMode) {
            console.error("(re)bindselectable", target, this);
        }

        /**
         * Push the last selected item to the end of the selected_list array.
         */
        $jqSelectable.rebind('selectableselecting.sm selectableselected.sm', (e, data) => {
            var $selected = $(data.selecting || data.selected);
            const mainSel = $.selectddUIgrid && $.selectddUIitem ? `${$.selectddUIgrid} ${$.selectddUIitem}` : '';

            // If fm drag drop selection event is not inited yet, click may arrive here, send it back to correct event.
            if (mainSel && (e.shiftKey || e.metaKey || e.ctrlKey) && e.originalEvent.type !== 'mouseup' &&
                ($selected.is(mainSel) || $selected.closest(mainSel).length)) {

                return $selected.trigger('click.filemanager', [e]);
            }

            var id = $selected.attr('id');
            if (id) {
                // dont use 'this/self' but the current/global selectionManager
                this.add_to_selection(id);
            }
        });
        this._boundEvents.push([$jqSelectable, 'selectableselecting.sm selectableselected.sm']);

        /**
         * Remove any unselected element from the selected_list array.
         */
        $jqSelectable.rebind(
            'selectableunselecting.sm selectableunselected.sm',
            (e, data) => {
                var $unselected = $(data.unselecting || data.unselected);
                var unselectedId = $unselected.attr('id');
                if (unselectedId) {
                    // dont use 'this/self' but the current/global selectionManager
                    this.remove_from_selection(unselectedId , false);

                    // Close node Info panel as nothing selected
                    if (this.selected_list.length === 0) {
                        mega.ui.mInfoPanel.closeIfOpen();
                    }
                }
            });

        this._boundEvents.push([$jqSelectable, 'selectableunselecting.sm selectableunselected.sm']);

        if ($jqSelectable.is(`${$.selectddUIgrid}:not(.hidden)`)) {
            // jQuery UI won't do trigger unselecting, in case of the ui-selected item is NOT in the DOM, so
            // we need to reset it on our own (on drag on the background OR click)
            this._boundEvents.push([$jqSelectable, 'mousedown.sm']);

            $jqSelectable.rebind('mousedown.sm', e => {
                var $target = $(e.target).parent();

                if ($target.is(`${$.selectddUIgrid}:not(.hidden)`) &&
                    e.button === 0 && !e.shiftKey && !e.metaKey && !e.ctrlKey &&
                    !e.target.classList.contains('ps__rail-x') &&
                    !e.target.classList.contains('ps__rail-y')) {

                    // Close node Info panel as nothing selected
                    mega.ui.mInfoPanel.closeIfOpen();

                    this.clear_selection();
                }
            });
        }
    }

    scrollToElementProxyMethod(nodeHandle) {

        if (M.megaRender && M.megaRender.megaList) {
            M.megaRender.megaList.scrollToItem(nodeHandle);
        }
        else {
            const $el = $('#' + nodeHandle, this._get_selectable_container());
            scrollToElement($el.closest('.ps'), $el);
        }
    }

    _get_selectable_container() {
        var targetScope = this.$selectable && this.$selectable[0];
        if (
            !targetScope ||
            !targetScope.parentNode ||
            targetScope.classList.contains("hidden") ||
            !$(targetScope).is(":visible")
        ) {
            // because MegaRender is providing a DOM node, which later on is being removed, we can't cache
            // the $selectable in this case, so lets try to use $.selectddUIgrid and do a brand new jq Sizzle query
            this.$selectable = $($.selectddUIgrid + ":visible");
        }
        return this.$selectable;
    }

    reinitialize() {
        var nodeList = this.selected_list = $.selected = $.selected || [];

        if (nodeList.length) {
            if (nodeList.length === this.items.length) {
                this.select_all();
            }
            else {
                this.add_to_selection(nodeList.shift(), true);
            }
        }
        else {
            this.clear_selection(); // remove ANY old .currently-selected values.
        }

        this.eventHandlers.onSelectedUpdated(this.selected_list);

        return this;
    }
    clear_last_selected() {
        super.clear_last_selected();

        let $selectable = this._get_selectable_container();
        $('.currently-selected', $selectable).removeClass('currently-selected');
    }

    clear_selection() {
        const res = super.clear_selection();

        let $selectable = this._get_selectable_container();
        $('.ui-selected', $selectable).removeClass(this.CLS_UI_SELECTED);

        onIdle(() => {
            var list = this.selected_list;
            if (list && !list.length) {
                this.hideSelectionBar();
            }
        });

        return res;
    }
    set_currently_selected(nodeId, scrollTo) {
        super.set_currently_selected(nodeId, scrollTo);

        quickFinder.disable_if_active();

        let $selectable = this._get_selectable_container();
        $("#" + nodeId).addClass(this.CLS_UI_SELECTED);

        if (scrollTo) {
            var $element = $('#' + this.last_selected, $selectable);
            $element.addClass("currently-selected");
            this.scrollToElementProxyMethod(this.last_selected);
        }
    }
    add_to_selection(nodeId, scrollTo, alreadySorted) {
        const res = super.add_to_selection(nodeId, scrollTo, alreadySorted);
        if (res === false) {
            return res;
        }

        delay('selMan:notify:selection', () => {
            let selectionSize = false;

            if (oIsFrozen(this)) {
                // Destroyed.
                return;
            }

            for (let i = this.selected_list.length; i--;) {
                let n = this.selected_list[i];
                const e = M.megaRender ? M.megaRender.getDOMNode(n) : document.getElementById(n);
                if ((n = M.d[n])) {
                    selectionSize += n.t ? n.tb : n.s;
                }
                else if (M.dyh) {
                    selectionSize = 0;
                }
                if (e) {
                    e.classList.add(this.CLS_UI_SELECTED);
                }
            }

            if (selectionSize === false) {
                this.hideSelectionBar();
            }
            else {
                this.selectionNotification(selectionSize, false, false);
            }

        }, 60);

        return res;
    }

    remove_from_selection(nid, scrollTo) {

        let old_last_selected = this.last_selected;
        super.remove_from_selection(nid);

        const e = M.megaRender ? M.megaRender.getDOMNode(nid) : document.getElementById(nid);

        if (e) {
            e.classList.remove(this.CLS_UI_SELECTED);

            if (old_last_selected === nid) {
                e.classList.remove('currently-selected');
            }
        }

        delay('selManUpdNotif', () => {

            if (!this.removing_list || !this.selected_list) {
                return;
            }

            const selListMap = array.to.object(this.selected_list);

            // Lets deduplicate and filter reselected
            this.removing_list = [...new Set(this.removing_list)].filter(h => !selListMap[h]);

            if (this.selected_list.length !== 0 && this.removing_list.length > 1) {

                const cb = (pv, c) => pv + (M.d[c] ? M.d[c].tb === undefined ? M.d[c].s : M.d[c].tb : 0);
                const removingSize = this.removing_list.reduce(cb, 0);
                nid = this.selected_totalSize - removingSize;
            }

            this.selectionNotification(nid, false, scrollTo);
            this.removing_list = [];
        }, 50);
    }

    select_all() {
        super.select_all();

        var container = this._get_selectable_container().get(0);
        var nodeList = container && container.querySelectorAll('.megaListItem') || false;
        const currentNode = M.d[this.currentdirid]
            || M.currentrootid === 's4' && M.d[this.currentdirid.split('/').pop()];

        if (nodeList.length) {
            for (var i = nodeList.length; i--;) {
                nodeList[i].classList.add(this.CLS_UI_SELECTED);
            }
            this.set_currently_selected(nodeList[0].id);
        }
        else if (this.selected_list.length) {
            // Not under a MegaList-powered view
            this.add_to_selection(this.selected_list.pop(), false, true);
        }
        if (currentNode) {
            this.selectionNotification(currentNode.tb);
        }

        mega.ui.mInfoPanel.reRenderIfVisible($.selected);
    }

    /**
     * Update the selection notification message once a node is added or removed
     * @param nodeId
     * @param isAddToSelection
     * @returns {Boolean}
     */
    selectionNotification(nodeId, isAddToSelection, scrollTo = true) {
        if (M.chat || M.isGalleryPage() || typeof nodeId !== 'number' && !M.d[nodeId]) {
            return false;
        }
        let itemsNum = this.selected_list.filter(h => h !== this.currentdirid).length;

        if (itemsNum === 0) {
            this.hideSelectionBar();
        }
        else {
            var totalNodes = this.items.length;

            var itemsTotalSize = "";
            var notificationText = "";

            const _getNodeSize = () => M.d[nodeId].t ? M.d[nodeId].tb : M.d[nodeId].s;

            if (typeof nodeId === 'number') {
                this.selected_totalSize = nodeId;
            }
            else if (isAddToSelection) {
                this.selected_totalSize += _getNodeSize();
            }
            else {
                this.selected_totalSize -= _getNodeSize();
            }

            if (this.selected_totalSize > 0) {
                itemsTotalSize = bytesToSize(this.selected_totalSize);
            }

            const totalHtml = `<span class="sel-notif-size-total">${itemsTotalSize}</span>`;

            if (totalNodes) {
                if (totalNodes === 1) { // Only one item exists
                    notificationText = l[24679].replace('%1', itemsNum).replace('%2', totalHtml);
                }
                else { // Multiple items here
                    itemsNum = mega.icu.format(l.selected_count, itemsNum);

                    notificationText = mega.icu.format(l[24672], totalNodes)
                        .replace('%1', `<span class="sel-notif-count-total">${itemsNum}</span>`)
                        .replace('%2', totalHtml);
                }
            }

            this.showSelectionBar(notificationText, itemsNum, itemsTotalSize, totalNodes);

            if (M.megaRender && M.megaRender.megaList) {
                M.megaRender.megaList.resized();
            }
            else {
                initPerfectScrollbar($(this._get_selectable_container()).closest('.ps'));
            }

            if (scrollTo) {
                this.scrollToElementProxyMethod(this.last_selected);
            }
        }
    }

    /**
     * Show the selection notification bar at the bottom of pages
     * @param notificationText
     */
    showSelectionBar(notificationText, itemSelected, itemsTotalSize, totalNodes) {

        var $selectionBar = $('.selection-status-bar');
        let scrollBarYClass = '';
        const $selCountElm = $('.sel-notif-count-total', $selectionBar);

        if (notificationText) {
            // if count is existing, lets using existing dom node not create new one.
            if ($selCountElm.length && totalNodes === $selectionBar.data('total-node')) {
                $selCountElm.text(itemSelected);
                $('.sel-notif-size-total', $selectionBar).text(itemsTotalSize);
            }
            else {
                $('.selection-bar-col', $selectionBar).safeHTML(notificationText);
                $selectionBar.data('total-node', totalNodes);
            }
        }
        else {
            $('.selection-bar-col', $selectionBar).empty();
        }

        this.vSelectionBar = $('b', $selectionBar).get(0);

        if (this.currentdirid === "out-shares") {
            scrollBarYClass = M.viewmode ? '.out-shared-blocks-scrolling.ps--active-y' :
                '.out-shared-grid-view .grid-scrolling-table.ps--active-y';
        }
        else if (this.currentdirid === "shares") {
            scrollBarYClass = M.viewmode ? '.shared-blocks-scrolling.ps--active-y' :
                '.shared-grid-view .grid-scrolling-table.ps--active-y';
        }
        else {
            scrollBarYClass = (M.viewmode === 1) ?
                '.file-block-scrolling.ps--active-y' : '.grid-scrolling-table.ps--active-y';
        }

        if (
            (!M.gallery || M.isAlbumsPage())
            && (this.currentdirid.substr(0, 7) !== 'search/' || this.selected_list.length > 0)
        ) {
            $selectionBar.removeClass('hidden');
        }

        const scrollBarY = document.querySelector(scrollBarYClass);
        if (scrollBarY && (scrollBarY.scrollHeight - scrollBarY.scrollTop - scrollBarY.clientHeight) < 37) {
            requestAnimationFrame(() => {
                scrollBarY.scrollTop = scrollBarY.scrollHeight;
                initPerfectScrollbar();
            });
        }

        this.showRequiredLinks();
    }

    /**
     * Hide the selection notification bar at the bottom of pages
     */
    hideSelectionBar() {

        let selectionBar = document.getElementsByClassName('selection-status-bar').item(0);

        if (selectionBar) {
            selectionBar.classList.add('hidden');
        }
        const block = document.querySelector('.search-multi');
        if (block) {
            block.classList.remove('search-multi');
        }
        this.selected_totalSize = 0;
        this.vSelectionBar = null;

        if (M.megaRender && M.megaRender.megaList) {
            M.megaRender.megaList.resized();
        }
        else {
            initPerfectScrollbar($(this._get_selectable_container()).closest('.ps'));
        }
    }

    /**
    * Show required links in selection notification bar based on selection
    */
    showRequiredLinks() {
        if (d) {
            console.time('showRequiredLinks');
        }

        const selectionLinkWrapper = document.getElementsByClassName('selection-links-wrapper').item(0);

        if (!selectionLinkWrapper) {
            return false;
        }

        const isAlbums = M.isAlbumsPage(2);

        const allButtons = selectionLinkWrapper.querySelectorAll(
            mega.gallery.albums.isPublic ? '.js-statusbarbtn:not(.options)' : '.js-statusbarbtn'
        );

        for (let i = allButtons.length; i--;) {
            allButtons[i].classList.add('hidden');
        }

        let __showBtn = (className) => {
            const button = selectionLinkWrapper.querySelector(`.js-statusbarbtn.${className}`);

            if (button) {
                button.classList.remove('hidden');
            }
        };

        const __hideButton = (className) => {
            const button = selectionLinkWrapper.querySelector(`.js-statusbarbtn.${className}`);

            if (button) {
                button.classList.add('hidden');
            }
        };

        const isMegaList = M.dyh ? M.dyh('is-mega-list') : true;

        if (isAlbums && mega.gallery.albums.grid && mega.gallery.albums.grid.timeline) {
            if (mega.gallery.albums.isPublic) {
                const selections = Object.keys(mega.gallery.albums.grid.timeline.selections);

                if (selections.length === 1 && mega.gallery.isPreviewable(M.d[selections[0]])) {
                    __showBtn('preview');
                }
            }

            __showBtn('download');

            if (!mega.gallery.albums.isPublic) {
                const albumId = M.currentdirid.replace('albums/', '');

                if (mega.gallery.albums.store[albumId] && !mega.gallery.albums.store[albumId].filterFn) {
                    __showBtn('delete-from-album');
                }
            }
        }
        else if (isMegaList) {
            __showBtn('options');
            const isSearch = String(self.page).startsWith('fm/search');
            const selNode = M.getNodeByHandle($.selected[0]);
            const sourceRoot = M.getSelectedSourceRoot(isSearch);
            const shareButton = selectionLinkWrapper.querySelector(`.js-statusbarbtn.share`);

            let showGetLink;
            let restrictedFolders = false;

            const spanTotal = document.querySelector('.selection-bar-col .sel-notif-size-total');

            if (spanTotal) {
                spanTotal.classList.remove('hidden');
            }

            // Set default "Share folder" / "Share bucket" string
            shareButton.dataset.simpletip = sourceRoot === 's4'
                && M.getS4NodeType(selNode) === 'bucket' && l.s4_share_bucket || l[5631];

            const { dataset } = selectionLinkWrapper.querySelector('.selection-links-wrapper .delete');
            dataset.simpletip = M.getSelectedRemoveLabel($.selected);

            if ((sourceRoot === M.RootID || sourceRoot === 's4'
                 || M.isDynPage(sourceRoot)) && !folderlink) {

                const cl = new mega.Share.ExportLink();

                for (let i = 0; i < $.selected.length; i++) {
                    if (M.getNodeRoot($.selected[i]) === M.InboxID) {
                        restrictedFolders = true;
                        break;
                    }
                }

                // If any of selected items is taken down we do not need to proceed futher
                if (cl.isTakenDown($.selected)) {
                    if (!restrictedFolders) {
                        __showBtn('delete');
                    }
                    __showBtn = nop;
                }

                showGetLink = 1;

                if (selNode.t && $.selected.length === 1) {
                    __showBtn('share');
                }
            }

            if (M.checkSendToChat(isSearch, sourceRoot)) {
                __showBtn('sendto');
            }

            // Temporarily hide download button for now in MEGA Lite mode (still accessible via zip in context menu)
            if (M.getNodeRoot(M.currentdirid) !== M.RubbishID &&
                (!mega.lite.inLiteMode || !mega.lite.containsFolderInSelection($.selected))) {
                __showBtn('download');
            }

            if (showGetLink || folderlink) {
                __showBtn('link');
            }

            if (sourceRoot === M.InboxID || restrictedFolders) {

                // Set "Read-only share" string
                shareButton.dataset.simpletip = l.read_only_share;

                if (selNode.t && $.selected.length === 1) {
                    __showBtn('share');
                }
                __showBtn('link');
            }
            else if (!folderlink && M.currentrootid !== 'shares' && M.currentdirid !== 'shares'
                || M.currentrootid === 'shares' && M.currentdirid !== 'shares' && M.d[M.currentdirid].r === 2) {
                __showBtn('delete');
            }

            if (M.currentdirid === 'file-requests') {
                __hideButton('link');
                __hideButton('share');
                __hideButton('sendto');
            }

            // If in MEGA Lite mode, temporarily hide any download buttons in the Shared area
            if (mega.lite.inLiteMode && M.currentrootid === 'shares') {
                __hideButton('download');
            }

            // If in MEGA Lite mode, temporarily hide the Bove to Rubbish Bin button in the outgoing shares area
            if (mega.lite.inLiteMode && M.currentrootid === 'out-shares') {
                __hideButton('delete');
            }
        }
        else {
            M.dyh('required-links')
                .then((links) => {
                    if (links) {
                        const { show, hide } = links;
                        for (const h of hide) {
                            __hideButton(h);
                        }
                        for (const s of show) {
                            __showBtn(s);
                        }
                    }
                });
        }

        M.initStatusBarLinks();

        if (d) {
            console.timeEnd('showRequiredLinks');
        }
    }
}

/**
 * Implementation class of SelectionManager2, to be used in chat/react-like environments,
 * where DOM operaitons are done separately.
 */
class SelectionManager2_React extends SelectionManager2Base {
    constructor(items, currentdirid, itemsPerRowGetter, scrollToNode, eventHandlers) {
        super(eventHandlers);
        this.items = items;
        this.currentdirid = currentdirid;
        this.itemsPerRowGetter = itemsPerRowGetter;
        this.scrollToElementProxyMethod = scrollToNode;
    }

    get items_per_row() {
        return this.itemsPerRowGetter() | 0;
    }
}

var selectionManager;

/**
 * addNewContact
 *
 * User adding new contact/s from add contact dialog.
 * @param {String} $addBtnClass, contact dialog add button class, i.e. .add-user-popup-button.
 * @param {Boolean} cd close dialog or not. default: true
 */
function addNewContact($addButton, cd) {

    var mailNum;
    var msg;
    var title;
    var email;
    var emailText;
    var $mails;
    var $textarea = $('textarea', $addButton.parents('.mega-dialog'));
    var promise = new MegaPromise();
    cd = cd === undefined ? true : cd;

    // Add button is enabled
    if (!$addButton.hasClass('disabled')) {

        // Check user type
        if (u_type === 0) {
            ephemeralDialog(l[997]);
            promise.resolve();
        }
        else {
            var promises = [];
            var addedEmails = [];

            loadingDialog.pshow();

            // Custom text message
            emailText = $textarea.val();

            if (emailText === '' || emailText === l[6853]) {
                emailText = l[17738];
            }

            // List of email address planned for addition
            $mails = $('.token-input-list-mega .token-input-token-mega');

            mailNum = $mails.length;

            // temp array to hold emails of current contacts to exclude from inviting.
            // note: didn't use "getContactsEMails()" to optimize memory usage, since the returned array
            // there is bigger (contains: email, name, handle, type)

            var currentContactsEmails = [];

            var pushAsAddedEmails = function() {
                if (!currentContactsEmails.includes(email) && !M.findOutgoingPendingContactIdByEmail(email)) {
                    // if invitation is sent, push as added Emails.
                    promises.push(
                        M.inviteContact(M.u[u_handle].m, email, emailText).then((res) => addedEmails.push(res))
                    );
                }
            };

            M.u.forEach(function(contact) {
                // Active contacts with email set
                if (contact.c === 1 && contact.m) {
                    currentContactsEmails.push(contact.m);
                }
            });

            if (mailNum) {
                // Loop through new email list
                $mails.each(function(index, value) {
                    // Extract email addresses one by one
                    email = $(value).contents().eq(1).text();

                    pushAsAddedEmails();
                });
            }

            if ($.dialog === 'share' && Object.keys($.addContactsToShare).length > 0) {
                // Invite new contacts to share
                for (var i in $.addContactsToShare) {
                    email = $.addContactsToShare[i].u;
                    emailText = $.addContactsToShare[i].msg;

                    pushAsAddedEmails();
                }
            }

            // after all process is done, and there is added email(s), show invitation sent dialog.
            Promise.allSettled(promises).always(() => {
                const shareFolderName = $.dialog === 'share'
                    && $('.share-dialog-folder-name', '.mega-dialog.share-dialog').text();

                if (addedEmails.length > 0) {
                    title = mega.icu.format(l.contacts_invited_title, addedEmails.length);
                    msg = addedEmails.length === 1 ? l[5898] : l[5899];
                    contactsInfoDialog(title, addedEmails[0], msg);
                }
                else {
                    cd = false;
                }

                if (cd) {
                    closeDialog();
                    $('.token-input-token-mega').remove();
                }

                loadingDialog.phide();

                if (shareFolderName) {
                    showToast('view', l.share_folder_toast.replace('%1', shareFolderName));
                }

                promise.resolve();
            });
        }
    }
    else {
        promise.reject();
    }

    return promise;
}

/**
 * sharedUInode
 *
 * Handle shared/export link icons in Cloud Drive
 * @param {String} nodeHandle selected node id
 * @param {*} [force] no delay
 */
// eslint-disable-next-line complexity
function sharedUInode(nodeHandle, force) {
    'use strict';

    if (!fminitialized) {
        return;
    }

    if (!force) {
        return delay(`sharedUInode:${nodeHandle}`, () => sharedUInode(nodeHandle, true), 666);
    }

    var oShares;
    var bExportLink = false;
    var bAvailShares = false;
    var UiExportLink = new mega.UI.Share.ExportLink();
    var share = new mega.Share();
    var target;
    const iconSize = M.viewmode ? 90 : 24;
    const iconSpriteClass = `item-type-icon${M.viewmode ? '-90' : ''}`;

    // Is there a full share or pending share available
    if ((M.d[nodeHandle] && M.d[nodeHandle].shares) || M.ps[nodeHandle]) {

        // Contains full shares and/or export link
        oShares = M.d[nodeHandle] && M.d[nodeHandle].shares;

        // Do we have export link for selected node?
        if (oShares && oShares.EXP) {

            UiExportLink.addExportLinkIcon(nodeHandle);

            // Item is taken down, make sure that user is informed
            if (oShares.EXP.down === 1) {
                UiExportLink.addTakenDownIcon(nodeHandle);
            }

            bExportLink = true;
        }

        // Add share icon in left panel for selected node only if we have full or pending share
        // Don't show share icon when we have export link only
        if (share.isShareExist([nodeHandle], true, true, false)) {

            // Left panel
            target = document.querySelector('#treea_' + nodeHandle + ' .nw-fm-tree-folder');

            if (target) {
                target.classList.add('shared-folder');
            }

            bAvailShares = true;
        }
    }

    // t === 1, folder
    if (M.d[nodeHandle] && M.d[nodeHandle].t) {

        target = document.getElementById(nodeHandle);

        if (target) {

            // Update right panel selected node with appropriate icon
            target = target.querySelector(`.${iconSpriteClass}`);

            if (target) {
                target.className = `${iconSpriteClass} icon-${fileIcon(M.d[nodeHandle])}-${iconSize} folder`;
            }
        }
    }

    // If no shares are available, remove share icon from left panel, right panel (list and block view)
    if (!bAvailShares) {

        // Left panel
        target = document.querySelector('#treea_' + nodeHandle + ' .nw-fm-tree-folder');

        if (target) {
            target.classList.remove('shared-folder');
        }

        target = document.getElementById(nodeHandle);

        if (target) {

            // Right panel
            target = target.querySelector(`.${iconSpriteClass}`);

            if (target) {
                target.classList.replace((`icon-folder-outgoing-${iconSize}`), `icon-folder-${iconSize}`);
            }
        }

        // Remove the share node selection on incoming and outgoing shares pages
        if (typeof nodeHandle !== 'undefined' && (M.currentdirid === 'out-shares' || M.currentdirid === 'shares')) {
            selectionManager.remove_from_selection(nodeHandle);
        }
    }

    // If no export link is available, remove export link from left and right panels (list and block view)
    if (!bExportLink) {
        UiExportLink.removeExportLinkIcon(nodeHandle);
    }
}

/**
 * initAddDialogInputPlugin
 */
function initAddDialogMultiInputPlugin() {

    // Plugin configuration
    var contacts = M.getContactsEMails();
    var $this  = $('.add-contact-multiple-input');
    var $scope = $this.closest('.add-user-popup');
    var $addButton = $('.add-user-popup-button', $scope);
    var $addButtonSpan = $('span', $addButton);

    $this.tokenInput(contacts, {
        theme: 'mega',
        placeholder: l[19108],// Enter one or more email address
        searchingText: '',
        noResultsText: '',
        addAvatar: true,
        autocomplete: null,
        searchDropdown: true,
        emailCheck: true,
        preventDoublet: true,
        tokenValue: 'id',
        propertyToSearch: 'id',
        resultsLimit: 5,
        // Prevent showing of drop down list with contacts email addresses
        // Max allowed email address is 254 chars
        minChars: 255,
        accountHolder: (M.u[u_handle] || {}).m || '',
        scrollLocation: 'add',
        // Exclude from dropdownlist only emails/names which exists in multi-input (tokens)
        excludeCurrent: false,
        tokenLimit: 500,
        onEmailCheck: function() {
            errorMsg(l[7415]);
        },
        onDoublet: function(u, iType) {
            $addButton.addClass('hidden');
            if (iType === 'opc') {
                errorMsg(l[17545]);
            }
            else if (iType === 'ipc') {
                errorMsg(l[17546]);
            }
            else {
                errorMsg(l[7413]);
            }
        },
        onHolder: function() {
            errorMsg(l[7414]);
        },
        onReady: function() {
            var $input = $this.parent().find('li input').eq(0);

            $input.rebind('keyup', function() {
                var value = $.trim($input.val());
                var emailList = value.split(/[ ;,]+/);
                var itemNum = $scope.find('.share-added-contact').length;

                if (isValidEmail(value)) {
                    itemNum = itemNum + 1;
                }

                if (itemNum > 0) {
                    $addButtonSpan.text(mega.icu.format(l[19113], itemNum));
                    $addButton.removeClass('hidden');
                }
                else {
                    $addButton.addClass('hidden');
                }

            });
        },
        onAdd: function() {
            var $inputTokens = $scope.find('.share-added-contact');
            var itemNum = $inputTokens.length;

            if (itemNum === 0) {
                $addButton.addClass('hidden');
            }
            else {
                var $multiInput = $scope.find('.multiple-input');

                $addButtonSpan.text(mega.icu.format(l[19113], itemNum));
                $addButton.removeClass('hidden');
            }
        },
        onDelete: function() {
            var $inputTokens = $scope.find('.token-input-list-mega .token-input-token-mega');
            var itemNum;

            setTimeout(function() {
                $inputTokens.find('input').trigger("blur");
            }, 0);

            // Get number of emails
            itemNum = $inputTokens.length;

            if (itemNum === 0) {
                $addButton.addClass('hidden');
            }
            else {
                $addButtonSpan.text(mega.icu.format(l[19113], itemNum));
                $addButton.removeClass('hidden');
            }
        }
    });

    /**
     * errorMsg
     *
     * Show error popup next to multi input box in case that email is wrong.
     * @param {String} msg, error message.
     */
    function errorMsg(msg) {

        var $addUserPopup = $('.add-user-popup'),
            $warning = $addUserPopup.find('.multiple-input-warning span');

        $warning.text(msg);
        $addUserPopup.addClass('error');

        setTimeout(function() {
            $addUserPopup.removeClass('error');
        }, 3000);
    }
}

/**
 * contactsInfoDialog
 *
 * Handle add new contact dialog UI
 * @param {String} title Dialog title
 * @param {String} username User name/email
 * @param {Boolean} close Dialog parameter
 */
function contactsInfoDialog(title, username, msg, close) {
    'use strict';

    var $d = $('.mega-dialog.contact-info');
    var $msg = $('.new-contact-info', $d);

    // Hide
    if (close) {
        closeDialog();
        return true;
    }

    if (title) {
        $('#contact-info-title', $d).text(title);
    }
    else {
        $('#contact-info-title', $d).text('');
    }

    if (username && msg) {
        $msg.safeHTML(msg.replace(/%1|\[X\]/g, '<span>' + username + '</span>'));
    }
    else if (msg) {
        $msg.text(msg);
    }

    M.safeShowDialog('contact-info', $d);

    $('button.js-close, button.ok', $d).rebind('click', function() {
        contactsInfoDialog(undefined, undefined, undefined, 1);
    });
}

/**
 * setContactLink
 *
 * Set public link and init CopyToClipboard events
 * @param {Node|jQuery} [$container] optional container node, used to scope the `public-contact-link`
 * @returns {undefined|Boolean}
 */
function setContactLink($container) {
    "use strict";

    var $publicLink = $container ? $('.public-contact-link', $container) : $('.public-contact-link:visible');
    // multiple link data may exists!
    var linkData = $publicLink.attr('data-lnk');
    var account = M.account || false;
    var contactPrefix = '';

    // Exit if link exists
    if (!$publicLink.length || linkData) {
        return false;
    }

    // Check data exists in M.account
    if (account.contactLink && account.contactLink.length) {
        contactPrefix =  M.account.contactLink.match('^C!') ? '' : 'C!';
        $publicLink.attr('data-lnk', 'https://127.0.0.1/' + contactPrefix + M.account.contactLink);
    }
    else {
        api.send('clc')
            .then((res) => {
                if (typeof res === 'string') {
                    contactPrefix = res.match('^C!') ? '' : 'C!';
                    res = 'https://127.0.0.1/' + contactPrefix + res;
                    $publicLink.attr('data-lnk', res);
                    mBroadcaster.sendMessage('contact:setContactLink', res);
                }
            })
            .catch(tell);
    }

    $publicLink.rebind('mouseout.publiclnk', function() {
        $('.dropdown.tooltip.small')
            .removeClass('visible')
            .addClass('hidden');
    });

    $publicLink.rebind('click.publiclnk', function() {
        var linkData = $(this).attr('data-lnk') || '';

        if (linkData.length) {
            copyToClipboard(linkData, `${l[371]}<span class="link-text">${linkData}</span>`);
        }
    });
}

/**Show Contact VS User difference dialog */
function contactVsUserDialog() {
    "use strict";
    var $dialog = $('.add-reassign-dialog.user-management-dialog');

    $('.dif-dlg-contact-add-btn', $dialog).rebind('click.dlg', function addContactClickHandler() {
        closeDialog();
        return contactAddDialog(null, true);
    });

    $('button.js-close', $dialog).rebind('click.dlg', function closeClickHandler() {
        return closeDialog();
    });

    $dialog.find('.dif-dlg-user-add-btn').rebind('click.dlg', function addUserClickHandler() {
        closeDialog();
        if (!u_attr || !u_attr.b || !u_attr.b.m || u_attr.b.s === -1) {
            return false;
        }

        window.triggerShowAddSubUserDialog = true;
        M.openFolder('user-management', true);

    });

    M.safeShowDialog('contact-vs-user', $dialog);
}

/**
 * addContactUI
 *
 * Handle add contact dialog UI
 * @param {Boolean} close               dialog parameter
 * @param {Boolean} dontWarnBusiness    if true, then proceed to show the dialog
 */
function contactAddDialog(close, dontWarnBusiness) {
    'use strict';

    var $d = $('.add-user-popup');

    // not for ephemeral
    if (!u_type) {
        return;
    }

    // Hide
    if (close) {
        closeDialog();
        return true;
    }
    if (M.chat && $.dialog === 'onboardingDialog') {
        closeDialog();
    }

    // Check if this is a business master, then Warn him about the difference between Contact and User
    if (!dontWarnBusiness) {
        if (u_attr && u_attr.b && u_attr.b.m && u_attr.b.s !== -1) {
            return contactVsUserDialog();
        }
    }

    // Init default states
    $.sharedTokens = [];
    $d.removeClass('private achievements');

    M.safeShowDialog('add-user-popup', $d);

    setContactLink($d);

    var $textarea = $d.find('.add-user-textarea textarea');

    mega.achievem.enabled().done(function () {
        $d.addClass('achievements');
    });

    $textarea.val('');
    $d.find('.multiple-input .token-input-token-mega').remove();

    initPerfectScrollbar($('.multiple-input', $d));

    Soon(function() {
        $('.add-contact-multiple-input input', $d).trigger("focus");
    });

    $('.add-user-popup-button span', $d).text(mega.icu.format(l[19113], 1));
    $('.add-user-popup-button', $d).addClass('hidden');

    if (u_attr && u_attr.b) {
        $('.hidden-achievement-info', $d).addClass('hidden');
    }
    else {
        $('.hidden-achievement-info', $d).removeClass('hidden');
    }

    initTextareaScrolling($textarea);
    $('input.add-contact-multiple-input', $d).trigger("focus");
    focusOnInput();

    $d.find('.hidden-textarea-info span').rebind('click', function() {
        $d.addClass('private');
        $('.add-user-textarea textarea', $d).focus();
    });

    function focusOnInput() {
        var $tokenInput = $('#token-input-');

        $tokenInput.trigger("focus");
    }

    $('.add-user-notification textarea').rebind('focus.add-user-n', function() {
        $('.add-user-notification').addClass('focused');
    });

    $('.add-user-notification textarea').rebind('blur.add-user-n', function() {
        $('.add-user-notification').removeClass('focused');
    });

    if (!$('.add-contact-multiple-input').tokenInput("getSettings")) {
        initAddDialogMultiInputPlugin();
    }

    $('.add-user-popup-button').rebind('click', function() {
        addNewContact($(this));
    });

    $('.add-user-popup button.js-close').rebind('click', function() {
        showLoseChangesWarning().done(closeDialog);
    });
}

function ephemeralDialog(msg) {

    msgDialog('confirmation', l[998], msg + ' ' + l[999], l[1000], function(e) {
        if (e) {
            loadSubPage('register');
        }
    });
}

function fmtopUI() {

    "use strict";

    var $sharesTabBlock = $('.shares-tabs-bl');
    var $galleryTabBlock = $('.gallery-tabs-bl');
    const $galleryTabLink = $('.gallery-tab-lnk');
    const $header = $('.fm-right-header', '.fmholder');
    const $fmShareButton = $('.fm-share-folder').off('click.shareFolder').addClass('hidden');

    if ($fmShareButton.length) {
        // Show share button unless for root id, out shares, s4, etc
        const pages = ['s4', 'out-shares', 'shares', 'file-requests', 'faves', M.RubbishID];
        const dirPages = [M.BackupsId, M.RootID, M.currentrootid];
        const showButton = !pages.includes(M.currentrootid) && !dirPages.includes(M.currentdirid)
            && M.currentrootid !== (M.BackupsId && M.getNodeByHandle(M.BackupsId).p);

        if (showButton) {
            const h = String(M.currentdirid).split('/').pop();
            const n = M.getNodeByHandle(h);

            if (M.getNodeRights(n.h) > 1) {
                $fmShareButton.removeClass('hidden').rebind('click.shareFolder', () => {
                    $.selected = [n.h];
                    M.openSharingDialog($.selected[0]);
                    eventlog(500034);
                    return false;
                });
            }
        }
    }

    $('.shares-tab-lnk.active', $sharesTabBlock).removeClass('active');
    $('.gallery-tab-lnk.active', $galleryTabBlock).removeClass('active');

    $('.fm-s4-settings, .fm-s4-new-bucket, .fm-s4-new-key, .fm-s4-new-user, .fm-s4-new-group', $header)
        .addClass('hidden');

    $('.fm-clearbin-button,.fm-add-user,.fm-new-folder,.fm-file-upload,.fm-folder-upload,.fm-uploads')
        .add('.fm-new-shared-folder,.fm-new-link')
        .add('.fm-new-file-request')
        .addClass('hidden');
    $('.fm-new-folder').removeClass('filled-input');
    $('.fm-right-files-block').removeClass('visible-notification rubbish-bin');
    $('.fm-breadcrumbs-block').removeClass('hidden');
    $('button.link-button.accept-all').addClass('hidden');

    var showUploadBlock = function _showUploadBlock() {

        if (M.InboxID && (M.currentrootid === M.InboxID
            || M.getNodeRoot(M.currentdirid.split('/').pop()) === M.InboxID)) {
            return false;
        }

        $('.fm-new-folder').removeClass('hidden');
        $('.fm-file-upload').removeClass('hidden');
        $('.fm-uploads').removeClass('hidden');

        if ($.hasWebKitDirectorySupport === undefined) {
            $.hasWebKitDirectorySupport = 'webkitdirectory' in document.createElement('input');
        }

        if ($.hasWebKitDirectorySupport) {
            $('.fm-folder-upload').removeClass('hidden');
        }
        else {
            $('.fm-file-upload').addClass('last-button');
        }
    };

    if (M.currentrootid === M.RubbishID) {
        if (M.v.length) {
            $('.fm-clearbin-button').removeClass('hidden');
        }
        $('.fm-right-files-block').addClass('rubbish-bin visible-notification');
    }
    else {
        if (M.currentrootid === M.InboxID) {
            if (d) {
                console.log('Inbox');
            }
        }
        else if (M.isDynPage(M.currentdirid)) {
            $('.fm-right-files-block').addClass('visible-notification');
        }
        else if (M.currentrootid === 'shares') {

            M.sharesUI();
            $sharesTabBlock.removeClass('hidden');
            $sharesTabBlock.find('.in-shares').addClass('active');
            $('.fm-right-files-block').addClass('visible-notification');

            if (M.currentdirid !== 'shares' && M.getNodeRights(M.currentdirid) > 0) {
                showUploadBlock();
            }
        }
        else if (M.currentrootid === 'out-shares') {

            M.sharesUI();
            $sharesTabBlock.removeClass('hidden');
            $('.out-shares', $sharesTabBlock).addClass('active');
            $('.fm-right-files-block').addClass('visible-notification');

            if (M.currentdirid !== M.currentrootid) {
                showUploadBlock();
            }
            else {
                $('.fm-new-shared-folder').removeClass('hidden');
                $sharesTabBlock.removeClass('hidden');
            }
        }
        else if (M.currentrootid === 'public-links') {

            M.sharesUI();
            $('.fm-right-files-block').addClass('visible-notification');

            if (M.currentdirid === M.currentrootid) {
                $('.fm-new-link').removeClass('hidden');
            }
            else {
                showUploadBlock();
            }
        }
        else if (M.currentrootid === 'file-requests') {
            $('.fm-right-files-block', document).addClass('visible-notification');

            if (M.currentdirid === M.currentrootid) {
                $('.fm-new-file-request', document).removeClass('hidden');
            }
            else {
                showUploadBlock();
            }
        }
        else if (M.isGalleryPage()) {
            $galleryTabBlock.removeClass('hidden');

            if (M.currentdirid === 'favourites') {
                $galleryTabLink.addClass('hidden');
            }
            else {
                $galleryTabLink.removeClass('hidden');
            }

            if (mega.gallery[M.currentdirid]) {
                $('.gallery-tab-lnk', $galleryTabBlock).removeClass('active');
                $(`.gallery-tab-lnk-${mega.gallery[M.currentdirid].mode}`, $galleryTabBlock).addClass('active');
            }
        }
        else if (M.currentrootid === 's4') {
            const {subType, original} = M.currentCustomView;
            if (subType === 'container') {
                $('.fm-s4-new-bucket, .fm-s4-settings', '.fm-header-buttons').removeClass('hidden');
            }
            else if (subType === 'bucket') {
                $('.fm-new-folder').removeClass('hidden');
                $('.fm-uploads').removeClass('hidden');
                $('.fm-file-upload').removeClass('hidden');
                $('.fm-folder-upload').removeClass('hidden');
            }
            else if (subType === 'keys') {
                $('.fm-files-view-icon').addClass('hidden');
                $('.fm-s4-new-key').removeClass('hidden');
            }
            else if (subType === 'policies') {
                $('.fm-files-view-icon').addClass('hidden');
            }
            else if (subType === 'users') {
                $('.fm-files-view-icon').addClass('hidden');
                if (original.endsWith('users')) {
                    $('.fm-s4-new-user').removeClass('hidden');
                }
            }
            else if (subType === 'groups') {
                $('.fm-files-view-icon').addClass('hidden');
                if (original.endsWith('groups')) {
                    $('.fm-s4-new-group').removeClass('hidden');
                }
            }
        }
        else if (String(M.currentdirid).length === 8
            && M.getNodeRights(M.currentdirid) > 0) {

            $('.fm-right-files-block').addClass('visible-notification');
            showUploadBlock();
        }
    }
    $('.fm-clearbin-button').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }

        doClearbin(true);
    });

    if (M.currentrootid === 'file-requests') {
        mega.fileRequest.rebindTopMenuCreateIcon();
    }
    $.tresizer();
}

/**
 * Function to init Left Pane scrolling in FM/Settings/Dashboard
 */
function initTreeScroll() {

    "use strict";

    var treeClass = 'js-myfiles-panel';
    var scrollBlock;

    if (M.currentTreeType === 'gallery') {
        treeClass = 'js-gallery-panel';
    }
    else if (folderlink || M.currentTreeType !== 'cloud-drive') {
        treeClass = 'js-other-tree-panel';

        $('.js-other-tree-panel .section-title')
            .text(
                folderlink
                    ? (pfcol ? l.shared_album : l.folderlink_lp_title)
                    : l[24682]
            );
    }

    scrollBlock = document.getElementsByClassName(treeClass).item(0);

    if (!scrollBlock || scrollBlock.classList.contains('hidden')) {
        return false;
    }

    if (scrollBlock.classList.contains('ps')) {
        Ps.update(scrollBlock);
    }
    else {
        Ps.initialize(scrollBlock);
    }
}

function fmLeftMenuUI() {

    "use strict";

    // handle the Inbox section use cases
    if (M.InboxID && M.currentdirid === M.InboxID) {
        M.openFolder(M.RootID);
    }

    // handle the Backups button changes
    if (!M.BackupsId) {
        $('.js-lp-myfiles .js-backups-btn', '.fmholder').addClass('hidden');
    }

    // handle the RubbishBin icon changes
    var $icon = $('.fm-left-panel .rubbish-bin');
    var rubNodes = Object.keys(M.c[M.RubbishID] || {});

    if (rubNodes.length) {

        if (!$icon.hasClass('filled')) {
            $icon.addClass('filled');
        }
        else if (!$icon.hasClass('glow')) {
            $icon.addClass('glow');
        }
        else {
            $icon.removeClass('glow');
        }
    }
    else {
        $icon.removeClass('filled glow');
    }
}

function doClearbin(all) {
    "use strict";

    msgDialog('clear-bin', l[14], l[15], l[1007], function(e) {

        if (e) {
            M.clearRubbish(all).catch(dump);
        }
    });
}

/**
 * To show the password reset link / the account closure link sent dialog, and its related event handlers
 * @param {String} dialogText   The main message displays in the dialog
 * @param {String} dlgString    The dialog name
 * @returns {void}
 */
function handleResetSuccessDialogs(dialogText, dlgString) {
    'use strict';

    const $resetSuccessDlg = $('.mega-dialog.reset-success');

    $('.reset-success-title', $resetSuccessDlg)
        .text(dlgString === 'deleteaccount' ? l.ac_closure_link_sent : l.pwd_link_sent);
    $('.reset-email-success-txt', $resetSuccessDlg).safeHTML(dialogText);

    $('a.try-again, button.js-close, button.ok-btn', $resetSuccessDlg).rebind('click.close-dlg', () => {
        $('.fm-dialog-overlay').addClass('hidden');
        $('body').removeClass('overlayed');
        $resetSuccessDlg.addClass('hidden');
        delete $.dialog;
    });

    $('.fm-dialog-overlay').removeClass('hidden');
    $('body').addClass('overlayed');
    $resetSuccessDlg.removeClass('hidden');
    $.dialog = dlgString;
}

function avatarDialog(close) {
    'use strict';

    var $dialog = $('.mega-dialog.avatar-dialog');

    if (close) {
        closeDialog();
        return true;
    }

    M.safeShowDialog('avatar', $dialog);

    $('.avatar-body').safeHTML(
        `<div id="avatarcrop">
            <div class="image-upload-and-crop-container">
                <div class="image-explorer-container empty">
                    <div class="image-explorer-image-view">
                        <img class="image-explorer-source" />
                        <div class="image-explorer-mask circle-mask"></div>
                        <div class="image-explorer-drag-delegate"></div>
                    </div>
                <div class="zoom-slider-wrap">
                    <i class="zoom-out sprite-fm-theme icon-image-zoom-out simpletip" data-simpletip="${l[24927]}">
                    </i>
                    <div class="zoom-slider disabled"></div>
                    <i class="zoom-in sprite-fm-theme icon-image-zoom-in simpletip" data-simpletip="${l[24928]}">
                    </i>
                </div>
                    <input type="file" id="image-upload-and-crop-upload-field" class="image-upload-field"
                        accept="image/jpeg, image/gif, image/png" />
                </div>
            </div>
        </div>`);
    $('.avatar-footer').safeHTML(
        `<button class="mega-button cancel-avatar" id="fm-cancel-avatar">
            <span>@@</span>
        </button>
        <div>
            <label for="image-upload-and-crop-upload-field">
                <button class="mega-button image-upload-field-replacement select-avatar">
                    <span>@@</span>
                </button>
            </label>
            <button class="mega-button positive change-avatar" id="fm-change-avatar">
                <span>@@</span>
            </button>
            <button class="mega-button negative remove-avatar" id="fm-remove-avatar">
                <span>@@</span>
            </button>
        </div>`,
        l[82],
        l[1016],
        l[1017],
        l[6974]
    );
    $('#fm-change-avatar').hide();
    $('#fm-cancel-avatar').hide();
    $('#fm-remove-avatar').hide();

    mega.attr.get(u_handle, 'a', true, false)
        .fail()
        .done(function(res) {
            if (res !== null && res !== undefined && res !== "none"){
                $('#fm-remove-avatar').show();
            }
        });

    var imageCrop = new ImageUploadAndCrop($("#avatarcrop").find('.image-upload-and-crop-container'),
        {
            cropButton: $('#fm-change-avatar'),
            dragDropUploadPrompt:l[1390],
            outputFormat: 'image/jpeg',
            onCrop: function(croppedDataURI)
            {
                if (croppedDataURI.length > 64 * 1024) {
                    return msgDialog('warninga', l[8645], l[8646]);
                }
                var data = dataURLToAB(croppedDataURI);

                mega.attr.set('a', ab_to_base64(data), true, false);
                useravatar.setUserAvatar(u_handle, data, this.outputFormat);

                // Update mega.io about the new avatar change
                initMegaIoIframe(true);

                $('.fm-account-avatar').safeHTML(useravatar.contact(u_handle, '', 'div', false));
                $('.fm-avatar').safeHTML(useravatar.contact(u_handle));
                avatarDialog(1);
            },
            onImageUpload: function()
            {
                $('#fm-change-avatar').show();
                $('#fm-cancel-avatar').show();
                $('#fm-remove-avatar').hide();
            },
            onImageUploadError: function()
            {

            }
        });
    $('#fm-cancel-avatar,.mega-dialog.avatar-dialog button.js-close').rebind('click', function() {
        avatarDialog(1);
    });

    $('#fm-remove-avatar').rebind('click', function() {
        msgDialog('confirmation', 'confirm-remove-avatar', l[18699], l[6973], function(response) {
            if (response){
                mega.attr.set('a', "none", true, false);

                // Update mega.io about the new avatar change
                initMegaIoIframe(true);

                avatarDialog(1);
            }
        });
    });

    $('.select-avatar', $dialog).rebind('click', function() {
        $(this).parent('label').trigger('click');
    });
}


/**
 * Really simple shortcut logic for select all, copy, paste, delete
 * Note: there is another key binding on initUIKeyEvents() for filemanager.
 *
 * @constructor
 */
function FMShortcuts() {
    'use strict';
    var current_operation = null;
    mBroadcaster.addListener('crossTab:fms!cut/copy', ev => (current_operation = ev.data));

    $(window).rebind('keydown.fmshortcuts', function(e) {
        var isShareRoot = false;
        if (
            !is_fm() ||
            !selectionManager ||
            M.currentrootid === 'chat' || // prevent shortcut for chat
            M.currentrootid === undefined || // prevent shortcut for file transfer, dashboard, settings
            M.isGalleryPage()
        ) {
            return true;
        }
        else if (M.currentdirid === 'shares') {
            isShareRoot = true;
        }

        e = e || window.event;

        // DO NOT start the search in case that the user is typing something in a form field... (eg.g. contacts -> add
        // contact field)
        if ($(e.target).is("input, textarea, select") || $.dialog) {
            return;
        }

        var charCode = e.which || e.keyCode; // ff
        var charTyped = String.fromCharCode(charCode).toLowerCase();

        if (charTyped === "a" && (e.ctrlKey || e.metaKey)) {
            if (typeof selectionManager != 'undefined' && selectionManager && !M.gallery && !M.isAlbumsPage()) {
                selectionManager.select_all();
            }
            return false; // stop prop.
        }
        else if (
            (charTyped === "c" || charTyped === "x") &&
            (e.ctrlKey || e.metaKey) &&
            !isShareRoot
        ) {
            var items = clone(selectionManager.get_selected());
            if (items.length === 0) {
                return; // dont do anything.
            }

            current_operation = {
                'op': charTyped == "c" ? 'copy' : 'cut',
                'dir': M.currentdirid,
                'src': items
            };
            delay('crossTab:fms!cut/copy', () => {
                mBroadcaster.crossTab.notify('fms!cut/copy', current_operation);
            });

            return false; // stop prop.
        }
        else if (
            charTyped === "v" &&
            (e.ctrlKey || e.metaKey) &&
            !isShareRoot
        ) {
            if (!current_operation || (M.getNodeRights(M.currentdirid || '') | 0) < 1) {
                return false; // stop prop.
            }

            let {src: handles, op, dir} = current_operation;
            op = op === 'cut' && dir === M.currentdirid ? 'copy' : op;

            if (op === "copy") {
                M.copyNodes(handles, M.currentdirid).catch((ex) => ex !== EBLOCKED && tell(ex));
            }
            else if (op === "cut") {
                M.moveNodes(handles, M.currentdirid).catch(tell);
                current_operation = null;
            }

            return false; // stop prop.
        }
        else if (
            charCode === 8 &&
            !isShareRoot
        ) {
            if (M.isInvalidUserStatus() || $.msgDialog === 'remove') {
                return;
            }

            var remItems = selectionManager.get_selected();
            if (remItems.length === 0 || (M.getNodeRights(M.currentdirid || '') | 0) < 2 ||
                M.currentrootid === M.InboxID || M.currentdirid === 'devices') {
                return; // dont do anything.
            }

            fmremove(remItems, e.ctrlKey || e.metaKey);

            return false;
        }
    });
}



function fm_addhtml() {
    'use strict';

    var elm = document.getElementById('fmholder');
    if (elm) {
        if (!elm.textContent) {
            $(elm).safeHTML(translate(String(pages.fm).replace(/{staticpath}/g, staticpath)));
        }

        if (!document.getElementById('invoicePdfPrinter')) {
            elm = document.querySelector('.invoice-container');
            if (elm && elm.parentNode) {
                elm.parentNode.insertBefore(mCreateElement('iframe', {
                    type: 'content',
                    'class': 'hidden',
                    src: 'about:blank',
                    id: 'invoicePdfPrinter'
                }), elm);
            }
        }
    }
    else {
        console.error('fmholder container not found...');
    }
}

function fm_hideoverlay() {
    "use strict";

    if (!$.propertiesDialog) {
        $('.fm-dialog-overlay').addClass('hidden');
        $('body').removeClass('overlayed');
    }
    $(document).trigger('MegaCloseDialog');
}

function fm_showoverlay() {
    "use strict";

    $('.fm-dialog-overlay').removeClass('hidden');

    $('body').addClass('overlayed');
}

/**
 * Search for an existing node name
 * @param {String} value New file/folder name
 * @param {String} [target] Target folder to check for duplication. If not provided, M.v will be used.
 * @returns {Boolean} Whether it does exist.
 */
function duplicated(value, target) {
    "use strict";
    if (!target) {
        return M.v.some((n) => n.name === value);
    }

    if (M.c[target]) {
        for (const handle in M.c[target]) {
            if (M.d[handle] && M.d[handle].name === value) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Helper to handle validation of Input elements tied to floating warnings.
 * e.g. leading/trailing (LT) white-spaces warning message lifecycle
 * @param {Object} $container Element having input to check
 * @param {Object} [options] the
 * @constructor
 */
function InputFloatWarning($container, options) {
    "use strict";

    if (!(this instanceof InputFloatWarning)) {
        return new InputFloatWarning($container, options);
    }

    this.$container = $container;
    this.id = `IFW.${makeUUID()}`;

    this.options = Object.assign({
        namespace: 'whitespaces'
    }, options);

    /**
     * Show warning
     * @param {String} msg Message to show
     * @returns {InputFloatWarning} this instance
     */
    this.show = (msg) => {
        $(`.${this.options.namespace}-input-warning span`, this.$container).text(msg);
        this.$container.addClass(this.options.namespace);
        return this;
    };

    /**
     * Hide warning
     * @returns {InputFloatWarning} this instance
     */
    this.hide = () => {
        this.$container.removeClass(this.options.namespace);
        return this;
    };

    /**
     * Display e.g. LT white-spaces warning if input value contains leading/trailing white-spaces
     * @param {Number} type file: 0, folder: 1
     * @param {String} name {optional} Name to check, if not provided, container input value will used
     * @param {Number} ms {optional} Timeout in milliseconds. If not provided, default timeout
     * @returns {InputFloatWarning} this instance
     */
    this.check = ({type, name, ms = 1000}) => {
        // delay function sets default value if given timeout is 0. Workaround: set "ms" to 1 when 0 is given
        delay(this.id, () => {
            const validator = InputFloatWarning.validator[this.options.namespace];
            const msg = validator(name || $('input', this.$container).val(), type);
            return msg ? this.show(msg) : this.hide();
        }, ms > 0 ? ms : 1);

        return this;
    };

    Object.freeze(this);
}

/** @property InputFloatWarning.validator */
lazy(InputFloatWarning, 'validator', () => {
    'use strict';
    const obj = {
        'whitespaces': (value, type) => {
            if (typeof value !== 'undefined' && value.length !== value.trim().length) {
                return type ? l.whitespaces_on_foldername : l.whitespaces_on_filename;
            }
            return false;
        }
    };
    Object.setPrototypeOf(obj, null);
    return Object.freeze(obj);
});

function renameDialog() {
    "use strict";

    if ($.selected.length > 0) {
        var n = M.d[$.selected[0]] || false;
        var nodeType = n.t;// file: 0, folder: 1
        var ext = fileext(n.name);
        var $dialog = $('.mega-dialog.rename-dialog');
        var $input = $('input', $dialog);
        var errMsg = '';

        M.safeShowDialog('rename', function() {
            $dialog.removeClass('hidden').addClass('active');
            $input.trigger("focus");
            return $dialog;
        });

        const ltWSpaceWarning = new InputFloatWarning($dialog);
        ltWSpaceWarning.hide().check({type: nodeType, name: n.name, ms: 0});

        $('button.js-close, .rename-dialog-button.cancel', $dialog).rebind('click', closeDialog);

        $('.rename-dialog-button.rename').rebind('click', function() {
            if ($dialog.hasClass('active')) {
                var value = $input.val();
                errMsg = '';

                if (n.name && value !== n.name) {
                    if (!value.trim()) {
                        errMsg = l[5744];
                    }
                    else if (M.isSafeName(value)) {
                        var targetFolder = n.p;
                        if (duplicated(value, targetFolder)) {
                            errMsg = l[23219];
                        }
                        else if (!n.s4 || !(errMsg = s4.ui.getInvalidNodeNameError(n, value))) {

                            M.rename(n.h, value).catch(tell);
                        }
                    }
                    else if (value.length > 250) {
                        errMsg = nodeType === 1 ? l.LongName : l.LongName1;
                    }
                    else {
                        errMsg = l[24708];
                    }

                    if (errMsg) {
                        $('.duplicated-input-warning span', $dialog).safeHTML(errMsg);
                        $dialog.addClass('duplicate');
                        $input.addClass('error');

                        setTimeout(function() {
                            $dialog.removeClass('duplicate');
                            $input.removeClass('error');

                            $input.trigger("focus");
                        }, 2000);

                        return;
                    }
                }

                closeDialog();
            }
        });

        $('header h2', $dialog).text(n.t ? n.s4 ? l.s4_bucket_rename : l[425] : l[426]);
        $input.val(n.name);

        $('.item-type-icon', $dialog)
            .attr('class', `item-type-icon icon-${fileIcon(n)}-24`);

        if (!n.t && ext.length > 0) {
            $input[0].selectionStart = 0;
            $input[0].selectionEnd = $input.val().length - ext.length - 1;
        }

        $input.rebind('focus', function() {
            var selEnd;
            $dialog.addClass('focused');
            var d = $(this).val().lastIndexOf('.');
            if (d > -1) {
                selEnd = d;
            }
            else {
                selEnd = $(this).val().length;
            }
            $(this)[0].selectionStart = 0;
            $(this)[0].selectionEnd = selEnd;
        });

        $input.rebind('blur', function() {
            $dialog.removeClass('focused');
        });

        $input.rebind('keydown', (event) => {
            // distingushing only keydown evet, then checking if it's Enter in order to preform the action'
            if (event.keyCode === 13) { // Enter
                $('.rename-dialog-button.rename').click();
                return;
            }
            else if (event.keyCode === 27) { // ESC
                closeDialog();
            }
            else {
                $dialog.removeClass('duplicate').addClass('active');
                $input.removeClass('error');
            }
        });

        $input.rebind('keyup.rename-f', () => {
            ltWSpaceWarning.check({type: nodeType});
        });
    }
}

/**
 * Show message dialog
 * @param {String} type Dialog type. May also contain button labels: "remove:!^$Cancel!Delete"
 * @param {String} title Header text
 * @param {String} msg Main information text
 * @param {String} [submsg] Addition text (Optional)
 * @param {Function} [callback] The function to invoke on button click
 * @param {Boolean|String} [checkboxSetting] Show "Do not show again" block if True
 * @returns {void}
 */
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity
function msgDialog(type, title, msg, submsg, callback, checkboxSetting) {
    'use strict';
    let negate = false;
    let doneButton = l.ok_button;
    let showCloseButton = checkboxSetting === 1;

    type = String(type);
    if (type[0] === '*') {
        type = type.slice(1);
        showCloseButton = true;
    }
    if (type[0] === '-') {
        type = type.slice(1);
        negate = true;
    }
    let extraButton = type.split(':');

    if (extraButton.length === 1) {
        extraButton = null;
    }
    else {
        type = extraButton.shift();
        extraButton = extraButton.join(':');

        if (extraButton[0] === '!') {
            doneButton  = l[82];
            extraButton = extraButton.substr(1);

            if (extraButton[0] === '^') {
                extraButton = extraButton.substr(1);
                var pos = extraButton.indexOf('!');
                doneButton = extraButton.substr(0, pos++);
                extraButton = extraButton.substr(pos);
            }
        }
    }
    if (d && $.warningCallback) {
        console.warn(`There is another dialog open!.. ${$.msgDialog}, ${$.warningCallback}`);
    }
    $.msgDialog = type;
    $.warningCallback = typeof callback === 'function' && ((res) => onIdle(callback.bind(null, res, null)));

    // eslint-disable-next-line sonarjs/no-duplicate-string
    var $dialog = $('#msgDialog').removeClass('confirmation warning info error question ' +
        'delete-contact loginrequired-dialog multiple with-close-btn');

    $dialog.parent().addClass('msg-dialog-container');
    $('#msgDialog aside').addClass('hidden');

    // Show the top right close (x) button
    if (showCloseButton) {
        $dialog.addClass('with-close-btn');
    }

    if (type === 'clear-bin') {
        $('#msgDialog').addClass('warning');
        $('#msgDialog footer .footer-container')
            .safeHTML(
                `<button class="mega-button cancel">
                    <span>@@</span>
                </button>
                <button class="mega-button positive confirm">
                    <span>@@</span>
                </button>`,
                l[82],
                extraButton || l[1018]);

        $('#msgDialog .mega-button.confirm').rebind('click', function() {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback(true);
                $.warningCallback = null;
            }
        });
        $('#msgDialog .mega-button.cancel').rebind('click', function() {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback(false);
                $.warningCallback = null;
            }
        });
    }
    else if (type === 'delete-contact') {
        $('#msgDialog').addClass('delete-contact');
        $('#msgDialog footer .footer-container')
            .safeHTML(
                `<button class="mega-button cancel">
                    <span>@@</span>
                </button>
                <button class="mega-button positive confirm">
                    <span>@@</span>
                </button>`,
                l[79],
                l[78]);

        // eslint-disable-next-line sonarjs/no-identical-functions
        $('#msgDialog .mega-button.confirm').rebind('click', function() {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback(true);
                $.warningCallback = null;
            }
        });

        // eslint-disable-next-line sonarjs/no-identical-functions
        $('#msgDialog .mega-button.cancel').rebind('click', function() {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback(false);
                $.warningCallback = null;
            }
        });
    }
    else if (type === 'warninga' || type === 'warningb' || type === 'info' || type === 'error') {
        if (extraButton) {
            $('#msgDialog footer .footer-container')
                .safeHTML(
                    `<button class="mega-button cancel">
                        <span>@@</span>
                    </button>
                    <button class="mega-button positive confirm">
                        <span>@@</span>
                    </button>`,
                    extraButton,
                    doneButton
                );

            // eslint-disable-next-line sonarjs/no-identical-functions
            $('#msgDialog .mega-button.confirm').rebind('click', function() {
                closeMsg();
                if ($.warningCallback) {
                    $.warningCallback(false);
                    $.warningCallback = null;
                }
            });

            // eslint-disable-next-line sonarjs/no-identical-functions
            $('#msgDialog .mega-button.cancel').rebind('click', function() {
                closeMsg();
                if ($.warningCallback) {
                    $.warningCallback(true);
                    $.warningCallback = null;
                }
            });
        }
        else {
            $('#msgDialog footer .footer-container').safeHTML(
                `<button class="mega-button confirm ${checkboxSetting === 1 ? 'positive' : ''}">
                    <span>@@</span>
                </button>`,
                l.ok_button
            );

            // eslint-disable-next-line sonarjs/no-identical-functions
            $('#msgDialog .mega-button.confirm').rebind('click', function() {
                closeMsg();
                if ($.warningCallback) {
                    $.warningCallback(true);
                    $.warningCallback = null;
                }
            });
        }
        if (type === 'warninga') {
            $('#msgDialog').addClass('info');
        }
        else if (type === 'warningb') {
            $('#msgDialog').addClass('warning');
        }
        else if (type === 'info') {
            $('#msgDialog').addClass('info');
        }
        else if (type === 'error') {
            $('#msgDialog').addClass('error');
        }
    }
    else if (type === 'confirmationa' || type === 'confirmation' || type === 'remove') {
        if (doneButton === l.ok_button) {
            doneButton = false;
        }

        negate = negate || doneButton === l[23737];
        $('#msgDialog footer .footer-container')
            .safeHTML(
                `<div class="space-between">
                    <button class="mega-button cancel">
                        <span>@@</span>
                    </button>
                    <button class="mega-button ${negate ? 'negative' : 'positive'} confirm">
                        <span>@@</span>
                    </button>
                </div>`,
                extraButton || l[79],
                doneButton || l[78]);

        $('#msgDialog aside')
            .safeHTML(`<div class="checkbox-block top-pad">
                    <div class="checkdiv checkboxOff">
                        <input type="checkbox" name="confirmation-checkbox"
                            id="confirmation-checkbox" class="checkboxOff">
                    </div>
                    <label for="confirmation-checkbox" class="radio-txt">@@</label>
                </div>`, l.do_not_show_this_again);
        $('#msgDialog aside').removeClass('hidden');

        // eslint-disable-next-line sonarjs/no-identical-functions
        $('#msgDialog .mega-button.confirm').rebind('click', function() {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback(true);
                $.warningCallback = null;
            }
        });
        // eslint-disable-next-line sonarjs/no-identical-functions
        $('#msgDialog .mega-button.cancel').rebind('click', function() {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback(false);
                $.warningCallback = null;
            }
        });
        if (type === 'remove') {
            $('#msgDialog').addClass('warning');
        }
        else if (type === 'confirmationa') {
            $('#msgDialog').addClass('info');
        }
        else {
            $('#msgDialog').addClass('confirmation');
        }

        checkboxSetting = checkboxSetting === 1 ? null : checkboxSetting;
        if (checkboxSetting) {
            assert(
                checkboxSetting === 'cslrem'
                || checkboxSetting === 'nowarnpl'
                || checkboxSetting === 'skipDelWarning', checkboxSetting);

            $('#msgDialog .checkbox-block .checkdiv,' +
                '#msgDialog .checkbox-block input')
                    .removeClass('checkboxOn').addClass('checkboxOff');

            $.warningCheckbox = false;
            $('#msgDialog aside').removeClass('hidden');
            $('#msgDialog .checkbox-block').rebind('click', function() {
                var $o = $('#msgDialog .checkbox-block .checkdiv, #msgDialog .checkbox-block input');
                if ($('#msgDialog .checkbox-block input').hasClass('checkboxOff')) {
                    $o.removeClass('checkboxOff').addClass('checkboxOn');
                    mega.config.set(checkboxSetting, 1);
                }
                else {
                    $o.removeClass('checkboxOn').addClass('checkboxOff');
                    mega.config.remove(checkboxSetting);
                }

                return false;
            });
        }
        else {
            $('#msgDialog aside').addClass('hidden');
        }
    }
    else if (type === 'import_login_or_register') {
        // Show import confirmation dialog if a user isn't logged in
        $('#msgDialog').addClass('question with-close-btn');
        $('#msgDialog footer .footer-container')
            .safeHTML(
                `<a class="bottom-bar-link">@@</a>
                <button class="mega-button cancel">
                    <span>@@</span>
                </button>
                <button class="mega-button positive confirm">
                    <span>@@</span>
                </button>`,
                l[20754],
                l[171],
                l[170]);

        // Register a new account to complete the import
        $('#msgDialog .mega-button.confirm').rebind('click', function() {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback('register');
                $.warningCallback = null;
            }
        });
        // Login to complete the import
        $('#msgDialog .mega-button.cancel').rebind('click', function() {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback('login');
                $.warningCallback = null;
            }
        });
        // Have an ephemeral account to complete the import
        $('#msgDialog .bottom-bar-link').rebind('click', function() {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback('ephemeral');
                $.warningCallback = null;
            }
        });
    }
    else if (type === 'save_discard_cancel') {
        $('footer .footer-container', $dialog)
            .safeHTML(
                `<div class="space-between">
                    <button class="mega-button cancel">
                        <span>@@</span>
                    </button>
                    <button class="mega-button discard">
                        <span>@@</span>
                    </button>
                    <button class="mega-button positive confirm">
                        <span>@@</span>
                    </button>
                </div>`,
                l.msg_dlg_cancel, l.msg_dlg_discard, l.msg_dlg_save);

        $('.mega-button.confirm', $dialog).rebind('click.msgdlg', () => {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback(1);
                $.warningCallback = null;
            }
        });
        $('.mega-button.cancel', $dialog).rebind('click.msgdlg', () => {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback(0);
                $.warningCallback = null;
            }
        });
        $('.mega-button.discard', $dialog).rebind('click.msgdlg', () => {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback(-1);
                $.warningCallback = null;
            }
        });
        $dialog.addClass('confirmation');

        $('aside', $dialog).addClass('hidden');
    }

    $('#msgDialog header p.subtitle').text(title);

    if (msg) {
        $('#msgDialog header h3').safeHTML(msg);
    }
    else {
        $('#msgDialog header h3').addClass('hidden');
    }

    clickURLs();
    if (submsg) {
        $('#msgDialog header p.text').safeHTML(submsg);
        $('#msgDialog header p.text').removeClass('hidden');
    }
    else {
        $('#msgDialog header p.text').addClass('hidden');
    }

    // eslint-disable-next-line sonarjs/no-identical-functions
    $('#msgDialog button.js-close').rebind('click', function() {
        closeMsg();
        if ($.warningCallback) {
            $.warningCallback(null);
            $.warningCallback = null;
        }
    });
    $('#msgDialog').removeClass('hidden');
    fm_showoverlay();

    if ($.dialog) {
        $('.mega-dialog:not(#msgDialog)').addClass('arrange-to-back');
        $('.mega-dialog-container.common-container').addClass('arrange-to-back');
    }
}

// eslint-disable-next-line strict -- see {@link msgDialog}
function asyncMsgDialog(...args) {
    return new Promise((resolve, reject) => {
        const callback = args[4] || echo;
        args[4] = tryCatch((value) => {
            Promise.resolve(callback(value)).then(resolve).catch(reject);
        }, reject);
        msgDialog(...args);
    });
}

function closeMsg() {
    var $dialog = $('#msgDialog').addClass('hidden');
    $dialog.parent().removeClass('msg-dialog-container');

    if ($.dialog && !(M.chat && $.dialog === 'onboardingDialog')) {
        $('.mega-dialog').removeClass('arrange-to-back');
        $('.mega-dialog-container.common-container').removeClass('arrange-to-back');
    }
    else {
        fm_hideoverlay();
    }

    delete $.msgDialog;
    mBroadcaster.sendMessage('msgdialog-closed');
}

/**
 * opens a contact link dialog, after getting all needed info from API
 *
 * @param {String} contactLink, user contact link, the link we want to get.
 * @returns {null} no return value
 */
function openContactInfoLink(contactLink) {
    var $dialog = $('.mega-dialog.qr-contact');
    var QRContactDialogPrepare = function QRContactDialogPrepare(em, fullname, ctHandle, avatar) {
        $('.qr-contact-name', $dialog).text(fullname);
        $('.qr-contact-email', $dialog).text(em);

        if (avatar && avatar.length > 5) {
            useravatar.setUserAvatar(em, base64_to_ab(avatar));

            avatar = `<div class="avatar-wrapper small-rounded-avatar"><img src="${avatars[em].url}"></div>`;
        }
        else {
            avatar = useravatar.contact(em, 'small-rounded-avatar square');
        }
        $('.avatar-container-qr-contact', $dialog).safeHTML(avatar);

        var contactStatus = 1;
        if (u_handle) {
            if (ctHandle === u_handle) {
                $('#qr-ctn-add', $dialog).addClass('disabled');
                $('#qr-ctn-add', $dialog).off('click');
                $('.qr-ct-exist', $dialog).text(l[18514]).removeClass('hidden');
                $('aside', $dialog).removeClass('hidden');
            }
            else if (M.u[ctHandle] && M.u[ctHandle]._data.c) {
                contactStatus = 2;
                $('#qr-ctn-add', $dialog).addClass('disabled');
                $('.qr-ct-exist', $dialog).text(l[17886]).removeClass('hidden');
                $('aside', $dialog).removeClass('hidden');
                $('#qr-ctn-add', $dialog).off('click');
            }
            else {
                $('.big-btn-txt', $dialog).text(l[101]);
                $('#qr-ctn-add', $dialog).removeClass('disabled');
                $('.qr-ct-exist', $dialog).addClass('hidden');
                $('aside', $dialog).addClass('hidden');
                $('#qr-ctn-add', $dialog).rebind('click', function () {
                    if (contactStatus === 1) {
                        M.inviteContact(u_attr.email, em, null, contactLink);
                    }
                    $('#qr-ctn-add', $dialog).off('click');
                    closeDialog();

                    return false;
                });

                // This contact link is valid to be affilaited
                M.affiliate.storeAffiliate(contactLink, 4);
            }
        }
        else {
            $('.big-btn-txt', $dialog).text(l[101]);
            $('#qr-ctn-add', $dialog).removeClass('disabled');
            $('.qr-ct-exist', $dialog).addClass('hidden');
            $('aside', $dialog).addClass('hidden');
            $('#qr-ctn-add', $dialog).rebind('click', function () {
                closeDialog();
                var page = 'fm/chat/contacts';
                mBroadcaster.once('fm:initialized', function () {
                    openContactInfoLink(contactLink);
                });

                // This contact link is not checked but stored for register case
                // and also user click `add contact` anyway so it's user's call
                M.affiliate.storeAffiliate(contactLink, 4);

                login_next = page;
                login_txt = l[1298];
                return loadSubPage('login');
            });
        }
    };


    api.req({a: 'clg', cl: contactLink})
        .then(({result}) => {

            M.safeShowDialog('qr-contact', () => {
                QRContactDialogPrepare(result.e, `${result.fn || ''} ${result.ln || ''}`, result.h, result['+a']);

                $('button.js-close', $dialog).rebind('click', () => loadSubPage('fm'));
                return $dialog.removeClass('hidden');
            });

        })
        .catch((ex) => {
            console.error(ex);
            msgDialog('warningb', l[8531], l[17865]);
        });
}

/**
 * shareDialogContentCheck
 *
 * Taking care about share dialog buttons enabled/disabled and scroll
 *
 */
function shareDialogContentCheck() {

    var dc = document.querySelector('.mega-dialog.share-dialog');
    var itemsNum = $('.share-dialog-access-list .share-dialog-access-node', dc).length;
    var $doneBtn = $('.done-share', dc);
    var $removeBtn = $('.remove-share', dc);

    // Taking care about the sharing access list scrolling
    initPerfectScrollbar($('.share-dialog-access-list', dc));

    // Taking care about the Remove Share button enabled/disabled
    if (itemsNum > 1) {
        $removeBtn.removeClass('disabled');
    }
    else {
        $removeBtn.addClass('disabled');
    }

    // Taking care about the Done button enabled/disabled
    if (Object.keys($.addContactsToShare).length
        || Object.keys($.changedPermissions).length
        || Object.keys($.removedContactsFromShare).length) {
        $doneBtn.removeClass('disabled');
    }
    else {
        $doneBtn.addClass('disabled');
    }

    if (!dc) {
        return;
    }

    const cvw = dc.querySelector('.contact-verify-warning');
    const cvn = dc.querySelector('.contact-verify-notification');

    cvw.classList.add('hidden');
    cvn.classList.add('hidden');

    const cv = mega.keyMgr.getWarningValue('cv') !== false;

    if (!cv && u_attr.since < 1697184000 && !mega.keyMgr.getWarningValue('cvb')) {
        cvn.classList.remove('hidden');
        // Set warning value for contact verificaiton banner
        mega.keyMgr.setWarningValue('cvb', '1');
        const cvnText = cvn.querySelector('span');
        $(cvnText).safeHTML(
            escapeHTML(l.contact_verification_notif_banner)
                .replace(
                    '[D]',
                    '<div class="contact-verification-settings">'
                )
                .replace('[/D]', '</div>')
        );
    }

    // if any unverified contact
    if (cv && dc.querySelector('.unverified-contact')) {
        cvw.classList.remove('hidden');
    }
}

/**
 * Generate the html DOM element for a single share contact of the folder
 *
 * @param {string} userEmail contact email
 * @param {string} type  type of contact e.g. type 1 indicates the owner of the folder
 * @param {string} id    contact handle
 * @param {string} av    contact avatar
 * @param {string} userName  contact name
 * @param {string} permClass permission classname
 *
 * @returns {string}
 */
function renderContactRowContent(userEmail, type, id, av, userName, permClass) {
    "use strict";
    var html = '';
    var presence = type === '1' ? M.onlineStatusClass(M.u[id].presence)[1] : '';
    if (M.d[id] && M.d[id].presence) {
        presence = M.onlineStatusClass(M.d[id].presence === 'unavailable' ? 1 : M.d[id].presence)[1];
    }

    let extraClass = '';
    if (type === '1') {
        userName += ` (${l[8885]})`;
        permClass = 'owner';
        extraClass = ' owner';
    }
    else if (type === '2') {
        userName = l.contact_request_pending.replace('%1', userName);
    }
    else if (mega.keyMgr.getWarningValue('cv') === '1') {
        const ed = authring.getContactAuthenticated(id, 'Ed25519');

        if (!(ed && ed.method >= authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON)) {
            extraClass += ' unverified-contact';
        }
    }

    html =  `<div class="share-dialog-access-node${extraClass}" id="${id}">
                <div class="access-node-info-block">
                    ${av}
                    <div class="access-node-username">
                        ${htmlentities(userName)}
                    </div>
                </div>
                <div class="access-node-contact-verify">
                    <div class='contact-verify'>${l.verify_credentials}</div>
                </div>
                <div class="access-node-permission-wrapper">
                    <button
                        class="mega-button action icon round access-node-permission ${permClass}
                        ${permClass === 'full-access' ? ' simpletip' : ''}"
                        data-simpletip="${l[23709]}" data-simpletipposition="top"
                        data-simpletipwrapper=".mega-dialog-container"
                        data-simpletipoffset="5" data-simpletip-class="medium-width center-align">
                        <i class="owner sprite-fm-uni icon-owner"></i>
                        <i class="full-access sprite-fm-mono icon-star"></i>
                        <i class="read-and-write sprite-fm-mono icon-permissions-write"></i>
                        <i class="read-only sprite-fm-mono icon-read-only"></i>
                    </button>
                </div>
                <i class="access-node-remove sprite-fm-mono icon-remove"></i>
            </div>`;

    return html;
}

/**
 * Generate the html content
 *
 * @param {Boolean} readonly Sets read-only for new users and doesn't allow to change it (Optional)
 * @returns {void}
 */
function fillShareDialogWithContent(readonly) {

    "use strict";

    let pendingShares = {};
    const nodeHandle = String($.selected[0]);
    const node = M.getNodeByHandle(nodeHandle);
    const seen = {};
    let userHandles   = M.getNodeShareUsers(node, 'EXP');
    $.sharedTokens = [];// GLOBAL VARIABLE, Hold items currently visible in share folder content (above multi-input)

    if (M.ps[nodeHandle]) {
        pendingShares = Object(M.ps[nodeHandle]);
        userHandles   = userHandles.concat(Object.keys(pendingShares));
    }

    // Fill the owner of the folder on the top of the access list
    if (u_attr) {
        generateShareDialogRow(u_attr.name, u_attr.email, 2, u_attr.u);
    }

    // Remove items in the removed contacts list
    for (var rmContact in $.removedContactsFromShare) {
        const rmContactIndex = userHandles.indexOf(rmContact);
        if (rmContactIndex > -1) {
            userHandles.splice(rmContactIndex, 1);
        }
    }

    // Existing contacts in shares
    userHandles.forEach(function(handle) {
        const user = M.getUser(handle) || Object(M.opc[handle]);

        if (!user.m) {
            console.warn('Unknown user "%s"!', handle);
        }
        else if (!seen[user.m]) {
            const name  = M.getNameByHandle(handle) || user.m;
            const share = M.getNodeShare(node, handle) || Object(pendingShares[handle]);

            generateShareDialogRow(
                name,
                user.m,
                share.r | 0,
                handle,
                handle in pendingShares,
                readonly
            );
            seen[user.m] = 1;
        }
    });

    // New added contacts
    for (var newContact in $.addContactsToShare) {

        let newContactName;
        const newContactEmail = $.addContactsToShare[newContact].u;

        // Backup folder can be only shared as Read-Only
        if (readonly) {
            $.addContactsToShare[newContact].r = 0;
        }

        if (!seen[newContactEmail]) {
            let pendingContact;
            if (newContact.startsWith('#new_')) {
                newContactName = $.addContactsToShare[newContact].u;
                pendingContact = true;
            }
            else {
                newContactName  = M.getNameByHandle(newContact) || newContactEmail;
                pendingContact = !!M.findOutgoingPendingContactIdByEmail(newContactEmail);
            }
            const shareRights = $.addContactsToShare[newContact].r;
            generateShareDialogRow(
                newContactName,
                newContactEmail,
                shareRights,
                newContact,
                pendingContact,
                readonly
            );
            seen[newContactEmail] = 1;
        }
    }
}

/**
 * Generates and inserts a share or pending share row into the share dialog
 * @param {String} displayNameOrEmail
 * @param {String} email
 * @param {Number} shareRights
 * @param {String} userHandle Optional
 * @param {boolean} isPending if true, shows text 'contact request pending'
 * @param {Boolean} disabled Doesn't not allow to change the permissions (Optional)
 */
function generateShareDialogRow(displayNameOrEmail, email, shareRights, userHandle, isPending, disabled) {
    'use strict';
    var rowId = '',
        html = '',
        av =  useravatar.contact(userHandle || email, 'access-node-avatar'),
        perm = '',
        permissionLevel = 0;

    if (typeof shareRights != 'undefined') {
        permissionLevel = shareRights;
    }

    // Restore the latest changed permission
    if ($.changedPermissions
        && $.changedPermissions[userHandle]) {

        permissionLevel = $.changedPermissions[userHandle].r;
    }

    // Permission level
    if (permissionLevel === 1) {
        perm = 'read-and-write';
    }
    else if (permissionLevel === 2) {
        perm = 'full-access';
    }
    else {
        perm = 'read-only';
    }

    // Do not allow to change permissions
    if (disabled) {
        perm += ' disabled';
    }

    // Add contact
    $.sharedTokens.push(email.toLowerCase());

    rowId = (userHandle) ? userHandle : email;
    if (u_attr && userHandle === u_attr.u) {
        html = renderContactRowContent(email, '1', rowId, av, displayNameOrEmail, perm);
    }
    else {
        html = renderContactRowContent(email, isPending ? '2' : '', rowId, av, displayNameOrEmail, perm);
    }

    $('.share-dialog .share-dialog-access-list').safeAppend(html);
}

/**
 * Hide the permission menu in the share dialog
 */
function hideShareDialogPermMenu() {
    "use strict";
    var $shareDialog = $('.mega-dialog.share-dialog');
    var $permissionMenu = $('.share-dialog-permissions-menu', $shareDialog).addClass('o-hidden');

    $('.option', $permissionMenu).removeClass('active');
    $('.share-dialog-access-node', $shareDialog).removeClass('active');

    setTimeout(() => {
        $permissionMenu.addClass('hidden');
    }, 200);
}

/**
 * Show the permission menu in the share dialog with the position x and y
 *
 * @param {Object} $this    The selected contact element in the DOM
 * @param {Number} x        The x position of showing the menu
 * @param {Number} y        The y position of showing the menu
 */
function showShareDialogPermMenu($this, x, y) {

    "use strict";

    const $shareDialog = $('.mega-dialog.share-dialog', '.mega-dialog-container');
    const $permissionMenu = $('.share-dialog-permissions-menu', $shareDialog)
        .removeClass('hidden').addClass('o-hidden');
    const permissionLevel = checkMultiInputPermission($this);

    if ($this.is('.disabled')) {
        return false;
    }

    $('.option', $permissionMenu).removeClass('active');
    $('.option.' + permissionLevel[0], $permissionMenu).addClass('active');
    $permissionMenu.css('right', x + 'px');
    $permissionMenu.css('top', y + 'px');
    onIdle(() => {
        $permissionMenu.removeClass('o-hidden');
    });

    $permissionMenu.rebind('mouseover.showTipMsg', () => {
        $('.share-dialog-bottom-msg span', $shareDialog).removeClass('v-hidden');
    });

    $permissionMenu.rebind('mouseout.hideTipMsg', () => {
        $('.share-dialog-bottom-msg span', $shareDialog).addClass('v-hidden');
    });
}

/**
 * Bind events to various components in the access list of share dialog after rendering
 */
function shareDialogAccessListBinds() {
    "use strict";
    var $shareDialog = $('.mega-dialog.share-dialog');

    // Open the permissions menu
    $('.access-node-permission-wrapper', $shareDialog).rebind('click', function(e) {
        e.stopPropagation();
        var $this = $(this);
        var $selectedContact = $this.parent('.share-dialog-access-node');

        if ($selectedContact.is('.owner')) {
            return false;
        }

        var $scrollBlock = $('.share-dialog-access-list', $shareDialog);
        var scrollPos = 0;
        var x = 0;
        var y = 0;

        if ($scrollBlock.length) {
            scrollPos = $scrollBlock.position().top;
        }

        if ($selectedContact.is('.active')) {
            hideShareDialogPermMenu();
            $selectedContact.removeClass('active');
        }
        else {
            $('.share-dialog-access-node', $shareDialog).removeClass('active');
            x = 45;
            y = $this.position().top + $this.outerHeight() + 5 + scrollPos;

            showShareDialogPermMenu($('.access-node-permission', $(this)), x, y);
            $selectedContact.addClass('active');
        }
    });

    // Remove the specific contact from share
    $('.access-node-remove', $shareDialog).rebind('click', function() {
        var $deletedContact = $(this).parent('.share-dialog-access-node');

        if ($deletedContact.is('.owner')) {
            return false;
        }

        var userHandle = $deletedContact.attr('id');
        var selectedNodeHandle = $.selected[0];

        $deletedContact.remove();

        if (userHandle !== '') {
            var userEmail = '';
            if ($.addContactsToShare[userHandle]) {
                userEmail = $.addContactsToShare[userHandle].u;
                delete $.addContactsToShare[userHandle];
            }
            else {
                // Due to pending shares, the id could be an email instead of a handle
                var userEmailOrHandle = Object(M.opc[userHandle]).m || userHandle;
                userEmail = Object(M.opc[userHandle]).m || M.getUserByHandle(userHandle).m;

                $.removedContactsFromShare[userHandle] = {
                    'selectedNodeHandle': selectedNodeHandle,
                    'userEmailOrHandle': userEmailOrHandle,
                    'userHandle': userHandle
                };

                // Remove the permission change if exists
                if ($.changedPermissions[userHandle]) {
                    delete $.changedPermissions[userHandle];
                }
            }

            // Remove it from multi-input tokens
            var sharedIndex = $.sharedTokens.indexOf(userEmail.toLowerCase());
            if (sharedIndex > -1) {
                $.sharedTokens.splice(sharedIndex, 1);
            }
        }

        shareDialogContentCheck();
    });

    // Hide the permission menu once scrolling
    $('.share-dialog-access-list', $shareDialog).rebind('scroll.closeMenu', () => {
        hideShareDialogPermMenu();
    });

    $('.access-node-contact-verify .contact-verify', $shareDialog).rebind('click', function() {

        const contact = this.closest('.unverified-contact');

        if (contact) {
            fingerprintDialog(this.closest('.unverified-contact').id);
        }
    });

    $('.contact-verification-settings', $shareDialog).rebind('click', () => {
        M.openFolder('account/contact-chats/contact-verification-settings', true);
    });
}

/**
 * updateDialogDropDownList
 *
 * Extract id from list of emails, preparing it for extrusion,
 * fill multi-input dropdown list with not used emails.
 *
 * @param {String} dialog multi-input dialog class name.
 */
function updateDialogDropDownList(dialog) {

    var listOfEmails = M.getContactsEMails(),
        allEmails = [],
        contacts;

    // Loop through email list and extrude id
    for (var i in listOfEmails) {
        if (listOfEmails.hasOwnProperty(i)) {
            allEmails.push(listOfEmails[i].id);
        }
    }

    contacts = excludeIntersected($.sharedTokens, allEmails);
    addToMultiInputDropDownList(dialog, contacts);
}

/**
 * checkMultiInputPermission
 *
 * Check DOM element permission level class name.
 * @param {Object} $this, DOM drop down list element.
 * @returns {Array} [drop down list permission class name, translation string].
 */
function checkMultiInputPermission($this) {

    var permissionLevel;

    if ($this.is('.read-and-write')) {
        permissionLevel = ['read-and-write', l[56]]; // Read & Write
    }
    else if ($this.is('.full-access')) {
        permissionLevel = ['full-access', l[57]]; // Full access
    }
    else {
        permissionLevel = ['read-only', l[55]]; // Read-only
    }

    return permissionLevel;
}

/**
 * Checks if an email address is already known by the user
 * @param {String} email
 * @returns {Boolean} Returns true if it exists in the state, false if it is new
 */
function checkIfContactExists(email) {

    var userIsAlreadyContact = false;
    var userContacts = M.u;

    // Loop through the user's contacts
    for (var contact in userContacts) {
        if (userContacts.hasOwnProperty(contact)) {

            // Check if the users are already contacts by comparing email addresses of known contacts and the one entered
            if (email === userContacts[contact].m) {
                userIsAlreadyContact = true;
                break;
            }
        }
    }

    return userIsAlreadyContact;
}

/**
 * sharedPermissionLevel
 *
 * Translate class name to numeric permission level.
 * @param {String} value Permission level as a string i.e. 'read-and-write', 'full-access', 'read-only'.
 * @returns {Number} integer value of permission level.
 */
function sharedPermissionLevel(value) {

    var permissionLevel = 0;

    if (value === 'read-and-write') {
        permissionLevel = 1; // Read and Write access
    }
    else if (value === 'full-access') {
        permissionLevel = 2; // Full access
    }
    else {
        permissionLevel = 0; // read-only
    }

    return permissionLevel;
}

/**
 * Initialize share dialog multi input plugin
 *
 * @param {array} alreadyAddedContacts  Array of already added contacts
 */
function initShareDialogMultiInput(alreadyAddedContacts) {
    "use strict";

    var $scope = $('.share-add-dialog');
    var $input = $('.share-multiple-input', $scope);
    var listedContacts = []; // All listed contact emails

    var errorMsg = function(msg) {
        var $warning = $('.multiple-input-warning span', $scope);

        $warning.text(msg);
        $scope.addClass('error');

        setTimeout(function() {
            $scope.removeClass('error');
        }, 3000);
    };

    Object.values(M.getContactsEMails(true)).forEach(function(item) {
        listedContacts.push(item.id);
    });

    // Clear old values in case the name/nickname updated since last opening
    $input.tokenInput('destroy');

    $input.tokenInput([], {
        theme: "mega",
        placeholder: l[23711],
        searchingText: "",
        noResultsText: "",
        addAvatar: true,
        autocomplete: null,
        searchDropdown: false,
        emailCheck: true,
        preventDoublet: false,
        tokenValue: "id",
        propertyToSearch: "id",
        resultsLimit: 5,
        minChars: 1,
        accountHolder: (M.u[u_handle] || {}).m || '',
        scrollLocation: 'share',
        initFocused: false,
        // Exclude from dropdownlist only emails/names which exists in multi-input (tokens)
        excludeCurrent: true,
        onEmailCheck: function() {
            errorMsg(l[2465]); // Please enter a valid email address
        },
        onReady: function() {
        },
        onDoublet: function() {
            errorMsg(l[23714]); // This folder has already been shared with this email address
        },
        onHolder: function() {
            errorMsg(l[23715]); // It is not necessary to share this folder with yourself
        },
        onAdd: function(email) {
            if (listedContacts.indexOf(email.id) > -1) {
                // If the entered email is one of existing contacts in the picker, select it automatically for users
                const $listedItemHandle = M.getUserByEmail(email.id).h;
                const $listedItemEle = $(`.contacts-search-subsection .${$listedItemHandle}`, $scope);
                const $scrollBlock = $('.contacts-search-scroll', $scope);

                if ($scrollBlock.is('.ps')) {
                    // Auto-scroll to the selected element
                    scrollToElement($scrollBlock, $listedItemEle);
                }

                if ($.contactPickerSelected
                    && !$.contactPickerSelected.includes($listedItemHandle)) {

                    $listedItemEle.trigger('click');
                }

                $('.token-input-token-mega .' + $listedItemHandle, $scope)
                    .siblings('.token-input-delete-token-mega').trigger('click');
            }
            else {
                if (typeof M.findOutgoingPendingContactIdByEmail(email.id) === 'undefined') {
                    // Show a text area where the user can add a custom message to the pending share request
                    $('.share-message', $scope).removeClass('hidden');
                    initTextareaScrolling($('.share-message-textarea textarea', $scope));
                }

                $('.add-share', $scope).removeClass('disabled');
            }
        },
        onDelete: function() {
            var $scope = $('.share-add-dialog');
            var $newEmails = $('.token-input-list-mega .token-input-token-mega', $scope);
            var newEmailsNum = $newEmails.length;
            var noNewContacts = true;

            onIdle(() => {
                $('.token-input-input-token-mega input', $scope).trigger("blur");
            });

            for (var i = 0; i < newEmailsNum; i++) {
                var newEmail = $($newEmails[i]).contents().eq(1).text();
                if (!M.findOutgoingPendingContactIdByEmail(newEmail)) {
                    noNewContacts = false;
                    break;
                }
            }

            // If no new email that hasn't been sent contact request, clear and hide the personal message input box
            if (noNewContacts) {
                $('.share-message', $scope).addClass('hidden');
                $('.share-message textarea', $scope).val('');
            }

            // If no new email is in multiInput box and contact picker, disable the button
            if (newEmailsNum === 0) {
                const sel = $.contactPickerSelected;

                if (Array.isArray(sel) && JSON.stringify(sel.sort()) === JSON.stringify(alreadyAddedContacts.sort())) {
                    $('.add-share', $scope).addClass('disabled');
                }
            }
        }
    });
}

/**
 * Render the content of access list in share dialog
 */
function renderShareDialogAccessList() {
    "use strict";

    const $shareDialog = $('.mega-dialog.share-dialog', '.mega-dialog-container');
    const $warning = $('.mega-banner', $shareDialog).eq(2);
    let readonly = false;

    // Remove all contacts from the access list
    $('.share-dialog-access-node').remove();

    // Clear and hide warning
    $warning.addClass('hidden').text('');

    if (M.currentrootid === M.InboxID || M.getNodeRoot($.selected[0]) === M.InboxID) {

        $warning.safeHTML(l.backup_read_only_wrng).removeClass('hidden');
        $('span', $warning).text('').attr({
            'class': 'sprite-fm-mono icon-info-filled simpletip',
            'data-simpletip': l.backup_read_only_info,
            'data-simpletip-class': 'backup-tip short',
            'data-simpletipposition': 'top',
            'data-simpletipoffset': 6
        }).trigger('simpletipUpdated');

        readonly = true;
    }

    // Fill the shared folder's access list
    fillShareDialogWithContent(readonly);

    // Take care about share button enabled/disabled and the access list scrolling
    shareDialogContentCheck();

    // Bind events to components in the access list after rendering
    shareDialogAccessListBinds();
}

/**
 * Initializes the share dialog
 */
function initShareDialog() {
    "use strict";

    var $dialog = $('.share-dialog');

    $dialog.rebind('click', function(e) {
        var $target = $(e.target);

        // Hide the permission menu once click outside range of it
        if (!$target.is('.share-dialog-permissions-menu')
           &&  !$target.closest('.share-dialog-permissions-menu').length) {

            hideShareDialogPermMenu();
        }
    });

    var $shareAddFooterElement = null;

    // Close the share dialog
    $('button.js-close', $dialog).rebind('click', function() {
        showLoseChangesWarning().done(closeDialog);
    });

    // Change the permission for the specific contact or group
    $('.share-dialog-permissions-menu .option', $dialog).rebind('click', function(e) {
        var $this = $(this);
        const {shares} = M.getNodeByHandle($.selected[0]);
        var newPermLevel = checkMultiInputPermission($this);
        var newPerm = sharedPermissionLevel(newPermLevel[0]);
        var $selectedContact =  $('.share-dialog-access-node.active', $dialog);

        hideShareDialogPermMenu();

        var pushNewPermissionIn = function(id) {
            if (!shares || !shares[id] || shares[id].r !== newPerm) {
                // If it's a pending contact, provide the email
                var userEmailOrHandle = Object(M.opc[id]).m || id;

                $.changedPermissions[id] = {u: userEmailOrHandle, r: newPerm};
            }
        };

        if (e.shiftKey) {
            // Change the permission for all listed contacts

            for (var key in $.addContactsToShare) {
                $.addContactsToShare[key].r = newPerm;
            }

            $.changedPermissions = {};

            $('.share-dialog-access-node:not(.owner)', $dialog).get().forEach(function(item) {
                var itemId = $(item).attr('id');
                if (itemId !== undefined && itemId !== '' && !$.addContactsToShare[itemId]) {
                    pushNewPermissionIn(itemId);
                }
            });

            const $nodes = $('.share-dialog-access-node:not(.owner) .access-node-permission', $dialog);
            $nodes.removeClass('full-access read-and-write read-only simpletip')
                .addClass(newPermLevel[0]);

            if (newPermLevel[0] === 'full-access') {
                $nodes.addClass('simpletip');
            }
        }
        else {
            // Change the permission for the specific contact
            var userHandle = $selectedContact.attr('id');

            if (userHandle !== undefined && userHandle !== '') {
                if ($.addContactsToShare[userHandle]) {
                    // Change the permission for new added share contacts
                    $.addContactsToShare[userHandle].r = newPerm;
                }
                else {
                    // Change the permission for existing share contacts
                    if ($.changedPermissions[userHandle]) {
                        // Remove the previous permission change if exists
                        delete $.changedPermissions[userHandle];
                    }

                    pushNewPermissionIn(userHandle);
                }
            }

            const $node = $('.access-node-permission', $selectedContact);
            $node.removeClass('full-access read-and-write read-only simpletip')
                .addClass(newPermLevel[0]);

            if (newPermLevel[0] === 'full-access') {
                $node.addClass('simpletip');
            }
        }

        // Share button enable/disable control
        if (Object.keys($.changedPermissions).length > 0) {
            $('.done-share', $dialog).removeClass('disabled');
        }
        else if (Object.keys($.removedContactsFromShare).length === 0
            && Object.keys($.addContactsToShare).length === 0) {
            $('.done-share', $dialog).addClass('disabled');
        }

        return false;
    });

    // Open the share add dialog
    $('.share-dialog-access-add', $dialog).rebind('click', function() {
        var alreadyAddedContacts = [];

        $('.share-dialog-access-node:not(.owner)', $dialog).get().forEach(function(item) {
            var itemId = $(item).attr('id');
            if (!itemId.startsWith('#new_') && M.u[itemId]) {
                alreadyAddedContacts.push(itemId);
            }
        });

        if(!$shareAddFooterElement) {
            $shareAddFooterElement = $(document.querySelector('.share-add-dialog-bottom-template')
                .content.firstElementChild.cloneNode(true));
        }
        M.initShareAddDialog(alreadyAddedContacts, $shareAddFooterElement);
    });

    $('.done-share', $dialog).rebind('click', function() {
        if (!$(this).is('.disabled')) {
            addNewContact($(this), false).done(function() {
                var share = new mega.Share();

                share.updateNodeShares();
                eventlog(500037);
            });
        }

        return false;
    });

    $('.remove-share', $dialog).rebind('click', function() {
        if (!$(this).is('.disabled')) {
            msgDialog(`remove:!^${l[23737]}!${l[82]}`, '', l.remove_share_title, l.remove_share_msg, res => {
                if (res) {
                    loadingDialog.show();
                    new mega.Share().removeSharesFromSelected().always(() => {
                        loadingDialog.hide();
                        closeDialog();
                    });
                }
            }, 1);
        }
        return false;
    });
}

/**
 * Check the dialog has token input that is already filled up by user or any unsaved changes.
 * Warn user closing dialog will lose all inserted input and unsaved changes.
 */

function showLoseChangesWarning() {
    "use strict";

    var $dialog = $('.mega-dialog:visible');
    if ($dialog.length !== 1) {
        console.warn('Unexpected number of dialogs...', [$dialog]);
        return MegaPromise.resolve();
    }

    var promise = new MegaPromise();

    // If there is any tokenizer on the dialog and it is triggered by dom event.
    var $tokenInput = $('li[class*="token-input-input"]', $dialog);

    // Make sure all input is tokenized.
    if ($tokenInput.length) {
        $('input', $tokenInput).trigger('blur');
    }

    // If tokenizer is on the dialog, check it has input already. If it has, warn user.
    var $tokenItems = $('li[class*="token-input-token"]', $dialog);

    if ($tokenItems.length) {
        // Warn user closing dialog will lose all inserted input
        msgDialog('confirmation', '', l[20474], l[18229], function(e) {
            if (e) {
                const $tokenObj = $('.add-contact-multiple-input');
                if ($tokenObj.tokenInput('getSettings')) {
                    $tokenObj.data('tokenInputObject').clearOnCancel();
                }
                $tokenItems.remove();
                promise.resolve();
            }
            else {
                promise.reject();
            }
        });
    }
    else if ($.dialog === 'share' && Object.keys($.addContactsToShare || []).length > 0
        || Object.keys($.changedPermissions || []).length > 0
        || Object.keys($.removedContactsFromShare || []).length > 0
        || (
            $.dialog === 'file-request-create-dialog' &&
            mega.fileRequest.dialogs.createDialog.checkLoseChangesWarning()
        )
        || (
            $.dialog === 'file-request-manage-dialog' &&
            mega.fileRequest.dialogs.manageDialog.checkLoseChangesWarning()
        )
    )  {
        // Warn user closing dialog will lose all unsaved changes
        msgDialog('confirmation', '', l[24208], l[18229], function(e) {
            if (e) {
                promise.resolve();
            }
            else {
                promise.reject();
            }
        });
    }
    else {
        promise.resolve();
    }

    return promise;
}

function closeDialog(ev) {
    "use strict";

    if (d) {
        MegaLogger.getLogger('closeDialog').debug($.dialog);
    }

    if (!$('.mega-dialog.registration-page-success').hasClass('hidden')) {
        fm_hideoverlay();
        $('.mega-dialog.registration-page-success').addClass('hidden').removeClass('special');
    }

    if ($('.mega-dialog.incoming-call-dialog').is(':visible') === true || $.dialog === 'download-pre-warning') {
        // managing dialogs should be done properly in the future, so that we won't need ^^ bad stuff like this one
        return false;
    }

    if ($.dialog === 'passwordlink-dialog') {
        if (String(page).substr(0, 2) === 'P!') {
            // do nothing while on the password-link page
            return false;
        }
        $('.mega-dialog.password-dialog').addClass('hidden');
    }

    // business account, add sub-user dialog. we wont allow closing before copying password
    if ($.dialog === 'sub-user-adding-dlg') {
        if ($('.user-management-add-user-dialog.user-management-dialog footer .add-sub-user')
            .hasClass('disabled')) {
            return false;
        }
    }

    if ($.dialog === 'prd') {
        // PasswordReminderDialog manages its own states, so don't do anything.
        return;
    }

    if ($.dialog === 'terms' && $.registerDialog) {
        $('.mega-dialog.bottom-pages-dialog').addClass('hidden');
    }
    else if ($.dialog === 'createfolder' && ($.copyDialog || $.moveDialog || $.selectFolderDialog || $.saveAsDialog)) {
        $('.mega-dialog.create-folder-dialog').addClass('hidden');
        $('.mega-dialog.create-folder-dialog .create-folder-size-icon').removeClass('hidden');
    }
    else if (($.dialog === 'slideshow') && $.copyrightsDialog) {
        $('.copyrights-dialog').addClass('hidden');

        delete $.copyrightsDialog;
    }
    else if ($.dialog === 'share-add') {
        $('.mega-dialog.share-add-dialog').addClass('hidden');
    }
    else if ($.dialog === 'fingerprint-dialog' && document.querySelector('.share-dialog.arrange-to-back')) {
        document.querySelector('.fingerprint-dialog').classList.add('hidden');
    }
    else if ($.dialog === 'fingerprint-admin-dlg' && window.closeDlgMute) {
        return false;
    }
    else {
        if ($.dialog === 'properties') {
            propertiesDialog(2);
        }
        else {
            fm_hideoverlay();
        }
        $('.mega-dialog' + ($.propertiesDialog ? ':not(.properties-dialog)' : ''))
            .trigger('dialog-closed')
            .addClass('hidden');
        $('.dialog-content-block').empty();

        // add contact popup
        $('.add-user-popup').addClass('hidden');
        $('.fm-add-user').removeClass('active');

        $('.add-contact-multiple-input').tokenInput("clearOnCancel");
        $('.share-multiple-input').tokenInput("clearOnCancel");

        if ($.dialog === 'share') {
            // share dialog
            $('.share-dialog-access-node').remove();
            hideShareDialogPermMenu();

            delete $.sharedTokens;
            delete $.contactPickerSelected;
            delete $.addContactsToShare;
            delete $.changedPermissions;
            delete $.removedContactsFromShare;
        }

        $('.copyrights-dialog').addClass('hidden');

        delete $.copyDialog;
        delete $.moveDialog;
        delete $.copyToShare;
        delete $.copyToUpload;
        delete $.shareToContactId;
        delete $.copyrightsDialog;
        delete $.selectFolderDialog;
        delete $.saveAsDialog;
        delete $.nodeSaveAs;
        delete $.shareDialog;

        /* copy/move dialog - save to */
        delete $.saveToDialogCb;
        delete $.saveToDialogNode;
        delete $.saveToDialog;
        delete $.chatAttachmentShare;

        if ($.saveToDialogPromise) {
            if (typeof $.saveToDialogPromise === 'function') {
                $.saveToDialogPromise(EEXPIRED);
            }
            else {
                $.saveToDialogPromise.reject(EEXPIRED);
            }
            delete $.saveToDialogPromise;
        }

        if (ev && $(ev.target).is('.fm-dialog-overlay, .fm-dialog-close')) {
            delete $.onImportCopyNodes;
            delete $.albumImport;
        }

        if ($.msgDialog) {
            if ($.warningCallback) {
                onIdle($.warningCallback.bind(null, null));
                $.warningCallback = null;
            }
            closeMsg();
        }
        if ($.dialog === 'onboardingDialog') {
            if (
                mega.ui.onboarding.$hotSpotNode
                && mega.ui.onboarding.$hotSpotNode.hasClass('onboarding-hotspot-animation-rect')
            ) {
                mega.ui.onboarding.$hotSpotNode.removeClass('onboarding-hotspot-animation-rect');
            }
            if (M.chat) {
                megaChat.plugins.chatOnboarding.occurrenceDialogShown = false;
            }
        }
    }
    $('.mega-dialog, .overlay.arrange-to-back, .mega-dialog-container.common-container').removeClass('arrange-to-back');
    // $('.mega-dialog .dialog-sorting-menu').remove();

    $('.export-links-warning').addClass('hidden');
    if ($.dialog === 'terms' && $.termsAgree) {
        delete $.termsAgree;
    }

    if ($.dialog === 'createfolder') {
        if ($.cfpromise) {
            $.cfpromise.reject();
            delete $.cfpromise;
        }
    }
    else if ($.dialog !== 'terms') {
        delete $.mcImport;
    }

    if (typeof redeem !== 'undefined' && redeem.$dialog) {
        redeem.$dialog.addClass('hidden');
    }

    delete $.dialog;
    treesearch = false;

    if ($.registerDialog) {
        // if the terms dialog was closed from the register dialog
        $.dialog = $.registerDialog;
    }

    if ($.propertiesDialog) {
        // if the dialog was close from the properties dialog
        $.dialog = $.propertiesDialog;
    }

    if ($.copyDialog || $.moveDialog || $.selectFolderDialog || $.saveAsDialog) {
        // the createfolder dialog was closed
        // eslint-disable-next-line local-rules/hints
        $.dialog = $.copyDialog || $.moveDialog || $.selectFolderDialog || $.saveAsDialog;
    }

    if ($.shareDialog) {
        // if the share-add dialog was closed from the share dialog
        // eslint-disable-next-line local-rules/hints
        $.dialog = $.shareDialog;
    }

    mBroadcaster.sendMessage('closedialog');
}

function createFolderDialog(close) {
    "use strict";

    if (M.isInvalidUserStatus()) {
        return;
    }

    var $dialog = $('.mega-dialog.create-folder-dialog');
    var $input = $('input', $dialog);
    $input.val('');

    const ltWSpaceWarning = InputFloatWarning($dialog).hide();

    if (close) {
        if ($.cftarget) {
            delete $.cftarget;
        }
        if ($.dialog === 'createfolder') {
            closeDialog();
        }
        return true;
    }

    var doCreateFolder = function(v) {
        var errorMsg = '';
        if (v.trim() === '' || v.trim() === l[157]) {
            errorMsg = l.EmptyName;
        }
        else if (v.length > 250) {
            errorMsg = l.LongName;
        }
        else if (M.isSafeName(v) === false) {
            $dialog.removeClass('active');
            errorMsg = l[24708];
        }
        else {
            var specifyTarget = null;
            if ($.cftarget) {
                specifyTarget = $.cftarget;
            }
            if (duplicated(v, specifyTarget)) {
                errorMsg = l[23219];
            }
        }

        if (errorMsg !== '') {
            showErrorCreatingFileFolder(errorMsg, $dialog, $input);

            return;
        }

        var target = $.cftarget = $.cftarget || M.currentCustomView.nodeID || M.currentdirid;
        var awaitingPromise = $.cfpromise;
        delete $.cfpromise;

        closeDialog();
        loadingDialog.pshow();

        M.createFolder(target, v)
            .then((h) => {
                if (d) {
                    console.log('Created new folder %s->%s', target, h);
                }
                createFolderDialog(1);

                if (awaitingPromise) {
                    // dispatch an awaiting promise expecting to perform its own action instead of the default one
                    queueMicrotask(() => awaitingPromise.resolve(h));
                    return awaitingPromise;
                }

                // By default, auto-select the newly created folder as long no awaiting promise
                return M.openFolder(Object(M.d[h]).p || target)
                    .always(() => {
                        $.selected = [h];
                        reselect(1);
                    });
            })
            .catch((ex) => {
                msgDialog('warninga', l[135], l[47], ex < 0 ? api_strerror(ex) : ex, function() {
                    if (awaitingPromise) {
                        awaitingPromise.reject(ex);
                    }
                });
            })
            .finally(() => {
                loadingDialog.phide();
            });
    };

    $input.rebind('focus', function() {
        if ($(this).val() === l[157]) {
            $input.val('');
        }
        $dialog.addClass('focused');
    });

    $input.rebind('blur', function() {
        $dialog.removeClass('focused');
    });

    $input.rebind('keyup', function(e) {
        ltWSpaceWarning.check({type: 1});
        if ($input.val() === '' || $input.val() === l[157]) {
            $dialog.removeClass('active');
        }
        else if (e.which !== 13)  {
            $dialog.addClass('active');
            $input.removeClass('error');
        }
    });

    $input.rebind('keypress', function(e) {
        var v = $(this).val();
        if (e.which === 13 && v.trim() !== '') {
            doCreateFolder(v);
        }
    });

    $('button.js-close, .create-folder-button-cancel', $dialog).rebind('click', createFolderDialog);

    $('.fm-dialog-input-clear').rebind('click', function() {
        $input.val('');
        $dialog.removeClass('active');
    });

    $('.fm-dialog-new-folder-button').rebind('click', () => doCreateFolder($input.val()));

    M.safeShowDialog('createfolder', function() {
        $dialog.removeClass('hidden');
        $('.create-folder-wrapper input', $dialog).focus();
        $dialog.removeClass('active');
        return $dialog;
    });
}

function showErrorCreatingFileFolder(errorMsg, $dialog, $input) {
    "use strict";
    $('.duplicated-input-warning span', $dialog).text(errorMsg);
    $dialog.addClass('duplicate');
    $input.addClass('error');

    setTimeout(
        () => {
            $input.removeClass('error');
            $dialog.removeClass('duplicate');
            $input.trigger("focus");
        },
        2000
    );
}

function createFileDialog(close, action, params) {
    "use strict";


    var closeFunction = function() {
        if ($.cftarget) {
            delete $.cftarget;
        }
        closeDialog();
        return false;
    };


    if (close) {
        return closeFunction();
    }

    if (!action) {
        action = function(name, t) {
            if (ulmanager.ulOverStorageQuota) {
                ulmanager.ulShowOverStorageQuotaDialog();
                return;
            }

            loadingDialog.pshow();

            M.addNewFile(name, t)
                .done(function(nh) {
                    if (d) {
                        console.log('Created new file %s->%s', t, name);
                    }
                    loadingDialog.phide();

                    if ($.selectddUIgrid.indexOf('.grid-scrolling-table') > -1 ||
                        $.selectddUIgrid.indexOf('.file-block-scrolling') > -1) {
                        var $grid = $($.selectddUIgrid);
                        var $newElement = $('#' + nh, $grid);

                        if (M.megaRender && M.megaRender.megaList && M.megaRender.megaList._wasRendered) {
                            M.megaRender.megaList.scrollToItem(nh);
                            $newElement = $('#' + nh, $grid);
                        }
                        else if ($grid.length && $newElement.length && $grid.hasClass('ps')) {
                            scrollToElement($grid, $newElement);
                        }

                        // now let's select the item. we can not use the click handler due
                        // to redraw if element was out of viewport.
                        $($.selectddUIgrid + ' ' + $.selectddUIitem).removeClass('ui-selected');
                        $newElement.addClass('ui-selected');
                        $.gridLastSelected = $newElement;
                        selectionManager.clear_selection();
                        selectionManager.add_to_selection(nh);

                        loadingDialog.show('common', l[23130]);

                        mega.fileTextEditor.getFile(nh).done(
                            function(data) {
                                loadingDialog.hide();
                                mega.textEditorUI.setupEditor(M.d[nh].name, data, nh);
                            }
                        ).fail(function() {
                            loadingDialog.hide();
                        });

                    }

                })
                .fail(function(error) {
                    loadingDialog.phide();
                    msgDialog('warninga', l[135], l[47], api_strerror(error));
                });
        };
    }

    // there's no jquery parent for this container.
    // eslint-disable-next-line local-rules/jquery-scopes
    var $dialog = $('.mega-dialog.create-file-dialog');
    var $input = $('input', $dialog);
    $input.val('.txt')[0].setSelectionRange(0, 0);

    const ltWSpaceWarning = InputFloatWarning($dialog).hide();

    var doCreateFile = function(v) {
        var target = $.cftarget = $.cftarget || M.currentdirid;

        var errorMsg = '';

        if (v === '' || v === l[17506]) {
            errorMsg = l[8566];
        }
        else if (v.length > 250) {
            errorMsg = l.LongName1;
        }
        else if (!M.isSafeName(v)) {
            $dialog.removeClass('active');
            errorMsg = l[24708];
        }
        else if (duplicated(v, target)) {
            errorMsg = l[23219];
        }
        if (errorMsg !== '') {
            showErrorCreatingFileFolder(errorMsg, $dialog, $input);
            return;
        }
        closeFunction();
        action(v, target, params);
    };


    $input.rebind('focus.fileDialog', function() {
        if ($(this).val() === l[17506]) {
            $input.val('');
        }
        $dialog.addClass('focused');
    });

    $input.rebind('blur.fileDialog', function() {
        $dialog.removeClass('focused');
    });

    $input.rebind('keyup.fileDialog', function() {
        ltWSpaceWarning.check({type: 0});
        if ($input.val() === '' || $input.val() === l[17506]) {
            $dialog.removeClass('active');
        }
        else {
            $dialog.addClass('active');
            $input.removeClass('error');
        }
    });

    $input.rebind('keypress.fileDialog', function(e) {

        if (e.which === 13) {
            doCreateFile($(this).val());
        }
        else {
            $input.removeClass('error');
            $dialog.removeClass('duplicate');
        }
    });

    // eslint-disable-next-line sonarjs/no-duplicate-string
    $('.js-close, .cancel-create-file', $dialog).rebind('click.fileDialog', closeFunction);

    $('.fm-dialog-input-clear', $dialog).rebind('click.fileDialog', function() {
        $input.val('');
        $dialog.removeClass('active');
    });

    $('.create-file', $dialog).rebind('click.fileDialog', function() {
        var v = $input.val();
        doCreateFile(v);
    });

    M.safeShowDialog('createfile', function() {
        $dialog.removeClass('hidden');
        $('.create-file-wrapper input', $dialog).focus();
        $dialog.removeClass('active');
        return $dialog;
    });
}

/**
 * Show bottom pages dialog
 * @param {Boolean} close dialog parameter
 * @param {String} bottom page title
 * @param {String} dialog header
 * @param {Boolean} tickbox tickbox existency to let user agree this dialog
 */
function bottomPageDialog(close, pp, hh, tickbox) {
    "use strict";

    var $dialog = $('.mega-dialog.bottom-pages-dialog');
    var closeDialog = function() {
        $dialog.off('dialog-closed');
        // reset scroll position to top for re-open
        $dialog.scrollTop(0);

        window.closeDialog();
        delete $.termsAgree;
        delete $.termsDeny;
        return false;
    };

    if (close) {
        closeDialog();
        return false;
    }

    if (!pp) {
        pp = 'terms';
    }

    // Show Agree/Cancel buttons for Terms dialogs if it does not have tickbox to agree=
    if ((pp === 'terms' && !tickbox) || pp === 'sdkterms') {
        $('.fm-bp-cancel, .fm-bp-agree', $dialog).removeClass('hidden');
        $('.fm-bp-close', $dialog).addClass('hidden');
        $('header h2', $dialog).text(l[385]);

        $('.fm-bp-agree', $dialog).rebind('click', function()
        {
            if ($.termsAgree) {
                $.termsAgree();
            }
            bottomPageDialog(1);
        });

        $('button.js-close, .fm-bp-cancel', $dialog).rebind('click', function()
        {
            if ($.termsDeny) {
                $.termsDeny();
            }
            bottomPageDialog(1);
        });
    }
    else {
        $('.fm-bp-cancel, .fm-bp-agree', $dialog).addClass('hidden');
        $('.fm-bp-close', $dialog).removeClass('hidden');
        if (hh) {
            $('header h2', $dialog).text(hh);
        }

        $('button.js-close, .fm-bp-close', $dialog).rebind('click', function()
        {
            bottomPageDialog(1);
        });
    }

    var asyncTaskID;
    if (!pages[pp]) {
        asyncTaskID = 'page.' + pp + '.' + makeUUID();

        M.require(pp)
            .always(function() {
                mBroadcaster.sendMessage(asyncTaskID);
                asyncTaskID = null;
            });
    }

    M.safeShowDialog(pp, function _showDialog() {
        if (asyncTaskID) {
            loadingDialog.show();
            mBroadcaster.once(asyncTaskID, function() {
                loadingDialog.hide();
                asyncTaskID = null;
                _showDialog();
            });

            return $dialog;
        }
        $dialog.rebind('dialog-closed', closeDialog).removeClass('hidden');

        const $bottomPageDialogMain = $('.bp-main', $dialog);
        $bottomPageDialogMain.safeHTML(translate(String(pages[pp])
            .split('((TOP))')[1]
            .split('((BOTTOM))')[0]
            .replace('main-mid-pad new-bottom-pages', ''))
        );

        initPerfectScrollbar($('.bp-body', $dialog));

        if (pp === 'terms') {
            $('a[href]', $bottomPageDialogMain).attr('target', '_blank');
        }
        clickURLs();
        scrollToURLs();
        return $dialog;
    });
}

function clipboardcopycomplete()
{
    if (d)
        console.log('clipboard copied');
}

function saveprogress(id, bytesloaded, bytestotal)
{
    if (d)
        console.log('saveprogress', id, bytesloaded, bytestotal);
}

function savecomplete(id)
{
    $('.mega-dialog.download-dialog').addClass('hidden');
    fm_hideoverlay();

    var dl = dlmanager.getDownloadByHandle(id);
    if (dl) {
        M.dlcomplete(dl);
        dlmanager.cleanupUI(dl, true);
    }
}

/**
 * Because of the left and transfer panes resizing options, we are now implementing the UI layout logic here, instead of
 * the original code from the styles.css.
 * The main reason is that, the CSS is not able to correctly calculate values based on other element's properties (e.g.
 * width, height, position, etc).
 * This is why we do a on('resize') handler which handles the resize of the generic layout of Mega's FM.
 */
function fm_resize_handler(force) {
    "use strict";

    if ($.tresizer.last === -1 && force !== true) {
        return;
    }
    if (d) {
        if (d > 1) {
            console.warn('fm_resize_handler');
        }
        console.time('fm_resize_handler');
    }

    if (M.currentdirid !== 'transfers') {
        initTreeScroll();
    }

    if (M.currentdirid === 'shares') {
        if (M.viewmode) {
            initPerfectScrollbar($('.shared-blocks-scrolling', '.shared-blocks-view'));
        }
        else {
            initPerfectScrollbar($('.grid-scrolling-table', '.shared-grid-view'));
        }
    }
    else if (M.currentdirid === 'out-shares') {
        if (M.viewmode) {
            initPerfectScrollbar($('.out-shared-blocks-scrolling', '.out-shared-blocks-view'));
        }
        else {
            initPerfectScrollbar($('.grid-scrolling-table', '.out-shared-grid-view'));
        }
    }
    else if (M.currentdirid === 'transfers') {
        fm_tfsupdate(); // this will call $.transferHeader();
    }
    else if (M.currentdirid && M.currentdirid.substr(0, 7) === 'account') {
        var $accountContent = $('.fm-account-main', '.fm-main');

        $accountContent.removeClass('low-width');

        if ($accountContent.width() < 780) {
            $accountContent.addClass('low-width');
        }

        // Init account content scrolling
        accountUI.initAccountScroll();
    }
    else if (M.currentdirid && M.currentdirid.substr(0, 9) === 'dashboard') {
        var $dashboardContent = $('.fm-right-block.dashboard', '.fm-main');

        $dashboardContent.removeClass('low-width');

        if ($dashboardContent.width() < 780 || !$('.business-dashboard', $dashboardContent).hasClass('hidden')
            && $dashboardContent.width() < 915) {
            $dashboardContent.addClass('low-width');
        }

        // Init dashboard content scrolling
        initDashboardScroll();
    }
    else if (M.currentdirid && M.currentdirid.startsWith('user-management') &&
        typeof initBusinessAccountScroll === 'function') {
        initBusinessAccountScroll($('.user-management-view .ps:visible', fmholder));
    }
    else if (!M.chat) {
        // Resize the search breadcrumbs
        if (M.currentdirid && M.currentdirid.includes('search/')) {
            delay('render:search_breadcrumbs', () => M.renderSearchBreadcrumbs());
        }
        if (M.viewmode) {

            initPerfectScrollbar($('.file-block-scrolling:visible'));
        }
        else {

            initPerfectScrollbar($('.grid-scrolling-table:visible'));
            if ($.gridHeader) {
                $.gridHeader();
            }
        }
        // Resize the cloud drive breadcrumbs
        delay('render:path_breadcrumbs', () => M.renderPathBreadcrumbs());
    }

    if (M.currentdirid !== 'transfers') {
        var treePaneWidth = Math.round($('.fm-left-panel:visible').outerWidth());
        var leftPaneWidth = Math.round($('.nw-fm-left-icons-panel:visible').outerWidth());
        const margin = (treePaneWidth + leftPaneWidth) + "px";

        if (megaChatIsReady && megaChat.resized) {
            megaChat.resized();
        }

        $('.popup.transfer-widget').outerWidth(treePaneWidth - 9);
    }

    if (M.currentrootid === 'shares') {
        var $sharedDetailsBlock = $('.shared-details-block', '.fm-main');
        var sharedHeaderHeight = Math.round($('.shared-top-details', $sharedDetailsBlock).outerHeight());

        $('.files-grid-view, .fm-blocks-view', $sharedDetailsBlock).css({
            'height': `calc(100% - ${sharedHeaderHeight}px)`,
        });
    }

    if (d) {
        console.timeEnd('fm_resize_handler');
    }
}


function sharedFolderUI() {
    "use strict";

    var nodeData = M.d[M.currentdirid];
    var browsingSharedContent = false;

    // Browsing shared content
    if ($('.shared-details-block').length > 0) {

        $('.shared-details-block .files-grid-view, .shared-details-block .fm-blocks-view').removeAttr('style');
        $('.shared-details-block .shared-folder-content').unwrap();
        $('.shared-folder-content').removeClass('shared-folder-content');
        $('.shared-top-details').remove();
        browsingSharedContent = true;
    }

    // are we in an inshare?
    while (nodeData && !nodeData.su) {
        nodeData = M.d[nodeData.p];
    }

    if (nodeData) {

        var rights = l[55];
        var rightPanelView = '.files-grid-view.fm';

        // Handle of initial share owner
        var ownersHandle = nodeData.su;
        var folderName = M.getNameByHandle((M.d[M.currentdirid] || nodeData).h);
        var displayName = escapeHTML(M.getNameByHandle(ownersHandle));
        var avatar = useravatar.contact(M.d[ownersHandle]);
        $('.shared-blocks-view', '.fm-right-files-block').addClass('hidden');

        if (Object(M.u[ownersHandle]).m) {
            displayName += '<span>' + escapeHTML(M.u[ownersHandle].m) + '</span>';
        }

        // Access rights
        if (nodeData.r === 1) {
            rights = l[56];
        }
        else if (nodeData.r === 2) {
            rights = l[57];
        }

        if (M.viewmode === 1) {
            rightPanelView = '.fm-blocks-view.fm';
        }

        $(rightPanelView).wrap('<div class="shared-details-block"></div>');

        $('.shared-details-block').prepend(
            '<div class="shared-top-details">'
                + '<i class="shared-details-icon item-type-icon-90 icon-folder-incoming-90"></i>'
                + '<div class="shared-details-info-block">'
                    + '<div class="shared-details-pad">'
                        + '<div class="shared-details-folder-name">' + escapeHTML(folderName) + '</div>'
                        + '<div class="shared-folder-access">'
                            + '<span>' + escapeHTML(rights) + '</span>'
                        + '</div>'
                        + '<a href="javascript:;" class="grid-url-arrow">'
                        + '<i class="sprite-fm-mono icon-options"></i></a>'
                        + '<div class="clear"></div>'
                        + avatar
                        + '<div class="fm-chat-user-info">'
                            + '<div class="fm-chat-user">' + displayName + '</div>'
                        + '</div>'
                    + '</div>'
                    + '<div class="shared-details-buttons">'
                        + '<button class="mega-button fm-share-download">'
                            + '<span class="fm-chatbutton-arrow inshare-dl-button0">' + escapeHTML(l[58]) + '</span>'
                        + '</button>'
                        + '<button class="mega-button fm-share-copy">'
                            + '<span>'
                                + escapeHTML(l[63])
                            + '</span>'
                        + '</button>'
                        + '<button class="mega-button negative fm-leave-share">'
                            + '<span>'
                                + escapeHTML(l[5866])
                            + '</span>'
                        + '</button>'
                    + '</div>'
                    + '<div class="clear"></div>'
                + '</div>'
            + '</div>');

        $(rightPanelView).addClass('shared-folder-content');

        if (mega.keyMgr.getWarningValue('cv') === '1') {
            const ed = authring.getContactAuthenticated(ownersHandle, 'Ed25519');

            if (!(ed && ed.method >= authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON)) {
                $('.shared-details-block .shared-details-icon')
                    .addClass('sprite-fm-uni-after icon-warning-after');
            }
        }

        if (M.d[M.currentdirid] !== nodeData || M.d[nodeData.p]) {
            // hide leave-share under non-root shares
            $('.fm-leave-share').addClass('hidden');
        }

        onIdle(function() {
            $(window).trigger('resize');
            onIdle(fm_resize_handler);
        });
    }

    return browsingSharedContent;
}

function userFingerprint(userid, callback) {
    userid = userid.u || userid;
    var user = M.u[userid];
    if (!user || !user.u) {
        return callback([]);
    }
    if (userid === u_handle) {
        var fprint = authring.computeFingerprint(u_pubEd25519, 'Ed25519', 'hex');
        return callback(fprint.toUpperCase().match(/.{4}/g), fprint);
    }
    var fingerprintPromise = crypt.getFingerprintEd25519(user.h || userid);
    fingerprintPromise.done(function (response) {
        callback(
            response.toUpperCase().match(/.{4}/g),
            response
        );
    });
}

/**
 * Get and display the fingerprint
 * @param {Object} user The user object e.g. same as M.u[userHandle]
 * @param {Selector} $wrapper Container of fingerprint block
 */
function showAuthenticityCredentials(user, $wrapper) {

    var $fingerprintContainer = $wrapper.length ?
        $wrapper.find('.contact-fingerprint-txt') : $('.contact-fingerprint-txt');

    // Compute the fingerprint
    userFingerprint(user, function(fingerprints) {

        // Clear old values immediately
        $fingerprintContainer.empty();

        // Render the fingerprint into 10 groups of 4 hex digits
        $.each(fingerprints, function(key, value) {
            $('<span>').text(value).appendTo($fingerprintContainer);
        });
    });
}

/**
 * Enables the Verify button
 * @param {String} userHandle The user handle
 */
function enableVerifyFingerprintsButton(userHandle) {
    $('.fm-verify').removeClass('verified');
    $('.fm-verify').find('span').text(l[1960] + '...');
    $('.fm-verify').rebind('click', function() {
        fingerprintDialog(userHandle);
    });
}

function fingerprintDialog(userid, isAdminVerify, callback) {
    'use strict';

    userid = userid.u || userid;
    const user = M.u[userid];
    if (!user || !user.u) {
        return -5;
    }

    if (d) {
        console.warn('fingerprint-dialog', user.h, [user], isAdminVerify, [callback]);
    }

    // Add log to see how often they open the verify dialog
    eventlog(99601, !!isAdminVerify);

    const $dialog = $('.fingerprint-dialog');

    $dialog.toggleClass('e-modal', isAdminVerify === null);
    $dialog.toggleClass('admin-verify', isAdminVerify === true);
    let titleTxt = l.verify_credentials;
    let subTitleTxt = l.contact_ver_dialog_content;
    let approveBtnTxt = l.mark_as_verified;
    let credentialsTitle = l[6780];
    let listenerToken = null;
    window.closeDlgMute = null;

    if (isAdminVerify) {
        titleTxt = l.bus_admin_ver;
        subTitleTxt = l.bus_admin_ver_sub;
        approveBtnTxt = l[1960];
        credentialsTitle = l.bus_admin_cred;
        listenerToken = mBroadcaster.addListener('mega:openfolder', {
            callback: () => {
                fingerprintDialog(u_attr.b.mu[0], true);
            },
            once: true
        });
        window.closeDlgMute = true;
    }

    $('header h2', $dialog).text(titleTxt);
    $('.content-block p.sub-title-txt', $dialog).text(subTitleTxt);
    $('.footer-container .dialog-approve-button span', $dialog).text(approveBtnTxt);
    $('.fingerprint-code .contact-fingerprint-title', $dialog).text(credentialsTitle);

    const closeFngrPrntDialog = () => {
        window.closeDlgMute = null;
        closeDialog();
        $('button.js-close', $dialog).off('click');
        $('.dialog-approve-button').off('click');
        $('.dialog-skip-button').off('click');
        if (!isAdminVerify) {
            callback = callback || mega.ui.CredentialsWarningDialog.rendernext;
            callback(userid);
        }
        else {
            const bus = new BusinessAccount();
            bus.sendSubMKey()
                .then(() => {
                    mBroadcaster.removeListener(listenerToken);
                })
                .catch(tell);
        }
    };

    $('.fingerprint-avatar', $dialog).empty()
        .append($(useravatar.contact(userid, 'semi-mid-avatar')));

    $('.contact-details-user-name', $dialog)
        .text(M.getNameByHandle(user.u)) // escape HTML things
        .end()
        .find('.contact-details-email')
        .text(user.m); // escape HTML things

    $('.fingerprint-txt', $dialog).empty();

    userFingerprint(u_handle, (fprint) => {
        const target = $('.fingerprint-bott-txt .fingerprint-txt');
        fprint.forEach(function(v) {
            $('<span>').text(v).appendTo(target);
        });
    });

    userFingerprint(user, (fprint) => {
        let offset = 0;
        $dialog.find('.fingerprint-code .fingerprint-txt').each(function() {
            let that = $(this);

            fprint.slice(offset, offset + 5).forEach(function(v) {
                $('<span>').text(v).appendTo(that);
                offset++;
            });
        });
    });

    $('button.js-close, .dialog-skip-button', $dialog).rebind('click', function() {
        if (isAdminVerify) {
            return;
        }
        closeFngrPrntDialog();
    });

    $('.dialog-approve-button', $dialog).rebind('click', () => {

        // Add log to see how often they verify the fingerprints
        api_req({ a: 'log', e: 99602, m: 'Fingerprint verification approved' });

        const promises = [];
        loadingDialog.show();

        if (!authring.getContactAuthenticated(userid, 'Cu25519') || !pubCu25519[userid]) {
            promises.push(crypt.getPubCu25519(userid, true));
        }
        // Generate fingerprint
        promises.push(crypt.getFingerprintEd25519(userid, 'string'));

        Promise.all(promises)
            .then((res) => {
                const fingerprint = res.pop();

                // Authenticate the contact
                return authring.setContactAuthenticated(
                    userid,
                    fingerprint,
                    'Ed25519',
                    authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON,
                    authring.KEY_CONFIDENCE.UNSURE
                );
            })
            .then(() => {

                // Change button state to 'Verified'
                $('.fm-verify').off('click').addClass('verified').find('span').text(l[6776]);

                closeFngrPrntDialog();

                if (M.u[userid]) {
                    M.u[userid].trackDataChange(M.u[userid], "fingerprint");

                    if (M.currentdirid === 'shares' && M.c[userid]) {

                        for (const h in M.c[userid]) {
                            if (M.megaRender) {
                                M.megaRender.revokeDOMNode(h, true);
                            }
                        }

                        M.renderMain(true);
                    }
                    else if (M.c[userid] && M.c[userid][M.currentdirid]) {
                        $('.shared-details-icon').removeClass('icon-warning-after sprite-fm-uni-after');
                        $('.' + userid).addClass('verified');
                    }

                    if ($.dialog === 'share') {

                        const contact = document.querySelector(`.share-dialog-access-list [id="${userid}"]`);

                        if (contact) {

                            contact.classList.remove('unverified-contact');
                            contact.querySelector('.avatar-wrapper').classList.add('verified');
                        }

                        shareDialogContentCheck();
                    }
                }
            })
            .catch((ex) => {
                console.error(ex);
                msgDialog('warninga', l[135], l[47], ex);

                const user = M.getUserByHandle(userid);
                const info = [
                    2,
                    String(ex).trim().split('\n')[0],
                    String(ex && ex.stack).trim().replace(/\s+/g, ' ').substr(0, 512),
                    userid,
                    {c: user.c, m: user.m ? 1 : 0, h: user.h, u: user.u, ts: user.ts, ats: user.ats}
                ];
                eventlog(99816, JSON.stringify(info));
            })
            .finally(() => {
                loadingDialog.hide();
            });
    });

    M.safeShowDialog(isAdminVerify ? 'fingerprint-admin-dlg' : 'fingerprint-dialog', $dialog);
}

/**
 * Implements the behavior of "File Manager - Resizable Panes":
 * - Initializes a jQuery UI .resizable
 * - Sets w/h/direction
 * - Persistance (only saving is implemented here, you should implement by yourself an initial set of the w/h from the
 *  localStorage
 * - Proxies the jQ UI's resizable events - `resize` and `resizestop`
 * - Can be initialized only once per element (instance is stored in $element.data('fmresizable'))
 *
 * @param element
 * @param opts
 * @returns {*}
 * @constructor
 */
function FMResizablePane(element, opts) {
    "use strict";

    var $element = $(element);
    var self = this;
    var $self = $(this);

    self.element = element;

    /**
     * Default options
     *
     * @type {{direction: string, persistanceKey: string, minHeight: undefined, minWidth: undefined, handle: string}}
     */
    var defaults = {
        'direction': 'n',
        'persistanceKey': '',
        'maxWidth': 400,
        'minHeight': undefined,
        'minWidth': undefined,
        'handle': '.transfer-drag-handle'
    };

    var size_attr = 'height';

    opts = $.extend(true, {}, defaults, opts);

    self.options = opts; //expose as public

    console.assert(opts.multiple || $element.length === 1, 'FMResizablePane: Invalid number of elements.');

    /**
     * Depending on the selected direction, pick which css attr should we be changing - width OR height
     */
    if (opts.direction === 'n' || opts.direction === 's') {
        size_attr = 'height';
    }
    else if (opts.direction === 'e' || opts.direction === 'w') {
        size_attr = 'width';
    }
    else if (opts.direction.length === 2) {
        size_attr = 'both';
    }

    self.destroy = function() {
        $self.off();
        $element.data('fmresizable', null);
    };

    this.refresh = function(ev) {
        const width = $element.width();

        if (opts.maxWidth && width >= opts.maxWidth) {
            $('.left-pane-drag-handle').css('cursor', 'w-resize');
            $('body').css('cursor', 'w-resize');
        }
        else if (width <= opts.minWidth) {
            $('.left-pane-drag-handle').css('cursor', 'e-resize');
            $('body').css('cursor', 'e-resize');
        }
        else {
            $('.left-pane-drag-handle').css('cursor', 'ew-resize');
            $('body').css('cursor', 'ew-resize');
        }

        if (!$element.hasClass('ui-resizable-resizing')) {
            $('body').css('cursor', 'auto');
        }

        if (width < opts.updateWidth + 60) {
            $element.addClass('small-left-panel');
        }
        else {
            $element.removeClass('small-left-panel');
        }

        if (d > 1) {
            console.warn([this], width);
        }

        return ev || $.tresizer();
    };

    this.setWidth = function(value) {

        if (!value && opts.persistanceKey) {
            const size = mega.config.get(opts.persistanceKey) | 0;
            if (size) {
                const {maxWidth, minWidth} = opts;
                value = Math.min(maxWidth || size, Math.max(minWidth | 0, size));
            }
        }

        if (value > 0) {
            $element.width(value);
        }

        this.refresh();
    };

    this.setOption = function(key, value) {
        opts[key] = value;
        this.element.resizable('option', key, value);
        this.setWidth();
    };

    if (opts.persistanceKey) {
        this.setWidth();
    }

    /**
     * Basic init/constructor code
     */
    if (!$element.data('fmresizable')) {
        var $handle = $(opts.handle, $element);

        if (d) {
            if (!$handle.length) {
                console.warn('FMResizablePane: Element not found: ' + opts.handle);
            }
        }

        $handle.addClass('ui-resizable-handle ui-resizable-' + opts.direction);

        var resizable_opts = {
            'handles': {},
            minHeight: opts.minHeight,
            minWidth: opts.minWidth,
            maxHeight: opts.maxHeight,
            maxWidth: opts.maxWidth,
            start: function(e, ui) {
                $(self.element).addClass('resizable-pane-active');
            },
            resize: function(e, ui) {
                var css_attrs = {
                    'top': 0
                };

                if (size_attr === 'both') {
                    css_attrs['width'] = ui.size['width'];
                    css_attrs['height'] = ui.size['height'];

                    $element.css(css_attrs);

                    if (opts.persistanceKey) {
                        console.assert(opts.persistanceKey !== 'leftPaneWidth');
                        mega.config.set(opts.persistanceKey, css_attrs);
                    }
                } else {
                    css_attrs[size_attr] = ui.size[size_attr];
                    $element.css(css_attrs);
                    if (opts.persistanceKey) {
                        mega.config.set(opts.persistanceKey, ui.size[size_attr]);
                    }
                    self["current_" + size_attr] = ui.size[size_attr];
                }

                delay('fm-resizable-pane:refresh', () => self.refresh(e, ui));
            },
            'stop': function(e, ui) {
                $.tresizer();
                $(self.element).removeClass('resizable-pane-active');
                $self.trigger('resizestop', [e, ui]);
            }
        };

        if (opts['aspectRatio']) {
            resizable_opts['aspectRatio'] = opts['aspectRatio'];
        }

        resizable_opts['handles'][opts.direction] = $handle;

        $element.resizable(resizable_opts);

        $element.data('fmresizable', this);
    }

    return this;
}

Object.defineProperty(FMResizablePane, 'refresh', {
    value() {
        'use strict';
        if (M.fmTabPages) {
            // @todo revamp if we ever use other than '.fm-left-panel' for these
            const cl = $('.fm-left-panel:visible').data('fmresizable');

            if (cl) {

                cl.setOption('maxWidth', M.fmTabPages['cloud-drive'][M.currentrootid] ? null : 400);
            }

            return cl;
        }
    }
});

function initDownloadDesktopAppDialog() {

    'use strict';

    const $dialog = $('.mega-dialog.mega-desktopapp-download');

    $('.download-app', $dialog).rebind('click.downloadDesktopAppDialog', () => {

        switch (ua.details.os) {
            case "Apple":
                window.location = megasync.getMegaSyncUrl('mac');
                break;
            case "Windows":
                // Download app for Windows
                window.location = megasync.getMegaSyncUrl(ua.details.is64bit && !ua.details.isARM ?
                    'windows' : 'windows_x32');

                break;
            case "Linux":
                $('aside', $dialog).addClass('hidden');
                mega.redirect('mega.io', '/desktop', false, false, false);
                break;
        }
    });

    clickURLs();
    $('aside a', $dialog).rebind('click.downloadDesktopAppDialog', closeDialog);

    // Close the share dialog
    $('button.js-close', $dialog).rebind('click.downloadDesktopAppDialog', closeDialog);

    M.safeShowDialog('onboardingDesktopAppDialog', $dialog);
}

/**
 * BackupCenter functions.
 * @name backupCenter
 * @memberOf mega
 * @type {Object}
 */
lazy(mega, 'backupCenter', () => {
    'use strict';

    const errorMessages = {
        // File system not supported.
        '2': l.err_fs_is_not_supported,
        // Remote node is not valid.
        '3': l.err_invalid_remote_node,
        // Local path is not valid.
        '4': l.err_invalid_local_path,
        // Initial scan failed.
        '5': l.err_initial_scan_failed,
        // Local path temporarily unavailable.
        '6': l.err_local_path_temp_na,
        // Local path not available.
        '7': l.err_local_path_is_na,
        // Remote node not found.
        '8': l.err_remote_n_not_found,
        // Foreign target storage quota reached.
        '11': l.err_inshare_acc_overquota,
        // Remote path has changed.
        '12': l.err_changed_remote_path,
        // Remote node has been deleted.
        '13': l.err_deleted_remote_n,
        // Share without full access.
        '14': l.err_share_wo_access,
        // Local fingerprint mismatch.
        '15': l.err_wrong_fingerprint,
        // Put nodes error.
        '16': l.err_put_nodes_error,
        // Active sync below path.
        '17': l.err_sync_below_path,
        // Active sync above path.
        '18': l.err_sync_above_path,
        // Remote node moved to Rubbish Bin.
        '19': l.err_n_moved_to_rubbish,
        // Remote node is inside Rubbish Bin.
        '20': l.err_n_is_in_rubbish,
        // Unsupported VBoxSharedFolderFS filesystem.
        '21': l.err_unsupported_vbsf,
        // Local path collides with an existing sync.
        '22': l.err_path_with_sync,
        // Unknown temporary error.
        '24': l.err_unknown_temp,
        // Too many changes in account, local state invalid.
        '25': l.err_local_state_invalid,
        // Session closed.
        '26': l.err_session_closed,
        // The whole account was reloaded, missed updates could not have been applied in an orderly fashion.
        '27': l.err_reloaded_acc,
        // Unable to figure out some node correspondence.
        '28': l.err_n_correspondence,
        // Backup externally modified.
        '29': l.err_externally_modified,
        // Backup source path not below drive path.
        '30': l.err_wrong_source_path,
        // Unable to write sync config to disk.
        '31': l.err_write_config_to_disk
    };

    const syncStatus = {

        inProgressSyncs(syncData, statusParentNode) {
            // Show Syncing progress (or Backing up icon if progress data is missing)
            if (syncData.syncingPercs && syncData.syncsNumber === 1) {
                const percsNode = mCreateElement('div', {'class': 'percs'}, statusParentNode);

                mCreateElement('i', {'class': 'sprite-fm-mono icon-transfer in-progress'}, percsNode);
                mCreateElement('span', {
                    'class': 'in-progress'
                }, percsNode).textContent = `${syncData.syncingPercs} %`;
            }
            else {

                mCreateElement('i', {
                    'class': 'sprite-fm-mono icon-transfer in-progress'
                }, statusParentNode);
            }

            mCreateElement('span', {'class': 'in-progress'}, statusParentNode).textContent = l.updating_status;
        },

        blockedSyncs(syncData, statusParentNode, isDeviceCard) {

            const errorMessage = errorMessages[syncData.errorState];
            let status = l.blocked_status; // Blocked

            // Expired account status
            if (syncData.errorState === 10) {
                status = l.expired_account_state;
            }
            // Error status
            else if (errorMessage) {
                status = l[1578];
            }

            mCreateElement('i', {'class': 'sprite-fm-mono error icon-close-component'}, statusParentNode);
            mCreateElement('span', {'class': 'error'}, statusParentNode).textContent = status;

            // Show error icon with a tooltip
            if (!isDeviceCard && errorMessage) {

                mCreateElement('i', {
                    'class': 'sprite-fm-mono icon-info-filled tip-icon simpletip',
                    'data-simpletip': errorMessage,
                    'data-simpletip-class': 'backup-tip',
                    'data-simpletipposition': 'top',
                    'data-simpletipoffset': 2
                }, statusParentNode);
            }
        },

        offlineSyncs(syncData, statusParentNode, isDeviceCard) {
            const daysNum = 7; // Max Offline days to show warning

            // Show warning icon if last heartbeat was > 'daysNum' days ago
            if (isDeviceCard &&
                (syncData.currentDate - syncData.lastHeartbeat * 1000) / (1000 * 3600 * 24) >= daysNum) {

                mCreateElement('i', {
                    'class': 'sprite-fm-uni icon-hazard simpletip',
                    'data-simpletip': mega.icu.format(l.offline_device_tip, daysNum),
                    'data-simpletipposition': 'top',
                    'data-simpletipoffset': 2
                }, statusParentNode);
            }
            mCreateElement('i', {'class': 'sprite-fm-mono icon-offline'}, statusParentNode);
            mCreateElement('span', undefined, statusParentNode).textContent = l[5926];
        }
    };

    return new class {

        constructor() {

            this.data = []; // Formatted API response data
            this.deviceCardStates = {}; // Saved Expanded/Selected device states, paginator value
            this.dn = {};
            this.lastupdate = 0; // Last API request date
            this.selectedSync = false; // Selected backup/sync id, if any
            this.$fmHolder = $('.fmholder', 'body');
            this.$backupWrapper = $('.fm-right-block.backup', this.$fmHolder);
            this.$leftPane = $('.content-panel.backup-center', this.$fmHolder);
            this.$leftPaneBtns = $('.js-lpbtn', this.$leftPane);
            this.$loader = $('.js-bc-loader', this.$backupWrapper);
            this.$emptyBlock = $('.backup-center.empty-section', this.$backupWrapper);
            this.$contentBlock = $('.backup-center.content-block', this.$backupWrapper);
        }

        /**
         * Get device names list from u_attr
         * @returns {void}
         */
        async getDevicesData() {

            const res = await Promise.resolve(mega.attr.get(u_handle, 'dn', false, true)).catch(nop);

            if (typeof res === 'object') {

                // Decode the 8 bit chars in the string to a UTF-8 byte array then
                // convert back to a regular JavaScript String (UTF-16)
                this.dn = mega.attr.decodeObjectValues(res) || {};
            }

            if (d) {
                console.log('Devices names:');
                console.log(this.dn);
            }
        }

        /**
         * Add folders that exist in My Backups, but there is no sync data in API
         * @returns {void}
         */
        async getStoppedBackups() {

            const backups = M.tree[M.BackupsId];

            if (typeof backups !== 'object') {
                return false;
            }

            for (const h in backups) {

                const folders = M.tree[h];

                if (!folders) {
                    continue;
                }

                const handles = Object.keys(folders);
                await dbfetch.geta(handles);

                const id = M.d[h].devid || M.d[h].drvid;
                const i = this.data.findIndex(e => e.device === id);

                if (i > -1) {

                    const activeBackups = this.data[i].folders || [];
                    const ids = new Set(activeBackups.map(d => d.h));
                    const stoppedBackups = Object.values(folders).filter(d => !ids.has(d.h));

                    if (stoppedBackups) {
                        this.data[i].folders = [...activeBackups, ...stoppedBackups];
                    }
                }
                else {

                    if (!this.deviceCardStates[id]) {

                        this.deviceCardStates[id] = {};
                    }

                    this.data.push({
                        device: id,
                        folders: Object.values(folders),
                        handle: M.d[h].p,
                        t: 5
                    });
                }
            }
        }

        /**
         * Create an array with deviceIds and corresponding backups/syncs data
         * @param {Array} res Array of all backup folders from API
         * @returns {Array} Array of devices and corresponding syncs
         */
        formatData(res) {

            const formattedData = [];

            for (let i = 0; i < res.length; i++) {

                const n = M.getNodeByHandle(res[i].h);

                // Check if such device already exists
                const devIndex = formattedData.findIndex(a => a.device === res[i].d);

                // If such Device already exists in Array
                if (devIndex > -1) {

                    formattedData[devIndex].folders.push(res[i]);

                    // Reset the Parent folder handle if at least one folder is not a backup
                    if (res[i].t !== 5) {
                        formattedData[devIndex].handle = '';
                    }

                    // Set "Backup" type if device contains Sync folders and Backups
                    // If there is no device name in u_attr, we will set Backup parent folder name later
                    formattedData[devIndex].type = Math.max(formattedData[devIndex].type, res[i].t);
                }
                else {

                    // Create device states key to keep Expanded/Selected states and paginator value
                    if (!this.deviceCardStates[res[i].d]) {

                        this.deviceCardStates[res[i].d] = {};
                    }

                    formattedData.push({
                        device: res[i].d,
                        handle: res[i].t === 5 && n.p ? n.p : '', // Set parent node handle if it's a Backup folder
                        folders: [res[i]],
                        type: res[i].t,
                        dua: res[i].dua
                    });
                }
            }

            return formattedData;
        }

        /**
         * Get Device list with backup/sync folders data
         * @param {Boolean} force True to update data without time limit
         * @returns {Promise} Promise that resolve once process is done.
         */
        async getData(force) {

            this.lastupdate = Date.now();

            const {result: res} = await api.req({a: 'sf'});

            if (d) {
                console.log('Backup/sync folders API response: sf ->');
                console.log(res);
            }

            if (Array.isArray(res) && res.length) {

                const uniqueHandles = res.map(a => a.h)
                    .filter((val, i, self) => self.indexOf(val) === i);

                await dbfetch.geta(uniqueHandles);

                // Set an array of objects with device IDs and corresponding sync/backup data
                this.data = this.formatData(res);
            }
            else {

                this.data = [];
            }
        }

        /**
         * Open MEGAsync if it's installed or Show necessary dialog
         * @returns {void}
         */
        addNewBackup() {

            megasync.isInstalled((err, is) => {

                if (!err && is) {

                    megasync.megaSyncRequest({a: "ab", u: u_handle}, (ev, res) => {

                        // TODO: Remove the condition when no old versions left on users devices
                        if (res === -2 && is.v && parseFloat(is.v) < 4.8) {

                            msgDialog(
                                `confirmation:!^${l[20826]}!${l[1597]}`,
                                l[23967],
                                l.outdated_app_ver,
                                undefined,
                                (e) => {

                                    if (!e || typeof megasync === 'undefined') {
                                        return false;
                                    }
                                    open(
                                        megasync.getMegaSyncUrl() || 'https://mega.io/desktop',
                                        '_blank',
                                        'noopener,noreferrer'
                                    );
                                }
                            );
                        }
                        // Invalid user handle
                        else if (res === -2) {

                            msgDialog('info', l[23967], l[200]);
                        }
                        // Wrong user
                        else if (res === -11) {

                            msgDialog('info', l[23967],l.account_mismatch_info);
                        }
                    }, () => {

                        // MEGAsync is not running
                        msgDialog('info', l[23967], l[23967], l.empty_bakups_info);
                    });
                }
                else {

                    dlmanager.showMEGASyncOverlay();
                }
            });
        }

        /**
         * Stop Sync/Backup
         * @param {String} id Sync id
         * @param {String} h Folder handle
         * @param {String} target Target folder handle
         * @returns {Promise} Promise that resolve once process is done
         */
        async stopSync(id, h, target) {

            if (M.isInvalidUserStatus()) {
                return;
            }

            const node = M.getNodeByHandle(h);

            // If `id` is not a folder handle, stop the sync/backup
            if (id && id !== h) {
                const {result} = await api.req({a: 'sr', id: id});

                if (d) {
                    console.log(`Remove backup/sync response: sr -> ${result}`);
                }
            }

            if (node) {

                // Set `sds` attr to make sure that SDK will try to clear heartbeat record too
                if (id && id !== h) {
                    const sds = node.sds ? `${node.sds},${id}:8` : `${id}:8`;
                    await api.setNodeAttributes(node, {sds});
                }

                // Backup/stopped backup folder
                if (M.getNodeRoot(node.h) === M.InboxID) {

                    // Move backup to target folder
                    if (target) {

                        await M.moveNodes([h], target, 3);
                    }
                    // Remove
                    else {

                        await M.safeRemoveNodes([h]);
                    }
                }
            }
            await this.renderContent(true);
        }

        /**
         * Show Stop Sync/Backup confirmation dialog
         * @param {Boolean} isBackup Change wording for backups
         * @returns {void}
         */
        showStopConfirmationDialog(isBackup) {

            if (!$.selected.length || !this.selectedSync
                || this.selectedSync.nodeHandle !== $.selected[0]) {

                return false;
            }

            let type = `confirmation:!^${ l.stop_syncing_button}!${l[1597]}`;
            let title = l.stop_syncing_button;
            let info = l.stop_syncing_info;

            if (isBackup) {
                type = 'confirmation';
                title = l.stop_backup_header;
                info = '';
            }

            msgDialog(
                type,
                l[882],
                title,
                info,
                (e) => {

                    if (!e) {
                        return false;
                    }

                    loadingDialog.pshow();

                    this.stopSync(this.selectedSync.id, this.selectedSync.nodeHandle)
                        .then(nop)
                        .catch((ex) => {
                            msgDialog('warninga', l[135], l[47], ex);
                        })
                        .finally(() => {

                            loadingDialog.phide();
                        });
                });
        }

        /**
         * Show Stop Backup dialog
         * @returns {void}
         */
        showStopBackupDialog() {

            if (!$.selected.length || !this.selectedSync
                || this.selectedSync.nodeHandle !== $.selected[0]) {

                return false;
            }

            // Show single confirmation dialog is there is not folder node
            if (!M.d[this.selectedSync.nodeHandle]) {

                this.showStopConfirmationDialog(true);
                return;
            }

            const $backupDialog = $('.mega-dialog.stop-backup', '.mega-dialog-container');
            const $radioWrappers = $('.radio-button', $backupDialog);
            const $radioButtons = $('input[name="stop-backup"]', $backupDialog);
            const $input = $('.js-path-input input', $backupDialog);
            const $changePathButton = $('.js-change-path', $backupDialog);
            const $confirmButton = $('.js-confirm', $backupDialog);
            const $closeButton = $('.js-close', $backupDialog);
            let inputValue = `${l[18051]}/`;
            let target = M.RootID;

            $radioButtons.prop('checked', false);
            $radioWrappers.removeClass('radioOn').addClass('radioOff');
            $changePathButton.addClass('disabled');
            $confirmButton.addClass('disabled');
            $input.val(inputValue);

            $closeButton.rebind('click.closeDialog', () => {

                closeDialog();
            });

            $radioButtons.rebind('change.selectAction', (e) => {

                const $this = $(e.target);

                $radioWrappers.removeClass('radioOn').addClass('radioOff');
                $this.parent().removeClass('radioOff').addClass('radioOn');

                if ($this.val() === '0') {
                    $changePathButton.removeClass('disabled');
                }
                else {
                    $changePathButton.addClass('disabled');
                }

                $confirmButton.removeClass('disabled');
            });

            $changePathButton.rebind('click.changePath', (e) => {

                if ($(e.currentTarget).hasClass('disabled')) {

                    return false;
                }

                closeDialog();

                selectFolderDialog('move')
                    .then((folder) => {
                        folder = folder || target;

                        M.safeShowDialog('stop-backup', $backupDialog);
                        return folder === M.RootID ? folder : dbfetch.get(folder).then(() => folder);
                    })
                    .then((folder) => {
                        target = folder;
                        $input.val(M.getPath(folder).reverse().map(h => M.getNameByHandle(h)).join('/'));
                    })
                    .catch(tell);
            });

            $confirmButton.rebind('click.stopBackup', (e) => {

                if ($(e.currentTarget).hasClass('disabled') || !this.selectedSync) {

                    return false;
                }

                const deleteFolder = $('input:checked', $radioWrappers).val();

                closeDialog();
                loadingDialog.pshow();

                this.stopSync(this.selectedSync.id, this.selectedSync.nodeHandle, deleteFolder !== '1' && target)
                    .catch(tell)
                    .finally(() => {

                        loadingDialog.phide();
                    });
            });

            M.safeShowDialog('stop-backup', $backupDialog);
        }

        /**
         * Init / update content scrolling
         * @returns {void}
         */
        scrollBlock() {

            // Init content scrolling
            const $scrollBlock = $('.content-body', this.$contentBlock);

            if ($scrollBlock.is('.ps')) {
                Ps.update($scrollBlock[0]);
            }
            else {
                Ps.initialize($scrollBlock[0]);
            }

            if (this.scrollToSelected) {

                const $scrollTo = $('tr.active, .backup-body.expanded', $scrollBlock).first();
                this.scrollToSelected = false;

                if ($scrollTo.length === 0) {
                    return false;
                }

                const scrollToOffset = $scrollTo.offset().top;
                const scrollToHeight = $scrollTo.outerHeight();
                const scrollBlockOffset = $scrollBlock.offset().top;
                const scrollBlockHeight = $scrollBlock.height();
                const scrollValue = $scrollBlock.scrollTop();

                if (scrollToOffset - scrollBlockOffset + scrollToHeight > scrollBlockHeight) {

                    $scrollBlock.scrollTop(
                        scrollToOffset - scrollBlockOffset
                            + scrollToHeight - scrollBlockHeight + scrollValue + 8
                    );
                }
            }
        }

        /**
         * Get device name
         * @param {String} deviceId Device name
         * @param {Number} syncType Device sync type
         * @param {Object} node Device Node
         * @returns {String} Device name
         */
        getDeviceName(deviceId, syncType, node) {

            // Return real device name is  device id exists is u_attr
            if (this.dn && this.dn[deviceId]) {

                return this.dn[deviceId];
            }
            // Return "Mobile" if sync is MU/CU
            else if (syncType === 3 || syncType === 4) {

                return l.my_mobile;
            }
            // Return forder name if it's a Backup
            else if (syncType === 5 && node.name) {

                return node.name;
            }

            // Return "Unknown device"
            return l.my_computer;
        }

        /**
         * Decode and decrypt an encrypted TLV values of
         * @param {String} encodedValue Encoded string
         * @returns {Object} Decoded Folder data
         */
        decodeFolderData(encodedValue) {

            let decodedValue = {};

            if (encodedValue) {

                tryCatch(() => {

                    // Try decode, decrypt, convert from TLV into a JS object
                    const urlDecodedString = base64urldecode(encodedValue);
                    const decryptedBlock = tlvstore.blockDecrypt(urlDecodedString, u_k);
                    const container = tlvstore.tlvRecordsToContainer(decryptedBlock);

                    decodedValue = mega.attr.decodeObjectValues(container);

                }, (ex) => {

                    if (d) {

                        console.error(`Failed to decrypt ${encodedValue}`, ex);
                    }
                })();
            }

            return decodedValue;
        }

        /**
         * Init Backup center pages navigator for each device is folders list contains > 10
         * @returns {void}
         */
        initPagesNavigator() {

            const $backups = $('.backup-body', this.$contentBlock);

            // Slides switcher
            const switchSlide = ($backup, slide) => {

                const $navigation = $('.nav', $backup);
                const $pageNumbers = $('span', $navigation);

                // Save page value to restore after data refresh
                this.deviceCardStates[$backup.attr('data-id')].nav = slide;

                $backup.attr('data-nav',  slide);
                $pageNumbers.removeClass('active');
                $pageNumbers.filter(`[data-slide="${slide}"]`).addClass('active');
                $('i', $navigation).removeClass('disabled hidden');

                if (slide === 1) {
                    $('.prev', $navigation).addClass('hidden');
                }
                else if (slide === $('span', $navigation).length) {
                    $('.next', $navigation).addClass('disabled');
                }

                $('.data-table', $backup).addClass('hidden');
                $(`.data-table:eq(${slide - 1})`, $backup).removeClass('hidden');

                this.scrollBlock();
            };

            // Populate nav buttons and select a slide
            for (let i = 0; i < $backups.length; i++) {

                const $currentBackup = $($backups[i]);
                const $foldersLists = $('.data-table', $currentBackup);
                const $navigation = $('.nav', $currentBackup).text('');
                const foldersNum = $foldersLists.length;
                const savedSlide = $currentBackup.attr('data-nav') || 1;
                let navPages = null;

                // Create navigation bar
                if (foldersNum > 1) {

                    // Prev/Next buttons and pages wrapper
                    mCreateElement('i', {'class': 'sprite-fm-mono icon-arrow-right prev hidden'}, $navigation[0]);
                    navPages = mCreateElement('div', {'class': 'pages'}, $navigation[0]);
                    mCreateElement('i', {'class': 'sprite-fm-mono icon-arrow-right next'}, $navigation[0]);

                    // Create Pages buttons
                    for (let j = 0; j < foldersNum; j++) {

                        mCreateElement('span', {
                            'data-slide': j + 1
                        }, navPages).textContent = j + 1;
                    }

                    // Show saved slide or first one
                    switchSlide($currentBackup, savedSlide > foldersNum ? foldersNum : parseInt(savedSlide));
                }
            }

            // Init Pages click event
            $('.pages span', $backups).rebind('click.showPage', (e) => {

                const $this = $(e.target);

                switchSlide($this.closest('.backup-body'), parseInt($this.attr('data-slide')));
            });

            // Init Prev/Next click events
            $('.nav i', $backups).rebind('click.showPage', (e) => {

                const $this = $(e.target);
                const $backup = $this.closest('.backup-body');
                let newSlide = 0;

                if ($this.hasClass('hidden') || $this.hasClass('disabled')) {
                    return false;
                }
                else if ($this.hasClass('prev')) {
                    newSlide = parseInt($('.pages span.active', $backup).attr('data-slide')) - 1;
                }
                else {
                    newSlide = parseInt($('.pages span.active', $backup).attr('data-slide')) + 1;
                }

                switchSlide($backup, newSlide);
            });
        }

        /**
         * Init Backup center collapse/expand folder lists
         * @returns {void}
         */
        initExpandCollapse() {

            const $contentWrap = $('.content-wrap', this.$contentBlock);

            $('.js-expand', $contentWrap).rebind('click.expandCollapse', (e) => {

                const $this = $(e.target);
                const $deviceCard = $this.closest('.backup-body');
                const deviceId = $deviceCard.attr('data-id');

                if ($deviceCard.hasClass('expanded')) {
                    this.deviceCardStates[deviceId].expanded = '';
                    $deviceCard.removeClass('expanded');
                }
                else {
                    $deviceCard.addClass('expanded');
                    this.deviceCardStates[deviceId].expanded = 'expanded';

                    // Update data
                    this.renderContent().catch(dump);
                }

                this.scrollBlock();
            });
        }

        /**
         * Show Context menu and required menu items
         * @param {Object} e Event data
         * @returns {void}
         */
        showContextMenu(e) {

            const $this = $(e.target);
            const $syncFolder = $this.closest('tr[data-handle]');
            const $deviceCard = $this.closest('.backup-body');
            let menuItems = '';

            // If target is backup folder
            if ($syncFolder.length === 1) {

                menuItems = '.properties-item';

                if (M.d[$syncFolder.attr('data-handle')]) {
                    menuItems += ', .open-cloud-item';
                }

                if (!$syncFolder.attr('data-id')) {
                    menuItems += ', .move-backup-item, .remove-backup-item';
                }
                else if ($syncFolder.attr('data-type') === '5') {
                    menuItems += ', .stopbackup-item';
                }
                else if ($syncFolder.attr('data-type') !== '3' && $syncFolder.attr('data-type') !== '4') {
                    menuItems += ', .stopsync-item';
                }
            }
            // If target is device card
            else if ($deviceCard.length === 1) {

                menuItems = '.properties-item, .device-rename-item';

                // "Show in Cloud drive" for Backups only
                if ($deviceCard.attr('data-handle') && M.d[$deviceCard.attr('data-handle')]) {

                    menuItems += ', .open-cloud-item';
                }

                // "Get more quota"
                if ($deviceCard.hasClass('overquota')) {

                    menuItems += ', .get-more-quota';
                }
            }
            // Outside area
            else {

                menuItems = '.new-backup';
            }

            // Show menu
            M.contextMenuUI(e, 8, menuItems);
        }

        /**
         * Init Backup center Context menus
         * @returns {void}
         */
        initContextMenus() {

            const $contentBody = $('.content-body', this.$contentBlock);

            // Select device card/sync folder
            $contentBody.rebind('click.backupSelect contextmenu.backupSelect', (e) => {

                const $this = $(e.target);
                const $selectedDevice = $('.backup-body.active', $contentBody);
                const $currentDevice = $this.closest('.backup-body');
                const $currentFolder = $this.closest('tr[data-handle]');

                selectionManager.clear_selection();

                // Unselect previously selected sync/backup
                this.selectedSync = false;
                $('tr', $contentBody).removeClass('active');

                // Unselect previously selected device card
                if ($selectedDevice.length) {

                    $('.backup-body.active', $contentBody).removeClass('active');
                    this.deviceCardStates[$selectedDevice.attr('data-id')].selected = '';
                }

                if ($currentFolder.length) {

                    $currentFolder.addClass('active');

                    selectionManager.add_to_selection($currentFolder.attr('data-handle'));
                    mega.ui.mInfoPanel.reRenderIfVisible($.selected);
                    this.selectedSync = {
                        'nodeHandle': $currentFolder.attr('data-handle'),
                        'id': $currentFolder.attr('data-id') || $currentFolder.attr('data-handle'),
                        'localName': $currentFolder.attr('data-local')
                    };
                }
                // Select clicked device card
                else if ($currentDevice.length) {

                    // Show "Open in cloud drive" item if device contains backups only
                    if ($currentDevice.attr('data-handle')) {

                        selectionManager.add_to_selection($currentDevice.attr('data-handle'));
                    }
                    else {

                        const $deviceFolders = $('tr[data-handle]', $currentDevice);

                        // Get all folder handles in device for Properties dialog
                        for (let i = 0; i < $deviceFolders.length; i++) {

                            selectionManager.add_to_selection($deviceFolders[i].dataset.handle);
                        }
                    }

                    $currentDevice.addClass('active');
                    this.deviceCardStates[$currentDevice.attr('data-id')].selected = 'active ';
                    mega.ui.mInfoPanel.reRenderIfVisible($.selected);
                }
            });

            // Right click on backups content block
            $contentBody.rebind('contextmenu.backupContext', (e) => {

                this.showContextMenu(e);
            });

            // Context icon click
            $('.js-context', $contentBody).rebind('click.backupContext', (e) => {

                this.showContextMenu(e);
            });
        }

        /**
         * Init Backup center events
         * @returns {void}
         */
        initEvents() {

            this.scrollBlock();
            this.initPagesNavigator();
            this.initExpandCollapse();
            this.initContextMenus();

            // Reinit simpletip events
            $('.simpletip', this.$contentBlock).trigger('simpletipUpdated');

            // Open Support page if the link exists
            $('.tip-icon', this.$contentBlock).rebind(
                'mouseover.showTip',
                SoonFc(() => {

                    $('.dark-direct-tooltip.backup-tip a', 'body').rebind('click.openHelp', () => {

                        window.open('https://127.0.0.1/support', '_blank');
                    });
                }));

            // Init New backup button
            $('.js-backup-computer', this.$contentBlock).rebind('click.openApp', () => {

                this.addNewBackup();
            });
        }

        /**
         * Get backup states and sync statuses of one or multiple folders
         * @param {Array} folders One or multiple folders data
         * @returns {Object} An Object with 'status', 'progress' and 'heartbeat' unix date
         */
        // eslint-disable-next-line complexity
        getSyncStatus(folders) {

            const syncData = {
                'currentDate': Date.now(),
                'blockedSyncs': 0,
                'disabledSyncs': 0,
                'errorState': undefined,
                'initializingSyncs': 0,
                'inProgressSyncs': 0,
                'isMobile': false,
                'lastHeartbeat': 0,
                'offlineSyncs': 0,
                'overquotaSyncs': 0,
                'pausedSyncs': 0,
                'scaningSyncs': 0,
                'stalledSyncs': 0,
                'stoppedSyncs': 0,
                'syncingPercs': 0,
                'syncsNumber': folders.length,
                'syncType': 0,
                'upToDateSyncs': 0
            };

            for (var i = 0; i < folders.length; i++) {

                let folderHeartbeat = 0;
                let timeDifference = 0;

                // Detect Mobile device
                // 0 - TYPE_TWOWAY
                // 1 - TYPE_ONEWAY_UP
                // 2 - TYPE_ONEWAY_DOWN
                // 3 - TYPE_CAMERA_UPLOAD
                // 4 - TYPE_MEDIA_UPLOAD
                // 5 - TYPE_BACKUP
                syncData.isMobile = folders[i].t === 3 || folders[i].t === 4;

                // Get folder hearbeat and save latest timestamp
                if (folders[i].hb) {

                    // Get latest backup heartbeat
                    folderHeartbeat = Math.max(
                        folders[i].hb.ts || 0,
                        folders[i].hb.lt || 0
                    );

                    // Set latest device heartbeat
                    syncData.lastHeartbeat = Math.max(
                        folderHeartbeat,
                        syncData.lastHeartbeat
                    );
                }

                // How much time has passed since the last interaction
                timeDifference = (syncData.currentDate - folderHeartbeat * 1000) / (1000 * 60);

                // Stopped backup (folder without sync data)
                if (!folders[i].s) {

                    syncData.stoppedSyncs++;
                }
                // Check Disabled/Paused backup states
                // 1- Working fine (enabled)
                // 2 - Failed (permanently disabled)
                // 3 - Temporarily disabled due to a transient situation (e.g: account blocked).
                // 3 - Will be resumed when the condition passes
                // 4 - Disabled by the user
                // 5 - Active but upload transfers paused in the SDK
                // 6 - Active but download transfers paused in the SDK
                // 7 - Active but transfers paused in the SDK
                // Blocked (permanently disabled / due to a transient situation) or Error
                else if (folders[i].s === 2 || folders[i].s === 3) {

                    syncData.blockedSyncs++;
                    syncData.errorState = folders[i].ss;

                    if (folders[i].ss === 9) {
                        syncData.overquotaSyncs++;
                    }
                }
                // Stalled
                else if (folders[i].hb && folders[i].hb.s === 6) {

                    syncData.stalledSyncs++;
                }
                // Disabled by user
                else if (folders[i].s === 4) {

                    syncData.disabledSyncs++;
                }
                // Offline Sync
                // if there is no heartbeat
                // or last CU/MU heartbeat was > 1h ago
                // or last Sync/backup heartbeat was > 30mins ago
                else if (!folderHeartbeat || syncData.isMobile && timeDifference > 60
                    || !syncData.isMobile && timeDifference > 30) {

                    // Set Offline only if MEGA folder does not exist
                    // or if MEGA folder was created > 10mins ago
                    if (!M.d[folders[i].h]
                        || (syncData.currentDate - M.d[folders[i].h].ts * 1000) / (1000 * 60) > 10) {

                        syncData.offlineSyncs++;
                    }
                }
                // Paused
                // if TWOWAY sync and any transfer type is paused
                // or if ONEWAY_UP/CU/MU/Backup and uploads/all transfers are paused
                // or if ONEWAY_DOWN and downloads/all transfers are paused
                else if (folders[i].t === 0 && folders[i].s >= 5
                    || (folders[i].t === 1 || folders[i].t >= 3) && (folders[i].s === 5 || folders[i].s === 7)
                    || folders[i].t === 2 && folders[i].s >= 6) {

                    syncData.pausedSyncs++;
                }
                // Check Sync heartbeat statuses:
                // 1 - Up to date: local and remote paths are in sync
                // 2 - The sync engine is working, transfers are in progress (will be detected by folder.hb.p)
                // 3 - The sync engine is working, e.g: scanning local folders
                // 4 - Sync is not active. A state != ACTIVE should have been sent through '''sp'''
                // 5 - Unknown status
                // 6 - Stalled: indicates the user needs to intervene due to something the sync can't decide for them
                // Up to date
                // if working fine or unrelated transfer type is paused
                // and there is no heartbeat state or Up to date/unknown/not active
                else if ((folders[i].s === 1 || folders[i].s >= 5) && (!folders[i].hb
                    || folders[i].hb && (folders[i].hb.s === 1 || folders[i].hb.s === 4))) {

                    syncData.upToDateSyncs++;
                }
                // Initalizing...
                else if (folders[i].hb && folders[i].hb.s === 5) {

                    syncData.initializingSyncs++;
                }
                // Syncing. If 'p' value exitsts in backup, then the sync engine is working
                // If it doesn't not exist, then wwe thing that backup if synced, as rest states will be filtered before
                else if (folders[i].hb && folders[i].hb.s === 2) {

                    syncData.syncingPercs = folders[i].hb.p;
                    syncData.inProgressSyncs++;
                }
                // Scanning
                else if (folders[i].hb && folders[i].hb.s === 3) {

                    syncData.scaningSyncs++;
                }
            }

            return syncData;
        }

        /**
         * Create DOM element with sync status
         * @param {Object} syncData An Object with 'status', 'progress' and 'heartbeat' unix date
         * @param {Object} statusParentNode An Element Object, representing Status parent element
         * @param {Boolean} isDeviceCard True is status required special Device card warnigs
         * @returns {void}
         */
        setSyncStatus(syncData, statusParentNode, isDeviceCard) {

            // Show syncing status: Backing up
            if (syncData.inProgressSyncs) {

                syncStatus.inProgressSyncs(syncData, statusParentNode, isDeviceCard);
            }
            // Show syncing status: Scaning
            else if (syncData.scaningSyncs) {

                mCreateElement('i', {'class': 'sprite-fm-mono icon-sync in-progress'}, statusParentNode);
                mCreateElement('span', {'class': 'in-progress'}, statusParentNode).textContent = l.scanning_status;
            }
            // Show syncing status: Initilizing
            else if (syncData.initializingSyncs) {

                mCreateElement('i', {'class': 'sprite-fm-mono icon-sync in-progress'}, statusParentNode);
                mCreateElement('span', {'class': 'in-progress'}, statusParentNode).textContent = l.initailizing_status;
            }
            // Show sync status: Paused
            else if (syncData.pausedSyncs) {

                mCreateElement('i', {'class': 'sprite-fm-mono icon-pause'}, statusParentNode);
                mCreateElement('span', undefined, statusParentNode).textContent = l[1651];
            }
            // Show backup state: Overquota
            else if (syncData.overquotaSyncs) {

                mCreateElement('i', {
                    'class': 'sprite-fm-mono error icon-cloud-storage-over-quota'
                }, statusParentNode);
                mCreateElement('span', {'class': 'error'}, statusParentNode).textContent = l.out_of_quota;
            }
            // Show backup state: Blocked due to error/Temporary blocked
            else if (syncData.blockedSyncs) {

                syncStatus.blockedSyncs(syncData, statusParentNode, isDeviceCard);
            }
            // Show backup state: Stalled
            else if (syncData.stalledSyncs) {

                mCreateElement('i', {
                    'class': 'sprite-fm-mono error icon-close-component'
                }, statusParentNode);
                mCreateElement('span', {'class': 'error'}, statusParentNode).textContent =
                    mega.icu.format(l.stalled_sync_state, isDeviceCard ? syncData.stalledSyncs : 1);
            }
            // Show sync status: Up to date
            else if (syncData.upToDateSyncs) {

                mCreateElement('i', {'class': 'sprite-fm-mono icon-check success'}, statusParentNode);
                mCreateElement('span', {
                    'class': 'success'
                }, statusParentNode).textContent = l.up_to_date_status;
            }
            // Show sync status: Offline
            else if (syncData.offlineSyncs) {

                syncStatus.offlineSyncs(syncData, statusParentNode, isDeviceCard);
            }
            // Show backup state: Disabled by user
            else if (syncData.disabledSyncs) {

                mCreateElement('i', {
                    'class': 'sprite-fm-mono warning icon-disable'
                }, statusParentNode);
                mCreateElement('span', {'class': 'warning'}, statusParentNode).textContent = l.backup_disabled_by_user;

                if (!isDeviceCard) {

                    mCreateElement('i', {
                        'class': 'sprite-fm-mono icon-info-filled tip-icon simpletip',
                        'data-simpletip': syncData.isMobile ? l.disabled_mobile_sync_tip : l.disabled_sync_tip,
                        'data-simpletip-class': 'backup-tip',
                        'data-simpletipposition': 'top',
                        'data-simpletipoffset': 2
                    }, statusParentNode);
                }
            }
            // Show stopped backup state
            else if (syncData.stoppedSyncs) {

                mCreateElement('i', {
                    'class': 'sprite-fm-mono icon-clear'
                }, statusParentNode);
                mCreateElement('span', undefined, statusParentNode).textContent = l.backup_stopped;
            }
        }

        /**
         * Populate device list
         * @returns {void}
         */
        populateDevices() {

            const $contentWrap = $('.content-wrap', this.$contentBlock).text('');

            this.$emptyBlock.addClass('hidden');
            this.$contentBlock.removeClass('hidden');

            for (let i = 0; i < this.data.length; i++) {

                const syncStatuses = this.getSyncStatus(this.data[i].folders);
                const deviceHandle = this.data[i].handle || '';
                const n = M.getNodeByHandle(deviceHandle);
                const foldersNumber = this.data[i].folders.length;
                const savedDeviceStates = this.deviceCardStates[this.data[i].device] || {};
                let deviceState = '';
                let deviceUserAgent = '';
                let deviceName = '';
                let deviceNode = null;
                let headerNode = null;
                let nameNode = null;
                let infoNode = null;
                let foldersInfoNode = null;
                let statusWrapperNode = null;
                let statusInfoNode = null;

                // Keep expanded state after update
                if (savedDeviceStates.expanded) {
                    deviceState += ` ${savedDeviceStates.expanded}`;
                }

                // Keep selected state after update
                if (savedDeviceStates.selected) {
                    deviceState += ` ${savedDeviceStates.selected}`;
                }

                // Ovequota state to show correct context menu
                if (syncStatuses.overquotaSyncs) {
                    deviceState += ' overquota';
                }

                // Backup container with device id and folder handle
                deviceNode = mCreateElement('div', {
                    'class': `backup-body${deviceState}`,
                    'data-id': this.data[i].device,
                    'data-handle': deviceHandle,
                    'data-nav': savedDeviceStates.nav || ''
                }, $contentWrap[0]);

                // Backup container header
                headerNode = mCreateElement('div', {'class': 'header'}, deviceNode);

                // Device name container
                nameNode = mCreateElement('div', {'class': 'name'}, headerNode);

                // Get device name
                deviceName = this.getDeviceName(this.data[i].device, this.data[i].type, n);
                deviceUserAgent = this.data[i].dua;

                // Show Device icon
                const dIcon = deviceIcon(deviceUserAgent || deviceName, this.data[i].type);
                mCreateElement('i', {
                    'class':`medium-file-icon item-type-icon-90 icon-${dIcon}-90`
                }, nameNode);

                // Show Device name
                mCreateElement('span', {
                    'title': deviceName
                }, nameNode).textContent = deviceName;

                // Backup info container
                infoNode = mCreateElement('div', {'class': 'info'}, headerNode);

                // Backup folders info container
                foldersInfoNode = mCreateElement('div', {'class': 'info-cell folders-info'}, infoNode);

                // Show Number of backups
                mCreateElement('span', {'class': 'high'}, foldersInfoNode).textContent =
                    foldersNumber === 1 ? l[834] : l[832].replace('[X]', foldersNumber);

                // Show Warning icon if any folder have issues
                if (syncStatuses.disabledSyncs) {

                    mCreateElement('i', {
                        'class': 'sprite-fm-uni icon-hazard simpletip',
                        'data-simpletip': mega.icu.format(l.device_attention_tip, syncStatuses.disabledSyncs),
                        'data-simpletipposition': 'top',
                        'data-simpletipoffset': 2
                    }, foldersInfoNode);
                }

                // Sync status wrapper
                statusWrapperNode = mCreateElement('div', {'class': 'info-cell status-info'}, infoNode);

                // Sync status block
                statusInfoNode = mCreateElement('div', {'class': 'status'}, statusWrapperNode);
                this.setSyncStatus(syncStatuses, statusInfoNode, true);

                // Show Expand and Context icons
                mCreateElement('i', {
                    'class': 'control sprite-fm-mono icon-arrow-down js-expand'
                }, statusWrapperNode);
                mCreateElement('i', {
                    'class': 'control sprite-fm-mono icon-options js-context'
                }, statusWrapperNode);

                // Create folders list wrapper
                mCreateElement('div', {'class': 'bc-item-list'}, deviceNode);

                // Populate folders list for current device
                this.populateFolders(this.data[i]);
            }
        }

        // Device rename dialog
        renameDialog() {

            const $deviceEl = $('.backup-body.active', this.$contentBlock);
            const deviceId = $deviceEl.data('id');

            if (deviceId) {

                var $dialog = $('.mega-dialog.device-rename-dialog');
                var $input = $('input', $dialog);
                var errMsg = '';
                const maxDeviceNameLength = 32;

                const deviceData = mega.backupCenter.data.find((dev) => dev.device === deviceId);

                const deviceName = mega.backupCenter.dn[deviceId];
                const deviceIconClass = `icon-${deviceIcon(
                    deviceData.dua || deviceName,
                    deviceData.type
                )}-90`;

                M.safeShowDialog('device-rename-dialog', () => {
                    $dialog.removeClass('hidden').addClass('active');
                    $input.trigger("focus");
                    return $dialog;
                });

                $('button.js-close, .device-rename-dialog-button.cancel', $dialog)
                    .rebind('click.dialogClose', closeDialog);

                $('.device-rename-dialog-button.rename', $dialog).rebind('click.dialogRename', () => {
                    if ($dialog.hasClass('active')) {

                        var value = $input.val();
                        errMsg = '';

                        if (deviceName && deviceName !== value) {

                            value = value.trim();

                            if (!value) {
                                errMsg = l.device_rename_dialog_warning_empty;
                            }
                            else if (M.isSafeName(value) && value.length <= maxDeviceNameLength) {

                                if (Object.values(mega.backupCenter.dn).includes(value)) {
                                    errMsg = l.device_rename_dialog_warning_duplicate;
                                }
                                else {
                                    mega.backupCenter.dn[deviceId] = value;
                                    loadingDialog.show();
                                    mega.attr.set('dn', mega.attr.encodeObjectValues(mega.backupCenter.dn), false, true)
                                        .then(() => mega.backupCenter.renderContent(true))
                                        .catch(tell)
                                        .finally(() => loadingDialog.hide());
                                }
                            }
                            else if (value.length > 32) {
                                errMsg = mega.icu.format(l.device_rename_dialog_warning_length, maxDeviceNameLength);
                            }
                            else {
                                errMsg = l[24708];
                            }

                            if (errMsg) {
                                $('.duplicated-input-warning span', $dialog).safeHTML(errMsg);
                                $dialog.addClass('duplicate');
                                $input.addClass('error');

                                setTimeout(() => {
                                    $dialog.removeClass('duplicate');
                                    $input.removeClass('error');

                                    $input.trigger("focus");
                                }, 2000);

                                return;
                            }
                        }
                        closeDialog();
                    }
                });

                $input.val(deviceName);

                $('.item-type-icon-90', $dialog)
                    .attr('class',
                          `item-type-icon-90 ${deviceIconClass}`
                    );

                $input.rebind('focus.deviceRenameDialog', () => {
                    $dialog.addClass('focused');
                });

                $input.rebind('blur.deviceRenameDialog', () => {
                    $dialog.removeClass('focused');
                });

                $input.rebind('keydown.deviceRenameDialog', (event) => {
                    // distingushing only keydown evet, then checking if it's Enter in order to preform the action'
                    if (event.keyCode === 13) { // Enter
                        $('.device-rename-dialog-button.rename', $dialog).click();
                    }
                    else if (event.keyCode === 27) { // ESC
                        closeDialog();
                    }
                    else {
                        $dialog.removeClass('duplicate').addClass('active');
                        $input.removeClass('error');
                    }
                });

            }
        }

        /**
         * Populate folder list
         * @param {Object} deviceNode An Element Object, representing Device card element
         * @returns {void}
         */
        // eslint-disable-next-line complexity
        populateFolders(deviceNode) {

            const $deviceWrap = $(`.backup-body[data-id="${deviceNode.device}"]`, this.$contentBlock);
            const $foldersList = $('.bc-item-list', $deviceWrap).text('');
            let tableNode = null;
            let tableHeaderNode = null;
            let folderRowNode = null;
            let folderCellNode = null;
            let folderInfoNode = null;
            let foldersCounter = 0;
            let pagesCounter = 1;

            // Create table and static header
            const createFoldersTable = () => {

                tableNode = mCreateElement('table', {'class': 'data-table minimal'}, $foldersList[0]);
                tableHeaderNode = mCreateElement('tr', undefined, tableNode);
                mCreateElement('th', undefined, tableHeaderNode); // Folder name without label
                mCreateElement('th', undefined, tableHeaderNode).textContent = l[488]; // Status
                mCreateElement('th', undefined, tableHeaderNode).textContent = l[93]; // Type
                mCreateElement('th', undefined, tableHeaderNode)
                    .textContent = l.last_updated_label; // 'Last updated'
                mCreateElement('th', undefined, tableHeaderNode)
                    .textContent = l.used_storage_label; // 'Used storage'
                mCreateElement('th', undefined, tableHeaderNode); // Context icon without label
            };

            createFoldersTable();

            for (let i = 0; i < deviceNode.folders.length; i++) {

                const folder = deviceNode.folders[i];
                const decodedFolderName = this.decodeFolderData(folder.e);
                const syncStatus = this.getSyncStatus([folder]);
                const n = M.getNodeByHandle(folder.h);
                const folderName = folder.id && decodedFolderName.bn && !syncStatus.isMobile || !n.name ?
                    decodedFolderName.bn : n.name;
                const isSelected = folder.id && folder.id === this.selectedSync.id
                        || folder.h === this.selectedSync.id;
                let icon = 'icon-folder-24';
                let type = '';

                // Create new table if > 10 folders for pages navigator
                if (foldersCounter === 10) {

                    foldersCounter = 0;
                    pagesCounter++;
                    createFoldersTable();
                }

                foldersCounter++;

                // Create table row for current folder
                folderRowNode = mCreateElement('tr', {
                    'class': isSelected ? 'active' : '',
                    'data-handle': folder.h,
                    'data-id': folder.id || '',
                    'data-local': folderName,
                    'data-type': folder.id ? folder.t : ''
                }, tableNode);

                if (folder.id && folder.t === 5) {
                    icon = 'icon-folder-backup-24 folder-backup';
                    type = l[20606];
                }
                else if (folder.id && folder.t === 3) {
                    icon = 'icon-folder-camera-uploads-24 folder-camera';
                    type = l.camera_uploads;
                }
                else if (folder.id && folder.t !== 4) {
                    icon = 'icon-folder-sync-24 folder-sync';
                    type = l[17621];
                }

                // Show folder name
                folderCellNode = mCreateElement('td', undefined, folderRowNode);
                folderInfoNode = mCreateElement('div', {'class': 'item-name'}, folderCellNode);
                // sprite-fm-uni icon-folder-24 for vector
                mCreateElement('i', {'class': `item-type-icon ${icon}`}, folderInfoNode);
                mCreateElement('span', {
                    'title': this.decodeFolderData(folder.l).lf || ''
                }, folderInfoNode).textContent = folderName;

                // Create folder Status cell
                folderCellNode = mCreateElement('td', undefined, folderRowNode);
                folderInfoNode = mCreateElement('div', {'class': 'status'}, folderCellNode);

                // Show sync status
                this.setSyncStatus(syncStatus, folderInfoNode);

                // Create Type cell
                folderCellNode = mCreateElement('td', undefined, folderRowNode);

                // Show Used storage
                folderCellNode.textContent = type;

                // Create Last Updated cell
                folderCellNode = mCreateElement('td', undefined, folderRowNode);

                // Set last interation date
                if (syncStatus.lastHeartbeat) {
                    folderCellNode.textContent = time2date(syncStatus.lastHeartbeat);
                }

                // Create Used Storage cell
                folderCellNode = mCreateElement('td', undefined, folderRowNode);

                // Show Used storage
                folderCellNode.textContent = n.tb ? bytesToSize(n.tb) : bytesToSize(0);

                // Show Context menu icon
                folderCellNode = mCreateElement('td', undefined, folderRowNode);
                mCreateElement('i', {
                    'class': 'control sprite-fm-mono icon-options js-context'
                }, folderCellNode);

                // Show page with selected folder
                if (isSelected) {
                    $deviceWrap.attr('data-nav', pagesCounter);
                }
            }

            // Create navigation wrapper
            mCreateElement('div', {'class': 'nav'}, $foldersList[0]);
        }

        /**
         * Render Show Empty screen
         * @returns {void}
         */
        renderEmptyScreen() {

            this.$emptyBlock.removeClass('hidden');
            this.$contentBlock.addClass('hidden');

            // Create a backup button
            $('.desktop a', this.$emptyBlock).rebind('click.openApp', (e) => {
                e.preventDefault();
                this.addNewBackup();
            });

            // Open mobile apps page
            $('.mobile a', this.$emptyBlock).rebind('click.openMobile', (e) => {
                e.preventDefault();
                mega.redirect('mega.io', 'mobile', false, false, false);
            });
        }

        /**
         * Populate device list or show Empty screen
         * @returns {void}
         */
        populateData() {

            if (d) {
                console.log('All Backed up devices:');
                console.log(this.data);
            }

            this.$loader.addClass('hidden');

            // Show a list of devices
            if (this.data.length) {

                this.populateDevices();
            }
            // Or show Empty screen
            else {

                this.renderEmptyScreen();
            }

            // Init pages navigator if needed
            this.initEvents();
        }

        /**
         * Render/rerender Backups content
         * @param {Boolean} [force] True to update data without time limit
         * @returns {Promise}
         */
        async renderContent(force) {

            if (M.currentdirid !== 'devices' || !force && this.lastupdate > Date.now() - 10000) {
                return false;
            }

            await this.getDevicesData();
            await this.getData();
            await this.getStoppedBackups();
            this.populateData();

            delay('devices:update', () => this.renderContent().catch(dump), 30000);

            if (!this.bpcListener) {
                this.bpcListener = mBroadcaster.addListener('beforepagechange', (page) => {

                    if (page.includes('devices')) {
                        return;
                    }

                    delay.cancel('devices:update');
                    this.lastupdate = 0;
                    this.selectedSync = false;
                    mBroadcaster.removeListener(this.bpcListener);
                    delete this.bpcListener;
                });
            }
        }

        /**
         * Update and render Backups content or show Empty block when BC is opened
         * @returns {void}
         */
        async render() {

            // Hide both Content and Empty screen till we get any data
            this.$emptyBlock.addClass('hidden');
            this.$contentBlock.addClass('hidden');
            this.$loader.removeClass('hidden');

            // Rended Content or Empty screen
            await this.renderContent().catch(dump);
        }

        /**
         * Show Backup Center section
         * @returns {void}
         */
        openSection() {

            // Prevent ephemeral session to access
            if (u_type === 0) {

                msgDialog('confirmation', l[998], `${l[17146]} ${l[999]}`, l[1000], (e) => {
                    if (e) {
                        loadSubPage('register');
                        return false;
                    }
                    loadSubPage('fm');
                });

                return false;
            }

            // Show devices section and hide rest
            $('.fm-right-block, .fm-right-files-block, .section.conversations,'
                + '.fm-right-account-block', '.fmholder').addClass('hidden');
            this.$backupWrapper.removeClass('hidden');

            // Render left tree pane
            M.onSectionUIOpen('devices');
            this.$leftPaneBtns.removeClass('active');
            this.$leftPaneBtns.filter('.devices').addClass('active');

            M.initShortcutsAndSelection(this.$backupWrapper);

            // Update and render Devices content or show Empty block
            this.render();
        }

        /**
         * Show Backup folder in BC
         * @param {String} h Backup folder handle
         * @returns {void}
         */
        showFolder(h) {

            if (!h || M.getNodeRoot(h) !== M.InboxID) {
                return false;
            }

            const node = M.d[h];
            let id = node.devid || node.drvid;
            let backupHandle = '';
            this.scrollToSelected = true;

            if (!id && node.h !== M.BackupsId) {

                const path = M.getPath(node.h);

                for (i = 0; i < path.length; i++) {

                    const {p} = M.d[path[i]];

                    id = M.d[p].devid || M.d[p].drvid;

                    if (id) {
                        backupHandle = path[i];
                        break;
                    }
                }
            }

            if (id) {
                this.deviceCardStates[id] = {
                    'expanded': 'expanded',
                    'selected': 'active '
                };
            }

            if (backupHandle) {
                this.selectedSync = {
                    'id': backupHandle
                };
            }

            M.openFolder('devices', true);
        }

        ackVaultWriteAccess(h, req) {
            if (h && this.selectedSync.nodeHandle === h) {
                assert(req.a === 'm' || req.a === 'a' || req.a === 'd');
                req.vw = 1;
            }
            else if (d) {
                console.error('Unexpected Vault-write attempt.', h, req);
            }
        }
    };
});

function dashboardUI(updProcess) {
    "use strict";

    // Prevent ephemeral session to access dashboard via url
    if (u_type === 0) {
        msgDialog('confirmation', l[998], l[17146]
             + ' ' + l[999], l[1000], function(e) {
            if (e) {
                loadSubPage('register');
                return false;
            }
            loadSubPage('fm');
        });

        return false;
    }

    updProcess = updProcess || false;

    if (!updProcess) {
        loadingDialog.show('loadDashboard');
    }

    $('.fm-right-files-block, .section.conversations, .fm-right-account-block').addClass('hidden');
    $('.fm-right-block.dashboard').removeClass('hidden');

    // Hide backup widget is user already saved recovery key before
    if (localStorage.recoverykey) {
        $('.account.widget.recovery-key').addClass('hidden');
    }
    else {
        $('.account.widget.recovery-key').removeClass('hidden');
    }

    M.onSectionUIOpen('dashboard');

    // If Business or Pro Flexi, show the Business dashboard
    if (u_attr && (u_attr.b || u_attr.pf)) {

        $('.fm-right-block.dashboard .non-business-dashboard').addClass('hidden');
        const $bsnDashboard = $('.fm-right-block.dashboard .business-dashboard').removeClass('hidden');

        // If Business master account and not expired
        if (u_attr.b && u_attr.b.m && u_attr.b.s !== pro.ACCOUNT_STATUS_EXPIRED) {
            $('.overall-usage-container', $bsnDashboard).addClass('admin');
            $('.subaccount-view-used-data .view-title span', $bsnDashboard).text(l.bsn_pers_usage);
        }

        // If Business expired/grace period or sub user account
        if (u_attr.b && (u_attr.b.s !== pro.ACCOUNT_STATUS_ENABLED || !u_attr.b.m)) {
            $('.left-pane.small-txt.plan-date-info', '.dashboard').addClass('hidden');
            $('.left-pane.big-txt.plan-date-val', '.dashboard').addClass('hidden');
        }

        // If Pro Flexi, show admin overall usage container (and keep Data heading, not Personal usage data)
        if (u_attr.pf) {
            $('.overall-usage-container', $bsnDashboard).addClass('admin');
        }

        // If Pro Flexi expired/grace period
        if (u_attr.pf && (u_attr.pf.s !== pro.ACCOUNT_STATUS_ENABLED)) {
            $('.left-pane.small-txt.plan-date-info', '.dashboard').addClass('hidden');
            $('.left-pane.big-txt.plan-date-val', '.dashboard').addClass('hidden');
        }
    }
    else {
        // Show regular dashboard
        $('.fm-right-block.dashboard .non-business-dashboard').removeClass('hidden');
        $('.fm-right-block.dashboard .business-dashboard').addClass('hidden');
    }

    // Avatar dialog
    $('.fm-account-avatar').rebind('click', function(e) {
        avatarDialog();
    });

    // Data plus, upload file
    $('.non-business-dashboard button.upload-file, .business-dashboard button.upload-file').rebind('click', function() {
        $('.fm-file-upload input').trigger('click');
        return false;
    });

    // Space-widget clickable sections
    $('.account.widget.storage .pr-item')
        .rebind('click', function() {
            var section = String($(this).attr('class')).replace(/account|pr-item|empty|ui-droppable/g, '').trim();
            if (section.indexOf('cloud-drive') !== -1) {
                section = M.RootID;
            }
            else if (section.indexOf('rubbish-bin') !== -1) {
                section = M.RubbishID;
            }
            else if (section.indexOf('incoming-shares') !== -1) {
                section = 'shares';
            }
            else if (section.indexOf('backups') !== -1) {

                section = M.BackupsId;
            }
            else if (section.indexOf('versions') === -1) {
                section = null;
            }
            else {
                section = 'account/file-management';
            }

            if (section) {
                M.openFolder(section);
            }

            return false;
        });

    // Account data
    /* eslint-disable-next-line complexity */
    M.accountData(function(account) {

        if (!updProcess) {
            loadingDialog.hide('loadDashboard');
        }
        accountUI.general.userUIUpdate();

        // Display welcome message
        if (u_attr.firstname) {
            const $welcome = $('.dashboard .welcome-message-banner').removeClass('hidden');
            $('.message', $welcome).text(l[24930].replace('$1', u_attr.firstname));
        }

        // If Pro Flexi, or Business master user (and not status expired), render the
        // storage and transfer analytics graphs on the admin user's dashboard page
        if (u_attr.pf || (u_attr.b && u_attr.b.m && u_attr.b.s !== pro.ACCOUNT_STATUS_EXPIRED)) {

            // Make sure the files are loaded
            M.require('businessAcc_js', 'businessAccUI_js').done(() => {

                const business = new BusinessAccountUI();
                business.viewAdminDashboardAnalysisUI();
            });
        }

        // Show balance
        $('.account.left-pane.balance-info').text(l[7108]);
        $('.account.left-pane.balance-txt').safeHTML('@@ &euro; ', account.balance[0][0]);

        $('.fm-account-blocks.storage, .fm-account-blocks.bandwidth').removeClass('exceeded going-out');

        // Achievements Widget
        if (account.maf && !u_attr.b) {
            $('.fm-right-block.dashboard').addClass('active-achievements');
            var $achWidget = $('.account.widget.achievements');
            var maf = M.maf;
            var $storage = $('.account.bonuses-size.storage', $achWidget);
            var $transfer = $('.account.bonuses-size.transfers', $achWidget);
            var storageCurrentValue = maf.storage.current /*+ maf.storage.base*/;
            var transferCurrentValue = maf.transfer.current /*+ maf.transfer.base*/;

            $storage.text(bytesToSize(storageCurrentValue, 0));
            $transfer.text(bytesToSize(transferCurrentValue, 0));

            $('.more-bonuses', $achWidget).rebind('click', function() {
                mega.achievem.achievementsListDialog();
            });
        }
        else {
            $('.fm-right-block.dashboard').removeClass('active-achievements');
        }

        if (!updProcess) {
            // Only render the referral program widget if loading the dashboard page UI initially
            dashboardUI.renderReferralWidget();
        }

        // Elements for free/pro accounts. Expires date / Registration date
        if (u_attr.p || (u_attr.b && u_attr.b.s === pro.ACCOUNT_STATUS_EXPIRED) ||
            (u_attr.pf && u_attr.pf.s === pro.ACCOUNT_STATUS_EXPIRED)) {

            var timestamp;
            // Subscription
            if (account.stype == 'S') {

                // Get the date their subscription will renew
                timestamp = account.srenew[0];

                // Display the date their subscription will renew
                if (timestamp > 0) {
                    $('.account.left-pane.plan-date-val').text(time2date(timestamp, 2));
                    $('.account.left-pane.plan-date-info').text(l[20154]);
                }
                else {
                    // Otherwise hide info blocks
                    $('.account.left-pane.plan-date-val, .account.left-pane.plan-date-info').addClass('hidden');
                }
            }
            else if (account.stype == 'O') {
                const planExpiryString = pro.filter.simple.miniPlans.has(u_attr.p)
                    ? l.plan_expires_on
                    : l[20153];
                // one-time or cancelled subscription
                $('.account.left-pane.plan-date-val').text(time2date(account.expiry, 2));

                // If user has nextplan, show infomative tooltip
                if (account.nextplan) {
                    $('.account.left-pane.plan-date-info').safeHTML(escapeHTML(planExpiryString) +
                        '<div class="sprite-fm-mono icon-info-filled simpletip" ' +
                        'data-simpletip-class="center-align medium-width" data-simpletip="' +
                        escapeHTML(l[20965]) + '"></div>');
                }
                else if (u_attr.b && u_attr.b.m) {
                    $('.account.left-pane.plan-date-info').text(l[987]);
                }
                else {
                    $('.account.left-pane.plan-date-info').text(planExpiryString);
                }
            }

            // If active/grace/expired Business or Pro Flexi expired status
            if ((u_attr.b) || (u_attr.pf && u_attr.pf.s === pro.ACCOUNT_STATUS_EXPIRED)) {

                // someone modified the CSS to overwirte the hidden class !!, therefore .hide() will be used
                $('.account.left-pane.reg-date-info, .account.left-pane.reg-date-val').addClass('hidden').hide();
                var $businessLeft = $('.account.left-pane.info-block.business-users').removeClass('hidden');

                if (u_attr.b && u_attr.b.s === pro.ACCOUNT_STATUS_ENABLED) {
                    $businessLeft.find('.suba-status').addClass('active').removeClass('disabled pending')
                        .text(l[7666]);
                }
                else if (u_attr.b && u_attr.b.s === pro.ACCOUNT_STATUS_GRACE_PERIOD && u_attr.b.m) {
                    $('.suba-status', $businessLeft).addClass('pending').removeClass('disabled active')
                        .text(l[19609]);
                    if (u_attr.b.sts && u_attr.b.sts[0] && u_attr.b.sts[0].s === -1) {
                        const expiryDate = new Date(u_attr.b.sts[0].ts * 1000);
                        const currentTime = new Date();
                        let remainingDays = Math.floor((expiryDate - currentTime) / 864e5);
                        remainingDays = remainingDays < 0 ? 0 : remainingDays;
                        const daysLeft = mega.icu.format(l[16284], remainingDays);
                        $('.suba-days-left', $businessLeft).removeClass('hidden').text(daysLeft);
                        $('.suba-pay-bill', $businessLeft).removeClass('hidden');
                    }
                }
                else {
                    $('.suba-status', $businessLeft).addClass('disabled').removeClass('pending active')
                        .text(l[19608]);

                    if (u_attr.b && u_attr.b.m) {
                        $('.suba-pay-bill', $businessLeft).removeClass('hidden');
                    }
                }

                // For Pro Flexi, hide the Role block
                if (u_attr.pf) {
                    $('.suba-role', $businessLeft).parent().addClass('hidden');
                }

                // Otherwise for Business Master and User show the Role block
                if (u_attr.b && u_attr.b.m) {
                    $('.suba-role', $businessLeft).text(l[19610]); // Administrator
                }
                else {
                    $('.suba-role', $businessLeft).text(l[5568]); // User
                }

                if (u_attr.b && (u_attr.b.s !== pro.ACCOUNT_STATUS_ENABLED || !u_attr.b.m)) {
                    $('.left-pane.small-txt.plan-date-info', '.dashboard').addClass('hidden');
                    $('.left-pane.big-txt.plan-date-val', '.dashboard').addClass('hidden');
                }

                var $businessDashboard = $('.fm-right-block.dashboard .business-dashboard').removeClass('hidden');
                $('.fm-right-block.dashboard .non-business-dashboard').addClass('hidden');
            }
        }
        else {
            // resetting things might be changed in business account
            $('.fm-right-block.dashboard .business-dashboard').addClass('hidden');
            $('.account.left-pane.info-block.business-users').addClass('hidden');
            $('.account.left-pane.reg-date-info, .account.left-pane.reg-date-val').removeClass('hidden').show();
            $('.fm-right-block.dashboard .non-business-dashboard').removeClass('hidden');
        }

        /* Registration date, bandwidth notification link */
        $('.upgrade-to-pro, .pay-bill-btn', '.dashboard').rebind('click.dboard', function() {
            if (u_attr && u_attr.b && u_attr.b.m && (u_attr.b.s === -1 || u_attr.b.s === 2)) {
                loadSubPage('repay');
            }
            else {
                loadSubPage('pro');
            }
        });

        $('.account.left-pane.reg-date-info').text(l[16128]);
        $('.account.left-pane.reg-date-val').text(time2date(u_attr.since, 2));

        const mBackupsNode = M.getNodeByHandle(M.BackupsId);

        // If not Business or Pro Flexi (i.e. regular account)
        if (!u_attr.b && !u_attr.pf) {

            accountUI.general.charts.init(account);

            /* Used Storage */
            var percents = [
                100 * account.stats[M.RootID].bytes / account.space,
                100 * account.stats[M.RubbishID].bytes / account.space,
                100 * (mBackupsNode.tb / account.space || 0),
                100 * account.stats[M.RootID].vbytes / account.space,
                Math.max(100 * (account.space - account.space_used) / account.space, 0),
            ];
            for (let i = 0; i < percents.length; i++) {
                const $percBlock = $('.storage .account.progress-perc.pr' + i);
                $percBlock.safeHTML(`<span class="value">${Math.round(percents[i])}</span><span class="unit">%</span>`);
                const $percBar = $('.storage .account.progress-bar-section.pr' + i);
                $percBar.css('width', percents[i] + '%');
            }

            // Cloud drive
            $('.account.progress-size.cloud-drive').text(
                `(${bytesToSize(account.stats[M.RootID].bytes)})`
            );
            // Rubbish bin
            $('.account.progress-size.rubbish-bin').text(
                `(${bytesToSize(account.stats[M.RubbishID].bytes)})`
            );

            if (mBackupsNode) {
                $('.account.progress-size.backups').text(`(${bytesToSize(mBackupsNode.tb)})`);
                $('.js-backups-el', '.non-business-dashboard').removeClass('hidden');
            }
            else {
                $('.js-backups-el', '.non-business-dashboard').addClass('hidden');
            }

            // Available
            $('.account.progress-size.available').text(
                `(${bytesToSize(Math.max(account.space - account.space_used, 0))})`
            );
            // Versions
            $('.account.progress-size.versions').text(
                `(${bytesToSize(account.stats[M.RootID].vbytes)})`
            );
            /* End of Used Storage */

            /* hide/show quota warning banner */
            const quotaBanner = document.querySelector('.non-business-dashboard .account.quota-alert-banner');
            if (quotaBanner) {
                if (account.isFull) {
                    quotaBanner.textContent = l[24973];
                    quotaBanner.classList.remove('hidden', 'warning');
                    quotaBanner.classList.add('error');
                }
                else if (account.isAlmostFull) {
                    quotaBanner.textContent = l[24974];
                    quotaBanner.classList.remove('hidden', 'error');
                    quotaBanner.classList.add('warning');
                }
                else {
                    quotaBanner.classList.add('hidden');
                }
            }

            if (u_attr.p) {
                $('.account.widget.bandwidth').addClass('enabled-pr-bar');
                $('.dashboard .account.learn-more.right').addClass('hidden');
            }
            else {

                // Show available bandwith for FREE accounts with enabled achievements
                if (account.tfsq.ach) {
                    $('.account.widget.bandwidth').addClass('enabled-pr-bar');
                }
                else {
                    $('.account.widget.bandwidth').removeClass('enabled-pr-bar');
                }

                $('.dashboard .account.learn-more.right').removeClass('hidden');
                $('.dashboard .account.learn-more.right').rebind('click', function() {
                    var $dropDownItem = $('.dropdown', $(this));
                    if ($dropDownItem.hasClass('hidden')) {
                        $dropDownItem.removeClass('hidden');
                    }
                    else {
                        $dropDownItem.addClass('hidden');
                    }
                });

                // Get more transfer quota button
                $('.account.widget.bandwidth .free .more-quota').rebind('click', function() {
                    loadSubPage('pro');
                    return false;
                });
            }

            if (account.tfsq.used > 0 || Object(u_attr).p || account.tfsq.ach) {
                $('.account.widget.bandwidth').removeClass('hidden');
                $('.fm-account-blocks.bandwidth.right').removeClass('hidden');
                $('.bandwidth .account.progress-size.base-quota').text(bytesToSize(account.tfsq.used, 0));
            }
            else {
                $('.account.widget.bandwidth').addClass('hidden');
                $('.fm-account-blocks.bandwidth.right').addClass('hidden');
            }

            /* End of Used Bandwidth progressbar */

            // Fill Cloud data widget
            dashboardUI.updateCloudDataWidget();
        }
        else {
            // Business or Pro Flexi
            // Debug code ...
            if (d && localStorage.debugNewPrice) {
                account.space_bus_base = 3;
                account.space_bus_ext = 2;
                account.tfsq_bus_base = 3;
                account.tfsq_bus_ext = 1;
                account.tfsq_bus_used = 3848290697216; // 3.5 TB
                account.space_bus_used = 4617948836659; // 4.2 TB
            }
            // END Debug code

            const $storageBlk = $('.business-dashboard .user-management-storage');
            const $transferBlk = $('.business-dashboard .user-management-transfer');
            const $storageBaseBlk = $('.storage-transfer-data-details-base', $storageBlk);
            const $transferBaseBlk = $('.storage-transfer-data-details-base', $transferBlk);
            const $storageExtBlk = $('.storage-transfer-data-details-ext', $storageBlk);
            const $transferExtBlk = $('.storage-transfer-data-details-ext', $transferBlk);

            $('.storage-transfer-data, .storage-transfer-current', $storageBlk)
                .text(bytesToSize(account.space_bus_used || account.space_used, 2));
            $('.storage-transfer-data, .storage-transfer-current', $transferBlk)
                .text(bytesToSize(account.tfsq_bus_used || account.tfsq.used, 2));

            $('.storage-transfer-data', $storageExtBlk).text(l[5816].replace('[X]', 0));
            $('.storage-transfer-data', $transferExtBlk).text(l[5816].replace('[X]', 0));

            // If Pro Flexi or Business master account
            if (u_attr.pf || (u_attr.b && u_attr.b.m)) {

                $storageExtBlk.removeClass('hidden');
                $transferExtBlk.removeClass('hidden');
                $('.view-info .storage-transfer-current', $storageBlk).removeClass('hidden');
                $('.view-info .storage-transfer-current', $transferBlk).removeClass('hidden');
                $('.storage-transfer-data-base-head', $storageBlk).removeClass('hidden');
                $('.storage-transfer-data-base-head', $transferBlk).removeClass('hidden');

                if (account.space_bus_base) {
                    $('.storage-transfer-data', $storageBaseBlk)
                        .text(l[5816].replace('[X]', account.space_bus_base));
                    if (account.space_bus_ext) {
                        $('.storage-transfer-data', $storageExtBlk).text(l[5816].replace('[X]', account.space_bus_ext));
                    }
                }
                if (account.tfsq_bus_base) {
                    $('.storage-transfer-data', $transferBaseBlk)
                        .text(l[5816].replace('[X]', account.tfsq_bus_base));
                    if (account.tfsq_bus_ext) {
                        $('.storage-transfer-data', $transferExtBlk).text(l[5816].replace('[X]', account.tfsq_bus_ext));
                    }
                }
            }

            var $dataStats = $('.business-dashboard .subaccount-view-used-data');

            var ffNumText = function(value, type) {
                var counter = value || 0;
                return mega.icu.format(type === 'file' ? l.file_count : l.folder_count, counter);
            };

            const rubbishSize = account.stats[M.RubbishID].bytes;

            var folderNumText = ffNumText(account.stats[M.RootID].folders, 'folder');
            var fileNumText = ffNumText(account.stats[M.RootID].files, 'file');
            $('.ba-root .ff-occupy', $dataStats).text(bytesToSize(account.stats[M.RootID].bytes, 2));
            $('.ba-root .folder-number', $dataStats).text(folderNumText);
            $('.ba-root .file-number', $dataStats).text(fileNumText);

            folderNumText = ffNumText(account.stats.inshares.items, 'folder');
            fileNumText = ffNumText(account.stats.inshares.files, 'file');
            $('.ba-inshare .ff-occupy', $dataStats).text(bytesToSize(account.stats.inshares.bytes, 2));
            $('.ba-inshare .folder-number', $dataStats).text(folderNumText);
            $('.ba-inshare .file-number', $dataStats).text(fileNumText);

            folderNumText = ffNumText(account.stats.outshares.items, 'folder');
            fileNumText = ffNumText(account.stats.outshares.files, 'file');
            $('.ba-outshare .ff-occupy', $dataStats).text(bytesToSize(account.stats.outshares.bytes, 2));
            $('.ba-outshare .folder-number', $dataStats).text(folderNumText);
            $('.ba-outshare .file-number', $dataStats).text(fileNumText);

            folderNumText = ffNumText(account.stats[M.RubbishID].folders, 'folder');
            fileNumText = ffNumText(account.stats[M.RubbishID].files, 'file');
            $('.ba-rubbish .ff-occupy', $dataStats).text(bytesToSize(rubbishSize, 2));
            $('.ba-rubbish .folder-number', $dataStats).text(folderNumText);
            $('.ba-rubbish .file-number', $dataStats).text(fileNumText);

            folderNumText = ffNumText(account.stats.links.folders, 'folder');
            fileNumText = ffNumText(account.stats.links.files, 'file');
            $('.ba-pub-links .ff-occupy', $dataStats).text(bytesToSize(account.stats.links.bytes, 2));
            $('.ba-pub-links .folder-number', $dataStats).text(folderNumText);
            $('.ba-pub-links .file-number', $dataStats).text(fileNumText);

            if (mBackupsNode) {
                $('.js-backups-el', '.business-dashboard').removeClass('hidden');

                fileNumText = ffNumText(mBackupsNode.tf | 0, 'file');
                folderNumText = ffNumText(mBackupsNode.td | 0, 'folder');
                $('.ba-backups .ff-occupy', $dataStats).text(bytesToSize(mBackupsNode.tb, 2));
                $('.ba-backups .folder-number', $dataStats).text(folderNumText);
                $('.ba-backups .file-number', $dataStats).text(fileNumText);
            }
            else {
                $('.js-backups-el', '.business-dashboard').addClass('hidden');
            }

            if (rubbishSize > 0) {
                $('.ba-rubbish', $dataStats).removeClass('empty');
            }
            else {
                $('.ba-rubbish', $dataStats).addClass('empty');
            }

            var verFiles = 0;
            var verBytes = 0;
            verFiles = account.stats[M.RootID]['vfiles'];
            verBytes = account.stats[M.RootID]['vbytes'];
            // for (var k in account.stats) {
            //    if (account.stats[k]['vfiles']) {
            //        verFiles += account.stats[k]['vfiles'];
            //    }
            //    if (account.stats[k]['vbytes']) {
            //        verBytes += account.stats[k]['vbytes'];
            //    }
            // }

            $('.ba-version .versioning-settings').rebind('click', function() {
                loadSubPage('fm/account/file-management');
            });

            $('.business-dashboard .used-storage-info.ba-pub-links').rebind('click.suba', function() {
                loadSubPage('fm/links');
            });

            fileNumText = ffNumText(verFiles, 'file');
            $('.ba-version .ff-occupy', $dataStats).text(bytesToSize(verBytes));
            $('.ba-version .file-number', $dataStats).text(fileNumText);
        }

        // if this is a business account user (sub or master)
        // if (u_attr.b) {
        //    $('.account.widget.bandwidth').addClass('hidden');
        //    $('.account.widget.body.achievements').addClass('hidden');
        // }

        $.tresizer();
        initTreeScroll();

        // Init the dashboard content scroll, after we've fetched account data (in MEGA Lite this takes longer)
        if (mega.lite.inLiteMode) {
            initDashboardScroll();
        }

        // Button on dashboard to backup their master key
        $('.dashboard .backup-master-key').rebind('click', function() {
            M.showRecoveryKeyDialog(2);
        });
    });
}
dashboardUI.renderReferralWidget = function() {
    "use strict";

    // Referrals Widget
    if (mega.flags.refpr) {
        M.affiliate.getBalance().then(() => {
            let prefix = '.non-business-dashboard ';

            // If Business or Pro Flexi, use the business-dashboard parent selector
            if (u_attr.b || u_attr.pf) {
                prefix = '.business-dashboard ';
            }

            const $referralWidget = $(prefix + '.account.widget.referrals');
            const balance = M.affiliate.balance;
            var localCurrency;
            var localTotal;
            var localAvailable;

            if (balance) {
                localCurrency = balance.localCurrency;

                $referralWidget.removeClass('hidden');

                if (localCurrency === 'EUR') {
                    localTotal = formatCurrency(balance.localTotal);
                    localAvailable = formatCurrency(balance.localAvailable);

                    $('.euro', $referralWidget).addClass('hidden');
                }
                else {
                    localTotal = formatCurrency(balance.localTotal, localCurrency, 'number');
                    localAvailable = formatCurrency(balance.localAvailable, localCurrency, 'number');

                    $('.euro', $referralWidget).removeClass('hidden');
                    $('.referral-value.local .currency', $referralWidget).text(localCurrency);
                    $('.referral-value.total.euro', $referralWidget)
                        .text(formatCurrency(balance.pending + balance.available));
                    $('.referral-value.available.euro', $referralWidget).text(formatCurrency(balance.available));
                }

                $('.referral-value.total.local .value', $referralWidget)
                    .text(localTotal);
                $('.referral-value.available.local .value', $referralWidget)
                    .text(localAvailable);

                // Referral widget button
                $('button.referral-program', $referralWidget).rebind('click.refer', () => {
                    loadSubPage('/fm/refer');
                });
            }
        }).catch(ex => {
            if (d) {
                console.error('Update affiliate data failed: ', ex);
            }
        });
    }
};

dashboardUI.updateCloudDataWidget = function() {
    const files = l.file_count;
    const folders = l.folder_count;
    const data = M.getDashboardData();
    const locale = [files, folders, files, folders, folders, folders, folders];
    const map = ['files', 'folders', 'rubbish', 'ishares', 'oshares', 'backups', 'links', 'versions'];

    $('.data-item .links-s').rebind('click', function() {
        loadSubPage('fm/public-links');
        return false;
    });

    $('.data-item .rubbish-bin-dashboard').rebind('click', function() {
        loadSubPage('fm/' + M.RubbishID);
        return false;
    });

    $('.data-item .incoming').rebind('click', function() {
        loadSubPage('fm/shares');
        return false;
    });

    $('.data-item .outgoing').rebind('click', function() {
        loadSubPage('fm/out-shares');
        return false;
    });

    $('.backups', '.data-item').rebind('click.openBC', () => {

        if (!M.BackupsId) {
            return false;
        }
        M.openFolder(M.BackupsId);
        return false;
    });

    $('.account.data-item .versioning-settings').rebind('click', function() {
        loadSubPage('fm/account/file-management');
    });

    $('.data-item:not(.used-storage-info)', '.account.data-table.data')
        .each(function(idx, elm) {
            const props = data[map[idx]];
            let {cnt, xfiles, size} = props;

            let str = idx < 7 ? mega.icu.format(locale[idx], cnt, true) : cnt;

            if (props.xfiles > 0) {
                str += `, ${mega.icu.format(files, xfiles, true)}`;
            }

            elm.children[1].textContent = str;
            if (props.cnt > 0) {
                elm.children[2].textContent = bytesToSize(size);
                $(elm).removeClass('empty');
                $('.account.data-item .versioning-settings').show();
            }
            else {
                elm.children[2].textContent = '-';
                $(elm).addClass('empty');
                $('.account.data-item .versioning-settings').hide();
            }
        });
};
dashboardUI.prototype = undefined;
Object.freeze(dashboardUI);

/**
 * Function to init custom block scrolling
 * @param {Object} $scrollBlock optional custom block selector.
 */
function initDashboardScroll() {
    "use strict";

    var $scrollBlock = $('.fm-right-block.dashboard', '.fm-main');

    if (!$scrollBlock.length) {
        return false;
    }

    if ($scrollBlock.is('.ps')) {
        Ps.update($scrollBlock[0]);
    }
    else {
        Ps.initialize($scrollBlock[0]);
    }
}

/* exported openRecents */
/* exported renderRecents */

/**
 * Trigger open recents with all default values.
 * (Ignore any passed arguments).
 *
 */
function openRecents() {
    'use strict';
    renderRecents();
}

/**
 * Render recents interface.
 * @param limit Node Limit
 * @param until Unix timestamp until.
 */
function renderRecents(limit, until) {
    'use strict';
    console.log("renderRecents:", limit, until);
    if (!M.recentsRender) {
        M.recentsRender = new RecentsRender();
    }
    M.recentsRender.render(limit, until);
}

/**
 * Recents Render Controller.
 * @constructor
 */
function RecentsRender() {
    'use strict';
    this.$container = $(".fm-recents.container");
    this.container = this.$container[0];
    this.$scrollDiv = this.$container.find(".fm-recents.scroll");
    this.scrollDiv = this.$scrollDiv[0];
    this.$content = this.$container.find(".fm-recents.content");
    this.$noContent = this.$container.find(".fm-recents.no-content");
    this.$disabledContent = this.$container.find(".fm-recents.disabled-content");
    this.$buttonEnableRecents = this.$disabledContent.find("button");
    this._$titleTemplate = this.getTemplate("title-template");

    this.currentLimit = false;
    this.currentUntil = false;
    this._showRecents = this._getConfigShow();
    this._rendered = false;
    this._maxFitOnScreen = false;
    this._resizeListeners = [];

    this._renderCache = {};
    this._childIds = {};
    this._dynamicList = false;
    this._renderFunctions = {};
    this._view = [];
    this.recentActions = [];
    this.actionIdMap = {};
    this._shortTimeFormatter = new Intl.DateTimeFormat([], {
        hour: '2-digit',
        minute:'2-digit',
        hour12: false
    });
    this._fullTimeFormatter = new Intl.DateTimeFormat([], {
        hour: '2-digit',
        minute:'2-digit',
        second: '2-digit',
        hour12: false
    });
    this._expandedStates = {};

    this._initScrollPosition = false;

    // Map all nodes -> action ids.
    this._nodeActionMap = {};

    // Maps nodes -> rendered item ids (only if different than action id).
    this._nodeRenderedItemIdMap = {};

    this._actionChildren = {};

    var recentsDays = parseInt(localStorage.recentsDays) || 90;
    var recentsNodeLimit = parseInt(localStorage.recentsNodeLimit) || 10000;

    this._defaultRangeTimestamp = Math.floor((Date.now() - recentsDays * 86400000) / 1000); // 90 days
    this._defaultRangeLimit = recentsNodeLimit;

    var self = this;

    // Default click handlers
    this.$container.rebind("click contextmenu", function(e) {
        $.hideTopMenu(e);
        $.hideContextMenu(e);
        self.markSelected();
        selectionManager.clear_selection();
        return false;
    });
}

/**
 * Trigger a render init or update.
 * @param limit
 * @param until
 */
RecentsRender.prototype.render = function(limit, until, forceInit) {
    'use strict';
    var self = this;

    if (M.currentdirid !== "recents") {
        return;
    }

    // Switch to recents panel.
    M.onSectionUIOpen('recents');
    $('.fmholder').removeClass("transfer-panel-opened");
    $('.fm-right-files-block').addClass('hidden');
    $('.top-head').find(".recents-tab-link").removeClass("hidden").addClass('active');
    this.$container.removeClass('hidden');

    M.viewmode = 1;
    M.v = this._view;
    this.currentLimit = limit || this._defaultRangeLimit;
    this.currentUntil = until || this._defaultRangeTimestamp;

    if (M.megaRender) {
        // Cleanup background nodes
        M.megaRender.cleanupLayout(false, M.v);
    }

    if (this._dynamicList && !this._dynamicList.active) {
        this._dynamicList.resume();
    }

    if (!$.dialog) {
        selectionManager.clear_selection();
        this.clearSelected();
    }

    if (!this._showRecents) {
        return this._initialRender([]);
    }

    if (!this._rendered) {
        loadingDialog.show();
    }
    M.initShortcutsAndSelection(this.$container);

    M.getRecentActionsList(this.currentLimit, this.currentUntil).then(function(actions) {
        self.getMaxFitOnScreen(true);
        console.time('recents:render');
        self._injectDates(actions);
        if (!self._rendered || !self._dynamicList || forceInit) {
            self._initialRender(actions);
        }
        else {
            self._updateState(actions);
        }
        loadingDialog.hide();
        console.timeEnd('recents:render');
    });
};

/**
 * Initialise the dynamicList and render the initial view.
 * If called after already initialized, will destroy previous instance and recreate.
 * @param actions
 * @private
 */
RecentsRender.prototype._initialRender = function(actions) {
    'use strict';
    var self = this;
    if (!this._showRecents) {
        this.recentActions = actions;
        this._view = [];
        M.v = this._view;
        this.$disabledContent.removeClass('hidden');
        this.$noContent.addClass('hidden');
        this.$content.addClass('hidden');

        this.$buttonEnableRecents
            .rebind('click.enableRecents', () => this._setConfigShow(1));
    }
    else if (actions.length === 0) {
        this.recentActions = actions;
        this._view = [];
        M.v = this._view;
        this.$noContent.removeClass('hidden');
        this.$disabledContent.addClass('hidden');
        this.$content.addClass('hidden');
    } else {
        self.$noContent.addClass('hidden');
        self.$disabledContent.addClass('hidden');
        this.recentActions = actions;
        if (this._rendered) {
            this._dynamicList.destroy();
            this.reset();
        }
        this._dynamicList = new MegaDynamicList(this.scrollDiv, {
            'contentContainerClasses': 'fm-recents content',
            'initialScrollY': this._initScrollPosition,
            'itemRenderFunction': function(id) { return self._doRenderWorker(id); },
            'itemHeightCallback': function(id) { return self._getItemHeight(id); },
            'onNodeInjected': function() { return self._onNodeInjected(); },
            'onResize': function() { return self.thottledResize(); },
            'onScroll': function() { return self.onScroll(); },
            'perfectScrollOptions': {
                'handlers': ['click-rail', 'drag-thumb', 'wheel', 'touch'],
                'minScrollbarLength': 20
            },
            'viewPortBuffer': 50
        });

        this._dynamicList.getItemHeight = function(position) {
            return this._heights[this.items[position]];
        };

        this._dynamicList.getItemOffsets = function(position) {
            return this._offsets[this.items[position]];
        };

        this._dynamicList.scrollToItemPosition = function(position, toBottom) {

            var newPosition = this._offsets[this.items[position]];

            if (toBottom) {
                newPosition += this.options.viewPortBuffer * 2;
                newPosition -= this._calculated.scrollHeight - this.getItemHeight(position);
            }
            else {
                newPosition -= this.options.viewPortBuffer * 2;
            }

            this.listContainer.scrollTop = newPosition;

            this._viewChanged(true);
        };

        if (!actions[0].id) {
            this._fillActionIds(actions);
        }

        this._view = [];
        var keys = [];
        for (var i = 0; i < actions.length; i++) {
            keys.push(actions[i].id);
            this.actionIdMap[actions[i].id] = actions[i];
            if (actions[i].length && actions[i].length > 0) {
                this._view = this._view.concat(actions[i]);
                this._populateNodeActionMap(actions[i]);
            }
        }
        M.v = this._view;
        this._dynamicList.batchAdd(keys);
        this._dynamicList.initialRender();
        this._rendered = true;
        this._initScrollPosition = false;
    }
    self.previousActionCount = actions.length;
    self.previousNodeCount = actions.nodeCount;
};

RecentsRender.prototype._doRenderWorker = function(id) {
    'use strict';
    if (!this._renderCache[id]) {
        if (this._renderFunctions[id]) {
            this._renderCache[id] = this._renderFunctions[id](id);
        } else {
            var action = this.actionIdMap[id];
            if (action.type === "date") {
                var $newTitleDiv = this._$titleTemplate.clone().removeClass("template title-template");
                $newTitleDiv.text(action.date);
                this._renderCache[id] = $newTitleDiv[0];
            } else {
                this._renderCache[id] = this.generateRow(action, id)[0];
            }
        }
    }
    return this._renderCache[id];
};

RecentsRender.prototype._getItemHeight = function(id) {
    'use strict';
    var h;
    if (this._childIds[id]) {
        h = 49;
    } else if (this._renderCache[id]) {
        h = this._renderCache[id].offsetHeight;
    } else {
        var a = this.actionIdMap[id];
        if (a.type === "date") {
            h = 62;
        } else if (a.type === "media" && a.length > this.getMaxFitOnScreen()) {
            h = 254;
        } else if (a.type === "media" && a.length > 1) {
            h = 219;
        } else if (a.length > 1) {
            h = 66;
        } else {
            h = 49;
        }

    }
    return h;
};

RecentsRender.prototype._onNodeInjected = function() {
    'use strict';
    delay('thumbnails', fm_thumbnails, 200);
};

/**
 * Inject the date titles into the actions array before passing to dynamicList.
 * @private
 */
RecentsRender.prototype._injectDates = function(actions) {
    'use strict';
    var lastSeenDate = false;
    for (var i = 0; i < actions.length; i++) {
        var action = actions[i];
        if (action.date !== lastSeenDate) {
            actions.splice(i, 0, {
                type: "date",
                date: action.date,
                ts: moment.unix(action.ts).endOf('day')._d.getTime() / 1000
            });
            lastSeenDate = action.date;
        }
    }
    return actions;
};


/**
 * Mark UI elements as selected.
 * Note: Call with no arguments to clear selection.
 */
RecentsRender.prototype.markSelected = function($elms) {

    'use strict';

    this.clearSelected();
    if ($elms) {
        $elms.addClass('ui-selected');
    }
};

RecentsRender.prototype.appendSelected = function($elms) {

    'use strict';

    $elms.addClass('ui-selected');
};

RecentsRender.prototype.clearSelected = function() {
    'use strict';
    this.$container.find('.ui-selected').removeClass('ui-selected');
};

RecentsRender.prototype.keySelectPrevNext = function(dir, shift) {

    'use strict';

    var $selectedAction = $('.MegaDynamicListItem.ui-selected', this.$container);
    var $selectedFile = $('.data-block-view.ui-selected', $selectedAction);

    if (!$selectedFile.length) {
        return false;
    }

    var $nextFileToSelect = $selectedFile[dir < 0 ? 'prev' : 'next']()[dir < 0 ? 'first' : 'last']();

    if ($nextFileToSelect.length) {

        var nextNodeId = $nextFileToSelect.prop('id');

        if (shift) {
            this.appendSelected($nextFileToSelect);
            if ($.selected && !$.selected.includes(nextNodeId)) {
                $.selected.push(nextNodeId);
            }
        }
        else {
            this.markSelected($nextFileToSelect.add($nextFileToSelect.parents('.MegaDynamicListItem')));
            $.selected = [nextNodeId];
        }
        mega.ui.mInfoPanel.reRenderIfVisible($.selected);
    }
};

RecentsRender.prototype.keySelectUpDown = function(dir, shift) {

    'use strict';

    var $selectedAction = $('.MegaDynamicListItem.ui-selected', this.$container);

    var _getNextToSelect = function() {

        var $action;

        if (dir < 0) {

            $action = $selectedAction.first().prev();
            $action = $action.hasClass('date') ? $action.prev() : $action;
        }
        else {
            $action = $selectedAction.last().next();
            $action = $action.hasClass('date') ? $action.next() : $action;
        }

        return $action;
    };

    var $nextActionToSelect = _getNextToSelect();

    if ($nextActionToSelect.hasClass('pre-pusher')) {

        var currentItemIndex = this._dynamicList.items.indexOf($selectedAction.data('action'));

        this._dynamicList.scrollToItemPosition(--currentItemIndex);
    }

    var nextID = $nextActionToSelect.prop('id');

    nextID = nextID || $('.data-block-view', $nextActionToSelect).first().prop('id');

    if (!nextID) {
        return false;
    }

    var $nextItem = $(`#${nextID}`);

    if (shift) {

        this.appendSelected($nextItem.add($nextActionToSelect));
        if ($.selected && !$.selected.includes(nextID)) {
            $.selected.push(nextID);
        }
    }
    else {
        this.markSelected($nextItem);

        if ($nextItem.hasClass('data-block-view')) {
            this.appendSelected($nextItem.parents('.MegaDynamicListItem'));
        }
        $.selected = [nextID];
    }
    mega.ui.mInfoPanel.reRenderIfVisible($.selected);

    var itemIndex = this._dynamicList.items.indexOf($nextActionToSelect.data('action'));

    if (dir < 0 && this._dynamicList.getScrollTop() >= this._dynamicList.getItemOffsets(itemIndex)) {
        this._dynamicList.scrollToItemPosition(itemIndex);
    }
    else if (dir > 0 && this._dynamicList.getScrollTop() + this._dynamicList.listContainer.offsetHeight <=
        this._dynamicList.getItemOffsets(itemIndex) + this._dynamicList.getItemHeight(itemIndex)) {
        this._dynamicList.scrollToItemPosition(itemIndex, true);
    }
};

/**
 * Generate a breadcrumb based off array of partPart (or node) objects.
 * @param $container
 * @param action
 */
RecentsRender.prototype.populateBreadCrumb = function($container, action) {
    'use strict';
    var self = this;
    var newBreadCrumb = function(node) {
        var $breadCrumb = $('<span/>');
        $breadCrumb
            .attr('id', node.h)
            .text(node.name)
            .rebind('click dblclick', function () {
                M.openFolder(node.h);
                return false;
            })
            .rebind("contextmenu", function(e) {
                self.markSelected($breadCrumb.add($breadCrumb.closest('.content-row')));
                selectionManager.clear_selection();
                selectionManager.add_to_selection(node.h);
                $.hideTopMenu();
                return M.contextMenuUI(e, 1) ? true : false;
            });
        return $breadCrumb;
    };

    var getActionUserString = function(isOtherUser, isCreated) {
        var actionUserString = '<span>';
        if (isOtherUser) {
            actionUserString += isCreated ? l[19937] : l[19940];
            actionUserString = actionUserString
                .replace("%3", '<span class="link action-user-name"></span>');
        }
        else {
            actionUserString += isCreated ? l[24769] : l[24770];
        }
        actionUserString = actionUserString.replace("%1", '<span class="dot-separator">&#183;</span>');

        return actionUserString + '</span>';
    };

    if (!action || !Array.isArray(action.path) || !action.path.length) {
        // FIXME: check out where this does originates...
        console.warn('Invalid parameters, cannot render breadcrumb...', action);
        return;
    }

    var iconFolderType = 'icon-folder';
    if (action.inshare) {
        iconFolderType = "icon-folder-incoming-share";
    }
    else if (action.outshare) {
        iconFolderType = "icon-folder-outgoing-share";
    }
    $container.safeAppend('<i class="js-path-icon sprite-fm-mono ' + iconFolderType + '"></i>');

    var pathTooltip = '';
    for (var k = action.path.length; k--;) {
        pathTooltip += action.path[k].name;
        if (k >= 1) {
            pathTooltip += '[I class="sprite-fm-mono icon-arrow-right"][/I]';
        }
    }

    $container.append(newBreadCrumb(action.path[0]));
    $('span', $container).addClass('link parent-folder-name simpletip').attr({
        "data-simpletip": pathTooltip,
        "data-simpletip-class": "recents-file-path",
        "data-simpletipposition": "top"
    });

    $container.safeAppend(getActionUserString(action.user !== u_handle, action.action === "added"));
};

/**
 * Populate, enable and attach event listeners to the `by <name>` parts of the template.
 * @param $newRow
 * @param action
 */
RecentsRender.prototype.handleByUserHandle = function($newRow, action) {
    'use strict';
    var self = this;
    var user = M.getUserByHandle(action.user);
    var $userNameContainer = $(".breadcrumbs .action-user-name", $newRow);

    $userNameContainer
        .removeClass("hidden")
        .text(M.getNameByHandle(action.user) || l[24061])

    if (!user.h) {
        // unknown/deleted contact, no business here...
        return;
    }
    $userNameContainer
        .attr('id', user.h)
        .rebind("contextmenu", function(e) {
            self.markSelected($userNameContainer.add($newRow));
            selectionManager.clear_selection();
            selectionManager.add_to_selection(user.h);
            $.hideTopMenu();
            return M.contextMenuUI(e, 1) ? true : false;
        })
        .rebind("click", function(e) {
            $userNameContainer.trigger({
                type: 'contextmenu',
                originalEvent: e.originalEvent
            });
            return false;
        })
        .rebind("dblclick", function() {
            if (user.h) {
                M.openFolder(user.h);
            }
            return false;
        });
};

/**
 * Handle In/Out share actions for a new row
 * @param $newRow
 * @param action
 */
RecentsRender.prototype.handleInOutShareState = function($newRow, action) {
    'use strict';

    $('.js-path-icon', $newRow)
        .removeClass('hidden icon-folder icon-folder-outgoing-share icon-folder-incoming-share')
        .addClass(action.outshare ? 'icon-folder-outgoing-share' : 'icon-folder-incoming-share');
    $('.in-out-tooltip span', $newRow)
        .text(action.outshare ? l[5543] : l[5542]);
};

/**
 * Get the max number of image thumbs that will fit on the screen horizontally.
 * @param force Calulation is cached, use this to force recalculate.
 * @returns {int}
 */
RecentsRender.prototype.getMaxFitOnScreen = function(force) {
    'use strict';
    if (!this._maxFitOnScreen || force) {
        this._maxFitOnScreen = Math.floor((this.$container.width() - 114) / 130) || 2;
    }
    return this._maxFitOnScreen;
};

/**
 * Generate a new action row.
 * @param action
 * @param actionId
 * @returns {*|Autolinker.HtmlTag}
 */
RecentsRender.prototype.generateRow = function (action, actionId) {
    'use strict';

    var self = this;

    // Get correct template.
    var $newRow;
    if (action.type === "media" && action.length > 1) {
        $newRow = self.getTemplate("images-content-row-template").removeClass("template");
    } else {
        $newRow = self.getTemplate("content-row-template").removeClass("template");
    }

    // Attach unique class & data attributes for this action.
    if (actionId !== undefined) {
        $newRow.addClass("action-" + actionId).data("action", actionId);
    }

    // Populate breadcrumb path
    this.populateBreadCrumb($newRow.find(".breadcrumbs"), action);

    // The following commented out code may require to back later.
    // Render the date/time views.
    // var date = new Date(action.ts * 1000 || 0);
    // $newRow.find(".file-data .time").text(this._shortTimeFormatter.format(date));
    // $newRow.find(".file-data .uploaded-on-message.dark-direct-tooltip span").text(
    //     (action.action !== "added" ? l[19942] : l[19941])
    //         .replace('%1', acc_time2date(action.ts, true))
    //         .replace('%2', this._fullTimeFormatter.format(date))
    // );

    // Render in/out share icons.
    if (action.outshare || action.inshare) {
        self.handleInOutShareState($newRow, action);
    }

    // Show correct icon for action.
    if (action.action !== 'added') {
        $newRow.find(".action-icon.tiny-icon").removeClass("top-arrow").addClass("refresh");
    }

    if (action.type === "media" && action.length > 1) {
        this._renderMedia($newRow, action, actionId);
    } else {
        $newRow.attr('id', action[0].h);
        this._renderFiles($newRow, action, actionId);
    }

    // Show by user if not current user.
    if (action.user !== u_handle) {
        self.handleByUserHandle($newRow, action);
    }
    return $newRow;
};

/**
 * Render Files Block
 * @param $newRow
 * @param action
 * @param actionId
 * @private
 */
RecentsRender.prototype._renderFiles = function($newRow, action, actionId) {
    'use strict';
    var self = this;
    var isCreated = action.action === "added";
    var isOtherUser = action.user !== u_handle;
    var $icon = $('.item-type-icon-90', $newRow);
    var iconClass = fileIcon(action[0]);

    // handle icon
    $icon.addClass(`${iconClass.includes('video') ? 'video ' : ''}icon-${iconClass}-90`);

    if (action.length === 1 && (iconClass === 'image' && is_image2(action[0]) ||
        iconClass === 'video' && is_video(action[0]) || iconClass === 'pdf')) {

        $icon.addClass('thumb').safeHTML('<img>');

        if (M.d[action[0].h]) {
            M.d[action[0].h].seen = true;
        }
        action[0].seen = true;

        if (iconClass === 'video') {
            $icon.safeAppend(
                '<div class="video-thumb-details theme-dark-forced">' +
                    '<i class="sprite-fm-mono icon-play"></i>' +
                '</div>');
        }
    }

    // handle filename.
    var $fileName = $newRow.find(".file-name");
    var titleString;
    var isMore = action.length > 1;
    if (isMore) {
        titleString = l[24835];
    } else {
        titleString = '%1';
    }

    titleString = titleString
        .replace("%1", '<span class="link title first-node-name"></span>')
        .replace("%2", action.length - 1)
        .replace("[A]", '<span class="link more-less-toggle">')
        .replace("[/A]", '</span>')
        .replace("[A1]", '<span class="rest-nodes-counter">')
        .replace("[/A1]", '</span>');

    $fileName.safeHTML(titleString);

    var $fileNameContainer = $fileName.find(".title");
    $fileNameContainer
        .text(action[0].name)
        .attr('id', action[0].h)
        .rebind('click', function(e) {
            self.markSelected();
            $.hideContextMenu();
            if (is_image(action[0]) || is_video(action[0])) {
                if (is_video(action[0])) {
                    $.autoplay = action[0].h;
                }
                slideshow(action[0].h);
            }
            else if (is_text(action[0])) {

                loadingDialog.show();

                mega.fileTextEditor.getFile(action[0].h)
                    .then((data) => {
                        mega.textEditorUI.setupEditor(action[0].name, data, action[0].h);
                    })
                    .catch(dump)
                    .finally(() => {
                        loadingDialog.hide();
                    });
            }
            else {
                $fileNameContainer.trigger({
                    type: 'contextmenu',
                    originalEvent: e.originalEvent
                });
            }
            return false;
        });

    var expandedIds = [];

    // Use a render function to delay the rendering of a child node till it is in view.
    var generateRenderFunction = function(i, id) {
        return function() {
            if (!self._renderCache[id]) {
                var nodeAction = action.createEmptyClone();
                var node = action[i];
                nodeAction.ts = node.ts;
                nodeAction.push(node);
                var $newChildAction = self.generateRow(nodeAction);
                $newChildAction.addClass(`action-${actionId}-child`);
                $newChildAction.addClass(i === action.length - 1 ? 'last-child' : 'child-note');
                self._renderCache[id] = $newChildAction[0];
            }
            return self._renderCache[id];
        };
    };

    var expandCollapseHelper = function() {
        self.markSelected();
        $.hideContextMenu();
        if ($newRow.hasClass('expanded')) {
            self._expandedStates[actionId] = false;
            $newRow.removeClass('expanded').addClass("collapsed");
            self._dynamicList.remove(expandedIds, false);
            self._dynamicList.itemRenderChanged(actionId);
            delete self._actionChildren[actionId];
            expandedIds = [];
        }
        else {
            // Render new action views.
            self._expandedStates[actionId] = true;
            $newRow.removeClass("collapsed").addClass("expanded");
            expandedIds = [];
            for (var i = 1; i < action.length; i++) {
                var id = `${actionId}:${i}`;
                self._nodeRenderedItemIdMap[action[i].h] = id;
                self._renderFunctions[id] = generateRenderFunction(i, id);
                self._childIds[id] = true;
                expandedIds.push(id);
            }
            self._dynamicList.insert(actionId, expandedIds, false);
            self._dynamicList.itemRenderChanged(actionId);
            self._actionChildren[actionId] = expandedIds;
        }
    };
    var clickFunction = (e) => {
        if ((e.detail === 2 || $newRow.hasClass('ui-selected'))
            && ($newRow.hasClass('expanded') || $newRow.hasClass('collapsed'))) {
            expandCollapseHelper();
        }
        return self._handleSelectionClick(e, action[0].h, $newRow);
    };

    // If more than 1 file in action.
    if (isMore) {
        action.createEmptyClone = function() {
            var clone = [];
            clone.action = this.action;
            clone.ts = this.ts;
            clone.date = this.date;
            clone.path = this.path;
            clone.user = this.user;
            clone.recent = this.recent;
            if (this.inshare) {
                clone.inshare = this.inshare;
            }
            if (this.outshare) {
                clone.outshare = this.outshare;
            }
            return clone;
        };

        $('.expand-collapse-toggle, .more-less-toggle', $newRow)
            .rebind('click.recents', () => {
                expandCollapseHelper();
                return false;
            });

        $newRow.rebind('click.recents', clickFunction);

        $newRow.removeClass("single").addClass("group collapsed");
    }
    else {
        $newRow.rebind('click.recents', clickFunction);
    }

    $newRow
        .rebind("contextmenu", function(e) {
            if (selectionManager.selected_list.indexOf(action[0].h) === -1) {
                selectionManager.clear_selection();
                selectionManager.add_to_selection(action[0].h);
                self.markSelected($newRow);
            }
            return M.contextMenuUI(e, 1) ? true : false;
        });

    var $contextMenuButton = $newRow.find(".context-menu-button");
    $contextMenuButton
        .attr('id', action[0].h)
        .rebind("click", function (e) {
            $contextMenuButton.trigger({
                type: 'contextmenu',
                originalEvent: e.originalEvent
            });
            return false;
        })
        .rebind("dblclick", function() {
            return false;
        })
        .rebind("contextmenu", function(e) {
            self.markSelected($newRow);
            selectionManager.clear_selection();
            selectionManager.add_to_selection(action[0].h);
            $.hideTopMenu();
            return M.contextMenuUI(e, 1) ? true : false;
        });
};

/**
 * Render Media Block
 * @param $newRow
 * @param action
 * @private
 */
RecentsRender.prototype._renderMedia = function($newRow, action, actionId) {
    'use strict';
    var self = this;
    var isCreated = action.action === "added";
    var isOtherUser = action.user !== u_handle;
    var $previewBody = $newRow.find(".previews-body");
    var $thumbTemplate = $previewBody.find(".data-block-view.template");
    var maxFitOnScreen = self.getMaxFitOnScreen();
    var imagesToRender = action.length;

    // Maintain the index of images that we have rendered.
    var renderedIndex = 0;
    var renderedThumbs = [];
    var mediaCounts = self._countMedia(action);
    var videos = mediaCounts.videos;
    var images = mediaCounts.images;
    var pdfs = mediaCounts.pdfs;
    var docxs = mediaCounts.docxs;

    $newRow.addClass('media expanded');

    // Create & append new image container, fire async method to collect thumbnail.
    var renderThumb = function(i) {
        var $newThumb = $thumbTemplate.clone().removeClass("template");
        var node = action[i];
        $newThumb
            .attr('id', node.h)
            .attr('title', node.name)
            .rebind('dblclick', () => {
                self.markSelected();
                $.hideContextMenu();

                // Close node Info panel as it's not applicable when opening Preview
                mega.ui.mInfoPanel.closeIfOpen();

                // mega.ui.searchbar.recentlyOpened.addFile(node.h, false);
                slideshow(node.h);
                $.autoplay = node.h;
                return false;
            })
            .rebind('click', e => {

                const result = self._handleSelectionClick(e, node.h, $newThumb.add($newRow));

                // Update the Info panel if it's open once the selection is made
                mega.ui.mInfoPanel.reRenderIfVisible($.selected);

                return result;
            })
            .rebind('contextmenu', e => {
                if (!selectionManager.selected_list.includes(node.h)) {
                    selectionManager.clear_selection();
                    self.clearSelected();
                }
                self.appendSelected($newThumb.add($newRow));
                selectionManager.add_to_selection(node.h);
                $.hideTopMenu();
                return Boolean(M.contextMenuUI(e, 1));
            });

        if (M.d[node.h]) {
            M.d[node.h].seen = true;

            if (M.d[node.h].shares && M.d[node.h].shares.EXP) {
                $newThumb.addClass('linked');
            }
        }

        if (!node.t && node.tvf) {
            $newThumb.addClass('versioning');
        }
        node.seen = true;

        $('.item-type-icon-90', $newThumb).addClass(`icon-${fileIcon(node)}-90`);

        if (is_video(node)) {
            $('.data-block-bg', $newThumb).addClass('video');
            node = MediaAttribute(node, node.k);
            if (node && node.data && node.data.playtime) {
                $('.video-thumb-details span', $newThumb).text(secondsToTimeShort(node.data.playtime));
            }
        }

        if (node.fav) {
            $('.file-status-icon', $newThumb).addClass('sprite-fm-mono icon-favourite-filled');
        }

        if (M.getNodeShare(node.h).down) {
            $('.file-status-icon', $newThumb).removeClass('icon-favourite-filled').addClass('icon-takedown');
        }

        var $contextMenuHandle = $(".file-settings-icon", $newThumb);
        $contextMenuHandle
            .attr('id', node.h)
            .rebind("contextmenu", e => {
                self.markSelected($newThumb.add($newRow));
                selectionManager.clear_selection();
                selectionManager.add_to_selection(node.h);
                $.hideTopMenu();
                Boolean(M.contextMenuUI(e, 1));
            })
            .rebind('click', e => {
                $contextMenuHandle.trigger({
                    type: 'contextmenu',
                    originalEvent: e.originalEvent
                });
            });

            $previewBody.append($newThumb);
            renderedThumbs[i] = $newThumb;
    };

    var $toggleExpandedButton = $newRow.find(".toggle-expanded-state");
    var $toggleExpandedButtonText = $toggleExpandedButton.find("span");
    var $toggleExpandedButtonIcon = $toggleExpandedButton.find("i");

    var $previewsScroll = $newRow.find(".previews-scroll");

    // If there are more images than we can fit onto the initial screen size.
    if (action.length > maxFitOnScreen) {
        imagesToRender = maxFitOnScreen;
        $toggleExpandedButton.removeClass('hidden');
    }

    var toggleOpenState = function() {
        if ($previewsScroll.hasClass('expanded')) {
            self._expandedStates[actionId] = false;
            $previewsScroll.removeClass('expanded');
            $toggleExpandedButtonText.text(l.x_more_files.replace('%1', action.length - maxFitOnScreen));
            $toggleExpandedButtonIcon.removeClass('icon-arrow-up').addClass('icon-arrow-down');
            // Mark thumbs that are no longer viewable as hidden.
            for (var i = maxFitOnScreen; i < renderedIndex; i++) {
                if (renderedThumbs[i]) {
                    renderedThumbs[i].addClass('hidden');
                }
            }

        } else {
            if (action.length >= maxFitOnScreen) {
                self._expandedStates[actionId] = true;
                $previewsScroll.addClass('expanded');
                $toggleExpandedButtonText.text(l[19963]);
                $toggleExpandedButtonIcon.removeClass('icon-arrow-down').addClass('icon-arrow-up');
                $('.data-block-view', $previewsScroll).removeClass('hidden');
                // Inject the rest of the images that were not loaded initially.
                for (;renderedIndex < action.length; renderedIndex++) {
                    renderThumb(renderedIndex);
                }
                fm_thumbnails();
            }
        }
        self._dynamicList.itemRenderChanged(actionId);
        return false;
    };

    $toggleExpandedButtonText.text(l.x_more_files.replace('%1', action.length - maxFitOnScreen));
    $toggleExpandedButton.rebind('click', function() {
        toggleOpenState();
        return false;
    });

    // render inital image containers.
    for (renderedIndex = 0; renderedIndex < imagesToRender; renderedIndex++) {
        renderThumb(renderedIndex);
    }

    // Set title based on content.
    var $title = $newRow.find(".file-name");
    var $titleString;

    const makeTitle = function() {

        const numOfFiles = images + videos + pdfs + docxs;
        const titleString = mega.icu.format(l.file_count, numOfFiles);

        return '<span class="title number-of-files">' + titleString + '</span>';
    };

    $titleString = makeTitle();
    $title.safeHTML($titleString);

    // Attach title click to open folder.
    $title.find("span.title").on('click', function() {
            toggleOpenState();
            return false;
        })
        .rebind("dblclick", function() {
            return false;
        });

    // Set the media block icons according to media content.
    let fIcon;
    let rIcon;

    if (images) {
        fIcon = rIcon = 'image';
        if (videos) {
            rIcon = 'video';
        }
        else if (pdfs) {
            rIcon = 'pdf';
        }
        else if (docxs) {
            rIcon = 'word';
        }
    }
    else if (videos) {
        fIcon = rIcon = 'video';
        if (pdfs) {
            rIcon = 'pdf';
        }
        else if (docxs) {
            rIcon = 'word';
        }
    }
    else if (pdfs) {
        fIcon = rIcon = 'pdf';
        if (docxs) {
            rIcon = 'word';
        }
    }
    else if (docxs) {
        fIcon = rIcon = 'word';
    }

    const $rearIcon = $('.item-type-icon-90.double', $newRow).addClass(`icon-${rIcon}-90`);
    $('.item-type-icon-90', $rearIcon).addClass(`icon-${fIcon}-90`);

    // Attach resize listener to the image block.
    self._resizeListeners.push(function() {
        var newMax = self.getMaxFitOnScreen();
        const isExpanded = $previewsScroll.hasClass('expanded');

        // Render new more images if we can now fit more on the screen.
        if (newMax > maxFitOnScreen) {
            for (; renderedIndex < newMax && renderedIndex < action.length; renderedIndex++) {
                renderThumb(renderedIndex);
            }
        }
        maxFitOnScreen = newMax;

        if (!isExpanded) {
            for (let i = renderedIndex; i--;) {
                renderedThumbs[i][i < maxFitOnScreen ? 'removeClass' : 'addClass']('hidden');
            }
        }

        // Enable/disable showall button if resize makes appropriate.
        if (newMax < action.length) {
            $toggleExpandedButton.removeClass("hidden");
            if (isExpanded) {
                $toggleExpandedButtonText.text(l[19963]);
            }
            else {
                $toggleExpandedButtonText.text(l.x_more_files.replace('%1', action.length - newMax));
            }
        }
        else {
            $toggleExpandedButton.addClass("hidden");
        }
    });

    $('.expand-collapse-toggle', $newRow).rebind('click', function() {
        if ($newRow.hasClass('expanded')) {
            $newRow.removeClass('expanded').addClass('collapsed');
        }
        else {
            $newRow.removeClass('collapsed').addClass('expanded');
        }
        self._dynamicList.itemRenderChanged(actionId);
        return false;
    }).rebind("dblclick", function() {
        return false;
    });

    $newRow.rebind('click.recents', (e) => {
        if (e.detail === 2 || e.detail === 1 && $newRow.hasClass('ui-selected')) {
            if ($newRow.hasClass('expanded')) {
                $newRow.removeClass('expanded').addClass('collapsed');
            }
            else {
                $newRow.removeClass('collapsed').addClass('expanded');
            }
        }
        return self._handleSelectionClick(e, '', $newRow);
    }).rebind('dblclick.recents', () => {
        return false;
    });

    const triggerContextMenu = (ev) => {
        const sm = selectionManager;
        sm.clear_selection();
        sm.selected_list = action.map(n => n.h);
        sm.add_to_selection(sm.selected_list.pop(), false, true);
        mega.ui.mInfoPanel.reRenderIfVisible($.selected);
        self.markSelected($newRow);
        $.hideTopMenu();
        return !!M.contextMenuUI(ev, 3);
    };

    $newRow.rebind("contextmenu", triggerContextMenu);

    var $contextMenuButton = $newRow.find(".context-menu-button");
    $contextMenuButton
        .rebind("dblclick", () => false)
        .rebind("click contextmenu", triggerContextMenu);

    // Remove the template that we no longer need.
    $thumbTemplate.remove();
};

/**
 * Get a new instance of a template.
 * @param className
 * @returns {jQuery}
 */
RecentsRender.prototype.getTemplate = function(className) {
    'use strict';
    return this.$container.find(".template." + className).clone().removeClass(className);
};

/**
 * Generate count of images/videos in action block.
 * @param action
 * @private
 */
RecentsRender.prototype._countMedia = function(action) {
    'use strict';
    var counts = {
        images: 0,
        videos: 0,
        pdfs: 0,
        docxs: 0
    };

    for (var idx = action.length; idx--;) {
        var n = action[idx];

        if (is_video(n)) {
            counts.videos++;
        }
        else if (is_image3(n)) {
            counts.images++;
        }
        else if (fileIcon(n) === 'pdf') {
            counts.pdfs++;
        }
        else if (fileIcon(n) === 'word') {
            counts.docxs++;
        }
        else if (d) {
            console.warn('What is this?...', n);
        }
    }
    return counts;
};

/**
 * Reset internal variables before reiniting.
 */
RecentsRender.prototype.reset = function() {
    'use strict';
    var renderCacheIds = Object.keys(this._renderCache);
    for (var i = 0; i < renderCacheIds.length; i++) {
        var id = renderCacheIds[i];
        $(this._renderCache[id]).remove();
        delete this._renderCache[id];
    }
    this._rendered = false;
    this._resizeListeners = [];
    this._renderCache = {};
    this._childIds = {};
    this._renderFunctions = {};
    this._view = [];
    this._nodeActionMap = {};
    if (this._dynamicList) {
        this._dynamicList.destroy();
        this._dynamicList = false;
    }
};

/**
 * @returns {boolean} true if recents config has changed
 */
RecentsRender.prototype.hasConfigChanged = function() {
    'use strict';
    return this._showRecents !== this._getConfigShow();
};

/**
 * To be used on recents config change
 * @returns {void}
 */
RecentsRender.prototype.onConfigChange = function() {
    'use strict';
    this._showRecents = this._getConfigShow();
    this._rendered = false;
    if (this._dynamicList) {
        this._dynamicList.destroy();
        this._dynamicList = false;
    }
};

/**
 * @returns {boolean} get show recents value from mega configuration
 */
RecentsRender.prototype._getConfigShow = function() {
    'use strict';
    return mega.config.get('showRecents');
};

/**
 * set show recents value in mega configuration
 * @param {boolean} val new value
 * @returns {void}
 */
RecentsRender.prototype._setConfigShow = function(val) {
    'use strict';
    mega.config.set('showRecents', val ? 1 : undefined);
    if (!val) {
        mega.ui.searchbar.recentlyOpened.clear();
        mega.ui.searchbar.recentlySearched.clear();
    }
    queueMicrotask(() => {
        this.checkStatusChange(1);
    });
};

/**
 * Check status change.
 */
RecentsRender.prototype.checkStatusChange = function(force) {
    'use strict';
    let res = false;

    if (force || this.hasConfigChanged()) {
        this.onConfigChange();

        res = page.includes('fm/recents');
        if (res++) {
            openRecents();
        }
    }

    return res;
};

/**
 * Cleanup function, should be triggered when moving to another section of the webclient.
 */
RecentsRender.prototype.cleanup = function() {
    'use strict';
    if (this._dynamicList && this._dynamicList.active) {
        this._dynamicList.pause();
    }
};

/**
 * Triggered on resize after a thottle control.
 * @private
 */
RecentsRender.prototype._onResize = function() {
    'use strict';
    this.getMaxFitOnScreen(true);
    if (d) {
        console.time("recents.resizeListeners");
    }
    for (var i = 0; i < this._resizeListeners.length; i++) {
        this._resizeListeners[i]();
    }
    fm_thumbnails();
    if (d) {
        console.timeEnd("recents.resizeListeners");
    }
};

RecentsRender.prototype.thottledResize = function() {
    'use strict';
    var self = this;
    delay('recents.resizeListener', function() {
        self._onResize();
    }, 100);
};

/**
 * Triggered when the list scrolls.
 */
RecentsRender.prototype.onScroll = function() {
    'use strict';
    delay('recents:on-scroll', () => {
        delay('thumbnails', fm_thumbnails, 260);

        onIdle(() => {
            $.hideContextMenu();
            notify.closePopup();
        });
    }, 190);
};

/**
 * Helper function to add items to the selection based on common key shortcuts.
 * @param e
 * @param handle
 * @param $element
 * @returns boolean
 * @private
 */
RecentsRender.prototype._handleSelectionClick = function(e, handle, $element) {
    'use strict';
    $.hideContextMenu();
    if (e.ctrlKey !== false || e.metaKey !== false) {
        this.appendSelected($element);
    }
    else {
        selectionManager.clear_selection();
        this.markSelected($element);
    }
    if (handle) {
        selectionManager.add_to_selection(handle);
        mega.ui.mInfoPanel.reRenderIfVisible($.selected);
    }
    return false;
};

/**
 * Trigger for when a single node gets changes (renamed, etc).
 * This will attempt to re-redner the action that houses the node.
 * For large changes, like moving the file, the RecentsRender.updateState() should be called instead.
 *
 * @param handle
 */
RecentsRender.prototype.nodeChanged = function(handle) {
    'use strict';
    if (handle && M.d[handle] && this._nodeActionMap[handle] && this._dynamicList) {
        var actionId = this._nodeActionMap[handle];
        var action = this.actionIdMap[actionId];
        if (action) {
            var renderedItemId = this._nodeRenderedItemIdMap[handle] || actionId;
            // Remove any cached rendering.
            if (this._renderCache[renderedItemId]) {
                delete this._renderCache[renderedItemId];
            }

            var i;
            // Get the new node state.
            var currentNode = M.d[handle];

            // Update the internal list.
            for (i = 0; i < action.length; i++) {
                if (action[i].h === handle) {
                    action[i] = currentNode;
                    break;
                }
            }

            // Update the view.
            for (i = 0; i < this._view.length; i++) {
                if (this._view[i].h === handle) {
                    this._view[i] = currentNode;
                    break;
                }
            }
            M.v = this._view;

            if (!this._updateNodeName(currentNode)) {
                this._dynamicList.itemChanged(renderedItemId);
            }
        }
    } else if (this._dynamicList.active) {
        this.updateState();
    }
};

/**
 * Generate a unique id for this action based on its contents.
 * @param action
 * @private
 */
RecentsRender.prototype._generateId = function(action) {
    'use strict';
    var idString;
    if ($.isArray(action) && action.length > 0) {
        var handleAppend = function(summary, node) {
            return summary + node.h;
        };
        var pathString = action.path.reduce(handleAppend, "");
        idString = action.reduce(handleAppend, "recents_" + pathString);
    } else if (action.type === "date") {
        idString = "date_" + action.ts;
    }
    return fastHashFunction(idString);
};

/**
 * Generate IDS for all the actions provided.
 * @param actions
 * @private
 */
RecentsRender.prototype._fillActionIds = function(actions) {
    'use strict';
    for (var i = 0; i < actions.length; i++) {
        actions[i].id = this._generateId(actions[i]);
    }
};

/**
 * Update state with changes from new actions list.
 * Computes a diff against the current content to find actions that need to be inserted / removed and does so.
 * Will only re-render the actions that has been updated.
 *
 * @param actions
 * @private
 */
RecentsRender.prototype._updateState = function(actions) {
    'use strict';

    if (this.previousActionCount === 0 || actions.length === 0) {
        this.reset();

        this._initialRender(actions);
        return;
    }

    var removed = [];
    var added = [];
    var removedAsExpanded = [];
    var newActionIdMap = {};
    var i;
    var k;
    var action;
    var stateChanged = false;

    this._injectDates(actions);
    this._fillActionIds(actions);

    this._firstItemPosition = this._dynamicList.getFirstItemPosition();

    // Scan for added nodes
    for (i = 0; i < actions.length; i++) {
        action = actions[i];
        newActionIdMap[action.id] = action;
        if (this.actionIdMap[action.id] === undefined) {
            this.actionIdMap[action.id] = action;
            added.push(action);
            stateChanged = true;
        }
    }

    // Scan and remove nodes no longer present in newActions.
    for (i = 0; i < this.recentActions.length; i++) {
        action = this.recentActions[i];
        if (newActionIdMap[action.id] === undefined) {
            removed.push(action.id);
            delete this._renderCache[action.id];
            delete this._renderFunctions[action.id];
            delete this.actionIdMap[action.id];

            // If this is expaned action and it is about to removed, save states with ts.
            if (this._expandedStates[action.id]) {
                removedAsExpanded.push(action.ts);
            }

            this._dynamicList.remove(action.id);
            if (this._actionChildren[action.id]) {
                for (k = 0; k < this._actionChildren[action.id].length; k++) {
                    this._dynamicList.remove(this._actionChildren[action.id][k]);
                    delete this._renderCache[this._actionChildren[action.id][k]];
                    delete this._renderFunctions[this._actionChildren[action.id][k]];
                }
                delete this._actionChildren[action.id];
            }
            stateChanged = true;
        }
    }

    if (stateChanged) {
        this._applyStateChange(added, removed, removedAsExpanded);
    }
};

/**
 * Apply the state changes.
 * @param added
 * @param removed
 * @private
 */
RecentsRender.prototype._applyStateChange = function(added, removed, removedAsExpanded) {
    'use strict';
    var action;
    var i;
    var k;
    var after;
    var pos;
    // Make changes to internal list of recentActions.
    var actions = this.recentActions.filter(function(item) {
        return removed.indexOf(item.id) === -1;
    });

    // Inject new actions.
    var handled = 0;
    i = 0;

    var currentScrollTop = this._dynamicList.getScrollTop();

    var keepExpanded = function(id) {
        $('.toggle-expanded-state', '.action-' + id).trigger('click');
        this._dynamicList.scrollToYPosition(currentScrollTop);
    };

    while (i < actions.length && handled < added.length) {
        action = actions[i];
        if (added[handled].ts > action.ts) {
            pos = i;
            if (pos === 0) {
                after = null;
            } else {
                after = actions[pos - 1].id;
                if (this._actionChildren[after]) {
                    after = this._actionChildren[after][this._actionChildren[after].length - 1];
                }
            }
            actions.splice(pos, 0, added[handled]);
            this._populateNodeActionMap(added[handled]);
            this._dynamicList.insert(after, added[handled].id);

            if (removedAsExpanded.indexOf(added[handled].ts) > -1) {
                onIdle(keepExpanded.bind(this, added[handled].id));
            }

            handled++;
        }
        i++;
    }

    for (k = handled; k < added.length; k++ && i++) {
        pos = actions.length;
        if (pos === 0) {
            after = null;
        } else {
            after = actions[pos - 1].id;
            if (this._actionChildren[after]) {
                after = this._actionChildren[after][this._actionChildren[after].length - 1];
            }
        }
        actions.splice(pos, 0, added[handled]);
        this._populateNodeActionMap(added[handled]);
        this._dynamicList.insert(after, added[k].id);
    }

    if (removed.length > 0) {
        this._removeConsecutiveDates(actions);
    }

    if (this._firstItemPosition !== undefined) {
        this._dynamicList.scrollToItemPosition(this._firstItemPosition);
        delete this._firstItemPosition;
    }

    // Update M.v
    this._view = [];
    for (i = 0; i < actions.length; i++) {
        if ($.isArray(actions[i])) {
            Array.prototype.push.apply(this._view, actions[i]);
        }
    }
    this.recentActions = actions;
    M.v = this._view;
};

/**
 * Add action nodes to maps.
 * @param action
 * @private
 */
RecentsRender.prototype._populateNodeActionMap = function(action) {
    'use strict';
    if ($.isArray(action)) {
        for (var k = 0; k < action.length; k++) {
            this._nodeActionMap[action[k].h] = action.id;
        }
    }
};

/**
 * Remove consecutive dates from actions list.
 * @param actions
 * @private
 */
RecentsRender.prototype._removeConsecutiveDates = function(actions) {
    'use strict';
    // Remove duplicating dates.
    for (i = 0; i < actions.length; i++) {
        if (actions[i].type === "date" && i + 1 < actions.length && actions[i + 1].type === "date") {
            var id = actions[i].id;
            delete this._renderCache[id];
            delete this._renderFunctions[id];
            delete this.actionIdMap[id];
            this._dynamicList.remove(id);
            actions.splice(i, 1);
        }
    }
};

/**
 * Trigger when content changes while the recents page is open.
 * Thottles the _updateState function.
 */
RecentsRender.prototype.updateState = function() {
    'use strict';
    var self = this;
    delay('recents.updateState', function() {
        self.render();
    }, 500);
};

/**
 * Update the name of a rendered node.
 * @param node
 * @returns boolean if update was handled.
 * @private
 */
RecentsRender.prototype._updateNodeName = function(node) {
    'use strict';
    var $renderdItem = $("#" + node.h);
    if ($renderdItem.length > 0) {
        if ($renderdItem.hasClass("data-block-view")) {
            $renderdItem.attr('title', node.name);
            return true;
        }
        else if ($renderdItem.hasClass("content-row")) {
            $renderdItem.find(".first-node-name").text(node.name);
            return true;
        }
    }
    return false;
};

(function(window) {
    'use strict';

    const WEEK_SECONDS = 7 * 24 * 60 * 60;
    const FORTNIGHT_SECONDS = 2 * WEEK_SECONDS; // 2 WEEKS
    const MONTH_SECONDS = 2 * FORTNIGHT_SECONDS;

    const TYPE_WEEK = 0;
    const TYPE_FORTNIGHT = 1;
    const TYPE_MONTH = 2;

    const TIMES_WEEK = 5;
    const TIMES_FORTNIGHT = 5;

    function TimeChecker(context) {
        this.type = TYPE_WEEK;
        this.times = 0;
        this.lastTimestamp = this.getCurrentTimestamp();
        this.context = context || null;
        this.requestId = null;
    }

    /**
     * Initialize time checker and hydrate properties
     *
     * @returns {Promise} void
     */
    TimeChecker.prototype.init = async function() {
        await this.fillContext();
    };

    /**
     * Fill properties from context
     *
     * @returns {Promise} void
     */
    TimeChecker.prototype.fillContext = async function() {
        const context = this.getContext();

        if (context) {
            const contextValues = await context.get();

            if (contextValues && contextValues.length) {
                this.lastTimestamp = contextValues[0];
                this.times = contextValues[1];
                this.type = contextValues[2];
            }
        }
    };

    /**
     * Update view count for the add phone banner
     *
     * @returns {void} void
     */
    TimeChecker.prototype.update = function() {
        this.requestId = requesti;
        const times = this.getTimes();
        const type = this.getType();
        const currentTimestamp = this.getCurrentTimestamp();
        const lastTimestamp = this.getLastTimestamp();

        let newTimes = times;
        let newType = type;
        let newTimestamp = lastTimestamp;

        const deltaSeconds = currentTimestamp - lastTimestamp;

        switch (type) {
            case TYPE_WEEK:
                if (deltaSeconds > WEEK_SECONDS) {
                    newType = TYPE_FORTNIGHT;
                    newTimestamp = this.getCurrentTimestamp();
                    newTimes = 0;
                }
                newTimes++;
                break;
            case TYPE_FORTNIGHT:
                if (deltaSeconds > FORTNIGHT_SECONDS) {
                    newType = TYPE_MONTH;
                    newTimestamp = this.getCurrentTimestamp();
                    newTimes = 0;
                }
                newTimes++;
                break;
            case TYPE_MONTH:
                if (deltaSeconds > MONTH_SECONDS) {
                    newTimestamp = this.getCurrentTimestamp();
                    newTimes = 0;
                }
                newTimes++;
                break;
        }

        this.save(newTimestamp, newTimes, newType);
    };

    /**
     * Do a delayed update for banner checking
     *
     * @param {function} callback callback after delay
     *
     * @returns {void} void
     */
    TimeChecker.prototype.delayedUpdate = function(callback) {
        if (typeof callback === 'function') {
            delay(this.getContext().getKey(), () => {
                this.update();
                callback();
            }, this.getContext().getDelay());
        }
    };

    /**
     * Check if the current request count has been updated
     *
     * @returns {boolean} stored request id is same as saved one
     */
    TimeChecker.prototype.hasUpdated = function() {
        return requesti === this.requestId;
    };

    /**
     * Check if the banner is allowed to display
     *
     * @returns {boolean} returns true if able
     */
    TimeChecker.prototype.shouldShow = function() {
        const type = this.getType();
        const currentTimestamp = this.getCurrentTimestamp();
        const lastTimestamp = this.getLastTimestamp();
        const deltaSeconds = currentTimestamp - lastTimestamp;
        const times = this.getTimes();

        switch (type) {
            case TYPE_WEEK:
                if (deltaSeconds > WEEK_SECONDS) {
                    return true;
                }

                if (times < TIMES_WEEK) {
                    return true;
                }

                break;
            case TYPE_FORTNIGHT:
                if (deltaSeconds > FORTNIGHT_SECONDS) {
                    return true;
                }

                if (times < TIMES_FORTNIGHT) {
                    return true;
                }

                break;
            case TYPE_MONTH:
                return deltaSeconds > MONTH_SECONDS;
            default:
        }

        return false;
    };

    /**
     * Save the new record for last time checked
     *
     * @param {number} newTimestamp new timestamp
     * @param {number} newTimes number of times
     * @param {number} newType week, fortnight or month
     *
     * @returns {void} void
     */
    TimeChecker.prototype.save = function(newTimestamp, newTimes, newType) {
        const context = this.getContext();

        if (context && this.isAllowedSave()) {
            this.lastTimestamp = newTimestamp;
            this.times = newTimes;
            this.type = newType;

            context.save(newTimestamp, newTimes, newType);
        }
    };

    /**
     * Get time checker type
     * @returns {number} Time checker type (week, fortnight, month)
     */
    TimeChecker.prototype.getType = function() {
        return this.type;
    };

    /**
     * Get number of times banner was viewed
     * @returns {number} number of times
     */
    TimeChecker.prototype.getTimes = function() {
        return this.times;
    };

    /**
     * Get the last timestamp when type was changed
     * @returns {number} unix timestamp
     */
    TimeChecker.prototype.getLastTimestamp = function() {
        return this.lastTimestamp;
    };

    /**
     * Current date unix timestamp helper
     *
     * @returns {number} current timestamp
     */
    TimeChecker.prototype.getCurrentTimestamp = function() {
        return Date.now();
    };

    TimeChecker.prototype.getContext = function() {
        return this.context;
    };

    TimeChecker.prototype.isAllowedSave = function() {
        if (this.context) {
            return this.context.isAllowedSave();
        }
        return true;
    };

    /**
     * Check if the banner was shown more than 10 times
     *
     * @returns {boolean} true if more than 10 times or month type
     */
    TimeChecker.prototype.isMoreThan10Times = function() {
        return this.type === TYPE_MONTH || this.type === TYPE_FORTNIGHT && this.times >= 5;
    };

    /**
     * Time checker context (storage, checking etc.)
     * @param {string} key storage key
     * @param {function} allowSaveCallback callback to check if allowed to save
     * @param {number} delay saving delay
     *
     * @returns {TimeCheckerContext} instance
     */
    function TimeCheckerContext(key, allowSaveCallback, delay) {
        this.key = 'tc';
        this.allowSaveCallback = null;
        this.delay = delay || 3000;

        if (key) {
            this.key = `${key}${this.key}`;
        }

        if (typeof allowSaveCallback === 'function') {
            this.allowSaveCallback = allowSaveCallback;
        }
    }

    /**
     * Save last time checked
     * @param {number} timestamp Last timestamp
     * @param {number} times number of times
     * @param {number} type type of checking
     * @returns {void|Promise} Promise if persistent otherwise void
     */
    TimeCheckerContext.prototype.save = function(timestamp, times, type) {
        const key = this.getKey();
        const value = [timestamp, times, type];
        const serializedValue =  JSON.stringify(value);

        return window.M.setPersistentData(key, serializedValue).catch(nop);
    };

    /**
     * Get time checker context from storage
     *
     * @returns {Promise|array} If from local storage array, otherwise promise
     */
    TimeCheckerContext.prototype.get = async function(){
        const key = this.getKey();
        let serializedValue = null;

        serializedValue = await Promise.resolve(window.M.getPersistentData(key).catch(nop));

        if (typeof serializedValue === 'string') {
            return JSON.parse(serializedValue);
        }

        return serializedValue;
    };

    /**
     * Get storage key
     *
     * @returns {string} storage key
     */
    TimeCheckerContext.prototype.getKey = function() {
        return this.key;
    };

    /**
     * Check if allowed to save
     * @returns {boolean} allowed to save
     */
    TimeCheckerContext.prototype.isAllowedSave = function() {
        if (this.allowSaveCallback) {
            return this.allowSaveCallback();
        }

        return true;
    };

    /**
     * Set allow save callback
     * @param {function} allowSaveCallback allow save callback
     * @returns {void} void
     */
    TimeCheckerContext.prototype.setAllowSaveCallback = function(allowSaveCallback) {
        this.allowSaveCallback = null;

        if (typeof allowSaveCallback === 'function') {
            this.allowSaveCallback = allowSaveCallback;
        }
    };

    /**
     * Saving delay
     * @returns {number} delay
     */
    TimeCheckerContext.prototype.getDelay = function() {
        return this.delay;
    };

    /**
     * Phone Banner Time Checker Factory
     */
    const PhoneBannerTimeChecker = {
        checker: null
    };

    /**
     * Time checker instance
     *
     * @param {function} allowSaveCallback save callback for context
     * @returns {TimeChecker} Time checker instance
     */
    PhoneBannerTimeChecker.init = async function(allowSaveCallback) {
        if (this.checker) {
            this.checker.getContext().setAllowSaveCallback(allowSaveCallback);
            return this.checker;
        }
        const timeCheckerContext = new TimeCheckerContext('pb');
        const timeChecker = new TimeChecker(timeCheckerContext, allowSaveCallback);

        await timeChecker.init();
        this.checker = timeChecker;
        return timeChecker;
    };

    TimeChecker.Context = TimeCheckerContext;
    TimeChecker.PhoneBanner = PhoneBannerTimeChecker;

    Object.defineProperty(window.mega, 'TimeChecker', {
        value: TimeChecker
    });
})(window);

/**
 * Semantic and accessible context menu creator/API.
 * Not yet used for the main context menu, only menu bar menus.
 *
 * Menus can have any depth by nesting them adjacent to the <button> element, i.e.:
 *
 * <template>
 *   <nav aria-expanded="false">
 *     <ul>
 *       <li>
 *         <button />
 *         <nav  aria-expanded="false" /><!-- second nested nav here -->
 *       </li>
 *     </ul>
 *   </button>
 * </template>
 *
 * Note the use of a <template> element to reduce the size of the rendered DOM until necessary.
 * See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template
 *
 * - Optional transitions by setting them in the CSS and passing animationDuration > 0 to create.
 * - Can be used to automate menus for testing/demos using open/close/toggle.
 * - The menu should be put in a positioned parent element, and the menu will appear above/below the parent element
 *
 * @global
 * @name contextMenu
 * @memberOf window
 * @param {boolean} defaultIsRTL - the default value for whether the menu should have a RTL layout
 * @param {number} defaultAnimationDuration - value to use for the animationDuration if not specified
 */
lazy(window, 'contextMenu', () => {
    'use strict';

    const defaultAnimationDuration = 150;
    const defaultIsRTL = document.body.classList.contains('rtl');

    /**
     * Attaches the menu to the DOM.
     *
     * @private
     * @param {HTMLElement} menu - The menu element created from a template
     * @param {HTMLElement} sibling - The element to attach the menu next to
     * @returns {undefined}
     */
    function attach(menu, sibling) {
        sibling.insertAdjacentElement('afterend', menu);
    }

    /**
     * Creates the instance of the menu from a template.
     *
     * @private
     * @param {HTMLElement} template - The template to create the menu from
     * @param {boolean} isRTL - Whether the layout is RTL
     * @param {HTMLElement} boundingElement - The element the menu should not extend outside of
     * @param {number} [animationDuration] - The duration of the close animation (in ms)
     * @returns {HTMLElement} The instance of the menu
     */
    function createMenuElement(template, isRTL, boundingElement, animationDuration) {
        const elem = template.content.firstElementChild.cloneNode(true);
        elem.dataset.menuRoot = true;
        elem.style.direction = isRTL ? 'rtl' : 'ltr';
        elem.boundingElement = boundingElement;
        elem.animationDuration = animationDuration;
        return elem;
    }

    /**
     * Add hover events to show/hide submenus.
     *
     * @private
     * @param {HTMLElement} menu - The menu element to add events to
     * @returns {undefined}
     */
    function submenuHovers(menu) {
        const submenus = menu.querySelectorAll('nav');

        submenus.forEach(submenu => {
            const li = submenu.closest('li');
            let closeTimer;

            li.addEventListener('mouseover', () => {
                // if the submenu is not already open
                if (!submenu.classList.contains('visible')) {
                    open(submenu);
                    closeOtherSubmenus(submenu);
                }
                if (closeTimer) {
                    closeTimer.abort();
                    closeTimer = null;
                }
            });
            li.addEventListener('mouseleave', () => {
                (closeTimer = tSleep(0.5)).then(() => close(submenu));
            });
        });
    }

    /**
     * Closes all submenus except the specified one.
     *
     * @private
     * @param {HTMLElement} submenu - The submenu that should stay open
     * @returns {undefined}
     */
    function closeOtherSubmenus(submenu) {
        submenu.closest('ul').querySelectorAll(':scope > li nav').forEach(menu => {
            if (menu !== submenu) {
                close(menu);
            }
        });
    }

    /**
     * Sets the direction the menu will appear from, so that is it always visible to the user.
     * The bounding element does not have to be a parent of the menu.
     * The parent is used to calculate which direction the menu should open.
     *
     * @private
     * @param {HTMLElement} menu - The menu to set the open direction on
     * @returns {undefined}
     */
    function setOpenDirection(menu) {

        // Handle RTL and keeping within bottom boundary
        if (menu.classList.contains('open-horizontal') || menu.classList.contains('avoid-bottom')) {
            const menuRoot = menu.closest('[data-menu-root]');
            const boundingElement = menuRoot.boundingElement;
            const isRTL = menuRoot.style.direction === 'rtl';
            const parentRect = menu.parentNode.getBoundingClientRect();
            let directionClass = ['open-right'];
            let boundingElementRect;

            if (boundingElement === window) {
                boundingElementRect = {
                    left: 0,
                    right: window.innerWidth,
                    top: 0,
                    bottom: window.innerHeight
                };
            }
            else {
                boundingElementRect = boundingElement.getBoundingClientRect();
            }

            // Slide out sideways
            if (menu.classList.contains('open-horizontal')) {

                menu.classList.remove('open-right', 'open-left');

                // if it's RTL and there's space, or LTR and no space, open to the left
                if (isRTL && parentRect.left - boundingElementRect.left >= menu.offsetWidth
                    || !isRTL && boundingElementRect.right - parentRect.right < menu.offsetWidth) {
                    directionClass = ['open-left'];
                }
            }

            // if the submenu will go outside the boundary, move it up
            menu.classList.remove('open-above');
            if (parentRect.bottom + (menu.offsetHeight - parentRect.height) > boundingElementRect.bottom) {
                directionClass.push('open-above');
            }

            menu.classList.add(...directionClass);
        }
    }

    /**
     * Create the menu from a template and append it to a parent element
     *
     * @private
     * @param {HTMLElement} template - The template to be used for the menu
     * @param {HTMLElement} sibling - The element the menu will be attached after
     * @param {function} [callback] - Called after the menu is created (for click handlers, etc.)
     * @param {boolean} [isRTL=defaultIsRTL] - Whether the layout is RTL
     * @param {HTMLElement} [boundingElement=document.body] - The element the menu should not extend outside of
     * @param {number} [animationDuration=defaultAnimationDuration] - The duration of the close animation (in ms)
     * @returns {HTMLElement} The menu element
     */
    function create({
        template,
        sibling,
        callback,
        isRTL = defaultIsRTL,
        boundingElement = window,
        animationDuration = defaultAnimationDuration
    }) {
        const menuElement = createMenuElement(template, isRTL, boundingElement, animationDuration);
        submenuHovers(menuElement);
        attach(menuElement, sibling);
        if (callback) {
            callback();
        }
        return menuElement;
    }

    /**
     * @param {HTMLElement} menu - The menu/submenu to clean up
     * @private
     */
    const _cleanup = (menu) => {
        if (menu.openingTimeout) {
            menu.openingTimeout.abort();
            menu.openingTimeout = null;
        }
        if (menu.closingTimeout) {
            menu.closingTimeout.abort();
            menu.closingTimeout = null;
        }
    };

    /**
     * Open a menu or submenu.
     *
     * @private
     * @async
     * @param {HTMLElement} menu - The menu/submenu to open
     * @returns {Promise} Resolves after the animation is complete
     */
    async function open(menu) {
        const menuRoot = menu.closest('[data-menu-root]');

        _cleanup(menu);
        menu.classList.remove('closing');
        menu.classList.add('opening');
        menu.setAttribute('aria-expanded', 'true');
        setOpenDirection(menu);
        requestAnimationFrame(() => menu.classList.add('visible'));
        menu.openingTimeout = tSleep((menuRoot.animationDuration + 10) / 1e3);
        return menu.openingTimeout.then(() => menu.classList.remove('opening'));
    }

    /**
     * Close a menu or submenu.
     *
     * @private
     * @param {HTMLElement} menu - The menu/submenu to close
     * @returns {Promise} Resolves after the animation is complete
     */
    async function close(menu) {
        if (menu) {
            _cleanup(menu);
            const menuRoot = menu.closest('[data-menu-root]');

            if (menuRoot) {
                menu.classList.add('closing');
                menu.classList.remove('opening', 'visible');
                menu.closingTimeout = tSleep(menuRoot.animationDuration / 1e3);
                return menu.closingTimeout.then(() => {
                    menu.classList.remove('closing');
                    menu.setAttribute('aria-expanded', false);
                });
            }
        }
    }

    /**
     * Toggle a menu open/closed.
     *
     * @private
     * @async
     * @param {HTMLElement} menu - The menu/submenu to toggle
     * @returns {undefined}
     */
    async function toggle(menu) {
        // closed or closing
        if (menu.getAttribute('aria-expanded') === 'false' || menu.classList.contains('closing')) {
            await open(menu);
        }
        else {
            await close(menu);
        }
    }

    /**
     * Removes the menu from the DOM.
     *
     * @private
     * @async
     * @param {HTMLElement} menu - The menu to be removed
     * @param {function} [callback] - Called after the menu is destroyed
     * @returns {undefined}
     */
    async function destroy(menu, callback) {
        await close(menu);
        menu.remove();
        if (callback) {
            callback();
        }
    }

    // API
    return freeze({
        /**
         * Create the menu from a template and append it to a parent element
         *
         * @public
         * @see create
         */
        create,

        /**
         * Open a menu or submenu.
         *
         * @public
         * @see open
         */
        open,

        /**
         * Close a menu or submenu.
         *
         * @public
         * @see close
         */
        close,

        /**
         * Toggle a menu open/closed.
         *
         * @public
         * @async
         * @see toggle
         */
        toggle,

        /**
         * Removes the menu from the DOM.
         *
         * @public
         * @async
         * @see destroy
         */
        destroy
    });
});

((scope) => {
    'use strict';

    class DragSelect {
        /**
         * @param {HTMLElement} el Element to add the event listeners to
         * @param {Object.<String, any>} data Drag data
         * @param {String[]} [data.allowedClasses] Additional classes allowed to trigger drag events
         * @param {Number} [data.scrollMargin] Area on where to trigger vertical scroll
         * @param {Function} [data.onDragStart] Method to call when the mousedown is triggered
         * @param {Function} [data.onDragMove] Method to call when the select area is about to re-render
         * @param {Function} [data.onDragEnd] Method to call when the mouse button is released
         * @param {Function} [data.getScrollTop] Method to retrieve scroll position
         * @param {Function} [data.onScrollUp] Method to call when scroll up is needed
         * @param {Function} [data.onScrollDown] Method to call when scroll down is needed
         */
        constructor(
            el,
            {
                allowedClasses,
                onDragStart,
                onDragMove,
                onDragEnd,
                scrollMargin,
                onScrollUp,
                onScrollDown,
                getScrollTop
            }) {
            if (el) {
                this.el = el;

                this.createDragArea();
                this.startListening(el, allowedClasses);
                this.scrollMargin = scrollMargin || 50;

                this.onScrollUp = onScrollUp || nop;
                this.onScrollDown = onScrollDown || nop;
                this.onDragStart = onDragStart || nop;
                this.onDragMove = onDragMove || nop;
                this.onDragEnd = onDragEnd || nop;

                this.getScrollTop = typeof getScrollTop === 'function' ? getScrollTop : () => el.scrollTop;
                this._disabled = false;
            }
        }

        get disabled() {
            return this._disabled;
        }

        /**
         * @param {Boolean} status Whether the drag events should be ignored or not
         * @returns {void}
         */
        set disabled(status) {
            this._disabled = status;
        }

        updatePosition(l, r, t, b, { x, y, right, bottom }) {
            if (l < x) {
                l = x;
            }

            if (t < y) {
                t = y;
            }

            if (r >= right) {
                r = right - 2;
            }

            if (b >= bottom) {
                b = bottom - 2;
            }

            this.area.style.left = l + 'px';
            this.area.style.width = (r - l) + 'px';
            this.area.style.top = t + 'px';
            this.area.style.height = (b - t) + 'px';
        }

        createDragArea() {
            this.area = document.createElement('div');
            this.area.className = 'ui-selectable-helper';
        }

        startListening(el, cl) {
            // Disposing the previous events, if any
            this.dispose();

            let scrollTimeout = null;

            this._disposeDown = MComponent.listen(document, 'mousedown', (evt) => {
                const { target, pageX: left, pageY: top } = evt;

                if (target !== el
                    && (!Array.isArray(cl)
                        || !cl.length
                        || !cl.some(c => target.classList.contains(c)))) {
                    return true;
                }

                const rect = el.getBoundingClientRect();

                if (scrollTimeout) {
                    clearTimeout(scrollTimeout);
                }

                const initScrollTop = this.getScrollTop();
                let yCorrection = 0;
                let mouseX = left;
                let mouseY = top;
                this.isDragging = false;

                const handleMovement = (moveEvt) => {
                    if (this._disabled) {
                        return;
                    }

                    const vals = [];
                    const { pageX: newX, pageY: newY } = moveEvt;

                    if (!this.isDragging) {
                        this.isDragging = true;

                        document.body.append(this.area);

                        if (this.onDragStart) {
                            this.onDragStart(left - rect.x, top - rect.y, evt);
                        }
                    }

                    mouseX = newX;
                    mouseY = newY;

                    if (newX > left) {
                        vals.push(left, newX);
                    }
                    else {
                        vals.push(newX, left);
                    }

                    if (newY > top - yCorrection) {
                        vals.push(top - yCorrection, newY);
                    }
                    else {
                        vals.push(newY, top - yCorrection);
                    }

                    this.updatePosition(...vals, rect);

                    if (this.onScrollDown && newY >= rect.bottom - this.scrollMargin) {
                        this.onScrollDown();
                    }
                    else if (this.onScrollUp && newY <= rect.y + this.scrollMargin) {
                        this.onScrollUp();
                    }

                    if (this.onDragMove) {
                        let xPos = 0;
                        let yPos = 0;

                        if (newX > rect.right) {
                            xPos = el.clientWidth;
                        }
                        else if (newX > rect.x) {
                            xPos = newX - rect.x;
                        }

                        if (newY > rect.bottom) {
                            yPos = el.clientHeight;
                        }
                        else if (newY > rect.y) {
                            yPos = newY - rect.y;
                        }

                        this.onDragMove(xPos, yPos, moveEvt);
                    }
                };

                this._disposeMove = MComponent.listen(document, 'mousemove', handleMovement);

                this._disposeUp = MComponent.listen(document, 'mouseup', (upEvt) => {
                    this.disposeEvent('Move');
                    this.disposeEvent('Up');
                    this.disposeEvent('Scroll');
                    this.disposeEvent('Over');

                    if (this.isDragging) {
                        this.isDragging = false;

                        if (this.onDragEnd) {
                            this.onDragEnd(true, yCorrection, this.area.getBoundingClientRect(), upEvt);
                        }

                        document.body.removeChild(this.area);
                    }
                    else {
                        this.onDragEnd(false, 0, null, upEvt);
                    }
                });

                this._disposeScroll = MComponent.listen(el, 'scroll', () => {
                    if (!this.isDragging) {
                        return;
                    }

                    const newCorrection = this.getScrollTop() - initScrollTop;
                    const diff = newCorrection - yCorrection;
                    yCorrection = newCorrection;

                    if (!yCorrection || !diff) {
                        return;
                    }

                    let t = (diff) ? mouseY - (rect.bottom - this.scrollMargin) : rect.y + this.scrollMargin - mouseY;

                    if (t > 50) {
                        t = 50;
                    }

                    scrollTimeout = setTimeout(() => {
                        if (this.isDragging) {
                            handleMovement({ pageX: mouseX, pageY: mouseY });
                        }
                    }, 500 / t);
                });

                return true;
            });
        }

        scrollUp(rate) {
            this.onScrollUp(rate);
            this.scrollUp(rate);
        }

        disposeEvent(key) {
            key = '_dispose' + key;

            if (this[key]) {
                this[key]();
                delete this[key];
            }
        }

        dispose() {
            this.disposeEvent('Down');
            this.disposeEvent('Up');
            this.disposeEvent('Move');
            this.disposeEvent('Scroll');
            this.disposeEvent('Over');
        }
    }

    scope.dragSelect = DragSelect;
})(mega.ui);

// initialising onboarding v4

// Bump this version number if changes are required in an existing section or if required to reduce complexity.
window.ONBOARD_VERSION = 1;
window.OBV4_FLAGS = {
    OBV4: 'obv4f',
    CLOUD_DRIVE: 'obcd',
    CLOUD_DRIVE_UPLOAD: 'obcduf',
    CLOUD_DRIVE_MANAGE_FILES: 'obcdmyf',
    CLOUD_DRIVE_MEGASYNC: 'obcdda',
    CHAT: 'obmc',
    CHAT_OPEN: 'obmcnw',
    CHAT_NAV: 'obmclp',
    CHAT_CHATS_PANE: 'obmccp',
    CHAT_MEETINGS_PANE: 'obmcmp',
    CHAT_CONTACT_PANE: 'obmcco',
    CHAT_SCHEDULE_NEW: 'obmcsn',
    CHAT_SCHEDULE_ADDED: 'obmcsa',
    CHAT_SCHEDULE_CONF: 'obmcsc',
    CHAT_SCHEDULE_OCCUR: 'obmcso',
    CHAT_SCHEDULE_START: 'obmcss',
    CHAT_SCHEDULE_PAST: 'obmcsp',
    CHAT_FEEDBACK: 'obmcfb',
    CHAT_FEEDBACK_NEW: 'obmcfn',
    CHAT_CALL_UI: 'obmcui',
    CHAT_CALL_RECORDING: 'obmcrec',
    CHAT_CALL_RAISE: 'obmcrai',
    // New onboarding flags to be added at the end of this object. Don't change the order!!!!
};

mBroadcaster.addListener('fm:initialized', () => {
    'use strict';

    // If user is visiting folderlink, or not complete registration do not show Onboarding V4.
    if (folderlink || u_type < 3) {
        return;
    }

    const upgradeFrom = fmconfig.obVer ?
        fmconfig.obVer < ONBOARD_VERSION ? fmconfig.obVer : false
        : -1;
    if (upgradeFrom) {
        mega.config.set('obVer', ONBOARD_VERSION);
    }

    const flagMap = attribCache.bitMapsManager.exists('obv4')
        ? attribCache.bitMapsManager.get('obv4')
        : new MegaDataBitMap('obv4', false, Object.values(OBV4_FLAGS));

    flagMap.isReady().then((res) => {
        if (res) {
            // ENOENT so migrate any old flags to this attribute
            for (const flag of Object.values(OBV4_FLAGS)) {
                let val = typeof fmconfig[flag] === 'undefined' || fmconfig[flag] === 0 ? 0 : 1;
                if (fmconfig.obrev) {
                    val ^= 1;
                }
                flagMap.setSync(flag, val, true);
            }
            flagMap.commit().catch(dump);
        }

        // If new user then we can ignore the first chat step
        if (u_attr.since >= 1659398400) {
            flagMap.setSync(OBV4_FLAGS.CHAT_NAV, 1);
            flagMap.safeCommit();
            // Show the new user onboarding dot when chat is ready.
            const handleFirstChatStep = () => {
                const $mcNavDot = $('.nw-fm-left-icon.conversations .onboarding-highlight-dot', fmholder);
                if (!flagMap.getSync(OBV4_FLAGS.CHAT_OPEN) && !M.chat) {
                    $('.dark-tooltip', $mcNavDot.parent().addClass('w-onboard')).addClass('hidden');
                    $mcNavDot.removeClass('hidden');
                }

                mBroadcaster.addListener('pagechange', () => {
                    if (M.chat) {
                        flagMap.setSync(OBV4_FLAGS.CHAT_OPEN, 1);
                        flagMap.safeCommit();
                        $mcNavDot.addClass('hidden');
                        $('.dark-tooltip', $mcNavDot.parent().removeClass('w-onboard')).removeClass('hidden');

                        return 0xDEAD;
                    }
                });
            };
            if (megaChatIsReady) {
                if (M.chat) {
                    // Already on chat so just skip
                    flagMap.setSync(OBV4_FLAGS.CHAT_OPEN, 1);
                    flagMap.safeCommit();
                }
                else {
                    handleFirstChatStep();
                }
            }
            else {
                mBroadcaster.once('chat_initialized', () => handleFirstChatStep());
            }
        }
        else {
            let upgraded = false;
            if (upgradeFrom !== false && upgradeFrom < 1) {
                // This is the version where the new chat path was added so convert to it.
                // Existing users shall only see the scheduled meetings changes
                flagMap.setSync(OBV4_FLAGS.CHAT_NAV, 1);
                flagMap.setSync(OBV4_FLAGS.CHAT_CHATS_PANE, 1);
                flagMap.setSync(OBV4_FLAGS.CHAT_MEETINGS_PANE, 1);
                flagMap.setSync(OBV4_FLAGS.CHAT_CONTACT_PANE, 1);
                // Set complete for now future schedule steps will reset it
                flagMap.setSync(OBV4_FLAGS.CHAT, 0);
                upgraded = true;
            }


            // Future upgrades may be added here


            if (upgraded) {
                flagMap.safeCommit();
            }
        }

        if (u_attr.since <= 1674432000) {
            flagMap.setSync(OBV4_FLAGS.CHAT_FEEDBACK_NEW, 1);
            flagMap.safeCommit();
        }

        if (mega.ui.onboarding) {
            mBroadcaster.addListener('pagechange', () => {
                // Hide the control panel while the page change is finishing up.
                $('.onboarding-control-panel').addClass('hidden');
                onIdle(mega.ui.onboarding.start.bind(mega.ui.onboarding));
            });
            mega.ui.onboarding.start();
        }
    }).catch(dump);

    // Onboarding Flow map. This need to be set carefully for design flow on each section.
    // Instruction requires to be place on later stage.
    const obMap = {
        'cloud-drive': {
            title: l[20556],
            flag: OBV4_FLAGS.CLOUD_DRIVE,
            steps: [
                {
                    name: l[372],
                    flag: OBV4_FLAGS.CLOUD_DRIVE_UPLOAD,
                    actions: [
                        {
                            type: 'showDialog',
                            dialogTitle: l.onboard_v4_upload_dialog_title,
                            dialogDesc: l.onboard_v4_upload_dialog_desc,
                            targetElmClass: '.button.fm-uploads',
                            targetElmPosition: 'left bottom',
                            targetHotSpot: true,
                            markComplete: true
                        }
                    ]
                },
                {
                    name: l.onboard_v4_manage_file_control_button,
                    flag: OBV4_FLAGS.CLOUD_DRIVE_MANAGE_FILES,
                    get prerequisiteCondition() {
                        return M.v.length !== 0;
                    },
                    prerequisiteWarning: l.onboard_v4_manage_file_prerequisite_warning,
                    actions: [
                        {
                            type: 'showDialog',
                            dialogTitle: l.onboard_v4_manage_file_dialog_title,
                            dialogDesc: l.onboard_v4_manage_file_dialog_desc,
                            targetElmClass: '.megaListItem:first',
                            get targetElmPosition() {
                                return M.viewmode ? 'right' : 'bottom';
                            },
                            markComplete: true,
                            nextActionTrigger: 'contextmenu'
                        },
                        {
                            type: 'markContextMenu',
                            targetElmClass: [
                                '.dropdown.context.files-menu a.sh4r1ng-item',
                                '.dropdown.context.files-menu a.getlink-item'
                            ],
                            targetDescription: [
                                l.onboard_v4_manage_file_context_desc_1,
                                l.onboard_v4_manage_file_context_desc_2
                            ],
                            contextElmClass: '.megaListItem:first',
                        }
                    ]
                },
                {
                    name: l[956],
                    flag: OBV4_FLAGS.CLOUD_DRIVE_MEGASYNC,
                    actions: [
                        {
                            type: 'showExtDialog',
                            targetElmClass: '.mega-dialog.mega-desktopapp-download',
                            dialogInitFunc: initDownloadDesktopAppDialog,
                            markComplete: true
                        }
                    ]
                }
            ]
        },
        chat: {
            title: 'MEGA Chat',
            flag: OBV4_FLAGS.CHAT,
            dismissNoConfirm: true,
            steps: [
                {
                    name: 'MEGA Chat Left Pane',
                    flag: OBV4_FLAGS.CHAT_NAV,
                    actions: [
                        {
                            type: 'showDialog',
                            dialogClass: 'mcob',
                            dialogTitle: l.onboard_megachat_dlg1_title,
                            dialogDesc: l.onboard_megachat_dlg1_text,
                            dialogNext: l.onboard_megachat_dlg1_btn,
                            targetElmClass: '.conversationsApp .lhp-nav',
                            targetElmPosition: 'right bottom',
                            markComplete: true,
                            ignoreBgClick: '.conversationsApp',
                        }
                    ]
                },
                {
                    name: 'Chats',
                    flag: OBV4_FLAGS.CHAT_CHATS_PANE,
                    actions: [
                        {
                            type: 'showDialog',
                            dialogClass: 'mcob',
                            dialogTitle: l.onboard_megachat_dlg2_title,
                            dialogDesc: l.onboard_megachat_dlg2_text,
                            targetElmClass: '.conversationsApp .conversations-category',
                            targetElmPosition: 'right',
                            markComplete: true,
                            ignoreBgClick: '.conversationsApp',
                        }
                    ]
                },
                {
                    name: 'Meetings',
                    flag: OBV4_FLAGS.CHAT_MEETINGS_PANE,
                    actions: [
                        {
                            type: 'showDialog',
                            dialogClass: 'mcob',
                            dialogTitle: l.onboard_megachat_dlg3_title,
                            dialogDesc: l.onboard_megachat_dlg3_text,
                            targetElmClass: '.conversationsApp .lhp-nav .lhp-meetings-tab',
                            targetElmPosition: 'bottom right',
                            markComplete: true,
                            ignoreBgClick: '.conversationsApp',
                        }
                    ]
                },
                {
                    name: 'Contacts',
                    flag: OBV4_FLAGS.CHAT_CONTACT_PANE,
                    actions: [
                        {
                            type: 'showDialog',
                            dialogClass: 'mcob',
                            dialogTitle: l.onboard_megachat_dlg4_title,
                            dialogDesc: l.onboard_megachat_dlg4_text,
                            targetElmClass: '.conversationsApp .lhp-nav .lhp-contacts-tab',
                            targetElmPosition: 'bottom right',
                            markComplete: true,
                            ignoreBgClick: '.conversationsApp',
                        }
                    ]
                },
                {
                    name: 'Schedule available',
                    flag: OBV4_FLAGS.CHAT_SCHEDULE_NEW,
                    get prerequisiteCondition() {
                        return megaChatIsReady && megaChat.plugins.chatOnboarding.canShowScheduledNew;
                    },
                    actions: [
                        {
                            type: 'showDialog',
                            dialogClass: 'mcob',
                            dialogTitle: l.onboard_megachat_dlg5_title,
                            dialogDesc: l.onboard_megachat_dlg5_text,
                            targetElmClass: '.conversationsApp .lhp-nav .lhp-meetings-tab',
                            targetElmPosition: 'bottom right',
                            markComplete: true,
                            ignoreBgClick: '.conversationsApp',
                            dialogNext: l.onboard_try_scheduled,
                            dialogSkip: l[148],
                            postComplete: () => megaChat.trigger(megaChat.plugins.meetingsManager.EVENTS.EDIT, null),
                        }
                    ]
                },
                {
                    name: 'Schedule created',
                    flag: OBV4_FLAGS.CHAT_SCHEDULE_ADDED,
                    get prerequisiteCondition() {
                        return megaChatIsReady && !!megaChat.scheduledMeetings.length &&
                            megaChat.plugins.chatOnboarding.isMeetingsTab;
                    },
                    actions: [
                        {
                            type: 'showDialog',
                            dialogClass: 'mcob',
                            dialogTitle: l.onboard_megachat_dlg6_title,
                            dialogDesc: l.onboard_megachat_dlg6_text,
                            targetElmClass: `.conversationsApp .lhp-conversations ul.conversations-pane
                                             li.upcoming-conversation.active`,
                            targetElmPosition: 'right',
                            markComplete: true,
                            ignoreBgClick: '.conversationsApp',
                            dialogNext: l.onboard_schedule_tour_start,
                            postComplete: () => {
                                // The plugin needs this flag set immediately to block the next step correctly.
                                megaChat.plugins.chatOnboarding
                                    .handleFlagChange(null, null, OBV4_FLAGS.CHAT_SCHEDULE_ADDED, 1);
                                megaChat.plugins.chatOnboarding.checkAndShowStep();
                            },
                        }
                    ],
                },
                {
                    name: 'Schedule options',
                    flag: OBV4_FLAGS.CHAT_SCHEDULE_CONF,
                    get prerequisiteCondition() {
                        return M.chat && megaChatIsReady
                            && megaChat.plugins.chatOnboarding.currentChatIsScheduled
                            && !megaChat.chatUIFlags.convPanelCollapse
                            && !megaChat.plugins.chatOnboarding.willShowOccurrences;
                    },
                    actions: [
                        {
                            type: 'showDialog',
                            dialogClass: 'mcob',
                            dialogTitle: l.onboard_megachat_dlg7a_title,
                            dialogDesc: l.onboard_megachat_dlg7a_text,
                            targetElmClass: `.conversationsApp .conversation-panel:not(.hidden)
                                             .chatroom-options-panel .chat-dropdown.header`,
                            targetElmPosition: 'left',
                            ignoreBgClick: '.conversationsApp',
                            markComplete: true,
                        }
                    ],
                },
                {
                    name: 'Schedule start early',
                    flag: OBV4_FLAGS.CHAT_SCHEDULE_START,
                    get prerequisiteCondition() {
                        if (!M.chat || !megaChatIsReady) {
                            return false;
                        }
                        const room = megaChat.getCurrentRoom();
                        return room && !!room.scheduledMeeting && room.state === ChatRoom.STATE.READY;
                    },
                    actions: [
                        {
                            type: 'showDialog',
                            dialogClass: 'mcob',
                            dialogTitle: l.onboard_megachat_dlg8_title,
                            dialogDesc: l.onboard_megachat_dlg8_text,
                            targetElmClass: '.conversationsApp .in-call-notif:visible',
                            targetElmPosition: 'bottom 20',
                            ignoreBgClick: '.conversationsApp',
                            markComplete: true,
                        }
                    ],
                },
                {
                    name: 'Schedule past meetings',
                    flag: OBV4_FLAGS.CHAT_SCHEDULE_PAST,
                    get prerequisiteCondition() {
                        return megaChatIsReady && M.chat && megaChat.plugins.chatOnboarding.isMeetingsTab;
                    },
                    actions: [
                        {
                            type: 'showDialog',
                            dialogClass: 'mcob',
                            dialogTitle: l.onboard_megachat_dlg9_title,
                            dialogDesc: '',
                            targetElmClass:
                                `.conversationsApp .lhp-conversations .category-past`,
                            targetElmPosition: 'right',
                            ignoreBgClick: '.conversationsApp',
                            markComplete: true,
                        }
                    ],
                },
                {
                    name: 'Feedback',
                    flag: OBV4_FLAGS.CHAT_FEEDBACK,
                    actions: [
                        {
                            type: 'showDialog',
                            dialogClass: 'mcob',
                            dialogTitle: l.onboard_megachat_dlg10_title,
                            dialogDesc: l.onboard_megachat_dlg10_text,
                            targetElmClass: '#fmholder button.js-more-menu.js-top-buttons',
                            targetElmPosition: 'left bottom',
                            targetHotSpot: true,
                            markComplete: true,
                            skipHidden: true,
                            ignoreBgClick: '.conversationsApp',
                            dialogNext: l[726],
                        }
                    ]
                }
            ]
        }
    };


    // If this is an old user don't show them the cloud-drive onboarding v4
    if (!(u_attr.since > 1631664000 || localStorage.obv4test)) {
        delete obMap['cloud-drive'];
    }

    // Main controller level of whole OBv4 include section start, reset, initialising.
    class OnboardV4 {

        /**
         * OnboardV4
         * @constructor
         *
         * @param {object} map Map used to create Sections and corresponding Steps
         * @param {MegaDataBitMap} flagStorage The onboarding flag storage
         */
        constructor(map, flagStorage) {

            this.map = map;
            this.sections = Object.create(null);
            this.flagStorage = flagStorage;
        }

        start() {

            const {currentSection} = this;
            const {currentSectionName} = this;

            // User revisit this section
            if (currentSection) {
                currentSection.init();
            }
            // User visit this section first time lets start
            else {
                // eslint-disable-next-line no-use-before-define
                this.sections[currentSectionName] = new OnboardV4Section(this.map[currentSectionName], this);
            }
        }

        // Delete flag for testing purpose.
        reset(prefix) {

            // this is only for debugging
            if (!d) {
                return;
            }

            let obflags = Object.values(OBV4_FLAGS);

            if (prefix) {
                obflags = obflags.filter(flag => flag.startsWith(prefix));
            }

            for (var i = obflags.length; i--;) {
                this.flagStorage.setSync(obflags[i], 0);
            }
            this.flagStorage.safeCommit();
        }

        get currentSectionName() {

            switch (M.currentrootid) {
                case M.RootID: return 'cloud-drive';
                case M.InboxID: return 'inbox';
                case M.RubbishID: return 'rubbish-bin';
                case 'chat': return 'chat';
                default: return M.currentrootid === undefined ? M.currentdirid : M.currentrootid;
            }
        }

        get currentSection() {

            return this.sections[this.currentSectionName];
        }
    }

    // Section(Page) level like Clouddrive, Chat, Backup, Settings, etc.
    class OnboardV4Section {

        constructor(map, parent) {

            this.map = map;
            this.steps = [];
            this.parent = parent;
            this.init();
        }

        init() {
            // This section is completed let move on.
            if (!this.map || this.isComplete || isPublicLink()) {
                $('.onboarding-control-panel').addClass('hidden');

                return;
            }

            this.prepareControlPanel();
            this.bindControlPanelEvents();
            this.hotspotNextStep();
        }

        get currentStep() {
            return this.steps[this.currentStepIndex];
        }

        get isComplete() {
            return !!this.parent.flagStorage.getSync(this.map.flag);
        }

        prepareControlPanel() {

            const currentSteps = this.map.steps;

            if (!currentSteps) {
                return;
            }

            let html = '';

            this.$obControlPanel = $('.onboarding-control-panel').removeClass('hidden');

            $('.onboarding-control-panel-title', this.$obControlPanel).text(this.map.title);

            for (let i = 0; i < currentSteps.length; i++) {

                html += `<button class="onboarding-step-link mega-button action no-hover">
                            <div class="onboarding-step mega-button icon">
                                <i class="onboarding-step-complete-icon sprite-fm-mono icon-check"></i>
                                <span class="onboarding-step-count">${i + 1}</span>
                            </div>
                            <span>${escapeHTML(currentSteps[i].name)}</span>
                        </button>`;

                this.steps[i] = new OnboardV4Step(this, i ,currentSteps[i], this.$obControlPanel);
            }

            $('.onboarding-control-panel-step', this.$obControlPanel).safeHTML(html);
        }

        bindControlPanelEvents() {

            $('.onboarding-step-link', this.$obControlPanel).rebind('click.onboarding', e => {

                const clickedStep = $('.onboarding-step-count', e.currentTarget).text() - 1;

                if (clickedStep === this.currentStepIndex) {
                    return false;
                }

                onIdle(() => {
                    this.startNextOpenSteps(clickedStep);
                });

                return false;
            });

            $('.onboarding-control-panel-content .js-close', this.$obControlPanel)
                .rebind('click.onboarding', this.showConfirmDismiss.bind(this));
            $('.onboarding-control-panel-complete .js-close', this.$obControlPanel)
                .rebind('click.onboarding', this.markSectionComplete.bind(this));
            $('.js-dismiss', this.$obControlPanel).rebind('click.onboarding', this.markSectionComplete.bind(this));
            $('.js-dismiss-cancel', this.$obControlPanel)
                .rebind('click.onboarding', this.hideConfirmDismiss.bind(this));
            $('.onboarding-step-link', this.$obControlPanel).rebind('mouseenter.onboarding', e => {

                const stepIndex = e.currentTarget.querySelector('.onboarding-step-count').textContent;
                if (this.steps && this.steps[stepIndex - 1]) {
                    this.steps[stepIndex - 1].checkPrerequisite();
                }
            });
        }

        showConfirmDismiss() {

            this.hotspotNextStep();
            this.currentStepIndex = undefined;
            if (this.map.dismissNoConfirm) {
                return this.markSectionComplete();
            }

            $('.onboarding-control-panel-dismiss', this.$obControlPanel).removeClass('hidden');
            $('.onboarding-control-panel-content', this.$obControlPanel).addClass('hidden');
        }

        hideConfirmDismiss() {

            $('.onboarding-control-panel-dismiss', this.$obControlPanel).addClass('hidden');
            $('.onboarding-control-panel-content', this.$obControlPanel).removeClass('hidden');
        }

        showCompleteMessage() {

            clickURLs();

            $('.onboarding-control-panel-complete', this.$obControlPanel).removeClass('hidden');
            $('.onboarding-control-panel-content', this.$obControlPanel).addClass('hidden');

            this.setSectionComplete();
        }

        searchNextOpenStep() {

            let nextStep = false;

            for (let i = 0; i < this.steps.length; i++) {

                if (this.steps[i].isComplete) {
                    this.steps[i].markDone();
                }
                else if (nextStep === false){
                    nextStep = i;
                }
            }

            return nextStep;
        }

        hotspotNextStep() {

            const nextStepIndex = this.searchNextOpenStep();

            if (nextStepIndex === false) {

                // This section is completed lets show user there is no more.
                this.showCompleteMessage();
                return false;
            }

            this.steps[nextStepIndex].markHotspot();
        }

        startNextOpenSteps(step) {

            if (this.steps.length === 0 || this.steps[step] && this.steps[step].isComplete) {
                return false;
            }

            // Just searching next step available
            if (step === undefined) {
                this.currentStepIndex = this.searchNextOpenStep();

                if (this.currentStepIndex === false) {

                    // This section is completed lets show user there is no more.
                    this.showCompleteMessage();
                    return false;
                }
            }
            // Manually triggered by event such as click
            else {
                this.currentStepIndex = step;
            }

            if (!this.currentStep.checkPrerequisite()) {

                if (!step) {
                    this.currentStep.showPrerequisiteMessage();
                }

                delete this.currentStepIndex;

                this.hotspotNextStep();

                return false;
            }

            this.currentStep.markActive();
            this.currentStep.currentActionIndex = 0;
            this.currentStep.executeAction();
        }

        // Mark section completed and hide onboarding control panel
        markSectionComplete() {

            this.$obControlPanel.addClass('hidden');
            this.setSectionComplete();
        }

        // set section completed on fmconfig
        setSectionComplete() {
            this.parent.flagStorage.setSync(this.map.flag, 1);
            this.parent.flagStorage.safeCommit();
        }
    }

    // Step level like Upload, File Management, Desktop app, etc.
    class OnboardV4Step {

        constructor(parent, index, map, $cp) {

            this.index = index;
            this.map = map;
            this.currentActionIndex = 0;
            this.$controlPanel = $cp;
            this.parentSection = parent;

            this.initActions();
        }

        checkPrerequisite() {

            if (this.map.prerequisiteCondition === false) {

                this.addPrerequisiteMessage();
                return false;
            }

            this.removePrerequisiteMessage();

            return true;
        }

        addPrerequisiteMessage() {

            this.$stepButton.addClass('simpletip').attr({
                'data-simpletip': this.map.prerequisiteWarning,
                'data-simpletipposition': 'bottom',
                'data-simpletip-class': 'bluetip medium-width theme-light-forced center-align',
            });
        }

        showPrerequisiteMessage() {

            this.$stepButton.addClass('manual-tip').trigger('mouseenter.simpletip');

            setTimeout(() => {
                this.$stepButton.removeClass('manual-tip').trigger('simpletipClose.internal');
            }, 4000);
        }

        removePrerequisiteMessage() {
            this.$stepButton.removeClass('simpletip').removeAttr(
                'data-simpletip data-simpletipposition data-simpletip-class data-simpletip-display-duration');
        }

        get $stepButton() {
            return $('.onboarding-step-link', this.$controlPanel).eq(this.index);
        }

        initActions() {

            this.actions = [];

            for (let i = 0; i < this.map.actions.length; i++) {
                this.actions[i] = new OnboardV4Action(this, this.map.actions[i]);
            }
        }

        executeAction() {

            this.actions[this.currentActionIndex].execute();
        }

        toNextAction() {

            this.currentActionIndex++;

            if (this.actions[this.currentActionIndex]) {
                this.executeAction();
            }
            else {
                this.parentSection.hotspotNextStep();
            }
        }

        get currentAction() {
            return this.actions[this.currentActionIndex];
        }

        get nextAction() {
            return this.actions[this.currentActionIndex + 1];
        }

        get isComplete() {
            return !!this.parentSection.parent.flagStorage.getSync(this.map.flag);
        }

        markHotspot() {

            delay('markingDelay', () => {

                if (this.parentSection.currentStepIndex !== this.index) {
                    $('.onboarding-step-link', this.$controlPanel).eq(this.index)
                        .removeClass('active').addClass('hotspot');
                }
            }, 1000);
        }

        markActive() {
            $('.onboarding-step-link', this.$controlPanel).removeClass('hotspot').eq(this.index).addClass('active');
        }

        markDeactive() {
            $('.onboarding-step-link', this.$controlPanel).eq(this.index).removeClass('active');
        }

        markDone() {

            $('.onboarding-step-link', this.$controlPanel).eq(this.index).removeClass('active').addClass('complete');

            this.parentSection.parent.flagStorage.setSync(this.map.flag, 1);
            this.parentSection.parent.flagStorage.safeCommit();
        }
    }

    // Action level of each step, like open dialog on upload section, context menu marking on File management, etc.
    class OnboardV4Action {

        constructor(parent, actionMap) {

            this.map = actionMap;
            this.type = actionMap.type;
            this.parentStep = parent;
        }

        execute() {

            const actionType = this.map.type;

            if (typeof this[actionType] === 'function') {
                this[actionType]();
            }
        }

        showDialog() {

            if (!$(this.map.targetElmClass).length) {
                return;
            }
            this.$dialog = $('#ob-dialog');

            M.safeShowDialog('onboardingDialog', () => {
                this.$dialog.removeClass('mcob').addClass(this.map.dialogClass || '');
                // Fill contents for the dialog
                $('#ob-dialog-title').text(this.map.dialogTitle);
                $('#ob-dialog-text').text(this.map.dialogDesc);
                $('.js-next span', this.$dialog).text(this.map.dialogNext || l[556]);
                $('.js-skip', this.$dialog)
                    .text(this.map.dialogSkip || l.onboard_v4_dialog_skip)
                    .removeClass('hidden')
                    .addClass(this.map.skipHidden ? 'hidden' : '');

                this.positionDialog();
                this.bindDialogEvents();

                return this.$dialog;
            });
        }

        positionDialog() {

            if (!$(this.map.targetElmClass).length) {
                // Just in case something odd happened with the DOM node.
                return;
            }
            // Position of the onboarding dialog
            let my = 'center top';
            let at = 'center bottom+6';
            let arrowAt = 'top';
            let hadHidden = false;

            switch (this.map.targetElmPosition) {
                case 'top':
                    my = 'center bottom';
                    at = 'center top-6';
                    arrowAt = 'bottom';
                    break;
                case 'left':
                    my = 'right center';
                    at = 'left-6 center';
                    arrowAt = 'right';
                    break;
                case 'right':
                    my = 'left center';
                    at = 'right+6 center';
                    arrowAt = 'left';
                    break;
                case 'left bottom':
                    my = 'right top';
                    at = 'left-6 bottom-2';
                    arrowAt = false;
                    break;
                case 'right bottom':
                    my = 'left center';
                    at = 'right+6 bottom';
                    arrowAt = 'left';
                    break;
                case 'bottom right':
                    my = 'left-42 bottom-8';
                    at = 'right-42 top';
                    arrowAt = 'top-left';
                    break;
                case 'bottom 20':
                    at = 'center bottom+26';
                    break;
            }

            if (this.map.targetHotSpot) {
                this.parentStep.parentSection.parent.$hotSpotNode
                    = $(this.map.targetElmClass).addClass('onboarding-hotspot-animation-rect');
            }

            // $.position bug escaping
            this.$dialog.removeAttr('style');

            // As hidden eleemnt cannot calculate collision with viewport edge, remove hidden temporarily
            if (this.$dialog.hasClass('hidden')) {
                this.$dialog.removeClass('hidden');
                hadHidden = true;
            }

            this.$dialog.position({
                my: my,
                at: at,
                of: this.map.targetElmClass,
                collision: 'flipfit',
                using: (obj, info) => {

                    if (arrowAt && arrowAt !== 'top-left') {
                        // Dialog position is moved due to collision on viewport swap arrow position
                        if (info.horizontal === 'right' && obj.left < info.target.left) {
                            arrowAt = 'right';
                        }
                        else if (info.horizontal === 'left' && obj.left > info.target.left) {
                            arrowAt = 'left';
                        }
                        else if (info.vertical === 'top' && obj.top > info.target.top) {
                            arrowAt = 'top';
                        }
                        else if (info.vertical === 'bottom' && obj.top < info.target.top) {
                            arrowAt = 'bottom';
                        }
                    }

                    this.$dialog.css(obj);
                }
            });

            if (arrowAt) {
                $('#ob-dialog-arrow', this.$dialog)
                    .removeClass('hidden top bottom left right top-left').addClass(arrowAt);
            }
            else {
                $('#ob-dialog-arrow', this.$dialog).addClass('hidden').removeClass('top bottom left right top-left');
            }

            // If it was temporary bug fixing hidden removal, add hidden back
            if (hadHidden) {
                this.$dialog.addClass('hidden');
            }
        }

        bindDialogEvents() {

            let __updFMUIListener;
            const __closeDialogAction = (noComplete) => {

                closeDialog();
                delete this.parentStep.parentSection.parent.$hotSpotNode;

                $('#fmholder').off('mouseup.onboarding');
                $('.fm-right-files-block .ui-selectable:visible:not(.hidden)').off('mousedown.onboarding');
                $('body').off('drop.onboarding');
                $(this.map.targetElmClass).off(`${this.map.nextActionTrigger}.onboarding`);
                $(window).off('resize.onboarding');
                $('.js-close', this.parentStep.$obControlPanel).off('click.obdialogdismiss');

                if (__updFMUIListener) {
                    mBroadcaster.removeListener(__updFMUIListener);
                }

                if (!noComplete && this.map.markComplete) {
                    this.parentStep.markDone();
                    if (typeof this.map.postComplete === 'function') {
                        this.map.postComplete();
                    }
                }
                else if (noComplete) {
                    this.parentStep.markDeactive();
                }
            };

            // There is next action trigger, if it happen on target, close dialog and move to next action.
            if (this.map.nextActionTrigger) {

                let $binded = $(this.map.targetElmClass).rebind(`${this.map.nextActionTrigger}.onboarding`, () => {

                    __closeDialogAction();
                    this.parentStep.toNextAction();
                });

                // when node update on File Manager, rebind target action trigger event to new target if required
                __updFMUIListener = mBroadcaster.addListener('updFileManagerUI', () => {

                    if (!$binded.is(this.map.targetElmClass)) {

                        $binded.off(`${this.map.nextActionTrigger}.onboarding`);

                        $binded = $(this.map.targetElmClass).rebind(`${this.map.nextActionTrigger}.onboarding`, () => {

                            __closeDialogAction();
                            this.parentStep.toNextAction();
                        });
                    }
                });
            }

            // User trigger mouse event on other than target, just close dialog and place hotspot on next step
            $('#fmholder').rebind('mouseup.onboarding', e => {

                // If there is nextActionTrigger, let that handle close dialog.
                const $target = $(e.target);
                if (
                    !this.map.nextActionTrigger
                    || !$target.is(this.map.targetElmClass)
                    || $target.parents(this.map.targetElmClass).length
                ) {
                    if (this.map.ignoreBgClick) {
                        if ($target.is(this.map.ignoreBgClick) || $target.parents(this.map.ignoreBgClick).length) {
                            return;
                        }
                        __closeDialogAction(true);
                        return;
                    }

                    __closeDialogAction();
                    this.parentStep.parentSection.hotspotNextStep();
                }
            });

            // Event for block view empty space, to not conflict with selection manger multi-selection event.
            $('.fm-right-files-block .ui-selectable:visible:not(.hidden)').rebind('mousedown.onboarding', e => {

                if (e.which === 1) {

                    if (this.map.ignoreBgClick) {
                        const $target = $(e.target);
                        if ($target.is(this.map.ignoreBgClick) || $target.parents(this.map.ignoreBgClick).length) {
                            return;
                        }
                        __closeDialogAction(true);
                        return;
                    }
                    __closeDialogAction();
                    this.parentStep.parentSection.hotspotNextStep();
                }
            });

            // Drag drop file will close the dialog and continue upload process
            $('body').rebind('drop.onboarding', (e) => {
                if (e.originalEvent && $(e.originalEvent.target).parents('.float-video').length) {
                    return;
                }
                __closeDialogAction();
                this.parentStep.parentSection.hotspotNextStep();
            });

            // Next button clicked, close dialog and move to next available step
            $('.js-next', this.$dialog).rebind('click.onboarding', () => {

                __closeDialogAction();
                this.parentStep.parentSection.startNextOpenSteps();
            });

            // Skip button clicked, close dialog and mark step as completed
            $('.js-skip', this.$dialog).rebind('click.onboarding', () => {

                __closeDialogAction(true);
                this.parentStep.parentSection.showConfirmDismiss();
            });

            $('.js-close', this.parentStep.$obControlPanel).rebind('click.obdialogdismiss', () => {

                __closeDialogAction(true);
            });

            $(window).rebind('resize.onboarding', this.positionDialog.bind(this));
        }

        markContextMenu() {

            mBroadcaster.once('showcontextmenu', () => {

                const targetSelector = this.map.targetElmClass.join();
                const html = '<div class="onboarding-highlight-dot"></div>';

                $(targetSelector).safeAppend(html);

                if (this.map.targetDescription) {

                    for (var i = this.map.targetDescription.length; i--;) {

                        $('.onboarding-highlight-dot', this.map.targetElmClass[i]).parent().addClass('simpletip').attr({
                            'data-simpletip': this.map.targetDescription[i],
                            'data-simpletipposition': 'right',
                            'data-simpletip-class': 'bluetip medium-width theme-light-forced'
                        });
                    }
                }

                mBroadcaster.once('contextmenuclose', () => {

                    $('.onboarding-highlight-dot', targetSelector).parent().removeClass('simpletip')
                        .removeAttr('data-simpletip data-simpletipposition data-simpletip-class');

                    $('.onboarding-highlight-dot', targetSelector).remove();

                    if (this.map.markComplete) {
                        this.parentStep.markDone();
                    }

                    this.parentStep.toNextAction();
                });
            });
        }

        showExtDialog() {

            this.$dialog = $(this.map.targetElmClass);
            this.parentStep.markDone();

            if (typeof this.map.dialogInitFunc === 'function') {
                this.map.dialogInitFunc();
            }
            else {
                safeShowDialog('onboardingDialog', this.$dialog);
            }

            mBroadcaster.once('closedialog', this.parentStep.toNextAction.bind(this.parentStep));
        }
    }

    mega.ui.onboarding = new OnboardV4(obMap, flagMap);
    mega.ui.onboardingFlags = OBV4_FLAGS;

    window.OnboardV4Action = OnboardV4Action;

    return 0xDEAD;
});

/**
 * Generic functions for SMS verification on mobile
 */
var sms = {

    /**A flag which if set updates the UI if they arrived from the login, suspended account flow */
    isSuspended: false,

    /**
     * Initialise the Close icon/button to close the dialog
     */
    initDialogCloseButton: function($dialog, $background) {

        'use strict';

        var $closeButton = $('button.js-close, .js-not-now-button', $dialog);

        // If they are suspended, don't show the close icon/button so they can't do anything else
        if (this.isSuspended) {
            $closeButton.addClass('hidden');
        }
        else {
            // On Close button tap
            $closeButton.rebind('click', () => {
                $dialog.addClass('hidden');
                $background.addClass('hidden');

                // This dialog is also used on the /smsdialog page, but if they used the Close/Not Now buttons on this
                // page they would be left with a blank background, so instead we load /login (or /fm if logged in).
                if (page === 'smsdialog') {
                    loadSubPage('login');
                }
            });
        }
    },

    /**
     * Update the language advertisement string 'Get 20 GB storage and 40 GB transfer quota for free when you...' with
     * the details from the API. If a non-achievement account, a different text will be rendered.
     * @param {Object} $textField The text field to be updated
     */
    renderAddPhoneText: function($textField) {

        'use strict';

        // Fetch all account data from the API
        M.accountData(function() {

            // Hide the loading dialog after request completes
            loadingDialog.hide();

            // Set string for non achievement account
            var langString = l[20411];  // Verifying your mobile will make it easier for your contacts to find you...

            // M.maf is cached in its getter, however, repeated gets will cause unnecessary checks.
            var ach = M.maf;
            sms.achievementUsed = ach && ach[9] && ach[9].rwd;

            // Make sure they are on an achievement account and not used, maf will be calculated once.
            if (typeof M.account.maf !== 'undefined' && !sms.achievementUsed) {
                // Convert storage and bandwidth to 'x GB'
                var bonuses = M.account.maf.u;
                var storage = bonuses[9][0];
                var transfer = bonuses[9][1];
                var storageQuotaFormatted = bytesToSize(storage, 0, 3);
                var transferQuotaFormatted = bytesToSize(transfer, 0, 3);

                // Update string to 'Get 20 GB storage and 40 GB transfer quota for free when you add your phone...'
                langString = l[20210].replace('%1', storageQuotaFormatted).replace('%2', transferQuotaFormatted);
            }

            // Update the page text
            $textField.text(langString);

        }, true);
    },

    /**
     * Reset the phone input form in the dialog if needs
     * @param {Object} $dialog  The dialog of phone verification
     * @returns {void}
     */
    resetPhoneInputForm: function($dialog) {

        'use strict';

        const $phoneInputPage = $('form.js-phone-input-page', $dialog);
        if ($phoneInputPage.length > 0) {
            // Reset the phone input page form
            $('.verify-ph-country .js-country-list .option', $phoneInputPage).removeClass('active')
                .attr('data-state', '');
            $('.verify-ph-country span', $phoneInputPage).text(l[996]);
            $('.js-phone-input', $phoneInputPage).val('');
        }
    }
};

/**
 * Functions for the SMS phone number input page
 */
sms.phoneInput = {

    /** The container dialog with the HTML for all the pages/screens */
    $dialog: null,

    /** The background overlay for the dialog */
    $background: null,

    /** The current page/screen in the flow */
    $page: null,

    /** The country name of the phone number */
    countryName: null,

    /** The two letter country code e.g. AU, CA, NZ, UK, US */
    countryIsoCode: null,

    /** The country international calling code from the previous page */
    countryCallCode: null,

    /** The phone number from the previous page */
    phoneNumber: null,

    /**
     * Initialise the page
     * @param {Boolean|undefined} isSuspended Sets a flag if the user was suspended and is coming from login flow
     */
    init: function(isSuspended) {

        'use strict';

        // Cache the page
        this.$dialog = $('.mega-dialog.verify-phone');
        this.$background = $('.fm-dialog-overlay');
        this.$page = $('.js-phone-input-page');

        // Set suspended flag
        if (isSuspended) {
            sms.isSuspended = true;
        }

        // Clear the phone input form if open the SMS dialog initially,
        // exceptional case is back from clicking back button on the verify code page.
        if (this.$dialog.hasClass('hidden')) {
            sms.resetPhoneInputForm(this.$dialog);
        }

        // Init functionality
        this.initDisplay();
        this.buildListOfCountries();
        this.initCountryPicker();
        this.initChangeAndKeyupHandler();
        this.initSendSmsButton();

        // Initialise the close button if applicable
        sms.initDialogCloseButton(this.$dialog, this.$background);

        // Show the page
        this.$dialog.removeClass('hidden');
        this.$background.removeClass('hidden').off('click');
        this.$page.removeClass('hidden');
    },

    /**
     * Initalise the text of the page depending on the way they arrived at the page
     */
    initDisplay: function() {

        'use strict';

        var $dialog = this.$dialog;
        var $headerText = $('.js-header-text', $dialog);
        var $allPages = $('form', $dialog);
        var $allFooters = $('.footer-container', $dialog);
        var $verifyIcon = $('.verify-ph-icon', $dialog);
        var $verifySuccessIcon = $('.verify-ph-success-icon', $dialog);
        var $bodyText = $('.js-body-text', this.$page);
        var $warningMessage = $('.js-warning-message', this.$page);
        var megaInput = new mega.ui.MegaInputs($('.js-phone-input', $dialog));

        // If coming from the login process where their account was suspended
        if (sms.isSuspended) {

            // Hide buttons using the class and change the text
            $dialog.addClass('suspended');
            $headerText.text(l[20212]);
            $bodyText.text(l[20209]);
        }
        else {
            // Otherwise must be coming from the achievement add phone process
            $headerText.text(l[20211]);

            // Set the xGB storage and xGB transfer quota text
            sms.renderAddPhoneText($bodyText);
        }

        // Hide any previous pages and warnings if returning
        $allPages.addClass('hidden');
        $allFooters.addClass('hidden');
        $warningMessage.removeClass('visible');
        $verifyIcon.removeClass('hidden');
        $verifySuccessIcon.addClass('hidden');
        $('aside.js-verify-success-page', $dialog).addClass('hidden');
    },

    /**
     * Fill the country picker dialog with a list of countries
     */
    buildListOfCountries: function() {

        'use strict';

        var $countryList = $('.js-country-list');
        var $countryItemTemplate = $('.option.template', $countryList);

        if ($('.dropdown-scroll .option', $countryList).length > 1) {
            return;
        }

        var countryOptions = '';

        // Build list of countries
        $.each(M.getCountries(), function(isoCode, countryName) {

            // Clone the template
            var $countryItem = $countryItemTemplate.clone().removeClass('template');

            // Get the country calling code e.g. 64 for NZ
            var countryCallCode = M.getCountryCallCode(isoCode);

            // Default option text is format: New Zealand (+64)
            var optionText = countryName + ' (+' + countryCallCode + ')';

            // If in Arabic it will be: 0064 New Zealand
            if (lang === 'ar') {
                optionText = countryName + ' 00' + countryCallCode;
            }

            // Create the option and set the ISO code and country name
            $countryItem.attr('data-country-iso-code', isoCode);
            $countryItem.attr('data-country-name', countryName);
            $countryItem.attr('data-country-call-code', countryCallCode);
            $countryItem.val(isoCode);
            $countryItem.text(optionText);

            // Append the HTML to the list of options
            countryOptions += $countryItem.prop('outerHTML');
        });

        // Render the countries
        $('.dropdown-scroll', $countryList).safeAppend(countryOptions);
    },

    /**
     * Initialise the country picker dialog to open on clicking the text input
     */
    initCountryPicker: function() {

        'use strict';

        var $countrySelect = $('.verify-ph-country', this.$page);
        var $countryDropdown = $('.js-country-list', $countrySelect);

        // Initialise with jQueryUI selectmenu
        bindDropdownEvents($countrySelect);

        // On select of the country in the picker
        $('.option', $countryDropdown).rebind('click.countryselect', function() {

            // Get the country call code and name
            var $this = $(this);
            var countryIsoCode = $this.attr('data-country-iso-code');
            var countryCallCode = M.getCountryCallCode(countryIsoCode);
            var countryName = M.getCountryName(countryIsoCode);
            var $selectMenuText = $('> span', $countrySelect);

            // Check that they didn't pick the blank option at the top
            if (typeof countryCallCode !== 'undefined') {

                // Put the call code first because of long country names
                $selectMenuText.text('(+' + countryCallCode + ') ' + countryName);
            }
            else {
                // Reset back to default state if blank option clicked
                $selectMenuText.text(l[481]);
            }
        });
    },

    /**
     * Initialise keyup handler to the select menu and input so the button gets enabled if everything is completed
     */
    initChangeAndKeyupHandler: function() {

        'use strict';

        var $countrySelector = $('.js-country-list', this.$page);
        var $phoneInput = $('.js-phone-input', this.$page);
        var $sendButton = $('.js-send-sms-button', this.$page);
        var $warningMessage = $('.js-warning-message', this.$page);

        var toggleButtonState = function() {
            let hideErrorMsg = true;
            const $countrySelect = $('.option[data-state="active"]', $countrySelector);
            const phoneInputEntered = $phoneInput.val();
            const countryCallCode = $countrySelect.attr('data-country-call-code');
            const stripedPhNum = M.stripPhoneNumber(countryCallCode, phoneInputEntered);
            const formattedPhoneNumber = `+${countryCallCode}${stripedPhNum}`;
            const validateResult = M.validatePhoneNumber(phoneInputEntered, countryCallCode);
            const checkOldNum = u_attr ? formattedPhoneNumber === u_attr.smsv : false;

            // If the fields are completed enable the button
            if ($countrySelect.length && $countrySelect.attr('data-country-iso-code').length > 1
                && validateResult
                && !checkOldNum) {
                $sendButton.removeClass('disabled');
            }
            else {
                // Otherwise disable the button
                $sendButton.addClass('disabled');

                if (phoneInputEntered.length && !validateResult) {
                    $warningMessage.addClass('visible').text(l.err_invalid_ph); // Phone format invalid
                    hideErrorMsg = false;
                }
            }

            if (hideErrorMsg) {
                // Hide old error message
                $warningMessage.removeClass('visible');
            }
        };

        // Add handlers to enable/disable button
        $('.option', $countrySelector).rebind('click.toggleVerifyButton', function() {
            toggleButtonState();
        });

        $phoneInput.rebind('keyup.toggleVerifyButton', function() {
            toggleButtonState();
        });

        // Prevent input of invalid chars
        $phoneInput.rebind('keypress.filterkeys', function(event) {

            var inputChar = String.fromCharCode(event.which);

            toggleButtonState();

            // If not an integer, prevent input from being entered
            if (!/[0-9]/.test(inputChar)) {
                event.preventDefault();
            }
        });
    },

    /**
     * Initialise the Send button to send a verification SMS to the user's phone
     */
    initSendSmsButton: function() {

        'use strict';

        var $countrySelector = $('.js-country-list', this.$page);
        var $phoneInput = $('.js-phone-input', this.$page);
        var $sendButton = $('.js-send-sms-button', this.$page);
        var $warningMessage = $('.js-warning-message', this.$page);

        var sendSMSToPhone = function() {
            var phoneNum = $phoneInput.val();
            var $selectedOption = $('.option[data-state="active"]', $countrySelector);
            var countryCallingCode = $selectedOption.attr('data-country-call-code');

            // Strip hyphens and whitespace, remove trunk code.
            // e.g. NZ 021-1234567 => 2112345567
            phoneNum = M.stripPhoneNumber(countryCallingCode, phoneNum);

            const formattedPhoneNumber = `+${countryCallingCode}${phoneNum}`;
            const validatedFormattedPhoneNumber = M.validatePhoneNumber(formattedPhoneNumber);

            if (!validatedFormattedPhoneNumber) {
                $sendButton.addClass('disabled');
                $warningMessage.addClass('visible').text(l.err_invalid_ph); // Phone format invalid
                return false;
            }

            // Get the phone number details
            var countryName = $selectedOption.attr('data-country-name');
            var countryCode = $selectedOption.attr('data-country-iso-code');

            // Prepare request
            var apiRequest = {a: 'smss', n: validatedFormattedPhoneNumber};

            // Add debug mode to test reset of the phone number so can be re-used (staging API only)
            if (localStorage.smsDebugMode) {
                apiRequest['to'] = 1;
            }

            // Send SMS to the phone
            api_req(apiRequest, {
                callback: function(apiResult) {

                    // Check for errors
                    if (apiResult === EACCESS) {
                        $warningMessage.addClass('visible').text(l[20393]); // Your phone number is already verified
                        $sendButton.addClass('disabled');
                    }
                    else if (apiResult === EEXIST) {
                        $warningMessage.addClass('visible').text(l[20394]); // Phone already in use by other account
                        $sendButton.addClass('disabled');
                    }
                    else if (apiResult === ETEMPUNAVAIL) {
                        $warningMessage.addClass('visible').text(l[20223]); // Too many attempts. Please try in x hours
                        $sendButton.addClass('disabled');
                    }
                    else if (apiResult < 0) {
                        $warningMessage.addClass('visible').text(l[47]); // Oops, something went wrong...
                        $sendButton.addClass('disabled');
                    }
                    else {
                        // Save the call code and phone number details to re-use on the next page if necessary
                        sms.phoneInput.countryName = countryName;
                        sms.phoneInput.countryIsoCode = countryCode;
                        sms.phoneInput.countryCallCode = countryCallingCode;
                        sms.phoneInput.phoneNumber = phoneNum;

                        // Hide the page
                        sms.phoneInput.$page.addClass('hidden');

                        // Load verify code page
                        sms.verifyCode.init();
                    }
                }
            });
        };

        // On Send button click
        $sendButton.rebind('click', () => {

            // Do not proceed the country code/phone is not selected/entered and the button is not active
            if ($sendButton.hasClass('disabled')) {
                return false;
            }

            if (u_attr === undefined || u_attr.smsv === undefined) {
                sendSMSToPhone();
            }
            else {
                // If it's to modify the phone number, have to remove the existing one firstly
                accountUI.account.profiles.removePhoneNumber().then(sendSMSToPhone).catch(dump);
            }
        });
    }
};

/**
 * Functions for the SMS code verification page
 */
sms.verifyCode = {

    /** The container dialog with the HTML for all the pages/screens */
    $dialog: null,

    /** The background overlay for the dialog */
    $background: null,

    /** The current page/screen in the flow of the dialog */
    $page: null,

    /**
     * Initialise the page
     */
    init: function() {

        'use strict';

        // Cache the page
        this.$dialog = $('.mega-dialog.verify-phone');
        this.$background = $('.fm-dialog-overlay');
        this.$page = $('.js-verify-code-page');

        // Init functionality
        this.initDisplay();
        this.initResendAndBackButton();
        this.initCodeInputHandlers();
        this.initVerifyButton();

        // Initialise the close button if applicable
        sms.initDialogCloseButton(this.$dialog, this.$background);

        // Show the page
        this.$dialog.removeClass('hidden');
        this.$background.removeClass('hidden');
        this.$page.removeClass('hidden');

        // Put the focus in the code input field after its visible
        this.$page.find('.js-verification-number-input').trigger('focus');
    },

    /**
     * Set/reset the initial display of the dialog if returning to this screen
     */
    initDisplay: function() {

        'use strict';

        var $headerText = this.$dialog.find('.js-header-text');
        var $phoneInput = this.$page.find('.js-user-phone-number');
        var $warningMessage = this.$page.find('.js-warning-message');
        var $codeInput = this.$page.find('.js-verification-number-input');

        // Display full phone number from previous page, hide any previous warnings and clear code entered
        $headerText.text(l[20213]);
        $phoneInput.text('(+' + sms.phoneInput.countryCallCode + ') ' + sms.phoneInput.phoneNumber);
        $warningMessage.removeClass('visible');
        $codeInput.val('');
    },

    /**
     * Initialise the Resend and Back buttons to go back to the previous screen and the phone is pre-filled from state
     */
    initResendAndBackButton: function() {

        'use strict';

        var $resendButton = this.$page.find('.js-resend-button');
        var $backButton = this.$page.find('.js-back-button');

        // On Resend/Close button tap
        $resendButton.add($backButton).rebind('click', function() {

            // Hide the current page
            sms.verifyCode.$page.addClass('hidden');

            // Load the previous page
            sms.phoneInput.init();
        });
    },

    /**
     * Initialise keyup handler to the code input so the button gets enabled if everything is completed
     */
    initCodeInputHandlers: function() {

        'use strict';

        var $codeInput = this.$page.find('.js-verification-number-input');
        var $verifyButton = this.$page.find('.js-verify-button');
        var $warningMessage = this.$page.find('.js-warning-message');

        // Add change and keyup handler for changes to code field
        $codeInput.rebind('change.validate keyup.validate', function() {

            // If the field has 6 numbers, move cursor out of the input and enable the button
            if ($codeInput.val().length === 6) {
                $codeInput.blur();
                $verifyButton.removeClass('disabled');
            }
            else {
                // Otherwise disable the button
                $verifyButton.addClass('disabled');
            }

            // Hide old error message
            $warningMessage.removeClass('visible');
        });

        // Add keypress handler to filter out invalid letters etc to only allow numbers
        $codeInput.rebind('keypress.filterinvalid', function(event) {

            // Get the entered key
            var inputChar = String.fromCharCode(event.which);

            // If not an integer, prevent input from being entered
            if (!/[0-9]/.test(inputChar)) {
                event.preventDefault();
            }
        });

        // Add click handler to clear the input field and disable the button if it is clicked into again
        $codeInput.rebind('click.clearinput', function() {

            $codeInput.val('');
            $verifyButton.addClass('disabled');
        });
    },

    /**
     * Initialise the Verify button to verify the SMS code received and entered by the user
     */
    initVerifyButton: function() {

        'use strict';

        var $verificationCode = this.$page.find('.js-verification-number-input');
        var $warningMessage = this.$page.find('.js-warning-message');
        var $verifyButton = this.$page.find('.js-verify-button');

        // On Verify button tap
        $verifyButton.rebind('click', function() {

            // Do not process the click if the code is not entered and the button is not active
            if ($verifyButton.hasClass('disabled')) {
                return false;
            }

            // Get the code, format the phone number for sending and set the success message
            var verificationCode = $verificationCode.val();
            var phoneNumber = '(+' + sms.phoneInput.countryCallCode + ') ' + sms.phoneInput.phoneNumber;
            var successMessage = l[20220].replace('%1', phoneNumber);

            // Send code to the API for verification
            api.send({a: 'smsv', c: verificationCode})
                .then(() => {

                    // Hide the current page
                    sms.verifyCode.$dialog.addClass('hidden');
                    sms.verifyCode.$background.addClass('hidden');
                    sms.verifyCode.$page.addClass('hidden');

                    // If they were suspended when they started the process
                    if (sms.isSuspended) {

                        // Show a success dialog then load their account after
                        msgDialog('info', l[18280], successMessage, false, () => {

                            // Reset flag
                            sms.isSuspended = false;

                            // Set the message and phone number to show on the login page
                            login_txt = successMessage + ' ' + l[20392];

                            // Log out the partially logged in account and reload page
                            u_logout().then(() => location.reload());
                        });
                    }
                    else {
                        // Show achievement success dialog
                        sms.verifySuccess.init();
                    }
                })
                .catch((ex) => {

                    // Check for errors
                    if (ex === EACCESS) {
                        $warningMessage.addClass('visible').text(l[20223]);
                        $verifyButton.addClass('disabled');
                    }
                    else if (ex === EEXPIRED) {
                        $warningMessage.addClass('visible').text(l[20224]);
                        $verifyButton.addClass('disabled');
                    }
                    else if (ex === EFAILED) {
                        $warningMessage.addClass('visible').text(l[20225]);
                        $verifyButton.addClass('disabled');
                    }
                    else if (ex === EEXIST || ex === ENOENT) {
                        $warningMessage.addClass('visible').text(l[20226]);
                        $verifyButton.addClass('disabled');
                    }
                    else {
                        console.error(ex);
                        $warningMessage.addClass('visible').text(l[47]);  // Oops, something went wrong...
                        $verifyButton.addClass('disabled');
                    }
                });
        });
    }
};

/**
 * Functions for the SMS verification success page (only shown for achievement method)
 */
sms.verifySuccess = {

    /** The container dialog with the HTML for all the pages/screens */
    $dialog: null,

    /** The background overlay for the dialog */
    $background: null,

    /** The current page/screen in the flow */
    $page: null,

    /**
     * Initialise the page
     */
    init: function() {

        'use strict';

        // Cache the page
        this.$dialog = $('.mega-dialog.verify-phone');
        this.$background = $('.fm-dialog-overlay');
        this.$page = $('.js-verify-success-page');

        // Init functionality
        this.initDisplay();
        this.renderAchievementDetails();
        this.initCloseButton();

        // Show the page
        this.$dialog.removeClass('hidden');
        this.$background.removeClass('hidden');
    },

    /**
     * Initialise the display of the dialog
     */
    initDisplay: function() {

        'use strict';

        // Change the dialog's icon to a success icon
        this.$dialog.find('.verify-ph-icon').addClass('hidden');
        this.$dialog.find('.verify-ph-success-icon').removeClass('hidden');
    },

    /**
     * Show the storage, transfer quota and number of days
     */
    renderAchievementDetails: function() {

        'use strict';

        var $page = this.$page;
        var $successMessage = $page.find('.js-body-text');
        var $storageAmount = $page.find('.js-storage-quota');
        var $transferAmount = $page.find('.js-transfer-quota');
        var $validDaysText = $('.valid-days-title span', $page);

        // Fetch all account data from the API
        M.accountData(function() {

            // Hide the loading dialog after request completes
            loadingDialog.hide();

            $page.removeClass('non-achievement-account');

            // If this is a non-achievements account
            if (typeof M.account.maf === 'undefined' || sms.achievementUsed) {

                // Set the text to 'Your number (+64) 229876543 has been successfully verified...'
                var phone = '(+' + sms.phoneInput.countryCallCode + ') ' + sms.phoneInput.phoneNumber;
                var successText = l[20220].replace('%1', phone);

                // Show a different success dialog state and text
                $successMessage.text(successText);
                $page.addClass('non-achievement-account');
            }
            else {
                // Otherwise if an achievements account, convert storage and bandwidth to 'x GB'
                var bonuses = M.account.maf.u;
                var storage = bonuses[9][0];
                var transfer = bonuses[9][1];
                var days = bonuses[9][2].replace('d', '');
                var storageQuotaFormatted = bytesToSize(storage, 0);
                var transferQuotaFormatted = bytesToSize(transfer, 0);

                // Update the page text
                $successMessage.text(l[20404]);             // Congratulations! You've just unlocked:
                $storageAmount.text(storageQuotaFormatted);
                $transferAmount.text(transferQuotaFormatted);
                $validDaysText.text(mega.icu.format(l[20407], days));
            }
            $page.removeClass('hidden');
        }, true); // Show loading spinner
    },

    /**
     * Initialise the OK button to take them back to their account page
     */
    initCloseButton: function() {

        'use strict';

        var $dialogCloseButton = this.$dialog.find('button.js-close');
        var $pageCloseButton = this.$dialog.find('.js-close-button');

        // On Close button tap
        $dialogCloseButton.add($pageCloseButton).rebind('click', function() {

            loadingDialog.show();

            // Perform User Get request to get the new added phone number
            api_req({ a: 'ug' }, {
                callback: function(res) {

                    loadingDialog.hide();

                    if (typeof res === 'object' && res.smsv) {

                        // Update the SMS Verification (smsv) locally with the user's phone
                        u_attr.smsv = res.smsv;

                        // If not on the account profile page, load it to show the phone number
                        if (page !== 'fm/account') {
                            loadSubPage('fm/account');
                        }
                        else {
                            // Hide the current page
                            sms.verifySuccess.$dialog.addClass('hidden');
                            sms.verifySuccess.$background.addClass('hidden');

                            // Update the UI
                            accountUI.renderAccountPage(M.account);
                            loadingDialog.hide();
                        }
                    }
                }
            });
        });
    }
};
