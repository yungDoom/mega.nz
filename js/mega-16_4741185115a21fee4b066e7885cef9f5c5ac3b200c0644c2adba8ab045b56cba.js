/* Bundle Includes:
 *   js/fm/filemanager.js
 *   js/fm/utils.js
 *   js/fm/megadata.js
 *   js/fm/megadata/account.js
 *   js/fm/megadata/contacts.js
 *   js/fm/megadata/filters.js
 *   js/fm/megadata/menus.js
 */

function FileManager() {
    "use strict";

    this.logger = new MegaLogger('FileManager');
    this.columnsWidth = {
        cloud: Object.create(null),
        inshare: Object.create(null),
        outshare: Object.create(null)
    };

    this.columnsWidth.cloud.fav = { max: 50, min: 50, curr: 50, viewed: true };
    this.columnsWidth.cloud.fname = { max: 5000, min: 180, curr: '100%', viewed: true };
    this.columnsWidth.cloud.label = { max: 130, min: 80, curr: 80, viewed: false };
    this.columnsWidth.cloud.size = { max: 160, min: 100, curr: 100, viewed: true };
    this.columnsWidth.cloud.type = { max: 180, min: 130, curr: 130, viewed: true };
    this.columnsWidth.cloud.timeAd = { max: 180, min: 130, curr: 130, viewed: true };
    this.columnsWidth.cloud.timeMd = { max: 180, min: 130, curr: 130, viewed: false };
    this.columnsWidth.cloud.versions = { max: 180, min: 130, curr: 130, viewed: false };
    this.columnsWidth.cloud.playtime = { max: 180, min: 130, curr: 130, viewed: false };
    this.columnsWidth.cloud.extras = { max: 140, min: 93, curr: 93, viewed: true };
    this.columnsWidth.cloud.accessCtrl = { max: 180, min: 130, curr: 130, viewed: true };
    this.columnsWidth.cloud.fileLoc = { max: 180, min: 130, curr: 130, viewed: false };

    this.columnsWidth.makeNameColumnStatic = function() {

        const header = document.querySelector('.files-grid-view.fm .grid-table thead th[megatype="fname"]');
        if (!header) {
            console.assert(false);
            return;
        }

        // check if it's still dynamic
        if (header.style.width.startsWith('calc(') || header.style.width === '100%') {

            var currWidth = getComputedStyle(header).width;

            M.columnsWidth.cloud.fname.curr = currWidth.replace('px', '') | 0;
            header.style.width = currWidth;
        }
    };

    this.columnsWidth.updateColumnStyle = function() {

        for (var col in M.columnsWidth.cloud) {

            const header = document.querySelector(`.files-grid-view.fm th[megatype="${col}"]`);

            if (!header) {
                continue;
            }

            if (M.columnsWidth.cloud[col]) {

                if (typeof M.columnsWidth.cloud[col].curr !== 'number') {

                    if (col === 'fname') {

                        // This is large screen, lets show full table
                        if (document.body.offsetWidth > 1800) {
                            M.columnsWidth.cloud[col].curr = header.style.width = '100%';
                        }
                        else {
                            // hardcoded spacing values due to performance.
                            // Width of .nw-fm-left-icons-panel = 64px;
                            // Width of .grid-wrapper margin left and right = 52px;
                            // Width of spacing want to achieve = 560px on small screen or depends on active column;
                            // =================
                            // Sum of above = 676px on small screen or depends on active column

                            M.columnsWidth.cloud[col].curr = header.style.width =
                                `calc(100vw - ${$.leftPaneResizable.element.outerWidth() + 676}px)`;
                        }
                    }

                    const headerWidth = getComputedStyle(header).width.replace('px', '') | 0;

                    if (headerWidth < M.columnsWidth.cloud[col].min) {
                        header.style.width = `${M.columnsWidth.cloud[col].min}px`;
                    }
                    else if (headerWidth > M.columnsWidth.cloud[col].max) {
                        header.style.width = `${M.columnsWidth.cloud[col].max}px`;
                    }
                }

                if (M.columnsWidth.cloud[col].viewed) {
                    $('.grid-table.fm').addClass(`v-${col}`);
                }
                else {
                    $('.grid-table.fm').removeClass(`v-${col}`);
                }
            }
        }
    };
}
FileManager.prototype.constructor = FileManager;

FileManager.prototype.showExpiredBusiness = function() {
    'use strict';
    M.require('businessAcc_js', 'businessAccUI_js').done(() => {
        const isMaster = u_attr.b && u_attr.b.m || u_attr.pf;
        const business_ui = new BusinessAccountUI();
        business_ui.showExpiredDialog(isMaster);
    });
};

/** Check if this is a business expired account, or ODW paywall. */
FileManager.prototype.isInvalidUserStatus = function() {
    'use strict';
    let res = false;

    if (mega.paywall) {
        if ((u_attr.b && u_attr.b.s === -1) || (u_attr.pf && u_attr.pf.s === -1)) {
            if ($.hideContextMenu) {
                $.hideContextMenu();
            }
            M.showExpiredBusiness();
            res = true;
        }
        else if (u_attr.uspw) {
            if ($.hideContextMenu) {
                $.hideContextMenu();
            }
            M.showOverStorageQuota(EPAYWALL).catch(dump);
            res = true;
        }
    }
    if (res) {
        window.onerror = null;
    }
    return res;
};

/**
 * Initialize the rendering of the cloud/file-manager
 * @details Former renderfm()
 * @returns {MegaPromise}
 */
FileManager.prototype.initFileManager = async function() {
    "use strict";

    if (d) {
        console.time('renderfm');
    }

    this.initFileManagerUI();
    this.sortByName();
    this.renderTree();

    const $treesub = $(`#treesub_${M.RootID}`);
    if (!$treesub.hasClass('opened')) {
        $treesub.addClass('opened');
    }

    const path = $.autoSelectNode && M.getNodeByHandle($.autoSelectNode).p || M.currentdirid || getLandingPage();

    if (!pfid && !is_mobile && u_type) {
        const s4e = u_attr.s4;
        const pTag = 's4-setup';

        if (d) {
            console.assert(!window[pTag], 'S4 Setup already ongoing...');
        }

        if (s4e && !window[pTag]) {
            const hold = !!this.getNodeByHandle(path.slice(0, 8)).s4;
            window[pTag] = Date.now();

            const s4load =
                Promise.allSettled([this.getPersistentData(pTag), this.require('s4')])
                    .then(([{value}]) => {
                        this.setPersistentData(pTag, Date.now()).catch(dump);

                        const cnt = Object.keys(this.c[this.RootID] || {})
                            .map((h) => this.d[h]).filter((n) => n && n.s4);

                        const res = [cnt, value];
                        return cnt.length && value ? dbfetch.geta(cnt.map(n => n.h)).then(() => res) : res;
                    })
                    .then(([cnt, pending]) => {
                        const promises = [];

                        if (pending) {
                            if (d) {
                                pending = new Date(pending).toISOString();
                                console.warn('Previous S4 Container creation did not complete.', pending);
                            }

                            while (cnt.length) {
                                const n = cnt.pop();

                                if (Object.keys(this.c[n.h] || {}).length) {
                                    cnt.push(n);
                                    if (d) {
                                        console.error(`S4 Container ${n.h} is not empty.`, cnt);
                                    }
                                    break;
                                }

                                promises.push(
                                    api.setNodeAttributes(n, {name: `${pTag}.lost&found`})
                                        .then(() => this.moveToRubbish([n.h]))
                                );
                            }
                        }

                        if (!cnt.length) {
                            return Promise.allSettled(promises)
                                .then(() => s4.kernel.container.create(true));
                        }
                    })
                    .then(() => {
                        window[pTag] = null;
                        this.delPersistentData(pTag).dump(pTag);
                        $('.js-s4-tree-panel').removeClass('hidden');
                        return this.buildtree({h: 's4'}, this.buildtree.FORCE_REBUILD);
                    })
                    .catch((ex) => {
                        reportError(ex);
                        if (hold) {
                            throw ex;
                        }
                    });

            if (hold) {
                // We're (re)loading over a s4-page, hold it up.
                await s4load;
            }
        }

        if (mega.rewindEnabled) {

            Promise.resolve(M.require('rewind'))
                .then(() => {
                    if (d) {
                        console.info('REWIND Initialized.', [mega.rewind]);
                    }
                })
                .catch((ex) => {
                    reportError(ex);
                    delete mega.rewind;
                });
        }
    }

    if (path) {
        this.onFileManagerReady(fmLeftMenuUI);
    }

    const res = await this.openFolder(path, true);

    if (megaChatIsReady) {
        megaChat.renderMyStatus();
    }

    if (d) {
        console.timeEnd('renderfm');
    }

    return res;
};

/**
 * Invoke callback once the fm has been initialized
 * @param {Boolean} [ifMaster] Invoke callback if running under a master tab
 * @param {Function} callback The function to invoke
 */
FileManager.prototype.onFileManagerReady = function(ifMaster, callback) {
    'use strict';

    if (typeof ifMaster === 'function') {
        callback = ifMaster;
        ifMaster = false;
    }

    callback = (function(callback) {
        return function() {
            if (!ifMaster || mBroadcaster.crossTab.owner) {
                onIdle(callback);
            }
        };
    })(callback);

    if (fminitialized) {
        onIdle(callback);
    }
    else {
        mBroadcaster.once('fm:initialized', callback);
    }
};

/**
 * Initialize the cloud/file-manager UI components
 * @details Former initUI()
 */
FileManager.prototype.initFileManagerUI = function() {
    "use strict";

    if (d) {
        console.time('initUI');
    }
    $('.not-logged .fm-not-logged-button.create-account').rebind('click', function() {
        loadSubPage('register');
    });

    $('.fm-main').removeClass('l-pane-collapsed');
    $('button.l-pane-visibility').removeClass('active');

    $('.fm-dialog-overlay').rebind('click.fm', function(ev) {
        if ($.dialog === 'pro-login-dialog'
            || $.dialog === 'share'
            || $.dialog === 'share-add'
            || $.dialog === 'cookies-dialog'
            || $.dialog === 'affiliate-redeem-dialog'
            || $.dialog === 'discount-offer'
            || $.dialog === 'voucher-info-dlg'
            || $.dialog === "chat-incoming-call"
            || $.dialog === 'stripe-pay'
            || $.dialog === 'start-meeting-dialog'
            || $.dialog === 'meetings-call-consent'
            || $.dialog === 'fingerprint-dialog'
            || $.dialog === 'fingerprint-admin-dlg'
            || $.dialog === 'meetings-schedule-dialog'
            || $.dialog === 'upgrade-to-pro-dialog'
            || String($.dialog).startsWith('verify-email')
            || String($.dialog).startsWith('s4-managed')
            || localStorage.awaitingConfirmationAccount) {
            return false;
        }
        showLoseChangesWarning().done(function() {
            closeDialog(ev);
        });
        $.hideContextMenu();

        if (is_eplusplus && megaChatIsReady && megaChat.activeCall) {
            // In call permissions dialog may have been shown. Don't leave the call UI.
            return;
        }

        // For ephemeral session redirect to 'fm' page
        // if user clicks overlay instead Yes/No or close icon 'x'
        // One situation when this is used, is when ephemeral user
        //  trying to access settings directly via url
        if (u_type === 0 && !folderlink) {
            loadSubPage('fm');
        }
    });

    if (folderlink) {
        $('.nw-fm-left-icons-panel .logo').removeClass('hidden');
        $('.fm-main').addClass('active-folder-link');
        $('.activity-status-block').addClass('hidden');

        var $prodNav = $('.fm-products-nav').text('');
        if (!u_type) {
            $prodNav.safeHTML(translate(pages['pagesmenu']));
            onIdle(clickURLs);
        }

        $('button.l-pane-visibility').rebind('click.leftpane', function() {
            var $this = $(this);
            var $breadcrumbs = $('.fm-right-header .fm-breadcrumbs-block');

            if ($this.hasClass('active')) {
                if (M.currentdirid === M.RootID) {
                    $breadcrumbs.addClass('deactivated');
                }
                $this.removeClass('active');
                $('.fm-main').removeClass('l-pane-collapsed');
            }
            else {
                $this.addClass('active');
                $('.fm-main').addClass('l-pane-collapsed');

                M.onFileManagerReady(function() {
                    if (M.currentdirid === M.RootID) {
                        $breadcrumbs.removeClass('deactivated')
                            .find('.folder-link .right-arrow-bg')
                            .safeHTML('<span class="selectable-txt">@@</span>', M.getNameByHandle(M.RootID));
                    }
                });
            }
            $.tresizer();
        });

        $('button.l-pane-visibility').trigger('click');
    }
    else {
        $('.nw-fm-left-icons-panel .logo').addClass('hidden');
        $('.fm-main').removeClass('active-folder-link');
        $('.fm-products-nav').text('');
    }

    $.doDD = function(e, ui, a, type) {

        // Prevent drop behavior for the `FloatingVideo` component
        // See: ui/meetings/float.jsx
        if (ui.helper.hasClass('float-video') || !$(ui.draggable).hasClass('ui-draggable')) {
            return;
        }

        function nRevert(r) {
            try {
                $(ui.draggable).draggable("option", "revert", false);
                if (r) {
                    $(ui.draggable).remove();
                }
            }
            catch (e) {
            }
        }

        var c = $(ui.draggable).attr('class');
        var t, ids, dd;
        let id;

        if (c && c.indexOf('nw-fm-tree-item') > -1) {
            // tree dragged:
            id = $(ui.draggable).attr('id');
            if (id.indexOf('treea_') > -1) {
                ids = [id.replace('treea_', '')];
            }
        }
        else {
            if ($.dragSelected && $.dragSelected.length > 0) {
                ids = $.dragSelected;
            }
            else if ($.selected && $.selected.length > 0) {
                // grid dragged:
                ids = $.selected;
            }
        }

        // Checks selected/dragseleted items has folder on it
        const hasFolder = ids && ids.some((id) => M.getNodeByHandle(id).t);

        // Workaround a problem where we get over[1] -> over[2] -> out[1]
        if (a === 'out' && $.currentOver !== $(e.target).attr('id')) {
            a = 'noop';
        }

        if (type == 1) {
            // tree dropped:
            c = $(e.target).attr('class');
            if (c && c.indexOf('nw-fm-left-icon') > -1) {
                dd = 'nw-fm-left-icon';
                if (a === 'drop') {
                    if (c.indexOf('cloud') > -1) {
                        t = M.RootID;
                    }
                    else if (c.indexOf('rubbish-bin') > -1) {
                        t = M.RubbishID;
                    }
                    else if (c.indexOf('transfers') > -1) {
                        dd = 'download';
                    }
                }
            }
            else if (c && c.indexOf('js-lpbtn') > -1 && a === 'drop') {
                if (c.indexOf('cloud-drive') > -1) {
                    // Drag and drop to the cloud drive in the file manager left panel
                    t = M.RootID;
                }
                else if (c.includes('s4') && M.tree.s4) {
                    const cn = s4.utils.getContainersList();

                    // Drag and drop folder to the only container or skip
                    if (cn.length === 1 && M.isFolder(ids)) {
                        t = cn[0].h;
                    }
                    else {
                        dd = 'noop';
                    }
                }
                else if (c.indexOf('rubbish-bin') > -1) {
                    // Drag and drop to the rubbish bin in the file manager left panel
                    t = M.RubbishID;
                }
            }
            else if (c && c.indexOf('js-lpbtn') > -1 && c.indexOf('cloud-drive') > -1 && a === 'over') {
                // Drag and over the cloud drive in the file manager left panel
                t = M.RootID;
            }
            else if (c && c.indexOf('nw-fm-tree-item') > -1 && !$(e.target).visible(!0)) {
                dd = 'download';
            }
            else if (
                $(e.target).is('ul.conversations-pane > li') ||
                $(e.target).closest('ul.conversations-pane > li').length > 0 ||
                $(e.target).is('.messages-block')
            ) {
                if (M.isFile(ids)) {
                    dd = 'chat-attach';
                }
                else {
                    dd = 'noop';
                }
            }
            else {
                t = $(e.target).attr('id');
                if (t && t.indexOf('treea_') > -1) {
                    t = t.replace('treea_', '');
                }
                else if (t && t.indexOf('path_') > -1) {
                    t = t.replace('path_', '');
                }
                else if (M.currentdirid !== 'shares' || !M.d[t] || M.getNodeRoot(t) !== 'shares') {
                    t = undefined;
                }
            }
        }
        else {
            // grid dropped:
            c = $(e.target).attr('class');
            if (c && c.indexOf('folder') > -1) {
                t = $(e.target).attr('id');
            }
        }

        var setDDType = function() {
            if (ids && ids.length && t) {
                dd = ddtype(ids, t, e.altKey);
                if (dd === 'move' && e.altKey) {
                    dd = 'copy';
                }
            }
        };

        if (a !== 'noop') {
            if ($.liTimerK) {
                clearTimeout($.liTimerK);
            }
            $('body').removeClassWith('dndc-');
            $('.hide-settings-icon').removeClass('hide-settings-icon');
        }
        setDDType();

        if (a === 'drop' || a === 'out' || a === 'noop') {
            $(e.target).removeClass('dragover');
            // if (a !== 'noop') $('.dragger-block').addClass('drag');
        }
        else if (a === 'over') {
            id = $(e.target).attr('id');
            if (!id) {
                $(e.target).uniqueId();
                id = $(e.target).attr('id');
            }

            $.currentOver = id;
            setTimeout(function() {
                if ($.currentOver === id) {
                    var h;
                    if (id.indexOf('treea_') > -1) {
                        h = id.replace('treea_', '');
                    }
                    else {
                        c = $(id).attr('class');
                        if (c && c.indexOf('cloud-drive-item') > -1) {
                            h = M.RootID;
                        }
                        else if (c && c.indexOf('recycle-item') > -1) {
                            h = M.RubbishID;
                        }
                        else if (c && c.indexOf('contacts-item') > -1) {
                            h = 'contacts';
                        }
                    }
                    if (h) {
                        M.onTreeUIExpand(h, 1);
                    }
                    else if ($(e.target).hasClass('nw-conversations-item')) {
                        $(e.target).click();
                    }
                    else if ($(e.target).is('ul.conversations-pane > li')) {
                        $(e.target).click();
                    }
                }
            }, 890);

            if (dd === 'move') {
                $.draggingClass = ('dndc-move');
            }
            else if (dd === 'copy') {
                $.draggingClass = ('dndc-copy');
            }
            else if (dd === 'download') {
                $.draggingClass = ('dndc-download');
            }
            else if (dd === 'nw-fm-left-icon') {
                c = String($(e.target).attr('class'));

                $.draggingClass = ('dndc-warning');
                if (c.indexOf('rubbish-bin') > -1) {
                    $.draggingClass = ('dndc-to-rubbish');
                }
                else if (c.indexOf('conversations') > -1) {
                    if (hasFolder) {
                        c = null;
                    }
                    else {
                        $.draggingClass = 'dndc-to-conversations';
                    }
                }
                else if (c.indexOf('shared-with-me') > -1) {
                    $.draggingClass = ('dndc-to-shared');
                }
                else if (c.indexOf('transfers') > -1) {
                    $.draggingClass = ('dndc-download');
                }
                else if (c.indexOf('cloud-drive') > -1) {
                    $.draggingClass = ('dndc-move');
                }
                else {
                    c = null;
                }

                if (c) {
                    if ($.liTooltipTimer) {
                        clearTimeout($.liTooltipTimer);
                    }
                    $.liTimerK = setTimeout(function() {
                        $(e.target).click();
                    }, 920);
                }
            }
            else if (dd === 'chat-attach') {
                $.draggingClass = ('dndc-to-conversations');
            }
            else {
                const {type} = M.isCustomView(t) || {};
                $.draggingClass = M.d[t] || type === 's4' ? 'dndc-warning' : 'dndc-move';
            }

            $('body').addClass($.draggingClass);

            $(e.target).addClass('dragover');
            $($.selectddUIgrid + ' ' + $.selectddUIitem).removeClass('ui-selected');
            if ($(e.target).hasClass('folder')) {
                $(e.target).addClass('ui-selected').find('.file-settings-icon, .grid-url-arrow').addClass('hide-settings-icon');
            }
        }
        // if (d) console.log('!a:'+a, dd, $(e.target).attr('id'), (M.d[$(e.target).attr('id').split('_').pop()]||{}).name, $(e.target).attr('class'), $(ui.draggable.context).attr('class'));

        var onMouseDrop = function() {
            if (dd === 'nw-fm-left-icon') {
                // do nothing
            }
            else if ($(e.target).hasClass('nw-conversations-item') || dd === 'chat-attach') {
                nRevert();

                // drop over a chat window
                var currentRoom = megaChat.getCurrentRoom();
                assert(currentRoom, 'Current room missing - this drop action should be impossible.');
                currentRoom.attachNodes(ids).catch(dump);
            }
            else if (dd === 'move') {
                nRevert();
                $.moveids = ids;
                $.movet = t;
                var $ddelm = $(ui.draggable);
                setTimeout(function() {
                    if ($.movet === M.RubbishID) {
                        fmremove($.moveids);
                        if (selectionManager) {
                            selectionManager.clear_selection();
                        }
                    }
                    else {
                        loadingDialog.pshow();
                        M.moveNodes($.moveids, $.movet)
                            .then((moves) => {
                                if (moves
                                    && M.currentdirid !== 'out-shares'
                                    && M.currentdirid !== 'public-links'
                                    && M.currentdirid !== 'file-requests'
                                    && String(M.currentdirid).split("/")[0] !== "search") {
                                    $ddelm.remove();
                                }
                            })
                            .catch((ex) => {
                                if (ex !== EBLOCKED) {
                                    // user canceled file-conflict dialog.
                                    tell(ex);
                                }
                            })
                            .finally(() => loadingDialog.phide());

                        if (window.selectionManager) {
                            selectionManager.resetTo($.movet);
                        }
                    }
                }, 50);
            }
            else if ((dd === 'copy') || (dd === 'copydel')) {
                nRevert();
                $.copyids = ids;
                $.copyt = t;
                setTimeout(() => {
                    M.copyNodes($.copyids, $.copyt, dd === 'copydel')
                        .then(() => {

                            // Update files count...
                            if (M.currentdirid === 'shares' && !M.viewmode) {
                                M.openFolder('shares', 1);
                            }
                        })
                        .catch((ex) => {
                            if (ex === EOVERQUOTA) {
                                return msgDialog('warninga', l[135], l[8435]);
                            }
                            // Tell the user there was an error unless he cancelled the file-conflict dialog
                            if (ex !== EINCOMPLETE) {
                                tell(ex);
                            }
                        });
                }, 50);
            }
            else if (dd === 'download') {
                nRevert();
                var as_zip = e.altKey;
                M.addDownload(ids, as_zip);
            }
            $('.dragger-block').hide();
        };

        if (a === 'drop' && dd !== undefined) {
            dbfetch.get(t).always(function() {
                setDDType();
                if (dd) {
                    onMouseDrop();
                }
            });
        }
    };
    InitFileDrag();
    M.createFolderUI();
    // M.treeSearchUI();
    // M.treeFilterUI();
    // M.treeSortUI();
    M.initTreePanelSorting();
    M.initContextUI();
    initShareDialog();
    M.addTransferPanelUI();
    M.initUIKeyEvents();
    M.onFileManagerReady(topmenuUI);
    M.initMegaSwitchUI();

    // disabling right click, default contextmenu.
    var alwaysShowContextMenu = Boolean(localStorage.contextmenu);
    $(document).rebind('contextmenu.doc', function(ev) {
        var target = ev.target;
        var ALLOWED_IDS = {'embed-code-field': 1};
        var ALLOWED_NODES = {INPUT: 1, TEXTAREA: 1, VIDEO: 1};
        var ALLOWED_CLASSES = [
            'contact-details-user-name',
            'contact-details-email',
            'js-selectable-text',
            'nw-conversations-name'
        ];
        var ALLOWED_PARENTS =
            '#startholder, .fm-account-main, .export-link-item, .contact-fingerprint-txt, .fm-breadcrumbs, ' +
            '.fm-affiliate, .text-editor-container';
        var ALLOWED_CLOSEST =
            '.multiple-input, .create-folder-input-bl, .content-panel.conversations, ' +
            '.messages.content-area, .chat-right-pad .user-card-data';

        if (ALLOWED_NODES[target.nodeName] || ALLOWED_IDS[target.id] || alwaysShowContextMenu) {
            return;
        }

        for (var i = ALLOWED_CLASSES.length; i--;) {
            if (target.classList && target.classList.contains(ALLOWED_CLASSES[i])) {
                return;
            }
        }

        var $target = $(target);
        if (!is_fm() || $target.parents(ALLOWED_PARENTS).length || $target.closest(ALLOWED_CLOSEST).length) {
            return;
        }

        $.hideContextMenu();
        return false;
    });

    var $fmholder = $('#fmholder');
    $('.grid-table .grid-view-resize').rebind('mousedown.colresize', function(col) {
        var $me = $(this);
        var th = $me.closest('th');
        var startOffset = th.outerWidth() - col.pageX;

        $fmholder.rebind('mousemove.colresize', function(col) {
            var newWidth = startOffset + col.pageX;

            const min = th.attr('data-minwidth') | 0;

            if (newWidth < min) {
                newWidth = min;
            }

            var colType = th.attr('megatype');
            if (colType) {
                if (newWidth < M.columnsWidth.cloud[colType].min) {
                    return;
                }
                if (newWidth > M.columnsWidth.cloud[colType].max) {
                    return;
                }
                th.outerWidth(newWidth);
                M.columnsWidth.cloud[colType].curr = newWidth;

                if (M.megaRender && M.megaRender.megaList) {
                    if (M.megaRender.megaList._scrollIsInitialized) {
                        M.megaRender.megaList.scrollUpdate();
                    }
                    else {
                        M.megaRender.megaList.resized();
                    }
                }
            }
            else {
                th.outerWidth(newWidth);
            }

            $('#fmholder').css('cursor', 'col-resize');
        });

        $fmholder.rebind('mouseup.colresize', function() {
            M.columnsWidth.makeNameColumnStatic();
            $('#fmholder').css('cursor', '');
            $fmholder.off('mouseup.colresize');
            $fmholder.off('mousemove.colresize');
        });
    });

    $('.ps', $fmholder)
        .rebind('ps-scroll-left.fm-x-scroll ps-scroll-right.fm-x-scroll', function(e) {
            if (!e || !e.target) {
                console.warn('no scroll event info...!');
                console.warn(e);
                return;
            }
            var $target = $(e.target);
            if (!$target.hasClass('grid-scrolling-table megaListContainer')) {
                return;
            }
        });

    $('.fm-files-view-icon').rebind('click', function() {
        $.hideContextMenu();

        const viewIcon = $(this);
        var viewValue = viewIcon.hasClass('media-view') ? 2 : viewIcon.hasClass('listing-view') ? 0 : 1;

        if (fmconfig.uiviewmode | 0) {
            mega.config.set('viewmode', viewValue);
        }
        else {
            fmviewmode(M.currentdirid, viewValue);
        }
        $('.fm-files-view-icon').removeClass('active');

        if (folderlink && String(M.currentdirid).startsWith('search')) {
            M.viewmode = viewValue;
            M.renderMain();
        }
        else {
            M.openFolder(M.currentdirid, true).then(reselect.bind(null, 1));
        }

        if (viewValue === 2 && mega.ui.mNodeFilter) {
            mega.ui.mNodeFilter.resetFilterSelections();
        }

        return false;
    });

    $('.fm-folder-upload, .fm-file-upload').rebind('click', (element) => {
        $.hideContextMenu();
        if (element.currentTarget.classList.contains('fm-folder-upload')) {

            // Log that User clicks on Upload folder button
            eventlog(500009);

            $('#fileselect2').click();
        }
        else {
            // Log that User clicks on Upload file button
            eventlog(500011);

            $('#fileselect1').click();
        }
    });

    $.hideContextMenu = function(event) {

        var a, b, currentNodeClass;

        if (event && event.target) {

            a = event.target.parentNode;
            currentNodeClass = event.target.classList;
            if (a && !currentNodeClass.length) {
                currentNodeClass = a.classList;
            }
            if (currentNodeClass && currentNodeClass.contains('dropdown')
                && (currentNodeClass.contains('download-item')
                    || currentNodeClass.contains('move-item'))
                && currentNodeClass.contains('active')
                || currentNodeClass.contains('inshare-dl-button0')) {
                return false;
            }

            if (!(a && a.classList.contains('breadcrumb-dropdown-link'))) {
                $('.breadcrumb-dropdown').removeClass('active');
            }
        }
        $('.dropdown-search').addClass('hidden');
        $('.nw-sorting-menu').addClass('hidden');
        $('.colour-sorting-menu').addClass('hidden');
        $('.nw-tree-panel-arrows').removeClass('active');
        $('.nw-fm-tree-item').removeClass('dragover');
        $('.nw-fm-tree-item.hovered').removeClass('hovered');
        $('.data-block-view .file-settings-icon').removeClass('active');
        $('.column-settings.overlap').removeClass('c-opened');
        $('.js-statusbarbtn.options').removeClass('c-opened');

        const $jqe = $('.shared-details-info-block .fm-share-download');
        if ($jqe.hasClass('active')) {
            // close & cleanup
            $jqe.trigger('click');
        }
        $('.fm-share-download').removeClass('active disabled');

        const $threeDotsContextMenu = $('.shared-details-info-block .grid-url-arrow');
        if ($threeDotsContextMenu.hasClass('active')) {
            $threeDotsContextMenu.trigger('click');
        }
        $('.grid-url-arrow').removeClass('active');

        // Set to default
        a = $('.dropdown.body.files-menu,.dropdown.body.download');
        a.addClass('hidden');
        b = a.find('.dropdown.body.submenu');
        b.attr('style', '');
        b.removeClass('active left-position overlap-right overlap-left mega-height');
        a.find('.disabled,.context-scrolling-block').removeClass('disabled context-scrolling-block');
        a.find('.dropdown-item.contains-submenu.opened').removeClass('opened');

        // Cleanup for scrollable context menu
        var cnt = $('#cm_scroll').contents();
        $('#cm_scroll').replaceWith(cnt);// Remove .context-scrollable-block
        a.removeClass('mega-height');
        a.find('> .context-top-arrow').remove();
        a.find('> .context-bottom-arrow').remove();
        a.css({ 'height': 'auto' });// In case that window is enlarged

        // Remove all sub-menues from context-menu move-item
        $('#csb_' + M.RootID).empty();

        $(window).off('resize.ccmui');

        // enable scrolling
        if ($.disabledContianer) {
            Ps.enable($.disabledContianer[0]);
            delete $.disabledContianer;
        }

        mBroadcaster.sendMessage('contextmenuclose');
    };

    $fmholder.rebind('click.contextmenu', function(e) {
        $.hideContextMenu(e);
        if ($.hideTopMenu) {
            $.hideTopMenu(e);
        }
        if (M.chat) {
            // chat can handle its own links..no need to return false on every "click" and "element" :O
            // halt early, to save some CPU cycles if in chat.
            return;
        }
        var $target = $(e.target);
        var exclude = '.upgradelink, .campaign-logo, .resellerbuy, .linkified, '
            + 'a.red, a.mailto, a.top-social-button, .notif-help';

        if ($target.attr('type') !== 'file'
            && !$target.is(exclude)
            && !$target.parent().is(exclude)) {
            return false;
        }
    });

    if (page !== "chat") {
        $('.fm-right-header.fm').removeClass('hidden');
    }

    folderlink = folderlink || 0;

    if ((typeof dl_import !== 'undefined') && dl_import) {
        M.onFileManagerReady(importFile);
    }

    $('.dropdown.body.context').rebind('contextmenu.dropdown', function(e) {
        if (!localStorage.contextmenu) {
            e.preventDefault();
        }
    });

    $('.nw-fm-left-icon, .js-lpbtn').rebind('contextmenu', (ev) => {
        M.contextMenuUI(ev, 1);
        return false;
    });

    // stop sort and filter dialog clicking close itself
    $('.nw-sorting-menu').on('click', function(e) {
        e.stopPropagation();
    });

    var self = this;

    if (!this.fmTabState || this.fmTabState['cloud-drive'].root !== M.RootID) {
        this.fmTabState = freeze({
            'cloud-drive': { // My-files
                root: M.RootID,
                prev: null,
                subpages: [
                    M.InboxID, M.RubbishID,
                    'recents', 'shares', 'faves', 'out-shares', 'public-links', 'file-requests'
                ]
            },
            'gallery':         {root: 'photos',    prev: null, subpages: Object.keys(mega.gallery.sections)},
            'photos': {
                root: 'photos',
                prev: null,
                subpages: ['cloud-drive-photos', 'camera-uploads-photos']
            },
            'images': {
                root: 'images',
                prev: null,
                subpages: ['cloud-drive-images', 'camera-uploads-images']
            },
            'videos': {
                root: 'videos',
                prev: null,
                subpages: ['cloud-drive-videos', 'camera-uploads-videos']
            },
            'favourites':      {root: 'favourites',prev: null},
            'albums':          {root: 'photos',    prev: null},
            'folder-link':     {root: M.RootID,    prev: null},
            'conversations':   {
                root: 'chat',
                prev: null,
                subpages: ['chat/contacts', 'chat/contacts/received', 'chat/contacts/sent']
            },
            'transfers':       {root: 'transfers', prev: null},
            'account':         {root: 'account',   prev: null},
            'dashboard':       {root: 'dashboard', prev: null, subpages: ['refer']},
            'user-management': {root: 'user-management', prev: null},
            'shared-with-me':  {root: 'shares',    prev: null, subpages: ['out-shares']},
            'public-links':    {root: 'public-links',    prev: null},
            'recents':         {root: 'recents',   prev: null},
            'faves':           {root: 'faves',   prev: null},
            'backups':         {root: 'backups',   prev: null},
            'rubbish-bin':     {root: M.RubbishID, prev: null},
            'backup-center':   {root: 'devices', prev: null},
            'file-requests':   {root: 'file-requests',    prev: null}
        });

        this.fmTabPages = deepFreeze(
            Object.entries(this.fmTabState)
                .reduce((o, [k, v]) => {
                    o[k] = {[k]: -2, [v.root]: -1, ...array.to.object(v.subpages || [])};
                    return o;
                }, Object.create(null))
        );
    }

    var isMegaSyncTransfer = true;

    $('.js-fm-tab').rebind('click.fmTabState', function() {
        treesearch = false;
        var clickedClass = this.className;

        if (!clickedClass) {
            return;
        }

        if ((ul_queue && ul_queue.length) || (dl_queue && dl_queue.length)) {
            isMegaSyncTransfer = false;
        }
        if (clickedClass.indexOf('transfers') > -1) {
            if (isMegaSyncTransfer && window.useMegaSync === 2) {
                megasync.transferManager();
                return;
            }
            else {
                // reset - to ckeck again next time
                isMegaSyncTransfer = true;
                if (!mega.tpw.isWidgetVisibile()) {
                    mega.tpw.showWidget();
                    if (mega.tpw.isWidgetVisibile()) {
                        // do if there's no transfers, we will allow going to transfers page
                        return false;
                    }
                }
                else {
                    mega.tpw.hideWidget();
                }
            }
        }

        let activeClass = '.js-fm-tab';

        if (this.classList.contains('btn-myfiles')) {
            activeClass = '.btn-myfiles';
        }
        else if (this.classList.contains('btn-galleries')) {
            activeClass = '.btn-galleries';
        }

        activeClass = ('' + $(activeClass + '.active:visible')
            .attr('class')).split(" ").filter(function(c) {
            return !!self.fmTabState[c];
        })[0];

        var activeTab = self.fmTabState[activeClass];

        if (activeTab) {
            if (activeTab.root === M.currentrootid
                || activeTab.root === 'chat'
                || M.isAlbumsPage()
                || activeTab.subpages && activeTab.subpages.includes(M.currentrootid || M.currentdirid)
            ) {
                activeTab.prev = M.currentdirid;
                M.lastActiveTab = activeClass;
            }
            else if (d) {
                console.warn('Root mismatch', M.currentrootid, M.currentdirid, activeTab);
            }
        }

        if (this.classList.contains('devices')) {
            if (u_type === 0) {

                // Show message 'This page is for registered users only'
                ephemeralDialog(l[17146]);
            }
            else {

                loadSubPage('fm/devices');
            }
        }

        if (this.classList.contains('account') || this.classList.contains('dashboard')) {

            if (u_type === 0) {
                if (this.classList.contains('account')) {
                    ephemeralDialog(l[7687]);
                }
                else {
                    // Show message 'This page is for registered users only'
                    ephemeralDialog(l[17146]);
                }
            }
            else if (this.classList.contains('dashboard')) {
                if (M.currentdirid !== 'refer' && self.fmTabState.dashboard.prev === 'refer') {
                    loadSubPage('fm/refer');
                    return false;
                }
                self.fmTabState.dashboard.prev = null;
                loadSubPage('fm/dashboard');
            }
            else {
                loadSubPage('fm/account');
            }
            return false;
        }

        const isGalleryRedirect = this.dataset.locationPref
            && (M.isAlbumsPage() || M.isGalleryPage() || this.matches('.nw-fm-left-icon.gallery'));

        for (var tab in self.fmTabState) {
            if (~clickedClass.indexOf(tab)) {
                tab = self.fmTabState[tab];

                if (tab.root === 'transfers' && pfcol) {
                    break;
                }

                var targetFolder = null;

                if (tab.root === 'backups') {
                    targetFolder = M.BackupsId || M.RootID;
                }
                // Clicked on the currently active tab, should open the root (e.g. go back)
                else if (clickedClass.indexOf(activeClass) !== -1) {
                    targetFolder = (isGalleryRedirect) ? this.dataset.locationPref : tab.root;

                    // special case handling for the chat, re-render current conversation
                    if (
                        tab.root === 'chat' &&
                        String(M.currentdirid).substr(0, 5) === 'chat/' &&
                        !M.currentdirid.startsWith('chat/contacts')
                    ) {
                        targetFolder = M.currentdirid;
                    }
                }
                else if (tab.prev && (M.d[tab.prev] || M.isCustomView(tab.prev) ||
                    (tab.subpages && tab.subpages.indexOf(tab.prev) > -1))) {
                    targetFolder = tab.prev;
                }
                else if (isGalleryRedirect) {
                    targetFolder = this.dataset.locationPref;
                }
                else {
                    targetFolder = tab.root;
                }

                M.openFolder(targetFolder, true);

                if (tab.root === 'chat') {
                    delay('chat-event-gen-nav', () => eventlog(500294));
                }
                break;
            }
        }
    });

    if (dlMethod.warn) {
        window.onerror = null;
        console.error('This browser is using an outdated download method, good luck...', '' + window.ua);
    }

    // chat can handle the left-panel resizing on its own
    const lPane = $('.fm-left-panel').filter(":not(.chat-lp-body)");
    $.leftPaneResizable = new FMResizablePane(lPane, {
        'direction': 'e',
        'minWidth': mega.flags.ab_ads ? 260 : 200,
        'maxWidth': 400,
        'persistanceKey': 'leftPaneWidth',
        'handle': '.left-pane-drag-handle'
    });

    $(window).rebind('resize.fmrh hashchange.fmrh', SoonFc(65, fm_resize_handler));

    if (ua.details.os === "Apple") {

        $(window).rebind('blur.ps-unfocus', () => {

            $('.ps').rebind('ps-scroll-y.ps-unfocus', e => {

                $(e.target).addClass('ps-outfocused-scrolling');

                delay('ps-out-focused-' + $(e.target).data('ps-id'), function __psOutFocused() {
                    $(e.target).removeClass('ps-outfocused-scrolling');
                }, 1000);
            });
        });

        if (!document.hasFocus()) {
            $(window).trigger('blur.ps-unfocus');
        }

        $(window).rebind('focus.ps-unfocus', function() {

            $('.ps').off('ps-scroll-y.ps-unfocus');
        });
    }

    if (d) {
        console.timeEnd('initUI');
    }
};

/**
 * A FileManager related method for (re)initializing the shortcuts and selection managers.
 *
 * @param container
 * @param aUpdate
 * @param {Boolean} [refresh] are we re-attaching the container?
 */
FileManager.prototype.initShortcutsAndSelection = function(container, aUpdate, refresh) {
    'use strict';

    if (!window.fmShortcuts) {
        window.fmShortcuts = new FMShortcuts();
    }

    if (!aUpdate) {
        if (window.selectionManager) {
            window.selectionManager.destroy();
        }

        if (M.previousdirid !== M.currentdirid && !refresh) {
            // do not retain selected nodes unless re-rendering the same view
            $.selected = [];
        }
        // or re-rendering the same view but previous view is media discovery view
        else if (!M.gallery && !$('#gallery-view').hasClass('hidden')) {
            for (let i = $.selected.length - 1; i >= 0; i--) {
                if (!M.v.includes(M.d[$.selected[i]])) {
                    $.selected.splice(i, 1);
                }
            }
        }

        /**
         * (Re)Init the selectionManager, because the .selectable() is reinitialized and we need to
         * reattach to its events.
         *
         * @type {SelectionManager}
         */
        window.selectionManager = new SelectionManager2_DOM(
            $(container),
            {
                'onSelectedUpdated': (selected_list) => {
                    $.selected = selected_list;
                }
            }
        ).reinitialize();
    }
};


/**
 * Update FileManager on new nodes availability
 * @details Former rendernew()
 * @returns {MegaPromise}
 */
// eslint-disable-next-line complexity
FileManager.prototype.updFileManagerUI = async function() {
    "use strict";

    var treebuild = Object.create(null);
    var UImain = false;
    var UItree = false;
    var newcontact = false;
    var newpath = false;
    var newshare = false;
    var selnode;
    var buildtree = function(n) {
        delay('updFileManagerUI:buildtree:' + n.h, function() {
            M.buildtree(n, M.buildtree.FORCE_REBUILD);
            M.addTreeUIDelayed();
        }, 2600);
    };

    if (d) {
        console.warn('updFileManagerUI for %d nodes.', newnodes.length);
        console.time('rendernew');
    }

    const view = Object.create(null);
    view[this.currentdirid] = 1;
    view[this.currentCustomView.nodeID] = 1;

    if (this.currentdirid === 'file-requests') {
        Object.assign(view, mega.fileRequest.getPuHandleList());
    }

    for (var i = newnodes.length; i--;) {
        var newNode = newnodes[i];

        if (newNode.h.length === 11) {
            newcontact = true;
        }
        if (newNode.su) {
            newshare = true;
        }
        if (newNode.p && newNode.t) {
            treebuild[newNode.p] = 1;
        }

        if (view[newNode.p] || view[newNode.h]
            || newNode.su && this.currentdirid === 'shares'
            || newNode.shares && this.currentdirid === 'out-shares') {

            UImain = true;

            if ($.onRenderNewSelectNode === newNode.h) {
                delete $.onRenderNewSelectNode;
                selnode = newNode.h;
            }
        }

        if (!newpath && document.getElementById(`path_${newNode.h}`)) {
            newpath = true;
        }
    }

    for (var h in treebuild) {
        var tb = this.d[h];
        if (tb) {
            // If this is out-shares or public-links page, build both cloud-drive tree and it's own
            if (this.currentCustomView) {
                if (tb.h === M.RubbishID) {
                    tb = {h: M.RootID};
                }
                this.buildtree(tb, this.buildtree.FORCE_REBUILD, 'cloud-drive');
                this.buildtree({h: this.currentCustomView.type}, this.buildtree.FORCE_REBUILD);
            }
            else {
                buildtree(tb);
            }
            UItree = true;
        }
    }

    if (d) {
        console.log('rendernew, dir=%s, root=%s, mode=%d', this.currentdirid, this.currentrootid, this.viewmode);
        console.log('rendernew.stat', newcontact, newshare, UImain, newpath);
        console.log('rendernew.tree', Object.keys(treebuild));
    }
    let renderPromise = null;

    if (UImain) {
        if (UItree || this.v.length) {
            var emptyBeforeUpd = !M.v.length;
            this.filterByParent(this.currentCustomView.nodeID || this.currentdirid);
            this.sort();
            this.renderMain(!emptyBeforeUpd);
        }
        else {
            renderPromise = this.openFolder(this.currentdirid, true);
        }

        UImain = this.currentdirid;
    }

    if (this.currentdirid === "recents" && this.recentsRender) {
        this.recentsRender.updateState();
    }

    if (UItree) {
        if (this.currentrootid === 'shares') {
            this.renderTree();
        }
        else if (this.currentCustomView) {
            this.addTreeUIDelayed(90);
        }

        if (this.currentdirid === 'shares' && !this.viewmode) {

            renderPromise = Promise.resolve(renderPromise)
                .then(() => this.openFolder('shares', true));
        }
    }

    newnodes = [];
    if (renderPromise) {
        await renderPromise;
    }

    if (UItree && this.nodeRemovalUIRefresh.pending !== this.currentdirid) {
        this.onTreeUIOpen(this.currentdirid);
    }

    if (newcontact) {
        useravatar.refresh().catch(dump);

        if (megaChatIsReady) {
            megaChat.renderMyStatus();
        }
    }
    if (newshare) {
        M.buildtree({h: 'shares'}, M.buildtree.FORCE_REBUILD);
    }
    if (newpath) {
        delay('render:path_breadcrumbs', () => M.renderPathBreadcrumbs());
    }

    if (UImain === M.currentdirid) {
        if (selnode) {
            onIdle(() => {
                $.selected = [selnode];
                reselect(1);
            });
        }

        if (window.selectionManager) {
            // update the total count of nodes
            var tmp = selectionManager.vSelectionBar;
            if (tmp) {
                var mm = String(tmp.textContent).split('/').map(Number);
                tmp.textContent = mm[0] + ' / ' + M.v.length;
            }
        }

    }

    if (u_type === 0) {
        // Show "ephemeral session warning"
        topmenuUI();
    }

    delay('dashboard:upd', () => {
        if (M.currentdirid === 'dashboard') {
            dashboardUI(true);
        }
        else if (UImain === M.currentdirid) {
            delay('rendernew:mediainfo:collect', () => {
                mBroadcaster.sendMessage('mediainfo:collect');
                $.tresizer();
            }, 3200);
        }
    }, 2000);

    mBroadcaster.sendMessage('updFileManagerUI');

    if (d) {
        console.timeEnd('rendernew');
    }
};

/**
 * Initialize context-menu related user interface
 */
FileManager.prototype.initContextUI = function() {
    "use strict";

    var c = '.dropdown.body.context .dropdown-item';

    $('.dropdown-section').off('mouseover', '.dropdown-item');
    $('.dropdown-section').on('mouseover', '.dropdown-item', function() {
        var $this = $(this),
            pos = $this.offset(),
            menuPos,
            currentId;

        if ($this.hasClass('disabled') && $this.parents('#sm_move').length === 0) {
            return false;
        }

        // Hide opened submenus
        if (!$this.parent().parent().hasClass('submenu')) {
            $('.dropdown-item').removeClass('opened');
            $('.dropdown.body.submenu').removeClass('active');
        }
        else {
            $this.parent().find('.dropdown-item').removeClass('opened');
            $this.parent().find('.submenu').removeClass('active');
        }

        currentId = $this.attr('id');
        if (currentId || $this.hasClass('move-item')) {
            M.buildSubMenu(String(currentId).replace('fi_', ''));
        }

        // Show necessary submenu
        if (!$this.hasClass('opened') && $this.hasClass('contains-submenu')) {
            menuPos = M.reCalcMenuPosition($this, pos.left, pos.top, 'submenu');

            $this.next('.submenu')
                .css({'top': menuPos.top})
                .removeClass('hidden')
                .addClass('active');

            $this.addClass('opened');
        }

        // If MEGA Lite mode and the selection contains a folder, hide the regular download option (only zip allowed),
        // otherwise this throws an error about downloading an empty folder then downloads as a zip anyway.
        if (mega.lite.inLiteMode && mega.lite.containsFolderInSelection($.selected)) {
            $(c + '.download-standart-item').addClass('hidden');
            return false;
        }

        // Make standard download option visible for files (and folders in regular mode)
        $(c + '.download-standart-item').removeClass('hidden');
    });

    var safeMoveNodes = function() {
        if (!$(this).hasClass('disabled')) {
            $.hideContextMenu();
            mLoadingSpinner.show('safeMoveNodes');
            M.safeMoveNodes(String($(this).attr('id')).replace('fi_', '')).catch(dump)
                .finally(() => mLoadingSpinner.hide('safeMoveNodes'));
        }
        return false;
    };

    $(c + '.cloud-item').rebind('click', safeMoveNodes);

    $('.dropdown.body.files-menu').off('click', '.folder-item');
    $('.dropdown.body.files-menu').on('click', '.folder-item', safeMoveNodes);
    safeMoveNodes = undefined;

    $(c + '.download-item').rebind('click', function() {
        var c = this.className;

        // If MEGA Lite mode and attempting to download a folder(s) by clicking on the Download item, disable the click
        if (mega.lite.inLiteMode && mega.lite.containsFolderInSelection($.selected)) {
            return false;
        }

        if (c && (c.indexOf('contains-submenu') > -1 || c.indexOf('msync-found') > -1)) {
            M.addDownload($.selected);
        }
    });

    $(c + '.download-standart-item').rebind('click', function() {
        if (folderlink) {
            eventlog(99768);
        }
        M.addDownload($.selected);
    });

    $(c + '.zipdownload-item').rebind('click', function() {
        if (folderlink) {
            eventlog(99769);
        }
        M.addDownload($.selected, true);
    });


    $(c + '.syncmegasync-item').rebind('click', function () {
        // check if this is a business expired account
        if (M.isInvalidUserStatus()) {
            return;
        }

        megasync.isInstalled(function (err, is) {
            if (!err || is) {
                if (megasync.currUser === u_handle) {
                    // i know the selection is 1 item [otherwise option in menu wont be visible]
                    megasync.syncFolder($.selected[0]);
                }
            }
                // no need to do anything, something wierd happened, next time
                // the option wont be visible.
        });
        $.hideContextMenu();
    });

    $(c + '.getlink-item, ' + c + '.embedcode-item, ' + c + '.cd-getlink-item').rebind('click', function(e) {

        M.getLinkAction.call(this);

        if ($(e.currentTarget).hasClass('cd-getlink-item')) {
            if ($(e.currentTarget).hasClass('manage-link')) {
                // event log for manage link/s
                eventlog(500030);
            }
            else {
                // event log for share link
                eventlog(500028);
            }
        }

    });

    $(c + '.removelink-item, ' + c + '.cd-removelink-item').rebind('click', (e) => {
        // check if this is a business expired account
        if (M.isInvalidUserStatus()) {
            return;
        }

        if (u_type === 0) {
            ephemeralDialog(l[1005]);
        }
        else {
            var media = false;
            var handles = Array.isArray($.selected) && $.selected.concat();
            var removeLink = function(e) {
                if (e) {
                    var exportLink = new mega.Share.ExportLink({'updateUI': true, 'nodesToProcess': handles});
                    exportLink.removeExportLink();
                }
            };
            let files = 0;
            let folders = 0;
            for (var i = handles.length; i--;) {
                if (is_video(M.d[handles[i]]) === 1) {
                    media = true;
                }
                if (M.d[handles[i]].t) {
                    folders++;
                }
                else {
                    files++;
                }
            }

            var mediaRemoveLink = () => {
                msgDialog('confirmation', l[882], l[17824], 0, removeLink);
            };

            if (mega.config.get('nowarnpl')) {
                if (media) {
                    mediaRemoveLink();
                }
                else {
                    removeLink(true);
                }
            }
            else {
                // Pluralise dialog text
                const linkCount = folders + files;
                const msg = mega.icu.format(l.remove_link_question, linkCount);
                const cancelButtonText = l.dont_remove;
                const confirmButtonText = l['83'];

                // Use message about removal of 'items' for when both files and folders are selected
                let subMsg = l.remove_link_confirmation_mix_items;

                // Change message to folder/s or file/s depending on number of files and folders
                if (folders === 0) {
                    subMsg = mega.icu.format(l.remove_link_confirmation_files_only, files);
                }
                else if (files === 0) {
                    subMsg = mega.icu.format(l.remove_link_confirmation_folders_only, folders);
                }

                // Show confirmation dialog
                msgDialog(`*confirmation:!^${confirmButtonText}!${cancelButtonText}`, null, msg, subMsg, removeLink,
                    'nowarnpl');
            }
        }

        if ($(e.currentTarget).hasClass('cd-removelink-item')) {
            eventlog(500031);
        }
    });

    $(c + '.dispute-item').rebind('click', function() {
        // Find the first takendown node in the list. This is the item we will use to prefill with.
        localStorage.removeItem('takedownDisputeNodeURL');
        for (var i = 0; i < $.selected.length; i++) {
            var node = M.getNodeByHandle($.selected[i]);
            if (node.t & M.IS_TAKENDOWN || M.getNodeShare(node).down === 1) {
                var disputeURL = mega.getPublicNodeExportLink(node);
                if (disputeURL) {
                    localStorage.setItem('takedownDisputeNodeURL', disputeURL);
                }
                break;
            }
        }
        mega.redirect('mega.io', 'dispute', false, false, false);
    });

    $(c + '.rename-item').rebind('click', function() {
        // check if this is a business expired account
        if (M.isInvalidUserStatus()) {
            return;
        }
        renameDialog();
    });

    $(c + '.sh4r1ng-item').rebind('click', function() {
        M.openSharingDialog($.selected[0]);
        eventlog(500029);
    });

    $(`${c}.removeshare-item, ${c}.cd-removeshare-item`).rebind('click', (e) => {
        if (M.isInvalidUserStatus()) {
            return;
        }

        msgDialog(`remove:!^${l[23737]}!${l[82]}`, '', l.remove_share_title, l.remove_share_msg, res => {
            if (res) {
                new mega.Share().removeSharesFromSelected().dump('remove-share');
            }
        }, 1);

        if ($(e.currentTarget).hasClass('cd-removeshare-item')) {
            eventlog(500033);
        }
    });

    $(c + '.cd-sh4r1ng-item').rebind('click', (e) => {
        M.openSharingDialog($.selected[0]);

        if ($(e.currentTarget).hasClass('manage-share')) {
            // event log for manage folder
            eventlog(500032);
        }
        else {
            // event log for share folder
            eventlog(500029);
        }
    });

    // Move Dialog
    $(c + '.advanced-item, ' + c + '.move-item').rebind('click', openMoveDialog);

    $(c + '.copy-item').rebind('click', openCopyDialog);

    $(c + '.revert-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        mLoadingSpinner.show('restore-nodes');
        M.revertRubbishNodes($.selected)
            .catch((ex) => {
                if (ex !== EBLOCKED) {
                    // user canceled file-conflict dialog.
                    tell(ex);
                }
            })
            .finally(() => mLoadingSpinner.hide('restore-nodes'));
    });

    $(c + '.import-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }

        if (pfcol) {
            $.selected = Object.keys(mega.gallery.albums.grid.timeline.selections);
        }

        eventlog(pfcol ? 99832 : 99767);
        ASSERT(folderlink, 'Import needs to be used in folder links.');

        M.importFolderLinkNodes($.selected);
    });

    $(c + '.newfolder-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        createFolderDialog();
    });
    // eslint-disable-next-line local-rules/jquery-scopes
    $(c + '.newfile-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        createFileDialog();
    });

    $(c + '.fileupload-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        $('#fileselect3').click();
    });

    $(c + '.folderupload-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        $('#fileselect4').click();
    });

    $(c + '.remove-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        if ($(this).hasClass('disabled')) {
            return false;
        }
        closeDialog();
        fmremove();
    });

    $(c + '.addcontact-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        contactAddDialog();
    });

    $(c + '.startchat-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        var $this = $(this);
        var user_handle = $.selected;

        if (user_handle.length === 1) {
            if (!$this.is('.disabled') && user_handle[0]) {
                loadSubPage('fm/chat/p/' + user_handle[0]);
            }
        }
        else {
            megaChat.createAndShowGroupRoomFor(user_handle, "", {keyRotation: true, createChatLink: false});
        }
    });

    $(c + '.startaudio-item,' + c + '.startaudiovideo-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        var $this = $(this);
        var user_handle = $.selected && $.selected[0];

        if (!$this.is('.disabled') && user_handle) {
            megaChat.createAndShowPrivateRoom(user_handle)
                .then(function(room) {
                    room.setActive();
                    room.startAudioCall();
                });
        }
    });

    $(c + '.startvideo-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        var $this = $(this);
        var user_handle = $.selected && $.selected[0];

        if (!$this.is('.disabled') && user_handle) {
            megaChat.createAndShowPrivateRoom(user_handle)
                .then(function(room) {
                    room.setActive();
                    room.startVideoCall();
                });
        }
    });

    $(c + '.view-profile-item').rebind('click', function(e) {
        var $this = $(this);
        var user_handle = $.selected && $.selected[0];

        if (!$this.is('.disabled') && user_handle) {
            loadSubPage('fm/chat/contacts/' + user_handle);
            // there seem to be some duplicated callbacks triggered by menus.js, but since I'm not sure what would the
            // side effects of that can be, I'm stopping propagation here to reduce risk of those causing double
            // loadSubPage calls (which breaks fm/$contact -> fm/chat/contacts/$contact redirects, because it triggers
            // a race in openFolder)
            e.stopPropagation();
        }
    });

    $(c + '.send-files-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        var $this = $(this);
        var user_handle = $.selected && $.selected[0];

        if (!$this.is('.disabled') && user_handle) {
            megaChat.openChatAndSendFilesDialog(user_handle);
        }
    });

    $(c + '.share-folder-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        var $this = $(this);
        var user_handle = $.selected && $.selected[0];

        if (!$this.is('.disabled') && user_handle) {
            openCopyShareDialog(user_handle);
        }
    });

    $(`${c}.leaveshare-item`).rebind('click', () => {
        if (M.isInvalidUserStatus()) {
            return;
        }
        const errHandler = ex => {
            if (ex === EMASTERONLY) {
                msgDialog('warningb', '', l.err_bus_sub_leave_share_dlg_title, l.err_bus_sub_leave_share_dlg_text);
            }
        };

        for (let i = 0; i < $.selected.length; i++) {
            M.leaveShare($.selected[i]).catch(errHandler);
        }
    });

    // Bind Set Nickname context menu button
    $(c + '.set-nickname').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        var userHandle = $.selected && $.selected[0];

        $.hideContextMenu();
        nicknames.setNicknameDialog.init(userHandle);
    });

    $(c + '.remove-contact').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        if ($(this).hasClass('disabled')) {
            return;
        }
        var user_handle = $.selected && $.selected[0];

        fmremove(user_handle);
    });

    $(c + '.properties-item').rebind('click', function() {
        mega.ui.mInfoPanel.initInfoPanel();
    });

    $(c + '.device-rename-item').rebind('click', () => {
        mega.backupCenter.renameDialog();
    });

    if (pfid) {
        $(`${c}.vhl-item`).rebind('click', () => {
            for (let i = $.selected.length; i--;) {
                let n = M.d[$.selected[i]];
                if (n) {
                    if ((n.vhl |= 1) > 3) {
                        n.vhl = 0;
                    }
                    $(`#${n.h}`).removeClassWith('highlight').addClass(`highlight${++n.vhl}`);

                    while ((n = M.d[n.p])) {
                        if (!n.vhl) {
                            n.vhl = 1;
                        }
                    }
                }
            }
            M.clearSelectedNodes();
        });
    }

    // eslint-disable-next-line local-rules/jquery-scopes
    $(c + '.edit-file-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        var nodeHandle = $.selected && $.selected[0];
        if (!nodeHandle) {
            return;
        }

        // Close properties dialog if context menu was triggered there
        if ($.dialog === 'properties') {
            propertiesDialog(true);
        }

        loadingDialog.show('common', l[23130]);

        mega.fileTextEditor.getFile(nodeHandle)
            .then((data) => {
                mega.textEditorUI.setupEditor(M.getNameByHandle(nodeHandle), data, nodeHandle);
            })
            .catch(dump)
            .finally(() => {
                loadingDialog.hide();
            });
    });

    $(c + '.properties-versions').rebind('click', function() {
        fileversioning.fileVersioningDialog();
    });

    $(c + '.clearprevious-versions').rebind('click', function() {

        if (M.isInvalidUserStatus()) {
            return;
        }

        if ($.selected && $.selected.length > 0) {

            const fselected = M.getNodeByHandle($.selected[0]);

            if ($.selected && $.selected.length === 1 && fselected.t && fselected.tvf) {

                const sfWithVf = Object.create(null);

                sfWithVf[$.selected[0]] = fselected.tvf;

                const _getChildFolderWithVerion = function _(h) {

                    if (!M.tree[h]) {
                        return;
                    }

                    const fHandles = Object.keys(M.tree[h]);

                    for (let i = fHandles.length; i--;) {

                        if (M.tree[h][fHandles[i]].tvf) {

                            sfWithVf[fHandles[i]] = M.tree[h][fHandles[i]].tvf;
                            sfWithVf[h] -= M.tree[h][fHandles[i]].tvf;
                            _(fHandles[i]);
                        }

                        if (!sfWithVf[h]) {

                            delete sfWithVf[h];
                            break;
                        }
                    }
                };

                msgDialog('remove', l[1003], l.clear_prev_version_folder, l[1007], async(e) => {

                    if (e) {

                        _getChildFolderWithVerion($.selected[0]);

                        const fh = Object.keys(sfWithVf);
                        await dbfetch.geta(fh);

                        for (let i = fh.length; i--;) {

                            const cfh = Object.keys(M.c[fh[i]]);

                            for (let j = cfh.length; j--;) {

                                const cfn = M.getNodeByHandle(cfh[j]);

                                if (!cfn.t && cfn.tvf) {
                                    fileversioning.clearPreviousVersions(cfh[j]);
                                }
                            }
                        }
                    }
                });

                return;
            }

            const fvNode = [];

            for (let i = $.selected.length; i--;) {

                const selected = M.getNodeByHandle($.selected[i]);

                if (!selected.t && selected.tvf) {
                    fvNode.push($.selected[i]);
                }
            }

            msgDialog('remove', l[1003], mega.icu.format(l[17154], fvNode.length), l[1007], (e) => {

                if (e) {
                    for (let i = fvNode.length; i--;) {
                        fileversioning.clearPreviousVersions(fvNode[i]);
                    }
                }
            });
        }
    });

    $(c + '.findupes-item').rebind('click', M.findDupes);

    $(c + '.add-star-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }

        let newFavState;

        if ($.selected.length > 1) {
            // Determine the new fav state value from multiselection
            newFavState = Number($('i', $(this)).hasClass('icon-favourite'));
        }
        else {
            newFavState = Number(!M.isFavourite($.selected));
        }

        M.favourite($.selected, newFavState);
    });

    $(`${c}.send-to-contact-item, ${c}.cd-send-to-contact-item`).rebind('click', (ev) => {
        openCopyDialog('conversations');

        if ($(ev.currentTarget).hasClass('cd-send-to-contact-item')) {
            // eveng log for send contact folder
            eventlog(500027);
        }
    });

    $('.submenu.labels .dropdown-colour-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }

        const classList = this.classList;
        let labelId = parseInt(this.dataset.labelId);

        // Remove the existing label from nodes
        if (classList.contains('active') && !classList.contains('update-to')) {
            labelId = 0;
        }

        M.labeling($.selected, labelId);
    });

    $('.colour-sorting-menu .filter-by .dropdown-colour-item').rebind('click', function(e) {
        if (d){
            console.log('label color selected');
        }
        var labelId = parseInt(this.dataset.labelId);
        var parent = $(this).parents('.labels');

        if (labelId && !parent.hasClass("disabled")) {
            // init M.filterLabel[type] if not exist.
            if (!M.currentLabelFilter) {
                M.filterLabel[M.currentLabelType] = Object.create(null);
            }

            M.applyLabelFilter(e);
        }
    });

    $('.filter-block.body .close').rebind('click', function() {
        delete M.filterLabel[M.currentLabelType];
        $('.colour-sorting-menu .dropdown-colour-item').removeClass('active');
        $(this).parent().addClass('hidden')// Hide 'Filter:' DOM elements
            .find('.colour-label-ind').remove();// Remove all colors from it

        $.hideContextMenu();
        M.openFolder(M.currentdirid, true);
    });

    $('.filter-block.rubbish .filter-block.close').rebind('click', function() {
        delete M.filterLabel[M.currentLabelType];
        $('.colour-sorting-menu .dropdown-colour-item').removeClass('active');
        $('.filter-block.rubbish.body')
        .addClass('hidden')// Hide 'Filter:' DOM elements
        .find('.colour-label-ind').remove();// Remove all colors from it

        $.hideContextMenu();
        M.openFolder(M.currentdirid, true);
    });

    $('.submenu.labels .dropdown-colour-item').rebind('mouseover.clrSort', function() {
        var labelTxt = this.dataset.labelTxt;
        if ($(this).hasClass('update-to')) {
            switch (labelTxt) {
                case "Red":
                    labelTxt = l.update_to_red;
                    break;
                case "Orange":
                    labelTxt = l.update_to_orange;
                    break;
                case "Yellow":
                    labelTxt = l.update_to_yellow;
                    break;
                case "Green":
                    labelTxt = l.update_to_green;
                    break;
                case "Blue":
                    labelTxt = l.update_to_blue;
                    break;
                case "Purple":
                    labelTxt = l.update_to_purple;
                    break;
                case "Grey":
                    labelTxt = l.update_to_grey;
                    break;
            }
        }
        else if ($(this).hasClass('active')) {
            switch (labelTxt) {
                case "Red":
                    labelTxt = l[19569];
                    break;
                case "Orange":
                    labelTxt = l[19573];
                    break;
                case "Yellow":
                    labelTxt = l[19577];
                    break;
                case "Green":
                    labelTxt = l[19581];
                    break;
                case "Blue":
                    labelTxt = l[19585];
                    break;
                case "Purple":
                    labelTxt = l[19589];
                    break;
                case "Grey":
                    labelTxt = l[19593];
                    break;
            }
        }
        else {
            switch (labelTxt) {
                case "Red":
                    labelTxt = l[19568];
                    break;
                case "Orange":
                    labelTxt = l[19572];
                    break;
                case "Yellow":
                    labelTxt = l[19576];
                    break;
                case "Green":
                    labelTxt = l[19580];
                    break;
                case "Blue":
                    labelTxt = l[19584];
                    break;
                case "Purple":
                    labelTxt = l[19588];
                    break;
                case "Grey":
                    labelTxt = l[19592];
                    break;
            }
        }
        $('.labels .dropdown-color-info').safeHTML(labelTxt).addClass('active');
    });

    $('.colour-sorting-menu .labels .dropdown-colour-item').rebind('mouseover.clrSort', function(e) {
        if (!$(this).parents('.labels').hasClass('disabled')){
            M.updateLabelInfo(e);
        }
    });

    $('.labels .dropdown-colour-item').rebind('mouseout', function() {
        $('.labels .dropdown-color-info').removeClass('active');
    });

    $(c + '.open-item').rebind('click', function() {
        var target = $.selected[0];
        if (
            M.currentrootid === 'out-shares' ||
            M.currentrootid === 'public-links' ||
            M.currentrootid === 'file-requests'
        ) {
            target = M.currentrootid + '/' + target;
        }
        else if (M.dyh) {
            target = M.dyh('folder-id', target);
        }
        $('.js-lpbtn').removeClass('active');
        M.openFolder(target);
    });

    $(c + '.verify-credential').rebind('click', () => fingerprintDialog(M.d[$.selected[0]].su));

    $(`${c}.open-gallery`).rebind('click', () => {
        var target = $.selected[0];
        M.openFolder(`discovery/${target}`);
    });

    $(`${c}.open-cloud-item, ${c}.open-in-location, ${c}.open-s4-item`)
        .rebind('click.openItem', () => {

        const node = M.d[$.selected[0]];

        // Incoming Shares section if shared folder doestn't have parent
        const target = node.su && (!node.p || !M.d[node.p]) ? 'shares' : node.p;

        if (mega.gallery.sections[M.currentdirid]) {
            M.fmTabState.gallery.prev = M.currentdirid;
        }

        M.openFolder(target).then(() => {
            selectionManager.add_to_selection(node.h, true);
        });
    });

    $(`${c}.hide-backup`).rebind('click.hBckp', () => {

        mega.backupCenter.hideDevice();
    });

    $(`${c}.get-more-quota`).rebind('click.getQuota', () => {

        loadSubPage('pro');
    });

    $(`${c}.new-backup`).rebind('click.nBckp', () => {

        mega.backupCenter.addNewBackup();
    });

    $(`${c}.view-in-bc-item`).rebind('click.openBC', () => {

        mega.backupCenter.showFolder($.selected[0]);
    });

    $(`${c}.move-backup-item`).rebind('click.moveBckp', () => {

        if (!$.selected.length || !mega.backupCenter.selectedSync
            || mega.backupCenter.selectedSync.nodeHandle !== $.selected[0]) {

            return false;
        }

        selectFolderDialog('move')
            .then((target) => {
                if (target) {
                    loadingDialog.pshow();
                    return mega.backupCenter.stopSync(undefined, mega.backupCenter.selectedSync.nodeHandle, target);
                }
            })
            .catch(tell)
            .finally(() => {
                loadingDialog.phide();
            });
    });

    $(`${c}.remove-backup-item`).rebind('click.removeBckp', () => {

        if (!$.selected.length || !mega.backupCenter.selectedSync
            || mega.backupCenter.selectedSync.nodeHandle !== $.selected[0]) {

            return false;
        }

        msgDialog(
            'remove',
            l[882],
            l[13751],
            l[1007],
            (e) => {

                if (e) {

                    loadingDialog.pshow();

                    mega.backupCenter.stopSync(
                        undefined, mega.backupCenter.selectedSync.nodeHandle
                    )
                        .then(nop)
                        .catch((ex) => {
                            msgDialog('warninga', l[135], l[47], ex);
                        })
                        .finally(() => {

                            loadingDialog.phide();
                        });
                }
            }
        );
    });

    $(`${c}.stopbackup-item`).rebind('click.stopBckp', () => {

        mega.backupCenter.showStopBackupDialog();
    });

    $(`${c}.stopsync-item`).rebind('click.stopSync', () => {

        mega.backupCenter.showStopConfirmationDialog();
    });

    $(c + '.preview-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }

        // Close node Info panel as not needed immediately after opening Preview
        mega.ui.mInfoPanel.closeIfOpen();

        closeDialog();
        slideshow($.selected[0]);
    });

    $(c + '.play-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        var n = $.selected[0];

        // Close node Info panel as not needed immediately after opening Preview
        mega.ui.mInfoPanel.closeIfOpen();

        closeDialog();

        $.autoplay = n;
        slideshow(n);
    });

    $(c + '.clearbin-item').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }
        doClearbin(true);
    });

    $(c + '.transfer-play, ' + c + '.transfer-pause').rebind('click', function() {
        var $trs = $('.transfer-table tr.ui-selected');

        if ($(this).hasClass('transfer-play')) {
            if ($trs.filter('.transfer-upload').length && ulmanager.ulOverStorageQuota) {
                ulmanager.ulShowOverStorageQuotaDialog();
                return;
            }

            if (dlmanager.isOverQuota) {
                dlmanager.showOverQuotaDialog();
                return;
            }
        }

        var ids = $trs.attrs('id');

        if ($(this).hasClass('transfer-play')) {
            ids.map(fm_tfsresume);
        }
        else {
            ids.map(fm_tfspause);
        }

        $trs.removeClass('ui-selected');
    });

    $(c + '.canceltransfer-item,' + c + '.transfer-clear').rebind('click', function() {
        var $trs = $('.transfer-table tr.ui-selected');
        var toabort = $trs.attrs('id');
        $trs.remove();
        dlmanager.abort(toabort);
        ulmanager.abort(toabort);
        $.clearTransferPanel();
        tfsheadupdate({c: toabort});
        mega.tpw.removeRow(toabort);

        onIdle(function() {
            // XXX: better way to stretch the scrollbar?
            $(window).trigger('resize');
        });
        $('.transfer-table tr.ui-selected').removeClass('ui-selected');
    });

    $(`${c}.new-bucket-item`)
        .rebind('click.createBucket', () => s4.ui.showDialog(s4.buckets.dialogs.create));

    $(`${c}.settings-item`)
        .rebind('click.showSettings', () => s4.ui.showDialog(s4.buckets.dialogs.settings, M.d[$.selected[0]]));

    $(`${c}.managepuburl-item`)
        .rebind('click.managePA', () => s4.ui.showDialog(s4.objects.dialogs.access, M.d[$.selected[0]]));

    if (window.pfcol) {
        $(`${c}.play-slideshow, ${c}.preview-item, ${c}.play-item`).rebind('click', function() {
            if (M.isInvalidUserStatus()) {
                return;
            }

            closeDialog();
            mega.gallery.playSlideshow(
                mega.gallery.getAlbumIdFromPath(),
                this.classList.contains('play-slideshow'),
                this.classList.contains('play-item')
            );
        });
    }

    if (mega.keyMgr.version) {

        queueMicrotask(() => {

            this.fireKeyMgrDependantActions().catch(dump);
        });
    }
};

FileManager.prototype.fireKeyMgrDependantActions = async function() {
    'use strict';

    if (sessionStorage.folderLinkImport || ($.onImportCopyNodes && !$.onImportCopyNodes.opSize)) {

        await M.importFolderLinkNodes(false);
    }
};

FileManager.prototype.createFolderUI = function() {
    "use strict";

    const $inputWrapper = $('.fm-dialog-body', '.create-new-folder.popup');
    const ltWSpaceWarning = new InputFloatWarning($inputWrapper);

    var doCreateFolder = function() {

        // Log that Create button clicked within the Create folder dialog
        eventlog(500008);

        var $input = $('input', $inputWrapper);
        var name = $input.val();
        var errorMsg = '';

        if (name.trim() === '') { // Check if enter a folder name
            errorMsg = l.EmptyName;
        }
        else if (!M.isSafeName(name)) { // Check if folder name is valid
            errorMsg = name.length > 250 ? l.LongName : l[24708];
        }
        else if (duplicated(name)) { // Check if folder name already exists
            errorMsg = l[23219];
        }

        if (errorMsg) {
            $('.duplicated-input-warning span', $inputWrapper).text(errorMsg);
            $inputWrapper.addClass('duplicate');

            setTimeout(() => {
                $inputWrapper.removeClass('duplicate');
                $input.removeClass('error');
                $input.trigger("focus");
            }, 2000);

            return;
        }

        $input.val('');
        $('.fm-new-folder').removeClass('active');
        $('.create-new-folder').addClass('hidden');

        mLoadingSpinner.show('create-folder');
        var currentdirid = M.currentCustomView.nodeID || M.currentdirid;

        M.createFolder(currentdirid, name)
            .then((h) => {
                const ok = typeof h === 'string' && h.length === 8;

                if (d) {
                    console.log('Created new folder %s->%s.', currentdirid, h);
                    console.assert(ok, `Invalid createFolder result ${h}`, h);
                }
                if (ok) {
                    // @todo the previously created folder is leaved selected, FIXME
                    $.selected = [h];
                    reselect(1);
                }
            })
            .catch(tell)
            .finally(() => {
                mLoadingSpinner.hide('create-folder');
            });

        return false;
    };

    $('.fm-new-folder').rebind('click', function(e) {

        if (M.isInvalidUserStatus()) {
            return;
        }

        ltWSpaceWarning.hide();

        // Log that top menu Create folder clicked
        eventlog(500007);

        var $me = $(this);
        var $nFolderDialog = $('.create-new-folder', 'body').removeClass('filled-input');

        var $nameInput = $('input', $nFolderDialog).val('');

        if ($me.hasClass('active')) {
            $me.removeClass('active filled-input');
            $nFolderDialog.addClass('hidden');
        }
        else {
            $me.addClass('active');
            $nFolderDialog.removeClass('hidden');
            topPopupAlign(this, '.dropdown.create-new-folder');
            $nameInput.focus();
        }
        $.hideContextMenu();
        return false;
    });

    $('.create-folder-button').rebind('click', doCreateFolder);

    $('.create-folder-button-cancel').rebind('click', function() {
        $('.fm-new-folder').removeClass('active');
        $('.create-new-folder').addClass('hidden');
        $('.create-new-folder').removeClass('filled-input');
        $('.create-new-folder input').val('');
    });

    $('.create-folder-size-icon.full-size').rebind('click', function() {

        var v = $('.create-new-folder input').val();

        if (v !== l[157] && v !== '') {
            $('.create-folder-dialog input').val(v);
        }

        $('.create-new-folder input').trigger("focus");
        $('.create-new-folder').removeClass('filled-input');
        $('.create-new-folder').addClass('hidden');
        $('.fm-new-folder').removeClass('active');
        createFolderDialog(0);
        $('.create-new-folder input').val('');
    });

    $('.create-folder-size-icon.short-size').rebind('click', function() {

        var v = $('.create-folder-dialog input').val();

        if (v !== l[157] && v !== '') {
            $('.create-new-folder input').val(v);
            $('.create-new-folder').addClass('filled-input');
        }

        $('.fm-new-folder').addClass('active');
        $('.create-new-folder').removeClass('hidden');
        topPopupAlign('.link-button.fm-new-folder', '.create-folder-dialog');

        createFolderDialog(1);
        $('.create-folder-dialog input').val('');
        $('.create-new-folder input').trigger("focus");
    });

    $('.create-new-folder input').rebind('keyup.create-new-f', function(e) {
        ltWSpaceWarning.check({type: 1});
        $('.create-new-folder').addClass('filled-input');
        if ($(this).val() === '') {
            $('.create-new-folder').removeClass('filled-input');
        }
        if (e.which === 13) {
            doCreateFolder();
        }
    });

    $('.create-new-folder input').rebind('focus.create-new-f', function() {
        if ($(this).val() === l[157]) {
            $(this).val('');
        }
        $(this).removeAttr('placeholder');
        $('.create-new-folder').addClass('focused');
    });

    $('.create-new-folder input').rebind('blur.create-new-f', function() {
        $('.create-new-folder').removeClass('focused');
        $(this).attr('placeholder', l[157]);
    });

    $('.fm-new-shared-folder').rebind('click', function() {
        if (u_type === 0) {
            ephemeralDialog(l[997]);
        }
        else {
            openNewSharedFolderDialog().catch(dump);
        }
    });

    $('.fm-new-link').rebind('click', function() {
        if (M.isInvalidUserStatus()) {
            return;
        }

        if (u_type === 0) {
            ephemeralDialog(l[1005]);
        }
        else {
            M.safeShowDialog('create-new-link', function () {
                M.initFileAndFolderSelectDialog('create-new-link');
            });
        }
    });
};

/**
 * Initialize file and folder select dialog from chat.
 * This will fill up $.selected with what user selected on the dialog.
 * @param {String} type Type of dialog for select default options, e.g. newLink for New public link
 */
FileManager.prototype.initFileAndFolderSelectDialog = function(type, OnSelectCallback) {
    'use strict';
    /* eslint-enable id-length */
    // If chat is not ready.
    if (!megaChatIsReady) {
        if (megaChatIsDisabled) {
            console.error('Mega Chat is disabled, cannot proceed');
        }
        else {
            // Waiting for chat_initialized broadcaster.
            loadingDialog.show();
            mBroadcaster.once('chat_initialized', this.initFileAndFolderSelectDialog.bind(this, type));
        }
        return false;
    }

    loadingDialog.hide();

    // Using existing File selector dialog from chat.
    var dialogPlacer = document.createElement('div');
    var selected = [];
    var constructor;
    var doClose = function(noClearSelected) {
        ReactDOM.unmountComponentAtNode(dialogPlacer);
        constructor.domNode.remove();
        dialogPlacer.remove();
        if (!noClearSelected) {
            selected = [];
        }
        closeDialog();
    };

    var options = {
        'create-new-link': {
            title: l[20667],
            classes: 'no-incoming', // Hide incoming share tab
            selectLabel: l[1523],
            folderSelectable: true, // Can select folder(s)
            onAttach: function() {
                doClose(true);
                $.selected = selected;
                M.getLinkAction();
            }
        },
        'openFile': {
            title: l[22666],
            classes: 'no-incoming', // Hide incoming share tab
            selectLabel: l[865],
            folderSelectNotAllowed: true,
            folderSelectable: false, // Can select folder(s)
            customFilterFn: function(node) {
                if (node.t) {
                    return true;
                }
                if (node.s >= 20971520) {
                    return false;
                }

                if (is_text(node)) {
                    return true;
                }
                return false;
            },
            onAttach: function() {
                doClose(true);
                $.selected = selected;
                if (OnSelectCallback) {
                    OnSelectCallback(selected);
                }
            }
        }
    };

    var prop = {
        title: options[type].title,
        folderSelectable: options[type].folderSelectable,
        selectLabel: options[type].selectLabel,
        className: options[type].classes,
        onClose: function() {
            doClose();
        },
        onSelected: function(node) {
            selected = node;
        },
        onAttachClicked: options[type].onAttach,
    };
    if (options[type].folderSelectNotAllowed) {
        prop.folderSelectNotAllowed = options[type].folderSelectNotAllowed;
    }
    if (options[type].customFilterFn) {
        prop.customFilterFn = options[type].customFilterFn;
    }

    var dialog = React.createElement(CloudBrowserModalDialogUI.CloudBrowserDialog, prop);

    constructor = ReactDOM.render(dialog, dialogPlacer);
};

FileManager.prototype.initNewChatlinkDialog = function() {
    'use strict';

    // If chat is not ready.
    if (!megaChatIsReady) {
        if (megaChatIsDisabled) {
            console.error('Mega Chat is disabled, cannot proceed');
        }
        else {
            // Waiting for chat_initialized broadcaster.
            loadingDialog.show();
            mBroadcaster.once('chat_initialized', this.initNewChatlinkDialog.bind(this));
        }
        return false;
    }

    loadingDialog.hide();

    var dialogPlacer = document.createElement('div');

    var dialog = React.createElement(StartGroupChatDialogUI.StartGroupChatWizard, {
        name: "start-group-chat",
        flowType: 2,
        onClose: function() {
            ReactDOM.unmountComponentAtNode(dialogPlacer);
            dialogPlacer.remove();
            closeDialog();
        }
    });

    ReactDOM.render(dialog, dialogPlacer);
};

FileManager.prototype.initUIKeyEvents = function() {
    "use strict";

    $(window).rebind('keydown.uikeyevents', function(e) {
        if ((M.chat && !$.dialog) || M.isAlbumsPage()) {
            return true;
        }

        if (e.keyCode == 9 && !$(e.target).is("input,textarea,select")) {
            return false;
        }
        if ($(e.target).filter("input,textarea,select").is(":focus")) {
            // when the user is typing in the "New folder dialog", if the current viewMode is grid/icons view, then
            // left/right navigation in the input field may cause the selection manager to trigger selection changes.
            // Note: I expected that the dialog would set $.dialog, but it doesn't.
            if (e.keyCode !== 27) {
                return true;
            }
        }

        var is_transfers_or_accounts = (
            M.currentdirid && (M.currentdirid.substr(0, 7) === 'account' || M.currentdirid === 'transfers')
        );

        // selection manager may not be available on empty folders.
        var is_selection_manager_available = !!window.selectionManager;

        var sl = false;
        var s = [];

        var selPanel = $('.fm-transfers-block tr.ui-selected');

        if (selectionManager && selectionManager.selected_list && selectionManager.selected_list.length > 0) {
            s = clone(selectionManager.selected_list);
        }
        else {
            var tempSel;

            if (M.viewmode) {
                tempSel = $('.data-block-view.ui-selected');
            }
            else {
                tempSel = $('.grid-table tr.ui-selected');
            }

            s = tempSel.attrs('id');
        }


        if (!is_fm() && page !== 'login' && page.substr(0, 3) !== 'pro') {
            return true;
        }

        /**
         * Because of te .unbind, this can only be here... it would be better if its moved to iconUI(), but maybe some
         * other day :)
         */
        if (
            page === 'fm/recents' &&
            !slideshowid &&
            !$.dialog
        ) {
            // left or right
            if (e.keyCode === 37 || e.keyCode === 39) {
                M.recentsRender.keySelectPrevNext(e.keyCode === 39 | 0 || -1, e.shiftKey);
            }
            // up or down
            else if (e.keyCode === 38 || e.keyCode === 40) {
                M.recentsRender.keySelectUpDown(e.keyCode === 40 | 0 || -1, e.shiftKey);
            }

            return;
        }
        else if (
            is_selection_manager_available &&
            !is_transfers_or_accounts &&
            !$.dialog &&
            !slideshowid &&
            M.viewmode == 1
        ) {
            if (e.keyCode == 37) {
                // left
                selectionManager.select_prev(e.shiftKey, true);
            }
            else if (e.keyCode == 39) {
                // right
                selectionManager.select_next(e.shiftKey, true);
            }

            // up & down
            else if (e.keyCode == 38 || e.keyCode == 40) {
                if (e.keyCode === 38) {
                    selectionManager.select_grid_up(e.shiftKey, true);
                }
                else {
                    selectionManager.select_grid_down(e.shiftKey, true);
                }
            }
        }

        if (
            is_selection_manager_available &&
            !is_transfers_or_accounts &&
            e.keyCode == 38 &&
            String($.selectddUIgrid).indexOf('.grid-scrolling-table') > -1 &&
            !$.dialog
        ) {
            // up in grid/table
            selectionManager.select_prev(e.shiftKey, true);
            quickFinder.disable_if_active();
        }
        else if (
            is_selection_manager_available &&
            !is_transfers_or_accounts &&
            e.keyCode == 40 &&
            String($.selectddUIgrid).indexOf('.grid-scrolling-table') > -1 &&
            !$.dialog
        ) {
            // down in grid/table
            selectionManager.select_next(e.shiftKey, true);
            quickFinder.disable_if_active();
        }
        else if (
            !is_transfers_or_accounts &&
            e.keyCode == 46 &&
            s.length > 0 &&
            !$.dialog &&
            (M.getNodeRights(M.currentdirid) > 1 || M.currentCustomView) &&
            !M.isGalleryPage() &&
            M.currentrootid !== M.InboxID &&
            M.currentdirid !== 'devices'
        ) {
            const nodes = s.filter(h => !M.d[h] || M.getNodeRoot(M.d[h].h) !== M.InboxID);
            if (M.isInvalidUserStatus() || $.msgDialog === 'remove') {
                return;
            }

            if (nodes.length) {
                // delete
                fmremove(nodes);
            }
        }
        else if ((e.keyCode === 46) && (selPanel.length > 0)
            && !$.dialog && M.getNodeRights(M.currentdirid) > 1) {
            msgDialog('confirmation', l[1003], mega.icu.format(l[17092], s.length), false, (e) => {

                // we should encapsule the click handler
                // to call a function rather than use this hacking
                if (e) {
                    $('.transfer-clear').trigger('click');
                }
            });
        }
        else if (
            !is_transfers_or_accounts &&
            e.keyCode == 13
            && s.length > 0
            && !$.dialog
            && !$.msgDialog
            && !$('.fm-new-folder').hasClass('active')
            && !$('.top-search-bl').hasClass('active')
            && !$('.node-description.mega-textarea', 'body').hasClass('active')
        ) {
            $.selected = s.filter(h => !M.getNodeShare(h).down);

            if ($.selected && $.selected.length > 0) {
                var n = M.d[$.selected[0]];

                if (M.getNodeRoot(n.h) === M.RubbishID) {
                    propertiesDialog();
                }
                else if (n && n.t) {
                    M.openFolder(n.h);
                }
                else if ($.selected.length < 2 && (is_image2(n) || is_video(n))) {
                    const $elm = mega.gallery.sections[M.currentdirid]
                        ? $(`#${n.h}.data-block-view`, '#gallery-view')
                        : $('.dropdown-item.play-item');

                    if ($elm.length) {
                        $elm.trigger('click').trigger('dblclick');
                    }
                    else {
                        slideshow($.selected[0]);
                    }
                }
                else {
                    M.addDownload($.selected);
                }
            }
        }
        else if ((e.keyCode === 13) && ($.dialog === 'share')) {
            addNewContact($('.add-user-popup-button'), false).done(function() {
                var share = new mega.Share();
                share.updateNodeShares();
                $('.token-input-token-mega').remove();
            });
        }
        else if ((e.keyCode === 13) && ($.dialog === 'rename')) {
            $('.rename-dialog-button.rename').trigger('click');
        }
        else if (e.keyCode === 27 && $.dialog && ($.msgDialog === 'confirmation')) {
            return false;
        }
        // If the Esc key is pressed while the payment address dialog is visible, close it
        else if ((e.keyCode === 27) && !$('.payment-address-dialog').hasClass('hidden')) {
            addressDialog.closeDialog();
        }
        else if (e.keyCode === 27 && ($.copyDialog || $.moveDialog || $.selectFolderDialog
            || $.copyrightsDialog || $.saveAsDialog)) {
            closeDialog();
        }
        else if (e.keyCode == 27 && $.topMenu) {
            topMenu(1);
        }
        else if (e.keyCode == 27 && $.dialog) {
            if ($.dialog === 'share-add' || $.dialog === 'share' || $.dialog === 'meetings-schedule-dialog') {
                return false;
            }
            closeDialog();
        }
        else if (e.keyCode == 27 && $('.default-select.active').length) {
            var $selectBlock = $('.default-select.active');
            $selectBlock.find('.default-select-dropdown').fadeOut(200);
            $selectBlock.removeClass('active');
        }
        else if (e.keyCode == 27 && $.msgDialog) {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback(false);
                $.warningCallback = null;
            }
        }
        else if (e.keyCode === 13 && ($.msgDialog === 'confirmation' || $.msgDialog === 'remove' ||
            (($.msgDialog === 'warninga' || $.msgDialog === 'warningb' || $.msgDialog === 'info' ||
            $.msgDialog === 'error') && $('#msgDialog .mega-button').length === 1))) {
            closeMsg();
            if ($.warningCallback) {
                $.warningCallback(true);
                $.warningCallback = null;
            }
        }
        else if (
            !is_transfers_or_accounts &&
            (e.keyCode === 113 /* F2 */) &&
            (s.length > 0) &&
            !$.dialog && M.getNodeRights(M.d[s[0]] && M.d[s[0]].h) > 1 &&
            M.currentrootid !== M.InboxID &&
            M.currentdirid !== 'devices' && M.getNodeRoot(M.d[s[0]].h) !== M.InboxID
        ) {
            renameDialog();
        }
        else if (
            is_selection_manager_available &&
            e.keyCode == 65 &&
            e.ctrlKey &&
            !$.dialog &&
            !M.isGalleryPage()
        ) {
            if (is_transfers_or_accounts) {
                return;
            }
            // ctrl+a/cmd+a - select all
            selectionManager.select_all();
        }
        else if (e.keyCode == 27) {
            if ($.hideTopMenu) {
                $.hideTopMenu();
            }
            if ($.hideContextMenu) {
                $.hideContextMenu();
            }
        }

        if (sl && String($.selectddUIgrid).indexOf('.grid-scrolling-table') > -1) {
            // if something is selected, scroll to that item
            const $scrollBlock = sl.closest('.ps');
            if (M.megaRender && M.megaRender.megaList && M.megaRender.megaList._wasRendered) {
                M.megaRender.megaList.scrollToItem(sl.data('id'));
            }
            else if ($scrollBlock.length) {
                scrollToElement($scrollBlock, sl);
            }
        }

        M.renderSearchBreadcrumbs();
    });
};

FileManager.prototype.addTransferPanelUI = function() {
    "use strict";

    var transferPanelContextMenu = function(target) {
        var file;
        var tclear;

        // Please be aware that menu items are all hyperlink elements with the dropdown-item classname.
        // Here only hide all menu items and display correct ones,
        // which should not include any ones under submenu with the span tag.
        var $menuitems = $('.dropdown.body.files-menu a.dropdown-item');
        $menuitems.addClass('hidden');

        $menuitems.filter('.transfer-pause,.transfer-play,.move-up,.move-down,.transfer-clear').removeClass('hidden');

        tclear = $menuitems.filter('.transfer-clear').contents('span').get(0) || {};
        tclear.textContent = l[103];

        if (target === null && (target = $('.transfer-table tr.ui-selected')).length > 1) {
            var ids = target.attrs('id');
            var finished = 0;
            var paused = 0;
            var started = false;

            ids.forEach(function(id) {
                file = GlobalProgress[id];
                if (!file) {
                    finished++;
                }
                else {
                    if (file.paused) {
                        paused++;
                    }
                    if (file.started) {
                        started = true;
                    }
                }
            });

            if (finished === ids.length) {
                $menuitems.addClass('hidden')
                    .filter('.transfer-clear').removeClass('hidden');
                tclear.textContent = l[7218];
            }
            else {
                if (started) {
                    $menuitems.filter('.move-up,.move-down').addClass('hidden');
                }
                if (paused === ids.length) {
                    $menuitems.filter('.transfer-pause').addClass('hidden');
                }

                var prev = target.first().prev();
                var next = target.last().next();

                if (prev.length === 0 || !prev.hasClass('transfer-queued')) {
                    $menuitems.filter('.move-up').addClass('hidden');
                }
                if (next.length === 0) {
                    $menuitems.filter('.move-down').addClass('hidden');
                }
            }
        }
        else if (!(file = GlobalProgress[$(target).attr('id')])) {
            /* no file, it is a finished operation */
            $menuitems.addClass('hidden')
                .filter('.transfer-clear').removeClass('hidden');
            tclear.textContent = l[7218];
        }
        else {
            if (file.started) {
                $menuitems.filter('.move-up,.move-down').addClass('hidden');
            }
            if (file.paused) {
                $menuitems.filter('.transfer-pause').addClass('hidden');
            }
            else {
                $menuitems.filter('.transfer-play').addClass('hidden');
            }

            if (!target.prev().length || !target.prev().hasClass('transfer-queued')) {
                $menuitems.filter('.move-up').addClass('hidden');
            }
            if (target.next().length === 0) {
                $menuitems.filter('.move-down').addClass('hidden');
            }
        }

        // XXX: Hide context-menu's menu-up/down items for now to check if that's the
        // origin of some problems, users can still use the new d&d logic to move transfers
        $menuitems.filter('.move-up,.move-down').addClass('hidden');

        var parent = $menuitems.parent();
        parent
            .children('hr').addClass('hidden').end()
            .children('hr.pause').removeClass('hidden').end();

        if (parent.height() < 56) {
            parent.find('hr.pause').addClass('hidden');
        }
    };


    $.transferHeader = function(tfse) {
        tfse = tfse || M.getTransferElements();
        if (!tfse) {
            return;
        }
        const {domTableEmptyTxt, domScrollingTable, domTable} = tfse;
        tfse = undefined;

        // Show/Hide header if there is no items in transfer list
        if (domTable.querySelector('tr')) {
            domTableEmptyTxt.classList.add('hidden');
            domScrollingTable.style.display = '';
        }
        else {
            domTableEmptyTxt.classList.remove('hidden');
            domScrollingTable.style.display = 'none';
        }

        $(domScrollingTable).rebind('click.tst contextmenu.tst', function(e) {
            if (!$(e.target).closest('.transfer-table').length) {
                $('.ui-selected', domTable).removeClass('ui-selected');
            }
        });

        var $tmp = $('.grid-url-arrow, .clear-transfer-icon, .link-transfer-status', domTable);
        $tmp.rebind('click', function(e) {
            var target = $(this).closest('tr');
            e.preventDefault();
            e.stopPropagation(); // do not treat it as a regular click on the file
            $('tr', domTable).removeClass('ui-selected');

            if ($(this).hasClass('link-transfer-status')) {

                var $trs = $(this).closest('tr');

                if ($(this).hasClass('transfer-play')) {
                    if ($trs.filter('.transfer-upload').length && ulmanager.ulOverStorageQuota) {
                        ulmanager.ulShowOverStorageQuotaDialog();
                        return;
                    }

                    if (dlmanager.isOverQuota) {
                        dlmanager.showOverQuotaDialog();
                        return;
                    }
                }

                var ids = $trs.attrs('id');

                if ($(this).hasClass('transfer-play')) {
                    ids.map(fm_tfsresume);
                }
                else {
                    ids.filter(id => !String(id).startsWith('LOCKed_')).map(fm_tfspause);
                }
            }
            else {
                if (!target.hasClass('.transfer-completed')) {
                    var toabort = target.attr('id');
                    dlmanager.abort(toabort);
                    ulmanager.abort(toabort);
                }
                target.fadeOut(function() {
                    $(this).remove();
                    tfsheadupdate({c: target.attr('id')});
                    mega.tpw.removeRow(target.attr('id'));
                    $.clearTransferPanel();
                });
            }

            return false;
        });

        $tmp = $('tr', domTable);
        $tmp.rebind('dblclick', function() {
            if ($(this).hasClass('transfer-completed')) {
                var id = String($(this).attr('id'));
                if (id[0] === 'd') {
                    id = id.split('_').pop();
                }
                else if (id[0] === 'u') {
                    id = String(ulmanager.ulIDToNode[id]);
                }
                var path = M.getPath(id);
                if (path.length > 1) {
                    M.openFolder(path[1], true)
                        .always(function() {
                            $.selected = [id];
                            reselect(1);
                        });
                }
            }
            return false;
        });

        $tmp.rebind('click contextmenu', function(e) {
            if (e.type === 'contextmenu') {
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    $('.ui-selected', domTable).removeClass('ui-selected');
                }
                $(this).addClass('ui-selected dragover');
                transferPanelContextMenu(null);
                return !!M.contextMenuUI(e);
            }
            else {
                var domNode = domTable.querySelector('tr');
                $.hideContextMenu();
                if (e.shiftKey && domNode) {
                    var start = domNode;
                    var end = this;
                    if ($.TgridLastSelected && $($.TgridLastSelected).hasClass('ui-selected')) {
                        start = $.TgridLastSelected;
                    }
                    if ($(start).index() > $(end).index()) {
                        end = start;
                        start = this;
                    }
                    $('.ui-selected', domTable).removeClass('ui-selected');
                    $([start, end]).addClass('ui-selected');
                    $(start).nextUntil($(end)).each(function(i, e) {
                        $(e).addClass('ui-selected');
                    });
                }
                else if (!e.ctrlKey && !e.metaKey) {
                    $('.ui-selected', domTable).removeClass('ui-selected');
                    $(this).addClass('ui-selected');
                    $.TgridLastSelected = this;
                }
                else {
                    if ($(this).hasClass("ui-selected")) {
                        $(this).removeClass("ui-selected");
                    }
                    else {
                        $(this).addClass("ui-selected");
                        $.TgridLastSelected = this;
                    }
                }
            }

            return false;
        });
        $tmp = undefined;

        delay('tfs-ps-update', function() {
            // XXX: This update will fire ps-y-reach-end, set a flag to ignore it...

            $.isTfsPsUpdate = true;
            Ps.update(domScrollingTable);

            onIdle(function() {
                $.isTfsPsUpdate = false;
            });
        });
    };

    $.transferClose = function() {
        $('.nw-fm-left-icon.transfers').removeClass('active');
        $('#fmholder').removeClass('transfer-panel-opened');
    };

    $.transferOpen = function(force) {
        if (force || !$('.nw-fm-left-icon.transfers').hasClass('active')) {
            $('.nw-fm-left-icon').removeClass('active');
            $('.nw-fm-left-icon.transfers').addClass('active');
            $('#fmholder').addClass('transfer-panel-opened');
            var domScrollingTable = M.getTransferElements().domScrollingTable;
            if (!domScrollingTable.classList.contains('ps')) {
                Ps.initialize(domScrollingTable);
            }
            fm_tfsupdate(); // this will call $.transferHeader();
        }
    };

    $.clearTransferPanel = function() {
        var obj = M.getTransferElements();
        if (obj.domTable && !obj.domTable.querySelector('tr')) {
            $('.transfer-clear-all-icon').addClass('disabled');
            $('.transfer-pause-icon').addClass('disabled');
            $('.transfer-clear-completed').addClass('disabled');
            obj.domTableEmptyTxt.classList.remove('hidden');
            obj.domUploadBlock.classList.add('hidden');
            obj.domDownloadBlock.classList.add('hidden');
            obj.domUploadBlock.classList.remove('overquota', 'error');
            obj.domDownloadBlock.classList.remove('overquota', 'error');
            obj.domUploadProgressText.textContent = l[1418];
            obj.domDownloadProgressText.textContent = l[1418];
            $('.nw-fm-left-icon.transfers').removeClass('transfering').find('p').removeAttr('style');
        }

        if (M.currentdirid === 'transfers') {
            fm_tfsupdate();
            $.tresizer();
        }
    };

    $.removeTransferItems = function($trs) {
        var type = null;
        if (!$trs) {
            $trs = $('.transfer-table tr.transfer-completed');
            type = mega.tpw.DONE;
        }
        var $len = $trs.length;
        const ids = [];
        for (let i = 0; i < $trs.length; i++) {
            ids.push($trs.eq(i).prop('id'));
        }
        if ($len && $len < 100) {
            $trs.fadeOut(function() {
                $(this).remove();
                if (!--$len) {
                    $.clearTransferPanel();
                }
            });
        }
        else {
            $trs.remove();
            Soon($.clearTransferPanel);
        }
        tfsheadupdate({c: ids});
        mega.tpw.clearRows(type);
    };
    bindTransfersMassEvents('.fm-transfers-header');

    $('.transfer-clear-completed').rebind('click', function() {
        if (!$(this).hasClass('disabled')) {
            $.removeTransferItems();
        }
    });
};

/**
 * Depending the viewmode this fires either addIconUI or addGridUI, plus addTreeUI
 * @param {Boolean} aNoTreeUpdate Omit the call to addTreeUI
 */
FileManager.prototype.addViewUI = function(aNoTreeUpdate, refresh) {
    if (this.viewmode) {
        this.addIconUI(undefined, refresh);
    }
    else {
        this.addGridUI(refresh);
    }

    if (!aNoTreeUpdate) {
        this.addTreeUI();
    }
};

FileManager.prototype.addIconUI = function(aQuiet, refresh) {
    "use strict";

    if (this.chat) {
        return;
    }
    if (d) {
        console.time('iconUI');
    }

    // #file-request change column title for public link page
    let dateLabel = l[17445];
    switch (page) {
        case 'fm/public-links':
            dateLabel = l[20694];
            break;
        case 'fm/file-requests':
            dateLabel = l.file_request_page_label_request_created;
            break;
    }

    if (dateLabel) {
        $('.files-menu.context .dropdown-item.sort-timeAd span').safeHTML(dateLabel);
    }

    $('.fm-files-view-icon').removeClass('active').filter('.block-view').addClass('active');
    $('.shared-grid-view').addClass('hidden');
    $('.out-shared-grid-view').addClass('hidden');
    $('.files-grid-view.fm').addClass('hidden');
    $('.fm-blocks-view.fm').addClass('hidden');

    if (this.currentdirid === 'shares') {
        $('.shared-blocks-view').removeClass('hidden');
        initPerfectScrollbar($('.shared-blocks-scrolling', '.shared-blocks-view'));
    }
    else if (this.currentdirid === 'out-shares') {
        $('.out-shared-blocks-view').removeClass('hidden');
        initPerfectScrollbar($('.out-shared-blocks-scrolling', '.out-shared-blocks-view'));
    }
    else if (this.currentrootid === 'shares' && !this.v.length) {
        const viewModeClass = (M.viewmode ? '.fm-blocks-view' : '.files-grid-view') + '.fm.shared-folder-content';

        $(viewModeClass).removeClass('hidden');
        initPerfectScrollbar($(viewModeClass));
    }
    // user management ui update is handled in Business Account classes.
    else if (this.v.length && !M.isGalleryPage()) {

        $('.fm-blocks-view.fm', '.fmholder')
            .removeClass('hidden out-shares-view public-links-view file-requests-view s4-view');

        if (this.currentCustomView) {
            $('.fm-blocks-view.fm', '.fmholder').addClass(`${this.currentCustomView.type}-view`);
        }

        if (!aQuiet) {
            initPerfectScrollbar($('.file-block-scrolling', '.fm-blocks-view.fm'));
        }
    }

    $('.fm-blocks-view, .fm-empty-cloud, .fm-empty-folder,' +
        '.shared-blocks-view, .out-shared-blocks-view, .fm-empty-s4-bucket')
        .rebind('contextmenu.fm', function(e) {
            // Remove context menu option from filtered view and media discovery view
            if (page === "fm/links" || M.gallery) {
                return false;
            }
            $(this).find('.data-block-view').removeClass('ui-selected');
            // is this required? don't we have a support for a multi-selection context menu?
            if (selectionManager) {
                selectionManager.clear_selection();
            }
            $.selected = [];
            $.hideTopMenu();
            return !!M.contextMenuUI(e, 2);
        });

    $('.files-menu.context .submenu.sorting .dropdown-item.sort-grid-item').rebind('click', function(e) {
        var sortType;
        var $me = $(this);

        if ($me.hasClass('sort-size')) {
            sortType = 'size';
        }
        else if ($me.hasClass('sort-name')) {
            sortType = 'name';
        }
        else if ($me.hasClass('sort-label')) {
            sortType = 'label';
        }
        else if ($me.hasClass('sort-type')) {
            sortType = 'type';
        }
        else if ($me.hasClass('sort-timeAd')) {
            sortType = 'ts';
        }
        else if ($me.hasClass('sort-timeMd')) {
            sortType = 'mtime';
        }
        else if ($me.hasClass('sort-fav')) {
            sortType = 'fav';
        }
        else if ($me.hasClass('sort-owner')) {
            sortType = 'owner';
        }
        else if ($me.hasClass('sort-access')) {
            sortType = 'access';
        }
        else if ($me.hasClass('sort-sharedwith')) {
            sortType = 'sharedwith';
        }
        else if ($me.hasClass('sort-sharecreated')) {
            sortType = 'date';
        }
        else if ($me.hasClass('sort-versions')) {
            sortType = 'versions';
        }
        else if ($me.hasClass('sort-playtime')) {
            sortType = 'playtime';
        }

        var classToAdd = 'selected';
        var iconClassToAdd = 'icon-up';
        var sortDir = 1;

        if ($me.hasClass('selected') && !$me.hasClass('inverted') ) {
            classToAdd += ' inverted';
            iconClassToAdd = 'icon-down';
            sortDir = -1;
        }

        $('.files-menu.context .submenu.sorting .dropdown-item.sort-grid-item').removeClass('selected inverted');
        $('i.sprite-fm-mono', $me).removeClass('icon-up icon-down').addClass(iconClassToAdd);
        $me.addClass(classToAdd);

        M.doSort(sortType, sortDir);
        M.renderMain();
    });

    if (this.currentdirid === 'shares') {
        $.selectddUIgrid = '.shared-blocks-scrolling';
        $.selectddUIitem = 'a';
    }
    else if (this.currentdirid === 'out-shares') {
        $.selectddUIgrid = '.out-shared-blocks-scrolling';
        $.selectddUIitem = 'a';
    }
    else if (M.isGalleryPage()) {
        $.selectddUIgrid = '.gallery-view';
    }
    else {
        $.selectddUIgrid = '.file-block-scrolling';
        $.selectddUIitem = 'a';
    }
    this.addSelectDragDropUI(refresh);
    if (d) {
        console.timeEnd('iconUI');
    }

};

FileManager.prototype.addGridUI = function(refresh) {
    "use strict";

    if (this.chat || this.gallery) {
        return;
    }
    if (d) {
        console.time('gridUI');
    }

    // Change title for Public link page
    let dateLabel = l[17445];
    switch (page) {
        case 'fm/public-links':
            dateLabel = l[20694];
            break;
        case 'fm/file-requests':
            dateLabel = l.file_request_page_label_request_created;
            break;
    }

    if (dateLabel) {
        $('.fm .grid-table thead .ts').text(dateLabel);
        $('.fm .grid-table thead .date').text(dateLabel);
        $('.dropdown.body.files-menu .dropdown-item.visible-col-select[megatype="timeAd"] span').text(dateLabel);
    }

    // $.gridDragging=false;
    $.gridLastSelected = false;
    $('.fm-files-view-icon').removeClass('active').filter('.listing-view').addClass('active');

    $.gridHeader = function() {
        if (folderlink) {
            M.columnsWidth.cloud.versions.viewed = false;
            M.columnsWidth.cloud.versions.disabled = true;
            M.columnsWidth.cloud.fav.viewed = false;
            M.columnsWidth.cloud.fav.disabled = true;
            M.columnsWidth.cloud.label.viewed = false;
            M.columnsWidth.cloud.label.disabled = true;
            M.columnsWidth.cloud.accessCtrl.viewed = false;
            M.columnsWidth.cloud.accessCtrl.disabled = true;
        }
        else {
            if (M.columnsWidth.cloud.fav.disabled) {
                // came from folder-link
                M.columnsWidth.cloud.fav.viewed = true;
            }
            M.columnsWidth.cloud.versions.disabled = false;
            M.columnsWidth.cloud.fav.disabled = false;
            M.columnsWidth.cloud.label.disabled = false;
            M.columnsWidth.cloud.type.disabled = false;

            // if we have FM configuration
            var storedColumnsPreferences = mega.config.get('fmColPrefs');
            if (storedColumnsPreferences !== undefined) {
                var prefs = getFMColPrefs(storedColumnsPreferences);
                const cgMenu = new Set(['fav', 'fname', 'size', 'type', 'timeAd', 'extras', 'accessCtrl', 'playtime']);
                for (var colPref in prefs) {
                    if (Object.prototype.hasOwnProperty.call(prefs, colPref)) {
                        M.columnsWidth.cloud[colPref].viewed =
                            prefs[colPref] > 0;
                    }
                    if (cgMenu.has(colPref)) {
                        M.columnsWidth.cloud[colPref].disabled = false;
                    }
                }
            }
            else {
                // restore default columns (to show/hide columns)
                const defaultColumnShow = new Set(['fav', 'fname', 'size', 'type', 'timeAd', 'extras', 'accessCtrl']);
                const defaultColumnHidden = new Set(['label', 'timeMd', 'versions', 'playtime', 'fileLoc']);
                for (const col in M.columnsWidth.cloud) {
                    if (defaultColumnShow.has(col)) {
                        M.columnsWidth.cloud[col].viewed = true;
                        M.columnsWidth.cloud[col].disabled = false;
                    }
                    else if (defaultColumnHidden.has(col)) {
                        M.columnsWidth.cloud[col].viewed = false;
                        if (col === 'playtime') {
                            M.columnsWidth.cloud[col].disabled = false;
                        }
                    }
                }
            }

            if (String(M.currentdirid).startsWith('search')) {
                // modified column to show for /search (Added link location dir)
                const searchCol = new Set(['fav', 'fname', 'size', 'timeMd', 'fileLoc', 'extras']);
                for (const col in M.columnsWidth.cloud) {
                    if (searchCol.has(col)) {
                        M.columnsWidth.cloud[col].viewed = true;
                        M.columnsWidth.cloud[col].disabled = false;
                    }
                    else {
                        M.columnsWidth.cloud[col].viewed = false;
                        M.columnsWidth.cloud[col].disabled = true;
                    }
                }
            }

            if (
                M.currentrootid === M.RubbishID
                || M.currentrootid === 'shares'
            ) {
                M.columnsWidth.cloud.fav.disabled = true;
                M.columnsWidth.cloud.fav.viewed = false;
            }

            if (M.currentrootid === 's4' && M.d[M.currentdirid.split('/').pop()]) {
                M.columnsWidth.cloud.accessCtrl.viewed = true;
                M.columnsWidth.cloud.accessCtrl.disabled = false;
            }
            else {
                M.columnsWidth.cloud.accessCtrl.viewed = false;
                M.columnsWidth.cloud.accessCtrl.disabled = true;
            }
        }

        if (M && M.columnsWidth && M.columnsWidth.cloud) {

            M.columnsWidth.updateColumnStyle();

            if (M.megaRender && M.megaRender.megaList) {
                if (!M.megaRender.megaList._scrollIsInitialized) {
                    M.megaRender.megaList.resized();
                }
                else {
                    M.megaRender.megaList.scrollUpdate();
                }
            }
        }
    };

    $('.fm-blocks-view.fm').addClass('hidden');
    $('.fm-chat-block').addClass('hidden');
    $('.shared-blocks-view').addClass('hidden');
    $('.shared-grid-view').addClass('hidden');
    $('.out-shared-blocks-view').addClass('hidden');
    $('.out-shared-grid-view').addClass('hidden');
    $('.files-grid-view.fm').addClass('hidden');

    if (this.currentdirid === 'shares') {
        $('.shared-grid-view').removeClass('hidden');
        initPerfectScrollbar($('.grid-scrolling-table', '.shared-grid-view'));
    }
    else if (this.currentdirid === 'out-shares') {
        $('.out-shared-grid-view').removeClass('hidden');
        initPerfectScrollbar($('.grid-scrolling-table', '.out-shared-grid-view'));
    }
    else if (this.currentrootid === 'shares' && !this.v.length) {
        const viewModeClass = (M.viewmode ? '.fm-blocks-view' : '.files-grid-view') + '.fm.shared-folder-content';

        $(viewModeClass).removeClass('hidden');
        initPerfectScrollbar($(viewModeClass, '.shared-details-block'));
    }
    else if (this.v.length) {
        $('.files-grid-view.fm', '.fmholder').removeClass('hidden');
        $('.files-grid-view.fm', '.fmholder')
            .removeClass('out-shares-view public-links-view file-requests-view');

        if (this.currentCustomView) {
            if (M.isGalleryPage() || M.isAlbumsPage()) {
                $('.files-grid-view.fm', '.fmholder').addClass('hidden');
            }
            else {
                $('.files-grid-view.fm', '.fmholder')
                    .addClass(`${this.currentCustomView.type}-view`);
            }
        }
        else {
            $('.files-grid-view.fm', '.fmholder')
                .removeClass('out-shares-view public-links-view s4-view');
        }

        $.gridHeader();

        // if there is any node that already rendered before getting correct value, update with resize handler.
        fm_resize_handler();
    }

    $('.grid-url-arrow').show();
    $('.grid-url-header').text('');

    $('.files-grid-view.fm .grid-scrolling-table,.files-grid-view.fm .file-block-scrolling,.fm-empty-cloud,' +
        '.fm-empty-folder,.fm.shared-folder-content, .fm-empty-s4-bucket').rebind('contextmenu.fm', e => {
        // Remove context menu option from filtered view and media discovery view
        if (page === "fm/links" && page === "fm/faves" || M.gallery) {
            return false;
        }
            $('.fm-blocks-view .data-block-view').removeClass('ui-selected');
            if (selectionManager) {
                selectionManager.clear_selection();
            }
            $.selected = [];
            $.hideTopMenu();
            return !!M.contextMenuUI(e, 2);
    });

    // enable add star on first column click (make favorite)
    $('.grid-table.shared-with-me tr td:first-child').add('.grid-table.out-shares tr td:first-child')
        .add('.grid-table.fm tr td:nth-child(2)').rebind('click', function() {
            $.hideContextMenu();
            if (M.isInvalidUserStatus()) {
                return;
            }
            var id = $(this).parent().attr('id');
            var newFavState = Number(!M.isFavourite(id));

            // Handling favourites is allowed for full permissions shares only
            if (M.getNodeRights(id) > 1) {
                M.favourite(id, newFavState);
                return false;
            }
        });

    $('.grid-table .arrow').rebind('click', function(e) {
        // this grid-table is used in the chat - in Archived chats. It won't work there, so - skip doing anything.
        if (M.chat) {
            return;
        }
        var cls = $(this).attr('class');
        var dir = 1;

        // Excludes colour sorting dialog for contacts
        if (cls.includes('name') && !pfid) {
            return M.labelSortMenuUI(e);
        }
        else {
            M.resetLabelSortMenuUI();

            if (cls && cls.indexOf('desc') > -1) {
                dir = -1;
            }
            for (var sortBy in M.sortRules) {
                if (cls.indexOf(sortBy) !== -1) {

                    var dateColumns = ['ts', 'mtime', 'date'];

                    if (dir !== -1 && dateColumns.indexOf(sortBy) !== -1) {
                        if (cls.indexOf('asc') === -1) {
                            dir = -1;
                        }
                    }

                    M.doSort(sortBy, dir);
                    M.renderMain();

                    break;
                }
            }
        }
    });

    var showColumnsContextMenu = function(e) {
        var notAllowedTabs = ['shares', 'out-shares'];
        if (notAllowedTabs.indexOf(M.currentdirid) !== -1) {
            return false;
        }
        M.contextMenuUI(e, 7);
        return false;
    };

    $('.grid-table th').rebind('contextmenu', e => showColumnsContextMenu(e));

    $('.column-settings.overlap').rebind('click',
        function(e) {
            var $me = $(this);
            if ($me.hasClass('c-opened')) {
                $.hideContextMenu();
                return false;
            }
            showColumnsContextMenu(e);
            $me.addClass('c-opened');
            return false;
        });

    $('.files-menu.context .dropdown-item.visible-col-select').rebind('click', function(e) {
        var $me = $(this);
        if ($me.hasClass('notactive')) {
            return false;
        }

        var targetCol = $me.attr('megatype');

        if ($me.attr('isviewed')) {
            $me.removeAttr('isviewed');
            $('i', $me).removeClass('icon-check').addClass('icon-add');
            M.columnsWidth.cloud[targetCol].viewed = false;
        }
        else {
            $me.attr('isviewed', 'y');
            $('i', $me).removeClass('icon-add').addClass('icon-check');
            M.columnsWidth.cloud[targetCol].viewed = true;
        }

        M.columnsWidth.cloud.fname.lastOffsetWidth = null;
        M.columnsWidth.updateColumnStyle();

        var columnPreferences = mega.config.get('fmColPrefs');
        if (columnPreferences === undefined) {
            columnPreferences = 108; // default
        }
        var colConfigNb = getNumberColPrefs(targetCol);
        if (colConfigNb) {
            if (M.columnsWidth.cloud[targetCol].viewed) {
                columnPreferences |= colConfigNb;
            }
            else {
                columnPreferences &= ~colConfigNb;
            }
        }
        mega.config.set('fmColPrefs', columnPreferences);

        if (M.megaRender && M.megaRender.megaList) {
            if (!M.megaRender.megaList._scrollIsInitialized) {
                M.megaRender.megaList.resized();
            }
            else {
                M.megaRender.megaList.scrollUpdate();
            }
        }
        $.hideContextMenu && $.hideContextMenu();
        return false;
    });


    $('.grid-first-th').rebind('click', function() {
        var $el = $(this).children().first();
        var c = $el.attr('class');
        var d = 1;

        if (c && (c.indexOf('desc') > -1)) {
            d = -1;
            $el.removeClass('desc').addClass('asc');
        }
        else {
            $el.removeClass('asc').addClass('desc');
        }

        var fav = function(el) {
            return el.fav;
        };

        if (M.v.some(fav)) {
            for (var f in M.sortRules) {
                if (c.indexOf(f) !== -1) {
                    M.doSort(f, d);
                    M.renderMain();
                    break;
                }
            }
        }
    });

    $('.grid-table .grid-file-location').rebind('click.fileLocation', (e) => {
        const h = $(e.target).closest('tr').attr('id');
        const node = M.getNodeByHandle(h);

        // Incoming Shares section if shared folder doesn't have parent
        const target = node.su && (!node.p || !M.d[node.p]) ? 'shares' : node.p;
        M.openFolder(target).then(() => {
            selectionManager.add_to_selection(node.h, true);
        });
    });

    if (this.currentdirid === 'shares') {
        $.selectddUIgrid = '.shared-grid-view .grid-scrolling-table';
    }
    else if (this.currentdirid === 'out-shares') {
        $.selectddUIgrid = '.out-shared-grid-view .grid-scrolling-table';
    }
    else if (M.isGalleryPage()) {
        $.selectddUIgrid = '.gallery-view';
    }
    else {
        $.selectddUIgrid = '.files-grid-view.fm .grid-scrolling-table';
    }

    $.selectddUIitem = 'tbody tr';
    this.addSelectDragDropUIDelayed(refresh);

    if (d) {
        console.timeEnd('gridUI');
    }
};

FileManager.prototype.addGridUIDelayed = function(refresh) {
    delay('GridUI', function() {
        M.addGridUI(refresh);
    }, 20);
};

// Todo Enhance this or probably make this into MegaInput?
FileManager.prototype.initMegaSwitchUI = function() {

    'use strict';

    const $switches = $('.mega-switch');

    const _setHandleIcon = ($handle, on) => {

        if (on) {
            $handle.removeClass('icon-minimise-after');
            $handle.addClass('icon-check-after');
        }
        else {
            $handle.addClass('icon-minimise-after');
            $handle.removeClass('icon-check-after');
        }
    };

    $switches.attr({
        'role': 'switch',
        'aria-checked': function() {

            const on = this.classList.contains('toggle-on');
            const $handle = $('.mega-feature-switch', this).addClass('sprite-fm-mono-after');

            _setHandleIcon($handle, on);

            return on;
        },
        'tabindex': '0',
    });

    $(document).rebind('update.accessibility', '.mega-switch', e => {

        const on = e.target.classList.contains('toggle-on');

        e.target.setAttribute('aria-checked', on);

        _setHandleIcon($(e.target.querySelector('.mega-feature-switch')).addClass('sprite-fm-mono-after'), on);
    });
};

FileManager.prototype.getDDhelper = function getDDhelper() {
    'use strict';

    var id = '#fmholder';
    if (page === 'start') {
        id = '#startholder';
    }
    $('.dragger-block').remove();
    $(id).append(
        '<div class="dragger-block drag" id="draghelper">' +
        '<div class="dragger-content"></div>' +
        '<div class="dragger-files-number">1</div>' +
        '</div>'
    );
    $('.dragger-block').show();
    $('.dragger-files-number').hide();
    return $('.dragger-block')[0];
};

FileManager.prototype.addSelectDragDropUI = function(refresh) {
    "use strict";

    if (this.currentdirid &&
        (this.currentdirid.substr(0, 7) === 'account' || M.isGalleryPage())) {
        return false;
    }

    if (d) {
        console.time('selectddUI');
    }

    var mainSel = $.selectddUIgrid + ' ' + $.selectddUIitem;
    var dropSel = $.selectddUIgrid + ' ' + $.selectddUIitem + '.folder';

    $(dropSel).droppable({
        tolerance: 'pointer',
        drop: function(e, ui) {
            $.doDD(e, ui, 'drop', 0);
        },
        over: function(e, ui) {
            $.doDD(e, ui, 'over', 0);
        },
        out: function(e, ui) {
            $.doDD(e, ui, 'out', 0);
        }
    });

    if ($.gridDragging) {
        $('body').addClass('dragging ' + ($.draggingClass || ''));
    }

    var $ddUIitem = $(mainSel);
    var $ddUIgrid = $($.selectddUIgrid);
    $ddUIitem.draggable({
        start: function(e, u) {
            if (d) {
                console.log('draggable.start');
            }
            $.hideContextMenu(e);
            $.gridDragging = true;
            $('body').addClass('dragging');
            if (!$(this).hasClass('ui-selected')) {
                selectionManager.resetTo($(this).attr('id'));
            }
            var max = ($(window).height() - 96) / 24;
            var html = [];
            $.selected.forEach(function(id, i) {
                var n = M.d[id];
                if (n) {
                    if (max > i) {
                        html.push(
                            '<div class="item-type-icon icon-' + fileIcon(n) + '-24"></div>' +
                            '<div class="tranfer-filetype-txt dragger-entry">' +
                            escapeHTML(n.name) + '</div>'
                        );
                    }
                }
            });
            if ($.selected.length > max) {
                $('.dragger-files-number').text($.selected.length);
                $('.dragger-files-number').show();
            }
            $('#draghelper .dragger-content').html(html.join(""));
            $.draggerHeight = $('#draghelper .dragger-content').outerHeight();
            $.draggerWidth = $('#draghelper .dragger-content').outerWidth();
            $.draggerOrigin = M.currentdirid;
            $.dragSelected = clone($.selected);
        },
        drag: function(e, ui) {
            if (ui.position.top + $.draggerHeight - 28 > $(window).height()) {
                ui.position.top = $(window).height() - $.draggerHeight + 26;
            }
            if (ui.position.left + $.draggerWidth - 58 > $(window).width()) {
                ui.position.left = $(window).width() - $.draggerWidth + 56;
            }
        },
        refreshPositions: true,
        containment: 'document',
        scroll: false,
        distance: 10,
        revertDuration: 200,
        revert: true,
        cursorAt: {right: 90, bottom: 56},
        helper: function(e, ui) {
            $(this).draggable("option", "containment", [72, 42, $(window).width(), $(window).height()]);
            return M.getDDhelper();
        },
        stop: function(event) {
            if (d) {
                console.log('draggable.stop');
            }
            $.gridDragging = $.draggingClass = false;

            $('body').removeClass('dragging').removeClassWith("dndc-");
            var origin = $.draggerOrigin;
            setTimeout(function __onDragStop() {
                M.onTreeUIOpen(M.currentdirid, false, true);
            }, 200);
            delete $.dragSelected;
        }
    });

    $ddUIgrid.selectable({
        filter: $.selectddUIitem,
        cancel: '.ps__rail-y, .ps__rail-x, thead',
        start: e => {
            $.hideContextMenu(e);
            $.hideTopMenu();
            $.selecting = true;
        },
        stop: () => {
            M.renderSearchBreadcrumbs();
            $.selecting = false;

            // On drag stop and if the side Info panel is visible, update the information in it
            mega.ui.mInfoPanel.reRenderIfVisible($.selected);
        },
        appendTo: $.selectddUIgrid
    });

    // Since selectablecreate is triggered only on first creation of the selectable widget, we need to find a way
    // to notify any code (selectionManager) that it can now hook selectable events after the widget is created
    $ddUIgrid.trigger('selectablereinitialized');

    const contextMenuHandler = function(e) {
        $.hideContextMenu(e);

        if (e.shiftKey) {
            selectionManager.shift_select_to($(this).attr('id'), false, true, true);
        }
        else if (e.ctrlKey !== false || e.metaKey !== false) {
            selectionManager.add_to_selection($(this).attr('id'));
            $.gridLastSelected = this;
        }
        else {
            var id = $(this).attr('id');

            if (selectionManager.selected_list.indexOf(id) === -1) {
                selectionManager.resetTo(id);
            }
            else {
                selectionManager.add_to_selection(id);
                $.gridLastSelected = this;
            }
        }

        M.renderSearchBreadcrumbs();
        $.hideTopMenu();

        return !!M.contextMenuUI(e, 1);
    };

    if (!$ddUIgrid.hasClass('ddinit')) {

        $ddUIgrid.addClass('ddinit').rebind('click.filemanager', $.selectddUIitem, function(e, smEvent) {

            // This is triggered from Selection Manager
            if (smEvent) {
                e = smEvent;
            }

            if ($.gridDragging) {
                return false;
            }

            const $this = $(this);

            if (e.shiftKey) {
                selectionManager.shift_select_to($this.attr('id'), false, true, $.selected.length === 0);
            }
            else if (!e.ctrlKey && !e.metaKey) {

                $.gridLastSelected = this;

                selectionManager.clear_selection();
                selectionManager.add_to_selection($this.attr('id'), true);
            }
            else if ($this.hasClass("ui-selected")) {
                selectionManager.remove_from_selection($this.attr('id'), false);
            }
            else {
                $.gridLastSelected = this;
                selectionManager.add_to_selection($this.attr('id'));
            }
            M.renderSearchBreadcrumbs();
            $.hideContextMenu(e);

            if ($.hideTopMenu) {
                $.hideTopMenu();
            }

            // If the side Info panel is visible, update the information in it
            mega.ui.mInfoPanel.reRenderIfVisible($.selected);

            return false;
        });

        $ddUIgrid.rebind('contextmenu.filemanager', $.selectddUIitem, contextMenuHandler);

        $ddUIgrid.rebind('mousewheel.selectAndScroll', e => {

            if ($.selecting) {
                delay('selectAndScroll', () => {

                    $ddUIgrid = $($.selectddUIgrid);

                    $ddUIgrid.selectable('refresh');
                    $ddUIgrid.selectable('triggerMouseMove', e);
                }, 50);
            }
        });
    }

    // Open folder/file in filemanager
    let tappedItemId = '';
    $ddUIitem.rebind('dblclick.openTarget touchend.tabletOpenTarget', (e) => {
        let h = $(e.currentTarget).attr('id');
        const n = M.getNodeByHandle(h);

        if (!n) {
            return false;
        }
        else if (M.getNodeShare(n).down && n.t !== 1) {
            // Prevent to preview any kind of taken down files
            contextMenuHandler.call(e.currentTarget, e);
            return false;
        }

        // Emulate dblclick on tablet devices
        if (e.type === 'touchend' && tappedItemId !== h) {

            tappedItemId = h;
            delay('ddUIitem:touchend.tot', () => {
                tappedItemId = '';
            }, 600);

            return false;
        }

        if (n.t) {
            if (e.ctrlKey) {
                $.ofShowNoFolders = true;
            }
            $('.top-context-menu').hide();
            if (
                M.currentrootid === 'out-shares' ||
                M.currentrootid === 'public-links' ||
                M.currentrootid === 'file-requests'
            ) {
                h = M.currentrootid + '/' + h;
            }
            else if (M.dyh) {
                h = M.dyh('folder-id', h);
            }
            M.openFolder(h);
        }
        else if (is_image2(n) || is_video(n)) {
            if (is_video(n)) {
                $.autoplay = h;
            }

            // Close node Info panel as not needed immediately after opening Preview
            mega.ui.mInfoPanel.closeIfOpen();

            slideshow(h);
        }
        else if (is_text(n)) {
            $.selected = [h];
            // there's no jquery parent for this container.
            // eslint-disable-next-line local-rules/jquery-scopes
            $('.dropdown.body.context .dropdown-item.edit-file-item').trigger('click');
        }
        else if (M.getNodeRoot(n.h) === M.RubbishID) {
            propertiesDialog();
        }
        else {
            M.addDownload([h]);
        }
    });

    if (!refresh) {
        $.tresizer();
    }

    if (d) {
        console.timeEnd('selectddUI');
    }

    $ddUIitem = $ddUIgrid = undefined;
};

FileManager.prototype.addSelectDragDropUIDelayed = function(refresh) {
    delay('selectddUI', function() {
        M.addSelectDragDropUI(refresh);
    });
};

FileManager.prototype.onSectionUIOpen = function(id) {
    "use strict";

    var tmpId;
    var $fmholder = $('#fmholder', 'body');
    const isAlbums = M.isAlbumsPage();

    if (d) {
        console.group('sectionUIOpen', id, folderlink);
        console.time('sectionUIOpen');
    }
    if ($.hideContextMenu) {
        $.hideContextMenu();
    }

    // Close node Info panel if currently open as it's not applicable when switching to these areas
    if (id === 'account' || id === 'dashboard' || id === 'conversations'
        || id === 'user-management' || id === 'transfers') {

        if (mega.ui.mInfoPanel) {
            mega.ui.mInfoPanel.closeIfOpen();
        }

        // Hide top menus
        if (id === 'account' || id === 'dashboard') {
            $.hideTopMenu();
        }
    }

    $('.nw-fm-left-icon', $fmholder).removeClass('active');

    if (u_type === 3 || window.is_eplusplus) {
        $('.nw-fm-left-icon.conversations', $fmholder).removeClass('hidden');
    }
    else {
        $('.nw-fm-left-icon.conversations', $fmholder).addClass('hidden');
    }

    // View or hide left icon for business account, confirmed and paid.
    if (u_attr && u_attr.b && u_attr.b.m && (u_attr.b.s === 1 || u_attr.b.s === 2) && u_privk) {
        $('.nw-fm-left-icon.user-management', $fmholder).removeClass('hidden');
    }
    else {
        $('.nw-fm-left-icon.user-management', $fmholder).addClass('hidden');
    }

    switch (id) {
        case 'opc':
        case 'ipc':
        case 'recents':
        case 'search':
        case 'shared-with-me':
        case 'out-shares':
        case 'public-links':
        case 'backups':
        case 'rubbish-bin':
        case 's4':
        case 'file-requests':
            tmpId = 'cloud-drive';
            break;
        case 'devices':
            tmpId = 'backup-center';
            break;
        case 'affiliate':
            tmpId = 'dashboard';
            break;
        case 'albums':
            tmpId = 'gallery';
            break;
        case 'discovery':
            tmpId = 'cloud-drive';
            break;
        default:
            if (M.isDynPage(id)) {
                const {location} = M.dynContentLoader[id].options;
                if (location) {
                    tmpId = location;
                    break;
                }
            }
            tmpId = (mega.gallery.sections[id] || isAlbums) ? 'gallery' : id;
    }

    const fmLeftIconName = String(tmpId).replace(/[^\w-]/g, '');
    let fmLeftIcons = document.getElementsByClassName('nw-fm-left-icon');

    if (fmLeftIcons[fmLeftIconName] && !fmLeftIcons[fmLeftIconName].classList.contains('active')) {
        fmLeftIcons[fmLeftIconName].classList.add('active');
    }

    let contentPanels = document.getElementsByClassName('content-panel');

    for (let i = contentPanels.length; i--;) {

        if (contentPanels[i].classList.contains(fmLeftIconName)) {

            if (!contentPanels[i].classList.contains('active')) {
                contentPanels[i].classList.add('active');
            }
        }
        else if (contentPanels[i].classList.contains('active')) {
            contentPanels[i].classList.remove('active');
        }
    }

    this.currentTreeType = M.treePanelType();

    $('.fm.fm-right-header, .fm-import-download-buttons, .gallery-tabs-bl', $fmholder).addClass('hidden');
    $('.fm-import-to-cloudrive, .fm-download-as-zip', $fmholder).off('click');

    $fmholder.removeClass('affiliate-program');
    $('.fm-main', $fmholder).removeClass('active-folder-link');
    $('.nw-fm-left-icons-panel .logo', $fmholder).addClass('hidden');
    $('.fm-products-nav', $fmholder).text('');
    $('.nw-fm-left-icon.folder-link', $fmholder).removeClass('active');

    // Prevent autofill prevent fake form to be submitted
    $('#search-fake-form-2', $fmholder).rebind('submit', function() {
        return false;
    });

    if (folderlink) {
        // XXX: isValidShareLink won't work properly when navigating from/to a folderlink
        /*if (!isValidShareLink()) {
         $('.fm-breadcrumbs.folder-link .right-arrow-bg').text('Invalid folder');
         } else*/
        if (id === 'cloud-drive' || id === 'transfers') {
            $('.nw-fm-left-icons-panel .logo', $fmholder).removeClass('hidden');
            $('.fm-main', $fmholder).addClass('active-folder-link');
            $('.fm-right-header', $fmholder).addClass('folder-link');

            var $prodNav = $('.fm-products-nav').text('');
            if (!u_type) {
                $prodNav.safeHTML(translate(pages['pagesmenu']));
                onIdle(function() {
                    clickURLs();
                    bottompage.initNavButtons($fmholder);
                });
            }

            // Remove import and download buttons from the search result.
            if (!String(M.currentdirid).startsWith('search')) {
                const $btnWrap = $('.fm-import-download-buttons', $fmholder).removeClass('hidden');

                megasync.isInstalled((err, is) => {

                    if (!err || is) {

                        $('.merge-mega-button', $btnWrap).removeClass('merge-mega-button');
                        $('.download-dropdown', $btnWrap).addClass('hidden');
                    }
                });

                $('.fm-import-to-cloudrive', $btnWrap).rebind('click', () => {
                    eventlog(pfcol ? 99831 : 99765);
                    // Import the current folder, could be the root or sub folder
                    M.importFolderLinkNodes([M.RootID]);
                });

                $('.fm-download-as-zip', $btnWrap).rebind('click', () => {

                    eventlog(pfcol ? 99954 : 99766);
                    // Download the current folder, could be the root or sub folder
                    M.addDownload([M.RootID], true);
                });

                $('.fm-megasync-download', $btnWrap).rebind('click', () => {

                    loadingDialog.show();
                    megasync.isInstalled((err, is) => {

                        loadingDialog.hide();

                        if (fmconfig.dlThroughMEGAsync && (!err || is)) {
                            $('.megasync-overlay').removeClass('downloading');
                            M.addDownload([M.RootID]);
                        }
                        else {
                            dlmanager.showMEGASyncOverlay();
                        }
                    });
                });
            }
        }
    }

    if (id !== 'conversations') {
        if (id === 'user-management') {
            $('.fm-right-header').addClass('hidden');
            $('.fm-right-header-user-management').removeClass('hidden');
            M.hideEmptyGrids();
        }
        else if (M.isGalleryPage(id) || isAlbums) {
            $('.fm-right-header').addClass('hidden');
            $('.fm-right-header-user-management').addClass('hidden');
        }
        else {
            $('.fm-right-header').removeClass('hidden');
            $('.fm-right-header-user-management').addClass('hidden');
        }

        $('.fm-chat-block').addClass('hidden');
    }

    if (
        id !== 'cloud-drive' &&
        !M.isDynPage(id) &&
        id !== 'rubbish-bin' &&
        id !== 'backups' &&
        id !== 'shared-with-me' &&
        !String(M.currentdirid).includes('shares') &&
        id !== 'out-shares' &&
        !String(M.currentdirid).includes('out-shares') &&
        id !== 'public-links' &&
        !String(M.currentdirid).includes('public-links') &&
        id !== 'file-requests' &&
        !String(M.currentdirid).includes('file-requests') &&
        id !== 's4' &&
        M.currentrootid !== 's4'
    ) {
        $('.files-grid-view.fm').addClass('hidden');
        $('.fm-blocks-view.fm').addClass('hidden');
    }

    if (id !== 'user-management') {
        $('.fm-left-panel').removeClass('user-management');
        $('.user-management-tree-panel-header').addClass('hidden');
        $('.files-grid-view.user-management-view').addClass('hidden');
        $('.fm-blocks-view.user-management-view').addClass('hidden');
        $('.user-management-overview-bar').addClass('hidden');
    }

    if (id !== 'shared-with-me' && M.currentdirid !== 'shares') {
        $('.shared-blocks-view').addClass('hidden');
        $('.shared-grid-view').addClass('hidden');
    }

    if (M.currentdirid !== 'out-shares') {
        $('.out-shared-blocks-view').addClass('hidden');
        $('.out-shared-grid-view').addClass('hidden');
    }

    if (id !== 'shared-with-me' && id !== 'out-shares' || M.search) {
        $('.shares-tabs-bl').addClass('hidden');
    }

    if (!M.gallery || isAlbums) {
        $('.gallery-view').addClass('hidden');
    }

    if (M.previousdirid && M.isAlbumsPage(0, M.previousdirid)
        || !$('#albums-view', $('.fm-right-files-block')).hasClass('hidden')) {
        if (M.isGalleryPage()) {
            mega.gallery.albums.disposeInteractions();
        }
        else if (isAlbums && mega.gallery.albums && mega.gallery.albums.grid) {
            mega.gallery.albums.grid.clear();
        }
        else {
            $('#albums-view', $('.fm-right-files-block')).addClass('hidden');

            if (mega.gallery.albums) {
                mega.gallery.albums.disposeAll();
            }
        }
    }

    $(".fm-left-panel:not(.chat-lp-body)").removeClass('hidden');

    if (id !== "recents") {
        $(".fm-recents.container").addClass('hidden');
        $('.top-head').find(".recents-tab-link").addClass("hidden").removeClass('active');
    }
    if (id !== 'transfers') {
        if ($.transferClose) {
            $.transferClose();
        }
    }
    else {
        if (!$.transferOpen) {
            M.addTransferPanelUI();
        }
        $.transferOpen(true);
    }

    if (id === 'affiliate') {
        $('#fmholder').addClass('affiliate-program');
    }

    // required tricks to make the conversations work with the old UI HTML/css structure
    if (id === "conversations") {
        // moving the control of the headers in the tree panel to chat.js + ui/conversations.jsx
        $('.fm-main.default > .fm-left-panel').addClass('hidden');

        if (!is_mobile) {
            window.mega.ui.searchbar.refresh();
        }
    }
    else if (id !== "recents") {
        $('.fm-main.default > .fm-left-panel').removeClass('hidden');
    }

    // new sections UI
    let sections = document.getElementsByClassName('section');

    for (let i = sections.length; i--;) {

        if (sections[i].classList.contains(tmpId)) {
            sections[i].classList.remove('hidden');
        }
        else {
            sections[i].classList.add('hidden');
        }
    }

    // Revamp Implementation Begin
    $('.js-fm-left-panel').children('section').addClass('hidden');

    let panel;

    if (
        (id === 'cloud-drive' && !folderlink)
        || id === 'shared-with-me'
        || id === 'out-shares'
        || id === 'public-links'
        || id === 'backups'
        || id === 'rubbish-bin'
        || id === 'recents'
        || id === 'discovery'
        || id === 's4'
        || isAlbums
        || M.isDynPage(id)
        || mega.gallery.sections[id]
        || id === 'file-requests'
    ) {
        M.initLeftPanel();
    }
    else if (id === 'cloud-drive' || id === 'dashboard'
        || id === 'account' || id === 'devices') {

        panel = document.getElementsByClassName('js-other-tree-panel').item(0);

        if (panel) {
            panel.classList.remove('hidden');
        }
    }
    else if (id === 'user-management') {

        panel = document.getElementsByClassName('js-other-tree-panel').item(0);

        if (panel) {
            panel.classList.remove('hidden');
        }

        panel = document.getElementsByClassName('js-lp-usermanagement').item(0);

        // Don't show the panel if Pro Flexi
        if (panel && !u_attr.pf) {
            panel.classList.remove('hidden');
        }

        if (selectionManager) {
            selectionManager.clear_selection();
        }
    }

    // Revamp Implementation End

    if (self.FMResizablePane) {
        FMResizablePane.refresh();
    }

    if (d) {
        console.timeEnd('sectionUIOpen');
        console.groupEnd();
    }
};


FileManager.prototype.getLinkAction = function() {
    'use strict';

    if (M.isInvalidUserStatus()) {
        return;
    }

    // ToDo: Selected can be more than one folder $.selected
    // Avoid multiple referencing $.selected instead use event
    // add new translation message '... for multiple folders.'
    // cancel descendant File requests folders after copyRights are accepted
    if (u_type === 0) {
        ephemeralDialog(l[1005]);
    }
    else {
        var isEmbed = $(this).hasClass('embedcode-item');
        var selNodes = Array.isArray($.selected) ? $.selected.concat() : [];
        var showDialog = function() {
            mega.Share.initCopyrightsDialog(selNodes, isEmbed);
        };

        const mdList = mega.fileRequestCommon.storage.isDropExist(selNodes);
        if (mdList.length) {
            var fldName = mdList.length > 1 ? l[17626] : l[17403].replace('%1', escapeHTML(M.d[mdList[0]].name));

            msgDialog('confirmation', l[1003], fldName, l[18229], function(e) {
                if (e) {
                    mega.fileRequest.removeList(mdList, true).then(showDialog).catch(dump);
                }
            });
        }
        else {
            showDialog();
        }
    }
};

/**
 * Initialize Statusbar Links related user interface
 */
FileManager.prototype.initStatusBarLinks = function() {
    "use strict";

    // Set hover text to Share link or Share links depending on number selected
    const linkHoverText = mega.icu.format(l.share_link, $.selected.length);
    const $selectionStatusBar = $('.selection-status-bar');

    $('.js-statusbarbtn.link', $selectionStatusBar).attr('data-simpletip', linkHoverText);
    $('.js-statusbarbtn', $selectionStatusBar).rebind('click', function(e) {
        const isMegaList = M.dyh ? M.dyh('is-mega-list') : true;
        if (!isMegaList) {
            M.dyh('init-status-bar-links', e, this.classList);
        }
        else if (this.classList.contains('download')) {
            if (M.isAlbumsPage()) {
                mega.gallery.albums.downloadSelectedElements();
            }
            else {
                M.addDownload($.selected);
            }
        }
        else if (this.classList.contains('share')) {
            M.openSharingDialog($.selected[0]);
        }
        else if (this.classList.contains('sendto')) {
            openCopyDialog('conversations');
        }
        else if (this.classList.contains('link')) {
            M.getLinkAction();
        }
        else if (this.classList.contains('delete')) {

            if (M.isInvalidUserStatus() || this.classList.contains('disabled')) {
                return false;
            }

            closeDialog();
            fmremove();
        }
        else if (this.classList.contains('options')) {
            if (this.classList.contains('c-opened')) {
                this.classList.remove('c-opened');
                $.hideContextMenu();
                return false;
            }

            M.contextMenuUI(e, 1);
            this.classList.add('c-opened');
        }
        else if (this.classList.contains('preview')) {
            if (M.isAlbumsPage()) {
                mega.gallery.albums.previewSelectedElements();
            }
            else {
                slideshow(M.d[$.selected[0]], false);
            }
        }
        else if (this.classList.contains('delete-from-album')) {
            mega.gallery.albums.requestAlbumElementsRemoval();
        }

        return false;
    });
};

FileManager.prototype.initLeftPanel = function() {
    'use strict';

    const isGallery = M.isGalleryPage();
    const isDiscovery = isGallery && M.currentCustomView.prefixPath === 'discovery/';
    const isAlbums = M.isAlbumsPage();

    let elements = document.getElementsByClassName('js-lpbtn');

    for (var i = elements.length; i--;) {
        elements[i].classList.remove('active');
    }

    elements = document.getElementsByClassName(
        ((isGallery && !isDiscovery) || isAlbums)
            ? 'js-lp-gallery'
            : 'js-lp-myfiles'
    );

    for (var j = elements.length; j--;) {
        elements[j].classList.remove('hidden');
    }

    if ((isGallery || isAlbums) && mega.gallery.albums) {
        mega.gallery.albums.init();
    }

    $('.js-lp-storage-usage').removeClass('hidden');

    this.checkLeftStorageBlock();

    if (M.currentdirid === M.RootID) {
        $('.js-clouddrive-btn').addClass('active');
    }
    else if (M.currentdirid === M.BackupsId || M.currentrootid === M.InboxID) {
        $('.js-lpbtn[data-link="backups"]').addClass('active');
    }
    else if (M.currentrootid === 'shares' || M.currentrootid === 'out-shares') {
        $('.js-lpbtn[data-link="shares"]').addClass('active');
    }
    else if (M.currentdirid === 'recents') {
        $('.js-lpbtn[data-link="recents"]').addClass('active');
    }
    else if (M.currentrootid === 'public-links') {
        $('.js-lpbtn[data-link="links"]').addClass('active');
    }
    else if (M.currentrootid === 'file-requests') {
        $('.js-lpbtn[data-link="file-requests"]').addClass('active'); // Active left panel button
    }
    else if (M.currentrootid === M.RubbishID) {
        $('.js-lpbtn[data-link="bin"]').addClass('active');
    }
    else if (M.isDynPage(M.currentdirid)) {
        $(`.js-lpbtn[data-link="${M.currentdirid}"]`, '.js-myfiles-panel').addClass('active');
    }
    else if (isGallery && mega.gallery.sections[M.currentdirid]) { // If gallery and is not Discovery
        $(`.js-lpbtn[data-link="${mega.gallery.sections[M.currentdirid].root}"]`).addClass('active');
    }
    else if (M.currentrootid === 's4' && M.currentCustomView.subType === 'container') {
        $('.js-lpbtn[data-link="s4"]').addClass('active');
    }

    if (u_attr) {
        const galleryBtn = document.querySelector('.nw-fm-left-icon.gallery');

        if (galleryBtn && (!galleryBtn.dataset.locationPref || isGallery)) {
            mega.gallery.updateButtonsStates(elements, galleryBtn);
        }
    }

    $('.js-lpbtn').rebind('click.openSubTab', function(e) {

        let link = $(this).attr('data-link');

        if (link === 'clouddrive') {

            let $el = $(this);

            if (M.currentdirid === M.RootID || $(e.target).hasClass('js-cloudtree-expander')) {
                $el.toggleClass('collapse');
                const $treeContentPanel = $('.content-panel.active');
                if ($treeContentPanel.hasClass('collapse')) {
                    $treeContentPanel.removeClass('collapse');
                    M.addTreeUIDelayed();
                }
                else {
                    $treeContentPanel.addClass('collapse');
                }
                $.tresizer();
            }
            else {
                M.openFolder(M.RootID, true);
            }
            return;
        }
        else if (link === 'upgrade') {
            loadSubPage('pro');
        }
        else if (M.isGalleryPage(link)) {

            onIdle(() => {
                const gallery = mega.gallery[link];

                if (gallery && link === M.previousdirid && link !== M.currentdirid) {
                    gallery.mode = false;
                    gallery.setMode('a', 1);
                }
            });
        }
        else if (link === 's4' && 'ui' in s4) {
            const $eTarget = $(this);
            const $s4ContentPanel = $('.content-panel.s4', '.js-myfiles-panel');

            if (M.dyh && M.dyh('is-section', 'container') || $(e.target).hasClass('js-cloudtree-expander')) {
                $eTarget.toggleClass('collapse');
                if ($s4ContentPanel.hasClass('collapse')) {
                    $s4ContentPanel.removeClass('collapse');
                    M.addTreeUIDelayed();
                }
                else {
                    $s4ContentPanel.addClass('collapse');
                }
            }
            else {
                s4.ui.renderRoot();
            }
        }
    });

    if (M.currentrootid === 's4') {
        // Auto expand the tree pane if access any component pages of s4
        $('.js-lpbtn.js-s4-btn', '.js-myfiles-panel').removeClass('collapse');
        $('.content-panel.s4', '.js-myfiles-panel').removeClass('collapse');
        M.addTreeUIDelayed();
    }
};


/**
 * Get "My Backups" folder Handle
 * @return {void}
 */
FileManager.prototype.getMyBackups = async function() {

    'use strict';

    const res = await Promise.resolve(mega.attr.get(u_handle, 'bak', -2, 1)).catch(nop);

    if (!res) {
        return;
    }

    const handle = base64urlencode(res);

    if (!handle) {
        return;
    }

    M.BackupsId = handle;

    const lPaneButton = document.querySelector('.js-lp-myfiles .js-backups-btn');

    if (lPaneButton.classList.contains('hidden')) {
        lPaneButton.classList.remove('hidden');
    }
};

FileManager.prototype.getCameraUploads = async function() {

    "use strict";

    const nodes = [];
    const res = await Promise.resolve(mega.attr.get(u_handle, "cam", false, true)).catch(nop);

    if (!res) {
        return;
    }

    const handle = base64urlencode(res.h);

    if (!handle) {
        return;
    }

    nodes.push(handle);
    M.CameraId = handle;

    this.cameraUploadUI();

    const handle2 = base64urlencode(res.sh);

    if (handle2) {
        nodes.push(handle2);
        M.SecondCameraId = handle2;
    }

    return nodes;
};

FileManager.prototype.cameraUploadUI = function() {

    "use strict";

    if (M.CameraId) {

        const treeItem = document.querySelector(`[id="treea_${M.CameraId}"] .nw-fm-tree-folder`);
        const fmItem = document.querySelector(`[id="${M.CameraId}"] .folder`);

        if (treeItem) {
            treeItem.classList.add('camera-folder');
        }

        if (fmItem) {
            fmItem.classList.add('folder-camera', 'icon-folder-camera-uploads-90');
            fmItem.classList.remove('icon-folder-90');
        }
    }
};

(function(global) {
    'use strict';

    var _cdialogq = Object.create(null);

    // Define what dialogs can be opened from other dialogs
    var diagInheritance = {
        'recovery-key-dialog': ['recovery-key-info'],
        properties: ['links', 'rename', 'copyrights', 'copy', 'move', 'share', 'saveAs'],
        copy: ['createfolder'],
        move: ['createfolder'],
        register: ['terms'],
        selectFolder: ['createfolder'],
        saveAs: ['createfolder'],
        share: ['share-add', 'fingerprint-dialog'],
        'stripe-pay': ['stripe-pay-success', 'stripe-pay-failure']
    };

    var _openDialog = function(name, dsp) {
        if (d > 1) {
            console.log('safeShowDialog::_openDialog', name, typeof dsp, $.dialog);
        }

        onIdle(function() {
            if (typeof $.dialog === 'string') {
                if ($.dialog === name) {
                    if (d > 1) {
                        console.log('Reopening same dialog...', name);
                    }
                }

                // There are a few dialogs that can be opened from others, deal it.
                else if (!diagInheritance[$.dialog] || diagInheritance[$.dialog].indexOf(name) < 0) {
                    _cdialogq[name] = dsp;
                    return;
                }
            }

            dsp();
        });
    };

    mBroadcaster.addListener('closedialog', function() {
        var name = Object.keys(_cdialogq).shift();

        if (name) {
            _openDialog(name, _cdialogq[name]);
            delete _cdialogq[name];
        }
    });

    if (d) {
        global._cdialogq = _cdialogq;
    }

    /**
     * Prevent dispatching several dialogs in top on each other
     * @param {String} dialogName The dialog name to set on $.dialog
     * @param {Function|Object} dispatcher The dispatcher, either a jQuery's node/selector or a function
     */
    FileManager.prototype.safeShowDialog = function(dialogName, dispatcher) {

        dispatcher = (function(name, dsp) {
            return tryCatch(function() {
                var $dialog;

                if (d > 1) {
                    console.warn('Dispatching queued dialog.', name);
                }

                if (typeof dsp === 'function') {
                    $dialog = dsp();
                }
                else {
                    $dialog = $(dsp);
                }

                if ($dialog) {
                    if (!$dialog.hasClass('mega-dialog') &&
                        !$dialog.hasClass('fm-dialog-mobile') &&
                        !$dialog.hasClass('fm-dialog')) {

                        throw new Error(`Unexpected dialog(${name}) type...`);
                    }

                    if (!$dialog.is('#ob-dialog')) {
                        // arrange to back any non-controlled dialogs except message dialog,
                        // this class will be removed on the next closeDialog()
                        $('.mega-dialog:not(#msgDialog):visible, .overlay:visible').addClass('arrange-to-back');
                        fm_showoverlay();
                    }
                    $dialog.removeClass('hidden arrange-to-back');
                }
                $.dialog = String(name);
            }, function(ex) {
                // There was an exception dispatching the above code, move to the next queued dialog...
                if (d) {
                    console.warn(ex);
                }
                mBroadcaster.sendMessage('closedialog', ex);
            });
        })(dialogName, dispatcher);

        _openDialog(dialogName, dispatcher);
    };

    /**
     * Don't use this method, unless you know what you are doing.
     * This method would ditch the currently queued dialogs, without notifying via
     * sendMessage('closedialog') or .trigger('dialog-closed').
     * This may cause side effects of some dialogs, not unmounting correctly, despite being hidden.
     * E.g. this is specially dangerous with dialogs that do keyboard shortcuts or other global events.
     */
    Object.defineProperty(FileManager.prototype.safeShowDialog, 'abort', {
        value: function _abort() {
            if (d && $.dialog) {
                console.info('Aborting dialogs dispatcher while on %s, queued: ', $.dialog, _cdialogq);
            }

            delete $.dialog;
            loadingDialog.hide('force');
            _cdialogq = Object.create(null);

            $('html, body').removeClass('overlayed');
            $('.fm-dialog-overlay').addClass('hidden');
            $('.mega-dialog:visible, .overlay:visible').addClass('hidden');

            if (mega.ui.overlay && mega.ui.overlay.visible) {
                mega.ui.overlay.hide();
            }
            if (mega.ui.sheet && mega.ui.sheet.visible) {
                mega.ui.sheet.hide();
            }
        }
    });

})(self);

Object.freeze(FileManager.prototype);

function MegaUtils() {
    'use strict';
    this.fscache = Object.create(null);

    if (typeof Intl !== 'undefined' && Intl.Collator) {
        this.collator = new Intl.Collator('co', {numeric: true});
    }
}

MegaUtils.prototype = new FileManager();
MegaUtils.prototype.constructor = MegaUtils;

/**
 * execCommandUsable
 *
 * Native browser 'copy' command using execCommand('copy').
 * Supported by Chrome42+, FF41+, IE9+, Opera29+
 * @returns {Boolean}
 */
MegaUtils.prototype.execCommandUsable = function() {
    var result;

    try {
        return document.queryCommandSupported("copy");
    }
    catch (ex) {
        try {
            result = document.execCommand('copy');
        }
        catch (ex) {
        }
    }

    return result === false;
};

/**
 * Utility that will return a sorting function (can compare numbers OR strings, depending on the data stored in the
 * obj), that can sort an array of objects.
 * @param key {String|Function} the name of the property that will be used for the sorting OR a func that will return a
 * dynamic value for the object
 * @param [order] {Number} 1 for asc, -1 for desc sorting
 * @param [alternativeFn] {Function} Optional function to be used for comparison of A and B if both are equal or
 *      undefined
 * @returns {Function}
 */
MegaUtils.prototype.sortObjFn = function(key, order, alternativeFn) {
    'use strict';

    if (!order) {
        order = 1;
    }

    if (typeof key !== 'function') {
        var k = key;
        key = function(o) {
            return o[k];
        };
    }

    return function(a, b, tmpOrder) {
        var currentOrder = tmpOrder ? tmpOrder : order;

        var aVal = key(a);
        var bVal = key(b);

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal, locale) * currentOrder;
        }
        else if (typeof aVal === 'string' && typeof bVal === 'undefined') {
            return 1 * currentOrder;
        }
        else if (typeof aVal === 'undefined' && typeof bVal === 'string') {
            return -1 * currentOrder;
        }
        else if (typeof aVal === 'number' && typeof bVal === 'undefined') {
            return 1 * currentOrder;
        }
        else if (typeof aVal === 'undefined' && typeof bVal === 'number') {
            return -1 * currentOrder;
        }
        else if (typeof aVal === 'undefined' && typeof bVal === 'undefined') {
            if (alternativeFn) {
                return alternativeFn(a, b, currentOrder);
            }
            else {
                return -1 * currentOrder;
            }
        }
        else if (typeof aVal === 'number' && typeof bVal === 'number') {
            var _a = aVal || 0;
            var _b = bVal || 0;
            if (_a > _b) {
                return 1 * currentOrder;
            }
            if (_a < _b) {
                return -1 * currentOrder;
            }
            else {
                if (alternativeFn) {
                    return alternativeFn(a, b, currentOrder);
                }
                else {
                    return 0;
                }
            }
        }
        else {
            return 0;
        }
    };
};


/**
 * This is an utility function that would simply do a localCompare OR use Intl.Collator for comparing 2 strings.
 *
 * @param stringA {String} String A
 * @param stringB {String} String B
 * @param direction {Number} -1 or 1, for inversing the direction for sorting (which is most of the cases)
 * @returns {Number}
 */
MegaUtils.prototype.compareStrings = function megaUtilsCompareStrings(stringA, stringB, direction) {
    'use strict';

    let res;
    if (this.collator) {
        res = this.collator.compare(stringA || '', stringB || '') * direction;
    }

    return res || String(stringA || '').localeCompare(stringB || '') * direction;
};

/**
 * Promise-based XHR request
 * @param {Object|String} aURLOrOptions   URL or options
 * @param {Object|String} [aData]         Data to send, optional
 * @returns {MegaPromise}
 */
MegaUtils.prototype.xhr = megaUtilsXHR;

/**
 *  Retrieve a call stack
 *  @return {String}
 */
MegaUtils.prototype.getStack = function megaUtilsGetStack() {
    'use strict';
    return String(new Error('trace').stack);
};

/**
 *  Check whether there are pending transfers.
 *
 *  @return {Boolean}
 */
MegaUtils.prototype.hasPendingTransfers = function megaUtilsHasPendingTransfers() {
    'use strict';

    return (
        (fminitialized && ulmanager.isUploading) || dlmanager.isDownloading
            || typeof dlmanager.isStreaming === 'object'
    );
};

/**
 * On transfers completion cleanup
 */
MegaUtils.prototype.resetUploadDownload = function megaUtilsResetUploadDownload() {
    if (!ul_queue.some(isQueueActive)) {
        ul_queue = new UploadQueue();
        ulmanager.isUploading = false;
        ASSERT(ulQueue._running === 0, 'ulQueue._running inconsistency on completion');
        ulQueue._pending = [];
        ulQueue.setSize((fmconfig.ul_maxSlots | 0) || 4);

        if (is_megadrop) {
            mega.fileRequestUpload.onUploadCompletion();
        }
    }

    if (!dl_queue.some(isQueueActive)) {
        dl_queue = new DownloadQueue();
        dlmanager.isDownloading = false;
        dlQueue.setSize((fmconfig.dl_maxSlots | 0) || 4);
        dlQueue.resume();

        delay.cancel('overquota:retry');
        delay.cancel('overquota:uqft');

        dlmanager._quotaPushBack = {};
        dlmanager._dlQuotaListener = [];


        $.totalDL = false;
    }

    if (!dlmanager.isDownloading && !ulmanager.isUploading) {
        /* destroy all xhr */
        clearTransferXHRs();

        $('.transfer-pause-icon').addClass('disabled');
        $('.transfer-clear-all-icon').addClass('disabled');
        $('.nw-fm-left-icon.transfers').removeClass('transfering');
        $('.transfers .nw-fm-percentage li p').css('transform', 'rotate(0deg)');
        M.tfsdomqueue = Object.create(null);
        GlobalProgress = Object.create(null);
        delete $.transferprogress;
        if ($.mTransferAnalysis) {
            clearInterval($.mTransferAnalysis);
            delete $.mTransferAnalysis;
        }
        $('.transfer-panel-title span').text('');
        dlmanager.dlRetryInterval = 3000;
        percent_megatitle();

        if (dlmanager.onDownloadFatalError) {
            dlmanager.showMEGASyncOverlay(true, dlmanager.onDownloadFatalError);
            delete dlmanager.onDownloadFatalError;
        }
    }

    if (d) {
        dlmanager.logger.info("resetUploadDownload", ul_queue.length, dl_queue.length);
    }

    if (page === 'download') {
        delay('percent_megatitle', percent_megatitle);
    }
    else {
        fm_tfsupdate();
    }
};

/**
 *  Abort all pending transfers.
 *  @param force {boolean} Force to abort transfers or not
 *
 *  @return {MegaPromise}
 *          Resolved: Transfers were aborted
 *          Rejected: User canceled confirmation dialog
 *
 *  @details This needs to be used when an operation requires that
 *           there are no pending transfers, such as a logout.
 */
MegaUtils.prototype.abortTransfers = function megaUtilsAbortTransfers(force) {
    "use strict";
    var promise = new MegaPromise();
    force = force || false;

    var abort = function () {
        if (dlmanager.isDownloading) {
            dlmanager.abort(null);
        }
        if (ulmanager.isUploading) {
            ulmanager.abort(null);
        }
        if (typeof dlmanager.isStreaming === 'object') {
            dlmanager.isStreaming.abort();
        }
        dlmanager.isStreaming = false;

        M.resetUploadDownload();
        loadingDialog.show();
        var timer = setInterval(function() {
            if (!M.hasPendingTransfers()) {
                clearInterval(timer);
                promise.resolve();
            }
        }, 350);
    };

    if (!M.hasPendingTransfers()) {
        promise.resolve();
    } else {
        if (force) {
            abort();
        } else {
            msgDialog('confirmation', l[967], l[377] + ' ' + l[507] + '?', false, function(doIt) {
                if (doIt) {
                    abort();
                }
                else {
                    promise.reject();
                }
            });
        }
    }

    return promise;
};

/**
 * Save new UI language.
 * @param {String} The new lang
 * @returns {Promise}
 */
MegaUtils.prototype.uiSaveLang = promisify(function(resolve, reject, aNewLang) {
    'use strict';
    assert(aNewLang !== window.lang);

    const ack = async() => {
        let storage = localStorage;

        loadingDialog.hide();

        /**
        if ('csp' in window) {
            await csp.init();

            if (!csp.has('pref')) {
                storage = sessionStorage;
            }
        }
        /**/

        // Store the new language in localStorage to be used upon reload
        storage.lang = aNewLang;

        // If there are transfers, ask the user to cancel them to reload...
        M.abortTransfers().then(resolve).catch(function(ex) {
            console.debug('Not reloading upon language change...', ex);
            reject(ex);
        });
    };
    loadingDialog.show();

    // Set a language user attribute on the API (This is a private but unencrypted user
    // attribute so that the API can read it and send emails in the correct language)
    if (window.u_handle) {
        mega.attr.set(
            'lang',
            aNewLang,      // E.g. en, es, pt
            -2,            // Set to private private not encrypted
            true           // Set to non-historic, this won't retain previous values on API server
        ).then(function() {
            setTimeout(ack, 2e3);
        }).catch(ack);
    }
    else {
        ack();
    }
});

/**
 *  Reload the site cleaning databases & session/localStorage.
 *
 *  Under non-activated/registered accounts this
 *  will perform a former normal cloud reload.
 */
MegaUtils.prototype.reload = function megaUtilsReload(force) {
    'use strict';
    const _reload = () => {
        var u_sid = u_storage.sid;
        var u_key = u_storage.k;
        var privk = u_storage.privk;
        var jj = localStorage.jj;
        var debug = localStorage.d;
        var lang = localStorage.lang;
        var mcd = localStorage.testChatDisabled;
        var apipath = debug && localStorage.apipath;
        var cdlogger = debug && localStorage.chatdLogger;
        const rad = sessionStorage.rad;
        const {
            mInfinity,
            megaLiteMode,
            allownullkeys,
            testLargeNodes
        } = localStorage;

        force = force || sessionStorage.fmAetherReload;

        localStorage.clear();
        sessionStorage.clear();

        if (u_sid) {
            u_storage.sid = u_sid;
            u_storage.privk = privk;
            u_storage.k = u_key;
            localStorage.wasloggedin = true;
        }

        if (debug) {
            localStorage.d = 1;
            localStorage.minLogLevel = 0;

            if (location.host !== 'mega.nz') {
                localStorage.dd = true;
                if (!is_extension && jj) {
                    localStorage.jj = jj;
                }
            }
            if (apipath) {
                // restore api path across reloads, only for debugging purposes...
                localStorage.apipath = apipath;
            }

            if (cdlogger) {
                localStorage.chatdLogger = 1;
            }
        }

        if (rad) {
            sessionStorage.rad = 1;
        }
        if (mcd) {
            localStorage.testChatDisabled = 1;
        }
        if (lang) {
            localStorage.lang = lang;
        }
        if (hashLogic) {
            localStorage.hashLogic = 1;
        }
        if (allownullkeys) {
            localStorage.allownullkeys = 1;
        }
        if (mInfinity) {
            localStorage.mInfinity = 1;
        }
        if (megaLiteMode) {
            localStorage.megaLiteMode = 1;
        }
        if (testLargeNodes) {
            localStorage.testLargeNodes = 1;
        }

        if (force) {
            localStorage.force = true;
        }
        else {
            sessionStorage.fmAetherReload = 1;
        }
        location.reload(true);
        loadingDialog.hide();
    };

    if (u_type !== 3 && page !== 'download') {
        api.stop();
        waitsc.stop();
        loadfm(true);
        return;
    }

    // Show message that this operation will destroy the browser cache and reload the data stored by MEGA
    msgDialog('confirmation', l[761], l[7713], l[6994], (doIt) => {
        if (!doIt) {
            return;
        }

        let shouldAbortTransfers = true;
        if (!ulmanager.isUploading) {
            const queue = dl_queue.filter(isQueueActive);
            let i = queue.length;
            while (i--) {
                if (!queue[i].hasResumeSupport) {
                    break;
                }
            }
            shouldAbortTransfers = i >= 0;
        }

        const promise = shouldAbortTransfers ? M.abortTransfers() : Promise.resolve();

        promise.then(() => {
            const waitingPromises = [];

            loadingDialog.show();
            waitsc.stop();
            api.stop();

            if (window.delay) {
                delay.abort();
            }

            if (force === -0x7e080f) {
                if (mega.infinity) {
                    delete localStorage.mInfinity;
                }
                else {
                    localStorage.mInfinity = 1;
                }
                delete localStorage.megaLiteMode;
            }

            if (window.fmdb) {
                waitingPromises.push(fmdb.invalidate());
            }

            if (shouldAbortTransfers) {
                waitingPromises.push(M.clearFileSystemStorage());
            }
            else {
                // Trick our onbeforeunlaod() handler.
                dlmanager.isDownloading = false;
            }

            if (window.megaChatIsReady) {
                waitingPromises.push(megaChat.dropAllDatabases());
            }

            Promise.allSettled(waitingPromises).then(dump).finally(_reload);
        });
    });
};

/**
 * Clear the data on FileSystem storage.
 *
 * M.clearFileSystemStorage().always(console.debug.bind(console));
 */
MegaUtils.prototype.clearFileSystemStorage = function megaUtilsClearFileSystemStorage() {
    'use strict';

    var timer;
    var _done = function _done(status) {
        clearTimeout(timer);

        if (promise) {
            if (d) {
                console.timeEnd('fscleaning');
                console.log('FileSystem cleaning finished.', status);
            }

            if (status !== 0x7ffe) {
                promise.reject(status);
            }
            else {
                promise.resolve();
            }
            promise = undefined;
        }
    };

    if (d) {
        console.time('fscleaning');
    }

    timer = setTimeout(function() {
        if (d) {
            console.warn('FileSystem cleaning timedout...');
        }
        _done();
    }, 4000);

    var promise = new MegaPromise();

    (function _clear(storagetype) {
        if (d) {
            console.log('Cleaning FileSystem storage...', storagetype);
        }

        function onInitFs(fs) {
            var dirReader = fs.root.createReader();
            (function _readEntries(e) {
                dirReader.readEntries(function(entries) {
                    if (!entries.length) {
                        _next(e || 0x7ffe);
                    }
                    else {
                        (function _iterate(e) {
                            var entry = entries.pop();

                            if (!entry) {
                                _readEntries(e);
                            }
                            else {
                                if (d > 1) {
                                    console.debug('Got FileEntry %s', entry.name, entry);
                                }

                                if (String(entry.name).endsWith('mega')) {
                                    var fn = entry.isDirectory ? 'removeRecursively' : 'remove';

                                    console.debug('Cleaning FileEntry %s...', entry.name, entry);

                                    entry[fn](_iterate, function(e) {
                                        console.warn('Failed to remove FileEntry %s', entry.name, entry, e);
                                        _iterate(e);
                                    });
                                }
                                else {
                                    _iterate();
                                }
                            }
                        })();
                    }
                });
            })();
        }

        function _next(status) {
            if (storagetype === 0) {
                _clear(1);
            }
            else {
                _done(status);
            }
        }

        window.requestFileSystem(storagetype, 1024, onInitFs, _next);
    })(0);

    return promise;
};

/**
 * Resources loader through our secureboot mechanism
 * @param {...*} var_args  Resources to load, either plain filenames or jsl2 members
 * @return {MegaPromise}
 */
MegaUtils.prototype.require = function megaUtilsRequire() {
    var files = [];
    var args = [];
    var logger = d && MegaLogger.getLogger('require', 0, this.logger);

    toArray.apply(null, arguments).forEach(function(rsc) {
        // check if a group of resources was provided
        if (jsl3[rsc]) {
            var group = Object.keys(jsl3[rsc]);

            args = args.concat(group);

            // inject them into jsl2
            for (var i = group.length; i--;) {
                if (!jsl2[group[i]]) {
                    (jsl2[group[i]] = jsl3[rsc][group[i]]).n = group[i];
                }
            }
        }
        else {
            args.push(rsc);
        }
    });

    args.forEach(function(file) {

        // If a plain filename, inject it into jsl2
        // XXX: Likely this will have a conflict with our current build script
        if (!jsl2[file]) {
            var filename = file.replace(/^.*\//, '');
            var extension = filename.split('.').pop().toLowerCase();
            var name = filename.replace(/\./g, '_');
            var type;

            if (extension === 'html') {
                type = 0;
            }
            else if (extension === 'js') {
                type = 1;
            }
            else if (extension === 'css') {
                type = 2;
            }

            jsl2[name] = {f: file, n: name, j: type};
            file = name;
        }

        if (!jsl_loaded[jsl2[file].n]) {
            files.push(jsl2[file]);
        }
    });

    if (files.length === 0) {
        // Everything is already loaded
        if (logger) {
            logger.debug('Nothing to load.', args);
        }
        return MegaPromise.resolve();
    }

    if (megaUtilsRequire.loading === undefined) {
        megaUtilsRequire.pending = [];
        megaUtilsRequire.loading = Object.create(null);
    }

    var promise = new MegaPromise();
    var rl = megaUtilsRequire.loading;
    var rp = megaUtilsRequire.pending;
    var loading = Object.keys(rl).length;

    // Check which files are already being loaded
    for (var i = files.length; i--;) {
        var f = files[i];

        if (rl[f.n]) {
            // loading, remove it.
            files.splice(i, 1);
        }
        else {
            // not loading, track it.
            rl[f.n] = M.getStack();
        }
    }

    // hold up if other files are loading
    if (loading) {
        rp.push([files, promise]);

        if (logger) {
            logger.debug('Queueing %d files...', files.length, args);
        }
    }
    else {

        (function _load(files, promise) {
            var onload = function() {
                // all files have been loaded, remove them from the tracking queue
                for (var i = files.length; i--;) {
                    delete rl[files[i].n];
                }

                if (logger) {
                    logger.debug('Finished loading %d files...', files.length, files);
                }

                // resolve promise, in a try/catch to ensure the caller doesn't mess us..
                try {
                    promise.resolve();
                }
                catch (ex) {
                    (logger || console).error(ex);
                }

                // check if there is anything pending, and fire it.
                var pending = rp.shift();

                if (pending) {
                    _load.apply(null, pending);
                }
            };

            if (logger) {
                logger.debug('Loading %d files...', files.length, files);
            }

            if (!files.length) {
                // nothing to load
                onload();
            }
            else if (jsl.length) {
                if (logger) {
                    logger.debug('File(s) externally being loaded, holding up...');
                }
                mBroadcaster.once('startMega', SoonFc(90, _load.bind(this, files, promise)));
            }
            else {
                Array.prototype.push.apply(jsl, files);
                console.assert(!silent_loading, 'There is another silent loader... ' + silent_loading);
                silent_loading = onload;
                jsl_start();
            }
        })(files, promise);
    }
    return promise;
};

/**
 *  Check single tab or multiple tabs and there are any active transfers.
 *  Show a proper message in the warning dialog before logging out.
 */
MegaUtils.prototype.logoutAbortTransfers = function megaUtilsLogoutAbortTransfers() {
    "use strict";
    var promise = new MegaPromise();
    var singleTab = true;


    var logoutAbort = function (htCase) {
        if (!M.hasPendingTransfers() && singleTab) {
            promise.resolve();
        }
        else {
            var hasTransferMsg = "";
            if (M.hasPendingTransfers() && singleTab) {
                hasTransferMsg = l[19931];
            }
            switch (htCase) {
                case "this":
                    hasTransferMsg = l[19931];
                    break;
                case "other":
                    hasTransferMsg = l[19932];
                    break;
                case "others":
                    hasTransferMsg = l[19933];
                    break;
                case "this+other":
                    hasTransferMsg = l[19934];
                    break;
                case "this+others":
                    hasTransferMsg = l[19935];
                    break;
            }

            msgDialog('confirmation', l[967], hasTransferMsg + ' ' + l[507] + '?', false, function(doIt) {
                if (doIt) {
                    watchdog.notify("abort-transfers");
                    var targetPromise = M.abortTransfers(true);
                    promise.linkDoneAndFailTo(targetPromise);
                }
                else {
                    promise.reject();
                }
            });
        }
    };

    if (u_type === 0) {
        // if it's in ephemeral session
        watchdog.notify("abort-transfers");
        var targetPromise = M.abortTransfers(true);
        promise.linkDoneAndFailTo(targetPromise);
    } else {
        watchdog.query("transfers").always((res) => {
            if (!res.length) {
                // if it's in normal session with a single tab
                logoutAbort();
            } else {
                // if it's in normal session with multiple tabs
                singleTab = false;

                // Watch all tabs and check hasPendingTransfers in each tab
                var hasTransferTabNum = 0;
                res.forEach(function (i) {
                    if (i) {
                        hasTransferTabNum++;
                    }
                });

                if ((hasTransferTabNum > 0) || M.hasPendingTransfers()) {
                    if (M.hasPendingTransfers()) {
                        if (hasTransferTabNum === 0) {
                            logoutAbort("this");
                        } else if (hasTransferTabNum === 1) {
                            logoutAbort("this+other");
                        } else {
                            logoutAbort("this+others");
                        }
                    } else {
                        if (hasTransferTabNum === 1) {
                            logoutAbort("other");
                        } else {
                            logoutAbort("others");
                        }
                    }
                } else {
                    promise.resolve();
                }
            }
        });
    }

    return promise;
};

/**
 *  Kill session and Logout
 */
MegaUtils.prototype.logout = function megaUtilsLogout() {
    "use strict";
    M.logoutAbortTransfers().then(function() {
        var step = 2;
        var finishLogout = function() {
            const afterLogout = () => {
                if (is_extension) {
                    location.reload();
                }

                var sitePath = getSitePath();
                if (sitePath.includes('fm/search/')
                    || sitePath.includes('/chat')
                    || sitePath.includes('keybackup')) {

                    location.replace(getBaseUrl());
                }
                else if (location.href.indexOf('fm/user-management/invdet') > -1) {
                    var myHost = getBaseUrl() + '/fm/user-management/invoices';
                    location.replace(myHost);
                }
                else {
                    location.reload();
                }
            };

            if (--step === 0) {
                u_logout(true).then(() => afterLogout());
            }
        };

        loadingDialog.show();
        window.onerror = null;
        window.isLoggingOut = true;
        const promises = [mega.config.flush()];

        if ('rad' in mega) {
            mega.rad.log('\ud83d\udd1a', 'Logging out...');
            promises.push(tSleep(4 / 10).then(() => mega.rad.flush()));
        }

        if (fmdb && fmconfig.dbDropOnLogout) {
            promises.push(fmdb.drop());
        }

        if (window.megaChatIsReady) {
            megaChat.isLoggingOut = true;

            if (megaChat.userPresence) {
                megaChat.userPresence.disconnect();
            }

            if (fmconfig.dbDropOnLogout) {
                promises.push(megaChat.dropAllDatabases());
            }

            megaChat.destroy(true);
        }

        if (window.is_eplusplus) {
            promises.push(M.delPersistentData('e++ck'));
        }

        Promise.allSettled(promises)
            .then((res) => {
                if (self.d) {
                    console.debug('logging out...', tryCatch(() => JSON.stringify(res), false)() || res);
                }
                waitsc.stop();
                // XXX: using a batched-command for sml to forcefully flush any pending
                //      API request, otherwise they could fail with a -15 (ESID) error.
                return u_type !== false && api.req([{a: 'sml'}]);
            })
            .catch(dump)
            .finally(() => {
                step = 1;
                finishLogout();
            });
    });
};

/**
 * Convert a version string (eg, 2.1.1) to an integer, for easier comparison
 * @param {String}  version The version string
 * @param {Boolean} hex     Whether give an hex result
 * @return {Number|String}
 */
MegaUtils.prototype.vtol = function megaUtilsVTOL(version, hex) {
    version = String(version).split('.');

    while (version.length < 4) {
        version.push(0);
    }

    version = ((version[0] | 0) & 0xff) << 24 |
        ((version[1] | 0) & 0xff) << 16 |
        ((version[2] | 0) & 0xff) << 8 |
        ((version[3] | 0) & 0xff);

    version >>>= 0;

    if (hex) {
        return version.toString(16);
    }

    return version;
};

/**
 * Retrieve data from storage servers.
 * @param {String|Object} aData           ufs-node's handle or public link
 * @param {Number}        [aStartOffset]  offset to start retrieveing data from
 * @param {Number}        [aEndOffset]    retrieve data until this offset
 * @param {Function}      [aProgress]     callback function which is called with the percent complete
 * @returns {MegaPromise}
 */
MegaUtils.prototype.gfsfetch = megaUtilsGFSFetch;

/**
 * Returns the currently running site version depending on if in development, on the live site or if in an extension
 * @returns {String} Returns the string 'dev' if in development or the currently running version e.g. 3.7.0
 */
MegaUtils.prototype.getSiteVersion = function() {

    // Use 'dev' as the default version if in development
    var version = 'dev';

    // If this is a production version the timestamp will be set
    if (buildVersion.timestamp !== '') {

        // Use the website build version by default
        version = buildVersion.website;

        // If an extension use the version of that (because sometimes there are independent deployments of extensions)
        if (is_extension) {
            version = (mega.chrome) ? buildVersion.chrome + ' ' +
                (ua.details.browser === 'Edgium' ? l[23326] : l[957]) :
                buildVersion.firefox + ' ' + l[959];
        }
    }

    return version;
};

/**
 * Fire "find duplicates"
 */
MegaUtils.prototype.findDupes = function() {
    loadingDialog.show();
    onIdle(function() {
        M.overrideModes = 1;
        loadSubPage('fm/search/~findupes');
    });
};

/**
 * Search for nodes
 * @param {String} searchTerm The search term to look for.
 * @returns {Promise}
 */
MegaUtils.prototype.fmSearchNodes = function(searchTerm) {
    'use strict';

    if (String(searchTerm).startsWith('--')) {
        if (pfid) {
            onIdle(() => M.filterBySearch(searchTerm));
        }
        return Promise.resolve();
    }

    // Add log to see how often they use the search
    eventlog(99603, JSON.stringify([1, pfid ? 1 : 0, Object(M.d[M.RootID]).tf, searchTerm.length]), pfid);

    return new Promise(function(resolve, reject) {
        var promise = MegaPromise.resolve();
        var fill = function(nodes) {
            var r = 0;

            for (var i = nodes.length; i--;) {
                var n = nodes[i];
                if (M.nn[n.h]) {
                    r = 1;
                }
                else if (!n.fv) {
                    M.nn[n.h] = n.name;
                }
            }

            return r;
        };

        if (d) {
            console.time('fm-search-nodes');
        }

        if (!M.nn) {
            M.nn = Object.create(null);

            if (fmdb) {
                loadingDialog.show();
                promise = new Promise(function(resolve, reject) {
                    var ts = 0;
                    var max = 96;
                    var options = {
                        sortBy: 't',
                        limit: 16384,

                        query: function(db) {
                            return db.where('t').aboveOrEqual(ts);
                        },
                        include: function() {
                            return true;
                        }
                    };
                    var add = function(r) {
                        return r[r.length - 1].ts + fill(r);
                    };

                    onIdle(function _() {
                        var done = function(r) {
                            if (!Array.isArray(r)) {
                                return reject(r);
                            }

                            if (r.length) {
                                ts = add(r);

                                if (--max && r.length >= options.limit) {
                                    return onIdle(_);
                                }
                            }

                            if (ts >= 0) {
                                ts = -1;
                                max = 48;
                                r = null;
                                options.query = function(db) {
                                    return db.where('t').belowOrEqual(ts);
                                };
                                add = function(r) {
                                    return 1262304e3 - r[0].ts + -fill(r);
                                };
                                return onIdle(_);
                            }

                            resolve();
                        };
                        fmdb.getbykey('f', options).then(done).catch(done);
                    });
                });
            }
            else {
                fill(Object.values(M.d));
            }
        }

        promise.then(function() {
            var h;
            var filter = M.getFilterBySearchFn(searchTerm);

            if (folderlink) {
                M.v = [];
                for (h in M.nn) {
                    if (filter({name: M.nn[h]}) && h !== M.currentrootid) {
                        M.v.push(M.d[h]);
                    }
                }
                M.currentdirid = 'search/' + searchTerm;
                M.renderMain();
                M.onSectionUIOpen('cloud-drive');
                $('.fm-right-header .fm-breadcrumbs-wrapper').addClass('hidden');
                onIdle(resolve);
                // mBroadcaster.sendMessage('!sitesearch', searchTerm, 'folder-link', M.v.length);
            }
            else {
                var handles = [];

                for (h in M.nn) {
                    if (!M.d[h] && filter({name: M.nn[h]}) && handles.push(h) > 4e3) {
                        break;
                    }
                }

                loadingDialog.show();
                dbfetch.geta(handles).always(function() {
                    loadingDialog.hide();
                    resolve();
                });
            }

            if (d) {
                console.timeEnd('fm-search-nodes');
            }
        }).catch(function(ex) {
            loadingDialog.hide();
            msgDialog('warninga', l[135], l[47], ex);
            reject(ex);
        });
    });
};


/** check if the current M.v has any names duplicates.
 * @param {String}      id              Handle of the current view's parent
 * @returns {Object}    duplicates     if none was found it returns null
 * */
MegaUtils.prototype.checkForDuplication = function(id) {
    'use strict';
    if (M.currentrootid === M.RubbishID
        || !M.d[id]
        || M.getNodeRights(id) < 2) {
        return;
    }

    if (d) {
        console.time('checkForDuplication');
    }

    // at this point we have V prepared.

    var names = Object.create(null);

    // count duplications O(n)
    for (let i = M.v.length; i--;) {
        const n = M.v[i] || false;

        if (!n.name || missingkeys[n.h] || n.p !== id) {
            if (d) {
                console.debug('name-less node', missingkeys[n.h], [n]);
            }
            continue;
        }

        let target = names[n.name];
        if (!target) {
            names[n.name] = target = Object.create(null);
        }

        target = target[n.t];
        if (!target) {
            names[n.name][n.t] = target = Object.create(null);
            target.total = 0;
            target.list = [];
        }

        target.total++;
        target.list.push(n.h);
    }

    if (d) {
        console.timeEnd('checkForDuplication');
    }

    // extract duplication O(n), if we have any
    // O(1) if we dont have any
    var dups = Object.create(null);
    var dupsFolders = Object.create(null);

    if (M.v.length > Object.keys(names).length) {

        var found = false;

        for (var nodeName in names) {
            found = false;

            if (names[nodeName][0] && names[nodeName][0].total > 1) {
                dups[nodeName] = names[nodeName][0].list;
                found = true;
            }
            if (names[nodeName][1] && names[nodeName][1].total > 1) {
                dupsFolders[nodeName] = names[nodeName][1].list;
                found = true;
            }

            if (!found) {
                names[nodeName] = null;
            }
        }

        if (!Object.keys(dups).length && !Object.keys(dupsFolders).length) {
            if (d) {
                console.warn("No Duplications were found in the time when"
                    + "we have a mismatch in lengths "
                    + id + '. We have names intersected between files and folders');
            }
            return;
        }

        var resultObject = Object.create(null);
        resultObject.files = dups;
        resultObject.folders = dupsFolders;

        return resultObject;
    }
};

mBroadcaster.addListener('mega:openfolder', SoonFc(300, function(id) {
    'use strict';

    let dups = false;

    // Show desktop notification
    if (!is_mobile && (dups = M.checkForDuplication(id)) && (dups.files || dups.folders)) {
        const $bar = $('.fm-notification-block.duplicated-items-found').addClass('visible');

        $('.fix-me-btn', $bar).rebind('click.df', function() {
            fileconflict.resolveExistedDuplication(dups, id);
        });
        $('.fix-me-close', $bar).rebind('click.df', function() {
            $bar.removeClass('visible');
        });
        reselect(1);
    }
}));


/**
 * Handle a redirect from the mega.co.nz/#pro page to mega.nz/#pro page
 * and keep the user logged in at the same time
 *
 * @param {String} [data] optional data to decode
 * @returns {Boolean}
 */
MegaUtils.prototype.transferFromMegaCoNz = function(data) {
    'use strict';

    // Get site transfer data from after the hash in the URL
    var urlParts = /sitetransfer!(.*)/.exec(data || window.location);

    if (urlParts) {

        try {
            // Decode from Base64 and JSON
            urlParts = JSON.parse(atob(urlParts[1]));
        }
        catch (ex) {
            console.error(ex);
            loadSubPage('login');
            return false;
        }

        if (urlParts) {

            api_req({a: 'log', e: 99804, m: 'User tries to transfer a session from mega.co.nz.'});

            var toPage = String(urlParts[2] || 'fm').replace('#', '');

            if (toPage.includes('?')) {
                const pageParts = toPage.split('?');
                toPage = pageParts[0];
                for (let i = 1; i < pageParts.length; i++) {
                    const queryParts = pageParts[i].split('=');
                    if (queryParts[0] === 'tab') {
                        window.mProTab = queryParts[1].split('/')[0];
                    }
                }
            }

            // If the user is already logged in here with the same account
            // we can avoid a lot and just take them to the correct page
            if (JSON.stringify(u_k) === JSON.stringify(urlParts[0])) {
                loadSubPage(toPage);
                return false;
            }

            // If the user is already logged in but with a different account just load that account instead. The
            // hash they came from e.g. a folder link may not be valid for this account so just load the file manager.
            else if (u_k && (JSON.stringify(u_k) !== JSON.stringify(urlParts[0]))) {
                // If the user is transferred from MEGAsync and is logged in as different account on webclient.
                msgDialog(
                    'warninga',
                    l[882],
                    l.megasync_transferred_different_user,
                    '',
                    function() {
                        if (!urlParts[2] || String(urlParts[2]).match(/^fm/)) {
                            loadSubPage('fm');
                            return false;
                        }
                        loadSubPage(toPage);
                        return false;
                    }
                );

                return false;
            }

            // Likely that they have never logged in here before so we must set this
            localStorage.wasloggedin = true;
            u_logout();

            // Set master key, session ID and RSA private key
            u_storage = init_storage(sessionStorage);
            u_k = urlParts[0];
            u_sid = urlParts[1];
            if (u_k) {
                u_storage.k = JSON.stringify(u_k);
            }

            loadingDialog.show();

            var _goToPage = function() {
                loadingDialog.hide();
                loadSubPage(toPage);
            };

            var _rawXHR = function(url, data, callback) {
                M.xhr(url, JSON.stringify([data]))
                    .always(function(ev, data) {
                        var resp = data | 0;
                        if (typeof data === 'string' && data[0] === '[') {
                            try {
                                resp = JSON.parse(data)[0];
                            }
                            catch (ex) {
                            }
                        }
                        callback(resp);
                    });
            };

            // Performs a regular login as part of the transfer from mega.co.nz
            _rawXHR(apipath + 'cs?id=0&sid=' + u_sid, {'a': 'ug'}, function(data) {

                var ctx = {
                    checkloginresult: function(ctx, result) {
                        u_type = typeof result !== 'number' || result < 0 ? false : result;

                        if (toPage.substr(0, 1) === '!' && toPage.length > 7) {
                            _rawXHR(apipath + 'cs?id=0&domain=meganz',
                                {'a': 'g', 'p': toPage.substr(1, 8)},
                                function(data) {
                                    if (data) {
                                        dl_res = data;
                                    }
                                    _goToPage();
                                });
                        }
                        else {
                            _goToPage();
                        }
                    }
                };
                api_setsid(u_sid);
                u_storage.sid = u_sid;
                u_checklogin3a(data, ctx);
            });
            return false;
        }
    }
};

/**
 * Sanitise filename so that saving to local disk won't cause any issue...
 * @param {String} name The filename
 * @returns {String}
 */
MegaUtils.prototype.getSafeName = function(name) {
    // http://msdn.microsoft.com/en-us/library/aa365247(VS.85)
    name = ('' + name).replace(/["*/:<>?\\|]+/g, '.');

    if (name.length > 250) {
        name = name.substr(0, 250) + '.' + name.split('.').pop();
    }
    name = name.replace(/[\t\n\r\f\v]+/g, ' ');
    name = name.replace(/\u202E|\u200E|\u200F/g, '');

    var end = name.lastIndexOf('.');
    end = ~end && end || name.length;
    if (/^(?:CON|PRN|AUX|NUL|COM\d|LPT\d)$/i.test(name.substr(0, end))) {
        name = '!' + name;
    }
    return name;
};
/**
 * checking if name (file|folder)is satisfaying all OSs [Win + linux + Mac + Android + iOs] rules,
 * so syncing to local disks won't cause any issue...
 * we cant yet control cases in which :
 *     I sync a file named [x] from OS [A],
 *     to another device running another OS [B]
 *     And the name [x] breaks OS [B] rules.
 *
 * this method will be called to control, renamings from webclient UI.
 * @param {String} name The filename
 * @param {Boolean} [allowPathSep] whether to allow ether / or \ as a mean for nested folder creation requirements.
 * @returns {Boolean}
 */
MegaUtils.prototype.isSafeName = function(name, allowPathSep) {
    'use strict';
    // below are mainly denied in windows or android.
    // we can enhance this as much as we can as
    // denied chars set D = W + L + M + A + I
    // where W: denied chars on Winfows, L: on linux, M: on MAC, A: on Android, I: on iOS
    // minimized to NTFS only
    if (name.trim().length <= 0) {
        return false;
    }
    return !(name.search(allowPathSep ? /["*:<>?|]/ : /["*/:<>?\\|]/) >= 0 || name.length > 250);
};

/**
 * Sanitise path components so that saving to local disk won't cause any issue...
 * @param {String} path   The full path to sanitise
 * @param {String} [file] Optional filename to append
 * @returns {Array} Each sanitised path component as array members
 */
MegaUtils.prototype.getSafePath = function(path, file) {
    var res = ('' + (path || '')).split(/[\\\/]+/).map(this.getSafeName).filter(String);
    if (file) {
        res.push(this.getSafeName(file));
    }
    return res;
};

/**
 * Retrieve transfer quota details, i.e. by firing an uq request.
 */
MegaUtils.prototype.getTransferQuota = async function() {
    'use strict';
    const {result} = await api.req({a: 'uq', xfer: 1, qc: 1});

    return freeze({
        ...result,
        max: result.mxfer,
        base: result.pxfer
    });
};


/**
 * Get the state of the storage
 * @param {Number|Boolean} [force] Do not use the cached u_attr value
 * @return {MegaPromise} 0: Green, 1: Orange (almost full), 2: Red (full)
 */
MegaUtils.prototype.getStorageState = async function(force) {
    'use strict';

    if (!force && Object(u_attr).hasOwnProperty('^!usl')) {
        return u_attr['^!usl'] | 0;
    }

    // XXX: Not using mega.attr.get since we don't want the result indexedDB-cached.
    const result = await api.send({'a': 'uga', 'u': u_handle, 'ua': '^!usl', 'v': 1});
    if (d) {
        console.debug('getStorageState', result);
        console.assert(result === ENOENT || result.av, `getStorageState: Unexpected response... ${result}`);
    }
    const value = base64urldecode(result.av || '');

    if (typeof u_attr === 'object') {
        u_attr['^!usl'] = value;
    }

    return value | 0;
};

/**
 * Retrieve storage quota details, i.e. by firing an uq request.
 */
MegaUtils.prototype.getStorageQuota = async function() {
    'use strict';
    const {result} = await api.req({a: 'uq', strg: 1, qc: 1}, {cache: -4});

    if (result.uslw === undefined) {
        result.uslw = 9000;
    }

    return freeze({
        ...result,
        max: result.mstrg,
        used: result.cstrg,
        isFull: result.cstrg / result.mstrg >= 1,
        percent: Math.floor(result.cstrg / result.mstrg * 100),
        isAlmostFull: result.cstrg / result.mstrg >= result.uslw / 10000
    });
};

/**
 * Check Storage quota.
 * @param {Number} timeout in milliseconds, defaults to 30 seconds
 */
MegaUtils.prototype.checkStorageQuota = function checkStorageQuota(timeout) {
    'use strict';
    delay('checkStorageQuota', function _csq() {
        M.getStorageQuota().then((data) => {
            if (data.percent < 100) {
                if (ulmanager.ulOverStorageQuota) {
                    onIdle(function() {
                        ulmanager.ulResumeOverStorageQuotaState();
                    });
                }
                if (is_mobile && mega.ui.sheet.name === 'over-storage') {
                    mega.ui.sheet.hide();
                }
                if (u_attr) {
                    delete u_attr.uspw;
                }
            }
            return M.showOverStorageQuota(data);
        }).catch(dump);
    }, timeout || 30000);
};

/**
 * Check whether an operation could take the user over their storage quota
 * @param {Number} opSize The size needed by the operation
 * @returns {Promise}
 */
MegaUtils.prototype.checkGoingOverStorageQuota = function(opSize) {
    'use strict';

    return M.getStorageQuota()
        .then((data) => {

            if (opSize === -1) {
                opSize = data.mstrg;
            }

            if (opSize > data.mstrg - data.cstrg) {
                var options = {custom: 1, title: l[882], body: l[16927]};

                return M.showOverStorageQuota(data, options)
                    .always(() => {
                        throw EGOINGOVERQUOTA;
                    });
            }
        });
};

/**
 * Fill LHP storage block caption.
 * @param {HTMLElement} container storage block element
 * @param {Number|String} storageQuota available storage quota
 * @returns {Promise} fulfilled on completion.
 */
MegaUtils.prototype.createLeftStorageBlockCaption = async function(container, storageQuota) {
    'use strict';

    let checked = false;
    const $storageBlock = $(container);
    const $popup = $('.js-lp-storage-information-popup', $storageBlock.parent()).removeClass('hidden');

    $storageBlock.rebind('mouseenter.storage-usage', () => {
        if (!checked) {
            checked = true;

            Promise.resolve(!u_attr.p || u_attr.tq || this.getTransferQuota())
                .then((res) => {
                    if (typeof res === 'object') {
                        // base transfer quota from getTransferQuota()
                        res = res.base;
                    }
                    if (typeof res === 'number') {
                        res = bytesToSize(res, 3, 4);
                    }

                    if (u_attr.p) {
                        u_attr.tq = res;
                        $popup.text(l.storage_usage_caption_pro.replace('%1', storageQuota).replace('%2', u_attr.tq));
                    }
                    else {
                        $popup.text(l.storage_usage_caption_free.replace('%1', storageQuota));
                    }
                });
        }

        delay('storage-information-popup', () => $popup.addClass('hovered'), 1e3);
    });

    $storageBlock.rebind('mouseleave.storage-usage', () => {
        delay.cancel('storage-information-popup');
        $popup.removeClass('hovered');
    });
};

/**
 * Fill left-pane element with storage quota footprint.
 * @param {Object} [data] already-retrieved storage-quota
 * @returns {Promise} fulfilled on completion.
 */
MegaUtils.prototype.checkLeftStorageBlock = async function(data) {
    'use strict';
    const storageBlock = document.querySelector('.js-lp-storage-usage-block');

    if (!u_type || !fminitialized || this.storageQuotaCache) {

        if (u_type === 0) {
            storageBlock.classList.add('hidden');
        }

        return false;
    }

    storageBlock.classList.remove('hidden');

    const loaderSpinner = storageBlock.querySelector('.loader');

    // minimize DOM ops when not needed by only triggering the loader if really needed
    if (loaderSpinner) {
        loaderSpinner.classList.add('loading');
    }

    this.storageQuotaCache = data || await this.getStorageQuota();

    let storageHtml;
    const {percent, max, used, isAlmostFull, isFull} = this.storageQuotaCache;
    const space = bytesToSize(max, 0);
    const space_used = bytesToSize(used);

    storageBlock.classList.remove('over');
    storageBlock.classList.remove('warning');

    if (isFull && !storageBlock.classList.contains("over")) {
        storageBlock.classList.add('over');
    }
    else if (isAlmostFull && !storageBlock.classList.contains("warning")) {
        storageBlock.classList.add('warning');
    }

    // If Business or Pro Flexi always show the plan name (even if expired, which is when u_attr.p is undefined)
    if (u_attr.b || u_attr.pf) {
        storageBlock.querySelector('.plan').textContent = pro.getProPlanName(
            u_attr.b ? pro.ACCOUNT_LEVEL_BUSINESS : pro.ACCOUNT_LEVEL_PRO_FLEXI
        );
    }
    else if (u_attr.p) {
        storageBlock.querySelector('.plan').textContent = pro.getProPlanName(u_attr.p);
    }
    else {
        storageBlock.querySelector('.plan').textContent = l[1150]; // Free
    }

    // Show only space_used for Business and Pro Flexi accounts
    if (u_attr && (u_attr.b || u_attr.pf)) {
        storageHtml = `<span class="lp-sq-used">${space_used}</span>`;
        storageBlock.querySelector('.js-storagegraph').classList.add('hidden');
        storageBlock.querySelector('.js-lpbtn[data-link="upgrade"]').classList.add('hidden');
    }
    else {
        storageHtml = l[1607].replace('%1', `<span class="lp-sq-used">${space_used}</span>`)
            .replace('%2', `<span class="lp-sq-max">${space}</span>`);
    }

    $('.storage-txt', storageBlock).safeHTML(storageHtml);
    $('.js-storagegraph span', storageBlock).outerWidth(`${percent}%`);

    if (loaderSpinner) {
        loaderSpinner.remove();
    }

    if (!u_attr.pf && !u_attr.b && (!u_attr.tq || !storageBlock.classList.contains('caption-running'))) {
        storageBlock.classList.add('caption-running');
        return this.createLeftStorageBlockCaption(storageBlock, space);
    }
};

/**
 * Check whether the provided object is a TypedArray
 * @param {Object} obj The object to check
 * @returns {Boolean}
 */
MegaUtils.prototype.isTypedArray = function(obj) {
    'use strict';

    obj = Object(obj).constructor;
    return obj && obj.BYTES_PER_ELEMENT > 0;
};

/** @property MegaUtils.mTextEncoder */
lazy(MegaUtils.prototype, 'mTextEncoder', function() {
    'use strict';
    return new TextEncoder();
});

/**
 * Convert data to ArrayBuffer
 * @param {*} data the data to convert
 * @returns {Promise}
 */
MegaUtils.prototype.toArrayBuffer = promisify(function(resolve, reject, data) {
    'use strict';

    if (typeof data === 'string' && data.substr(0, 5) === 'data:') {
        data = dataURLToAB(data);
    }

    if (data instanceof Blob) {
        ('arrayBuffer' in data ? data.arrayBuffer() : this.readBlob(data)).then(resolve).catch(reject);
    }
    else if (typeof data === 'string' && data.substr(0, 5) === 'blob:') {
        M.xhr({url: data, type: 'arraybuffer'})
            .then(function(ev, data) {
                resolve(data);
            })
            .catch(function(ex, detail) {
                reject(detail || ex);
            });
    }
    else if (this.isTypedArray(data)) {
        if (data.byteLength !== data.buffer.byteLength) {
            resolve(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        }
        else {
            resolve(data.buffer);
        }
    }
    else if (data instanceof ArrayBuffer) {
        resolve(data);
    }
    else if (data instanceof ReadableStream) {
        data.arrayBuffer().then(resolve).catch(reject);
    }
    else {
        if (typeof data !== 'string') {
            try {
                data = JSON.stringify(data);
            }
            catch (_) {
            }
        }

        resolve(this.mTextEncoder.encode('' + data).buffer);
    }
});

/**
 * Retrieves or creates a readable stream for the provided input data
 * @param {*} data some arbitrary data
 * @returns {Promise<ReadableStream<Uint8Array>|ReadableStream<any>>}
 */
MegaUtils.prototype.getReadableStream = async function(data) {
    'use strict';

    if (data instanceof Blob) {
        return data.stream();
    }

    return new Response(data).body;
};

/**
 * Compress data using the Compression Streams API
 * The Compression Streams API provides a JavaScript API for compressing
 * and decompressing streams of data using the gzip or deflate formats.
 * @param {ArrayBuffer|Blob} data some arbitrary data
 * @param {String} [format] optional, default to gzip
 * @returns {Promise<ArrayBuffer>}
 */
MegaUtils.prototype.compress = async function(data, format) {
    'use strict';
    const cs = new CompressionStream(format || 'gzip');
    const stream = (await this.getReadableStream(data)).pipeThrough(cs);
    return new Response(stream).arrayBuffer();
};

/**
 * Decompress data using the Compression Streams API
 * The Compression Streams API provides a JavaScript API for compressing
 * and decompressing streams of data using the gzip or deflate formats.
 * @param {ArrayBuffer|Blob} data some arbitrary data
 * @param {String} [format] optional, default to gzip
 * @returns {Promise<ArrayBuffer>}
 */
MegaUtils.prototype.decompress = async function(data, format) {
    'use strict';
    const ds = new DecompressionStream(format || 'gzip');
    const stream = (await this.getReadableStream(data)).pipeThrough(ds);
    return new Response(stream).arrayBuffer();
};

/**
 * Save to disk the current's account tree (fetch-nodes response)
 * @param {Number} [ca] set to 1 to not clear the tree-cache
 * @returns {Promise<*>}
 */
MegaUtils.prototype.saveFTree = async function(ca) {
    'use strict';
    const ts = new Date().toISOString().replace(/\W/g, '');
    return M.saveAs(await api.send({a: 'f', c: 1, r: 1, ca}), `tree-${ts}.json`);
};

/**
 * Save files locally
 * @param {*} data The data to save to disk
 * @param {String} [filename] The file name
 * @returns {MegaPromise}
 */
MegaUtils.prototype.saveAs = function(data, filename) {
    'use strict';

    var promise = new MegaPromise();

    if (!filename) {
        filename = new Date().toISOString().replace(/\W/g, '') + '.txt';
    }

    var saveToDisk = function(data) {
        var dl = {awaitingPromise: promise};
        var io = new MemoryIO(Math.random().toString(36), dl);
        io.begin = function() {
            io.write(data, 0, function() {
                io.download(filename, false);
                promise.resolve();
            });
        };
        try {
            io.setCredentials(false, data.byteLength, filename);
        }
        catch (e) {
            promise.reject(e);
        }
    };

    if (this.isTypedArray(data)) {
        saveToDisk(data);
    }
    else {
        this.toArrayBuffer(data)
            .then(function(ab) {
                saveToDisk(new Uint8Array(ab));
            })
            .catch(function() {
                promise.reject.apply(promise, arguments);
            });
    }

    return promise;
};

/**
 * Read a Blob
 * @param {Blob|File} blob The blob to read
 * @param {String} [meth] The FileReader method to use, defaults to readAsArrayBuffer
 * @returns {Promise}
 */
MegaUtils.prototype.readBlob = function(blob, meth) {
    'use strict';
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() {
            resolve(this.result);
        };
        reader.onerror = reject;
        reader[meth || 'readAsArrayBuffer'](blob);
    });
};

/**
 * Read a FileSystem's FileEntry
 * @param {FileEntry} entry the.file.entry
 * @param {String} [meth] The FileReader method to use, defaults to readAsArrayBuffer
 * @returns {Promise}
 */
MegaUtils.prototype.readFileEntry = function(entry, meth) {
    'use strict';
    return new Promise(function(resolve, reject) {
        if (String(entry) === '[object FileEntry]') {
            entry.file(function(file) {
                M.readBlob(file, meth).then(resolve).catch(reject);
            }, reject);
        }
        else {
            reject(EARGS);
        }
    });
};

/**
 * Helper function to quickly perform an IndexedDB (Dexie) operation
 * @param {String} name The database name
 * @param {Object} schema The database schema, Dexie-style
 * @returns {Promise}
 */
MegaUtils.prototype.onDexieDB = promisify(function(resolve, reject, name, schema) {
    'use strict';

    var db = new Dexie(name);
    db.version(1).stores(schema);
    db.open().then(resolve.bind(null, db)).catch(function(ex) {
        onIdle(db.close.bind(db));

        if (ex && ex.name === 'InvalidStateError') {
            // Firefox in PBM?
            return resolve(null);
        }

        reject(ex);
    });
});

/**
 * Wrapper around M.onDexieDB() for the persistent storage functions.
 * @param {String} [action] Pre-defined action to perform.
 * @param {String} [key] action key.
 * @param {String} [value] action key value.
 * @returns {Promise}
 */
MegaUtils.prototype.onPersistentDB = promisify(function(resolve, reject, action, key, value) {
    'use strict';

    this.onDexieDB('$ps', {kv: '&k'}).then((db) => {
        const ack = (value) => {
            if (!value && action === 'get') {
                return reject(ENOENT);
            }
            resolve(value);
        };

        if (!action) {
            // No pre-defined action given, the caller is responsible of db.close()'ing
            resolve(db);
        }
        else if (db) {
            var c = db.kv;
            var r = action === 'get' ? c.get(key) : action === 'set' ? c.put({k: key, v: value}) : c.delete(key);

            r.then((result) => {
                onIdle(db.close.bind(db));
                ack(action === 'get' && result && result.v || null);
            }).catch(reject);
        }
        else {
            this.onPersistentDB.fallback.call(null, action, key, value).then(ack).catch(reject);
        }
    }, reject);
});

/**
 * indexedDB persistence fallback.
 * @param {String} action The fallback action being performed
 * @param {String} key The storage key identifier
 * @param {*} [value] The storage key value
 * @returns {Promise}
 */
MegaUtils.prototype.onPersistentDB.fallback = async function(action, key, value) {
    'use strict';
    const pfx = '$ps!';
    const parse = tryCatch(JSON.parse.bind(JSON));
    const storage = localStorage;
    key = pfx + (key || '');

    var getValue = function(key) {
        var value = storage[key];
        if (value) {
            value = parse(value) || value;
        }
        return value;
    };

    if (action === 'set') {
        value = tryCatch(JSON.stringify.bind(JSON))(value) || value;
        if (d && String(value).length > 4096) {
            console.warn('Storing more than 4KB...', key, [value]);
        }
        storage[key] = value;
    }
    else if (action === 'get') {
        value = getValue(key);
    }
    else if (action === 'rem') {
        value = storage[key];
        delete storage[key];
    }
    else if (action === 'enum') {
        const entries = Object.keys(storage)
            .filter((k) => k.startsWith(key))
            .map((k) => k.substr(pfx.length));
        let result = entries;

        if (value) {
            // Read contents
            result = Object.create(null);

            for (var i = entries.length; i--;) {
                result[entries[i]] = getValue(pfx + entries[i]);
            }
        }

        value = result;
    }

    return value;
};

// Get FileSystem storage ignoring polyfills.
lazy(MegaUtils.prototype, 'requestFileSystem', function() {
    'use strict';
    const requestFileSystem = window.webkitRequestFileSystem || window.requestFileSystem;
    if (typeof requestFileSystem === 'function') {
        return requestFileSystem.bind(window);
    }
});

/**
 * Get access to persistent FileSystem storage
 * @param {Boolean} [writeMode] Whether we want write access
 * @param {String|Number} [token] A token to store reusable fs instances
 * @returns {Promise}
 */
MegaUtils.prototype.getFileSystemAccess = promisify(function(resolve, reject, writeMode, token) {
    'use strict';

    var self = this;

    if (Object(this.fscache[token]).ts + 7e6 > Date.now()) {
        resolve(this.fscache[token].fs);
    }
    else if (navigator.webkitPersistentStorage && M.requestFileSystem) {
        var success = function(fs) {
            if (token) {
                self.fscache[token] = {ts: Date.now(), fs: fs};
            }
            resolve(fs);
        };
        let type = 1;
        var request = function(quota) {
            M.requestFileSystem(type, quota, success, reject);
        };

        delete this.fscache[token];
        navigator.webkitPersistentStorage.queryUsageAndQuota(function(used, remaining) {
            if (remaining) {
                request(remaining);
            }
            else if (writeMode) {
                navigator.webkitPersistentStorage.requestQuota(1e10, request, reject);
            }
            else {
                type = 0;
                navigator.webkitTemporaryStorage.requestQuota(1e10, request, (err) => {
                    console.error(err);
                    reject(EBLOCKED);
                });
            }
        }, reject);
    }
    else {
        reject(ENOENT);
    }
});

/**
 * Get access to an entry in persistent FileSystem storage
 * @param {String} filename The filename under data will be stored
 * @param {Boolean} [create] Whether the file(s) should be created
 * @returns {Promise}
 */
MegaUtils.prototype.getFileSystemEntry = promisify(function(resolve, reject, filename, create) {
    'use strict';

    create = create || false;

    this.getFileSystemAccess(create, seqno)
        .then(function(fs) {
            if (String(filename).indexOf('/') < 0) {
                filename += '.mega';
            }
            fs.root.getFile(filename, {create: create}, resolve, reject);
        }, reject);
});

/**
 * Retrieve metadata for a filesystem entry
 * @param {FileEntry|String} entry A FileEntry instance or filename
 * @returns {Promise}
 */
MegaUtils.prototype.getFileEntryMetadata = promisify(function(resolve, reject, entry) {
    'use strict';

    var getMetadata = function(entry) {
        entry.getMetadata(resolve, reject);
    };

    if (String(entry) === '[object FileEntry]') {
        getMetadata(entry);
    }
    else {
        this.getFileSystemEntry(entry).then(getMetadata).catch(reject);
    }
});

/**
 * Retrieve all *root* entries in the FileSystem storage.
 * @param {String} [aPrefix] Returns entries matching with this prefix
 * @param {Boolean} [aMetaData] Whether metadata should be retrieved as well, default to true
 * @returns {Promise}
 */
MegaUtils.prototype.getFileSystemEntries = promisify(function(resolve, reject, aPrefix, aMetaData) {
    'use strict';

    this.getFileSystemAccess(false, seqno)
        .then(function(fs) {
            var entries = [];
            var reader = fs.root.createReader();

            var success = function() {
                var mega = Object.create(null);

                for (var i = entries.length; i--;) {
                    var name = String(entries[i].name);

                    if (entries[i].isFile && name.substr(-5) === '.mega') {
                        mega[name.substr(0, name.length - 5)] = entries[i];
                    }
                }
                resolve(mega);
            };

            var getMetadata = function(idx) {
                var next = function() {
                    onIdle(getMetadata.bind(this, ++idx));
                };

                if (idx === entries.length) {
                    success();
                }
                else if (entries[idx].isFile) {
                    entries[idx].getMetadata(function(metadata) {
                        entries[idx].date = metadata.modificationTime;
                        entries[idx].size = metadata.size;
                        next();
                    }, next);
                }
                else {
                    next();
                }
            };

            (function _readEntries() {
                reader.readEntries(function(result) {
                    if (result.length) {
                        if (aPrefix) {
                            for (var i = result.length; i--;) {
                                if (String(result[i].name).startsWith(aPrefix)) {
                                    entries.push(result[i]);
                                }
                            }
                        }
                        else {
                            entries = entries.concat(result);
                        }
                        _readEntries();
                    }
                    else if (aMetaData !== false) {
                        getMetadata(0);
                    }
                    else {
                        success();
                    }
                }, reject);
            })();
        }).catch(reject);
});

/**
 * Retrieve data saved into persistent storage
 * @param {String} k The key identifying the data
 * @returns {Promise}
 */
MegaUtils.prototype.getPersistentData = async function(k) {
    'use strict';
    return this.onPersistentDB('get', k);
};

/**
 * Save data into persistent storage
 * @param {String} k The key identifying the data to store
 * @param {*} v The value/data to store
 * @returns {Promise}
 */
MegaUtils.prototype.setPersistentData = async function(k, v) {
    'use strict';
    return this.onPersistentDB('set', k, v);
};

/**
 * Remove previously stored persistent data
 * @param {String} k The key identifying the data
 * @returns {Promise}
 */
MegaUtils.prototype.delPersistentData = function(k) {
    'use strict';

    return Promise.allSettled([
        this.onPersistentDB('rem', k),
        this.onPersistentDB.fallback('rem', k)
    ]);
};

/**
 * Enumerates all persistent data entries
 * @param {String} [aPrefix] Returns entries matching with this prefix
 * @param {Boolean} [aReadContents] Whether the contents must be read as well
 * @returns {MegaPromise}
 */
MegaUtils.prototype.getPersistentDataEntries = promisify(async function(resolve, reject, aPrefix, aReadContents) {
    'use strict';

    let result = null;
    const append = (data) => {
        if (Array.isArray(data)) {
            result = result || [];
            assert(Array.isArray(result));
            result = result.concat(data);
        }
        else {
            assert(typeof result === 'object' && !Array.isArray(result));
            result = Object.assign(Object.create(null), result, data);
        }
    };
    const finish = (data) => {
        if (data) {
            append(data);
        }
        if (result) {
            return resolve(result);
        }
        reject(ENOENT);
    };
    const fail = (ex) => {
        if (d > 1) {
            console.warn(ex);
        }
        finish();
    };
    const fallback = () => {
        this.onPersistentDB().then((db) => {
            if (db) {
                var dbc = db.kv;

                if (aPrefix) {
                    dbc = dbc.where('k').startsWith(aPrefix);
                }
                else {
                    dbc = dbc.toCollection();
                }

                dbc[aReadContents ? 'toArray' : 'keys']()
                    .then(function(entries) {
                        onIdle(db.close.bind(db));

                        if (!aReadContents) {
                            return finish(entries);
                        }

                        var result = Object.create(null);
                        for (var i = entries.length; i--;) {
                            result[entries[i].k] = entries[i].v;
                        }
                        finish(result);
                    })
                    .catch(fail);
            }
            else {
                this.onPersistentDB.fallback('enum', aPrefix, aReadContents, true).then(finish).catch(fail);
            }
        }, fail);
    };

    // why the closure? check out git blame, some logic was removed here and no need to refactor everything, yet.
    fallback();
});

/**
 * Returns the name of a country given a country code in the users current language.
 * Will return Null if the requested countrycode does not exist.
 * @param {String} countryCode The countrycode of the country to get the name of
 * @returns {Null|String}.
 */
MegaUtils.prototype.getCountryName = function(countryCode) {
    'use strict';

    if (!this._countries) {
        this.getCountries();
    }

    // Get the stringid for the country code specified.
    if (this._countries.hasOwnProperty(countryCode)) {
        return this._countries[countryCode];
    } else {
        if (d) {
            console.error('Error - getCountryName: unrecognizable country code: ' + countryCode);
        }
        return null;
    }
};

/**
 * Returns an object with all countryCodes:countryNames in the user set language.
 * @returns Object
 */
MegaUtils.prototype.getCountries = function() {
    'use strict';

    if (!this._countries) {
        this._countries = (new RegionsCollection()).countries;
    }
    return this._countries;
};

/**
 * Returns an object with all the stateCodes:stateNames.
 * @returns Object
 */
MegaUtils.prototype.getStates = function() {
    'use strict';

    if (!this._states) {
        this._states = (new RegionsCollection()).states;
    }
    return this._states;
};

/**
 * Return a country call code for a given country
 * @param {String} isoCountryCode A two letter ISO country code e.g. NZ, AU
 * @returns {String} Returns the country international call code e.g. 64, 61
 */
MegaUtils.prototype.getCountryCallCode = function(isoCountryCode) {
    'use strict';

    if (!this._countryCallCodes) {
        this._countryCallCodes = (new RegionsCollection()).countryCallCodes;
    }
    return this._countryCallCodes[isoCountryCode];
};

/**
 * Gets the trunk (national dialling) code from the given number and country code.
 * If the country doesn't have trunk codes or wasn't included in the number, returns an empty string.
 *
 * @param {string} countryCallCode Country intl. calling code
 * @param {string} phoneNumber Phone number in question
 * @returns {string} Trunk code or empty string if not found
 */
MegaUtils.prototype.getNumberTrunkCode = function(countryCallCode, phoneNumber) {
    'use strict';

    if (!this._countryTrunkCodes) {
        this._countryTrunkCodes = new RegionsCollection().countryTrunkCodes;
    }

    let trunkCodes;
    if (this._countryTrunkCodes.hasOwnProperty(countryCallCode)) {
        trunkCodes = this._countryTrunkCodes[countryCallCode];
        if (typeof trunkCodes === 'function') {
            trunkCodes = trunkCodes(phoneNumber);
        }
    }

    for (let trunkCode in trunkCodes) {
        trunkCode = trunkCodes[trunkCode];
        if (trunkCode && phoneNumber.startsWith(trunkCode)) {
            return trunkCode;
        }
    }

    return ''; // No trunk code is common
};

/**
 * Formats the given phone number to make it suitable to prepend a country call code.
 * Strips hyphens and whitespace, removes the trunk code.
 * e.g. NZ 021-1234567 => 2112345567
 *
 * @param {string} countryCallCode Country int. calling code
 * @param {string} phoneNumber Phone number to format
 * @returns {string} Formatted phone number
 */
MegaUtils.prototype.stripPhoneNumber = function(countryCallCode, phoneNumber) {
    'use strict';

    // Strip hyphens, whitespace
    phoneNumber = phoneNumber.replace(/-|\s/g, '');

    // Remove the trunk code (prefix for dialling nationally) from the given phone number.
    const trunkCode = M.getNumberTrunkCode(countryCallCode, phoneNumber);
    if (trunkCode && phoneNumber.startsWith(trunkCode)) {
        phoneNumber = phoneNumber.substr(trunkCode.length);
    }

    return phoneNumber;
};

/**
 * Check user trying to upload folder by drag and drop.
 * @param {Event} event
 * @returns {Boolean}
 */
MegaUtils.prototype.checkFolderDrop = function(event) {

    'use strict';

    /**
     * Check user trying to upload folder.
     */
    if (d) {
        console.log('Checking user uploading folder.');
    }

    var checkWebkitItems = function _checkWebkitItems() {
        var items = event.dataTransfer.items;
        for (var i = 0; i < items.length; i++) {
            if (items[i].webkitGetAsEntry) {
                var item = items[i].webkitGetAsEntry();
                if (item && item.isDirectory) {
                    return true;
                }
            }
        }
    };

    if (event.dataTransfer
        && event.dataTransfer.items
        && event.dataTransfer.items.length > 0 && event.dataTransfer.items[0].webkitGetAsEntry) {
        return checkWebkitItems();
    }

    return false;
};

/**
 * Check the date entered, as day, month and year, is valid
 * @param {Number} day Day value of the date to validate
 * @param {Number} month Month value of the date to validate
 * @param {Number} year Year value of the date to validate
 * @returns {Number} 0 on success, else the number represent why date is not valid.
 */
MegaUtils.prototype.validateDate = function(day, month, year) {

    'use strict';

    // Check value is null or empty or 0
    if (!day || !month || !year) {
        return 1;
    }

    // Check value over common range limits
    if (day > 31 || month > 12) {
        return 2;
    }

    const tDate = new Date();

    tDate.setFullYear(year, month - 1, day);

    // If entered day is not exact as processed date, day value is not exist on entered month of the year,
    // i.e. not exist on Calandar
    if (tDate.getDate() !== day || tDate.getMonth() + 1 !== month || tDate.getFullYear() !== year) {
        return 3;
    }

    // it is valid
    return 0;
};

/**
 * Validate raw phone number
 *
 * @param {string} phoneNumber Phone number
 * @param {string} countryCode Country calling code
 * @returns {string|Boolean} returns the cleaned phone number otherwise false
 */
MegaUtils.prototype.validatePhoneNumber = function(phoneNumber, countryCode) {
    'use strict';

    if (typeof phoneNumber !== 'string') {
        return false;
    }

    let length = 4;

    if (typeof countryCode === 'string') {
        countryCode = countryCode.trim();
        phoneNumber = `${countryCode}${phoneNumber}`;
        length = countryCode.length + 4;
    }

    phoneNumber = phoneNumber.trim().replace(/[^\w+]/g, '');

    var simplePhoneNumberPattern = new RegExp(`^\\+?\\d{${length},}$`);

    if (!simplePhoneNumberPattern.test(phoneNumber)) {
        return false;
    }

    return phoneNumber;
};

/**
 * Tells whether the used does have to agree to the copyright warning before proceeding.
 * @returns {Boolean} value.
 */
MegaUtils.prototype.agreedToCopyrightWarning = function() {
    'use strict';

    if (pfid) {
        // No need under folder-links, copyright agents are retrieving links there
        return true;
    }

    if (mega.config.get('cws') | 0) {
        // They did.
        return true;
    }

    if (Object.keys((this.su || !1).EXP || {}).length > 0) {
        // rely on the presence of public-links.
        mega.config.set('cws', 1);
        return true;
    }

    return false;
};

MegaUtils.prototype.noSleep = async function(stop, title) {
    'use strict';
    // Based on https://github.com/richtr/NoSleep.js

    const store = this.noSleep;

    if (store.canUseWakeLock === undefined) {
        store.canUseWakeLock = 'wakeLock' in window.navigator;
        store.tick = 0;
    }

    if (store.canUseWakeLock) {
        const {wakeLock} = store;

        if (stop) {

            if (wakeLock && (--store.tick < 1 || stop > 1)) {
                store.tick = 0;
                store.wakeLock = null;
                return (await wakeLock).release();
            }
        }
        else {
            store.tick++;

            if (wakeLock) {
                return wakeLock;
            }
            store.wakeLock = new Promise((resolve, reject) => {

                navigator.wakeLock.request('screen')
                    .then((res) => {
                        if (store.tick > 0) {
                            store.wakeLock = res;
                        }
                        return res;
                    })
                    .catch((ex) => {
                        if (d) {
                            console.error(ex);
                        }
                        delete store.wakeLock;
                        store.canUseWakeLock = false;

                        if (store.tick > 0) {
                            return this.noSleep(false, title);
                        }
                    })
                    .then(resolve)
                    .catch(reject);
            });
        }

        return store.wakeLock;
    }

    const vNode = store.node = store.node || document.createElement("video");
    assert(vNode, 'Cannot apply no-sleep measures...');

    if (!store.srcNode) {
        vNode.setAttribute('playsinline', '');
        vNode.setAttribute('title', title || 'MEGA');
        vNode.addEventListener("timeupdate", () => {
            if (vNode.currentTime > 0.5) {
                vNode.currentTime = Math.random();
            }
        });

        const sNode = store.srcNode = document.createElement("source");
        sNode.src = `${staticpath}images/mega/no-sleep.mp4`;
        sNode.type = "video/mp4";
        vNode.appendChild(sNode);
    }

    if (stop) {

        if (--store.tick < 1 || stop > 1) {
            store.awake = false;
            vNode.pause();
        }
    }
    else {
        store.awake = true;
        return vNode.play();
    }
};

MegaUtils.prototype.updatePaymentCardState = () => {
    'use strict';
    return api.req({a: 'cci'}).then((res) => {
        const date = new Date();
        const cardM = res.result.exp_month;
        const cardY = res.result.exp_year;
        const currentM = date.getMonth() + 1;
        const currentY = date.getFullYear();
        const currentD = date.getDate();
        const isCurrentYear = currentY === cardY;
        let state;
        // Expired
        if (currentY > cardY || ((currentM > cardM) && isCurrentYear)) {
            state = 'exp';
        }
        // Expires this month
        else if ((currentM === cardM) && isCurrentYear) {
            state = 'expThisM';
        }
        // Expires next month (only show on/after the 15th of the current month)
        else if ((((currentM + 1) === cardM) && (currentD >= 15)) && isCurrentYear) {
            state = 'expNextM';
        }
        M.showPaymentCardBanner(state);
        if (M.account && state) {
            M.account.cce = state;
        }
    });
};


Object.freeze(MegaUtils.prototype);

/**
 * @typedef {Object} MEGA_USER_STRUCT
 *      Access using namespace mega.u
 *      Access using global variable M.u
 *      An object holding informations about specific contacts/user identified
 *      by "handle" as base64 URL encoded 88-bit value.
 *      Caches informations for current/past full contacts.
 *      Pending contacts informations are not stored here.
 * @property {String} u
 *     Mega user handle as base64 URL encoded 88-bit value.
 * @property {Number} c
 *     Contact access right/status: 2: owner, 1: active contact, 0: inactive/deleted.
 * @property {String} m
 *     Email address of the contact.
 * @property {Array} m2
 *     Array of all emails/phone numbers of a user.
 * @property {String} name
 *     Combines users First and Last name defined in user profile.
 *     If First and Last name in user profile are undefined holds users email.
 *     It's used at least like index field for search contacts in share dialog.
 *     It combines `firstname` and `lastname` of user attributes.
 * @property {String} nickname
 *     A custom nickname for a contact, it won't be set for the current user.
 *     This information comes from a private encrypted attribute !*>alias which
 *     stores all contact nicknames for the user.
 * @property {String} h
 *     Holds user handle, value equal to 'u' param. Used only when synching with
 *     M.d, deeply rooted in code. should not be removed.
 *     Reason behind it should be searched in file/folders caching structure,
 *     'h' represents file/folder "handle" as base64 URL encoded 64-bit value.
 * @property {Number} t
 *     For active contacts but not for the owner 't' is set to 1. For non active
 *     contacts and owner it's 'undefined'. Used when synching with M.d, deeply
 *     rooted in code. should not be removed.
 *     Reason behind it should be searched in file/folders caching structure,
 *     't' represents type of item: 2: Cloud Drive root, 1: folder, 0: file
 * @property {String} p
 *     Logic inherited from file manager where parent directory 'p' is
 *     represented by base64 URL encoded 64-bit value.
 *     Root directory for Cloud Drive is cached in M.RootID.
 *     This parameter represents top level/root/parent for 'Contacts' tab.
 *     All contacts are bind to account owner but instead of owners "handle"
 *     as base64 URL encoded 88-bit value we are using 'contacts'.
 * @property {Number} ts
 *     UNIX epoch time stamp as an integer in seconds to record last change of
 *     parameters values.
  * @property {Number} rTimeStamp
 *     UNIX epoch time stamp as an integer in seconds to record last change of
 *     time stamp.
 * @property {Number} lastChatActivity
 *     UNIX epoch time stamp as an integer in seconds for the last chat
 *     activity.
 */

mBroadcaster.once('boot_done', function() {
    'use strict';

    const value = freeze({
        "u": undefined,
        "c": undefined,
        "m": undefined,
        // "m2": undefined,
        "name": undefined,
        "h": undefined,
        "t": undefined,
        "p": undefined,
        "presence": 'unavailable',
        "presenceMtime": undefined,
        "firstName": "",
        "lastName": "",
        "nickname": "",
        "ts": undefined,
        "ats": undefined,
        // "rTimeStamp": undefined,
        "avatar": undefined,
        "lastGreen": undefined
    });

    Object.defineProperty(window, 'MEGA_USER_STRUCT', {value});
});


function MegaData() {
    "use strict";

    this.reset();

    this.csortd = -1;
    this.csort = 'name';
    this.storageQuotaCache = null;
    this.tfsdomqueue = Object.create(null);
    this.sortTreePanel = Object.create(null);
    this.lastColumn = null;
    this.account = false;

    Object.defineProperty(this, 'fsViewSel', {
        value: '.files-grid-view.fm .grid-scrolling-table, .fm-blocks-view.fm .file-block-scrolling',
        configurable: false
    });

    (function(self) {
        var maf = false;
        var saved = 0;

        Object.defineProperty(self, 'maf', {
            get: function() {
                if (Object(self.account).maf && saved !== self.account.maf) {
                    saved = self.account.maf;
                    maf = mega.achievem.prettify(self.account.maf);
                }
                return maf;
            }
        });
    })(this);

    // XXX: do NOT change the order, add new entries at the tail, and ask before removing anything..
    const sortRules = {
        'name': this.sortByName.bind(this),
        'size': this.sortBySize.bind(this),
        'type': this.sortByType.bind(this),
        'date': this.sortByDateTime.bind(this),
        'ts': this.sortByDateTime.bind(this),
        'rTimeStamp': this.sortByRts.bind(this),
        'owner': this.sortByOwner.bind(this),
        'modified': this.sortByModTime.bind(this),
        'mtime': this.sortByModTime.bind(this),
        'interaction': this.sortByInteraction.bind(this),
        'access': this.sortByAccess.bind(this),
        'status': this.sortByStatus.bind(this),
        'fav': this.sortByFav.bind(this),
        'email': this.sortByEmail.bind(this),
        'label': this.sortByLabel.bind(this),
        'sharedwith': this.sortBySharedWith.bind(this),
        'versions': this.sortByVersion.bind(this),
        'playtime': this.sortByPlaytime.bind(this)
    };
    Object.setPrototypeOf(sortRules, null);
    Object.defineProperty(this, 'sortRules', {value: Object.freeze(sortRules)});

    /** EventListener interface. */
    this.handleEvent = function(ev) {
        if (d > 1) {
            console.debug(ev.type, ev);
        }

        var ttl;
        if (ev.type === 'ps-y-reach-end' && !$.isTfsPsUpdate) {
            ttl = M.getTransferTableLengths();
            if (ttl.left > -100) {
                this.doFlushTransfersDynList(ttl.size);
            }
        }
        else if (ev.type === 'tfs-dynlist-flush') {
            ttl = M.getTransferTableLengths();
            if (ttl.left > -10) {
                this.doFlushTransfersDynList(ttl.size);
            }
        }
    };

    if (is_mobile) {
        /* eslint-disable no-useless-concat */
        mobile.shim(this);
    }
    else if (is_megadrop) {
        Object.defineProperty(this, 'ul' + 'progress', {
            value: function(ul, perc, bl, bt, bps) {
                if (!bl || !ul.starttime || uldl_hold) {
                    return false;
                }

                if (d) {
                    console.assert(mega.fileRequestUpload.isUploadPageInitialized(), 'Check this...');
                }

                const {id} = ul;
                const remainingTime = bps > 1000 ? (bt - bl) / bps : -1;

                $.transferprogress[`ul_${id}`] = [bl, bt, bps];

                delay('percent_megatitle', percent_megatitle, 50);

                mega.fileRequestUpload.onItemUploadProgress(ul, bps, remainingTime, perc, bl);
            }
        });
    }

    /** @name M.IS_TREE */
    /** @name M.IS_FAV */
    /** @name M.IS_LINKED */
    /** @name M.IS_SHARED */
    /** @name M.IS_TAKENDOWN */
    makeEnum(['TREE', 'FAV', 'LINKED', 'SHARED', 'TAKENDOWN'], 'IS_', this);

    const seal = new Set();
    (function shield(ctx) {
        const proto = Object.getPrototypeOf(ctx);
        if (proto) {
            const desc = Object.getOwnPropertyDescriptors(proto);
            for (const p in desc) {
                if (typeof desc[p].value === 'function') {
                    seal.add(p);
                }
            }
            shield(proto);
        }
    })(this);

    // Think twice before adding anything new here.
    const safe = [
        'getTransferElements'
    ];

    if (self.hashLogic && String(location.hash).startsWith('#test')) {
        safe.push('accountData', 'getStorageQuota');
    }

    for (let i = safe.length; i--;) {
        seal.delete(safe[i]);
    }

    return new Proxy(this, {
        defineProperty(target, prop, descriptor) {
            if (seal.has(prop)) {
                throw new MEGAException('Invariant', prop, 'DataCloneError');
            }
            return Reflect.defineProperty(target, prop, descriptor);
        }
    });
}

MegaData.prototype = new MegaUtils();
MegaData.prototype.constructor = MegaData;

// Initialize affiliate dataset on-demand
lazy(MegaData.prototype, 'affiliate', () => {
    'use strict';
    return new AffiliateData();
});

MegaData.prototype.accountData = function(cb, blockui, force) {
    "use strict";

    const account = Object(this.account);
    let reuseData = account.lastupdate > Date.now() - 10000 && !force;

    if (reuseData && (!account.stats || !account.stats[M.RootID])) {
        if (d) {
            console.error('Track down how we get here...', M.RootID, account.stats && Object.keys(account.stats));
        }
        reuseData = false;
    }

    if (reuseData && cb) {
        return cb(account);
    }

    const promises = [];
    const mRootID = M.RootID;
    const pstatus = Object(window.u_attr).p;

    const sendAPIRequest = (payload, always, handler) => {
        if (typeof always === 'function') {
            handler = always;
            always = false;
        }
        const promise = api.req(payload)
            .then(({result}) => {
                return handler(result);
            })
            .catch((ex) => {
                if (always) {
                    return handler(ex);
                }
                throw ex;
            });
        const slot = promises.push(promise) - 1;

        Object.defineProperty(promises, `<${slot}>`, {value: payload.a});
    };

    if (d) {
        if (!window.fminitialized) {
            console.warn('You should not use this function outside the fm...');
        }
        console.assert(mRootID, 'I told you...');
    }

    if (blockui) {
        loadingDialog.show();
    }

    // Fetch extra storage/transfer base data Pro Flexi or Business master
    const b = typeof u_attr !== 'undefined' && (u_attr.pf || u_attr.b && u_attr.b.m) ? 1 : 0;

    /** DO NOT place any sendAPIRequest() call before, this 'uq' MUST BE the FIRST one */

    sendAPIRequest({a: 'uq', strg: 1, xfer: 1, pro: 1, v: 1, b}, (res) => {
        Object.assign(account, res);

        account.type = res.utype;
        // account.stime = res.scycle;
        // account.scycle = res.snext;
        account.expiry = res.suntil;
        account.space = Math.round(res.mstrg);
        account.space_used = Math.round(res.cstrg);
        account.bw = Math.round(res.mxfer);
        account.servbw_used = Math.round(res.csxfer);
        account.downbw_used = Math.round(res.caxfer);
        account.servbw_limit = Math.round(res.srvratio);
        account.isFull = res.cstrg / res.mstrg >= 1;
        account.isAlmostFull = res.cstrg / res.mstrg >= res.uslw / 10000;

        // Business base/extra quotas:
        if (res.utype === pro.ACCOUNT_LEVEL_BUSINESS || res.utype === pro.ACCOUNT_LEVEL_PRO_FLEXI) {
            account.space_bus_base = res.b ? res.b.bstrg : undefined; // unit TB
            account.space_bus_ext = res.b ? res.b.estrg : undefined; // unit TB
            account.tfsq_bus_base = res.b ? res.b.bxfer : undefined; // unit TB
            account.tfsq_bus_ext = res.b ? res.b.exfer : undefined; // unit TB
            account.tfsq_bus_used = res.b ? res.b.xfer : undefined; // unit B
            account.space_bus_used = res.b ? res.b.strg : undefined; // unit B
        }

        if (res.nextplan) {
            account.nextplan = res.nextplan;
        }

        if (res.mxfer === undefined) {
            delete account.mxfer;
        }

        // If a subscription, get the timestamp it will be renewed
        if (res.stype === 'S') {
            account.srenew = res.srenew;
        }

        if (!Object(res.balance).length || !res.balance[0]) {
            account.balance = [['0.00', 'EUR']];
        }

        return res;
    });

    sendAPIRequest({a: 'uavl'}, true, (res) => {
        if (!Array.isArray(res)) {
            res = [];
        }
        account.vouchers = voucherData(res);
    });

    sendAPIRequest({a: 'maf', v: mega.achievem.RWDLVL}, (res) => {

        account.maf = res;
    });

    if (!is_chatlink) {

        sendAPIRequest({a: 'uga', u: u_handle, ua: '^!rubbishtime', v: 1}, (res) => {

            account.ssrs = base64urldecode(String(res.av || res)) | 0;
        });
    }

    sendAPIRequest({a: 'utt'}, true, (res) => {
        if (!Array.isArray(res)) {
            res = [];
        }
        account.transactions = res;
    });

    // getting contact link [QR]
    // api_req : a=clc     contact link create api method
    //           f=1       a flag to tell the api to create a new link if it doesnt exist.
    //                     but if a previous link was deleted, then dont return any thing (empty)
    sendAPIRequest({a: 'clc', f: 1}, ([, res]) => {

        account.contactLink = typeof res === 'string' ? `C!${res}` : '';
    });

    // Get (f)ull payment history
    // [[payment id, timestamp, price paid, currency, payment gateway id, payment plan id, num of months purchased]]
    sendAPIRequest({a: 'utp', f: 1}, true, (res) => {
        if (!Array.isArray(res)) {
            res = [];
        }
        account.purchases = res;
    });

    /* x: 1, load the session ids
     useful to expire the session from the session manager */
    sendAPIRequest({a: 'usl', x: 1}, true, (res) => {
        if (!Array.isArray(res)) {
            res = [];
        }
        account.sessions = res;
    });


    /**
     * DO NOT place any sendAPIRequest() call AFTER, this 'ug' MUST BE the LAST one!
     */
    /* eslint-disable complexity -- @todo revamp the below mumbo-jumbo */

    promises.push(M.getAccountDetails());

    Promise.allSettled(promises)
        .then((res) => {
            let tmUpdate = false;

            for (let i = res.length; i--;) {
                if (res[i].status !== 'fulfilled') {
                    const a = promises[`<${i}>`];

                    console.warn(`API Request ${a} failed...`, res[i].reason);
                }
            }

            // get 'uq' reply.
            const uqres = res[0].value;

            // override with 'ug' reply.
            res = res.pop().value;

            if (typeof res === 'object') {
                if (res.p) {
                    u_attr.p = res.p;
                    if (u_attr.p) {
                        tmUpdate = true;
                    }
                }
                else {
                    delete u_attr.p;
                    if (pstatus) {
                        tmUpdate = true;
                    }
                }
                if (res.pf) {
                    u_attr.pf = res.pf;
                    tmUpdate = true;
                }
                if (res.b) {
                    u_attr.b = res.b;
                    tmUpdate = true;
                }
                if (res.uspw) {
                    u_attr.uspw = res.uspw;
                }
                else {
                    delete u_attr.uspw;
                }
                if (res.mkt) {
                    u_attr.mkt = res.mkt;
                    if (Array.isArray(u_attr.mkt.dc) && u_attr.mkt.dc.length) {
                        delay('ShowDiscountOffer', pro.propay.showDiscountOffer, 7000);
                    }
                }
                else {
                    delete u_attr.mkt;
                }
                if (res['^!discountoffers']) {
                    u_attr['^!discountoffers'] = base64urldecode(res['^!discountoffers']);
                }
            }

            if (!account.downbw_used) {
                account.downbw_used = 0;
            }

            if (u_attr && pstatus !== u_attr.p) {
                account.justUpgraded = Date.now();

                M.checkStorageQuota(2);

                // If pro status change is recognised revoke storage quota cache
                M.storageQuotaCache = null;
            }

            if (tmUpdate) {
                onIdle(topmenuUI);
            }

            if (uqres) {
                if (!u_attr || !u_attr.p) {
                    if (uqres.tal) {
                        account.bw = uqres.tal;
                    }
                    account.servbw_used = 0;
                }

                if (uqres.tah) {
                    let bwu = 0;

                    for (const w in uqres.tah) {
                        bwu += uqres.tah[w];
                    }

                    account.downbw_used += bwu;
                }
            }

            // Prepare storage footprint stats.
            let cstrgn = account.cstrgn = Object(account.cstrgn);
            const stats = account.stats = Object.create(null);
            let groups = [M.RootID, M.InboxID, M.RubbishID];
            const root = array.to.object(groups);
            const exp = Object(M.su.EXP);

            groups = [...groups, 'inshares', 'outshares', 'links'];
            for (let i = groups.length; i--;) {
                stats[groups[i]] = array.to.object(['items', 'bytes', 'files', 'folders', 'vbytes', 'vfiles'], 0);
                // stats[groups[i]].nodes = [];
            }

            // Add pending out-shares that has no user on cstrgn variable
            const ps = Object.keys(M.ps || {});
            if (ps.length) {
                cstrgn = {
                    ...cstrgn,
                    ...ps
                        .map(h => M.getNodeByHandle(h))
                        .reduce((o, n) => {
                            o[n.h] = [n.tb || 0, n.tf || 0, n.td || 0, n.tvb || 0, n.tvf || 0];
                            return o;
                        }, {})
                };
            }

            for (const handle in cstrgn) {
                const data = cstrgn[handle];
                let target = 'outshares';

                if (root[handle]) {
                    target = handle;
                }
                else if (M.c.shares[handle]) {
                    target = 'inshares';
                }
                // stats[target].nodes.push(handle);

                if (exp[handle] && !M.getNodeShareUsers(handle, 'EXP').length) {
                    continue;
                }

                stats[target].items++;
                stats[target].bytes += data[0];
                stats[target].files += data[1];
                stats[target].folders += data[2];
                stats[target].vbytes += data[3];
                stats[target].vfiles += data[4];
            }

            // calculate root's folders size
            if (M.c[M.RootID]) {
                const t = Object.keys(M.c[M.RootID]);
                const s = Object(stats[M.RootID]);

                s.fsize = s.bytes;
                for (let i = t.length; i--;) {
                    const node = M.d[t[i]] || false;

                    if (!node.t) {
                        s.fsize -= node.s;
                    }
                }
            }

            // calculate public links items/size
            const {links} = stats;
            Object.keys(exp)
                .forEach((h) => {
                    if (M.d[h]) {
                        if (M.d[h].t) {
                            links.folders++;
                            links.bytes += M.d[h].tb || 0;
                        }
                        else {
                            links.bytes += M.d[h].s || 0;
                            links.files++;
                        }
                    }
                    else {
                        if (d) {
                            console.error(`Not found public node ${h}`);
                        }
                        links.files++;
                    }
                });

            account.lastupdate = Date.now();

            if (d) {
                console.log('stats', JSON.stringify(stats));
            }

            if (!account.bw) {
                account.bw = 1024 * 1024 * 1024 * 1024 * 1024 * 10;
            }
            if (!account.servbw_used) {
                account.servbw_used = 0;
            }
            if (!account.downbw_used) {
                account.downbw_used = 0;
            }

            M.account = account;

            // transfers quota
            const tfsq = {max: account.bw, used: account.downbw_used};

            if (u_attr && u_attr.p) {
                tfsq.used += account.servbw_used;
            }
            else if (M.maf) {
                tfsq.used += account.servbw_used;
                const max = M.maf.transfer.base + M.maf.transfer.current;
                if (max) {
                    // has achieved quota
                    tfsq.ach = true;
                    tfsq.max = max;
                }
            }

            const epsilon = 20971520; // E = 20MB

            tfsq.left = Math.max(tfsq.max - tfsq.used, 0);

            if (tfsq.left <= epsilon) {
                tfsq.perc = 100;
            }
            else if (tfsq.left <= epsilon * 5) {
                tfsq.perc = Math.round(tfsq.used * 100 / tfsq.max);
            }
            else {
                tfsq.perc = Math.floor(tfsq.used * 100 / tfsq.max);
            }

            M.account.tfsq = tfsq;

            if (mRootID !== M.RootID) {
                // TODO: Check if this really could happen and fix it...
                console.error('mRootID changed while loading...', mRootID, M.RootID);
            }

            if (typeof cb === 'function') {

                cb(account);
            }
        })
        .catch(reportError)
        .finally(() => {
            loadingDialog.hide();
        });
};

MegaData.prototype.refreshSessionList = function(callback) {
    "use strict";

    if (d) {
        console.log('Refreshing session list');
    }

    const {account} = this;

    if (account) {
        api.req({a: 'usl', x: 1})
            .then(({result}) => {
                if (Array.isArray(result)) {
                    result.sort((a, b) => a[0] < b[0] ? 1 : -1);
                }
                else {
                    result = [];
                }

                account.sessions = result;
            })
            .finally(() => {
                if (typeof callback === 'function') {
                    callback();
                }
            });
    }
    else {
        M.accountData(callback);
    }
};


/**
 * Retrieve general user information once a session has been established.
 * The webclient calls this method after every 'us' request and also upon any session resumption (page reload).
 * Only account information that would be useful for clients in the general pages of the site/apps is returned,
 * with other more specific commands available when the user wants
 * to delve deeper in the account sections of the site/apps.
 * @return {Promise<Object>} user get result
 */
MegaData.prototype.getAccountDetails = function() {
    'use strict';

    return api.req({a: 'ug'})
        .then(({result}) => {
            const {u_attr} = window;

            if (u_attr && typeof result === 'object') {
                const upd = `b,mkt,p,pf,uspw,notifs`.split(',');

                for (let i = upd.length; i--;) {
                    const k = upd[i];

                    if (result[k]) {
                        u_attr[k] = result[k];
                    }
                    else {
                        delete u_attr[k];
                    }
                }

                if (result.ut) {
                    localStorage.apiut = result.ut;
                }

                Object.defineProperty(u_attr, 'flags', {
                    configurable: true,
                    value: freeze(result.flags || {})
                });
                mBroadcaster.sendMessage('global-mega-flags', u_attr.flags);

                if (self.notify && notify.checkForNotifUpdates) {
                    tryCatch(() => notify.checkForNotifUpdates())();
                }
            }

            return result;
        });
};

/**
 * Show the Master/Recovery Key dialog
 * @param {Number} [version] Dialog version, 1: post-register, otherwise default one.
 */
MegaData.prototype.showRecoveryKeyDialog = function(version) {
    'use strict';

    var $dialog = $('.mega-dialog.recovery-key-dialog').removeClass('post-register');
    $('i.js-key', $dialog).removeClass('shiny');

    // TODO: Implement this on mobile
    if (!$dialog.length) {
        if (d) {
            console.debug('recovery-key-dialog not available...');
        }
        return;
    }

    M.safeShowDialog('recovery-key-dialog', () => {

        $('.skip-button, button.js-close', $dialog).removeClass('hidden').rebind('click', closeDialog);
        $('.copy-recovery-key-button', $dialog).removeClass('hidden').rebind('click', () => {
            // Export key showing a toast message
            u_exportkey(l[6040]);
        });
        $('footer', $dialog).removeClass('hidden');
        $('.content-block', $dialog).removeClass('dialog-bottom');
        $('header.graphic', $dialog).removeClass('hidden');

        switch (version) {
            case 1:
                $('.skip-button', $dialog).removeClass('hidden');
                $('button.js-close', $dialog).addClass('hidden');
                $('.copy-recovery-key-button', $dialog).addClass('hidden');
                $('i.js-key', $dialog).addClass('shiny');
                $dialog.addClass('post-register').rebind('dialog-closed', () => {
                    eventlog(localStorage.recoverykey ? 99718 : 99719);
                    $dialog.unbind('dialog-closed');
                });
                break;
            case 2:
                $('.skip-button', $dialog).addClass('hidden');
                $('button.js-close', $dialog).removeClass('hidden');
                $('.copy-recovery-key-button', $dialog).addClass('hidden');
                $('footer', $dialog).addClass('hidden');
                $('.content-block', $dialog).addClass('dialog-bottom');
                $('i.js-key', $dialog).addClass('shiny');
                $('header.graphic', $dialog).addClass('hidden');
                $dialog.addClass('post-register');
                break;
        }

        $('.save-recovery-key-button', $dialog).rebind('click', () => {
            if ($dialog.hasClass('post-register')) {
                M.safeShowDialog('recovery-key-info', () => {
                    // Show user recovery key info warning
                    $dialog.addClass('hidden').removeClass('post-register');
                    $dialog = $('.mega-dialog.recovery-key-info');

                    // On button click close dialog
                    $('.close-dialog, button.js-close', $dialog).rebind('click', closeDialog);

                    return $dialog;
                });
            }

            // Save Recovery Key to disk.
            u_savekey();

            // Show toast message.
            showToast('recoveryKey', l[8922]);
        });

        // Automatically select all string when key is clicked.
        $('#backup_keyinput_2fa', $dialog).rebind('click.backupRecoveryKey', function() {
            this.select();
        });

        // Update localStorage.recoveryKey when user copied his/her key.
        $('#backup_keyinput_2fa', $dialog).rebind('copy.backupRecoveryKey', function() {

            var selection = document.getSelection();

            // If user is fully selected key and copy it completely.
            if (selection.toString() === this.value) {

                mBroadcaster.sendMessage('keyexported');

                if (!localStorage.recoverykey) {
                    localStorage.recoverykey = 1;
                    $('body').addClass('rk-saved');
                }
            }

        });

        $('a.toResetLink', $dialog).rebind('click', () => {
            closeDialog();
            loadingDialog.show();

            api.req({a: 'erm', m: u_attr.email, t: 9})
                .then(({result}) => {
                    assert(result === 0);
                    if (is_mobile) {
                        msgDialog('info', '', l[735]);
                    }
                    else {
                        fm_showoverlay();
                        $('.mega-dialog.account-reset-confirmation').removeClass('hidden');
                    }
                })
                .catch((ex) => {
                    if (ex === ENOENT) {
                        return msgDialog('warningb', l[1513], l[1946]);
                    }
                    tell(ex);
                })
                .finally(() => {
                    loadingDialog.hide();
                });

            return false;
        });

        $('.recovery-key.input-wrapper input', $dialog).val(a32_to_base64(u_k));

        return $dialog;
    });
};

/**
 * Show the Contact Verification dialog
 * @return {Object} contact verification dialog
 */
MegaData.prototype.showContactVerificationDialog = function() {
    'use strict';

    var $dialog = $('.mega-dialog.contact-verification-dialog');

    // TODO: Implement this on mobile
    if (!$dialog.length) {
        if (d) {
            console.debug('contact-verification-dialog not available...');
        }
        return;
    }
    $('button.js-close', $dialog).removeClass('hidden').rebind('click', closeDialog);

    // Don't show to new user
    if (u_attr.since > 1697184000 || mega.keyMgr.getWarningValue('cvd')
        || mega.keyMgr.getWarningValue('cv') !== false) {
        return;
    }

    M.safeShowDialog('contact-verification-dialog', () => {
        // Set warning value for contact verificaiton dialog
        mega.keyMgr.setWarningValue('cvd', '1');

        // Automatically select all string when key is clicked.
        $('.dialog-approve-button', $dialog).rebind('click.cv', () => {
            $('.fm-account-contact-chats', accountUI.$contentBlock).removeClass('hidden');
            closeDialog();
            M.openFolder('account/contact-chats/contact-verification-settings', true);
        });
        return $dialog;
    });
};


MegaData.prototype.showPaymentCardBanner = function(status) {
    'use strict';

    const $banner = $('.fm-notification-block.payment-card-status')
        .removeClass('payment-card-almost-expired payment-card-expired visible');
    if (!status) {
        return;
    }

    $('.notification-block-icon', $banner)
        .removeClass('icon-alert-triangle-thin-outline icon-alert-circle-thin-outline')
        .addClass(`icon-alert-${status === 'exp' ? 'triangle' : 'circle'}-thin-outline`);

    let bannerTitle;
    let bannerDialog = u_attr && u_attr.b ? l.payment_card_update_details_b : l.payment_card_update_details;
    let isExpiredClassName = 'payment-card-almost-expired';
    // Expired
    if (status === 'exp') {
        bannerTitle = l.payment_card_exp_b_title;
        bannerDialog = u_attr && u_attr.b ? l.payment_card_at_risk_b : l.payment_card_at_risk;

        isExpiredClassName = 'payment-card-expired';
        const $dialog = $('.payment-reminder.payment-card-expired');

        $('.close', $dialog).rebind('click', closeDialog);

        $('.update-payment-card', $dialog)
            .rebind('click', () => {
                closeDialog();
                loadSubPage('fm/account/plan/account-card-info');
            });

        M.safeShowDialog('expired-card-dialog', $dialog);
    }
    // Expires this month
    else if (status === 'expThisM') {
        bannerTitle = l.payment_card_almost_exp;
    }
    // Expires next month (only show from the 15th of the current month)
    else if (status === 'expNextM') {
        bannerTitle = l.payment_card_exp_nxt_mnth;
    }
    else {
        return;
    }

    $('a', $banner).rebind('click', loadSubPage.bind(null, 'fm/account/plan/account-card-info'));

    $banner.addClass(`visible ${isExpiredClassName}`);
    $('.banner-title', $banner).text(bannerTitle);
    $('.banner-txt', $banner).text(bannerDialog);
};


/**
 * Show storage overquota dialog
 * @param {*} quota Storage quota data, as returned from M.getStorageQuota()
 * @param {Object} [options] Additional options
 */
MegaData.prototype.showOverStorageQuota = function(quota, options) {
    'use strict';

    if (quota === undefined && options === undefined) {
        return Promise.reject(EARGS);
    }

    if (!pro.membershipPlans || !pro.membershipPlans.length) {
        return new Promise((resolve, reject) => {
            pro.loadMembershipPlans(() => {
                if (!pro.membershipPlans || !pro.membershipPlans.length) {
                    reject(EINCOMPLETE);
                }
                else {
                    M.showOverStorageQuota(quota, options).then(resolve).catch(reject);
                }
            });
        });
    }
    const {promise} = mega;

    if (quota && quota.isFull && Object(u_attr).uspw) {
        // full quota, and uspw exist --> overwrite the full quota warning.
        quota = EPAYWALL;
    }

    var $strgdlg = $('.mega-dialog.storage-dialog').removeClass('full almost-full');
    var $strgdlgBodyFull = $('.fm-dialog-body.storage-dialog.full', $strgdlg).removeClass('odq');
    var $strgdlgBodyAFull = $('.fm-dialog-body.storage-dialog.almost-full', $strgdlg);

    var prevState = $('.fm-main').is('.almost-full, .full');
    $('.fm-main').removeClass('fm-notification almost-full full');
    var $odqWarn = $('.odq-warning', $strgdlgBodyFull).addClass('hidden');
    var $upgradeBtn = $('.choose-plan span', $strgdlg).text(l[8696]);
    const $headerFull = $('header h2.full', $strgdlg);
    const $estimatedPriceText = $('.estimated-price-text', $strgdlg);
    const $rubbishBinText = $('.rubbish-text', $strgdlg).toggleClass('hidden', quota === EPAYWALL);

    let upgradeTo;
    let isEuro;
    let lowestPlanLevel;

    if (quota === EPAYWALL) { // ODQ paywall

        if (!this.account) {
            return new Promise((resolve, reject) => {
                this.accountData(() => {
                    if (!this.account) {
                        return reject(EINTERNAL);
                    }
                    this.showOverStorageQuota(quota, options).then(resolve).catch(reject);
                });
            });
        }
        $('.fm-main').addClass('fm-notification full');

        $strgdlg.addClass('full');
        $('.body-header', $strgdlgBodyFull).text(l[23519]);

        var dlgTexts = odqPaywallDialogTexts(u_attr || {}, M.account);
        $('.body-p.long', $strgdlgBodyFull).safeHTML(dlgTexts.dialogText);

        $strgdlgBodyFull.addClass('odq');
        $odqWarn.removeClass('hidden');
        $upgradeBtn.text(l[5549]);
        $headerFull.text(l[16360]);

        $('.storage-dialog.body-p', $odqWarn).safeHTML(dlgTexts.dlgFooterText);

        $('.fm-notification-block.full').safeHTML(
            `<i class="notification-block-icon sprite-fm-mono icon-offline"></i>
            <span>${dlgTexts.fmBannerText}</span>`);
    }
    else {
        if (quota === -1) {
            quota = { percent: 100 };
            quota.isFull = quota.isAlmostFull = true;
            options = { custom: 1 };
        }

        const lowestRequiredPlan = pro.filter.lowestRequired(quota.cstrg || '', 'storageTransferDialogs');

        let upgradeString;
        isEuro = !lowestRequiredPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];

        lowestPlanLevel = lowestRequiredPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];

        // If user requires lowest available plan (Pro Lite or a Mini plan)
        if (pro.filter.simple.lowStorageQuotaPlans.has(lowestPlanLevel)) {
            upgradeString = isEuro
                ? l[16313]
                : l.cloud_strg_upgrade_price_ast;
            upgradeTo = 'min';
        }
        // If user requires pro flexi
        else if (lowestPlanLevel === pro.ACCOUNT_LEVEL_PRO_FLEXI) {
            upgradeString = l.over_storage_upgrade_flexi;
            upgradeTo = 'flexi';
        }
        // User requires a regular plan
        else {
            upgradeString = l.over_storage_upgrade_pro;
            upgradeTo = 'regular';
        }

        const planName = pro.getProPlanName(lowestPlanLevel);

        const localPrice = isEuro
            ? lowestRequiredPlan[pro.UTQA_RES_INDEX_PRICE]
            : lowestRequiredPlan[pro.UTQA_RES_INDEX_LOCALPRICE];

        const localCurrency = isEuro
            ? 'EUR'
            : lowestRequiredPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];

        if (upgradeTo !== 'flexi') {
            upgradeString = upgradeString.replace('%1', planName)
                .replace('%2', formatCurrency(localPrice, localCurrency, 'narrowSymbol'))
                .replace('%3', bytesToSize(lowestRequiredPlan[pro.UTQA_RES_INDEX_STORAGE] * pro.BYTES_PER_GB, 0))
                .replace('%4', bytesToSize(lowestRequiredPlan[pro.UTQA_RES_INDEX_TRANSFER] * pro.BYTES_PER_GB, 0));
        }

        $('.body-p.main-text', $strgdlgBodyFull).text(upgradeString);
        $('.body-p.main-text', $strgdlgBodyAFull).text(upgradeString);

        const maxStorage = bytesToSize(pro.maxPlan[2] * pro.BYTES_PER_GB, 0) +
            ' (' + pro.maxPlan[2] + ' ' + l[17696] + ')';

        var myOptions = Object(options);
        if (quota.isFull) {
            $strgdlg.addClass('full');
            $('.fm-main').addClass('fm-notification full');
            $('header h2', $strgdlgBodyFull).text(myOptions.title || l[16302]);
            $('.body-header', $strgdlgBodyFull).safeHTML(myOptions.body || l[16360]);
            $headerFull.text(l.cloud_strg_100_percent_full);
        }
        else if (quota.isAlmostFull || myOptions.custom) {
            if (quota.isAlmostFull) {
                $('.fm-main').addClass('fm-notification almost-full');
                if (mega.tpw.initialized && mega.tpw.isWidgetVisibile()) {
                    mega.tpw.showAlmostOverquota();
                }
            }
            $strgdlg.addClass('almost-full');
            $('header h2.almost-full', $strgdlg).text(myOptions.title || l[16312]);
            if (myOptions.body) {
                $('.body-header', $strgdlgBodyAFull).safeHTML(myOptions.body);
            }

            // Storage chart and info
            var strQuotaLimit = bytesToSize(quota.mstrg, 0).split('\u00A0');
            var strQuotaUsed = bytesToSize(quota.cstrg);
            var $storageChart = $('.fm-account-blocks.storage', $strgdlg);

            var fullDeg = 360;
            var deg = fullDeg * quota.percent / 100;

            // Used space chart
            if (quota.percent < 50) {
                $('.left-chart span', $storageChart).css('transform', 'rotate(180deg)');
                $('.right-chart span', $storageChart).css('transform', `rotate(${180 - deg}deg)`);
                $('.right-chart', $storageChart).addClass('low-percent-clip');
                $('.left-chart', $storageChart).addClass('low-percent-clip');
            }
            else {
                $('.left-chart span', $storageChart).css('transform', 'rotate(180deg)');
                $('.right-chart span', $storageChart).css('transform', `rotate(${(deg - 180) * -1}deg)`);
                $('.right-chart', $storageChart).removeClass('low-percent-clip');
                $('.left-chart', $storageChart).removeClass('low-percent-clip');
            }

            $('.chart.data .size-txt', $strgdlg).text(strQuotaUsed);
            $('.chart.data .pecents-txt', $strgdlg).text(strQuotaLimit[0]);
            $('.chart.data .gb-txt', $strgdlg).text(strQuotaLimit[1]);
            $('.chart.body .perc-txt', $strgdlg).text(quota.percent + '%');

        }
        else {
            if ($strgdlg.is(':visible')) {
                window.closeDialog();
            }
            $('.fm-main').removeClass('fm-notification almost-full full');

            return Promise.reject();
        }

        $('.fm-notification-block.full')
            .safeHTML(
                `<i class="notification-block-icon sprite-fm-mono icon-offline"></i>
                <span>${l[22667].replace('%1', maxStorage)}</span>`);

        $('.fm-notification-block.almost-full')
            .safeHTML(
                `<i class="notification-block-icon sprite-fm-mono icon-offline"></i>
                <span>${l[22668].replace('%1', maxStorage)}</span>
                <i class="fm-notification-close sprite-fm-mono icon-close-component"></i>`);

    }

    var closeDialog = function() {
        $strgdlg.off('dialog-closed');
        window.closeDialog();
        promise.resolve();
    };

    $strgdlg.rebind('dialog-closed', closeDialog);

    $upgradeBtn.text(quota.isFull ? l.upgrade_now : l[433]);
    $estimatedPriceText.toggleClass('hidden', isEuro || (upgradeTo !== 'min'));

    $('button', $strgdlg).rebind('click', function() {
        var $this = $(this);
        if ($this.hasClass('disabled')) {
            return false;
        }
        closeDialog();

        if (lowestPlanLevel && pro.filter.simple.miniPlans.has(lowestPlanLevel)) {
            // Show the user the exclusive offer section of the pro page
            sessionStorage.mScrollTo = 'exc';
        }
        else if (upgradeTo === 'flexi') {
            // Scroll to flexi section of pro page
            sessionStorage.mScrollTo = 'flexi';
        }

        loadSubPage('pro');

        return false;
    });

    $('button.js-close, button.skip', $strgdlg).rebind('click', closeDialog);

    $('button.skip', $strgdlg).toggleClass('hidden', upgradeTo === 'min');

    $('.fm-notification-block .fm-notification-close')
        .rebind('click', function() {
            $('.fm-main').removeClass('fm-notification almost-full full');
            $.tresizer();
        });

    clickURLs();

    if (quota && quota.isFull && page === 'fm/dashboard') {
        $('a.dashboard-link', $strgdlg).rebind('click.dashboard', e => {
            e.preventDefault();
            closeDialog();
        });
    }

    $('a', $rubbishBinText).attr('href', '/fm/' + M.RubbishID)
        .rebind('click', function() {
            closeDialog();
            loadSubPage('fm/' + M.RubbishID);
            return false;
        });


    // if another dialog wasn't opened previously
    if (!prevState || Object(options).custom || quota === EPAYWALL) {
        M.safeShowDialog('over-storage-quota', $strgdlg);
    }
    else {
        promise.reject();
    }

    if (!prevState) {
        // On the banner appearance or disappearance, lets resize height of fm.
        $.tresizer();
    }

    return promise;
};

// ---------------------------------------------------------------------------

function voucherData(arr) {
    var vouchers = [];
    var varr = arr[0];
    var tindex = {};
    for (var i in arr[1]) {
        tindex[arr[1][i][0]] = arr[1][i];
    }
    for (var i in varr) {
        var redeemed = 0;
        var cancelled = 0;
        var revoked = 0;
        var redeem_email = '';
        if ((varr[i].rdm) && (tindex[varr[i].rdm])) {
            redeemed = tindex[varr[i].rdm][1];
            redeem_email = tindex[varr[i].rdm][2];
        }
        if (varr[i].xl && tindex[varr[i].xl]) {
            cancelled = tindex[varr[i].xl][1];
        }
        if (varr[i].rvk && tindex[varr[i].rvk]) {
            revoked = tindex[varr[i].rvk][1];
        }
        vouchers.push({
            id: varr[i].id,
            amount: varr[i].g,
            currency: varr[i].c,
            iss: varr[i].iss,
            date: tindex[varr[i].iss][1],
            code: varr[i].v,
            redeemed: redeemed,
            redeem_email: redeem_email,
            cancelled: cancelled,
            revoked: revoked
        });
    }
    return vouchers;
}

mBroadcaster.once('fm:initialized', () => {
    'use strict';

    if (u_attr && (u_attr.p || u_attr.b)) {

        if (M.account && M.account.cce) {
            M.showPaymentCardBanner(M.account.cce);
        }
        else {
            M.updatePaymentCardState().catch(dump);
        }
    }
});

MegaData.prototype.contactstatus = function(h, wantTimeStamp) {
    var folders = 0;
    var files = 0;
    var ts = 0;
    if (this.d[h]) {
        if (!wantTimeStamp || !this.d[h].ts) {
            // FIXME: include root?
            var a = this.getNodesSync(h);

            for (var i = a.length; i--;) {
                var n = this.d[a[i]];
                if (n) {
                    if (ts < n.ts) {
                        ts = n.ts;
                    }
                    if (n.t) {
                        folders++;
                    }
                    else if (!n.fv) {
                        files++;
                    }
                }
            }
            if (!this.d[h].ts) {
                this.d[h].ts = ts;
            }
        }
        else {
            ts = this.d[h].ts;
        }
    }

    return {files: files, folders: folders, ts: ts};
};

MegaData.prototype.onlineStatusClass = function(os) {
    if (os === 4 || os === 'dnd') {
        // UserPresence.PRESENCE.DND
        return [l[5925], 'busy'];
    }
    else if (os === 2 || os === 'away') {
        // UserPresence.PRESENCE.AWAY
        return [l[5924], 'away'];
    }
    else if (os === 3 || os === 'chat' || os === 'available') {
        // UserPresence.PRESENCE.ONLINE
        return [l[5923], 'online'];
    }
    else if (os === 1 || os === 'offline') {
        return [l[5926], 'offline'];
    }
    else {
        return ['', 'black'];
    }
};

MegaData.prototype.onlineStatusEvent = function(u, status) {
    'use strict';

    if (u instanceof MegaDataObject) {
        var $elm = $('.ustatus.' + u.u);
        if ($elm.length) {
            $elm.removeClass('offline online busy away');
            $elm.addClass(this.onlineStatusClass(status)[1]);
        }

        $elm = $('.fm-chat-user-status.' + u.u);
        if ($elm.length) {
            u = this.onlineStatusClass(status)[0];

            if (u) {
                $elm.safeHTML(u);
            }
            else {
                $elm.text('');
            }
        }
    }
};

/**
 * getContactsEMails
 *
 * Loop through all available contacts, full and pending ones (outgoing and incomming)
 * and creates a list of contacts email addresses.
 * @returns {Array} contacts, array of contacts email.
 */
MegaData.prototype.getContactsEMails = function(excludeRequests) {
    var contact;
    var contacts = [];
    var contactName;

    // Loop through full contacts
    M.u.forEach(function(contact) {
        // Active contacts with email set
        if (contact.c === 1 && contact.m) {
            contacts.push({
                id: contact.m, name: M.getNameByHandle(contact.u), handle: contact.u,
                contactType: 'active'
            });
        }
    });

    if (!excludeRequests) {
        // Loop through outgoing pending contacts
        for (var k in M.opc) {
            contact = M.opc[k];
            contactName = M.getNameByHandle(M.opc[k].p);

            // Is contact deleted
            if (!contact.dts) {
                contacts.push({ id: contact.m, name: contactName, handle: M.opc[k].p, contactType: 'opc' });
            }
        }

        // Loop through incomming pending contacts
        for (var m in M.ipc) {
            contact = M.ipc[m];
            contactName = M.getNameByHandle(M.ipc[m].p);

            // Is there a email available
            if (contact.m) {
                contacts.push({ id: contact.m, name: contactName, handle: M.ipc[m].p, contactType: 'ipc' });
            }
        }
    }

    // Sort contacts by name in ascending order
    contacts.sort(function(contactA, contactB) {
        return contactA.name.localeCompare(contactB.name);
    });

    return contacts;
};

MegaData.prototype.getActiveContacts = function() {
    var res = [];

    if (typeof this.c.contacts === 'object') {
        Object.keys(this.c.contacts)
            .forEach(function(userHandle) {
                if (Object(M.u[userHandle]).c === 1) {
                    res.push(userHandle);
                }
            });
    }

    return res;
};

// eslint-disable-next-line complexity
MegaData.prototype.syncUsersFullname = async function(userId, chatHandle) {
    "use strict";
    const user = userId in this.u && this.u[userId] || false;
    const {name} = user;

    if (user.firstName || user.lastName) {
        // already loaded.
        return name;
    }

    const attrs = await Promise.allSettled([
        mega.attr.get(userId, 'lastname', -1, false, undefined, undefined, chatHandle),
        mega.attr.get(userId, 'firstname', -1, false, undefined, undefined, chatHandle)
    ]);

    for (let i = attrs.length; i--;) {
        const obj = attrs[i];

        // -1, -9, -2, etc...
        if (typeof obj.value === 'string') {
            // eslint-disable-next-line local-rules/hints
            try {
                obj.value = from8(base64urldecode(obj.value));
            }
            catch (ex) {
                obj.value = null;
            }
        }

        if (typeof obj.value !== 'string' || !obj.value) {
            obj.value = '';
        }
    }

    user.name = "";
    user.lastName = attrs[0].value.trim();
    user.firstName = attrs[1].value.trim();

    if (user.firstName || user.lastName) {
        user.name = `${user.firstName}${user.firstName.length ? " " : ""}${user.lastName}`;

        // Get the nickname if available otherwise get the user name
        const userName = nicknames.getNickname(userId);

        if (M.currentdirid === 'shares') {// Update right panel list and block view
            $(`.shared-grid-view .${userId} .fm-chat-user`).text(userName);
            $(`.inbound-share .${userId} ~> .shared-folder-info`).text(l[17590].replace('%1', userName));
        }
        else if (M.currentrootid === 'shares') {
            $(`.shared-details-info-block .${userId} ~> .fm-chat-user`).text(`${userName} <${user.m}>`);
        }
    }

    if (nicknames.cache[userId]) {
        user.nickname = nicknames.cache[userId];
    }

    // only clear old avatar if the old one was a text one and was different then the new names
    if (user.avatar && user.avatar.type !== "image" && name !== user.name) {
        user.avatar = false;
        useravatar.loaded(userId);
    }

    if (userId === u_handle) {
        u_attr.firstname = user.firstName;
        u_attr.lastname = user.lastName;
        u_attr.name = user.name;

        $('.user-name, .top-menu-logged .name, .membership-big-txt.name').text(u_attr.fullname);
        if (!is_mobile && M.currentdirid === 'account') {
            accountUI.account.profiles.renderFirstName();
            accountUI.account.profiles.renderLastName();
        }
    }

    // check if this first name + last belongs to business sub-user
    // we added here to avoid re-calling get attribute + minimize the need of code refactoring
    if (u_attr && u_attr.b && u_attr.b.m && M.suba && M.suba[userId]) {
        M.require('businessAcc_js', 'businessAccUI_js')
            .then(() => {
                var business = new BusinessAccount();
                var subUser = M.suba[userId];
                subUser.lastname = base64urlencode(to8(user.lastName));
                subUser.firstname = base64urlencode(to8(user.firstName));

                business.parseSUBA(subUser, false, true);
            });
    }

    if ($.dialog === 'share') {
        // Re-render the content of access list in share dialog to update contacts' latest names
        renderShareDialogAccessList();
    }

    return user.name;
};

// eslint-disable-next-line complexity
MegaData.prototype.syncContactEmail = async function(userHash, forced) {
    'use strict';
    const user = userHash in this.u && this.u[userHash] || false;
    if (user.m) {
        return user.m;
    }

    if (megaChatIsReady && megaChat.FORCE_EMAIL_LOADING) {
        forced = true;
    }

    if (!forced && (is_chatlink || !user || user.c !== 1 && user.c !== 2)) {
        return Promise.reject(EINCOMPLETE);
    }

    let cache = false;
    let data = await Promise.resolve(attribCache.getItem(`${userHash}_uge+`)).catch(nop);

    if (!data) {
        cache = true;
        data = await api.send({a: 'uge', u: userHash}).catch(echo);
    }

    if (typeof data === 'string' && data[0] === '[') {
        data = JSON.parse(data);
    }

    if (!Array.isArray(data)) {
        data = [data, Infinity];
    }

    let email = data[0];
    const expiry = data[1];

    console.assert(typeof email !== 'string' || email.includes('@'));
    if (typeof email !== 'string' || !email.includes('@')) {
        console.assert(email === ENOENT, `email is ${email}`);
        email = ENOENT;
    }

    if (cache === true) {
        attribCache.setItem(`${userHash}_uge+`, JSON.stringify([email, Date.now() + 7e6]));
    }

    if (email === ENOENT) {
        if (Date.now() > expiry) {
            console.assert(!cache);
            throw EEXPIRED;
        }

        email = undefined;
    }
    else if (user && user.m !== email) {
        user.m = email;
    }

    return email || Promise.reject(ENOENT);
};

(function() {
    "use strict";

    /**
     * Set new user into map store and returns it
     * @param {String} u_h user handle
     * @param {MegaDataObject|Object} [obj] store
     * @returns {MegaDataObject} stored user
     */
    MegaData.prototype.setUser = function(u_h, obj) {
        if (!(u_h in this.u)) {
            if (!(obj instanceof MegaDataObject)) {

                obj = new MegaDataObject(MEGA_USER_STRUCT, Object.assign({h: u_h, u: u_h, m: '', c: undefined}, obj));
            }
            this.u.set(u_h, obj);
        }
        return this.u[u_h];
    };

    /**
     * addUser, updates global .u variable with new user data
     * adds/updates user indexedDB with newest user data
     *
     * @param {object} u, user object data
     * @param {boolean} ignoreDB, don't write to indexedDB
     */
    MegaData.prototype.addUser = function(u, ignoreDB) {
        if (u && u.u) {
            var user = u.u in this.u && this.u[u.u];

            if (user) {
                for (var key in u) {
                    if (key !== 'name' && key in MEGA_USER_STRUCT) {

                        if (u[key] !== user[key]) {

                            user[key] = u[key];
                        }
                    }
                    else if (d) {
                        console.warn('addUser: property "%s" not updated.', key, u[key]);
                    }
                }
            }
            else {
                user = this.setUser(u.u, u);
            }

            if (fmdb && !ignoreDB) {
                fmdb.add('u', {u: u.u, d: {...user.toJS()}});
            }

            if (user.c === 1 || user.u === window.u_handle) {

                if (!ignoreDB) {
                    user.lastName = '';
                    user.firstName = '';
                    attribCache.removeItem(`${user.u}_lastname`);
                    attribCache.removeItem(`${user.u}_firstname`);
                }

                if (!user.m) {
                    // If the email isn't already present, try to fetch it.
                    this.syncContactEmail(user.u, true).catch(nop);
                }
                this.syncUsersFullname(user.u, is_chatlink.ph).catch(dump);

                if (megaChatIsReady && megaChat.plugins.presencedIntegration) {
                    megaChat.plugins.presencedIntegration.eventuallyAddPeer(user.u);
                }
            }
        }
    };
})();

// Update M.opc and related localStorage
MegaData.prototype.addOPC = function(u, ignoreDB) {
    'use strict';

    if (fmdb && !ignoreDB && !pfkey) {
        const d = {...u};

        // Filter out values we don't need to persist.
        delete d.a;
        delete d.i;
        delete d.st;
        delete d.usn;
        if (!d.msg || d.msg === l[17738]) {
            // default invite message.
            delete d.msg;
        }

        fmdb.add('opc', {p: d.p, d});
    }
    this.opc[u.p] = u;
};

/**
 * Delete opc record from localStorage using id
 *
 * @param {string} id
 *
 */
MegaData.prototype.delOPC = function(id) {
    'use strict';

    if (fmdb && !pfkey) {
        fmdb.del('opc', id);
    }
    delete this.opc[id];
};

// Update M.ipc and related localStorage
MegaData.prototype.addIPC = function(u, ignoreDB) {
    'use strict';

    if (fmdb && !ignoreDB && !pfkey) {
        const d = {...u};

        // Filter out values we don't need to persist.
        delete d.a;
        delete d.i;
        delete d.st;
        delete d.usn;
        if (!d.msg || d.msg === l[17738]) {
            // default invite message.
            delete d.msg;
        }

        fmdb.add('ipc', {p: d.p, d});
    }
    this.ipc[u.p] = u;
};

/**
 * Delete ipc record from indexedDb using id
 *
 * @param {string} id
 *
 */
MegaData.prototype.delIPC = function(id) {
    'use strict';

    if (fmdb && !pfkey) {
        fmdb.del('ipc', id);
    }
    delete this.ipc[id];
};

/**
 * Update M.ps and indexedDb
 *
 * Structure of M.ps
 * <shared_item_id>:
 * [
 *  <pending_contact_request_id>:
 *  {h, p, r, ts},
 * ]
 * @param {JSON} ps, pending share
 * @param {boolean} ignoreDB
 *
 *
 */
MegaData.prototype.addPS = function(ps, ignoreDB) {
    if (!this.ps[ps.h]) {
        this.ps[ps.h] = Object.create(null);
    }
    this.ps[ps.h][ps.p] = ps;

    if (fmdb && !ignoreDB && !pfkey) {
        fmdb.add('ps', {h_p: ps.h + '*' + ps.p, d: ps});
    }

    // maintain special outgoing shares index by user:
    if (!this.su[ps.p]) {
        this.su[ps.p] = Object.create(null);
    }
    this.su[ps.p][ps.h] = 2;
};

/**
 * Maintain .ps and related indexedDb
 *
 * @param {string} pcrId, pending contact request id
 * @param {string} nodeId, shared item id
 *
 *
 */
MegaData.prototype.delPS = function(pcrId, nodeId) {

    // Delete the pending share
    if (this.ps[nodeId]) {
        if (this.ps[nodeId][pcrId]) {
            delete this.ps[nodeId][pcrId];
        }

        // If there's no pending shares for node left, clean M.ps
        if (Object.keys(this.ps[nodeId]).length === 0) {
            delete this.ps[nodeId];
        }
    }

    // clear pending share history from M.su
    if (M.su[pcrId] && M.su[pcrId][nodeId] === 2) {
        delete M.su[pcrId][nodeId];
    }

    if (fmdb && !pfkey) {
        fmdb.del('ps', nodeId + '*' + pcrId);
    }
};

/**
 * Invite contacts using email address, also known as ongoing pending contacts.
 * This uses API 3.0
 *
 * @param {String} owner, account owner email address.
 * @param {String} target, target email address.
 * @param {String} msg, optional custom text message.
 * @param {String} contactLink, optional contact link.
 * @returns {Promise<Number|String>} proceed, API response code, if negative something is wrong
 * look at API response code table.
 */
MegaData.prototype.inviteContact = async function(owner, target, msg, contactLink) {
    "use strict";

    // since we have the possibility of having cached attributes of the user we are inviting
    // we will remove the cached attrs to allow API request.
    // this was done due to cases when a user changes his name, then we invite him
    // in other cases when the user is in contacts list, it will be updated with APs.
    // 1- check if we have cache
    if (attribCache) {
        var userHandle = null;
        // 2- check if we cache this user. then get his handle
        for (var us in M.u) {
            if (M.u[us] && M.u[us].m && M.u[us].m === target) {
                userHandle = us;
                break;
            }
        }
        // 3- if we found the user, remove the cached attrs.
        if (userHandle) {
            var userKeys = [userHandle + '_lastname', userHandle + '_firstname'];
            for (var k = 0; k < userKeys.length; k++) {
                attribCache.removeItem(userKeys[k]);
            }
            M.u[userHandle].firstName = '';
            M.u[userHandle].lastName = '';

            M.syncUsersFullname(userHandle);
        }
    }

    if (d) {
        console.group('inviteContact', target);
    }

    const request = {'a': 'upc', 'u': target, 'e': owner, 'aa': 'a'};
    if (contactLink && contactLink.length) {
        request.cl = contactLink;
    }
    if (msg && msg.length) {
        request.msg = msg;
    }

    return api.screq(request)
        .then(({result}) => {

            // In case of invite-dialog we will use notifications
            if ($.dialog !== 'invite-friend') {
                this.inviteContactMessageHandler(result.p);
            }

            return result.m;
        })
        .catch((ex) => this.inviteContactMessageHandler(ex))
        .finally(() => d && console.groupEnd());
};

/**
 * Handle all error codes for contact invitations and shows message
 *
 * @param {int} errorCode
 * @param {string} msg Can be undefined
 * @param {email} email  Can be undefined
 *
 */
MegaData.prototype.inviteContactMessageHandler = function(errorCode) {
    if (errorCode === -12) {

        // Invite already sent, and not expired
        msgDialog('info', '', 'Invite already sent, waiting for response');
    }
    else if (errorCode === -10) {

        // User already sent you an invitation
        msgDialog('info', '', 'User already sent you an invitation, check incoming contacts dialog');
    }
    else if (errorCode === -2) {

        // User already exist or owner
        msgDialog('info', '', l[1783]);
    }
    // EOVERQUOTA err
    else if (errorCode === -17) {
        msgDialog('info', '', l.invalid_invitation_sent);
    }
};

MegaData.prototype.cancelPendingContactRequest = async function(target) {
    'use strict';

    if (d) {
        console.debug('cancelPendingContactRequest', target);
    }

    const {opc} = M;
    let foundEmail = false;

    for (const i in opc) {
        if (opc[i].m === target) {
            // opc is already deleted
            if (!opc[i].dts) {
                foundEmail = true;
            }
            break;
        }
    }

    if (!foundEmail) {
        // opc doesn't exist for given email
        return Promise.reject(EARGS);
    }

    return api.screq({'a': 'upc', 'u': target, 'aa': 'd'});
};

MegaData.prototype.reinvitePendingContactRequest = function(target) {
    'use strict';

    if (d) {
        console.debug('reinvitePendingContactRequest');
    }
    return api.screq({'a': 'upc', 'u': target, 'aa': 'r'});
};

// Answer on 'aa':'a', {"a":"upc","p":"0uUure4TCJw","s":2,"uts":1416434431,"ou":"fRSlXWOeSfo","i":"UAouV6Kori"}
// Answer on 'aa':'i', "{"a":"upc","p":"t17TPe65rMM","s":1,"uts":1416438884,"ou":"nKv9P8pn64U","i":"qHzMjvvqTY"}"
MegaData.prototype.ipcRequestHandler = async function(id, action) {
    'use strict';
    if (d) {
        console.group('ipcRequestHandler', id, action);
    }

    let found = false;
    const {ipc} = this;
    for (const i in ipc) {
        if (ipc[i].p === id) {
            found = true;
            break;
        }
    }

    if (!found) {
        return Promise.reject(EARGS);
    }

    return api.screq({'a': 'upca', 'p': id, 'aa': action})
        .catch((ex) => {
            if (ex === -2) {
                msgDialog('info', 'Already processed', 'Already handled request, something went wrong.');
            }
            else if (ex === -3 || ex === -4) {
                // Server busy, ask them to retry the request
                msgDialog('warninga', 'Server busy', 'The server was busy, please try again later.');
            }
            else if (ex === -12) {
                // Repeated request
                msgDialog('info', 'Repeated request', 'The contact has already been accepted.');
            }
            throw ex;
        })
        .finally(() => d && console.groupEnd());
};

MegaData.prototype.acceptPendingContactRequest = function(id) {
    return this.ipcRequestHandler(id, 'a');
};

MegaData.prototype.denyPendingContactRequest = function(id) {
    return this.ipcRequestHandler(id, 'd');
};

MegaData.prototype.ignorePendingContactRequest = function(id) {
    return this.ipcRequestHandler(id, 'i');
};

// Searches M.opc for the pending contact
MegaData.prototype.findOutgoingPendingContactIdByEmail = function(email) {
    for (var index in this.opc) {
        var opc = this.opc[index];

        if (opc.m === email) {
            return opc.p;
        }
    }
};

MegaData.prototype.filterBy = function(f, omitVersions) {
    this.filter = f;
    this.v = [];
    for (var i in this.d) {
        if ((!omitVersions || !this.d[i].fv) && f(this.d[i])) {
            this.v.push(this.d[i]);
        }
    }
};

/**
 * The same as filterBy, but instead of pushing the stuff in M.v, will return a new array.
 *
 * @param f function, with 1 arguments (node) that returns true when a specific node should be returned in the list
 * of filtered results
 */
MegaData.prototype.getFilterBy = function(f) {
    var v = [];
    for (var i in this.d) {
        if (f(this.d[i])) {
            v.push(this.d[i]);
        }
    }
    return v;
};

/* legacy method
 this.filterByParent = function(id) {
 this.filterBy(function(node) {
 return (node.p === id) || (node.p && (node.p.length === 11) && (id === 'shares'));
 });
 };*/


/**
 * filter M.v by parent ID
 * @param {String} id   handle of the parent
 * @returns {Object} duplicates if found
 */
MegaData.prototype.filterByParent = function(id) {
    var i;
    var node;

    if (id === 'shares') {
        this.v = [];
        var inshares = Object.keys(this.c.shares || {});

        for (i = inshares.length; i--;) {
            node = this.d[inshares[i]] || false;
            // filter label applies here.
            if (node.su && !this.d[node.p] && (!M.currentLabelFilter || M.filterByLabel(node))) {
                this.v.push(node);
            }
        }
    }
    // We should have a parent's childs into M.c, no need to traverse the whole M.d
    else if (this.c[id] || id === 'public-links' || id === 'out-shares' || id === 'file-requests') {
        var list;

        if (id === 'public-links') {
            list = this.su.EXP || {};
        }
        else if (id === 'out-shares') {
            list = this.getOutShareTree();
        }
        else if (id === 'file-requests') {
            list = mega.fileRequest.getPuHandleList();
        }
        else {
            list = this.c[id];
        }

        this.v = Object.keys(list)
            .map((h) => M.d[h])
            .filter((n) => {
                // Filter versioned file or undefined node.
                if (!n || n.fv || n.s4 && n.p === M.RootID || M.gallery && !mega.gallery.isGalleryNode(n)) {
                    return false;
                }

                // Filter label applies here.
                return !(this.currentLabelFilter && !this.filterByLabel(n));
            });
    }
    else {
        this.filterBy(function(node) {
            return (node.p === id);
        });
    }

    if (mega.ui.mNodeFilter && mega.ui.mNodeFilter.selectedFilters) {

        for (let i = this.v.length; i--;) {

            if (!mega.ui.mNodeFilter.match(this.v[i])) {

                this.v.splice(i, 1);
            }
        }
    }
};

MegaData.prototype.filterBySearch = function (str) {
    'use strict';

    str = String(str || '').replace('search/', '').trim();

    if (hashLogic) {
        str = decodeURIComponent(str);
    }

    const pfx = '--';
    if (str.startsWith(pfx)) {
        const command = str.slice(pfx.length);
        str = null;

        if (command === 'findupes') {
            var nodesByHash = {};

            for (var node in this.d) {
                node = this.d[node];

                if (node && node.hash && node.h && M.getNodeRoot(node.h) === this.RootID) {
                    if (!nodesByHash[node.hash]) {
                        nodesByHash[node.hash] = [];
                    }
                    nodesByHash[node.hash].push(node);
                }
            }

            var dupes = Object.keys(nodesByHash).filter(function(hash) {
                return nodesByHash[hash].length > 1;
            });

            this.v = [];
            for (var i in dupes) {
                this.v = this.v.concat(nodesByHash[dupes[i]]);
            }

            if (this.overrideModes) {
                this.overrideModes = 0;
                this.overrideViewMode = 1;
                this.overrideSortMode = ['size', -1];
            }

            // Wait for this.openFolder to finish and set colors to matching hashes
            this.onRenderFinished = function() {
                var find = M.viewmode ? 'a' : 'tr';
                $(M.fsViewSel).find(find).each(function() {
                    var $this = $(this);
                    var node = M.d[$this.attr('id')];

                    if (node) {
                        var color = crc32(asmCrypto.SHA256.hex(node.hash)) >>> 8;

                        if (M.viewmode) {
                            var r = (color >> 16) & 0xff;
                            var g = (color >> 8) & 0xff;
                            var b = color & 0xff;

                            $this.find('.file-block-title')
                                .css({
                                    'border-radius': '0 0 8px 8px',
                                    'background-color': 'rgba(' + r + ',' + g + ',' + b + ',0.3)'
                                });
                        }
                        else {
                            color = ("00" + color.toString(16)).slice(-6);

                            $('.item-type-icon', $this).css('background-color', '#' + color);
                        }
                    }
                });
                loadingDialog.hide();
            };
        }
        else if (command.startsWith('find') || command.startsWith('ctag')) {
            const handles = command.split(/[^\w-]+/).slice(1);

            this.v = [];
            loadingDialog.show();
            Promise.resolve(window.fmdb && dbfetch.geta(handles))
                .then(() => {
                    const v = handles.map((h) => M.d[h]).filter(Boolean);

                    if (pfid && command.startsWith('ctag')) {
                        for (let i = v.length; i--;) {
                            let n = v[i];

                            do {
                                $(`#${n.h}`).removeClassWith('highlight').addClass(`highlight${n.vhl = 1}`);

                            } while ((n = M.d[n.p]));
                        }
                    }
                    else {
                        this.currentdirid = `search/${pfx}${command}`;
                        this.v = v;
                        this.sort();
                        this.renderMain();
                    }
                })
                .catch(tell)
                .finally(() => loadingDialog.hide());
        }
        else {
            console.error('Unknown search command', command);
            str = `${pfx}${command}`;
        }
    }

    if (str) {
        this.filterBy(this.getFilterBySearchFn(str), true);
    }
};

MegaData.prototype.getFilterBySearchFn = function(searchTerm) {
    'use strict';

    // Simple glob/wildcard support.
    // spaces are replaced with *, and * moved to regexp's .* matching
    var regex;
    var str = String(searchTerm).toLowerCase().replace(/\s+/g, '*');

    if (str.indexOf('*') !== -1) {
        try {
            regex = RegExp(str.replace(/(\W)/g, '\\$1').replace(/\\\*/g, '.*'), 'i');
        }
        catch (ex) {}
    }

    if (mega.ui.mNodeFilter.selectedFilters) {
        if (regex) {
            return (n) => n.name && regex.test(n.name) && mega.ui.mNodeFilter.match(n);
        }
        return (n) => n.name && n.name.toLowerCase().includes(str) && mega.ui.mNodeFilter.match(n);
    }

    if (regex) {
        return function(node) {
            return node.name && regex.test(node.name)
                && node.p !== 'contacts' && !(node.s4 && node.p === M.RootID);
        };
    }

    return function(node) {
        return node.name && node.name.toLowerCase().includes(str)
            && node.p !== 'contacts' && !(node.s4 && node.p === M.RootID);
    };
};

/**
 * Filter a node contains right .lbl value
 *
 * @param {Object} node  target node
 *
 * @return {Boolean} node has the label or not
 */
MegaData.prototype.filterByLabel = function(node) {
    "use strict";

    if (!node.lbl || !M.currentLabelFilter[node.lbl]) {
        return false;
    }
    return true;
};

/*
 * buildSubMenu - context menu related
 * Create sub-menu for context menu parent directory
 *
 * @param {string} id - parent folder handle
 */
MegaData.prototype.buildSubMenu = function(id) {
    'use strict'; /* jshint -W074 */

    var csb;
    var cs = '';
    var sm = '';
    var tree = Object(this.tree[id]);
    var folders = obj_values(tree);
    var rootID = escapeHTML(this.RootID);
    var rootTree = this.tree[rootID] || false;
    var rootTreeLen = $.len(rootTree);
    var arrow = '<span class="context-top-arrow"></span><span class="context-bottom-arrow"></span>';

    csb = document.getElementById('sm_move');
    if (!csb || parseInt(csb.dataset.folders) !== rootTreeLen) {
        if (rootTree) {
            cs = ' contains-submenu sprite-fm-mono-after icon-arrow-right-after';
            sm = '<span class="dropdown body submenu" id="sm_' + rootID + '">'
                + '<span id="csb_' + rootID + '"></span>' + arrow + '</span>';
        }

        if (csb) {
            csb.parentNode.removeChild(csb);
        }

        $('.dropdown-item.move-item').after(
            '<span class="dropdown body submenu" id="sm_move">' +
            '  <span id="csb_move">' +
            '    <span class="dropdown-item cloud-item' + cs + '" id="fi_' + rootID + '">' +
            '      <i class="sprite-fm-mono icon-cloud"></i>' +
            '      <span>' + escapeHTML(l[164]) + '</span>' +
            '    </span>' + sm +
            '    <hr />' +
            '    <span class="dropdown-item advanced-item">' +
            '      <i class="sprite-fm-mono icon-target"></i>' +
            '      <span>' + escapeHTML(l[9108]) + '</span>' +
            '    </span>' + arrow +
            '  </span>' +
            '</span>'
        );

        if ((csb = document.getElementById('sm_move'))) {
            csb.dataset.folders = rootTreeLen;
            M.initContextUI(); // rebind just recreated dropdown-item's
        }
    }

    csb = document.getElementById('csb_' + id);
    if (csb && csb.querySelectorAll('.dropdown-item').length !== folders.length) {
        var $csb = $(csb).empty();

        folders.sort(M.getSortByNameFn2(1));
        for (var i = 0; i < folders.length; i++) {
            var fid = escapeHTML(folders[i].h);

            cs = '';
            sm = '';
            if (this.tree[fid]) {
                cs = ' contains-submenu sprite-fm-mono-after icon-arrow-right-after';
                sm = '<span class="dropdown body submenu" id="sm_' + fid + '">'
                    + '<span id="csb_' + fid + '"></span>' + arrow + '</span>';
            }

            var classes = 'folder-item';
            var iconClass = 'icon-folder';
            if (folders[i].t & M.IS_SHARED) {
                classes += ' shared-folder-item';
                iconClass = 'icon-folder-outgoing-share';
            }
            else if (mega.fileRequest.publicFolderExists(fid)) {
                classes += ' file-request-folder';
                iconClass = 'icon-folder-mega-drop';
            }

            var nodeName = missingkeys[fid] ? l[8686] : folders[i].name;

            $csb.append(
                '<span class="dropdown-item ' + classes + cs + '" id="fi_' + fid + '">' +
                '  <i class="sprite-fm-mono ' + iconClass + '"></i>' +
                '  <span>' + escapeHTML(nodeName) + '</span>' +
                '</span>' + sm
            );
        }
    }

    M.disableCircularTargets('#fi_');
};

MegaData.prototype.getSelectedSourceRoot = function(isSearch, isTree) {
    'use strict';

    let sourceRoot = isTree || isSearch || M.currentdirid === 'recents'
        || M.currentdirid === 'public-links' || M.currentdirid === 'out-shares'
        ? M.getNodeRoot($.selected[0]) : M.currentrootid;

    if (sourceRoot === 'file-requests') {
        sourceRoot = M.RootID;
    }

    return sourceRoot;
};

MegaData.prototype.checkSendToChat = function(isSearch, sourceRoot) {
    'use strict';

    // view send to chat if all selected items are files
    if (!folderlink && window.megaChatIsReady && $.selected.length) {

        for (let i = $.selected.length; i--;) {

            let n = M.d[$.selected[i]];
            const nRoot = isSearch ? n && n.u === u_handle && M.getNodeRoot($.selected[i]) : sourceRoot;

            if (!n || n.t && (nRoot !== M.RootID && nRoot !== M.InboxID && nRoot !== 's4'
                && !M.isDynPage(nRoot)) || nRoot === M.RubbishID) {

                return false;
            }
        }
        return true;
    }
    return false;
};


/**
 * Build an array of context-menu items to show for the selected node
 * @returns {Promise}
 */
// @todo make eslint happy..
// eslint-disable-next-line complexity,sonarjs/cognitive-complexity
MegaData.prototype.menuItems = async function menuItems(isTree) {
    "use strict";

    console.assert($.selected);
    if (!$.selected) {
        $.selected = [];
    }

    const restore = new Set();
    const nodes = [...$.selected];

    for (let i = nodes.length; i--;) {
        const h = nodes[i] || !1;
        const n = M.getNodeByHandle(h);

        if (n || h.length !== 8) {
            nodes.splice(i, 1);

            if (n.rr && M.getNodeRoot(n.h) === M.RubbishID) {
                restore.add(n.rr);
            }
            // else we can delete .rr and api_setattr
        }
    }
    nodes.push(...restore);

    if (nodes.length) {
        await dbfetch.geta(nodes).catch(dump);
    }

    let n;
    const items = Object.create(null);
    const isSearch = page.startsWith('fm/search');
    const selNode = M.getNodeByHandle($.selected[0]);
    const sourceRoot = M.getSelectedSourceRoot(isSearch, isTree);
    let restrictedFolders = false;
    const isInShare = M.currentrootid === 'shares';

    if (selNode && selNode.su && !M.d[selNode.p]) {
        items['.leaveshare-item'] = 1;
    }
    else if (M.getNodeRights($.selected[0]) > 1) {
        items['.move-item'] = 1;
        items['.remove-item'] = 1;
    }

    if (selNode && $.selected.length === 1) {
        if (selNode.t) {
            if (M.currentdirid !== selNode.h && !is_mobile) {
                items['.open-item'] = 1;
            }

            if ((sourceRoot === M.RootID || sourceRoot === 's4'
                || M.isDynPage(M.currentrootid)) && !folderlink) {

                let exp = false;
                const shares = this.getNodeShareUsers(selNode);

                for (let i = shares.length; i--;) {
                    if (shares[i] === 'EXP') {
                        shares.splice(i, 1);
                        exp = selNode.shares.EXP;
                    }
                }

                items['.sh4r1ng-item'] = 1;

                if (shares.length || M.ps[selNode.h]) {
                    items['.removeshare-item'] = 1;
                }
                else if (!exp && !shared.is(selNode.h)) {

                    if (mega.fileRequest.publicFolderExists(selNode.h)) {
                        let fileRequestPageClass = '';

                        if (!is_mobile) {
                            fileRequestPageClass =
                                M.currentrootid === 'file-requests'
                                    ? '.file-request-page'
                                    : ':not(.file-request-page)';
                        }

                        items[`.file-request-manage${fileRequestPageClass}`] = 1;
                        items[`.file-request-copy-link${fileRequestPageClass}`] = 1;
                        items[`.file-request-remove${fileRequestPageClass}`] = 1;
                    }
                    else {
                        items[`.file-request-create`] = 1;
                    }
                }
            }

            // If the selected folder contains any versioning show clear version
            if (selNode.tvf && M.getNodeRights(selNode.h) > 1) {
                items['.clearprevious-versions'] = 1;
            }

            // This is just to make sure the source root is on the cloud drive
            if (mega.rewind && sourceRoot === M.RootID && !!mega.rewind.contextMenu) {
                items['.rewind-item'] = 1;
            }
        }
        else {
            if ((selNode.tvf > 0) && !folderlink) {
                items['.properties-versions'] = 1;
                if (M.getNodeRights(selNode.h) > 1) {
                    items['.clearprevious-versions'] = 1;
                }
            }

            if (is_image2(selNode)) {
                items['.preview-item'] = 1;
            }
            else {
                var mediaType = is_video(selNode);

                if (mediaType) {
                    items['.play-item'] = 1;

                    if (mediaType === 1 && sourceRoot !== M.RubbishID && sourceRoot !== "shares") {
                        items['.embedcode-item'] = 1;
                    }
                }
                else if (is_text(selNode)) {
                    items['.edit-file-item'] = 1;
                }
            }
        }

        if (M.currentCustomView || M.currentdirid && M.currentdirid.startsWith('search/')) {
            items['.open-cloud-item'] = 1;
            if (folderlink) {
                items['.open-in-location'] = 1;
            }
            else {
                items['.open-cloud-item'] = 1;
            }
        }

        if (M.getNodeRights(selNode.h) > 1) {
            items['.rename-item'] = 1;
            items['.colour-label-items'] = 1;

            if (!isInShare) {
                items['.add-star-item'] = 1;

                if (M.isFavourite(selNode.h)) {

                    if (is_mobile) {

                        const fav = mega.ui.contextMenu.getChild('.add-star-item');
                        fav.text = l[5872];
                        fav.icon = 'sprite-mobile-fm-mono icon-heart-broken-thin-outline';
                    }
                    else {
                        $('.add-star-item').safeHTML('<i class="sprite-fm-mono icon-favourite-removed"></i>@@',
                                                     l[5872]);
                    }
                }
                else if (is_mobile) {

                    const fav = mega.ui.contextMenu.getChild('.add-star-item');
                    fav.text = l[5871];
                    fav.icon = 'sprite-mobile-fm-mono icon-heart-thin-outline';
                }
                else {
                    $('.add-star-item').safeHTML('<i class="sprite-fm-mono icon-favourite"></i>@@', l[5871]);
                }
            }

            M.colourLabelcmUpdate(selNode.h);

            if (items['.edit-file-item']) {
                $('.dropdown-item.edit-file-item span').text(l[865]);
            }
        }
        else if (items['.edit-file-item']) {
            $('.dropdown-item.edit-file-item span').text(l[16797]);
        }

        if (selNode.vhl) {
            items['.vhl-item'] = 1;
        }
    }

    // Allow to mark as Favourite/Labeled from multi-selection
    if ($.selected.length > 1) {
        items['.colour-label-items'] = 1;
        let allAreFavourite = !isInShare;

        if (!isInShare) {
            items['.add-star-item'] = 1;
        }

        for (let i = 0; i < $.selected.length; i++) {

            if (allAreFavourite && !M.isFavourite($.selected[i])) {
                allAreFavourite = false;
            }

            if (!restrictedFolders
                && (sourceRoot === M.InboxID || M.getNodeRoot($.selected[i]) === M.InboxID)) {

                restrictedFolders = true;
            }
        }

        if (allAreFavourite) {
            $('.add-star-item').safeHTML('<i class="sprite-fm-mono icon-favourite-removed"></i>@@', l[5872]);
        }
        else {
            $('.add-star-item').safeHTML('<i class="sprite-fm-mono icon-favourite"></i>@@', l[5871]);
        }

        M.colourLabelcmUpdate($.selected);
    }

    if (M.checkSendToChat(isSearch, sourceRoot)) {
        items['.send-to-contact-item'] = 1;
    }

    if (selNode) {
        items['.download-item'] = 1;
        items['.zipdownload-item'] = 1;
        items['.copy-item'] = 1;
        items['.properties-item'] = 1;
    }
    items['.refresh-item'] = 1;

    if (folderlink) {
        delete items['.copy-item'];
        delete items['.add-star-item'];
        delete items['.embedcode-item'];
        delete items['.colour-label-items'];
        delete items['.properties-versions'];
        delete items['.clearprevious-versions'];

        items['.import-item'] = 1;
        items['.getlink-item'] = 1;

        if (selNode.vhl || !selNode.t && self.d && localStorage.compli) {
            items['.vhl-item'] = 1;
        }
    }

    if (M.isGalleryPage()) {

        items['.open-cloud-item'] = 1;

        delete items['.move-item'];
        delete items['.copy-item'];
        delete items['.rename-item'];
        delete items['.remove-item'];
        if (M.currentdirid !== 'favourites') {
            delete items['.add-star-item'];
        }
        delete items['.colour-label-items'];
        delete items['.embedcode-item'];
        delete items['.properties-versions'];
        delete items['.clearprevious-versions'];
        delete items['.open-in-location'];
    }

    if ((sourceRoot === M.RootID
         || sourceRoot === 's4' || M.isDynPage(M.currentrootid)) && !folderlink) {

        items['.move-item'] = 1;
        items['.getlink-item'] = 1;

        var cl = new mega.Share();
        var hasExportLink = cl.hasExportLink($.selected);

        if (hasExportLink) {
            items['.removelink-item'] = true;
        }

        cl = new mega.Share.ExportLink();
        var isTakenDown = cl.isTakenDown($.selected);

        // If any of selected items is taken down remove actions from context menu
        if (isTakenDown) {
            delete items['.getlink-item'];
            delete items['.embedcode-item'];
            delete items['.removelink-item'];
            delete items['.sh4r1ng-item'];
            delete items['.add-star-item'];
            delete items['.colour-label-items'];
            delete items['.download-item'];
            delete items['.play-item'];
            delete items['.preview-item'];
            delete items['.edit-file-item'];

            if ($.selected.length > 1 || selNode.t !== 1) {
                delete items['.open-item'];
            }

            items['.dispute-item'] = 1;
        }
    }
    else if (sourceRoot === M.RubbishID && !folderlink) {
        items['.move-item'] = 1;

        delete items['.move-item'];
        delete items['.copy-item'];
        delete items['.rename-item'];
        delete items['.add-star-item'];
        delete items['.download-item'];
        delete items['.zipdownload-item'];
        delete items['.colour-label-items'];
        delete items['.properties-versions'];
        delete items['.clearprevious-versions'];

        for (var j = $.selected.length; j--;) {
            n = M.getNodeByHandle($.selected[j]);

            if (n.rr && M.getNodeRoot(n.h) === M.RubbishID) {
                items['.revert-item'] = 1;
            }
            else if (items['.revert-item']) {
                delete items['.revert-item'];
                break;
            }
        }
    }

    // For multiple selections, should check all have the right permission.
    if ($.selected.length > 1) {

        let removeItemFlag = true;
        let clearVersioned = false;
        let favouriteFlag = true;
        let labelFlag = true;

        for (var g = 0; g < $.selected.length; g++) {

            // If any of node has read only rights or less, stop loop
            if (folderlink || M.getNodeRights($.selected[g]) <= 1) {

                removeItemFlag = false;
                clearVersioned = false;
                favouriteFlag = false;
                labelFlag = false;

                break;
            }

            const selected = M.getNodeByHandle($.selected[g]);

            // Do not show clear version option if there is any folder selected
            // Or multi-select files including a versioned file and in rubbish bin
            if (selected.t || M.currentrootid === M.RubbishID) {
                clearVersioned = false;
                break;
            }
            else if (selected.tvf) {
                clearVersioned = true;
            }
        }

        if (!removeItemFlag) {
            delete items['.remove-item'];
            delete items['.move-item'];
        }

        if (!favouriteFlag) {
            delete items['.add-star-item'];
        }

        if (!labelFlag) {
            delete items['.colour-label-items'];
        }

        // if there is no folder selected, selected file nodes are versioned, user has right to clear it.
        if (clearVersioned) {
            items['.clearprevious-versions'] = 1;
        }
    }

    const {useMegaSync} = window;
    const $didi = $('.dropdown-item.download-item');
    $didi.addClass('contains-submenu sprite-fm-mono-after icon-arrow-right-after').removeClass('msync-found');

    if (useMegaSync === 2 || useMegaSync === 3) {
        $didi.removeClass('contains-submenu sprite-fm-mono-after icon-arrow-right-after').addClass('msync-found');

        if (useMegaSync === 2 && $.selected.length === 1 && selNode.t) {
            const {error, response} = await megasync.syncPossibleA(selNode.h).catch(dump) || false;
            if (!error && response === 0) {
                items['.syncmegasync-item'] = 1;
            }
        }
    }

    if (M.currentdirid === 'file-requests' && !isTree) {
        delete items['.move-item'];
        delete items['.copy-item'];
        delete items['.open-in-location'];
        delete items['.getlink-item'];
        delete items['.embedcode-item'];
        delete items['.removelink-item'];
        delete items['.sh4r1ng-item'];
        delete items['.send-to-contact-item'];
    }

    // If in MEGA Lite mode, temporarily hide any Download, Copy and Manage Share options while in the Shared area
    if (mega.lite.inLiteMode && (M.currentrootid === 'shares' || M.currentrootid === 'out-shares')) {
        delete items['.download-item'];
        delete items['.copy-item'];
        delete items['.sh4r1ng-item'];
        delete items['.remove-item'];
    }

    if (restrictedFolders || $.selected.length === 1
        && sourceRoot === M.InboxID) {

        delete items['.open-cloud-item'];
        delete items['.open-in-location'];
        delete items['.move-item'];
        delete items['.rename-item'];
        delete items['.add-star-item'];
        delete items['.colour-label-items'];
        delete items['.embedcode-item'];

        if (!self.vw) {
            delete items['.remove-item'];
        }

        let cl = new mega.Share.ExportLink();

        if (folderlink || cl.isTakenDown($.selected)) {
            return items;
        }

        cl = new mega.Share();

        if (cl.hasExportLink($.selected)) {
            items['.removelink-item'] = 1;
        }

        if (M.currentrootid === M.InboxID && $.selected.length === 1
            && ((selNode.devid || selNode.drvid) && selNode.td > 0
            || M.d[selNode.p].devid || M.d[selNode.p].drvid || selNode.h === M.BackupsId)) {

            items['.view-in-bc-item'] = 1;
        }

        items['.getlink-item'] = 1;

        if ($.selected.length === 1 && selNode.t) {
            items['.sh4r1ng-item'] = 1;

            if (M.getNodeShareUsers(selNode, 'EXP').length || M.ps[selNode]) {
                items['.removeshare-item'] = 1;
            }
        }
    }

    // S4 Object Storage
    if ($.selected.length === 1 && sourceRoot === 's4') {
        const s4Type = 'kernel' in s4 && s4.kernel.getS4NodeType(selNode);

        delete items['.open-cloud-item'];

        if (M.currentCustomView.type !== 's4' || M.currentdirid.startsWith('search/')) {
            items['.open-s4-item'] = 1;
        }

        // Temporary block most of actions over the containers
        if (s4Type === 'container' || !s4Type) {
            delete items['.move-item'];
            delete items['.rename-item'];
            delete items['.add-star-item'];
            delete items['.colour-label-items'];
            delete items['.embedcode-item'];
            delete items['.properties-versions'];
            delete items['.clearprevious-versions'];
            delete items['.remove-item'];
        }
        else if (s4Type === 'bucket') {
            delete items['.properties-item'];
            items['.settings-item'] = 1;
        }
        else if (s4Type === 'object') {
            items['.managepuburl-item'] = 1;
        }
    }

    return items;
};

/**
 * Show a context menu for the selected node.
 * @param {Event} e The event being dispatched
 * @param {Number} ll The type of context menu.
 * @param {String} items Requested items classes, i.e '.properties-item, ...'
 * @returns {void}
 */
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity
MegaData.prototype.contextMenuUI = function contextMenuUI(e, ll, items) {
    "use strict";

    var flt;
    var asyncShow = false;
    var m = $('.dropdown.body.files-menu');
    var $contactDetails = m.find('.dropdown-contact-details');

    // Selection of first child level ONLY of .dropdown-item in .dropdown.body
    var menuCMI = '.dropdown.body.files-menu .dropdown-section > .dropdown-item';

    // is contextmenu disabled
    if (localStorage.contextmenu) {
        console.warn('context menus are disabled.');
        return true;
    }

    // function to recuring repositioning for sub menus.
    var findNewPosition = function() {
        M.adjustContextMenuPosition(e, m);
        m.find('.contains-submenu.opened').removeClass('opened');
        m.find('.submenu.active').removeClass('active');
    };

    var showContextMenu = function() {
        // This part of code is also executed when ll == 'undefined'
        var v = m.children('.dropdown-section');

        // Count all items inside section, and hide dividers if necessary
        v.each(function() {
            var $this = $(this);
            var a = $this.find('a.dropdown-item');
            var x = a.filter(function() {
                return $(this).hasClass('hidden');
            });
            if (x.length === a.length || a.length === 0) {
                $this.addClass('hidden');
            }
            else {
                $this.removeClass('hidden');
            }
        });

        M.adjustContextMenuPosition(e, m);

        M.disableCircularTargets('#fi_');

        m.removeClass('hidden');

        // Hide last divider
        v.find('hr').removeClass('hidden');
        m.find('.dropdown-section:visible:last hr').addClass('hidden');

        $(window).rebind('resize.ccmui', SoonFc(findNewPosition));

        // disable scrolling
        var $psContainer = $(e.currentTarget).closest('.ps');
        if ($psContainer.length) {
            Ps.disable($psContainer[0]);
            $.disabledContianer = $psContainer;
        }

        mBroadcaster.sendMessage('showcontextmenu');
    };

    $.hideContextMenu(e);
    $contactDetails.addClass('hidden');

    /**
     * Adding context menu for share folder while you're on it
     * @param {Object} n node
     * @returns {void}
     */
    var shareContextMenu = function(n) {
        // Hide shares context menu for root id, out shares and S4
        const hideFrom = !['s4', 'out-shares', 'shares', 'file-requests'].includes(M.currentrootid)
            && M.RootID !== M.currentdirid;

        if (hideFrom) {
            $.selected = [n.h];

            $(menuCMI).filter('.cd-send-to-contact-item').removeClass('hidden');
            $(menuCMI).filter('.cd-getlink-item').removeClass('hidden');
            $(menuCMI).filter('.cd-sh4r1ng-item').removeClass('hidden');

            onIdle(() => M.setContextMenuShareText());
            onIdle(() => M.setContextMenuGetLinkText());
        }

        var cl = new mega.Share();
        var hasExportLink = cl.hasExportLink(n.h);

        if (hideFrom && hasExportLink) {
            $(menuCMI).filter('.cd-removelink-item').removeClass('hidden');
        }

        if (hideFrom && M.getNodeShareUsers(n.h, 'EXP').length || M.ps[n.h]) {
            $(menuCMI).filter('.cd-removeshare-item').removeClass('hidden');
        }
    };

    // Used when right click is occured outside item, on empty canvas
    if (ll === 2) {
        // to init megaSync, as the user may click of file/folder upload
        // the below event handler will setup the communication with MEGASYNC
        var fupload = document.getElementById('fileselect1');
        var mEvent = new MouseEvent('mouseover', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        fupload.dispatchEvent(mEvent);

        $(menuCMI).filter('.dropdown-item').addClass('hidden');
        var itemsViewed = false;
        var ignoreGrideExtras = false;

        if (M.currentdirid !== 'shares' && M.currentdirid !== 'out-shares') {
            // Enable upload item menu for clould-drive, don't show it for rubbish and rest of crew

            const nodeRights = M.getNodeRights(M.currentCustomView.nodeID || M.currentdirid);
            const h = M.currentdirid.split('/').pop();
            const n = M.getNodeByHandle(h);
            const nodeRoot = M.getNodeRoot(h);

            if (nodeRights && M.currentrootid !== M.RubbishID && M.currentrootid !== M.InboxID
                && nodeRoot !== M.InboxID) {

                if (M.currentrootid === 'contacts') {
                    $(menuCMI).filter('.addcontact-item').removeClass('hidden');
                    ignoreGrideExtras = true;
                }
                else if (n.s4 && 'kernel' in s4 && s4.kernel.getS4NodeType(n) === 'container') {
                    $(menuCMI).filter('.new-bucket-item').removeClass('hidden');
                }
                else {
                    $(menuCMI).filter('.fileupload-item,.newfolder-item').removeClass('hidden');

                    if (nodeRights > 0) {
                        $(menuCMI).filter('.newfile-item').removeClass('hidden');
                    }

                    if ($.hasWebKitDirectorySupport === undefined) {
                        $.hasWebKitDirectorySupport = 'webkitdirectory' in document.createElement('input');
                    }

                    if ($.hasWebKitDirectorySupport) {
                        $(menuCMI).filter('.folderupload-item').removeClass('hidden');
                    }

                    if (nodeRoot !== 's4' && mega.rewind && !!mega.rewind.contextMenu
                        && mega.rewind.permittedRoots[M.currentrootid]) {
                        $(menuCMI).filter('.rewind-item').removeClass('hidden');
                    }
                    // Flag added for share folder while on it at context menu
                    if (mega.flags.ab_ctxmenu_shares) {
                        shareContextMenu(n);
                        eventlog(500035);
                    }
                }
                itemsViewed = true;
            }
        }

        if (M.currentrootid === M.RubbishID && M.v.length) {
            $('.files-menu.context .dropdown-item.clearbin-item').removeClass('hidden');
            itemsViewed = true;
        }

        if (!ignoreGrideExtras && M.viewmode) {
            itemsViewed = true;
            $('.files-menu.context .dropdown-item.sort-grid-item-main').removeClass('hidden');
            if (M.currentdirid === 'shares') {
                $('.files-menu.context .dropdown-item.sort-grid-item').addClass('hidden');
                $('.files-menu.context .dropdown-item.sort-grid-item.s-inshare').removeClass('hidden');
            }
            else if (M.currentdirid === 'out-shares') {
                $('.files-menu.context .dropdown-item.sort-grid-item').addClass('hidden');
                $('.files-menu.context .dropdown-item.sort-grid-item.s-outshare').removeClass('hidden');
            }
            else {
                $('.files-menu.context .dropdown-item.sort-grid-item').addClass('hidden');
                $('.files-menu.context .dropdown-item.sort-grid-item.s-fm').removeClass('hidden');
                if (folderlink) {
                    $('.files-menu.context .dropdown-item.sort-grid-item.s-fm.sort-label').addClass('hidden');
                    $('.files-menu.context .dropdown-item.sort-grid-item.s-fm.sort-fav').addClass('hidden');
                }

                if (M.currentrootid === M.RubbishID) {
                    $('.files-menu.context .dropdown-item.sort-grid-item.s-fm.sort-fav').addClass('hidden');
                }
            }
        }
        if (!itemsViewed) {
            return false;
        }
    }
    else if (ll === 3) {// we want just the download menu
        $(menuCMI).addClass('hidden');
        m = $('.dropdown.body.download');
        menuCMI = '.dropdown.body.download .dropdown-item';
        $(menuCMI).removeClass('hidden');
    }
    else if (ll === 4 || ll === 5) {// contactUI
        $(menuCMI).addClass('hidden');

        asyncShow = true;
        M.menuItems()
            .then((items) => {

                delete items['.download-item'];
                delete items['.zipdownload-item'];
                delete items['.copy-item'];
                delete items['.open-item'];

                if (ll === 5) {
                    delete items['.properties-item'];
                }

                for (var item in items) {
                    $(menuCMI).filter(item).removeClass('hidden');
                }

                // Hide Info item if properties dialog is opened
                if ($.dialog === 'properties') {
                    delete items['.properties-item'];
                }

                onIdle(showContextMenu);
            })
            .catch(dump);
    }
    else if (ll === 7) { // Columns selection menu
        if (M && M.columnsWidth && M.columnsWidth.cloud) {
            // Please be aware that have to hide all hyperlink dropdown items that are options in context menu,
            // not including any ones under submenu with the span tag.
            // Then filter them with the classname of visible-col-select
            // and display correct ones based on the visible columns list.
            var $currMenuItems = $('.files-menu.context a.dropdown-item')
                .addClass('hidden').filter('.visible-col-select');
            for (var col in M.columnsWidth.cloud) {
                if (M.columnsWidth.cloud[col] && M.columnsWidth.cloud[col].disabled) {
                    continue;
                }
                else {
                    if (M.columnsWidth.cloud[col] && M.columnsWidth.cloud[col].viewed) {
                        $currMenuItems.filter('[megatype="' + col + '"]').attr('isviewed', 'y')
                            .removeClass('hidden').find('i').removeClass('icon-add').addClass('icon-check');
                    }
                    else {
                        $currMenuItems.filter('[megatype="' + col + '"]').removeAttr('isviewed')
                            .removeClass('hidden').find('i').removeClass('icon-check').addClass('icon-add');
                    }
                }
            }
        }
    }
    else if (ll === 8 && items) { // Passes requested items

        $(menuCMI).addClass('hidden');

        asyncShow = true;
        M.menuItems()
            .then(() => {
                onIdle(showContextMenu);
                $(menuCMI).filter(items).removeClass('hidden');
            })
            .catch(dump);
    }
    else if (ll) {// Click on item

        // Hide all menu-items
        $(menuCMI).addClass('hidden');

        var id;
        var currNodeClass;
        var $currentTarget = $(e.currentTarget);
        let isTree = false;

        // This event is context on selection bar
        if ($currentTarget.hasClass('js-statusbarbtn')) {
            id = $.selected[0];
            currNodeClass = $.gridLastSelected ? $.gridLastSelected.className : false;
        }
        // This event is context on node itself
        else {
            id = $currentTarget.attr('id');
            currNodeClass = $currentTarget.attr('class');
        }

        if (id) {

            // File manager left panel click
            if (id.includes('treea_')) {
                id = id.replace(/treea_+|(os_|pl_)/g, '');
                eventlog(500036);
                isTree = true;
            }

            // File manager breadcrumb path click
            else if (id.startsWith('pathbc-')) {
                id = id.replace('pathbc-', '');
            }
        }

        /*if (id && !M.d[id]) {

         // exist in node list
         id = undefined;
         }*/

        // In case that id belongs to contact, 11 char length
        if (id && (id.length === 11)) {
            var $contactDetails = m.find('.dropdown-contact-details');
            var username = M.getNameByHandle(id) || '';

            flt = '.remove-contact, .share-folder-item, .set-nickname';

            // Add .send-files-item to show Send files item
            if (window.megaChatIsReady) {
                flt += ',.startchat-item, .send-files-item';

                if (megaChat.hasSupportForCalls) {
                    flt += ',.startaudiovideo-item';
                }
            }
            var $menuCmi = $(menuCMI);
            $menuCmi.filter(flt).removeClass('hidden');

            // Enable All buttons
            $menuCmi.filter('.startaudiovideo-item, .send-files-item')
                .removeClass('disabled disabled-submenu');

            // disable remove for business accounts + business users
            if (u_attr && u_attr.b && M.u[id] && M.u[id].b) {
                $menuCmi.filter('.remove-contact').addClass('disabled');
            }

            // Show Detail block
            $contactDetails.removeClass('hidden');

            if (M.viewmode) {
                $contactDetails.find('.view-profile-item').removeClass('hidden');
                $contactDetails.find('.dropdown-avatar').addClass('hidden');
                $contactDetails.find('.dropdown-user-name').addClass('hidden');
            }
            else {
                $contactDetails.find('.view-profile-item').addClass('hidden');

                // Set contact avatar
                $contactDetails.find('.dropdown-avatar').removeClass('hidden')
                    .find('.avatar').safeHTML(useravatar.contact(id, 'context-avatar'));

                // Set username
                $contactDetails.find('.dropdown-user-name').removeClass('hidden')
                    .find('.name span').text(username);
            }

            // Set contact fingerprint
            showAuthenticityCredentials(id, $contactDetails);

            // Open contact details page
            $contactDetails.rebind('click.opencontact', function() {
                loadSubPage('fm/chat/contacts/' + id);
            });

            var verificationState = u_authring.Ed25519[id] || {};
            var isVerified = (verificationState.method
                >= authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON);

            // Show the user is verified
            if (isVerified) {
                $contactDetails.addClass('verified');
                $contactDetails.find('.dropdown-verify').removeClass('active');
            }
            else {
                $contactDetails.removeClass('verified');
                $contactDetails.find('.dropdown-verify').addClass('active')
                    .rebind('click.verify', function(e) {
                        e.stopPropagation();
                        $.hideContextMenu(e);
                        fingerprintDialog(id);
                    });
            }
        }
        else if (currNodeClass && (currNodeClass.indexOf('cloud-drive') > -1
            || currNodeClass.indexOf('folder-link') > -1)) {
            flt = '.properties-item';

            if (folderlink) {
                flt += ',.import-item';
            }
            else {
                flt += ',.findupes-item';

                if (mega.rewind && !!mega.rewind.contextMenu) {
                    flt += ',.rewind-item';
                }
            }
            if (M.v.length && folderlink) {
                flt += ',.zipdownload-item,.download-item';
            }
            $.selected = [M.RootID];
            $(menuCMI).filter(flt).removeClass('hidden');
        }
        else if (currNodeClass && $(e.currentTarget).hasClass('inbox')) {
            $.selected = [M.InboxID];
            $(menuCMI).filter('.properties-item').removeClass('hidden');
        }
        else if (currNodeClass && currNodeClass.indexOf('rubbish-bin') > -1) {
            $.selected = [M.RubbishID];
            $(menuCMI).filter('.properties-item').removeClass('hidden');
            if (currNodeClass.indexOf('filled') > -1) {
                $(menuCMI).filter('.clearbin-item').removeClass('hidden');
            }
        }
        else if (currNodeClass && currNodeClass.indexOf('contacts-item') > -1) {
            $(menuCMI).filter('.addcontact-item').removeClass('hidden');
        }
        else if (currNodeClass && currNodeClass.indexOf('messages-item') > -1) {
            e.preventDefault();
            return false;
        }
        else if (pfcol) {
            const $menuCMI = $(menuCMI);
            const albums = mega.gallery.albums;
            const selections = Object.keys(albums.grid.timeline.selections);
            const oneImageSelected = selections.length === 1 && !!mega.gallery.isImage(M.d[selections[0]]);
            const hasImageSelected = selections.some((h) => !!mega.gallery.isImage(M.d[h]));
            const slideshowItem = $menuCMI.filter('.play-slideshow');
            const previewItem = $menuCMI.filter('.preview-item');
            const playItem = $menuCMI.filter('.play-item');
            const importItem = $menuCMI.filter('.import-item');
            const onlyPlayableVideosSelected = selections.every((h) => !!is_video(M.d[h]));
            const allowSlideshow = oneImageSelected
                && mega.gallery.nodesAllowSlideshow(mega.gallery.albums.store[M.d[pfid].id].nodes);

            slideshowItem.toggleClass('hidden', !allowSlideshow);
            previewItem.toggleClass('hidden', !hasImageSelected);
            $menuCMI.filter('.properties-item').removeClass('hidden');
            importItem.removeClass('hidden');

            $.selected = selections;

            $('span', playItem).text(l.album_play_video);
            $('span', importItem).text(u_type ? l.context_menu_import : l.btn_imptomega);

            playItem.toggleClass('hidden', !onlyPlayableVideosSelected);
        }
        else if (currNodeClass
            && (currNodeClass.includes('data-block-view') || currNodeClass.includes('folder'))
            || String(id).length === 8) {

            asyncShow = true;
            const updateUIPerItems = ($menuCMI, items) => {
                if (items['.getlink-item']) {
                    onIdle(() => M.setContextMenuGetLinkText());
                }
                if (items['.sh4r1ng-item']) {
                    onIdle(() => M.setContextMenuShareText());
                }

                if (items['.play-item']) {
                    var $playItem = $menuCMI.filter('.play-item');

                    if (is_audio(M.d[id])) {
                        $('i', $playItem).removeClass('icon-video-call-filled').addClass('icon-play-small');
                        $('span', $playItem).text(l[17828]);
                    }
                    else {
                        $('i', $playItem).removeClass('icon-play-small').addClass('icon-video-call-filled');
                        $('span', $playItem).text(l[16275]);
                    }
                }

                if (items['.remove-item']) {
                    $('span', $menuCMI.filter('.remove-item')).text(M.getSelectedRemoveLabel($.selected));
                }

                if (items['.import-item']) {
                    const $importItem = $menuCMI.filter('.import-item');

                    if (u_type) {
                        $('i', $importItem)
                            .removeClass('icon-mega-thin-outline')
                            .addClass('icon-upload-to-cloud-drive');

                        $('span', $importItem).text(l.context_menu_import);
                    }
                    else {
                        $('i', $importItem)
                            .removeClass('icon-upload-to-cloud-drive')
                            .addClass('icon-mega-thin-outline');

                        $('span', $importItem).text(l.btn_imptomega);
                    }
                }

                if (items['.open-item']) {
                    const $openItem = $menuCMI.filter('.open-item');
                    const n = M.getNodeByHandle(id);

                    if (n.s4 && 'kernel' in s4 && s4.kernel.getS4NodeType(n) === 'bucket') {
                        $('i', $openItem).removeClass('icon-folder-open').addClass('icon-bucket');
                    }
                    else {
                        $('i', $openItem).removeClass('icon-bucket').addClass('icon-folder-open');
                    }
                }

                // We know the rewind-item is already active and passed the check
                // We need to check the 2nd time if the source of event is on right location
                if (items['.rewind-item']) {
                    const fromCloudDriveTree = $currentTarget.closest('.js-myfile-tree-panel').length;
                    if (!fromCloudDriveTree && M.currentrootid !== M.RootID) {
                        $menuCMI.filter('.rewind-item').addClass('hidden');
                    }
                }
            };

            M.menuItems(isTree)
                .then((items) => {
                    const $menuCMI = $(menuCMI);

                    for (const item in items) {
                        $menuCMI.filter(item).removeClass('hidden');
                    }

                    // Hide context menu items not needed for undecrypted nodes
                    if (missingkeys[id]) {
                        $menuCMI.filter('.add-star-item').addClass('hidden');
                        $menuCMI.filter('.download-item').addClass('hidden');
                        $menuCMI.filter('.rename-item').addClass('hidden');
                        $menuCMI.filter('.copy-item').addClass('hidden');
                        $menuCMI.filter('.move-item').addClass('hidden');
                        $menuCMI.filter('.getlink-item').addClass('hidden');
                        $menuCMI.filter('.embedcode-item').addClass('hidden');
                        $menuCMI.filter('.colour-label-items').addClass('hidden');
                        $menuCMI.filter('.send-to-contact-item').addClass('hidden');
                    }
                    else if (M.getNodeShare(id).down === 1) {
                        $menuCMI.filter('.copy-item').addClass('hidden');
                        $menuCMI.filter('.move-item').addClass('hidden');
                        $menuCMI.filter('.send-to-contact-item').addClass('hidden');
                    }
                    else {
                        updateUIPerItems($menuCMI, items);
                    }

                    if (M.getNodeByHandle(id).su) {
                        const ed = authring.getContactAuthenticated(M.d[id].su, 'Ed25519');

                        if (!(ed && ed.method >= authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON) &&
                            M.currentdirid !== `chat/contacts/${M.d[id].su}`) {
                            $menuCMI.filter('.verify-credential').removeClass('hidden');
                        }
                    }

                    // Hide Info item if properties dialog is opened
                    if ($.dialog === 'properties') {
                        $menuCMI.filter('.properties-item').addClass('hidden');
                    }

                    // Hide items for selection Bar Options button
                    if (!$currentTarget.attr('id')) {
                        $menuCMI.filter('.download-item, .sh4r1ng-item, .send-to-contact-item,' +
                            '.getlink-item, .remove-item').addClass('hidden');
                    }

                    onIdle(showContextMenu);
                })
                .catch(dump);
        }
        else {
            return false;
        }
    }

    if (!asyncShow) {
        showContextMenu();
    }

    e.preventDefault();
};

/**
 * Sets the text in the context menu for the Get link and Remove link items. If there are
 * more than one nodes selected then the text will be pluralised. If all the selected nodes
 * have public links already then the text will change to 'Update link/s'.
 */
MegaData.prototype.setContextMenuGetLinkText = function() {
    "use strict";

    var numOfExistingPublicLinks = 0;
    var numOfSelectedNodes = Object($.selected).length;
    var getLinkText = '';

    // Loop through all selected nodes
    for (var i = 0; i < numOfSelectedNodes; i++) {

        // Get the node handle of the current node
        var nodeHandle = $.selected[i];

        // If it has a public link, then increment the count
        if (M.getNodeShare(nodeHandle)) {
            numOfExistingPublicLinks++;
        }
    }

    // Toggle manage link class for a/b testing purposes
    const cdGetLinkToggle = (func) => {
        const el = document.querySelector('.dropdown.body .cd-getlink-item');

        if (el && !is_mobile) {
            el.classList[func]('manage-link');
        }
    };

    // If all the selected nodes have existing public links, set text to 'Manage links' or 'Manage link'
    if (numOfSelectedNodes === numOfExistingPublicLinks) {
        getLinkText = numOfSelectedNodes > 1 ? l[17520] : l[6909];
        cdGetLinkToggle('add');
    }
    else {
        // Otherwise change text to 'Share links' or 'Share link' if there are selected nodes without links
        getLinkText = mega.icu.format(l.share_link, numOfSelectedNodes);
        cdGetLinkToggle('remove');
    }

    // If there are multiple nodes with existing links selected, set text to 'Remove links', otherwise 'Remove link'
    const removeLinkText = numOfExistingPublicLinks > 1 ? l[8735] : l[6821];

    // Set the text for the 'Get/Update link/s' and 'Remove link/s' context menu items
    if (is_mobile) {

        mega.ui.contextMenu.getChild('.getlink-item').text = getLinkText;
        mega.ui.contextMenu.getChild('.removelink-item').text = removeLinkText;
    }
    else {
        document.querySelector('.dropdown.body .getlink-item span').textContent = getLinkText;
        document.querySelector('.dropdown.body .removelink-item span').textContent = removeLinkText;
        document.querySelector('.dropdown.body .cd-getlink-item span').textContent = getLinkText;
        document.querySelector('.dropdown.body .cd-removelink-item span').textContent = removeLinkText;
    }
};

/**
 * Sets the text in the context menu for the sharing option.
 * If the folder is shared or has pending shares then the text will be set to 'Manage share',
 * else the text will be set to 'Share folder'.
 */
MegaData.prototype.setContextMenuShareText = function() {
    'use strict';

    const n = M.d[$.selected[0]] || false;
    const isS4Bucket = n.s4 && 'kernel' in s4 && s4.kernel.getS4NodeType(n) === 'bucket';
    let getLinkText = M.currentrootid === M.InboxID
        || M.getNodeRoot($.selected[0]) === M.InboxID ? l.read_only_share : l[5631];
    let getLinkIcon = 'sprite-mobile-fm-mono icon-share-thin-outline';
    let manageIcon = 'icon-folder-outgoing-share';
    let removeIcon = 'icon-folder-remove-share';
    const cdShareItem = document.querySelector('.dropdown.body .cd-sh4r1ng-item');

    if (isS4Bucket) {
        getLinkText = l.s4_share_bucket;
        manageIcon = 'icon-bucket-outgoing-share';
        removeIcon = 'icon-bucket-remove-share';
    }

    // Toggle manage share class for a/b testing purposes
    const cdShareToggle = (func) => {
        if (cdShareItem && !is_mobile) {
            cdShareItem.classList[func]('manage-share');
        }
    };

    // If the node has shares or pending shares, set to 'Manage share', else, 'Share folder'
    if (n && M.getNodeShareUsers(n, 'EXP').length || M.ps[n]) {
        getLinkText = l.manage_share;
        getLinkIcon = 'sprite-mobile-fm-mono icon-settings-thin-outline';
        cdShareToggle('add');
    }
    else {
        cdShareToggle('remove');
    }

    if (is_mobile) {

        const shareBtn = mega.ui.contextMenu.getChild('.sh4r1ng-item');
        shareBtn.text = getLinkText;
        shareBtn.icon = getLinkIcon;
    }
    else {

        const shareItem = document.querySelector('.dropdown.body .sh4r1ng-item');
        const removeItem = document.querySelector('.dropdown.body .removeshare-item');
        const cdRemoveItem = document.querySelector('.dropdown.body .cd-removeshare-item');

        cdShareItem.querySelector('span').textContent = getLinkText;
        cdShareItem.querySelector('i').className = `sprite-fm-mono ${manageIcon}`;
        shareItem.querySelector('span').textContent = getLinkText;
        shareItem.querySelector('i').className = `sprite-fm-mono ${manageIcon}`;
        removeItem.querySelector('i').className = `sprite-fm-mono ${removeIcon}`;
        cdRemoveItem.querySelector('i').className = `sprite-fm-mono ${removeIcon}`;
    }
};

/**
 * @param {jQuery.Event} e jQuery event
 * @param {Object} m Context menu jQuery object
 */
MegaData.prototype.adjustContextMenuPosition = function(e, m) {
    "use strict";

    // mouse cursor, returns the coordinates within the application's client area
    // at which the event occurred (as opposed to the coordinates within the page)
    var mX = e.clientX;
    var mY = e.clientY;

    var mPos;// menu position
    if (e.type === 'click' && !e.calculatePosition) {// Clicked on file-settings-icon
        var ico = { 'x': e.delegateTarget.clientWidth, 'y': e.delegateTarget.clientHeight };
        var icoPos = getHtmlElemPos(e.delegateTarget);// Get position of clicked file-settings-icon
        mPos = M.reCalcMenuPosition(m, icoPos.x, icoPos.y, ico);
    }
    else {// right click
        mPos = M.reCalcMenuPosition(m, mX, mY);
    }

    m.css({ 'top': mPos.y, 'left': mPos.x });// set menu position

    return true;
};

/**
 * Calculates coordinates where context menu will be shown
 * @param {Object} m jQuery object of context menu or child class
 * @param {Number} x Coordinate x of cursor or clicked element
 * @param {Number} y Coordinate y of cursor or clicked element
 * @param {Object} ico JSON {x, y} width and height of element clicked on
 * @returns {Object} Coordinates {x, y} where context menu will be drawn
 */
MegaData.prototype.reCalcMenuPosition = function(m, x, y, ico) {
    "use strict";

    var TOP_MARGIN = 12;
    var SIDE_MARGIN = 12;

    let hiddenUpdate;

    // make it as visitble hidden for temporary to get context size to avoid 'display: none!important' return size 0 bug
    // Somehow 'display: none' with '!important' causing jQuery offsetWidth and offsetHeight malfunction.
    if (m.hasClass('hidden')) {
        m.removeClass('hidden').addClass('v-hidden');
        hiddenUpdate = true;
    }

    var cmW = m.outerWidth();// dimensions without margins calculated
    var cmH = m.outerHeight();// dimensions without margins calculated

    if (hiddenUpdate) {
        m.removeClass('v-hidden').addClass('hidden');
    }

    var wH = window.innerHeight;
    var wW = window.innerWidth;
    var maxX = wW - SIDE_MARGIN;// max horizontal coordinate, right side of window
    var maxY = wH - TOP_MARGIN;// max vertical coordinate, bottom side of window

    // min horizontal coordinate, left side of right panel
    var minX = SIDE_MARGIN + $('nav.nw-fm-left-icons-panel').outerWidth();
    var minY = TOP_MARGIN;// min vertical coordinate, top side of window
    var wMax = x + cmW;// coordinate of context menu right edge
    var hMax = y + cmH;// coordinate of context menu bottom edge

    var top = 'auto';
    var left = '100%';
    var right = 'auto';

    var overlapParentMenu = function(n) {
        var tre = wW - wMax;// to right edge
        var tle = x - minX - SIDE_MARGIN;// to left edge

        if (tre >= tle) {
            n.addClass('overlap-right');
            n.css({'top': top, 'left': (maxX - x - nmW) + 'px'});
        }
        else {
            n.addClass('overlap-left');
            n.css({'top': top, 'right': (wMax - nmW - minX) + 'px'});
        }
    };

    /**
     * Calculates top position of submenu
     * Submenu is relatively positioned to the first sibling element
     * @param {Object} n jQuery object, submenu of hovered element
     * @returns {String} top Top coordinate in pixels for submenu
     */
    var horPos = function(n) {
        var top;
        var nTop = parseInt(n.css('padding-top'));
        var tB = parseInt(n.css('border-top-width'));
        var pPos = m.position();
        var b = y + nmH - (nTop - tB);// bottom of submenu
        var mP = m.closest('.dropdown.body.submenu');
        var pT = 0;
        var bT = 0;
        var pE = { top: 0 };

        if (mP.length) {
            pE = mP.offset();
            pT = parseInt(mP.css('padding-top'));
            bT = parseInt(mP.css('border-top-width'));
        }

        var difference = 0;

        if (b > maxY) {
            difference = b - maxY;
        }
        top = pPos.top - tB - difference + 'px';

        return top;
    };

    var handleSmall = function(dPos) {
        m.find('> .dropdown-section').wrapAll('<div id="cm_scroll" class="context-scrolling-block"></div>');
        m.append('<span class="context-top-arrow"></span><span class="context-bottom-arrow"></span>');
        m.addClass('mega-height');
        cmH = wH - TOP_MARGIN * 2;
        m.css({ 'height': wH - TOP_MARGIN * 2 + 'px' });
        m.on('mousemove', M.scrollMegaSubMenu);
        dPos.y = wH - cmH;
    };

    var removeMegaHeight = function() {
        if (m.hasClass('mega-height')) {
            // Cleanup for scrollable context menu upon resizing window.
            var cnt = $('#cm_scroll').contents();
            $('#cm_scroll').replaceWith(cnt);// Remove .context-scrollable-block
            m.removeClass('mega-height');
            m.find('> .context-top-arrow').remove();
            m.find('> .context-bottom-arrow').remove();
            m.css({ 'height': 'auto' });// In case that window is enlarged
        }
    };

    var dPos;// new context menu position
    var rtl = $('body').hasClass('rtl');

    if (typeof ico === 'object') {// draw context menu relative to file-settings-icon
        dPos = { 'x': x , 'y': y + ico.y + 4 };// position for right-bot

        // draw to the left
        if (wMax > maxX) {
            dPos.x = x - cmW + ico.x;// additional pixels to align with -icon
        }

        if (cmH + 24 >= wH) {// Handle small windows height
            handleSmall(dPos);
        }
        else {
            removeMegaHeight();
            if (hMax > maxY - TOP_MARGIN) {
                dPos.y = y - cmH - 4;
                if (dPos.y < TOP_MARGIN) {
                    dPos.y = TOP_MARGIN;
                }
            }
        }
    }
    else if (ico === 'submenu') {// submenues
        var n = m.next('.dropdown.body.submenu');
        var nmW = n.outerWidth();// margin not calculated
        var nmH = n.outerHeight();// margins not calculated
        if (nmH >= (maxY - TOP_MARGIN)) {// Handle huge menu
            nmH = maxY - TOP_MARGIN;
            var tmp = document.getElementById('csb_' + String(m.attr('id')).replace('fi_', ''));
            if (tmp) {
                $(tmp).addClass('context-scrolling-block');
                tmp.addEventListener('mousemove', M.scrollMegaSubMenu.bind(this));

                // add scrollable context menu.
                n.addClass('mega-height');
                n.css({'height': nmH + 'px'});
            }
        }

        top = horPos(n);

        if (rtl) {
            if (m.parent().parent('.right-position').length === 0) {
                if (minX <= (x - nmW)) {
                    left = '100%';
                    right = 'auto';
                }
                else if (maxX >= (wMax + nmW)) {
                    n.addClass('right-position');
                }
                else {
                    overlapParentMenu(n);

                    return true;
                }
            }
            else {
                if (maxX >= (wMax + nmW)) {
                    n.addClass('right-position');
                }
                else if (minX <= (x - nmW)) {
                    left = '100%';
                    right = 'auto';
                }
                else {
                    overlapParentMenu(n);

                    return true;
                }
            }
        }
        else {
            if (m.parent().parent('.left-position').length === 0) {
                if (maxX >= (wMax + nmW)) {
                    left = 'auto';
                    right = '100%';
                }
                else if (minX <= (x - nmW)) {
                    n.addClass('left-position');
                }
                else {
                    overlapParentMenu(n);

                    return true;
                }
            }
            else {
                if (minX <= (x - nmW)) {
                    n.addClass('left-position');
                }
                else if (maxX >= (wMax + nmW)) {
                    left = 'auto';
                    right = '100%';
                }
                else {
                    overlapParentMenu(n);

                    return true;
                }
            }
        }

        return {'top': top, 'left': left, 'right': right};
    }
    else {// right click

        if (rtl) {
            dPos = { 'x': x - 10 - m.outerWidth(), 'y': y + 10 };
        }
        else {
            dPos = { 'x': x + 10, 'y': y + 10 };
        }

        if (cmH + 24 >= wH) {// Handle small windows height
            handleSmall(dPos);
        }
        else {
            removeMegaHeight();
            if (hMax > maxY) {
                dPos.y = wH - cmH - TOP_MARGIN;// align with bottom
            }
        }

        if (x < minX) {
            dPos.x = minX;// left side alignment
        }
        if (wMax > maxX) {
            dPos.x = maxX - cmW;// align with right side
        }
    }

    return { 'x': dPos.x, 'y': dPos.y };
};

// Scroll menus which height is bigger then window.height
MegaData.prototype.scrollMegaSubMenu = function(e) {
    "use strict";

    var c = $(e.target).closest('.dropdown.body.mega-height');
    var pNode = c.children(':first')[0];

    if (typeof pNode === 'undefined') {
        pNode = c[0];
    }

    if (typeof pNode !== 'undefined') {
        var ey = e.pageY;
        var h = pNode.offsetHeight;
        var dy = h * 0.1;// 10% dead zone at the begining and at the bottom
        var pos = getHtmlElemPos(pNode, true);
        var py = (ey - pos.y - dy) / (h - dy * 2);

        if (py > 1) {
            py = 1;
            c.children('.context-bottom-arrow').addClass('disabled');
        }
        else if (py < 0) {
            py = 0;
            c.children('.context-top-arrow').addClass('disabled');
        }
        else {
            c.children('.context-bottom-arrow,.context-top-arrow').removeClass('disabled');
        }
        pNode.scrollTop = py * (pNode.scrollHeight - h);
    }
};

MegaData.prototype.labelSortMenuUI = function(event, rightClick) {
    "use strict";

    var $menu = $('.colour-sorting-menu');
    var $menuItems = $('.colour-sorting-menu .dropdown-colour-item');
    var x = 0;
    var y = 0;
    var $sortMenuItems = $('.dropdown-item', $menu).removeClass('active');
    var $selectedItem;
    var type = this.currentLabelType;
    var sorting = M.sortmode || {n: 'name', d: 1};

    var dirClass = sorting.d > 0 ? 'icon-up' : 'icon-down';

    // Close label filtering sorting menu on second Name column click
    if ($menu.is(':visible') && !rightClick) {
        $menu.addClass('hidden');
        return false;
    }

    $('.colour-sorting-menu .dropdown-colour-item').removeClass('active');
    if (M.filterLabel[type]) {
        for (var key in M.filterLabel[type]) {
            if (key) {
                $menuItems.filter('[data-label-id=' + key + ']').addClass('active');
            }
        }
    }

    $selectedItem = $sortMenuItems
        .filter('*[data-by=' + sorting.n + ']')
        .addClass('active');

    var tmpFn = function() {
        x = event.clientX;
        y = event.clientY;

        $menu.css('left', x + 'px');
        $menu.css('top', y + 'px');
    };

    if (rightClick) {// FM right mouse click on node
        M.adjustContextMenuPosition(event, $menu);
    }
    else {
        tmpFn();
    }

    delay('render:search_breadcrumbs', () => M.renderSearchBreadcrumbs());
    $.hideTopMenu();
    $.hideContextMenu();
    $menu.removeClass('hidden');

    $('.colour-sorting-menu').off('click', '.dropdown-item');
    $('.colour-sorting-menu').on('click', '.dropdown-item', function() {
        // dont to any if it is static
        if ($(this).hasClass('static')){
            return false;
        }

        if (d){
            console.log('fm sorting start');
        }

        var data = $(this).data();
        var dir = 1;

        if ($(this).hasClass('active')) {// Change sort direction
            dir = sorting.d * -1;
        }

        $('.colour-sorting-menu').addClass('hidden');

        var lbl = function(el) {
            return el.lbl;
        };
        if (data.by === 'label' && !M.v.some(lbl)) {
            return false;
        }

        M.doSort(data.by, dir);
        M.renderMain();

        return false;
    });

    return false;
};

MegaData.prototype.resetLabelSortMenuUI = function() {
    "use strict";

    $('.colour-sorting-menu .dropdown-item').removeClass('active asc desc');
    return false;
};

MegaData.prototype.getSelectedRemoveLabel = (handlesArr) => {
    'use strict';

    let allAreRubbish = true;
    let allAreNotRubbish = true;

    for (let i = 0; i < handlesArr.length; i++) {
        if (M.getNodeRoot(handlesArr[i]) === M.RubbishID) {
            allAreNotRubbish = false;
        }
        else {
            allAreRubbish = false;
        }

        if (!allAreRubbish && !allAreNotRubbish) {
            break;
        }
    }

    if (allAreRubbish) {
        return l.delete_permanently;
    }

    if (allAreNotRubbish) {
        return l.move_to_rubbish_bin;
    }

    return l[83];
};
