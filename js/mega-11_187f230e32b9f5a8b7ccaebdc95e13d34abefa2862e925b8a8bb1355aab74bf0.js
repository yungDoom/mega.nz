/* Bundle Includes:
 *   js/fm/properties.js
 *   js/fm/removenode.js
 *   js/fm/ufssizecache.js
 *   html/js/pro.js
 *   html/js/proplan.js
 *   html/js/planpricing.js
 *   html/js/propay.js
 *   html/js/propay-dialogs.js
 *   js/states-countries.js
 *   js/ui/miniui.js
 *   js/fm/achievements.js
 */

(function _properties(global) {
    'use strict';

    /**
     * Handles node properties/info dialog contact list content
     * @param {Object} $dialog The properties dialog
     * @param {Array} users The list of users to whom we're sharing the selected nodes
     * @private
     */
    function fillPropertiesContactList($dialog, users) {

        var MAX_CONTACTS = 5;
        var shareUsersHtml = '';
        var $shareUsers = $dialog.find('.properties-body .properties-context-menu')
            .empty()
            .append('<div class="properties-context-arrow"></div>');

        for (var i = users.length; i--;) {
            var user = users[i];
            var userHandle = user.u || user.p;
            var hidden = i >= MAX_CONTACTS ? 'hidden' : '';
            var status = megaChatIsReady && megaChat.getPresenceAsCssClass(user.u);

            shareUsersHtml += '<div class="properties-context-item ustatus ' + escapeHTML(userHandle)
                + ' ' + (status || '') + ' ' + hidden + '" data-handle="' + escapeHTML(userHandle) + '">'
                + '<div class="properties-contact-status"></div>'
                + '<span>' + escapeHTML(M.getNameByHandle(userHandle)) + '</span>'
                + '</div>';
        }

        if (users.length > MAX_CONTACTS) {
            shareUsersHtml += '<div class="properties-context-item show-more">'
                + '<span>...' + escapeHTML(l[10663]).replace('[X]', users.length - MAX_CONTACTS) + '</span>'
                + '</div>';
        }

        if (shareUsersHtml !== '') {
            $shareUsers.append(shareUsersHtml);
        }
    }

    /**
     * Gets properties HTML
     * @param {Object} p The properties data
     * @returns {String} Properties HTML
     */
    function getPropertiesContent(p) {
        if  (typeof p !== 'object') {
            return false;
        }

        // Name
        const namehtml = is_mobile ? '' : '<div class="properties-name-container">'
            + '<div class="properties-small-gray">' + p.t1 + '</div>'
            + '<div class="properties-name-block"><div class="propreties-dark-txt">' + p.t2 + '</div>'
            + '</div></div>';

        // Type
        const typehtml = is_mobile && p.t23 ? '<div class="properties-float-bl">'
            + '<span class="properties-small-gray">' + p.t22 + '</span>'
            + '<span class="propreties-dark-txt">' + p.t23 + '</span></div>' : '';

        // Versioning info
        const vhtml = p.versioningFlag
            ?
            '<div class="properties-float-bl' + p.t12 + '"><span class="properties-small-gray">' + p.t13 + '</span>'
            + '<span class="propreties-dark-txt">' + p.t14 + '</span></div>'
            + '<div class="properties-float-bl"><span class="properties-small-gray">' + p.t15 + '</span>'
            + '<span class="propreties-dark-txt">' + p.t16 + '</span></div>'
            + '<div class="properties-float-bl' + p.t17 + '"><span class="properties-small-gray">' + p.t18 + '</span>'
            + '<span class="propreties-dark-txt">' + p.t19 + '</span></div>'
            : '';

        // Modifed or Owner
        const singlenodeinfohtml  = '<div class="properties-float-bl' + p.t5 + ' properties-contains">'
            + '<span class="properties-small-gray">' + p.t6 + '</span>'
            + '<span class="propreties-dark-txt t7">' + p.t7 + '</span></div>';

        // Link created
        const linkcreatedhtml = is_mobile && p.t21 ? '<div class="properties-float-bl">'
            + '<span class="properties-small-gray">' + p.t20 + '</span>'
            + '<span class="propreties-dark-txt t7">' + p.t21 + '</span></div>' : '';

        // Created or Contains
        const shareinfohtml = typeof p.t10 === 'undefined' && typeof p.t11 === 'undefined'
            ? ''
            : '<div class="properties-float-bl"><div class="properties-small-gray t10">' + p.t10 + '</div>'
            + '<div class="propreties-dark-txt t11">' + p.t11 + '</div></div></div>';

        return namehtml
            + `<div class="properties-breadcrumb"><div class="properties-small-gray path">${l.path_lbl}</div>`
            + '<div class="fm-breadcrumbs-wrapper info">'
            +                    '<div class="crumb-overflow-link dropdown">'
            +                       '<a class="breadcrumb-dropdown-link info-dlg">'
            +                            '<i class="menu-icon sprite-fm-mono icon-options icon24"></i>'
            +                        '</a>'
            +                        '<i class="sprite-fm-mono icon-arrow-right icon16"></i>'
            +                    '</div>'
            +                    `<div class="fm-breadcrumbs-block info${is_mobile ? ' location' : ''}"></div>`
            +                    '<div class="breadcrumb-dropdown"></div>'
            +                '</div>'
            + '</div>'
            + '<div class="properties-items"><div class="properties-float-bl properties-total-size">'
            + '<span class="properties-small-gray">' + p.t3 + '</span>'
            + '<span class="propreties-dark-txt">' + p.t4 + '</span></div>'
            + typehtml
            + vhtml
            + singlenodeinfohtml
            + '<div class="properties-float-bl">'
            + (p.n.h === M.RootID || p.n.h === M.RubbishID || p.n.h === M.InboxID ?
                '<div class="contact-list-icon sprite-fm-mono icon-info-filled"></div>'
                + '</div>'
                + shareinfohtml :
                '<div class="properties-small-gray">' + p.t8
                + '</div><div class="propreties-dark-txt contact-list">'
                + '<span>' + p.t9 + '</span>'
                + '<div class="contact-list-icon sprite-fm-mono icon-info-filled"></div>'
                + '</div></div>'
                + shareinfohtml
                + linkcreatedhtml);
    }

    /**
     * Gets properties data
     * @param {String|Array} handles Selected node handles {optional}
     * @returns {Object|Boolean} Properties data and strings
     */
    function getNodeProperties(handles) {
        let filecnt = 0;
        let foldercnt = 0;
        let size = 0;
        let sfilecnt = 0;
        let sfoldercnt = 0;
        let vsize = 0;
        let svfilecnt = 0;
        let n;
        const icons = [];
        const selected = [];
        const p = Object.create(null);

        handles = typeof handles === 'string' && [handles] || handles || $.selected || [];

        for (var i = handles.length; i--;) {
            const node = M.getNodeByHandle(handles[i]);

            if (!node) {

                if (d) {
                    console.log('propertiesDialog: invalid node', handles[i]);
                }
                continue;
            }

            n = node;
            icons.push(`item-type-icon-90 icon-${fileIcon(n)}-90`);
            selected.push(handles[i]);

            if (n.t) {
                size += n.tb;// - (n.tvb || 0);
                sfilecnt += n.tf;// - (n.tvf || 0);
                sfoldercnt += n.td;
                foldercnt++;
                vsize += n.tvb || 0;
                svfilecnt += n.tvf || 0;
            }
            else {
                filecnt++;
                size += n.s;
                vsize += n.tvb || 0;
                svfilecnt += n.tvf || 0;
            }
        }

        if (selected.length > 1) {
            n = Object.create(null); // empty n [multiple selection]
        }

        if (!n) {
            return false;
        }

        if (n.tvf) {
            p.versioningFlag = true;

            if (n.rewind) {
                p.fromRewind = true;
            }
        }

        // Hide versioning details temporarily, due to it not working correctly in MEGA Lite / Infinity
        if (mega.lite.inLiteMode) {
            p.versioningFlag = false;
        }

        const exportLink = new mega.Share.ExportLink({});
        p.isTakenDown = exportLink.isTakenDown(selected);
        p.isUndecrypted = missingkeys[n.h];

        if (filecnt + foldercnt === 1) { // one item
            // Favorite icon
            if (n.fav && !folderlink && M.getNodeRoot(n.h) !== M.RubbishID) {
                p.favIcon = ' sprite-fm-mono icon-favourite-filled';
            }
            else if (missingkeys[n.h]) {
                p.favIcon = ' sprite-fm-mono icon-info';
            }

            // Outgoing share
            // @todo: Fix live site issue. Outgoing contacts are never shown
            if (icons.includes('icon-outgoing-90')) {
                p.share = true;
            }

            // Incoming share
            if (typeof n.r === "number") {
                p.zclass = 'read-only';

                if (n.r === 1) {
                    p.zclass = 'read-and-write';
                }
                else if (n.r === 2) {
                    p.zclass = 'full-access';
                }
                p.share = true;
            }

            const user = Object(M.d[n.su || n.p]);
            const shareTs = M.getNodeShare(n).ts;

            if (d) {
                console.log('propertiesDialog', n, user);
            }

            p.t6 = '';
            p.t7 = '';

            if (filecnt) {
                p.t3 = l[5605];
                p.t5 = ' second';

                if (n.mtime) {
                    p.t6 = l[22129];
                    p.t7 = htmlentities(time2date(n.mtime));
                }
            }
            else {
                p.t3 = l[22130];
                p.t5 = '';
            }
            p.t1 = l[1764];

            if (p.isUndecrypted) {
                p.t2 = htmlentities(l[8649]);
            }
            else if (mega.backupCenter
                && mega.backupCenter.selectedSync
                && mega.backupCenter.selectedSync.nodeHandle === n.h
                && mega.backupCenter.selectedSync.localName) {

                p.t2 = htmlentities(mega.backupCenter.selectedSync.localName);
            }
            else if (n.name) {
                p.t2 = htmlentities(n.name);
            }
            else if (n.h === M.RootID) {
                p.t2 = htmlentities(l[164]);
            }
            else if (n.h === M.InboxID) {
                p.t2 = htmlentities(l.restricted_folder_button);
            }
            else if (n.h === M.RubbishID) {
                p.t2 = htmlentities(l[167]);
            }

            p.t4 = p.versioningFlag ? bytesToSize(size + vsize) : bytesToSize(size);
            p.t9 = n.ts && htmlentities(time2date(n.ts)) || '';
            p.t8 = p.t9 ? l[22143] : '';
            p.t12 = ' second';
            p.t13 = l[22144];
            p.t14 = mega.icu.format(l.version_count, svfilecnt);
            p.t15 = l[22145];
            p.t16 = bytesToSize(size);
            p.t17 = ' second';
            p.t18 = l[22146];
            p.t19 = bytesToSize(vsize);

            // Link created
            p.t20 = l.link_created_with_colon;
            p.t21 = shareTs && htmlentities(time2date(shareTs)) || '';

            // Item type
            p.t22 = l[22149];
            p.t23 = foldercnt ? l[1049] : filetype(n, 0, 1);

            if (foldercnt) {
                p.t6 = l[22147];
                p.t7 = fm_contains(sfilecnt, sfoldercnt, true);
                p.t15 = l[22148];
                if (p.share) {
                    p.users = M.getSharingUsers(selected, true);

                    // In case that user shares with other
                    // Show contact informations in property dialog
                    if (p.users.length) {
                        p.t8 = l[5611];
                        p.t9 = mega.icu.format(l.contact_count, p.users.length);
                        p.t11 = n.ts ? htmlentities(time2date(n.ts)) : '';
                        p.t10 = p.t11 ? l[6084] : '';
                        p.usersCounter = typeof n.r !== "number" && p.users.length;
                    }
                    else {
                        p.hideContacts = true;
                    }
                }
                if (typeof n.r === "number") {
                    p.t3 = l[5612];
                    let rights = l[55];
                    if (n.r === 1) {
                        rights = l[56];
                    }
                    else if (n.r === 2) {
                        rights = l[57];
                    }
                    p.t4 = rights;
                    p.t6 = l[22157];
                    p.t7 = htmlentities(M.getNameByHandle(user.h));
                    p.t8 = l[22130];
                    p.t9 = p.versioningFlag ? bytesToSize(size + vsize) : bytesToSize(size);
                    p.t10 = l[22147];
                    p.t11 = fm_contains(sfilecnt, sfoldercnt, true);
                }
            }
            if (filecnt && p.versioningFlag && M.currentrootid !== M.RubbishID && !p.fromRewind) {
                p.t14 = '<a id="previousversions">' + p.t14 + '</a>';
            }
        }
        else {
            p.t1 = '';
            p.t2 = '<b>' + fm_contains(filecnt, foldercnt) + '</b>';
            p.t3 = l[22130];
            p.t4 = p.versioningFlag ? bytesToSize(size + vsize) : bytesToSize(size);
            if (foldercnt) {
                p.t5 = '';
                p.t6 = l[22147];
                p.t7 = fm_contains(sfilecnt + filecnt, sfoldercnt + foldercnt, true);
            }
            else {
                p.t5 = ' second';
            }
            p.t8 = l[22149];
            p.t9 = l[1025];
            p.t12 = '';
            p.t13 = l[22144];
            p.t14 = mega.icu.format(l.version_count, svfilecnt);
            p.t15 = l[22148];
            p.t16 = bytesToSize(size);
            p.t17 = '';
            p.t18 = l[22146];
            p.t19 = bytesToSize(vsize);
        }

        return {...p, n, filecnt, foldercnt, icons};
    }

    function _propertiesDialog(action) {
        const update = action === 3;
        const close = !update && action;
        const $dialog = $('.mega-dialog.properties-dialog', '.mega-dialog-container');
        const $icon = $('.properties-file-icon', $dialog);

        $(document).off('MegaCloseDialog.Properties');

        if (close) {
            delete $.propertiesDialog;
            if (close === 2) {
                fm_hideoverlay();
            }
            else {
                closeDialog();
            }
            $('.contact-list-icon').removeClass('active');
            $('.properties-context-menu').fadeOut(200);
            if ($.hideContextMenu) {
                $.hideContextMenu();
            }

            return true;
        }

        $dialog.removeClass('multiple folders-only two-elements shared shared-with-me');
        $dialog.removeClass('read-only read-and-write full-access taken-down undecryptable');
        $dialog.removeClass('hidden-context versioning');
        $('.properties-elements-counter span').text('');

        const p = getNodeProperties();
        const {n, filecnt, foldercnt, icons} = p;

        if (!n) {
            // $.selected had no valid nodes!
            propertiesDialog(1);

            return msgDialog('warninga', l[882], l[24196]);
        }

        if ($.dialog === 'onboardingDialog') {
            closeDialog();
        }

        M.safeShowDialog('properties', () => {
            $.propertiesDialog = 'properties';

            // If it is download page or
            // node is not owned by current user on chat
            // (possible old shared file and no longer exist on cloud-drive, or shared by other user in the chat room),
            // don't display path
            if (page === 'download' || M.chat && n.u !== u_handle
                || !n.h && !M.d[M.currentdirid] || M.isAlbumsPage()) {

                $('.properties-breadcrumb', $dialog).addClass('hidden');
            }
            else {
                // on idle so we can call renderPathBreadcrumbs only once the info dialog is rendered.
                onIdle(() => {
                    // we pass the filehandle, so it is available if we search on files on search
                    M.renderPathBreadcrumbs(n.h, true);
                    mBroadcaster.sendMessage('properties:finish', n.h);
                });
            }
            return $dialog;
        });

        // Set properties data
        $('.properties-txt-pad').safeHTML(getPropertiesContent(p));

        // Hide context menu button
        if (page.substr(0, 7) === 'fm/chat' || n.h === M.RootID || slideshowid || n.h === M.RubbishID) {
            $dialog.addClass('hidden-context');
        }

        if (filecnt + foldercnt === 1) {
            // Show takenDown / undecrypted message
            if (p.isTakenDown || p.isUndecrypted) {
                let notificationText = '';
                if (p.isTakenDown) {
                    $dialog.addClass('taken-down');
                    notificationText = l[7703] + '\n';
                }
                if (p.isUndecrypted) {
                    $dialog.addClass('undecryptable');
                    notificationText += M.getUndecryptedLabel(n);
                }
                showToast('clipboard', notificationText);
            }
        }
        // Adapt UI for multiple selected items
        // @todo: probably remove folder only (?)
        else {
            $dialog.addClass('multiple folders-only');
        }

        // Adapt UI for file versioning
        if (p.versioningFlag) {
            $dialog.addClass('versioning');
        }

        // Adapt UI for outgoing shares
        if (p.share) {
            $dialog.addClass('shared');
        }

        // Add incoming share access icon
        if (p.zclass) {
            $dialog.addClass(`shared shared-with-me ${p.zclass}`);
        }

        // Fill in information about the users with whom the folder was shared
        if (p.users && !p.hideContacts) {
            $('.properties-elements-counter span').text(p.usersCounter || '');
            fillPropertiesContactList($dialog, p.users);
        }

        // Add Favourite icon
        if (p.favIcon) {
            $('.file-status-icon', $dialog).attr('class', 'file-status-icon ' + p.favIcon);
        }

        /* If in MEGA Lite mode for folders, temporarily hide the Total Size and Contains info which isn't known */
        if (mega.lite.inLiteMode && mega.lite.containsFolderInSelection($.selected)) {
            $dialog.addClass('hide-size-and-contains');
        }
        else {
            $dialog.removeClass('hide-size-and-contains');
        }

        if ($dialog.hasClass('shared-with-me') || p.hideContacts) {
            $('.contact-list-icon', '.properties-txt-pad').addClass('hidden');
        }

        $('.properties-body', $dialog).rebind('click', function() {
            // Clicking anywhere in the dialog will close the context-menu, if open
            var $fsi = $('.file-settings-icon', $dialog);
            if ($fsi.hasClass('active')) {
                $fsi.click();
            }

            // Clicking anywhere in the dialog would close the path breadcrumb dropdown if exists and open
            const $pathBreadcrumb = $('.breadcrumb-dropdown', $dialog);
            if ($pathBreadcrumb && $pathBreadcrumb.hasClass('active')) {
                $pathBreadcrumb.removeClass('active');
            }
        });

        if ((filecnt === 1) && (foldercnt === 0)) {
            $('#previousversions').rebind('click', function(ev) {
                mBroadcaster.sendMessage('trk:event', 'properties-dialog', 'click', 'file-version', n);

                if (M.currentrootid !== M.RubbishID) {
                    if (slideshowid) {
                        slideshow(n.h, 1);
                    }
                    fileversioning.fileVersioningDialog(n.h);
                    closeDialog();
                }
            });
        }

        $('button.js-close', $dialog).rebind('click', _propertiesDialog);

        var __fsi_close = function() {
            $dialog.find('.file-settings-icon').removeClass('active');
            $('.dropdown.body').removeClass('arrange-to-front');
            $('.properties-dialog').removeClass('arrange-to-back');
            $('.mega-dialog').removeClass('arrange-to-front');
            $.hideContextMenu();
        };

        $dialog.find('.file-settings-icon').rebind('click context', function(e) {
            if (!$(this).hasClass('active')) {
                e.preventDefault();
                e.stopPropagation();
                $(this).addClass('active');
                // $('.mega-dialog').addClass('arrange-to-front');
                // $('.properties-dialog').addClass('arrange-to-back');
                $('.dropdown.body').addClass('arrange-to-front');
                e.currentTarget = $('#' + n.h);
                if (!e.currentTarget.length) {
                    e.currentTarget = $('#treea_' + n.h);
                }
                e.calculatePosition = true;
                $.selected = [n.h];
                M.contextMenuUI(e, n.h.length === 11 ? 5 : 1);
            }
            else {
                __fsi_close();
            }

            return false;
        });

        $(document).rebind('MegaCloseDialog.Properties', __fsi_close);

        if ($dialog.hasClass('shared')) {
            $('.contact-list-icon').rebind('click', function() {
                if (!$(this).hasClass('active')) {
                    $(this).addClass('active');
                    var $pcm = $('.properties-context-menu');
                    var position = $(this).position();
                    $pcm.css({
                        'left': position.left + 16 + 'px',
                        'top': position.top - $pcm.outerHeight() - 8 + 'px',
                        'transform': 'translateX(-50%)',
                    });
                    $pcm.fadeIn(200);
                }
                else {
                    $(this).removeClass('active');
                    $('.properties-context-menu').fadeOut(200);
                }

                return false;
            });

            $('.properties-dialog').rebind('click', function() {
                var $list = $('.contact-list-icon');
                if ($list.hasClass('active')) {
                    $list.removeClass('active');
                    $('.properties-context-menu').fadeOut(200);
                }
            });

            $('.properties-context-item').rebind('click', function() {
                $('.contact-list-icon').removeClass('active');
                $('.properties-context-menu').fadeOut(200);
                loadSubPage('fm/' + $(this).data('handle'));
                return false;
            });

            // Expands properties-context-menu so rest of contacts can be shown
            // By default only 5 contacts is shown
            $('.properties-context-item.show-more').rebind('click', function() {

                // $('.properties-context-menu').fadeOut(200);
                $('.properties-dialog .properties-context-item')
                    .remove('.show-more')
                    .removeClass('hidden');// un-hide rest of contacts

                var $cli = $('.contact-list-icon');
                var position = $cli.position();
                $('.properties-context-menu').css({
                    'left': position.left + 16 + 'px',
                    'top': position.top - $('.properties-context-menu').outerHeight() - 8 + 'px',
                    'transform': 'translateX(-50%)',
                });
                // $('.properties-context-menu').fadeIn(200);

                return false;// Prevent bubbling
            });
        }

        $icon.text('');

        if (filecnt + foldercnt === 1) {
            mCreateElement('i', {
                'class': icons[0]
            }, $icon[0]);
        }
        else {
            if (filecnt + foldercnt === 2) {
                $dialog.addClass('two-elements');
            }
            $('.properties-elements-counter span', $dialog).text(filecnt + foldercnt);

            var iconsTypes = [];

            for (var j = 0; j < icons.length; j++) {
                var ico = icons[j];

                if (!iconsTypes.includes(ico)) {
                    if (!ico.includes('folder')) {
                        $dialog.removeClass('folders-only');
                    }

                    iconsTypes.push(ico);
                }
            }

            if (icons.length === 2) {
                $dialog.addClass('two-elements');
            }

            for (var k = 0; k < icons.length; k++) {

                if (filecnt && foldercnt || iconsTypes.length > 1) {

                    mCreateElement('i', {
                        'class': `item-type-icon-90 icon-${filecnt ? 'generic' : 'folder'}-90`
                    }, $icon[0]);
                }
                else {

                    mCreateElement('i', {
                        'class': escapeHTML(iconsTypes[0])
                    }, $icon[0]);
                }

                if (k === 2) {
                    break;
                }
            }
        }
    }

    /**
     * @global
     */

    /**
     * Open properties dialog for the selected node(s)
     * @param {Number|Boolean} [close] Whether it should be rather closed.
     * @returns {*|MegaPromise}
     */
    global.propertiesDialog = function propertiesDialog(close) {

        if (close) {
            _propertiesDialog(close);
        }
        else {
            var shares = [];
            var nodes = ($.selected || [])
                .filter(function(h) {
                    if (String(h).length === 11 && M.c[h]) {
                        shares = shares.concat(Object.keys(M.c[h]));
                    }
                    else if (!M.getNodeByHandle(h)) {
                        return true;
                    }
                });
            nodes = nodes.concat(shares);
            var promise = dbfetch.geta(nodes);

            promise.always(function() {
                _propertiesDialog();
            });

            return promise;
        }
    };

    global.getPropertiesContent = getPropertiesContent;
    global.getNodeProperties = getNodeProperties;

})(self);

function removeUInode(h, parent) {
    'use strict';

    let hasSubFolders = 0;
    const n = M.getNodeByHandle(h);

    parent = parent || M.getNodeParent(n || h);

    // check subfolders
    if (n && n.t) {
        const cns = M.c[parent];
        if (cns) {
            for (var cn in cns) {
                if (M.d[cn] && M.d[cn].t && cn !== h) {
                    hasSubFolders++;
                    break;
                }
            }
        }
    }

    // Update M.v it's used for at least preview slideshow
    for (var k = M.v.length; k--;) {
        var v = M.v[k].ch || M.v[k].h;
        if (v === h) {
            if (slideshowid === v) {
                (function(h) {
                    onIdle(function() {
                        slideshow(h, !h);
                    });
                })(slideshow_steps().backward[0]);
            }
            M.v.splice(k, 1);
            break;
        }
    }

    if (mega.gallery.handleNodeRemoval) {
        tryCatch(mega.gallery.handleNodeRemoval)(n);
    }

    if (M.isDynPage(M.currentdirid) > 1) {
        M.dynContentLoader[M.currentdirid].sync(n);
    }

    var hasItems = !!M.v.length;
    const __markEmptied = () => {

        let fmRightFileBlock = document.querySelector('.fm-right-files-block:not(.in-chat)');

        if (fmRightFileBlock) {
            fmRightFileBlock.classList.add('emptied');
        }
    };

    switch (M.currentdirid) {
        case "shares":
            $('#treeli_' + h).remove();// remove folder and subfolders
            if (!hasItems) {

                __markEmptied();
                $('.fm-empty-incoming').removeClass('hidden');
            }
            break;
        case "chat":
            if (!hasItems) {

                __markEmptied();
                $('.fm-empty-chat').removeClass('hidden');
            }
            break;
        case M.RubbishID:
            if (!hasSubFolders) {
                $('#treea_' + parent).removeClass('contains-folders expanded');
            }

            // Remove item
            $('#' + h).remove();

            // Remove folder and subfolders
            $('#treeli_' + h).remove();
            if (!hasItems) {

                __markEmptied();
                $('.fm-empty-trashbin').removeClass('hidden');
                $('.fm-clearbin-button').addClass('hidden');
            }
            break;
        case M.RootID:
            if (!hasSubFolders) {
                $('#treea_' + parent).removeClass('contains-folders expanded');
            }

            // Remove item
            $('#' + h).remove();

            // Remove folder and subfolders
            $('#treeli_' + h).remove();
            if (!hasItems) {

                __markEmptied();
                $('.files-grid-view').addClass('hidden');
                $('.grid-table.fm tbody tr').remove();

                if (M.gallery) {
                    const lastToRemove = M.c[M.currentdirid] &&
                        Object.values(M.c[M.currentdirid]).length === 1 && h in M.c[M.currentdirid];
                    mega.gallery.showEmpty(M.currentdirid, lastToRemove);
                }
                else if (folderlink) {
                    $('.fm-empty-folder').removeClass('hidden');
                }
                else {
                    $('.fm-empty-cloud').removeClass('hidden');
                }
            }
            break;
        case (mega.gallery.sections[M.currentdirid] ? mega.gallery.sections[M.currentdirid].path : null):
        case `discovery/${M.currentCustomView.nodeID}`:
            if (!hasItems) {

                __markEmptied();
                $('.files-grid-view').addClass('hidden');
                $('.grid-table.fm tbody tr').remove();

                mega.gallery.showEmpty(M.currentdirid);
            }
            break;
        default:
            if (M.chat || String(M.currentdirid).includes('user-management') || M.isAlbumsPage()) {
                break;
            }
            if (!hasSubFolders) {
                $('#treea_' + parent).removeClass('contains-folders expanded');
            }
            $('#' + h).remove();// remove item
            $('#treeli_' + h).remove();// remove folder and subfolders
            if (!hasItems) {

                __markEmptied();
                if (M.gallery) {
                    $('.files-grid-view').addClass('hidden');

                    const lastToRemove = M.c[M.currentdirid] &&
                        Object.values(M.c[M.currentdirid]).length === 1 && h in M.c[M.currentdirid];
                    mega.gallery.showEmpty(M.currentdirid, lastToRemove);
                }
                else if (M.dyh) {
                    M.dyh('empty-ui');
                }
                else if (sharedFolderUI()) {
                    M.emptySharefolderUI();
                }
                else {
                    $('.files-grid-view').addClass('hidden');
                    if (M.isDynPage(M.currentdirid)) {
                        $(`.fm-empty-${M.currentdirid}`, '.fm-right-files-block').removeClass('hidden');
                    }
                    else if (M.currentdirid === 'out-shares') {
                        $('.fm-empty-outgoing').removeClass('hidden');
                    }
                    else if (M.currentdirid !== 'public-links' && M.currentdirid !== 'file-requests') {
                        $('.fm-empty-folder').removeClass('hidden');
                    }
                }
                $('.grid-table.fm tbody tr').remove();
            }
            break;
    }

    // Remove item in subtitles dialog
    if ($.subtitlesMegaRender && $.subtitlesMegaRender.nodeMap) {
        $.subtitlesMegaRender.revokeDOMNode(h, true);
    }

    if (M.megaRender && M.megaRender.megaList) {
        if (parent) {
            // this was a move node op
            if (parent === M.currentdirid || parent === M.currentCustomView.nodeID) {
                // the node was moved out of the current viewport, so lets remove it from the MegaList
                M.megaRender.megaList.remove(h);
            }
        }
        else {
            M.megaRender.megaList.remove(h);
        }
    }

    M.nodeRemovalUIRefresh(h,  parent);
}

/**
 * Remove nodes
 * @param {Array|String} selectedNodes An array of node handles.
 * @param {Boolean} [skipDelWarning] skip..del..warning..
 * @returns {MegaPromise}
 */
// @todo make eslint happy..
// eslint-disable-next-line complexity,sonarjs/cognitive-complexity
async function fmremove(selectedNodes, skipDelWarning) {
    'use strict';

    selectedNodes = selectedNodes || $.selected;
    if (!Array.isArray(selectedNodes)) {
        selectedNodes = selectedNodes ? [selectedNodes] : [];
    }

    const handles = [...selectedNodes];
    await dbfetch.coll(handles).catch(nop);

    if (handles.some((h) => M.d[h] && M.d[h].su)) {
        const promises = [];

        for (let i = handles.length; i--;) {
            promises.push(M.leaveShare(handles[i]));
        }

        return Promise.all(promises);
    }

    var i = 0;
    var filecnt = 0;
    var foldercnt = 0;
    var contactcnt = 0;
    var removesharecnt = 0;
    var title = '';
    var message = '';
    let s4Bucketcnt = 0;

    // If on mobile we will bypass the warning dialog prompts
    skipDelWarning = skipDelWarning || is_mobile ? 1 : mega.config.get('skipDelWarning');

    for (i = 0; i < selectedNodes.length; i++) {
        var n = M.d[selectedNodes[i]];

        if (n && n.su) {
            removesharecnt++;
        }
        else if (String(selectedNodes[i]).length === 11) {
            contactcnt++;
        }
        else if (n && n.t) {
            foldercnt++;
        }
        else {
            filecnt++;
        }

        if (M.getS4NodeType(n) === 'bucket') {
            s4Bucketcnt++;
        }
    }

    if (removesharecnt) {
        for (i = 0; i < selectedNodes.length; i++) {
            M.leaveShare(selectedNodes[i]);
        }
        M.openFolder('shares', true);
    }

    // Remove contacts from list
    else if (contactcnt) {

        var c = selectedNodes.length;
        var replaceString = '';
        var sharedFoldersAlertMessage = l[7872];

        if (c > 1) {
            replaceString = c + ' ' + l[5569];
            sharedFoldersAlertMessage = l[17974];
        }
        else {
            var contactName = escapeHTML(M.getNameByHandle(selectedNodes[0]) || '');
            replaceString = '<strong>' + contactName + '</strong>';
            sharedFoldersAlertMessage = sharedFoldersAlertMessage.replace('[X]', contactName);
        }

        const ack = async(yes) => {
            const promises = [];
            const leave = (h) => M.leaveShare(h);

            for (let i = yes && selectedNodes.length; i--;) {
                const h = selectedNodes[i];

                if (M.c[h]) {
                    promises.push(...Object.keys(M.c[h]).map(leave));
                }

                promises.push(api.screq({a: 'ur2', u: h, l: '0'}));
            }

            return Promise.allSettled(promises).dump('delete-contact');
        };

        msgDialog('delete-contact', l[1001], l[1002].replace('[X]', replaceString), sharedFoldersAlertMessage, ack);

        if (c > 1) {
            $('#msgDialog').addClass('multiple');
            $('#msgDialog .fm-del-contact-avatar')
                .safeHTML(`<i class="multiple sprite-fm-uni icon-users"></i>
                    <span></span>
                    <div class="fm-del-contacts-number"></div>`);
            $('.fm-del-contacts-number').text(selectedNodes.length);
            $('#msgDialog .fm-del-contact-avatar').attr('class', 'fm-del-contact-avatar');
            $('#msgDialog .fm-del-contact-avatar span').empty();
        }
        else {
            var user = M.u[selectedNodes[0]];
            var avatar = useravatar.contact(user, 'avatar-remove-dialog');

            $('#msgDialog .fm-del-contact-avatar').safeHTML(avatar);
        }
    }

    // Remove selected nodes from rubbish bin
    else if (M.getNodeRoot(selectedNodes[0]) === M.RubbishID) {

        var dlgMessage = '';
        var toastMessage = '';

        if (filecnt > 0 && !foldercnt) {
            dlgMessage = mega.icu.format(l[13750], filecnt);
            toastMessage = mega.icu.format(l[13758], filecnt);
        }
        else if (!filecnt && foldercnt > 0) {
            dlgMessage = mega.icu.format(l[13752], foldercnt);
            toastMessage = mega.icu.format(l[13760], foldercnt);
        }
        else if (filecnt && foldercnt) {
            const itemscnt = filecnt + foldercnt;
            dlgMessage = mega.icu.format(l[13754], itemscnt);
            toastMessage = mega.icu.format(l[13762], itemscnt);
        }

        msgDialog('clear-bin:' + l[83], l[1003], dlgMessage, l[1007], function(e) {
            if (e) {
                var tmp = null;
                if (String(M.currentdirid).substr(0, 7) === 'search/') {
                    tmp = M.currentdirid;
                    M.currentdirid = M.getNodeByHandle(selectedNodes[0]).p || M.RubbishID;
                }

                M.clearRubbish(false)
                    .finally(() => {
                        if (tmp) {
                            M.currentdirid = tmp;
                        }
                    })
                    .then((res) => {
                        console.debug('clear-bin', res);
                        showToast('settings', toastMessage);
                    })
                    .catch(dump);
            }
        });
    }

    // Remove contacts
    else if (M.getNodeRoot(selectedNodes[0]) === 'contacts') {
        if (skipDelWarning) {
            M.copyNodes(selectedNodes, M.RubbishID, true).catch(tell);
        }
        else {
            title = l[1003];
            if (filecnt > 0 && foldercnt === 0) {
                message = mega.icu.format(l.move_rubbish_files, filecnt);
            }
            else if (filecnt === 0 && foldercnt > 0) {
                message = mega.icu.format(l.move_rubbish_folders, foldercnt);
            }
            else {
                message = mega.icu.format(l.move_rubbish_items, filecnt + foldercnt);
            }

            msgDialog('confirmation', title, message, false, function(e) {
                    if (e) {
                    M.copyNodes(selectedNodes, M.RubbishID, true).catch(tell);
                    }
            }, 'skipDelWarning');
        }
    }
    else {
        var moveToRubbish = function() {
            mLoadingSpinner.show('move-to-rubbish');
            mBroadcaster.sendMessage('trk:event', 'move-to-rubbish', 'remove', selectedNodes);

            return M.moveToRubbish(selectedNodes)
                .catch(tell)
                .finally(() => {
                    mLoadingSpinner.hide('move-to-rubbish');

                    // Re-render the search result page after files being removed
                    if (String(M.currentdirid).startsWith("search") || M.isDynPage(M.currentdirid)) {
                        M.openFolder(M.currentdirid, true);
                    }
                });
        };

        if (skipDelWarning) {
            return moveToRubbish();
        }
        else {
            let note = l[7410];
            title = l[1003];
            if (filecnt > 0 && foldercnt === 0) {
                message = mega.icu.format(l.move_files_to_bin, filecnt);
            }
            else if (!filecnt && s4Bucketcnt && foldercnt - s4Bucketcnt === 0) {
                message = mega.icu.format(l.s4_move_bucket_to_bin, s4Bucketcnt);
                note = selectedNodes.length === 1 ?
                    `${l.s4_remove_bucket_note} <p>${l.s4_remove_bucket_tip}</p>` :
                    `${l.s4_remove_items_note} <p>${l.s4_remove_items_tip}</p>`;
            }
            else if (filecnt === 0 && !s4Bucketcnt && foldercnt > 0) {
                message = mega.icu.format(l.move_folders_to_bin, foldercnt);
            }
            else {
                message = mega.icu.format(l.move_files_to_bin, filecnt + foldercnt);

                if (s4Bucketcnt) {
                    note = `${l.s4_remove_items_note} <p>${l.s4_remove_items_tip}</p>`;
                }
            }

            if (filecnt + foldercnt === 1) {
                message = message.replace('%1', escapeHTML(M.d[selectedNodes[0]].name));
            }

            msgDialog(
                `remove:!^${l[62]}!${l[16499]}`,  title, message, note,
                (yes) => {
                    if (yes) {
                        moveToRubbish();
                    }
                }, 'skipDelWarning'
            );
        }
    }
};

/**
 * Generate file manager contains text message
 *
 * @param {Number} filecnt          The number of files
 * @param {Number} foldercnt        The number of folders
 * @param {Boolean} lineBreak       Indicate needs a line break or not
 * @returns {String} containstext   Contains text message
 */
function fm_contains(filecnt, foldercnt, lineBreak) {

    "use strict";

    var containstxt = l[782];
    var folderText = mega.icu.format(l.folder_count, foldercnt);
    var fileText = mega.icu.format(l.file_count, filecnt);

    if (foldercnt >= 1 && filecnt >= 1 && lineBreak) {
        containstxt = `${folderText}<br>${fileText}`;
    }
    else if (foldercnt >= 1 && filecnt >= 1) {
        containstxt = l.file_and_folder_count.replace('[X1]', folderText).replace('[X2]', fileText);
    }
    else if (foldercnt > 0) {
        containstxt = folderText;
    }
    else if (filecnt > 0) {
        containstxt = fileText;
    }

    return containstxt;
}


function fmremdupes(test) {
    var hs = {}, i, f = [], s = 0;
    var cRootID = M.currentrootid;
    loadingDialog.show();
    for (i in M.d) {
        var n = M.d[i];
        if (n && n.hash && n.h && M.getNodeRoot(n.h) === cRootID) {
            if (!hs[n.hash]) {
                hs[n.hash] = [];
            }
            hs[n.hash].push(n.h);
        }
    }
    for (i in hs) {
        var h = hs[i];
        while (h.length > 1)
            f.push(h.pop());
    }
    for (i in f) {
        console.debug('Duplicate node: ' + f[i] + ' at ~/'
            + M.getPath(f[i]).reverse().map(function(n) {
                return M.d[n].name || ''
            }).filter(String).join("/"));
        s += M.d[f[i]].s | 0;
    }
    loadingDialog.hide();
    console.log('Found ' + f.length + ' duplicated files using a sum of ' + bytesToSize(s));
    if (!test && f.length) {
        fmremove(f);
    }
    return f.length;
}

/**
 * UFS Size Cache handling.
 */
function UFSSizeCache() {
    'use strict';
    // handle[d, f, b, parent, td, tf, tb, tvf, tvb, fv, n{}]
    this.cache = Object.create(null);
    // version linkage.
    this.versions = new Set();
}

// add node n to the folders cache
// assumptions:
// - if n.p is set, n.t is 0 or 1
// - if n.t is 0, n.s is always set
// - if n.t is 1, n.s is never set or set and != 0
UFSSizeCache.prototype.feednode = function(n) {
    'use strict';

    if (n.p) {
        if (!this.cache[n.p]) {
            // create previously unknown parent
            this.cache[n.p] = [n.t, 1 - n.t, n.s || 0, false, 0, 0, 0, 0, 0, 0, null];
        }
        else if (n.fv || this.cache[n.p][9]) {
            if (this.cache[n.p][9]) {
                // we only need the last version.
                this.versions.delete(n.p);
            }
        }
        else {
            // update known parent
            this.cache[n.p][1 - n.t]++;
            if (n.s) {
                this.cache[n.p][2] += n.s;
            }
        }

        // record parent linkage
        if (this.cache[n.h]) {
            this.cache[n.h][10] = (n.t || n.fv) && n;
            this.cache[n.h][3] = n.p;
        }
        else {
            this.cache[n.h] = [0, 0, 0, n.p, 0, 0, 0, 0, 0, 0, (n.t || n.fv) && n];
        }

        // record file version
        if (n.fv) {
            this.cache[n.h][1] = 1;
            this.cache[n.h][2] = n.s;
            this.cache[n.h][9] = 1;

            if (!this.cache[n.p][9]) {
                // version linkage (the parent is no longer in memory or not received yet)
                this.versions.add(n.p);
            }
        }
        else if (this.versions.has(n.h)) {
            // prevent loading this version later.
            this.versions.delete(n.h);
            this.cache[n.h][10] = n;
        }
    }
};

// compute td / tf / tb for all folders
UFSSizeCache.prototype.sum = function() {
    'use strict';

    for (var h in this.cache) {
        var p = h;

        do {
            this.cache[p][4] += this.cache[h][0];

            if (this.cache[h][9]) {
                this.cache[p][7] += this.cache[h][1];
                this.cache[p][8] += this.cache[h][2];
            }
            else {
                this.cache[p][5] += this.cache[h][1];
                this.cache[p][6] += this.cache[h][2];
            }
        } while ((p = this.cache[p][3]));
    }
};

// @private
UFSSizeCache.prototype._saveNodeState = function(n, entry) {
    'use strict';

    n.td = (n.td || 0) + entry[4];
    n.tf = (n.tf || 0) + entry[5];
    n.tb = (n.tb || 0) + entry[6];
    n.tvf = (n.tvf || 0) + entry[7];
    n.tvb = (n.tvb || 0) + entry[8];
    this.addToDB(n);
};

// @private
UFSSizeCache.prototype._saveTreeState = function(n, entry) {
    'use strict';

    this._saveNodeState(n, entry);

    if (!entry[3]) {
        while ((n = M.d[n.p] || this.cache[n.p] && this.cache[n.p][10])) {
            this._saveNodeState(n, entry);
        }
    }
};

// @private
UFSSizeCache.prototype._getVersions = function(rootNode) {
    'use strict';
    const versions = [...this.versions];

    if (d && rootNode && !M.d[rootNode.h]) {
        console.error('Versions should have been loaded prior to parsing action-packets!');
    }

    for (let i = versions.length; i--;) {
        const h = versions[i];

        if (M.d[h] || !this.cache[h] || this.cache[h][10]) {
            if (d) {
                if (!M.d[h] && (!this.cache[h] || !this.cache[h][10].fv)) {
                    console.error('Bogus feednode()... fix it.', h, [...this.cache[h]]);
                }
                else if (d > 1) {
                    console.debug('Version %s already in memory.', h, [...this.cache[h]]);
                }
            }
            versions.splice(i, 1);
        }
    }

    if (versions.length) {
        if (d) {
            console.warn('Versions retrieval...', [...versions]);
        }
        return dbfetch.geta(versions);
    }
};

// Save computed td / tf / tb / tvf /tvb for all folders
// if no root node is provided, cache is a full cloud tree
UFSSizeCache.prototype.save = async function(rootNode) {
    'use strict';
    this.sum();

    if (d) {
        console.debug('ufsc.save(%s)', rootNode ? rootNode.h : 'undef', rootNode, this);
        console.time('ufsc.save');
    }

    if (this.versions.size) {
        const promise = this._getVersions(rootNode);
        if (promise) {
            await promise;
        }
    }

    for (var h in this.cache) {
        const n = M.d[h] || this.cache[h][10];
        if (n) {
            if (d > 1 && rootNode && !this.cache[h][3] && !n.su) {
                // this may happens for outgoing shares moved to the rubbish-bin
                const msg = 'Uh..oh... internal (api?) error, try menu->reload';
                console.assert(rootNode.p === h, msg, rootNode.p, h, this.cache[h]);
            }

            this._saveTreeState(n, this.cache[h]);
        }
    }

    if (d) {
        console.timeEnd('ufsc.save');
        if (d > 2) {
            this._cache = [this.cache, [...this.versions]];
        }
    }
    this.cache = null;
    this.versions = null;
};

// Add node to indexedDB
UFSSizeCache.prototype.addToDB = function(n) {
    'use strict';

    if (fmdb) {
        fmdb.add('f', {
            h: n.h,
            p: n.p,
            s: n.s >= 0 ? n.s : -n.t,
            t: n.t ? 1262304e3 - n.ts : n.ts,
            c: n.hash || '',
            fa: n.fa || '',
            d: n
        });
    }

    if (n.t) {
        this.addTreeNode(n);

        if (fminitialized) {
            // onFolderSizeChangeUIUpdate will quit if not correct path
            M.onFolderSizeChangeUIUpdate(n);
        }
    }
};

/**
 * Record folder node, populates M.tree
 * @param {Object} n The folder node to add
 * @param {Boolean} [ignoreDB] Whether updating local state only
 */
UFSSizeCache.prototype.addTreeNode = function(n, ignoreDB) {
    'use strict';
    var p = n.su ? 'shares' : n.p;

    if (n.s4 && n.p === M.RootID) {
        p = 's4';
    }
    else if (M.tree.s4 && M.tree.s4[n.h]) {
        delete M.tree.s4[n.h];
    }

    if (!M.tree[p]) {
        M.tree[p] = Object.create(null);
    }
    var tmp = M.tree[p][n.h] = Object.create(null);
    tmp.name = n.name;
    tmp.ts = n.ts;
    tmp.td = n.td || 0;
    tmp.tf = n.tf || 0;
    tmp.tb = n.tb || 0;
    tmp.tvf = n.tvf || 0;
    tmp.tvb = n.tvb || 0;
    tmp.h = n.h;
    tmp.p = n.p;
    tmp.t = M.IS_TREE;
    tmp.lbl = n.lbl;

    if (ignoreDB) {
        if (n.t & M.IS_TREE) tmp.t = n.t;
    }
    else {
        if (n.fav)                                                   tmp.t |= M.IS_FAV;
        if (M.su.EXP && M.su.EXP[n.h])                               tmp.t |= M.IS_LINKED;
        if (M.getNodeShareUsers(n, 'EXP').length || M.ps[n.h])       tmp.t |= M.IS_SHARED;
        if (M.getNodeShare(n).down === 1)                            tmp.t |= M.IS_TAKENDOWN;
    }

    if (p === 's4') {
        tmp.s4 = Object.create(null);
    }

    if (n.su) {
        tmp.su = n.su;

        if (!M.tree[n.p]) {
            M.tree[n.p] = Object.create(null);
        }
        M.tree[n.p][n.h] = tmp;
    }

    if (fmdb && !ignoreDB) {
        fmdb.add('tree', {
            h: n.h,
            d: tmp
        });
    }
};

/**
 * Remove folder node
 * @param {String} h The ufs node's handle
 * @param {String} p The ufs parent node for h
 */
UFSSizeCache.prototype.delTreeNode = function(h, p) {
    if (M.tree[h]) {
        for (var k in M.tree[h]) {
            this.delTreeNode(k, h);
        }
        delete M.tree[h];
    }
    if (M.tree.s4 && M.tree.s4[h]) {
        delete M.tree.s4[h];
    }
    if (M.tree[p] && M.tree[p][h]) {
        delete M.tree[p][h];

        var len = 0;
        for (var j in M.tree[p]) {
            len++;
            break;
        }
        if (!len) {
            delete M.tree[p];
        }
    }

    if (fmdb) {
        fmdb.del('tree', h);
    }
};

/**
 * Compute node addition back to root
 * @param {Object} n The ufs node
 * @param {Boolean} [ignoreDB] Hint: do not set it...
 */
UFSSizeCache.prototype.addNode = function(n, ignoreDB) {
    'use strict';
    var td, tf, tb, tvf, tvb;

    if (n.t) {
        td = (n.td || 0) + 1;
        tf = (n.tf || 0);
        tb = (n.tb || 0);
        tvf = (n.tvf || 0);
        tvb = (n.tvb || 0);

        if (!ignoreDB) {
            // if a new folder was created, save it to db
            this.addToDB(n);
        }
    }
    else {
        td = 0;
        tf = (n.fv) ? 0 : 1;
        tb = (n.fv) ? 0 : n.s;
        tvf = (n.fv) ? 1 : 0;
        tvb = (n.fv) ? n.s : 0;
    }

    if (d) {
        console.debug('ufsc.add', n.h, td, tf, tb, tvf, tvb);
    }

    while ((n = M.d[n.p])) {
        n.td = (n.td || 0) + td;
        n.tf = (n.tf || 0) + tf;
        n.tb = (n.tb || 0) + tb;
        n.tvf = (n.tvf || 0) + tvf;
        n.tvb = (n.tvb || 0) + tvb;
        this.addToDB(n);
    }
};

/**
 * Compute node deletions back to root
 * @param {Object} h The ufs node's handle
 * @param {Boolean} [ignoreDB] Hint: do not set it...
 */
UFSSizeCache.prototype.delNode = function(h, ignoreDB) {
    var n = M.d[h];

    if (n) {
        var td, tf, tb, tvf, tvb;

        if (n.t) {
            td = n.td + 1;
            tf = n.tf;
            tb = n.tb;
            tvf = n.tvf || 0;
            tvb = n.tvb || 0;

            this.delTreeNode(n.h, n.p);
        }
        else {
            td = 0;
            tf = (n.fv) ? 0 : 1;
            tb = (n.fv) ? 0 : n.s;
            tvf = (n.fv) ? 1 : 0;
            tvb = (n.fv) ? n.s : 0;
        }

        if (d) {
            console.debug('ufsc.del', h, td, tf, tb, tvf, tvb);

            // if (!td && td !== 0) debugger;
        }

        while ((n = M.d[n.p])) {
            n.td -= td;
            n.tf -= tf;
            n.tb -= tb;
            n.tvf -= tvf;
            n.tvb -= tvb;
            this.addToDB(n);
        }
    }
    else if (d && ignoreDB) {
        console.error('ufsc.delNode: Node not found', h);
    }
};

/**
 * Common functionality for both the Pro pages (Step 1 and Step 2). Some functions e.g.
 * getProPlanName() and getPaymentGatewayName() may be used from other places not just the Pro pages.
 */
var pro = {

    /** An array of the possible membership plans from the API */
    membershipPlans: [],
    conversionRate: 0,

    lastLoginStatus: -99, // a var to store the user login status when prices feteched

    /** The last payment provider ID used */
    lastPaymentProviderId: null,

    /* Constants for the array indexes of the membership plans (these are from the API 'utqa' response) */
    UTQA_RES_INDEX_ID: 0,
    UTQA_RES_INDEX_ACCOUNTLEVEL: 1,
    UTQA_RES_INDEX_STORAGE: 2,
    UTQA_RES_INDEX_TRANSFER: 3,
    UTQA_RES_INDEX_MONTHS: 4,
    UTQA_RES_INDEX_PRICE: 5,
    UTQA_RES_INDEX_CURRENCY: 6,
    UTQA_RES_INDEX_MONTHLYBASEPRICE: 7,
    UTQA_RES_INDEX_LOCALPRICE: 8,
    UTQA_RES_INDEX_LOCALPRICECURRENCY: 9,
    UTQA_RES_INDEX_LOCALPRICECURRENCYSAVE: 10,
    UTQA_RES_INDEX_ITEMNUM: 11,

    /* Constants for special Pro levels */
    ACCOUNT_LEVEL_STARTER: 11,
    ACCOUNT_LEVEL_BASIC: 12,
    ACCOUNT_LEVEL_ESSENTIAL: 13,
    ACCOUNT_LEVEL_PRO_LITE: 4,
    ACCOUNT_LEVEL_PRO_I: 1,
    ACCOUNT_LEVEL_PRO_II: 2,
    ACCOUNT_LEVEL_PRO_III: 3,
    ACCOUNT_LEVEL_PRO_FLEXI: 101,
    ACCOUNT_LEVEL_BUSINESS: 100,

    /* Account statuses for Business and Pro Flexi accounts */
    ACCOUNT_STATUS_EXPIRED: -1,
    ACCOUNT_STATUS_ENABLED: 1,
    ACCOUNT_STATUS_GRACE_PERIOD: 2,

    /* Number of bytes for conversion, as we recieve GB for plans, and use bytes for sizing */
    BYTES_PER_GB: 1024 * 1024 * 1024,
    BYTES_PER_TB: 1024 * 1024 * 1024 * 1024,

    /**
     * Determines if a Business or Pro Flexi account is expired or in grace period
     * @param {Number} accountStatus The account status e.g. from u_attr.b.s (Business) or u_attr.pf.s (Pro Flexi)
     * @returns {Boolean} Returns true if the account is expired or in grace period
     */
    isExpiredOrInGracePeriod: function(accountStatus) {
        'use strict';

        return [this.ACCOUNT_STATUS_EXPIRED, this.ACCOUNT_STATUS_GRACE_PERIOD].includes(accountStatus);
    },

    /**
     * Load pricing plan information from the API. The data will be loaded into 'pro.membershipPlans'.
     * @param {Function} loadedCallback The function to call when the data is loaded
     */
    loadMembershipPlans: async function(loadedCallback) {
        "use strict";

        // Set default
        loadedCallback = loadedCallback || function() { };

        // If this data has already been fetched, re-use it and run the callback function
        if (pro.membershipPlans.length > 0 && !(!pro.lastLoginStatus && u_type > 0)) {
            loadedCallback();
        }
        else {
            // Get the membership plans.
            const payload = {a: 'utqa', nf: 2, p: 1};

            await api.req({a: 'uq', pro: 1, gc: 1})
                .then(({result: {balance}}) => {
                    if (balance) {
                        balance = balance.length && parseFloat(balance[0][0]);

                        if (balance >= 4.99 && balance <= 9.98) {
                            payload.r = 1;
                        }
                    }
                })
                .catch(dump);

            api.req(payload)
                .then(({result: results}) => {

                    // The rest of the webclient expects this data in an array format
                    // [api_id, account_level, storage, transfer, months, price, currency, monthlybaseprice]
                    var plans = [];
                    var maxPlan = null;
                    var minPlan = null;
                    var lmbps = {};
                    const allowLocal = localStorage.blockLocal !== '1';
                    const blockedPlans = localStorage.blockPlans && localStorage.blockPlans.split(',');

                    const conversionRate = results[0].l.lc === "EUR" ? 1 : results[0].l.exch;

                    for (var i = 1; i < results.length; i++) {

                        let discount = 0;

                        if (blockedPlans && blockedPlans.includes(String(results[i].al))) {
                            continue;
                        }

                        if (results[i].m === 1) {
                            lmbps[results[i].mbp] = results[i].lp;
                        }
                        else {
                            discount = lmbps[results[i].mbp] * results[i].m - results[i].lp;
                        }

                        // If this is Pro Flexi, the data is structured similarly to business, so set that manually
                        if (results[i].al === pro.ACCOUNT_LEVEL_PRO_FLEXI) {
                            plans.push([
                                results[i].id,              // id
                                results[i].al,              // account level
                                results[i].bd.ba.s,         // base storage
                                results[i].bd.ba.t,         // base transfer
                                results[i].m,               // months
                                results[i].bd.ba.p  / 100,  // base price
                                results[0].l.c,             // currency
                                results[i].bd.ba.p  / 100,  // monthly base price
                                results[i].bd.ba.lp / 100,  // local base price
                                results[0].l.lc,            // local price currency
                                0,                          // local price save
                                results[i].it,              // item (will be 1 for business / Pro Flexi)
                                results[i].bd.sto.p / 100,  // extra storage rate
                                results[i].bd.sto.lp / 100, // extra storage local rate
                                results[i].bd.trns.p / 100,  // extra transfer rate
                                results[i].bd.trns.lp / 100  // extra transfer local rate
                            ]);
                        }
                        else {
                            // Otherwise for PRO I - III and PRO Lite set as so
                            plans.push([
                                results[i].id,          // id
                                results[i].al,          // account level
                                results[i].s,           // storage
                                results[i].t,           // transfer
                                results[i].m,           // months
                                results[i].p / 100,     // price
                                results[0].l.c,         // currency
                                results[i].mbp / 100,   // monthly base price
                                (allowLocal && results[i].lp / 100),    // local price
                                (allowLocal && results[0].l.lc),        // local price currency
                                (allowLocal && discount / 100),         // local price save
                                results[i].it           // item (will be 0 for user)
                            ]);
                        }
                        pro.planObjects.createPlanObject(plans[plans.length - 1]);
                        if (results[i].m === 1 && results[i].it !== 1) {
                            if (!maxPlan || maxPlan[2] < results[i]['s']) {
                                maxPlan = plans[plans.length - 1];
                            }
                            if (!minPlan || minPlan[2] > results[i]['s']) {
                                minPlan = plans[plans.length - 1];
                            }
                        }
                    }

                    // Store globally
                    pro.membershipPlans = plans;
                    pro.lastLoginStatus = u_type;
                    pro.maxPlan = maxPlan;
                    pro.minPlan = minPlan;
                    pro.conversionRate = conversionRate;
                })
                .finally(() => {
                    pro.initFilteredPlans();
                    // Run the callback function
                    loadedCallback();
                });
        }
    },

    /**
     * Redirect to the site.
     * @param {String} topage Redirect to this page of our site.
     */
    redirectToSite: function(topage) {
        'use strict';

        // On mobile just load the main account page as there is no payment history yet
        topage = topage || (is_mobile ? 'fm/account' : 'fm/account/plan');

        // Make sure it fetches new account data on reload
        // and redirect to account page to show purchase
        if (M.account) {
            M.account.lastupdate = 0;

            // If pro page is opened from account/plan update M.currentdirid to force call openfolder
            M.currentdirid = String(M.currentdirid).substr(0, 7) === 'account' ? false : M.currentdirid;
        }

        loadSubPage(topage);
    },

    /**
     * Show the payment result of success or failure after coming back from a provider
     * @param {String} verifyUrlParam The URL parameter e.g. 'success' or 'failure'
     */
    showPaymentResult: function(verifyUrlParam) {
        'use strict';

        var $backgroundOverlay = $('.fm-dialog-overlay');
        var $pendingOverlay = $('.payment-result.pending.alternate');
        var $failureOverlay = $('.payment-result.failed');

        // Show the overlay
        $backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');

        // On successful payment
        if (verifyUrlParam === 'success') {

            // Show the success
            $pendingOverlay.removeClass('hidden');

            insertEmailToPayResult($pendingOverlay);

            if (!u_type || u_type !== 3) {
                $pendingOverlay.find('.payment-result-button, .payment-close').addClass('hidden');
            }
            else {
                $pendingOverlay.find('.payment-result-button, .payment-close').removeClass('hidden');

                // Add click handlers for 'Go to my account' and Close buttons
                $pendingOverlay.find('.payment-result-button, .payment-close').rebind('click', function () {

                    // Hide the overlay
                    $backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
                    $pendingOverlay.addClass('hidden');

                    pro.redirectToSite();
                });
            }
        }
        else {
            // Show the failure overlay
            $failureOverlay.removeClass('hidden');

            // On click of the 'Try again' or Close buttons, hide the overlay
            $failureOverlay.find('.payment-result-button, .payment-close').rebind('click', function() {

                // Hide the overlay
                $backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
                $failureOverlay.addClass('hidden');
                if (u_attr && u_attr.b) {
                    loadSubPage('registerb');
                }
                else {
                    loadSubPage('pro');
                }
            });
        }
    },

    /**
    * Update the state when a payment has been received to show their new Pro Level
    * @param {Object} actionPacket The action packet {'a':'psts', 'p':<prolevel>, 'r':<s for success or f for failure>}
    */
    processPaymentReceived: function (actionPacket) {

        // Check success or failure
        var success = (actionPacket.r === 's') ? true : false;

        // Add a notification in the top bar
        notify.notifyFromActionPacket(actionPacket);

        // If their payment was successful, redirect to account page to show new Pro Plan
        if (success) {

            // Make sure it fetches new account data on reload
            if (M.account) {
                M.account.lastupdate = 0;
            }

            // Don't show the plan expiry dialog anymore for this session
            alarm.planExpired.lastPayment = null;

            // If last payment was Bitcoin, we need to redirect to the account page
            if (pro.lastPaymentProviderId === bitcoinDialog.gatewayId) {
                loadSubPage('fm/account/plan');
            }
        }
    },

    /**
     * Get a string for the payment plan number
     * @param {Number} planNum The plan number e.g. 1, 2, 3, 4, 100, 101, undefined
     * @returns {String} The plan name i.e. Pro I, Pro II, Pro III, Pro Lite, Business, Pro Flexi, Free (default)
     */
    getProPlanName: function(planNum) {

        switch (planNum) {
            case 1:
                return l[5819];                 // Pro I
            case 2:
                return l[6125];                 // Pro II
            case 3:
                return l[6126];                 // Pro III
            case 4:
                return l[8413];                 // Pro Lite
            case 11:
                return l.plan_name_starter;     // Starter
            case 12:
                return l.plan_name_basic;       // Basic
            case 13:
                return l.plan_name_essential;   // Essential
            case 100:
                return l[19530];                // Business
            case 101:
                return l.pro_flexi_name;        // Pro Flexi
            default:
                return l[1150];                 // Free
        }
    },

    /**
     * Returns the name of the gateway / payment provider and display name. The API will only
     * return the gateway ID which is unique on the API and will not change.
     *
     * @param {Number} gatewayId The number of the gateway/provider from the API
     * @returns {Object} Returns an object with two keys, the 'name' which is a unique string
     *                   for the provider which can be used for displaying icons etc, and the
     *                   'displayName' which is the translated name for that provider (however
     *                   company names are not translated).
     */
    getPaymentGatewayName: function(gatewayId, gatewayOpt) {

        var gateways = {
            0: {
                name: 'voucher',
                displayName: l[487]     // Voucher code
            },
            1: {
                name: 'paypal',
                displayName: l[1233]    // PayPal
            },
            2: {
                name: 'apple',
                displayName: 'Apple'
            },
            3: {
                name: 'google',
                displayName: 'Google'
            },
            4: {
                name: 'bitcoin',
                displayName: l[6802]    // Bitcoin
            },
            5: {
                name: 'dynamicpay',
                displayName: l[7109]    // UnionPay
            },
            6: {
                name: 'fortumo',
                displayName: l[7219] + ' (' + l[7110] + ')'    // Mobile (Fortumo)
            },
            7: {
                name: 'stripe',
                displayName: l[7111]    // Credit Card
            },
            8: {
                name: 'perfunctio',
                displayName: l[7111]    // Credit Card
            },
            9: {
                name: 'infobip',
                displayName: l[7219] + ' (Centilli)'    // Mobile (Centilli)
            },
            10: {
                name: 'paysafecard',
                displayName: 'paysafecard'
            },
            11: {
                name: 'astropay',
                displayName: 'AstroPay'
            },
            12: {
                name: 'reserved',
                displayName: 'reserved' // TBD
            },
            13: {
                name: 'windowsphone',
                displayName: l[8660]    // Windows Phone
            },
            14: {
                name: 'tpay',
                displayName: l[7219] + ' (T-Pay)'       // Mobile (T-Pay)
            },
            15: {
                name: 'directreseller',
                displayName: l[6952]    // Credit card
            },
            16: {
                name: 'ecp',                    // E-Comprocessing
                displayName: l[6952] + ' (ECP)' // Credit card (ECP)
            },
            17: {
                name: 'sabadell',
                displayName: 'Sabadell'
            },
            19: {
                name: 'Stripe2',
                displayName: l[6952] + ' (Stripe)' // Credit card (Stripe)
            },
            999: {
                name: 'wiretransfer',
                displayName: l[6198]    // Wire transfer
            }
        };

        // If the gateway option information was provided we can improve the default naming in some cases
        if (typeof gatewayOpt !== 'undefined') {
            if (typeof gateways[gatewayId] !== 'undefined') {
                // Subgateways should always take their subgateway name from the API if provided
                gateways[gatewayId].name =
                    (gatewayOpt.type === 'subgateway') ? gatewayOpt.gatewayName : gateways[gatewayId].name;

                // Direct reseller still requires the translation from above to be in its name
                if (gatewayId === 15 && gatewayOpt.type !== 'subgateway') {
                    gateways[gatewayId].displayName = gateways[gatewayId].displayName + " " + gatewayOpt.displayName;
                }
                else {
                    gateways[gatewayId].displayName =
                        (gatewayOpt.type === 'subgateway') ? gatewayOpt.displayName : gateways[gatewayId].displayName;
                }

                // If in development and on staging, add some extra info for seeing which provider E.g. ECP/Sabadell/AP
                // mega.flags.bid can be passed from API to ask us to turn on "extra info" showing for providers.
                if (d && (apipath === 'https://staging.api.mega.co.nz/' || mega.flags.bid)) {
                    gateways[gatewayId].displayName += ' (via ' + gateways[gatewayId].name + ')';
                }
            }
        }

        // If the gateway exists, return it
        if (typeof gateways[gatewayId] !== 'undefined') {
            return gateways[gatewayId];
        }

        // Otherwise return a placeholder for currently unknown ones
        return {
            name: 'unknown',
            displayName: 'Unknown'
        };
    },

    /**
     * Update the pro page depending on if the user can see the "exclusive offer" tab
     * (mini plans) or not.
     *
     * If they can, fill in the empty low tier plan feature table cells (plan title and
     * storage and transfer quotas).
     *
     * Otherwise, delete the low tier plans flag, hide the "exclusive offer" tab and
     * show the user a dialog/sheet.
     *
     * @param {Boolean} canSeeMiniPlans
     * @returns {void}
     */
    updateLowTierProPage(canSeeMiniPlans) {
        'use strict';

        if (canSeeMiniPlans) {
            pro.proplan2.updateExcOffers();
        }
        else {
            const showProPlansTab = () => {
                delete window.mProTab;

                $('.tabs-module-block#pr-exc-offer-tab', '.individual-team-tab-container').addClass('hidden');
                $('.tabs-module-block#pr-individual-tab', '.individual-team-tab-container').trigger('click');
            };

            if (is_mobile) {
                mega.ui.sheet.show({
                    name: 'cannot-view-offer',
                    type: 'modal',
                    showClose: false,
                    preventBgClosing: true,
                    contents: l.cannot_view_offer,
                    actions: [
                        {
                            type: 'normal',
                            text: l[81], // OK
                            onClick: () => {
                                mega.ui.sheet.hide();
                                showProPlansTab();
                            }
                        }
                    ]
                });
            }
            else {
                const cannotViewOfferDialog = new mega.ui.Dialog({
                    'className': 'cannotviewoffer-dialog',
                    'closable': false,
                    'closableByOverlay': false,
                    'focusable': false,
                    'expandable': false,
                    'requiresOverlay': true,
                    'buttons': []
                });
                cannotViewOfferDialog.rebind('onBeforeShow', function() {
                    $('header p', this.$dialog).text(l.cannot_view_offer);

                    $('button.ok-close', this.$dialog).rebind('click.closeDialog', () => {
                        cannotViewOfferDialog.hide();
                        showProPlansTab();
                    });
                });

                cannotViewOfferDialog.show();
            }
        }
    },

    // These are indented to this level to keep the pro object cleaner, and they should not be directly accessed outside
    // of functions in pro. pro.getPlanObj should be used to retreive them instead.
    planObjects: {
        planKeys: Object.create(null),
        planTypes: Object.create(null),

        createPlanObject(plan) {
            'use strict';
            const key = plan[pro.UTQA_RES_INDEX_ID] + plan[pro.UTQA_RES_INDEX_ITEMNUM];

            lazy(pro.planObjects.planKeys, key, () => {

                const thisPlan = {
                    key,        // Plan key
                    _saveUpTo: null,        // Stores the saveUpTo percentage of the plan, in case given by another plan
                    _correlatedPlan: null,       // Stores the correlated plan, in case given by another plan
                    _maxCorrPriceEur: null,
                    planArray: plan,
                };

                lazy(thisPlan, 'id', () => plan[pro.UTQA_RES_INDEX_ID]);
                lazy(thisPlan, 'itemNum', () => plan[pro.UTQA_RES_INDEX_ITEMNUM]);
                lazy(thisPlan, 'level', () => plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL]);
                lazy(thisPlan, 'name', () => pro.getProPlanName(plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL]));
                lazy(thisPlan, 'storage', () => plan[pro.UTQA_RES_INDEX_STORAGE] * pro.BYTES_PER_GB);
                lazy(thisPlan, 'transfer', () => plan[pro.UTQA_RES_INDEX_TRANSFER] * pro.BYTES_PER_GB);
                lazy(thisPlan, 'months', () => plan[pro.UTQA_RES_INDEX_MONTHS]);
                lazy(thisPlan, 'price', () => plan[pro.UTQA_RES_INDEX_LOCALPRICE] || plan[pro.UTQA_RES_INDEX_PRICE]);
                lazy(thisPlan, 'currency', () => {
                    return plan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY] || plan[pro.UTQA_RES_INDEX_CURRENCY];
                });
                lazy(thisPlan, 'priceEuro', () => plan[pro.UTQA_RES_INDEX_PRICE]);
                lazy(thisPlan, 'currencyEuro', () => plan[pro.UTQA_RES_INDEX_CURRENCY]);
                lazy(thisPlan, 'save', () => plan[pro.UTQA_RES_INDEX_LOCALPRICESAVE] || false);
                lazy(thisPlan, 'monthlyBasePrice', () => plan[pro.UTQA_RES_INDEX_MONTHLYBASEPRICE] || false);
                lazy(thisPlan, 'hasLocal', () => !!plan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY]);

                lazy(thisPlan, 'correlatedPlan', () => {
                    if (thisPlan._correlatedPlan === null) {
                        let correlatedPlan = false;
                        const arrCorrPlan = pro.membershipPlans.find((searchPlan) => {
                            return ((searchPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] === thisPlan.level)
                                && (searchPlan[pro.UTQA_RES_INDEX_MONTHS] !== thisPlan.months));
                        });
                        if (arrCorrPlan) {
                            const planObj = pro.getPlanObj(arrCorrPlan);
                            planObj._correlatedPlan = thisPlan;
                            correlatedPlan = planObj;
                        }
                        thisPlan._correlatedPlan = correlatedPlan;
                    }
                    return thisPlan._correlatedPlan;
                });

                lazy(thisPlan, 'saveUpTo', () => {
                    if (thisPlan._saveUpTo === null) {
                        let saveUpTo = false;
                        if (thisPlan.correlatedPlan) {
                            const thisMonthlyPrice = thisPlan.price / thisPlan.months;
                            const corrMonthlyPrice = thisPlan.correlatedPlan.price / thisPlan.correlatedPlan.months;
                            saveUpTo = percentageDiff(thisMonthlyPrice, corrMonthlyPrice, 3);
                            thisPlan.correlatedPlan._saveUpTo = saveUpTo;
                        }
                        thisPlan._saveUpTo = saveUpTo;
                    }
                    return thisPlan._saveUpTo;
                });

                lazy(thisPlan, 'maxCorrPriceEuro', () => {
                    if (thisPlan._maxCorrPriceEur === null) {
                        let maxCorrPrice = thisPlan.priceEuro;
                        if (thisPlan.correlatedPlan) {
                            maxCorrPrice = Math.max(thisPlan.priceEuro, thisPlan.correlatedPlan.priceEuro);
                            thisPlan.correlatedPlan._maxCorrPriceEur = maxCorrPrice;
                        }
                        thisPlan._maxCorrPrice = maxCorrPrice;
                    }
                    return thisPlan._maxCorrPrice;
                });

                lazy(thisPlan, 'yearlyDiscount', () => {
                    if (thisPlan.save) {
                        return thisPlan.save;
                    }
                    if ((thisPlan.months === 1) || !thisPlan.correlatedPlan) {
                        return false;
                    }
                    const baseYearly = thisPlan.correlatedPlan.price * 12;

                    // Multiply by 100 and then divide by 100 to avoid floating point issues as JS hates decimals
                    return (baseYearly * 100 - thisPlan.price * 100) / 100;
                });

                /**
                 * Checks if the plan is in a filter, returns boolean or level of the plan in the filter.
                 * @param {string} filter - The name of the filter to check
                 * @param {?string} returnType - Desired return type. Will return boolean if not specified.
                 * @returns {number | boolean} - Returns if the plan is in the filter,
                 * as the level of the plan if specified, or as a boolean if not.
                 */
                thisPlan.isIn = (filter, returnType) => {
                    if (returnType === 'asLevel') {
                        return pro.filter.simple[filter].has(thisPlan.level) ? thisPlan.level : 0;
                    }
                    return pro.filter.simple[filter].has(thisPlan.level);
                };

                return thisPlan;

            });
        },
    },

    initFilteredPlans() {
        'use strict';
        const pf = pro.filter;
        const superFilterKeys = Object.keys(pf.superSet);

        for (let i = 0; i < superFilterKeys.length; i++) {
            const key = superFilterKeys[i];
            const subsets = pf.superSet[key];
            let allItems = [];

            for (let j = 0; j < subsets.length; j++) {
                allItems = ([...allItems, ...pf.simple[subsets[j]]]);
            }

            pf.simple[superFilterKeys[i]] = new Set(allItems);
        }

        const simpleFilterKeys = Object.keys(pf.simple);
        const invertedFilterKeys = Object.keys(pf.inverted);

        // If a non-simple filter has already been used, it will also already be in simple filters
        const setUp = new Set();

        // For monthly (1), yearly (12), and combined (23)
        for (let i = 1; i < 24; i += 11) {
            const months = i < 13 ? i : false;
            const monthsTag = months
                ? months === 1 ? 'M' : 'Y'
                : '';


            for (let j = 0; j < simpleFilterKeys.length; j++) {
                setUp.add(simpleFilterKeys[j] + monthsTag);

                // Set up basic plan sub-arrays (is in account level group, and right num months)
                lazy(pf.plans, simpleFilterKeys[j] + monthsTag, () => pro.membershipPlans.filter((plan) => {
                    if (months) {
                        return pro.filter.simple[simpleFilterKeys[j]].has(plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL])
                            && plan[pro.UTQA_RES_INDEX_MONTHS] === months;
                    }
                    return pro.filter.simple[simpleFilterKeys[j]].has(plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL]);
                }));
            }

            for (let j = 0; j < invertedFilterKeys.length; j++) {
                if (setUp.has(invertedFilterKeys[j] + monthsTag)) {
                    continue;
                }
                setUp.add(invertedFilterKeys[j] + monthsTag);

                // Set up inverted plan sub-arrays (is in all minus specified, correct num months(via allX))
                lazy(pf.plans, invertedFilterKeys[j] + monthsTag, () =>
                    pro.filter.plans[`all${monthsTag}`].filter((plan) =>
                        pro.filter.simple[invertedFilterKeys[j]].has(plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL])
                    )
                );
            }

        }

        lazy(pro.filter, 'affMin', () => {
            const plans = pro.filter.plans.affPlans;
            let currentMin = plans[0];
            for (let i = 1; i < plans.length; i++) {
                if (plans[i][pro.UTQA_RES_INDEX_STORAGE] < currentMin[pro.UTQA_RES_INDEX_STORAGE]) {
                    currentMin = plans[i];
                }
            }
            return currentMin;
        });

        lazy(pro.filter, 'miniMin', () => {
            const plans = pro.filter.plans.miniPlans;
            if (!plans.length) {
                return false;
            }
            let currentMin = plans[0];
            for (let i = 1; i < plans.length; i++) {
                if (plans[i][pro.UTQA_RES_INDEX_STORAGE] < currentMin[pro.UTQA_RES_INDEX_STORAGE]) {
                    currentMin = plans[i];
                }
            }
            return currentMin;
        });
    },

    /**
     * Given a plan array, a plan key (id + itemnum), or the account level/number of months, returns objectified plan
     * @param {Array | number} plan - takes in the full plan array, or the account level
     * @param {number | string} [months = 1] - the number of months of the plan if account level is given
     * @returns {Object | boolean} - returns the same plan but as an object, or false if none found
     */
    getPlanObj(plan, months) {
        'use strict';
        const {planTypes} = pro.planObjects;
        months = (months |= 0) || 1;
        let key;
        let type;
        if (typeof plan === 'number' || typeof plan === 'string') {
            type = plan + '_' + months;
            if (planTypes[type]) {
                return planTypes[type];
            }
            plan = pro.membershipPlans.find((searchPlan) => {
                return ((searchPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] === +plan)
                    && (searchPlan[pro.UTQA_RES_INDEX_MONTHS] === months));
            });
        }

        if (typeof plan === 'object') {
            key = plan[pro.UTQA_RES_INDEX_ID] + plan[pro.UTQA_RES_INDEX_ITEMNUM];
        }
        // If plan level and duration given, cache it as may be used again
        if (type) {
            planTypes[type] = pro.planObjects.planKeys[key];
        }
        return pro.planObjects.planKeys[key] || false;
    },

    /**
     * When it is unknown what type we will receive for a plan, this function will always return the plan level as num
     * @param {Array | Object | string | number} plan - The plan or plan level to return the plan level of
     * @returns {number} - the plan level number
     */
    getPlanLevel(plan) {
        'use strict';
        if (typeof plan === 'number') {
            return plan;
        }
        else if (Array.isArray(plan)) {
            plan = plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];
        }
        else if (typeof plan === 'object') {
            plan = plan.level;
        }
        return plan | 0;
    },

    /**
     * Checks if the given plan/plan level is in the given filter
     * @param {Array | Object | string | number} plan
     * @param {string} [filter = 'all'] filter - the filter to check the plan against
     * @returns {boolean} - If the plan is in the filter
     */
    planInFilter(plan, filter) {
        'use strict';
        const filterSet = pro.filter.simple[filter || 'all'];
        if (!filterSet) {
            if (d) {
                console.error('Invalid filter: ' + filter);
            }
            return false;
        }
        return filterSet.has(pro.getPlanLevel(plan));
    }
};

/**
 * Contains the filtering functions, filter types, and plans
 * @property pro.filter
 */
lazy(pro, 'filter', () => {
    'use strict';
    const pf = {

        // contains the filtered plan arrays
        plans: Object.create(null),

        // These are intended to be used in a similar way to transifex strings
        // If 2 arrays are the same but have a different context, please keep them separate.
        // This is to make future updating as straightforward as possible.
        simple: {

            // validPurchases: 11, 12, 13, 4, 1, 2, 3, 101 - plans that are valid to purchase via propay_X
            // Excludes any plans that are not directly purchasable at the url /propay_X. e.g., Business
            validPurchases:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III, pro.ACCOUNT_LEVEL_PRO_FLEXI
                ]),

            // all: 11, 12, 13, 4, 1, 2, 3, 101, 100 - all currently available plans
            // Excludes any plans that the webclient is not yet ready to support.
            all:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III, pro.ACCOUNT_LEVEL_PRO_FLEXI, pro.ACCOUNT_LEVEL_BUSINESS
                ]),

            // storageTransferDialogs: 11, 12, 13, 4, 1, 2, 3, 101 - plans that should be shown in the storage
            // and transfer upsell dialogs
            storageTransferDialogs:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III, pro.ACCOUNT_LEVEL_PRO_FLEXI
                ]),

            // lowStorageQuotaPlans: 11, 12, 13, 4 - plans that should have their monthly price shown
            // in the storage upsell dialogs
            lowStorageQuotaPlans:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE
                ]),

            // affPlans: 4, 1, 2, 3 - plans that can show in the affiliate redeem section
            affPlans:
                new Set([
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III
                ]),

            // miniPlans: 11, 12, 13 - mini plans available to targeted users
            miniPlans:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL
                ]),

            // ninetyDayRewind: 11, 12, 13, 4 - plans that have up to 90 days rewind instead of up to 180 days
            ninetyDayRewind:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE
                ]),

            // proPlans: 4, 1, 2, 3, 101 - plans that are in the group "pro"
            proPlans:
                new Set([
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III, pro.ACCOUNT_LEVEL_PRO_FLEXI
                ]),

            // core 4, 1, 2, 3 - plans with a set amount of storage and transfer and are available to most or all users
            core:
                new Set([
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III
                ]),

            // recommend: 1, 2, 3 - plans that are able to be recommended to users
            recommend:
                new Set([
                    pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II, pro.ACCOUNT_LEVEL_PRO_III
                ]),

            // TODO: Make this dynamic instead of hardcoding the values. Cannot guarantee no changes in the future.
            // yearlyMiniPlans: 12, 13 - mini plans available to targeted users which allow yearly subscriptions
            yearlyMiniPlans:
                new Set([
                    pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL
                ])
        },

        // Sets of plans to invert (all plans minus specified plans), will then
        // be added to pro.filter.simple, and plan arrays added to pro.filter.plans
        inverted: {
            // Plans that do not see the cancel benefits dialog
            canSeeCancelBenefits:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_FLEXI, pro.ACCOUNT_LEVEL_BUSINESS
                ]),

            // Plans that do not have an icon to show
            hasIcon:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL
                ]),

            supportsExpensive:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE
                ]),

            supportsGooglePlay:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_FLEXI
                ]),
        },

        superSet: {
            // Plans that are exlusive offiers
            excPlans: ['miniPlans'],

            // Plans that have regular transfer and storage quota
            regular: ['miniPlans', 'core'],
        },

        /**
         * Finds the lowest monthly plan that can store the users data, excluding their current plan
         * @param {number} userStorage - The users current storage in bytes
         * @param {string} secondaryFilter - The subset of plans to choose lowest plan from
         * @returns {Array|false} - An array item of the specific plan, or false if no plans found
         */
        lowestRequired(userStorage, secondaryFilter = 'all') {
            const plans = pro.filter.plans[secondaryFilter + 'M'];
            if (!plans) {
                console.assert(pro.membershipPlans.length, 'Plans not loaded');
                return;
            }
            return plans.find((plan) =>
                (plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] !== u_attr.p)
                && ((plan[pro.UTQA_RES_INDEX_STORAGE] * pro.BYTES_PER_GB) > userStorage)
                || (plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] === pro.ACCOUNT_LEVEL_PRO_FLEXI));
        }

    };

    const invertedFilterKeys = Object.keys(pf.inverted);

    for (let j = 0; j < invertedFilterKeys.length; j++) {

        lazy(pf.simple, invertedFilterKeys[j], () => {

            return new Set([...pro.filter.simple.all].filter((id) =>
                !pro.filter.inverted[invertedFilterKeys[j]].has(id)
            ));
        });
    }

    return Object.setPrototypeOf(pf, null);
});

/**
 * Functionality for the Pro page Step 1 where the user chooses their Pro plan.
 * If the user selects a plan but is not logged in, they are prompted to log in.
 */
pro.proplan = {

    /** The user's current plan data */
    planData: null,

    /** Business plan data */
    businessPlanData: null,

    /** The user's current storage in bytes */
    currentStorageBytes: 0,

    /** If the user had come from the home page, or wasn't logged in and the got booted back to Pro step 1 */
    previouslySelectedPlan: null,

    /** Discount API error codes. */
    discountErrors: {
        expired: -8,
        notFound: -9,
        diffUser: -11,
        isRedeemed: -12,
        tempUnavailable: -18
    },

    /**
     * Initialises the page and functionality
     */
    init: function() {
        "use strict";

        // if business sub-user is trying to get to Pro page redirect to home.
        if (u_attr && u_attr.b && (!u_attr.b.m || (u_attr.b.m && u_attr.b.s !== pro.ACCOUNT_STATUS_EXPIRED))) {
            loadSubPage('fm');
            return;
        }
        if (u_attr && u_attr.b && u_attr.b.m && pro.isExpiredOrInGracePeriod()) {
            loadSubPage('repay');
            return;
        }

        // Make sure Pro Flexi can't access the Pro page and redirect to the File Manager or Repay page
        if (u_attr && u_attr.pf && !pro.isExpiredOrInGracePeriod()) {
            loadSubPage('fm');
            return;
        }
        if (u_attr && u_attr.pf && pro.isExpiredOrInGracePeriod()) {
            loadSubPage('repay');
            return;
        }

        // Cache selectors
        var $body = $('body');
        var $stepOne = $('.pricing-section', $body);
        const $accountButton = $('.mega-button.account.individual-el', $stepOne);
        const $accountButtonLabel = $('span', $accountButton);
        const $freeButton = $(' .free-button', $stepOne);
        const $freeButtonLabel = $('span', $freeButton);

        // If selecting a plan after registration
        if (localStorage.keycomplete) {

            // Remove the flag so next page visit (or on refresh) they will go straight to Cloud Drive
            localStorage.removeItem('keycomplete');

            if (typeof u_attr.p === 'undefined') {

                // Show the Free plan
                $body.addClass('key');

                // Set "Get started for FREE" plans and bottom buttons label
                $accountButton.attr('href', '/fm');
                $accountButtonLabel.text(l[23960]);
                $freeButton.attr('href', '/fm');
                $freeButtonLabel.text(l[23960]);
            }
        }
        else if (typeof u_attr === 'undefined') {

            // Set "Get started for FREE" plans button label
            $freeButton.attr('href', '/register');
            $freeButtonLabel.text(l[23960]);

            // Set "Get started Now" bottom button label
            $accountButton.attr('href', '/register');
            $accountButtonLabel.text(l[24054]);
        }
        else {

            $body.addClass('pro');

            // Set "Cloud drive" plans and bottom buttons label
            $accountButton.attr('href', '/fm');
            $accountButtonLabel.text(l[164]);
            $freeButton.attr('href', '/fm');
            $freeButtonLabel.text(l[164]);
        }

        // Add click handlers for the pricing boxes
        this.initPricingBoxClickHandlers();

        // Add mouseover handlers for the pricing boxes
        this.initPlanHoverHandlers();

        // Load pricing data from the API
        this.loadPricingPlans();

        // Init plan slider controls
        this.initPlanSliderControls();

        // Init plan period radio buttons
        this.initPlanPeriodControls();

        // Init individual/business plans switcher
        this.initPlanControls();

        // Init compare slider
        this.initCompareSlider();

        // Init Get started for free button
        this.initGetFreeButton();

        // Init business plan tab events
        this.initBusinessPlanTabEvents();

        var prevWindowWidth = $(window).width();
        $(window).rebind('resize.proslider', function() {
            // Prevent Iphone url bar resizing trigger reinit.
            var currentWindowWidth = $(window).width();
            if (currentWindowWidth !== prevWindowWidth) {
                pro.proplan.initPlanSliderControls();
                prevWindowWidth = currentWindowWidth;
            }
        });

        if (window.nextPage === '1' && window.pickedPlan) {
            const $planDiv = $('.pricing-page.plan.main[data-payment=' + window.pickedPlan + ']', 'body');
            if ($planDiv.length) {
                $('.pricing-page.plan.main', 'body').removeClass('selected');
                $planDiv.addClass('selected');
                showRegisterDialog();
                delete window.nextPage;
                delete window.pickedPlan;
            }
        }
    },

    /**
     * Initialise the click handler for the desktop pricing boxes to continue straight to step two
     */
    initPricingBoxClickHandlers: function() {

        'use strict';

        var $planBlocks = $('.pricing-page.plans-block', 'body');
        var $purchaseButtons = $('.plan-button', $planBlocks);

        // Initialise click handler for all the plan blocks
        $purchaseButtons.rebind('click', function() {

            const $selectedPlan = $(this).closest('.plan');

            $('.plan', $planBlocks).removeClass('selected');
            $selectedPlan.addClass('selected');

            const planType = $selectedPlan.data('payment');

            if (typeof planType === 'number' && planType > 0 && planType <= 4) {
                // events log range from 99780 --> 99783
                // Pro1, Pro2, Pro3, Lite
                delay('pricing.plan', eventlog.bind(null, 99779 + planType));

                delay('pricing.plan', eventlog.bind(null, 99775 + planType));
            }

            // Continue to Step 2
            pro.proplan.continueToStepTwo($selectedPlan);
        });
    },

    /**
     * Initialise the click handler for the desktop pricing boxes to continue straight to step two
     */
    initPlanHoverHandlers: function() {

        'use strict';

        var $pricingPage =  $('.pricing-section', '.fmholder');
        var $planBlock = $('.pricing-page.plan.main', $pricingPage);
        var $planTag = $('.plan-tag-description', $pricingPage);

        // Initialise mouseover handler for all the plan blocks
        $planBlock.rebind('mouseenter.showprotag tap.showprotag', function() {

            var $this = $(this);

            if ($this.data('tag')) {

                // Set tag information
                $('span', $planTag).attr('class', 'pro' + $this.data('payment'))
                    .safeHTML($this.data('tag'));

                // pointer + tag has height of 40, when spacing between planblock and top of browser is < 40, causes bug
                if ($planBlock[0].getBoundingClientRect().top < 40) {
                    $planTag.css('width', $this.outerWidth()).addClass('visible').position({
                        of: $this,
                        my: 'center top',
                        at: 'center bottom-40'
                    });
                    $planTag.addClass('noafter');
                }
                else {
                    // Reposition the Tag
                    $planTag.css('width', $this.outerWidth()).addClass('visible').position({
                        of: $this,
                        my: 'center bottom',
                        at: 'center top-10'
                    });
                    $planTag.removeClass('noafter');
                }

                // Hide tag for mobile
                $(window).rebind('resize.hideprotag', function() {

                    $planBlock.trigger('mouseleave');
                });
            }
        });

        // Hide tag on mouseout
        $planBlock.rebind('mouseleave.hideprotag', function() {

            $planTag.removeClass('visible');
            $(window).unbind('resize.hideprotag');
        });
    },

    /**
     * Continues the flow to step two of the Pro payment process
     * @param {Object} $selectedPlan The selected Pro card container which has the data-payment attribute
     */
    continueToStepTwo: function($selectedPlan) {

        'use strict';

        var planNum = $selectedPlan.attr('data-payment');

        // If not logged in, show the login/register prompt
        if (!u_handle) {
            showSignupPromptDialog();
            return false;
        }

        // If they're ephemeral but awaiting email confirmation, still let them continue to choose a plan and pay
        else if (isEphemeral() && !localStorage.awaitingConfirmationAccount) {
            showRegisterDialog();
            return false;
        }

        // If they clicked the plan immediately after completing registration, set the flag so it can be logged
        if ($('body').hasClass('key')) {
            pro.propay.planChosenAfterRegistration = true;
        }

        // Load the Pro page step 2 where they can make payment
        loadSubPage('propay_' + planNum);
    },

    /**
     * Load the pricing plans
     */
    loadPricingPlans: function() {

        'use strict';

        // Show loading spinner because some stuff may not be rendered properly yet
        loadingDialog.show();

        // Hide the payment processing/transferring/loading overlay if click back from the payment page
        pro.propay.preloadAnimation();
        pro.propay.hideLoadingOverlay();

        /*
        * Hide the successful payment modal dialog of cardDialog, voucherDialog and redeem
        * if click back after making the payment successfully
        * */
        $('.payment-result.success', $(document.body)).addClass('hidden');

        // Load the membership plans
        pro.loadMembershipPlans(function() {

            // Render the plan details
            pro.proplan.populateMembershipPlans();

            // Check which plans are applicable or grey them out if not
            pro.proplan.checkApplicablePlans();

            // Close loading spinner
            loadingDialog.hide();
        });
    },

    /**
     * Pro page plans side scroll to elements.
     */
    initPlanSliderControls: function() {

        'use strict';

        // The box which gets scroll and contains all the child content.
        const $plansSection =  $('.plans-section', '.pricing-section');
        const $scrollBlock = $('.plans-wrap', $plansSection);
        const $row = $('.pricing-page.plans-row', $scrollBlock).first();
        const $slides =  $('.plan', $row);

        // Init default slider events for mobile
        bottompage.initSliderEvents($plansSection, $scrollBlock, $slides);

        // Init scroll event
        $scrollBlock.rebind('scroll.plansScrollEvent', () => {

            // Hide simple tip
            $('.pricing-sprite.i-icon', $scrollBlock).trigger('simpletipClose');

            // Hide plans tag
            $('.plan.main', $scrollBlock).trigger('mouseleave');
        });
    },

    /**
     * Pro page individual/business plans switcher
     */
    initPlanControls: function() {

        'use strict';

        var $stepOne = $('.pricing-section', 'body');
        var $switcherButton = $('.plans-switcher .button', $stepOne);
        var selectedSection;

        // Init Individual/Business buttons click
        $switcherButton.rebind('click.selectPlanType', function() {

            var $this = $(this);
            var selectedSection;

            // Set active state
            $switcherButton.removeClass('active');
            $this.addClass('active');

            // Show/hide necessary content blocks
            if ($this.is('.business')) {
                $('.individual-el', $stepOne).addClass('hidden');
                $('.business-el', $stepOne).removeClass('hidden');

                selectedSection = 'business';
            }
            else {
                $('.individual-el', $stepOne).removeClass('hidden');
                $('.business-el', $stepOne).addClass('hidden');

                selectedSection = 'individual';
            }

            sessionStorage.setItem('pro.subsection', selectedSection);
        });

        // Show previously selected plans type
        selectedSection = sessionStorage['pro.subsection'];

        if (selectedSection) {
            $switcherButton.filter('.' + selectedSection).trigger('click');
        }
    },

    /**
     * Pro page Monthly/Yearly price switcher
     */
    initPlanPeriodControls: function($dialog) {

        'use strict';

        var $stepOne = $($dialog ? $dialog : '.scroll-block');
        var $pricingBoxes = $('.plans-block .pricing-page.plan', $stepOne);
        var $pricePeriod = $('.plan-period', $pricingBoxes);
        var $radioButtons = $('.pricing-page.radio-buttons input', $stepOne);
        var $radioLabels = $('.pricing-page.radio-buttons .radio-txt', $stepOne);
        var $savePercs = $('.pricing-page.save-percs:visible', $stepOne);
        var $saveArrow = $('.save-green-arrow:visible', $stepOne);
        var savePercsReposition;

        if ($savePercs.length && $saveArrow.length) {

            // Set text to "save" block
            $savePercs.safeHTML(l[16649]);
            $('span', $savePercs).text(formatPercentage(0.16));

            savePercsReposition = function() {
                $savePercs.position({
                    of: $saveArrow,
                    my: 'left top',
                    at: 'right+1 top-13',
                    collision: 'fit none'
                });
            };

            // Reposition percs block
            savePercsReposition();
            $(window).rebind('resize.propercsreposition', savePercsReposition);
        }

        // Init monthly/yearly radio buttons value change
        $radioLabels.rebind('click', function(){
            $('input', $(this).prev()).trigger('click');
        });

        $radioButtons.rebind('change.changePeriod', function() {

            var value = $(this).val();
            var monthOrYearWording;

            // Set Off states to all buttons
            $radioButtons.removeClass('radioOn').addClass('radioOff');
            $radioButtons.parent().removeClass('radioOn').addClass('radioOff');

            // Set On state for checked  button
            if (this.checked) {
                $(this).removeClass('radioOff').addClass('radioOn');
                $(this).parent().removeClass('radioOff').addClass('radioOn');
            }

            // Set monthly/yearly wording variable
            if (value === '12') {
                monthOrYearWording = l[932];
            }
            else {
                monthOrYearWording = l[931];
            }

            // Updte price and transfer values
            pro.proplan.updateEachPriceBlock($dialog ? 'D' : 'P', $pricingBoxes, $dialog, parseInt(value));

            // Update the plan period text
            $pricePeriod.text('/' + monthOrYearWording);
        });

        // Set yearly prices by default
        const preSelectedPeriod = (sessionStorage.getItem('pro.period') | 0) || 12;
        $radioButtons.filter(`input[value="${preSelectedPeriod}"]`).trigger('click');
    },

    /**
     * Pro page compare slider
     */
    initCompareSlider: function() {

        'use strict';

        var $stepOne = $('.pricing-section', 'body');
        var $sliderWrap = $('.pricing-page.slider-wrap', $stepOne);
        var $slider = $('.pricing-page.slider', $sliderWrap);
        var $resultWarpper = $('.pricing-page.compare-block', $stepOne);
        var $resultBlocks = $('.compare-cell', $resultWarpper);
        var $resultTip = $('.pricing-page.compare-tip .tip', $stepOne);
        var $dots = $('.slider-dot', $sliderWrap);
        var compareDetails = [];

        // Set current exchange tip value in USD
        $resultTip.text(l[24078].replace('%1', mega.intl.number.format('1.17')));

        // Set compare slider labels
        $dots.get().forEach(function(e) {

            var $this = $(e);
            var $label = $('.label', $this);
            var storageValue = $label.data('storage');

            // Set storage value labels
            if (storageValue) {

                $label.safeHTML(l[23789].replace('%1', '<span>' + bytesToSize(storageValue) + '</span>'));
            }
            // Set Free Storage label
            else {

                $label.safeHTML(l[24099]);
            }
        });

        // Set compare MEGA/GoogleDrive/Dropbox data for FREE/2TB/8TB/16TB plans.

        const gb = 1024 * 1024 * 1024;
        const tb = gb * 1024;

        compareDetails = [
            [
                ['', bytesToSize(20 * gb), '', l[16362]],
                ['', bytesToSize(2 * gb), '' , l[24075]],
                ['', bytesToSize(15 * gb), '', l[24076]]
            ],
            [
                [bytesToSize(2 * tb), '9.99', 'EUR', l[23818].replace('%1', l[5819])],
                [bytesToSize(2 * tb), '10.27', 'EUR', l[23947]],
                [bytesToSize(2 * tb), '9.99', 'EUR', l[23818].replace('%1', bytesToSize(2 * tb))]
            ],
            [
                [bytesToSize(8 * tb), '19.99', 'EUR', l[23818].replace('%1', l[6125])],
                [bytesToSize(8 * tb), '', '', ''],
                [bytesToSize(8 * tb), '', '', '']
            ],
            [
                [bytesToSize(16 * tb), '29.99', 'EUR', l[23818].replace('%1', l[6126])],
                [bytesToSize(16 * tb), '', '', ''],
                [bytesToSize(16 * tb), '', '', '']
            ]
        ];

        // Init compare slider
        $slider.slider({

            min: 1, max: 4, range: 'min',
            change: function(e, ui) {

                var value = ui.value;

                // Set  selected slide data
                $resultWarpper.attr('class', 'pricing-page compare-block slide' + value);

                const $freeBlock = $($resultBlocks[0]);

                if (value === 1) {
                    $freeBlock.addClass('free');
                }
                else {
                    $freeBlock.removeClass('free');
                }

                // Change compare MEGA/GoogleDrive/Dropbox blocks data
                for (var i = 0, length = $resultBlocks.length; i < length; i++) {

                    var $resultBlock = $($resultBlocks[i]);
                    var $planInfoBlock = $('.compare-info', $resultBlock);
                    var planInfo = compareDetails[value - 1][i];

                    // Default block UI
                    $resultBlock.removeClass('not-supported');

                    // Set Storage value
                    $('.compare-storage', $resultBlock).text(planInfo[0]);

                    // Not supported UI if price is not set
                    if (!planInfo[1]) {
                        $resultBlock.addClass('not-supported');

                        continue;
                    }

                    // Set price and currency
                    $('.price', $resultBlock).safeHTML(value === 1 ? planInfo[1] :
                        formatCurrency(planInfo[1], planInfo[2])
                            .replace('\u20ac', '<span class="currency">\u20ac</span>'));

                    // Change plan tip
                    if (planInfo[3]) {
                        $planInfoBlock.text(planInfo[3]);
                    }
                }

                // Change compare MEGA/GoogleDrive/Dropbox blocks data
                $dots.removeClass('active');

                for (var j = 0; j < value; j++) {
                    $($dots[j]).addClass('active');
                }
            },
            slide: function(e, ui) {

                var value = ui.value;

                // Change compare MEGA/GoogleDrive/Dropbox blocks data
                $dots.removeClass('active');

                for (var j = 0; j < value; j++) {
                    $($dots[j]).addClass('active');
                }
            }
        });

        // Set 50GB plan as default
        $slider.slider('value', 3);

        // Init slider dots click
        $dots.rebind('click', function() {
            $('.pricing-page.slider').slider('value', $(this).data('val'));
        });
    },

    /**
     * Pro page Get started for Free button
     */
    initGetFreeButton: function() {

        'use strict';

        const $stepOne = $('.pricing-section', 'body');
        const $getFreeButton = $('.free-button', $stepOne);
        const $getStartedNow = $('#get-started-btn', $stepOne);

        onIdle(() => {
            // ugh, a race with clickURL
            $getStartedNow.rebind('click.log', () => {
                eventlog(99785);
            });
        });

        // Init button click
        $getFreeButton.rebind('click', () => {

            delay('pricing.plan', eventlog.bind(null, 99784));

            if (typeof u_attr === 'undefined') {
                loadSubPage('register');

                return false;
            }

            // If coming from the process key step and they click on the Free button
            loadSubPage('fm');

            if (localStorage.gotOverquotaWithAchievements) {
                onIdle(() => {
                    mega.achievem.achievementsListDialog();
                });
                delete localStorage.gotOverquotaWithAchievements;
            }
        });
    },

    /**
     * Get current and next plan data if user logged in
     * @param {Object} $pricingBoxes Pro cards blocks
     */
    updateCurrentPlanData: function($pricingBoxes) {
        "use strict";

        // If user is logged in get curent/next plan info
        if (u_type === 3) {

            // If account data does not exist then or it was changed
            if (!pro.proplan.planData || pro.proplan.planData.utype !== u_attr.p
                || (pro.proplan.planData.srenew && M.account && M.account.stype !== 'S')) {

                // Get user quota information, the flag 'strg: 1' includes current account storage in the response
                api_req({ a: 'uq', strg: 1, pro: 1 }, {
                    callback : function(result) {

                        // Store current account storage usage for checking later
                        pro.proplan.currentStorageBytes = result.cstrg;

                        // Save plan data
                        pro.proplan.planData = result;

                        // Process next and current plan data and display tag on top of the plan
                        pro.proplan.processCurrentAndNextPlan(result, $pricingBoxes);
                    }
                });
            }
            else {

                // Process next and current plan data and display tag on top of the plan
                pro.proplan.processCurrentAndNextPlan(pro.proplan.planData, $pricingBoxes);
            }
        }
    },

    /**
     * Update each pricing block with details from the API
     */
    updateEachPriceBlock: function(pageType, $pricingBoxes, $dialog, period) {
        "use strict";

        var euroSign = '\u20ac';
        var oneLocalPriceFound = false;
        var zeroPrice;
        var classType = 1;
        var intl = mega.intl.number;

        // If user is logged in, and the page type is P, get curent/next plan info
        if (pageType === 'P') {
            pro.proplan.updateCurrentPlanData($pricingBoxes);
        }

        // Save selected payment period
        sessionStorage.setItem('pro.period', period);

        for (var i = 0, length = pro.membershipPlans.length; i < length; i++) {

            // Get plan details
            var currentPlan = pro.membershipPlans[i];
            var months = currentPlan[pro.UTQA_RES_INDEX_MONTHS];
            var planNum = currentPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];
            var planName = pro.getProPlanName(planNum);
            var priceIndex = pro.UTQA_RES_INDEX_MONTHLYBASEPRICE;
            let planObj = pro.getPlanObj(currentPlan);

            // Skip if data differs from selected period
            if (months !== period) {
                continue;
            }
            // Set yearly variable index
            else if (months === 12) {
                priceIndex = pro.UTQA_RES_INDEX_PRICE;
            }

            // Iterate over the filtered boxes (as some targeted low tier plan users
            // will see the monthly and yearly plan cards at the same time)
            var $filteredBoxes = $pricingBoxes.filter('.pro' + planNum);
            for (var j = 0; j < $filteredBoxes.length; j++) {
                var $currentBox = $($filteredBoxes[j]);
                const isLowTierPlanBox = !!$currentBox.data('period');
                const isYearlyLowTierPlanBox = $currentBox.data('period') === 12;

                if (isYearlyLowTierPlanBox) {
                    planObj = planObj.correlatedPlan;
                    currentPlan = planObj.planArray;
                }

                var $price = $('.plan-price .price', $currentBox);
                var $euroPrice = $('.pricing-page.euro-price', $currentBox);
                var $currncyAbbrev = $('.pricing-page.plan-currency', $filteredBoxes);
                var $planName = $('.pricing-page.plan-title', $currentBox);
                var $planButton = $('.pricing-page.plan-button', $currentBox);
                var basePrice;
                var baseCurrency;
                $currentBox.removeClass('hidden');

                if (currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE]) {
                    // Calculate the base price in local currency
                    basePrice = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE];
                    baseCurrency = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];

                    $currncyAbbrev.text(baseCurrency);
                    $euroPrice.text(formatCurrency(currentPlan[priceIndex]));

                    if (pageType === "P") {
                        oneLocalPriceFound = true;
                    }

                    // Set localCurrency indicator
                    if ($dialog) {
                        $dialog.addClass('local-currency');
                    }
                }
                else {
                    // Calculate the base price
                    basePrice = currentPlan[pro.UTQA_RES_INDEX_PRICE];
                    baseCurrency = 'EUR';
                }

                // Calculate the monthly base price
                var storageGigabytes = currentPlan[pro.UTQA_RES_INDEX_STORAGE];
                var storageBytes = storageGigabytes * 1024 * 1024 * 1024;
                var storageFormatted = numOfBytes(storageBytes, 0);
                var storageSizeRounded = Math.round(storageFormatted.size);
                var storageValue;

                var bandwidthGigabytes = currentPlan[pro.UTQA_RES_INDEX_TRANSFER];
                var bandwidthBytes = bandwidthGigabytes * 1024 * 1024 * 1024;

                // Get bandwidth
                const bandwidthValue = bytesToSize(bandwidthBytes, isYearlyLowTierPlanBox ? 1 : 0);

                // Update the plan name
                $planName.text(planName);

                // Update the button label plan name if plan is not a current one
                if (!$currentBox.first().is('.current')) {
                    $planButton.first().text(l[23776].replace('%1', planName));
                }

                $price.text(formatCurrency(basePrice, baseCurrency, 'narrowSymbol'));

                if (pageType === 'D') {
                    const $onlySection = $('.pricing-page.plan-only', $currentBox);
                    const $currencyAndPeriod = $('.pricing-page.currency-and-period', $currentBox);
                    const periodIsYearly = period === 12 || isYearlyLowTierPlanBox;

                    // TODO change strings to be "<currency> billed monthly/yearly" in future ticket
                    const billingPeriodText = `${baseCurrency} / ${periodIsYearly ? l[932] : l[931]}`;
                    const onlyText = l.pr_only;

                    // TODO re-enable in future ticket
                    // const $monthlyPrice = $('.pricing-page.monthly-price', $currentBox)
                    // .toggleClass('hidden', !periodIsYearly); // TODO unhide in HTML in future ticket
                    // if (periodIsYearly) {
                    //     onlyText = formatCurrency(price, baseCurrency, 'narrowSymbol');

                    //     const perMonthPrice = formatCurrency(
                    //         planObj.correlatedPlan.price, baseCurrency, 'narrowSymbol') + '*';
                    //     $('span', $monthlyPrice).text(perMonthPrice);
                    // }

                    if (isLowTierPlanBox && pro.filter.simple.yearlyMiniPlans.has(planNum)) {
                        const $periodSubTitle = $('.pricing-page.period-subtitle', $currentBox);
                        $periodSubTitle.text(periodIsYearly ? l.yearly_unit : l[918]);

                        if (periodIsYearly && planObj.saveUpTo) {
                            const savingsString = l.yearly_plan_saving.replace('%1', planObj.saveUpTo);
                            $('.pricing-page.plan-saving', $currentBox).text(savingsString).removeClass('hidden');
                        }
                    }

                    $onlySection.text(onlyText); // TODO toggle strikethrough class in future ticket
                    $currencyAndPeriod.text(billingPeriodText);
                }

                // Get storage
                storageValue = storageSizeRounded + ' ' + storageFormatted.unit;

                // Update storage and bandwidth data
                pro.proplan.updatePlanData($currentBox, storageValue, bandwidthValue, period);
            }
        }

        return pageType === "P" ? [oneLocalPriceFound] : classType;
    },

    /**
     * Update Storage and bandwidth data in plaan card
     */
    updatePlanData: function($pricingBox, storageValue, bandwidthValue, period) {

        "use strict";

        var $storageAmount = $('.plan-feature.storage', $pricingBox);
        var $storageTip = $('i', $storageAmount);
        var $bandwidthAmount = $('.plan-feature.transfer', $pricingBox);
        var $bandwidthTip = $('i', $bandwidthAmount);
        var bandwidthText = period === 1 ? l[23808] : l[24065];

        // Update storage
        $('span span', $storageAmount).text(storageValue);
        if ($storageTip && $storageTip.attr('data-simpletip')) {
            $storageTip.attr('data-simpletip', l[23807].replace('%1', '[U]' + storageValue + '[/U]'));
        }

        // Update bandwidth
        $('span span', $bandwidthAmount).text(bandwidthValue);
        if ($bandwidthTip && $bandwidthTip.data('simpletip')) {
            $bandwidthTip.attr('data-simpletip', bandwidthText.replace('%1', '[U]' + bandwidthValue + '[/U]'));
        }
    },

    /**
     * Populate the monthly plans across the main /pro page
     */
    populateMembershipPlans: function() {

        "use strict";

        const $stepOne = $('.plans-section', 'body');
        const $pricingBoxes = $('.pricing-page.plan', $stepOne);
        const updateResults = pro.proplan.updateEachPriceBlock("P", $pricingBoxes, undefined, 1);

        if (updateResults[0]) {
            $stepOne.addClass('local-currency');
        }
        else {
            $stepOne.removeClass('local-currency');
        }
    },

    /**
     * Check applicable plans for the user based on their current storage usage
     */
    checkApplicablePlans: function() {

        // If their account storage is not available (e.g. not logged in) all plan options will be shown
        if (pro.proplan.currentStorageBytes === 0) {
            return false;
        }

        // Cache selectors
        var $stepOne = $('.pricing-section', 'body');
        var $pricingBoxes = $('.pricing-page.plan', $stepOne);
        var $noPlansSuitable = $('.no-plans-suitable',  $stepOne);
        var $currentStorageTerabytes = $('.current-storage .terabytes',  $noPlansSuitable);
        var $requestPlanButton = $('.btn-request-plan',  $noPlansSuitable);

        // Calculate storage in gigabytes
        var totalNumOfPlans = 4;
        var numOfPlansNotApplicable = 0;
        var currentStorageGigabytes = pro.proplan.currentStorageBytes / 1024 / 1024 / 1024;

        if (u_attr && u_attr.b) {

            // Show business plan
            $('.plans-switcher .button.business', $stepOne).trigger('click');
        }
        else {

            // Show individual plans
            $('.plans-switcher .button.individual', $stepOne).trigger('click');

            // Loop through membership plans
            for (var i = 0, length = pro.membershipPlans.length; i < length; i++) {

                // Get plan details
                var currentPlan = pro.membershipPlans[i];
                var proNum = parseInt(currentPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL]);
                var planStorageGigabytes = parseInt(currentPlan[pro.UTQA_RES_INDEX_STORAGE]);
                var months = parseInt(currentPlan[pro.UTQA_RES_INDEX_MONTHS]);

                // If their current storage usage is more than the plan's grey it out
                if ((months !== 12) && (currentStorageGigabytes > planStorageGigabytes)) {

                    // Grey out the plan
                    $pricingBoxes.filter('.pro' + proNum).addClass('sub-optimal-plan');

                    // Add count of plans that aren't applicable
                    numOfPlansNotApplicable++;
                }
            }
        }

        // Show message to contact support
        if (numOfPlansNotApplicable === totalNumOfPlans) {

            // Get current usage in TB and round to 3 decimal places
            var currentStorageTerabytes = currentStorageGigabytes / 1024;
            currentStorageTerabytes = Math.round(currentStorageTerabytes * 1000) / 1000;
            currentStorageTerabytes = l[5816].replace('[X]', currentStorageTerabytes);

            // Show current storage usage and message
            $noPlansSuitable.removeClass('hidden');
            $currentStorageTerabytes.text(currentStorageTerabytes);

            clickURLs();

            // Redirect to #contact
            $requestPlanButton.rebind('click', function() {
                loadSubPage('contact');
            });
        }
    },

    /**
     * Processes a return URL from the payment provider in form of /payment-{providername}-{status} e.g.
     * /payment-ecp-success
     * /payment-ecp-failure
     * /payment-sabadell-success
     * /payment-sabadell-failure
     * /payment-astropay-pending
     * /payment-paysafecard-saleidXXX
     * @param {String} page The requested page from index.js e.g. payment-ecp-success etc
     */
    processReturnUrlFromProvider: function(page) {

        // Get the provider we are returning from and the status
        var pageParts = page.split('-');
        var provider = pageParts[1];
        var status = pageParts[2];

        var successPayText = l[19514];
        var $pendingOverlay = $('.payment-result.pending.alternate');


        // manipulate the texts if business account
        if (status === 'success' && pageParts && pageParts[3] === 'b') {
            successPayText = l[19809].replace('{0}', '1');
        }

        $pendingOverlay.find('.payment-result-txt').safeHTML(successPayText);

        // If returning from an paysafecard payment, do a verification on the sale ID
        if (provider === 'paysafecard') {
            paysafecard.verify(status);
        }

        // If returning from an AstroPay payment, show a pending payment dialog
        else if (provider === 'astropay') {
            astroPayDialog.showPendingPayment();
        }

        // If returning from an Ecomprocessing payment, show a success or failure dialog
        else if (provider === 'ecp') {
            addressDialog.showPaymentResult(status);
        }

        // Sabadell needs to also show success or failure
        else if (provider === 'sabadell') {
            sabadell.showPaymentResult(status);
        }
    },

    /**
     * Processes current and next plan data from api response, and place tag(s) for it.
     *
     * @param {Object} data Api response data
     * @param {Object} $pricingBoxes Pro cards blocks
     */
    processCurrentAndNextPlan: function(data, $pricingBoxes) {

        'use strict';

        var $currPlan = $pricingBoxes.filter('[data-payment="' + data.utype + '"]').addClass('current');
        var currentExpireTimestamp;

        // Set "Current plan"button label
        $('.pricing-page.plan-button', $currPlan).text(l[20711]);

        // Current plan
        if (data.srenew) { // This is subscription plan

            var renewTimestamp = data.srenew[0];
            if (renewTimestamp === 0) {
                $currPlan.addClass('renew');
            }
            else {
                $currPlan.addClass('renew')
                    .data('tag', l[20759].replace('%1', time2date(renewTimestamp, 2)));
            }
        }
        else {
            currentExpireTimestamp = data.nextplan ? data.nextplan.t : data.suntil;
            $currPlan.data('tag', l[20713].replace('%1', time2date(currentExpireTimestamp, 2)));
        }

        // Next plan
        if (data.nextplan) {

            // Store next plan
            pro.proplan.nextPlan = data.nextplan;

            var $nextPlan = $pricingBoxes.filter('[data-payment="' + pro.proplan.nextPlan.p + '"]');

            $nextPlan.addClass('next');
            $nextPlan.data('tag', l[20714].replace('%1', time2date(pro.proplan.nextPlan.t, 2))
                .replace('%2', pro.getProPlanName(pro.proplan.nextPlan.p)));

            // Hide popular text on next plan
            $('.pro-popular-txt', $nextPlan).addClass('hidden');
        }

    },
    handleDiscount: function(page) {
        'use strict';
        mega.discountCode = page.substr(8);
        if (mega.discountCode.length < 15) {
            // it should be 22 length. but made 10 because i am not sure if len=22 is guaranteed
            delete mega.discountInfo;
            msgDialog('warninga', l[135], l[24676], false, () => {
                loadSubPage('pro');
            });
            return false;
        }
        if (!u_type) {
            login_txt = l[24673];
            login_next = 'discount' + mega.discountCode;
            return loadSubPage('login');
        }
        loadingDialog.show();
        delete mega.discountInfo;
        api.req({a: 'dci', dc: mega.discountCode}).then(({result: res}) => {
            loadingDialog.hide();
            if (res && res.al && res.pd) {
                DiscountPromo.storeDiscountInfo(res);
                return loadSubPage('propay_' + res.al);
            }
            msgDialog('warninga', l[135], l[24674], false, () => {
                loadSubPage('pro');
            });
        }).catch((ex) => {
            loadingDialog.hide();
            let errMsg = l[24674];
            if (ex === pro.proplan.discountErrors.expired) {
                errMsg = l[24675];
            }
            else if (ex === pro.proplan.discountErrors.notFound) {
                errMsg = l[24676];
            }
            else if (ex === pro.proplan.discountErrors.diffUser) {
                errMsg = l[24677];
            }
            else if (ex === pro.proplan.discountErrors.isRedeemed) {
                errMsg = l[24678];
            }
            else if (ex === pro.proplan.discountErrors.tempUnavailable) {
                errMsg = l[24764];
            }
            msgDialog('warninga', l[135], errMsg, false, () => {
                loadSubPage('pro');
            });
        });
        return false;
    },

    /**
     * Init business plan tab events, set plandata
     * @returns {void}
     */
    initBusinessPlanTabEvents: function() {

        'use strict';

        // Set business plan data (users/storage/stransfer/price)
        this.setBusinessPlanData();

        // Init quotes slider in business section.
        this.initQuotesSliderControls();
    },

    /**
     * Set business plan data (users/storage/stransfer/price)
     * @returns {void}
     */
    setBusinessPlanData: function() {

        'use strict';

        M.require('businessAcc_js').done(function afterLoadingBusinessClass() {
            const business = new BusinessAccount();

            // eslint-disable-next-line complexity
            business.getBusinessPlanInfo(false).then((info) => {

                pro.proplan.businessPlanData = info;

                // If all new API values exist
                pro.proplan.businessPlanData.isValidBillingData = info.bd && info.bd.us
                    && (info.bd.us.p || info.bd.us.lp)
                    && info.bd.sto && (info.bd.sto.p || info.bd.sto.lp)
                    && info.bd.sto.s && info.bd.trns && (info.bd.trns.p || info.bd.trns.lp)
                    && info.bd.trns.t && info.bd.ba.s && info.bd.ba.t;

                // If local currency values exist
                pro.proplan.businessPlanData.isLocalInfoValid = info.l && info.l.lcs && info.l.lc
                    && info.bd.us.lp && info.bd.sto.lp && info.bd.trns.lp;

                pro.proplan.populateBusinessPlanData();
            });
        });
    },

    /**
     * Populate Business plan card data
     * @returns {void}
     */
    populateBusinessPlanData: function() {

        'use strict';

        const $stepOne = $('.pricing-section', '.fmholder');
        let $businessCard = $('.js-business-card', $stepOne);
        const pricePerUser = this.businessPlanData.bd && this.businessPlanData.bd.us && this.businessPlanData.bd.us.p;

        const $createBusinessBtn = $('#create-business-btn', $stepOne);
        const $tryBusinessBtn = $('#try-business-btn', $stepOne);

        onIdle(() => {
            // ugh, a race with clickURL
            $createBusinessBtn.rebind('click.log', () => {
                eventlog(99786);
            });
            $tryBusinessBtn.rebind('click.log', () => {
                eventlog(99787);
            });
        });

        // If new API values exist, populate new business card values
        if (this.businessPlanData.isValidBillingData) {

            const $storageInfo = $('.plan-feature.storage', $businessCard);
            const $transferInfo = $('.plan-feature.transfer', $businessCard);
            const minStorageValue = this.businessPlanData.bd.ba.s / 1024;
            const minTransferValue = this.businessPlanData.bd.ba.t / 1024;
            let storagePrice = 0;
            let transferPrice = 0;

            // If local currency values exist
            if (this.businessPlanData.isLocalInfoValid) {
                storagePrice = formatCurrency(this.businessPlanData.bd.sto.lp, this.businessPlanData.l.lc) + '*';
                transferPrice = formatCurrency(this.businessPlanData.bd.trns.lp, this.businessPlanData.l.lc) + '*';
            }
            else {
                storagePrice = formatCurrency(this.businessPlanData.bd.sto.p);
                transferPrice = formatCurrency(this.businessPlanData.bd.trns.p);
            }

            // Set storage and transfer details, simpletip hint
            $('.js-main', $storageInfo).text(
                l.bsn_starting_storage.replace('%1', minStorageValue)
            );
            $('.js-addition', $storageInfo).text(
                l.bsn_additional_storage.replace('%1', storagePrice)
            );
            $('i', $storageInfo).attr(
                'data-simpletip', l.bsn_storage_tip.replace('%1', `${minStorageValue} ${l[20160]}`)
                    .replace('%2', storagePrice)
            );
            $('.js-main', $transferInfo).text(
                l.bsn_starting_transfer.replace('%1', minTransferValue)
            );
            $('.js-addition', $transferInfo).text(
                l.bsn_additional_transfer.replace('%1', transferPrice)
            );
            $('i', $transferInfo).attr(
                'data-simpletip', l.bsn_transfer_tip.replace('%1', `${minTransferValue} ${l[20160]}`)
                    .replace('%2', transferPrice)
            );

            // Init price calculator events, populate necessary plan data
            this.initBusinessPlanCalculator();

            // Show new Business plan card and calculator if new API is valid
            $('.business-el-new', $stepOne).removeClass('hidden');
            $('.business-el-old', $stepOne).addClass('hidden');
        }

        // Show old Business plan card, if new API is incorrect.
        // TODO: remove when new API is stable
        else {

            const storageAmount = this.businessPlanData.bd
                && this.businessPlanData.bd.ba && this.businessPlanData.bd.ba.s ?
                this.businessPlanData.bd.ba.s / 1024 : 15;

            $businessCard = $('.js-business-card-old', $stepOne);
            $('.plan-feature.storage-b span', $businessCard).safeHTML(
                l[23789].replace('%1', `<span>${storageAmount} ${l[20160]}</span>`)
            );

            $('.business-el-new', $stepOne).addClass('hidden');
            $('.business-el-old', $stepOne).removeClass('hidden');
        }

        // Set the plan main prices for both Old and New APIs
        if (this.businessPlanData.isLocalInfoValid) {

            $businessCard.addClass('local-currency');
            $('.plan-price .price', $businessCard).text(
                formatCurrency(this.businessPlanData.bd.us.lp, this.businessPlanData.l.lc, 'narrowSymbol'));
            $('.pricing-page.plan-currency', $businessCard).text(this.businessPlanData.l.lc);
            $('.pricing-page.euro-price', $businessCard).text(formatCurrency(pricePerUser));
        }
        else {

            $businessCard.removeClass('local-currency');
            $('.plan-price .price', $businessCard).text(formatCurrency(pricePerUser));
        }
    },

    /**
     * Init Business plan calculator events
     * @returns {void}
     */
    initBusinessPlanCalculator: function() {

        'use strict';

        const $stepOne = $('.pricing-section', '.fmholder');
        const $calculator = $('.business-calculator', $stepOne);
        const $usersSlider = $('.business-slider.users', $calculator);
        const $storageSlider = $('.business-slider.storage', $calculator);
        const $transferSlider = $('.business-slider.transfer', $calculator);
        const $totalPrice = $('.footer span', $calculator);
        const planInfo = this.businessPlanData;
        const minStorageValue = planInfo.bd.ba.s / 1024;
        const minTransferValue = planInfo.bd.ba.t / 1024;
        let userPrice = 0;
        let storagePrice = 0;
        let transferPrice = 0;
        let astrisk = '';

        // If local currency values exist
        if (planInfo.isLocalInfoValid) {
            userPrice = parseFloat(planInfo.bd.us.lp);
            storagePrice = parseFloat(planInfo.bd.sto.lp);
            transferPrice = parseFloat(planInfo.bd.trns.lp);
            astrisk = '*';
        }
        else {
            userPrice = parseFloat(planInfo.bd.us.p);
            storagePrice = parseFloat(planInfo.bd.sto.p);
            transferPrice = parseFloat(planInfo.bd.trns.p);
        }

        /**
         * Calculate Business plan price
         * @param {Number} usersValue Optional. Script will take calculator value if undefined
         * @param {Number} storageValue Optional. Script will take calculator value if undefined
         * @param{Number} transferValue Optional. Script will take calculator value if undefined
         * @returns {Number} Calculated price value
         */
        const calculatePrice = (usersValue, storageValue, transferValue) => {

            let totalPrice = 0;

            usersValue = usersValue || $usersSlider.attr('data-value');
            storageValue = storageValue || $storageSlider.attr('data-value');
            transferValue = transferValue || $transferSlider.attr('data-value');

            totalPrice = userPrice * usersValue
                + storagePrice * (storageValue - minStorageValue)
                + transferPrice * (transferValue - minTransferValue);

            return this.businessPlanData.isLocalInfoValid ?
                formatCurrency(totalPrice, this.businessPlanData.l.lc) : formatCurrency(totalPrice) + astrisk;
        };

        /**
         * Set users slider value
         * @param {Object} $handle jQ selecter on slider handle
         * @param {Number} value Selected slider value
         * @returns {void}
         */
        const setUsersSliderValue = ($handle, value) => {

            // Set the value in custom created span in the handle
            $('span', $handle).text(value);
            $handle.attr('data-value', value);

            // Calculate the price and set in total
            $totalPrice.text(calculatePrice());
        };

        /**
         * Set storage and transfer slider value
         * @param {Object} $handle jQ selecter on slider handle
         * @param {Number} value Selected slider value
         * @returns {void}
         */
        const setDataSlidersValue = ($handle, value) => {

            let result = 0;

            // Small trick which changes slider step if storage value > 1TB
            if (value <= 100) {
                $('span', $handle).text(`${value} ${l[20160]}`);
                result = value;
            }
            else if (value < 150) {
                result = Math.floor((value - 100) / 5) || 1;
                result *= 100;
                $('span', $handle).text(`${result} ${l[20160]}`);
            }
            else if (value === 150) {
                $('span', $handle).text(`1 ${l[23061]}`);
                result = 1000;
            }
            else if (value <= 200) {
                result = Math.floor((value - 150) / 5) || 1;
                $('span', $handle).text(`${result} ${l[23061]}`);
                result *= 1000;
            }

            // Set data attribute for futher calculations
            $handle.attr('data-value', result);

            // Calculate the price and set in total
            $totalPrice.text(calculatePrice());
        };

        // Init users/storage/transfer sliders at once
        $usersSlider.add($storageSlider).add($transferSlider).slider({
            range: 'min',
            step: 1,
            change: function(event, ui) {
                setUsersSliderValue($(this), ui.value);
            },
            slide: function(event, ui) {
                setUsersSliderValue($(this), ui.value);
            }
        });

        // Init Storage  and transfer sliders
        $storageSlider.add($transferSlider).slider({

            range: 'min',
            step: 1,
            change: function(event, ui) {
                setDataSlidersValue($(this), ui.value);
            },
            slide: function(event, ui) {
                setDataSlidersValue($(this), ui.value);
            }
        });

        // Set custom min/current values for each slider
        $usersSlider.slider({
            'min': planInfo.bd.minu,
            'max': 300,
            'value': planInfo.bd.minu
        });
        $storageSlider.slider({
            'min': minStorageValue,
            'max': 200,
            'value': minStorageValue
        });
        $transferSlider.slider({
            'min': minTransferValue,
            'max': 200,
            'value': minTransferValue
        });

        // Set "Most competitive price" values
        $('.pr1', $calculator).text(
            l.bsn_calc_monthly_price
                .replace('%1', `100 ${l[20160]}`)
                .replace('%2', calculatePrice(3, 97, 0))
        );
        $('.pr2', $calculator).text(
            l.bsn_calc_monthly_price
                .replace('%1', `1 ${l[23061]}`)
                .replace('%2',  calculatePrice(3, 997, 0))
        );

        // Set min values under each slider
        $('.js-min-users', $calculator).safeHTML(
            l.bsn_calc_min_users.replace('%1', planInfo.bd.minu)
        );
        $('.js-min-storage', $calculator).safeHTML(
            l.bsn_calc_min_storage.replace('%1', minStorageValue)
        );
        $('.js-min-transfer', $calculator).safeHTML(
            l.bsn_calc_min_transfer.replace('%1', minTransferValue)
        );
    },

    /**
     * Init quotes slider in business section.
     * @returns {void}
     */
    initQuotesSliderControls: function() {

        'use strict';

        // The box which gets scroll and contains all the child content.
        const $quotesSection = $('.business-q-wrap', '.pricing-section');
        const $scrollBlock = $('.business-quotes',  $quotesSection);
        const $slides =  $('.business-quote', $scrollBlock);

        // Init default slider events for mobile
        bottompage.initSliderEvents($quotesSection, $scrollBlock, $slides, true);
    }
};

/* jshint -W003 */  // Warning is not relevant

/**
 * The old Login / Register dialogs which are used if they are not logged in and try to go to Step 2.
 * @param {String} email An email address to be optionally pre-filled into the dialog
 * @param {String} password A password to be optionally pre-filled into the dialog
 */
function showLoginDialog(email, password) {
    'use strict';
    var $dialog = $('.pro-login-dialog');
    var $inputs = $('input', $dialog);
    var $button = $('.top-dialog-login-button', $dialog);
    $('aside', $dialog).addClass('hidden');

    var closeLoginDialog = function() {
        $('.fm-dialog-overlay').unbind('click.proDialog');
        $('button.js-close', $dialog).unbind('click.proDialog');

        closeDialog();

        return false;
    };

    M.safeShowDialog('pro-login-dialog', function() {

        // Init inputs events
        accountinputs.init($dialog);

        // controls
        const onLowTierProPg = page === 'pro' && window.mProTab;
        if (onLowTierProPg) {
            $('button.js-close', $dialog).addClass('hidden');
        }
        else {
            $('button.js-close', $dialog).rebind('click.proDialog', closeLoginDialog);
            $('.fm-dialog-overlay').rebind('click.proDialog', closeLoginDialog);
        }

        $('.input-email', $dialog).val(email || '');
        $('.input-password', $dialog).val(password || '');

        $('.top-login-forgot-pass', $dialog).rebind('click.forgetPass', function() {

            var email = document.getElementById('login-name3').value;

            if (isValidEmail(email)) {
                $.prefillEmail = email;
            }

            loadSubPage('recovery');
        });


        $inputs.rebind('keydown.loginreq', function(e) {
            if (e.keyCode === 13) {
                doProLogin($dialog);
            }
        });

        $button.rebind('click.loginreq', function() {
            doProLogin($dialog);
        });

        // eslint-disable-next-line sonarjs/no-identical-functions
        $button.rebind('keydown.loginreq', function(e) {
            if (e.keyCode === 13) {
                doProLogin($dialog);
            }
        });

        onIdle(clickURLs);
        return $dialog;
    });
}

var doProLogin = function($dialog) {

    loadingDialog.show();

    var $formWrapper = $dialog.find('form');
    var $emailInput = $dialog.find('input#login-name3');
    var $passwordInput = $dialog.find('input#login-password3');
    var $rememberMeCheckbox = $dialog.find('.login-check input');

    var email = $emailInput.val().trim();
    var password = $passwordInput.val();
    var rememberMe = $rememberMeCheckbox.is('.checkboxOn');  // ToDo check if correct
    var twoFactorPin = null;

    if (email === '' || !isValidEmail(email)) {
        $emailInput.megaInputsShowError(l[141]);
        $emailInput.val('').focus();
        loadingDialog.hide();

        return false;
    }
    else if (password === '') {
        $passwordInput.megaInputsShowError(l[1791]);
        loadingDialog.hide();

        return false;
    }

    // Checks if they have an old or new registration type, after this the flow will continue to login
    security.login.checkLoginMethod(email, password, twoFactorPin, rememberMe, startOldProLogin, startNewProLogin);
};

/**
 * Starts the old login proceedure
 * @param {String} email The user's email address
 * @param {String} password The user's password as entered
 * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if N/A
 * @param {Boolean} rememberMe Whether the user clicked the Remember me checkbox or not
 */
function startOldProLogin(email, password, pinCode, rememberMe) {
    'use strict';
    postLogin(email, password, pinCode, rememberMe).then(completeProLogin).catch(tell);
}

/**
 * Start the new login proceedure
 * @param {String} email The user's email addresss
 * @param {String} password The user's password as entered
 * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if N/A
 * @param {Boolean} rememberMe A boolean for if they checked the Remember Me checkbox on the login screen
 * @param {String} salt The user's salt as a Base64 URL encoded string
 */
function startNewProLogin(email, password, pinCode, rememberMe, salt) {

    'use strict';

    // Start the login using the new process
    security.login.startLogin(email, password, pinCode, rememberMe, salt, completeProLogin);
}

/**
 * Completes the login process
 * @param {Number} result The result from the API, e.g. a negative error num or the user type e.g. 3 for full user
 */
function completeProLogin(result) {
    'use strict';

    var $formWrapper = $('.pro-login-dialog form');
    var $emailField = $formWrapper.find('input#login-name3');
    var $passwordField = $formWrapper.find('input#login-password3');

    // Check and handle the common login errors
    if (security.login.checkForCommonErrors(result, startOldProLogin, startNewProLogin)) {
        return false;
    }

    // If successful result
    else if (result !== false && result >= 0) {

        $emailField.val('').blur();
        $passwordField.val('').blur();

        u_type = result;

        if (page === "chat") {
            var chatHash = getSitePath().replace("/chat/", "").split("#")[0];
            megaChat.loginOrRegisterBeforeJoining(chatHash);
        }
        else if (page === "pro" && window.mProTab) {
            closeDialog();

            if (u_attr.b || u_attr.pf) {
                // Load FM if user is a Business or Pro Flexi account (not allowed
                // to see pro page)
                loadSubPage('fm');
            }
            else {
                loadingDialog.show();

                // Update the pro page after login based on whether the user
                // is allowed to see the low tier section of the pro page
                pro.loadMembershipPlans(() => {
                    pro.updateLowTierProPage(!!pro.filter.miniMin);

                    loadingDialog.hide();
                });
            }
        }
        else if (page.startsWith('propay_')) {
            closeDialog();
            pro.propay.init();
        }
        else {
            // Find the plan they clicked on in /pro before the login/register prompt popped up
            const proNum = (pro.proplan2.selectedPlan || $('.pricing-page.plan.selected').data('payment')) | 0;

            loadingDialog.show();

            // Load the Pro payment page (step 2) if the plan that the user is attempting
            // to purchase has enough storage quota for their currently stored data.
            M.getStorageQuota().then((storage) => {
                closeDialog();
                checkPlanStorage(storage.used, proNum).then((res) => {
                    loadingDialog.hide();
                    if (res) {
                        loadSubPage(`propay_${proNum}`);
                    }
                    else {
                        msgDialog('warninga', l[135],
                                  l.warn_head_not_enough_storage, l.warn_body_not_enough_storage, () => {
                                      loadSubPage('pro');
                                      pro.proplan2.initPage();
                                  });
                    }
                });
            });
        }
    }
    else {
        fm_showoverlay();
        $emailField.megaInputsShowError();
        $passwordField.megaInputsShowError(l[7431]);

        var $inputs = $emailField.add($passwordField);

        $inputs.rebind('input.hideBothError', function() {

            $emailField.megaInputsHideError();
            $passwordField.megaInputsHideError();

            $inputs.off('input.hideBothError');
        });
    }
}

async function checkPlanStorage(currentStored, planNum) {
    'use strict';

    // If the user is purchasing a Pro Flexi account, they will be able to get extra storage
    if (planNum === pro.ACCOUNT_LEVEL_PRO_FLEXI) {
        return true;
    }
    return pro.loadMembershipPlans().then(() => {
        const plan = pro.membershipPlans.find(plan => {
            return plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] === planNum;
        });
        if (!plan) {
            return false;
        }
        return plan[pro.UTQA_RES_INDEX_STORAGE] * 1024 * 1024 * 1024 >= currentStored;
    });
}

function showRegisterDialog(aPromise) {
    'use strict';

    mega.ui.showRegisterDialog({
        title: l[5840],

        onLoginAttemptFailed: function(registerData) {
            msgDialog('warninga:' + l[171], l[1578], l[218], null, function(e) {
                if (e) {
                    $('.pro-register-dialog').addClass('hidden');
                    if (signupPromptDialog) {
                        signupPromptDialog.hide();
                    }
                    showLoginDialog(registerData.email);
                }
            });
        },

        onAccountCreated: function(gotLoggedIn, registerData) {
            // If true this means they do not need to confirm their email before continuing to step 2
            var skipConfirmationStep = true;

            if (skipConfirmationStep) {
                closeDialog();
                if (!gotLoggedIn) {
                    security.register.cacheRegistrationData(registerData);
                }

                if (page.startsWith('propay_')) {
                    pro.propay.init();
                    return;
                }

                // Find the plan they clicked on in /pro before the login/register prompt popped up
                var proNum = pro.proplan2.selectedPlan || $('.pricing-page.plan.selected').data('payment');

                // Load the Pro payment page (step 2) now that the account has been created
                loadSubPage('propay_' + proNum);
            }
            else {
                $('.mega-dialog.registration-page-success').removeClass('hidden');
                fm_showoverlay();
            }
        }
    }, aPromise);
}

// Flag to check if (not logged in) user has clicked Login / Register when selecting a pricing plan
var attemptingLoginOrRegister = false;

var signupPromptDialog = null;
var showSignupPromptDialog = function() {

    const onLowTierProPg = page === 'pro' && window.mProTab;

    // If on mobile, show the mobile version
    if (is_mobile) {
        // Set login_next to send the user to the low tier pro page once logged in
        if (onLowTierProPg) {
            login_next = 'pro';
        }
        mobile.proSignupPrompt.init();
        return;
    }

    if (!signupPromptDialog) {
        signupPromptDialog = new mega.ui.Dialog({
            'className': 'loginrequired-dialog',
            'closable': !onLowTierProPg,
            'closableByOverlay': !onLowTierProPg,
            'focusable': false,
            'expandable': false,
            'requiresOverlay': true,
            'title': onLowTierProPg ? l[1768] : l[5841],
            'buttons': []
        });
        signupPromptDialog.rebind('onBeforeShow', function() {

            this.$dialog.addClass('with-close-btn');
            // custom buttons, because of the styling
            $('header p', this.$dialog)
                .safeHTML('@@', onLowTierProPg ? l.log_in_to_continue : l[5842]);

            $('.pro-login', this.$dialog)
                .rebind('click.loginrequired', function() {
                    delay('logindlg.login', eventlog.bind(null, 99859));
                    attemptingLoginOrRegister = true;
                    signupPromptDialog.hide();
                    showLoginDialog();
                    return false;
                });

            if (onLowTierProPg) {
                $('.pro-register', this.$dialog).addClass('hidden');
            }
            else {
                $('.pro-register', this.$dialog)
                    .rebind('click.loginrequired', () => {
                        delay('logindlg.register', eventlog.bind(null, 99860));
                        attemptingLoginOrRegister = true;
                        signupPromptDialog.hide();

                        if (u_wasloggedin()) {
                            var msg = l[8743];
                            msgDialog('confirmation', l[1193], msg, null, res => {
                                if (res) {
                                    showRegisterDialog();
                                }
                                else {
                                    showLoginDialog();
                                }
                            });
                        }
                        else {
                            showRegisterDialog();
                        }
                        return false;
                    });
            }

            var $selectedPlan = $('.pricing-page.plan.selected', 'body');

            this.$dialog.addClass(`pro${$selectedPlan.data('payment')}`);
        });

        signupPromptDialog.rebind('onHide', function() {

            // If login/register was pressed, do not trigger a close event
            if (!attemptingLoginOrRegister) {
                delay('logindlg.close', eventlog.bind(null, 99861));
            }

            this.$dialog.removeClass('with-close-btn');

            // Set default icon
            this.$dialog.removeClass('pro1 pro2 pro3 pro4');
        });
    }

    attemptingLoginOrRegister = false;
    signupPromptDialog.show();
};

lazy(pro, 'proplan2', () => {
    'use strict';

    let $page;
    let $planCards;
    let $exclusivePlans;
    let $businessPlans;
    let $usersBusinessSlider;
    let $usersBusinessInput;
    let $strgBusinessSlider;
    let $strgBusinessInput;
    let $trsBusinessSlider;
    let $trsBusinessInput;
    let $totalPriceVal;
    let $totalPriceCurr;
    let $proflexiBlock;
    let $compareBox;
    let $totalFlexPriceVal;
    let $totalFlexPriceCurr;

    let ProFlexiFound = false;

    const getCurrentTab = () => {
        return window.mProTab === 'exc'
            ? 'pr-exc-offer-tab'
            : sessionStorage['pro.pricingTab'] || 'pr-individual-tab';
    };

    let currentTab = getCurrentTab();

    // Ensure that this is a boolean, as it will be used for toggleClass
    let showExclusiveOffers = false;

    const updateFeaturesTable = (excOfferTabSelected) => {
        const $tableContainer = $('.pricing-pg.pricing-plans-compare-table-container', $page);
        const $miniPlansHeader = $('.plans-table-header.pro-exc-offer', $tableContainer);

        // Add/remove classes as appropriate
        $('.pricing-plans-compare-table', $tableContainer).toggleClass('mini-plans', excOfferTabSelected);
        $('.pricing-plans-compare-table-item.pro-flexi:not(.no-ads)', $tableContainer)
            .toggleClass('hidden', excOfferTabSelected);
        $('.pricing-plans-compare-table-item.pro-business:not(.no-ads)', $tableContainer)
            .toggleClass('hidden', excOfferTabSelected);
        $('.pricing-plans-compare-table-item.pro-exc-offer:not(.no-ads)', $tableContainer)
            .toggleClass('hidden', !excOfferTabSelected);
        $('.plans-table-header.pro-flexi, .plans-table-header.pro-business', $tableContainer)
            .toggleClass('hidden', excOfferTabSelected);
        $miniPlansHeader.toggleClass('hidden', !excOfferTabSelected);
        $('.pricing-plans-compare-table-item.pro', $tableContainer).toggleClass('rb', !excOfferTabSelected);
        $('button.experiment-button.pro', $tableContainer).toggleClass('primary', !excOfferTabSelected);
        $('button.experiment-button.pro-exc-offer', $tableContainer).toggleClass('primary', excOfferTabSelected);

        // Update Pro plans table column heading as appropriate
        $('.plans-table-header.pro-plans span', $tableContainer).text(
            excOfferTabSelected ? l.pr_pro_plans : l.pr_pro_i_to_iii
        );
    };

    const initTabHandlers = () => {

        const $tableContainer = $('.pricing-pg.pricing-plans-compare-table-container', $page);
        const $tabs = $('.individual-team-tab-container .tabs-module-block', $page);

        const proDivsSelector = '.pricing-pg.pick-period-container:not(.exclusive-plans-container), ' +
            '.pricing-pg.pro-plans-cards-container, ' +
            '.pricing-pg.pricing-estimation-note-container';
        const proDivsFree = '.pricing-pg.pricing-banner-container';
        const $proPlans = $(proDivsSelector, $page);
        const $freeBanner = $(proDivsFree, $page);

        const $footerBanner = $('.pricing-pg.pricing-get-started-container', $page);
        const $footerTitle = $('.pricing-get-started-txt', $footerBanner);
        const $footerSubTitle = $('.pricing-get-started-subtxt', $footerBanner);
        const $footerBtn = $('#tryMega', $footerBanner);

        const $excPlansNotPeriod = $('.exclusive-plans-container:not(.pick-period-container)', $page);

        const setFooterBannerTxt = (title, subTitle, btnTxt) => {
            $footerTitle.text(title);
            $footerSubTitle.toggleClass('hidden', subTitle.length < 1).text(subTitle);
            $footerBtn.text(btnTxt);
        };

        const changeIndividualTeamTab = (target) => {
            $tabs.removeClass('selected');
            target.classList.add('selected');

            let isIndividual = target.id === 'pr-individual-tab';
            const isBusinessTab = target.id === 'pr-business-tab';
            let isExcOfferTab = target.id === 'pr-exc-offer-tab';

            if (!showExclusiveOffers && isExcOfferTab) {
                isExcOfferTab = false;
                isIndividual = true;
            }

            if (showExclusiveOffers) {
                updateFeaturesTable(isExcOfferTab);
            }

            $proPlans.addClass('hidden');
            $businessPlans.addClass('hidden');
            $exclusivePlans.addClass('hidden');
            $page.removeClass('business individual exc-offer');

            if ($businessPlans && isBusinessTab) {
                $businessPlans.removeClass('hidden');
                $page.addClass('business');
            }
            else if (isExcOfferTab) {
                if (pro.filter.plans.excPlansM.length === pro.filter.plans.excPlansY.length) {
                    $exclusivePlans.removeClass('hidden');
                }
                else {
                    $excPlansNotPeriod.removeClass('hidden');
                }
                $page.addClass('exc-offer');
            }
            else {
                $proPlans.removeClass('hidden');
                $page.addClass('individual');
            }

            $('.pricing-pg.pricing-estimation-note-container', $page).toggleClass('business', isBusinessTab);

            $freeBanner.toggleClass(
                'hidden',
                !isIndividual || (typeof u_handle !== 'undefined' && !localStorage.keycomplete)
            );

            if (isIndividual) {
                setFooterBannerTxt(l.pr_get_started_now, '', l.pr_try_mega);
            }
            else {
                setFooterBannerTxt(l.pr_business_started, l.pr_easily_add, l[24549]);
            }
        };

        $tabs.rebind('click.pricing', function() {
            changeIndividualTeamTab(this);

            currentTab = this.id;
            sessionStorage['pro.pricingTab'] = this.id;

            if (this.id === 'pr-individual-tab') {
                delay('pricing.plan', eventlog.bind(null, is_mobile ? 99863 : 99862));
            }
            else if (this.id === 'pr-business-tab') {
                delay('pricing.business', eventlog.bind(null, is_mobile ? 99865 : 99864));
            }
            else {
                delay('pricing.exc-offer', eventlog.bind(null, is_mobile ? 500248 : 500247));
            }
        });

        const idShift = is_mobile ? 0 : 1;

        $('button.free', $tableContainer).rebind('click', () => {
            loadSubPage('register');
            delay('pricing.free' + 99880, eventlog.bind(null, 99880 + idShift));
        });
        $('button.pro', $tableContainer).rebind('click', () => {
            changeIndividualTeamTab($('.individual-team-tab-container #pr-individual-tab', $page)[0]);
            $('.pricing-pg.pro-plans-cards-container', $page)[0].scrollIntoView({behavior: 'smooth'});
            delay('pricing.pro' + 99882, eventlog.bind(null, 99882 + idShift));
        });
        $('button.pro-flexi', $tableContainer).rebind('click', () => {
            $('.pricing-pg.pricing-flexi-container', $page)[0].scrollIntoView({behavior: 'smooth'});
            delay('pricing.pro-flexi' + 99884, eventlog.bind(null, 99884 + idShift));
        });
        $('button.pro-business', $tableContainer).rebind('click', () => {
            changeIndividualTeamTab($('.individual-team-tab-container #pr-business-tab', $page)[0]);
            $('.pricing-pg.pricing-business-plan-container', $page)[0].scrollIntoView({behavior: 'smooth'});
            delay('pricing.pro-business' + 99886, eventlog.bind(null, is_mobile ? 99886 : 99904));
        });

        currentTab = getCurrentTab();
        if (!showExclusiveOffers && currentTab === 'pr-exc-offer-tab') {
            currentTab = 'pr-individual-tab';
        }
        changeIndividualTeamTab($(`#${currentTab}`, $page)[0]);

        // Update the savedTab so that it will be set correctly when visited via /pro?tab=XXX
        sessionStorage['pro.pricingTab'] = currentTab;

        if (u_handle) {
            delete window.mProTab;
        }
    };

    const initPlansTabs = () => {
        const $tableContainer = $('.pricing-pg.pricing-plans-compare-table-container', $page);
        const $showBtn = $('.pricing-plans-compare-table-show', $tableContainer);
        const $dataTable = $('.pricing-plans-compare-table', $tableContainer);
        const $arrowIcon = $('i.chevron-down-icon', $showBtn);
        const $showBtnTxt = $('.pricing-plans-compare-table-txt', $showBtn);
        const $buttons = $('.pricing-plans-compare-table-item button', $tableContainer);
        const $buttonsNotFree = $('.pricing-plans-compare-table-item button:not(.free)', $tableContainer);

        $('.pricing-plans-compare-table-item button', $tableContainer).addClass('hidden');

        if (u_attr && !is_mobile) {
            $buttonsNotFree.removeClass('hidden');
        }
        else if (!is_mobile) {
            $buttons.removeClass('hidden');
        }

        $showBtn.rebind('click.pricing', () => {
            eventlog(is_mobile ? 99888 : 99887);
            $dataTable.toggleClass('hidden');
            $arrowIcon.toggleClass('inv');

            let btnTxt = l.pr_show_plan;
            if ($arrowIcon.hasClass('inv')) {
                btnTxt = l.pr_hide_plan;
            }

            $showBtnTxt.text(btnTxt);

            return false;
        });
        $('.no-ads', $tableContainer).toggleClass('hidden', !(mega.flags.ab_ads));

        // set 20GB text for the storage value in the comparison table.
        $('#table-strg-v', $tableContainer).text(bytesToSize(20 * 1073741824, 0));

        // Set 100 for the maximum number of participants in a free tier meeting.
        $('#meet-up-to-participants', $tableContainer).text(l.pr_meet_up_to_participants.replace('%1', 100));

        // Set 1 hour for the maximum duration of a free tier meeting.
        $('#meet-up-to-duration', $tableContainer).text(mega.icu.format(l.pr_meet_up_to_duration, 1));
    };

    const moveToBuyStep = (planId) => {
        pro.proplan2.selectedPlan = planId;

        if (!u_handle) {
            showSignupPromptDialog();
            return false;
        }
        // If they're ephemeral but awaiting email confirmation,
        // let them continue to choose a plan and pay
        else if (isEphemeral() && !localStorage.awaitingConfirmationAccount) {
            showRegisterDialog();
            return false;
        }

        // If they clicked the plan immediately after completing registration,
        // set the flag so it can be logged
        if (localStorage.keycomplete) {
            pro.propay.planChosenAfterRegistration = true;
        }

        loadSubPage('propay_' + planId);
    };

    const initBuyPlan = ($givenPlans) => {
        const $buyBtn = $('.pricing-plan-btn', $givenPlans || $([...$planCards, ...$exclusivePlans]));
        const $freeBtns = $('#freeStart, #tryMega', $page);

        $buyBtn.rebind('click.pricing', function() {

            const selectedCard = this.closest('.pricing-plan-card');
            if (!selectedCard || selectedCard.classList.contains('disabled')) {
                return false;
            }

            const selectedID = selectedCard.id;

            if (selectedID) {

                const planId = selectedID.replace('pro', '') | 0;

                if (planId) {
                    if (is_mobile) {
                        delay('pricing.plan-mobile', eventlog.bind(null, 99869 + planId));
                    }
                    delay('pricing.plan', eventlog.bind(null, 99779 + planId));

                    moveToBuyStep(planId);
                }

            }
            return false;
        });

        $freeBtns.rebind('click.pricing', function() {
            const logId = this.id === 'tryMega' ? 99785 : 99784;

            localStorage.removeItem('keycomplete');

            delay('pricing.plan', eventlog.bind(null, logId));

            if (!window.u_handle) {

                const destination = this.id === 'tryMega' && this.textContent === l[24549]
                    ? 'registerb' : 'register';

                loadSubPage(destination);

                return false;
            }

            loadSubPage('fm');

            if (localStorage.gotOverquotaWithAchievements) {
                onIdle(() => {
                    mega.achievem.achievementsListDialog();
                });
                delete localStorage.gotOverquotaWithAchievements;
            }

            return false;

        });
    };

    const estimateBussPrice = (users = 3, storage = 3, transfer = 3) => {
        const minUser = 3;
        const minStroage = 3; // 3 TB
        const minTransfer = 3; // 3 TB

        users = Math.max(minUser, users);
        storage = Math.max(minStroage, storage);
        transfer = Math.max(minTransfer, transfer);

        const extraStorage = storage - minStroage;
        let extraTransfer = transfer - minTransfer;

        if (extraTransfer > extraStorage) {
            extraTransfer -= extraStorage;
        }
        else {
            extraTransfer = 0;
        }

        let totalPrice;
        let currency = 'EUR';

        if (pro.proplan.businessPlanData.isLocalInfoValid) {
            currency = pro.proplan.businessPlanData.l.lc;
            const totalUsersCost = pro.proplan.businessPlanData.bd.us.lp * users;
            const totalStorageCost = pro.proplan.businessPlanData.bd.sto.lp * extraStorage;
            const totalTransferCost = pro.proplan.businessPlanData.bd.trns.lp * extraTransfer;

            totalPrice = formatCurrency(
                totalUsersCost + totalStorageCost + totalTransferCost,
                currency,
                'narrowSymbol'
            );
        }
        else {
            const totalUsersCost = pro.proplan.businessPlanData.bd.us.p * users;
            const totalStorageCost = pro.proplan.businessPlanData.bd.sto.p * extraStorage;
            const totalTransferCost = pro.proplan.businessPlanData.bd.trns.p * extraTransfer;

            totalPrice = formatCurrency(totalUsersCost + totalStorageCost + totalTransferCost);
        }

        $totalPriceVal.text(totalPrice);
        $totalPriceCurr.text(`${currency} / ${l[931]}`);
    };

    const estimateFlexiPrice = (storage = 3, transfer = 3) => {

        if (!ProFlexiFound) {
            $proflexiBlock.addClass('hidden');
            return;
        }

        const minStroage = 3; // 3 TB
        const minTransfer = 3; // 3 TB

        storage = Math.max(minStroage, storage);
        transfer = Math.max(minTransfer, transfer);

        const extraStorage = storage - minStroage;
        let extraTransfer = transfer - minTransfer;

        // Extra transfer is not charged if it's lower than extra storage.
        if (extraTransfer <= extraStorage) {
            extraTransfer = 0;
        }
        else {
            extraTransfer -= extraStorage;
        }

        let totalPrice;
        let currency = 'EUR';
        // if we have local price info for extra storage/transfer and currency
        if (ProFlexiFound[13] && ProFlexiFound[15] && ProFlexiFound[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY]
            && ProFlexiFound[pro.UTQA_RES_INDEX_LOCALPRICE]) {
            currency = ProFlexiFound[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];

            const totalStorageCost = ProFlexiFound[13] * extraStorage;
            const totalTransferCost = ProFlexiFound[15] * extraTransfer;

            totalPrice = formatCurrency(
                totalStorageCost + totalTransferCost + ProFlexiFound[pro.UTQA_RES_INDEX_LOCALPRICE],
                currency,
                'narrowSymbol'
            );
        }
        else {
            const totalStorageCost = ProFlexiFound[12] * extraStorage;
            const totalTransferCost = ProFlexiFound[14] * extraTransfer;

            totalPrice = formatCurrency(
                totalStorageCost
                + totalTransferCost
                + ProFlexiFound[pro.UTQA_RES_INDEX_MONTHLYBASEPRICE]
            );
        }

        $totalFlexPriceVal.text(totalPrice);
        $totalFlexPriceCurr.text(`${currency} / ${l[931]}`);

    };

    /**
     * Handler to init all sliders : Business, Flexi, Competitors
     * */
    const initSlidersEvents = () => {

        const $flexStorageSlider = $('#storage-flex-slider', $proflexiBlock);
        const $flexTransSlider = $('#trans-flex-slider', $proflexiBlock);
        const $strgFlexInput = $('#esti-storage', $proflexiBlock);
        const $transFlexInput = $('#esti-trans', $proflexiBlock);

        // ordered array for ranges: [range-start,range-end,min,max]
        const symmetricRanges = [
            [0, 32, 3, 75],
            [33, 66, 76, 150],
            [67, 100, 151, 300]
        ];
        const asymmetricRanges = [
            [0, 50, 3, 100],
            [51, 75, 101, 1000],
            [76, 100, 1001, 10000]
        ];

        const sliderEventHandler = (slider, ranges, $inputTxt) => {
            let val = slider.value;

            if (slider.max && slider.max !== 100) {
                val = (val / slider.max) * 100;
            }

            let direction = 'to right';

            if ($('body').hasClass('rtl')) {
                direction = 'to left';
            }

            const styleVal = `linear-gradient(${direction}, var(--color-secondary-cobalt-900) ${val}%,`
                + `var(--color-grey-150) ${val}% 100%)`;

            slider.style.background = styleVal;

            if ($inputTxt) {
                // get val range. maintain the order is important to minimize complexity
                for (const range of ranges) {
                    if (val <= range[1]) {
                        const area = range[1] - range[0];
                        const top = range[3] - range[2];
                        const pointer = val - range[0];
                        // area  top
                        // val   x ==> x = top*val/area
                        const newVal = ((top * pointer) / area) + range[2];
                        $inputTxt.val(Math.round(newVal));
                        break;
                    }
                }
            }

        };

        sliderEventHandler($usersBusinessSlider[0]);
        sliderEventHandler($strgBusinessSlider[0]);
        sliderEventHandler($trsBusinessSlider[0]);
        sliderEventHandler($flexStorageSlider[0]);
        sliderEventHandler($flexTransSlider[0]);


        $usersBusinessSlider.rebind('input.pricing', function() {
            sliderEventHandler(this, symmetricRanges, $usersBusinessInput);
            estimateBussPrice($usersBusinessInput.val(), $strgBusinessInput.val(), $trsBusinessInput.val());
        });

        $strgBusinessSlider.rebind('input.pricing', function() {
            sliderEventHandler(this, asymmetricRanges, $strgBusinessInput);
            estimateBussPrice($usersBusinessInput.val(), $strgBusinessInput.val(), $trsBusinessInput.val());
        });

        $trsBusinessSlider.rebind('input.pricing', function() {
            sliderEventHandler(this, asymmetricRanges, $trsBusinessInput);
            estimateBussPrice($usersBusinessInput.val(), $strgBusinessInput.val(), $trsBusinessInput.val());
        });

        $flexStorageSlider.rebind('input.pricing', function() {
            sliderEventHandler(this, asymmetricRanges, $strgFlexInput);
            estimateFlexiPrice($strgFlexInput.val(), $transFlexInput.val());
        });

        $flexTransSlider.rebind('input.pricing', function() {
            sliderEventHandler(this, asymmetricRanges, $transFlexInput);
            estimateFlexiPrice($strgFlexInput.val(), $transFlexInput.val());
        });

        const fromValueToRange = (ranges, val) => {
            for (const range of ranges) {
                if (val <= range[3]) {
                    const area = range[1] - range[0];
                    const top = range[3] - range[2];
                    const pointer = val - range[2];

                    return ((area * pointer) / top) + range[0];
                }
            }
        };

        $usersBusinessInput.rebind('change.pricing', function() {
            const min = this.getAttribute('min') | 0;
            this.value = Math.max(Math.min(Math.round(this.value), 300), min);

            const newRange = fromValueToRange(symmetricRanges, this.value);

            $usersBusinessSlider.val(newRange);
            sliderEventHandler($usersBusinessSlider[0]);
            estimateBussPrice($usersBusinessInput.val(), $strgBusinessInput.val(), $trsBusinessInput.val());
        });

        $strgBusinessInput.rebind('change.pricing', function() {
            const min = this.getAttribute('min') | 0;
            this.value = Math.max(Math.min(Math.round(this.value), 10000), min);

            const newRange = fromValueToRange(asymmetricRanges, this.value);

            $strgBusinessSlider.val(newRange);
            sliderEventHandler($strgBusinessSlider[0]);
            estimateBussPrice($usersBusinessInput.val(), $strgBusinessInput.val(), $trsBusinessInput.val());
        });

        $trsBusinessInput.rebind('change.pricing', function() {
            const min = this.getAttribute('min') | 0;
            this.value = Math.max(Math.min(Math.round(this.value), 10000), min);

            const newRange = fromValueToRange(asymmetricRanges, this.value);

            $trsBusinessSlider.val(newRange);
            sliderEventHandler($trsBusinessSlider[0]);
            estimateBussPrice($usersBusinessInput.val(), $strgBusinessInput.val(), $trsBusinessInput.val());
        });

        $strgFlexInput.rebind('change.pricing', function() {
            const min = this.getAttribute('min') | 0;
            this.value = Math.max(Math.min(Math.round(this.value), 10000), min);

            const newRange = fromValueToRange(asymmetricRanges, this.value);

            $flexStorageSlider.val(newRange);
            sliderEventHandler($flexStorageSlider[0]);
            estimateFlexiPrice($strgFlexInput.val(), $transFlexInput.val());
        });

        $transFlexInput.rebind('change.pricing', function() {
            const min = this.getAttribute('min') | 0;
            this.value = Math.max(Math.min(Math.round(this.value), 10000), min);

            const newRange = fromValueToRange(asymmetricRanges, this.value);

            $flexTransSlider.val(newRange);
            sliderEventHandler($flexTransSlider[0]);
            estimateFlexiPrice($strgFlexInput.val(), $transFlexInput.val());
        });

        estimateFlexiPrice($strgFlexInput.val(), $transFlexInput.val());

    };

    const initSocial = () => {
        const quotes = {
            'advisor': [l.bsn_feedback_quote3, 'TECH ADVISOR'],
            'radar': [l.bsn_feedback_quote4, 'techradar'],
            'cloudwards': [l.bsn_feedback_quote1, 'Cloudwards'],
            'privacy': [l.bsn_feedback_quote2, 'ProPrivacy'],
            'toms': [l.bsn_feedback_quote5, 'tom\'s guide']
        };

        const $socialContainer = $('.pricing-pg.pricing-social-container', $page);
        const $socialIconsContainer = $('.pricing-social-refs-container', $socialContainer);
        const $socialIcons = $('i.q-logo', $socialIconsContainer);
        const $socialText = $('.pricing-social-quote', $socialContainer);
        const $socialName = $('.pricing-social-quote-name', $socialContainer);

        let rotatingTimer;

        const rotatingQuotes = () => {
            if (page !== 'pro') {
                clearInterval(rotatingTimer);
                return;
            }

            for (let i = 0; i < $socialIcons.length; i++) {

                if ($socialIcons[i].classList.contains('active')) {

                    const nextIcon = i + 1 >= $socialIcons.length ? 0 : i + 1;

                    $($socialIcons[nextIcon]).trigger('click.pricing');
                    return;
                }
            }
        };

        $socialIcons.rebind('click.pricing', function() {

            clearInterval(rotatingTimer);

            $socialIcons.removeClass('active');
            this.classList.add('active');
            $socialText.text(quotes[this.dataset.quoter][0]);
            $socialName.text(quotes[this.dataset.quoter][1]);

            if ($socialIconsContainer[0].scrollWidth > $socialIconsContainer[0].clientWidth) {
                $socialIconsContainer[0].scroll(this.offsetLeft - $socialIconsContainer[0].offsetLeft, 0);
            }

            rotatingTimer = setInterval(rotatingQuotes, 9000);
        });

        rotatingTimer = setInterval(rotatingQuotes, 9000);

    };

    const initFaq = () => {

        const $faqContainer = $('.pricing-pg.faq-container', $page).removeClass('hidden');
        const $faqItemTemplate = $('.faq-qa.template', $faqContainer);
        const $faqContent = $('.faq-content', $faqContainer);

        const faqQuestions = {
            'faq1': {
                question: l.pricing_page_faq_question_1,
                answer: [l.pricing_page_faq_answer_1]
            },
            'faq2': {
                question: l.pricing_page_faq_question_2,
                answer: [l.pricing_page_faq_answer_2]
            },
            'faq3': {
                question: l.pricing_page_faq_question_3,
                answer: [l.pricing_page_faq_answer_3]
            },
            'faq4': {
                question: l.pricing_page_faq_question_4,
                answer: [l.pricing_page_faq_answer_4, l.pricing_page_faq_answer_4_2]
            },
            'faq5': {
                question: l.pricing_page_faq_question_5,
                answer: [l.pricing_page_faq_answer_5]
            },
            'faq6': {
                question: l.pricing_page_faq_question_6,
                answer: [l.pricing_page_faq_answer_6, l.pricing_page_faq_answer_6_2]
            },
        };

        const $answerPartTemplate = $('.faq-answer-part', $faqItemTemplate).clone();

        for (const faq in faqQuestions) {
            const $faqItem = $faqItemTemplate.clone().removeClass('template hidden').addClass(faq);
            $('.faq-question', $faqItem).text(faqQuestions[faq].question);
            for (let i = 0; i < faqQuestions[faq].answer.length; i++) {
                const $answerPart = $answerPartTemplate.clone().safeHTML(faqQuestions[faq].answer[i]);
                $('.faq-item-answer', $faqItem).safeAppend($answerPart.prop('outerHTML'));
            }

            $faqContent.safeAppend($faqItem.prop('outerHTML'));

            const $qaRebind = $(`.${faq}`, $faqContent);
            $('.faq-item-title', $qaRebind).rebind('click.pricing', () => {
                if (window.getSelection()) {
                    window.getSelection().removeAllRanges();
                }
                $('.faq-item-answer', $qaRebind).toggleClass('hidden');
                $('.faq-item-title i', $qaRebind).toggleClass(['minus-icon', 'grey-medium-plus', 'small-icon']);
            });
        }
        $('.faq1 .faq-question', $faqContent).click();
    };

    const initCompare = () => {

        $compareBox = $('.pricing-pg.pricing-compare-full-container', $page).removeClass('hidden');

        const $compareMEGABox = $('.pricing-compare-cards.mega', $compareBox);
        const $compareDPBox = $('.pricing-compare-cards.dp', $compareBox);
        const $compareGDBox = $('.pricing-compare-cards.gd', $compareBox);
        const $compareMEGA = $('.pricing-compare-cards-rate .vl', $compareMEGABox);
        const $compareDP = $('.pricing-compare-cards-rate .vl', $compareDPBox);
        const $compareGD = $('.pricing-compare-cards-rate .vl', $compareGDBox);

        $compareMEGA.text(formatCurrency(1.56));
        $compareDP.text(formatCurrency(5.50));
        $compareGD.text(formatCurrency(3.70));
    };

    const initProFlexi = () => {

        if (!ProFlexiFound) {
            $proflexiBlock.addClass('hidden');
            return;
        }

        const $proFlexCard = $('.pricing-plan-card', $proflexiBlock);

        $totalFlexPriceVal = $('.pricing-flexi-block-estimator-total-nb .vl', $proflexiBlock);
        $totalFlexPriceCurr = $('.pricing-flexi-block-estimator-total-unit', $proflexiBlock);

        const planNum = ProFlexiFound[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];
        const planName = pro.getProPlanName(planNum);


        $('.pricing-plan-title', $proFlexCard).text(planName);

        let flexiPrice;
        let flexiCurrency;
        let extraPrice;
        let hasLocalPrices = false;

        // if we have local prices info provided
        if (ProFlexiFound[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY] && ProFlexiFound[pro.UTQA_RES_INDEX_LOCALPRICE]) {
            flexiPrice = ProFlexiFound[pro.UTQA_RES_INDEX_LOCALPRICE];
            flexiCurrency = ProFlexiFound[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];
        }
        else {
            flexiPrice = ProFlexiFound[pro.UTQA_RES_INDEX_PRICE];
            flexiCurrency = 'EUR';
        }

        $('.pricing-plan-price span.vl', $proFlexCard).text(formatCurrency(flexiPrice, flexiCurrency, 'narrowSymbol'));
        $('.pricing-plan-price-unit', $proFlexCard).text(`${flexiCurrency} / ${l[931]}`);

        const baseStorage = ProFlexiFound[pro.UTQA_RES_INDEX_STORAGE] / 1024;

        $('.pricing-plan-storage', $proFlexCard)
            .text(l.bsn_base_stg_trs.replace('%1', baseStorage));

        // if we have local price info for extra storage
        if (ProFlexiFound[13]) {
            extraPrice = formatCurrency(ProFlexiFound[13], flexiCurrency, 'narrowSymbol');
            hasLocalPrices = true;
        }
        else {
            extraPrice = formatCurrency(ProFlexiFound[12]);
        }

        if (flexiCurrency === 'EUR') {
            $('.pricing-plan-trasfer .ex-desc', $proFlexCard)
                .text(l.pr_flexi_extra.replace('%1', extraPrice));
        }
        else {
            $('.pricing-plan-trasfer .ex-desc', $proFlexCard)
                .text(l.bsn_add_base_stg_trs.replace('%1', extraPrice));
        }

        const $buyBtn = $('.pricing-plan-btn', $proFlexCard)
            .text(l.buy_plan.replace('%1', planName));

        // hide/show the asterisk and the note depending on local prices availability
        $('.ars', $proflexiBlock).toggleClass('hidden', !hasLocalPrices);
        $('.pricing-flexi-block-card-note, .pricing-flexi-block-card-note-s', $proflexiBlock)
            .toggleClass('hidden', !hasLocalPrices);

        $buyBtn.rebind('click.pricing', () => {
            moveToBuyStep(planNum);
        });

    };

    const fillPlansInfo = (period) => {

        period = period || 12;

        if (!pro.membershipPlans.length) {
            console.error('Plans couldnt be loaded.');
            return;
        }

        const periodText = period === 12 ? l[932] : l[931];

        $planCards = $('.pricing-pg.pro-plans-cards-container .pricing-plan-card', $page);

        let localPriceInfo = false;
        ProFlexiFound = false;

        for (const currentPlan of pro.membershipPlans) {

            const months = currentPlan[pro.UTQA_RES_INDEX_MONTHS];
            const planNum = currentPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];

            // ProFlexiFound is used to see if we should show pro flexi
            if (planNum === pro.ACCOUNT_LEVEL_PRO_FLEXI) {
                ProFlexiFound = currentPlan;
                continue;
            }

            if (months !== period || planNum === pro.ACCOUNT_LEVEL_BUSINESS) {
                continue;
            }

            const planName = pro.getProPlanName(planNum);

            const $planCard = $planCards.filter(`#pro${planNum}`);
            $planCard.removeClass('hidden');

            let planPrice = currentPlan[pro.UTQA_RES_INDEX_PRICE];
            let priceCurrency = 'EUR';

            if (currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE]) {
                planPrice = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE];
                priceCurrency = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];
                if (!localPriceInfo) {
                    localPriceInfo = priceCurrency;
                }
            }

            const priceText = formatCurrency(planPrice, priceCurrency, 'narrowSymbol');

            $('.pricing-plan-price span.vl', $planCard).text(priceText);
            $('.pricing-plan-price-unit', $planCard).text(priceCurrency + ' / ' +  periodText);

            if (priceText) {
                $planCard.toggleClass('long-currency1', priceText.length >= 9 && priceText.length <= 12);
                $planCard.toggleClass('long-currency2', priceText.length >= 13 && priceText.length <= 16);
                $planCard.toggleClass('long-currency3', priceText.length >= 17);
            }

            // get the storage/bandwidth, then convert it to bytes (it comes in GB) to format.
            // 1073741824 = 1024 * 1024 * 1024
            const storageFormatted = bytesToSize(currentPlan[pro.UTQA_RES_INDEX_STORAGE] * 1073741824, 0);
            const storageTxt = l[23789].replace('%1', storageFormatted);

            const bandwidthFormatted = bytesToSize(currentPlan[pro.UTQA_RES_INDEX_TRANSFER] * 1073741824, 0);
            const bandwidthTxt = l[23790].replace('%1', bandwidthFormatted);

            $('.pricing-plan-storage', $planCard).text(storageTxt);

            const $storageBox = $('.pricing-plan-storage', $planCard);
            const $transferBox = $('.pricing-plan-trasfer', $planCard);
            const $transferSubBox = $('.pricing-plan-trasfer-val', $transferBox);

            if (storageTxt) {
                $storageBox.toggleClass('long-text', storageTxt.length >= 27 || bandwidthTxt.length >= 27);
                $transferBox.toggleClass('long-text', storageTxt.length >= 27 || bandwidthTxt.length >= 27);
            }

            if ($transferSubBox.length) {
                $transferSubBox.text(bandwidthTxt);
            }
            else {
                $transferBox.text(bandwidthTxt);
            }

            $('.pricing-plan-title', $planCard).text(planName);
            $('.pricing-plan-btn', $planCard).text(l.buy_plan.replace('%1', planName));
        }

        const $freeBanner = $('.pricing-pg.pricing-banner-container', $page);

        localPriceInfo = localPriceInfo || 'EUR';
        $('.pricing-get-free-banner-price-val', $freeBanner)
            .text(formatCurrency(0, localPriceInfo, 'narrowSymbol', true));

        $('.pricing-get-free-ads', $freeBanner).toggleClass('hidden', !(mega.flags.ab_ads));

        $proflexiBlock = $('.pricing-pg.pricing-flexi-container', $page);

        const showFlexi = ProFlexiFound && mega.flags && mega.flags.pf === 1;
        $('.pricing-plan-more', $planCards).toggleClass('hidden', !showFlexi);
        $proflexiBlock.toggleClass('hidden', !showFlexi);

        if (showFlexi) {

            $('#try-flexi', $planCards).rebind('click.pricing', () => {
                // behavior not supported in Safari.
                $proflexiBlock[0].scrollIntoView({ behavior: "smooth" });
            });

            initProFlexi();
        }

        // hide/show the asterisk and the note depending on local prices availability
        $('.ars', $planCards).toggleClass('hidden', localPriceInfo === 'EUR');
        $('.pricing-pg.pricing-estimation-note-container', $page).toggleClass('hidden eu', localPriceInfo === 'EUR');

    };

    const populateBusinessPlanData = () => {

        $businessPlans = $('.pricing-pg.pricing-business-plan-container', $page);

        const $businessCard = $('.pricing-plan-card', $businessPlans);

        $totalPriceVal = $('.pricing-flexi-block-estimator-total-nb .vl', $businessPlans);
        $totalPriceCurr = $('.pricing-flexi-block-estimator-total-unit', $businessPlans);

        $usersBusinessSlider = $('input#users-slider', $businessPlans);
        $usersBusinessInput = $('input#esti-user', $businessPlans);

        $strgBusinessSlider = $('input#storage-flex-slider-b', $businessPlans);
        $strgBusinessInput = $('input#esti-storage-b', $businessPlans);

        $trsBusinessSlider = $('input#trans-flex-slider-b', $businessPlans);
        $trsBusinessInput = $('input#esti-trans-b', $businessPlans);

        let pricePerUser = pro.proplan.businessPlanData.bd && pro.proplan.businessPlanData.bd.us
            && pro.proplan.businessPlanData.bd.us.p;
        let priceCurrency;
        let storagePrice;
        let hasLocalPrice = false;

        const minStorageValue = pro.proplan.businessPlanData.bd.ba.s / 1024;

        if (pro.proplan.businessPlanData.isLocalInfoValid) {

            priceCurrency = pro.proplan.businessPlanData.l.lc;

            pricePerUser = formatCurrency(pro.proplan.businessPlanData.bd.us.lp * 3, priceCurrency, 'narrowSymbol');
            storagePrice = formatCurrency(pro.proplan.businessPlanData.bd.sto.lp, priceCurrency, 'narrowSymbol');
            hasLocalPrice = true;
        }
        else {
            priceCurrency = 'EUR';
            pricePerUser = formatCurrency(pricePerUser * 3);
            storagePrice = formatCurrency(pro.proplan.businessPlanData.bd.sto.p);
        }

        $('.pricing-plan-price .vl', $businessCard).text(pricePerUser);
        $('.pricing-plan-price-unit', $businessCard).text(`${priceCurrency} / ${l[931]}`);
        $('.pricing-plan-storage .business-base', $businessCard)
            .text(l.bsn_base_stg_trs.replace('%1', minStorageValue));
        $('.pricing-plan-trasfer', $businessCard)
            .text(l.bsn_add_base_stg_trs.replace('%1', storagePrice)
                .replace('*', (hasLocalPrice ? '*' : '')));

        initSlidersEvents();
        estimateBussPrice($usersBusinessInput.val(), $strgBusinessInput.val(), $trsBusinessInput.val());

        // hide/show the asterisk and the note depending on local prices availability
        $('.ars', $businessPlans).toggleClass('hidden', !hasLocalPrice);
        $('.pricing-flexi-block-card-note, .pricing-flexi-block-card-note-s', $businessPlans)
            .toggleClass('hidden', !hasLocalPrice);

        // init buy-business button event handler
        $('#buyBusiness', $businessPlans).rebind('click.pricing', () => {

            // log the click event
            delay('pricing.plan', eventlog.bind(null, 99786));

            loadSubPage('registerb');

            return false;
        });

    };

    const fetchBusinessPlanInfo = async() => {

        if (pro.proplan.businessPlanData && pro.proplan.businessPlanData.length) {
            return populateBusinessPlanData();
        }

        await M.require('businessAcc_js');

        const business = new BusinessAccount();

        // eslint-disable-next-line complexity
        return business.getBusinessPlanInfo(false).then((info) => {

            pro.proplan.businessPlanData = info;

            // If all new API values exist
            pro.proplan.businessPlanData.isValidBillingData = info.bd && info.bd.us
                && (info.bd.us.p || info.bd.us.lp)
                && info.bd.sto && (info.bd.sto.p || info.bd.sto.lp)
                && info.bd.sto.s && info.bd.trns && (info.bd.trns.p || info.bd.trns.lp)
                && info.bd.trns.t && info.bd.ba.s && info.bd.ba.t;

            // If local currency values exist
            pro.proplan.businessPlanData.isLocalInfoValid = info.l && info.l.lcs && info.l.lc
                && info.bd.us.lp && info.bd.sto.lp && info.bd.trns.lp;
        });
    };

    const initPeriodPickHandler = () => {
        const $radioOptionsInd = $('.pricing-pg.pick-period-container.individual .pricing-radio-option', $page);
        const $radioOptionsExc = $('.pricing-pg.pick-period-container.exclusive-plans-container .pricing-radio-option'
            , $page);
        const $allRadioOptions = $([...$radioOptionsInd, ...$radioOptionsExc]);
        const $strgFlexInput = $('#esti-storage', $proflexiBlock);
        const $transFlexInput = $('#esti-trans', $proflexiBlock);

        const preSelectedPeriod = (sessionStorage.getItem('pro.period') | 0) || 12;
        const preSelectedPeriodExc = (sessionStorage.getItem('pro.periodExc') | 0) || 12;

        if (preSelectedPeriod === 12) {
            $radioOptionsInd.removeClass('selected');
            $radioOptionsInd.filter('[data-period="12"]').addClass('selected');
        }
        if (preSelectedPeriodExc === 12) {
            $radioOptionsExc.removeClass('selected');
            $radioOptionsExc.filter('[data-period="12"]').addClass('selected');
        }

        $allRadioOptions.rebind('click.pricing', function() {
            const $optionWrapper = $(this).closest('.pick-period-container');
            const tabType = $optionWrapper.data('tabname');

            $('.pricing-radio-option', $optionWrapper).removeClass('selected');

            this.classList.add('selected');

            if (this.dataset.period === '12') {
                delay('pricing.plan', eventlog.bind(null, is_mobile ? 99867 : 99866));
            }
            else {
                delay('pricing.plan', eventlog.bind(null, is_mobile ? 99869 : 99868));
            }
            if (tabType === 'pro') {
                sessionStorage.setItem('pro.period', this.dataset.period);
                fillPlansInfo(this.dataset.period | 0);
            }
            else if (tabType === 'exclusive') {
                sessionStorage.setItem('pro.periodExc', this.dataset.period);
                pro.proplan2.fillExclusivePlanCards(this.dataset.period | 0);
            }
            estimateFlexiPrice($strgFlexInput.val(), $transFlexInput.val());

            return false;
        });
    };

    const fetchPlansData = () => {
        return new Promise(resolve => {
            pro.loadMembershipPlans(() => {
                if (u_attr) {

                    M.getStorageQuota().then(storage => {
                        pro.proplan2.storageData = storage;
                        resolve();
                    });
                }
                else {
                    resolve();
                }
            });
        });
    };

    /**
     * This method see how we should display each plan card for a logged-in user
     * */
    const updatePriceCards = () => {

        // we consider confirmed users [u_type = 3]
        // and non confirmed ones [=2] because they might have bought a plan
        if (u_type > 1 && u_attr) {

            // if this is user is Business or Pro-flexi
            // note: they cant reach this function, however this check
            // is for future changes protection
            if (u_attr.p === pro.ACCOUNT_LEVEL_BUSINESS || u_attr.p === pro.ACCOUNT_LEVEL_PRO_FLEXI) {
                $planCards.addClass('disabled');
                return;
            }

            // reset cards status
            $planCards.removeClass('disabled popular');

            // hide free banners

            if (localStorage.keycomplete) {
                pro.propay.planChosenAfterRegistration = true;
            }
            else {
                $('.pricing-pg.pricing-banner-container, .pricing-pg.pricing-get-started-container', $page)
                    .addClass('hidden');
            }
            // function to set card class, and txt for the header
            const setCardClassTxt = (id, cls, txt) => {
                const $card = $(`#pro${id}`, $page).addClass(cls);
                if (txt) {
                    $('.pricing-plan-recommend', $card).text(txt);
                }
            };

            // to see what to disable  and what to recommend
            // we will check storage.
            if (pro.proplan2.storageData && pro.proplan2.storageData.used) {
                const usedSpaceGB = pro.proplan2.storageData.used / 1073741824;

                // get the plan account levels for lite, pro1, pro2, pro3. and 1 month
                const plans = pro.filter.plans.coreM;

                // strangely no plans found --> set default
                if (!plans.length) {
                    setCardClassTxt(pro.ACCOUNT_LEVEL_PRO_I, 'popular', l.pr_popular);
                    return;
                }

                let minStorage = Number.MAX_SAFE_INTEGER;
                let recomendedPlan = null;
                const planLevel = u_attr.p ? (u_attr.p <= 3 ? u_attr.p : 0) : -1;

                for (const plan of plans) {
                    // create plan objects from the account levels (all 1m, which is defaulted)
                    const planObj = pro.getPlanObj(plan);

                    if (pro.filter.simple.excPlans.has(planObj.level)) {
                        setCardClassTxt(planObj.level, 'exclusive-offer', 'Exclusive Offer');
                    }

                    const currPlanLevel = planObj.isIn('recommend', 'asLevel');

                    // if the plan offers less space than used OR same user's plan --> disable
                    if (plan[pro.UTQA_RES_INDEX_STORAGE] < usedSpaceGB) {

                        $planCards.filter(`#pro${plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL]}`).addClass('disabled');
                    }

                    // if the plan is suitable, let's see the smallest plan to recommend to the user
                    // that is bigger than their current purchased plan.
                    else if (currPlanLevel > planLevel && plan[pro.UTQA_RES_INDEX_STORAGE] < minStorage) {
                        minStorage = plan[pro.UTQA_RES_INDEX_STORAGE];
                        recomendedPlan = plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];
                    }
                }

                // if we found recommendation, let's recommend
                if (recomendedPlan) {
                    setCardClassTxt(recomendedPlan, 'popular', l[23948]);
                }

            }
            // we couldn't get the info.
            // if it's not a free user
            // we will reset to default
            else if (u_attr.p) {
                setCardClassTxt(pro.ACCOUNT_LEVEL_PRO_I, 'popular', l.pr_popular);
            }
            // it's a free user
            else {
                setCardClassTxt(pro.ACCOUNT_LEVEL_PRO_LITE, 'popular', l[23948]);
            }

        }
    };

    /**
     * Check id the current request to view the page is valid
     * @returns {boolean}   true if it's valid
     * */
    const validatePageRequest = () => {

        // if there's a logged in user (attributes)
        if (u_attr) {
            // if it's a business account --> not valid
            // just check the proper destination.
            if (u_attr.b) {
                let destination = 'fm';

                if (u_attr.b.m && pro.isExpiredOrInGracePeriod(u_attr.b.s)) {
                    destination = 'repay';
                }

                loadSubPage(destination);
                return false;
            }
            // if it's a Pro-Flexi account --> not valid
            // just check the proper destination.
            else if (u_attr.pf) {
                let destination = 'fm';

                if (pro.isExpiredOrInGracePeriod(u_attr.pf.s)) {
                    destination = 'repay';
                }

                loadSubPage(destination);
                return false;
            }

        }

        return true;
    };

    /**
     * This method initialize Plans' Prices cards.
     * It calls some other private method to display the cards correctly
     * */
    const initPlansCards = () => {


        // fill the info in all cards
        fillPlansInfo(sessionStorage.getItem('pro.period') | 0);
        updatePriceCards();
        // initialize buy buttons for plans and for the free
        initBuyPlan();
    };


    return new class {

        async initPage() {

            // validate the request, checking for business + proFlexi

            if (!validatePageRequest()) {
                return false;
            }

            // They're from mega.io with a plan chosen, but they need to register first before going to /propay_x
            if (is_mobile && window.nextPage === '1' && window.pickedPlan){
                return loadSubpage('register');
            }

            loadingDialog.show();

            await fetchPlansData();
            await fetchBusinessPlanInfo();
            parsepage(pages.planpricing);

            if (mega.ui.header) {
                mega.ui.header.update();
            }
            if (mega.ui.alerts) {
                mega.ui.alerts.hide();
            }

            showExclusiveOffers = !!pro.filter.miniMin;

            $page = $('.bottom-page.full-block', '.bottom-page.content.pricing-pg');
            $exclusivePlans = $('.exclusive-plans-container', $page);

            delay('pricingpage.init', eventlog.bind(null, is_mobile ? 99936 : 99935));

            // Check the user is allowed to see the low tier version of the pro page
            // (i.e. if the lowest plan returned is a mini plan)
            if (window.mProTab === 'exc') {
                if (!u_handle) {
                    // If not logged in, prompt them to do so
                    showSignupPromptDialog();
                }
                else if (!showExclusiveOffers) {
                    // Otherwise if the user isn't eligible, show a dialog telling the user this
                    pro.updateLowTierProPage();
                }
            }

            initPlansCards();
            populateBusinessPlanData();

            if (sessionStorage.mScrollTo === 'exc') {
                window.mProTab = 'exc';
                delete sessionStorage.mScrollTo;
            }

            initTabHandlers();
            initPeriodPickHandler();
            initPlansTabs();
            initSocial();
            initFaq();
            initCompare();

            // Check the user is allowed to see the low tier version of the pro page
            // (i.e. if the lowest plan returned is a mini plan)
            if ((u_handle && window.mProTab === 'exc') || showExclusiveOffers) {
                // Unhide and select exclusive offer tab
                pro.proplan2.updateExcOffers();
                $('.tabs-module-block#pr-exc-offer-tab', $page).removeClass('hidden');
            }

            loadingDialog.hide();

            if (sessionStorage.mScrollTo === 'flexi' && ProFlexiFound) {
                $proflexiBlock[0].scrollIntoView({behavior: 'smooth'});
                delete sessionStorage.mScrollTo;
            }

            if (window.nextPage === '1' && window.pickedPlan) {

                pro.proplan2.selectedPlan = window.pickedPlan;

                delete window.nextPage;
                delete window.pickedPlan;

                showRegisterDialog();
            }
        }

        initLowTierPlanFeatureCells() {
            // Do not init if mini plans are not visible to user
            if (!showExclusiveOffers) {
                return;
            }

            const $tableContainer = $('.pricing-pg.pricing-plans-compare-table-container', $page);
            const $miniPlansHeader = $('.plans-table-header.pro-exc-offer', $tableContainer);

            const miniPlanNum = pro.filter.miniMin[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];
            const planName = pro.getProPlanName(miniPlanNum);

            // Populate mini plan title, and storage and transfer columns
            $('span', $miniPlansHeader).text(l.pr_table_mini_plan.replace('%1', planName));
            $('#table-strg-mini', $tableContainer).text(
                bytesToSize(pro.minPlan[pro.UTQA_RES_INDEX_STORAGE] * 1073741824, 0)
            );
            $('#table-trans-mini', $tableContainer).text(
                bytesToSize(pro.minPlan[pro.UTQA_RES_INDEX_TRANSFER] * 1073741824, 0)
            );
            $('#table-days-mini', $tableContainer).text(mega.icu.format(l.pr_up_to_days, 90));

            // Set button link and text for mini plan button
            $('button.pro-exc-offer', $tableContainer)
                .text(l.buy_plan.replace('%1', planName))
                .rebind('click', () => {
                    delay('pricing.pro-exc-offer', eventlog.bind(null, is_mobile ? 500246 : 500244, miniPlanNum));

                    loadSubPage(`propay_${miniPlanNum}`);
                });
        }

        /**
         * Initialize the pro cards for the exclusive offer plans
         */
        createExclusivePlanCards(force) {

            // If children already created, don't recreate them as that would make the card empty
            if ($('> .plans-cards-container > .exc-plan-card', $exclusivePlans).length && !force) {
                return;
            }

            showExclusiveOffers = !!pro.filter.miniMin;

            const plans = pro.filter.plans.excPlans;
            const usedPlanLevels = [];
            const $template = $('.template', $exclusivePlans);
            $('.exc-plan-card', $exclusivePlans).remove();
            for (let i = 0; i < plans.length; i++) {
                const planObj = pro.getPlanObj(plans[i]);
                if (usedPlanLevels.includes(planObj.level)) {
                    continue;
                }
                usedPlanLevels.push(planObj.level);
                const $planCard = $template.clone()
                    .removeClass('template hidden').addClass('exc-plan-card').attr('id', 'pro' + planObj.level);

                $('.plans-cards-container', $exclusivePlans).safeAppend($planCard.prop('outerHTML'));
            }
            if (window.mProTab === 'exc' && showExclusiveOffers) {
                document.getElementById('pr-exc-offer-tab').click();
                delete window.mProTab;
            }
            if (showExclusiveOffers) {
                initBuyPlan($exclusivePlans);
            }
        }

        /**
         * Fills the exclusive offer plan cards with the currently available plans.
         * @param {number} period - The number of months that is selected to show. If 0, default to 12
         */
        fillExclusivePlanCards(period) {

            let plans = pro.filter.plans['excPlans' + (period === 1 ? 'M' : 'Y')];
            let showDurationOptions = true;
            $('.exc-plan-card', $exclusivePlans).addClass('hidden');

            // If there are no plans of the duration, find any cards that are of the other duration and show them
            // Also set the other period and hide the selector
            if (!plans.length) {
                plans = pro.filter.plans.excPlans;
                if (plans.length) {
                    period = period === 1 ? 12 : 1;
                    $('.pick-period-container.exclusive-plans-container', $page).addClass('hidden');
                    sessionStorage.setItem('pro.periodExc', period);
                    showDurationOptions = false;
                }
            }

            // If there are no plans of any duration, show no plans
            if (!plans.length) {
                return;
            }
            const periodText = period === 12 ? l[932] : l[931];

            let planObj;
            const saveOptions = [];

            const updateCard = (planObj) => {
                const $planCard = $(`#pro${planObj.level}`).removeClass('hidden');

                saveOptions.push(planObj.saveUpTo);

                // If no update is needed for the card, skip it. Also safely handle no plan being found
                if (($planCard.data('period') === period) || !planObj) {
                    return;
                }

                $planCard.data('period', period);
                const priceText = formatCurrency(planObj.price, planObj.currency, 'narrowSymbol');
                const storageTxt = l[23789].replace('%1', bytesToSize(planObj.storage, 3, 4));
                const bandwidthTxt = l[23790].replace('%1', bytesToSize(planObj.transfer, 3, 4));

                const $storageBox = $('.pricing-plan-storage', $planCard);
                const $transferBox = $('.pricing-plan-trasfer', $planCard);
                const $transferSubBox = $('.pricing-plan-trasfer-val', $transferBox);

                const $featuresBox = $('.pricing-plan-features', $planCard);

                $('.pricing-plan-title', $planCard).text(planObj.name);
                $('.pricing-plan-price span.vl', $planCard).text(priceText);
                $('.pricing-plan-price-unit', $planCard).text(planObj.currency + ' / ' + periodText);
                $('.pricing-plan-storage', $planCard).text(storageTxt);

                $('.features-title', $featuresBox).text(l.pr_includes);
                $('.vpn span', $featuresBox).text(l.mega_vpn);
                $('.meeting-limits span', $featuresBox).text(l.pr_no_meet_time_limits);
                $('.meeting-participants span', $featuresBox).text(l.pr_unlimited_participants);

                if (priceText) {
                    $planCard.toggleClass('long-currency1', priceText.length >= 9 && priceText.length <= 12);
                    $planCard.toggleClass('long-currency2', priceText.length >= 13 && priceText.length <= 16);
                    $planCard.toggleClass('long-currency3', priceText.length >= 17);
                }

                if (storageTxt) {
                    $storageBox.toggleClass('long-text', storageTxt.length >= 27 || bandwidthTxt.length >= 27);
                    $transferBox.toggleClass('long-text', storageTxt.length >= 27 || bandwidthTxt.length >= 27);
                }
                if ($transferSubBox.length) {
                    $transferSubBox.text(bandwidthTxt);
                }
                else {
                    $transferBox.text(bandwidthTxt);
                }
                $('.pricing-plan-btn', $planCard).text(l.buy_plan.replace('%1', planObj.name));
                if (pro.proplan2.storageData && pro.proplan2.storageData.used) {
                    $planCard.toggleClass('disabled', planObj.storage < pro.proplan2.storageData.used);
                }
            };

            for (let i = 0; i < plans.length; i++) {
                planObj = pro.getPlanObj(plans[i]);
                updateCard(planObj);
            }

            if (showDurationOptions) {
                $('.period-note-txt', $exclusivePlans).text(l.pr_save_up_to.replace('%1', Math.max(...saveOptions)));
            }

            $('.ars', $exclusivePlans).toggleClass('hidden', !planObj.hasLocal);
            $('.pricing-pg.pricing-estimation-note-container-exc', $page)
                .toggleClass('hidden eu', !planObj.hasLocal);
        }

        updateExcOffers() {
            showExclusiveOffers = !!pro.filter.miniMin;
            this.initLowTierPlanFeatureCells();
            this.createExclusivePlanCards(showExclusiveOffers);
            this.fillExclusivePlanCards((sessionStorage.getItem('pro.periodExc') | 0) || 12);

            $('#pr-exc-offer-tab', $page).toggleClass('hidden', !showExclusiveOffers);
        }
    };
});

/**
 * Functionality for the Pro page Step 2 where the user has chosen their Pro plan and now they
 * will choose the payment provider and plan duration.
 */
pro.propay = {

    /** The selected Pro plan number e.g. 1 - 4 */
    planNum: null,

    /** The selected Pro plan name e.g. Pro I - III & Pro Lite */
    planName: null,

    /** All payment gateways loaded from the API */
    allGateways: [],

    /** The user's account balance */
    proBalance: 0,

    /** The selected Pro package details */
    selectedProPackage: null,

    /** The gateway name of the selected payment method */
    proPaymentMethod: null,

    /** Whether they selected the PRO plan immediately after completing the registration process */
    planChosenAfterRegistration: false,

    /** Darker background modal overlay */
    $backgroundOverlay: null,

    /** Overlays for loading/processing/redirecting */
    $loadingOverlay: null,

    /** Selector for the Pro Pay page (step 2 of the process) */
    $page: null,

    paymentStatusChecker: null,

    /** The user's subscription payment gateway id */
    userSubsGatewayId: null,

    /** @var Dialog Log in / register dialog displayed when not signed in */
    accountRequiredDialog: null,

    /**
     * Initialises the page and functionality
     */
    init: function() {
        "use strict";

        // If Business sub-user or account is not expired/grace period, don't allow
        // access to this Pro Pay page or they would end up purchasing a new plan
        if (u_attr && u_attr.b && (!u_attr.b.m || !pro.isExpiredOrInGracePeriod(u_attr.b.s))) {
            loadSubPage('start');
            return;
        }

        // If Business master user is expired or in grace period, redirect to repay page
        if (u_attr && u_attr.b && u_attr.b.m && pro.isExpiredOrInGracePeriod(u_attr.b.s)) {
            loadSubPage('repay');
            return;
        }

        // If a current Pro Flexi user (not expired/grace period), don't allow
        // access to this Pro Pay page or they would end up purchasing a new plan
        if (u_attr && u_attr.pf && !pro.isExpiredOrInGracePeriod(u_attr.pf.s)) {
            loadSubPage('start');
            return;
        }

        // If a previous Pro Flexi user is expired or in grace period, they must use the Repay page to pay again
        if (u_attr && u_attr.pf && pro.isExpiredOrInGracePeriod(u_attr.pf.s)) {
            loadSubPage('repay');
            return;
        }

        // Cache current Pro Payment page selector
        this.$page = $('.payment-section', '#startholder');

        const $selectedPlanName = $('.top-header.plan-title .plan-name', this.$page);
        const $purchaseButton = $('button.purchase', this.$page);

        // Preload loading/transferring/processing animation
        pro.propay.preloadAnimation();

        // Ephemeral accounts (accounts not registered at all but have a few files in the cloud
        // drive) are *not* allowed to reach the Pro Pay page as we can't track their payment (no email address).
        // Accounts that have registered but have not confirmed their email address yet *are* allowed to reach the Pro
        // Pay page e.g. if they registered on the Pro Plan selection page first (this gets more conversions).
        if (u_type === 0 && typeof localStorage.awaitingConfirmationAccount === 'undefined') {
            loadSubPage('pro');
            return;
        }

        // If the plan number is not set in the URL e.g. propay_4, go back to Pro page step 1 so they can choose a plan
        if (!pro.propay.setProPlanFromUrl()) {
            loadSubPage('pro');
            return;
        }

        // Update header text with plan
        $selectedPlanName.text(pro.propay.planName);

        let discountInfo = pro.propay.getDiscount();
        if (discountInfo && discountInfo.used) {
            delete mega.discountCode;
            delete mega.discountInfo;
            discountInfo = null;
        }

        // Apply discount info if applicable
        if (discountInfo && discountInfo.pd) {
            const discountTitle = discountInfo.m === 12 ? l[24680]
                : (discountInfo.m === 1 ? l[24849] : l[24850]);
            $('.top-header.plan-title', this.$page).safeHTML(discountTitle
                .replace('%1', escapeHTML(pro.propay.planName))
                .replace('%2', formatPercentage(discountInfo.pd / 100)));
            $('.stores-desc', this.$page).addClass('hidden');
        }

        if (!pro.planInFilter(pro.propay.planNum, 'supportsGooglePlay')) {
            $('.bottom-page .bottom-page.stores-desc', this.$page).addClass('hidden');
        }

        // Show loading spinner because some stuff may not be rendered properly yet
        loadingDialog.show('propayReady');

        // Initialise some extra stuff just for mobile
        if (is_mobile) {
            mobile.propay.init();
            if ((discountInfo && discountInfo.pd) || !pro.planInFilter(pro.propay.planNum, 'supportsGooglePlay')) {
                $('.mobile.external-payment-options', '.mobile.fm-content').addClass('hidden');
            }
        }

        // If the user is not logged in, show the login / register dialog
        if (u_type === false) {
            loadingDialog.hide('propayReady');
            pro.propay.showAccountRequiredDialog();

            // login / register action while on /propay_x will recall init()
            return;
        }

        if (discountInfo) {
            mega.discountInfo.used = true;
        }

        // If the user does has more stored than the current plan offers, go back to Pro page
        // so they may select a plan that provides more storage space
        const proceed = new Promise((resolve, reject) => {
            M.getStorageQuota().then((storage) => {
                checkPlanStorage(storage.used, pro.propay.planNum).then((res) => {
                    if (res) {
                        $purchaseButton.removeClass('disabled');
                        resolve();
                    }
                    else {
                        loadSubPage('pro');
                        reject(new Error('Selected plan does not have enough storage space; ' +
                        `Or plan ${pro.getProPlanName(pro.propay.planNum)} (${pro.propay.planNum}) is not available`));
                    }
                });
            });
        });

        // Initialise the main purchase button
        $purchaseButton.rebind('click.purchase', () => {
            if (is_mobile) {
                pro.propay.userSubsGatewayId =
                    M.account.sgwids && M.account.sgwids.length > 0 ? M.account.sgwids[0] : null;
            }
            pro.propay.startPurchaseProcess();
            return false;
        });

        clickURLs();

        // Load payment plans
        pro.loadMembershipPlans(function() {

            // Get the user's account balance
            voucherDialog.getLatestBalance(function() {

                // Load payment providers and do the rest of the rendering if the selected plan
                // has enough storage. Otherwuse do not proceed with rendering the page.
                proceed.then(async () => {
                    await pro.propay.loadPaymentGatewayOptions();
                    loadingDialog.hide('propayReady');
                }).catch((ex) => {
                    console.error(ex);
                });
            });
        });
    },

    /**
     * Gets the Pro plan number e.g. 4 from the URL e.g. propay_4
     * @returns {Boolean} Returns true if set correctly, otherwise returns false
     */
    setProPlanFromUrl: function() {

        // The URL should be in format /propay_x (1-4)
        const pageParts = page.split('_');

        if (typeof pageParts[1] === 'undefined') {
            return false;
        }

        const proNumInt = parseInt(pageParts[1]);
        const validProNums = pro.filter.simple.validPurchases;

        // If the Pro Flexi enabled (pf) flag is not on and they're trying to access the page, don't allow
        if (mega.flags && mega.flags.pf !== 1 && proNumInt === pro.ACCOUNT_LEVEL_PRO_FLEXI) {
            return false;
        }

        // Check the URL has propay_1 (PRO I) - propay_3 (PRO III), propay_4 (PRO Lite), propay_101 (Pro Flexi)
        if (validProNums.has(proNumInt)) {

            // Get the Pro number e.g. 2 then the name e.g. Pro I - III, Pro Lite, Pro Flexi etc
            pro.propay.planNum = proNumInt;
            pro.propay.planName = pro.getProPlanName(pro.propay.planNum);

            return true;
        }

        return false;
    },

    /**
     * Preloads the large loading animation so it displays immediately when shown
     */
    preloadAnimation: function() {

        pro.propay.$backgroundOverlay = $('.fm-dialog-overlay', 'body');
        pro.propay.$loadingOverlay = $('.payment-processing', 'body');

        // Check if using retina display
        var retina = (window.devicePixelRatio > 1) ? '@2x' : '';

        // Preload loading animation
        pro.propay.$loadingOverlay.find('.payment-animation').attr('src',
            staticpath + '/images/mega/payment-animation' + retina + '.gif'
        );
    },

    getDiscount: function() {
        'use strict';
        if (mega.discountInfo && mega.discountInfo.pd && mega.discountInfo.al === pro.propay.planNum) {
            return mega.discountInfo;
        }
        return false;
    },

    /**
     * Loads the payment gateway options into Payment options section
     */
    loadPaymentGatewayOptions: async function() {

        'use strict';

        // If testing flag is enabled, enable all the gateways for easier debugging (this only works on Staging API)
        var enableAllPaymentGateways = (localStorage.enableAllPaymentGateways) ? 1 : 0;

        // Do API request (User Forms of Payment Query Full) to get the valid list of currently active
        // payment providers. Returns an array of objects e.g.
        // {
        //   "gatewayid":11,"gatewayname":"astropayB","type":"subgateway","displayname":"Bradesco",
        //   "supportsRecurring":0,"supportsMonthlyPayment":1,"supportsAnnualPayment":1,
        //   "supportsExpensivePlans":1,"extra":{"code":"B","taxIdLabel":"CPF"}
        // }
        let {result: gatewayOptions} = await api.req({ a: 'ufpqfull', t: 0, d: enableAllPaymentGateways });

        const $placeholderText = $('.loading-placeholder-text', pro.propay.$page);
        const $pricingBox = $('.pricing-page.plan', pro.propay.$page);

        // If an API error (negative number) exit early
        if ((typeof gatewayOptions === 'number') && (gatewayOptions < 0)) {
            $placeholderText.text('Error while loading, try reloading the page.');
            return false;
        }

        var tempGatewayOptions = gatewayOptions.filter(gate =>
            (pro.propay.planNum === pro.ACCOUNT_LEVEL_PRO_FLEXI && gate.supportsBusinessPlans === 1)
            || (pro.propay.planNum !== pro.ACCOUNT_LEVEL_PRO_FLEXI
                && (typeof gate.supportsIndividualPlans === 'undefined' || gate.supportsIndividualPlans))
            && !(gate.minimumEURAmountSupported > pro.getPlanObj(pro.propay.planNum, 1).maxCorrPriceEuro));

        // if this user has a discount, clear gateways that are not supported.
        const discountInfo = pro.propay.getDiscount();
        const testGateway = localStorage.testGateway;
        if (discountInfo) {
            tempGatewayOptions = tempGatewayOptions.filter(gate => {
                if (gate.supportsMultiDiscountCodes && gate.supportsMultiDiscountCodes === 1) {
                    return true;
                }
                return testGateway;
            });
        }

        gatewayOptions = tempGatewayOptions;

        // Filter out if they don't support expensive plans
        if (parseInt(pro.propay.planNum) !== 4) {
            gatewayOptions = gatewayOptions.filter((opt) => {
                return opt.supportsExpensivePlans !== 0;
            });
        }

        // Make a clone of the array so it can be modified
        pro.propay.allGateways = JSON.parse(JSON.stringify(gatewayOptions));

        // If mobile, filter out all gateways except the supported ones
        if (is_mobile) {
            pro.propay.allGateways = mobile.propay.filterPaymentProviderOptions(pro.propay.allGateways);
        }

        // Check if the API has some issue and not returning any gateways at all
        if (pro.propay.allGateways.length === 0) {
            console.error('No valid gateways returned from the API');
            msgDialog('warningb', '', l.no_payment_providers, '', () => {
                loadSubPage('pro');
            });
            return false;
        }

        // Separate into two groups, the first group has 6 providers, the second has the rest
        var primaryGatewayOptions = gatewayOptions.splice(0, 9);
        var secondaryGatewayOptions = gatewayOptions;

        // Show payment duration (e.g. month or year) and renewal option radio options
        pro.propay.renderPlanDurationOptions(discountInfo);
        pro.propay.initPlanDurationClickHandler();

        // Hide/show Argentian warning message depending on ipcc
        if (u_attr.ipcc === 'AR') {
            $('.argentina-only', pro.propay.$page).removeClass('hidden');
        }
        else {
            $('.argentina-only', pro.propay.$page).addClass('hidden');
        }

        // If mobile, show all supported options at once and they can scroll vertically
        if (is_mobile) {
            pro.propay.renderPaymentProviderOptions(pro.propay.allGateways, 'primary');
        }
        else {
            // Otherwise if desktop, render the two groups and a Show More button will show the second group
            pro.propay.renderPaymentProviderOptions(primaryGatewayOptions, 'primary');
            pro.propay.renderPaymentProviderOptions(secondaryGatewayOptions, 'secondary');
        }

        // Change radio button states when clicked
        pro.propay.initPaymentMethodRadioButtons();
        pro.propay.preselectPreviousPaymentOption();
        pro.propay.updateDurationOptionsOnProviderChange();
        pro.propay.initShowMoreOptionsButton();

        // Update the pricing and whether is a regular payment or subscription
        pro.propay.updateMainPrice(undefined, discountInfo);
        pro.propay.updateTextDependingOnRecurring();

        // Show the pricing box on the right (it is hidden while everything loads)
        $pricingBox.removeClass('loading');
    },

    /**
     * Renders the pro plan prices into the Plan Duration dropdown
     * @param {Object}  discountInfo    Discount info object if any
     */
    renderPlanDurationOptions: function(discountInfo) {
        'use strict';

        // Sort plan durations by lowest number of months first
        pro.propay.sortMembershipPlans();

        // Cache the duration options list
        const $durationList = $('.duration-options-list', this.$page);

        // Clear the radio options, in case they revisted the page
        $('.payment-duration', $durationList).not('.template').remove();

        // Loop through the available plan durations for the current membership plan
        for (var i = 0, length = pro.membershipPlans.length; i < length; i++) {

            var currentPlan = pro.membershipPlans[i];

            // If match on the membership plan, display that pricing option in the dropdown
            if (currentPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] === parseInt(pro.propay.planNum)) {

                // If this is a new multi discount code, follow rendering logic for that
                if (discountInfo && discountInfo.md && discountInfo.pd) {

                    // Calculate if the plan renews yearly (will renew yearly if it is a clean multiple of 12 months)
                    // e.g. 12, 24, 36. Mixed months e.g. 18 months, 32 months etc will renew monthly as per the API.
                    const discountMonths = discountInfo.m;
                    const willRenewYearly = discountMonths % 12 === 0;

                    // If the plan will renew yearly, and the current plan's number of months is 12 (yearly), then
                    // render the single option only. Or if the plan will renew monthly, and the current plan's number
                    // of months is 1, then also render. We want the plan index number (i) to be corresponding to the
                    // plan that will be used on renewal so correct renewal text is shown.
                    if (willRenewYearly && currentPlan[pro.UTQA_RES_INDEX_MONTHS] === 12 ||
                        !willRenewYearly && currentPlan[pro.UTQA_RES_INDEX_MONTHS] === 1) {
                        pro.propay.renderNewMutiDiscountRadio(discountInfo, currentPlan, i);
                        break;
                    }

                    // Try find the correct plan in the next loop iteration
                    continue;
                }

                // Get the price and number of months duration
                var numOfMonths = currentPlan[pro.UTQA_RES_INDEX_MONTHS];
                var price = currentPlan[pro.UTQA_RES_INDEX_PRICE];
                var currency = 'EUR';
                var discountedPriceY = '';
                var discountedPriceM = '';
                var discountSaveY = '';
                var discountSaveM = '';

                if (currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE]) {
                    price = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE];
                    currency = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];
                    if (discountInfo && discountInfo.pd) {
                        const discountPerc = 1 - (discountInfo.pd / 100).toFixed(2);
                        if (numOfMonths === 12) {
                            discountedPriceY = (price * discountPerc).toFixed(2);
                            discountSaveY = (price - discountedPriceY).toFixed(2);
                        }
                        else if (numOfMonths === 1) {
                            discountedPriceM = (price * discountPerc).toFixed(2);
                            discountSaveM = (price - discountedPriceM).toFixed(2);
                        }
                    }
                }
                else if (discountInfo && (discountInfo.emp || discountInfo.eyp)) {
                    discountedPriceY = discountInfo.eyp || '';
                    discountedPriceM = discountInfo.emp || '';
                    discountSaveY = discountedPriceY ? (price - discountedPriceY).toFixed(2) : '';
                    discountSaveM = discountedPriceM ? (price - discountedPriceM).toFixed(2) : '';
                }

                if (discountInfo && discountInfo.m !== 0 && discountInfo.m !== numOfMonths) {
                    continue;
                }

                // Change wording depending on number of months
                var monthsWording = l[922];     // 1 month
                if (numOfMonths === 12) {
                    monthsWording = l[923];     // 1 year
                }
                else {
                    monthsWording = mega.icu.format(l[922], numOfMonths);  // x months
                }

                // Build select option
                const $durationOption = $('.payment-duration.template', this.$page).first().clone();

                // Update months and price
                $durationOption.removeClass('template');
                $durationOption.attr('data-plan-index', i);
                $durationOption.attr('data-plan-months', numOfMonths);
                $('.duration', $durationOption).text(monthsWording);
                $('.price', $durationOption).text(formatCurrency(price, currency));

                // Show amount they will save
                if (numOfMonths === 12) {

                    const discount = discountSaveY || pro.getPlanObj(currentPlan).yearlyDiscount;

                    $('.save-money', $durationOption).removeClass('hidden');
                    $('.save-money .amount', $durationOption).text(formatCurrency(discount, currency));
                    if (discountedPriceY) {
                        $('.oldPrice', $durationOption).text($('.price', $durationOption).text())
                            .removeClass('hidden');
                        $('.crossline', $durationOption).removeClass('hidden');
                        $('.price', $durationOption).text(formatCurrency(discountedPriceY, currency));
                        $('.membership-radio-label', $durationOption).addClass('discounted');
                    }
                }
                else if (numOfMonths === 1 && discountedPriceM) {
                    const savedAmount = formatCurrency(discountSaveM, currency);
                    const $saveContainer = $('.save-money', $durationOption).removeClass('hidden');

                    $('.amount', $saveContainer).text(savedAmount);
                    $('.oldPrice', $durationOption).text($('.price', $durationOption).text())
                        .removeClass('hidden');
                    $('.crossline', $durationOption).removeClass('hidden');
                    $('.price', $durationOption).text(formatCurrency(discountedPriceM, currency));
                    $('.membership-radio-label', $durationOption).addClass('discounted');
                }

                // Update the list of duration options
                $durationOption.appendTo('.duration-options-list');
            }
        }

        // If there is data about any previous plan they purchased
        if (alarm.planExpired.lastPayment) {

            // Get the number of months for the plan they last paid for
            var lastPaymentMonths = alarm.planExpired.lastPayment.m;

            // Find the radio option with the same number of months
            var $monthOption = $(".payment-duration[data-plan-months='" + lastPaymentMonths + "']");

            // If it can find it then select the radio option. Note: In some
            // cases this may not be available (e.g. with upcoming A/B testing
            if (!sessionStorage['pro.period'] && $monthOption.length) {
                $('input', $monthOption).prop('checked', true);
                $('.membership-radio', $monthOption).addClass('checked');
                $('.membership-radio-label', $monthOption).addClass('checked');
                return true;
            }
        }

        // Otherwise pre-select the chosen period (from previous page, or storage / transfer
        // quota dialog if a mini plan is shown there)
        // TODO: Handle different durations from different locations in a tidy way
        let selectedPeriod;

        if (sessionStorage.fromOverquotaPeriod) {
            selectedPeriod = sessionStorage.fromOverquotaPeriod;
            delete sessionStorage.fromOverquotaPeriod;
        }
        else {
            const selectedTab = sessionStorage['pro.pricingTab'];
            selectedPeriod = (selectedTab === 'pr-exc-offer-tab'
                ? sessionStorage['pro.periodExc']
                : sessionStorage['pro.period']) || 12;
        }

        let $selectedOption = $(`.payment-duration[data-plan-months=${selectedPeriod}]`, $durationList);

        // Otherwise pre-select yearly payment (or monthly if plan is Pro Flexi)
        if (!$selectedOption.length) {
            $selectedOption = $('.payment-duration:not(.template)', $durationList).last();
        }

        $('input', $selectedOption).prop('checked', true);
        $('.membership-radio', $selectedOption).addClass('checked');
        $('.membership-radio-label', $selectedOption).addClass('checked');
    },

    /**
     * Renders the single option for the new discount scheme which can be redeemed by multiple users
     * @param {Object} discountInfo The discount information cached from the 'dci' API request
     * @param {Array} currentPlan The current plan data
     * @param {Number} dataPlanIndex The array index of the plan in pro.membershipPlans
     */
    renderNewMutiDiscountRadio: function(discountInfo, currentPlan, dataPlanIndex) {

        'use strict';

        // Change wording depending on number of months
        const numOfMonths = discountInfo.m;
        const monthsWording = mega.icu.format(l[922], numOfMonths);

        let currencyCode = 'EUR';
        let discountedTotalPrice = discountInfo.edtp;   // Euro Discounted Total Price
        let discountAmount = discountInfo.eda;          // Euro Discount Amount

        // Get local amounts if applicable
        if (currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE]) {
            currencyCode = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];
            discountedTotalPrice = discountInfo.ldtp;   // Local Discounted Total Price
            discountAmount = discountInfo.lda;          // Local Discount Amount
        }

        // Format for webclient styled currency
        const formattedDiscountAmount = formatCurrency(discountAmount, currencyCode);
        const formattedDiscountedTotalPrice = formatCurrency(discountedTotalPrice, currencyCode);

        // Build select option
        const $durationOption = $('.payment-duration.template', this.$page).first().clone();
        const $saveContainer = $('.save-money', $durationOption).removeClass('hidden');

        // Update months and price
        $durationOption.removeClass('template');
        $durationOption.attr('data-plan-index', dataPlanIndex);
        $durationOption.attr('data-plan-months', numOfMonths);
        $('.amount', $saveContainer).text(formattedDiscountAmount);
        $('.duration', $durationOption).text(monthsWording);
        $('.price', $durationOption).text(formattedDiscountedTotalPrice);

        // Update the list of duration options
        $durationOption.appendTo('.duration-options-list');
    },

    /**
     * Sorts plan durations by lowest number of months first
     */
    sortMembershipPlans: function() {

        pro.membershipPlans.sort(function (planA, planB) {

            var numOfMonthsPlanA = planA[pro.UTQA_RES_INDEX_MONTHS];
            var numOfMonthsPlanB = planB[pro.UTQA_RES_INDEX_MONTHS];

            if (numOfMonthsPlanA < numOfMonthsPlanB) {
                return -1;
            }
            if (numOfMonthsPlanA > numOfMonthsPlanB) {
                return 1;
            }

            return 0;
        });
    },

    /**
     * Add click handler for the radio buttons which are used for selecting the plan/subscription duration
     */
    initPlanDurationClickHandler: function() {

        var $durationOptions = $('.payment-duration', '.payment-section');

        // Add click handler
        $durationOptions.rebind('click', function() {

            var $this = $(this);
            if ($this.hasClass('disabled')) {
                return;
            }
            var planIndex = $this.attr('data-plan-index');

            // Remove checked state on the other buttons
            $('.membership-radio', $durationOptions).removeClass('checked');
            $('.membership-radio-label', $durationOptions).removeClass('checked');
            $('input', $durationOptions).prop('checked', false);

            // Add checked state to just to the clicked one
            $('.membership-radio', $this).addClass('checked');
            $('.membership-radio-label', $this).addClass('checked');
            $('input', $this).prop('checked', true);

            // Update the main price and wording for one-time or recurring
            pro.propay.updateMainPrice(planIndex);
            pro.propay.updateTextDependingOnRecurring();
        });
    },

    /**
     * Updates the main price
     * @param {Number} planIndex    The array index of the plan in pro.membershipPlans
     * @param {Object} discountInfo Discount info object if any
     */
    updateMainPrice: function(planIndex, discountInfo) {
        'use strict';
        // If not passed in (e.g. inital load), get it from the currently selected duration radio option
        if (typeof planIndex === 'undefined') {
            planIndex = $('.duration-options-list .membership-radio.checked', '.payment-section')
                .parent().attr('data-plan-index');
        }

        // Change the wording to month or year
        var currentPlan = pro.membershipPlans[planIndex];
        var numOfMonths = currentPlan[pro.UTQA_RES_INDEX_MONTHS];
        var monthOrYearWording = numOfMonths === 1 ? l[931] : l[932];
        var bandwidthText = numOfMonths === 1 ? l[23808] : l[24065];

        // Get the current plan price
        var localCurrency = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];
        var euroPrice = formatCurrency(currentPlan[pro.UTQA_RES_INDEX_PRICE]);

        // Get the current plan's storage, formatted as 'x GBs' or 'x TBs', up to 3 decimal places
        const storageValue = bytesToSize(currentPlan[pro.UTQA_RES_INDEX_STORAGE] * pro.BYTES_PER_GB, 3, 4);

        // Get the current plan's bandwidth, formatted as 'x GBs' or 'x TBs', up to 3 decimal places
        const bandwidthValue = bytesToSize(currentPlan[pro.UTQA_RES_INDEX_TRANSFER] * pro.BYTES_PER_GB, 3, 4);

        // Set selectors
        const $pricingBox = $('.pricing-page.plan', this.$page);
        const $planName = $('.plan-title', $pricingBox);
        const $priceNum = $('.plan-price .price', $pricingBox);
        const $pricePeriod = $('.plan-period', $pricingBox);
        const $storageAmount = $('.plan-feature.storage', $pricingBox);
        const $storageTip = $('i', $storageAmount);
        const $bandwidthAmount = $('.plan-feature.transfer', $pricingBox);
        const $bandwidthTip = $('i', $bandwidthAmount);
        const $euroPrice = $('.euro-price', $pricingBox);
        const $currncyAbbrev = $('.plan-currency', $pricingBox);

        var localPrice;

        if (currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE]) {
            this.$page.addClass('local-currency');
            $currncyAbbrev.text(localCurrency);
            $euroPrice.text(euroPrice);
            localPrice = formatCurrency(currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE], localCurrency, 'narrowSymbol');
            $('.local-currency-tip', this.$page).removeClass('hidden');
        }
        else {
            this.$page.removeClass('local-currency');
            $('.local-currency-tip', this.$page).addClass('hidden');
        }

        // If mobile, name at the top
        if (is_mobile) {
            const $mobilePlanName = $('.payment-options .plan-name', this.$page);

            $mobilePlanName.text(pro.propay.planName);
        }

        // Update the style of the dialog to be Pro I-III or Lite, also change the plan name
        $pricingBox.addClass('pro' + pro.propay.planNum);
        $pricingBox.attr('data-payment', pro.propay.planNum);
        $planName.text(pro.propay.planName);

        // Default to svg sprite icon format icon-crests-pro-x-details
        let iconClass = 'no-icon';
        if (pro.filter.simple.hasIcon.has(pro.propay.planNum)) {
            iconClass = `sprite-fm-uni icon-crests-pro-${pro.propay.planNum}-details`;
        }

        // Special handling for PRO Lite (account level 4) and Pro Flexi (account level 101)
        if (pro.propay.planNum === pro.ACCOUNT_LEVEL_PRO_LITE) {
            iconClass = 'sprite-fm-uni icon-crests-lite-details';
        }
        else if (pro.propay.planNum === pro.ACCOUNT_LEVEL_PRO_FLEXI) {
            iconClass = 'sprite-fm-uni icon-crests-pro-flexi-details';
        }

        // Add svg icon class (for desktop and mobile)
        $('.plan-icon', this.$page).addClass(iconClass);

        // Update the price of the plan and the /month or /year next to the price box
        // work for local currency if present
        if (localPrice) {
            $priceNum.text(localPrice);
        }
        else {
            $priceNum.text(euroPrice);
        }
        $pricePeriod.text('/' + monthOrYearWording);

        // Update storage
        if ($storageTip && $storageTip.attr('data-simpletip')) {
            $('span span', $storageAmount).text(storageValue);
            $storageTip.attr('data-simpletip', l[23807].replace('%1', '[U]' + storageValue + '[/U]'));
        }

        // Update bandwidth
        if ($bandwidthTip && $bandwidthTip.data('simpletip')) {
            $('span span', $bandwidthAmount).text(bandwidthValue);
            $bandwidthTip.attr('data-simpletip', bandwidthText.replace('%1', '[U]' + bandwidthValue + '[/U]'));
        }

        discountInfo = discountInfo || pro.propay.getDiscount();

        // Handle new multi-use discounts
        if (discountInfo && discountInfo.md && discountInfo.pd && discountInfo.al === pro.propay.planNum) {
            const $discountHeader = $('.payment-page.discount-header', this.$page);

            $('.discount-header-text', $discountHeader)
                .text(l[24670].replace('$1', formatPercentage(discountInfo.pd / 100)));
            $discountHeader.removeClass('hidden');

            let currency = 'EUR';
            const euroDiscountedTotalPrice = formatCurrency(discountInfo.edtp); // Euro Discounted Total Price
            let discountedTotalPrice = discountInfo.edtp;       // Euro Discounted Total Price
            let normalTotalPrice = discountInfo.etp;            // Euro Total Price (undiscounted)

            // Get local amounts if applicable
            if (currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE]) {
                currency = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];
                discountedTotalPrice = discountInfo.ldtp;   // Local Discounted Total Price
                normalTotalPrice = discountInfo.ltp;        // Local Total Price (undiscounted)
            }

            // Format for webclient styled currency
            const formattedDiscountedTotalPrice = formatCurrency(discountedTotalPrice, currency);
            const formattedNormalTotalPrice = formatCurrency(normalTotalPrice, currency);

            // Only show Euro price if there is a local price shown (no point showing Euro price in 2 places)
            if (currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE]) {
                $('.euro-price', $pricingBox).text(euroDiscountedTotalPrice);
            }

            $('.old-plan-price', $pricingBox).text(formattedNormalTotalPrice).removeClass('hidden');
            $('.cross-line', $pricingBox).removeClass('hidden');
            $('.plan-period', $pricingBox).addClass('hidden');
            $priceNum.parent('.pricing-page.plan-price').addClass('discounted');
            $priceNum.text(formattedDiscountedTotalPrice);
        }

        // Handle old style discounts
        else if (discountInfo && discountInfo.al && discountInfo.pd && discountInfo.al === pro.propay.planNum) {
            const $discountHeader = $('.payment-page.discount-header', this.$page);

            $('.discount-header-text', $discountHeader)
                .text(l[24670].replace('$1', formatPercentage(discountInfo.pd / 100)));
            $discountHeader.removeClass('hidden');

            const oldPriceText = $priceNum.text();
            let newPriceText = oldPriceText;
            const oldEuroText = $euroPrice.text();
            let newEuroText = oldEuroText;
            let localDiscountPrice = '';

            if (currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE]) {
                const discountPerc = 1 - (discountInfo.pd / 100).toFixed(2);
                localDiscountPrice = (currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE] * discountPerc).toFixed(2);
                localDiscountPrice = formatCurrency(localDiscountPrice, localCurrency);
            }

            if (numOfMonths === 1) {
                const euroFormatted = discountInfo.emp ? formatCurrency(discountInfo.emp) : '';
                newPriceText = localDiscountPrice || euroFormatted || oldPriceText;
                newEuroText = euroFormatted || oldEuroText;
            }
            else {
                const euroFormatted = discountInfo.eyp ? formatCurrency(discountInfo.eyp) : '';
                newPriceText = localDiscountPrice || euroFormatted || oldPriceText;
                newEuroText = euroFormatted || oldEuroText;
            }

            $('.old-plan-price', $pricingBox).text(oldPriceText).removeClass('hidden');
            $('.cross-line', $pricingBox).removeClass('hidden');
            $priceNum.text(newPriceText).parent('.pricing-page.plan-price').addClass('discounted');
            $euroPrice.text(newEuroText);
        }
    },

    /**
     * Updates the text on the page depending on the payment option they've selected and
     * the duration/period so it is accurate for a recurring subscription or one off payment.
     */
    updateTextDependingOnRecurring: function() {

        'use strict';

        if (pro.propay.allGateways.length === 0) {
            return false;
        }

        var $paymentDialog = $('.payment-dialog', 'body');
        var $paymentAddressDialog = $('.payment-address-dialog', 'body');
        var $numbers;

        // Update whether this selected option is recurring or one-time
        const $selectDurationOption = $('.duration-options-list .membership-radio.checked', this.$page);
        const selectedGatewayName = $('.payment-options-list input:checked', this.$page).val();
        const selectedProvider = pro.propay.allGateways.filter(val => {
            return (val.gatewayName === selectedGatewayName);
        })[0] || false;

        // Set text to subscribe or purchase
        var planIndex = $selectDurationOption.parent().attr('data-plan-index');
        var currentPlan = pro.membershipPlans[planIndex];
        var numOfMonths = currentPlan[pro.UTQA_RES_INDEX_MONTHS];
        var price = formatCurrency(currentPlan[pro.UTQA_RES_INDEX_PRICE]);
        var localPrice = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE];

        if (localPrice) {
            price = formatCurrency(localPrice, currentPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY]) + '*';
        }

        // Set the value for whether the plan should renew automatically
        // based on whether the provider supports doing so
        const recurringEnabled = selectedProvider.supportsRecurring;

        // Set text
        var subscribeOrPurchase = (recurringEnabled) ? l[23675] : l[6190];
        var subscribeOrPurchaseInstruction = (recurringEnabled) ? l[22074] : l[7996];
        var recurringOrNonRecurring = (recurringEnabled) ? '(' + l[6965] + ')' : l[6941];
        var recurringMonthlyOrAnnuallyMessage = (numOfMonths === 1) ? l[10628] : l[10629];
        var autoRenewMonthOrYearQuestion = (numOfMonths === 1) ? l[10638] : l[10639];
        var chargeInfoDuration = l[10642].replace('%1', price);

        // Find the pricing period in the pricing box and the plan duration options
        const $sidePanelPeriod = $('.pricing-page.plan .period', this.$page);
        const discountInfo = pro.propay.getDiscount();

        // Otherwise if new multi-use discount code
        if (discountInfo && discountInfo.md) {

            // If it's a compulsory subscription after the discount offer ends, show text "You will be
            // charged the normal plan price of 0.00 after the first month when the subscription renews.
            if (discountInfo.cs || recurringEnabled) {
                chargeInfoDuration = pro.propay.getDiscountRecurringWording(currentPlan, discountInfo);
            }
            else {
                let discountedTotalPrice = formatCurrency(mega.discountInfo.edtp);    // Euro Discounted Total Price
                const perMonthLocalPrice = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE];

                // Get the local discounted per month price and discounted total price
                if (perMonthLocalPrice) {
                    const localCurrency = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];

                    // Get the Local Discounted Total Price and add * on the end (links to note about billed in Euros)
                    discountedTotalPrice = mega.discountInfo.ldtp;
                    discountedTotalPrice = formatCurrency(discountedTotalPrice, localCurrency, 'narrowSymbol', false);
                    discountedTotalPrice += '*';
                }

                // Set text "You will be charged x.xx one time."
                chargeInfoDuration = l[10642].replace('%1', discountedTotalPrice);
            }
        }

        // Change the charge information below the recurring yes/no question
        else if ((recurringEnabled) && (numOfMonths === 1)) {
            chargeInfoDuration = l[10640].replace('%1', price);     // You will be charged 0.00 monthly.
            if (discountInfo && (discountInfo.lmp || discountInfo.emp)) {

                // You will be charged the normal plan price of 0.00 after the first month when the subscription renews.
                chargeInfoDuration = l[24699].replace('%1', price);
            }
        }
        else if ((recurringEnabled) && (numOfMonths === 12)) {
            chargeInfoDuration = l[10641].replace('%1', price);     // You will be charged 0.00 annually.
            if (discountInfo && (discountInfo.lyp || discountInfo.eyp)) {

                // You will be charged the full plan price of 0.00 after the first year when the subscription renews.
                chargeInfoDuration = l[24698].replace('%1', price);
            }
        }
        else if (discountInfo && (discountInfo.lmp || discountInfo.emp) && !recurringEnabled && numOfMonths === 1) {

            // You will be charged 0.00 one time.
            chargeInfoDuration = l[10642]
                .replace('%1', (discountInfo.lmp ? discountInfo.lmp + '*' : discountInfo.emp));
        }
        else if (discountInfo && (discountInfo.lyp || discountInfo.eyp) && !recurringEnabled && numOfMonths === 12) {

            // You will be charged 0.00 one time.
            chargeInfoDuration = l[10642]
                .replace('%1', (discountInfo.lyp ? discountInfo.lyp + '*' : discountInfo.eyp));
        }

        // Set to monthly or annually in the pricing box on the right
        if (recurringEnabled) {
            if (numOfMonths === 1) {
                $sidePanelPeriod.text('/' + l[918]);  // monthly
            }
            else {
                $sidePanelPeriod.text('/' + l[919]);  // annually
            }
        }
        else {
            if (numOfMonths === 1) {
                $sidePanelPeriod.text('/' + l[913]);  // month
            }
            else {
                $sidePanelPeriod.text('/' + l[932]);  // year
            }
        }

        const isFlexiPlan = currentPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] === pro.ACCOUNT_LEVEL_PRO_FLEXI;

        // Show the extra Question 3 recurring option section if the plan being bought
        // is Pro Flexi (forced recurring)
        $('.renewal-option', this.$page).toggleClass('hidden', !isFlexiPlan);

        $numbers = $('.number:visible', this.$page);

        // Reorder options numbering
        for (var i = 0, length = $numbers.length; i < length; i++) {
            $($numbers[i]).text(i + 1);
        }

        const $planTextStandard = $('.payment-plan-txt.js-plan-txt-normal', $paymentAddressDialog);
        const $planTextRecurringDiscount = $('.payment-plan-txt.js-plan-txt-discount', $paymentAddressDialog);
        const $noteDiscountRecurring = $('.payment-note-first.js-multi-discount-recurring', $paymentAddressDialog);
        const $noteStandardRecurring = $('.payment-note-first.recurring', $paymentAddressDialog);
        const $noteOneTime = $('.payment-note-first.one-time', $paymentAddressDialog);
        const $subscriptionInstructions = $('.subscription-instructions', this.$page);

        // By default, hide all address dialog notes
        $planTextStandard.add($planTextRecurringDiscount).addClass('hidden');
        $noteDiscountRecurring.add($noteStandardRecurring).add($noteOneTime).addClass('hidden');

        // If there is a percent discount and if using the new multi-discount system
        if (mega.discountInfo && mega.discountInfo.pd && mega.discountInfo.md) {

            // If recurring subscription, update dialog text below the
            // Pro plan name, show only the recurring discount text
            if (recurringEnabled) {
                recurringOrNonRecurring = l.promotion_recurring_subscription_monthly;

                // If the number of months is cleanly divisible by 12 then it will renew yearly after the promo
                if (discountInfo.m % 12 === 0) {
                    recurringOrNonRecurring = l.promotion_recurring_subscription_yearly;
                }

                $noteDiscountRecurring.removeClass('hidden');
            }
            else {
                // Otherwise update text below the Pro plan name and show only the standard one-off payment text
                recurringOrNonRecurring = l.promotion_one_off_subscription_text;
                $noteOneTime.removeClass('hidden');
            }

            // Show the discount recurring/non-recurring text block below the Pro plan name
            $planTextRecurringDiscount.removeClass('hidden').text(recurringOrNonRecurring);
        }
        else {
            // If recurring subscription is chosen, show only the standard recurring text in the dialog
            if (recurringEnabled) {
                $noteStandardRecurring.removeClass('hidden');
                $('.duration', $noteStandardRecurring).text(recurringMonthlyOrAnnuallyMessage);
            }
            else {
                // Show only the standard one-off payment text
                $noteOneTime.removeClass('hidden');
            }

            // Show the standard 1 month/year (recurring/non-recurring) text block below the Pro plan name
            $planTextStandard.removeClass('hidden');
            $('.recurring', $planTextStandard).text(recurringOrNonRecurring);
        }

        // If recurring, always show recurring info box above the Pro pay page Purchase button and init click handler
        if (recurringEnabled) {
            $subscriptionInstructions.removeClass('hidden');
        }
        else {
            // Otherwise hide it
            $subscriptionInstructions.addClass('hidden');
        }

        // If discount with compulsory subscription or Pro Flexi, hide the No option so it'll be forced recurring
        if ((discountInfo && discountInfo.cs) || isFlexiPlan) {
            $('.renewal-options-list .renewal-option', this.$page).last().addClass('hidden');
        }

        // Update depending on recurring or one off payment
        $('button.purchase span', this.$page).text(subscribeOrPurchase);
        $(is_mobile ? '.payment-info' : '.payment-instructions', this.$page).safeHTML(subscribeOrPurchaseInstruction);
        $('.choose-renewal .duration-text', this.$page).text(autoRenewMonthOrYearQuestion);
        $('.charge-information', this.$page).text(chargeInfoDuration);
        $('.payment-buy-now span', $paymentDialog).text(subscribeOrPurchase);
        $('.payment-buy-now span', $paymentAddressDialog).text(subscribeOrPurchase);
    },

    /**
     * Gets the recurring wording for the new multi-discount system, used in a few places
     * @param {Array} currentPlan The array from the 'utqa' response with the details of the selected Pro plan
     * @param {Object} discountInfo The discount information from the 'dci' response
     * @returns {String} Returns the wording for when the plan renews and at what monthly/yearly rate
     */
    getDiscountRecurringWording: function(currentPlan, discountInfo) {

        'use strict';

        const numOfMonths = discountInfo.m;

        // Default to monthly recurring subscription wording
        let monthsOrYears = numOfMonths;
        let discountRecurringText = l.promotion_recurring_info_text_monthly;

        // If the number of months is cleanly divisible by 12 the subscription will recur yearly after the promo
        if (numOfMonths % 12 === 0) {
            monthsOrYears = numOfMonths / 12;
            discountRecurringText = l.promotion_recurring_info_text_yearly;
        }

        // Default to Euros
        let price = formatCurrency(currentPlan[pro.UTQA_RES_INDEX_PRICE]);

        // Get the local price if available
        if (currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE]) {
            const localPrice = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE];
            const localCurrency = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];

            // Get the Local Discounted Total Price and add * on the end (links to note about billed in Euros)
            price = formatCurrency(localPrice, localCurrency, 'narrowSymbol', false);
            price += '*';
        }

        // Set the date to current date e.g. 3 May 2022 (will be converted to local language wording/format)
        const date = new Date();
        date.setMonth(date.getMonth() + numOfMonths);

        // Get the selected Pro plan name
        const proPlanName = pro.getProPlanName(discountInfo.al);

        // Update text for "When the #-month/year promotion ends on 26 April, 2024 you will start a
        // recurring monthly/yearly subscription for Pro I of EUR9.99 and your card will be billed monthly/yearly."
        discountRecurringText = mega.icu.format(discountRecurringText, monthsOrYears);
        discountRecurringText = discountRecurringText.replace('%1', time2date(date.getTime() / 1000, 2));
        discountRecurringText = discountRecurringText.replace('%2', proPlanName);
        discountRecurringText = discountRecurringText.replace('%3', price);

        return discountRecurringText;
    },

    /**
     * Render the payment providers as radio buttons
     * @param {Object} gatewayOptions The list of gateways from the API
     * @param {String} primaryOrSecondary Which list to render the gateways into i.e. 'primary' or 'secondary'
     */
    renderPaymentProviderOptions: function(gatewayOptions, primaryOrSecondary) {

        // Get their plan price from the currently selected duration radio button
        var selectedPlanIndex = $('.duration-options-list .membership-radio.checked', 'body')
            .parent().attr('data-plan-index');
        var selectedPlan = pro.membershipPlans[selectedPlanIndex];
        var selectedPlanNum = selectedPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];
        var selectedPlanPrice = selectedPlan[pro.UTQA_RES_INDEX_PRICE];

        // Convert to float for numeric comparisons
        var planPriceFloat = parseFloat(selectedPlanPrice);
        var balanceFloat = parseFloat(pro.propay.proBalance);
        var gatewayHtml = '';

        // Cache the template selector
        var $template = $('.payment-options-list.primary .payment-method.template', 'body');

        // Remove existing providers and so they are re-rendered
        $('.payment-options-list.' + primaryOrSecondary
          + ' .payment-method:not(.template)', 'body').remove();
        $('.loading-placeholder-text', 'body').addClass('hidden');

        const svgicons = {
            visa: 'icon-visa-border',
            mastercard: 'icon-mastercard',
            'unionpay': 'icon-union-pay',
            'american express': 'icon-amex',
            jcb: 'icon-jcb',
        };

        // Loop through gateway providers (change to use list from API soon)
        for (var i = 0, length = gatewayOptions.length; i < length; i++) {

            var $gateway = $template.clone();
            var gatewayOpt = gatewayOptions[i];
            var gatewayId = gatewayOpt.gatewayId;

            // Get the gateway name and display name
            var gatewayInfo = pro.getPaymentGatewayName(gatewayId, gatewayOpt);
            var gatewayName = gatewayInfo.name;
            var displayName = gatewayInfo.displayName;

            // If it couldn't find the name (e.g. new provider, use the name from the API)
            if (gatewayInfo.name === 'unknown') {
                continue;
            }

            // Add hidden class if this payment method is not supported for this plan
            if ((gatewayOpt.supportsExpensivePlans === 0) && pro.filter.simple.supportsExpensive.has(selectedPlan)) {
                $gateway.addClass('hidden');
                $gateway.attr('title', l[7162]);
            }

            // If the voucher/balance option
            if ((gatewayId === 0) && (balanceFloat >= planPriceFloat)) {

                // Show "Balance (x.xx)" if they have enough to purchase this plan
                displayName = l[7108] + ' (' + balanceFloat.toFixed(2) + ' \u20ac)';
            }

            // Create a radio button with icon for each payment gateway
            $gateway.removeClass('template');
            $('input', $gateway).attr('name', gatewayName);
            $('input', $gateway).attr('id', gatewayName);
            $('input', $gateway).val(gatewayName);

            const iconkeys = Object.keys(svgicons);
            let iconkey;

            for (let i = iconkeys.length; i--;) {
                if (displayName.toLowerCase().includes(iconkeys[i])) {
                    iconkey = iconkeys[i];
                    break;
                }
            }

            if (iconkey) {
                $('.provider-icon', $gateway).addClass('svgicon')
                    .safeHTML(`<i class="sprite-fm-uni ${svgicons[iconkey]}"></i>`);
            }
            else {
                $('.provider-icon', $gateway).addClass(gatewayName);
            }
            $('.provider-name', $gateway).text(displayName).prop('title', displayName);

            // Build the html
            gatewayHtml += $gateway.prop('outerHTML');
        }

        // Update the page
        $(gatewayHtml).appendTo($('.payment-options-list.' + primaryOrSecondary));
    },

    /**
     * Change payment method radio button states when clicked
     */
    initPaymentMethodRadioButtons: function() {

        // Cache selector
        var $paymentOptionsList = $('.payment-options-list', '.fmholder');

        // Add click handler to all payment methods
        $('.payment-method', $paymentOptionsList).rebind('click.changeState', function() {

            var $this = $(this);

            // Don't let the user select this option if it's disabled e.g. it is disabled because
            // they must select a cheaper plan to work with this payment provider e.g. Fortumo
            if ($this.hasClass('disabled')) {
                return false;
            }

            // Remove checked state from all radio inputs
            $('.membership-radio', $paymentOptionsList).removeClass('checked');
            $('.provider-details', $paymentOptionsList).removeClass('checked');
            $('input', $paymentOptionsList).prop('checked', false);

            // Add checked state for this radio button
            $('input', $this).prop('checked', true);
            $('.membership-radio', $this).addClass('checked');
            $('.provider-details', $this).addClass('checked');

            pro.propay.updateTextDependingOnRecurring();
            pro.propay.updateDurationOptionsOnProviderChange();
        });
    },

    /**
     * Preselect an option they previously paid with if applicable
     */
    preselectPreviousPaymentOption: function() {

        // If they have paid before and their plan has expired, then re-select their last payment method
        if (alarm.planExpired.lastPayment) {

            // Get the last gateway they paid with
            var lastPayment = alarm.planExpired.lastPayment;
            var gatewayId = lastPayment.gw;

            // Get the gateway name, if it's a subgateway, then it will have it's own name
            var gatewayInfo = pro.getPaymentGatewayName(gatewayId);
            var extraData = (typeof lastPayment.gwd !== 'undefined') ? lastPayment.gwd : null;
            var gatewayName = (typeof lastPayment.gwd !== 'undefined') ? extraData.gwname : gatewayInfo.name;

            // Find the gateway
            var $gatewayInput = $('#' + gatewayName);

            // If it is still in the list (e.g. valid provider still)
            if ($gatewayInput.length) {

                // Get the elements which need to be set
                var $membershipRadio = $gatewayInput.parent();
                var $providerDetails = $membershipRadio.next();
                var $secondaryPaymentOptions = $('.payment-options-list.secondary', 'body');
                var $showMoreButton = $('.provider-show-more', '.payment-section');

                // Set to checked
                $gatewayInput.prop('checked', true);
                $membershipRadio.addClass('checked');
                $providerDetails.addClass('checked');

                // If the gateway is in the secondary list, then show the secondary list and hide the button
                if ($secondaryPaymentOptions.find('#' + gatewayName).prop('checked')) {
                    $secondaryPaymentOptions.removeClass('hidden');
                    $showMoreButton.hide();
                }
            }
            else {
                // Otherwise select the first available payment option because this provider is no longer available
                pro.propay.preselectPaymentOption();
            }
        }
        else {
            // Otherwise select the first available payment option
            pro.propay.preselectPaymentOption();
        }
    },

    /**
     * Preselects the payment option in the list of payment providers. Pro balance should be selected first if
     * they have a balance, otherwise the next payment provider should be selected (which is usually Visa)
     */
    preselectPaymentOption: function() {

        'use strict';

        // Find the primary payment options
        var $payOptions = $(
            '.payment-options-list.primary .payment-method:not(.template)',
            '.fmholder:not(.hidden)'
        );

        // If they have a Pro balance, select the first option, otherwise select
        // the next payment option (usually API will have it ordered to be Visa)
        var $option = (parseFloat(pro.propay.proBalance) > 0) ? $payOptions.first()
            : $payOptions.length > 1 ? $payOptions.eq(1) : $payOptions.eq(0);

        // Check the radio button option
        $('input', $option).prop('checked', true);
        $('.membership-radio', $option).addClass('checked');
        $('.provider-details', $option).addClass('checked');
    },

    /**
     * Updates the duration/renewal period options if they select a payment method. For example
     * for the wire transfer option we only want to accept one year one-off payments
     */
    updateDurationOptionsOnProviderChange: function() {

        var $durationOptionsList = $('.duration-options-list', 'body');
        var $durationOptions = $('.payment-duration:not(.template)', $durationOptionsList);
        var selectedPlanIndex = $('.membership-radio.checked', $durationOptionsList).parent()
                                    .attr('data-plan-index');
        var selectedGatewayName = $('.payment-options-list input:checked', 'body').val();
        var selectedProvider = pro.propay.allGateways.filter(function(val) {
            return (val.gatewayName === selectedGatewayName);
        })[0];

        // Reset all options, they will be hidden or checked again if necessary below
        $durationOptions.removeClass('hidden');
        $('.membership-radio', $durationOptions).removeClass('checked');
        $('.membership-radio-label', $durationOptions).removeClass('checked');
        $('input', $durationOptions).prop('checked', false);

        // Loop through renewal period options (1 month, 1 year)
        $.each($durationOptions, function(key, durationOption) {

            var $durOpt = $(durationOption);
            // Get the plan's number of months
            var planIndex = $durOpt.attr('data-plan-index');
            var currentPlan = pro.membershipPlans[planIndex];
            var numOfMonths = currentPlan[pro.UTQA_RES_INDEX_MONTHS];

            $durOpt.removeClass('disabled');

            // If the currently selected payment option e.g. Wire transfer
            // doesn't support a 1 month payment hide the option
            if (((!selectedProvider.supportsMonthlyPayment) && (numOfMonths === 1)) ||
                ((!selectedProvider.supportsAnnualPayment) && (numOfMonths === 12))) {
                $durOpt.addClass('hidden');
            }
            else {
                // Show the option otherwise
                $durOpt.removeClass('hidden');
                if (selectedProvider.minimumEURAmountSupported &&
                    selectedProvider.minimumEURAmountSupported > currentPlan[pro.UTQA_RES_INDEX_PRICE]) {
                    $durOpt.addClass('disabled');
                }
            }
        });

        // Select the first remaining option or previously selected (if its not hidden)
        var $newDurationOption;
        var newPlanIndex;
        $newDurationOption = $('[data-plan-index=' + selectedPlanIndex + ']', $durationOptionsList);
        if ($newDurationOption.length && !$newDurationOption.hasClass('hidden') &&
            !$newDurationOption.hasClass('disabled')) {
            newPlanIndex = selectedPlanIndex;
        }
        else {
            $newDurationOption = $('.payment-duration:not(.template, .hidden, .disabled)', $durationOptionsList)
                .first();
            newPlanIndex = $newDurationOption.attr('data-plan-index');
        }
        $('.membership-radio', $newDurationOption).addClass('checked');
        $('.membership-radio-label', $newDurationOption).addClass('checked');
        $('input', $newDurationOption).prop('checked', true);

        // Update the text for one-time or recurring
        pro.propay.updateMainPrice(newPlanIndex);
        pro.propay.updateTextDependingOnRecurring();
    },

    /**
     * Initialise the button to show more payment options
     */
    initShowMoreOptionsButton: function() {

        // If there are more than 6 payment options, enable the button to show more
        if (pro.propay.allGateways.length > 9) {

            var $showMoreButton = $('.provider-show-more', '.payment-section');

            // Show the button
            $showMoreButton.removeClass('hidden');

            // On clicking 'Click here to show more payment options'
            $showMoreButton.rebind('click.shoMore', function() {

                // Show the other payment options and then hide the button
                $('.payment-options-list.secondary', 'body').removeClass('hidden');
                $showMoreButton.hide();

                // Trigger resize or you can't scroll to the bottom of the page anymore
                $(window).trigger('resize');
            });
        }
    },

    /**
     * Start the purchase process
     */
    startPurchaseProcess: function() {

        // Get the selected payment duration and gateway
        const $selectedPaymentDuration = $('.duration-options-list .membership-radio.checked', this.$page);
        const $selectedPaymentGateway = $('.payment-options-list input:checked', this.$page);

        // Selected payment method and package
        var selectedPaymentGatewayName = $selectedPaymentGateway.val();
        var selectedProvider = pro.propay.allGateways.filter(function(val) {
            return (val.gatewayName === selectedPaymentGatewayName);
        })[0];

        // Get array index of the Pro package in the list of plans from the API
        var selectedProPackageIndex = $selectedPaymentDuration.parent().attr('data-plan-index');

        // Set the pro package (used in pro.propay.sendPurchaseToApi function)
        pro.propay.selectedProPackage = pro.membershipPlans[selectedProPackageIndex];

        // log button clicking
        delay('subscribe.plan', eventlog.bind(null, 99788));

        if (u_type === false) {

            u_storage = init_storage(localStorage);
            loadingDialog.show();

            u_checklogin({ checkloginresult: function() {
                pro.propay.sendPurchaseToApi();

            }}, true);
        }
        else {
            // Store the gateway name for later
            pro.propay.proPaymentMethod = selectedPaymentGatewayName;
            console.assert(pro.propay.proPaymentMethod, 'check this...invalid gateway');

            // For credit card we show the dialog first, then do the uts/utc calls
            if (pro.propay.proPaymentMethod === 'perfunctio') {
                cardDialog.init();
            }
            else if (String(pro.propay.proPaymentMethod).indexOf('ecp') === 0
                || String(pro.propay.proPaymentMethod).toLowerCase().indexOf('stripe') === 0) {

                if (pro.propay.userSubsGatewayId === 2 || pro.propay.userSubsGatewayId === 3) {
                    // Detect the user has subscribed to a Pro plan with Google Play or Apple store
                    // pop up the warning dialog but let the user proceed with an upgrade
                    msgDialog('warninga', '', l.warning_has_subs_with_3p, '', () => {
                        addressDialog.init();
                    });
                }
                else {
                    addressDialog.init();
                }
            }
            else if (pro.propay.proPaymentMethod === 'voucher') {
                voucherDialog.init();
            }
            else if (pro.propay.proPaymentMethod === 'wiretransfer') {
                wireTransferDialog.init();
            }
            else if (selectedProvider.gatewayId === astroPayDialog.gatewayId) {
                astroPayDialog.init(selectedProvider);
            }
            else {
                // For other methods we do a uts and utc call to get the provider details first
                pro.propay.sendPurchaseToApi();
            }
        }
    },

    /**
     * Continues the Pro purchase and initiates the
     */
    sendPurchaseToApi: function() {

        // Show different loading animation text depending on the payment methods
        switch (pro.propay.proPaymentMethod) {
            case 'bitcoin':
                pro.propay.showLoadingOverlay('loading');
                break;
            case 'pro_prepaid':
            case 'perfunctio':
                pro.propay.showLoadingOverlay('processing');
                break;
            default:
                pro.propay.showLoadingOverlay('transferring');
        }

        // Data for API request
        var apiId = pro.propay.selectedProPackage[pro.UTQA_RES_INDEX_ID];
        var price = pro.propay.selectedProPackage[pro.UTQA_RES_INDEX_PRICE];
        var currency = pro.propay.selectedProPackage[pro.UTQA_RES_INDEX_CURRENCY];
        const itemNum = pro.propay.selectedProPackage[pro.UTQA_RES_INDEX_ITEMNUM];

        // Convert from boolean to integer for API
        var fromBandwidthDialog = ((Date.now() - parseInt(localStorage.seenOverQuotaDialog)) < 2 * 3600000) ? 1 : 0;
        var fromPreWarnBandwidthDialog = ((Date.now() - parseInt(localStorage.seenQuotaPreWarn)) < 2 * 36e5) ? 1 : 0;

        // uts = User Transaction Sale
        var utsRequest = {
            a:  'uts',
            it:  itemNum,
            si:  apiId,
            p:   price,
            c:   currency,
            aff: mega.affid,
            m:   m,
            bq:  fromBandwidthDialog,
            pbq: fromPreWarnBandwidthDialog
        };

        if (mega.uaoref) {
            utsRequest.uao = escapeHTML(mega.uaoref);
        }

        // If the plan was chosen immediately after registration, add an 'fr' (from registration) log to the request
        if (pro.propay.planChosenAfterRegistration) {
            utsRequest.fr = 1;
        }
        if (localStorage.keycomplete) {
            delete localStorage.keycomplete;
        }

        // Add the discount information to the User Transaction Sale request
        if (mega.discountInfo && mega.discountInfo.dc) {
            utsRequest.dc = mega.discountInfo.dc;
        }

        const setValues = (extra, saleId) => {

            if (pro.propay.proPaymentMethod === 'voucher' || pro.propay.proPaymentMethod === 'pro_prepaid') {
                pro.lastPaymentProviderId = 0;
            }
            else if (pro.propay.proPaymentMethod === 'bitcoin') {
                pro.lastPaymentProviderId = 4;
            }
            else if (pro.propay.proPaymentMethod === 'perfunctio') {
                pro.lastPaymentProviderId = 8;
            }
            else if (pro.propay.proPaymentMethod === 'dynamicpay') {
                pro.lastPaymentProviderId = 5;
            }
            else if (pro.propay.proPaymentMethod === 'fortumo') {
                // pro.lastPaymentProviderId = 6;
                // Fortumo does not do a utc request, we immediately redirect
                fortumo.redirectToSite(saleId);
                return false;
            }
            else if (pro.propay.proPaymentMethod === 'infobip') {
                // pro.lastPaymentProviderId = 9;
                // Centili does not do a utc request, we immediately redirect
                centili.redirectToSite(saleId);
                return false;
            }
            else if (pro.propay.proPaymentMethod === 'paysafecard') {
                pro.lastPaymentProviderId = 10;
            }
            else if (pro.propay.proPaymentMethod === 'tpay') {
                pro.lastPaymentProviderId = tpay.gatewayId; // 14
            }
            else if (pro.propay.proPaymentMethod.indexOf('directreseller') === 0) {
                pro.lastPaymentProviderId = directReseller.gatewayId; // 15
            }

            // If AstroPay, send extra details
            else if (pro.propay.proPaymentMethod.indexOf('astropay') > -1) {
                pro.lastPaymentProviderId = astroPayDialog.gatewayId;
                extra.bank = astroPayDialog.selectedProvider.extra.code;
                extra.name = astroPayDialog.fullName;
                extra.address = astroPayDialog.address;
                extra.city = astroPayDialog.city;
                extra.cpf = astroPayDialog.taxNumber;
            }

            // If Ecomprocessing, send extra details
            else if (pro.propay.proPaymentMethod.indexOf('ecp') === 0) {
                pro.lastPaymentProviderId = addressDialog.gatewayId;
                Object.assign(extra, addressDialog.extraDetails);
            }
            else if (pro.propay.proPaymentMethod.indexOf('sabadell') === 0) {
                pro.lastPaymentProviderId = sabadell.gatewayId; // 17

                // If the provider supports recurring payments set extra.recurring as true
                extra.recurring = true;
            }
            else if (pro.propay.proPaymentMethod.toLowerCase().indexOf('stripe') === 0) {
                Object.assign(extra, addressDialog.extraDetails);
                pro.lastPaymentProviderId = addressDialog.gatewayId_stripe;
            }

            return true;
        };

        // Setup the 'uts' API request
        api.screq(utsRequest)
            .then(({result: saleId}) => {

                // Extra gateway specific details for UTC call
                var extra = {};

                if (!setValues(extra, saleId)) {
                    return false;
                }

                // If saleId is already an array of sale IDs use that, otherwise add to an array
                const saleIdArray = Array.isArray(saleId) ? saleId : [saleId];

                // Complete the transaction
                let utcReqObj = {
                    a: 'utc',                       // User Transaction Complete
                    s: saleIdArray,                 // Array of Sale IDs
                    m: pro.lastPaymentProviderId,   // Gateway number
                    bq: fromBandwidthDialog,        // Log for bandwidth quota triggered
                    extra: extra                    // Extra information for the specific gateway
                };
                const discountInfo = pro.propay.getDiscount();
                if (discountInfo && discountInfo.dc) {
                    utcReqObj.dc = discountInfo.dc;
                }

                return api.screq(utcReqObj).then(({result}) => this.processUtcResults(result, saleId));
            })
            .catch((ex) => {
                // Default error is "Something went wrong. Try again later..."
                let errorMessage;

                // Handle specific discount errors
                if (ex === EEXPIRED) {
                    // The discount code has expired.
                    errorMessage = l[24675];
                }
                else if (ex === EEXIST) {
                    // This discount code has already been redeemed.
                    errorMessage = l[24678];
                }
                else if (ex === EOVERQUOTA && pro.lastPaymentProviderId === voucherDialog.gatewayId) {

                    // Insufficient balance, try again...
                    errorMessage = l[514];
                }
                else {
                    errorMessage = ex < 0 ? api_strerror(ex) : ex;
                }

                // Hide the loading overlay and show an error
                pro.propay.hideLoadingOverlay();

                tell(errorMessage);
            });
    },

    /**
     * Process results from the API User Transaction Complete call
     * @param {Object|Number} utcResult The results from the UTC call or a negative number on failure
     * @param {String}        saleId    The saleIds of the purchase.
     */
    async processUtcResults(utcResult, saleId) {
        'use strict';

        const welDlgAttr =
            parseInt(await Promise.resolve(mega.attr.get(u_handle, 'welDlg', -2, true)).catch(nop)) | 0;

        // If the user has purchased a subscription and they haven't seen the welcome dialog before (
        // u_attr[^!welDlg] = 0), set welDlg to 1 which will show it when the psts notification arrives.
        // If the payment fails the welcome dialog will check if the user has a pro plan, and as such should still
        // work as expected.
        if (!welDlgAttr) {
            mega.attr.set('welDlg', 1, -2, true);
        }

        // Handle results for different payment providers
        switch (pro.lastPaymentProviderId) {

            // If using prepaid balance
            case voucherDialog.gatewayId:
                voucherDialog.showSuccessfulPayment();
                break;

            // If Bitcoin provider then show the Bitcoin invoice dialog
            case bitcoinDialog.gatewayId:
                bitcoinDialog.processUtcResult(utcResult);
                break;

            // If Dynamic/Union Pay provider then redirect to their site
            case unionPay.gatewayId:
                unionPay.redirectToSite(utcResult);
                break;

            // If credit card provider
            case cardDialog.gatewayId:
                cardDialog.processUtcResult(utcResult);
                break;

            // If paysafecard provider then redirect to their site
            case paysafecard.gatewayId:
                paysafecard.redirectToSite(utcResult);
                break;

            // If AstroPay result, redirect
            case astroPayDialog.gatewayId:
                astroPayDialog.processUtcResult(utcResult);
                break;

            // If Ecomprocessing result, redirect
            case addressDialog.gatewayId:
                addressDialog.processUtcResult(utcResult);
                break;

            // If tpay, redirect over there
            case tpay.gatewayId:
                tpay.redirectToSite(utcResult);
                break;

            // If 6media, redirect to the site
            case directReseller.gatewayId:
                directReseller.redirectToSite(utcResult);
                break;

            // If sabadell, redirect to the site
            case sabadell.gatewayId:
                sabadell.redirectToSite(utcResult);
                break;

            case addressDialog.gatewayId_stripe:
                addressDialog.processUtcResult(utcResult, true, saleId);
                break;
        }
    },

    /**
     * Generic function to show the bouncing megacoin icon while loading
     * @param {String} messageType Which message to display e.g. 'processing', 'transferring', 'loading'
     */
    showLoadingOverlay: function(messageType) {

        // Show the loading gif
        pro.propay.$backgroundOverlay.removeClass('hidden')
            .addClass('payment-dialog-overlay');
        pro.propay.$loadingOverlay.removeClass('hidden');

        // Prevent clicking on the background overlay while it's loading, which makes
        // the background disappear and error triangle appear on white background
        $('.fm-dialog-overlay.payment-dialog-overlay').rebind('click', function(event) {
            event.stopPropagation();
        });

        var message = '';

        // Choose which message to display underneath the animation
        if (messageType === 'processing') {
            message = l[6960];                  // Processing your payment...
        }
        else if (messageType === 'transferring') {
            message = l[7203];                  // Transferring to payment provider...
        }
        else if (messageType === 'loading') {
            message = l[7006];                  // Loading...
        }

        // Display message
        $('.payment-animation-txt', pro.propay.$loadingOverlay).text(message);
    },

    /**
     * Hides the payment processing/transferring/loading overlay
     */
    hideLoadingOverlay: function() {
        if (pro.propay.$backgroundOverlay && pro.propay.$loadingOverlay) {
            pro.propay.$backgroundOverlay.addClass('hidden')
                .removeClass('payment-dialog-overlay');
            pro.propay.$loadingOverlay.addClass('hidden');
        }
    },

    /**
     * Gets the wording for the plan subscription duration in months or years.
     * This is used by a number of the payment provider dialogs.
     * @param {Number} numOfMonths The number of months
     * @returns {String} Returns the number of months e.g. '1 month', '1 year'
     */
    getNumOfMonthsWording: function(numOfMonths) {

        let monthsWording;
        // Change wording depending on number of months
        if (numOfMonths === 12) {
            monthsWording = l[923];     // 1 year
        }
        else {
            monthsWording = mega.icu.format(l[922], numOfMonths); // 1 month
        }

        return monthsWording;
    },

    /** This function to show the discount offer dialog if applies */
    showDiscountOffer: function() {
        'use strict';
        if (window.offerPopupTimer) {
            clearTimeout(window.offerPopupTimer);
        }
        if (is_mobile || typeof page !== 'string' || page.includes('propay')) {
            return;
        }

        if (u_attr && u_attr.mkt && Array.isArray(u_attr.mkt.dc) && u_attr.mkt.dc.length) {
            // if we have multiple offers, we have no preferences we will take the first one.
            const offer = u_attr.mkt.dc[0];

            // check if we previewed a popup in the past 20 hours
            let discountOffers = u_attr['^!discountoffers'] ? JSON.parse(u_attr['^!discountoffers']) : null;
            if (discountOffers && discountOffers[offer.dc]) {
                const timeDif = new Date().getTime() - discountOffers[offer.dc];
                if (timeDif < 72e6) {
                    if (timeDif > 0) {
                        window.offerPopupTimer = setTimeout(pro.propay.showDiscountOffer, 72e6 - timeDif + 10);
                    }
                    return;
                }
            }
            discountOffers = discountOffers || Object.create(null);

            if (offer.al && offer.pd && typeof offer.m !== 'undefined') {
                const $discountDlg = $('.mega-dialog.pro-discount', 'body');
                let title = l[24703];
                if (offer.m === 1) {
                    title = l[24702];
                }
                else if (offer.m === 12) {
                    title = l[24701];
                }
                title = title.replace('%1', offer.pd + '%').replace('%2', pro.getProPlanName(offer.al));
                $('.discount-title', $discountDlg).text(title);
                pro.loadMembershipPlans(() => {
                    const matchedPlan = pro.membershipPlans.find(plan => {
                        return plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] === offer.al
                            && plan[pro.UTQA_RES_INDEX_MONTHS] === (offer.m || 12);
                    });
                    if (matchedPlan) {
                        const storageFormatted = numOfBytes(matchedPlan[pro.UTQA_RES_INDEX_STORAGE] * 1073741824, 0);
                        const desc = l[24704]
                            .replace('%1', Math.round(storageFormatted.size) + ' ' + storageFormatted.unit);
                        $('.discount-desc', $discountDlg).text(desc);

                        let discountPopupPref = new Date().getTime();
                        let reTrigger = true;

                        const storeViewTime = () => {
                            discountOffers[offer.dc] = discountPopupPref;
                            mega.attr.set('discountoffers', JSON.stringify(discountOffers), -2, true);
                        };

                        // binding events
                        $('button.js-close, .close-btn', $discountDlg).rebind('click.discount', (ev) => {
                            storeViewTime();
                            window.closeDialog();
                            if (reTrigger) {
                                window.offerPopupTimer = setTimeout(pro.propay.showDiscountOffer, 72e6);
                            }
                            mBroadcaster.sendMessage(
                                'trk:event',
                                'discountPopup',
                                'closed',
                                'btnUsed',
                                ev.currentTarget.className.indexOf('close-btn') > -1 ? 1 : 0);
                            mBroadcaster.sendMessage(
                                'trk:event',
                                'discountPopup',
                                'closed',
                                'notShowAgain',
                                reTrigger ? 0 : 1);
                        });

                        $('.get-btn', $discountDlg).rebind('click.discount', () => {
                            storeViewTime();
                            $discountDlg.addClass('hidden');
                            if (reTrigger) {
                                window.offerPopupTimer = setTimeout(pro.propay.showDiscountOffer, 72e6);
                            }
                            loadSubPage('discount' + offer.dc);
                            mBroadcaster.sendMessage(
                                'trk:event',
                                'discountPopup',
                                'requested',
                                'notShowAgain',
                                reTrigger ? 0 : 1);
                        });

                        $('.fm-picker-notagain.checkbox-block', $discountDlg).rebind('click.discount', () => {
                            const $check = $('.fm-picker-notagain.checkbox-block .checkdiv', $discountDlg);
                            if ($check.hasClass('checkboxOff')) {
                                $check.removeClass('checkboxOff').addClass('checkboxOn');
                                discountPopupPref = new Date(9999, 11, 30).getTime();
                                reTrigger = false;
                            }
                            else {
                                $check.addClass('checkboxOff').removeClass('checkboxOn');
                                discountPopupPref = new Date().getTime();
                                reTrigger = true;
                            }
                        });
                        M.safeShowDialog('discount-offer', $discountDlg, true);
                        mBroadcaster.sendMessage('trk:event', 'discountPopup', 'shown');
                    }
                });
            }
        }
    },

    showAccountRequiredDialog() {
        'use strict';

        if (is_mobile) {
            login_next = page;
            mobile.proSignupPrompt.init();
            return;
        }

        if (!pro.propay.accountRequiredDialog) {
            pro.propay.accountRequiredDialog = new mega.ui.Dialog({
                className: 'loginrequired-dialog',
                focusable: false,
                expandable: false,
                requiresOverlay: true,
                title: l[5841],
            });
        }
        else {
            pro.propay.accountRequiredDialog.visible = false; // Allow it to go through the show() motions again
        }

        pro.propay.accountRequiredDialog.bind('onBeforeShow', () => {
            const $dialog = pro.propay.accountRequiredDialog.$dialog;

            $dialog.addClass('with-close-btn');

            let loginProceed = false;
            $('.pro-login', $dialog).rebind('click.loginrequired', () => {
                loginProceed = true;
                pro.propay.accountRequiredDialog.hide();
                showLoginDialog();
                return false;
            });

            $('header p', $dialog).text(l[5842]);

            $('.pro-register', $dialog).rebind('click.loginrequired', () => {
                loginProceed = true;
                pro.propay.accountRequiredDialog.hide();
                if (u_wasloggedin()) {
                    var msg = l[8743];
                    msgDialog('confirmation', l[1193], msg, null, res => {
                        if (res) {
                            showRegisterDialog();
                        }
                        else {
                            showLoginDialog();
                        }
                    });
                }
                else {
                    showRegisterDialog();
                }
                return false;
            });

            pro.propay.accountRequiredDialog.rebind('onHide', () => {
                if (!loginProceed) {
                    loadSubPage('pro');
                }
            });
        });

        pro.propay.accountRequiredDialog.show();
    },
};
mBroadcaster.once('login2', () => {
    'use strict';
    delay('ShowDiscountOffer', pro.propay.showDiscountOffer, 5000);
});

/**
 * This file contains all the logic for different payment providers, some use dialogs to collect
 * extra information before sending to the API, others redirect directly to the payment provider.
 * Some of the code in this page is also used by the first step of the Pro page to handle return
 * URLS from the payment provider.
 */

var closeButtonJS = 'button.js-close';

var closeStripeDialog = () => {
    'use strict';

    closeDialog();
    $('.fm-dialog-overlay').off('click.stripeDialog');
    $(document).off('keydown.stripeDialog');
};

var resizeDlgScrollBar = function($targetDialog) {
    'use strict';

    const $contentSection = $('section.content', $targetDialog);
    if ($contentSection.is('.ps')) {
        Ps.update($contentSection[0]);
    }
    else {
        Ps.initialize($contentSection[0]);
    }
};

/**
 * Code for the AstroPay dialog on the second step of the Pro page
 */
var astroPayDialog = {

    $dialog: null,
    $backgroundOverlay: null,
    $pendingOverlay: null,
    $propayPage: null,

    // Constant for the AstroPay gateway ID
    gatewayId: 11,

    // The provider details
    selectedProvider: null,

    // Cached details to be sent on submit
    fullName: '',
    address: '',
    city: '',
    taxNumber: '',

    confirmationIsShowing: false,

    /**
     * Initialise
     * @param {Object} selectedProvider
     */
    init: function (selectedProvider) {

        /* Testing stub for different AstroPay tax validation
        selectedProvider = {
            displayName: 'AstroPay Visa',
            gatewayId: 11,
            gatewayName: 'astropayVI',
            supportsAnnualPayment: 1,
            supportsExpensivePlans: 1,
            supportsMonthlyPayment: 1,
            supportsRecurring: 1,
            type: "subgateway",
            extra: {
                taxIdLabel: 'CPF'
            }
        };
        //*/

        // Cache DOM reference for lookup in other functions
        this.$dialog = $('.astropay-dialog');
        this.$backgroundOverlay = $('.fm-dialog-overlay');
        this.$pendingOverlay = $('.payment-result.pending.original');
        this.$propayPage = $('.payment-section', 'body');

        // Store the provider details
        this.selectedProvider = selectedProvider;

        // Initalise the rest of the dialog
        this.initCloseButton();
        this.initConfirmButton();
        this.updateDialogDetails();
        this.showDialog();
    },

    /**
     * Update the dialog details
     */
    updateDialogDetails: function () {

        // Get the gateway name
        var gatewayName = this.selectedProvider.gatewayName;

        // Change icon and payment provider name
        this.$dialog.find('.provider-icon').removeClass().addClass('provider-icon ' + gatewayName);
        this.$dialog.find('.provider-name').text(this.selectedProvider.displayName);

        // Localise the tax label to their country e.g. GST, CPF
        var taxLabel = l[7989].replace('%1', this.selectedProvider.extra.taxIdLabel);
        var taxPlaceholder = l[7990].replace('%1', this.selectedProvider.extra.taxIdLabel);

        // If on mobile, the input placeholder text is just 'CPF Number'
        if (is_mobile) {
            taxPlaceholder = taxLabel;
        }

        // If they have previously paid before with Astropay
        if (!is_mobile && (alarm.planExpired.lastPayment) && (alarm.planExpired.lastPayment.gwd)) {

            // Get the extra data from the gateway details
            var firstLastName = alarm.planExpired.lastPayment.gwd.name;
            var taxNum = alarm.planExpired.lastPayment.gwd.cpf;

            // Prefill the user's name and tax details
            this.$dialog.find('.astropay-name-field').val(firstLastName);
            this.$dialog.find('.astropay-tax-field').val(taxNum);
        }

        // Change the tax labels
        this.$dialog.find('.astropay-label.tax').text(taxLabel + ':');
        this.$dialog.find('.astropay-tax-field').attr('placeholder', taxPlaceholder);

        // If the provider doesn't support extra address information, hide it.
        // Currently only India needs Address and City, but others may need them in future.
        if (!this.selectedProvider.supportsExtraAddressInfo) {
            this.$dialog.find('.astropay-label.address').addClass('hidden');
            this.$dialog.find('.astropay-address-field').parent().addClass('hidden');
            this.$dialog.find('.astropay-label.city').addClass('hidden');
            this.$dialog.find('.astropay-city-field').parent().addClass('hidden');
        }
    },

    /**
     * Display the dialog
     */
    showDialog: function () {

        this.$dialog.removeClass('hidden');
        this.showBackgroundOverlay();

        // Hide the Propage page
        if (is_mobile) {
            this.$propayPage.addClass('hidden');
        }

        if (!is_mobile) {
            // Keep the ps scrollbar block code after remove the hidden class from the dialog
            // so that it shows the scrollbar initially
            resizeDlgScrollBar(this.$dialog);

            $(window).rebind('resize.billAddressDlg', resizeDlgScrollBar.bind(null, this.$dialog));
        }
    },

    /**
     * Hide the overlay and dialog
     */
    hideDialog: function () {

        this.$backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
        this.$dialog.addClass('hidden');

        // Show the Propage page
        if (is_mobile) {
            this.$propayPage.removeClass('hidden');
        }
        else {
            $(window).unbind('resize.billAddressDlg');
        }
    },

    /**
     * Shows the background overlay
     */
    showBackgroundOverlay: function () {

        // Show the background overlay only for desktop
        if (!is_mobile) {
            this.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');
        }
    },

    /**
     * Functionality for the close button
     */
    initCloseButton: function () {
        "use strict";
        // Initialise the close and cancel buttons
        this.$dialog.find('button.js-close, .cancel').rebind('click', function() {

            // Hide the overlay and dialog
            astroPayDialog.hideDialog();
        });

        // Prevent close of dialog from clicking outside the dialog
        $('.fm-dialog-overlay.payment-dialog-overlay').rebind('click', function (event) {
            event.stopPropagation();
        });
    },

    /**
     * Get the details entered by the user and redirect to AstroPay
     */
    initConfirmButton: function () {
        "use strict";
        this.$dialog.find('.accept').rebind('click', function () {

            // Store the full name and tax number entered
            astroPayDialog.fullName = $.trim(astroPayDialog.$dialog.find('#astropay-name-field').val());
            astroPayDialog.address = $.trim(astroPayDialog.$dialog.find('#astropay-address-field').val());
            astroPayDialog.city = $.trim(astroPayDialog.$dialog.find('#astropay-city-field').val());
            astroPayDialog.taxNumber = $.trim(astroPayDialog.$dialog.find('#astropay-tax-field').val());

            // Make sure they entered something
            if ((astroPayDialog.fullName === '') || (astroPayDialog.fullName === '')) {

                // Show error dialog with Missing payment details
                msgDialog('warninga', l[6958], l[6959], '', function () {
                    astroPayDialog.showBackgroundOverlay();
                });

                return false;
            }

            // If the tax number is invalid, show an error dialog
            if (!astroPayDialog.taxNumberIsValid()) {

                msgDialog('warninga', l[6958], l[17789], '', function () {
                    astroPayDialog.showBackgroundOverlay();
                });

                return false;
            }

            // Try redirecting to payment provider
            astroPayDialog.hideDialog();
            pro.propay.sendPurchaseToApi();
        });
    },

    /**
     * Checks if the tax number provided is valid for that tax label
     * @returns {Boolean} Returns true if valid, false if not
     */
    taxNumberIsValid: function () {

        'use strict';

        // Use the tax label from the API and the tax number entered by the user
        var taxLabel = astroPayDialog.selectedProvider.extra.taxIdLabel;
        var taxNum = astroPayDialog.taxNumber;

        // Remove special characters and check the length
        var taxNumCleaned = taxNum.replace(/([~!@#$%^&*()_+=`{}\[\]\-|\\:;'<>,.\/? ])+/g, '');
        var taxNumLength = taxNumCleaned.length;

        // Check for Peru (between 8 and 9) and Argentina (between 7 and 9 or 11)
        if (taxLabel === 'DNI' && taxNumLength >= 7 && taxNumLength <= 11) {
            return true;
        }

        // Check for Mexico (between 10 and 18)
        else if (taxLabel === 'CURP / RFC / IFE' && taxNumLength >= 10 && taxNumLength <= 18) {
            return true;
        }

        // Check for Colombia (between 6 and 10)
        else if (taxLabel === 'NUIP / CC / RUT' && taxNumLength >= 6 && taxNumLength <= 10) {
            return true;
        }

        // Check for Uruguay (between 6 and 8)
        else if (taxLabel === 'CI' && taxNumLength >= 6 && taxNumLength <= 8) {
            return true;
        }

        // Check for Chile (between 8 and 9)
        else if (taxLabel === 'RUT' && taxNumLength >= 8 && taxNumLength <= 9) {
            return true;
        }

        // Check for India
        else if (taxLabel === 'PAN' && taxNumLength === 10) {
            return true;
        }

        // Check for Indonesia and Vietnam (no tax requirement), just collect anyway if they do enter something
        else if (taxLabel === 'NPWP' || taxLabel === 'TIN') {
            return true;
        }

        // Check for Brazil (CPF and CPNJ)
        else if (taxLabel === 'CPF' &&
            (astroPayDialog.cpfIsValid(taxNumCleaned) || astroPayDialog.cpnjIsValid(taxNumCleaned))) {
            return true;
        }
        else {
            return false;
        }
    },

    /**
     * Validate the Brazillian CPF number (Cadastrado de Pessoas Fisicas) is the equivalent of a personal Brazilian tax
     * registration number. CPF numbers have 11 digits in total: 9 numbers followed by 2 check numbers that are being
     * used for validation. Validation code from:
     * http://nadikun.com/how-to-validate-cpf-number-using-custom-method-in-jquery-validate-plugin/
     *
     * @param {String} taxNum The tax number entered by the user (which contains only numbers, no hyphens etc)
     * @returns {Boolean} Returns true if the CPF is valid
     */
    cpfIsValid: function (taxNum) {

        'use strict';

        // Checking value to have 11 digits only
        if (taxNum.length !== 11) {
            return false;
        }

        var firstCheckNum = parseInt(taxNum.substring(9, 10), 10);
        var secondCheckNum = parseInt(taxNum.substring(10, 11), 10);

        var checkResult = function (sum, checkNum) {
            var result = (sum * 10) % 11;
            if ((result === 10) || (result === 11)) {
                result = 0;
            }
            return (result === checkNum);
        };

        // Checking for dump data
        if (taxNum === '' ||
            taxNum === '00000000000' ||
            taxNum === '11111111111' ||
            taxNum === '22222222222' ||
            taxNum === '33333333333' ||
            taxNum === '44444444444' ||
            taxNum === '55555555555' ||
            taxNum === '66666666666' ||
            taxNum === '77777777777' ||
            taxNum === '88888888888' ||
            taxNum === '99999999999'
        ) {

            return false;
        }

        var sum = 0;

        // Step 1 - using first Check Number:
        for (var i = 1; i <= 9; i++) {
            sum = sum + parseInt(taxNum.substring(i - 1, i), 10) * (11 - i);
        }

        // If first Check Number is valid, move to Step 2 - using second Check Number:
        if (checkResult(sum, firstCheckNum)) {
            sum = 0;
            for (var j = 1; j <= 10; j++) {
                sum = sum + parseInt(taxNum.substring(j - 1, j), 10) * (12 - j);
            }
            return checkResult(sum, secondCheckNum);
        }

        return false;
    },

    /**
     * Validate the Brazillian CPNJ number (Cadastro Nacional da Pessoa Juridica) is the equivalent of a
     * company/organisation/non-personal Brazilian tax registration number. The CNPJ consists of a 14-digit number
     * formatted as 00.000.000/0001-00 - The first eight digits identify the company, the four digits after the slash
     * identify the branch or subsidiary ("0001" defaults to the headquarters), and the last two are check digits.
     * Validation code from:
     * https://github.com/fnando/cpf_cnpj.js/blob/master/lib/cnpj.js
     *
     * @param {String} taxNum The tax number entered by the user (which contains only numbers, no hyphens etc)
     * @returns {Boolean} Returns true if the CPNJ is valid
     */
    cpnjIsValid: function (taxNum) {

        'use strict';

        // Blacklist common values
        var BLACKLIST = [
            '00000000000000',
            '11111111111111',
            '22222222222222',
            '33333333333333',
            '44444444444444',
            '55555555555555',
            '66666666666666',
            '77777777777777',
            '88888888888888',
            '99999999999999'
        ];

        var STRICT_STRIP_REGEX = /[-\/.]/g;
        var LOOSE_STRIP_REGEX = /[^\d]/g;

        var verifierDigit = function (numbers) {

            var index = 2;
            var reverse = numbers.split("").reduce(function (buffer, number) {
                return [parseInt(number, 10)].concat(buffer);
            }, []);

            var sum = reverse.reduce(function (buffer, number) {
                buffer += number * index;
                index = (index === 9 ? 2 : index + 1);
                return buffer;
            }, 0);

            var mod = sum % 11;

            return (mod < 2 ? 0 : 11 - mod);
        };

        var strip = function (number, strict) {

            var regex = strict ? STRICT_STRIP_REGEX : LOOSE_STRIP_REGEX;

            return (number || "").toString().replace(regex, "");
        };

        var isValid = function (number, strict) {

            var stripped = strip(number, strict);

            // CNPJ must be defined
            if (!stripped) {
                return false;
            }

            // CNPJ must have 14 chars
            if (stripped.length !== 14) {
                return false;
            }

            // CNPJ can't be blacklisted
            if (BLACKLIST.indexOf(stripped) >= 0) {
                return false;
            }

            var numbers = stripped.substr(0, 12);
            numbers += verifierDigit(numbers);
            numbers += verifierDigit(numbers);

            return numbers.substr(-2) === stripped.substr(-2);
        };

        return isValid(taxNum);
    },

    /**
     * Redirect to the site
     * @param {String} utcResult containing the url to redirect to
     */
    redirectToSite: function (utcResult) {

        var url = utcResult.EUR['url'];
        window.location = url;
    },

    /**
     * Process the result from the API User Transaction Complete call
     * @param {Object} utcResult The results from the UTC call
     */
    processUtcResult: function (utcResult) {

        // If successful AstroPay result, redirect
        if (utcResult.EUR.url) {
            astroPayDialog.redirectToSite(utcResult);
        }
        else {
            // Hide the loading animation and show an error
            pro.propay.hideLoadingOverlay();
            astroPayDialog.showError(utcResult);
        }
    },

    /**
     * Something has gone wrong just talking to AstroPay
     * @param {Object} utcResult The result from the UTC API call with error codes
     */
    showError: function (utcResult) {

        // Generic error: Oops, something went wrong...
        var message = l[47];

        // Transaction could not be initiated due to connection problems...
        if (utcResult.EUR.error === -1) {
            message = l[7233];
        }

        // Possibly invalid tax number etc
        else if (utcResult.EUR.error === -2) {
            message = l[6959];
        }

        // Too many payments within 12 hours
        else if (utcResult.EUR.error === -18) {
            message = l[7982];
        }

        // Show error dialog
        msgDialog('warninga', l[7235], message, '', function () {
            astroPayDialog.showBackgroundOverlay();
            astroPayDialog.showDialog();
        });
    },

    /**
     * Shows a modal dialog that their payment is pending
     */
    showPendingPayment: function () {

        this.$backgroundOverlay = $('.fm-dialog-overlay');
        this.$pendingOverlay = $('.payment-result.pending.original');

        // Show the success
        this.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');
        this.$pendingOverlay.removeClass('hidden');

        insertEmailToPayResult(this.$pendingOverlay);

        if (!u_type || u_type !== 3) {
            this.$pendingOverlay.find('.payment-result-button, .payment-close').addClass('hidden');
        }
        else {
            this.$pendingOverlay.find('.payment-result-button, .payment-close').removeClass('hidden');

            // Add click handlers for 'Go to my account' and Close buttons
            this.$pendingOverlay.find('.payment-result-button, .payment-close').rebind('click', function () {

                // Hide the overlay
                astroPayDialog.$backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
                astroPayDialog.$pendingOverlay.addClass('hidden');

                pro.redirectToSite();
            });
        }
    }
};

/**
 * Code for the voucher dialog on the second step of the Pro page
 * This code is shared for desktop and mobile webclient.
 */
var voucherDialog = {

    $dialog: null,
    $backgroundOverlay: null,
    $successOverlay: null,

    /** The gateway ID for using prepaid balance */
    gatewayId: 0,

    /**
     * Initialisation of the dialog
     */
    init: function() {

        'use strict';

        // Cache DOM reference for lookup in other functions
        this.$dialog = $('.voucher-dialog');
        this.$backgroundOverlay = $('.fm-dialog-overlay');
        this.$successOverlay = $('.payment-result.success');

        // Initialise functionality
        this.initCloseButton();
        this.setDialogDetails();
        this.initPurchaseButton();
        this.initRedeemVoucherButton();
        this.initRedeemVoucherNow();
        this.showVoucherDialog();
    },

    /**
     * Display the dialog
     */
    showVoucherDialog: function() {
        'use strict';
        var self = this;

        // Add the styling for the overlay
        M.safeShowDialog('voucher-dialog', function() {
            self.showBackgroundOverlay();
            return self.$dialog;
        });
    },

    /**
     * Set voucher dialog details on load
     */
    setDialogDetails: function() {

        // Get the selected Pro plan details
        var proNum = pro.propay.selectedProPackage[1];
        var proPlan = pro.getProPlanName(proNum);
        var proPrice = pro.propay.selectedProPackage[5];
        var numOfMonths = pro.propay.selectedProPackage[4];
        var monthsWording = pro.propay.getNumOfMonthsWording(numOfMonths);
        var balance = parseFloat(pro.propay.proBalance).toFixed(2);
        var newBalance = parseFloat(balance - proPrice).toFixed(2);
        var oldPlan = pro.membershipPlans.filter(function(item) {
            return item[1] === M.account.type;
        })[0];
        var oldStorage = oldPlan ? (oldPlan[2] * Math.pow(1024, 3)) : 0;
        var newStorage = Math.max(pro.propay.selectedProPackage[2] * Math.pow(1024, 3), oldStorage);
        var newTransfer = pro.propay.selectedProPackage[3] * Math.pow(1024, 3);

        // Update template
        this.$dialog.find('.plan-icon').removeClass('pro1 pro2 pro3 pro4').addClass('pro' + proNum);
        this.$dialog.find('.voucher-plan-title').text(proPlan);
        this.$dialog.find('.voucher-plan-txt .duration').text(monthsWording);
        this.$dialog.find('.voucher-plan-price .price').text(formatCurrency(proPrice));
        this.$dialog.find('#voucher-code-input input').val('');
        const hasSufficientBalance = this.changeColourIfSufficientBalance();

        var $voucherAccountBalance = this.$dialog.find('.voucher-account-balance');
        var $balanceAmount = $voucherAccountBalance.find('.balance-amount');
        $balanceAmount.text(formatCurrency(balance));

        // Mobile specific dialog enhancements
        if (is_mobile) {
            var $newBalanceAmount = $voucherAccountBalance.find('.new-balance-amount');
            var $storageAmount = $voucherAccountBalance.find('.storage-amount');
            var $newStorageAmount = $voucherAccountBalance.find('.new-storage-amount');
            var $currentAchievementsAmount = $('.current-achievements-amount', $voucherAccountBalance);
            var $transferAmount = $voucherAccountBalance.find('.transfer-amount');
            var $newTransferAmount = $voucherAccountBalance.find('.new-transfer-amount');

            $newBalanceAmount.text(formatCurrency(newBalance));

            if (newBalance < 0) {
                $newBalanceAmount.addClass('red');
            }

            $storageAmount.text(bytesToSize(M.account.space, 0));
            $newStorageAmount.text(bytesToSize(newStorage, 0));
            if (M.maf.storage && M.maf.storage.current) {
                $currentAchievementsAmount.text(`+ ${bytesToSize(M.maf.storage.current, 0)}`);
                $currentAchievementsAmount.removeClass('hidden');
            }

            if (M.account.type) {
                $transferAmount.text(bytesToSize(M.account.tfsq.max, 0));
                $newTransferAmount.text(bytesToSize(M.account.tfsq.max + newTransfer, 0));
            }
            else {
                $transferAmount.text('Limited');
                $newTransferAmount.text(bytesToSize(newTransfer, 0));
            }
        }

        clickURLs();

        // Reset state to hide voucher input
        $('.voucher-input-container', voucherDialog.$dialog).addClass('hidden');

        if (hasSufficientBalance) {
            $('.voucher-buy-now', voucherDialog.$dialog).removeClass('hidden');
            $('.voucher-redeem', voucherDialog.$dialog).addClass('hidden');
        }
        else {
            $('.voucher-redeem, .voucher-buy-now', voucherDialog.$dialog).removeClass('hidden');
        }
    },

    /**
     * Show green price if they have sufficient funds, or red if they need to top up
     */
    changeColourIfSufficientBalance: function() {

        const price = pro.propay.selectedProPackage[5];
        const hasSufficientBalance = parseFloat(pro.propay.proBalance) >= parseFloat(price);

        // If they have enough balance to purchase the plan, make it green
        if (hasSufficientBalance) {
            $('.voucher-account-balance', this.$dialog).addClass('sufficient-funds');
            $('.voucher-buy-now', this.$dialog).addClass('sufficient-funds');
            $('.voucher-information-help', this.$dialog).addClass('hidden');
        }
        else {
            // Otherwise leave it as red
            $('.voucher-account-balance', this.$dialog).removeClass('sufficient-funds');
            $('.voucher-buy-now', this.$dialog).removeClass('sufficient-funds');
            $('.voucher-information-help', this.$dialog).removeClass('hidden');
        }

        return hasSufficientBalance;
    },

    /**
     * Functionality for the close button
     */
    initCloseButton: function() {

        // Initialise the close button
        this.$dialog.find('button.js-close, .btn-close-dialog').rebind('click', function() {

            // Hide the overlay and dialog
            voucherDialog.hideDialog();
        });

        // Prevent close of dialog from clicking outside the dialog
        $('.fm-dialog-overlay.payment-dialog-overlay').rebind('click', function(event) {
            event.stopPropagation();
        });
    },

    /**
     * Shows the background overlay
     */
    showBackgroundOverlay: function() {

        voucherDialog.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');
    },

    /**
     * Hide the overlay and dialog
     */
    hideDialog: function() {
        'use strict';

        closeDialog();
        voucherDialog.$backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
    },

    /**
     * Functionality for the initial redeem voucher button which shows
     * a text box to enter the voucher code and another Redeem Voucher button
     */
    initRedeemVoucherButton: function() {

        var $this = this;

        // On redeem button click
        $this.$dialog.find('.voucher-redeem').rebind('click', function() {

            // Show voucher input
            $('.voucher-redeem, .voucher-buy-now', $this.$dialog).addClass('hidden');
            $('.voucher-input-container', $this.$dialog).removeClass('hidden');
        });
    },

    /**
     * Redeems the voucher
     */
    initRedeemVoucherNow: function() {

        // On redeem button click
        this.$dialog.find('.voucher-redeem-now').rebind('click', function() {

            // Get the voucher code from the input
            var voucherCode = voucherDialog.$dialog.find('#voucher-code-input input').val();

            // If empty voucher show message Error - Please enter your voucher code
            if (voucherCode === '') {
                msgDialog('warninga', l[135], l[1015], '', function() {
                    voucherDialog.showBackgroundOverlay();
                });
            }
            else {
                // Clear text box
                voucherDialog.$dialog.find('#voucher-code-input input').val('');

                // Remove link information to get just the code
                voucherCode = voucherCode.replace('https://127.0.0.1/#voucher', '');

                // Add the voucher
                voucherDialog.addVoucher(voucherCode);
            }
        });
    },

    /**
     * Redeems the voucher code
     * @param {String} voucherCode The voucher code
     */
    addVoucher: function(voucherCode) {
        'use strict';

        loadingDialog.show();

        M.require('redeem_js')
            .then(function() {
                return redeem.redeemVoucher(voucherCode);
            })
            .then(({data, res}) => {
                loadingDialog.hide();

                if (d) {
                    console.debug('voucherDialog.addVoucher', res, data);
                }

                if (data.promotional) {
                    voucherDialog.hideDialog();
                    pro.propay.selectedProPackage = [0, data.proNum];
                    voucherDialog.showSuccessfulPayment();
                    return;
                }

                // Get the latest account balance and update the price in the dialog
                voucherDialog.getLatestBalance(function() {

                    // Format to 2dp
                    var proPrice = pro.propay.selectedProPackage[5];
                    var balance = pro.propay.proBalance.toFixed(2);
                    var newBalance = parseFloat(balance - proPrice).toFixed(2);

                    // Update dialog details
                    voucherDialog.$dialog.find('.voucher-account-balance .balance-amount')
                        .text(formatCurrency(balance));
                    voucherDialog.$dialog.find('.voucher-account-balance .new-balance-amount')
                        .text(formatCurrency(newBalance));
                    const sufficientBalance = voucherDialog.changeColourIfSufficientBalance();

                    if (!sufficientBalance) {
                        voucherDialog.$dialog.find('.voucher-redeem').removeClass('hidden');
                    }
                    voucherDialog.$dialog.find('.voucher-buy-now').removeClass('hidden');
                    // Hide voucher input
                    $('.voucher-input-container', voucherDialog.$dialog).addClass('hidden');

                    voucherDialog.showVoucherDialog();
                });
            })
            .catch(function(ex) {
                loadingDialog.hide();

                if (ex) {
                    if (ex === ETOOMANY) {
                        ex = l.redeem_etoomany;
                    }
                    msgDialog('warninga', l[135], l[47], ex, function() {
                        voucherDialog.showBackgroundOverlay();
                    });
                }
            });
    },

    /**
     * Gets the latest Pro balance from the API
     * @param {Function} callbackFunction A callback that can be used to continue on or update the UI once up to date
     */
    getLatestBalance: function(callbackFunction) {

        // Flag 'pro: 1' includes the Pro balance in the response
        api_req({ a: 'uq', pro: 1 }, {
            callback : function(result) {
                // If successful result
                if (typeof result === 'object') {
                    if (result.balance && result.balance[0]) {
                        // Convert to a float
                        var balance = parseFloat(result.balance[0][0]);

                        // Cache for various uses later on

                        pro.propay.proBalance = balance;
                    }

                    // Fetch the user's subscription payment gateway id if has any
                    pro.propay.userSubsGatewayId = result.sgwids && result.sgwids.length > 0 ? result.sgwids[0] : null;
                }

                // Run the callback
                callbackFunction();
            }
        });
    },

    /**
     * Purchase using account balance when the button is clicked inside the Voucher dialog
     */
    initPurchaseButton: function() {

        var $voucherPurchaseButton = this.$dialog.find('.voucher-buy-now');
        var $selectedDurationOption = $('.duration-options-list .membership-radio.checked');

        // On Purchase button click run the purchase process
        $voucherPurchaseButton.rebind('click', function() {

            // Get which plan is selected
            pro.propay.selectedProPackageIndex = $selectedDurationOption.parent().attr('data-plan-index');

            // Set the pro package (used in pro.propay.sendPurchaseToApi function)
            pro.propay.selectedProPackage = pro.membershipPlans[pro.propay.selectedProPackageIndex];

            // Get the plan price
            var selectedPlanPrice = pro.propay.selectedProPackage[pro.UTQA_RES_INDEX_PRICE];

            // Warn them about insufficient funds
            if ((parseFloat(pro.propay.proBalance) < parseFloat(selectedPlanPrice))) {

                // Show warning and re-apply the background because the msgDialog function removes it on close
                msgDialog('warningb', l[6804], l[6805], '', () => {
                    voucherDialog.showBackgroundOverlay();
                });
            }
            else {
                // Hide the overlay and dialog
                voucherDialog.hideDialog();

                // Proceed with payment via account balance
                pro.propay.proPaymentMethod = 'pro_prepaid';
                pro.propay.sendPurchaseToApi();
            }
        });
    },

    /**
     * Shows a successful payment modal dialog
     */
    showSuccessfulPayment: function() {

        // Get the selected Pro plan details
        var proNum = pro.propay.selectedProPackage[1];
        var proPlanName = pro.getProPlanName(proNum);

        // Hide the loading animation
        pro.propay.hideLoadingOverlay();

        // Show the success
        voucherDialog.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');
        voucherDialog.$successOverlay.removeClass('hidden');
        voucherDialog.$successOverlay.find('.payment-result-txt .plan-name').text(proPlanName);

        insertEmailToPayResult(voucherDialog.$successOverlay);

        // Send some data to mega.io that we updated the Pro plan
        initMegaIoIframe(true, proNum);

        // Add click handlers for 'Go to my account' and Close buttons
        voucherDialog.$successOverlay.find('.payment-result-button, .payment-close').rebind('click', function() {

            // Hide the overlay
            voucherDialog.$backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
            voucherDialog.$successOverlay.addClass('hidden');

            pro.redirectToSite();
        });
    }
};

/**
 * Display the wire transfer dialog
 */
var wireTransferDialog = {

    $dialog: null,
    $backgroundOverlay: null,

    /**
     * Open and setup the dialog
     */
    init: function(onCloseCallback) {

        // Close the pro register dialog if it's already open
        $('.pro-register-dialog').removeClass('active').addClass('hidden');

        // Cache DOM reference for faster lookup
        var dialogClass = is_mobile ? '.mobile.wire-transfer-dialog' : '.mega-dialog.wire-transfer-dialog';
        this.$dialog = $(dialogClass);
        this.$backgroundOverlay = $('.fm-dialog-overlay');

        // Add the styling for the overlay
        this.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');

        // Open the dialog
        this.$dialog.addClass('active').removeClass('hidden');

        // Change the class depending on mobile/desktop
        var closeButtonClass = is_mobile ? '.fm-dialog-close' : closeButtonJS;

        // Initialise the close button
        this.$dialog.find(closeButtonClass).rebind('click', () => {
            wireTransferDialog.$backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
            wireTransferDialog.$dialog.removeClass('active').addClass('hidden');

            if (onCloseCallback) {
                onCloseCallback();
            }
            return false;
        });

        // If logged in, pre-populate email address into wire transfer details
        if (typeof u_attr !== 'undefined' && u_attr.email) {

            // Replace the @ with -at- so the bank will accept it on the form
            var email = String(u_attr.email).replace('@', '-at-');

            wireTransferDialog.$dialog.find('.email-address').text(email);
        }

        // Check a Pro plan is selected (it might not be if /wiretransfer page is visited directly)
        if (pro.propay.selectedProPackage !== null) {

            // Get the price of the package
            var proPrice = pro.propay.selectedProPackage[5];

            // Update plan price in the dialog
            if (proPrice) {
                const discountInfo = pro.propay.getDiscount();
                if (discountInfo &&
                    ((numOfMonths === 1 && discountInfo.emp) || (numOfMonths === 12 && discountInfo.eyp))) {
                    proPrice = numOfMonths === 1 ? mega.intl.number.format(discountInfo.emp)
                        : mega.intl.number.format(discountInfo.eyp);
                }
                this.$dialog.find('.amount').text(formatCurrency(proPrice)).closest('tr').removeClass('hidden');
            }
            else {
                this.$dialog.find('.amount').closest('tr').addClass('hidden');
            }
        }
    }
};

/**
 * Code for Dynamic/Union Pay
 */
var unionPay = {

    /** The gateway ID for using Union Pay */
    gatewayId: 5,

    /**
     * Redirect to the site
     * @param {Object} utcResult
     */
    redirectToSite: function(utcResult) {

        // DynamicPay
        // We need to redirect to their site via a post, so we are building a form :\
        var form = $("<form name='pay_form' action='" + utcResult.EUR['url'] + "' method='post'></form>");

        for (var key in utcResult.EUR['postdata']) {
            if (utcResult.EUR['postdata'].hasOwnProperty(key)) {

                var input = $("<input type='hidden' name='" + key + "' value='"
                          + utcResult.EUR['postdata'][key] + "' />");

                form.append(input);
            }
        }
        $('body').append(form);
        form.submit();
    }
};

/**
 * Code for Sabadell Spanish Bank
 */
var sabadell = {

    gatewayId: 17,

    /**
     * Redirect to the site
     * @param {Object} utcResult
     */
    redirectToSite: function(utcResult) {

        // We need to redirect to their site via a post, so we are building a form
        var url = utcResult.EUR['url'];
        var form = $("<form id='pay_form' name='pay_form' action='" + url + "' method='post'></form>");

        for (var key in utcResult.EUR['postdata']) {
            if (utcResult.EUR['postdata'].hasOwnProperty(key)) {

                var input = $("<input type='hidden' name='" + key + "' value='"
                          + utcResult.EUR['postdata'][key] + "' />");

                form.append(input);
            }
        }
        $('body').append(form);
        form.submit();
    },

    /**
     * Show the payment result of success or failure after coming back from the Sabadell site
     * @param {String} verifyUrlParam The URL parameter e.g. 'success' or 'failure'
     */
    showPaymentResult: function(verifyUrlParam) {
        'use strict';
        return pro.showPaymentResult(verifyUrlParam);
    }
};

/**
 * Code for Fortumo mobile payments
 */
var fortumo = {

    /**
     * Redirect to the site
     * @param {String} utsResult (a saleid)
     */
    redirectToSite: function(utsResult) {

        window.location = `https://megapay.nz/?saleid=${utsResult}&l=${getTransifexLangCode()}`;
    }
};

/**
 * Code for tpay mobile payments
 */
var tpay = {

    gatewayId: 14,

    /**
     * Redirect to the site
     * @param {String} utcResult (a saleid)
     */
    redirectToSite: function(utcResult) {

        window.location = `https://megapay.nz/gwtp.html?provider=tpay&saleid=${utcResult.EUR.saleids}
                           &params=${utcResult.EUR.params}&l=${getTransifexLangCode()}`;
    }
};

/* jshint -W003 */  // Warning not relevant

/**
 * Code for directReseller payments such as Gary's 6media
 */
var directReseller = {

    gatewayId: 15,

    /**
     * Redirect to the site
     * @param {String} utcResult A sale ID
     */
    redirectToSite: function(utcResult) {
        var provider = utcResult['EUR']['provider'];
        var params = utcResult['EUR']['params'];
        params = atob(params);

        var baseurls = [
            '',
            'https://mega.6media.tw/', // 6media
            'https://mega.bwm-mediasoft.com/mega.php5?', // BWM Mediasoft
            'https://my.cloudbasedbackup.com/'
        ];

        if (provider >= 1 && provider <= 3)
        {
            var baseurl = baseurls[provider];
            var urlmod = utcResult['EUR']['urlmod'];

            // If the urlmod is not defined then we use the fully hardcoded url above,
            // otherwise the API is adjusting the end of it.
            if (typeof urlmod !== 'undefined') {
                baseurl += urlmod;
            }
            window.location =  baseurl + params;
        }
    }
};

/**
 * Code for paysafecard
 */
var paysafecard = {

    /** The gateway ID for using paysafecard */
    gatewayId: 10,

    /**
     * Redirect to the site
     * @param {String} utcResult containing the url to redirect to
     */
    redirectToSite: function(utcResult) {
        var url = utcResult.EUR['url'];
        window.location = url;
    },

    /**
     * Something has gone wrong just talking to paysafecard
     */
    showConnectionError: function() {
        msgDialog('warninga', l[7235], l[7233], '', function() {
            pro.propay.hideLoadingOverlay();
            loadSubPage('pro'); // redirect to remove any query parameters from the url
        });
    },

    /**
     * Something has gone wrong with the card association or debiting of the card
     */
    showPaymentError: function() {
        msgDialog('warninga', l[7235], l[7234], '', function() {
            loadSubPage('pro'); // redirect to remove any query parameters from the url
        });
    },

    /**
     * We have been redirected back to mega with the 'okUrl'. We need to ask the API to verify the payment
     * succeeded as per paysafecard's requirements, which they enforce with integration tests we must pass.
     * @param {String} saleIdString A string containing the sale ID e.g. saleid32849023423
     */
    verify: function(saleIdString) {

        // Remove the saleid string to just get the ID to check
        var saleId = saleIdString.replace('saleid', '');

        // Make the vpay API request to follow up on this sale
        var requestData = {
            'a': 'vpay',                      // Credit Card Store
            't': this.gatewayId,              // The paysafecard gateway
            'saleidstring': saleId            // Required by the API to know what to investigate
        };

        api_req(requestData, {
            callback: function (result) {

                // If negative API number
                if ((typeof result === 'number') && (result < 0)) {

                    // Something went wrong with the payment, either card association or actually debitting it
                    paysafecard.showPaymentError();
                }
                else {
                    // Continue to account screen
                    loadSubPage('account');
                }
            }
        });
    }
};

/**
 * Code for Centili mobile payments
 */
var centili = {

    /**
     * Redirect to the site
     * @param {String} utsResult (a saleid)
     */
    redirectToSite: function(utsResult) {

        window.location = 'http://api.centili.com/payment/widget?apikey=9e8eee856f4c048821954052a8d734ac&reference=' + utsResult;
    }
};

/**
 * A dialog to capture the billing name and address before redirecting off-site
 */
var addressDialog = {

    /** Cached jQuery selectors */
    $dialog: null,
    $backgroundOverlay: null,
    $pendingOverlay: null,
    $propayPage: null,

    /** The gateway ID for Ecomprocessing */
    gatewayId: 16,
    gatewayId_stripe: 19,

    /** Extra details for the API 'utc' call */
    extraDetails: {},

    /**
     * Open and setup the dialog
     */
    init: function (plan, userInfo, businessRegisterPage) {
        "use strict";
        var self = this;

        if (plan) {
            this.businessPlan = plan;
            this.userInfo = userInfo;
            this.businessRegPage = businessRegisterPage;
        }
        else {
            delete this.businessPlan;
            delete this.userInfo;
            delete this.businessRegPage;
        }

        loadingDialog.show();

        this.fetchBillingInfo().always(function (billingInfo) {
            billingInfo = billingInfo || Object.create(null);

            const selectedState =
                (billingInfo.country === 'US' || billingInfo.country === 'CA') && billingInfo.state || false;

            self.showDialog();
            self.prefillInfo(billingInfo);
            self.initStateDropDown(selectedState, billingInfo.country);
            self.initCountryDropDown(billingInfo.country);

            loadingDialog.hide();
            self.initCountryDropdownChangeHandler();
            self.initBuyNowButton();
            self.initCloseButton();
            self.initRememberDetailsCheckbox();
        });
    },

    /**
     * Display the dialog
     */
    showDialog: function() {

        // Cache DOM reference for lookup in other functions
        this.$dialog = $('.payment-address-dialog');
        this.$backgroundOverlay = $('.fm-dialog-overlay');
        this.$propayPage = $('.payment-section', '.fmholder');

        var selectedPlanIndex;
        var selectedPackage;
        var proNum;
        var proPlan;
        var proPrice;
        var numOfMonths;
        var monthsWording;
        let hasIcon = true;

        if (!is_mobile) {
            // Hide the warning message when the registerb dialog gets open each time.
            $('.error-message', this.$dialog).addClass('hidden');

            const $paymentIcons = $('.payment-icons', this.$dialog);
            const specialLogos = {
                'stripeAE': 'icon-amex',
                'stripeJC': 'icon-jcb',
                'stripeUP': 'icon-union-pay',
                'stripeDD': 'icon-discover'
            };
            const gate = this.businessPlan && this.businessPlan.usedGateName || pro.propay.proPaymentMethod;
            if (specialLogos[gate]) {

                $('i', $paymentIcons).addClass('hidden');
                $('.payment-provider-icon', $paymentIcons)
                    .removeClass('hidden icon-amex icon-jcb icon-union-pay icon-discover')
                    .addClass(specialLogos[gate]);
            }
            else {
                $('i', $paymentIcons).removeClass('hidden');
                $('.payment-provider-icon', $paymentIcons).addClass('hidden')
                    .removeClass('stripeAE stripeJC stripeUP stripeDD');
            }
        }

        // Get discount information if available
        const discountInfo = pro.propay.getDiscount();

        // in case we are coming from normal users sign ups (PRO)
        if (!this.businessPlan || !this.userInfo) {
            // Get the selected package
            selectedPlanIndex = $('.duration-options-list .membership-radio.checked').parent().attr('data-plan-index');
            selectedPackage = pro.membershipPlans[selectedPlanIndex];

            // Get the selected Pro plan details
            proNum = selectedPackage[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];
            if (!pro.filter.simple.hasIcon.has(proNum)) {
                hasIcon = false;
            }
            proPlan = pro.getProPlanName(proNum);
            proPrice = selectedPackage[pro.UTQA_RES_INDEX_PRICE];
            numOfMonths = selectedPackage[pro.UTQA_RES_INDEX_MONTHS];
            this.proNum = proNum;
            this.numOfMonths = numOfMonths;
            proNum = 'pro' + proNum;

            if (discountInfo &&
                ((numOfMonths === 1 && discountInfo.emp) || (numOfMonths === 12 && discountInfo.eyp))) {
                proPrice = numOfMonths === 1 ? mega.intl.number.format(discountInfo.emp)
                    : mega.intl.number.format(discountInfo.eyp);
            }
        }
        else {
            // Here it means we are coming from business account register (or Business / Pro Flexi) Repay page
            // Set plan icon
            proNum = this.businessPlan.al === pro.ACCOUNT_LEVEL_PRO_FLEXI ? `pro${this.businessPlan.al}` : 'business';

            // Get the plan number e.g. 100/101 and the plan name e.g. Business/Pro Flexi
            this.proNum = this.businessPlan.al;
            proPlan = pro.getProPlanName(this.proNum);

            if (this.businessPlan.pastInvoice && this.businessPlan.currInvoice) {
                // since API returned values types cant be guarnteed,
                // sometimes they are strings, and sometimes they are numbers!
                proPrice = Number(this.businessPlan.currInvoice.t);
                proPrice = proPrice.toFixed(2);
            }
            else {
                proPrice = (this.userInfo.nbOfUsers * this.businessPlan.userFare
                    + (this.userInfo.quota ? this.userInfo.quota * this.businessPlan.quotaFare : 0)).toFixed(2);
            }
            this.businessPlan.totalPrice = proPrice;
            this.businessPlan.totalUsers = this.userInfo.nbOfUsers;
            this.businessPlan.quota = this.userInfo.quota;
            numOfMonths = this.businessPlan.m;
            this.numOfMonths = numOfMonths;

            // auto renew is mandatory in business
            this.$dialog.find('.payment-buy-now span').text(l[6172]);
            // recurring is mandatory in business
            this.$dialog.find('.payment-plan-txt .recurring').text(`(${l[6965]})`);
        }
        monthsWording = pro.propay.getNumOfMonthsWording(numOfMonths);

        // If using new multi discount system
        if (discountInfo && discountInfo.pd && discountInfo.md) {

            const $promotionTextSelector = $('.js-multi-discount-recurring .js-discount-text', this.$dialog);
            const $selectedDuration = $('.duration-options-list .membership-radio.checked', this.$propayPage);
            const selectedPlanIndex = $selectedDuration.parent().attr('data-plan-index');

            // Show the Euro Total Discount Price
            proPrice = discountInfo.edtp;
            numOfMonths = discountInfo.m;

            // For text to show months or years when applicable
            let monthsOrYears = numOfMonths;

            // Default to monthly recurring subscription wording
            let discountRecurringText = l.promotion_recurring_info_text_monthly;

            // If the number of months is cleanly divisible by 12 the subscription will recur yearly after the promo
            if (numOfMonths % 12 === 0) {
                monthsOrYears = numOfMonths / 12;
                discountRecurringText = l.promotion_recurring_info_text_yearly;
            }

            // Set the date to current date e.g. 3 May 2022 (will be converted to local language wording/format)
            const date = new Date();
            date.setMonth(date.getMonth() + numOfMonths);

            // Get the selected Pro plan name
            const proPlanName = pro.getProPlanName(discountInfo.al);

            // Get the selected package
            const selectedPackage = pro.membershipPlans[selectedPlanIndex];
            const regularMonthlyPrice = selectedPackage[pro.UTQA_RES_INDEX_PRICE];

            // Update text for "When the #-month/year promotion ends on 26 April, 2024 you will start a
            // recurring monthly/yearly subscription for Pro I of EUR9.99 and your card will be billed monthly/yearly."
            discountRecurringText = mega.icu.format(discountRecurringText, monthsOrYears);
            discountRecurringText = discountRecurringText.replace('%1', time2date(date.getTime() / 1000, 2));
            discountRecurringText = discountRecurringText.replace('%2', proPlanName);
            discountRecurringText = discountRecurringText.replace('%3', formatCurrency(regularMonthlyPrice));

            // Update the text (if the recurring option is selected, it
            // will be shown in the payment address dialog when opened)
            $promotionTextSelector.text(discountRecurringText);
        }


        // Update template
        this.$dialog.find('.plan-icon').removeClass('pro1 pro2 pro3 pro4 pro101 business no-icon')
            .addClass(hasIcon ? proNum : 'no-icon');
        this.$dialog.find('.payment-plan-title').text(proPlan);
        this.$dialog.find('.payment-plan-txt .duration').text(monthsWording);
        this.proPrice = formatCurrency(proPrice);
        this.$dialog.find('.payment-plan-price .price').text(this.proPrice);

        // Show the black background overlay and the dialog
        this.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');
        this.$dialog.removeClass('hidden');

        this.firstNameMegaInput = new mega.ui.MegaInputs($('.first-name', this.$dialog));
        this.lastNameMegaInput = new mega.ui.MegaInputs($('.last-name', this.$dialog));
        this.addressMegaInput = new mega.ui.MegaInputs($('.address1', this.$dialog));
        this.address2MegaInput = new mega.ui.MegaInputs($('.address2', this.$dialog));
        this.cityMegaInput = new mega.ui.MegaInputs($('.city', this.$dialog));
        this.postCodeMegaInput = new mega.ui.MegaInputs($('.postcode', this.$dialog));
        this.taxCodeMegaInput = new mega.ui.MegaInputs($('.taxcode', this.$dialog));

        if (!is_mobile) {
            // Keep the ps scrollbar block code after remove the hidden class from the dialog
            // so that it shows the scrollbar initially
            resizeDlgScrollBar(this.$dialog);

            $(window).rebind('resize.billAddressDlg', resizeDlgScrollBar.bind(null, this.$dialog));
        }
    },

    /**
     * Binds Select events for mobile, Dropdown component events for desktop
     * @param {Object} $select jQuery object of the Select menu or dropdown
     */
    bindPaymentSelectEvents: function($select) {
        "use strict";

        if (is_mobile) {
            $select.rebind('change.defaultSelectChange', function() {
                var $this = $(this);

                $('option', $this).attr('data-state', '');
                $(':selected', $this).attr('data-state', 'active');
            });
        }
        else {
            bindDropdownEvents($select);
        }
    },

    /**
     * Creates a list of state names with the ISO 3166-1-alpha-2 code as the option value
     * @param {String} preselected ISO code of preselected country
     * @param {String} country ISO code of country
     */
    initStateDropDown: function(preselected, country) {

        var $statesSelect = $('.states', this.$dialog);
        var $selectScroll = $('.dropdown-scroll', $statesSelect);
        var $optionsContainer = is_mobile ? $statesSelect : $selectScroll;
        var option = is_mobile ? 'option' : 'div';

        // Remove all states (leave the first option because its actually placeholder).
        $selectScroll.empty();

        // Build options
        $.each(M.getStates(), function(isoCode, stateName) {

            var countryCode = isoCode.substr(0, 2);
            var itemNode;

            // Create the option and set the ISO code and state name
            itemNode = mCreateElement(option, {
                'class': 'option' + (countryCode !== country ? ' hidden' : ''),
                'data-value': isoCode,
                'data-state': preselected && isoCode === preselected ? 'active' : ''
            }, $optionsContainer[0]);
            mCreateElement('span', undefined, itemNode).textContent = stateName;

            if (preselected && isoCode === preselected) {
                $('> span', $statesSelect).text(stateName);

                // Set value to default Select menu for mobile
                if (is_mobile) {
                    $statesSelect.val(stateName);
                }
            }
        });

        // Initialise the selectmenu
        this.bindPaymentSelectEvents($statesSelect);

        if (preselected || country === 'US' || country === 'CA') {
            $statesSelect.removeClass('disabled').removeAttr('disabled');
        }
        else {
            $statesSelect.addClass('disabled').attr('disabled', 'disabled');
        }
    },

    /**
     * Creates a list of country names with the ISO 3166-1-alpha-2 code as the option value
     */
    initCountryDropDown: function(preselected) {

        var $countriesSelect = $('.countries', this.$dialog);
        var $selectScroll = $('.dropdown-scroll', $countriesSelect);
        var $optionsContainer = is_mobile ? $countriesSelect : $selectScroll;
        var option = is_mobile ? 'option' : 'div';

        // Remove all countries (leave the first option because its actually placeholder).
        $selectScroll.empty();

        // Build options
        $.each(M.getCountries(), function(isoCode, countryName) {

            var itemNode;

            // Create the option and set the ISO code and country name
            itemNode = mCreateElement(option, {
                'class': 'option',
                'data-value': isoCode,
                'data-state': preselected && isoCode === preselected ? 'active' : ''
            }, $optionsContainer[0]);
            mCreateElement('span', undefined, itemNode).textContent = countryName;

            if (preselected && isoCode === preselected) {
                $('> span', $countriesSelect).text(countryName);

                // Set value to default Select menu for mobile
                if (is_mobile) {
                    $countriesSelect.val(countryName);
                }
            }
        });

        // Initialise the selectmenu
        this.bindPaymentSelectEvents($countriesSelect);

        $countriesSelect.removeClass('disabled').removeAttr('disabled');
    },

    /**
     * Initialises a change handler for the country dropdown. When the country changes to US or
     * Canada it should enable the State dropdown. Otherwise it should disable the dropdown.
     * Only states from the selected country should be shown.
     */
    initCountryDropdownChangeHandler: function() {

        var inputSelector = function(input) {
            return Array.isArray(input) ? input[1] : input;
        };

        var $countriesSelect = $('.countries', this.$dialog);
        var $statesSelect = $('.states', this.$dialog);
        var $postcodeInput = inputSelector(this.postCodeMegaInput);
        var $taxcodeMegaInput = inputSelector(this.taxCodeMegaInput);
        const $titleElemTaxCode = $('.mega-input-title', $taxcodeMegaInput.$input.parent());
        const $titleElemPostCode = $('.mega-input-title', $postcodeInput.$input.parent());

        const countryCode = $('.option[data-state="active"]', $countriesSelect).attr('data-value');
        const fullTaxName = `${getTaxName(countryCode)} ${l[7347]}`;
        if ($titleElemTaxCode.length) {
            $taxcodeMegaInput.updateTitle(fullTaxName);
        }
        else {
            $taxcodeMegaInput.$input.attr('placeholder', fullTaxName);
        }

        // Change the States depending on the selected country
        var changeStates = function(selectedCountryCode) {

            // If postcode translations not set, then decalre them.
            if (!addressDialog.localePostalCodeName) {

                addressDialog.localePostalCodeName = freeze({
                    "US": "ZIP Code",
                    "CA": "Postal Code",
                    "PH": "ZIP Code",
                    "DE": "PLZ",
                    "AT": "PLZ",
                    "IN": "Pincode",
                    "IE": "Eircode",
                    "BR": "CEP",
                    "IT": "CAP"
                });
            }

            // If selecting a country whereby the postcode is named differently, update the placeholder value.
            if (addressDialog.localePostalCodeName[selectedCountryCode]) {
                if ($titleElemPostCode.length) {
                    $postcodeInput
                        .updateTitle(addressDialog.localePostalCodeName[selectedCountryCode]);
                }
                else {
                    $postcodeInput.$input.attr('placeholder', addressDialog.localePostalCodeName[selectedCountryCode]);
                }
            }
            else if ($titleElemPostCode.length) {
                $postcodeInput.updateTitle(l[10659]);
            }
            else {
                $postcodeInput.$input.attr('placeholder',l[10659]);
            }

            // If Canada or United States is selected
            if (selectedCountryCode === 'CA' || selectedCountryCode === 'US') {

                var $options = $('.option', $statesSelect);

                // Loop through all the states
                for (var i = 0; i < $options.length; i++) {
                    var $stateOption = $($options[i]);
                    var stateCode = $stateOption.attr('data-value');
                    var countryCode = stateCode.substr(0, 2);

                    // If it's a match, show it
                    if (countryCode === selectedCountryCode) {
                        $stateOption.removeClass('hidden');
                    }
                    else {
                        // Otherwise hide it
                        $stateOption.addClass('hidden');
                    }
                }

                $statesSelect.removeClass('disabled').removeAttr('disabled');
                $statesSelect.attr('tabindex', '7');
                $statesSelect.rebind('keydown.propay', function(e) {
                    if (this === document.activeElement) {
                        if (e.shiftKey && e.keyCode === 9) {
                            $('.city', this.$dialog).focus();
                        }
                        else if (e.keyCode === 9) {
                            $('.postcode', this.$dialog).focus();
                        }
                    }
                });
            }
            else {
                $statesSelect.addClass('disabled').attr('disabled', 'disabled');
                $statesSelect.attr('tabindex', '-1');
                $statesSelect.off('keydown.propay');
                $('span', $statesSelect).first().text(l[7192]);
                $('.option', $statesSelect).removeAttr('data-state').removeClass('active');
            }

            var taxName = getTaxName(selectedCountryCode);
            if ($titleElemTaxCode.length) {
                $taxcodeMegaInput.updateTitle(taxName + ' ' + l[7347]);
            }
            else {
                $taxcodeMegaInput.$input.attr('placeholder',taxName + ' ' + l[7347]);
            }

            // Remove any previous validation error
            $statesSelect.removeClass('error');
        };

        // Get the selected country ISO code e.g. CA and change States
        if (is_mobile) {

            $countriesSelect.rebind('change.selectCountry', function() {
                changeStates($(':selected', $(this)).attr('data-value'));
            });
        }
        else {

            $('.option', $countriesSelect).rebind('click.selectCountry', function() {
                changeStates($(this).attr('data-value'));
            });
        }
    },

    /**
     * Initialise the button for buy now
     */
    initBuyNowButton: function() {

        // Add the click handler to redirect off site
        this.$dialog.find('.payment-buy-now').rebind('click', function() {

            addressDialog.validateAndPay();
        });
    },

    /**
     * Attempt to prefill the info based on the user_attr information.
     */
    prefillInfo: function(billingInfo) {
        'use strict';

        const prefillMultipleInputs = (inputs, value) => {
            if (Array.isArray(inputs)) {
                inputs.forEach(($megaInput) => {
                    $megaInput.setValue(value);
                });
            }
            else {
                inputs.setValue(value);
            }
        };


        const getBillingProp = (propName, encoded) => {
            if (!billingInfo[propName] || !encoded) {
                return billingInfo[propName];
            }
            const val = tryCatch(() => from8(billingInfo[propName]), () => {
                console.error(`Invalid utf-8 encoded key value ${propName} -> ${billingInfo[propName]}`);
            })();
            return val || billingInfo[propName];
        };

        const fillInputFromAttr = ($input, businessAttrName, Atrrname) => {
            if (this.businessPlan && this.userInfo && this.userInfo.hasOwnProperty(businessAttrName)) {
                prefillMultipleInputs($input, this.userInfo[businessAttrName]);
            }
            else if (window.u_attr && u_attr[Atrrname]) {
                prefillMultipleInputs($input, u_attr[Atrrname]);
            }
            else {
                prefillMultipleInputs($input, '');
            }
        };

        let noFname = true;
        let noLname = true;

        if (billingInfo) {
            const encodedVer = !!billingInfo.version;

            if (billingInfo.firstname) {
                prefillMultipleInputs(this.firstNameMegaInput, getBillingProp('firstname', encodedVer));
                noFname = false;
            }

            if (billingInfo.lastname) {
                prefillMultipleInputs(this.lastNameMegaInput, getBillingProp('lastname', encodedVer));
                noLname = false;
            }

            if (billingInfo.address1) {
                prefillMultipleInputs(this.addressMegaInput, getBillingProp('address1', encodedVer));
            }

            if (billingInfo.address2) {
                prefillMultipleInputs(this.address2MegaInput, getBillingProp('address2', encodedVer));
            }

            if (billingInfo.city) {
                prefillMultipleInputs(this.cityMegaInput, getBillingProp('city', encodedVer));
            }

            if (billingInfo.postcode) {
                prefillMultipleInputs(this.postCodeMegaInput, getBillingProp('postcode', encodedVer));
            }

            if (billingInfo.taxCode) {
                prefillMultipleInputs(this.taxCodeMegaInput, getBillingProp('taxCode', encodedVer));
            }
        }
        if (noFname) {
            fillInputFromAttr(this.firstNameMegaInput, 'fname', 'firstname');
        }
        if (noLname) {
            fillInputFromAttr(this.lastNameMegaInput, 'lname', 'lastname');
        }
    },

    /**
     * Generate a list of billing info values either saved previously or guessed where applicable.
     * @returns {MegaPromise}
     */
    fetchBillingInfo: function() {
        'use strict';
        var self = this;
        var promise = new MegaPromise();
        mega.attr.get(u_attr.u, 'billinginfo', false, true).always(function(billingInfo) {
            if (typeof billingInfo !== "object") {
                billingInfo = {};
            }

            var finished = function() {
                if (!billingInfo.country) {
                    billingInfo.country = u_attr.country ? u_attr.country : u_attr.ipcc;
                }
                promise.resolve(billingInfo);
            };

            if (self.businessPlan && u_attr.b) {
                self.fetchBusinessInfo().always(function(businessInfo) {
                    const attributes = ["address1", "address2", "city", "state", "country", "postcode"];

                    businessInfo = businessInfo || Object.create(null);
                    for (var i = 0; i < attributes.length; i++) {
                        var attr = attributes[i];
                        var battr = attr === "postcode" ? '%zip' : '%' + attr;

                        if (!billingInfo[attr] && businessInfo[battr]) {
                            billingInfo[attr] = businessInfo[battr];
                        }
                    }
                    finished();
                });
            } else {
                finished();
            }
        });
        return promise;
    },

    /**
     * Load required business account attributes for payment dialog.
     * @param requiredAttributes
     * @returns {MegaPromise}
     */
    fetchBusinessInfo: function(requiredAttributes) {
        'use strict';

        var promise = new MegaPromise();
        requiredAttributes = requiredAttributes || [
            '%name', '%address1', '%address2', '%city', '%state', '%country', '%zip'
        ];
        var done = 0;
        var timeout = null;
        const businessInfo = Object.create(null);

        var loaded = function(res, ctx) {
            if (typeof res !== 'number') {
                businessInfo[ctx.ua] = from8(base64urldecode(res));
            }

            if (++done === requiredAttributes.length) {
                clearTimeout(timeout);
                promise.resolve(businessInfo);
            }
        };

        for (var i = 0; i < requiredAttributes.length; i++) {
            var attr = requiredAttributes[i];
            mega.attr.get(u_attr.b.bu, attr, -1, undefined, loaded);
        }

        // If it takes too long just return what we have so far.
        timeout = setTimeout(function() {
            promise.resolve(businessInfo);
        }, 3000);

        return promise;
    },

    /**
     * Initialize the remember billing information checkbox.
     */
    initRememberDetailsCheckbox: function() {
        'use strict';
        var self = this;
        this.$rememberDetailsCheckbox = $(".remember-billing-info-wrapper").find(".checkbox");
        $(".remember-billing-info, .radio-txt", this.$dialog).rebind('click.commonevent', function() {
            if (self.$rememberDetailsCheckbox.hasClass('checkboxOn')) {
                self.$rememberDetailsCheckbox.addClass('checkboxOff').removeClass('checkboxOn');
            }
            else {
                self.$rememberDetailsCheckbox.addClass('checkboxOn').removeClass('checkboxOff');
            }
            return false;
        });
    },

    /**
     * Initialise the X (close) button in the top right corner of the dialog
     */
    initCloseButton: function() {

        'use strict';

        // Change the class depending on mobile/desktop
        var closeButtonClass = is_mobile ? '.close-payment-dialog' : closeButtonJS;

        var mySelf = this;

        // Add the click handler to hide the dialog and the black overlay
        this.$dialog.find(closeButtonClass).rebind('click', function() {

            addressDialog.closeDialog();
            // if we are coming from business plan, we need to reset registration
            if (mySelf.businessPlan && mySelf.userInfo) {
                if (page === 'registerb') {
                    page = '';
                    loadSubPage('registerb');
                }
                else if (page === 'repay') {
                    page = '';
                    loadSubPage('repay');
                }
            }
        });
    },

    /**
     * Closes the dialog
     */
    closeDialog: function() {

        if (this.$backgroundOverlay) {
            this.$backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
            this.$dialog.removeClass('active').addClass('hidden');
        }
    },

    /**
     * Collects the form details and validates the form
     */
    validateAndPay: function() {

        const inputSelector = function(input) {
            return Array.isArray(input) ? input[1] : input;
        };
        // Selectors for form text fields
        const fields = ['first-name', 'last-name', 'address1', 'address2', 'city', 'postcode'];
        const fieldValues = Object.create(null);

        // Get the values from the inputs
        for (let i = 0; i < fields.length; i++) {

            // Get the form field value
            const fieldName = fields[i];
            const fieldValue = $(`.${fieldName}`, this.$dialog).val();

            // Trim the text
            fieldValues[fieldName] = $.trim(fieldValue);
        }

        // Get the values from the dropdowns
        const $stateSelect = $('.states', this.$dialog);
        const $countrySelect = $('.countries', this.$dialog);
        const state = $('.option[data-state="active"]', $stateSelect).attr('data-value');
        const country = $('.option[data-state="active"]', $countrySelect).attr('data-value');
        const taxCode = inputSelector(this.taxCodeMegaInput).$input.val();

        // Selectors for error handling
        const $errorMessage = $('.error-message', this.$dialog);
        const $errorMessageContainers = $('.message-container', this.$dialog);
        const $allInputs = $('.mega-input', this.$dialog);

        // Reset state of past error messages
        let stateNotSet = false;
        $errorMessage.addClass(is_mobile ? 'v-hidden' : 'hidden');
        $errorMessageContainers.addClass('hidden');
        $allInputs.removeClass('error');
        $stateSelect.removeClass('error');
        $countrySelect.removeClass('error');

        // Add red border around the missing fields
        $.each(fieldValues, function(fieldName, value) {

            // Make sure the value is set, if not add the class (ignoring address2 field which is not compulsory)
            if ((!value) && (fieldName !== 'address2')) {
                addressDialog.$dialog.find('.' + fieldName).parent().addClass('error');
            }
        });

        // Add red border around the missing country selectmenu
        if (!country) {
            $countrySelect.addClass('error');
        }

        // If the country is US or Canada then the State is also required field
        if (((country === 'US') || (country === 'CA')) && !state) {
            $stateSelect.addClass('error');
            stateNotSet = true;
        }

        // Check all required fields
        if (!fieldValues['first-name'] || !fieldValues['last-name'] || !fieldValues['address1'] ||
                !fieldValues['city'] || !fieldValues['postcode'] || !country || stateNotSet) {

            // Show a general error and exit early if they are not complete
            $errorMessage.removeClass(is_mobile ? 'v-hidden' : 'hidden');

            // Scroll down to the error message automatically if on large scaled displays
            const $contentSection = $('section.content.ps', this.$dialog);
            if ($contentSection.length > 0) {
                const scrollBottom = $contentSection.get(0).scrollHeight - $contentSection.get(0).clientHeight;
                if (scrollBottom > 0) {
                    $contentSection.scrollTop(scrollBottom);
                }
            }
            return false;
        }

        // If remember billing address, save as user attribute for future usage.
        if (this.$rememberDetailsCheckbox.hasClass("checkboxOn")) {
            const saveAttribute = function(name, value) {
                if (value) {
                    mega.attr.setArrayAttribute('billinginfo', name, value, false, true);
                }
            };
            saveAttribute('firstname', to8(fieldValues['first-name']));
            saveAttribute('lastname', to8(fieldValues['last-name']));
            saveAttribute('address1', to8(fieldValues.address1));
            saveAttribute('address2', to8(fieldValues.address2));
            saveAttribute('postcode', to8(fieldValues.postcode));
            saveAttribute('city', to8(fieldValues.city));
            saveAttribute('country', country);
            saveAttribute('state', state);
            saveAttribute('taxCode', to8(taxCode));
            saveAttribute('version', '2');
        } else {
            // Forget Attribute.
            const removeAttribute = function(name) {
                mega.attr.setArrayAttribute('billinginfo', name, '', false, true);
            };
            removeAttribute('firstname');
            removeAttribute('lastname');
            removeAttribute('address1');
            removeAttribute('address2');
            removeAttribute('postcode');
            removeAttribute('city');
            removeAttribute('country');
            removeAttribute('state');
            removeAttribute('taxCode');
            removeAttribute('version');
        }

        // log the click on the 'subscribe' button
        delay('addressDlg.click', eventlog.bind(null, 99789));

        // Send to the API
        this.proceedToPay(fieldValues, state, country, taxCode);
    },

    /**
     * Setup the payment details to send to the API
     * @param {Object} fieldValues The form field names and their values
     * @param {type} state The value of the state dropdown
     * @param {type} country The value of the country dropdown
     */
    proceedToPay: function(fieldValues, state, country, taxCode) {
        'use strict';
        // Set details for the UTC call
        this.extraDetails.first_name = fieldValues['first-name'];
        this.extraDetails.last_name = fieldValues['last-name'];
        this.extraDetails.address1 = fieldValues['address1'];
        this.extraDetails.address2 = fieldValues['address2'];
        this.extraDetails.city = fieldValues['city'];
        this.extraDetails.zip_code = fieldValues['postcode'];
        this.extraDetails.country = country;
        this.extraDetails.recurring = true;
        this.extraDetails.taxCode = taxCode;

        // If the country is US or Canada, add the state by stripping the country code off e.g. to get QC from CA-QC
        if ((country === 'US') || (country === 'CA')) {
            this.extraDetails.state = state.substr(3);
        }

        // Hide the dialog so the loading one will show, then proceed to pay
        this.$dialog.addClass('hidden');

        if (!this.businessPlan || !this.userInfo || !this.businessRegPage) {
            pro.propay.sendPurchaseToApi();
        }
        else {
            this.businessRegPage.processPayment(this.extraDetails, this.businessPlan);
        }
    },

    /**
     * Redirect to the site
     * @param {String} utcResult containing the url to redirect to
     */
    redirectToSite: function(utcResult) {

        var url = utcResult.EUR['url'];
        window.location = url + '?lang=' + lang;
    },

    stripePaymentChecker: function(saleId) {
        'use strict';
        addressDialog.stripeCheckerCounter++;
        if (addressDialog.stripeCheckerCounter > 20) {
            return;
        }

        const shift = 500;
        const base = 3000; // 3sec
        const nextTick = addressDialog.stripeCheckerCounter * shift + base;

        // If saleId is already an array of sale IDs use that, otherwise add to an array
        const saleIdArray = Array.isArray(saleId) ? saleId : [saleId];

        api.screq({a: 'utd', s: saleIdArray})
            .then(({result}) => {
                assert(typeof result === 'string');

                if (typeof result === 'string') {
                    // success
                    const $stripeDialog = $('.payment-stripe-dialog');
                    const $stripeSuccessDialog = $('.payment-stripe-success-dialog');
                    const $stripeIframe = $('iframe#stripe-widget', $stripeDialog);

                    // If this is newly created business account, it then requires verification
                    if (addressDialog.userInfo && !addressDialog.userInfo.isUpgrade) {
                        $('.success-desc', $stripeSuccessDialog).safeHTML(l[25081]);
                        $('button.js-close, .btn-close-dialog', $stripeSuccessDialog).addClass('hidden');
                    }
                    else {
                        $('button.js-close, .btn-close-dialog', $stripeSuccessDialog)
                            .removeClass('hidden')
                            .rebind('click.stripeDlg', closeDialog);

                        delay('reload:stripe', pro.redirectToSite, 4000);
                    }

                    $stripeIframe.remove();
                    $stripeDialog.addClass('hidden');
                    M.safeShowDialog('stripe-pay-success', $stripeSuccessDialog);
                }

            })
            .catch((ex) => {
                if (ex === ENOENT) {
                    pro.propay.paymentStatusChecker =
                        setTimeout(addressDialog.stripePaymentChecker.bind(addressDialog, saleId), nextTick);
                }
                else {
                    tell(ex);
                }
            });
    },

    stripeFrameHandler: function(event) {
        'use strict';
        if (d) {
            console.log(event);
        }

        clearTimeout(pro.propay.paymentStatusChecker);
        clearTimeout(pro.propay.listenRemover);

        const failHandle = (error) => {
            const $stripeDialog = $('.payment-stripe-dialog');
            const $stripeFailureDialog = $('.payment-stripe-failure-dialog');
            const $stripeIframe = $('iframe#stripe-widget', $stripeDialog);

            $('button.js-close, .btn-close-dialog', $stripeFailureDialog).rebind('click.stripeDlg', () => {

                closeDialog();
                // if we are coming from business plan, we need to reset registration
                if (addressDialog.businessPlan && addressDialog.userInfo) {
                    if (page === 'registerb') {
                        page = '';
                        loadSubPage('registerb');
                    }
                    else if (page === 'repay') {
                        page = '';
                        loadSubPage('repay');
                    }
                }
            });

            $('.stripe-error', $stripeFailureDialog).text(error || '');

            if (addressDialog.stripeSaleId === 'EDIT') {
                $((is_mobile ? '.fail-head' : '.payment-stripe-failure-dialog-title'), $stripeFailureDialog)
                    .text(l.payment_gw_update_fail);
                $('.err-txt', $stripeFailureDialog).safeHTML(l.payment_gw_update_fail_desc
                    .replace('[A]', '<a href="mailto:support@mega.nz">')
                    .replace('[/A]', '</a>'));
            }

            $stripeIframe.remove();
            closeStripeDialog();
            M.safeShowDialog('stripe-pay-failure', $stripeFailureDialog);
        };

        if (event && event.origin === addressDialog.gatewayOrigin && event.data) {
            if (typeof event.data !== 'string') {
                tryCatch(() => {
                    api_req({a: 'log', e: 99741, m: JSON.stringify(event.data)});
                });
                failHandle(l[1679]);
                return;
            }
            if (event.data === 'closeme') {
                closeStripeDialog();

                // Load the proper page UI after close the stripe payment dialog
                if (page === 'registerb') {
                    page = '';
                    loadSubPage('registerb');
                }
                else if (page === 'repay') {
                    page = '';
                    loadSubPage('repay');
                }
                return;
            }
            if (event.data.startsWith('payfail^')) {
                failHandle(event.data.split('^')[1]);
            }
            else if (event.data === 'paysuccess') {

                if (addressDialog.stripeSaleId === 'EDIT') {
                    closeStripeDialog();

                    if (is_mobile) {
                        if (page === 'fm/account/paymentcard') {
                            mega.ui.toast.show(l.payment_card_update_desc, 6);
                            loadSubPage('fm/account');
                        }
                    }
                    else {
                        msgDialog('info', '', l.payment_card_update, l.payment_card_update_desc, () => {
                            if (page.startsWith('fm/account/plan')) {
                                accountUI.plan.init(M.account);
                            }
                        });
                    }
                }
                else {
                    addressDialog.stripeCheckerCounter = 0;

                    pro.propay.paymentStatusChecker =
                        setTimeout(addressDialog.stripePaymentChecker
                            .bind(addressDialog, addressDialog.stripeSaleId), 500);
                }
            }
            else if (event.data.startsWith('action^')) {
                const destURL = event.data.split('^')[1] || '';
                if (!destURL) {
                    failHandle();
                }
                else {
                    window.location = destURL;
                }
            }
        }
        else {
            window.addEventListener('message', addressDialog.stripeFrameHandler, { once: true });
            pro.propay.listenRemover = setTimeout(() => {
                window.removeEventListener('message', addressDialog.stripeFrameHandler, { once: true });
            }, 7e5);
        }
    },

    stripeLocal: function() {
        'use strict';
        switch (lang) {
            case 'br': return 'pt';
            case 'cn': return 'zh';
            case 'ct': return 'zh-HK';
            case 'jp': return 'ja';
            case 'kr':
            case 'vi': return 'en'; // no support for Korean and Vietnamese
            default: return lang;
        }
    },

    stripeCheckerCounter: 0,
    stripeSaleId: null,

    /**
     * Process the result from the API User Transaction Complete call
     *
     * @param {Object} utcResult The results from the UTC call
     * @param {Boolean} isStripe A flag if 'Stripe' gateway is used
     * @param {String} saleId Saleid to check
     */
    processUtcResult: function(utcResult, isStripe, saleId) {
        'use strict';
        this.gatewayOrigin = null;

        if (!utcResult.EUR) {
            console.error('unexpected result...', utcResult);
            utcResult.EUR = false;
        }

        if (isStripe) {
            this.stripeSaleId = null;
            if (utcResult.EUR) {
                const $stripeDialog = $('.payment-stripe-dialog');
                const $iframeContainer =
                    $('.mobile.payment-stripe-dialog .iframe-container,' +
                          ' .mega-dialog.payment-stripe-dialog .iframe-container');
                let $stripeIframe = $('iframe#stripe-widget', $stripeDialog);
                $stripeIframe.remove();
                const sandBoxCSP = 'allow-scripts allow-same-origin allow-forms'
                    + (utcResult.edit ? ' allow-popups' : '');

                $stripeIframe = mCreateElement(
                    'iframe',
                    {
                        width: '100%',
                        height: '100%',
                        sandbox: sandBoxCSP,
                        frameBorder: '0'
                    },
                    $iframeContainer[0]
                );
                let iframeSrc = utcResult.EUR;

                const payInfo = tryCatch(() => {
                    return new URL(utcResult.EUR);
                })();
                this.gatewayOrigin = payInfo.origin;

                // if a testing gateway is set.
                if (localStorage.megaPay) {
                    const testSrc = tryCatch(() => {
                        return new URL(localStorage.megaPay);
                    })();

                    if (testSrc && payInfo) {
                        this.gatewayOrigin = testSrc.origin;
                        const secret = payInfo.searchParams.get('s');
                        const env = payInfo.searchParams.get('e');
                        const editType = payInfo.searchParams.get('t');
                        const planprice = payInfo.searchParams.get('pp');
                        if (secret) {
                            testSrc.searchParams.append('s', secret);
                        }
                        if (env) {
                            testSrc.searchParams.append('e', env);
                        }
                        if (editType) {
                            testSrc.searchParams.append('t', editType);
                        }
                        if (editType) {
                            testSrc.searchParams.append('pp', planprice);
                        }
                        iframeSrc = testSrc.toString();
                    }
                }

                this.stripeSaleId = 'EDIT';

                if (!utcResult.edit) {

                    iframeSrc += `&p=${this.proNum}`;
                    if (this.extraDetails.recurring) {
                        iframeSrc += '&r=1';
                    }

                    // If new multi-discount promotion, add the discount number of months & turn the promo flag on
                    if (mega.discountInfo && mega.discountInfo.md) {
                        iframeSrc += `&m=${mega.discountInfo.m}`;
                        iframeSrc += `&promo=1`;
                    }
                    else {
                        // Otherwise use the selected number of months and turn the promo flag off
                        iframeSrc += `&m=${this.numOfMonths}`;
                    }

                    this.stripeSaleId = saleId;

                    const gate = this.businessPlan && this.businessPlan.usedGateName || pro.propay.proPaymentMethod;

                    if (gate) {
                        iframeSrc += `&g=${b64encode(gate)}`;
                    }
                }

                const locale = addressDialog.stripeLocal();
                if (locale) {
                    iframeSrc += '&l=' + locale;
                }

                if (is_mobile) {
                    iframeSrc += '&mobile=1';
                }

                $stripeIframe.src = iframeSrc;
                $stripeIframe.id = 'stripe-widget';

                pro.propay.hideLoadingOverlay();
                loadingDialog.hide();

                M.safeShowDialog('stripe-pay', $stripeDialog);

                window.addEventListener('message', addressDialog.stripeFrameHandler, { once: true });
                pro.propay.listenRemover = setTimeout(() => {
                    window.removeEventListener('message', addressDialog.stripeFrameHandler, { once: true });
                }, 6e5); // 10 minutes

                // Keeping keys binding consistent with iframe events
                $(document).rebind('keydown.stripeDialog', () => false);

                $('.fm-dialog-overlay').rebind('click.stripeDialog', () => {
                    this.discardCreditCardUpdate();
                    return false;
                });
            }
            else {
                this.showError(utcResult);
            }
        }
        else {
            if (utcResult.EUR.url) {
                return this.redirectToSite(utcResult);
            }
            // Hide the loading animation and show the error
            pro.propay.hideLoadingOverlay();
            this.showError(utcResult);
        }
    },

    /**
     * Triggers a confirmation dialog when a credit card iframe is being discarded (only with overlay for now)
     * @returns {void}
     */
    discardCreditCardUpdate: function() {
        'use strict';

        if (this.confirmationIsShowing === true) {
            return;
        }

        this.confirmationIsShowing = true;

        msgDialog(
            'confirmation',
            '',
            l.close_credit_card_dialog,
            l.close_credit_card_dialog_confirmation,
            (status) => {
                if (status) {
                    closeStripeDialog();
                }

                this.confirmationIsShowing = false;
            }
        );
    },

    /**
     * Something has gone wrong with the API and Ecomprocessing setup
     * @param {Object} utcResult The result from the UTC API call with error codes
     */
    showError: function(utcResult) {

        // Generic error: Oops, something went wrong. Please try again later.
        var message = l[200] + ' ' + l[253];

        // Transaction could not be initiated due to connection problems...
        if (utcResult.EUR.error === EINTERNAL) {
            message = l[7233];
        }

        // Please complete the payment details correctly.
        else if (utcResult.EUR.error === EARGS) {
            message = l[6959];
        }

        // You have too many incomplete payments in the last 12 hours...
        else if (utcResult.EUR.error === ETEMPUNAVAIL) {
            message = l[7982];
        }

        // Show error dialog
        msgDialog('warninga', l[7235], message, '', function() {
            addressDialog.showDialog();
        });
    },

    /**
     * Show the payment result of success or failure after coming back from Ecomprocessing
     * @param {String} verifyUrlParam The URL parameter e.g. 'success' or 'failure'
     */
    showPaymentResult: function(verifyUrlParam) {
        'use strict';
        return pro.showPaymentResult(verifyUrlParam);
    }
};

/**
 * Credit card payment dialog
 */
var cardDialog = {

    $dialog: null,
    $backgroundOverlay: null,
    $successOverlay: null,
    $failureOverlay: null,
    $loadingOverlay: null,

    /** Flag to prevent accidental double payments */
    paymentInProcess: false,

    /** The RSA public key to encrypt data to be stored on the Secure Processing Unit (SPU) */
    publicKey: [
        atob(
            "wfvbeFkjArOsHvAjXAJqve/2z/nl2vaZ+0sBj8V6U7knIow6y3/6KJ" +
            "3gkJ50QQ7xDDakyt1C49UN27e+e0kCg2dLJ428JVNvw/q5AQW41" +
            "grPkutUdFZYPACOauqIsx9KY6Q3joabL9g1JbwmuB44Mv20aV/L" +
            "/Xyb2yiNm09xlyVhO7bvJ5Sh4M/EOzRN2HI+V7lHwlhoDrzxgQv" +
            "vKjzsoPfFZaMud742tpgY8OMnKHcfmRQrfIvG/WfCqJ4ETETpr6" +
            "AeI2PIHsptZgOYkkrDK6Bi8qb/T7njk32ZRt1E6Q/N7+hd8PLhh" +
            "2PaYRWfpNiWwnf/rPu4MnwRE6T77s/qGQ=="
        ),
        "\u0001\u0000\u0001",   // Exponent 65537
        2048                    // Key size in bits
    ],

    /** The gateway ID for using Credit cards */
    gatewayId: 8,

    /**
     * Open and setup the dialog
     */
    init: function() {
        this.showCreditCardDialog();
        this.initCountryDropDown();
        this.initExpiryMonthDropDown();
        this.initExpiryYearDropDown();
        this.initPurchaseButton();
    },

    /**
     * Display the dialog
     */
    showCreditCardDialog: function() {

        // Close the pro register dialog if it's already open
        $('.pro-register-dialog').removeClass('active').addClass('hidden');

        // Cache DOM reference for lookup in other functions
        this.$dialog = $('.mega-dialog.payment-dialog');
        this.$backgroundOverlay = $('.fm-dialog-overlay');
        this.$successOverlay = $('.payment-result.success');
        this.$failureOverlay = $('.payment-result.failed');
        this.$loadingOverlay = $('.payment-processing');

        // Add the styling for the overlay
        this.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');

        // Position the dialog and open it
        this.$dialog.addClass('active').removeClass('hidden');

        // Get the selected Pro plan details
        var proNum = pro.propay.selectedProPackage[1];
        var proPlan = pro.getProPlanName(proNum);
        var proPrice = pro.propay.selectedProPackage[5];
        var numOfMonths = pro.propay.selectedProPackage[4];
        var monthsWording = pro.propay.getNumOfMonthsWording(numOfMonths);

        const discountInfo = pro.propay.getDiscount();
        if (discountInfo && ((numOfMonths === 1 && discountInfo.emp) || (numOfMonths === 12 && discountInfo.eyp))) {
            proPrice = numOfMonths === 1 ? mega.intl.number.format(discountInfo.emp)
                : mega.intl.number.format(discountInfo.eyp);
        }

        // Update the Pro plan details
        this.$dialog.find('.plan-icon').removeClass('pro1 pro2 pro3 pro4').addClass('pro' + proNum);
        this.$dialog.find('.payment-plan-title').text(proPlan);
        this.$dialog.find('.payment-plan-price').text(formatCurrency(proPrice));
        this.$dialog.find('.payment-plan-txt').text(monthsWording + ' ' + l[6965] + ' ');

        // Remove rogue colon in translation text
        var statePlaceholder = this.$dialog.find('.state-province').attr('placeholder').replace(':', '');
        this.$dialog.find('.state-province').attr('placeholder', statePlaceholder);

        // Reset form if they made a previous payment
        this.clearPreviouslyEnteredCardData();

        // Initialise the close button
        this.$dialog.find(closeButtonJS).rebind('click', () => {
            cardDialog.$backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
            cardDialog.$dialog.removeClass('active').addClass('hidden');

            // Reset flag so they can try paying again
            cardDialog.paymentInProcess = false;
        });

        // Check if using retina display and preload loading animation
        var retina = (window.devicePixelRatio > 1) ? '@2x' : '';
        $('.payment-animation').attr('src', staticpath + '/images/mega/payment-animation' + retina + '.gif');
    },

    /**
     * Clears card data and billing details previously entered
     */
    clearPreviouslyEnteredCardData: function() {

        $('.first-name', this.$dialog).val('');
        $('.last-name', this.$dialog).val('');
        $('.credit-card-number', this.$dialog).val('');
        $('.cvv-code', this.$dialog).val('');
        $('.address1', this.$dialog).val('');
        $('.address2', this.$dialog).val('');
        $('.city', this.$dialog).val('');
        $('.state-province', this.$dialog).val('');
        $('.post-code', this.$dialog).val('');
        $('.expiry-date-month > span', this.$dialog).text(l[913]);
        $('.expiry-date-year > span', this.$dialog).text(l[932]);
        $('.countries > span', this.$dialog).text(l[481]);
    },

    /**
     * Initialise functionality for the purchase button
     */
    initPurchaseButton: function() {

        this.$dialog.find('.payment-buy-now').rebind('click', function() {

            // Prevent accidental double click if they've already initiated a payment
            if (cardDialog.paymentInProcess === false) {

                // Set flag to prevent double click getting here too
                cardDialog.paymentInProcess = true;

                // Validate the form and normalise the billing details
                var billingDetails = cardDialog.getBillingDetails();

                // If no errors, proceed with payment
                if (billingDetails !== false) {
                    cardDialog.encryptBillingData(billingDetails);
                }
                else {
                    // Reset flag so they can try paying again
                    cardDialog.paymentInProcess = false;
                }
            }
        });
    },

    /**
     * Creates a list of country names with the ISO 3166-1-alpha-2 code as the option value
     */
    initCountryDropDown: function() {

        var $countriesSelect = $('.dropdown-input.countries', this.$dialog);
        var $selectScroll = $('.dropdown-scroll', $countriesSelect);

        // Build options
        $.each(M.getCountries(), function(isoCode, countryName) {

            var itemNode;

            // Create the option and set the ISO code and country name
            itemNode = mCreateElement('div', {
                'class': 'option',
                'data-value': isoCode,
            }, $selectScroll[0]);
            mCreateElement('span', undefined, itemNode).textContent = countryName;
        });

        // Bind custom dropdowns events
        bindDropdownEvents($countriesSelect);
    },

    /**
     * Creates the expiry month dropdown
     */
    initExpiryMonthDropDown: function() {

        var $expiryMonthSelect = $('.dropdown-input.expiry-date-month',  this.$dialog);
        var $selectScroll = $('.dropdown-scroll', $expiryMonthSelect);

        // Build options
        for (var month = 1; month <= 12; month++) {

            var itemNode;
            var twoDigitMonth;

            twoDigitMonth = (month < 10) ? '0' + month : month;

            // Create the option and set month values
            itemNode = mCreateElement('div', {
                'class': 'option',
                'data-value': twoDigitMonth,
            }, $selectScroll[0]);
            mCreateElement('span', undefined, itemNode).textContent = twoDigitMonth;
        }

        // Bind custom dropdowns events
        bindDropdownEvents($expiryMonthSelect);
    },

    /**
     * Creates the expiry year dropdown
     */
    initExpiryYearDropDown: function() {

        var currentYear = new Date().getFullYear();
        var endYear = currentYear + 20;                                     // http://stackoverflow.com/q/2500588
        var $expiryYearSelect = $('.dropdown-input.expiry-date-year', this.$dialog);
        var $selectScroll = $('.dropdown-scroll', $expiryYearSelect);

        // Build options
        for (var year = currentYear; year <= endYear; year++) {

            var itemNode;

            // Create the option and set year values
            itemNode = mCreateElement('div', {
                'class': 'option',
                'data-value': year,
            }, $selectScroll[0]);
            mCreateElement('span', undefined, itemNode).textContent = year;
        }

        // Bind custom dropdowns events
        bindDropdownEvents($expiryYearSelect);
    },

    /* jshint -W074 */  // Old code, refactor another day

    /**
     * Checks if the billing details are valid before proceeding
     * Also normalise the data to remove inconsistencies
     * @returns {Boolean}
     */
    getBillingDetails: function() {

        // All payment data
        var billingData =    {
            first_name: $('.first-name', this.$dialog).val(),
            last_name: $('.last-name', this.$dialog).val(),
            card_number: $('.credit-card-number', this.$dialog).val(),
            expiry_date_month: $('.expiry-date-month .option[data-state="active"]', this.$dialog).attr('data-value'),
            expiry_date_year: $('.expiry-date-year .option[data-state="active"]', this.$dialog).attr('data-value'),
            cv2: $('.cvv-code', this.$dialog).val(),
            address1: $('.address1', this.$dialog).val(),
            address2: $('.address2', this.$dialog).val(),
            city: $('.city', this.$dialog).val(),
            province: $('.state-province', this.$dialog).val(),
            postal_code: $('.post-code', this.$dialog).val(),
            country_code: $('.countries .option[data-state="active"]', this.$dialog).attr('data-value'),
            email_address: u_attr.email
        };

        // Trim whitespace from beginning and end of all form fields
        $.each(billingData, function(key, value) {
            billingData[key] = $.trim(value);
        });

        // Remove all spaces and hyphens from credit card number
        billingData.card_number = billingData.card_number.replace(/-|\s/g, '');

        // Check the credit card number
        if (!cardDialog.isValidCreditCard(billingData.card_number)) {

            // Show error popup and on close re-add the overlay
            msgDialog('warninga', l[6954], l[6955], '', function() {
                cardDialog.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');
            });
            return false;
        }

        // Check the required billing details are completed
        if (!billingData.address1 || !billingData.city || !billingData.province || !billingData.country_code ||
            !billingData.postal_code) {

            // Show error popup and on close re-add the overlay
            msgDialog('warninga', l[6956], l[6957], '', function() {
                cardDialog.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');
            });
            return false;
        }

        // Check all the card details are completed
        else if (!billingData.first_name || !billingData.last_name || !billingData.card_number ||
                 !billingData.expiry_date_month || !billingData.expiry_date_year || !billingData.cv2) {

            msgDialog('warninga', l[6958], l[6959], '', function() {
                cardDialog.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');
            });
            return false;
        }

        return billingData;
    },
    /* jshint +W074 */

    /**
     * Encrypts the billing data before sending to the API server
     * @param {Object} billingData The data to be encrypted and sent
     */
    encryptBillingData: function(billingData) {

        // Get last 4 digits of card number
        var cardNumberLength = billingData.card_number.length;
        var lastFourCardDigits = billingData.card_number.substr(cardNumberLength - 4);

        // Hash the card data so users can identify their cards later in our system if they
        // get locked out or something. It must be unique and able to be derived again.
        var cardData = JSON.stringify({
            'card_number': billingData.card_number,
            'expiry_date_month': billingData.expiry_date_month,
            'expiry_date_year': billingData.expiry_date_year,
            'cv2': billingData.cv2
        });
        var htmlEncodedCardData = cardDialog.htmlEncodeString(cardData);
        var cardDataHash = sjcl.hash.sha256.hash(htmlEncodedCardData);
        var cardDataHashHex = sjcl.codec.hex.fromBits(cardDataHash);

        // Comes back as byte string, so encode first.
        var jsonEncodedBillingData = JSON.stringify(billingData);
        var htmlAndJsonEncodedBillingData = cardDialog.htmlEncodeString(jsonEncodedBillingData);
        var encryptedBillingData = btoa(paycrypt.hybridEncrypt(htmlAndJsonEncodedBillingData, this.publicKey));

        // Add credit card, the most recently added card is used by default
        var requestData = {
            'a': 'ccs',                          // Credit Card Store
            'cc': encryptedBillingData,
            'last4': lastFourCardDigits,
            'expm': billingData.expiry_date_month,
            'expy': billingData.expiry_date_year,
            'hash': cardDataHashHex
        };

        // Close the dialog
        cardDialog.$dialog.removeClass('active').addClass('hidden');

        // Proceed with payment
        api_req(requestData, {
            callback: function (result) {

                // If negative API number
                if ((typeof result === 'number') && (result < 0)) {
                    cardDialog.showFailureOverlay();
                }
                else {
                    // Otherwise continue to charge card
                    pro.propay.sendPurchaseToApi();
                }
            }
        });
    },

    /**
     * Encode Unicode characters in the string so people with strange addresses can still pay
     * @param {String} input The string to encode
     * @returns {String} Returns the encoded string
     */
    htmlEncodeString: function(input) {

        return input.replace(/[\u00A0-\uFFFF<>\&]/gim, function(i) {
            return '&#' + i.charCodeAt(0) + ';';
        });
    },

    /**
     * Process the result from the API User Transaction Complete call
     * @param {Object} utcResult The results from the UTC call
     */
    processUtcResult: function(utcResult) {

        // Hide the loading animation
        pro.propay.hideLoadingOverlay();

        // Show credit card success
        if (utcResult.EUR.res === 'S') {
            cardDialog.showSuccessfulPayment(utcResult);
        }

        // Show credit card failure
        else if ((utcResult.EUR.res === 'FP') || (utcResult.EUR.res === 'FI')) {
            cardDialog.showFailureOverlay(utcResult);
        }
    },

    /**
     * Shows a successful payment modal dialog
     */
    showSuccessfulPayment: function() {

        // Close the card dialog and loading overlay
        cardDialog.$failureOverlay.addClass('hidden');
        cardDialog.$loadingOverlay.addClass('hidden');
        cardDialog.$dialog.removeClass('active').addClass('hidden');

        // Get the selected Pro plan details
        var proNum = pro.propay.selectedProPackage[1];
        var proPlanName = pro.getProPlanName(proNum);

        // Show the success
        cardDialog.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');
        cardDialog.$successOverlay.removeClass('hidden');
        cardDialog.$successOverlay.find('.payment-result-txt .plan-name').text(proPlanName);

        insertEmailToPayResult(cardDialog.$successOverlay);

        // Send some data to mega.io that we updated the Pro plan
        initMegaIoIframe(true, proNum);

        // Add click handlers for 'Go to my account' and Close buttons
        cardDialog.$successOverlay.find('.payment-result-button, .payment-close').rebind('click', function() {

            // Hide the overlay
            cardDialog.$backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
            cardDialog.$successOverlay.addClass('hidden');

            // Remove credit card details from the form
            cardDialog.clearPreviouslyEnteredCardData();

            // Reset flag so they can try paying again
            cardDialog.paymentInProcess = false;

            pro.redirectToSite();
        });
    },

    /**
     * Shows the failure overlay
     * @param {Object} utcResult
     */
    showFailureOverlay: function(utcResult) {

        // Show the failure overlay
        cardDialog.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');
        cardDialog.$failureOverlay.removeClass('hidden');
        cardDialog.$loadingOverlay.addClass('hidden');
        cardDialog.$successOverlay.addClass('hidden');

        // If error is 'Fail Provider', get the exact error or show a default 'Something went wrong' type message
        var errorMessage = ((typeof utcResult !== 'undefined') && (utcResult.EUR.res === 'FP'))
                         ? this.getProviderError(utcResult.EUR.code)
                         : l[6950];
        cardDialog.$failureOverlay.find('.payment-result-txt').html(errorMessage);

        // On click of the 'Try again' or Close buttons, hide the overlay and the user can fix their payment details
        cardDialog.$failureOverlay.find('.payment-result-button, .payment-close').rebind('click', function() {

            // Reset flag so they can try paying again
            cardDialog.paymentInProcess = false;

            // Hide failure and re-open the dialog
            cardDialog.$failureOverlay.addClass('hidden');

            // Re-open the card dialog
            cardDialog.$dialog.addClass('active').removeClass('hidden');

            loadSubPage('pro');
        });
    },

    /**
     * Gets an error message based on the error code from the payment provider
     * @param {Number} errorCode The error code
     * @returns {String} The error message
     */
    getProviderError: function(errorCode) {

        switch (errorCode) {
            case -1:
                // There is an error with your credit card details.
                return l[6966];
            case -2:
                // There is an error with your billing details.
                return l[6967];
            case -3:
                // Your transaction was detected as being fraudulent.
                return l[6968];
            case -4:
                // You have tried to pay too many times with this credit card recently.
                return l[6969];
            case -5:
                // You have insufficient funds to make this payment.
                return l[6970];
            default:
                // An unknown error occurred. Please try again later.
                return l[7140];
        }
    },

    /**
     * Validates the credit card number is the correct format
     * Written by Jorn Zaefferer
     * From http://jqueryvalidation.org/creditcard-method/ (MIT Licence)
     * Based on http://en.wikipedia.org/wiki/Luhn_algorithm
     * @param {String} cardNum The credit card number
     * @returns {Boolean}
     */
    isValidCreditCard: function(cardNum) {

        // Accept only spaces, digits and dashes
        if (/[^0-9 \-]+/.test(cardNum)) {
            return false;
        }
        var numCheck = 0;
        var numDigit = 0;
        var even = false;
        var num = null;
        var charDigit = null;

        cardNum = cardNum.replace(/\D/g, '');

        // Basing min and max length on
        // http://developer.ean.com/general_info/Valid_Credit_Card_Types
        if (cardNum.length < 13 || cardNum.length > 19) {
            return false;
        }

        for (num = cardNum.length - 1; num >= 0; num--) {
            charDigit = cardNum.charAt(num);
            numDigit = parseInt(charDigit, 10);

            if (even) {
                if ((numDigit *= 2) > 9) {
                    numDigit -= 9;
                }
            }
            numCheck += numDigit;
            even = !even;
        }

        return (numCheck % 10) === 0;
    }
};

/**
 * Bitcoin invoice dialog
 */
var bitcoinDialog = {

    /** Timer for counting down the time till when the price expires */
    countdownIntervalId: 0,

    /** Original HTML of the Bitcoin dialog before modifications */
    dialogOriginalHtml: '',

    /** The gateway ID for using Bitcoin */
    gatewayId: 4,

    /**
     * Step 3 in plan purchase with Bitcoin
     * @param {Object} apiResponse API result
     */
    showInvoice: function(apiResponse) {

        /* Testing data to watch the invoice expire in 5 secs
        apiResponse['expiry'] = Math.round(Date.now() / 1000) + 5;
        //*/

        // Set details
        var bitcoinAddress = apiResponse.address;
        var invoiceDateTime = time2date(apiResponse.created, 7);
        invoiceDateTime = invoiceDateTime[0].toUpperCase() + invoiceDateTime.substring(1);
        var proPlanNum = pro.propay.selectedProPackage[1];
        var planName = pro.getProPlanName(proPlanNum);
        const planMonths = (pro.propay.selectedProPackage[4] === 1 ? l.bcoin_plan_month_one : l.bcoin_plan_month_mul)
            .replace('%1', pro.propay.selectedProPackage[4]);  // %1-month purchase
        var priceEuros = pro.propay.selectedProPackage[5];
        var priceBitcoins = apiResponse.amount;
        var expiryTime = new Date(apiResponse.expiry);

        const discountInfo = pro.propay.getDiscount();
        if (discountInfo && ((numOfMonths === 1 && discountInfo.emp) || (numOfMonths === 12 && discountInfo.eyp))) {
            priceEuros = numOfMonths === 1 ? mega.intl.number.format(discountInfo.emp)
                : mega.intl.number.format(discountInfo.eyp);
        }

        // Cache selectors
        var $dialogBackgroundOverlay = $('.fm-dialog-overlay');
        var $bitcoinDialog = $('.bitcoin-invoice-dialog');

        // If this is the first open
        if (bitcoinDialog.dialogOriginalHtml === '') {

            // Clone the HTML for the original dialog so it can be reset upon re-opening
            bitcoinDialog.dialogOriginalHtml = $bitcoinDialog.html();
        }
        else {
            // Replace the modified HTML with the original HTML
            $bitcoinDialog.safeHTML(bitcoinDialog.dialogOriginalHtml);
        }

        // Render QR code
        bitcoinDialog.generateBitcoinQrCode($bitcoinDialog, bitcoinAddress, priceBitcoins);

        // Update details inside dialog
        $bitcoinDialog.find('.bitcoin-address').text(bitcoinAddress);
        $bitcoinDialog.find('.invoice-date-time').text(invoiceDateTime);
        $bitcoinDialog.find('.plan-icon').addClass('pro' + proPlanNum);
        $bitcoinDialog.find('.plan-name').text(planName);
        $bitcoinDialog.find('.plan-duration').text(planMonths);
        $('.plan-price-euros .value', $bitcoinDialog).text(formatCurrency(priceEuros));
        $('.plan-price-bitcoins', $bitcoinDialog).text(mega.intl.bitcoin.format(priceBitcoins));

        // Set countdown to price expiry
        bitcoinDialog.setCoundownTimer($bitcoinDialog, expiryTime);

        // Close dialog and reset to original dialog
        $('button.js-close', $bitcoinDialog).rebind('click.bitcoin-dialog-close', function() {

            $dialogBackgroundOverlay.removeClass('bitcoin-invoice-dialog-overlay').addClass('hidden');
            $bitcoinDialog.addClass('hidden');

            // End countdown timer
            clearInterval(bitcoinDialog.countdownIntervalId);
        });

        // Make background overlay darker and show the dialog
        $dialogBackgroundOverlay.addClass('bitcoin-invoice-dialog-overlay').removeClass('hidden');
        $bitcoinDialog.removeClass('hidden');
    },

    /**
     * Renders the bitcoin QR code with highest error correction so that MEGA logo can be overlayed
     * http://www.qrstuff.com/blog/2011/12/14/qr-code-error-correction
     * @param {Object} dialog jQuery object of the dialog
     * @param {String} bitcoinAddress The bitcoin address
     * @param {String|Number} priceInBitcoins The price in bitcoins
     */
    generateBitcoinQrCode: function(dialog, bitcoinAddress, priceInBitcoins) {

        var options = {
            width: 256,
            height: 256,
            correctLevel: QRErrorCorrectLevel.H,    // High
            background: '#f2f2f2',
            foreground: '#151412',
            text: 'bitcoin:' + bitcoinAddress + '?amount=' + priceInBitcoins
        };

        // Render the QR code
        dialog.find('.bitcoin-qr-code').text('').qrcode(options);
    },

    /**
     * Sets a countdown timer on the bitcoin invoice dialog to count down from 15~ minutes
     * until the bitcoin price expires and they need to restart the process
     * @param {Object} dialog The bitcoin invoice dialog
     * @param {Date} expiryTime The date/time the invoice will expire
     */
    setCoundownTimer: function(dialog, expiryTime) {

        // Clear old countdown timer if they have re-opened the page
        clearInterval(bitcoinDialog.countdownIntervalId);

        // Count down the time to price expiration
        bitcoinDialog.countdownIntervalId = setInterval(function() {

            // Show number of minutes and seconds counting down
            var currentTimestamp = Math.round(Date.now() / 1000);
            var difference = expiryTime - currentTimestamp;
            var minutes = Math.floor(difference / 60);
            var minutesPadded = (minutes < 10) ? '0' + minutes : minutes;
            var seconds = difference - (minutes * 60);
            var secondsPadded = (seconds < 10) ? '0' + seconds : seconds;

            // If there is still time remaining
            if (difference > 0) {

                // Show full opacity when 1 minute countdown mark hit
                if (difference <= 60) {
                    dialog.find('.clock-icon').css('opacity', 1);
                    dialog.find('.expiry-instruction').css('opacity', 1);
                    dialog.find('.time-to-expire').css('opacity', 1);
                }

                // Show time remaining
                dialog.find('.time-to-expire').text(minutesPadded + ':' + secondsPadded);
            }
            else {
                // Grey out and hide details as the price has expired
                dialog.find('.scan-code-instruction').css('opacity', '0.25');
                dialog.find('.bitcoin-address').css('visibility', 'hidden');
                dialog.find('.bitcoin-qr-code').css('opacity', '0.15');
                dialog.find('.qr-code-mega-icon').hide();
                dialog.find('.plan-icon').css('opacity', '0.25');
                dialog.find('.plan-name').css('opacity', '0.25');
                dialog.find('.plan-duration').css('opacity', '0.25');
                dialog.find('.plan-price-euros').css('opacity', '0.25');
                dialog.find('.plan-price-bitcoins').css('opacity', '0.25');
                dialog.find('.plan-price-bitcoins-btc').css('opacity', '0.25');
                dialog.find('.expiry-instruction').text(l[8845]).css('opacity', '1');
                dialog.find('.time-to-expire').text('00:00').css('opacity', '1');
                dialog.find('.price-expired-instruction').show();

                // End countdown timer
                clearInterval(bitcoinDialog.countdownIntervalId);
            }
        }, 1000);
    },

    /**
     * Process the result from the API User Transaction Complete call
     * @param {Object} utcResult The results from the UTC call
     */
    processUtcResult: function(utcResult) {

        // Hide the loading animation
        pro.propay.hideLoadingOverlay();

        // Show the Bitcoin invoice dialog
        if (typeof utcResult.EUR === 'object') {
            bitcoinDialog.showInvoice(utcResult.EUR);
        }
        else {
            bitcoinDialog.showBitcoinProviderFailureDialog();
        }
    },

    /**
     * Show a failure dialog if the provider can't be contacted
     */
    showBitcoinProviderFailureDialog: function() {

        var $dialogBackgroundOverlay = $('.fm-dialog-overlay');
        var $bitcoinFailureDialog = $('.bitcoin-provider-failure-dialog');

        // Add styles for the dialog
        $bitcoinFailureDialog.removeClass('hidden');
        $dialogBackgroundOverlay.addClass('bitcoin-invoice-dialog-overlay').removeClass('hidden');

        // End countdown timer
        clearInterval(bitcoinDialog.countdownIntervalId);

        // Close dialog and reset to original dialog
        $('button.js-close', $bitcoinFailureDialog).rebind('click', function() {
            $dialogBackgroundOverlay.removeClass('bitcoin-invoice-dialog-overlay').addClass('hidden');
            $bitcoinFailureDialog.addClass('hidden');
        });
    }
};

var insertEmailToPayResult = function($overlay) {
    "use strict";

    if (u_attr && u_attr.email) {
        $overlay.find('.payment-result-txt .user-email').text(u_attr.email);
    } else if (localStorage.awaitingConfirmationAccount) {
        var acc = JSON.parse(localStorage.awaitingConfirmationAccount);
        $overlay.find('.payment-result-txt .user-email').text(acc.email);
    }
};

/* exported RegionsCollection */
function RegionsCollection() {
    'use strict';

    if (M !== undefined && M !== null && M._countries) {
        this.countries = M._countries;
    } else {
        var countryNames =  [
            {
                "cc": "US",
                "cn": l[18796]
            },
            {
                "cc": "GB",
                "cn": l[18797]
            },
            {
                "cc": "CA",
                "cn": l[18798]
            },
            {
                "cc": "AX",
                "cn": l[18799]
            },
            {
                "cc": "AF",
                "cn": l[18800]
            },
            {
                "cc": "AL",
                "cn": l[18801]
            },
            {
                "cc": "DZ",
                "cn": l[18802]
            },
            {
                "cc": "AS",
                "cn": l[18803]
            },
            {
                "cc": "AD",
                "cn": l[18804]
            },
            {
                "cc": "AO",
                "cn": l[18805]
            },
            {
                "cc": "AI",
                "cn": l[18806]
            },
            {
                "cc": "AQ",
                "cn": l[18807]
            },
            {
                "cc": "AG",
                "cn": l[18808]
            },
            {
                "cc": "AR",
                "cn": l[18809]
            },
            {
                "cc": "AM",
                "cn": l[18810]
            },
            {
                "cc": "AW",
                "cn": l[18811]
            },
            {
                "cc": "AU",
                "cn": l[18812]
            },
            {
                "cc": "AT",
                "cn": l[18813]
            },
            {
                "cc": "AZ",
                "cn": l[18814]
            },
            {
                "cc": "BS",
                "cn": l[18815]
            },
            {
                "cc": "BH",
                "cn": l[18816]
            },
            {
                "cc": "BD",
                "cn": l[18817]
            },
            {
                "cc": "BB",
                "cn": l[18818]
            },
            {
                "cc": "BY",
                "cn": l[18819]
            },
            {
                "cc": "BE",
                "cn": l[18820]
            },
            {
                "cc": "BZ",
                "cn": l[18821]
            },
            {
                "cc": "BJ",
                "cn": l[18822]
            },
            {
                "cc": "BM",
                "cn": l[18823]
            },
            {
                "cc": "BT",
                "cn": l[18824]
            },
            {
                "cc": "BO",
                "cn": l[18825]
            },
            {
                "cc": "BA",
                "cn": l[18826]
            },
            {
                "cc": "BW",
                "cn": l[18827]
            },
            {
                "cc": "BV",
                "cn": l[18828]
            },
            {
                "cc": "BR",
                "cn": l[18829]
            },
            {
                "cc": "IO",
                "cn": l[18830]
            },
            {
                "cc": "BN",
                "cn": l[18831]
            },
            {
                "cc": "BG",
                "cn": l[18832]
            },
            {
                "cc": "BF",
                "cn": l[18833]
            },
            {
                "cc": "BI",
                "cn": l[18834]
            },
            {
                "cc": "KH",
                "cn": l[18835]
            },
            {
                "cc": "CM",
                "cn": l[18836]
            },
            {
                "cc": "CV",
                "cn": l[18837]
            },
            {
                "cc": "KY",
                "cn": l[18838]
            },
            {
                "cc": "CF",
                "cn": l[18839]
            },
            {
                "cc": "TD",
                "cn": l[18840]
            },
            {
                "cc": "CL",
                "cn": l[18841]
            },
            {
                "cc": "CN",
                "cn": l[18842]
            },
            {
                "cc": "CX",
                "cn": l[18843]
            },
            {
                "cc": "CC",
                "cn": l[18844]
            },
            {
                "cc": "CO",
                "cn": l[18845]
            },
            {
                "cc": "KM",
                "cn": l[18846]
            },
            {
                "cc": "CG",
                "cn": l[18847]
            },
            {
                "cc": "CD",
                "cn": l[18848]
            },
            {
                "cc": "CK",
                "cn": l[18849]
            },
            {
                "cc": "CR",
                "cn": l[18850]
            },
            {
                "cc": "CI",
                "cn": l[18851]
            },
            {
                "cc": "HR",
                "cn": l[18852]
            },
            {
                "cc": "CU",
                "cn": l[18853]
            },
            {
                "cc": "CY",
                "cn": l[18854]
            },
            {
                "cc": "CZ",
                "cn": l[18855]
            },
            {
                "cc": "DK",
                "cn": l[18856]
            },
            {
                "cc": "DJ",
                "cn": l[18857]
            },
            {
                "cc": "DM",
                "cn": l[18858]
            },
            {
                "cc": "DO",
                "cn": l[18859]
            },
            {
                "cc": "TL",
                "cn": l[18860]
            },
            {
                "cc": "EC",
                "cn": l[18861]
            },
            {
                "cc": "EG",
                "cn": l[18862]
            },
            {
                "cc": "SV",
                "cn": l[18863]
            },
            {
                "cc": "GQ",
                "cn": l[18864]
            },
            {
                "cc": "ER",
                "cn": l[18865]
            },
            {
                "cc": "EE",
                "cn": l[18866]
            },
            {
                "cc": "ET",
                "cn": l[18867]
            },
            {
                "cc": "FK",
                "cn": l[18868]
            },
            {
                "cc": "FO",
                "cn": l[18869]
            },
            {
                "cc": "FJ",
                "cn": l[18870]
            },
            {
                "cc": "FI",
                "cn": l[18871]
            },
            {
                "cc": "FR",
                "cn": l[18872]
            },
            {
                "cc": "GF",
                "cn": l[18873]
            },
            {
                "cc": "PF",
                "cn": l[18874]
            },
            {
                "cc": "TF",
                "cn": l[18875]
            },
            {
                "cc": "GA",
                "cn": l[18876]
            },
            {
                "cc": "GM",
                "cn": l[18877]
            },
            {
                "cc": "GE",
                "cn": l[18878]
            },
            {
                "cc": "DE",
                "cn": l[18879]
            },
            {
                "cc": "GH",
                "cn": l[18880]
            },
            {
                "cc": "GI",
                "cn": l[18881]
            },
            {
                "cc": "GR",
                "cn": l[18882]
            },
            {
                "cc": "GL",
                "cn": l[18883]
            },
            {
                "cc": "GD",
                "cn": l[18884]
            },
            {
                "cc": "GP",
                "cn": l[18885]
            },
            {
                "cc": "GU",
                "cn": l[18886]
            },
            {
                "cc": "GG",
                "cn": l[18887]
            },
            {
                "cc": "GT",
                "cn": l[18888]
            },
            {
                "cc": "GN",
                "cn": l[18889]
            },
            {
                "cc": "GW",
                "cn": l[18890]
            },
            {
                "cc": "GY",
                "cn": l[18891]
            },
            {
                "cc": "HT",
                "cn": l[18892]
            },
            {
                "cc": "HN",
                "cn": l[18893]
            },
            {
                "cc": "HK",
                "cn": l[18894]
            },
            {
                "cc": "HU",
                "cn": l[18895]
            },
            {
                "cc": "IS",
                "cn": l[18896]
            },
            {
                "cc": "IN",
                "cn": l[18897]
            },
            {
                "cc": "ID",
                "cn": l[18898]
            },
            {
                "cc": "IR",
                "cn": l[18899]
            },
            {
                "cc": "IQ",
                "cn": l[18900]
            },
            {
                "cc": "IE",
                "cn": l[18901]
            },
            {
                "cc": "IM",
                "cn": l[18902]
            },
            {
                "cc": "IL",
                "cn": l[18903]
            },
            {
                "cc": "IT",
                "cn": l[18904]
            },
            {
                "cc": "JM",
                "cn": l[18905]
            },
            {
                "cc": "JP",
                "cn": l[18906]
            },
            {
                "cc": "JE",
                "cn": l[18907]
            },
            {
                "cc": "JO",
                "cn": l[18908]
            },
            {
                "cc": "KZ",
                "cn": l[18909]
            },
            {
                "cc": "KE",
                "cn": l[18910]
            },
            {
                "cc": "KI",
                "cn": l[18911]
            },
            {
                "cc": "KW",
                "cn": l[18912]
            },
            {
                "cc": "KG",
                "cn": l[18913]
            },
            {
                "cc": "LA",
                "cn": l[18914]
            },
            {
                "cc": "LV",
                "cn": l[18915]
            },
            {
                "cc": "LB",
                "cn": l[18916]
            },
            {
                "cc": "LS",
                "cn": l[18917]
            },
            {
                "cc": "LR",
                "cn": l[18918]
            },
            {
                "cc": "LY",
                "cn": l[18919]
            },
            {
                "cc": "LI",
                "cn": l[18920]
            },
            {
                "cc": "LT",
                "cn": l[18921]
            },
            {
                "cc": "LU",
                "cn": l[18922]
            },
            {
                "cc": "MO",
                "cn": l[18923]
            },
            {
                "cc": "MK",
                "cn": l[18924]
            },
            {
                "cc": "MG",
                "cn": l[18925]
            },
            {
                "cc": "MW",
                "cn": l[18926]
            },
            {
                "cc": "MY",
                "cn": l[18927]
            },
            {
                "cc": "MV",
                "cn": l[18928]
            },
            {
                "cc": "ML",
                "cn": l[18929]
            },
            {
                "cc": "MT",
                "cn": l[18930]
            },
            {
                "cc": "MH",
                "cn": l[18931]
            },
            {
                "cc": "MQ",
                "cn": l[18932]
            },
            {
                "cc": "MR",
                "cn": l[18933]
            },
            {
                "cc": "MU",
                "cn": l[18934]
            },
            {
                "cc": "YT",
                "cn": l[18935]
            },
            {
                "cc": "MX",
                "cn": l[18936]
            },
            {
                "cc": "FM",
                "cn": l[18937]
            },
            {
                "cc": "MD",
                "cn": l[18938]
            },
            {
                "cc": "MC",
                "cn": l[18939]
            },
            {
                "cc": "MN",
                "cn": l[18940]
            },
            {
                "cc": "ME",
                "cn": l[18941]
            },
            {
                "cc": "MS",
                "cn": l[18942]
            },
            {
                "cc": "MA",
                "cn": l[18943]
            },
            {
                "cc": "MZ",
                "cn": l[18944]
            },
            {
                "cc": "MM",
                "cn": l[18945]
            },
            {
                "cc": "NA",
                "cn": l[18946]
            },
            {
                "cc": "NR",
                "cn": l[18947]
            },
            {
                "cc": "NP",
                "cn": l[18948]
            },
            {
                "cc": "NL",
                "cn": l[18949]
            },
            {
                "cc": "NC",
                "cn": l[18950]
            },
            {
                "cc": "NZ",
                "cn": l[18951]
            },
            {
                "cc": "NI",
                "cn": l[18952]
            },
            {
                "cc": "NE",
                "cn": l[18953]
            },
            {
                "cc": "NG",
                "cn": l[18954]
            },
            {
                "cc": "NU",
                "cn": l[18955]
            },
            {
                "cc": "NF",
                "cn": l[18956]
            },
            {
                "cc": "KP",
                "cn": l[18957]
            },
            {
                "cc": "MP",
                "cn": l[18958]
            },
            {
                "cc": "NO",
                "cn": l[18959]
            },
            {
                "cc": "OM",
                "cn": l[18960]
            },
            {
                "cc": "PK",
                "cn": l[18961]
            },
            {
                "cc": "PW",
                "cn": l[18962]
            },
            {
                "cc": "PS",
                "cn": l[18963]
            },
            {
                "cc": "PA",
                "cn": l[18964]
            },
            {
                "cc": "PG",
                "cn": l[18965]
            },
            {
                "cc": "PY",
                "cn": l[18966]
            },
            {
                "cc": "PE",
                "cn": l[18967]
            },
            {
                "cc": "PH",
                "cn": l[18968]
            },
            {
                "cc": "PN",
                "cn": l[18969]
            },
            {
                "cc": "PL",
                "cn": l[18970]
            },
            {
                "cc": "PT",
                "cn": l[18971]
            },
            {
                "cc": "PR",
                "cn": l[18972]
            },
            {
                "cc": "QA",
                "cn": l[18973]
            },
            {
                "cc": "RE",
                "cn": l[18974]
            },
            {
                "cc": "RO",
                "cn": l[18975]
            },
            {
                "cc": "RU",
                "cn": l[18976]
            },
            {
                "cc": "RW",
                "cn": l[18977]
            },
            {
                "cc": "MF",
                "cn": l[18978]
            },
            {
                "cc": "KN",
                "cn": l[18979]
            },
            {
                "cc": "LC",
                "cn": l[18980]
            },
            {
                "cc": "VC",
                "cn": l[18981]
            },
            {
                "cc": "WS",
                "cn": l[18982]
            },
            {
                "cc": "SM",
                "cn": l[18983]
            },
            {
                "cc": "ST",
                "cn": l[18984]
            },
            {
                "cc": "SA",
                "cn": l[18985]
            },
            {
                "cc": "SN",
                "cn": l[18986]
            },
            {
                "cc": "RS",
                "cn": l[18987]
            },
            {
                "cc": "SC",
                "cn": l[18988]
            },
            {
                "cc": "SL",
                "cn": l[18989]
            },
            {
                "cc": "SG",
                "cn": l[18990]
            },
            {
                "cc": "SK",
                "cn": l[18991]
            },
            {
                "cc": "SI",
                "cn": l[18992]
            },
            {
                "cc": "SB",
                "cn": l[18993]
            },
            {
                "cc": "SO",
                "cn": l[18994]
            },
            {
                "cc": "ZA",
                "cn": l[18995]
            },
            {
                "cc": "GS",
                "cn": l[18996]
            },
            {
                "cc": "KR",
                "cn": l[18997]
            },
            {
                "cc": "SS",
                "cn": l[18998]
            },
            {
                "cc": "ES",
                "cn": l[18999]
            },
            {
                "cc": "LK",
                "cn": l[19000]
            },
            {
                "cc": "SH",
                "cn": l[19001]
            },
            {
                "cc": "PM",
                "cn": l[19002]
            },
            {
                "cc": "SD",
                "cn": l[19003]
            },
            {
                "cc": "SR",
                "cn": l[19004]
            },
            {
                "cc": "SJ",
                "cn": l[19005]
            },
            {
                "cc": "SZ",
                "cn": l[19006]
            },
            {
                "cc": "SE",
                "cn": l[19007]
            },
            {
                "cc": "CH",
                "cn": l[19008]
            },
            {
                "cc": "SY",
                "cn": l[19009]
            },
            {
                "cc": "TW",
                "cn": l[19010]
            },
            {
                "cc": "TJ",
                "cn": l[19011]
            },
            {
                "cc": "TZ",
                "cn": l[19012]
            },
            {
                "cc": "TH",
                "cn": l[19013]
            },
            {
                "cc": "TG",
                "cn": l[19014]
            },
            {
                "cc": "TK",
                "cn": l[19015]
            },
            {
                "cc": "TO",
                "cn": l[19016]
            },
            {
                "cc": "TT",
                "cn": l[19017]
            },
            {
                "cc": "TN",
                "cn": l[19018]
            },
            {
                "cc": "TR",
                "cn": l[19019]
            },
            {
                "cc": "TM",
                "cn": l[19020]
            },
            {
                "cc": "TC",
                "cn": l[19021]
            },
            {
                "cc": "TV",
                "cn": l[19022]
            },
            {
                "cc": "UG",
                "cn": l[19023]
            },
            {
                "cc": "UA",
                "cn": l[19024]
            },
            {
                "cc": "AE",
                "cn": l[19025]
            },
            {
                "cc": "UM",
                "cn": l[19026]
            },
            {
                "cc": "UY",
                "cn": l[19027]
            },
            {
                "cc": "UZ",
                "cn": l[19028]
            },
            {
                "cc": "VU",
                "cn": l[19029]
            },
            {
                "cc": "VA",
                "cn": l[19030]
            },
            {
                "cc": "VE",
                "cn": l[19031]
            },
            {
                "cc": "VN",
                "cn": l[19032]
            },
            {
                "cc": "VG",
                "cn": l[19033]
            },
            {
                "cc": "VI",
                "cn": l[19034]
            },
            {
                "cc": "WF",
                "cn": l[19035]
            },
            {
                "cc": "EH",
                "cn": l[19036]
            },
            {
                "cc": "YE",
                "cn": l[19037]
            },
            {
                "cc": "ZM",
                "cn": l[19038]
            },
            {
                "cc": "ZW",
                "cn": l[19039]
            },
            {
                "cc": "BQ",
                "cn": l[19078]
            },
            {
                "cc": "CW",
                "cn": l[19079]
            },
            {
                "cc": "HM",
                "cn": l[19080]
            },
            {
                "cc": "BL",
                "cn": l[19081]
            },
            {
                "cc": "SX",
                "cn": l[19082]
            },
            {
                "cc": "XK",
                "cn": l[19943]
            }
        ];
        var countries = {};
        $.each(countryNames.sort(M.sortObjFn("cn", 1, null)), function(index, cd) {
            countries[cd["cc"]] = cd["cn"];
        });
        this.countries = countries;
    }

    if (M !== undefined && M !== null && M._states) {
        this.states = M._states;
    } else {
        this.states =  {
            'CA-AB': 'Alberta',
            'CA-BC': 'British Columbia',
            'CA-MB': 'Manitoba',
            'CA-NB': 'New Brunswick',
            'CA-NL': 'Newfoundland and Labrador',
            'CA-NT': 'Northwest Territories',
            'CA-NS': 'Nova Scotia',
            'CA-NU': 'Nunavut',
            'CA-ON': 'Ontario',
            'CA-PE': 'Prince Edward Island',
            'CA-QC': 'Quebec',
            'CA-SK': 'Saskatchewan',
            'CA-YT': 'Yukon',
            'US-AL': 'Alabama',
            'US-AK': 'Alaska',
            'US-AS': 'American Samoa',
            'US-AZ': 'Arizona',
            'US-AR': 'Arkansas',
            'US-CA': 'California',
            'US-CO': 'Colorado',
            'US-CT': 'Connecticut',
            'US-DE': 'Delaware',
            'US-DC': 'District of Columbia',
            'US-FL': 'Florida',
            'US-GA': 'Georgia',
            'US-GU': 'Guam',
            'US-HI': 'Hawaii',
            'US-ID': 'Idaho',
            'US-IL': 'Illinois',
            'US-IN': 'Indiana',
            'US-IA': 'Iowa',
            'US-KS': 'Kansas',
            'US-KY': 'Kentucky',
            'US-LA': 'Louisiana',
            'US-ME': 'Maine',
            'US-MD': 'Maryland',
            'US-MA': 'Massachusetts',
            'US-MI': 'Michigan',
            'US-MN': 'Minnesota',
            'US-MS': 'Mississippi',
            'US-MO': 'Missouri',
            'US-MT': 'Montana',
            'US-NE': 'Nebraska',
            'US-NV': 'Nevada',
            'US-NH': 'New Hampshire',
            'US-NJ': 'New Jersey',
            'US-NM': 'New Mexico',
            'US-NY': 'New York',
            'US-NC': 'North Carolina',
            'US-ND': 'North Dakota',
            'US-MP': 'Northern Mariana Islands',
            'US-OH': 'Ohio',
            'US-OK': 'Oklahoma',
            'US-OR': 'Oregon',
            'US-PA': 'Pennsylvania',
            'US-PR': 'Puerto Rico',
            'US-RI': 'Rhode Island',
            'US-SC': 'South Carolina',
            'US-SD': 'South Dakota',
            'US-TN': 'Tennessee',
            'US-TX': 'Texas',
            'US-UM': 'United States Minor Outlying Islands',
            'US-UT': 'Utah',
            'US-VT': 'Vermont',
            'US-VA': 'Virginia',
            'US-VI': 'Virgin Islands, U.S.',
            'US-WA': 'Washington',
            'US-WV': 'West Virginia',
            'US-WI': 'Wisconsin',
            'US-WY': 'Wyoming'
        };
    }

    if (M !== undefined && M !== null && M._countryCallCodes) {
        this.countryCallCodes = M._countryCallCodes;
    } else {
        this.countryCallCodes = {
            'AF': '93',
            'AL': '355',
            'AS': '1684',
            'AD': '376',
            'AO': '244',
            'AI': '1264',
            'AQ': '672',
            'AG': '1268',
            'AR': '54',
            'AM': '374',
            'AW': '297',
            'AU': '61',
            'AT': '43',
            'AX': '358',
            'AZ': '994',
            'BS': '1242',
            'BH': '973',
            'BD': '880',
            'BB': '1246',
            'BY': '375',
            'BE': '32',
            'BZ': '501',
            'BJ': '229',
            'BM': '1441',
            'BQ': '599',
            'BT': '975',
            'BO': '591',
            'BA': '387',
            'BW': '267',
            'BR': '55',
            'BN': '673',
            'BG': '359',
            'BF': '226',
            'BI': '257',
            'BV': '599',
            'KH': '855',
            'CM': '237',
            'CA': '1',
            'CV': '238',
            'KY': '1345',
            'CF': '236',
            'TD': '235',
            'CL': '56',
            'CN': '86',
            'CX': '61',
            'CC': '61',
            'CO': '57',
            'KM': '269',
            'CK': '682',
            'CR': '506',
            'HR': '385',
            'IO': '246',
            'CU': '53',
            'CW': '599',
            'CY': '357',
            'CZ': '420',
            'CD': '243',
            'DK': '45',
            'DJ': '253',
            'DM': '1767',
            'DO': '18',
            'DZ': '213',
            'TL': '670',
            'EC': '593',
            'EG': '20',
            'SV': '503',
            'GQ': '240',
            'ER': '291',
            'EE': '372',
            'ET': '251',
            'FK': '500',
            'FO': '298',
            'FJ': '679',
            'FI': '358',
            'FR': '33',
            'PF': '689',
            'GA': '241',
            'GM': '220',
            'GE': '995',
            'GF': '594',
            'DE': '49',
            'GH': '233',
            'GI': '350',
            'GR': '30',
            'GL': '299',
            'GD': '1473',
            'GU': '1671',
            'GT': '502',
            'GG': '441481',
            'GN': '224',
            'GP': '590',
            'GS': '500',
            'GW': '245',
            'GY': '592',
            'HT': '509',
            'HM': '0',
            'HN': '504',
            'HK': '852',
            'HU': '36',
            'IS': '354',
            'IN': '91',
            'ID': '62',
            'IR': '98',
            'IQ': '964',
            'IE': '353',
            'IM': '441624',
            'IL': '972',
            'IT': '39',
            'CI': '225',
            'JM': '1876',
            'JP': '81',
            'JE': '441534',
            'JO': '962',
            'KZ': '7',
            'KE': '254',
            'KI': '686',
            'XK': '383',
            'KW': '965',
            'KG': '996',
            'LA': '856',
            'LV': '371',
            'LB': '961',
            'LS': '266',
            'LR': '231',
            'LY': '218',
            'LI': '423',
            'LT': '370',
            'LU': '352',
            'MO': '853',
            'MK': '389',
            'MG': '261',
            'MW': '265',
            'MY': '60',
            'MV': '960',
            'ML': '223',
            'MT': '356',
            'MH': '692',
            'MR': '222',
            'MU': '230',
            'YT': '262',
            'MX': '52',
            'FM': '691',
            'MA': '212',
            'MD': '373',
            'MC': '377',
            'MN': '976',
            'ME': '382',
            'MS': '1664',
            'MM': '95',
            'MQ': '596',
            'MZ': '258',
            'NA': '264',
            'NR': '674',
            'NP': '977',
            'NL': '31',
            'AN': '599',
            'NC': '687',
            'NZ': '64',
            'NI': '505',
            'NE': '227',
            'NF': '672',
            'NG': '234',
            'NU': '683',
            'KP': '850',
            'MP': '1670',
            'NO': '47',
            'OM': '968',
            'PK': '92',
            'PW': '680',
            'PS': '970',
            'PA': '507',
            'PG': '675',
            'PY': '595',
            'PE': '51',
            'PH': '63',
            'PN': '64',
            'PL': '48',
            'PT': '351',
            'PR': '1',
            'QA': '974',
            'CG': '242',
            'RE': '262',
            'RO': '40',
            'RU': '7',
            'RW': '250',
            'BL': '590',
            'SH': '290',
            'KN': '1869',
            'LC': '1758',
            'MF': '590',
            'PM': '508',
            'VC': '1784',
            'WS': '685',
            'SM': '378',
            'ST': '239',
            'SA': '966',
            'SN': '221',
            'RS': '381',
            'SC': '248',
            'SL': '232',
            'SG': '65',
            'SX': '1721',
            'SK': '421',
            'SI': '386',
            'SB': '677',
            'SO': '252',
            'ZA': '27',
            'KR': '82',
            'SS': '211',
            'ES': '34',
            'LK': '94',
            'SD': '249',
            'SR': '597',
            'SJ': '47',
            'SZ': '268',
            'SE': '46',
            'CH': '41',
            'SY': '963',
            'TW': '886',
            'TF': '260',
            'TJ': '992',
            'TZ': '255',
            'TH': '66',
            'TG': '228',
            'TK': '690',
            'TO': '676',
            'TT': '1868',
            'TN': '216',
            'TR': '90',
            'TM': '993',
            'TC': '1649',
            'TV': '688',
            'VI': '1340',
            'VG': '1284',
            'UG': '256',
            'UA': '380',
            'AE': '971',
            'GB': '44',
            'US': '1',
            'UY': '598',
            'UZ': '998',
            'VU': '678',
            'VA': '379',
            'VE': '58',
            'VN': '84',
            'WF': '681',
            'EH': '212',
            'YE': '967',
            'ZM': '260',
            'ZW': '263',
            'UM': '1'
        };
    }

    if (M !== undefined && M !== null && M._countryTrunkCodes) {
        this.countryTrunkCodes = M._countryTrunkCodes;
    }
    else {
        // Trunk codes are as per https://en.chahaoba.com/Country_Codes_List
        // and https://www.howtocallabroad.com/codes.html

        // Particular country call code not included? No trunk code for that country

        this.countryTrunkCodes = {
            '1': ['1'],
            '7': ['8'],
            '20': ['0'],
            '27': ['0'],
            '31': ['0'],
            '32': ['0'],
            '33': ['0'],
            '36': ['06'],
            '40': ['0'],
            '41': ['0'],
            '43': ['0'],
            '44': ['0'],
            '46': ['0'],
            '49': ['0'],
            '51': ['0'],
            '52': ['01', '044', '045'],
            '53': ['0'],
            '54': ['0'],
            '55': (phoneNumber) => {
                return [phoneNumber.startsWith('0') ? phoneNumber.substr(0, 3) : ''];
            },
            '57': ['0'],
            '58': ['0'],
            '60': ['0'],
            '61': ['0'],
            '62': ['0'],
            '63': ['0'],
            '64': ['0'],
            '66': ['0'],
            '81': ['0'],
            '82': ['0'],
            '84': ['0'],
            '86': ['0'],
            '90': ['0'],
            '91': ['0'],
            '92': ['0'],
            '93': ['0'],
            '94': ['0'],
            '95': ['0'],
            '98': ['0'],
            '212': ['0'],
            '218': ['0'],
            '232': ['0'],
            '233': ['0'],
            '234': ['0'],
            '243': ['0'],
            '249': ['0'],
            '251': ['0'],
            '254': ['0'],
            '255': ['0'],
            '256': ['0'],
            '260': ['0'],
            '261': ['0'],
            '262': ['0'],
            '263': ['0'],
            '264': ['0'],
            '291': ['0'],
            '353': ['0'],
            '355': ['0'],
            '358': ['0'],
            '359': ['0'],
            '370': ['8'],
            '373': ['0'],
            '374': ['0'],
            '375': ['0'],
            '380': ['0'],
            '381': ['0'],
            '382': ['0'],
            '385': ['0'],
            '386': ['0'],
            '387': ['0'],
            '389': ['0'],
            '421': ['0'],
            '590': ['0'],
            '591': ['0'],
            '593': ['0'],
            '594': ['0'],
            '595': ['0'],
            '596': ['0'],
            '597': ['0'],
            '598': ['0'],
            '599': ['0'],
            '691': ['1'],
            '692': ['692'],
            '850': ['0'],
            '855': ['0'],
            '856': ['0'],
            '880': ['0'],
            '886': ['0'],
            '961': ['0'],
            '962': ['0'],
            '963': ['0'],
            '964': ['0'],
            '966': ['0'],
            '967': ['0'],
            '970': ['0'],
            '971': ['0'],
            '972': ['0'],
            '976': ['0'],
            '977': ['0'],
            '992': ['8'],
            '993': ['8'],
            '994': ['0'],
            '995': ['0'],
            '996': ['0'],
            '998': ['0'],
        };
    }
}

/**
 * Moving all UI logic/initialisation code which you find that it would be good to be reusable here as a simple function,
 * which accepts:
 *  - first argument: jQuery element which contains the UI elements (e.g. scope)
 *  - second arg. optional: any options required for the ui to initialise the logic
 *
 *  note: this is a temp place which we will be using for the old MEGA code...for the new code, please use the ui directory.
 */

var uiPlaceholders = function($scope) {
    $('.have-placeholder', $scope)
        .rebind('focus.uiPlaceholder', function (e) {
            $(this).parent().removeClass('focused');

            if ($(this).val() == $(this).data('placeholder')) {
                $(this).val('');
            }

            if ($(this)[0].className.indexOf("password") > -1) {
                $(this)[0].type = "password";
            }
        })
        .rebind('keyup.uiPlaceholder', function (e) {
            $(this).parents('.incorrect').removeClass('incorrect');
        })
        .rebind('blur.uiPlaceholder', function (e) {
            $(this).parent().removeClass('focused');
            if ($(this).val() == '') {
                $(this).val($(this).data('placeholder'));
            }
            if ($(this)[0].className.indexOf("password") > -1 && $(this).val() == $(this).data('placeholder')) {
                $(this)[0].type = "text";
            }
        })
        .each(function () {
            if ($(this)[0].className.indexOf("password") > -1 && $(this).val() == $(this).data('placeholder')) {
                $(this)[0].type = "text";
            }
        });
};

/**
 * uiCheckboxes
 *
 * @param $scope {String|jQuery}
 * @param [saveState] {String} Optional, pass undefined to disable localStorage persisting of this checkbox's value
 * @param [stateChangeCb] {Function} Optional callback, that would be called when the checkbox's state is changed
 * @param [initialState] {Boolean} Optional, pass true to initialize as checked
 * @returns {jQuery}
 */
var uiCheckboxes = function($scope, saveState, stateChangeCb, initialState) {

    if (typeof saveState === 'function') {
        initialState = stateChangeCb;
        stateChangeCb = saveState;
        saveState = false;
    }
    $('.radio-txt', $scope).each(function() {
        var $label = $(this);
        var $cbxElement = $label.prev('.checkboxOn, .checkboxOff');
        var $input = $('input[type="checkbox"]', $cbxElement);

        var doToggle = function(state) {
            if ($label.parent().is(".disabled")) {
                return false;
            }

            if (state) {
                $cbxElement.removeClass('checkboxOff').addClass('checkboxOn');
            }
            else {
                $cbxElement.removeClass('checkboxOn').addClass('checkboxOff');
            }

            if (saveState) {
                if (state) {
                    localStorage[saveState] = 1;
                }
                else {
                    delete localStorage[saveState];
                }
            }
            if (stateChangeCb) {
                stateChangeCb.call($input.get(0), state);
            }
        };

        var _onToggle = function() {
            if ($cbxElement.hasClass('checkboxOn')) {
                doToggle();
                $input.prop('checked', false);
            }
            else {
                doToggle(true);
                $input.prop('checked', true);
            }
            return false;
        };

        $label.off('click.uiCheckboxes');
        $cbxElement.off('click.uiCheckboxes');
        $input.off('change.uiCheckboxes');

        if (initialState === true) {
            $input.prop('checked', true);
            $cbxElement.removeClass('checkboxOff').addClass('checkboxOn');
        }
        else {
            $input.prop('checked', false);
            $cbxElement.removeClass('checkboxOn').addClass('checkboxOff');
        }

        $label.rebind('click.uiCheckboxes', _onToggle);

        $input.rebind('change.uiCheckboxes', function() {
            doToggle($(this).prop('checked'));
        });
    });

    return $scope;
};

// MEGA Achievements
Object.defineProperty(mega, 'achievem', {
    value: Object.create(null, {
        RWDLVL: {value: 0},

        toString: {
            value: function toString(ach) {
                if (ach !== undefined) {
                    var res = Object.keys(this)
                        .filter(function(v) {
                            return this[v] === ach;
                        }.bind(this));

                    return String(res);
                }

                return '[object MegaAchievements]';
            }
        },

        bind: {
            value: function bind(action) {
                this.rebind('click', function() {
                    if (action) {
                        switch (action[0]) {
                            case '!':
                                var pf = navigator.platform.toUpperCase();
                                if (pf.indexOf('WIN') !== -1) {
                                    open('https://127.0.0.1/MEGAsyncSetup.exe');
                                    break;
                                }

                                if (pf.indexOf('MAC') !== -1) {
                                    open('https://127.0.0.1/MEGAsyncSetup.dmg');
                                    break;
                                }
                                mega.redirect('mega.io', 'desktop', false, false, false);
                                break;
                            case '/':
                                if (action === '/mobile') {
                                    mega.redirect('mega.io', 'mobile', false, false, false);
                                    break;
                                }
                                loadSubPage(action);
                                break;

                            case '~':
                                var fn = action.substr(1);
                                if (typeof mega.achievem[fn] === 'function') {
                                    if (fn.toLowerCase().indexOf('dialog') > 0) {
                                        closeDialog();
                                    }
                                    mega.achievem[fn]();
                                }
                                break;
                        }
                    }
                    return false;
                });
            }
        },

        prettify: {
            value: function prettify(maf) {
                var data = Object(clone(maf.u));
                var quota = {
                    storage: {base: 0, current: 0, max: 0},
                    transfer: {base: 0, current: 0, max: 0}
                };

                var setExpiry = function(data, out) {
                    var time = String(data[2]).split('');
                    var unit = time.pop();
                    time = time.join('') | 0;

                    if (time === 1 && unit === 'y') {
                        time = 12;
                        unit = 'm';
                    }

                    var result = {
                        unit: unit,
                        value: time
                    };

                    switch (unit) {
                        case 'd':
                            result.utxt = (time < 2) ? l[930] : l[16290];
                            break;
                        case 'w':
                            result.utxt = (time < 2) ? l[16292] : l[16293];
                            break;
                        case 'm':
                            result.utxt = (time < 2) ? l[913] : l[6788];
                            break;
                        case 'y':
                            result.utxt = (time < 2) ? l[932] : l[16294];
                            break;
                    }

                    out = out || data;
                    out.expiry = result;
                    return result;
                };

                Object.keys(data)
                    .forEach(function(k) {
                        setExpiry(data[k]);
                    });

                var mafr = Object(maf.r);
                var mafa = Object(maf.a);
                var alen = mafa.length;
                while (alen--) {
                    var ach = clone(mafa[alen]);

                    if (!data[ach.a]) {
                        data[ach.a] = Object(clone(mafr[ach.r]));
                        setExpiry(data[ach.a]);
                    }
                    var exp = setExpiry(mafr[ach.r] || data[ach.a], ach);
                    var ts = ach.ts * 1000;

                    ach.date = new Date(ts);
                    ach.left = Math.round((ach.e * 1000 - Date.now()) / 86400000);

                    if (data[ach.a].rwds) {
                        data[ach.a].rwds.push(ach);
                    }
                    else if (data[ach.a].rwd) {
                        data[ach.a].rwds = [data[ach.a].rwd, ach];
                    }
                    else {
                        data[ach.a].rwd = ach;
                    }
                }

                Object.keys(data)
                    .forEach(function(k) {
                        var ach = data[k];
                        var base = 0;
                        var rwds = ach.rwds || [ach.rwd];
                        for (var i = rwds.length; i--;) {
                            var rwd = rwds[i];

                            if (rwd && rwd.left > 0) {
                                base++;
                                if (ach[1]) {
                                    quota.transfer.current += mafr[rwd.r][1];
                                }
                                quota.storage.current += mafr[rwd.r][0];
                            }
                        }

                        if (ach[1]) {
                            quota.transfer.max += ach[1] * (base || 1);
                        }
                        quota.storage.max += ach[0] * (base || 1);
                    });

                if (Object(u_attr).p) {
                    quota.storage.base = Object(M.account).pstrg;
                    quota.transfer.base = Object(M.account).pxfer;
                }
                else {
                    quota.storage.base = maf.s;
                }

                data = Object.create(quota, Object.getOwnPropertyDescriptors(data));

                return data;
            }
        }
    })
});

(function(o) {
    var map = {
        /*  1 */ 'WELCOME'     : 'ach-create-account:/register',
        /*  2 */ 'TOUR'        : 'ach-take-tour',
        /*  3 */ 'INVITE'      : 'ach-invite-friend:~inviteFriendDialog',
        /*  4 */ 'SYNCINSTALL' : 'ach-install-megasync:!',
        /*  5 */ 'APPINSTALL'  : 'ach-install-mobile-app:/mobile',
        /*  6 */ 'VERIFYE164'  : 'ach-verify-number',
        /*  7 */ 'GROUPCHAT'   : 'ach-group-chat:/fm/chat',
        /*  8 */ 'FOLDERSHARE' : 'ach-share-folder:/fm/contacts',
        /*  9 */ 'SMSVERIFY'   : 'ach-sms-verification:~smsVerifyDialog'
    };
    var mapToAction = Object.create(null);
    var mapToElement = Object.create(null);

    Object.keys(map).forEach(function(k, idx) {
        Object.defineProperty(o, 'ACH_' + k, {
            value: idx + 1,
            enumerable: true
        });

        var tmp = map[k].split(':');
        mapToAction[idx + 1] = tmp[1];
        mapToElement[idx + 1] = tmp[0];
    });
    Object.defineProperty(o, 'mapToAction', {
        value: Object.freeze(mapToAction)
    });
    Object.defineProperty(o, 'mapToElement', {
        value: Object.freeze(mapToElement)
    });

})(mega.achievem);


/**
 * Check whether achievements are enabled for the current user.
 * @returns {MegaPromise}
 */
mega.achievem.enabled = function achievementsEnabled() {
    'use strict';

    var self = this;
    var promise = new MegaPromise();
    var status = 'ach' + u_type + u_handle;

    var notify = function(res) {
        self.achStatus[status] = res | 0;

        if ((res | 0) > 0) {
            return promise.resolve();
        }
        promise.reject();
    };

    if (typeof this.achStatus[status] === 'number') {
        notify(this.achStatus[status]);
    }
    else if (u_type && u_attr !== undefined) {
        notify(u_attr.flags && u_attr.flags.ach);
    }
    else if (this.achStatus[status] instanceof MegaPromise) {
        promise = this.achStatus[status];
    }
    else {
        this.achStatus[status] = promise;
        api.req({a: 'ach'}).then(({result}) => result).always(notify).catch(dump);
    }

    return promise;
};
mega.achievem.achStatus = Object.create(null);

/**
 * Show achievements list dialog
 * @param {Function} [onDialogClosed] function to invoke when the [x] is clicked
 */
mega.achievem.achievementsListDialog = function achievementsListDialog(onDialogClosed) {
    if (!M.maf) {
        loadingDialog.show();

        M.accountData(function() {
            loadingDialog.hide();

            if (M.maf) {
                achievementsListDialog(onDialogClosed);
            }
            else if (onDialogClosed) {
                onIdle(onDialogClosed);
            }
        });
        return true;
    }
    var $dialog = $('.mega-dialog.achievements-list-dialog');

    $('button.js-close', $dialog)
        .rebind('click', function() {
            if (onDialogClosed) {
                onIdle(onDialogClosed);
            }
            closeDialog();
            return false;
        });

    // hide everything until seen on the api reply (maf)
    $('.achievements-cell', $dialog).addClass('hidden');

    mega.achievem.bindStorageDataToView($dialog, true);

    // Show dialog
    M.safeShowDialog('achievements', () => {
        $dialog.removeClass('hidden');

        // Init scroll
        var $scrollBlock = $('.achievements-scroll', $dialog);

        if ($scrollBlock.is('.ps')) {
            $scrollBlock.scrollTop(0);
            Ps.update($scrollBlock[0]);
        }
        else {
            Ps.initialize($scrollBlock[0]);
        }

        return $dialog;
    });

    $('.invitees .new-dialog-icon', $dialog).rebind('click', () => {
        closeDialog();
        fm_showoverlay();
        mega.achievem.invitationStatusDialog();
    });
    $('.js-dashboard-btn', $dialog).rebind('click', () => {
        closeDialog();
        loadSubPage('fm/dashboard');
    });
};

/**
 * Show achievements list dialog
 * @param {Element} [$viewContext] element to bind the data dynamicaly
 * @param {boolean} [isDialog] boolean value for conditinal bindings
 */
mega.achievem.bindStorageDataToView = function bindStorageDataToView($viewContext, isDialog) {
    'use strict';
    var ach = mega.achievem;
    var maf = M.maf;
    var totalStorage = 0;
    var totalTransfer = 0;
    var totalInviteeCount = 0;
    var $cell;
    var locFmt = l[16325].replace(/\[S]/g, '<span>').replace(/\[\/S]/g, '</span>');

    const calculateAndBindRewardData = function calculateAndBindRewardData(data, idx) {

        if (data.rwds) {
            for (var i = data.rwds.length - 1; i >= 0; i--) {
                // totalStorage += data.rwds[i].left > 0 ? data[0] : 0;
                // totalTransfer += data.rwds[i].left > 0 ? data[1] : 0;
                totalInviteeCount += data.rwds[i].left > 0 ? 1 : 0;
            }
        }
        else if (data.rwd) {
            locFmt = l[16336].replace(/[()]/g, '').replace('[S]', '<span>').replace('[/S]', '</span>');

            // totalStorage += data[0];
            // totalTransfer += data[1];

            if (!data.rwd.e) {
                // this reward do not expires
                locFmt = '&nbsp;';
            }
            else if (data.rwd.left < 1) {
                // show "Expired"
                locFmt = l[1664];
                // totalStorage -= data[0];
                // totalTransfer -= data[1];
                $('.expires-txt', $cell).addClass('error');
                $cell.addClass('expired');
            }

            if (idx !== ach.ACH_INVITE) {
                $cell.addClass('achieved');

                if (data.rwd.expiry.unit === "d" && data.rwd.left > 0){
                    locFmt = mega.icu.format(l.ach_expires_days, data.rwd.left)
                        .replace('[S]', '<span>').replace('[/S]', '</span>');
                    $('.expires-txt', $cell).safeHTML(locFmt);
                }
                else {
                    $('.expires-txt', $cell).safeHTML(locFmt.replace('%1', data.rwd.left).replace('%2', l[16290]));
                }
                if (!$('.expires-txt', $cell).hasClass('error')) {
                    $('.expires-txt', $cell).addClass('info');
                }

                locFmt = '';
                switch (idx) {
                    case ach.ACH_WELCOME:     locFmt = l[16395]; break;
                    case ach.ACH_SYNCINSTALL: locFmt = l[16396]; break;
                    case ach.ACH_APPINSTALL:  locFmt = l[16397]; break;
                }
            }
        }
        else {
            locFmt = l[16291].replace(/[()]/g, '').replace('[S]', '<span>').replace('[/S]', '</span>');
            $('.expires-txt', $cell)
                .removeClass('error')
                .safeHTML('%n', locFmt, data.expiry.value, data.expiry.utxt);
            $cell.removeClass('expired');
        }

    };

    for (var idx in maf) {
        if (maf.hasOwnProperty(idx)) {
            idx |= 0;
            var data = maf[idx];
            var selector = ach.mapToElement[idx];
            if (selector) {
                $cell = $('.achievements-cell.' + selector, $viewContext).removeClass('hidden');

                if (idx !== 3 && (data.rwd || data.rwds)) {
                    $cell.addClass('one-reward');
                }

                if (!$cell.hasClass('localized')) {
                    $cell.addClass('localized');
                }

                calculateAndBindRewardData(data, idx);

                ach.bind.call($('.mega-button.positive', $cell), ach.mapToAction[idx]);
                $cell.removeClass('hidden');

                // If this is the SMS achievement, and SMS achievements are not enabled yet, hide the container
                if (selector === 'ach-sms-verification' && u_attr.flags.smsve !== 2) {
                    $cell.addClass('hidden');
                }
            }
        }
    }

    const loadDialogMoreData = function loadDialogMoreData() {

        $('.storage-quota .quota-txt', $viewContext).text(bytesToSize(M.maf.storage.current, 0));
        // $('.transfer-quota .quota-txt', $viewContext).text(bytesToSize(totalTransfer, 0));

        if (maf[3].rwds) {
            $('.invitees .quota-txt', $viewContext).text(totalInviteeCount);
            $('.invitees .new-dialog-icon', $viewContext).removeClass('hidden');
        }
        else if (maf[3].rwd && maf[3].rwd.left > 0) {
            $('.invitees .quota-txt', $viewContext).text(1);
            $('.invitees .new-dialog-icon', $viewContext).removeClass('hidden');
        }
        else {
            $('.invitees .quota-txt', $viewContext).text(0);
            $('.invitees .new-dialog-icon', $viewContext).addClass('hidden');
        }

    };

    if (isDialog) {
        loadDialogMoreData();
    }

    maf = ach = undefined;
};

/**
 * Show Invite a friend dialog
 * @param {String} close dialog parameter
 */
mega.achievem.inviteFriendDialog = function inviteFriendDialog(close) {
    var $dialog = $('.mega-dialog.invite-dialog');

    if (close) {
        showLoseChangesWarning().done(closeDialog);
        return true;
    }

    $('button.js-close', $dialog).rebind('click', mega.achievem.inviteFriendDialog);
    $('button.how-it-works', $dialog).rebind('click', () => {
        $('.how-it-works, .how-it-works-body', $dialog).toggleClass('closed');
    });

    var ach = mega.achievem;
    var maf = M.maf;
    maf = maf[ach.ACH_INVITE];

    $('.info-body p:first', $dialog).safeHTML(l[16317].replace('[S]', '<strong>').replace('[/S]', '</strong>'));

    // Remove all previously added emails
    $('.share-added-contact.token-input-token-invite', $dialog).remove();

    // Remove success dialog look
    $dialog.removeClass('success');

    // Default buttons states
    $('button.back', $dialog).addClass('hidden');
    $('button.send', $dialog).removeClass('hidden').addClass('disabled');
    $('button.status', $dialog).addClass('hidden');

    // Show dialog
    M.safeShowDialog('invite-friend', function() {
        'use strict';

        $dialog.removeClass('hidden');

        if (!$('.achievement-dialog.input').tokenInput("getSettings")) {
            mega.achievem.initInviteDialogMultiInputPlugin();
        }
        else {
            initPerfectScrollbar($('.multiple-input', $dialog));
            Soon(function() {
                $('.token-input-input-token-mega input', $dialog).trigger("focus");
            });
        }

        return $dialog;
    });

    // Remove unfinished user inputs
    $('#token-input-ach-invite-dialog-input', $dialog).val('');

    // Set focus on input so user can type asap
    $('.multiple-input .token-input-list-invite', $dialog).click();

    // Show "Invitation Status" button if invitations were sent before
    if (maf && maf.rwd && 0) {
        $('button.status', $dialog)
            .removeClass('hidden')
            .rebind('click', function() {
                closeDialog();
                mega.achievem.invitationStatusDialog();
            });
    }
    else {
        $('button.status', $dialog).addClass('hidden');
    }
};

/**
 * Load the SMS phone verification dialog
 */
mega.achievem.smsVerifyDialog = function () {

    'use strict';

    sms.phoneInput.init();
};

mega.achievem.initInviteDialogMultiInputPlugin = function initInviteDialogMultiInputPlugin() {

    // Init textarea logic
    var $dialog = $('.mega-dialog.invite-dialog');
    var $this = $('.achievement-dialog.multiple-input.emails input');
    var contacts = M.getContactsEMails();
    var errorTimer = null;

    $this.tokenInput(contacts, {
        theme: "invite",
        hintText: l[5908],
        searchingText: "",
        noResultsText: "",
        addAvatar: false,
        autocomplete: null,
        searchDropdown: false,
        emailCheck: true,
        preventDoublet: true,
        tokenValue: "id",
        propertyToSearch: "id",
        resultsLimit: 5,
        // Prevent showing of drop down list with contacts email addresses
        // Max allowed email address is 254 chars
        minChars: 255,
        visibleComma: true,
        accountHolder: (M.u[u_handle] || {}).m || '',
        scrolLocation: 'invite',
        excludeCurrent: false,
        visibleComma: false,
        enableHTML: true,
        onEmailCheck: function() {
            $('.achievement-dialog.input-info', $dialog).addClass('red').text(l[7415]);
            $('.achievement-dialog.multiple-input', $dialog).find('li input').eq(0).addClass('red');
            resetInfoText();
        },
        onDoublet: function (u, iType) {
            if (iType === 'opc') {
                $('.achievement-dialog.input-info', $dialog).addClass('red').text(l[17545]);
            }
            else if (iType === 'ipc') {
                $('.achievement-dialog.input-info', $dialog).addClass('red').text(l[17546]);
            }
            else {
                $('.achievement-dialog.input-info', $dialog).addClass('red').text(l[7413]);
            }
            $('.achievement-dialog.multiple-input', $dialog).find('li input').eq(0).addClass('red');

            resetInfoText();
        },
        onHolder: function() {
            $('.achievement-dialog.input-info', $dialog).addClass('red').text(l[7414]);
            $('.achievement-dialog.multiple-input', $dialog).find('li input').eq(0).addClass('red');
            resetInfoText();
        },
        onReady: function() {// Called once on dialog initialization
            var $input = $dialog.find('li input').eq(0);

            $input.rebind('keyup click change', function() {
                var value = $.trim($input.val());
                var emailList = value.split(/[ ;,]+/);
                var $wrapper = $('.multiple-input', $dialog);

                if (isValidEmail(value)) {
                    resetInfoText(0);
                    $('button.send', $dialog).removeClass('disabled');
                }
                else if ($wrapper.find('.share-added-contact').length > 0 || emailList.length > 1) {
                    $('button.send', $dialog).removeClass('disabled');
                }
                else {
                    $('button.send', $dialog).addClass('disabled');
                }
            });
            resetInfoText(0);
            setTimeout(function() {
                $('.token-input-input-token-invite input', $dialog).trigger("focus");
            }, 0);
        },
        onAdd: function() {
            $('.invite-dialog button.send', $dialog).removeClass('disabled');

            resetInfoText(0);
        },
        onDelete: function(item) {
            var $inviteDialog = $('.invite-dialog');
            var $inputTokens = $('.share-added-contact.token-input-token-invite', $dialog);
            var itemNum = $inputTokens.length;

            setTimeout(function() {
                $('.token-input-input-token-mega input', $inviteDialog).trigger("blur");
            }, 0);

            // Get number of emails
            if (itemNum === 0) {
                $('button.send', $inviteDialog).addClass('disabled');
            }
            else {
                $('button.send', $inviteDialog).removeClass('disabled');
            }
        }
    });

    // Rest input info text and color
    function resetInfoText(timeOut) {
        if (!$.isNumeric(timeOut)) {
            timeOut = 3000;
        }

        if (errorTimer) {
            clearTimeout(errorTimer);
            errorTimer = null;
        }

        errorTimer = setTimeout(function() {
            // Rest input info text and color
            $('.achievement-dialog.input-info')
                .removeClass('red')
                .text(l[9093]);

            $('.achievement-dialog.multiple-input').find('li input').eq(0)
                .removeClass('red').trigger('focus');
        }, timeOut);
    }

    // Invite dialog back button click event handler
    $('.mega-dialog.invite-dialog button.back').rebind('click', function() {
        var $dialog = $('.mega-dialog.invite-dialog');

        // Remove all previously added emails
        $('.share-added-contact.token-input-token-invite', $dialog).remove();

        // Disable Send button
        $('button.send', $dialog).addClass('disabled');

        initPerfectScrollbar($('.multiple-input', $dialog));
        Soon(function() {
            $('.token-input-input-token-mega input', $dialog).trigger("focus");
        });

        $dialog.removeClass('success');
    });

    // Invite dialog send button click event handler
    $('.mega-dialog.invite-dialog button.send').rebind('click', function() {
        'use strict';

        // Text message
        var emailText = l[5878];

        // List of email address planned for addition
        var $mails = $('.token-input-list-invite .token-input-token-invite');
        var mailNum = $mails.length;

        if (mailNum) {
            var error = false;

            // Loop through new email list
            $mails.each(function(index, value) {

                // Extract email addresses one by one
                var email = $(value).text().replace(',', '');
                const myEmail = Object(M.u[u_handle]).m || Object(window.u_attr).email;

                if (myEmail) {
                    M.inviteContact(myEmail, email, emailText);
                }
                else {
                    error = true;
                }
            });

            if (!error) {
                $('.mega-dialog.invite-dialog').addClass('success');
                $('.mega-dialog.invite-dialog button.back').removeClass('hidden');
                $('.mega-dialog.invite-dialog .share-added-contact.token-input-token-invite').remove();
            }
            else {
                console.warn('Unable to send invitation(s), no account access.');
            }
        }
        else {
            console.warn('Unable to send invitation(s), no emails found.');
        }
    });
}

/**
 * Show invitation status dialog
 * @param {String} close dialog parameter
 */
mega.achievem.invitationStatusDialog = function invitationStatusDialog(close) {
    'use strict';
    var $dialog = $('.mega-dialog.invitation-dialog');
    var $scrollBlock = $dialog.find('.table-scroll');

    if (close) {
        closeDialog();
        return true;
    }
    var $table = $scrollBlock.find('.table');

    if (!invitationStatusDialog.$tmpl) {
        invitationStatusDialog.$tmpl = $('.table-row:first', $table).clone();
    }

    var getConfig = function() {
        return invitationStatusDialog.config;
    };

    var setConfig = function(what, value) {
        invitationStatusDialog.config[what] = value;
    };

    if (!invitationStatusDialog.config) {
        invitationStatusDialog.config = {};
        setConfig('sortBy', l[16100]);
        setConfig('sortDir', 1);
    }
    $table.empty();

    $('button.js-close', $dialog).rebind('click', invitationStatusDialog);

    var ach = mega.achievem;
    var maf = M.maf;
    maf = maf[ach.ACH_INVITE];

    var locFmt;


    // Due specific M.maf.rwds structure sorting must be done respecting it
    var getSortByMafEmailFn = function() {
        var sortfn;

        sortfn = function(a, b, d) {
            if (typeof a.m[0] == 'string' && typeof b.m[0] == 'string') {
                return a.m[0].localeCompare(b.m[0]) * d;
            }
            return -1;
        };

        return sortfn;
    };

    /**
     * getSortByMafStatusFn, sort by .c and .csu attrs
     */
    var getSortByMafStatusFn = function() {
        var sortfn;

        sortfn = function(a, b, d) {

            var compare = function(x, y, d) {
                if (x < y) {
                    return (-1 * d);
                }
                else if (x > y) {
                    return d;
                }
                else {
                    return 0;
                }
            };

            if (a.c && b.c) {
                return compare(a.c, b.c);
            }
            else if (a.c && !b.c) {
                return d;
            }
            else if (!a.c && b.c) {
                return (-1 * d);
            }

            // No completed, search for .csu contact signed up
            else {
                if (a.csu && b.csu) {
                    return compare(a.csu, b.csu);
                }
                else if (a.csu && !b.csu) {
                    return d;
                }
                else if (!a.csu && b.csu) {
                    return (-1 * d);
                }

                // No completed and not signed up, sort by challenge timestamp
                else {
                    return compare(a.ts, b.ts);
                }
            }
        };

        return sortfn;
    };

    var sortFn = getSortByMafEmailFn();
    var sortBy = getConfig().sortBy;

    if (sortBy === l[89]) {// Status
        sortFn = getSortByMafStatusFn();
    }
    else if (sortBy === l[16100]) {// Date Sent
        sortFn = M.getSortByDateTimeFn();
    }
    var rwds = maf.rwds || [maf.rwd];
    var rlen = rwds.length;

    rwds.sort(
        function(a, b) {
            return sortFn(a, b, getConfig().sortDir);
        }
    );

    while (rlen--) {
        var rwd = rwds[rlen];
        var $tmpl = invitationStatusDialog.$tmpl.clone();

        $('.email strong', $tmpl).text(rwd.m[0]);
        $('.date span', $tmpl).text(time2date(rwd.ts));

        // If no pending (the invitee signed up)
        if (rwd.csu) {// csu - contact (invitee) signed up
            if (rwd.c) {// c - completed, time elapsed from time when app is installed

                $('.status', $tmpl)
                    .safeHTML(
                        '<strong class="green">@@</strong>' +
                        '<span class="light-grey"></span>',
                        l[16105]);// Quota Granted

                var expiry = rwd.expiry || maf.expiry;
                locFmt = l[16336].replace('[S]', '').replace('[/S]', '');
                $('.status .light-grey', $tmpl)
                    .safeHTML('%n', locFmt, expiry.value, expiry.utxt);

                $('.icon i', $tmpl).addClass('sprite-fm-mono icon-active granted-icon');
            }
            else {// Pending APP Install

                $('.status', $tmpl)
                    .safeHTML('<strong class="orange">@@</span>', l[16104]);// Pending App Install

                $('.icon i', $tmpl).addClass('sprite-fm-mono icon-exclamation-filled pending-install-icon');
            }

            // Remove reinvite button
            $('.date button.resend', $tmpl).remove();
        }
        else {// Pending

            $('.status', $tmpl)
                .safeHTML('<strong >@@</span>', l[7379]);// Pending

            $('.icon i', $tmpl).addClass('sprite-fm-mono icon-options pending-icon');

            // In case that time-limit is not
            $('.date button', $tmpl).rebind('click', function() {
                var $row = $(this).closest('.table-row');

                reinvite($('.email strong', $row).text(), $row);
                return false;
            });
        }

        $table.append($tmpl);
    }

    // Show dialog
    M.safeShowDialog('invitations', $dialog);

    // Init scroll
    initPerfectScrollbar($table);

    $('button.invite-more', $dialog).rebind('click', function() {
        closeDialog();
        mega.achievem.inviteFriendDialog();
        return false;
    });

    $('button.reinvite-all', $dialog).rebind('click', function() {
        $('.table-row', $table).each(function(idx, $row) {
            $row = $($row);

            if ($('.date div', $row).length) {
                reinvite($('.email strong', $row).text(), $row);
            }
        });
        $(this).addClass('hidden');
        return false;
    });

    // Click on sort column Email, Status or Date Sent
    $('.header .table-cell', $dialog).rebind('click', function() {

        var config = getConfig();
        var $elem = $('span', $(this));
        var sortBy = $elem.text();
        var sortClass = 'asc';

        // Do not sort for first colum
        if (!sortBy) {
            return false;
        }

        if (config.sortBy === sortBy) {
            setConfig('sortDir', config.sortDir * (-1))
        }
        else {
            setConfig('sortBy', sortBy);
            setConfig('sortDir', 1);
        }

        if (config.sortDir === -1) {
            sortClass = 'desc';
        }

        $('.table-cell span', $dialog).removeClass('asc desc');
        $($elem).addClass(sortClass);

        // Repaint dialog
        mega.achievem.invitationStatusDialog();
    });

    function reinvite(rawEmail, $row) {
        const email = String(rawEmail).trim();
        var opc = M.findOutgoingPendingContactIdByEmail(email);

        if (opc) {
            M.reinvitePendingContactRequest(email).catch(tell);
        }
        else {
            console.warn('No outgoing pending contact request for %s', email);
        }

        $('.date button.resend', $row).fadeOut(700);
    };
};

/**
 * Parse account achievements.
 */
mega.achievem.parseAccountAchievements = function parseAccountAchievements() {
    // hide everything until seen on the api reply (maf)
    var storageMaxValue = 0;
    var storageCurrentValue = 0;
    var transferMaxValue = 0;
    var transferCurrentValue = 0;
    var storageBaseQuota = 0;
    var transferBaseQuota = 0;

    var ach = mega.achievem;
    var maf = M.maf;
    for (var idx in maf) {
        if (maf.hasOwnProperty(idx)) {
            idx |= 0;
            var data = maf[idx];
            if (ach.mapToElement[idx]) {
                var base = 0;
                var rwds = data.rwds || [data.rwd];
                for (i = rwds.length; i--;) {
                    if (rwds[i] && rwds[i].left > 0) {
                        base++;
                    }
                }
                var storageValue = (data[0] * base);
                storageMaxValue += storageValue;
                if (data[1]) {
                    var transferValue = (data[1] * base);
                    transferMaxValue += transferValue;

                    if (data.rwd && data.rwd.left > 0) {
                        transferCurrentValue += transferValue;
                    }
                }

                if (idx === ach.ACH_INVITE) {
                    if (data.rwd && storageValue) {
                        storageCurrentValue += storageValue;
                    }
                }
                // Achieved
                else if (data.rwd && data.rwd.left > 0) {
                    storageCurrentValue += storageValue;
                }
            }
        }
    }

    // For free users only show base quota for storage and remove it for bandwidth.
    // For pro users replace base quota by pro quota
    storageBaseQuota = maf.storage.base ;

    if (u_attr.p) {
        transferBaseQuota = maf.transfer.base;
    }

    var storageProportion = storageCurrentValue / (storageBaseQuota + storageCurrentValue) * 100;
    var transferProportion = transferCurrentValue / (transferBaseQuota + transferCurrentValue) * 100;
    var storageAchieveValue = storageCurrentValue;
    var transferAchieveValue = transferCurrentValue;
    var $planContent = $('.data-block.account-type', '.fm-account-main');
    var $storageContent = $('.acc-storage-space', $planContent);
    var $bandwidthContent = $('.acc-bandwidth-vol', $planContent);
    storageCurrentValue += storageBaseQuota;
    transferCurrentValue += transferBaseQuota;

    $('.plan-info > span', $bandwidthContent).text(bytesToSize(transferCurrentValue, 3, 4));
    $('.settings-sub-bar', $bandwidthContent).css('width', transferProportion + '%');
    $('.base-quota-note span', $bandwidthContent).text(l[19992]
        .replace('%1', bytesToSize(transferBaseQuota, 3, 4)));
    $('.achieve-quota-note span', $bandwidthContent).text(l[19993]
        .replace('%1', bytesToSize(transferAchieveValue, 3, 4)));

    $('.plan-info > span', $storageContent).text(bytesToSize(storageCurrentValue, 0));
    $('.settings-sub-bar', $storageContent).css('width', storageProportion + '%');
    $('.base-quota-note span', $storageContent).text(l[19992]
        .replace('%1', bytesToSize(storageBaseQuota, 0)));
    $('.achieve-quota-note span', $storageContent).text(l[19993]
        .replace('%1', bytesToSize(storageAchieveValue, 0)));
};

// No one needs to mess with this externally
Object.freeze(mega.achievem);
