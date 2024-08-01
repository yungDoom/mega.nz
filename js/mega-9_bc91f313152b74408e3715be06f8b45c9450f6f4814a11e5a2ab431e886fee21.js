/* Bundle Includes:
 *   js/jquery.tokeninput.js
 *   js/jquery.checkboxes.js
 *   js/vendor/moment.js
 *   js/ui/megaRender.js
 *   js/ui/dialog.js
 *   js/ui/credentialsWarningDialog.js
 *   js/ui/loginRequiredDialog.js
 *   js/ui/registerDialog.js
 *   js/ui/keySignatureWarningDialog.js
 *   js/ui/feedbackDialog.js
 *   js/ui/forcedUpgradeProDialog.js
 *   js/ui/alarm.js
 *   js/ui/toast.js
 *   js/ui/top-tooltip-login.js
 *   js/fm/transfer-progress-widget.js
 */

(function($) {

    // Default settings
    var DEFAULT_SETTINGS = {
        // Search settings
        method: "GET",
        queryParam: "q",
        searchDelay: 200,
        minChars: 1,
        propertyToSearch: "id",
        jsonContainer: null,
        contentType: "json",
        excludeCurrent: false,
        excludeCurrentParameter: "x",
        // Prepopulation settings
        prePopulate: null,
        processPrePopulate: false,
        // Display settings
        hintText: "Type in a search term",
        noResultsText: "No results",
        searchingText: "Searching...",
        deleteText: "&#215;",
        animateDropdown: true,
        placeholder: null,
        theme: null,
        zindex: 1200,
        resultsLimit: null,
        searchDropdown: true,
        enableHTML: false,
        addAvatar: true,
        emailCheck: false,
        accountHolder: '',
        url: '',
        visibleComma: false,
        scrollLocation: 'add',
        initFocused: true,
        /**
         * resultsFormatter
         *
         * Creates contact row for share dialog drop down list.
         * Row is consisted of user avatar and two fields one below other
         * -------------------------
         * |        | upper string |
         * | avatar |--------------|
         * |        | lower string |
         * -------------------------
         * We can have 2 different situations depending on contact name
         * 1. Contact does NOT have a name. Top field is contact email address
         * bottom field is 'Email' string
         * 2. Contact does have a name. Top field is a contact name, bottom
         * field is a contact email address.
         *
         * @@param {Object} item
         * @returns {String} Html
         */
        resultsFormatter: function (item) {

            var id;
            var avatar;
            var email = item[this.tokenValue];
            var contactName = item[this.propertyToSearch];
            var upperValue = '';
            var lowerValue = '';

            M.u.forEach(function (contact, contactHandle) {
                if (contact.m === email) {
                    id = contactHandle;

                    return false;
                }
            });

            if (id) {
                contactName = M.getNameByHandle(id);
            }

            // Check existance of contact name and arrange upper/lower strings
            if ((contactName === email) || (contactName === '')) {// no contact name
                upperValue = email;
                lowerValue = l[7434];// Email
            }
            else {// with contact name
                upperValue = contactName;
                lowerValue = email;
            }

            avatar = useravatar.contact(id || email, '', 'span');

            return '<li class="share-search-result">' + (this.addAvatar ? avatar : '')
                    + '<span class="fm-chat-user-info">'
                    + '<span class="fm-chat-user">' + htmlentities(upperValue) + '</span>'
                    + '<span class="fm-chat-user-email">' + htmlentities(lowerValue) + '</span>'
                    + '</span><span class="clear"></span></li>';
        },
        tokenFormatter: function (item) {

            var id;
            var avatar;
            var email = item[this.tokenValue];
            var comma;

            M.u.forEach(function (contact, contactHandle) {
                if (contact.m === email) {
                    id = contactHandle;

                    return false;
                }
            });

            avatar = useravatar.contact(id || email, 'search-avatar', 'span');
            comma = ',';
            return '<li class="share-added-contact">'
                    + (this.addAvatar ? avatar : '')
                    + (this.enableHTML ? email : _escapeHTML(email))
                    + (this.visibleComma ? comma : '')
                    + '</li>';
        },
        // Tokenization settings
        tokenLimit: null,
        tokenDelimiter: /[ ,;]+/,
        preventDoublet: true,
        tokenValue: "id",
        // Behavioral settings
        allowFreeTagging: true,
        allowTabOut: false,
        autoSelectFirstResult: false,
        // Callbacks
        onResult: null,
        onCachedResult: null,
        onAdd: null,
        onFreeTaggingAdd: true,
        onDelete: null,
        onReady: null,
        onEmailCheck: null,
        onDoublet: null,
        onHolder: null,
        // Other settings
        idPrefix: "token-input-",
        // Keep track if the input is currently in disabled mode
        disabled: false
    };

    // Default classes to use when theming
    var DEFAULT_CLASSES = {
        tokenList: "token-input-list",
        token: "token-input-token",
        tokenDelete: "token-input-delete-token",
        selectedToken: "token-input-selected-token",
        highlightedToken: "token-input-highlighted-token",
        dropdown: "token-input-dropdown",
        dropdownItem: "token-input-dropdown-item",
        dropdownItem2: "token-input-dropdown-item2",
        selectedDropdownItem: "token-input-selected-dropdown-item",
        inputToken: "token-input-input-token"
    };

    // Input box position "enum"
    var POSITION = {
        BEFORE: 0,
        AFTER: 1,
        END: 2
    };

    // Keys "enum"
    var KEY = {
        BACKSPACE: 8,
        TAB: 9,
        ENTER: 13,
        ESCAPE: 27,
        SPACE: 32,
        PAGE_UP: 33,
        PAGE_DOWN: 34,
        END: 35,
        HOME: 36,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        NUMPAD_ENTER: 108,
        COMMA: 188,
        SEMICOLON: 186
    };

    var HTML_ESCAPES = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };

    var HTML_ESCAPE_CHARS = /[&<>"'\/]/g;

    function coerceToString(val) {
        return String((val === null || val === undefined) ? '' : val);
    }

    function _escapeHTML(text) {
        return coerceToString(text).replace(HTML_ESCAPE_CHARS, function(match) {
            return HTML_ESCAPES[match];
        });
    }

    // Additional public (exposed) methods
    var methods = {
        init: function(url_or_data_or_function, options) {
            var settings = $.extend({}, DEFAULT_SETTINGS, options || {});

            return this.each(function() {
                $(this).data("settings", settings);
                $(this).data("tokenInputObject", new $.TokenList(this, url_or_data_or_function, settings));
            });
        },
        clear: function() {
            if (this.data("tokenInputObject")) {
                this.data("tokenInputObject").clear();
                return this;
            }
            return false;
        },

        // Clears items from multi-input box, UI elements
        clearOnCancel: function() {
            if (this.data("tokenInputObject")) {
                this.data("tokenInputObject").clearOnCancel();
                return this;
            }
            return false;
        },
        add: function(item) {
            if (this.data("tokenInputObject")) {
                this.data("tokenInputObject").add(item);
                return this;
            }
            return false;
        },
        remove: function(item) {
            if (this.data("tokenInputObject")) {
                this.data("tokenInputObject").remove(item);
                return this;
            }
            return false;
        },
        get: function() {
            return this.data("tokenInputObject").getTokens();
        },
        getSettings: function() {
            return this.data("settings");
        },
        toggleDisabled: function(disable) {
            this.data("tokenInputObject").toggleDisabled(disable);
            return this;
        },
        setOptions: function(options) {
            $(this).data("settings", $.extend({}, $(this).data("settings"), options || {}));
            return this;
        },
        destroy: function() {
            if (this.data("tokenInputObject")) {
                this.data("tokenInputObject").clear();
                var tmpInput = this;
                var closest = this.parent();
                closest.empty();
                tmpInput.show();
                closest.append(tmpInput);
                return tmpInput;
            }
        },

        // Removes contact from dropdownlist, don't interfere with UI elements
        removeFromDDL: function(item) {

            var $settings = {},
                ld, tokenValue;

            if ($(this).data("settings")) {

                $settings = $(this).data("settings");
                ld = $settings.local_data;
                tokenValue = $settings.tokenValue;

                // Loop through local data
                for (var n in ld) {
                    if (ld[n][tokenValue] === item[tokenValue]) {
                        $(this).data("settings").local_data.splice(n, 1);
                        break;
                    }
                }
            }

            return false;
        },

        // Add contacts to drop down list, doesn't interfere with UI elements
        addToDDL: function(items) {

            var localData = [];
            var tokenValue;
            var propertyToSearch;
            var found = false;

            if ($(this).data("settings")) {

                localData = $(this).data("settings").local_data;
                tokenValue = $(this).data("settings").tokenValue;
                propertyToSearch = $(this).data("settings").propertyToSearch;

                // Loop through list of available items
                for (var i in items) {
                    if (items.hasOwnProperty(i)) {
                        found = false;

                        // Loop through list of item currently available in drop down box
                        for (var n in localData) {
                            if (localData.hasOwnProperty(n)) {

                                // In case that we have item in drop down list, skip and continue search for missing one
                                if (localData[n][tokenValue] === items[i][tokenValue]) {
                                    found = true;
                                    break;
                                }
                            }
                        }

                        // Add missing item to drop down list
                        if (!found) {
                            $(this).data("settings").local_data.push({
                                id: items[i][tokenValue],
                                name: items[i][propertyToSearch]
                            });
                        }
                    }
                }
            }

            return false;
        }
    };

    // Expose the .tokenInput function to jQuery as a plugin
    $.fn.tokenInput = function(method) {
        // Method calling and initialization logic
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else {
            return methods.init.apply(this, arguments);
        }
    };

    // TokenList class for each input
    $.TokenList = function(input, url_or_data, settings) {
        //
        // Initialization
        //

        // Configure the data source
        if (typeof (url_or_data) === "string" || typeof (url_or_data) === "function") {
            // Set the url to query against
            $(input).data("settings").url = url_or_data;

            // If the URL is a function, evaluate it here to do our initalization work
            var url = computeURL();

            // Make a smart guess about cross-domain if it wasn't explicitly specified
            if ($(input).data("settings").crossDomain === undefined && typeof url === "string") {
                if (url.indexOf("://") === -1) {
                    $(input).data("settings").crossDomain = false;
                }
                else {
                    $(input).data("settings").crossDomain = (location.href.split(/\/+/g)[1] !== url.split(/\/+/g)[1]);
                }
            }
        }
        else if (typeof (url_or_data) === "object") {

            // Set the local data to search through
            $(input).data("settings").local_data = url_or_data;
        }

        // Build class names
        if ($(input).data("settings").classes) {

            // Use custom class names
            $(input).data("settings").classes = $.extend({}, DEFAULT_CLASSES, $(input).data("settings").classes);
        }
        else if ($(input).data("settings").theme) {

            // Use theme-suffixed default class names
            $(input).data("settings").classes = {};
            $.each(DEFAULT_CLASSES, function(key, value) {
                $(input).data("settings").classes[key] = value + "-" + $(input).data("settings").theme;
            });
        }
        else {
            $(input).data("settings").classes = DEFAULT_CLASSES;
        }

        // Save the tokens
        var saved_tokens = [];

        // Keep track of the number of tokens in the list
        var token_count = 0;

        // Basic cache to save on db hits
        var cache = new $.TokenList.Cache();

        // Keep track of the timeout, old vals
        var timeout;
        var input_val;
        var input_box = $('<input type="text" autocomplete="disabled" autocapitalize="off"/>')
            .css({
                outline: "none"
            })
            .attr("id", $(input).data("settings").idPrefix + input.id)
        const initScroll = SoonFc(() => {
            var $wrapper = $(input).closest('.multiple-input');

            initPerfectScrollbar($wrapper);

            if ($(input).data("settings").initFocused) {
                focus_with_timeout(input_box);
            }
        });

        // Magic element to help us resize the text input
        var input_resizer = $("<tester/>");

        var token_list = $("<ul />").addClass($(input).data("settings").classes.tokenList);

        function resize_input() {
            if (input_val === (input_val = input_box.val())) {
                return;
            }
            // Get width left on the current line
            var width_left = token_list.outerWidth() - input_box.offset().left - token_list.offset().left;
            // Enter new content into resizer and resize input accordingly
            input_resizer.html(_escapeHTML(input_val));
            // Get maximum width, minimum the size of input and maximum the widget's width
            input_box.width(Math.min(
                token_list.outerWidth() || 30,
                Math.max(width_left, input_resizer.outerWidth() + 30)
            ));

            initScroll();
        }

        // Create a new text input an attach keyup events
        input_box.on('focus', () => {
                if ($(input).data("settings").disabled) {
                    return false;
                }
                if ($(input).data("settings").visibleComma) {
                    var $prevItem = input_token.prev();
                    if ($prevItem.length && ($prevItem.text().indexOf(',') === -1)) {
                        $prevItem.text($prevItem.text() + ',');
                    }
                }
                token_list.addClass($(input).data("settings").classes.focused);
                $('.multiple-input').parent().addClass('active');
                $('.permissions-menu').fadeOut(200);
                $('.permissions-icon.active').removeClass('active');
                $('.share-dialog-permissions.active').removeClass('active');
                $('.permissions-menu').removeClass('search-permissions');
            })
            .on('blur', function() {
                hide_dropdown();
                if ($(input).data("settings").allowFreeTagging) {
                    add_freetagging_tokens();
                }
                if ($(input).data("settings").visibleComma) {
                    var $prevItem = input_token.prev();
                    if ($prevItem.length) {
                        $prevItem.text($prevItem.text().replace(',', ''));
                    }
                }
                $(this).val('');
                $('.multiple-input').parent().removeClass('active');
                $('.multiple-input *').removeClass('red');
            })
            .on("keyup keydown blur update paste", resize_input)
            // Fix of paste issue. These is bug in tokenInut lib.
            .rebind("input.testerresize", function() {
                $(this).trigger("keydown");
            })
            // keydown instead of keyup to preventDefault.
            .on('keydown', function(event) {
                /* jshint -W074 */

                const expectedKeys = ['Tab', ' ', 'Enter', ',', ';'];
                var next_token;
                var previous_token;

                switch (event.keyCode) {
                    case KEY.LEFT:
                    case KEY.RIGHT:
                    case KEY.UP:
                    case KEY.DOWN:
                        if (this.value.length === 0) {
                            previous_token = input_token.prev();
                            next_token = input_token.next();

                            if ((previous_token.length && previous_token.get(0) === selected_token) ||
                                (next_token.length && next_token.get(0) === selected_token)) {

                                // Check if there is a previous/next token and it is selected
                                if (event.keyCode === KEY.LEFT || event.keyCode === KEY.UP) {
                                    deselect_token($(selected_token), POSITION.BEFORE);
                                }
                                else {
                                    deselect_token($(selected_token), POSITION.AFTER);
                                }
                            }
                            else if ((event.keyCode === KEY.LEFT || event.keyCode === KEY.UP) && previous_token.length) {

                                // We are moving left, select the previous token if it exists
                                select_token($(previous_token.get(0)));
                            }
                            else if ((event.keyCode === KEY.RIGHT || event.keyCode === KEY.DOWN) && next_token.length) {

                                // We are moving right, select the next token if it exists
                                select_token($(next_token.get(0)));
                            }
                        }
                        else {

                            var dropdown_item = null;

                            if (event.keyCode === KEY.DOWN || event.keyCode === KEY.RIGHT) {
                                dropdown_item = $(dropdown).find('li').first();

                                if (selected_dropdown_item) {
                                    dropdown_item = $(selected_dropdown_item).next();
                                }
                            }
                            else {
                                dropdown_item = $(dropdown).find('li').last();

                                if (selected_dropdown_item) {
                                    dropdown_item = $(selected_dropdown_item).prev();
                                }
                            }

                            var $scrollBlock = dropdown_item.closest('.ps');
                            if ($scrollBlock.length) {
                                $scrollBlock.scrollTop(dropdown_item.position().top);
                            }
                            select_dropdown_item(dropdown_item);
                        }

                        break;

                    case KEY.BACKSPACE:

                        previous_token = input_token.prev();

                        if (this.value.length === 0) {
                            if (selected_token) {
                                delete_token($(selected_token));
                                hidden_input.change();
                            }
                            else if (previous_token.length) {
                                delete_token($(previous_token.get(0)));
                                focus_with_timeout(input_box);
                            }
                            // waiting previous search to be finished and prevent show animation.
                            setTimeout(function() {
                                hide_dropdown();
                            }, $(input).data("settings").searchDelay);
                            return false;
                        }
                        else {
                            // set a timeout just long enough to let this function finish.
                            setTimeout(function() {
                                do_search();
                            }, 5);
                        }
                        break;

                    case KEY.TAB:
                    case KEY.SPACE:
                    case KEY.ENTER:
                    case KEY.NUMPAD_ENTER:
                    case KEY.COMMA:
                    case KEY.SEMICOLON:

                        if (!expectedKeys.includes(event.key) && String.fromCharCode(event.which)) {
                            // set a timeout just long enough to let this function finish.
                            onIdle(() => do_search());
                            return true;
                        }

                        // preventDefault to remove default behaviour from the keydown.
                        event.preventDefault();
                        if (this.value.length) {
                            if (selected_dropdown_item) {
                                add_token($(selected_dropdown_item).data("tokeninput"));
                                hidden_input.change();
                            }
                            else {
                                if ($(input).data("settings").allowFreeTagging) {
                                    if ($(input).data("settings").allowTabOut && $(this).val() === "") {
                                        return true;
                                    }
                                    else {
                                        add_freetagging_tokens();
                                    }
                                }
                                else {
                                    $(this).val("");
                                    if ($(input).data("settings").allowTabOut) {
                                        return true;
                                    }
                                }
                            }
                        }

                        // If users press enter/return on empty input field behave like done/share button is clicked
                        else if (event.keyCode === KEY.ENTER || event.keyCode === KEY.NUMPAD_ENTER) {
                            var $addContactBtn;
                            var cd;
                            if ($.dialog === "share") { // if it is share dialog
                                $addContactBtn = $('.share-dialog .dialog-share-button');
                                cd = false;
                            }
                            else if ($.dialog === "add-user-popup") { // if it is add user dialog.
                                $addContactBtn = $('.add-user-popup-button');
                                cd = true;
                            }
                            else {
                                // FIXME: what is this?
                                console.warn('Cannot add contact from here...', $.dialog);
                                return false;
                            }

                            addNewContact($addContactBtn, cd).done(function() {
                                if ($.dialog === "share") {
                                    var share = new mega.Share();
                                    share.updateNodeShares();
                                }
                                $('.token-input-token-mega').remove();
                            });
                        }

                        return false;

                    case KEY.ESCAPE:
                        hide_dropdown();
                        return true;

                    default:
                        if (String.fromCharCode(event.which)) {
                            // set a timeout just long enough to let this function finish.
                            setTimeout(function() {
                                do_search();
                            }, 5);
                        }
                        break;
                }
            });

        // Keep reference for placeholder
        if (settings.placeholder) {
            input_box.attr("placeholder", settings.placeholder);
        }

        // Keep a reference to the original input box
        var hidden_input = $(input)
            .hide()
            .val("")
            .on('focus', function() {
                focus_with_timeout(input_box);
            })
            .on('blur', function() {
                input_box.trigger('blur');

                //return the object to this can be referenced in the callback functions.
                return hidden_input;
            });

        // Keep a reference to the selected token and dropdown item
        var selected_token = null;
        var selected_token_index = 0;
        var selected_dropdown_item = null;

        // The list to store the token items in
        token_list.on('click', event => {
                var li = $(event.target).closest("li");
                if (li && li.get(0) && $.data(li.get(0), "tokeninput")) {
                    toggle_select_token(li);
                } else {
                    // Deselect selected token
                    if (selected_token) {
                        deselect_token($(selected_token), POSITION.END);
                    }

                    // Focus input box
                    focus_with_timeout(input_box);
                }
            })
            .on('mouseover', function(event) {
                var li = $(event.target).closest("li");
                if (li && selected_token !== this) {
                    li.addClass($(input).data("settings").classes.highlightedToken);
                }
            })
            .on('mouseout', function(event) {
                var li = $(event.target).closest("li");
                if (li && selected_token !== this) {
                    li.removeClass($(input).data("settings").classes.highlightedToken);
                }
            })
            .insertBefore(hidden_input);

        // The token holding the input box
        var input_token = $("<li />")
            .addClass($(input).data("settings").classes.inputToken)
            .appendTo(token_list)
            .append(input_box);

        // The list to store the dropdown items in
        var dropdown = $("<div/>")
            .addClass($(input).data("settings").classes.dropdown)
            .appendTo("body")
            .hide();

        input_resizer
            .insertAfter(input_box)
            .css({
                position: "absolute",
                top: -9999,
                left: -9999,
                width: "auto",
                whiteSpace: "nowrap"
            });


        // Pre-populate list if items exist
        hidden_input.val("");
        var li_data = $(input).data("settings").prePopulate || hidden_input.data("pre");

        if ($(input).data("settings").processPrePopulate && $.isFunction($(input).data("settings").onResult)) {
            li_data = $(input).data("settings").onResult.call(hidden_input, li_data);
        }

        if (li_data && li_data.length) {
            $.each(li_data, function(index, value) {
                insert_token(value);
                checkTokenLimit();
                input_box.attr("placeholder", null)
            });
        }

        // Check if widget should initialize as disabled
        if ($(input).data("settings").disabled) {
            toggleDisabled(true);
        }

        // Initialization is done
        if (typeof ($(input).data("settings").onReady) === "function") {
            $(input).data("settings").onReady.call();
        }

        //
        // Public functions
        //

        this.clear = function() {
            token_list.children("li").each(function() {
                if ($(this).children("input").length === 0) {
                    delete_token($(this));
                }
            });
        };

        this.clearOnCancel = function() {
            token_list.children("li").each(function() {
                if ($(this).children("input").length === 0) {
                    delete_all_tokens($(this));
                }
            });
        };

        this.add = function(item) {
            add_token(item);
        };

        this.remove = function(item) {
            token_list.children("li").each(function() {
                if ($(this).children("input").length === 0) {
                    var currToken = $(this).data("tokeninput");
                    var match = true;
                    for (var prop in item) {
                        if (item[prop] !== currToken[prop]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) {
                        delete_token($(this));
                    }
                }
            });
        };

        this.getTokens = function() {
            return saved_tokens;
        };

        this.toggleDisabled = function(disable) {
            toggleDisabled(disable);
        };

        // Resize input to maximum width so the placeholder can be seen
        resize_input();

        //
        // Private functions
        //

        function escapeHTML(text) {
            return $(input).data("settings").enableHTML ? text : _escapeHTML(text);
        }

        // Toggles the widget between enabled and disabled state, or according
        // to the [disable] parameter.
        function toggleDisabled(disable) {
            if (typeof disable === 'boolean') {
                $(input).data("settings").disabled = disable
            } else {
                $(input).data("settings").disabled = !$(input).data("settings").disabled;
            }
            input_box.attr('disabled', $(input).data("settings").disabled);
            token_list.toggleClass($(input).data("settings").classes.disabled, $(input).data("settings").disabled);
            // if there is any token selected we deselect it
            if (selected_token) {
                deselect_token($(selected_token), POSITION.END);
            }
            hidden_input.attr('disabled', $(input).data("settings").disabled);
        }

        function checkTokenLimit() {
            if ($(input).data("settings").tokenLimit !== null && token_count >= $(input).data("settings").tokenLimit) {
                input_box.hide();
                hide_dropdown();
                return;
            }
        }

        function add_freetagging_tokens() {

            var value = $.trim(input_box.val()).replace(/\s|\n/gi, '');
            var tokens = value.split($(input).data("settings").tokenDelimiter);

            if (tokens.length > 10) {
                loadingDialog.pshow();
            }
            onIdle(() => {
                for (let i = 0; i < tokens.length; i++) {
                    let token = tokens[i];
                    if (token) {
                        const { onFreeTaggingAdd, tokenValue, propertyToSearch } = $(input).data("settings");

                        if (typeof onFreeTaggingAdd === 'function') {
                            token = onFreeTaggingAdd.call(hidden_input, token);
                        }
                        const object = {};
                        object[tokenValue] = object[propertyToSearch] = token;
                        add_token(object);
                    }
                }
                if (tokens.length > 10) {
                    loadingDialog.phide();
                }
            });
        }

        // Inner function to a token to the list
        function insert_token(item) {
            var $this_token = $($(input).data("settings").tokenFormatter(item));
            var readonly = item.readonly === true ? true : false;

            if (readonly)
                $this_token.addClass($(input).data("settings").classes.tokenReadOnly);

            $this_token.addClass($(input).data("settings").classes.token).insertBefore(input_token);

            // The 'delete token' button
            if (!readonly) {
                $('<i class="remove-item sprite-fm-mono icon-close-component"></i>')
                    .addClass($(input).data("settings").classes.tokenDelete)
                    .appendTo($this_token)
                    .on('click', function() {
                        if (!$(input).data("settings").disabled && $(input).data("settings").something !== '') {
                            delete_token($(this).parent());
                            hidden_input.change();
                             initScroll();
                            return false;
                        }
                    });
            }

            // Store data on the token
            var token_data = item;
            $.data($this_token.get(0), "tokeninput", item);

            // Save this token for duplicate checking
            saved_tokens = saved_tokens.slice(0, selected_token_index).concat([token_data]).concat(saved_tokens.slice(selected_token_index));
            selected_token_index++;

            // Update the hidden input
            update_hidden_input(saved_tokens, hidden_input);

            token_count += 1;

            // Check the token limit
            if ($(input).data("settings").tokenLimit !== null && token_count >= $(input).data("settings").tokenLimit) {
                input_box.hide();
                hide_dropdown();
            }

            return $this_token;
        }

        // Add a token to the token list based on user input
        function add_token(item) {
            item[$(input).data("settings").tokenValue] = item[$(input).data("settings").tokenValue].toLowerCase();
            var callback = $(input).data("settings").onAdd;

            if ($(input).data("settings").emailCheck) {

                var isEmail =  isValidEmail(item[$(input).data("settings").tokenValue]);

                // Prevent further execution if email format is wrong
                if (!isEmail) {
                    var cb = $(input).data("settings").onEmailCheck;
                    if ($.isFunction(cb)) {
                        cb.call(hidden_input, item);
                    }

                    return;
                }
            }

            if ($(input).data("settings").accountHolder) {
                if ($(input).data("settings").accountHolder.toLowerCase() === item[$(input).data("settings").tokenValue].toLowerCase()) {
                    if (settings.scrollLocation === 'add') {
                        select_token(item);
                    }
                    var cb = $(input).data("settings").onHolder;
                    if ($.isFunction(cb)) {
                        cb.call(hidden_input, item);
                    }

                    return false;
                }
            }

            if ($(input).data("settings").preventDoublet) {

                var property = $(input).data("settings").propertyToSearch;
                var tokenValue = $(input).data("settings").tokenValue;
                var itemFoundType;
                var currData = $(input).data("settings").local_data;
                for (var k = 0; k < currData.length; k++) {
                    if (currData[k][property].toLowerCase() === item[tokenValue].toLowerCase()) {
                        itemFoundType = currData[k].contactType;
                        break;
                    }
                }
                if ((Object.keys(M.opc).length > 0) && (typeof itemFoundType === "undefined")) {
                    Object.keys(M.opc).forEach(function (g) {
                        if (M.opc[g].m.toLowerCase() === item[tokenValue].toLowerCase()
                            && !M.opc[g].hasOwnProperty('dts')) {
                            itemFoundType = "opc";
                            return false;
                        }
                    });
                }

                // Prevent further execution if email is duplicated
                if (itemFoundType) {
                    select_token(item);
                    var cb = $(input).data("settings").onDoublet;
                    if ($.isFunction(cb)) {
                        cb.call(hidden_input, item, itemFoundType);
                    }

                    return false;
                }
            }

            // compare against already added contacts, for shared folder exlusivelly
            if ($.inArray(item[$(input).data("settings").tokenValue], $.sharedTokens) !== -1) {
                var cb = $(input).data("settings").onDoublet;
                if ($.isFunction(cb)) {
                    cb.call(hidden_input, item);
                }
                return false;
            }

            // check current multi-input list
//			if (token_count > 0 && $(input).data("settings").preventDoublet) {
            if (token_count > 0) {
                var found_existing_token = null;
                token_list.children().each(function() {
                    var existing_token = $(this);
                    var existing_data = $.data(existing_token.get(0), "tokeninput");
                    if (existing_data && existing_data[$(input).data("settings").tokenValue] === item[$(input).data("settings").tokenValue]) {
                        found_existing_token = existing_token;
                        return false;
                    }
                });

                if (found_existing_token) {
                    if (settings.scrollLocation === 'add') {
                        select_token(found_existing_token);
                    }
                    var cb = $(input).data("settings").onDoublet;
                    if ($.isFunction(cb)) {
                        cb.call(hidden_input, item);
                    }
                    return;
                }
            }

            // Insert the new tokens
            if ($(input).data("settings").tokenLimit == null || token_count < $(input).data("settings").tokenLimit && isEmail) {
                insert_token(item);

                // Remove the placeholder so it's not seen after you've added a token
                input_box.attr("placeholder", null);
                checkTokenLimit();
            }

            // Clear input box
            input_box.val("");

            // Don't show the help dropdown, they've got the idea
            hide_dropdown();

            // Execute the onAdd callback if defined
            if ($.isFunction(callback)) {
                callback.call(hidden_input, item);
            }

            $(input).data("settings").local_data.push({
                id: item[$(input).data("settings").tokenValue],
                name: item[$(input).data("settings").propertyToSearch]
            });

            initScroll();
        }// END of function add_token

        // Select a token in the token list
        function select_token(token) {
            if (!$(input).data("settings").disabled) {
                // Hide input box
                input_box.val("");

                // Hide dropdown if it is visible (eg if we clicked to select token)
                hide_dropdown();
            }
        }

        // Deselect a token in the token list
        function deselect_token(token, position) {
            token.removeClass($(input).data("settings").classes.selectedToken);
            selected_token = null;

            if (position === POSITION.BEFORE) {
                input_token.insertBefore(token);
                selected_token_index--;
            } else if (position === POSITION.AFTER) {
                input_token.insertAfter(token);
                selected_token_index++;
            } else {
                input_token.appendTo(token_list);
                selected_token_index = token_count;
            }

            // Show the input box and give it focus again
            focus_with_timeout(input_box);
        }

        // Toggle selection of a token in the token list
        function toggle_select_token(token) {
            var previous_selected_token = selected_token;

            if (selected_token) {
                deselect_token($(selected_token), POSITION.END);
            }

            if (previous_selected_token === token.get(0)) {
                deselect_token(token, POSITION.END);
            } else {
                select_token(token);
            }
        }

        // Delete a token from the token list
        function delete_token(token) {

            // Remove the id from the saved list
            var token_data = $.data(token.get(0), "tokeninput"),
                callback = $(input).data("settings").onDelete,
                index = token.prevAll().length;

            if (index > selected_token_index) {
                index--;
            }

            // Delete the token
            token.remove();
            selected_token = null;

            // Show the input box and give it focus again
            focus_with_timeout(input_box);

            // Remove this token from the saved list
            saved_tokens = saved_tokens.slice(0, index).concat(saved_tokens.slice(index + 1));

            if (saved_tokens.length === 0) {
                input_box.attr("placeholder", settings.placeholder);
            }
            if (index < selected_token_index) {
                selected_token_index--;
            }

            // Update the hidden input
            update_hidden_input(saved_tokens, hidden_input);

            token_count -= 1;

            if ($(input).data("settings").tokenLimit !== null) {
                input_box
                    .show()
                    .val("");
                focus_with_timeout(input_box);
            }

            // Execute the onDelete callback if defined
            if ($.isFunction(callback)) {
                callback.call(hidden_input, token_data);
                var ld = $(input).data("settings").local_data;
                for (var n in ld) {
                    if (ld[n].id === token_data.id) {
                        $(input).data("settings").local_data.splice(n, 1);
                        break;
                    }
                }
            }

            initScroll();
        }

        // Delete a token from the token list
        function delete_all_tokens(token) {

            // Remove the id from the saved list
            var token_data = $.data(token.get(0), "tokeninput");

            var index = token.prevAll().length;
            if (index > selected_token_index) {
                index--;
            }

            token.remove();
            selected_token = null;

            // Show the input box and give it focus again
            focus_with_timeout(input_box);

            // Remove this token from the saved list
            saved_tokens = saved_tokens.slice(0, index).concat(saved_tokens.slice(index + 1));

            if (saved_tokens.length === 0) {
                input_box.attr("placeholder", settings.placeholder);
            }
            if (index < selected_token_index) {
                selected_token_index--;
            }

            // Update the hidden input
            update_hidden_input(saved_tokens, hidden_input);

            token_count -= 1;

            if ($(input).data("settings").tokenLimit !== null) {
                input_box
                    .show()
                    .val("");
                focus_with_timeout(input_box);
            }

            var ld = $(input).data("settings").local_data;
            for (var n in ld) {
                if (ld[n].id === token_data.id) {
                    $(input).data("settings").local_data.splice(n, 1);
                    break;
                }
            }
        }

        // Update the hidden input box value
        function update_hidden_input(saved_tokens, hidden_input) {
            var token_values = $.map(saved_tokens, function(el) {
                if (typeof $(input).data("settings").tokenValue == 'function')
                    return $(input).data("settings").tokenValue.call(this, el);

                return el[$(input).data("settings").tokenValue];
            });
            hidden_input.val(token_values.join($(input).data("settings").tokenDelimiter));

        }

        // Hide and clear the results dropdown
        function hide_dropdown() {
            if ($(input).data("settings").searchDropdown) {
                dropdown.hide().empty();
                selected_dropdown_item = null;
            }
        }

        function show_dropdown() {
            if ($(input).data("settings").searchDropdown) {
                dropdown
                    .css({
                        position: "absolute",
                        top: token_list.offset().top + token_list.outerHeight(true),
                        left: token_list.offset().left,
                        width: $(input).closest('.multiple-input').width() + 4,
                        'z-index': $(input).data("settings").zindex
                    })
                    .show();
            }
        }

        function show_dropdown_searching() {
            if ($(input).data("settings").searchingText && $(input).data("settings").searchDropdown) {
                dropdown.html("<p>" + escapeHTML($(input).data("settings").searchingText) + "</p>");
                show_dropdown();
            }
            else {
                hide_dropdown();
            }
        }

        function show_dropdown_hint() {
            if ($(input).data("settings").hintText && $(input).data("settings").searchDropdown) {
                dropdown.html("<p>" + escapeHTML($(input).data("settings").hintText) + "</p>");
                show_dropdown();
            }
        }

        var regexp_special_chars = new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g');
        function regexp_escape(term) {
            return term.replace(regexp_special_chars, '\\$&');
        }

        // Highlight the query part of the search term
        function highlight_term(value, term) {
            return value.replace(
                new RegExp(
                    "(?![^&;]+;)(?!<[^<>]*)(" + regexp_escape(term) + ")(?![^<>]*>)(?![^&;]+;)",
                    "gi"
                    ), function(match, p1) {
                return "<b>" + escapeHTML(p1) + "</b>";
            }
            );
        }

        function find_value_and_highlight_term(template, value, term) {
            return template.replace(new RegExp("(?![^&;]+;)(?!<[^<>]*)(" + regexp_escape(value) + ")(?![^<>]*>)(?![^&;]+;)", "g"), highlight_term(value, term));
        }

        // exclude existing tokens from dropdown
        function excludeCurrent(results) {
            if ($(input).data("settings").excludeCurrent) {
                var currentTokens = $(input).data("tokenInputObject").getTokens(),
                    trimmedList = [];
                if (currentTokens.length) {
                    $.each(results, function(index, value) {
                        var notFound = true;
                        $.each(currentTokens, function(cIndex, cValue) {
                            if (value[$(input).data("settings").tokenValue]
                                    === cValue[$(input).data("settings").tokenValue]) {
                                notFound = false;
                                return false;
                            }
                        });

                        if (notFound) {
                            trimmedList.push(value);
                        }
                    });
                    results = trimmedList;
                }
            }

            return results;
        }

        // Populate the results dropdown with some results
        function populate_dropdown(query, results) {
            // exclude current tokens if configured
            results = excludeCurrent(results);

            if (results && results.length) {
                dropdown.empty();
                var dropdown_ul = $("<ul/>")
                    .appendTo(dropdown)
                    // to prevent auto selecting when mouse pointer is on it,
                    // bind mouseover when mouse pointer is move.
                    .on('mousemove', function() {
                        $(this).on('mouseover', function(event) {
                            select_dropdown_item($(event.target).closest("li"));
                        }).on('mousedown', function(event) {
                            add_token($(event.target).closest("li").data("tokeninput"));
                            hidden_input.trigger('change');
                            return false;
                        }).on('mouseout', function(event) {
                            deselect_dropdown_item($(event.target).closest("li"));
                        })
                        .off('mousemove'); // remove mousemove so not cause multiple binding.
                    })
                    .hide();

                $.each(results, function(index, value) {
                    var this_li = $(input).data("settings").resultsFormatter(value);

                    this_li = find_value_and_highlight_term(this_li, value[$(input).data("settings").propertyToSearch], query);
                    this_li = $(this_li).appendTo(dropdown_ul);

                    if (index % 2) {
                        this_li.addClass($(input).data("settings").classes.dropdownItem);
                    } else {
                        this_li.addClass($(input).data("settings").classes.dropdownItem2);
                    }

                    if (index === 0 && $(input).data("settings").autoSelectFirstResult) {
                        select_dropdown_item(this_li);
                    }

                    $.data(this_li.get(0), "tokeninput", value);
                });

                show_dropdown();

                if ($(input).data("settings").animateDropdown) {
                    initPerfectScrollbar(dropdown_ul);
                    dropdown_ul.scrollTop($(input).position().top + $(input).outerHeight());
                } else {
                    dropdown_ul.show();
                    initPerfectScrollbar(dropdown_ul);
                }
            } else {
                if ($(input).data("settings").noResultsText) {
                    dropdown.html("<p>" + escapeHTML($(input).data("settings").noResultsText) + "</p>");
                    show_dropdown();
                }
            }
        }

        // Highlight an item in the results dropdown
        function select_dropdown_item(item) {
            if (item) {
                if (selected_dropdown_item) {
                    deselect_dropdown_item($(selected_dropdown_item));
                }

                item.addClass($(input).data("settings").classes.selectedDropdownItem);
                selected_dropdown_item = item.get(0);
            }
        }

        // Remove highlighting from an item in the results dropdown
        function deselect_dropdown_item(item) {
            item.removeClass($(input).data("settings").classes.selectedDropdownItem);
            selected_dropdown_item = null;
        }

        // Do a search and show the "searching" dropdown if the input is longer
        // than $(input).data("settings").minChars
        function do_search() {
            var query = input_box.val();

            if (query && query.length) {
                if (selected_token) {
                    deselect_token($(selected_token), POSITION.AFTER);
                }

                if (query.length >= $(input).data("settings").minChars) {
                    show_dropdown_searching();
                    clearTimeout(timeout);

                    timeout = setTimeout(function() {
                        run_search(query);
                    }, $(input).data("settings").searchDelay);
                } else {
                    hide_dropdown();
                }
            }
        }

        // Do the actual search
        function run_search(query) {

            var cache_key = query + computeURL(),
//                cached_results = cache.get(cache_key);
                cached_results;

            if (cached_results) {
                if ($.isFunction($(input).data("settings").onCachedResult)) {
                    cached_results = $(input).data("settings").onCachedResult.call(hidden_input, cached_results);
                }
                populate_dropdown(query, cached_results);
            }
            else {

                // Are we doing an ajax search or local data search?
                if ($(input).data("settings").url) {
                    var url = computeURL();
                    // Extract existing get params
                    var ajax_params = {};
                    ajax_params.data = {};
                    if (url.indexOf("?") > -1) {
                        var parts = url.split("?");
                        ajax_params.url = parts[0];

                        var param_array = parts[1].split("&");
                        $.each(param_array, function(index, value) {
                            var kv = value.split("=");
                            ajax_params.data[kv[0]] = kv[1];
                        });
                    } else {
                        ajax_params.url = url;
                    }

                    // Prepare the request
                    ajax_params.data[$(input).data("settings").queryParam] = query;
                    ajax_params.type = $(input).data("settings").method;
                    ajax_params.dataType = $(input).data("settings").contentType;
                    if ($(input).data("settings").crossDomain) {
                        ajax_params.dataType = "jsonp";
                    }

                    // exclude current tokens?
                    // send exclude list to the server, so it can also exclude existing tokens
                    if ($(input).data("settings").excludeCurrent) {
                        var currentTokens = $(input).data("tokenInputObject").getTokens();
                        var tokenList = $.map(currentTokens, function(el) {
                            if (typeof $(input).data("settings").tokenValue == 'function')
                                return $(input).data("settings").tokenValue.call(this, el);

                            return el[$(input).data("settings").tokenValue];
                        });

                        ajax_params.data[$(input).data("settings").excludeCurrentParameter] = tokenList.join($(input).data("settings").tokenDelimiter);
                    }

                    // Attach the success callback
                    ajax_params.success = function(results) {
                        cache.add(cache_key, $(input).data("settings").jsonContainer ? results[$(input).data("settings").jsonContainer] : results);
                        if ($.isFunction($(input).data("settings").onResult)) {
                            results = $(input).data("settings").onResult.call(hidden_input, results);
                        }

                        // only populate the dropdown if the results are associated with the active search query
                        if (input_box.val() === query) {
                            populate_dropdown(query, $(input).data("settings").jsonContainer ? results[$(input).data("settings").jsonContainer] : results);
                        }
                    };

                    // Provide a beforeSend callback
                    if (settings.onSend) {
                        settings.onSend(ajax_params);
                    }

                    // Make the request
                    $.ajax(ajax_params);
                }

                // Do the search through local data
                else if ($(input).data("settings").local_data) {

                    var tokenValue = $(input).data("settings").tokenValue;
                    var property = $(input).data("settings").propertyToSearch;

                    var results = $.grep($(input).data("settings").local_data, function(row) {
                        var emailAndName = row[tokenValue].toLowerCase() + row[property].toLowerCase();
                        return emailAndName.indexOf(query.toLowerCase()) > -1;
                    });

//                    cache.add(cache_key, results);
                    if ($.isFunction($(input).data("settings").onResult)) {
                        results = $(input).data("settings").onResult.call(hidden_input, results);
                    }
                    populate_dropdown(query, results);
                }
            }
        }

        // compute the dynamic URL
        function computeURL() {
            var url = $(input).data("settings").url;
            if (typeof $(input).data("settings").url == 'function') {
                url = $(input).data("settings").url.call($(input).data("settings"));
            }
            return url;
        }

        // Bring browser focus to the specified object.
        // Use of setTimeout is to get around an IE bug.
        // (See, e.g., http://stackoverflow.com/questions/2600186/focus-doesnt-work-in-ie)
        //
        // obj: a jQuery object to focus()
        function focus_with_timeout(obj) {
            onIdle(function() {
                $(obj).trigger('focus');
            });
        }
    };

    // Really basic cache for the results
    $.TokenList.Cache = function(options) {
        var settings, data = {}, size = 0, flush;

        settings = $.extend({max_size: 500}, options);

        flush = function() {
            data = {};
            size = 0;
        };

        this.add = function(query, results) {
            if (size > settings.max_size) {
                flush();
            }

            if (!data[query]) {
                size += 1;
            }

            data[query] = results;
        };

        this.get = function(query) {
            return data[query];
        };
    };

}(jQuery));

(function() {
  var iOSCheckbox, matched, userAgent,
    __slice = Array.prototype.slice;

  if ($.browser == null) {
    userAgent = navigator.userAgent || "";
    jQuery.uaMatch = function(ua) {
      var match;
      ua = ua.toLowerCase();
      match = /(chrome)[ \/]([\w.]+)/.exec(ua) || /(webkit)[ \/]([\w.]+)/.exec(ua) || /(opera)(?:.*version)?[ \/]([\w.]+)/.exec(ua) || /(msie) ([\w.]+)/.exec(ua) || ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+))?/.exec(ua) || [];
      return {
        browser: match[1] || "",
        version: match[2] || "0"
      };
    };
    matched = jQuery.uaMatch(userAgent);
    jQuery.browser = {};
    if (matched.browser) {
      jQuery.browser[matched.browser] = true;
      jQuery.browser.version = matched.version;
    }
    if (jQuery.browser.webkit) jQuery.browser.safari = true;
  }

  iOSCheckbox = (function() {

    function iOSCheckbox(elem, options) {
      var key, opts, value;
      this.elem = $(elem);
      opts = $.extend({}, iOSCheckbox.defaults, options);
      for (key in opts) {
        value = opts[key];
        this[key] = value;
      }
      this.elem.data(this.dataName, this);
      this.wrapCheckboxWithDivs();
      this.attachEvents();
      this.disableTextSelection();
      if (this.resizeHandle) this.optionallyResize('handle');
      if (this.resizeContainer) this.optionallyResize('container');
      this.initialPosition();
    }

    iOSCheckbox.prototype.isDisabled = function() {
      return this.elem.is(':disabled');
    };

    iOSCheckbox.prototype.wrapCheckboxWithDivs = function() {
      this.elem.wrap("<div class='" + this.containerClass + "' />");
      this.container = this.elem.parent();
      this.offLabel = $("<label class='" + this.labelOffClass + "'>\n  <span>" + this.uncheckedLabel + "</span>\n</label>").appendTo(this.container);
      this.offSpan = this.offLabel.children('span');
      this.onLabel = $("<label class='" + this.labelOnClass + "'>\n  <span>" + this.checkedLabel + "</span>\n</label>").appendTo(this.container);
      this.onSpan = this.onLabel.children('span');
      return this.handle = $("<div class='" + this.handleClass + "'>\n  <div class='" + this.handleRightClass + "'>\n    <div class='" + this.handleCenterClass + "' />\n  </div>\n</div>").appendTo(this.container);
    };

    iOSCheckbox.prototype.disableTextSelection = function() {
      if ($.browser.msie) {
        return $([this.handle, this.offLabel, this.onLabel, this.container]).attr("unselectable", "on");
      }
    };

    iOSCheckbox.prototype._getDimension = function(elem, dimension) {
      if ($.fn.actual != null) {
        return elem.actual(dimension);
      } else {
        return elem[dimension]();
      }
    };

    iOSCheckbox.prototype.optionallyResize = function(mode) {
      var newWidth, offLabelWidth, onLabelWidth;
      onLabelWidth = this._getDimension(this.onLabel, "width");
      offLabelWidth = this._getDimension(this.offLabel, "width");
      if (mode === "container") {
        newWidth = onLabelWidth > offLabelWidth ? onLabelWidth : offLabelWidth;
        newWidth += this._getDimension(this.handle, "width") + this.handleMargin ;
        return this.container.css({
          width: newWidth
        });
      } else {
        newWidth = onLabelWidth > offLabelWidth ? onLabelWidth : offLabelWidth;
        return this.handle.css({
          width: newWidth 
        });
      }
    };

    iOSCheckbox.prototype.onMouseDown = function(event) {
      var x;
      event.preventDefault();
      if (this.isDisabled()) return;
      x = event.pageX || event.originalEvent.changedTouches[0].pageX;
      iOSCheckbox.currentlyClicking = this.handle;
      iOSCheckbox.dragStartPosition = x;
      return iOSCheckbox.handleLeftOffset = parseInt(this.handle.css('left'), 10) || 0;
    };

    iOSCheckbox.prototype.onDragMove = function(event, x) {
      var newWidth, p;
      if (iOSCheckbox.currentlyClicking !== this.handle) return;
      p = (x + iOSCheckbox.handleLeftOffset - iOSCheckbox.dragStartPosition) / this.rightSide;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      newWidth = p * this.rightSide;
      this.handle.css({
        left: newWidth
      });
      this.onLabel.css({
        width: newWidth + this.handleRadius
      });
      this.offSpan.css({
        marginRight: -newWidth
      });
      return this.onSpan.css({
        marginLeft: -(1 - p) * this.rightSide
      });
    };

    iOSCheckbox.prototype.onDragEnd = function(event, x) {
      var p;
      if (iOSCheckbox.currentlyClicking !== this.handle) return;
      if (this.isDisabled()) return;
      if (iOSCheckbox.dragging) {
        p = (x - iOSCheckbox.dragStartPosition) / this.rightSide;
        this.elem.prop('checked', p >= 0.5);
      } else {
        this.elem.prop('checked', !this.elem.prop('checked'));
      }
      iOSCheckbox.currentlyClicking = null;
      iOSCheckbox.dragging = null;
      return this.didChange();
    };

    iOSCheckbox.prototype.refresh = function() {
      return this.didChange();
    };

    iOSCheckbox.prototype.didChange = function() {
      var new_left;
      if (typeof this.onChange === "function") {
        this.onChange(this.elem, this.elem.prop('checked'));
      }
      if (this.isDisabled()) {
        this.container.addClass(this.disabledClass);
        return false;
      } else {
        this.container.removeClass(this.disabledClass);
      }
      new_left = this.elem.prop('checked') ? this.rightSide : 0;
      this.handle.animate({
        left: new_left
      }, this.duration);
      this.onLabel.animate({
        width: new_left + this.handleRadius
      }, this.duration);
      this.offSpan.animate({
        marginRight: -new_left
      }, this.duration);
      return this.onSpan.animate({
        marginLeft: new_left - this.rightSide
      }, this.duration);
    };

    iOSCheckbox.prototype.attachEvents = function() {
      var localMouseMove, localMouseUp, self;
      self = this;
      localMouseMove = function(event) {
        return self.onGlobalMove.apply(self, arguments);
      };
      localMouseUp = function(event) {
        self.onGlobalUp.apply(self, arguments);
        $(document).unbind('mousemove touchmove', localMouseMove);
        return $(document).unbind('mouseup touchend', localMouseUp);
      };
      this.elem.change(function() {
        return self.refresh();
      });
      return this.container.bind('mousedown touchstart', function(event) {
        self.onMouseDown.apply(self, arguments);
        $(document).bind('mousemove touchmove', localMouseMove);
        return $(document).bind('mouseup touchend', localMouseUp);
      });
    };

    iOSCheckbox.prototype.initialPosition = function() {
      var containerWidth, offset;
      containerWidth = this._getDimension(this.container, "width");
      this.offLabel.css({
        width: containerWidth - this.containerRadius
      });
      offset = this.containerRadius + 1;
      if ($.browser.msie && $.browser.version < 7) offset -= 3;
      this.rightSide = containerWidth - this._getDimension(this.handle, "width") - offset;
      if (this.elem.is(':checked')) {
        this.handle.css({
          left: this.rightSide
        });
        this.onLabel.css({
          width: this.rightSide + this.handleRadius
        });
        this.offSpan.css({
          marginRight: -this.rightSide
        });
      } else {
        this.onLabel.css({
          width: 0
        });
        this.onSpan.css({
          marginLeft: -this.rightSide
        });
      }
      if (this.isDisabled()) return this.container.addClass(this.disabledClass);
    };

    iOSCheckbox.prototype.onGlobalMove = function(event) {
      var x;
      if (!(!this.isDisabled() && iOSCheckbox.currentlyClicking)) return;
      event.preventDefault();
      x = event.pageX || event.originalEvent.changedTouches[0].pageX;
      if (!iOSCheckbox.dragging && (Math.abs(iOSCheckbox.dragStartPosition - x) > this.dragThreshold)) {
        iOSCheckbox.dragging = true;
      }
      return this.onDragMove(event, x);
    };

    iOSCheckbox.prototype.onGlobalUp = function(event) {
      var x;
      if (!iOSCheckbox.currentlyClicking) return;
      event.preventDefault();
      x = event.pageX || event.originalEvent.changedTouches[0].pageX;
      this.onDragEnd(event, x);
      return false;
    };
	
	

    iOSCheckbox.defaults = {
      duration: 200,
      checkedLabel: 'ON',
      uncheckedLabel: 'OFF',
      resizeHandle: true,
      resizeContainer: true,
      disabledClass: 'iPhoneCheckDisabled',
      containerClass: 'iPhoneCheckContainer',
      labelOnClass: 'iPhoneCheckLabelOn',
      labelOffClass: 'iPhoneCheckLabelOff',
      handleClass: 'iPhoneCheckHandle',
      handleCenterClass: 'iPhoneCheckHandleCenter',
      handleRightClass: 'iPhoneCheckHandleRight',
      dragThreshold: 0,
      handleMargin: 0,
      handleRadius: 36,
      containerRadius: 0,
      dataName: "iphoneStyle",
      onChange: function() {}
    };

    return iOSCheckbox;

  })();

  $.iphoneStyle = this.iOSCheckbox = iOSCheckbox;

  $.fn.iphoneStyle = function() {
    var args, checkbox, dataName, existingControl, method, params, _i, _len, _ref, _ref2, _ref3, _ref4;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    dataName = (_ref = (_ref2 = args[0]) != null ? _ref2.dataName : void 0) != null ? _ref : iOSCheckbox.defaults.dataName;
    _ref3 = this.filter(':checkbox');
    for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
      checkbox = _ref3[_i];
      existingControl = $(checkbox).data(dataName);
      if (existingControl != null) {
        method = args[0], params = 2 <= args.length ? __slice.call(args, 1) : [];
        if ((_ref4 = existingControl[method]) != null) {
          _ref4.apply(existingControl, params);
        }
      } else {
        new iOSCheckbox(checkbox, args[0]);
      }
    }
    return this;
  };

  $.fn.iOSCheckbox = function(options) {
    var opts;
    if (options == null) options = {};
    opts = $.extend({}, options, {
      resizeHandle: false,
      disabledClass: 'iOSCheckDisabled',
      containerClass: 'iOSCheckContainer',
      labelOnClass: 'iOSCheckLabelOn',
      labelOffClass: 'iOSCheckLabelOff',
      handleClass: 'iOSCheckHandle',
      handleCenterClass: 'iOSCheckHandleCenter',
      handleRightClass: 'iOSCheckHandleRight',
      dataName: 'iOSCheckbox'
    });
    return this.iphoneStyle(opts);
  };

}).call(this);

//! moment.js
//! version : 2.10.6
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, function () { 'use strict';

    var hookCallback;

    function utils_hooks__hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function create_utc__createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    function valid__isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            m._isValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated;

            if (m._strict) {
                m._isValid = m._isValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }
        }
        return m._isValid;
    }

    function valid__createInvalid (flags) {
        var m = create_utc__createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    var momentProperties = utils_hooks__hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (typeof from._isAMomentObject !== 'undefined') {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (typeof from._i !== 'undefined') {
            to._i = from._i;
        }
        if (typeof from._f !== 'undefined') {
            to._f = from._f;
        }
        if (typeof from._l !== 'undefined') {
            to._l = from._l;
        }
        if (typeof from._strict !== 'undefined') {
            to._strict = from._strict;
        }
        if (typeof from._tzm !== 'undefined') {
            to._tzm = from._tzm;
        }
        if (typeof from._isUTC !== 'undefined') {
            to._isUTC = from._isUTC;
        }
        if (typeof from._offset !== 'undefined') {
            to._offset = from._offset;
        }
        if (typeof from._pf !== 'undefined') {
            to._pf = getParsingFlags(from);
        }
        if (typeof from._locale !== 'undefined') {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i in momentProperties) {
                prop = momentProperties[i];
                val = from[prop];
                if (typeof val !== 'undefined') {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            utils_hooks__hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function Locale() {
    }

    var locales = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return null;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && typeof module !== 'undefined' &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                require('./locale/' + name);
                // because defineLocale currently also sets the global locale, we
                // want to undo that for lazy loaded locales
                locale_locales__getSetGlobalLocale(oldLocale);
            } catch (e) { }
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function locale_locales__getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (typeof values === 'undefined') {
                data = locale_locales__getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, values) {
        if (values !== null) {
            values.abbr = name;
            locales[name] = locales[name] || new Locale();
            locales[name].set(values);

            // backwards compat for now: also set the locale
            locale_locales__getSetGlobalLocale(name);

            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    // returns locale data
    function locale_locales__getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                get_set__set(this, unit, value);
                utils_hooks__hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get_set__get(this, unit);
            }
        };
    }

    function get_set__get (mom, unit) {
        return mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]();
    }

    function get_set__set (mom, unit, value) {
        return mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
    }

    // MOMENTS

    function getSet (units, value) {
        var unit;
        if (typeof units === 'object') {
            for (unit in units) {
                this.set(unit, units[unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (typeof this[units] === 'function') {
                return this[units](value);
            }
        }
        return this;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Q|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '';
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    var matchWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i;

    var regexes = {};

    function isFunction (sth) {
        // https://github.com/moment/moment/issues/2325
        return typeof sth === 'function' &&
            Object.prototype.toString.call(sth) === '[object Function]';
    }


    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (typeof callback === 'number') {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  matchWord);
    addRegexToken('MMMM', matchWord);

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m) {
        return this._months[m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m) {
        return this._monthsShort[m.month()];
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        // TODO: Move this out of here!
        if (typeof value === 'string') {
            value = mom.localeData().monthsParse(value);
            // TODO: Another silent failure?
            if (typeof value !== 'number') {
                return mom;
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            utils_hooks__hooks.updateOffset(this, true);
            return this;
        } else {
            return get_set__get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    function warn(msg) {
        if (utils_hooks__hooks.suppressDeprecationWarnings === false && typeof console !== 'undefined' && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (firstTime) {
                warn(msg + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    utils_hooks__hooks.suppressDeprecationWarnings = false;

    var from_string__isoRegex = /^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d{2}-\d{2}/],
        ['YYYY-MM-DD', /\d{4}-\d{2}-\d{2}/],
        ['GGGG-[W]WW-E', /\d{4}-W\d{2}-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d{2}/],
        ['YYYY-DDD', /\d{4}-\d{3}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /(T| )\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss', /(T| )\d\d:\d\d:\d\d/],
        ['HH:mm', /(T| )\d\d:\d\d/],
        ['HH', /(T| )\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = from_string__isoRegex.exec(string);

        if (match) {
            getParsingFlags(config).iso = true;
            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(string)) {
                    config._f = isoDates[i][0];
                    break;
                }
            }
            for (i = 0, l = isoTimes.length; i < l; i++) {
                if (isoTimes[i][1].exec(string)) {
                    // match[6] should be 'T' or space
                    config._f += (match[6] || ' ') + isoTimes[i][0];
                    break;
                }
            }
            if (string.match(matchOffset)) {
                config._f += 'Z';
            }
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    utils_hooks__hooks.createFromInputFallback = deprecate(
        'moment construction falls back to js Date. This is ' +
        'discouraged and will be removed in upcoming major ' +
        'release. Please refer to ' +
        'https://github.com/moment/moment/issues/1407 for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    function createDate (y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor doesn't accept years < 1970
        if (y < 1970) {
            date.setFullYear(y);
        }
        return date;
    }

    function createUTCDate (y) {
        var date = new Date(Date.UTC.apply(null, arguments));
        if (y < 1970) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? utils_hooks__hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = utils_hooks__hooks.parseTwoDigitYear(input);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    utils_hooks__hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', false);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // firstDayOfWeek       0 = sun, 6 = sat
    //                      the day of the week that starts the week
    //                      (usually sunday or monday)
    // firstDayOfWeekOfYear 0 = sun, 6 = sat
    //                      the first week is the week that contains the first
    //                      of this day of the week
    //                      (eg. ISO weeks use thursday (4))
    function weekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
        var end = firstDayOfWeekOfYear - firstDayOfWeek,
            daysToDayOfWeek = firstDayOfWeekOfYear - mom.day(),
            adjustedMoment;


        if (daysToDayOfWeek > end) {
            daysToDayOfWeek -= 7;
        }

        if (daysToDayOfWeek < end - 7) {
            daysToDayOfWeek += 7;
        }

        adjustedMoment = local__createLocal(mom).add(daysToDayOfWeek, 'd');
        return {
            week: Math.ceil(adjustedMoment.dayOfYear() / 7),
            year: adjustedMoment.year()
        };
    }

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 1st is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, firstDayOfWeekOfYear, firstDayOfWeek) {
        var week1Jan = 6 + firstDayOfWeek - firstDayOfWeekOfYear, janX = createUTCDate(year, 0, 1 + week1Jan), d = janX.getUTCDay(), dayOfYear;
        if (d < firstDayOfWeek) {
            d += 7;
        }

        weekday = weekday != null ? 1 * weekday : firstDayOfWeek;

        dayOfYear = 1 + week1Jan + 7 * (week - 1) - d + weekday;

        return {
            year: dayOfYear > 0 ? year : year - 1,
            dayOfYear: dayOfYear > 0 ?  dayOfYear : daysInYear(year - 1) + dayOfYear
        };
    }

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        var now = new Date();
        if (config._useUTC) {
            return [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()];
        }
        return [now.getFullYear(), now.getMonth(), now.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(local__createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            weekYear = defaults(w.gg, config._a[YEAR], weekOfYear(local__createLocal(), dow, doy).year);
            week = defaults(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < dow) {
                    ++week;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        temp = dayOfYearFromWeeks(weekYear, week, weekday, doy, dow);

        config._a[YEAR] = temp.year;
        config._dayOfYear = temp.dayOfYear;
    }

    utils_hooks__hooks.ISO_8601 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === utils_hooks__hooks.ISO_8601) {
            configFromISO(config);
            return;
        }

        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (getParsingFlags(config).bigHour === true &&
                config._a[HOUR] <= 12 &&
                config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!valid__isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = [i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond];

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || locale_locales__getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return valid__createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        } else if (isDate(input)) {
            config._d = input;
        } else {
            configFromInput(config);
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (input === undefined) {
            config._d = new Date();
        } else if (isDate(input)) {
            config._d = new Date(+input);
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (typeof(input) === 'object') {
            configFromObject(config);
        } else if (typeof(input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function local__createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
         'moment().min is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548',
         function () {
             var other = local__createLocal.apply(null, arguments);
             return other < this ? this : other;
         }
     );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548',
        function () {
            var other = local__createLocal.apply(null, arguments);
            return other > this ? this : other;
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return local__createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 36e5; // 1000 * 60 * 60
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = locale_locales__getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchOffset);
    addRegexToken('ZZ', matchOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(string) {
        var matches = ((string || '').match(matchOffset) || []);
        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? +input : +local__createLocal(input)) - (+res);
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(+res._d + diff);
            utils_hooks__hooks.updateOffset(res, false);
            return res;
        } else {
            return local__createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    utils_hooks__hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime) {
        var offset = this._offset || 0,
            localAdjust;
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(input);
            }
            if (Math.abs(input) < 16) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    add_subtract__addSubtract(this, create__createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    utils_hooks__hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm) {
            this.utcOffset(this._tzm);
        } else if (typeof this._i === 'string') {
            this.utcOffset(offsetFromString(this._i));
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        input = input ? local__createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (typeof this._isDSTShifted !== 'undefined') {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? create_utc__createUTC(c._a) : local__createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return !this._isUTC;
    }

    function isUtcOffset () {
        return this._isUTC;
    }

    function isUtc () {
        return this._isUTC && this._offset === 0;
    }

    var aspNetRegex = /(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    var create__isoRegex = /^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/;

    function create__createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])        * sign,
                h  : toInt(match[HOUR])        * sign,
                m  : toInt(match[MINUTE])      * sign,
                s  : toInt(match[SECOND])      * sign,
                ms : toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = create__isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                d : parseIso(match[4], sign),
                h : parseIso(match[5], sign),
                m : parseIso(match[6], sign),
                s : parseIso(match[7], sign),
                w : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(local__createLocal(duration.from), local__createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    create__createDuration.fn = Duration.prototype;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {milliseconds: 0, months: 0};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period).');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = create__createDuration(val, period);
            add_subtract__addSubtract(this, dur, direction);
            return this;
        };
    }

    function add_subtract__addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = duration._days,
            months = duration._months;
        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(+mom._d + milliseconds * isAdding);
        }
        if (days) {
            get_set__set(mom, 'Date', get_set__get(mom, 'Date') + days * isAdding);
        }
        if (months) {
            setMonth(mom, get_set__get(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            utils_hooks__hooks.updateOffset(mom, days || months);
        }
    }

    var add_subtract__add      = createAdder(1, 'add');
    var add_subtract__subtract = createAdder(-1, 'subtract');

    function moment_calendar__calendar (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || local__createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            diff = this.diff(sod, 'days', true),
            format = diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
        return this.format(formats && formats[format] || this.localeData().calendar(format, this, local__createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var inputMs;
        units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
        if (units === 'millisecond') {
            input = isMoment(input) ? input : local__createLocal(input);
            return +this > +input;
        } else {
            inputMs = isMoment(input) ? +input : +local__createLocal(input);
            return inputMs < +this.clone().startOf(units);
        }
    }

    function isBefore (input, units) {
        var inputMs;
        units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
        if (units === 'millisecond') {
            input = isMoment(input) ? input : local__createLocal(input);
            return +this < +input;
        } else {
            inputMs = isMoment(input) ? +input : +local__createLocal(input);
            return +this.clone().endOf(units) < inputMs;
        }
    }

    function isBetween (from, to, units) {
        return this.isAfter(from, units) && this.isBefore(to, units);
    }

    function isSame (input, units) {
        var inputMs;
        units = normalizeUnits(units || 'millisecond');
        if (units === 'millisecond') {
            input = isMoment(input) ? input : local__createLocal(input);
            return +this === +input;
        } else {
            inputMs = +local__createLocal(input);
            return +(this.clone().startOf(units)) <= inputMs && inputMs <= +(this.clone().endOf(units));
        }
    }

    function diff (input, units, asFloat) {
        var that = cloneWithOffset(input, this),
            zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4,
            delta, output;

        units = normalizeUnits(units);

        if (units === 'year' || units === 'month' || units === 'quarter') {
            output = monthDiff(this, that);
            if (units === 'quarter') {
                output = output / 3;
            } else if (units === 'year') {
                output = output / 12;
            }
        } else {
            delta = this - that;
            output = units === 'second' ? delta / 1e3 : // 1000
                units === 'minute' ? delta / 6e4 : // 1000 * 60
                units === 'hour' ? delta / 36e5 : // 1000 * 60 * 60
                units === 'day' ? (delta - zoneDelta) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                units === 'week' ? (delta - zoneDelta) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                delta;
        }
        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        return -(wholeMonthDiff + adjust);
    }

    utils_hooks__hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function moment_format__toISOString () {
        var m = this.clone().utc();
        if (0 < m.year() && m.year() <= 9999) {
            if ('function' === typeof Date.prototype.toISOString) {
                // native implementation is ~50x faster, use it when we can
                return this.toDate().toISOString();
            } else {
                return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        } else {
            return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
        }
    }

    function format (inputString) {
        var output = formatMoment(this, inputString || utils_hooks__hooks.defaultFormat);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }
        return create__createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
    }

    function fromNow (withoutSuffix) {
        return this.from(local__createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }
        return create__createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
    }

    function toNow (withoutSuffix) {
        return this.to(local__createLocal(), withoutSuffix);
    }

    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = locale_locales__getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    function startOf (units) {
        units = normalizeUnits(units);
        // the following switch intentionally omits break keywords
        // to utilize falling through the cases.
        switch (units) {
        case 'year':
            this.month(0);
            /* falls through */
        case 'quarter':
        case 'month':
            this.date(1);
            /* falls through */
        case 'week':
        case 'isoWeek':
        case 'day':
            this.hours(0);
            /* falls through */
        case 'hour':
            this.minutes(0);
            /* falls through */
        case 'minute':
            this.seconds(0);
            /* falls through */
        case 'second':
            this.milliseconds(0);
        }

        // weeks are a special case
        if (units === 'week') {
            this.weekday(0);
        }
        if (units === 'isoWeek') {
            this.isoWeekday(1);
        }

        // quarters are also special
        if (units === 'quarter') {
            this.month(Math.floor(this.month() / 3) * 3);
        }

        return this;
    }

    function endOf (units) {
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond') {
            return this;
        }
        return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
    }

    function to_type__valueOf () {
        return +this._d - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(+this / 1000);
    }

    function toDate () {
        return this._offset ? new Date(+this) : this._d;
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function moment_valid__isValid () {
        return valid__isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = utils_hooks__hooks.parseTwoDigitYear(input);
    });

    // HELPERS

    function weeksInYear(year, dow, doy) {
        return weekOfYear(local__createLocal([year, 11, 31 + dow - doy]), dow, doy).week;
    }

    // MOMENTS

    function getSetWeekYear (input) {
        var year = weekOfYear(this, this.localeData()._week.dow, this.localeData()._week.doy).year;
        return input == null ? year : this.add((input - year), 'y');
    }

    function getSetISOWeekYear (input) {
        var year = weekOfYear(this, 1, 4).year;
        return input == null ? year : this.add((input - year), 'y');
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    addFormatToken('Q', 0, 0, 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        return isStrict ? locale._ordinalParse : locale._ordinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0], 10);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   matchWord);
    addRegexToken('ddd',  matchWord);
    addRegexToken('dddd', matchWord);

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config) {
        var weekday = config._locale.weekdaysParse(input);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    // LOCALES

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m) {
        return this._weekdays[m.day()];
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return this._weekdaysShort[m.day()];
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return this._weekdaysMin[m.day()];
    }

    function localeWeekdaysParse (weekdayName) {
        var i, mom, regex;

        this._weekdaysParse = this._weekdaysParse || [];

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            if (!this._weekdaysParse[i]) {
                mom = local__createLocal([2000, 1]).day(i);
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.
        return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, function () {
        return this.hours() % 12 || 12;
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var momentPrototype__proto = Moment.prototype;

    momentPrototype__proto.add          = add_subtract__add;
    momentPrototype__proto.calendar     = moment_calendar__calendar;
    momentPrototype__proto.clone        = clone;
    momentPrototype__proto.diff         = diff;
    momentPrototype__proto.endOf        = endOf;
    momentPrototype__proto.format       = format;
    momentPrototype__proto.from         = from;
    momentPrototype__proto.fromNow      = fromNow;
    momentPrototype__proto.to           = to;
    momentPrototype__proto.toNow        = toNow;
    momentPrototype__proto.get          = getSet;
    momentPrototype__proto.invalidAt    = invalidAt;
    momentPrototype__proto.isAfter      = isAfter;
    momentPrototype__proto.isBefore     = isBefore;
    momentPrototype__proto.isBetween    = isBetween;
    momentPrototype__proto.isSame       = isSame;
    momentPrototype__proto.isValid      = moment_valid__isValid;
    momentPrototype__proto.lang         = lang;
    momentPrototype__proto.locale       = locale;
    momentPrototype__proto.localeData   = localeData;
    momentPrototype__proto.max          = prototypeMax;
    momentPrototype__proto.min          = prototypeMin;
    momentPrototype__proto.parsingFlags = parsingFlags;
    momentPrototype__proto.set          = getSet;
    momentPrototype__proto.startOf      = startOf;
    momentPrototype__proto.subtract     = add_subtract__subtract;
    momentPrototype__proto.toArray      = toArray;
    momentPrototype__proto.toObject     = toObject;
    momentPrototype__proto.toDate       = toDate;
    momentPrototype__proto.toISOString  = moment_format__toISOString;
    momentPrototype__proto.toJSON       = moment_format__toISOString;
    momentPrototype__proto.toString     = toString;
    momentPrototype__proto.unix         = unix;
    momentPrototype__proto.valueOf      = to_type__valueOf;

    // Year
    momentPrototype__proto.year       = getSetYear;
    momentPrototype__proto.isLeapYear = getIsLeapYear;

    // Week Year
    momentPrototype__proto.weekYear    = getSetWeekYear;
    momentPrototype__proto.isoWeekYear = getSetISOWeekYear;

    // Quarter
    momentPrototype__proto.quarter = momentPrototype__proto.quarters = getSetQuarter;

    // Month
    momentPrototype__proto.month       = getSetMonth;
    momentPrototype__proto.daysInMonth = getDaysInMonth;

    // Week
    momentPrototype__proto.week           = momentPrototype__proto.weeks        = getSetWeek;
    momentPrototype__proto.isoWeek        = momentPrototype__proto.isoWeeks     = getSetISOWeek;
    momentPrototype__proto.weeksInYear    = getWeeksInYear;
    momentPrototype__proto.isoWeeksInYear = getISOWeeksInYear;

    // Day
    momentPrototype__proto.date       = getSetDayOfMonth;
    momentPrototype__proto.day        = momentPrototype__proto.days             = getSetDayOfWeek;
    momentPrototype__proto.weekday    = getSetLocaleDayOfWeek;
    momentPrototype__proto.isoWeekday = getSetISODayOfWeek;
    momentPrototype__proto.dayOfYear  = getSetDayOfYear;

    // Hour
    momentPrototype__proto.hour = momentPrototype__proto.hours = getSetHour;

    // Minute
    momentPrototype__proto.minute = momentPrototype__proto.minutes = getSetMinute;

    // Second
    momentPrototype__proto.second = momentPrototype__proto.seconds = getSetSecond;

    // Millisecond
    momentPrototype__proto.millisecond = momentPrototype__proto.milliseconds = getSetMillisecond;

    // Offset
    momentPrototype__proto.utcOffset            = getSetOffset;
    momentPrototype__proto.utc                  = setOffsetToUTC;
    momentPrototype__proto.local                = setOffsetToLocal;
    momentPrototype__proto.parseZone            = setOffsetToParsedOffset;
    momentPrototype__proto.hasAlignedHourOffset = hasAlignedHourOffset;
    momentPrototype__proto.isDST                = isDaylightSavingTime;
    momentPrototype__proto.isDSTShifted         = isDaylightSavingTimeShifted;
    momentPrototype__proto.isLocal              = isLocal;
    momentPrototype__proto.isUtcOffset          = isUtcOffset;
    momentPrototype__proto.isUtc                = isUtc;
    momentPrototype__proto.isUTC                = isUtc;

    // Timezone
    momentPrototype__proto.zoneAbbr = getZoneAbbr;
    momentPrototype__proto.zoneName = getZoneName;

    // Deprecations
    momentPrototype__proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    momentPrototype__proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    momentPrototype__proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    momentPrototype__proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. https://github.com/moment/moment/issues/1779', getSetZone);

    var momentPrototype = momentPrototype__proto;

    function moment__createUnix (input) {
        return local__createLocal(input * 1000);
    }

    function moment__createInZone () {
        return local__createLocal.apply(null, arguments).parseZone();
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function locale_calendar__calendar (key, mom, now) {
        var output = this._calendar[key];
        return typeof output === 'function' ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    function preParsePostFormat (string) {
        return string;
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relative__relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (typeof output === 'function') ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return typeof format === 'function' ? format(output) : format.replace(/%s/i, output);
    }

    function locale_set__set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (typeof prop === 'function') {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _ordinalParseLenient.
        this._ordinalParseLenient = new RegExp(this._ordinalParse.source + '|' + (/\d{1,2}/).source);
    }

    var prototype__proto = Locale.prototype;

    prototype__proto._calendar       = defaultCalendar;
    prototype__proto.calendar        = locale_calendar__calendar;
    prototype__proto._longDateFormat = defaultLongDateFormat;
    prototype__proto.longDateFormat  = longDateFormat;
    prototype__proto._invalidDate    = defaultInvalidDate;
    prototype__proto.invalidDate     = invalidDate;
    prototype__proto._ordinal        = defaultOrdinal;
    prototype__proto.ordinal         = ordinal;
    prototype__proto._ordinalParse   = defaultOrdinalParse;
    prototype__proto.preparse        = preParsePostFormat;
    prototype__proto.postformat      = preParsePostFormat;
    prototype__proto._relativeTime   = defaultRelativeTime;
    prototype__proto.relativeTime    = relative__relativeTime;
    prototype__proto.pastFuture      = pastFuture;
    prototype__proto.set             = locale_set__set;

    // Month
    prototype__proto.months       =        localeMonths;
    prototype__proto._months      = defaultLocaleMonths;
    prototype__proto.monthsShort  =        localeMonthsShort;
    prototype__proto._monthsShort = defaultLocaleMonthsShort;
    prototype__proto.monthsParse  =        localeMonthsParse;

    // Week
    prototype__proto.week = localeWeek;
    prototype__proto._week = defaultLocaleWeek;
    prototype__proto.firstDayOfYear = localeFirstDayOfYear;
    prototype__proto.firstDayOfWeek = localeFirstDayOfWeek;

    // Day of Week
    prototype__proto.weekdays       =        localeWeekdays;
    prototype__proto._weekdays      = defaultLocaleWeekdays;
    prototype__proto.weekdaysMin    =        localeWeekdaysMin;
    prototype__proto._weekdaysMin   = defaultLocaleWeekdaysMin;
    prototype__proto.weekdaysShort  =        localeWeekdaysShort;
    prototype__proto._weekdaysShort = defaultLocaleWeekdaysShort;
    prototype__proto.weekdaysParse  =        localeWeekdaysParse;

    // Hours
    prototype__proto.isPM = localeIsPM;
    prototype__proto._meridiemParse = defaultLocaleMeridiemParse;
    prototype__proto.meridiem = localeMeridiem;

    function lists__get (format, index, field, setter) {
        var locale = locale_locales__getLocale();
        var utc = create_utc__createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function list (format, index, field, count, setter) {
        if (typeof format === 'number') {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return lists__get(format, index, field, setter);
        }

        var i;
        var out = [];
        for (i = 0; i < count; i++) {
            out[i] = lists__get(format, i, field, setter);
        }
        return out;
    }

    function lists__listMonths (format, index) {
        return list(format, index, 'months', 12, 'month');
    }

    function lists__listMonthsShort (format, index) {
        return list(format, index, 'monthsShort', 12, 'month');
    }

    function lists__listWeekdays (format, index) {
        return list(format, index, 'weekdays', 7, 'day');
    }

    function lists__listWeekdaysShort (format, index) {
        return list(format, index, 'weekdaysShort', 7, 'day');
    }

    function lists__listWeekdaysMin (format, index) {
        return list(format, index, 'weekdaysMin', 7, 'day');
    }

    locale_locales__getSetGlobalLocale('en', {
        ordinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports
    utils_hooks__hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', locale_locales__getSetGlobalLocale);
    utils_hooks__hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', locale_locales__getLocale);

    var mathAbs = Math.abs;

    function duration_abs__abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function duration_add_subtract__addSubtract (duration, input, value, direction) {
        var other = create__createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function duration_add_subtract__add (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function duration_add_subtract__subtract (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'year') {
            days   = this._days   + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            return units === 'month' ? months : months / 12;
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function duration_as__valueOf () {
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asYears        = makeAs('y');

    function duration_get__get (units) {
        units = normalizeUnits(units);
        return this[units + 's']();
    }

    function makeGetter(name) {
        return function () {
            return this._data[name];
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        s: 45,  // seconds to minute
        m: 45,  // minutes to hour
        h: 22,  // hours to day
        d: 26,  // days to month
        M: 11   // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function duration_humanize__relativeTime (posNegDuration, withoutSuffix, locale) {
        var duration = create__createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds < thresholds.s && ['s', seconds]  ||
                minutes === 1          && ['m']           ||
                minutes < thresholds.m && ['mm', minutes] ||
                hours   === 1          && ['h']           ||
                hours   < thresholds.h && ['hh', hours]   ||
                days    === 1          && ['d']           ||
                days    < thresholds.d && ['dd', days]    ||
                months  === 1          && ['M']           ||
                months  < thresholds.M && ['MM', months]  ||
                years   === 1          && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set a threshold for relative time strings
    function duration_humanize__getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        return true;
    }

    function humanize (withSuffix) {
        var locale = this.localeData();
        var output = duration_humanize__relativeTime(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var iso_string__abs = Math.abs;

    function iso_string__toISOString() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        var seconds = iso_string__abs(this._milliseconds) / 1000;
        var days         = iso_string__abs(this._days);
        var months       = iso_string__abs(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds;
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        return (total < 0 ? '-' : '') +
            'P' +
            (Y ? Y + 'Y' : '') +
            (M ? M + 'M' : '') +
            (D ? D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? h + 'H' : '') +
            (m ? m + 'M' : '') +
            (s ? s + 'S' : '');
    }

    var duration_prototype__proto = Duration.prototype;

    duration_prototype__proto.abs            = duration_abs__abs;
    duration_prototype__proto.add            = duration_add_subtract__add;
    duration_prototype__proto.subtract       = duration_add_subtract__subtract;
    duration_prototype__proto.as             = as;
    duration_prototype__proto.asMilliseconds = asMilliseconds;
    duration_prototype__proto.asSeconds      = asSeconds;
    duration_prototype__proto.asMinutes      = asMinutes;
    duration_prototype__proto.asHours        = asHours;
    duration_prototype__proto.asDays         = asDays;
    duration_prototype__proto.asWeeks        = asWeeks;
    duration_prototype__proto.asMonths       = asMonths;
    duration_prototype__proto.asYears        = asYears;
    duration_prototype__proto.valueOf        = duration_as__valueOf;
    duration_prototype__proto._bubble        = bubble;
    duration_prototype__proto.get            = duration_get__get;
    duration_prototype__proto.milliseconds   = milliseconds;
    duration_prototype__proto.seconds        = seconds;
    duration_prototype__proto.minutes        = minutes;
    duration_prototype__proto.hours          = hours;
    duration_prototype__proto.days           = days;
    duration_prototype__proto.weeks          = weeks;
    duration_prototype__proto.months         = months;
    duration_prototype__proto.years          = years;
    duration_prototype__proto.humanize       = humanize;
    duration_prototype__proto.toISOString    = iso_string__toISOString;
    duration_prototype__proto.toString       = iso_string__toISOString;
    duration_prototype__proto.toJSON         = iso_string__toISOString;
    duration_prototype__proto.locale         = locale;
    duration_prototype__proto.localeData     = localeData;

    // Deprecations
    duration_prototype__proto.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', iso_string__toISOString);
    duration_prototype__proto.lang = lang;

    // Side effect imports

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    utils_hooks__hooks.version = '2.10.6';

    setHookCallback(local__createLocal);

    utils_hooks__hooks.fn                    = momentPrototype;
    utils_hooks__hooks.min                   = min;
    utils_hooks__hooks.max                   = max;
    utils_hooks__hooks.utc                   = create_utc__createUTC;
    utils_hooks__hooks.unix                  = moment__createUnix;
    utils_hooks__hooks.months                = lists__listMonths;
    utils_hooks__hooks.isDate                = isDate;
    utils_hooks__hooks.locale                = locale_locales__getSetGlobalLocale;
    utils_hooks__hooks.invalid               = valid__createInvalid;
    utils_hooks__hooks.duration              = create__createDuration;
    utils_hooks__hooks.isMoment              = isMoment;
    utils_hooks__hooks.weekdays              = lists__listWeekdays;
    utils_hooks__hooks.parseZone             = moment__createInZone;
    utils_hooks__hooks.localeData            = locale_locales__getLocale;
    utils_hooks__hooks.isDuration            = isDuration;
    utils_hooks__hooks.monthsShort           = lists__listMonthsShort;
    utils_hooks__hooks.weekdaysMin           = lists__listWeekdaysMin;
    utils_hooks__hooks.defineLocale          = defineLocale;
    utils_hooks__hooks.weekdaysShort         = lists__listWeekdaysShort;
    utils_hooks__hooks.normalizeUnits        = normalizeUnits;
    utils_hooks__hooks.relativeTimeThreshold = duration_humanize__getSetRelativeTimeThreshold;

    var _moment = utils_hooks__hooks;

    return _moment;

}));

(function(scope) {
    "use strict"; /* jshint maxcomplexity:19, maxdepth:6 */

    var DYNLIST_ENABLED = true;

    var logger;

    var viewModeTemplates = {
        'cloud-drive': [
            // List view mode
            '<table>' +
                '<tr>' +
                    '<td class="space-maintainer-start"></td>' +
                    '<td megatype="fav">' +
                        '<span class="grid-status-icon sprite-fm-mono icon-dot"></span>' +
                    '</td>' +
                    '<td megatype="fname">' +
                        '<span class="item-type-icon"><img/></span>' +
                        '<span class="tranfer-filetype-txt"></span>' +
                    '</td>' +
                    '<td megatype="label" class="label"></td>' +
                    '<td megatype="size" class="size"></td>' +
                    '<td megatype="type" class="type"></td>' +
                    '<td megatype="timeAd" class="time ad"></td>' +
                    '<td megatype="timeMd" class="time md"></td>' +
                    '<td megatype="versions" class="hd-versions"></td>' +
                    '<td megatype="playtime" class="playtime"></td>' +
                    '<td megatype="fileLoc" class="fileLoc">' +
                        '<span class="grid-file-location"></span>' +
                    '</td>' +
                    '<td megatype="extras" class="grid-url-field own-data">' +
                        '<a class="grid-url-arrow"><i class="sprite-fm-mono icon-options"></i></a>' +
                        '<span class="versioning-indicator">' +
                            '<i class="sprite-fm-mono icon-versions-previous"></i>' +
                        '</span>' +
                        '<i class="sprite-fm-mono icon-link"></i>' +
                    '</td>' +
                    '<td class="space-maintainer-end" megatype="empty"></td>' +
                '</tr>' +
            '</table>',

            // Icon view mode
            '<a class="data-block-view">' +
                '<span class="data-block-bg ">' +
                    '<span class="data-block-indicators">' +
                        '<span class="file-status-icon indicator sprite-fm-mono"></span>' +
                        '<span class="versioning-indicator">' +
                            '<i class="sprite-fm-mono icon-versions-previous"></i>' +
                        '</span>' +
                        '<i class="sprite-fm-mono icon-link"></i>' +
                    '</span>' +
                    '<span class="item-type-icon-90"><img/></span>' +
                    '<span class="file-settings-icon"><i class="sprite-fm-mono icon-options"></i></span>' +
                    '<div class="video-thumb-details">' +
                        '<i class="sprite-fm-mono icon-play"></i>' +
                        '<span>00:00</span>' +
                    ' </div>' +
                '</span>' +
                '<span class="file-block-title"></span>' +
            '</a>'
        ],

        'shares': [
            // List view mode
            '<table>' +
                '<tr>' +
                    '<td></td>' +
                    '<td>' +
                        '<div ' +
                            'class="item-type-icon-90 icon-folder-incoming-90 sprite-fm-uni-after icon-warning-after"' +
                        '>' +
                        '</div>' +
                        '<div class="shared-folder-info-block">' +
                            '<div class="shared-folder-name"></div>' +
                            '<div class="shared-folder-info"></div>' +
                        '</div>' +
                    '</td>' +
                    '<td>' +
                        '<div class="fm-chat-user-info todo-star ustatus">' +
                            '<div class="todo-fm-chat-user-star"></div>' +
                            '<div class="fm-chat-user"><span></span><div class="nw-contact-status"></div></div>' +
                            '<div class="fm-user-verification"><span></span></div>' +
                            '<div class="clear"></div>' +
                        '</div>' +
                    '</td>' +
                    '<td>' +
                        '<div class="shared-folder-size"></div>' +
                    '</td>' +
                    '<td>' +
                        '<div class="shared-folder-access"><i class="sprite-fm-mono"></i><span></span></div>' +
                    '</td>' +
                    '<td class="grid-url-header-nw">' +
                        '<a class="grid-url-arrow"><i class="sprite-fm-mono icon-options"></i></a>' +
                    '</td>' +
                    '<td class="space-maintainer-end" megatype="empty"></td>' +
                '</tr>' +
            '</table>',

            // Icon view mode
            '<a class="data-block-view folder">' +
                '<span class="data-block-bg">' +
                    '<span class="data-block-indicators">' +
                       '<span class="file-status-icon indicator sprite-fm-mono"></span>' +
                       '<span class="shared-folder-access indicator sprite-fm-mono"></span>' +
                    '</span>' +
                    '<span class="item-type-icon-90 icon-folder-incoming-90"></span>' +
                    '<span class="file-settings-icon"><i class="sprite-fm-mono icon-options"></i></span>' +
                    '<div class="video-thumb-details">' +
                        '<i class="sprite-fm-mono icon-play"></i>' +
                        '<span>00:00</span>' +
                    '</div>' +
                '</span>' +
                '<span class="shared-folder-info-block">' +
                    '<span class="shared-folder-name"></span>' +
                    '<span class="shared-folder-info"></span>' +
                    '<div class="fm-user-verification"><span></span></div>' +
                '</span>' +
            '</a>'
        ],

        'out-shares': [
            // List view mode
            '<table>' +
                '<tr>' +
                    '<td width="50">' +
                        '<span class="grid-status-icon sprite-fm-mono icon-dot"></span>' +
                    '</td>' +
                    '<td>' +
                        '<div class="item-type-icon-90 icon-folder-outgoing-90"></div>' +
                        '<div class="shared-folder-info-block">' +
                            '<div class="shared-folder-name"></div>' +
                            '<div class="shared-folder-info"></div>' +
                        '</div>' +
                    '</td>' +
                    '<td width="240" class="simpletip-parent">' +
                        '<div class="fm-chat-users-wrapper">' +
                            '<div class="fm-chat-users"></div>' +
                            '<div class="fm-chat-users-other"></div>' +
                        '</div>' +
                    '</td>' +
                    '<td width="100">' +
                        '<div class="shared-folder-size"></div>' +
                    '</td>' +
                    '<td width="200">' +
                        '<div class="last-shared-time"></div>' +
                    '</td>' +
                    '<td class="grid-url-header-nw">' +
                        '<a class="grid-url-arrow"><i class="sprite-fm-mono icon-options"></i></a>' +
                    '</td>' +
                    '<td class="space-maintainer-end" megatype="empty"></td>' +
                '</tr>' +
            '</table>',

            // Icon view mode
            '<a class="data-block-view folder">' +
                '<span class="data-block-bg">' +
                    '<span class="data-block-indicators">' +
                       '<span class="file-status-icon indicator sprite-fm-mono"></span>' +
                    '</span>' +
                    '<span class="item-type-icon-90 icon-folder-outgoing-90"></span>' +
                    '<span class="file-settings-icon"><i class="sprite-fm-mono icon-options"></i></span>' +
                    '<div class="video-thumb-details">' +
                        '<i class="sprite-fm-mono icon-play"></i>' +
                        '<span>00:00</span>' +
                    ' </div>' +
                '</span>' +
                '<span class="shared-folder-info-block">' +
                    '<span class="shared-folder-name"></span>' +
                    '<span class="shared-contact-info"></span>' +
                '</span>' +
            '</a>'
        ],

        'file-requests': [
            // List view mode
            '<table>' +
                '<tr>' +
                    '<td class="space-maintainer-start"></td>' +
                    '<td megatype="fav">' +
                        '<span class="grid-status-icon sprite-fm-mono icon-dot"></span>' +
                    '</td>' +
                    '<td megatype="fname">' +
                        '<span class="item-type-icon"><img/></span>' +
                        '<span class="tranfer-filetype-txt"></span>' +
                    '</td>' +
                    '<td megatype="label" class="label"></td>' +
                    '<td megatype="size" class="size"></td>' +
                    '<td megatype="type" class="type"></td>' +
                    '<td megatype="timeAd" class="time ad"></td>' +
                    '<td megatype="timeMd" class="time md"></td>' +
                    '<td megatype="versions" class="hd-versions"></td>' +
                    '<td megatype="playtime" class="playtime"></td>' +
                    '<td megatype="fileLoc" class="fileLoc">' +
                        '<span class="grid-file-location"></span>' +
                    '</td>' +
                    '<td megatype="extras" class="grid-url-field own-data">' +
                        '<a class="grid-url-arrow"><i class="sprite-fm-mono icon-options"></i></a>' +
                        '<span class="versioning-indicator">' +
                            '<i class="sprite-fm-mono icon-versions-previous"></i>' +
                        '</span>' +
                        '<i class="sprite-fm-mono icon-link"></i>' +
                        '<a class="grid-file-request-manage hidden">' +
                            '<i class="sprite-fm-mono icon-manage-folders"></i>' +
                        '</a>' +
                    '</td>' +
                    '<td class="space-maintainer-end" megatype="empty"></td>' +
                '</tr>' +
            '</table>',

            // Icon view mode
            '<a class="data-block-view">' +
                '<span class="data-block-bg ">' +
                    '<span class="data-block-indicators">' +
                        '<span class="file-status-icon indicator sprite-fm-mono"></span>' +
                        '<span class="versioning-indicator">' +
                            '<i class="sprite-fm-mono icon-versions-previous"></i>' +
                        '</span>' +
                        '<i class="sprite-fm-mono icon-link"></i>' +
                    '</span>' +
                    '<span class="item-type-icon-90"><img/></span>' +
                    '<span class="file-settings-icon"><i class="sprite-fm-mono icon-options"></i></span>' +
                    '<div class="video-thumb-details">' +
                        '<i class="sprite-fm-mono icon-play"></i>' +
                        '<span>00:00</span>' +
                    ' </div>' +
                '</span>' +
                '<span class="file-block-title"></span>' +
            '</a>'
        ],

        'subtitles': [
            // List view mode
            '<table>' +
                '<tr>' +
                    '<td class="space-maintainer-start"></td>' +
                    '<td megatype="fname">' +
                        '<span class="item-type-icon"><img/></span>' +
                        '<span class="tranfer-filetype-txt"></span>' +
                    '</td>' +
                    '<td megatype="size" class="size"></td>' +
                    '<td megatype="timeAd" class="time ad"></td>' +
                    '<td megatype="location" class="location">' +
                        '<span class="simpletip simpletip-breadcrumb block w-full text-ellipsis"></span>' +
                    '</td>' +
                '</tr>' +
            '</table>'
        ]
    };

    var viewModeContainers = {
        'cloud-drive': [
            '.grid-table.fm',
            '.fm-blocks-view.fm .file-block-scrolling',
        ],
        'shares': [
            '.shared-grid-view .grid-table.shared-with-me',
            '.shared-blocks-scrolling'
        ],
        'out-shares': [
            '.out-shared-grid-view .grid-table.out-shares',
            '.out-shared-blocks-scrolling'
        ],
        'file-requests': [
            '.grid-table.fm',
            '.fm-blocks-view.fm .file-block-scrolling',
        ],
        'subtitles': [
            '.mega-dialog .grid-table'
        ]
    };

    var versionColumnPrepare = function(versionsNb, VersionsSize) {
        var versionsTemplate = '<div class="ver-col-container">' +
            '<div class="ver-nb">' + versionsNb + '</div>' +
            '<div class="ver-icon versioning">' +
            '<span class="versioning-indicator"><i class="sprite-fm-mono icon-versions-previous"></i></span>' +
            '</div>' +
            '<div class="ver-size">' +
            '<div class="ver-size-nb">' + bytesToSize(VersionsSize) + '</div>' +
            '</div>' +
            '</div>';

        // safe will remove any scripts
        return parseHTML(versionsTemplate).firstChild;
    };

    mBroadcaster.once('startMega', function() {
        logger = MegaLogger.getLogger('MegaRender');

        var parser = function(template) {
            template = parseHTML(template).firstChild;

            if (template.nodeName === 'TABLE') {
                template = template.querySelector('tr');
            }

            return template;
        };

        // Convert html-templates to DOM nodes ready to use
        for (var section in viewModeTemplates) {
            if (viewModeTemplates.hasOwnProperty(section)) {
                var templates = viewModeTemplates[section];

                viewModeTemplates[section] = templates.map(parser);
            }
        }

        if (d) {
            logger.info('viewModeTemplates', viewModeTemplates);
        }
    });

    // Define object properties
    var define = function(target, property, value) {
        Object.defineProperty(target, property, {
            value : value
        });
    };

    /**
     * MegaRender
     * @param {Number} aViewMode I.e M.viewmode
     * @constructor
     */
    function MegaRender(aViewMode) {
        var renderer;
        var section = 'cloud-drive';
        var location = 'default';

        if (M.currentdirid === 'shares') {
            section = 'shares';
        }
        else if (M.currentdirid === 'out-shares') {
            section = 'out-shares';
        }
        else if (M.currentrootid === 'file-requests') {
            section = 'file-requests';
        }
        else if (typeof aViewMode === 'string') {
            section = aViewMode;

            // For now, only lists are landing here, no need to set to 1
            aViewMode = 0;
        }
        if (section === 'cloud-drive') {

            if (!DYNLIST_ENABLED) {

                renderer = this.renderer['*'];
            }

            location =
                M.currentdirid === 'public-links' ? 'mixed-content' :
                    M.currentrootid === M.RubbishID ? 'trashcan' :
                        M.currentrootid === M.InboxID ? 'backups' :
                            M.isDynPage(M.currentdirid) ? 'dyn-page' : location;
        }
        else {
            this.chatIsReady = megaChatIsReady;
        }

        this.labelsColors = {
            'red': l[16223],
            'orange': l[16224],
            'yellow': l[16225],
            'green': l[16226],
            'blue': l[16227],
            'purple': l[16228],
            'grey': l[16229]
        };

        this.numInsertedDOMNodes = 0;

        define(this, 'viewmode',            aViewMode);
        define(this, 'nodeMap',             Object.create(null));
        define(this, 'buildDOMNode',        this.builders[section]);
        define(this, 'finalize',            this.finalizers[section]);
        define(this, 'template',            viewModeTemplates[section][this.viewmode]);
        define(this, 'initialize',          this.initializers[section] || this.initializers['*']);
        define(this, 'render',              renderer || this.renderer[section] || this.renderer['*']);
        define(this, 'getNodeProperties',   this.nodeProperties[section] || this.nodeProperties['*']);
        define(this, 'section',             section);
        define(this, 'location',            location);
        this.versionColumnPrepare = versionColumnPrepare;

        if (scope.d) {
            var options = {
                levelColors: {
                    'ERROR': '#DE1F35',
                    'DEBUG': '#837ACC',
                    'WARN':  '#DEBB1F',
                    'INFO':  '#1F85CE',
                    'LOG':   '#9B7BA6'
                }
            };
            define(this, 'logger', new MegaLogger(section, options, logger));
        }

        renderer = undefined;
    }

    MegaRender.prototype = Object.freeze({
        constructor: MegaRender,

        /**
         * Cleanup rendering layout.
         * Called prior to rendering the contents.
         *
         * @param {Boolean} aUpdate       Whether we're updating the list
         * @param {Object}  aNodeList     List of nodes to process, I.e M.v
         * @param {String}  aListSelector DOM query selector for the main list
         * @return {Number} The number of nodes in the current folder.
         */
        cleanupLayout: function(aUpdate, aNodeList, aListSelector) {
            // TODO: This is copied as-is from the former method and should be OOPized as well.
            if (this.logger) {
                console.time('MegaRender.cleanupLayout');
            }

            if (!aUpdate) {
                delete M.rmItemsInView;
                M.hideEmptyGrids();
                $.tresizer();

                sharedFolderUI();

                $('.grid-table tbody tr').not('.conversationsApp .grid-table tbody tr').remove();
                $('.file-block-scrolling a').remove();
                $('.shared-blocks-scrolling a').remove();
                $('.out-shared-blocks-scrolling a').remove();

                // eslint-disable-next-line local-rules/jquery-replacements
                $(aListSelector).show().parent().children('table').show();
            }

            // Draw empty grid if no contents.
            var nodeListLength = aNodeList.length;
            let fmRightFileBlock = document.querySelector('.fm-right-files-block:not(.in-chat)');

            if (nodeListLength || (M.currentdirid && M.currentdirid.includes('user-management'))) {

                if (fmRightFileBlock) {
                    fmRightFileBlock.classList.remove('emptied');
                }
            }
            else {

                if (fmRightFileBlock) {
                    fmRightFileBlock.classList.add('emptied');
                }

                if (M.RubbishID && M.currentdirid === M.RubbishID) {
                    $('.fm-empty-trashbin').removeClass('hidden');
                    $('.fm-clearbin-button').addClass('hidden');
                }
                else if (String(M.currentdirid).substr(0, 7) === 'search/'
                        || mega.ui.mNodeFilter.selectedFilters
                        && M.currentrootid !== 'shares') {
                    $('.fm-empty-search').removeClass('hidden');
                }
                else if (M.currentdirid === M.RootID && folderlink) {
                    // FIXME: implement
                    /*if (!isValidShareLink()) {
                        $('.fm-invalid-folder').removeClass('hidden');
                    }
                    else {*/
                        $('.fm-empty-folder-link').removeClass('hidden');
                    /*} */
                }
                else if (M.currentrootid === M.RootID
                        || M.currentrootid === M.RubbishID
                        || M.currentrootid === M.InboxID) {
                    // If filter is empty show 'Your label filter did not match any documents'
                    if (M.currentLabelFilter) {
                        $('.fm-empty-filter').removeClass('hidden');
                    }
                    else if (M.currentdirid === M.RootID) {
                        $('.fm-empty-cloud').removeClass('hidden');
                    }
                    else if (M.currentrootid) {
                        $('.fm-empty-folder').removeClass('hidden');
                    }
                }
                else if (M.currentrootid === 'out-shares') {
                    if (M.currentdirid === 'out-shares') {
                        $('.fm-empty-outgoing').removeClass('hidden');
                    }
                    else {
                        $('.fm-empty-folder').removeClass('hidden');
                    }
                }
                else if (M.currentrootid === 'file-requests') {
                    if (M.currentdirid === 'file-requests') {
                        $('.fm-empty-file-requests').removeClass('hidden');
                        mega.fileRequest.rebindPageEmptyCreateButton();
                    }
                    else {
                        $('.fm-empty-folder').removeClass('hidden');
                    }
                }
                else if (M.currentrootid === 'public-links') {
                    if (M.currentdirid === 'public-links') {
                        $('.fm-empty-public-link').removeClass('hidden');
                    }
                    else {
                        $('.fm-empty-folder').removeClass('hidden');
                    }
                }
                else if (M.currentrootid === 'shares') {
                    if (M.currentdirid === 'shares') {
                        $('.fm-empty-incoming').removeClass('hidden');
                    }
                    else {
                        M.emptySharefolderUI(aListSelector);
                    }
                }
                else if (M.isGalleryPage()) {
                    const pagetype = M.currentdirid === M.currentCustomView.nodeID ? M.currentdirid : 'discovery';

                    $(`.fm-empty-${pagetype}`).removeClass('hidden');
                    $('.gallery-view').addClass('hidden');
                }
                else if (M.isDynPage(M.currentdirid)) {
                    if (d > 2) {
                        console.log('Deferred dyn-page.', M.currentdirid);
                    }
                }
                else if (this.logger) {
                    this.logger.info('Empty folder not handled...', M.currentdirid, M.currentrootid);
                }
            }

            if (this.logger) {
                console.timeEnd('MegaRender.cleanupLayout');
            }

            return nodeListLength;
        },

        /**
         * Recreates the container if detached from the DOM
         * @param {String} selector The affected DOM node selector
         */
        rebindLayout: function(selector) {
            if (this.container && this.container.parentNode === null) {
                if (this.logger) {
                    this.logger.debug('Container detached from the DOM...', [this.container]);
                }

                if ($(this.container).is(selector)) {
                    var container = document.querySelector(viewModeContainers[this.section][this.viewmode]);

                    if (!container) {
                        if (this.logger) {
                            this.logger.debug('Expected container is not yet re-attached...');
                        }

                        // TODO: ensure we don't run into an infinite loop...
                        delay('MegaRender:rebindLayout', this.rebindLayout.bind(this, selector));
                    }
                    else {
                        this.container = container;
                        M.initShortcutsAndSelection(container, false, true);
                        if (this.logger) {
                            this.logger.debug('rebindLayout completed.', [container]);
                        }
                    }
                }
                else if (this.logger) {
                    this.logger.debug('Not the expected selector...', selector);
                }
            }
        },

        /**
         * Render layout.
         * @param {Boolean} aUpdate   Whether we're updating the list
         * @param {Object}  aNodeList Optional list of nodes to process
         * @return {Number} Number of rendered (non-cached) nodes
         */
        renderLayout: function(aUpdate, aNodeList) {
            var initData = null;
            this.numInsertedDOMNodes = 0;

            if (this.logger) {
                console.time('MegaRender.renderLayout');
            }

            if (aNodeList) {
                this.nodeList = aNodeList;
            }

            this.container = document.querySelector(viewModeContainers[this.section][this.viewmode]);

            if (!this.container) {
                siteLoadError(l[1311], this);
                return 0;
            }

            if (this.container.nodeName === 'TABLE') {
                var tbody = this.container.querySelector('tbody');
                var thead = this.container.querySelector('thead');

                if (tbody) {
                    this.container = tbody;
                }

                if (thead) {
                    this.header = thead;
                }
            }

            if (this.initialize) {
                initData = this.initialize(aUpdate, aNodeList);
                if (initData && initData.newNodeList) {
                    aNodeList = initData.newNodeList;

                    // Got a new nodeList, cleanup cached DOM nodes.
                    var nodes = Object.values(aNodeList);
                    for (var i = nodes.length; i--;) {
                        delete this.nodeMap[nodes[i].h];
                    }
                }
            }

            if (!DYNLIST_ENABLED || this.section !== 'cloud-drive') {
                for (var idx = 0; idx < aNodeList.length; idx++) {
                    var node = this.nodeList[idx];
                    if (node && node.h) {
                        var handle = node.h;
                        var domNode = this.getDOMNode(handle, node);

                        if (domNode) {
                            this.render(node, handle, domNode, idx | 0, aUpdate, initData);
                        }
                    }
                    else if (this.logger) {
                        this.logger.error('Invalid node.', idx, aNodeList[idx]);
                    }
                }
            }

            if (this.finalize) {
                this.finalize(aUpdate, aNodeList, initData);
            }

            if (this.logger) {
                console.timeEnd('MegaRender.renderLayout');
            }

            if (DYNLIST_ENABLED) {
                return this.numInsertedDOMNodes;
            }
            else {
                return aNodeList.length;
            }
        },

        setDOMColumnsWidth: function(nodeDOM) {
            var sectionName = 'cloud';

            if (this.section !== 'cloud-drive' && this.section !== 'file-requests') {
                sectionName = this.section;
            }

            // setting widths
            if (M && M.columnsWidth && M.columnsWidth[sectionName]) {

                const knownColumnsWidths = Object.keys(M.columnsWidth[sectionName]) || [];

                for (let col = 0; col < knownColumnsWidths.length; col++) {

                    const tCol = nodeDOM.querySelector('[megatype="' + knownColumnsWidths[col] + '"]');
                    const colWidths = M.columnsWidth[sectionName][knownColumnsWidths[col]];

                    if (tCol && tCol.nodeName === 'TH') {
                        tCol.classList.remove('hidden');

                        if (typeof colWidths.curr === 'number') {
                            tCol.style.width = colWidths.curr + 'px';
                        }
                        else {
                            tCol.style.width = colWidths.curr || '';

                            const headerWidth = getComputedStyle(tCol).width.replace('px', '') | 0;
                            const colMin = colWidths.min;
                            const colMax = colWidths.max;

                            if (headerWidth < colMin) {
                                tCol.style.width = `${colMin}px`;
                            }
                            else if (headerWidth > colMax) {
                                tCol.style.width = `${colMax}px`;
                            }
                        }

                        if (colWidths.hidden) {
                            tCol.classList.add('hidden');
                        }
                    }
                }
            }
        },


        /**
         * Retrieves a DOM node stored in the `nodeMap`,
         * creating it if it doesn't exists.
         *
         * @param {String} aHandle The ufs-node's handle
         * @param {String} [aNode]   The ufs-node
         */
        getDOMNode: function(aHandle, aNode) {

            if (!this.nodeMap[aHandle] && (aNode = aNode || M.getNodeByHandle(aHandle))) {
                var template = this.template.cloneNode(true);
                var properties = this.getNodeProperties(aNode, aHandle);

                // Set common attributes used by all builders
                template.setAttribute('id', aHandle);

                if (properties.tooltip) {
                    template.setAttribute('title', properties.tooltip.join("\n"));
                }
                this.addClasses(template, properties.classNames);

                // Construct a new DOM node, and store it for any further use.
                this.nodeMap[aHandle] = this.buildDOMNode(aNode, properties, template);
            }

            return this.nodeMap[aHandle];
        },

        /**
         * Expunges a DOM node stored in the `nodeMap`.
         *
         * @param {String} aHandle The ufs-node's handle
         * @param {Boolean} [aRemove] Remove it from the DOM as well?
         */
        revokeDOMNode: function(aHandle, aRemove) {
            if (this.nodeMap[aHandle]) {
                const node = this.nodeMap[aHandle];
                delete this.nodeMap[aHandle];

                if (this.unverifiedShare && node.classList.contains('unverified-share')) {
                    this.unverifiedShare--;
                }

                if (aRemove) {
                    node.remove();
                }
                return node;
            }
        },

        /**
         * Check whether a DOM node is visible.
         * nb: not necessarily in the view-port, but MegaList should handle that.
         *
         * @param {String} aHandle The ufs-node's handle
         * @returns {Boolean} whether it is
         */
        isDOMNodeVisible: function(aHandle) {
            const node = this.nodeMap[aHandle];
            const res = !!(node && node.parentNode);

            if (d > 1) {
                console.assert(!this.megaList || res === this.megaList.isRendered(aHandle));
            }

            return res;
        },

        /**
         * Checks if a DOM node for that `aHandle` is created and cached in MegaRender.
         *
         * @param aHandle
         */
        hasDOMNode: function(aHandle) {
            return !!this.nodeMap[aHandle];
        },

        /**
         * Add classes to DOM node
         * @param {Object} aDOMNode    DOM node to set class over
         * @param {Array}  aClassNames An array of classes
         */
        addClasses: function(aDOMNode, aClassNames) {
            aDOMNode.classList.add(...aClassNames);
        },

        /**
         * Remove classes from DOM node
         * @param {Object} aDOMNode    DOM node to set class over
         * @param {Array}  aClassNames An array of classes
         */
        removeClasses: function(aDOMNode, aClassNames) {
            aDOMNode.classList.remove(...aClassNames);
        },

        /**
         * Insert DOM Node.
         * @param {Object}  aNode      The ufs-node
         * @param {Number}  aNodeIndex The ufs-node's index at M.v
         * @param {Object}  aDOMNode   The DOM node to insert
         * @param {Boolean} aUpdate    Whether we're updating the list
         * @param {Object}  aDynCache  Dynamic list cache entry, optional
         */
        insertDOMNode: function(aNode, aNodeIndex, aDOMNode, aUpdate, aDynCache) {
            if (!aUpdate || !this.container.querySelector(aDOMNode.nodeName)) {
                // 1. if the current view does not have any nodes, just append it
                aNode.seen = true;
                this.numInsertedDOMNodes++;
                this.container.appendChild(aDOMNode);
            }
            else {
                var domNode;
                var prevNode;
                var nextNode;

                if (document.getElementById(aNode.h)) {
                    aNode.seen = true;
                    return;
                }

                if (aUpdate && (prevNode = this.nodeList[aNodeIndex - 1])
                        && (domNode = document.getElementById(prevNode.h))) {

                    // 2. if there is a node before the new node in the current view, add it after that node:
                    // this.logger.debug('// 2. ---', aNode.name, aNode);

                    domNode.parentNode.insertBefore(aDOMNode, domNode.nextElementSibling);
                }
                else if (aUpdate && (nextNode = this.nodeList[aNodeIndex + 1])
                        && (domNode = document.getElementById(nextNode.h))) {

                    // 3. if there is a node after the new node in the current view, add it before that node:
                    // this.logger.debug('// 3. ---', aNode.name, aNode);

                    domNode.parentNode.insertBefore(aDOMNode, domNode);
                }
                else if (aNode.t && (domNode = this.container.querySelector(aDOMNode.nodeName))) {
                    // 4. new folder: insert new node before the first folder in the current view
                    // this.logger.debug('// 4. ---', aNode.name, aNode);

                    domNode.parentNode.insertBefore(aDOMNode, domNode);
                }
                else {
                    // 5. new file: insert new node before the first file in the current view
                    // this.logger.debug('// 5. ---', aNode.name, aNode);

                    var file = this.container.querySelector(aDOMNode.nodeName + ':not(.folder)');
                    if (file) {
                        file.parentNode.insertBefore(aDOMNode, file);
                    }
                    else {
                        // 6. if this view does not have any files, insert after the last folder
                        // this.logger.debug('// 6. ---', aNode.name, aNode);

                        this.container.appendChild(aDOMNode);
                    }
                }
                aNode.seen = true;
                this.numInsertedDOMNodes++;
            }
        },

        /** Node properties collector */
        nodeProperties: freeze({
            /**
             * @param {Object}  aNode         The ufs-node
             * @param {String}  aHandle       The ufs-node's handle
             * @param {Boolean} aExtendedInfo Include info needed by builders
             */
            '*': function(aNode, aHandle, aExtendedInfo) {
                const props = {classNames: []};
                const share = M.getNodeShare(aNode);
                let itemIcon = fileIcon(aNode);

                if (aNode.su) {
                    props.classNames.push('inbound-share');
                }

                if (aNode.s4 && M.getS4NodeType(aNode) === 'bucket') {
                    props.type = l.s4_bucket_type;
                    props.classNames.push('folder');
                    props.size = bytesToSize(aNode.tb || 0);
                }
                else if (aNode.t) {
                    props.type = l[1049];
                    props.classNames.push('folder');
                    props.size = bytesToSize(aNode.tb || 0);
                }
                else {
                    props.classNames.push('file');
                    props.size = bytesToSize(aNode.s);
                    props.type = filetype(aNode, 0, 1);

                    if (aNode.fa && aNode.fa.indexOf(':8*') > 0) {
                        Object.assign(props, MediaAttribute(aNode).data);
                        props.codecs = MediaAttribute.getCodecStrings(aNode);
                    }
                }

                props.name = aNode.name;

                if (missingkeys[aHandle] || share.down) {
                    itemIcon = aNode.t ? 'folder' : 'generic';
                    props.type = l[7381];// i.e. 'unknown'

                    props.tooltip = [];

                    // Taken down item
                    if (share.down) {
                        props.takenDown = true;
                        props.classNames.push('taken-down');
                        props.tooltip.push(aNode.t ? l[7705] : l[7704]);
                    }

                    // Undecryptable node
                    if (missingkeys[aHandle]) {
                        props.undecryptable = true;
                        props.classNames.push('undecryptable');
                        props.name = aNode.t ? l[8686] : l[8687];
                        props.tooltip.push(M.getUndecryptedLabel(aNode));

                        if (self.nullkeys && self.nullkeys[aHandle]) {
                            props.classNames.push('undecryptable-zk');
                        }
                    }

                    props.inv411d = 1;
                }

                props.icon = `icon-${itemIcon}-24`;
                props.blockIcon = `icon-${itemIcon}-90`;

                if (aExtendedInfo !== false) {

                    if (share) {
                        props.linked = true;
                        props.classNames.push('linked');
                    }

                    if (!this.viewmode) {
                        if (M.currentCustomView.type === 'public-links' && aNode.shares && aNode.shares.EXP) {
                            props.time = aNode.shares.EXP.ts ? time2date(aNode.shares.EXP.ts) : '';
                            props.mTime = aNode.mtime ? time2date(aNode.mtime) : '';
                        }
                        else {
                            // props.time = time2date(aNode[M.lastColumn] || aNode.ts);
                            props.time = time2date(aNode.ts);
                            props.mTime = aNode.mtime ? time2date(aNode.mtime) : '';
                        }
                    }

                    // Colour label
                    if (aNode.lbl && !folderlink) {
                        var colourLabel = M.getLabelClassFromId(aNode.lbl);
                        props.classNames.push('colour-label');
                        props.classNames.push(colourLabel);
                        props.labelC = this.labelsColors[colourLabel];
                    }
                }
                if (aNode.su) {
                    props.parentName = l[5542];
                }
                else if (aNode.p === M.RubbishID) {
                    props.parentName = l[167];
                }
                else {
                    const pHandle = M.getNodeByHandle(aNode.p);
                    props.parentName = M.getNameByHandle(pHandle);
                }

                return props;
            },
            'shares': function(aNode, aHandle, aExtendedInfo) {
                var avatar;
                var props = this.nodeProperties['*'].call(this, aNode, aHandle, false);

                props.userHandle = aNode.su || aNode.p;
                props.userName = M.getNameByHandle(props.userHandle);
                props.folderSize = bytesToSize(aNode.tb);

                if (aNode.r === 1) {
                    props.accessRightsText = l[56];
                    props.accessRightsClass = 'read-and-write';
                    props.accessRightsIcon = 'icon-permissions-write';
                }
                else if (aNode.r === 2) {
                    props.accessRightsText = l[57];
                    props.accessRightsClass = 'full-access';
                    props.accessRightsIcon = 'icon-star';
                }
                else {
                    props.accessRightsText = l[55];
                    props.accessRightsClass = 'read-only';
                    props.accessRightsIcon = 'icon-read-only';
                }

                if (this.viewmode) {
                    if (aExtendedInfo !== false) {
                        avatar = useravatar.contact(props.userHandle, '', 'span');
                    }
                }
                else {
                    props.shareInfo = fm_contains(aNode.tf, aNode.td);

                    if (this.chatIsReady) {
                        var contact = M.u[props.userHandle];
                        if (contact) {
                            props.onlineStatus = M.onlineStatusClass(
                                contact.presence ? contact.presence : "unavailable"
                            );
                        }
                    }

                    if (aExtendedInfo !== false) {
                        avatar = useravatar.contact(props.userHandle);
                    }
                }

                if (avatar) {
                    props.avatar = parseHTML(avatar).firstChild;
                }

                // Colour label
                if (aNode.lbl && !folderlink && (aNode.su !== u_handle)) {
                    var colourLabel = M.getLabelClassFromId(aNode.lbl);
                    props.classNames.push('colour-label');
                    props.classNames.push(colourLabel);
                }

                return props;
            },
            'out-shares': function(aNode, aHandle, aExtendedInfo) {
                var props = this.nodeProperties['*'].call(this, aNode, aHandle, false);
                props.lastSharedAt = 0;
                props.userNames = [];
                props.userHandles = [];
                props.avatars = [];

                for (var i in aNode.shares) {
                    if (i !== 'EXP') {
                        props.lastSharedAt = Math.max(props.lastSharedAt, aNode.shares[i].ts);
                        props.userNames.push(M.getNameByHandle(i));
                        props.userHandles.push(aNode.shares[i].u);
                    }
                }

                // Adding pending shares data
                for (var suh in M.ps[aNode.h]) {
                    if (M.ps[aNode.h] && M.opc[suh]) {
                        props.lastSharedAt = Math.max(props.lastSharedAt, M.ps[aNode.h][suh].ts);
                        props.userNames.push(M.opc[suh].m);
                        props.userHandles.push(suh);
                    }
                }

                props.icon = fileIcon(aNode);
                props.userNames = props.userNames.sort();
                props.lastSharedAt = time2date(props.lastSharedAt);
                props.folderSize = bytesToSize(aNode.tb + (aNode.tvb || 0));

                if (this.viewmode) {
                    if (aExtendedInfo !== false) {
                        for (i = 0; i < props.userHandles.length && i < 4; i++) {
                            props.avatars.push(parseHTML(useravatar.contact(props.userHandles[i], '', 'span'))
                                .firstChild);
                        }
                    }
                }
                else {
                    props.shareInfo = fm_contains(aNode.tf, aNode.td);
                }

                // Colour label
                if (aNode.lbl && !folderlink && (aNode.su !== u_handle)) {
                    var colourLabel = M.getLabelClassFromId(aNode.lbl);
                    props.classNames.push('colour-label');
                    props.classNames.push(colourLabel);
                }

                return props;
            },
            'file-requests': function(...args) {
                return this.nodeProperties['*'].apply(this, args);
            }
        }),

        /** DOM Node Builders */
        builders: freeze({
            /**
             * @param {Object} aNode       The ufs-node
             * @param {Object} aProperties The ufs-node properties
             * @param {Object} aTemplate   The DOM Node template
             */
            'cloud-drive': function(aNode, aProperties, aTemplate) {
                var tmp;
                var title = [];
                let elm;
                const isBackup = this.location === 'backups'
                    || this.location === 'mixed-content' && M.getNodeRoot(aNode.h) === M.InboxID;

                if (aNode.fav && !folderlink && this.location !== 'trashcan' && M.currentrootid !== 'shares') {
                    elm = aTemplate.querySelector(this.viewmode ? '.file-status-icon' : '.grid-status-icon');
                    elm.classList.add('icon-favourite-filled');
                    elm.classList.remove('icon-dot');
                }

                if (isBackup) {

                    elm = aTemplate.querySelector(this.viewmode ? '.file-status-icon' : '.grid-status-icon');
                    if (elm) {
                        elm.classList.add('read-only');
                    }
                }

                if (!aNode.t && aNode.tvf) {
                    aTemplate.classList.add('versioning');
                    var vTemplate = aTemplate.querySelector('.hd-versions');
                    if (vTemplate) {
                        vTemplate.appendChild(versionColumnPrepare(aNode.tvf, aNode.tvb || 0));
                    }
                }

                if (aNode.vhl) {
                    aTemplate.classList.add(`highlight${aNode.vhl}`);
                }

                if (!aProperties.inv411d
                    && (this.viewmode || String(aProperties.name).length > 78 || aProperties.playtime !== undefined)) {

                    if (aProperties.width) {
                        title.push(aProperties.width + 'x' + aProperties.height + ' @' + aProperties.fps + 'fps');
                    }
                    if (aProperties.codecs) {
                        title.push(aProperties.codecs);
                    }
                    if (aNode.s) {
                        title.push(bytesToSize(aNode.s, 0));
                    }
                    if (aProperties.name) {
                        title.push(aProperties.name);
                    }
                }
                title = title.join(' ');

                if (this.viewmode) {
                    tmp = aTemplate.querySelector('.item-type-icon-90');

                    tmp.classList.add(aProperties.blockIcon);

                    if (aProperties.playtime !== undefined) {
                        aTemplate.querySelector('.data-block-bg').classList.add('video');
                        aTemplate.querySelector('.video-thumb-details span').textContent
                            = secondsToTimeShort(aProperties.playtime);
                    }

                    aTemplate.querySelector('.file-block-title').textContent = aProperties.name;
                    if (title) {
                        aTemplate.setAttribute('title', title);
                    }
                }
                else {
                    if (aProperties.linked) {
                        aTemplate.querySelector('.grid-url-field').classList.add('linked');
                    }

                    if (aProperties.size !== undefined) {
                        aTemplate.querySelector('.size').textContent = aProperties.size;
                    }
                    if (aProperties.playtime !== undefined) {
                        aTemplate.querySelector('.playtime').textContent = secondsToTimeShort(aProperties.playtime);
                    }
                    aTemplate.querySelector('.type').textContent = aProperties.type;
                    aTemplate.querySelector('.time').textContent = aProperties.time;
                    aTemplate.querySelector('.time.md').textContent = aProperties.mTime;
                    aTemplate.querySelector('.fileLoc span').textContent = aProperties.parentName;
                    aTemplate.querySelector('.label').textContent = aProperties.labelC || '';

                    tmp = aTemplate.querySelector('.tranfer-filetype-txt');
                    tmp.textContent = aProperties.name;
                    if (title) {
                        tmp.setAttribute('title', title);
                    }

                    tmp = aTemplate.querySelector('.item-type-icon');

                    // Public URL Access for S4 Bucket or Object
                    if (M.currentrootid === 's4' && s4.ui) {
                        aTemplate = s4.ui.updateNodePublicAccess(aNode, aTemplate);
                    }

                    if (aProperties.icon) {
                        tmp.classList.add(aProperties.icon);
                    }
                }

                this.addClasses(tmp, aProperties.classNames);

                if (aProperties.undecryptable) {

                    if (this.viewmode) {
                        elm = aTemplate.querySelector('.file-status-icon');
                        elm.classList.remove('icon-favourite-filled');
                        elm.classList.add('icon-info');
                    }
                    else {
                        elm = aTemplate.querySelector('.grid-status-icon');
                        elm.classList.remove('icon-dot', 'icon-favourite-filled');
                        elm.classList.add('icon-info');
                    }
                }

                if (aProperties.takenDown) {

                    if (this.viewmode) {
                        elm = aTemplate.querySelector('.file-status-icon');
                        elm.classList.remove('icon-favourite-filled');
                        elm.classList.add('icon-takedown');
                    }
                    else {
                        elm = aTemplate.querySelector('.grid-status-icon');
                        elm.classList.remove('icon-dot', 'icon-favourite-filled');
                        elm.classList.add('icon-takedown');
                    }
                }

                return aTemplate;
            },
            'shares': function(aNode, aProperties, aTemplate) {
                aTemplate.querySelector('.shared-folder-name').textContent = aProperties.name;

                var tmp = aTemplate.querySelector('.shared-folder-access');

                if (aProperties.avatar) {
                    var avatar = this.viewmode ? '.shared-folder-info-block' : '.fm-chat-user-info';
                    avatar = aTemplate.querySelector(avatar);

                    avatar.parentNode.insertBefore(aProperties.avatar, avatar);
                }

                if (this.viewmode) {

                    aTemplate.querySelector('.item-type-icon-90').classList.add(aProperties.blockIcon);
                    tmp.classList.add(aProperties.accessRightsIcon);

                    aTemplate.querySelector('.shared-folder-info')
                        .textContent = l[17590].replace('%1', aProperties.userName);

                    if (String(aProperties.name).length > 20) {
                        aTemplate.setAttribute('title', aProperties.name);
                    }
                }
                else {

                    tmp.querySelector('span').textContent = aProperties.accessRightsText;
                    tmp.querySelector('i').classList.add(aProperties.accessRightsIcon);

                    tmp = aTemplate.querySelector('.fm-chat-user-info');
                    tmp.classList.add(aProperties.userHandle);
                    if (aProperties.onlineStatus) {
                        tmp.classList.add(aProperties.onlineStatus[1]);
                    }

                    aTemplate.querySelector('.fm-chat-user span').textContent = aProperties.userName;
                    aTemplate.querySelector('.shared-folder-info').textContent = aProperties.shareInfo;
                    aTemplate.querySelector('.shared-folder-size').textContent = aProperties.folderSize;

                    if (String(aProperties.name).length > 78) {
                        aTemplate.setAttribute('title', aProperties.name);
                    }

                }

                const contactVerification = mega.keyMgr.getWarningValue('cv') | 0;
                tmp = aTemplate.querySelector('.fm-user-verification span');

                if (contactVerification) {
                    const ed = aNode.su && authring.getContactAuthenticated(aNode.su, 'Ed25519');

                    if (!(ed && ed.method >= authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON)) {
                        aTemplate.classList.add('unverified-share');
                        this.unverifiedShare = (this.unverifiedShare || 0) + 1;
                        tmp.textContent = l.verify_credentials;
                    }

                    aTemplate.classList.add('cv-on');
                }
                else {
                    aTemplate.classList.remove('cv-on');
                }

                return aTemplate;
            },
            'out-shares': function(aNode, aProperties, aTemplate) {

                let elm;

                if (aNode.fav && !folderlink) {
                    elm = aTemplate.querySelector(this.viewmode ? '.file-status-icon' : '.grid-status-icon');
                    elm.classList.add('icon-favourite-filled');
                    elm.classList.remove('icon-dot');
                }

                if (M.getNodeRoot(aNode.h) === M.InboxID) {
                    elm = aTemplate.querySelector(this.viewmode ? '.file-status-icon' : '.grid-status-icon');
                    elm.classList.add('read-only');
                }

                aTemplate.querySelector('.shared-folder-name').textContent = aProperties.name;

                if (this.viewmode) {
                    elm = aTemplate.querySelector('.item-type-icon-90');

                    if (aProperties.avatars) {

                        var avatarElement;
                        var avatar = this.viewmode ? '.shared-folder-info-block' : '.fm-chat-user-info';
                        avatar = aTemplate.querySelector(avatar);

                        if (aProperties.avatars.length === 1) {
                            avatarElement = aProperties.avatars[0];
                        }
                        else {
                            avatarElement = document.createElement("div");
                            avatarElement.classList = 'multi-avatar multi-avatar-' + aProperties.avatars.length;

                            for (var i in aProperties.avatars) {
                                if (aProperties.avatars[i]) {
                                    aProperties.avatars[i].classList += ' avatar-' + i;
                                    avatarElement.appendChild(aProperties.avatars[i]);
                                }
                            }
                        }

                        avatar.parentNode.insertBefore(avatarElement, avatar);

                    }

                    if (aProperties.blockIcon) {
                        aTemplate.querySelector('.item-type-icon-90').classList.add(aProperties.blockIcon);
                    }

                    if (String(aProperties.name).length > 20) {
                        aTemplate.setAttribute('title', aProperties.name);
                    }

                    var shareContactInfo = aTemplate.querySelector('.shared-contact-info');
                    shareContactInfo.textContent = mega.icu.format(l.contact_count, aProperties.userNames.length);
                    shareContactInfo.classList += ' simpletip';
                    shareContactInfo.dataset.simpletip = aProperties.userNames.join(",[BR]");
                }
                else {
                    tmp = aTemplate.querySelector('.fm-chat-user-info');

                    var otherCount = 0;
                    var userNames = aProperties.userNames;
                    if (aProperties.userNames.length > 3) {
                        userNames = userNames.slice(0, 3);
                        otherCount = aProperties.userNames.length - 3;
                        var sharedUserWrapper = aTemplate.querySelector('.fm-chat-users-wrapper');
                        sharedUserWrapper.classList += ' simpletip';
                        sharedUserWrapper.dataset.simpletip = aProperties.userNames.join(",[BR]");
                        aTemplate.querySelector('.fm-chat-users-other').textContent = mega.icu
                            .format(l.users_share_other_count, otherCount);
                    }
                    aTemplate.querySelector('.fm-chat-users').textContent = userNames.join(', ');
                    aTemplate.querySelector('.shared-folder-info').textContent = aProperties.shareInfo;
                    aTemplate.querySelector('.shared-folder-size').textContent = aProperties.folderSize;
                    aTemplate.querySelector('.last-shared-time').textContent = aProperties.lastSharedAt;

                    if (String(aProperties.name).length > 78) {
                        aTemplate.setAttribute('title', aProperties.name);
                    }

                    if (aProperties.icon) {
                        aTemplate.querySelector('.item-type-icon-90').classList.add(aProperties.icon);
                    }
                }

                return aTemplate;
            },
            'file-requests': function(aNode, aProperties, aTemplate) {
                const renderTemplate = this.builders['cloud-drive'].call(this, aNode, aProperties, aTemplate);

                if (aNode.t && mega.fileRequest.publicFolderExists(aNode.h)) {
                    const manageIcon = renderTemplate.querySelector('.grid-file-request-manage');

                    if (manageIcon) {
                        manageIcon.classList.remove('hidden');
                    }
                }

                return renderTemplate;
            },
            'subtitles': function(aNode, aProperties, aTemplate) {
                let tmp;
                let title = [];

                if (String(aProperties.name).length > 78) {
                    if (aProperties.width) {
                        title.push(`${aProperties.width}x${aProperties.height} @${aProperties.fps}fps`);
                    }
                    if (aProperties.codecs) {
                        title.push(aProperties.codecs);
                    }
                    if (aNode.s) {
                        title.push(bytesToSize(aNode.s, 0));
                    }
                    if (aProperties.name) {
                        title.push(aProperties.name);
                    }
                }
                title = title.join(' ');

                if (aProperties.size !== undefined) {
                    aTemplate.querySelector('.size').textContent = aProperties.size;
                }
                aTemplate.querySelector('.time').textContent = aProperties.time;
                aTemplate.querySelector('.location span').textContent =
                    aNode.p === M.RootID ? l[164] : M.d[aNode.p].name;

                tmp = aTemplate.querySelector('.tranfer-filetype-txt');
                tmp.textContent = aProperties.name;
                if (title) {
                    tmp.setAttribute('title', title);
                }

                tmp = aTemplate.querySelector('.item-type-icon');

                if (aProperties.icon) {
                    tmp.classList.add(aProperties.icon);
                }

                this.addClasses(tmp, aProperties.classNames);

                return aTemplate;
            }
        }),

        /** DOM Node Renderers */
        renderer: freeze({
            /**
             * @param {Object}  aNode      The ufs-node
             * @param {String}  aHandle    The ufs-node's handle
             * @param {Object}  aDOMNode   The DOM Node
             * @param {Number}  aNodeIndex The ufs-node's index in M.v
             * @param {Boolean} aUpdate    Whether we're updating the list
             * @param {Object}  aUserData  Any data provided by initializers
             */
            '*': function(aNode, aHandle, aDOMNode, aNodeIndex, aUpdate, aUserData) {
                if (!DYNLIST_ENABLED || !this.megaList) {
                    this.insertDOMNode(aNode, aNodeIndex, aDOMNode, aUpdate);
                }
            },
            'cloud-drive': function(aNode, aHandle, aDOMNode, aNodeIndex, aUpdate, aUserData) {
                if (!DYNLIST_ENABLED || !this.megaList) {
                    this.insertDOMNode(aNode, aNodeIndex, aDOMNode, aUpdate, cacheEntry);
                }
            },
            'file-requests': function(...args) {
                return this.renderer['cloud-drive'].apply(this, args);
            }
        }),

        /** Renderer initializers */
        initializers: freeze({
            /**
             * @param {Boolean} aUpdate   Whether we're updating the list
             * @param {Array}   aNodeList The list of ufs-nodes to process
             * @return {Array} a filtered list of nodes, if needed
             */
            '*': function(aUpdate, aNodeList) {
                if (!aUpdate) {
                    M.setLastColumn(localStorage._lastColumn);
                }

                return null;
            },
            'cloud-drive': function(aUpdate, aNodeList) {
                var result = this.initializers['*'].call(this, aUpdate, aNodeList);

                if (DYNLIST_ENABLED) {
                    if (!aUpdate || !this.megaList) {

                        var megaListOptions = {
                            'itemRenderFunction': M.megaListRenderNode,
                            'itemRemoveFunction': this.location === 'dyn-page' && M.megaListRemoveNode,
                            'preserveOrderInDOM': true,
                            'extraRows': 1,
                            'batchPages': 0,
                            'appendOnly': false,
                            'onContentUpdated': function() {

                                // If there is dragging happen, do not run this.
                                if ($.selecting) {
                                    return;
                                }

                                if (M.viewmode) {
                                    delay('thumbnails', fm_thumbnails, 2);
                                }
                                M.rmSetupUIDelayed(911);
                            },
                            'perfectScrollOptions': {
                                'handlers': ['click-rail', 'drag-thumb', 'wheel', 'touch'],
                                'minScrollbarLength': 20
                            },
                        };
                        var megaListContainer;

                        if (this.viewmode) {
                            megaListOptions.itemWidth = 192 + 4 + 4 + 16 /* 16 = margin-left */;
                            megaListOptions.itemHeight = 192 + 4 + 4 + 16 /* 16 = margin-top */;
                            megaListContainer = this.container;
                            megaListOptions.bottomSpacing = 24;
                        }
                        else {
                            megaListOptions.extraRows = 4;
                            megaListOptions.itemWidth = false;
                            megaListOptions.itemHeight = 32;
                            megaListOptions.headerHeight = 34;
                            megaListOptions.bottomSpacing = 6;
                            megaListOptions.appendTo = 'tbody';
                            megaListOptions.renderAdapter = new MegaList.RENDER_ADAPTERS.Table();
                            megaListContainer = this.container.parentNode.parentNode.parentNode;
                        }

                        define(this, 'megaList', new MegaList(megaListContainer, megaListOptions));
                    }

                    // are there any 'newnodes'? if yes, generate the .newNodeList, even if this was previously a
                    // non-megaList/megaRender initialized folder (e.g. empty)
                    if (aUpdate && aNodeList.length && Object(newnodes).length) {
                        if (!result) {
                            result = {};
                        }

                        var newNodes = [];
                        var objMap = newnodes
                            .map(function(n) {
                                return n.h;
                            })
                            .reduce(function(obj, value) {
                                obj[value] = 1;
                                return obj;
                            }, {});

                        for (var idx = aNodeList.length; idx--;) {
                            if (objMap[aNodeList[idx].h]) {
                                newNodes[idx] = aNodeList[idx];
                            }
                        }

                        if (newNodes.length) {
                            result.newNodeList = newNodes;
                            result.curNodeList = aNodeList;
                        }
                    }
                }

                return result;
            },
            'file-requests': function(aUpdate, aNodeList) {


                return this.initializers['cloud-drive'].call(this, aUpdate, aNodeList);
            }
        }),

        /** Renderer finalizers */
        finalizers: freeze({
            /**
             * @param {Boolean} aUpdate   Whether we're updating the list
             * @param {Array}   aNodeList The list of ufs-nodes processed
             * @param {Object}  aUserData  Any data provided by initializers
             */
            'cloud-drive': function(aUpdate, aNodeList, aUserData) {
                if (DYNLIST_ENABLED) {
                    if (!aUpdate) {
                        var container = document.querySelector(viewModeContainers[this.section][this.viewmode]);
                        this.addClasses(
                            document.querySelector(viewModeContainers[this.section][0 + !this.viewmode]),
                            ["hidden"]
                        );

                        this.addClasses(container, ['megaListContainer']);

                        // because, viewModeContainers is not perfectly structured as before (e.g.
                        // container != the actual container that holds the list, we try to guess/find the node, which
                        // requires showing
                        if (container.classList.contains("hidden")) {
                            this.removeClasses(container, ["hidden"]);
                        }

                        container = container.parentNode.closest('.fm');
                        if (container && container.classList.contains("hidden")) {
                            this.removeClasses(container, ["hidden"]);
                        }

                        this.megaList.batchReplace(aNodeList.map(String));

                        if (!this.viewmode && !this._headersReady) {

                            this._headersReady = true;
                            this.setDOMColumnsWidth(this.container.parentElement.querySelector('thead tr'));
                        }
                        this.megaList.initialRender();
                    }
                    else if (aUserData && aUserData.newNodeList && aUserData.newNodeList.length > 0) {
                        this.megaList.batchReplace(aUserData.curNodeList.map(String));
                    }
                }
            },
            'file-requests': function(aUpdate, aNodeList, aUserData) {
                this.finalizers['cloud-drive'].call(this, aUpdate, aNodeList, aUserData);
            }
        }),

        destroy: function() {
            if (this.megaList) {
                this.megaList.destroy();
            }
            oDestroy(this);
        },

        toString: function() {
            return '[MegaRender:' + this.section + ':' + this.viewmode + ']';
        }
    });

    define(scope, 'MegaRender', Object.freeze(MegaRender));
})(this);

(function($, scope) {
    'use strict';
    var dialogIdx = 0;
    var startingZIndex = 1300;

    /**
     * Prototype of reusable Dialog, which will eventually implement the following features:
     *  - showing
     *  - hiding
     *  - maintaining state
     *  - collapse/expand
     *  - closable
     *  - have support for events (hidden, shown, collapsed) on a global level (document) OR on a local (per Dialog
     *  instance)
     *  - automatic positioning to screen/element
     *
     *
     * @param opts {Object}
     * @constructor
     */
    var Dialog = function(opts) {
        var self = this;

        var defaultOptions = {
            /**
             * Required: .dialog Class name (excl. the starting ".")
             */
            'className': '',

            /**
             * features:
             */
            'focusable': true,
            'closable': true,
            'closableByEsc': false,
            'closableByOverlay': true,
            'expandable': true,
            'requiresOverlay': false,
            'defaultButtonStyle': true,

            /**
             * css class names
             */
            'expandableButtonClass': '.fm-mega-dialog-size-icon',
            'buttonContainerClassName': '',
            'buttonPlaceholderClassName': 'fm-mega-dialog-pad',

            /**
             * optional:
             */
            'title': '',
            'notAgainTag': null,
            'buttons': []
        };

        self.options = $.extend(true, {}, defaultOptions, opts);

        assert(self.options.className && self.options.className.length > 0, 'missing required option .className');

        self.$dialog = $('.mega-dialog.' + self.options.className);

        self.visible = false;
        self.expanded = false;
        self.dialogIdx = dialogIdx++;

        self.$toggleButton = null;

        self._initGenericEvents();
        self._renderButtons();
    };

    makeObservable(Dialog);

    Dialog.prototype._getEventSuffix = function() {
        return this.options.className.replace(".", "");
    };

    /**
     * Binds once the events for toggling the file picker
     */
    Dialog.prototype._initGenericEvents = function() {
        var self = this;

        if (self.options.focusable) {
            $('input, textarea, select', self.$dialog).rebind('focus.dialog' + self._getEventSuffix(),function() {
                self.$dialog.addClass('focused');
            });
            $('input, textarea, select', self.$dialog).rebind('blur.dialog' + self._getEventSuffix(),function() {
                self.$dialog.removeClass('focused');
            });
        }
        if (self.options.expandable) {
            $(self.options.expandableButtonClass, self.$dialog).rebind('click.dialog' + self._getEventSuffix(), function() {
                self.toggleExpandCollapse();
            });
        }
        if (self.options.title) {
            $('header h2, header h3', self.$dialog).first().text(self.options.title);
        }

        if (self.options.closable) {
            $('button.js-close', self.$dialog).rebind('click.dialog' + self._getEventSuffix(), () => {
                self.hide();
            });
        }
        else {
            $('button.js-close', self.$dialog).addClass('hidden');
        }

        // link dialog size with the textareas when/if resized by the user using the native resize func
        $('textarea', self.$dialog)
            .rebind('mouseup mousemove', function() {
                if (this.oldwidth  === null){this.oldwidth  = this.style.width;}
                if (this.oldheight === null){this.oldheight = this.style.height;}
                if (this.style.width != this.oldwidth || this.style.height != this.oldheight){
                    $(this).resize();
                    this.oldwidth  = this.style.width;
                    this.oldheight = this.style.height;
                }
            })
            // .rebind('resize', function() {
            //     self.reposition();
            // });
    };


    /**
     * Render buttons passed to the options.buttons array
     */
    Dialog.prototype._renderButtons = function() {
        var self = this;

        let $container = null;
        let $footer = null;
        if (self.options.buttons.length) {
            $footer = $('<footer />');
            $container = $('<div class="footer-container ' + self.options.buttonContainerClassName + '"/>');
        }
        else if (self.options.notAgainTag) {
            $footer = $('<footer />');
        }

        let $aside;
        if (self.options.notAgainTag) {
            $aside = $('<aside class="align-start" />');
            $aside.safeAppend(`<div class="not-again checkbox-block fm-chat-inline-dialog-button-sendFeedback">
                <div class="checkdiv checkboxOff">
                    <input type="checkbox" name="confirmation-checkbox" class="checkboxOff">
                </div>
                <label for="confirmation-checkbox" class="radio-txt">${l[229]}</label>
            </div>`);

            $('.not-again.checkbox-block', $aside).rebind('click.dialog', function() {
                var $c = $('.not-again.checkbox-block .checkdiv', $aside);
                if ($c.hasClass('checkboxOff')) {
                    $c.removeClass('checkboxOff').addClass('checkboxOn');
                    localStorage[self.options.notAgainTag] = 1;
                }
                else {
                    $c.removeClass('checkboxOn').addClass('checkboxOff');
                    delete localStorage[self.options.notAgainTag];
                }
            });

        }

        if (self.options.buttons.length > 0) {
            self.options.buttons.forEach(function(buttonMeta, k) {
                let $button;
                if (self.options.defaultButtonStyle) {
                    $button = $('<button class="mega-button"><span></span></button>');
                } else {
                    $button = $('<button><span></span></button>');
                }
                $button
                    .addClass(
                        buttonMeta.className
                    )
                    .rebind('click.dialog' + self._getEventSuffix(), function() {
                        buttonMeta.callback.apply(self, [buttonMeta]);
                    })
                    .find('span')
                        .text(
                            buttonMeta.label
                        );
                $container.append($button);
            });
        }

        if ($footer) {
            $footer.append($container);
            self.$dialog.append($footer);

            if ($aside) {
                $footer.append($aside);
            }
        }
    };

    /**
     * Show the picker (and if $toggleButton is passed, position it top/bottom)
     * @param [$toggleButton] {jQuery|DomElement} optional element to which to attach/render the dialog
     */
    Dialog.prototype.show = function($toggleButton) {
        var self = this;

        if (self.visible) {
            return;
        }
        if (!self.$dialog.css('z-index')) {
            self.$dialog.css('z-index', dialogIdx + startingZIndex);
        }

        self.trigger('onBeforeShow');

        self.visible = true;

        self.$dialog.removeClass('hidden');

        if ($toggleButton) {
            self.collapse($toggleButton);
            $toggleButton.addClass('active');
        }
        if (self.options.closable) {
            $(document.body).rebind('mousedown.dialogClose' + self.dialogIdx, function(e) {
                if ($(self.$dialog).find(e.target).length == 0 && $(self.$dialog).is(e.target) === false && !$(self.$dialog).is(".fm-mega-dialog")) {
                    self.hide();
                    return false;
                }
            });
        }
        if (self.options.closableByEsc) {
            $(document).rebind('keyup.' + self.options.className, function(evt) {
                if (evt.keyCode == 27) {
                    self.hide();
                }
            });
        }
        if (!self.options.expandable || self.options.requiresOverlay) {
            self._showOverlay();
        }

        // $(window).rebind('resize.dialogReposition' + self.dialogIdx, function(e) {
        //     self.reposition();
        // });
        // self.reposition();

        self.trigger('onShow');
    };

    /**
     * Hide the picker
     */
    Dialog.prototype.hide = function() {
        var self = this;

        if (!self.visible) {
            return;
        }
        if (self.$toggleButton) {
            self.$toggleButton.removeClass('active');
        }

        self.visible = false;
        self.$toggleButton = null;

        if (self.options.expandable && self.expanded) {
            self.collapse();
        }

        if (self.options.closable) {
            $(document.body).off('mousedown.dialogClose' + self.dialogIdx);
        }

        if (self.options.closableByEsc) {
            $(document).off('keyup.' + self.options.className);
        }

        self.$dialog.addClass('hidden');

        if (!self.options.expandable && self.options.requiresOverlay) {
            self._hideOverlay();
        }

        $(document.body).off('resize.dialogReposition' + self.dialogIdx);

        self.trigger('onHide');
    };

    /**
     * Toggle (show/hide) the picker
     */
    Dialog.prototype.toggle = function($toggleButton) {
        var self = this;
        self.$toggleButton = $($toggleButton);

        if (self.visible) {
            self.hide();
        } else {
            self.show(self.$toggleButton);
        }
    };


    /**
     * Collapse the dialog. If a $toggleButton is passed, then when the dialog is collapsed it will be positioned above
     * or bellow (top/bottom) of that DOM element
     *
     * @param [$toggleButton]
     */
    Dialog.prototype.collapse = function($toggleButton) {
        var self = this;
        self.expanded = false;
        $(self.options.expandableButtonClass)
            .addClass("short-size")
            .removeClass("full-size");

        self._hideOverlay();

        if ($toggleButton) {
            self.$toggleButton = $toggleButton;
        }

        if (self.$toggleButton) {
            self.$toggleButton.addClass('active');
        }

        // self.reposition();

        self.trigger('onCollapse');
    };

    /**
     * Expand the dialog to "full screen" mode
     */
    Dialog.prototype.expand = function() {
        var self = this;
        self.expanded = true;

        self.$dialog.addClass('expanded');

        self._showOverlay();

        $(self.options.expandableButtonClass)
            .removeClass("short-size")
            .addClass("full-size");

        if (self.$toggleButton) {
            self.$toggleButton.removeClass('active');
        }

        self.trigger('onExpand');

        // self.reposition();

    };

    Dialog.prototype._showOverlay = function() {
        var self = this;

        if (self.options.closableByOverlay) {
            $('.fm-dialog-overlay').rebind('click.dialog' + self.dialogIdx, () => {
                self.hide();
            });
        }

        $('.fm-dialog-overlay').removeClass('hidden');

        if (is_mobile) {
            $('body').addClass('overlayed');
        }
        else if (!$('body').hasClass('bottom-pages')) {
            $('body').addClass('overlayed');
        }
    };

    Dialog.prototype._hideOverlay = function() {
        var self = this;
        if (!$('.mega-dialog.arrange-to-back').length) {
            $('.fm-dialog-overlay').addClass('hidden');
            $('body').removeClass('overlayed');
        }

        $('.fm-dialog-overlay').off('click.dialog' + self.dialogIdx);
    };
    /**
     * Toggle (show/hide) the picker
     */
    Dialog.prototype.toggleExpandCollapse = function() {
        var self = this;
        if (self.expanded) {
            self.collapse();
        } else {
            self.expand();
        }
    };

    /**
     * Hide & cleanup
     */
    Dialog.prototype.destroy = function() {
        var self = this;
        if (self.visible) {
            self.hide();
        }
        if (self.$dialog) {
            self.$dialog.remove();
        }
    };

    // export
    scope.mega = scope.mega || {};
    scope.mega.ui = scope.mega.ui || {};
    scope.mega.ui.Dialog = Dialog;
})(jQuery, window);

(function($, scope) {

    /**
     * Warning dialog when there is a fingerprint mismatch e.g. a MITM attack in progress.
     * Triggerable with the following test code (change the user handle to one in your account's M.u):
     * mega.ui.CredentialsWarningDialog.singleton(
     *      '4Hlf71R5IxY',
     *      'Ed25519',
     *      'ABCDEF0123456789ABCDEF0123456789ABCDEF01',
     *      'ABCDFF0123456789ABCDEE0123456788ABCDEF00'
     * );
     *
     * @param opts {Object}
     * @constructor
     */
    var CredentialsWarningDialog = function(opts) {
        var self = this;

        var defaultOptions = {
            /**
             * Required: .dialog Class name (excl. the starting ".")
             */
            'className': 'credentials-warning-dialog',

            /**
             * features:
             */
            'focusable': true,
            'closable': false,
            'expandable': true,
            'requiresOverlay': true,

            /**
             * css class names
             */
            'expandableButtonClass': '.fm-mega-dialog-size-icon',
            'buttonContainerClassName': '',
            'buttonPlaceholderClassName': '',

            /**
             * optional:
             */
            'title': 'Warning',
            'buttons': [
                {
                    'label': l[148],
                    'className': 'mega-button',
                    'callback': function() {
                        this.hide();
                        this._hideOverlay();
                        mega.ui.CredentialsWarningDialog.rendernext();
                    }
                }
            ]
        };

        mega.ui.Dialog.call(this, Object.assign({}, defaultOptions, opts));

        self.bind("onBeforeShow", function() {
            $('.fm-dialog-overlay').addClass('hidden');
        });
    };

    CredentialsWarningDialog.prototype = Object.create(mega.ui.Dialog.prototype);

    CredentialsWarningDialog.prototype._initGenericEvents = function() {
        var self = this;

        // Renders the dialog details, also shows the previous and new fingerprints differences in red
        this._renderDetails();
        this._renderFingerprints();

        mega.ui.Dialog.prototype._initGenericEvents.apply(self);
    };

    /**
     * Reset state of dialog if it had previously appeared this session and they had reset credentials
     */
    CredentialsWarningDialog.prototype._resetToDefaultState = function() {

        var $dialog = $('.credentials-warning-dialog');

        $dialog.find('.previousCredentials').show();
        $dialog.find('.newCredentials').show();
        $dialog.find('.resetCredentials').show();
        $dialog.find('.reset-credentials-button').removeClass('hidden');
        $dialog.find('.postResetCredentials').hide();
        $dialog.find('.verifyCredentials').hide();
    };

    /**
     * Render the placeholder details in the dialog
     */
    CredentialsWarningDialog.prototype._renderDetails = function() {

        // Change wording to seen or verified
        var infoFirstLine = (CredentialsWarningDialog.seenOrVerified === 'seen') ? l[6881] : l[6882];
            infoFirstLine = infoFirstLine.replace('%1', '<span class="emailAddress">' + CredentialsWarningDialog.contactEmail + '</span>');
        var title = (CredentialsWarningDialog.seenOrVerified === 'seen') ? l[6883] : l[6884];

        var $dialog = $('.credentials-warning-dialog');
        $dialog.find('.information .firstLine').html(infoFirstLine);
        $dialog.find('.previousCredentials .title').html(title);

        // If the avatar exists, show it
        if (typeof avatars[CredentialsWarningDialog.contactHandle] !== 'undefined') {
            $dialog.find('.userAvatar img').attr('src', avatars[CredentialsWarningDialog.contactHandle].url);
        }
        else {
            // Otherwise hide the avatar
            $dialog.find('.userAvatar').hide();
            $dialog.find('.information').addClass('noAvatar');
        }

        // Reset the contact's credentials
        $dialog.find('.reset-credentials-button').rebind('click', function() {

            // Reset the authring for the user and show the success message
            authring.resetFingerprintsForUser(CredentialsWarningDialog.contactHandle).catch(dump);

            // If they're already on the contact's page, reload the fingerprint info
            if (getSitePath() === '/fm/' + CredentialsWarningDialog.contactHandle) {

                // Get the user
                var user = M.u[CredentialsWarningDialog.contactHandle];

                showAuthenticityCredentials(user);
                enableVerifyFingerprintsButton(CredentialsWarningDialog.contactHandle);
            }

            // Change to verify details
            $dialog.find('.previousCredentials').hide();
            $dialog.find('.newCredentials').hide();
            $dialog.find('.resetCredentials').hide();

            // Show verify details
            $dialog.find('.postResetCredentials').show();
            $dialog.find('.verifyCredentials').show();

            // Copy the new credentials to the section to be shown after reset
            var $newCredentials = $dialog.find('.newCredentials .fingerprint').clone().removeClass('mismatch');
            $dialog.find('.postResetCredentials .fingerprint').html($newCredentials.html());

            // Hide the current Reset button and show the Verify contact one
            $(this).addClass('hidden');
            $dialog.find('.verify-contact-button').removeClass('hidden');
        });

        // Button to view the verification dialog
        $dialog.find('.verify-contact-button').rebind('click', function() {

            // Hide the dialog and show the regular fingerprint dialog
            CredentialsWarningDialog._instance.hide();
            fingerprintDialog(CredentialsWarningDialog.contactHandle);
        });
    };

    /**
     * Renders the previous and new fingerprints showing the differences in red
     */
    CredentialsWarningDialog.prototype._renderFingerprints = function() {
        var userHandle = CredentialsWarningDialog.contactHandle;
        var keyType = CredentialsWarningDialog.keyType;
        var previousFingerprint = CredentialsWarningDialog.previousFingerprint;
        var newFingerprint = CredentialsWarningDialog.newFingerprint;
        var previousFingerprintHtml = '';
        var newFingerprintHtml = '';

        // Build up the fingerprint HTML
        for (var i = 0, groupCount = 0, length = previousFingerprint.length;  i < length;  i++) {

            var previousFingerprintChar = previousFingerprint.charAt(i);
            var newFingerprintChar = '';

            // If the previous fingerprint character doesn't match the new character, make it red
            if (previousFingerprint.charAt(i) !== newFingerprint.charAt(i)) {
                newFingerprintChar = '<span class="mismatch">' + newFingerprint.charAt(i) + '</span>';
            }
            else {
                newFingerprintChar = newFingerprint.charAt(i);
            }

            // Close current group of 4 hex chars
            if (groupCount === 3) {
                previousFingerprintHtml += previousFingerprintChar + '</span>';
                newFingerprintHtml += newFingerprintChar + '</span>';
                groupCount = 0;
            }

            // Start a new group of 4 hex chars
            else if (groupCount === 0) {
                previousFingerprintHtml += '<span>' + previousFingerprintChar;
                newFingerprintHtml += '<span>' + newFingerprintChar;
                groupCount++;
            }
            else {
                // Add to existing group
                previousFingerprintHtml += previousFingerprintChar;
                newFingerprintHtml += newFingerprintChar;
                groupCount++;
            }
        }

        // Render new fingerprints
        var $dialog = $('.credentials-warning-dialog');
        $dialog.find('.previousCredentials .fingerprint').html(previousFingerprintHtml);
        $dialog.find('.newCredentials .fingerprint').html(newFingerprintHtml);
    };

    /**
     * Render next warning in the waiting list.
     */
    CredentialsWarningDialog.rendernext = function() {

        if (mega.ui.CredentialsWarningDialog.waitingList) {
            var key = mega.ui.CredentialsWarningDialog.currentKey;
            if (key) {
                delete mega.ui.CredentialsWarningDialog.waitingList[key];
            }
            var keys = Object.keys(mega.ui.CredentialsWarningDialog.waitingList);
            if (keys.length > 0) {
                key = keys[0];
                mega.ui.CredentialsWarningDialog.singleton(
                        mega.ui.CredentialsWarningDialog.waitingList[key].contactHandle,
                        mega.ui.CredentialsWarningDialog.waitingList[key].keyType,
                        mega.ui.CredentialsWarningDialog.waitingList[key].prevFingerprint,
                        mega.ui.CredentialsWarningDialog.waitingList[key].newFingerprint);

                mega.ui.CredentialsWarningDialog._instance._renderDetails();
                mega.ui.CredentialsWarningDialog._instance._renderFingerprints();
                CredentialsWarningDialog.currentKey = key;
            }
        }
    };
    /**
     * Initialises the Credentials Warning Dialog
     * @param {String} contactHandle The contact's user handle
     * @param {String} keyType The key type e.g. Ed25519, RSA
     * @param {String} prevFingerprint The previous fingerprint as a hexadecimal string
     * @param {String} newFingerprint The current fingerprint as a hexadecimal string
     * @returns {CredentialsWarningDialog._instance}
     */
    CredentialsWarningDialog.singleton = function(contactHandle, keyType, prevFingerprint, newFingerprint) {

        // Set to object so can be used later
        CredentialsWarningDialog.contactHandle = contactHandle;
        CredentialsWarningDialog.keyType = keyType;
        CredentialsWarningDialog.contactEmail = M.u[contactHandle].m;
        CredentialsWarningDialog.seenOrVerified = u_authring[keyType][contactHandle].method;
        CredentialsWarningDialog.seenOrVerified =
            (CredentialsWarningDialog.seenOrVerified === authring.AUTHENTICATION_METHOD.SEEN) ? 'seen' : 'verified';
        CredentialsWarningDialog.previousFingerprint = prevFingerprint;
        CredentialsWarningDialog.newFingerprint = newFingerprint;
        if (!CredentialsWarningDialog.waitingList) {
            CredentialsWarningDialog.waitingList = {};
        }
        var key = contactHandle + keyType;
        CredentialsWarningDialog.waitingList[key] = {
            'contactHandle' : contactHandle,
            'keyType' : keyType,
            'prevFingerprint' : prevFingerprint,
            'newFingerprint' : newFingerprint
        };

        if (!CredentialsWarningDialog._instance) {
            CredentialsWarningDialog._instance = new CredentialsWarningDialog();
            CredentialsWarningDialog.currentKey = key;
        }
        else {
            CredentialsWarningDialog._instance._resetToDefaultState();
            if (key !== CredentialsWarningDialog.currentKey) {
                mega.ui.CredentialsWarningDialog._instance._renderDetails();
                mega.ui.CredentialsWarningDialog._instance._renderFingerprints();
                CredentialsWarningDialog.currentKey = key;
            }
        }

        CredentialsWarningDialog._instance.show();


        return CredentialsWarningDialog._instance;
    };

    // Export
    scope.mega = scope.mega || {};
    scope.mega.ui = scope.mega.ui || {};
    scope.mega.ui.CredentialsWarningDialog = CredentialsWarningDialog;

})(jQuery, window);

(function($, scope) {

    function showLoginRequiredDialog(options) {
        var promise = new MegaPromise();
        options = options || {};

        // Already logged-in, even on ephemeral?
        if (u_type !== false && (!options.minUserType || u_type >= options.minUserType)) {
            Soon(function() {
                promise.resolve();
            });
        }
        else if (options.skipInitialDialog) {
            showLoginDialog(promise, options);
        }
        else {
            var icon;
            var loginRequiredDialog = new mega.ui.Dialog({
                'className': 'loginrequired-dialog',
                'closable': true,
                'focusable': false,
                'expandable': false,
                'requiresOverlay': true,
                'title': options.title || l[5841],
                'buttons': []
            });
            loginRequiredDialog.bind('onHide', function() {
                Soon(function() {
                    if (promise) {
                        promise.reject();
                        promise = undefined;
                    }
                });
            });
            loginRequiredDialog.bind('onBeforeShow', function() {
                $('header h2', this.$dialog)
                    .text(this.options.title);

                $('header p', this.$dialog)
                    .text(options.textContent || l[7679]);

                $('button.pro-login', this.$dialog)
                    .rebind('click.loginrequired', function() {
                        loginRequiredDialog.hide();
                        showLoginDialog(promise, options);
                        promise = undefined;
                        return false;
                    });

                if (options.showRegister) {
                    $('button.pro-register', this.$dialog)
                        .rebind('click.loginrequired', () => {
                            loginRequiredDialog.hide();
                            showRegisterDialog(promise);
                            promise = undefined;
                            return false;
                        });
                    $('button.pro-register span', this.$dialog).text(l.sign_up_btn);
                }
                else {
                    $('button.pro-register', this.$dialog)
                        .rebind('click.loginrequired', () => {
                            promise.reject();
                            return false;
                        });
                    $('button.pro-register span', this.$dialog).text(l[82]);
                }
            });

            loginRequiredDialog.show();

            promise.always(function __lrdAlways() {
                loginRequiredDialog.hide();
                loginRequiredDialog = undefined;
                closeDialog();
                promise = undefined;
            });
        }

        return promise;
    }

    function showLoginDialog(aPromise, options) {
        var $dialog = $('.mega-dialog.pro-login-dialog');
        var $inputs = $('input', $dialog);
        var $button = $('.top-dialog-login-button', $dialog);

        if (M.chat) {
            $('aside', $dialog).removeClass('hidden');
            $('aside > p > a', $dialog).rebind('click.doSignup', () => {
                closeDialog();
                megaChat.loginOrRegisterBeforeJoining(undefined, true, false, false, options.onLoginSuccessCb);
            });
        }
        else if (options.showRegister) {
            $('aside', $dialog).removeClass('hidden');
            $('aside > p > a', $dialog).rebind('click.doSignup', () => {
                closeDialog();
                mega.ui.showRegisterDialog({
                    showLogin: !folderlink,
                    title: l[5840],
                    onAccountCreated: function(gotLoggedIn, accountData) {
                        if (gotLoggedIn) {
                            completeLogin(u_type);
                        }
                        else {
                            security.register.cacheRegistrationData(accountData);

                            if (!options.noSignupLinkDialog) {
                                mega.ui.sendSignupLinkDialog(accountData);
                            }
                        }
                    }
                }, folderlink ? aPromise : null);
            });
        }
        else {
            $('aside', $dialog).addClass('hidden');
        }

        M.safeShowDialog('pro-login-dialog', function() {

            // Init inputs events
            accountinputs.init($dialog);

            return $dialog;
        });

        // controls
        $('button.js-close', $dialog).rebind('click.proDialog', function() {
            closeDialog();
            aPromise.reject();
        });

        $inputs.val('');

        $inputs.rebind('keydown', function(e) {

            $inputs.removeClass('errored').parent().removeClass('error');

            if (e.keyCode == 13) {
                doLogin($dialog, aPromise);
            }
        });

        $('.top-login-forgot-pass', $dialog).rebind('click.loginreq', function(e) {
            e.preventDefault();
            aPromise.reject();
            if (is_chatlink) {
                is_chatlink = false;
                delete megaChat.initialPubChatHandle;
                megaChat.destroy();
            }
            loadSubPage('recovery');
        });

        $button.rebind('click.loginreq', function(e) {
            doLogin($dialog, aPromise);
        });

        $button.rebind('keydown.loginreq', function (e) {
            if (e.keyCode === 13) {
                doLogin($dialog, aPromise);
            }
        });
    }

    var completePromise = null;

    function doLogin($dialog, aPromise) {

        loadingDialog.show();

        // Save the promise for use in the completeLogin function
        completePromise = aPromise;

        var $formWrapper = $dialog.find('form');
        var $emailInput = $dialog.find('#login-name3');
        var $passwordInput = $dialog.find('#login-password3');
        var $rememberMeCheckbox = $dialog.find('.login-check input');

        var email = $emailInput.val().trim();
        var password = $passwordInput.val();
        var rememberMe = $rememberMeCheckbox.is('.checkboxOn');  // ToDo check if correct
        var twoFactorPin = null;

        if (email === '' || !isValidEmail(email)) {
            $emailInput.megaInputsShowError(l[141]);
            $emailInput.focus();
            loadingDialog.hide();

            return false;
        }
        else if (password === '') {
            $passwordInput.megaInputsShowError(l[1791]);
            loadingDialog.hide();

            return false;
        }

        // Checks if they have an old or new registration type, after this the flow will continue to login
        security.login.checkLoginMethod(email, password, twoFactorPin, rememberMe, startOldLogin, startNewLogin);
    }

    /**
     * Starts the old login proceedure
     * @param {String} email The user's email address
     * @param {String} password The user's password as entered
     * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if N/A
     * @param {Boolean} rememberMe Whether the user clicked the Remember me checkbox or not
     */
    function startOldLogin(email, password, pinCode, rememberMe) {

        postLogin(email, password, pinCode, rememberMe).then(completeLogin).catch(tell);
    }

    /**
     * Start the new login proceedure
     * @param {String} email The user's email addresss
     * @param {String} password The user's password as entered
     * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if N/A
     * @param {Boolean} rememberMe A boolean for if they checked the Remember Me checkbox on the login screen
     * @param {String} salt The user's salt as a Base64 URL encoded string
     */
    function startNewLogin(email, password, pinCode, rememberMe, salt) {

        // Start the login using the new process
        security.login.startLogin(email, password, pinCode, rememberMe, salt, completeLogin);
    }

    /**
     * Completes the login process
     * @param {Number} result The result from the API, e.g. a negative error num or the user type e.g. 3 for full user
     */
    function completeLogin(result) {
        'use strict';

        var $formWrapper = $('.pro-login-dialog form');
        var $emailInput = $formWrapper.find('#login-name3');
        var $passwordInput = $formWrapper.find('#login-password3');

        // Check and handle the common login errors
        if (security.login.checkForCommonErrors(result, startOldLogin, startNewLogin)) {
            return false;
        }

        // If successful result
        else if (result !== false && result >= 0) {

            u_type = result;
            u_checked = true;

            if (u_type === 3) {
                if ($.dialog === 'pro-login-dialog') {
                    closeDialog();
                }
                completePromise.resolve();
            }
            else {
                boot_auth(null, result);
                completePromise.reject();
            }

            $emailInput.val('');
            $passwordInput.val('');
        }
        else {
            $emailInput.megaInputsShowError();
            $passwordInput.megaInputsShowError(l[7431]);
            $passwordInput.focus();
        }
    }

    // export
    scope.mega.ui.showLoginRequiredDialog = showLoginRequiredDialog;

})(jQuery, window);

(function(scope) {
    'use strict';
    var options = {};

    /*jshint -W074*/
    // ^ zxcvbn stuff..

    function closeRegisterDialog($dialog, isUserTriggered) {
        console.assert(options.closeDialog || $.dialog === 'register', 'Invalid state...');

        if (options.closeDialog) {
            options.closeDialog();
        }
        else if ($.dialog === 'register') {
            delete $.registerDialog;
            closeDialog();

            $(window).off('resize.proregdialog');
            $('.fm-dialog-overlay').off('click.registerDialog');
            $('button.js-close', $dialog).off('click.registerDialog');
            $('input', $dialog).val('');
            $('.understand-check', $dialog).removeClass('checkboxOn').addClass('checkboxOff');
            $('.register-check', $dialog).removeClass('checkboxOn').addClass('checkboxOff');

            if (isUserTriggered && options.onDialogClosed) {
                options.onDialogClosed($dialog);
            }
        }

        options = {};
    }

    function doProRegister($dialog, aPromise) {
        const rv = {};
        const hideOverlay = () => {
            loadingDialog.hide();
            $dialog.removeClass('arrange-to-back');
        };

        const $button = $('button:not(.js-close)', $dialog).addClass('disabled');
        if (options.onCreatingAccount) {
            options.onCreatingAccount($dialog);
        }
        loadingDialog.show();
        $dialog.addClass('arrange-to-back');

        if (u_type > 0) {
            hideOverlay();
            msgDialog('warninga', l[135], l[5843]);
            $button.removeClass('disabled');
            return false;
        }

        const registrationDone = (login) => {

            const onAccountCreated = options.onAccountCreated && options.onAccountCreated.bind(options);

            hideOverlay();
            closeRegisterDialog($dialog);
            $('.mega-dialog.registration-page-success').off('click');

            if (login) {
                Soon(() => {
                    showToast('megasync', l[8745]);
                    $('.fm-avatar img').attr('src', useravatar.mine());
                });
            }
            onIdle(topmenuUI);

            if (typeof onAccountCreated === 'function') {
                onAccountCreated(login, rv);
            }
            else {
                // $('.mega-dialog.registration-page-success').removeClass('hidden');
                // fm_showoverlay();
                // ^ legacy confirmation dialog, with no email change option
                sendSignupLinkDialog(rv);
            }

            if (aPromise) {
                aPromise.resolve();
            }
        };

        /**
         * Continue the old method Pro registration
         * @param {Number} result The result of the 'uc' API request
         * @param {Boolean} oldMethod Using old registration method.
         */
        const continueProRegistration = (result, oldMethod) => {
            $button.removeClass('disabled');
            if (result === 0) {
                if (oldMethod) {
                    var ops = {
                        a: 'up',
                        terms: 'Mq',
                        name2: base64urlencode(to8(rv.name)),
                        lastname: base64urlencode(to8(rv.last)),
                        firstname: base64urlencode(to8(rv.first))
                    };
                    u_attr.terms = 1;

                    if (mega.affid) {
                        ops.aff = mega.affid;
                    }

                    api_req(ops);
                }
                registrationDone();
            }
            else {
                u_logout();
                hideOverlay();
                // closeRegisterDialog($dialog, true);
                $('.mega-dialog:visible').addClass('arrange-to-back');
                if (result === EEXIST) {
                    fm_hideoverlay();
                    msgDialog('warninga', l[1578], l[7869]);
                    options.$dialog.find('input.email').megaInputsShowError(l[1297]);
                }
                else {
                    msgDialog('warninga', l[1578], l[200], api_strerror(result), () => {
                        if ($('.mega-dialog:visible').removeClass('arrange-to-back').length) {
                            fm_showoverlay();
                        }
                    });
                }
            }
        };

        /**
         * Continue the new method registration
         * @param {Number} result The result of the 'uc2' API request
         */
        const continueNewProRegistration = (result) => {
            continueProRegistration(result, false);
        };

        /**
         * The main function to register the account
         */
        const registeraccount = function() {

            rv.password = $('input.pass', $dialog).val();
            rv.first = $.trim($('input.f-name', $dialog).val());
            rv.last = $.trim($('input.l-name', $dialog).val());
            rv.email = $.trim($('input.email', $dialog).val());
            rv.name = rv.first + ' ' + rv.last;

            // Set a flag that the registration came from the Pro page
            const fromProPage = sessionStorage.getItem('proPageContinuePlanNum') !== null;

            // Set the signup function to start the new secure registration process
            security.register.startRegistration(
                rv.first,
                rv.last,
                rv.email,
                rv.password,
                fromProPage,
                continueNewProRegistration);
        };

        let err = false;
        const $formWrapper = $('form', $dialog);
        const $firstName = $('input.f-name', $formWrapper);
        const $lastName = $('input.l-name', $formWrapper);
        const $email = $('input.email', $formWrapper);
        const $password = $('input.pass', $formWrapper);
        const $confirmPassword = $('input.confirm-pass', $formWrapper);

        const firstName = $.trim($firstName.val());
        const lastName = $.trim($lastName.val());
        const email = $.trim($email.val());
        const password = $password.val();
        const confirmPassword = $confirmPassword.val();

        // Check if the entered passwords are valid or strong enough
        const passwordValidationResult = security.isValidPassword(password, confirmPassword);

        // If bad result
        if (passwordValidationResult !== true) {

            // Show error for password field, clear the value and refocus it
            $password.val('').trigger('input');
            $password.focus();
            $password.megaInputsShowError(l[1102] + ' ' + passwordValidationResult);

            // Show error for confirm password field and clear the value
            $confirmPassword.val('');
            $confirmPassword.blur();
            $confirmPassword.megaInputsShowError();

            // Make These two error disappear together
            $password.rebind('input.hideError', () => {
                $confirmPassword.megaInputsHideError();
                $password.off('input.hideError');
                $confirmPassword.off('input.hideError');
            });

            $confirmPassword.rebind('input.hideError', () => {
                $password.megaInputsHideError();
                $password.off('input.hideError');
                $confirmPassword.off('input.hideError');
            });

            err = 1;
        }

        if (email === '' || !isValidEmail(email)) {
            $email.megaInputsShowError(l[1100] + ' ' + l[1101]);
            $email.focus();
            err = 1;
        }

        if (firstName === '' || lastName === '') {
            $firstName.megaInputsShowError(l[1098] + ' ' + l[1099]);
            $lastName.megaInputsShowError();
            $firstName.focus();

            // Make These two error disappear together
            $firstName.rebind('input.hideError', () => {
                $lastName.megaInputsHideError();
                $firstName.off('input.hideError');
                $lastName.off('input.hideError');
            });

            $lastName.rebind('input.hideError', () => {
                $firstName.megaInputsHideError();
                $firstName.off('input.hideError');
                $lastName.off('input.hideError');
            });

            err = 1;
        }

        if (!err) {
            if ($('.understand-check', $dialog).hasClass('checkboxOff')) {
                hideOverlay();
                msgDialog('warninga', l[1117], l[21957]);
            }
            else if ($('.register-check', $dialog).hasClass('checkboxOff')) {
                hideOverlay();
                msgDialog('warninga', l[1117], l[1118]);
            }
            else {
                if (u_type === false) {
                    hideOverlay();
                    u_storage = init_storage(localStorage);
                    u_checklogin({
                        checkloginresult: function(u_ctx, r) {
                            u_type = r;
                            registeraccount();
                        }
                    }, true);
                }
                else if (u_type === 0) {
                    registeraccount();
                }
            }
        }
        if (err) {
            hideOverlay();
            $button.removeClass('disabled');
        }
    }

    function showRegisterDialog(opts, aPromise) {
        if ($.len(options)) {
            closeRegisterDialog(options.$dialog, true);
        }
        options = Object(opts);
        var $dialog = options.$wrapper || $('.mega-dialog.pro-register-dialog');
        var $inputs = $('input', $dialog);
        var $button = $('button:not(.js-close)', $dialog);
        var $password = $('input[type="password"]', $dialog);

        // Controls events, close button etc
        if (options.controls) {
            options.controls();
        }
        else {
            // controls
            $('button.js-close', $dialog).rebind('click.registerDialog', function() {
                if (aPromise) {
                    aPromise.reject();
                }
                closeRegisterDialog($dialog, true);
                return false;
            });

            // close dialog by click on overlay
            $('.fm-dialog-overlay').rebind('click.registerDialog', function() {
                if (aPromise) {
                    aPromise.reject();
                }
                if ($.registerDialog === $.dialog) {
                    closeRegisterDialog($dialog, true);
                }
                else {
                    closeDialog();
                }
                return false;
            });
        }
        console.assert(options.showDialog || $.dialog !== 'register', 'Invalid state...');
        options.$dialog = $dialog;

        // Show dialog function
        if (options.showDialog) {
            options.showDialog();
        }
        else {
            M.safeShowDialog('register', function() {
                $.registerDialog = 'register';
                return $dialog;
            });
        }

        // Init inputs events
        accountinputs.init($dialog);

        if (M.chat) {
            $('aside .login-text', $dialog).removeClass('hidden');
            $('aside .login-text a, .register-side-pane.header a', $dialog)
                .rebind('click.doSignup', function() {
                    closeRegisterDialog($dialog, true);
                    megaChat.loginOrRegisterBeforeJoining(
                        undefined,
                        false,
                        true,
                        undefined,
                        opts.onLoginSuccessCb
                    );
                });
        }
        else if (options.showLogin) {
            $('aside', $dialog).removeClass('no-padding');
            $('aside .login-text', $dialog).removeClass('hidden');
            $('aside .login-text a, .register-side-pane.header a', $dialog)
                .rebind('click.doSignup', function() {
                    var onAccountCreated = options.onAccountCreated && options.onAccountCreated.bind(options);

                    closeRegisterDialog($dialog, true);
                    mega.ui.showLoginRequiredDialog({minUserType: 3, skipInitialDialog: 1})
                        .then(function() {
                            if (typeof onAccountCreated === 'function') {
                                onAccountCreated(2, false);
                            }
                            else if (d) {
                                console.warn('Completed login, but have no way to notify the caller...');
                            }
                        }).catch(console.debug.bind(console));
                });
        }
        else {
            $('aside .login-text', $dialog).addClass('hidden');
            $('aside', $dialog).addClass('no-padding');
        }

        $inputs.val('');
        $password.parent().find('.password-status').removeClass('checked');

        $('header h2', $dialog).text(options.title || l[20755]);
        if (options.body) {
            $('header p', $dialog).safeHTML(options.body);
        }
        else {
            $('header p', $dialog).safeHTML(l[20757]);

            // Hide the "Create an account and get x GB of free storage on MEGA"
            // text if coming from the discount promotion page
            if (sessionStorage.getItem('discountPromoContinuePlanNum')) {
                $('header p', $dialog).addClass('hidden');
            }
        }

        $inputs.rebind('keydown.proRegister', function(e) {
            if (e.keyCode === 13) {
                doProRegister($dialog, aPromise);
            }
        });

        $button.rebind('click.proRegister', function() {
            var $this = $(this);
            if ($this.hasClass('disabled')) {
                return false;
            }
            doProRegister($dialog, aPromise);
            return false;
        });

        $button.rebind('keydown.proRegister', function (e) {
            if (e.keyCode === 13  && !$(this).hasClass('disabled')) {
                doProRegister($dialog, aPromise);
                return false;
            }
        });
    }

    /**
     * Send Signup link dialog
     * @param {Object} accountData The data entered by the user at registration
     * @param {Function} onCloseCallback Optional callback to invoke on close
     */
    function sendSignupLinkDialog(accountData, onCloseCallback) {
        const $dialog = $('.mega-dialog.registration-page-success').removeClass('hidden');
        const $changeEmailLink = $('.reg-success-change-email-btn', $dialog);
        const $resendEmailButton = $('.resend-email-button', $dialog);

        if (page && page.indexOf("chat/") > -1  || page === "chat") {
            $dialog.addClass('chatlink');
            $('.reg-success-icon-chat', $dialog).removeClass('hidden');
            $('.reg-success-icon', $dialog).addClass('hidden');
        }
        else {
            $dialog.removeClass('chatlink');
            $('.reg-success-icon-chat', $dialog).addClass('hidden');
            $('.reg-success-icon', $dialog).removeClass('hidden');
        }

        const $resendEmailTxt = $('.reg-resend-email-txt', $dialog);
        $resendEmailTxt.text(accountData.email).attr('data-simpletip', accountData.email);

        $changeEmailLink.rebind('click', (event) => {
            event.preventDefault();
            $('.reg-resend-email-txt', $dialog).addClass('hidden');
            $('footer', $dialog).addClass('hidden');
            $('.content-block', $dialog).addClass('dialog-bottom');
            if ($dialog.hasClass('chatlink')) {
                $('.reg-success-special .chat-header', $dialog).text(l[22901]);
            }
            else {
                $(".reg-success-special div[class='reg-success-txt']", $dialog).text(l[22901]);
            }
            $('.reg-resend-email input', $dialog).val(accountData.email);
            $('.reg-resend-email', $dialog).removeClass('hidden');
        });

        $resendEmailButton.rebind('click', function _click() {
            const ctx = {
                callback: function(res) {
                    loadingDialog.hide();

                    if (res === -5) {
                        alert(l[7717]);
                        return;
                    }
                    if (res === EEXIST) {
                        $('.reg-resend-email-meg', $dialog).text(l[19562]);
                        $('input', $dialog).parent().addClass('error');
                        $('input', $dialog).focus();
                        return false;
                    }
                    if (res !== 0) {
                        console.error('sendsignuplink failed', res);

                        $resendEmailButton.addClass('disabled');
                        $resendEmailButton.off('click');

                        let tick = 26;
                        var timer = setInterval(() => {
                            if (--tick === 0) {
                                clearInterval(timer);
                                $resendEmailButton.text(l[8744]);
                                $resendEmailButton.removeClass('disabled');
                                $resendEmailButton.rebind('click', _click);
                            }
                            else {
                                $resendEmailButton.text('\u23F1 ' + tick + '...');
                            }
                        }, 1000);

                        alert(l[200]);
                    }
                    else {
                        closeDialog();
                        fm_showoverlay();

                        $dialog.removeClass('hidden');
                    }
                }
            };
            loadingDialog.show();

            const newEmail = $.trim($('input', $dialog).val());

            // Verify the new email address is in valid format
            if (!isValidEmail(newEmail)) {
                // Hide the loading spinner
                loadingDialog.hide();

                $('.reg-resend-email-meg', $dialog).text(l[1100]);
                $('input', $dialog).parent().addClass('error');
                $('input', $dialog).focus();
                return false;
            }

            security.register.repeatSendSignupLink(accountData.first, accountData.last, newEmail, ctx.callback);
        });

        if (typeof onCloseCallback === 'function') {
            // Show dialog close button
            $('button.js-close', $dialog).removeClass('hidden');

            $('button.js-close', $dialog).rebind('click', () => {

                msgDialog('confirmation', l[1334], l[5710], false, (ev) => {

                    // Confirm abort registration
                    if (ev) {

                        // Run 'user cancel registration' API command to cleanup the registration API side
                        api_req({ a: 'ucr' });
                        onCloseCallback();
                    }
                    else {
                        // Restore the background overlay which was closed by the msgDialog function
                        fm_showoverlay();
                    }
                });
            });
        }
        else {
            // Hide dialog close button
            $('button.js-close', $dialog).addClass('hidden');
        }

        if (onCloseCallback === true) {
            // we just want the close button to be show and to not trigger anything closing it.
            $('button.js-close', $dialog).removeClass('hidden');
            $('button.js-close', $dialog).rebind('click', () => {
                // TODO: Move this to safeShowDialog();
                $dialog.addClass('hidden');
                fm_hideoverlay();
                return false;
            });
        }

        fm_showoverlay();
        $('.content-block', $dialog).removeClass('dialog-bottom');
        $('footer', $dialog).removeClass('hidden');
        $dialog.addClass('special').show();

        if ($resendEmailTxt[0].scrollWidth > $resendEmailTxt[0].offsetWidth) {
            $resendEmailTxt.addClass('simpletip').attr("data-simpletip-class", "no-max-width");
        }
        else {
            $resendEmailTxt.removeClass('simpletip').removeAttr('data-simpletip-class');
        }
    }

    // export
    scope.mega.ui.showRegisterDialog = showRegisterDialog;
    scope.mega.ui.sendSignupLinkDialog = sendSignupLinkDialog;

})(this);

(function($, scope) {

    /**
     * Warning dialog when a public key's signature does not verify.
     * Triggerable with the following test code:
     * mega.ui.KeySignatureWarningDialog.singleton('4Hlf71R5IxY', 'RSA');
     *
     * @param opts {Object}
     * @constructor
     */
    var KeySignatureWarningDialog = function(opts) {
        var self = this;

        var defaultOptions = {
            /**
             * Required: .dialog Class name (excl. the starting ".")
             */
            'className': 'key-signature-warning-dialog',

            /**
             * features:
             */
            'focusable': true,
            'closable': false,
            'expandable': true,
            'requiresOverlay': true,

            /**
             * css class names
             */
            'expandableButtonClass': '.fm-mega-dialog-size-icon',
            'buttonContainerClassName': '',
            'buttonPlaceholderClassName': '',

            /**
             * optional:
             */
            'title': 'Warning',
            'buttons': [
                {
                    'label': l[148],
                    'className': 'mega-button',
                    'callback': function() {
                        this.hide();
                        this._hideOverlay();
                    }
                }
            ]
        };

        mega.ui.Dialog.call(this, Object.assign({}, defaultOptions, opts));

        self.bind("onBeforeShow", function() {
            $('.fm-dialog-overlay').addClass('hidden');
        });
    };

    KeySignatureWarningDialog.prototype = Object.create(mega.ui.Dialog.prototype);

    KeySignatureWarningDialog.prototype._initGenericEvents = function() {
        var self = this;

        // Renders the dialog details.
        this._renderDetails();

        mega.ui.Dialog.prototype._initGenericEvents.apply(self);
    };

    /**
     * Render the placeholder details in the dialog
     */
    KeySignatureWarningDialog.prototype._renderDetails = function() {

        // Change wording to seen or verified
        var infoFirstLine = l[7585];
        var contactEmail = KeySignatureWarningDialog.contactHandle;
        if (M.u[KeySignatureWarningDialog.contactHandle]) {
            contactEmail = M.u[KeySignatureWarningDialog.contactHandle].m;
        }
        infoFirstLine = infoFirstLine.replace('%1', KeySignatureWarningDialog.keyType);
        infoFirstLine = infoFirstLine.replace('%2', '<span class="emailAddress">'
                      + contactEmail + '</span>');

        $dialog = $('.key-signature-warning-dialog');
        $dialog.find('.information .firstLine').html(infoFirstLine);

        var description = l[8436];
        description = description.replace('%1', '<span class="emailAddress">'
                      + contactEmail + '</span>');
        description = description.replace('[A]', '<a href="mailto:support@mega.nz">');
        description = description.replace('[/A]', '</a>');
        $dialog.find('.information .description').html(description);

        // If the avatar exists, show it
        if (typeof avatars[KeySignatureWarningDialog.contactHandle] !== 'undefined') {
            $('.userAvatar img', $dialog).attr('src', avatars[KeySignatureWarningDialog.contactHandle].url);
            $('.userAvatar', $dialog).show();
        }
        else {
            // Otherwise hide the avatar
            $dialog.find('.userAvatar').hide();
        }
    };

    /**
     * Initialises the Key Signature Warning Dialog.
     *
     * @param {string} contactHandle The contact's user handle
     * @param {string} keyType The type of key for authentication.
     * @returns {KeySignatureWarningDialog._instance}
     */
    KeySignatureWarningDialog.singleton = function(contactHandle, keyType) {

        // Set to object so can be used later
        KeySignatureWarningDialog.contactHandle = contactHandle;
        KeySignatureWarningDialog.keyType = keyType;

        if (!KeySignatureWarningDialog._instance) {
            KeySignatureWarningDialog._instance = new KeySignatureWarningDialog();
        }

        KeySignatureWarningDialog._instance.show();

        return KeySignatureWarningDialog._instance;
    };

    // Export
    scope.mega = scope.mega || {};
    scope.mega.ui = scope.mega.ui || {};
    scope.mega.ui.KeySignatureWarningDialog = KeySignatureWarningDialog;

})(jQuery, window);

(function($, scope) {
    /**
     * Simple/reusable feedback dialog
     *
     * @constructor
     * @class mega.ui.FeedbackDialog
     * @param [opts] {Object}
     * @constructor
     */
    var FeedbackDialog = function(opts) {
        var self = this;

        var defaultOptions = {
            /**
             * Required: .dialog Class name (excl. the starting ".")
             */
            'className': 'feedback-dialog',

            /**
             * features:
             */
            'focusable': true,
            'closable': true,
            'closableByEsc': true,
            'expandable': true,
            'requiresOverlay': false,
            'defaultButtonStyle': false,

            /**
             * css class names
             */
            'expandableButtonClass': '.fm-mega-dialog-size-icon',
            'buttonContainerClassName': 'feedback-dialog-bottom',
            'buttonPlaceholderClassName': 'fm-mega-dialog-pad',

            /**
             * optional:
             */
            'title': l[1356],
            'buttons': [
                {
                    'label': l[1686],
                    'className': "mega-button large feedback-button-cancel disabled",
                    'callback': function() {
                        this.hide();
                    }
                },
                {
                    'label': l[7237],
                    'className': "mega-button large positive feedback-button-send disabled",
                    'callback': function() {
                        self._report.message = self.$textarea.val();
                        if ($('input[name="contact_me"]', self.$dialog).prop('checked')) {
                            self._report.contact_me = 1;
                        } else {
                            self._report.contact_me = 0;
                        }


                        var $selectedRating = $('.rating a.active', self.$dialog);
                        if ($selectedRating.length === 0) {
                            return false;
                        }

                        var rated = $('.rating a.active', self.$dialog)[0].className;
                        rated = rated.replace("rate", "").replace("active", "").replace(/\s+/g, "");
                        self._report.userId = u_handle;
                        self._report.rated = rated;
                        self._report.calls = [{ callid: self._callId, chatid: self._chatId }];
                        var dump = JSON.stringify(self._report);

                        var reportId = MurmurHash3(JSON.stringify(dump), 0x4ef5391a);
                        api_req({
                            a: 'clog',
                            t: "feedbackDialog." + self._type,
                            id: reportId,
                            d: dump
                        });

                        $('.feedback-dialog-body').addClass('hidden');
                        $('.mega-dialog.feedback-dialog footer').addClass('hidden');
                        $('.feedback-result-pad').removeClass('hidden');

                        $('.result-button', self.$dialog).rebind('click.feedbackDialog', function() {
                            self.hide();
                        });

                    }
                }
            ]
        };

        self._report = {};
        self._type = "undefined";

        mega.ui.Dialog.call(this, Object.assign({}, defaultOptions, opts));

        uiCheckboxes(self.$dialog, function(enabled) {

            if (this.id === 'send_stats') {

                if (enabled) {
                    loadingDialog.show();

                    generateAnonymousReport()
                        .done(function(report) {
                            self._report = report;
                        })
                        .always(function() {
                            loadingDialog.hide();
                        });
                }
                else {
                    self._report = {};
                }
            }
        });

        self.$checkboxes = $('.reply, .stats', self.$dialog);

        self.bind("onBeforeShow", function() {

            $('.rating a', self.$dialog)
                .removeClass("active colored");

            self.$textarea = $('textarea', self.$dialog);
            self.$textarea
                .val('')
                .next()
                .text('');

            initTextareaScrolling($('.feedback-dialog-scr textarea', self.$dialog));

            $('.collected-data', self.$dialog)
                .html('');

            $('.feedback-button-send, .feedback-button-cancel', self.$dialog)
                .addClass('disabled');

            $('.feedback-dialog-body').removeClass('hidden');
            $('.mega-dialog.feedback-dialog footer').removeClass('hidden');
            $('.feedback-result-pad').addClass('hidden');

            $('.collected-data', self.$dialog)
                .html('');

            $('input[name="send_stats"]', self.$dialog)
                .prop('checked', true)
                .trigger('change');

            $('input[name="contact_me"]', self.$dialog)
                .prop('checked', false)
                .trigger('change');
        });

        self.bind("onHide", function() {
            // reset some vars
            self._report = {};
            self._type = "undefined";
        });
    };

    FeedbackDialog.prototype = Object.create(mega.ui.Dialog.prototype);

    FeedbackDialog.prototype._initGenericEvents = function() {
        var self = this,
            collectedData,
            renderTimer;

        $('.rating a', self.$dialog).rebind('click.feedbackDialog', function() {
            $('.rating a', self.$dialog)
                .removeClass('active colored');

            $(this).addClass('active').prevAll().addClass('colored');

            $('.feedback-button-send, .feedback-button-cancel', self.$dialog).removeClass('disabled');
        });

        initTextareaScrolling($('.feedback-dialog-scr textarea'), 80);

        $('.feedback-question', self.$dialog).rebind('click.feedbackDialog', function() {
            var dialog = self.$dataReportDialog;
            if (!dialog) {
                dialog = self.$dataReportDialog = new mega.ui.Dialog({
                    className: 'collected-data-review-dialog',

                    /**
                     * features:
                     */
                    'focusable': true,
                    'closable': true,
                    'closableByEsc': true,
                    'expandable': true,
                    'requiresOverlay': false,

                    /**
                     * optional:
                     */
                    'title': 'Collected Data Report',
                    'buttons': [
                        {
                            'label': l[20840],
                            'className': "mega-button positive collected-data-review-button-copy",
                            'callback': function() {
                                copyToClipboard(JSON.stringify(self._report, null, 2), l[371], 'clipboard-copy', 2000);
                            }
                        },
                        {
                            'label': l[148],
                            'className': "mega-button collected-data-review-button-cancel",
                            'callback': function() {
                                this.hide();
                            }
                        }
                    ]
                });
            }

            dialog.show();

            collectedData = '<li>' + JSON.stringify(self._report, null, 2).replace(/\n/g, '</li> <li>');
            $('.collected-data', dialog.$dialog).html(collectedData);

            // Content render fix for correct scrolling
            var renderTimer = setInterval(function(){
                initPerfectScrollbar($('.collected-data-textarea'));
                clearInterval(renderTimer);
            }, 200);

        });

        mega.ui.Dialog.prototype._initGenericEvents.apply(self);
    };

    FeedbackDialog.singleton = function($toggleButton, rating, typeOfFeedback) {
        if (!FeedbackDialog._instance) {
            FeedbackDialog._instance = new FeedbackDialog();
        }

        if (typeOfFeedback) {
            FeedbackDialog._instance._type = typeOfFeedback;
        }
        FeedbackDialog._instance.show($toggleButton);

        mBroadcaster.addListener('closedialog', () => {
            if (FeedbackDialog._instance && FeedbackDialog._instance.visible) {
                FeedbackDialog._instance.hide();
            }
        });

        return FeedbackDialog._instance;
    };


    // export
    scope.mega = scope.mega || {};
    scope.mega.ui = scope.mega.ui || {};
    scope.mega.ui.FeedbackDialog = FeedbackDialog;
})(jQuery, window);

class ForcedUpgradeProDialog {

    /**
     * Forced upgrade to pro dialog constructor
     *
     * @param {Object} storageInfo the result from the call to M.getStorageQuota()
     */
    constructor(storageInfo) {
        // jQuery caches
        this.$dialog = $('.mega-dialog.upgrade-to-pro-dialog', 'body');
        this.$title = $('.title-and-blurb .title', this.$dialog);
        this.$blurb = $('.title-and-blurb .blurb', this.$dialog);
        this.$image = $('i.image', this.$dialog);

        // Get storage quota percentage
        this.storagePct = (storageInfo.cstrg / storageInfo.mstrg) * 100;

        // Get the registered timestamp
        this.registeredDate = new Date(u_attr.since * 1000);

        // Get the current time
        this.currentTime = unixtime() * 1000;
    }

    /**
     * Add event listeners for the tabs and buttons
     *
     * @returns {void}
     */
    initEventListeners() {
        $('.tab', this.$dialog).rebind('click.changeProDialogTab', (e) => {
            const $clickedTab = $(e.currentTarget, this.$dialog);
            eventlog($clickedTab.attr('data-evt'));

            // Change image and tab contents
            this.activeTab = parseInt($clickedTab.attr('data-tab-num'));
            this.changeContent();

            // Reset the timer to 0
            clearInterval(this.tabsTimer);
            this.setTabsTimer();
        });

        const _closeDialogCb = (eventId) => {
            eventlog(eventId);
            clearInterval(this.tabsTimer);
            closeDialog();
        };

        $('button.close-dialog', this.$dialog).rebind('click.closeUpgradeToProDialog', () => {
            _closeDialogCb(500265);
        });

        $('button.upgrade', this.$dialog).rebind('click.upgradeToProDialog', () => {
            _closeDialogCb(500266);
            loadSubPage('pro');
        });
    }

    /**
     * Function to change the dialog's content and animate it (fade in/out)
     *
     * @returns {void}
     */
    changeContent() {
        const contents = this.tabContents[this.activeTab];

        $('.title-and-blurb *', this.$dialog).addClass('animation');
        this.$title.text(contents.title);
        this.$blurb.text(contents.blurb);

        this.$image
            .addClass('animation')
            .css('background-image', `url(${staticpath}images/mega/${contents.imgName}.png)`);

        $('.tab', this.$dialog).removeClass('active');
        $(`.tab[data-tab-num=${this.activeTab}]`, this.$dialog).addClass('active');

        // Remove animation class when it has finished
        delay('tab-content-animation', () => {
            $('.title-and-blurb *', this.$dialog).removeClass('animation');
            this.$image.removeClass('animation');
        }, 500);
    }

    /**
     * Set a five second interval for changing the active tab and the content shown on the dialog
     *
     * @returns {void}
     */
    setTabsTimer() {
        this.tabsTimer = setInterval(() => {
            this.activeTab = this.activeTab === this.tabContents.length - 1 ? 0 : this.activeTab + 1;
            this.changeContent();
        }, 5000);
    }

    /**
     * Set the contents for each tab when it is active
     *
     * @returns {void}
     */
    initTabContents() {
        this.tabContents = [
            {
                tabName: l[495], // Storage
                imgName: 'dialog-storage',
                title: l.storage_flexibility,
                blurb: l.user_storage_needs,
                eventId: 500267
            },
            {
                tabName: l.pr_sharing,
                imgName: 'dialog-sharing',
                title: l.easy_file_sharing,
                blurb: l.share_file_benefits,
                eventId: 500268
            },
            {
                tabName: l[5906], // Access
                imgName: 'dialog-access',
                title: l.never_lose_data,
                blurb: l.backup_sync_data,
                eventId: 500269
            },
            {
                tabName: l.vpn_title,
                imgName: 'dialog-vpn',
                title: l.mega_vpn,
                blurb: l.vpn_stay_private,
                eventId: 500270
            },
            {
                tabName: l.meetings,
                imgName: 'dialog-meetings',
                title: l.unrestricted_calls,
                blurb: l.unrestricted_calls_blurb,
                eventId: 500271
            },
        ];

        // Create tabs based off above list
        const $tabTemplate = $('.tab.template', this.$dialog);
        let tabCount = 0;
        for (const tabInfo of this.tabContents) {
            const $tabNode = $tabTemplate.clone(true).appendTo($tabTemplate.parent());
            $tabNode
                .text(tabInfo.tabName)
                .removeClass('template')
                .toggleClass('active', tabCount === 0)
                .attr('data-tab-num', tabCount)
                .attr('data-evt', tabInfo.eventId);

            // Set info container title, blurb and image to contents for first tab
            if (tabCount === 0) {
                this.$title.text(tabInfo.title);
                this.$blurb.text(tabInfo.blurb);
                this.$image.css('background-image', `url(${staticpath}images/mega/${tabInfo.imgName}.png)`);
            }

            tabCount++;
        }
        $tabTemplate.remove();

        this.activeTab = 0;
    }

    /**
     * Update the texts on the dialog which could be hidden or need value replacement:
     * 1. Main blurb text of the dialog (has the price of the lowest pro plan)
     * 2. The price disclaimer section and asterisk next to the price (show/hide as appropriate)
     * 3. The blurb text when the Storage tab is active (replace the %1 placeholder with the storage value)
     *
     * @returns {void}
     */
    updateDialogTexts() {
        // Get details of lowest available pro plan
        const lowestProPlan = pro.membershipPlans.filter((plan) => {
            return pro.filter.simple.proPlans.has(plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL])
                && plan[pro.UTQA_RES_INDEX_MONTHS] === 1;
        })[0];

        // Get price and currency of lowest pro plan
        let dialogBlurbPrice;
        let dialogBlurbCurrency;
        let priceIsInEuros;

        if (lowestProPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY]
            && lowestProPlan[pro.UTQA_RES_INDEX_LOCALPRICE]) {
            dialogBlurbPrice = lowestProPlan[pro.UTQA_RES_INDEX_LOCALPRICE];
            dialogBlurbCurrency = lowestProPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];
            priceIsInEuros = false;
        }
        else {
            dialogBlurbPrice = lowestProPlan[pro.UTQA_RES_INDEX_PRICE];
            dialogBlurbCurrency = 'EUR';
            priceIsInEuros = true;
        }

        // Replace storage tab blurb string with storage value (x GB/TB)
        const storageGigabytes = lowestProPlan[pro.UTQA_RES_INDEX_STORAGE];
        const storageBytes = storageGigabytes * 1024 * 1024 * 1024;
        const storageFormatted = numOfBytes(storageBytes, 0);
        const storageSizeRounded = Math.round(storageFormatted.size);
        const storageValue = `${storageSizeRounded} ${storageFormatted.unit}`;
        l.user_storage_needs = l.user_storage_needs.replace('%1', storageValue);

        // Update dialog blurb text with the price of the lowest available Pro plan
        const dialogBlurbText = l.view_upgrade_pro_dialog_desc
            .replace('%1', formatCurrency(dialogBlurbPrice, dialogBlurbCurrency, 'narrowSymbol'));
        $('.upgrade-to-pro-dialog-description', this.$dialog).safeAppend(dialogBlurbText);

        // Show or hide the price disclaimer and asterisk as appropriate
        $('span.asterisk', '.upgrade-to-pro-dialog-description')
            .add($('.price-disclaimer', this.$dialog))
            .toggleClass('hidden', priceIsInEuros);
    }

    /**
     * Set the next time when the user can see the dialog based on their activity levels
     *
     * @returns {void}
     */
    async setNextDialogShowTime() {
        let nextDialogShowTime;

        const tenDaysAfterRegistration = new Date(this.registeredDate.getTime());
        tenDaysAfterRegistration.setDate(this.registeredDate.getDate() + 10);
        tenDaysAfterRegistration.setHours(0,0,0,0);

        // If the user is new (has registered in last 10 days), show the dialog again
        // after the tenth day
        if (this.currentTime < tenDaysAfterRegistration.getTime()) {
            nextDialogShowTime = tenDaysAfterRegistration.getTime();
        }
        else {
            // Check number of logins / sessions in last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setHours(0,0,0,0);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const {result: sessions} = await api.req({ a: 'usl', x: 1 });
            const sessionsInLastThirtyDays = sessions.filter((session) => {
                return session[0] * 1000 >= thirtyDaysAgo.getTime();
            }).length;

            let daysMultiplier;

            // Determine number of days until dialog can be shown again based on
            // number of logins / sessions (or storage quota used)
            if (sessionsInLastThirtyDays >= 15) {
                daysMultiplier = 3;
            }
            else if (sessionsInLastThirtyDays >= 10) {
                daysMultiplier = 4;
            }
            else if (sessionsInLastThirtyDays >= 5 || this.storagePct >= 50) {
                daysMultiplier = 5;
            }
            else {
                daysMultiplier = 15;
            }

            const nextDialogShowDate = new Date(this.currentTime + (86400 * 1000 * daysMultiplier));
            nextDialogShowDate.setHours(0,0,0,0);
            nextDialogShowTime = nextDialogShowDate.getTime();
        }

        mega.attr.set('fudnxt', String(nextDialogShowTime), -2, true);
    }

    /**
     * Check if the forced upgrade pro dialog can be shown to the user. Do not show this dialog if:
     * 1. the user registered in the last two days, or
     * 2. it is too early for them to see it again (based on the ^!fudnxt user attribute -
     * forced upgrade dialog next (show time)) and their storage quota isn't in the yellow or red
     * (almost full / full) state
     *
     * @returns {Promise} true if the forced upgrade pro dialog can be shown to the user, false if not
     */
    async canShowDialog() {
        // Get end of the day after registration (registration day + 1 at 23:59:59)
        const endOfDayAfterRegistering = new Date(this.registeredDate.getTime() + 86400 * 1000);
        endOfDayAfterRegistering.setHours(23,59,59,59);

        const registeredLastTwoDays = this.currentTime <= endOfDayAfterRegistering.getTime();

        // Get the the earliest time we can show the dialog next (if it exists)
        const nextDialogShowTime =
            parseInt(await Promise.resolve(mega.attr.get(u_handle, 'fudnxt', -2, true)).catch(nop)) || 0;

        if (nextDialogShowTime) {
            return this.currentTime >= nextDialogShowTime;
        }

        return !registeredLastTwoDays && this.storagePct < 90;
    }

    /**
     * Show the forced upgrade pro dialog if the user meets all the requirements
     *
     * @returns {void}
     */
    async showForcedUpgradeDialog() {
        const canShowDialog = await this.canShowDialog();
        this.setNextDialogShowTime();

        if (canShowDialog) {
            pro.loadMembershipPlans(() => {
                this.updateDialogTexts();

                M.safeShowDialog('upgrade-to-pro-dialog', () => {
                    this.initTabContents();
                    this.initEventListeners();
                    this.setTabsTimer();

                    eventlog(500264);

                    return this.$dialog;
                });
            });
        }
    }
}

mBroadcaster.once('fm:initialized', () => {
    'use strict';

    // Do not show on the below pages
    const isInvalidDialogPage = M.currentdirid === 'transfers'
        || String(M.currentdirid).includes('account')
        || String(M.currentdirid).includes('devices')
        || folderlink;

    // Also do not show on mobile web, to paid users, or if AB flag isn't set to the variant value (1)
    if (isInvalidDialogPage || is_mobile || u_attr.p || u_attr.pf || u_attr.b || !mega.flags.ab_fupd) {
        return;
    }

    onIdle(() => {
        M.getStorageQuota().then((storage) => {
            const forcedUpgradeProDialog = new ForcedUpgradeProDialog(storage);
            forcedUpgradeProDialog.showForcedUpgradeDialog();
        });
    });
});

/**
 * Various warning triangle popups from the top header. This covers
 * cases for over quota, ephemeral session, non activated accounts
 * after purchase, PRO plan expired warnings and site updates.
 */
var alarm = {

    /**
     * A flag for whether the popup has been seen or not so it won't keep auto showing on new pages
     * 0 = dialog and icon not hidden (they are visible)
     * 1 = dialog hidden but icon still visible (so it can be re-opened)
     * 2 = dialog and icon permanently hidden
     */
    hidden: 0,

    /**
     * Get active holder
     * @returns {Object} $holder of the dialog window
     */
    handler: function() {
        'use strict';
        const holderId = is_fm() && page !== 'start' ? 'fmholder' : 'startholder';
        const holder = document.getElementById(holderId);
        return holder && holder.querySelector('.js-topbar');
    },

    /**
     * Shows the warning popup
     * @param {Object} $button Button which allows to open dialog
     * @param {Object} $dialog The dialog
     */
    showWarningPopup: function($button, $dialog) {

        // If permanently hidden, make sure it stays hidden
        if (alarm.hidden === 2) {
            $button.addClass('hidden').removeClass('show');
        }

        // If they have seen it already, we still want to let them open the dialog
        // So just show the warning icon and they can click to re-show the dialog if they want
        else if (alarm.hidden === 1) {
            $button.removeClass('hidden show');
        }

        // Otherwise auto show the dialog and warning icon
        else {
            $button.removeClass('hidden').addClass('show');
        }
    },

    /**
     * Hides other warning dialogs if they are currently visible so there is no double up
     */
    hideAllWarningPopups: function(leaveButton) {

        'use strict';

        if (!leaveButton) {
            var $buttons = $('.js-dropdown-warning');
            $buttons.addClass('hidden').removeClass('show');
        }

    },

    /**
     * Adds a click event on the warning icon to hide and show the dialog
     * @param {Object} $button Button which allows to open dialog
     * @param {Object} $dialog The dialog
     */
    initWarningIconButton: function($button, $dialog) {

        // On warning icon click
        $button.rebind('click', '.js-top-buttons', function() {

            // If the popup is currently visible
            if ($button.hasClass('show')) {

                // Hide the popup
                $button.removeClass('show');

                // Set flag so it doesn't auto show each time
                alarm.hidden = 1;
            }
            else {
                // Otherwise show the popup
                $button.addClass('show');
            }
        });
    },


    /**
     * Shows when the user is over quota
     */
    overQuota: {

        /**
         * Show the popup
         */
        render: function() {

            // Cache lookups
            const handlerElem = alarm.handler();
            var $button = $('.js-dropdown-overquota', handlerElem);
            var $dialog = $('.top-warning-popup.over-quota', handlerElem);

            // Add button click handler
            this.initUpgradeButton($dialog);

            // Hide other dialogs that may be open and make the icon clickable
            alarm.hideAllWarningPopups();
            alarm.initWarningIconButton($button, $dialog);
            alarm.showWarningPopup($button, $dialog);
        },

        /**
         * Initialises the click handler for the Upgrade Account button
         * @param {Object} $dialog The dialog
         */
        initUpgradeButton: function($dialog) {

            // Redirect to Pro signup page on button click
            $dialog.find('.warning-button').click(function() {

                // Set a flag so it doesn't show each time
                alarm.hidden = 1;

                // Go to the Pro page
                loadSubPage('pro');
            });
        }
    },


    /**
     * Shows when a user has uploaded a file to an ephemeral session
     */
    ephemeralSession: {

        /**
         * Show the popup
         */
        render: function() {

            // Cache lookups
            const handlerElem = alarm.handler();
            var $button = $('.js-dropdown-ephemeral', handlerElem);
            var $dialog = $('.top-warning-popup.ephemeral-session', handlerElem);

            // Add button click handler
            this.initRegisterButton($button, $dialog);

            // Hide other dialogs that may be open and make the icon clickable
            alarm.hideAllWarningPopups();
            alarm.initWarningIconButton($button, $dialog);
            alarm.showWarningPopup($button, $dialog);
        },

        /**
         * Initialises the click handler for the Choose button
         * @param {Object} $dialog The dialog
         */
        initRegisterButton: function($button, $dialog) {

            // Redirect to register signup page on button click
            $dialog.find('.warning-button').click(function() {

                // If already registered, but email not confirmed, do nothing
                if (isNonActivatedAccount()) {
                    return false;
                }

                // Set a flag so it doesn't show each time
                alarm.hidden = 1;

                // Hide the dialog and go to register page
                $button.removeClass('show');
                loadSubPage('register');
            });
        }
    },


    /**
     * Shows after creating an ephemeral session, then trying to purchase a Pro plan,
     * then it asks you to register, then continue purchasing the Pro plan, then the
     * popup will show because they still haven't confirmed their email yet
     */
    nonActivatedAccount: {

        /**
         * Show the popup
         * @param {Boolean} recentPurchase Flag to immediately show the popup and log the event
         */
        render: function(recentPurchase) {

            // Cache lookups
            const handlerElem = alarm.handler();
            var $button = $('.js-dropdown-accountlink', handlerElem);
            var $dialog = $('.top-warning-popup.non-activated-account', handlerElem);

            // If the user has previously seen an ephemeral dialog and they closed it,
            // then they purchased a plan then this forces the dialog to popup. This means
            // this dialog always shows so it is an incentive to confirm their email.
            alarm.hidden = 0;

            // Hide other dialogs that may be open
            alarm.hideAllWarningPopups();
            alarm.initWarningIconButton($button, $dialog);
            alarm.showWarningPopup($button, $dialog);
        }
    },


    /**
     * A helpful PRO plan renewal popup which is shown when their PRO plan has expired
     */
    planExpired: {

        /** All the user's last payment information from the API */
        lastPayment: null,

        /**
         * Show the popup
         */
        render: function() {

            // Cache lookups
            const handlerElem = alarm.handler();
            var $button = $('.js-dropdown-astropay', handlerElem);
            var $dialog = $('.top-warning-popup.astropay-payment-reminder', handlerElem);

            // If their last payment info is not set by the API, then their plan is not currently expired.
            if (this.lastPayment === null) {
                this.hideRepayWarn($button, $dialog);
                return false;
            }

            // Don't show this dialog if they have already said they don't want to see it again
            if ((typeof this.lastPayment.dontShow !== 'undefined') && (this.lastPayment.dontShow === 1)) {
                this.hideRepayWarn($button, $dialog);
                return false;
            }

            // If they recently upgraded to Pro in this session, don't render the icon & dialog
            if (typeof u_attr !== 'undefined' && u_attr.p > 0) {
                this.hideRepayWarn($button, $dialog);
                return false;
            }

            // Ignored payment provider IDs (not applicable or no longer in use)
            var gatewayIgnoreList = [1, 2, 3, 7, 8, 13];
            var gatewayId = this.lastPayment.gw;

            // Don't display the popup for Apple or Google as they are recurring subscriptions. If the lastPayment is
            // set then it means they have purposefully cancelled their account and would not want to see any warnings.
            if (gatewayIgnoreList.indexOf(gatewayId) > -1) {
                return false;
            }

            // Get PRO plan name e.g. PRO III
            var proNum = this.lastPayment.p;
            var proPlanName = pro.getProPlanName(proNum);

            // Convert the timestamps to yyyy-mm-dd format
            var purchasedDate = this.formatTimestampToDate(this.lastPayment.ts);
            var expiryDate = this.formatTimestampToDate(this.lastPayment.exts);

            // Work out the number of months their previous plan was for e.g. 1 month or 3 months
            var planMonths = this.lastPayment.m;
            var planMonthsPluralisation = (planMonths > 1) ? l[6788] : l[913];

            // Get the display name, if it's an Astropay subgateway, then it will have it's own display name
            var gatewayInfo = pro.getPaymentGatewayName(gatewayId);
            var extraData = (typeof this.lastPayment.gwd !== 'undefined') ? this.lastPayment.gwd : null;
            var gatewayName = (extraData) ? extraData.gwname : gatewayInfo.name;
            var gatewayDisplayName = (extraData) ? extraData.label : gatewayInfo.displayName;

            const svgicons = {
                visa: 'icon-visa-border',
                mastercard: 'icon-mastercard',
                'unionpay': 'icon-union-pay',
                'american express': 'icon-amex',
                jcb: 'icon-jcb'
            };

            // Display
            $dialog.find('.header-pro-plan').text(proPlanName);
            $dialog.find('.purchased-date').text(purchasedDate);
            $dialog.find('.expired-date').text(expiryDate);
            $dialog.find('.pro-plan').text(proPlanName);
            $dialog.find('.plan-duration').text(planMonths + ' ' + planMonthsPluralisation);

            const iconkey = Object.keys(svgicons).find(gw => gatewayInfo.displayName.toLowerCase().includes(gw));

            if (iconkey) {
                $('.provider-icon', $gateway).addClass('svgicon')
                    .safeHTML(`<i class="sprite-fm-uni ${svgicons[iconkey]}"></i>`);
            }
            else {
                $('.provider-icon', $dialog).addClass(gatewayName);
            }
            $dialog.find('.gateway-name').text(gatewayDisplayName);
            $('.plan-icon', $dialog).removeClass('pro1 pro2 pro3 pro4 pro101').addClass('pro' + proNum);

            // Add button click handlers
            this.initChooseButton($button, $dialog);
            this.initRenewButton($button, $dialog, proNum);
            this.initDontShowAgainButton($dialog);
            this.initFeedbackMessageKeyup($dialog);
            this.initSendAndCloseButton($button, $dialog);

            // Hide other dialogs that may be open and make the icon clickable
            alarm.hideAllWarningPopups();
            alarm.initWarningIconButton($button, $dialog);
            alarm.showWarningPopup($button, $dialog);
        },

        /**
         * Hiding the repay top popup and the button in the banner
         * @param {Object} $button      Top menu icon button
         * @param {Object} $dialog      Top menu popup dialog
         */
        hideRepayWarn: function($button, $dialog) {
            'use strict';
            $button.addClass('hidden').removeClass('show');
        },

        /**
         * Initialises the click handler for the Choose button
         * @param {Object} $dialog The dialog
         */
        initChooseButton: function($button, $dialog) {

            // On the Choose button click
            $dialog.find('.warning-button.choose').rebind('click', function() {

                // Hide the dialog and go to pro page
                $button.removeClass('show');

                // Set a flag so it doesn't show each time
                alarm.hidden = 1;

                // Add a log
                api_req({ a: 'log', e: 99608, m: 'User chose a new plan from the plan expiry dialog' });

                // Go to the first step of the Pro page so they can choose a new plan
                loadSubPage('pro');
            });
        },

        /**
         * Initialises the click handler for the Renew button
         * @param {Object} $dialog The dialog
         * @param {Number} proNum The Pro plan number e.g. 1, 2, 3, 4
         */
        initRenewButton: function($button, $dialog, proNum) {

            // On the Renew button click
            $dialog.find('.warning-button.renew').rebind('click', function() {

                // Hide the dialog
                $button.removeClass('show');

                // Set a flag so it doesn't show each time
                alarm.hidden = 1;

                // Add a log
                api_req({ a: 'log', e: 99609, m: 'User chose to renew existing plan from the plan expiry dialog' });

                // Go to the second step of the Pro page which will pre-populate the details
                loadSubPage('propay_' + proNum);
            });
        },

        /**
         * Initialise the 'Do not show again' button. When clicked it will show a text area and
         * a button for the user to send some feedback about why they don't want to renew their plan.
         * @param {Object} $dialog The dialog
         */
        initDontShowAgainButton: function($dialog) {

            // Add click handler for the checkbox and its label
            $dialog.find('.plan-expired-checkbox, .plan-expired-checkbox-label').rebind('click', function() {

                var $checkbox = $dialog.find('.plan-expired-checkbox');

                // If checked
                if ($checkbox.hasClass('checkboxOn')) {

                    // Uncheck the box
                    $checkbox.removeClass('checkboxOn').addClass('checkboxOff');

                    // Hide the feedback text area and button, show the payment messages/buttons
                    $dialog.find('.first-message, .second-message').removeClass('hidden');
                    $dialog.find('.warning-button.choose, .warning-button.renew').removeClass('hidden');
                    $dialog.find('.confirm-reason, .warning-button.close').addClass('hidden');
                }
                else {
                    // Otherwise check the box
                    $checkbox.removeClass('checkboxOff').addClass('checkboxOn');

                    // Hide the payment messages/buttons, show the feedback text area and button
                    $dialog.find('.first-message, .second-message').addClass('hidden');
                    $dialog.find('.warning-button.choose, .warning-button.renew').addClass('hidden');
                    $dialog.find('.confirm-reason, .warning-button.close').removeClass('hidden');
                }
            });
        },

        /**
         * Enable or disable the Send and close button depending on if they've entered enough characters
         * @param {Object} $dialog The dialog
         */
        initFeedbackMessageKeyup: function($dialog) {

            // On entry into the text area
            $dialog.find('.confirm-reason-message').rebind('keyup', function() {

                // If the message is less than 10 characters, keep the button disabled
                if ($(this).val().length < 10) {
                    $dialog.find('.warning-button.close').addClass('disabled');
                }
                else {
                    // Otherwise enable it
                    $dialog.find('.warning-button.close').removeClass('disabled');
                }
            });
        },

        /**
         * Initialises the button to send the user's feedback
         * @param {Object} $button Button which allows to open dialog
         * @param {Object} $dialog The dialog
         */
        initSendAndCloseButton: function($button, $dialog) {

            // On the Send and close button
            $dialog.find('.warning-button.close').rebind('click', function() {

                // Set the feedback message for the response
                var feedback = $dialog.find('.confirm-reason-message').val();
                var email = u_attr.email;
                var jsonData = JSON.stringify({ feedback: feedback, email: email });

                // Do nothing if less than 10 characters
                if (feedback.length < 10) {
                    return false;
                }

                // Send the feedback
                api_req({
                    a: 'clog',
                    t: 'doNotWantToRenewPlanFeedback',
                    d: jsonData
                });

                // Set a flag so the icon and dialog never re-appears
                alarm.hidden = 2;

                // Never show the dialog again for this account
                mega.attr.set(
                    'hideProExpired',
                    '1',                    // Simple flag
                    false,                  // Set to private attribute
                    true                    // Set to non-historic, this won't retain previous values on the API server
                );

                // Hide the warning icon and the dialog
                $button.addClass('hidden').removeClass('show');
            });
        },

        /**
         * Converts a timestamp to a localised yyyy-mm-dd format e.g. 2016-04-17
         * @param {Number} timestamp The UNIX timestamp
         * @returns {String} Returns the date in yyyy-mm-dd format
         */
        formatTimestampToDate: function(timestamp) {

            var date = new Date(timestamp * 1000);
            var year = date.getFullYear();
            var month = (date.getMonth() + 1);
            var monthPadded = (month < 10) ? '0' + month : month;
            var day = (date.getDate() < 10) ? '0' + date.getDate() : date.getDate();

            return year + '-' + monthPadded + '-' + day;
        }
    },


    /**
     * A popup to let the user know there is a MEGA website update available.
     * This is useful if they have not refreshed or reloaded in 24 hours since a release.
     * To test this, load the site and set: localStorage.setItem('testSiteUpdate', '1');
     * then reload the page. The popup should appear after 5 seconds.
     */
    siteUpdate: {

        /** Checks for after 1 day (milliseconds) */
        checkInterval: 60 * 60 * 24 * 1000,

        /** The URL to check for updates, uses the static server to reduce load on the root servers */
        updateUrl: mega.updateURL,

        /** The timer ID */
        timeoutId: null,

        /** Cache of the server build information if they have already seen the popup */
        cachedServerBuildVersion: null,

        /**
         * Initialise the update check mechanism
         */
        init: function() {

            // If they previously fetched the server information then re-render the popup on subsequent page loads
            if (this.cachedServerBuildVersion !== null) {
                Soon(function() {
                    alarm.siteUpdate.render(alarm.siteUpdate.cachedServerBuildVersion, true);
                });
            }

            // Otherwise start timer only if using the legacy extension or website because web extensions have
            // their own auto-update mechanism. Also don't start a new timer if there is one already started.
            else if (is_chrome_web_ext === false && is_firefox_web_ext === false && this.timeoutId === null) {
                this.startUpdateCheckTimer();
            }
        },

        /**
         * Start a timer to check the live site to see if there is an update available
         */
        startUpdateCheckTimer: function() {

            // If localStorage testing variable exists
            if (localStorage.getItem('testSiteUpdate')) {

                // Check for update in 3 seconds using the test update file
                this.checkInterval = 3 * 1000;
                this.updateUrl = defaultStaticPath + 'current_ver_test.txt';
            }

            // Only run the update on mega.nz, or the testSiteUpdate flag is set
            if (window.location.hostname === 'mega.nz' ||
                    localStorage.getItem('testSiteUpdate')) {

                // Clear old timer
                window.clearTimeout(this.timeoutId);

                // Set timeout to check if there is an update available
                this.timeoutId = setTimeout(function() {

                    // Reset the timer id after completion
                    alarm.siteUpdate.timeoutId = null;

                    // Get the server version
                    alarm.siteUpdate.getServerBuildVersion();

                }, this.checkInterval);
            }
        },

        /**
         * Get what build version is currently available from the live site
         */
        getServerBuildVersion: function() {

            // Add timestamp to end to break cache
            var updateUrl = this.updateUrl + '?time=' + unixtime();

            // Fetch the latest current_ver.txt
            M.xhr(updateUrl).done(function(event, data) {

                // Try parse version info
                try {
                    var serverBuildVersion = JSON.parse(data);

                    // Display information if data was returned
                    if (serverBuildVersion) {
                        alarm.siteUpdate.render(serverBuildVersion);
                    }
                }
                catch (exception) {

                    // Failed to fetch, try again in another 24 hours
                    alarm.siteUpdate.startUpdateCheckTimer();
                }
            });
        },

        /**
         * Render the popup if applicable
         * @param {Object} serverBuildVersion The deployment information in current_ver.txt
         * @param {Boolean} reRender If this is a repeat rendering of the popup
         */
        render: function(serverBuildVersion, reRender) {

            // Cache lookups
            var $button = $('.js-dropdown-siteupdate');
            var $dialog = $('.top-warning-popup.site-update-available');

            // Convert versions to integers for easier comparison
            var localVersion = M.vtol(buildVersion.website);
            var serverVersion = M.vtol(serverBuildVersion.website);

            // Calculate the time when the update should be notified to the user (24 hours later)
            var currentTimestamp = unixtime();
            var updateTimestamp = serverBuildVersion.timestamp + (60 * 60 * 24);

            // If the server version is newer and the build has been released for at least 24 hours
            if ((localVersion < serverVersion) && (currentTimestamp > updateTimestamp)) {

                // If this is the first time the popup has appeared, send a log
                if (!reRender) {
                    api_req({ a: 'log', e: 99610, m: 'Site update dialog triggered after 24 hours' });
                }

                // Set the release version and date
                $dialog.find('.release-version').text(serverBuildVersion.website);
                $dialog.find('.release-date-time').text(time2date(serverBuildVersion.timestamp));

                // Cache server update details so the popup can be immediately re-rendered if they switch page
                this.cachedServerBuildVersion = serverBuildVersion;

                // Initialise popup buttons
                this.initDontUpdateButton($button, $dialog);
                this.initUpdateButton($button, $dialog);

                // Hide any other popups that may be open, make the icon clickable and show the popup
                alarm.hideAllWarningPopups();
                alarm.initWarningIconButton($button, $dialog);
                alarm.showWarningPopup($button, $dialog);
            }
            else {
                // Using current version, try again in another 24 hours
                alarm.siteUpdate.startUpdateCheckTimer();
            }
        },

        /**
         * If the Don't Update button is clicked, hide the dialog and don't show it again
         * @param {Object} $button Button which allows to open dialog
         * @param {Object} $dialog The dialog
         */
        initDontUpdateButton: function($button, $dialog) {

            $dialog.find('.warning-button.dont-update').rebind('click', function() {

                // Set a flag so the icon and dialog never re-appears
                alarm.hidden = 2;

                // Add a log
                api_req({ a: 'log', e: 99611, m: 'User chose not to update from site update dialog' });

                // Hide the warning icon and the dialog
                $button.addClass('hidden').removeClass('show');
            });
        },

        /**
         * If the Update button is clicked, hard refresh the page to break cache
         * @param {Object} $dialog The dialog
         */
        initUpdateButton: function($button, $dialog) {

            $dialog.find('.warning-button.update').rebind('click', function() {

                // Hide it so only the icon is visible and they can re-open the popup after their transfers are done
                alarm.hidden = 1;

                // Hide the warning dialog
                $button.removeClass('show');

                // Check for pending transfers and if there are, prompt user to see if they want to continue
                M.abortTransfers().then(function() {
                    loadingDialog.show();
                    Promise.resolve(eventlog(99612)).finally(() => location.reload(true));
                });
            });
        }
    }
};

/**
 * Initialises methods for a toast rack.
 *
 * @global
 * @module toastRack
 * @returns {function} a factory method for creating a new toast rack
 */
window.toastRack = (() => {
    'use strict';

    /**
     * Create the toast rack (container) and attach it to the DOM, unless there is an existing rack in the parent.
     *
     * @private
     * @param {HTMLElement} parentElement - The parent to attach the rack to
     * @param {string} addTo - Position the new notifications should appear in (top/bottom/start/end). RTL aware.
     * @returns {HTMLElement} the new toast rack element
     */
    function createRack(parentElement, addTo = 'bottom') {

        const existRack = parentElement.querySelector('.toast-rack');
        const validPos = new Set(['top', 'bottom', 'start', 'end']);

        if (existRack) {

            if (addTo && validPos.has(addTo) && existRack.addTo !== addTo) {

                existRack.classList.remove(existRack.addTo);
                existRack.classList.add(addTo);
                existRack.addTo = addTo;
            }

            return existRack;
        }

        const rack = document.createElement('section');
        rack.className = 'toast-rack';
        rack.cleanupTimer = `toast-rack:${makeUUID()}`;
        rack.expiry = Infinity;

        // set direction
        if (addTo && validPos.has(addTo)) {
            rack.classList.add(addTo);
            rack.addTo = addTo;
        }

        // attach the rack to the parent
        parentElement.appendChild(rack);

        return rack;
    }

    /**
     * Creates a toast slot element.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @param {object} options - options for creating the toast
     * @param {number} [options.timeout] - The approximate time to display the toast for.
     *                                     Will be rounded up to the next 0.5s.
     * @param {string} [options.icon] - the icon name (class) to use for the toast
     * @param {Array} [options.buttons] - buttons to add to the toast
     * @param {boolean} [options.hasClose] - whether to show a close button
     * @param {function} [options.onClose] - called when the toast is closed
     * @param {Array} [options.classes] - extra classes to add to the toast
     * @param {(string|HTMLElement)} [options.content] - the text/HTML content of the toast
     * @param {Array} [options.groups] - an array of groups to use for the toast, used for filtering
     * @param {Array} [options.zIndex = true] - if false, no z-index will be applied to the toast slot
     * @returns {{toastSlot: object, toast: object}} the toast and its slot within the rack
     */
    function createToastSlot(rack, {
        timeout,
        icons,
        buttons,
        hasClose = true,
        onClose,
        classes,
        content,
        groups,
        zIndex = true
    }) {

        const toastSlot = document.createElement('div');
        toastSlot.className = 'toast-slot';
        toastSlot.id = `toast_${[Math.random().toString(36).substr(2, 9)]}`;

        // set classes
        if (Array.isArray(classes) && classes.length > 0) {
            toastSlot.classList.add(...classes);
        }

        // Get the last toast and it's z-index so the new slot can be higher
        if (zIndex && rack.addTo === 'top') {
            toastSlot.style.zIndex = getNextZIndex(rack);
        }

        if (Array.isArray(groups)) {
            toastSlot.groups = new Set(groups);
        }
        else {
            toastSlot.groups = new Set();
        }

        // set hide after timeout
        timeout = timeout || 3000;
        if (timeout > 0) {
            toastSlot.expiry = Date.now() + timeout;

            if (toastSlot.expiry < rack.expiry || rack.expiry < Date.now()) {
                rack.expiry = toastSlot.expiry;
                resetCleanupTimer(rack);
            }
        }

        const toast = createToast(rack, toastSlot.id, {
            icons,
            buttons,
            hasClose,
            onClose,
            classes,
            content
        });

        toastSlot.appendChild(toast);
        rack.appendChild(toastSlot);

        // set a height so the transitions work properly
        const toastStyle = getComputedStyle(toast);
        const minToastHeight = parseInt(toastStyle.getPropertyValue('--min-toast-height')) || 0;
        const toastHeight = toast.offsetHeight > minToastHeight ? toast.offsetHeight : minToastHeight;
        toastSlot.style.setProperty('--toast-height', toastHeight + 'px');

        // get the transition durations, as transition events are unreliable
        toastSlot.transitionDuration = parseFloat(getComputedStyle(toastSlot).transitionDuration) * 1000;
        toast.transitionDuration = parseFloat(toastStyle.transitionDuration) * 1000;

        return {toastSlot, toast};
    }

    /**
     * Creates a toast element.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @param {string} toastSlotId - the ID attribute of the toast slot
     * @param {object} options - options for creating the toast
     * @param {Array} [options.icons] - the icon names (classes) to use for the toast's icons
     * @param {Array} [options.buttons] - buttons to add to the toast
     * @param {boolean} [options.hasClose] - whether to show a close button
     * @param {function} [options.onClose] - called when the toast is closed
     * @param {Array} [options.classes] - extra classes to add to the toast
     * @param {(string|HTMLElement)} [options.content] - the text/HTML content of the toast, overrides html option
     * @returns {HTMLElement} a toast element
     */
    function createToast(rack, toastSlotId, {
        icons,
        buttons,
        hasClose,
        onClose,
        content
    }) {
        const toast = document.createElement('div');
        toast.className = 'toast';

        // set icons
        if (Array.isArray(icons)) {
            icons.forEach(i => {
                if (typeof i === 'string') {
                    toast.appendChild(createIcon(i));
                }
            });
        }

        // set content
        if (typeof content === 'string') {
            const span = document.createElement('span');
            span.className = 'message';
            span.textContent = content;
            toast.appendChild(span);
        }
        else if (content instanceof HTMLElement) {
            toast.appendChild(content);
        }

        // set buttons
        if (Array.isArray(buttons) && buttons.length > 0) {
            toast.append(...createButtons(buttons));
        }

        // set close
        if (typeof hasClose === 'boolean' && hasClose) {
            toast.appendChild(createCloseButton(rack, toastSlotId, onClose));
        }

        // get the transition duration, as transition events are unreliable
        toast.transitionDuration = parseFloat(getComputedStyle(toast).transitionDuration) * 1000;

        return toast;
    }

    /**
     * Gets the next value to use for a z-index so that shadows do not overlap.
     *
     * Note: only really applicable for addTo = 'top' as shadows tend to be bigger on the bottom and horizonally
     * symmetrical.
     *
     * Note 2: Arbitrarily uses 100 as the maximum value, feel free to change it.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @returns {number} the value to use for a z-index.
     */
    function getNextZIndex(rack) {
        const slots = rack.querySelectorAll('.toast-slot');

        if (slots.length > 0) {
            const lastSlot = slots[slots.length - 1];
            const previousZ = parseInt(lastSlot.style.zIndex);

            return previousZ - 1;
        }

        return 100;
    }

    /**
     * Removes expired toasts from the rack.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @returns {undefined}
     */
    function removeColdToast(rack) {
        let soonestUnexpired = Infinity;

        rack.querySelectorAll('.toast-slot').forEach(elem => {
            if (typeof elem.expiry !== 'undefined') {
                if (elem.expiry < Date.now()) {
                    hide(rack, elem.id);
                }
                else if (elem.expiry < soonestUnexpired) {
                    soonestUnexpired = elem.expiry;
                }
            }
        });

        rack.expiry = soonestUnexpired;
        if (soonestUnexpired !== Infinity) {
            resetCleanupTimer(rack);
        }
    }

    /**
     * Enables the timer for clearing expired toasts from the rack.
     * Stops the timer when the mouse is over the rack.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @returns {undefined}
     */
    function enableCleanupTimer(rack) {
        resetCleanupTimer(rack);
        rack.addEventListener('mouseover', eventEndTimer);
        rack.addEventListener('mouseleave', eventStartTimer);
    }

    /**
     * Disables the timer for clearing expired toasts from the rack.
     * Stops the timer when the mouse is over the rack.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @returns {undefined}
     */
    function disableCleanupTimer(rack) {
        delay.cancel(rack.cleanupTimer);
        rack.removeEventListener('mouseover', eventEndTimer);
        rack.removeEventListener('mouseleave', eventStartTimer);
    }

    /**
     * Event handler to start the cleanup timer on a rack.
     *
     * @private
     * @param {EventTarget} e - the event object
     * @returns {undefined}
     */
    function eventStartTimer(e) {
        const rack = e.currentTarget;
        rack.timerPaused = false;
        resetCleanupTimer(rack);
    }

    /**
     * Event handler to clear the cleanup timer on a rack.
     *
     * @private
     * @param {EventTarget} e - the event object
     * @returns {undefined}
     */
    function eventEndTimer(e) {
        const rack = e.currentTarget;
        delay.cancel(rack.cleanupTimer);
        rack.timerPaused = true;
    }

    /**
     * Clears the old timer and creates a new one based on the rack's expiry.
     *
     * @param {HTMLElement} rack - the toast rack
     * @returns {undefined}
     */
    function resetCleanupTimer(rack) {
        if (!rack.timerPaused) {
            const now = Date.now();

            if (rack.expiry < now) {
                delay.cancel(rack.cleanupTimer);
                removeColdToast(rack);
            }
            else {
                delay(rack.cleanupTimer, () => removeColdToast(rack), rack.expiry - now);
            }
        }
    }

    /**
     * Create an icon element for the toast.
     *
     * @private
     * @param {string} icon - the (class) name of the icon
     * @returns {HTMLElement} the new icon element
     */
    function createIcon(icon) {
        const iconElement = document.createElement('i');
        iconElement.className = `toast-icon ${icon}`;
        return iconElement;
    }

    /**
     * Creates button elements based on provided parameters.
     *
     * @private
     * @param {Array} buttons - buttons to be created
     * @param {string} buttons.text - the text content of the button
     * @param {Array} buttons.classes - extra classes to add to the button
     * @param {function} buttons.onClick - the click event for the button
     * @returns {HTMLElement[]} an array of button elements
     */
    function createButtons(buttons) {
        return buttons.map(({
            text,
            classes,
            onClick
        }) => {
            const button = document.createElement('button');
            button.className = 'action';

            // set classes
            if (Array.isArray(classes)) {
                button.classList.add(...classes);
            }

            // set click event
            if (typeof onClick === 'function') {
                button.addEventListener('click', onClick);
            }

            // set content
            if (typeof text === 'string') {
                button.textContent = text;
            }

            return button;
        });
    }

    /**
     * Create a close button and attach a click handler.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @param {string} toastSlotId - the ID of the toast slot the button will close
     * @param {function} [onClose] - called on close
     * @returns {HTMLElement} the new close button element
     */
    function createCloseButton(rack, toastSlotId, onClose) {
        const closeElement = document.createElement('button');
        closeElement.className = 'close';

        const iconElem = document.createElement('i');
        iconElem.className = 'sprite-fm-mono icon-close-component';
        closeElement.appendChild(iconElem);

        // set close event
        closeElement.addEventListener('click', async () => {
            await hide(rack, toastSlotId);
            if (typeof onClose === 'function') {
                onClose();
            }
        });

        return closeElement;
    }

    /**
     * Creates new slot and shows a new toast.
     *
     * @private
     * @async
     * @param {HTMLElement} rack - the toast rack
     * @param {object} options - options for creating the toast
     * @returns {string} the ID of the new toast slot
     */
    async function show(rack, options) {

        if (rack.querySelectorAll('.toast-slot').length === 0) {
            enableCleanupTimer(rack);
        }

        const {toastSlot, toast} = createToastSlot(rack, options);

        await openItem(toastSlot);
        await showToast(toast);

        return toastSlot.id;
    }

    /**
     * Hides a toast and removes the slot from the DOM.
     *
     * @private
     * @async
     * @param {HTMLElement} rack - the toast rack
     * @param {string} toastSlotId - the ID of the toast slot to close
     * @returns {undefined}
     */
    async function hide(rack, toastSlotId) {
        const toastSlot = document.getElementById(toastSlotId);
        if (toastSlot) {
            const toast = toastSlot.querySelector('.toast');

            await hideToast(toast);
            await closeItem(toastSlot);
        }
        if (rack.querySelectorAll('.toast-slot').length === 0) {
            disableCleanupTimer(rack);
        }
    }

    /**
     * Hides and remove all toasts in the rack.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @returns {Promise} completes when all toasts have been hidden and removed
     */
    function hideAll(rack) {
        const promises = [];

        // Find all the toasts and hide them
        rack.querySelectorAll('.toast-slot').forEach(toastSlot => promises.push(hide(rack, toastSlot.id)));

        return Promise.allSettled(promises);
    }

    /**
     * Hide all the toasts/toast slots provided.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @param {Array} ids - toast slot IDs to hide
     * @returns {Promise} completes when all toasts have been hidden and removed
     */
    function hideMany(rack, ids) {
        const promises = [];

        for (const id of ids) {
            promises.push(hide(rack, id));
        }

        return Promise.allSettled(promises);
    }

    /**
     * Hides and removes all toasts in the rack, except the IDs in the array.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @param {Array} exceptions - the exceptions that should remain visible
     * @returns {Promise} completes when all toasts have been hidden and removed
     */
    function hideAllExcept(rack, exceptions) {
        const promises = [];

        // Find all the toasts and hide them, unless they are an exception
        rack.querySelectorAll('.toast-slot').forEach(toastSlot => {
            if (!exceptions.includes(toastSlot.id)) {
                promises.push(hide(rack, toastSlot.id));
            }
        });

        return Promise.allSettled(promises);
    }

    /**
     * Hides and removes all toasts in the rack, except those in any of the groups in the array.
     *
     * Note: Worst case is O(number of toasts * number of exceptionGroups)
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @param {Array} exceptionGroups - the exceptions that should remain visible
     * @returns {Promise} completes when all toasts have been hidden and removed
     */
    function hideAllExceptGroups(rack, exceptionGroups) {
        const promises = [];

        // Find all the toasts and hide them, unless they are an exception
        for (const toastSlot of rack.querySelectorAll('.toast-slot')) {
            let ignore = false;
            for (const exception of exceptionGroups) {
                if (toastSlot.groups.has(exception)) {
                    ignore = true;
                    break;
                }
            }
            if (!ignore) {
                promises.push(hide(rack, toastSlot.id));
            }
        }

        return Promise.allSettled(promises);
    }

    /**
     * Updates the severity of a toast.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @param {string} toastSlotId - the ID of the toast slot to update
     * @param {string} [newSeverity] - the new level of severity to set (low/medium/high/undefined)
     * @returns {undefined}
     */
    function setSeverity(rack, toastSlotId, newSeverity) {
        const toastSlot = rack.querySelector(`#${toastSlotId}`);

        if (typeof toastSlot !== 'undefined') {
            const toast = toastSlot.querySelector('.toast');

            toast.classList.remove('low', 'medium', 'high');

            if (['low', 'medium', 'high'].includes(newSeverity)) {
                toast.classList.add(newSeverity);
            }
        }
    }

    /**
     * Opens (animates) a slot in the rack.
     *
     * @private
     * @param {HTMLElement} toastSlot - the slot to open
     * @returns {Promise} completes when the slot has finished animating
     */
    function openItem(toastSlot) {
        return new Promise(resolve => {
            toastSlot.classList.add('open');
            setTimeout(resolve, toastSlot.transitionDuration);
        });
    }

    /**
     * Shows (animates) a toast.
     *
     * @private
     * @param {HTMLElement} toast - the toast to show
     * @returns {Promise} completes when the toast has finished animating
     */
    function showToast(toast) {
        return new Promise(resolve => {
            toast.classList.add('visible');
            setTimeout(resolve, toast.transitionDuration);
        });
    }

    /**
     * Closes (animates) a slot in the rack and removes it from the DOM.
     *
     * @private
     * @param {HTMLElement} toastSlot - the slot to close
     * @returns {Promise} completes when the slot has finished animating and is removed
     */
    function closeItem(toastSlot) {
        return new Promise(resolve => {
            toastSlot.classList.remove('open');

            setTimeout(() => {
                toastSlot.remove();
                resolve();
            }, toastSlot.transitionDuration);
        });
    }

    /**
     * Hides (animates) a toast.
     *
     * @private
     * @param {HTMLElement} toast - the toast to hide
     * @returns {Promise} completes when the toast has finished animating
     */
    function hideToast(toast) {
        return new Promise(resolve => {
            toast.classList.remove('visible');
            setTimeout(resolve, toast.transitionDuration);
        });
    }

    /**
     * Hides all toasts, cleans up and removes the rack from the DOM.
     *
     * @private
     * @async
     * @param {HTMLElement} rack - the toast rack
     * @returns {undefined}
     */
    async function destroy(rack) {
        await hideAll(rack);
        rack.remove();
    }

    /**
     * Adds filtering groups to a toast.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @param {string} toastSlotId - the ID of the toast slot to add groups to
     * @param {Array} groups - an array of groups to add
     * @returns {undefined}
     */
    function addGroups(rack, toastSlotId, groups) {
        const toast = rack.querySelector(`#${toastSlotId}`);

        if (typeof toast !== 'undefined') {
            for (const group of groups) {
                toast.groups.add(group);
            }
        }
    }

    /**
     * Removes filtering groups to a toast.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @param {string} toastSlotId - the ID of the toast slot to add groups to
     * @param {Array} groups - an array of groups to remove
     * @returns {undefined}
     */
    function removeGroups(rack, toastSlotId, groups) {
        const toast = rack.querySelector(`#${toastSlotId}`);

        if (typeof toast !== 'undefined') {
            for (const group of groups) {
                toast.groups.delete(group);
            }
        }
    }

    /**
     * Returns the IDs of toast slots based on an array of groups.
     *
     * You can use 'and' or 'or' as operators.
     *
     * @private
     * @param {HTMLElement} rack - the toast rack
     * @param {Array} groups - the groups to match
     * @param {string} [operator] - and/or, not needed if groups.length === 1
     * @returns {Array} an array of toast slot IDs that match the criteria
     */
    function getIdsByGroups(rack, groups, operator) {
        const results = [];

        function or(groups, toastSlot) {
            for (const group of groups) {
                if (toastSlot.groups.has(group)) {
                    results.push(toastSlot.id);
                    break;
                }
            }
        }

        function and(groups, toastSlot) {
            let ignore = false;

            for (const group of groups) {
                if (!toastSlot.groups.has(group)) {
                    ignore = true;
                }
            }

            if (!ignore) {
                results.push(toastSlot.id);
            }
        }

        if (groups.length > 0) {
            for (const toastSlot of rack.querySelectorAll('.toast-slot')) {
                if (groups.length > 1) {
                    if (operator === 'or') {
                        or(groups, toastSlot);
                    }
                    else if (operator === 'and') {
                        and(groups, toastSlot);
                    }
                }
                else if (toastSlot.groups.has(groups[0])) {
                    results.push(toastSlot.id);
                }
            }
        }

        return results;
    }

    function testRack(rack, parentElementClass, addTo) {

        // Seems like rack is not visible one. lets try get visible one instead from another fmholder
        if (rack.offsetParent === null) {

            const pElms = document.getElementsByClassName(parentElementClass);

            for (let i = pElms.length; i--;) {

                if (pElms[i].offsetParent) {

                    rack = createRack(pElms[i], addTo);
                    break;
                }
            }
        }

        return rack;
    }

    /**
     * Create and display a toast notification from a batch
     *
     * @param {object} data - Configuration data
     * @param {HTMLElement} rack - The rack to display the toast on
     * @returns {string} - The ID of the new toast slot
     */
    function dispatchBatch(data, rack) {
        const opts = Object.create(null);
        if (data.level !== 'neutral') {
            opts.classes = [data.level];
        }
        opts.content = data.joiner(data.content);
        opts.icons = data.icon;
        opts.hasClose = true;
        return show(rack, Object.assign(opts, data.overrideOptions));
    }

    /**
     * Create the toast rack (container), attach it to the DOM and return methods to control it.
     *
     * @private
     * @param {HTMLElement} parentElement - the parent to attach the rack to
     * @param {string} addTo - position the new notifications should appear in (top/bottom/start/end). RTL aware.
     * @returns {object} control methods for the new toast rack
     */
    return (parentElement, parentElementClass, addTo) => {
        // Create a new rack, or connect to an existing one
        let rack = createRack(parentElement, addTo);
        const batches = Object.create(null);

        return {
            /**
             * Show a custom toast.
             *
             * @public
             * @async
             * @param {object} options - options for creating the toast
             * @returns {string} the ID of the new toast slot
             * @see show
             */
            show: async options => {

                rack = testRack(rack, parentElementClass);

                return show(rack, options);
            },

            /**
             * Hide a toast.
             *
             * @public
             * @async
             *
             * @param {string} toastSlotId - the ID of the toast slot to close
             * @returns {undefined}
             * @see hide
             */
            hide: async toastSlotId => hide(rack, toastSlotId),

            /**
             * Hide and remove all toasts in the rack.
             *
             * @public
             * @async
             * @returns {Promise} completes when all toasts have been hidden and removed
             * @see hideAll
             */
            hideAll: async () => await hideAll(rack),

            /**
             * Hide all the toasts/toast slots provided.
             *
             * @public
             * @async
             * @param {Array} ids - toast slot IDs to hide
             * @returns {Promise} completes when all toasts have been hidden and removed
             * @see hideMany
             */
            hideMany: async ids => await hideMany(rack, ids),

            /**
             * Hide and remove all toasts in the rack, except the IDs in the array.
             *
             * @public
             * @async
             * @param {Array} exceptions - the exceptions that should remain visible
             * @returns {Promise} completes when all toasts have been hidden and removed
             * @see hideAllExcept
             */
            hideAllExcept: async exceptions => await hideAllExcept(rack, exceptions),

            /**
             * Hides all toasts, cleans up and removes the rack from the DOM.
             *
             * @public
             * @async
             * @returns {undefined}
             * @see destroy
             */
            destroy: async () => destroy(rack),

            /**
             * Show a neutral priority toast.
             *
             * @public
             * @async
             * @param {(string|HTMLElement)} content - text/HTML to show in the teast
             * @param {string} [icon] - icon name (class) to use for the toast
             * @param {object} [overrideOptions] - an options object to override the defaults @see show
             * @returns {string} the ID of the new toast slot
             */
            neutral: async(content, icon, overrideOptions) => {

                rack = testRack(rack, parentElementClass);

                return show(rack, Object.assign({
                    content,
                    icons: [icon],
                    hasClose: true
                }, overrideOptions));
            },

            /**
             * Show a high priority toast.
             *
             * @public
             * @async
             * @param {(string|HTMLElement)} content - text/HTML to show in the teast
             * @param {string} [icon] - icon name (class) to use for the toast
             * @param {object} [overrideOptions] - an options object to override the defaults @see show
             * @returns {string} the ID of the new toast slot
             */
            high: async(content, icon, overrideOptions) => {

                rack = testRack(rack, parentElementClass);

                return show(rack, Object.assign({
                    classes: ['high'],
                    content,
                    icons: [icon],
                    hasClose: true
                }, overrideOptions));
            },

            /**
             * Show a medium priority toast.
             *
             * @public
             * @async
             * @param {(string|HTMLElement)} content - text/HTML to show in the teast
             * @param {string} [icon] - icon name (class) to use for the toast
             * @param {object} [overrideOptions] - an options object to override the defaults @see show
             * @returns {string} the ID of the new toast slot
             */
            medium: async(content, icon, overrideOptions) => {

                rack = testRack(rack, parentElementClass);

                return show(rack, Object.assign({
                    classes: ['medium'],
                    content,
                    icons: [icon],
                    hasClose: true
                }, overrideOptions));
            },

            /**
             * Show a low priority toast.
             *
             * @public
             * @async
             * @param {(string|HTMLElement)} content - text/HTMLElement to show in the teast
             * @param {string} [icon] - icon name (class) to use for the toast
             * @param {object} [overrideOptions] - an options object to override the defaults @see show
             * @returns {string} the ID of the new toast slot
             */
            low: async(content, icon, overrideOptions) => {

                rack = testRack(rack, parentElementClass);

                return show(rack, Object.assign({
                    classes: ['low'],
                    content,
                    icons: [icon],
                    hasClose: true
                }, overrideOptions));
            },

            /**
             * Batch similar toasts into a single toast.
             *
             * Batches based on level as well
             * e.g: `batch('a', 'a', 'neutral');` is a different batch than `batch('a', 'a', 'high');`
             *
             * @param {string} batchId              - The base id for the batch
             * @param {string} content              - The text/HTML to add to the toast
             * @param {string} [level]              - The toast level. One of: [neutral (default), low, medium, high]
             * @param {function} [joiner]           - Optional function to join the batched values.
             *                                        Receives an array of strings then return a string combining them
             *                                        Default: ['a', 'b'] => 'a and b'; ['a', 'b', 'c'] => 'a, b and c';
             * @param {string} [icon]               - The icon name (class) to use for the toast
             * @param {object} [overrideOptions]    - An options object to override the defaults @see show
             * @param {function} [cb]               - Optional call back that is called when the toast is dispatched.
             *                                        A promise with the ID of the new toast slot is provided as
             *                                        the first argument
             * @returns {void} void
             */
            batch: (batchId, content, {level, joiner, icon, overrideOptions, cb} = {}) => {
                level = level || 'neutral';
                batchId = `${batchId}${level}`;
                if (typeof batches[batchId] === 'undefined') {
                    batches[batchId] = Object.create(null);
                    batches[batchId].content = [];
                    batches[batchId].joiner = (arr) => {
                        return mega.utils.trans.listToString(arr, '[X]');
                    };
                    batches[batchId].level = level;
                }
                batches[batchId].content.push(content);
                if (icon) {
                    batches[batchId].icon = [icon];
                }
                if (overrideOptions) {
                    batches[batchId].overrideOptions = overrideOptions;
                }
                if (typeof joiner === 'function') {
                    batches[batchId].joiner = joiner;
                }
                if (typeof cb === 'function') {
                    batches[batchId].cb = cb;
                }
                const now = Date.now();
                if (typeof batches[batchId].maxTime === 'undefined') {
                    batches[batchId].maxTime = now + 2000;
                }
                const dsp = () => {
                    rack = testRack(rack, parentElementClass);
                    const id = dispatchBatch(batches[batchId], rack);
                    if (typeof batches[batchId].cb === 'function') {
                        batches[batchId].cb(id);
                    }
                    delete batches[batchId];
                };
                if (typeof batches[batchId].listener === 'undefined') {
                    batches[batchId].listener = setTimeout(dsp, 1000);
                    batches[batchId].dispTime = now + 1000;
                }
                else if (batches[batchId].dispTime !== batches[batchId].maxTime) {
                    clearTimeout(batches[batchId].listener);
                    batches[batchId].listener = setTimeout(
                        dsp,
                        batches[batchId].maxTime - batches[batchId].dispTime
                    );
                    batches[batchId].dispTime = batches[batchId].maxTime;
                }
            },

            /**
             * Updates the severity of a toast.
             *
             * @public
             * @param {string} toastSlotId - the ID of the toast slot to update
             * @param {string} [newSeverity] - the new level of severity to set (low/medium/high/undefined)
             * @returns {undefined}
             * @see setSeverity
             */
            setSeverity: (toastSlotId, newSeverity) => setSeverity(rack, toastSlotId, newSeverity),

            /**
             * Adds filtering groups to a toast.
             *
             * @public
             * @param {string} toastSlotId - the ID of the toast slot to add groups to
             * @param {Array} groups - an array of groups to add
             * @returns {undefined}
             * @see addGroups
             */
            addGroups: (toastSlotId, groups) => addGroups(rack, toastSlotId, groups),

            /**
             * Removes filtering groups to a toast.
             *
             * @public
             * @param {string} toastSlotId - the ID of the toast slot to add groups to
             * @param {Array} groups - an array of groups to remove
             * @returns {undefined}
             * @see removeGroups
             */
            removeGroups: (toastSlotId, groups) => removeGroups(rack, toastSlotId, groups),

            /**
             * Hides and removes all toasts in the rack, except those in any of the groups in the array.
             *
             * @public
             * @async
             * @param {Array} exceptionGroups - the exceptions that should remain visible
             * @returns {Promise} completes when all toasts have been hidden and removed
             * @see hideAllExceptGroups
             */
            hideAllExceptGroups: async exceptionGroups => hideAllExceptGroups(rack, exceptionGroups),

            /**
             * Returns the IDs of toast slots based on an array of groups.
             *
             * @public
             * @param {Array} groups - the groups to match
             * @param {string} [operator] - and/or, not needed if groups.length === 1
             * @returns {Array} an array of toast slot IDs that match the criteria
             * @see getIdsByGroups
             */
            getIdsByGroups: (groups, operator) => getIdsByGroups(rack, groups, operator),
        };
    };
})();

/**
 * Legacy patch for existing toast calls. Not to be used for new toasts.
 *
 * @param {string} type - the type that defines the icons to be used on the toast
 * @param {string} content - the text/HTML (as text) content of the toast
 * @param {string} [firstButtonText] - the text content of the first button
 * @param {string} [secondButtonText] - the text content of the second button
 * @param {function} [firstButtonOnClick] - the click event for the first button
 * @param {function} [secondButtonOnClick] - the click event for the second button
 * @param {Number} [timeout] -  - The approximate time to display the toast for. Will be rounded up to the next 0.5s.
 * @returns {undefined}
 */
window.showToast = function(
    type,
    content,
    firstButtonText,
    secondButtonText,
    firstButtonOnClick,
    secondButtonOnClick,
    timeout
) {
    'use strict';

    const iconEquivalents = {
        settings: 'sprite-fm-mono icon-settings',
        megasync: 'sprite-fm-mono icon-sync',
        recoveryKey: 'sprite-fm-mono icon-key',
        warning: 'sprite-fm-mono icon-warning-triangle',
        clipboard: 'sprite-fm-mono icon-link',
        download: 'sprite-fm-mono icon-download-filled',
        password: 'sprite-fm-mono icon-lock-filled',
        'send-chat': 'sprite-fm-mono icon-chat-filled',
        'megasync-transfer': ['sprite-fm-uni icon-mega-logo', 'sprite-fm-mono icon-down green'],
        'megasync-transfer upload': ['sprite-fm-uni icon-mega-logo', 'sprite-fm-mono icon-up blue'],
        success: 'sprite-fm-uni icon-check',
        'clipboard-copy': 'sprite-fm-mono icon-copy',
        warning2: 'sprite-fm-uni icon-warning',
        'clipboard-embed-code': 'sprite-fm-mono icon-embed-code',
    };

    const icons = typeof iconEquivalents[type] === 'string' ? [iconEquivalents[type]] : iconEquivalents[type];

    // content
    const span = document.createElement('span');
    span.className = 'message';
    $(span).safeHTML(content);

    // buttons
    let buttons;
    if (firstButtonText) {
        buttons = [
            {
                text: firstButtonText,
                onClick: firstButtonOnClick
            }
        ];

        if (secondButtonText) {
            buttons.push({
                text: secondButtonText,
                onClick: secondButtonOnClick
            });
        }
    }

    window.toaster.main.show({
        content: span,
        icons,
        buttons,
        hasClose: true,
        timeout
    });
};

// Create all the toasters
lazy(window, 'toaster', () => {
    'use strict';

    const toaster = {};

    lazy(toaster, 'main', () => {
        const mainToaster = document.createElement('section');
        mainToaster.className = 'global-toast-container';
        document.body.appendChild(mainToaster);
        return window.toastRack(mainToaster, 'global-toast-container', 'top');
    });

    lazy(toaster, 'alerts', () => window.toastRack(
        document.querySelector('.alert-toast-container'),
        'alert-toast-container',
        'top'
    ));

    return toaster;
});

/**
 * Logic for the Account forms Inputs behaviour
*/
var accountinputs = {

    /**
     * Initialise inputs events
     * @param {Object} $formWrapper. DOM form wrapper.
     */
    init: function($formWrapper) {

        "use strict";

        if (!$formWrapper.length) {
            return false;
        }

        var $loginForm = $formWrapper.find('form');
        var $inputs = $('input',  $formWrapper);
        var $checkbox = $('.account.checkbox-block input, .pw-remind.checkbox-block input', $loginForm);
        var $button = $('button.mega-button', $formWrapper);
        var $tooltip  = $loginForm.find('.account.input-tooltip');

        var megaInputs = new mega.ui.MegaInputs($inputs);

        $checkbox.rebind('focus.commonevent', function() {
            $(this).parents('.checkbox-block').addClass('focused');
        });

        $checkbox.rebind('blur.commonevent', function() {
            $(this).parents('.checkbox-block').removeClass('focused');
        });

        $checkbox.rebind('keydown.commonevent', function (e) {
            if (e.keyCode === 32) {
                var $wrapper = $(this).parent().find('.checkbox');

                if ($wrapper.hasClass('checkboxOn')) {
                    $wrapper.addClass('checkboxOff').removeClass('checkboxOn');
                }
                else {
                    $wrapper.addClass('checkboxOn').removeClass('checkboxOff');
                }
            }
        });

        $button.rebind('click.commonevent', function() {
            $button.removeClass('focused');
        });

        $button.rebind('keydown.commonevent', function (e) {
            if (e.keyCode === 9) {
                if (e.shiftKey) {
                    $checkbox.last().focus();
                }
                else {
                    $inputs.first().focus();
                }
            }
            return false;
        });

        $button.rebind('focus.commonevent', function() {
            $button.addClass('focused');
        });

        $button.rebind('blur.commonevent', function() {
            $(this).removeClass('focused');
        });

        var isRegister = false;

        if ($loginForm[0].className.indexOf('register') > -1) {
            $button.addClass('disabled');
            isRegister = true;
        }

        $('.radio-txt, .checkbox', $formWrapper).rebind('click.commonevent', function(e) {

            var $wrapper = $(this).parent().find('.checkbox');

            $wrapper.parent().removeClass('focused');

            if ($wrapper.hasClass('checkboxOn')) {
                $wrapper.addClass('checkboxOff').removeClass('checkboxOn');
            }
            else {
                $wrapper .addClass('checkboxOn').removeClass('checkboxOff');
            }

            if (isRegister) {

                if ($('.checkboxOn', $formWrapper).length === $checkbox.length) {
                    $button.removeClass('disabled');
                }
                else {
                    $button.addClass('disabled');
                }
            }
        });

        onIdle(() => {
            $inputs.first().focus();
        });

        return $formWrapper;
    }
};

/**
 * Logic for the top navigation bar's signin tooltip
 */
var tooltiplogin = {

    /**
     * Initialise the tooltip
     * @param {Boolean} close Optional flag to hide the tooltip
     */
    init: function(close) {

        'use strict';

        var $dialog = $('.dropdown.top-login-popup');

        if (close) {
            $dialog.find('form').empty();
            $dialog.addClass('hidden');
            return false;
        }

        if (is_extension) {
            $('.extension-advise', $dialog).addClass('hidden');
        }
        else {
            $('.extension-advise', $dialog).removeClass('hidden');
        }

        $dialog.find('form').replaceWith(getTemplate('top-login'));

        if (localStorage.hideloginwarning) {
            $dialog.find('.top-login-warning').addClass('hidden');
        }

        $('#login-name, #login-password, .top-dialog-login-button', $dialog)
            .rebind('keydown.loginpopup', function(e) {
                if (e.keyCode === 13) {
                    tooltiplogin.startLogin.call(this);
                    return false;
                }
            });

        $('.top-dialog-login-button', $dialog).rebind('click.loginpopup', tooltiplogin.startLogin);

        $('.top-login-full', $dialog).rebind('click', function() {
            tooltiplogin.init(1);
            loadSubPage('login');
        });

        $('.top-login-warning-close', $dialog).rebind('click', function() {
            if ($('.loginwarning-checkbox', $dialog).hasClass('checkboxOn')) {
                localStorage.hideloginwarning = 1;
            }
            $('.top-login-warning', $dialog).addClass('hidden');
        });

        $('.top-login-forgot-pass', $dialog).rebind('click', function() {

            var email = document.getElementById('login-name').value;

            if (isValidEmail(email)) {
                $.prefillEmail = email;
            }

            loadSubPage('recovery');
        });

        $dialog.removeClass('hidden');

        if ($('body').hasClass('logged')) {
            topPopupAlign('.top-head .user-name', '.dropdown.top-login-popup', 60);
        }
        else {
            if ($('body').hasClass('business')) {
                topPopupAlign('.top-buttons.business .top-login-button', '.dropdown.top-login-popup', 60);
            }
            else {
                topPopupAlign('.top-login-button:visible', '.dropdown.top-login-popup', 60);
            }
        }

        // Init inputs events
        accountinputs.init($dialog);
    },

    /**
     * Start the login process
     */
    startLogin: function() {

        'use strict';

        var $topLoginPopup =  $(this.closest('.top-login-popup'));
        var $loginForm = $topLoginPopup.find('.account.top-login-form');
        var $emailField = $topLoginPopup.find('#login-name');
        var $passwordField = $topLoginPopup.find('#login-password');
        var $loginButton = $topLoginPopup.find('.top-dialog-login-button');
        var $loginWarningCheckbox = $topLoginPopup.find('.loginwarning-checkbox');
        var $loginRememberCheckbox = $topLoginPopup.find('.login-check');

        var email = $emailField.val().trim();
        var password = $passwordField.val();
        var rememberMe = false;
        var twoFactorPin = null;

        if (email === '' || !isValidEmail(email)) {
            $emailField.megaInputsShowError(l[141]);
            $emailField.focus();
        }
        else if (password === '') {
            $passwordField.megaInputsShowError(l[1791]);
            $passwordField.focus();
        }
        else if ($loginButton.hasClass('loading')) {
            if (d) {
                console.warn('Aborting login procedure, there is another ongoing..');
            }
        }
        else {
            $loginButton.addClass('loading');

            if ($loginWarningCheckbox.hasClass('checkboxOn')) {
                localStorage.hideloginwarning = 1;
            }

            if ($loginRememberCheckbox.hasClass('checkboxOn')) {
                rememberMe = true;
            }

            // Checks if they have an old or new registration type, after this the flow will continue to login
            security.login.checkLoginMethod(email, password, twoFactorPin, rememberMe,
                                            tooltiplogin.old.startLogin,
                                            tooltiplogin.new.startLogin);
        }

        return false;
    },

    /**
     * Functions for the old login process which will need to be retained until everyone's upgraded to the new process
     */
    old: {
        /**
         * Starts the login proceedure
         * @param {String} email The user's email address
         * @param {String} password The user's password as entered
         * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if N/A
         * @param {Boolean} rememberMe Whether the user clicked the Remember me checkbox or not
         */
        startLogin: function(email, password, pinCode, rememberMe) {
            'use strict';

            postLogin(email, password, pinCode, rememberMe)
                .then((res) => tooltiplogin.completeLogin(res))
                .catch(tell);
        }
    },

    /**
     * Functions for the new secure login process
     */
    new: {
        /**
         * Start the login proceedure
         * @param {String} email The user's email addresss
         * @param {String} password The user's password as entered
         * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if N/A
         * @param {Boolean} rememberMe A boolean for if they checked the Remember Me checkbox on the login screen
         * @param {String} salt The user's salt as a Base64 URL encoded string
         */
        startLogin: function(email, password, pinCode, rememberMe, salt) {

            'use strict';

            // Start the login using the new process
            security.login.startLogin(email, password, pinCode, rememberMe, salt, tooltiplogin.completeLogin);
        }
    },

    /**
     * Complete the login process and redirect to the cloud drive
     * @param {Number} result If the result is negative there is an error, if positive it is the user type
     */
    completeLogin: function(result) {

        'use strict';

        var $button = $('.top-dialog-login-button.loading', '.top-login-popup');
        var $topLoginPopup = $button.closest('.top-login-popup');
        var $emailField = $topLoginPopup.find('#login-name');
        var $passwordField = $topLoginPopup.find('#login-password');

        // Remove loading spinner on the button
        onIdle(() => $button.removeClass('loading'));

        // Check and handle the common login errors
        if (security.login.checkForCommonErrors(result, tooltiplogin.old.startLogin, tooltiplogin.new.startLogin)) {
            return false;
        }

        // If successful result
        if (result !== false && result >= 0) {
            u_type = result;

            if (login_next) {
                loadSubPage(login_next);
            }
            else if (M && M.currentdirid && M.currentdirid.substr(0, 5) === "chat/") {
                // is a chat link
                window.location.reload();
            }
            else if (page === 'download') {
                onIdle(function() {
                    topmenuUI();
                    tooltiplogin.init(1);

                    if (dlmanager.isOverQuota) {
                        dlmanager._onOverquotaDispatchRetry();
                    }
                });
            }
            else if (page !== 'login') {
                page = getSitePath().substr(1);
                init_page();
                tooltiplogin.init(1);
            }
            else {
                loadSubPage('fm');
            }
            login_next = false;
        }
        else {

            $emailField.megaInputsShowError();
            $passwordField.megaInputsShowError(l[7431]);
            $passwordField.focus().select();

            var $inputs = $emailField.add($passwordField);

            $inputs.rebind('keydown.hideBothError', function() {

                $emailField.megaInputsHideError();
                $passwordField.megaInputsHideError();

                $inputs.off('keydown.hideBothError');
            });
        }
    }
};

/** This class will function as a UI controller.
 */
mega.tpw = new function TransferProgressWidget() {
    'use strict';
    var downloadRowPrefix = 'tpw_dl_';
    var uploadRowPrefix = 'tpw_ul_';
    const textSelector = '.transfer-progress-txt';
    const tpwRowSelector = '.transfer-task-row';
    const transferPauseAllSelector = '.transfer-pause-icon';
    var frozenTimeout = 6e4; // 60 sec
    var completedTimeToStay = 3e5; // 5 min
    var FailedTimeToStay = 9e5; // 15 min
    var maximumLength = 200; // maximum rows to draw in normal mode

    var $widget;
    var $widgetWarnings;
    var $rowsHeader;
    var $widgetHeadAndBody;
    var $widgetTabActive;
    var $widgetTabsHeader;
    var $widgetTabCompleted;
    var $rowsContainer;
    var $bodyContainer;
    var $widgetFooter;
    var $rowTemplate;
    var $downloadRowTemplate;
    var $uploadRowTemplate;
    var $transferActionTemplate;
    var $overQuotaBanner;
    var $uploadChart;
    var $downloadChart;
    var rowProgressWidth = 0;

    this.INITIALIZING = 0;
    this.DOWNLOADING = 1;
    this.UPLOADING = 2;
    this.FINISHING = 3;
    this.DONE = 4;
    this.FAILED = 5;
    this.FROZEN = 6;
    this.PAUSED = 7;

    this.DOWNLOAD = 1;
    this.UPLOAD = 2;

    this.initialized = false;

    var mySelf = this;
    var isHiddenByUser = false;
    var isMinimizedByUser = false;

    var monitors = Object.create(null);

    /**
     * setting the status of the row
     * @param {Object} row          JQuery object contains the row
     * @param {Number} status       represents the status id
     * @param {Object} extraOption
     */
    var setStatus = function(row, status, extraOption) {
        'use strict';
        if (row && row.length && typeof status !== 'undefined') {
            var stText = '';
            switch (status) {
                case mySelf.DONE:
                    stText = l[1418];
                    break;
                case mySelf.FAILED:
                    stText = extraOption || l.tfw_generic_fail_msg;
                    break;
                case mySelf.FROZEN:
                    stText = 'Frozen';
                    break;
                case mySelf.PAUSED:
                    stText = l[1651];
                    break;
            }

            $('.transfer-task-status', row).text(escapeHTML(stText));
        }
        else {
            return;
        }
    };

    var initScrolling = function() {
        delay('tpw:initScrolling', () => {
            initPerfectScrollbar($bodyContainer);
        }, 250);
    };

    var removeRow = function($row) {

        if (!$row || !$row.length) {
            return;
        }

        var timer = $row.data('timer');
        if (timer) {
            clearTimeout(timer);
        }

        var dId = $row.attr('id');
        if (monitors[dId]) {
            clearTimeout(monitors[dId]);
            delete monitors[dId];
        }

        $row.remove();
        delay('tpw:remove', () => {
            initScrolling();
            mega.tpw.updateHeaderAndContent();
        }, 1500);
    };

    /**
     * Show a tab in Transfer progress widget
     * @param {Number} section  1 = completed, 0 = on progress
     * @returns {void} void
     */
    var viewTransferSection = function(section) {
        var $rows = $(tpwRowSelector, $rowsContainer);
        if (typeof section === 'undefined') {
            section = $widgetTabActive.hasClass('inactive') ? 1 : $widgetTabActive.hasClass('active') ? 0 : 1;
        }

        // for enhanced performance, instead of using ".find" or ".filter" 2 times
        // I will apply the calls on 1 go O(n).

        for (var r = 0; r < $rows.length; r++) {
            var $currRow = $($rows[r]);
            if ($currRow.hasClass('complete')) {
                if (section) {
                    $currRow.removeClass('hidden');
                }
                else {
                    $currRow.addClass('hidden');
                }
            }
            else if (section) {
                $currRow.addClass('hidden');
            }
            else {
                $currRow.removeClass('hidden');
            }
        }

        if ($widgetTabCompleted.hasClass('active')) {
            $('.ps__rail-y', $bodyContainer).addClass('y-rail-offset');
        }

        initScrolling();
    };

    var initEventsHandlers = function() {
        // minimize event handler
        $('.transfer-progress-icon.tpw-c-e', $rowsHeader).rebind('click.tpw', function tpw_collapseExpandHandler() {
            if ($widgetHeadAndBody.hasClass('expand')) {
                isMinimizedByUser = true;
                $bodyContainer.slideUp(400, () => {
                    $widgetHeadAndBody.removeClass('expand').addClass('collapse');
                    $widgetFooter.addClass('hidden');
                    $widgetTabsHeader.addClass('hidden');
                });
            }
            else {
                isMinimizedByUser = false;
                $widgetHeadAndBody.removeClass('collapse').addClass('expand');
                $bodyContainer.slideDown(400, () => {
                    if ($widgetTabActive.hasClass('active')) {
                        $widgetFooter.removeClass('hidden');
                    }
                    $widgetTabsHeader.removeClass('hidden');
                    initScrolling();
                });
            }
            return false;
        });

        // close event handler
        $('.transfer-progress-icon.tpw-close', $rowsHeader).off('click').on('click',
            function tpw_CloseHandler() {
                isHiddenByUser = true;
                mega.tpw.hideWidget();
            });


        // close over quota
        $('.close-over', $overQuotaBanner).off('click').on('click',
            function overquota_bannerClose() {
                $overQuotaBanner.addClass('hidden');
            });

        // upgrade account
        $('.up-action', $overQuotaBanner).off('click').on('click',
            function overquota_bannerUpgrade() {
                $('.transfer-progress-icon.tpw-close', $rowsHeader).click();
                isHiddenByUser = true;
                loadSubPage('pro');
            });

        // open dashboard
        $('.left-section.circle-dashboard', $overQuotaBanner).off('click').on('click',
            function overquota_bannerUpgrade() {
                loadSubPage('dashboard');
            });

        // open transfer page
        $('.js-tpm-open', $widgetHeadAndBody).rebind('click.tpw', () => {
            $('.nw-fm-left-icon.transfers.js-fm-tab', '#fmholder').trigger('click');
        });

        // open section
        const openTransferSection = function() {
            const $this = $(this);
            if ($this.hasClass('inactive') || $this.hasClass('active')) {
                return false;
            }
            $widgetTabCompleted.toggleClass('active');
            viewTransferSection($this.hasClass('js-tab-active') ? 0 : 1);
            $widgetTabActive.toggleClass('active');
            $widgetFooter.toggleClass('hidden');

            // This disables the propagation of the click to ancestors triggering the $.hideTopMenu
            return false;
        };
        $widgetTabActive.rebind('click.tpw', openTransferSection);
        $widgetTabCompleted.rebind('click.tpw', openTransferSection);

        bindTransfersMassEvents($widgetFooter);
    };


    var viewOverQuotaBanner = function(type) {
        if (!type || !u_type) {
            return;
        }

        if (!$overQuotaBanner.hasClass('hidden')) {
            return;
        }

        $overQuotaBanner.removeClass('almost-overquota').addClass('overquota');

        M.accountData(function(acc) {
            if (type === mega.tpw.DOWNLOAD) {

                $overQuotaBanner.find('.head-title').text(l[20666]);
                $overQuotaBanner.find('.content-txt').text(l[18085]);

                $overQuotaBanner.find('.quota-info-pct-txt').text('100%');
                $('.quota-info-pr-txt', $overQuotaBanner)
                    .text(l[5775].replace('%1', bytesToSize(acc.tfsq.used)));
                const $action = $('.action', $overQuotaBanner);
                $action.addClass('negative');

                $('.quota-info-pct-circle li.right-c p', $overQuotaBanner).rotate(-180, 0);
            }
            else {
                var perc = Math.floor(acc.space_used / acc.space * 100);
                if (perc < 100) {
                    $overQuotaBanner.addClass('almost-overquota').removeClass('overquota');
                    $('.content-txt', $overQuotaBanner).text(l.tfw_storage_almost_exceeded_text);
                }
                else {
                    $('.content-txt', $overQuotaBanner).text(l.tfw_storage_exceeded_text);
                }
                $('.head-title', $overQuotaBanner).safeHTML(
                    l.tfw_storage_exceeded_title
                        .replace('[S]', '<span class="pct-used">')
                        .replace('[/S]', '</span>')
                        .replace('%1', perc)
                );

                $('.quota-info-pct-txt', $overQuotaBanner).text(formatPercentage(perc / 100));

                var usedSpace = bytesToSize(acc.space_used);
                var totalSpace = bytesToSize(acc.space, 0);
                if ((usedSpace + totalSpace).length >= 12) {
                    $('.quota-info-pr-txt', $overQuotaBanner).addClass('small-font');
                }
                var spaceInfo = l[16301].replace('%1', usedSpace).replace('%2', totalSpace);
                $('.quota-info-pr-txt', $overQuotaBanner).safeHTML(spaceInfo);

                const $action = $('.action', $overQuotaBanner);
                $action.removeClass('negative');

                perc = perc >= 100 ? 100 : perc;
                var direction = -1;
                var rotateAngle = 360 * perc / 100 <= 180 ? 0 : 360 * perc / 100 - 180;
                $('.quota-info-pct-circle li.right-c p', $overQuotaBanner).rotate(rotateAngle * direction);
            }

            $overQuotaBanner.removeClass('hidden');

        });
    };

    /**
     * Clear the warnings shown on TPW header
     * @param {Number} type     flag to distinguish upload/download
     */
    this.resetErrorsAndQuotasUI = function(type) {
        if (!type) {
            return;
        }

        $overQuotaBanner.addClass('hidden');
        $(tpwRowSelector, $widget).removeClass('overquota error');
        this.updateHeaderAndContent();
    };

    /**
     * Hide action buttons if file node is removed
     * @return {void}
     */
    const hideCompleteActions = (e) => {
        let actionsNode;

        if (!(e.currentTarget.classList.contains('complete')
            && (actionsNode = e.currentTarget.querySelector('.transfer-complete-actions')))) {

            return;
        }

        const h = e.currentTarget.getAttribute('nhandle')
            || e.currentTarget.getAttribute('id').split('_').pop();

        if (h && M.d[h]) {
            actionsNode.classList.remove('hidden');
        }
        else {
            actionsNode.classList.add('hidden');
        }
    };

    var actionsOnRowEventHandler = function() {
        var $me = $(this);
        if ($me.hasClass('disabled') || !$me.is(':visible')) {
            return;
        }

        var $transferRow = $me.closest(tpwRowSelector);
        var trId = $transferRow.attr('id');
        var id = trId.split('_').pop();
        var node = null;

        if ($me.hasClass('cancel')) {
            if ($transferRow.hasClass('download')) {
                if (!$transferRow.attr('zippo')) {
                    id = 'dl_' + id;
                }
                else {
                    id = 'zip_' + id;
                }
                if (GlobalProgress[id]) {
                    dlmanager.abort(id);
                }
            }
            else {
                id = 'ul_' + id;
                if (GlobalProgress[id]) {
                    ulmanager.abort(id);
                }
            }
            $('.transfer-table tr#' + id).remove();
            if ($.clearTransferPanel) {
                $.clearTransferPanel();
            }
            if (M.tfsdomqueue[id]) {
                delete M.tfsdomqueue[id];
            }
            tfsheadupdate({c: id});

            $transferRow.fadeOut(400, function() {
                removeRow($transferRow);
            });
        }
        else if ($me.hasClass('link')) {
            var nodeHandle = $transferRow.attr('nhandle');
            node = M.d[nodeHandle || id];
            if (!node) {
                return;
            }
            $.selected = [nodeHandle || id];
            $('.dropdown.body.context .dropdown-item.getlink-item').click();
        }
        else if ($me.hasClass('cloud-folder')) {
            var nHandle = $transferRow.attr('nhandle');
            node = M.d[nHandle || id];
            if (!node) {
                return;
            }

            if (node.p) {
                $.autoSelectNode = node.h;
                M.openFolder(node.p).always((res) => {
                    if (res && res === EEXIST && selectionManager) {
                        selectionManager.clear_selection();
                        selectionManager.add_to_selection($.autoSelectNode, true);
                        delete $.autoSelectNode;
                    }
                });
            }
        }
        else if ($me.hasClass('pause') || $me.hasClass('restart')) {
            if ($transferRow.hasClass('download')) {
                if ($transferRow.attr('zippo')) {
                    id = 'zip_' + id;
                }
                else {
                    id = 'dl_' + id;
                }
            }
            else {
                id = 'ul_' + id;
            }
            if ($me.hasClass('pause')) {
                fm_tfspause(id);
            }
            else {
                $transferRow.removeAttr('prepared');
                fm_tfsresume(id);
            }

        }

        return false;
    };


    var clearAndReturnWidget = function() {
        var $currWidget = $('.transfer-progress.tpw');
        if (!$currWidget || !$currWidget.length) {
            return null;
        }
        if ($currWidget.length === 2) {
            if ($('#startholder').is(':visible')) {
                $($currWidget[1]).remove();
                return $($currWidget[0]);
            }
            else {
                $($currWidget[0]).remove();
                return $($currWidget[1]);
            }
        }
        else if ($('#fmholder').is(':visible') && $currWidget.parents('#fmholder').length === 0) {
            $currWidget.appendTo($('.corner-messages', '#fmholder'));
            return $currWidget;
        }
        return $currWidget;
    };

    /** Initialize the properties and class members */
    var init = function() {
        'use strict';
        // return;
        if (mega.tpw.initialized) {
            return;
        }
        $widget = clearAndReturnWidget();
        if (!$widget || !$widget.length) {
            return;
        }

        $widgetWarnings = $('.banner.transfer', $widget);
        $rowsHeader = $('.transfer-progress-head', $widget);
        $widgetHeadAndBody = $('.transfer-progress-widget', $widget);
        $widgetTabsHeader = $('.transfer-progress-tabs-head', $widgetHeadAndBody);
        $widgetTabActive = $('.js-tab-active', $widgetTabsHeader);
        $widgetTabCompleted = $('.js-tab-completed', $widgetTabsHeader);
        $bodyContainer = $('.widget-body-container', $widget);
        $rowsContainer = $('.transfer-progress-widget-body', $bodyContainer);
        $widgetFooter = $('.transfer-widget-footer', $widget);
        $overQuotaBanner = $('.banner.transfer', $widget);
        $rowTemplate = $($(tpwRowSelector, $rowsContainer)[0]).clone();
        $rowTemplate.rebind('mouseover.hideButtons', hideCompleteActions);
        rowProgressWidth = $($rowsContainer[0]).find('.transfer-progress-bar').width();
        $downloadRowTemplate = $rowTemplate.clone(true).removeClass('upload').addClass('download icon-down');
        $uploadRowTemplate = $rowTemplate.clone(true).removeClass('download').addClass('upload icon-up');
        $uploadChart = $('.transfer-progress-type.upload .progress-chart', $widgetHeadAndBody);
        $downloadChart = $('.transfer-progress-type.download .progress-chart', $widgetHeadAndBody);

        $transferActionTemplate = $($('button.btn-icon.transfer-progress-btn', $downloadRowTemplate)[0]).clone()
            .removeClass('pause cancel link cloud-folder restart');
        var $transferActionTemplateIcon = $('i.transfer-progress-icon', $transferActionTemplate);
        $transferActionTemplateIcon.removeClass('pause cancel link cloud-folder restart' +
            'icon-pause icon-close-component icon-link icon-search-cloud icon-play-small');
        $transferActionTemplateIcon.bind('click', actionsOnRowEventHandler);

        $rowsContainer.empty();

        // events handlers
        initEventsHandlers();

        mega.tpw.initialized = true;
    };


    mBroadcaster.once('startMega:desktop', function() {
        'use strict';
        init();
    });


    var viewPreparation = function() {
        'use strict';
        init();
        if (!initUI()) {
            return;
        }

        // pages to hide always
        if (page.indexOf('transfers') !== -1 || page.indexOf('register') !== -1 || page.indexOf('download') !== -1) {
            mega.tpw.hideWidget();
            return;
        }

        if (!isHiddenByUser) {

            if (page !== 'securechat' && page.indexOf('chat') === -1) {
                mega.tpw.showWidget();
            }

            if ($widgetHeadAndBody.hasClass('expand')) {
                if (page !== 'securechat' && page.indexOf('chat') !== -1) {
                    $('.transfer-progress-icon.tpw-c-e.collapse', $rowsHeader).click();
                    isMinimizedByUser = false;
                }
            }
            else if (page !== 'securechat' && page.indexOf('chat') === -1 && !isMinimizedByUser) {
                $('.transfer-progress-icon.tpw-c-e.expand', $rowsHeader).click();
            }
        }

        return 0xDEAD;
    };

    mBroadcaster.addListener('pagechange', () => {
        delay('tpwviewprep', viewPreparation, 500);
    });
    mBroadcaster.addListener('fm:initialized', viewPreparation);


    /**
     * update a row when no update has arrived on it for a while
     * @param {Number} id       row id
     * @param {Boolean} u       isUpload
     */
    var updateToFrozen = function(id, isUpload) {
        if (!id) {
            return;
        }
        if (Array.isArray(id)) {
            if (!id.length) {
                return;
            }
            id = id[0];
        }
        var $targetedRow = $rowsContainer.find('#' + ((!isUpload) ? downloadRowPrefix : uploadRowPrefix) + id);
        if (!$targetedRow || !$targetedRow.length) {
            return;
        }
        if (!$targetedRow.hasClass('progress')) {
            return;
        }
        $targetedRow.removeClass('complete error progress paused overquota').addClass('inqueue');
        setStatus($targetedRow, mySelf.FROZEN);
    };

    var getDownloadsRows = function() {
        return $(`[id^='${downloadRowPrefix}']`, $rowsContainer);
    };

    var getUploadsRows = function() {
        return $(`[id^='${uploadRowPrefix}']`, $rowsContainer);
    };

    /**
     * Draws the progress circle in the header of the widget reflecting the done elements
     * @param {Object} $headerSection       jQuery object containing the download/upload section in header
     * @param {Number} total                Total elements
     * @param {Number} done                 Done elements
     */
    var setProgressCircle = function($headerSection, total, done) {
        var perc = done / total;

        perc = isNaN(perc) ? 0 : Math.round(perc * 100);

        const fullDeg = 360;
        const deg = fullDeg * perc / 100;

        if (perc < 50) {
            $('.left-chart span', $headerSection).css('transform', `rotate(${180 + deg}deg)`);
            $('.right-chart', $headerSection).addClass('low-percent-clip');
            $('.left-chart', $headerSection).addClass('low-percent-clip');
        }
        else {
            $('.left-chart span', $headerSection).css('transform', `rotate(${deg - 180}deg)`);
            $('.right-chart', $headerSection).removeClass('low-percent-clip');
            $('.left-chart', $headerSection).removeClass('low-percent-clip');
        }
    };


    var cleanOverLimitRows = function() {
        var $allRows = $(tpwRowSelector, $rowsContainer);
        var rowsCount = $allRows.length;

        if (rowsCount <= maximumLength) {
            return;
        }
        else {
            mega.tpw.clearRows(mega.tpw.DONE);
        }
    };

    var initUI = function() {
        var $currWidget = clearAndReturnWidget();

        if (!$currWidget) {
            return false;
        }

        var $rows = $(tpwRowSelector, $currWidget);
        if ($rows.length) {
            if (!$rows.eq(0).attr('id')) {
                $currWidget.replaceWith($widget);

                initEventsHandlers();
                $('i.transfer-progress-icon', $widget).rebind('click.tpw', actionsOnRowEventHandler);
            }
            // init sections
            viewTransferSection();
        }
        return true;
    };


    var postProcessComplete = function() {
        var $allRows = $(tpwRowSelector, $rowsContainer);
        var $completedRows = $allRows.filter('.complete');
        if ($completedRows.length === $allRows.length) {
            $widgetTabCompleted.addClass('active');
            $widgetTabActive.addClass('inactive');
            $allRows.removeClass('hidden');
            $widgetFooter.addClass('hidden');
        }
        initScrolling();
    };

    var finalizeUpdates = function() {
        cleanOverLimitRows();
        mega.tpw.updateHeaderAndContent();
        if (!mega.tpw.isWidgetVisibile() && !page.includes('download') && !page.includes('transfers')) {
            mega.tpw.showWidget();
        }
        initScrolling();
    };

    /**
     * Adding a download/upload entry to transfer progress widget
     * @param {Number} type             Entry type: 1 download, 2 upload
     * @param {Object} entry            Download|Upload entry object built at transfer
     * @param {Number} specifiedSize    to tell the size of download entry
     */
    this.addDownloadUpload = function(type, entry, specifiedSize) {
        'use strict';
        if (!$rowsContainer || typeof type === 'undefined' || !entry) {
            return;
        }

        var entriesArray;
        if (Array.isArray(entry)) {
            entriesArray = entry;
        }
        else {
            entriesArray = [entry];
        }

        var $tempRows = new Array(entriesArray.length);
        var tempRowPos = 0;
        var reverted = false;

        if (type === this.UPLOAD) {
            tempRowPos = entriesArray.length - 1;
            reverted = true;
        }

        var addAsHidden = $widgetTabCompleted.hasClass('active');

        if (addAsHidden && $widgetTabActive.hasClass('inactive')) {
            $widgetTabActive.removeClass('inactive').addClass('active');
            $widgetTabCompleted.removeClass('active');
            if ($widgetHeadAndBody.hasClass('expand')) {
                $widgetFooter.removeClass('hidden');
            }
            $('.transfer-task-row', $rowsContainer).addClass('hidden');
            addAsHidden = false;
        }
        for (var r = 0; r < entriesArray.length; r++) {
            var fName;
            var dId = entriesArray[r].id;
            var prefix;
            var toolTipText;

            if (type === this.DOWNLOAD) {
                fName = entriesArray[r].n;
                prefix = downloadRowPrefix;
                toolTipText = l[1196];

                if (entriesArray[r].zipid) {
                    fName = entriesArray[r].zipname;
                    dId = entriesArray[r].zipid;
                }
            }
            else {
                fName = entriesArray[r].name;
                prefix = uploadRowPrefix;
                toolTipText = l[1617];
            }
            const id = prefix + dId;
            const $targetedRow = $(`#${id}`, $rowsContainer);
            var $row = null;

            if ($targetedRow.length === 1) {
                $row = $targetedRow;
            }
            else if ($targetedRow.length > 1) {
                // somehow we found multiple instances
                $targetedRow.remove();
            }
            if (!$row) {
                $row = (type === this.DOWNLOAD)
                    ? $downloadRowTemplate.clone(true) : $uploadRowTemplate.clone(true);

                $row.attr('id', id);
            }

            if (monitors[dId]) {
                clearTimeout(monitors[dId]);
            }
            monitors[dId] = setTimeout(updateToFrozen, frozenTimeout, dId);

            $row.find('.transfer-filetype-txt').text(fName);

            var $enqueueAction = $transferActionTemplate.clone(true).addClass('cancel');
            $('i.transfer-progress-icon', $enqueueAction).addClass('cancel icon-close-component')
                .attr('data-simpletip', toolTipText);
            $row.find('.transfer-task-actions').empty().append($enqueueAction);
            if ($('.transfer-complete-actions', $row).length) {
                $('.transfer-complete-actions', $row).remove();
            }
            $row.find('.transfer-progress-bar .transfer-progress-bar-pct').css('width', 0);

            $row.removeClass('complete error progress paused overquota').addClass('inqueue');
            $('.transfer-task-status', $row).text('');
            $('.item-type-icon', $row)
                .attr('class', `item-type-icon icon-${fileIcon({name: fName})}-24`);


            if (entriesArray[r].zipid) {
                $row.attr('zippo', 'y');
            }

            if (addAsHidden) {
                $row.addClass('hidden');
            }
            else {
                $row.removeClass('hidden');
            }

            setStatus($row, this.INITIALIZING);
            if (!reverted) {
                $tempRows[tempRowPos++] = $row;
            }
            else {
                $tempRows[tempRowPos--] = $row;
            }
        }

        // for a concurrent batch of adding, we will postpone final calculations to the end.
        delay('tpw:addTimer', finalizeUpdates, 1500);

        $rowsContainer.prepend($tempRows);
        $tempRows = null;
    };


    this.updateDownloadUpload = function(type, id, perc, bytesLoaded, bytesTotal, kbps, queue_num, startTime) {
        'use strict';
        if (!$rowsContainer || typeof type === 'undefined' || !id) {
            return;
        }

        var dId = id;

        var pauseText;
        var cancelText;

        var prefix;
        var queue;

        if (type === this.DOWNLOAD) {
            dId = id = id.split('_').pop();
            prefix = downloadRowPrefix;
            queue = dl_queue;
            pauseText = l.tfw_transfer_pause;
            cancelText = l.tfw_transfer_cancel;

            if (queue[queue_num].zipid) {
                dId = queue[queue_num].zipid;
            }
            kbps *= 1024;
        }
        else {
            prefix = uploadRowPrefix;
            queue = ul_queue;
            pauseText = l[16185];
            cancelText = l[1617];
        }

        var $targetedRow = $rowsContainer.find('#' + prefix + dId);

        if (!$targetedRow || !$targetedRow.length) {
            var tempObj = {
                n: queue[queue_num].n,
                name: queue[queue_num].name, // in upload will be null - OK
                id: id,
                zipname: queue[queue_num].zipname, // null if upload - OK
                zipid: queue[queue_num].zipid, // null if upload - OK
                size: queue[queue_num].size
            };

            this.addDownloadUpload(type, tempObj);
            return mySelf.updateDownloadUpload(type, id, perc, bytesLoaded, bytesTotal, kbps, queue_num);
        }

        if (monitors[dId]) {
            clearTimeout(monitors[dId]);
        }
        monitors[dId] = setTimeout(updateToFrozen, frozenTimeout, dId);

        var timeSpent = (new Date().getTime() - startTime) / 1000;
        var realSpeed = bytesLoaded / timeSpent; // byte per sec

        var speed = (kbps) ? Math.min(realSpeed, kbps) : realSpeed;

        $targetedRow.removeClass('complete error inqueue paused overquota').addClass('progress');

        if (!$targetedRow.attr('prepared')) {
            var $actionsRow = $targetedRow.find('.transfer-task-actions').empty();
            var $progressAction = $transferActionTemplate.clone(true).addClass('pause');
            $('i.transfer-progress-icon', $progressAction).addClass('pause icon-pause')
                .attr('data-simpletip', pauseText);
            $actionsRow.append($progressAction);
            $progressAction = $transferActionTemplate.clone(true).addClass('cancel');
            $('i.transfer-progress-icon', $progressAction).addClass('cancel icon-close-component')
                .attr('data-simpletip', cancelText);
            $actionsRow.append($progressAction);
            $targetedRow.attr('prepared', 'yes');
        }

        var prog = perc * rowProgressWidth / 100;
        $targetedRow.find('.transfer-progress-bar-pct').width(prog);
        $('.transfer-task-status', $targetedRow).text(bytesToSpeed(speed));

        this.updateHeaderAndContent();
    };

    this.finishDownloadUpload = function(type, entry, handle) {
        'use strict';
        if (!$rowsContainer || typeof type === 'undefined' || !entry) {
            return;
        }

        var dId = entry.id;
        var prefix;

        var unHide = $widgetTabCompleted.hasClass('active');

        if (type === this.DOWNLOAD) {
            if (entry.zipid) {
                dId = entry.zipid;
            }
            prefix = downloadRowPrefix;
        }
        else {
            prefix = uploadRowPrefix;
        }

        var $targetedRow = $rowsContainer.find('#' + prefix + dId);

        if (!$targetedRow || !$targetedRow.length) {
            return;
        }

        if (monitors[dId]) {
            clearTimeout(monitors[dId]);
            delete monitors[dId];
        }

        $targetedRow.removeClass('progress error inqueue paused overquota').addClass('complete');
        setStatus($targetedRow, this.DONE);

        if (handle) {
            $targetedRow.attr('nhandle', handle);
        }

        var $actionsRow = $targetedRow.find('.transfer-task-actions').empty();

        var $finishedAction = $transferActionTemplate.clone(true).addClass('link');
        if (!$targetedRow.attr('zippo')) {
            var $finishedActionsRow = $actionsRow.clone();
            $targetedRow.find('.transfer-complete-actions').remove();
            $finishedActionsRow.removeClass('transfer-task-actions').addClass('transfer-complete-actions');
            const root = M.getNodeRoot(handle || dId);
            if (root && root !== 'shares') {
                $('i.transfer-progress-icon', $finishedAction).removeClass('sprite-fm-mono')
                    .addClass('sprite-fm-mono link icon-link').attr('data-simpletip', l[5622]);
                $finishedActionsRow.append($finishedAction);
            }
            if (type === this.UPLOAD) {
                $finishedAction = $transferActionTemplate.clone(true).addClass('cloud-folder');
                $('i.transfer-progress-icon', $finishedAction).addClass('cloud-folder icon-search-cloud')
                    .attr('data-simpletip', l[20695]);
            }
            else {
                $finishedAction = $();
            }
            $finishedActionsRow.append($finishedAction);
            $finishedActionsRow.insertAfter($('.transfer-filetype-txt', $targetedRow));
        }
        $finishedAction = $transferActionTemplate.clone(true).addClass('cancel');
        $('i.transfer-progress-icon', $finishedAction).addClass('cancel icon-close-component')
            .attr('data-simpletip', l.tfw_transfer_remove);
        $actionsRow.append($finishedAction);

        if (unHide) {
            $targetedRow.removeClass('hidden');
        }
        else {
            $targetedRow.addClass('hidden');
        }

        // for a concurrent batch of finishes, we will postpone final calculations to the end.
        delay('tpw:finishTimer', () => {
            this.updateHeaderAndContent();
            postProcessComplete();
        }, 400);

        var timerHandle = setTimeout(function() {
            $targetedRow.fadeOut(400, function() {
                removeRow($targetedRow);
            });

        }, completedTimeToStay);

        $targetedRow.data('timer', timerHandle);
    };




    this.errorDownloadUpload = function(type, entry, errorStr, isOverQuota) {
        'use strict';
        if (!$rowsContainer || typeof type === 'undefined' || !entry) {
            return;
        }

        var prefix;
        var cancelText;
        var dId = entry.id;

        if (type === this.DOWNLOAD) {
            prefix = downloadRowPrefix;
            cancelText = l[1196];
            if (entry.zipid) {
                dId = entry.zipid;
            }
        }
        else {
            prefix = uploadRowPrefix;
            cancelText = l[1617];
        }
        var $targetedRow = $rowsContainer.find('#' + prefix + dId);

        if (!$targetedRow || !$targetedRow.length) {
            return;
        }
        if (monitors[dId]) {
            clearTimeout(monitors[dId]);
            delete monitors[dId];
        }
        $targetedRow.removeClass('complete progress inqueue paused');
        setStatus($targetedRow, this.FAILED, errorStr);

        var $errorCancelAction = $transferActionTemplate.clone(true).addClass('cancel');
        $('i.transfer-progress-icon', $errorCancelAction).addClass('cancel icon-close-component')
            .attr('data-simpletip', cancelText);
        $targetedRow.find('.transfer-task-actions').empty().append($errorCancelAction);

        $targetedRow.removeAttr('prepared');

        if (isOverQuota) {
            $targetedRow.addClass('overquota');
            viewOverQuotaBanner(type);
        }
        else {
            $targetedRow.addClass('error');
        }

        var timerH = setTimeout(function() {
            $targetedRow.fadeOut(400, function() {
                removeRow($targetedRow);
            });

        }, FailedTimeToStay);

        $targetedRow.data('timer', timerH);
        this.updateHeaderAndContent();
    };



    this.resumeDownloadUpload = function(type, entry) {
        'use strict';
        if (!$rowsContainer || typeof type === 'undefined' || !entry) {
            return;
        }

        var dId = entry.id;
        var prefix;
        var toolTipText;

        if (type === this.DOWNLOAD) {
            prefix = downloadRowPrefix;
            toolTipText = l[1196];
            if (entry.zipid) {
                dId = entry.zipid;
            }
        }
        else {
            prefix = uploadRowPrefix;
            toolTipText = l[1617];
        }
        const $targetedRow = $(`#${prefix}${dId}`, $rowsContainer);

        if (!$targetedRow.length) {
            return;
        }
        if (!$targetedRow.hasClass('paused')) {
            return;
        }
        if (monitors[dId]) {
            clearTimeout(monitors[dId]);
            delete monitors[dId];
        }
        monitors[dId] = setTimeout(updateToFrozen, frozenTimeout, dId);

        var $enqueueAction = $transferActionTemplate.clone(true).addClass('cancel');
        $('i.transfer-progress-icon', $enqueueAction).addClass('cancel icon-close-component')
            .attr('data-simpletip', toolTipText);
        $targetedRow.find('.transfer-task-actions').empty().append($enqueueAction);
        $targetedRow.removeClass('complete error progress paused overquota').addClass('inqueue');
        $('.transfer-task-status', $targetedRow).text('');
        setStatus($targetedRow, this.INITIALIZING);
        // for a concurrent batch of resumes, we will postpone final calculations to the end.
        delay('tpw:resumeTimer', finalizeUpdates, 1500);
    };


    this.pauseDownloadUpload = function(type, entry) {
        'use strict';
        if (!$rowsContainer || typeof type === 'undefined' || !entry) {
            return;
        }

        var dId = entry.id;
        var prefix;

        if (type === this.DOWNLOAD) {
            prefix = downloadRowPrefix;
            if (entry.zipid) {
                dId = entry.zipid;
            }
        }
        else {
            prefix = uploadRowPrefix;
        }

        const $targetedRow = $(`#${prefix}${dId}`, $rowsContainer);

        if (!$targetedRow.length) {
            return;
        }
        if (monitors[dId]) {
            clearTimeout(monitors[dId]);
            delete monitors[dId];
        }


        $targetedRow.removeClass('error complete progress inqueue overquota').addClass('paused');
        setStatus($targetedRow, this.PAUSED);

        const $actionsRow = $('.transfer-task-actions', $targetedRow).empty();
        var $pausedAction = $transferActionTemplate.clone(true).addClass('restart');
        $('i.transfer-progress-icon', $pausedAction).addClass('restart icon-play-small')
            .attr('data-simpletip', l.tfw_transfer_start);
        $actionsRow.append($pausedAction);
        $pausedAction = $transferActionTemplate.clone(true).addClass('cancel');
        $('i.transfer-progress-icon', $pausedAction).addClass('cancel icon-close-component')
            .attr('data-simpletip', l.tfw_transfer_cancel);
        $actionsRow.append($pausedAction);
        $targetedRow.removeAttr('prepared');
        delay('tpwpauseallcheck', () => {
            if (
                $('.paused, .complete, .error, .overquota', $rowsContainer).length
                === $(tpwRowSelector, $rowsContainer).length
            ) {
                const $pauseAllBtn = $(transferPauseAllSelector, $widgetFooter);
                $pauseAllBtn.addClass('active');
                $('span', $pauseAllBtn).text(l[7101]);
                const $transferPagePauseBtn = $('.transfer-pause-icon', '.fm-transfers-header');
                if ($transferPagePauseBtn.length) {
                    $('span', $transferPagePauseBtn.addClass('active')).text(l[7101]);
                    $('i', $transferPagePauseBtn).removeClass('icon-pause').addClass('icon-play-small');
                }
                $('i', $pauseAllBtn).removeClass('icon-pause').addClass('icon-play-small');
            }
        }, 100);
        delay('tpw:pauseTimer', finalizeUpdates, 1500);
    };

    this.showAlmostOverquota = function() {
        viewOverQuotaBanner(this.UPLOAD);
    };

    /**
     * Removes a rows from widget
     * @param {String} rowId        download/upload ID
     * @param {Boolean} isUpload    {optional} a flag to distinguish transfer Type if rowId doesn't contain dl_/ul_
     */
    this.removeRow = function(rowId, isUpload) {
        'use strict';

        if (!rowId) {
            return;
        }
        if (Array.isArray(rowId)) {
            for (var h = 0; h < rowId.length; h++) {
                mega.tpw.removeRow(rowId[h]);
            }
            return;
        }

        var dId = rowId;
        if (rowId[0] === 'd') {
            isUpload = false;
            dId = rowId.substr(3);

        }
        if (rowId[0] === 'z') {
            isUpload = false;
            dId = rowId.substr(4);
        }
        else if (rowId[0] === 'u') {
            isUpload = true;
            dId = rowId.substr(3);
        }

        var prefix = (isUpload) ? uploadRowPrefix : downloadRowPrefix;
        var $targetedRow = $rowsContainer.find('#' + prefix + dId);

        if (!$targetedRow || !$targetedRow.length) {
            return;
        }

        removeRow($targetedRow);
    };


    this.isWidgetVisibile = function() {
        return $widget.is(':visible');
    };

    this.showWidget = function() {
        init();
        initUI();
        if (!$rowsContainer || !$(tpwRowSelector, $rowsContainer).length) {
            return;
        }
        if (u_type !== false && M.getTransferElements() && !pfid) {
            $('.js-tpm-open', $widgetHeadAndBody).removeClass('hidden');
        }
        else {
            $('.js-tpm-open', $widgetHeadAndBody).addClass('hidden');
        }
        $widget.removeClass('hidden');
        $widget.show();
        initScrolling();
        isHiddenByUser = false;
    };

    this.hideWidget = function() {
        $widget.addClass('hidden');
    };

    this.clearRows = function(type) {
        if (d) {
            console.time('tpw:clearRows');
        }
        var $tasks;
        if (!type) { // all
            $tasks = $(tpwRowSelector, $rowsContainer);
        }
        else if (type === this.DONE) {
            $tasks = $rowsContainer.find('.transfer-task-row.complete');
        }

        if ($tasks && $tasks.length) {
            for (var r = 0; r < $tasks.length; r++) {
                removeRow($($tasks[r]));
            }
        }
        if (d) {
            console.timeEnd('tpw:clearRows');
        }
    };

    /**
     * Returns the most complete transfer stats for rendering headers
     *
     * @return {object} transfer stats including overquota + error counts
     */
    this.getHeadStats = function() {
        const data = Object.create(null);
        if (!tfsheadupdate || !tfsheadupdate.stats) {
            return false;
        }
        const { adl, aul, edl, eul, odl, oul, fdl, ful } = tfsheadupdate.stats;
        const transfersData = getTransfersPercent();
        data.dl = adl;
        data.ul = aul;
        data.dlDone = fdl;
        data.ulDone = ful;
        data.dlRemain = data.dl - data.dlDone;
        data.ulRemain = data.ul - data.ulDone;
        data.dlBytes = transfersData.dl_total;
        data.dlDoneBytes = transfersData.dl_done;
        if (!data.dlBytes && !data.dlDoneBytes) {
            data.dlBytes = 1;
            data.dlDoneBytes = 1;
        }
        data.ulBytes = transfersData.ul_total;
        data.ulDoneBytes = transfersData.ul_done;
        if (!data.ulBytes && !data.ulDoneBytes) {
            data.ulBytes = 1;
            data.ulDoneBytes = 1;
        }
        data.dlOq = odl;
        data.ulOq = oul;
        data.dlErr = edl;
        data.ulErr = eul;
        return data;
    };

    this.updateHeaderAndContent = function() {
        const tfStats = this.getHeadStats();
        if (!tfStats.dl && !tfStats.ul || !$(tpwRowSelector, $rowsContainer).length) {
            this.hideWidget();
            return;
        }

        const processStats = function(tRemain, tBytes, tDoneBytes, tOq, tErr, blocks) {
            if (tOq) {
                blocks.$block.addClass('overquota');
                blocks.$text.text(l.tfw_header_overquota);
            }
            else if (tErr) {
                blocks.$block.addClass('error');
                blocks.$text.text(l.tfw_header_error);
            }
            else if (tRemain) {
                blocks.$text.text(String(l[20808] || '').replace('{0}', tRemain > 999 ? '999+' : tRemain));
                blocks.$block.removeClass('error overquota');
            }
            else {
                blocks.$text.text(l.tfw_header_complete);
                blocks.$block.removeClass('error overquota');
            }
            if (tRemain) {
                $widgetTabActive.removeClass('inactive');
            }
            setProgressCircle(blocks.$chart, tBytes, tDoneBytes);
        };

        if (tfStats.dlDone || tfStats.ulDone) {
            $widgetTabCompleted.removeClass('inactive');
        }
        if (tfStats.dlDone === tfStats.dl && tfStats.ulDone === tfStats.ul) {
            $widgetTabActive.addClass('inactive');
            $widgetTabCompleted.trigger('click');
        }
        if (tfStats.ulDone === 0 && tfStats.dlDone === 0) {
            $widgetTabCompleted.addClass('inactive');
            if (!$widgetTabActive.hasClass('active')) {
                $widgetTabActive.trigger('click');
            }
        }

        const blocks = Object.create(null);
        blocks.$block = $('.transfer-progress-type.download', $rowsHeader);
        if (tfStats.dl) {
            blocks.$text = $(textSelector, blocks.$block);
            blocks.$chart = $downloadChart;
            processStats(tfStats.dlRemain, tfStats.dlBytes, tfStats.dlDoneBytes, tfStats.dlOq, tfStats.dlErr, blocks);
            blocks.$block.removeClass('hidden');
        }
        else {
            blocks.$block.addClass('hidden');
        }
        blocks.$block = $('.transfer-progress-type.upload', $rowsHeader);
        if (tfStats.ul) {
            blocks.$text = $(textSelector, blocks.$block);
            blocks.$chart = $uploadChart;
            processStats(tfStats.ulRemain, tfStats.ulBytes, tfStats.ulDoneBytes, tfStats.ulOq, tfStats.ulErr, blocks);
            blocks.$block.removeClass('hidden');
        }
        else {
            blocks.$block.addClass('hidden');
        }
    };
};
