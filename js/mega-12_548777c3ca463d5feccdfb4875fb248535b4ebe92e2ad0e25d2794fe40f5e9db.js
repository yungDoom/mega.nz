/* Bundle Includes:
 *   js/fm/fileversioning.js
 *   js/fm/fileconflict.js
 *   js/ui/gdpr-download.js
 *   html/js/registerb.js
 *   js/emailNotify.js
 *   js/ui/slideshow/file.js
 *   js/ui/slideshow/manager.js
 *   js/ui/slideshow/playlist.js
 *   js/ui/slideshow/step.js
 *   js/ui/slideshow/utils.js
 *   js/ui/slideshow/settings/base/options.js
 *   js/ui/slideshow/settings/base/switch.js
 *   js/ui/slideshow/settings/order.js
 *   js/ui/slideshow/settings/speed.js
 *   js/ui/slideshow/settings/repeat.js
 *   js/ui/slideshow/settings/sub.js
 *   js/ui/slideshow/settings/settingsManager.js
 *   js/ui/imagesViewer.js
 *   js/filerequest_common.js
 *   js/filerequest_components.js
 *   js/filerequest.js
 *   js/ui/sprites.js
 *   js/ui/theme.js
 *   js/vendor/megalist.js
 *   js/ui/searchbar.js
 */

var versiondialogid;
(function _fileversioning(global) {
    'use strict';

    var current_sel_version = [];
    var ns = {
        /**
         * Get all the versions for given file handle in an async way.
         * If the versions are not loaded, it will load versions info into memory first.
         * @param h is expected to be a file handle.
         * @return It returns a list of handles of all the versions if everything works fine,
         * otherwise it returns list with current version.
         */
        async getAllVersions(h) {
            await dbfetch.tree([h], -1).catch(dump);
            return this.getAllVersionsSync(h);
        },

        /**
         * Get all the versions for given file handle.
         * @param {String} h is expected to be a file handle.
         * @return {Array} an array of ufs-nodes of all the versions if everything works fine,
         *         otherwise it returns list with current version.
         */
        getAllVersionsSync: function(h) {
            return this.getVersionHandles(h, true).map(h => M.d[h]).filter(Boolean);
        },

        /**
         * Get all the versions for given file handle.
         * @param {String} h is expected to be a file handle.
         * @param {Boolean} [includeroot] include {@h} in result.
         * @returns {Array} ufs-node's handles of all the versions.
         */
        getVersionHandles(h, includeroot = false) {
            const res = includeroot ? [h] : [];

            while (M.c[h]) {
                h = this.getChildVersion(h);
                if (h) {
                    res.push(h);
                }
            }
            return res;
        },

        /**
         * Retrieve a single version child
         * @param {String} h is expected to be a file handle.
         * @returns {Boolean|String} child handle or false
         */
        getChildVersion(h) {
            const c = Object.keys(M.c[h]);
            // 1. the chain should be 1 parent-child.
            // 2. the node's parent chain stops.
            // 3. the node's parent is a file.
            return c.length === 1 && M.c[h][c[0]] === 1 && (!M.d[c[0]] || !M.d[c[0]].t) && c[0];
        },

        /**
         * Check whether ph is an older version of h or is h.
         * @param h is expected to be the file handle of the current file.
         * @param ph is expected to be the file handle of an older version.
         * @return It returns true if ph is an older version of h, otherwise false.
         */
        checkPreviousVersionSync: function(h, ph) {
            return h === ph || this.getVersionHandles(h).includes(ph);
        },

        /**
         * Get the previous version for given file handle.
         * @param h is expected to be a file handle.
         * @return It returns the previous file of the given file handle, otherwise it returns false.
         */
        getPreviousVersionSync: function(h) {
            return M.c[h] && M.d[this.getChildVersion(h)] || false;
        },

        /**
         * Get the top node of the given file node from versioning chain.
         * @param h is expected to be a file handle.
         * @return It returns the top node of the passed in node.
        */
        getTopNodeSync: function(h) {
            var node = h;
            while (M.d[h] && M.d[M.d[h].p]) {

                if (M.d[M.d[h].p].t !== 0) {// the node's parent is not a file.
                    node = h;
                    break;
                }

                h = M.d[h].p;
            }
            return node;
        },

        /**
         * Close file versioning dialog if it is open.
         * @param {hanlde} del file hanle of the file to delete.
         */
        closeFileVersioningDialog: function (del) {
            if (!$('.fm-versioning').hasClass('hidden')) {
                if (del && $.selected && ($.selected.length === 0 || del === $.selected[0])) {
                    $('.fm-versioning').addClass('hidden');
                    current_sel_version = [];
                    versiondialogid = undefined;
                    $(document).off('keydown.fileversioningKeydown');
                    $(window).unbind('resize.fileversioning');

                    mBroadcaster.sendMessage('mega:close_fileversioning');
                }
                else {
                    fileversioning.updateFileVersioningDialog();
                }
            }
        },

        /**
         * delete all previous versions of a file.
         * @param {String} h ufs-node handle
         * @returns {Promise<*>}
         */
        clearPreviousVersions: function (h) {
            return fileversioning.getAllVersions(h)
                .then((versions) => {
                    var previousVersion = versions && versions.length > 1 ? versions[1] : false;
                    if (previousVersion) {
                        return api.screq({a: 'd', n: previousVersion.h});
                    }
                });
        },

        /**
         * set/remove favourite on all previous versions of a file.
         * @param {hanlde} h file hanle.
         * @param {Number} newFavState Favourites state 0 or 1
         */
        favouriteVersions: function (h, newFavState) {
            return fileversioning.getAllVersions(h)
                .then((versions) => {
                    const promises = [];
                    for (let i = 1; i < versions.length; i++) {
                        promises.push(api.setNodeAttributes(versions[i], {fav: newFavState | 0}));
                    }
                    return Promise.allSettled(promises);
                });
        },

        /**
         * set/remove labels on all previous versions of a file.
         * @param {hanlde} h file hanle.
         * @param {Number} labelId Numeric value of label
         */
        labelVersions: function (h, labelId) {
            return fileversioning.getAllVersions(h)
                .then((versions) => {
                    const promises = [];
                    for (let i = 1; i < versions.length; i++) {
                        promises.push(api.setNodeAttributes(versions[i], {lbl: labelId | 0}));
                    }
                    return Promise.allSettled(promises);
                });
        },

        /**
         * set/remove description on all previous versions of a file.
         * @param {String} h file handle.
         * @param {String} desc description string/text
         * @returns {Promise} promise
         */
        descriptionVersions(h, desc) {
            return fileversioning.getAllVersions(h)
                .then((versions) => {
                    const promises = [];
                    for (let i = 1; i < versions.length; i++) {
                        promises.push(api.setNodeAttributes(versions[i], {des: desc}));
                    }
                    return Promise.allSettled(promises);
                });
        },

        /**
         * update file versioning setting.
         */
        updateVersionInfo: function () {
            mega.attr.get(
                u_handle,
                'dv',
                -2,
                true
            ).done(r => {
                if (r === "0") {
                    $('#versioning-status').addClass('toggle-on').trigger('update.accessibility');
                    fileversioning.dvState = 0;
                }
                else if (r === "1") {
                    $('#versioning-status').removeClass('toggle-on').trigger('update.accessibility');
                    fileversioning.dvState = 1;
                }
            }).fail(e => {
                if (e === ENOENT) {
                    $('#versioning-status').addClass('toggle-on').trigger('update.accessibility');
                    fileversioning.dvState = 0;
                }
            });

            var data = M.getDashboardData();

            var $deleteButton = $('button#delete-all-versions').removeClass('disabled');
            if (data.versions.cnt === 0) {
                $deleteButton.addClass('disabled');
            }
            const verionInfo = mega.icu.format(l.version_file_summary, data.versions.cnt)
                .replace('[X]',
                         `<span class="versioning-text total-versions-size">${bytesToSize(data.versions.size)}</span>`);

            $('.versioning-body-text.versioning-info-message').safeHTML(verionInfo);
        },

        /**
         * Open file versioning dialog and render file history versions list.
         * @param {hanlde} handle hanle of the file to render history versioning list.
         *                 if handle is not set, then it will use the default one, $.selected[0].
         */
        fileVersioningDialog: function (handle) {
            var pd = $('.fm-versioning');
            var fh = (!handle) ? $.selected[0] : handle;
            var f = M.d[fh];
            if (!f) {
                return;
            }
            versiondialogid = fh;
            var nodeData = M.d[fh];
            // are we in an inshare?
            while (nodeData && !nodeData.su) {
                nodeData = M.d[nodeData.p];
            }

            current_sel_version = current_sel_version.length ? current_sel_version : [fh];

            var revertVersion = function(handle, current_node) {
                if (M.isInvalidUserStatus()) {
                    return;
                }

                var file = M.d[handle];
                var n = {
                    name: file.name,
                    hash: file.hash,
                    k: file.k
                };

                if (file.fav) {
                    n.fav = file.fav;
                }

                if (file.lbl) {
                    n.lbl = file.lbl;
                }

                if (file.des) {
                    n.des = file.des;
                }

                var ea = ab_to_base64(crypto_makeattr(n));
                var dir = M.d[current_node].p || M.RootID;
                var share = M.getShareNodesSync(dir, null, true);
                var req = {
                    a: 'p',
                    t: dir,
                    n: [{
                        h: handle,
                        t: 0,
                        a: ea,
                        k: a32_to_base64(encrypt_key(u_k_aes, file.k)),
                        fa: file.fa,
                        ov: current_node
                    }]
                };
                if (share.length) {

                    // repackage/-encrypt n for processing by the `p` API
                    var revertedNode = {};

                    // reverted files must retain their existing key
                    if (!file.t) {
                        revertedNode.k = file.k;
                    }

                    // new node inherits all attributes
                    revertedNode.a = ab_to_base64(crypto_makeattr(file, revertedNode));

                    // new node inherits handle, parent and type
                    revertedNode.h = n.h;
                    revertedNode.p = n.p;
                    revertedNode.t = n.t;
                    req.cr = crypto_makecr([revertedNode], share, false);
                }

                api.screq(req)
                    .then(({handle}) => {
                        $.selected = [handle];
                        reselect();
                    })
                    .catch(dump);
            };

            var fillVersionList = function(versionList) {

                var html = '';
                var lastDate = false;
                let firstHeader = true;
                for (var i = 0; i < versionList.length; i++) {

                    var v = versionList[i];
                    var curTimeMarker;
                    var msgDate = new Date(v.ts * 1000 || 0);
                    var iso = (msgDate.toISOString());
                    const isCurrentVersion = i === 0;

                    if (todayOrYesterday(iso)) {
                        // if in last 2 days, use the time2lastSeparator
                        curTimeMarker = time2lastSeparator(iso);
                    }
                    else {
                        // if not in the last 2 days, use 1st June [Year]
                        curTimeMarker = acc_time2date(v.ts, true);
                    }
                    //            <!-- Modification Date !-->
                    if (curTimeMarker !== lastDate) {
                        if (firstHeader) {
                            firstHeader = false;
                        }
                        else {
                            html += '</table>';
                        }
                        html += '<div class="fm-versioning data">' + curTimeMarker + '</div><table class="data-table">';
                    }
                    var actionHtml = (v.u === u_handle) ? l[16480]
                        : l[16476].replace('%1', M.u[v.u] && M.u[v.u].m || l[7381]);
                    if (i < versionList.length - 1) {
                        if (v.name !== versionList[i + 1].name) {
                            actionHtml = l[17156].replace(
                                '%1',
                                '<span>' + htmlentities(versionList[i + 1].name) + '</span>');
                        }
                    }

                    var mostRecentHtml = isCurrentVersion ? '<span class="current">(' + l[17149] + ')</span>' : '';
                    var activeClass  = current_sel_version.includes(v.h) ? 'active' : '';
                    var downBtnHtml =
                        `<div class="mega-button small action download-file simpletip"
                            data-simpletip="${l[58]}"
                            aria-label="${l[58]}"
                            id="vdl_${v.h}">
                            <i class="sprite-fm-mono icon-download-small"></i>
                        </div>`;
                    var viewBtnHtml =
                        `<div class="mega-button small action preview-file simpletip"
                            data-simpletip="${l.version_preview}"
                            aria-label="${l.version_preview}"
                            id="vdl_${v.h}">
                            <i class="sprite-fm-mono icon-file-edit"></i>
                        </div>`;
                    var revertBtnHtml =
                        `<div class="mega-button small action revert-file simpletip"
                            data-simpletip="${l[16475]}"
                            aria-label="${l[16475]}"
                            id="vrv_${v.h}">
                            <i class="sprite-fm-mono icon-versions-previous"></i>
                        </div>`;
                    // if the user does not have full access of the shared folder.
                    if (nodeData && nodeData.r < 2
                            || i === 0
                                && fileversioning.getTopNodeSync(current_sel_version[0]) === v.h
                    ) {
                        revertBtnHtml =
                            `<div class="mega-button small action revert-file disabled nonclickable simpletip"
                                data-simpletip="${l[16475]}"
                                aria-label="${l[16475]}"
                                id="vrv_${v.h}">
                                <i class="sprite-fm-mono icon-versions-previous disabled nonclickable"></i>
                            </div>`;
                    }
                    var deleteBtnHtml =
                        `<div class="mega-button small action delete-file simpletip"
                            data-simpletip="${l[1730]}"
                            aria-label="${l[1730]}"
                            id="vde_${v.h}">
                            <i class="sprite-fm-mono icon-bin"></i>
                        </div>`;
                    if ((nodeData && nodeData.r < 2) || !M.d[fh].tvf) {// if the user does not have full access of the shared folder.
                        deleteBtnHtml =
                            `<div class="mega-button small action delete-file disabled nonclickable"
                                data-simpletip="${l[1730]}"
                                aria-label="${l[1730]}"
                                id="vde_${v.h}">
                                <i class="sprite-fm-mono icon-bin disabled nonclickable"></i>
                            </div>`;
                    }

                    // If from backup
                    if (M.getNodeRoot(v.h) === M.InboxID) {
                        revertBtnHtml = ``;
                        if (isCurrentVersion) {
                            deleteBtnHtml = ``;
                        }
                    }

                    html += // <!-- File Data Row !-->
                            `<tr class="fm-versioning file-info-row ${activeClass}" id=v_${v.h}>
                                <td class="fm-versioning file-icon">
                                    <div class="item-type-icon-90 icon-${fileIcon({name : v.name})}-90"></div>
                                </td>
                                <td class="fm-versioning file-data">
                                    <div class="fm-versioning file-name">
                                        <span>${htmlentities(v.name)}</span>
                                    </div>
                                    <div class="fm-versioning file-info">
                                        <span class="size">${bytesToSize(v.s)}</span>
                                        <span>${mostRecentHtml}</span>
                                    </div>
                                </td>
                                ${/* Modification time */''}
                                <td class="fm-versioning modified-time">
                                    <i class="sprite-fm-uni icon-history"></i>
                                    <span>
                                        ${msgDate.getHours()}:${addZeroIfLenLessThen(msgDate.getMinutes(), 2)}
                                    </span>
                                </td>
                                ${/* Modification info */''}
                                <td class="fm-versioning modified-info">
                                    ${/* Classnames: "earth", "refresh-arrows",
                                    "mobile-device", "reverted-light-clock" */''}
                                    <span class="modified-info-txt">
                                        ${actionHtml}
                                    </span>
                                </td>
                                <td class="fm-versioning button-container">
                                    ${/* Buttons */''}
                                    <div class="fm-versioning buttons">
                                        ${downBtnHtml}
                                        ${viewBtnHtml}
                                        ${revertBtnHtml}
                                        ${deleteBtnHtml}
                                    </div>
                                    ${/* End of Buttons */''}
                                </td>
                            </tr>`;
                    lastDate = curTimeMarker;
                }
                html += '</table>';
                return html;
            };

            var a2 = M.getPath(M.d[fh].p);
            var name;
            var pathHtml = '';
            for (var i in a2) {
                let hasArrow = false;
                name = '';
                if (a2[i] === M.RootID) {
                    if (M.d[M.RootID]) {
                        name = l[164];
                    }
                }
                else if (a2[i] === 'contacts') {
                    name = l[165];
                }
                else if (a2[i] === 'opc') {
                    name = l[5862];
                }
                else if (a2[i] === 'ipc') {
                    name = l[5863];
                }
                else if (a2[i] === 'shares') {
                    name = l[5542];
                }
                else if (a2[i] === M.RubbishID) {
                    name = l[167];
                }
                else if (M.BackupsId && a2[i] === M.BackupsId) {
                    name = l.restricted_folder_button;
                    hasArrow = false;
                }
                else if (a2[i] === 'messages') {
                    name = l[166];
                }
                else {
                    var n = M.d[a2[i]];
                    if (n && n.name) {
                        name = n.name;
                        hasArrow = true;
                    }
                }

                if (name) {
                    name = htmlentities(name);
                    pathHtml =
                        `<span>
                            ${hasArrow ? '<i class="sprite-fm-mono icon-arrow-right"></i>' : ''}
                            <span class="simpletip" data-simpletip="${name}">${name}</span>
                        </span>` + pathHtml;
                }
            }

            var refreshHeader = function(fileHandle) {

                const headerSelect = '.fm-versioning .pad .top-column';
                const $rvtBtn = $('button.js-revert', headerSelect);
                const $delBtn = $('button.js-delete', headerSelect);
                const $clrBtn = $('button.js-clear-previous', headerSelect);
                const topNodeHandle = fileversioning.getTopNodeSync(fileHandle);

                if (current_sel_version.length > 1
                    || current_sel_version[0] === topNodeHandle
                    || nodeData && nodeData.r < 2
                ) {

                    $rvtBtn.addClass("disabled nonclickable");
                }
                else {
                    $rvtBtn.removeClass("disabled nonclickable");
                }

                if (nodeData && (nodeData.r < 2)) {
                    $delBtn.addClass("disabled nonclickable");
                    $clrBtn.addClass("disabled nonclickable");
                }
                else {
                    if (!M.d[fh].tvf || current_sel_version.length === M.d[fh].tvf + 1) {
                        $delBtn.addClass("disabled nonclickable");
                    }
                    else {
                        $delBtn.removeClass("disabled nonclickable");
                    }
                    if (M.d[fh].tvf) {
                        $clrBtn.removeClass("disabled nonclickable");
                    }
                    else {
                        $clrBtn.addClass("disabled nonclickable");
                    }
                }

                // If from backup
                if (M.getNodeRoot(fileHandle) === M.InboxID) {
                    $rvtBtn.addClass("disabled nonclickable");
                    if (current_sel_version.includes(topNodeHandle)) {
                        $delBtn.addClass("disabled nonclickable");
                    }
                }

                var f = M.d[fileHandle];
                var fnamehtml = '<span>' + htmlentities(f.name);

                $('.fm-versioning .header .pad .top-column .file-data .file-name').html(fnamehtml);

                $('.fm-versioning .header .pad .top-column .item-type-icon-90')
                    .attr('class', `item-type-icon-90 icon-${fileIcon({'name':f.name})}-90`);

            };
            var fnamehtml = '<span>' + htmlentities(f.name);

            $('.fm-versioning .header .pad .top-column .file-data .file-name').html(fnamehtml);
            $('.fm-versioning .header .pad .top-column .file-data .file-path').html(pathHtml);
            $('.fm-versioning .header .pad .top-column .item-type-icon-90')
                .addClass(`icon-${fileIcon({'name':f.name})}-90`);

            $('.fm-versioning .pad .top-column button.js-download').rebind('click', () => {
                M.addDownload(current_sel_version);
            });

            $('.fm-versioning .pad .top-column button.js-delete')
                .rebind('click', function() {
                    if (M.isInvalidUserStatus()) {
                        return;
                    }
                    $('.fm-versioning.overlay').addClass('arrange-to-back');

                    if (!$(this).hasClass('disabled')) {

                        const msg = mega.icu.format(l[13750], current_sel_version.length);

                        msgDialog('remove', l[1003], msg, l[1007], e => {
                            if (e) {
                                api.screq(current_sel_version.map((n) => ({n, a: 'd', v: 1}))).catch(dump);
                                current_sel_version = [];
                            }
                            $('.fm-versioning.overlay').removeClass('arrange-to-back');
                        });
                    }
            });

            $('.fm-versioning .pad .top-column button.js-revert').rebind('click', function() {
                if (!$(this).hasClass('disabled')) {
                    revertVersion(current_sel_version[0], fh);
                }
            });

            $('.fm-versioning .button.close').rebind('click', function() {
                fileversioning.closeFileVersioningDialog(window.versiondialogid);
            });

            $('.pad .top-column button.js-preview', '.fm-versioning').rebind('click.version', () => {
                fileversioning.previewFile(current_sel_version[0]);
            });

            fileversioning.getAllVersions(fh)
                .then((versions) => {
                    var vh = fillVersionList(versions);
                    const $scrollBlock = $('.fm-versioning.scroll-bl', '.fm-versioning .body');

                    $('.fm-versioning .body .scroll-bl .content').html(vh);
                    $('.fm-versioning .body .file-info-row').rebind('click', function(e) {
                        if (!e.shiftKey) {
                            $('.fm-versioning .body .file-info-row').removeClass('active');
                            current_sel_version = [];
                        }

                        if (this.classList.contains('active')) {

                            this.classList.remove('active');
                            current_sel_version.splice(current_sel_version.indexOf(this.id.substring(2)), 1);
                        }
                        else {
                            this.classList.add('active');
                            current_sel_version.push(this.id.substring(2));
                        }
                        refreshHeader(this.id.substring(2));
                    });

                    $('.fm-versioning .body .file-info-row').rebind('dblclick.fileInfoRow', function(e) {

                        if (!e.shiftKey) {
                            $('.fm-versioning .body .file-info-row').removeClass('active');
                            $(this).addClass('active');
                            M.addDownload([this.id.substring(2)]);
                            current_sel_version = [this.id.substring(2)];
                            refreshHeader(this.id.substring(2));
                        }
                    });

                    $('.fm-versioning .buttons .download-file').rebind('click', function(e) {

                        if (e.shiftKey && current_sel_version.length > 0) {
                            $('.fm-versioning .body .file-info-row').removeClass('active');
                            this.closest('.file-info-row').classList.add('active');
                        }
                        M.addDownload([this.id.substring(4)]);
                        current_sel_version = [this.id.substring(4)];
                    });

                    $('.fm-versioning .buttons .revert-file').rebind('click', function(e) {
                        if (!$(this).hasClass('disabled')) {

                            if (e.shiftKey && current_sel_version.length > 0) {
                                $('.fm-versioning .body .file-info-row').removeClass('active');
                                this.closest('.file-info-row').classList.add('active');
                            }

                            revertVersion(this.id.substring(4), fh);
                            current_sel_version = [this.id.substring(4)];
                        }
                    });

                    $('.fm-versioning .buttons .delete-file').rebind('click', function(e) {
                        if (M.isInvalidUserStatus()) {
                            return;
                        }
                        if (!$(this).hasClass('disabled')) {
                            const n = this.id.substr(4);

                            if (e.shiftKey && current_sel_version.length > 0) {
                                $('.fm-versioning .body .file-info-row').removeClass('active');
                                this.closest('.file-info-row').classList.add('active');
                            }

                            $('.fm-versioning.overlay').addClass('arrange-to-back');
                            msgDialog('remove', l[1003], mega.icu.format(l[13750], 1), l[1007], e => {
                                if (e) {
                                    current_sel_version = [];
                                    api.screq({a: 'd', n, v: 1}).catch(dump);
                                }
                                $('.fm-versioning.overlay').removeClass('arrange-to-back');
                            });
                        }
                    });

                    $('.fm-versioning .pad .top-column button.js-clear-previous')
                        .rebind('click', function() {
                            if (M.isInvalidUserStatus()) {
                                return;
                            }

                            if (!$(this).hasClass('disabled')) {
                                msgDialog('remove', l[1003], mega.icu.format(l[17154], 1), l[1007], e => {
                                    if (e) {
                                        fileversioning.clearPreviousVersions(fh);
                                        current_sel_version = [fh];
                                    }
                                });
                            }
                        });
                    $('.buttons .preview-file', '.fm-versioning').rebind('click.version', function() {
                        fileversioning.previewFile($(this).prop('id').substring(4));
                    });
                    refreshHeader(fh);
                    pd.removeClass('hidden');
                    // Init scrolling
                    initPerfectScrollbar($scrollBlock);
                    $(window).rebind('resize.fileversioning', SoonFc(() => {
                        initPerfectScrollbar($scrollBlock);
                    }));
                    if (
                        !is_video(M.d[window.versiondialogid])
                        && !is_image2(M.d[window.versiondialogid])
                        && !is_text(M.d[window.versiondialogid])
                    ) {
                        $('.pad .top-column button.js-preview', '.fm-versioning').addClass('hidden');
                        $('.action.preview-file', '.fm-versioning').addClass('hidden');
                    }
                });

            $(document).rebind('keydown.fileversioningKeydown', function(e) {
                if (e.keyCode === 8) { // Backspace
                    e.stopPropagation();
                    fileversioning.closeFileVersioningDialog(window.versiondialogid);
                }
            });
            $('.fm-versioning .header .button.settings').rebind('click', function() {
                pd.addClass('hidden');
                loadSubPage('fm/account/file-management');
            });
            pushHistoryState(page);
        },

        /**
         * Update file versioning dialog if it is open.
         *
         *
         * @param {hanlde} fileHandle file hanle of the file to update,
         * it is null, just do refresh based on the currently selected file.
         *
         */
        updateFileVersioningDialog: function (fileHandle) {

            const current_sel = fileHandle || $.selected[0];
            const p = fileversioning.getTopNodeSync(current_sel);

            if (p) {
                // update node DOM.
                M.versioningDomUpdate(p);
            }

            if (!$('.fm-versioning').hasClass('hidden')) {
                if ($.selected.length === 0 ||
                    fileversioning.checkPreviousVersionSync(current_sel, $.selected[0]) ||
                    fileversioning.checkPreviousVersionSync($.selected[0], current_sel)) {
                    if (p) {
                        fileversioning.fileVersioningDialog(p);
                        $.selected[0] = p;
                    }
                }
            }
        },

        /**
         * Open the text editor for the given version handle
         *
         * @param {string} previewHandle Node handle of the version to preview
         * @returns {none} none (ESLint requires)
         */
        previewFile: function(previewHandle) {
            if (M.isInvalidUserStatus()) {
                return;
            }

            loadingDialog.show('common', l[23130]);
            const versionHandle = window.versiondialogid;
            const reopen = () => {
                fileversioning.fileVersioningDialog(versionHandle);
                $(`#v_${previewHandle}`).trigger('click');
            };
            if (is_text(M.d[previewHandle])) {
                fileversioning.closeFileVersioningDialog(versionHandle);
                mBroadcaster.once('text-editor:close', () => {
                    onIdle(reopen);
                });
                mega.fileTextEditor
                    .getFile(previewHandle)
                    .done((data) => {
                        loadingDialog.hide();
                        mega.textEditorUI.setupEditor(M.d[previewHandle].name, data, previewHandle, true);
                    })
                    .fail(loadingDialog.hide);
            }
            else if (is_video(M.d[previewHandle]) || is_image2(M.d[previewHandle])) {
                fileversioning.getAllVersions(versionHandle).then((res) => {
                    fileversioning.closeFileVersioningDialog(versionHandle);
                    if (is_video(M.d[previewHandle])) {
                        $.autoplay = previewHandle;
                    }
                    mBroadcaster.once('slideshow:close', reopen);
                    slideshow(previewHandle, 0, false, res);
                    loadingDialog.hide();
                });
            }
        },
    };
    ns.dvState = null;
    Object.defineProperty(global, 'fileversioning', {value: ns});
    ns = undefined;

    mBroadcaster.addListener('fm:initialized', function() {
        if (folderlink || !u_handle) {
            return;
        }

        mega.attr.get(u_handle, 'dv', -2, true).done(function(r) {
            fileversioning.dvState = r === "1" ? 1 : 0;
        });

        return 0xDEAD;
    });
})(this);

(function _fileconflict(global) {
    'use strict'; /* jshint -W074 */

    var keepBothState = Object.create(null);
    var saveKeepBothState = function(target, node, name) {
        if (!keepBothState[target]) {
            keepBothState[target] = Object.create(null);
        }
        keepBothState[target][name] = node;
    };

    var setName = function(file, name) {
        try {
            Object.defineProperty(file, 'name', {
                writable: true,
                configurable: true,
                value: M.getSafeName(name)
            });
        }
        catch (e) {
        }
    };

    var ns = {
        /**
         * Check files against conflicts
         * @param {Array} files An array of files to check for conflicts
         * @param {String} target The target node handle
         * @param {String} op Operation, one of copy, move, or upload
         * @param {Number} [defaultAction] The optional default action to perform
         * @returns {Promise} Resolves with a non-conflicting array
         * @memberof fileconflict
         */
        check: function(files, target, op, defaultAction, defaultActionFolders) {
            var noFileConflicts = !!localStorage.noFileConflicts;
            const {promise} = mega;
            var conflicts = [];
            var result = [];
            var merges = [];
            var mySelf = this;
            var breakOP = false;
            var foldersRepeatAction = null;

            // this is special if for copying from chat
            // 1- must be 1 item
            // 2- must be to 1 target.
            // --> no need to consider in all logical space of file/folder conflicts
            if (M.d[target] && M.d[target].name === M.myChatFilesFolder.name) {
                defaultAction = ns.KEEPBOTH;
            }

            for (var i = files.length; i--;) {
                var file = files[i];

                if (typeof file === 'string') {
                    file = clone(M.getNodeByHandle(file) || false);
                }

                if (!file) {
                    console.warn('Got invalid file...');
                    continue;
                }

                if (missingkeys[file.h]) {
                    result.push(file);
                    continue;
                }

                try {
                    // this could throw NS_ERROR_FILE_NOT_FOUND
                    var test = file.size;
                }
                catch (ex) {
                    ulmanager.logger.warn(file.name, ex);
                    continue;
                }

                var found = null;
                var nodeTarget = file.target || target;
                var nodeName = M.getSafeName(file.name);

                if (M.c[nodeTarget]) {
                    found = this.getNodeByName(nodeTarget, nodeName, false);
                }

                if (!found) {
                    found = this.locateFileInUploadQueue(nodeTarget, nodeName);
                }

                if (found && !noFileConflicts) {
                    conflicts.push([file, found]);
                }
                else {
                    setName(file, nodeName);
                    saveKeepBothState(nodeTarget, file, nodeName);
                    result.push(file);
                }
            }

            var resolve = function() {
                keepBothState = Object.create(null);
                result.fileConflictChecked = true;
                promise.resolve(result);
            };

            if (conflicts.length) {
                var repeat = null;
                var self = this;
                var save = function(file, name, action, node) {
                    var stop = false;
                    if (file) {
                        setName(file, name);
                        var isAddNode = true;

                        if (action === ns.REPLACE) {
                            if (!file.t) {
                                // node.id if it's for an upload queue entry
                                file._replaces = node.h || node.id;
                            }
                            else {
                                merges.push([file, node]);
                                isAddNode = false;
                                if (op === 'move') {
                                    // in move i need to propograte mergered folders
                                    // in order to remove.
                                    isAddNode = true;
                                    file._mergedFolderWith = node.h;
                                    if (M.getShareNodesSync(file.h).length || M.getShareNodesSync(node.h).length) {
                                        stop = true;
                                    }
                                }
                            }

                            if (mega.ui.searchbar && mega.ui.searchbar.recentlyOpened) {
                                mega.ui.searchbar.recentlyOpened.files.delete(file._replaces);
                            }
                        }
                        if (isAddNode) {
                            result.push(file);
                        }
                    }
                    saveKeepBothState(node.p || target, node, name);
                    if (stop) {
                        resolve();
                        breakOP = true;
                        return false;
                    }
                    return true;
                };

                switch (defaultAction) {
                    case ns.REPLACE:
                    case ns.DONTCOPY:
                    case ns.KEEPBOTH:
                        repeat = defaultAction;
                }
                switch (defaultActionFolders) {
                    case ns.REPLACE:
                    case ns.DONTCOPY:
                    case ns.KEEPBOTH:
                        foldersRepeatAction = defaultActionFolders;
                }

                var applyCheck = function _prompt(a) {
                    var promptPromise = new MegaPromise();

                    let tick = 0;
                    (function promptRecursion(a) {
                        var file = a.pop();

                        if (file) {
                            var node = file[1];
                            file = file[0];

                            var action = (file.t && file.t === 1) ? foldersRepeatAction : repeat;

                            if (action) {
                                var name = file.name;
                                var proceed = true;
                                switch (action) {
                                    case ns.DONTCOPY:
                                        break;
                                    case ns.KEEPBOTH:
                                        name = self.findNewName(name, node.p || target);
                                        /* falls through */
                                    case ns.REPLACE:
                                        proceed = save(file, name, action, node);
                                        break;
                                }
                                if (proceed) {
                                    if (++tick % 200) {
                                        promptRecursion(a);
                                    }
                                    else {
                                        onIdle(() => promptRecursion(a));
                                    }
                                }
                                else {
                                    promptPromise.resolve();
                                }
                            }
                            else {
                                self.prompt(op, file, node, a.length, node.p || target)
                                    .always(function(file, name, action, checked) {
                                        if (file === -0xBADF) {
                                            result = [];
                                            resolve();
                                        }
                                        else {
                                            if (checked) {
                                                if (!file.t) {
                                                    repeat = action;
                                                }
                                                else {
                                                    foldersRepeatAction = action;
                                                }
                                            }
                                            if (action !== ns.DONTCOPY) {
                                                if (!save(file, name, action, node)) {
                                                    promptPromise.resolve();
                                                    return;
                                                }
                                            }

                                            promptRecursion(a);
                                        }
                                    });
                            }
                        }
                        else {
                            promptPromise.resolve();
                        }
                    })(a);

                    return promptPromise;
                };

                applyCheck(conflicts).always(function _traversTree() {
                    if (merges && merges.length && !breakOP) { // merge mode ! --> checking everything
                        var conflictedNodes = [];
                        var okNodes = [];
                        for (var k = 0; k < merges.length; k++) {
                            var res = mySelf.filesFolderConfilicts(M.c[merges[k][0].h], merges[k][1].h);
                            conflictedNodes = conflictedNodes.concat(res.conflicts);
                            okNodes = okNodes.concat(res.okNodes);
                        }
                        result = result.concat(okNodes);

                        foldersRepeatAction = ns.REPLACE; // per specifications, merge all internal folders
                        applyCheck(conflictedNodes).always(resolve);
                    }
                    else {
                        resolve();
                    }
                });
            }
            else {
                resolve();
            }

            return promise;
        },

        filesFolderConfilicts: function _filesFolderConfilicts(nodesToCopy, target) {
            var okNodes = [];
            var folderFound = false;
            var conflictedNodes = [];

            if (!nodesToCopy || !target) {
                return {
                    okNodes: [],
                    conflicts: []
                };
            }
            if (!Array.isArray(nodesToCopy)) {
                nodesToCopy = Object.keys(nodesToCopy);
            }


            for (var k = 0; k < nodesToCopy.length; k++) {
                var currNode = clone(M.d[nodesToCopy[k]] || false);

                if (!currNode) {
                    console.warn('Got invalid node (file|folder)...');
                    continue;
                }
                currNode.keepParent = target;

                var found = null;

                var nodeName = M.getSafeName(currNode.name);
                if (M.c[target]) {
                    found = this.getNodeByName(target, nodeName, false);
                }

                if (!found) {
                    found = this.locateFileInUploadQueue(target, nodeName);
                }

                if (found) {
                    if (!folderFound) {
                        folderFound = currNode.t;
                    }
                    conflictedNodes.push([currNode, found]);
                }
                else {
                    setName(currNode, nodeName);
                    saveKeepBothState(target, currNode, nodeName);
                    okNodes.push(currNode);
                }
            }

            if (folderFound) {
                var newConflictedNodes = [];
                var newOkNodes = [];
                for (var k2 = 0; k2 < conflictedNodes.length; k2++) {
                    if (conflictedNodes[k2][0].t) { // array contains either files or folders only
                        var res = this.filesFolderConfilicts(M.c[conflictedNodes[k2][0].h], conflictedNodes[k2][1].h);
                        newConflictedNodes = newConflictedNodes.concat(res.conflicts);
                        newOkNodes = newOkNodes.concat(res.okNodes);
                    }
                }

                okNodes = okNodes.concat(newOkNodes);
                conflictedNodes = conflictedNodes.concat(newConflictedNodes);
            }

            return {
                okNodes: okNodes,
                conflicts: conflictedNodes
            };
        },

        /**
         * Prompt duplicates/fileconflict dialog.
         * @param {String} op Operation, one of copy, move, or upload
         * @param {Object} file The source file
         * @param {Object} node The existing node
         * @param {Number} remaining The remaining conflicts
         * @param {String} target Location where the new file(s) will be placed
         * @param {Number} dupsNB {optional} in case of duplications, total number
         * @returns {MegaPromise}
         */
        prompt: function(op, file, node, remaining, target, dupsNB) {
            var promise = new MegaPromise();
            var $dialog = this.getDialog();
            var name = M.getSafeName(file.name);
            var $a1 = $('.action-block.a1', $dialog).removeClass('hidden');
            var $a2 = $('.action-block.a2', $dialog).removeClass('hidden');
            var $a3 = $('.action-block.a3', $dialog).removeClass('hidden');
            var $icons = $('.item-type-icon-90', $dialog);
            var classes = $icons.attr('class').split(' ');
            $icons.removeClass(classes[classes.length - 1]); // remove last class

            // Hide the loading spinner, it will be shown again when the conflict is being resolved
            loadingDialog.phide();

            if (file.t) {
                $a3.addClass('hidden');
                $icons.addClass(`icon-${folderIcon(node)}-90`);
                $('.info-txt.light-grey', $dialog).text(l[17556]);
                $('.info-txt-fn', $dialog)
                    .safeHTML(escapeHTML(l[17550]).replace('%1', '<strong>' + name + '</strong>'));
            }
            else {
                $icons.addClass(is_mobile ? fileIcon(node) : `icon-${fileIcon(node)}-90`);

                // Check whether the user have full-access to the target, required to replace or create versions
                if (M.getNodeRights(target) < 2) {
                    $a1.addClass('hidden');
                }

                $('.info-txt.light-grey', $dialog).text(l[16487]);
                $('.info-txt-fn', $dialog)
                    .safeHTML(escapeHTML(l[16486]).replace('%1', '<strong>' + name + '</strong>'));
            }

            switch (op) {
                case 'dups':
                    $a3.addClass('hidden');
                    $('.info-txt.light-grey', $dialog).text(l[22103]);
                    if (file.t) {
                        $('.info-txt-fn', $dialog)
                            .safeHTML(l[22104].replace('{0}', '<strong>' + name + '</strong>'));

                        $('.red-header', $a1).text(l[22105]);
                        $('.light-grey', $a1).text(l[22110]);

                        $('.red-header', $a2).text(l[22111]);
                        $('.light-grey', $a2).text(l[22112]);
                    }
                    else {
                        $('.red-header', $a1).text(l[22105]);
                        $('.red-header', $a2).text(l[22106]);
                        $('.light-grey', $a1).text(l[22107]);
                        $('.light-grey', $a2).text(l[22108]);

                        $('.info-txt-fn', $dialog)
                            .safeHTML(l[22109].replace('{0}', '<strong>' + name + '</strong>'));

                    }
                    break;
                case 'copy':
                    if (file.t) {
                        $('.red-header', $a1).text(l[17551]);
                        $('.red-header', $a2).text(l[16500]);
                        $('.light-grey', $a1).text(l[17552]);
                        $('.light-grey', $a2).text(l[19598]);
                    }
                    else {
                        $('.red-header', $a1).text(l[16496]);
                        $('.red-header', $a2).text(l[16500]);
                        $('.red-header', $a3).text(l[17095]);
                        $('.light-grey', $a1).text(l[16498]);
                        $('.light-grey', $a2).text(l[16491]);
                        $('.light-grey', $a3).text(l[16515]);
                    }
                    break;
                case 'move':
                    if (file.t) {
                        $('.red-header', $a1).text(l[17553]);
                        $('.red-header', $a2).text(l[16499]);
                        $('.light-grey', $a1).text(l[17554]);
                        $('.light-grey', $a2).text(l[19598]);
                    }
                    else {
                        $('.red-header', $a1).text(l[16495]);
                        $('.red-header', $a2).text(l[16499]);
                        $('.red-header', $a3).text(l[17096]);
                        $('.light-grey', $a1).text(l[16497]);
                        $('.light-grey', $a2).text(l[16491]);
                        $('.light-grey', $a3).text(l[16514]);
                    }
                    break;
                case 'upload':
                    if (file.t) {
                        $('.red-header', $a1).text(l[17555]);
                        $('.red-header', $a2).text(l[16490]);
                        $('.light-grey', $a2).text(l[19598]);
                    }
                    else {
                        $('.red-header', $a1).text(l[17093]);
                        $('.red-header', $a2).text(l[16490]);
                        $('.red-header', $a3).text(l[17094]);
                        $('.light-grey', $a1).safeHTML(l[17097]);
                        $('.light-grey', $a2).text(l[16491]);
                        $('.light-grey', $a3).text(l[16493]);
                    }
                    break;
                case 'replace':
                    $('.red-header', $a1).text(l[16488]);
                    $('.red-header', $a2).text(l[16490]);
                    $('.red-header', $a3).text(l[17094]);
                    $('.light-grey', $a1).text(l[17602]);
                    $('.light-grey', $a2).text(l[16491]);
                    $('.light-grey', $a3).text(l[16493]);
                    break;
                case 'import':
                    $('.red-header', $a1).text(l[17558]);
                    $('.red-header', $a2).text(l[17559]);
                    $('.red-header', $a3).text(l[17560]);
                    $('.light-grey', $a3).text(l[17561]);
                    $('.light-grey', $a1).safeHTML(l[17097]);
                    break;
            }

            $('.file-name', $a1).text(name);
            if (file.t) {
                $('.file-size', $a1).text('');
                $('.file-size', $a2).text('');
                $('.file-size', $a3).text('');
                if (op === 'dups') {
                    $('.file-name', $a1).text(this.findNewName(file.name, target));
                    $('.file-name', $a2).text(name);
                    $('.file-date', $a1).text('');
                    $('.file-date', $a2).text('');
                    $('.file-date', $a3).text('');
                    if (dupsNB > 2 || M.currentrootid === 'shares') {
                        $a2.addClass('hidden');
                    }
                }
            }
            else {
                $('.file-size', $a1).text(bytesToSize(file.size || file.s || ''));
                $('.file-name', $a3).text(this.findNewName(file.name, target));
                $('.file-size', $a2).text(bytesToSize(node.size || node.s));
                $('.file-size', $a3).text(bytesToSize(file.size || file.s || ''));
                if (op === 'dups') {
                    $('.file-name', $a1).text(this.findNewName(file.name, target));
                    $('.file-name', $a2).text(name);
                    $('.file-name', $a3).text(name);
                    $('.file-size', $a2).text(mega.icu.format(l[22113], dupsNB - 1));
                    $('.file-date', $a1).text('');
                    $('.file-date', $a2).text('');
                    $('.file-date', $a3).text('');

                }
            }
            if (op !== 'dups') {
                var myTime = file.mtime || file.ts || (file.lastModified / 1000);
                $('.file-date', $a1).text(myTime ? time2date(myTime, is_mobile ? 0 : 2) : '');
                $('.file-date', $a3).text(myTime ? time2date(myTime, is_mobile ? 0 : 2) : '');
                $('.file-name', $a2).text(node.name);
                myTime = node.mtime || node.ts;
                $('.file-date', $a2).text(myTime ? time2date(myTime, 2) : '');
            }

            this.customNames($dialog);

            var done = function(file, name, action) {
                fileconflict.hideDialog();
                var checked = fileconflict.isChecked($dialog, action, ns.DONTCOPY);
                if (checked) {
                    // Show loading while process multiple files
                    loadingDialog.show();
                    promise.always(function() {
                        loadingDialog.hide();
                    });
                }
                // Make sure browser is not freeze and show loading dialog
                onIdle(function() {
                    promise.resolve(file, name, action, checked);
                })
            };

            $a1.rebind('click', function() {
                done(file, $('.file-name', this).text(), ns.REPLACE);
            });
            $a2.rebind('click', function() {
                done(file, 0, ns.DONTCOPY);
            });
            $a3.rebind('click', function() {
                done(file, $('.file-name', this).text(), ns.KEEPBOTH);
            });

            $('#versionhelp', $dialog).rebind('click.versionhelp', function() {
                window.open(this.href, '_blank');
                return false;
            });
            // $('.skip-button', $dialog).rebind('click', function() {
            //     done(null, 0, ns.DONTCOPY);
            // });
            this.getCloseButton($dialog).rebind('click', () => {
                done(-0xBADF);
            });

            $('#duplicates-checkbox', $dialog)
                .switchClass('checkboxOn', 'checkboxOff')
                .parent()
                .switchClass('checkboxOn', 'checkboxOff');

            var $aside = $('aside', $dialog).addClass('hidden');

            if (remaining) {
                var remainingConflictText = remaining > 1 ?
                    escapeHTML(l[16494]).replace('%1', '<span>' + remaining + '</span>') :
                    l[23294];
                $aside.removeClass('hidden');
                $('label', $aside).safeHTML(remainingConflictText);
                this.customRemaining($dialog);
            }

            loadingDialog.phide();
            uiCheckboxes($dialog);
            this.showDialog($dialog);

            return promise;
        },

        /**
         * Get node from file conflict dialog.
         * @returns {Object} Dialog
         */
        getDialog: function() {
            return $('.mega-dialog.duplicate-conflict', document.body);
        },

        /**
         * Show dialog using M.safeShowDialog functionality.
         * @param {Object} $dialog Dialog
         * @returns {void}
         */
        showDialog: function($dialog) {
            M.safeShowDialog('fileconflict-dialog', $dialog);
        },

        /**
         * Hide dialog using M.safeShowDialog functionality.
         * @returns {void}
         */
        hideDialog: function() {
            closeDialog();
        },

        /**
         * Get close button from file conflict dialog.
         * @param {Object} $dialog Dialog
         * @returns {Object} Close button
         */
        getCloseButton: function($dialog) {
            return $('button.js-close, button.cancel-button', $dialog);
        },

        /**
         * Check if the multiple conflict resolution option is checked
         * @param {Object} $dialog Dialog
         * @returns {Boolean} True if is checked
         */
        isChecked: function($dialog) {
            return $('#duplicates-checkbox', $dialog).prop('checked');
        },

        customNames: function() {
            return nop;
        },

        customRemaining: function() {
            return nop;
        },

        /**
         * Given a filename, create a new one appending (1)..(n) as needed.
         * @param {String} oldName The old file name
         * @returns {String}
         */
        getNewName: function(oldName) {
            var newName;
            var idx = oldName.match(/\((\d+)\)(?:\..*?)?$/);

            if (idx) {
                idx = idx[1] | 0;

                newName = oldName.replace('(' + (idx++) + ')', '(' + idx + ')');
            }
            else {
                newName = oldName.split('.');

                if (newName.length > 1) {
                    var ext = newName.pop();
                    newName = newName.join('.') + ' (1).' + ext;
                }
                else {
                    newName += ' (1)';
                }
            }

            return newName;
        },

        /**
         * Find new name
         * @param {String} name The old file name
         * @param {String} target The target to lookup at
         * @returns {String}
         */
        findNewName: function(name, target) {
            var newName = name;

            do {
                newName = this.getNewName(newName);
            } while (this.getNodeByName(target, newName) || this.locateFileInUploadQueue(target, newName));

            if (keepBothState[target]) {
                delete keepBothState[target]['~/.names.db'];
            }

            return newName;
        },

        /**
         * Find node by name.
         * @param {String} target The target to lookup at
         * @param {String} name The name to check against
         * @param {Boolean} [matchSingle] only return a single matching node
         * @returns {Object} The found node
         */
        getNodeByName: function(target, name, matchSingle) {
            var res;

            if (keepBothState[target] && keepBothState[target][name]) {
                return keepBothState[target][name];
            }

            if (!matchSingle && M.c[target]) {
                if (!keepBothState[target]) {
                    keepBothState[target] = Object.create(null);
                }
                if (!keepBothState[target]['~/.names.db']) {
                    const store = keepBothState[target]['~/.names.db'] = Object.create(null);
                    const handles = Object.keys(M.c[target]);

                    for (let i = handles.length; i--;) {
                        let n = M.d[handles[i]];
                        if (n && n.name) {
                            store[n.name] = n;
                        }
                    }
                }
                return keepBothState[target]['~/.names.db'][name];
            }

            for (var h in M.c[target]) {
                var n = M.d[h] || false;

                if (n.name === name) {

                    if (!matchSingle) {
                        return n;
                    }

                    if (res) {
                        return null;
                    }
                    res = n;
                }
            }

            return res;
        },

        /**
         * Locate file in the upload queue
         * @param {String} target The target to lookup at
         * @param {String} name The name to check against
         * @returns {Object} The queue entry found
         */
        locateFileInUploadQueue: function(target, name) {
            for (var i = ul_queue.length; i--;) {
                var q = ul_queue[i] || false;

                if (q.target === target && q.name === name) {
                    var r = Object.create(null);
                    r.id = q.id;
                    r.name = q.name;
                    r.size = q.size;
                    r.target = r.p = q.target;
                    r.ts = Math.floor(q.lastModified / 1e3);
                    return r;
                }
            }
        },

        resolveExistedDuplication: function(dups, target) {
            if (!dups || (!dups.files && !dups.folders) || !Object.keys(dups).length) {
                return;
            }

            var dupsKeys = Object.keys(dups.files);
            var allDups = dupsKeys.length;
            var operationsOrderPromise = new MegaPromise();

            loadingDialog.pshow();

            var resolveDup = function(duplicateEntries, keys, kIndex, type, applyToAll) {
                if (kIndex >= keys.length) {
                    operationsOrderPromise.resolve();
                    loadingDialog.phide();
                    return;
                }

                var name = keys[kIndex];


                var contuineResolving = function(file, fname, action, checked) {

                    var olderNode = null;
                    var newestTS = -1;
                    var newestIndex = -1;
                    var pauseRecusrion = false;

                    if (duplicateEntries[type][name].length == 2) {
                        olderNode = duplicateEntries[type][name][0];
                        if (M.d[duplicateEntries[type][name][1]].ts < M.d[olderNode].ts) {
                            olderNode = duplicateEntries[type][name][1];
                        }
                    }
                    else {
                        for (var k = 0; k < duplicateEntries[type][name].length; k++) {
                            if (M.d[duplicateEntries[type][name][k]].ts > newestTS) {
                                newestTS = M.d[duplicateEntries[type][name][k]].ts;
                                newestIndex = k;
                            }
                        }
                    }

                    switch (action) {
                        case ns.REPLACE:
                            // rename old files

                            var newName;
                            if (olderNode) {
                                newName = fileconflict.findNewName(name, target);
                                M.rename(olderNode, newName).catch(dump);
                            }
                            else {
                                for (var h = 0; h < duplicateEntries[type][name].length; h++) {
                                    if (h === newestIndex) {
                                        continue;
                                    }
                                    newName = fileconflict.findNewName(name, target);
                                    M.rename(duplicateEntries[type][name][h], newName).catch(dump);
                                }
                            }
                            break;
                        case ns.KEEPBOTH:
                            // merge

                            break;
                        case ns.DONTCOPY:
                            // keep the newest
                            if (type === 'files') {
                                if (olderNode) {
                                    M.moveToRubbish(olderNode).catch(dump);
                                }
                                else {
                                    var nodeToRemove = duplicateEntries[type][name];
                                    nodeToRemove.splice(newestIndex, 1);
                                    M.moveToRubbish(nodeToRemove).catch(dump);
                                }
                                // hide bar
                                $('.fm-notification-block.duplicated-items-found').removeClass('visible');
                            }
                            else {
                                // merge
                                if (olderNode) {
                                    // 2 items
                                    pauseRecusrion = true;

                                    var originalParent = M.d[olderNode].p;

                                    var f1 = M.getShareNodesSync(duplicateEntries[type][name][0]);
                                    var f2 = M.getShareNodesSync(duplicateEntries[type][name][1]);

                                    if ((f1 && f1.length) || (f2 && f2.length)) {
                                        loadingDialog.phide();
                                        msgDialog('warninga', 'Moving Error', l[17739], 'Error in Merging');
                                    }
                                    else {
                                        M.moveNodes([olderNode], M.RubbishID)
                                            .then(() => M.moveNodes([olderNode], originalParent, fileconflict.REPLACE))
                                            .then(() => {
                                                // no need to updateUI,
                                                // for optimization we will only hide the bar
                                                $('.fm-notification-block.duplicated-items-found')
                                                    .removeClass('visible');

                                                const ata = checked ? action : null;
                                                resolveDup(duplicateEntries, keys, ++kIndex, type, ata);
                                            })
                                            .catch(tell);
                                    }

                                }
                                else {
                                    // coming from apply to all
                                    for (var z = 0; z < duplicateEntries[type][name].length; z++) {
                                        if (z === newestIndex) {
                                            continue;
                                        }
                                        var newFolderName = fileconflict.findNewName(name, target);
                                        M.rename(duplicateEntries[type][name][z], newFolderName).catch(dump);
                                    }
                                }
                            }
                            break;
                    }

                    !pauseRecusrion && resolveDup(duplicateEntries, keys, ++kIndex, type, (checked) ? action : null);
                };

                if (applyToAll) {
                    contuineResolving(null, null, applyToAll, applyToAll);
                }
                else {
                    fileconflict.prompt('dups', M.d[duplicateEntries[type][name][0]],
                        M.d[duplicateEntries[type][name][1]], allDups - 1, target,
                        duplicateEntries[type][name].length).always(
                            contuineResolving
                        );
                }
            };

            resolveDup(dups, dupsKeys, 0, 'files');

            operationsOrderPromise.done(function() {
                dupsKeys = Object.keys(dups.folders);
                allDups = dupsKeys.length;

                loadingDialog.pshow();

                resolveDup(dups, dupsKeys, 0, 'folders');
            });

        },

        REPLACE: 1,
        DONTCOPY: 2,
        KEEPBOTH: 3
    };

    Object.defineProperty(global, 'fileconflict', {value: ns});

})(this);

/*
 * Functionality for the General Data Protection Regulation (GDPR) data download functionality
 * Used on the /gdpr page and the /fm/account/security page
 */
var gdprDownload = {

    /** Cached data from the API request */
    cachedData: null,

    /**
     * Initialise the Download button to fetch the user's account data from the API as a zip file
     * @param {String} containerClass The class name of the current page/container where the download button is
     */
    initDownloadDataButton: function(containerClass) {

        'use strict';

        // Cache selectors
        var $container = $('.' + containerClass);
        var $downloadButton = $container.find('.download-button');
        var $errorMessage = $container.find('.error-message');

        // On Download button click
        $downloadButton.off().on('click', function() {

            // Show an error message for iOS users because the download will not work for them
            if (is_ios) {
                $errorMessage.removeClass('hidden').text(l[18496]);
                return false;
            }

            // Show an error for IE or Edge users that the download will not work in this browser
            if (is_microsoft) {
                $errorMessage.removeClass('hidden').text(l[9065]);
                return false;
            }

            // Prevent double clicks/taps from firing multiple requests
            if ($downloadButton.hasClass('loading')) {
                return false;
            }

            // If the results are already fetched
            if (gdprDownload.cachedData !== null) {

                // Re-download the data without making an additional API request
                gdprDownload.startDownload(gdprDownload.cachedData);
                return false;
            }

            // Show the loading spinner
            $downloadButton.addClass('loading');

            // Fetch the account data from the API as a Base64 string
            api_req({ a: 'gdpr' }, {
                callback: function(result) {

                    // Hide the loading spinner
                    $downloadButton.removeClass('loading');

                    // Check for error because they fetched too many times
                    if (typeof result === 'number' && result === ETEMPUNAVAIL) {
                        $errorMessage.removeClass('hidden').text(l[253]);
                        return false;
                    }

                    // Check for generic error
                    else if (typeof result === 'number' && result < 0) {
                        $errorMessage.removeClass('hidden').text(l[47] + ' ' + l[135] + ': ' + result);
                        return false;
                    }

                    // Cache the results to prevent the API repeating the intensive collection work
                    gdprDownload.cachedData = result;

                    // Trigger the download
                    gdprDownload.startDownload(result);
                }
            });
        });
    },

    /**
     * Starts the file download for the user
     * @param {String} base64data The data from the API as a Base64 string
     */
    startDownload: function(base64data) {

        'use strict';

        // Convert from Base64 to chars
        var byteChars = atob(base64data);
        var byteNums = [];

        // Convert chars to an array of byte numbers
        for (var i = 0; i < byteChars.length; i++) {
            byteNums[i] = byteChars.charCodeAt(i);
        }

        // Convert to a typed array
        var byteArray = new Uint8Array(byteNums);

        // Prompt the save file dialog
        M.saveAs(byteArray, 'gdpr-data.zip');
    }
};

/** a class contains the code-behind of business register "registerb" page */
function BusinessRegister() {
    "use strict";
    this.cacheTimeout = 9e5; // 15 min - default threshold to update payment gateway list
    this.planPrice = 9.99; // initial value
    this.minUsers = 3; // minimum number of users
    this.maxUsers = 300; // maximum number of users
    this.isLoggedIn = false;
    this.hasAppleOrGooglePay = false;
    if (mega) {
        if (!mega.cachedBusinessGateways) {
            mega.cachedBusinessGateways = Object.create(null);
        }
    }
}


/** a function to rest business registration page to its initial state*/
/* eslint-disable-next-line complexity */
BusinessRegister.prototype.initPage = function(preSetNb, preSetName, preSetTel, preSetFname, preSetLname, preSetEmail) {
    "use strict";

    loadingDialog.show();

    var $pageContainer = $('.bus-reg-body');
    var mySelf = this;

    var $nbUsersInput = $('#business-nbusrs', $pageContainer).val(preSetNb || '');
    var $cnameInput = $('#business-cname', $pageContainer).val(preSetName || '');
    var $telInput = $('#business-tel', $pageContainer).val(preSetTel || '');
    var $fnameInput = $('#business-fname', $pageContainer).val(preSetFname || '');
    var $lnameInput = $('#business-lname', $pageContainer).val(preSetLname || '');
    var $emailInput = $('#business-email', $pageContainer).val(preSetEmail || '');
    var $passInput = $('#business-pass', $pageContainer).val('');
    var $rPassInput = $('#business-rpass', $pageContainer).val('');
    var $storageInfo = $('.business-plan-note span', $pageContainer);

    $('.bus-reg-radio-block .bus-reg-radio', $pageContainer).removeClass('radioOn').addClass('radioOff');
    $('.mega-terms.bus-reg-agreement .checkdiv', $pageContainer).removeClass('checkboxOn');
    $('.ok-to-auto.bus-reg-agreement .checkdiv', $pageContainer).addClass('checkboxOn');
    $('.bus-reg-agreement.mega-terms .radio-txt', $pageContainer).safeHTML(l['208s']);
    $('.bus-reg-plan .business-base-plan .left', $pageContainer)
        .text(l[19503].replace('[0]', this.minUsers));
    $storageInfo.text(l[23789].replace('%1', '15 ' + l[20160]));

    var nbUsersMegaInput = new mega.ui.MegaInputs($nbUsersInput);
    nbUsersMegaInput.showMessage('*' + l[19501], true);

    $nbUsersInput.rebind('keypress.business paste.business', e => {
        // Firefox fix bug on allowing strings on input type number applies to Webkit also
        if (e.type === 'paste') {
            var ptext = e.originalEvent.clipboardData.getData('text');
            if (isNaN(ptext)) {
                return false;
            }
        }
        if (e.type === 'keypress' && isNaN(e.key)) {
            return false;
        }
    });

    $nbUsersInput.rebind('wheel.registerb', function(e) {
        e.preventDefault();
    });

    var cnameMegaInput = new mega.ui.MegaInputs($cnameInput);
    var telMegaInput = new mega.ui.MegaInputs($telInput);
    var fnameMegaInput = new mega.ui.MegaInputs($fnameInput);
    var lnameMegaInput = new mega.ui.MegaInputs($lnameInput);
    var emailMegaInput = new mega.ui.MegaInputs($emailInput);
    var passMegaInput = new mega.ui.MegaInputs($passInput);
    var rPassMegaInput = new mega.ui.MegaInputs($rPassInput);

    // Remove error on firstname and lastname at same time.
    $fnameInput.rebind('input.hideErrorName', function() {
        lnameMegaInput.hideError();
    });

    $lnameInput.rebind('input.hideErrorName', function() {
        fnameMegaInput.hideError();
    });

    // Remove error on password and repeat password at same time.
    $passInput.rebind('input.hideErrorPass', function() {
        rPassMegaInput.hideError();
    });

    $rPassInput.rebind('input.hideErrorPass', function() {
        passMegaInput.hideError();
    });

    // hiding everything to get ready first
    $pageContainer.addClass('hidden');  // hiding the main sign-up part
    $('.bus-confirm-body.confirm').addClass('hidden'); // hiding confirmation part
    $('.bus-confirm-body.verfication').addClass('hidden'); // hiding verification part

    // function to show first step of registration
    var unhidePage = function() {
        $pageContainer.removeClass('hidden');  // viewing the main sign-up part
        $('.bus-confirm-body.confirm').addClass('hidden'); // hiding confirmation part
        $('.bus-confirm-body.verfication').addClass('hidden'); // hiding verification part
        $pageContainer.find('#business-nbusrs').focus();
        loadingDialog.hide();
    };
    if (d && localStorage.debugNewPrice) {
        mySelf.usedGB = 7420;
    }

    // check if this is logged in user
    if (u_type) {
        if (u_attr && u_attr.b) {
            if (u_attr.b.s !== -1 && u_attr.b.s !== 2) {
                return loadSubPage('');
            }
            else {
                return loadSubPage('repay');
            }
        }
        else if (u_attr && u_attr.p && u_attr.p !== 100) {
            mySelf.hasAppleOrGooglePay = true;
        }
        if (!M.account) {
            M.accountData(mySelf.initPage.bind(
                mySelf,
                mySelf.preSetNb,
                mySelf.preSetName,
                mySelf.preSetTel,
                mySelf.preSetFname,
                mySelf.preSetLname,
                mySelf.preSetEmail
            ));
            return false;
        }
        mySelf.usedGB = M.account.space_used / 1073741824;

        $emailInput.val(u_attr['email']);
        $emailInput.prop('disabled', true);
        $emailInput.blur();
        $fnameInput.val(u_attr['firstname']);
        if (u_attr['firstname']) {
            $fnameInput.prop('disabled', true);
            $fnameInput.blur();
        }
        $lnameInput.val(u_attr['lastname']);
        if (u_attr['lastname']) {
            $lnameInput.prop('disabled', true);
            $lnameInput.blur();
        }

        // hiding element we dont need for logged-in users
        $passInput.parent().addClass('hidden');
        $rPassInput.parent().addClass('hidden');

        this.isLoggedIn = true;
    }

    $('.bus-reg-btn, .bus-reg-btn-2', $pageContainer).addClass('disabled');

    var fillPaymentGateways = function(status, list) {

        var failureExit = function(msg) {

            msgDialog('warninga', '', msg || l[19342], '', function() {
                loadSubPage('start');
            });
        };

        if (!status) { // failed result from API
            return failureExit();
        }

        // clear the payment block
        var $paymentBlock = $('.bus-reg-radio-block', $pageContainer).empty();

        const icons = {
            ecpVI: 'sprite-fm-uni icon-visa-border',
            ecpMC: 'sprite-fm-uni icon-mastercard-border',
            Stripe2: 'sprite-fm-theme icon-stripe',
            stripeVI: 'sprite-fm-uni icon-visa-border',
            stripeMC: 'sprite-fm-uni icon-mastercard-border',
            stripeAE: 'sprite-fm-uni icon-amex',
            stripeJC: 'sprite-fm-uni icon-jcb',
            stripeUP: 'sprite-fm-uni icon-union-pay',
            stripeDD: 'provider-icon stripeDD'
        };

        var radioHtml = '<div class="bus-reg-radio-option"> ' +
            '<div class="bus-reg-radio payment-[x] radioOff" prov-id="[Y]" gate-n="[Z]"></div>';
        var textHtml = '<div class="provider">[x]</div>';
        var iconHtml = `<div class="payment-icon">
                            <i class="[x]"></i>
                        </div></div>`;

        if (!list.length) {
            return failureExit(l[20431]);
        }

        if (!window.businessVoucher) {
            var paymentGatewayToAdd = '';
            for (var k = 0; k < list.length; k++) {
                var payRadio = radioHtml.replace('[x]', list[k].gatewayName).replace('[Y]', list[k].gatewayId).
                    replace('[Z]', list[k].gatewayName);
                var payText = textHtml.replace('[x]', list[k].displayName);
                var payIcon = iconHtml.replace('[x]', icons[list[k].gatewayName]);
                paymentGatewayToAdd += payRadio + payText + payIcon;
            }
            if (paymentGatewayToAdd) {
                $paymentBlock.safeAppend(paymentGatewayToAdd);
            }
        }
        $paymentBlock.safeAppend(
            radioHtml.replace('[x]', 'Voucher') + textHtml.replace('[x]', l[23494]) + '</div>'
        );

        // setting the first payment provider as chosen
        $('.bus-reg-radio-block .bus-reg-radio', $pageContainer).first().removeClass('radioOff')
            .addClass('radioOn');

        // event handler for radio buttons
        $('.bus-reg-radio-option', $paymentBlock)
            .rebind('click.suba', function businessRegisterationCheckboxClick() {
                const $me = $('.bus-reg-radio', $(this));
                if ($me.hasClass('radioOn')) {
                    return;
                }
                $('.bus-reg-radio', $paymentBlock).removeClass('radioOn').addClass('radioOff');
                $me.removeClass('radioOff').addClass('radioOn');
            });

        // view the page
        unhidePage();
    };

    const isValidBillingData = () => {
        return mySelf.planInfo.bd &&
            mySelf.planInfo.bd.us && (mySelf.planInfo.bd.us.p || mySelf.planInfo.bd.us.lp) &&
            mySelf.planInfo.bd.sto && (mySelf.planInfo.bd.sto.p || mySelf.planInfo.bd.sto.lp) &&
            mySelf.planInfo.bd.sto.s &&
            mySelf.planInfo.bd.trns && (mySelf.planInfo.bd.trns.p || mySelf.planInfo.bd.trns.lp) &&
            mySelf.planInfo.bd.trns.t &&
            mySelf.planInfo.bd.ba.s && mySelf.planInfo.bd.ba.t;
    };

    const isUsageCharges = () => {
        return mySelf.planInfo.bd.ba.s > 0 && mySelf.planInfo.bd.ba.t > 0 && mySelf.planInfo.bd.sto.s > 0
            && mySelf.planInfo.bd.trns.t > 0;
    };

    const isLocalInfoValid = () => {
        return mySelf.planInfo.l && mySelf.planInfo.l.lcs && mySelf.planInfo.l.lc;
    };

    const updateBreakdown = (users, quota, usrFare, quotaFare) => {
        users = Math.max(users || 0, mySelf.minUsers);
        quota = quota || mySelf.extraStorage;

        const mIntl = mega.intl;
        const intl = mIntl.number;

        const $breakdown = $('.business-plan-breakdown', $pageContainer);
        const $usersRow = $('.bus-plan-nb-users.bus-breakdown-row', $breakdown);
        const $quotaRow = $('.bus-plan-ex-quota.bus-breakdown-row', $breakdown).addClass('hidden');

        let totalUsr;
        let totalQuota = -1;
        let total = 0;

        if (mySelf.localPricesMode) {
            usrFare = usrFare || mySelf.planInfo.bd.us.lp;
            totalUsr = formatCurrency(total = usrFare * users, mySelf.planInfo.l.lc);

            if (quota && !Number.isNaN(quota)) {
                quotaFare = quotaFare || mySelf.planInfo.bd.sto.lp;
                const temp = quotaFare * quota;
                total += temp;
                totalQuota = formatCurrency(temp, mySelf.planInfo.l.lc);
            }
            total = `${formatCurrency(total, mySelf.planInfo.l.lc)}*`;
        }
        else {
            usrFare = usrFare || mySelf.planInfo.bd && mySelf.planInfo.bd.us.p || mySelf.planInfo.p;
            totalUsr = formatCurrency(total = usrFare * users);
            if (quota && !Number.isNaN(quota)) {
                quotaFare = quotaFare || mySelf.planInfo.bd.sto.p;
                const temp = quotaFare * quota;
                total += temp;
                totalQuota = formatCurrency(temp);
            }
            total = formatCurrency(total);
            $('.bus-price-footer-note', $pageContainer).addClass('hidden');
        }

        $('.nb-users-val', $usersRow).text(mega.icu.format(l.users_unit, users));
        $('.nb-users-fare', $usersRow).text(totalUsr);

        if (totalQuota !== -1) {
            $('.ex-quota-val', $quotaRow).text(l.additional_storage.replace('%1', quota));
            $('.ex-quota-fare', $quotaRow).text(totalQuota);
            $quotaRow.removeClass('hidden');
        }

        $('.business-plan-total .bus-total-val', $pageContainer).text(total);

    };

    const updatePriceGadget = function(users, quota) {
        if (!users) {
            users = mySelf.minUsers; // minimum val
        }
        const intl = mega.intl.number;
        const extraFares = Object.create(null);
        extraFares.storageFare = -1;
        extraFares.transFare = -1;
        extraFares.storageBase = -1;
        extraFares.transBase = -1;
        let localPricesMode = false;
        let quotaInfoPresent = false;

        if (typeof mySelf.planInfo.bd === 'undefined' || !isValidBillingData()) {

            // opps, bd is not available, new version of api cannot allow this.
            console.error('"bd" is not present or not valid. Something is wrong.');
            return false;
        }

        // hooray, new billing data.
        localPricesMode = mySelf.planInfo.bd.us.lp && mySelf.planInfo.bd.sto.lp && mySelf.planInfo.bd.trns.lp;
        localPricesMode = localPricesMode && isLocalInfoValid();

        const userFare = localPricesMode && mySelf.planInfo.bd.us.lp || mySelf.planInfo.bd.us.p;
        extraFares.storageFare = localPricesMode && mySelf.planInfo.bd.sto.lp || mySelf.planInfo.bd.sto.p;
        extraFares.transFare = localPricesMode && mySelf.planInfo.bd.trns.lp || mySelf.planInfo.bd.trns.p;
        extraFares.storageBase = mySelf.planInfo.bd.ba.s;
        extraFares.transBase = mySelf.planInfo.bd.ba.t;
        quotaInfoPresent = isUsageCharges();

        // setting the vals in the plan for payments.
        mySelf.planInfo.userFare = mySelf.planInfo.bd.us.p;


        const $gadget = $('.bus-reg-plan', $pageContainer);
        const $perUser = $('.business-plan-peruser', $gadget);
        const $perUse = $('.business-plan-peruse', $gadget).addClass('hidden');
        const $euroPriceBl = $('.bus-user-price-euro', $gadget).addClass('hidden');
        const $baseQuotaNote = $('.business-plan-quota-note', $gadget).addClass('hidden');

        const euroPriceText = formatCurrency(mySelf.planInfo.bd.us.p);
        let priceText = euroPriceText;
        let currncyAbbrv = '';

        if (localPricesMode) {

            priceText = formatCurrency(userFare, mySelf.planInfo.l.lc, 'narrowSymbol');
            currncyAbbrv = mySelf.planInfo.l.lc;

            $euroPriceBl.removeClass('hidden');

        }

        $('.bus-user-price-val', $perUser).text(priceText);
        $('.bus-user-price-val-euro', $perUser).text(euroPriceText);
        $('.bus-user-price-unit', $perUser).text(l.per_user.replace('%1', currncyAbbrv));

        if (quotaInfoPresent) {
            $('.bus-user-price-val', $perUse).text(l[5816].replace('[X]', extraFares.storageBase / 1024));
            $('.bus-quota-note-body', $baseQuotaNote)
                .text(l.base_stroage_note_desc.replace('%1', extraFares.storageBase / 1024)
                    .replace('%2', intl.format(mySelf.planInfo.bd.sto.p)));

            const neededQuota = mySelf.usedGB - extraFares.storageBase;
            if (neededQuota > 0) {
                mySelf.extraStorage = Math.ceil(neededQuota / 1024);
                const $extraStroage = $('.bus-addition-storage-block', $pageContainer).removeClass('hidden');
                $('.bus-add-storage-body', $extraStroage)
                    .text(l.additional_storage.replace('%1', mySelf.extraStorage));
                $('.bus-add-storage-foot', $extraStroage)
                    .text(l.additional_storage_desc.replace('%1', extraFares.storageBase / 1024));
                quota = mySelf.extraStorage;

                mySelf.planInfo.quotaFare = mySelf.planInfo.bd.sto.p;
            }

            $perUse.removeClass('hidden');
            $baseQuotaNote.removeClass('hidden');
        }

        mySelf.localPricesMode = localPricesMode;
        updateBreakdown(users, quota, userFare, extraFares.storageFare);
    };

    // event handler for check box
    $('.bus-reg-agreement', $pageContainer).rebind(
        'click.suba',
        function businessRegisterationCheckboxClick() {
            var $me = $('.checkdiv', $(this));
            if ($me.hasClass('checkboxOn')) {
                $me.removeClass('checkboxOn').addClass('checkboxOff');
                $('.bus-reg-btn, .bus-reg-btn-2', $pageContainer).addClass('disabled');
            }
            else {
                $me.removeClass('checkboxOff').addClass('checkboxOn');
                if ($('.bus-reg-agreement .checkdiv.checkboxOn', $pageContainer).length === 2) {
                    $('.bus-reg-btn, .bus-reg-btn-2', $pageContainer).removeClass('disabled');
                }
                else {
                    $('.bus-reg-btn, .bus-reg-btn-2', $pageContainer).addClass('disabled');
                }
            }
        });

    // event handlers for focus and blur on checkBoxes
    var $regChk = $('.checkdiv input', $pageContainer);
    $regChk.rebind(
        'focus.chkRegisterb',
        function regsiterbInputFocus() {
            $(this).parent().addClass('focused');
        }
    );

    $regChk.rebind(
        'blur.chkRegisterb',
        function regsiterbInputBlur() {
            $(this).parent().removeClass('focused');
        }
    );

    /**input values validation
     * @param {Object}  $element    the single element to validate, if not passed all will be validated
     * @returns {Boolean}   whether the validation passed or not*/
    var inputsValidator = function($element) {

        var passed = true;

        if (mySelf.isLoggedIn === false) {
            if (!$element || $element.is($passInput) || $element.is($rPassInput)) {

                // Check if the entered passwords are valid or strong enough
                var passwordValidationResult = security.isValidPassword($passInput.val(), $rPassInput.val());

                // If bad result
                if (passwordValidationResult !== true) {

                    // Show error for password field, clear the value and refocus it
                    $passInput.val('').focus().trigger('input');
                    $passInput.megaInputsShowError(passwordValidationResult);

                    // Show error for confirm password field and clear the value
                    $rPassInput.val('');
                    $rPassInput.parent().addClass('error');

                    passed = false;
                }
            }
        }
        if (!$element || $element.is($emailInput)) {
            if (!$emailInput.val().trim() || !isValidEmail($emailInput.val())) {
                emailMegaInput.showError($emailInput.val().trim() ? l[7415] : l.err_no_email);
                $emailInput.focus();
                passed = false;
            }
        }
        if (!$element || $element.is($lnameInput)) {
            if (!$lnameInput.val().trim()) {
                fnameMegaInput.showError(l.err_missing_name);
                lnameMegaInput.showError();
                $lnameInput.focus();
                passed = false;
            }
        }
        if (!$element || $element.is($fnameInput)) {
            if (!$fnameInput.val().trim()) {
                fnameMegaInput.showError(l.err_missing_name);
                lnameMegaInput.showError();
                $fnameInput.focus();
                passed = false;
            }
        }
        if (!$element || $element.is($telInput)) {
            const telVal = $telInput.val().trim();
            if (!M.validatePhoneNumber(telVal)) {
                telMegaInput.showError(telVal ? l.err_invalid_ph : l.err_no_ph);
                $telInput.focus();
                passed = false;
            }
        }
        if (!$element || $element.is($cnameInput)) {
            if (!$cnameInput.val().trim()) {
                cnameMegaInput.showError(l[19507]);
                $cnameInput.focus();
                passed = false;
            }
        }
        if (!$element || $element.is($nbUsersInput)) {
            var nbUsersTrimmed = $nbUsersInput.val().trim();
            if (!nbUsersTrimmed || nbUsersTrimmed < mySelf.minUsers) {
                nbUsersMegaInput.showError('*' + l[19501]);
                $nbUsersInput.focus();
                passed = false;
            }
            else if (nbUsersTrimmed && nbUsersTrimmed > mySelf.maxUsers) {
                nbUsersMegaInput.showError(mega.icu.format(l[20425], mySelf.maxUsers));
                $nbUsersInput.focus();
                passed = false;
            }
            else {
                nbUsersMegaInput.showMessage('*' + l[19501]);
            }
        }

        return passed;
    };


    // event handler for change on inputs
    $('.bus-reg-info-block input', $pageContainer).rebind(
        'input.suba',
        function nbOfUsersChangeEventHandler() {
            var $me = $(this);
            var valid = false;
            if ($me.is($nbUsersInput) && inputsValidator($me)) {
                $me.parent().removeClass('error');
                valid = true;
            }
            if ($me.attr('id') === 'business-nbusrs') {
                updateBreakdown(valid ? $me.val() : mySelf.minUsers);
            }
        }
    );

    // event handler for register button, validation + basic check
    var $regBtns = $('#business-reg-btn, #business-reg-btn-mob', $pageContainer);
    $regBtns.rebind(
        'click.regBtns',
        function registerBusinessAccButtonClickHandler() {

            if ($(this).hasClass('disabled')) {
                return false;
            }
            if (!inputsValidator()) {
                return false;
            }
            if (!u_type) {
                api_req({ a: 'ucr' });
            }

            mySelf.doRegister(
                $nbUsersInput.val().trim(),
                $cnameInput.val().trim(),
                $fnameInput.val().trim(),
                $lnameInput.val().trim(),
                M.validatePhoneNumber($telInput.val().trim()),
                $emailInput.val().trim(),
                $passInput.val());
        }
    );

    $regBtns.rebind(
        'keydown.regBtns',
        function regBusinessKeyDownHandler(e) {
            if (e.keyCode === 9) {
                e.preventDefault();
                $nbUsersInput.focus();
            }
            else if (e.keyCode === 32 || e.keyCode === 13) {
                e.preventDefault();
                $(this).triggerHandler('click');
            }
            return false;
        }
    );

    // event handlers for focus and blur on registerBtn
    $regBtns.rebind(
        'focus.regBtns',
        function regsiterbBtnFocus() {
            $(this).addClass('focused');
        }
    );

    $regBtns.rebind(
        'blur.regBtns',
        function regsiterbBtnBlur() {
            $(this).removeClass('focused');
        }
    );


    M.require('businessAcc_js').done(function afterLoadingBusinessClass() {
        var business = new BusinessAccount();

        business.getListOfPaymentGateways(false).always(fillPaymentGateways);
        business.getBusinessPlanInfo(false).then((info) => {
            mySelf.planPrice = Number.parseFloat(info.p);
            mySelf.planInfo = info;
            mySelf.minUsers = info.minu || 3;
            updatePriceGadget($nbUsersInput.val() || mySelf.minUsers);
        });
    });
};

/**
 * register new business account, values must be validated
 * @param {Number} nbusers      number of users in this business account
 * @param {String} cname        company name
 * @param {String} fname        first name of account owner
 * @param {String} lname        last name of account holder
 * @param {String} tel          telephone
 * @param {String} email        email
 * @param {String} pass         password
 */
BusinessRegister.prototype.doRegister = function(nbusers, cname, fname, lname, tel, email, pass) {
    "use strict";
    var $paymentMethod = $('.bus-reg-radio-option .bus-reg-radio.radioOn', '.bus-reg-body');
    var pMethod;
    if ($paymentMethod.hasClass('payment-Voucher')) {
        pMethod = 'voucher';
    }

    if (is_mobile) {
        parsepage(pages['mobile']);
    }
    loadingDialog.show();
    var mySelf = this;

    var afterEmphermalAccountCreation = function(isUpgrade) {
        // at this point i know BusinessAccount Class is required before
        var business = new BusinessAccount();
        var settingPromise = business.setMasterUserAttributes(nbusers, cname, tel, fname, lname,
            email, pass, isUpgrade);
        settingPromise.always(function settingAttrHandler(st, res) {
            if (st === 0) {
                if (res === EEXIST) {
                    msgDialog(
                        'warninga',
                        l[1578],
                        l[7869],
                        '',
                        function() {
                            loadingDialog.hide();
                            if (is_mobile) {
                                parsepage(pages['registerb']);
                                mySelf.initPage(nbusers, cname, tel, fname, lname, email);

                            }
                            var $emailInput = $('.bus-reg-body #business-email');
                            $emailInput.megaInputsShowError(l[1297]);
                            $emailInput.focus();
                        }
                    );
                }
                else {
                    msgDialog('warninga', l[1578], l[19508], res < 0 ? api_strerror(res) : res, () => {
                        loadingDialog.hide();
                        mySelf.initPage(nbusers, cname, tel, fname, lname, email);
                    });
                }
                loadingDialog.hide();
                return;
            }
            loadingDialog.hide();
            var userInfo = {
                fname: fname,
                lname: lname,
                nbOfUsers: nbusers,
                pMethod: pMethod,
                isUpgrade: isUpgrade,
                quota: mySelf.extraStorage
            };
            if (pMethod !== 'voucher') {
                mySelf.planInfo.usedGatewayId = $paymentMethod.attr('prov-id');
                mySelf.planInfo.usedGateName = $paymentMethod.attr('gate-n');
            }
            mySelf.goToPayment(userInfo);
        });
    };


    // call create ephemeral account function in security package
    if (!this.isLoggedIn || !u_type) {
        security.register.createEphemeralAccount(afterEmphermalAccountCreation);
    }
    else {
        afterEmphermalAccountCreation(true);
    }

};

/**
 * show the payment dialog
 * @param {Object} userInfo     user info (fname, lname and nbOfUsers)
 */
BusinessRegister.prototype.goToPayment = function(userInfo) {
    "use strict";
    if (userInfo.pMethod === 'voucher') {
        if (!userInfo.isUpgrade) {
            window.bCreatedVoucher = true;
        }
        window.busUpgrade = this.isLoggedIn;
        loadSubPage('redeem');
    }
    else {
        addressDialog.init(this.planInfo, userInfo, this);
    }

};

/**
 * Process the payment
 * @param {Object} payDetails       payment collected details from payment dialog
 * @param {Object} businessPlan     business plan details
 */
BusinessRegister.prototype.processPayment = function(payDetails, businessPlan) {
    "use strict";
    loadingDialog.show();

    new BusinessAccount().doPaymentWithAPI(payDetails, businessPlan).then(({result, saleId}) => {

        const redirectToPaymentGateway = () => {
            const isStrip = businessPlan.usedGatewayId ?
                (businessPlan.usedGatewayId | 0) === addressDialog.gatewayId_stripe : false;

            addressDialog.processUtcResult(result, isStrip, saleId);
        };

        let showWarnDialog = false;
        let payMethod = '';

        if (this.hasAppleOrGooglePay) {

            const purchases = M.account.purchases;
            for (let p in purchases) {
                if (purchases[p][4] === 2) {
                    showWarnDialog = true;
                    payMethod = 'Apple';
                    break;
                }
                else if (purchases[p][4] === 3) {
                    showWarnDialog = true;
                    payMethod = 'Google';
                    break;
                }
                else if (purchases[p][4] === 13) {
                    showWarnDialog = true;
                    payMethod = 'Windows Phone';
                    break;
                }
            }
        }

        if (showWarnDialog) {
            msgDialog('warninga', l[6859], l[20429].replace('{0}', payMethod), '', redirectToPaymentGateway);
        }
        else {
            redirectToPaymentGateway();
        }
    }).catch((ex) => {

        msgDialog('warninga', '', l[19511], ex < 0 ? api_strerror(ex) : ex, () => addressDialog.closeDialog());

    }).finally(() => loadingDialog.hide());
};

/**
 * Email Notification Settings.
 * A wrapper around `MegaIntBitMap` which confines to the bitmap format used for enotif settings.
 * - If the LSB is enabled, then all other bits can be considered enabled.
 */
(function(map) {
    'use strict';

    // Generate the bitmap attribute with `all` prepended to the list.
    var attribute = new MegaIntBitMap('enotif', ['all'].concat(map), -2, true, 300); // Autosave after 300ms.

    // Define a wrapper for the attribute which updates the first bit `all` to overwrite all other bits.
    Object.defineProperty(mega, 'enotif', {
        value: Object.freeze({
            types: map,

            /**
             * Set the state of an email
             * @param key The email key
             * @param newState The new state.
             * @return {MegaPromise}
             */
            setState: function(key, newState) {
                return new MegaPromise(function(resolve, reject) {
                    attribute.getAll().then(function (allEmailStates) {
                        var action;
                        if (allEmailStates.all === true) {
                            map.forEach(function (key) {
                                allEmailStates[key] = true;
                            });
                            allEmailStates.all = false;
                            allEmailStates[key] = false;
                            action = attribute.set(allEmailStates);
                        } else {
                            action = attribute.set(key, newState);
                        }
                        action.then(resolve, reject);
                    }, reject);
                });
            },

            /**
             * Returns map of {email-key => state}
             * @return {MegaPromise}
             */
            all: function() {
                return new MegaPromise(function(resolve, reject) {
                    attribute.getAll().then(function(allEmailStates) {
                        if (allEmailStates.all === true) {
                            map.forEach(function(key) {
                                allEmailStates[key] = true;
                            });
                        }
                        delete allEmailStates.all;
                        resolve(allEmailStates);
                    }, reject);
                });
            },

            /**
             * Set the state of all emails.
             * @param newState The new state
             * @return {MegaPromise}
             */
            setAllState: function(newState) {
                return attribute.setValue(newState ? 1 : 0);
            },

            /**
             * Trigger an attribute refetch.
             */
            handleAttributeUpdate: function() {
                attribute.handleAttributeUpdate().then(function() {
                    if (fminitialized && page === 'fm/account/notifications') {
                        if (is_mobile) {
                            mobile.settings.notifications.init();
                        } else {
                            accountUI.notifications.render();
                        }
                    }
                });
            },
        })
    });
})([
    // Emails that can be toggled on/off. Note: Do not change the order, only append new items as required.
    'contact-request',
    'chat-message',
    'achievements',
    'quota',
    'account-inactive',
    'referral-program',
    'RESERVED-business-usage',
    'card-expiry'
]);

lazy(mega.slideshow, 'file', () => {
    'use strict';

    return new class SlideshowFile {
        /**
         * Slideshow file handler to fetch all subtree MegaNodes and media files to be displayed on slideshow playlist
         * @returns {SlideshowFile} instance
         */
        constructor() {
            // state properties defining this function behavior
            this.state = {
                isReady: true,
                isAbort: false
            };

            Object.freeze(this);
        }

        /**
         * Update state to abort node fetching immediately
         * @returns {void}
         */
        abort() {
            this.setState({isReady: true, isAbort: true});
        }

        /**
         * Fetch all subtree MegaNodes on chunks and fetch those files not already available.
         * Fetched and filtered files will be added to slideshow playlist
         * @returns {Promise<*>} void
         */
        async fetch() {
            const {utils, manager} = mega.slideshow;

            const {filter} = manager.state;
            const opts = Object.assign({limit: 200, offset: 0});
            const inflight = [];

            this.setState({isReady: false, isAbort: false});

            await fmdb.getchunk('f', opts, (chunk) => {
                if (this.state.isAbort) {
                    return false;
                }
                opts.offset += opts.limit;
                // TODO check! large chunk causes UI block
                // opts.limit = Math.min(122880, opts.limit << 1);

                const updateIds = [];
                const fetchIds = [];

                for (let i = chunk.length; i--;) {
                    const n = chunk[i];

                    if (n && !n.fv && !n.rr && filter(n)) {
                        if (!M.d[n.h]) {
                            fetchIds.push(n.h);
                        }
                        else if (!M.v.some((v) => v.h === n.h) && utils.isNodeInCurrentTree(n)) {
                            updateIds.push(n.h);
                        }
                    }
                }

                if (updateIds.length) {
                    this._update(updateIds);
                }

                if (fetchIds.length) {
                    inflight.push(
                        dbfetch.geta(fetchIds)
                            .then(() => this._update(fetchIds))
                            .catch(dump)
                    );
                }
            });

            if (this.state.isAbort) {
                this.setState({isReady: true});
                return;
            }

            return Promise.allSettled(inflight).finally(() => {
                this.setState({isReady: true, isAbort: true});
            });
        }

        /**
         * Filter nodes to get only those included in current dir subtree.
         * Update M.v and playlist with those nodes
         * @param {String[]} nodeIds - node id list
         * @returns {void}
         */
        _update(nodeIds) {
            const {utils, playlist} = mega.slideshow;

            if (nodeIds && nodeIds.length) {
                const nodes = nodeIds
                    .map(h => M.d[h])
                    .filter(utils.isNodeInCurrentTree);

                if (nodes.length) {
                    M.v.push(...nodes);
                    playlist.add(nodes);
                }
            }
        }

        /**
         * Update state properties
         * @param {Object} behavior definition
         * @returns {void}
         */
        setState({isReady, isAbort}) {
            this.state.isReady = isReady === undefined ? this.state.isReady : isReady;
            this.state.isAbort = isAbort === undefined ? this.state.isAbort : isAbort;
        }
    };
});

lazy(mega.slideshow, 'manager', () => {
    'use strict';

    return new class SlideshowManager {
        /**
         * Slideshow manager / facade exposing slideshow playlist items operations.
         * Handle 2 different slideshow modes pointed out by "isPlayMode" state property
         * @returns {SlideshowManager} instance
         */
        constructor() {
            // state properties defining this function behavior
            this.state = {
                isPlayMode: false,
                isReset: false,
                nodes: null,
                filter: null,
                getNodeIdOnIndex: null
            };

            Object.freeze(this);
        }

        /**
         * Update state properties and playlist items
         * "mega.slideshow.file.fetch" can be fired while is in progress. In that case, current fetch will be aborted
         * before starting a new one
         * @param {Object} behavior definition
         * @returns {void}
         */
        setState({
            nodes,
            currentNodeId,
            isPlayMode,
            isReset,
            isAbortFetch,
            isChangeOrder,
            isNotBuildPlaylist
        }) {
            const {utils, file, settings, playlist} = mega.slideshow;

            this.state.isPlayMode = isPlayMode === undefined ? this.state.isPlayMode : isPlayMode;
            this.state.isReset = isReset === undefined ? this.state.isReset : isReset;
            this.state.nodes = nodes ? () => nodes : () => M.v;
            this.state.filter = utils.filterNodes(nodes, this.state.isPlayMode);
            this.state.getNodeIdOnIndex = (i) => utils.getNodeIdOnIndex(this.state.nodes()[i]);

            let hasToBuildPlaylist = !isNotBuildPlaylist && (!isAbortFetch || !this.state.isPlayMode);
            if (isAbortFetch) {
                file.abort();
                if (!isNotBuildPlaylist && settings.sub.getValue() && !utils.isCurrentDirFlat()) {
                    utils.setCurrentDir();
                    hasToBuildPlaylist = false;
                }
            }
            else if (!isChangeOrder && this._isFetchAllowed()) {
                if (!file.state.isReady) {
                    file.abort();
                }
                // give "file.abort" time to be effective
                delay('slideshow:fetch', () => file.fetch().catch(dump), 200);
            }

            if (hasToBuildPlaylist) {
                playlist.build(currentNodeId);
            }
        }

        /**
         * Return info about next playlist iteration
         * @param {String} nodeId - node id
         * @returns {Object} next playlist iteration
         */
        next(nodeId) {
            const {step, playlist} = mega.slideshow;

            const playLength = playlist.items.length;
            let next = {playLength};

            if (playlist.items.length > 1) {
                const {playIndex, node} = playlist.findNode(nodeId);

                const nextStep = node === undefined || this.state.isPlayMode && this.state.isReset ?
                    step.reset(playIndex) :
                    step.next(playIndex);

                next = {...next, node, playIndex, ...nextStep};
            }

            this.state.isReset = false;
            return next;
        }

        /**
         * Check if playlist item on index passed as argument is the last no the playlist
         * @param {Number} playIndex - playlist index
         * @returns {Boolean} whether current item is the last on the playlist
         */
        isLast(playIndex) {
            const {file, settings, playlist} = mega.slideshow;

            return playlist.items.length < 2 ||
                file.state.isReady &&
                !settings.repeat.getValue() &&
                playIndex === playlist.items.length - 1;
        }

        /**
         * Check if fetching items is allowed
         * @returns {Boolean} whether fetching items is allowed
         */
        _isFetchAllowed() {
            const {utils, settings, playlist} = mega.slideshow;

            return this.state.isPlayMode &&
                !utils.isCurrentDirFlat() &&
                settings.sub.getValue() &&
                !playlist.isFull();
        }
    };
});

lazy(mega.slideshow, 'playlist', () => {
    'use strict';

    // playlist max items allowed
    const maxItems = 1000;

    return new class SlideshowPlaylist {
        /**
         * Slideshow playlist handler holding MegaNode references to play on slideshow.
         * Playlist items will be ordered, pruned and placed based on slideshow state.
         *
         * Sample:
         *
         * - playlist items: [3, 1, 378, 23]
         * - nodes: [
         *      MegaNode_A // nodes[0] => - not in playlist -
         *      MegaNode_B // nodes[1] => playlist[1]
         *      MegaNode_C // nodes[2] => - not in playlist -
         *      MegaNode_D // nodes[3] => playlist[0]
         *      ...
         *      MegaNode_X // nodes[23] => playlist[3]
         *      ...
         *      MegaNode_Y // nodes[378] => playlist[2]
         *      ...
         *   ]
         * - so playlist de-referenced is: [MegaNode_D, MegaNode_B, MegaNode_Y, MegaNode_X]
         *
         * @returns {SlideshowPlaylist} instance
         */
        constructor() {
            // playlist items containing MegaNode indexes in a determined order
            this.items = [];

            Object.freeze(this);
        }

        /**
         * Build playlist items references based on slideshow state and MegaNodes available
         * Behavior changes when isPlayMode:
         * - playlist max length
         * - playlist ordering
         * - not absolute ordering may affect playlist first item
         * @param {String} nodeId - node id
         * @returns {void}
         */
        build(nodeId) {
            const {settings, manager} = mega.slideshow;
            const {isPlayMode, filter} = manager.state;
            const nodes = manager.state.nodes();
            const isAbsoluteOrder = settings.order.isAbsolute();

            let nodeIndex = -1;
            this.items.length = 0;

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (filter(node)) {
                    if (!isAbsoluteOrder && isPlayMode && nodeId !== undefined && node.h === nodeId) {
                        nodeIndex = i;
                    }
                    else {
                        this.items.push(i);
                    }
                }
            }

            if (isPlayMode) {
                settings.order.getValue()(this.items, nodes);
            }

            if (nodeIndex !== -1) {
                this.items.unshift(nodeIndex);
            }

            if (this.isFull()) {
                this.items.splice(maxItems);
            }
        }

        /**
         * Add ordered MegaNode references to playlist not exceeding playlist max length if applicable
         * @param {MegaNode[]} addNodes - nodes to add to playlist
         * @returns {void}
         */
        add(addNodes) {
            const {file, settings, manager} = mega.slideshow;
            const nodes = manager.state.nodes();

            if (addNodes.length) {
                if (this.isFull()) {
                    file.abort();
                    return;
                }

                const items = [];
                const maxItemsAllowed = maxItems - this.items.length;

                if (addNodes.length > maxItemsAllowed) {
                    if (addNodes.length > 1) {
                        settings.order.getValue()(addNodes, nodes);
                    }
                    addNodes.splice(maxItemsAllowed);
                }

                for (let i = 0; i < addNodes.length; i++) {
                    const index = nodes.findIndex((node) => node.h === addNodes[i].h);
                    if (index !== -1) {
                        items.push(index);
                    }
                }

                if (items.length > 1) {
                    settings.order.getValue()(items, nodes);
                }
                this.items.push(...items);

                if (this.isFull()) {
                    file.abort();
                    this.items.splice(maxItems);
                }
            }
        }

        /**
         * Return index on playlist and node in case id argument is related to a playlist item node.
         * Otherwise returns { playIndex: -1, node: undefined }
         * @param {String} id - node id
         * @returns {Object} playlist info about node id argument
         */
        findNode(id) {
            const {manager} = mega.slideshow;

            let playIndex = -1;
            let node;

            if (id !== undefined) {
                const nodes = manager.state.nodes();
                playIndex = this.items.findIndex(
                    (nodeIndex) => manager.state.getNodeIdOnIndex(nodeIndex) === id
                );
                node = nodes[this.items[playIndex]];
            }
            return {playIndex, node};
        }

        /**
         * Return node id related to a playlist item defined by index passed as argument
         * @param {Number} playIndex - playlist item index
         * @returns {String} node id
         */
        getNodeIdOnIndex(playIndex) {
            return mega.slideshow.manager.state.getNodeIdOnIndex(this.items[playIndex]);
        }

        /**
         * Check if playlist is full. Only applicable if isPlayMode.
         * Otherwise playlist has no limit.
         * This is a network & performance optimization when nodes from subfolders
         * can be fetched in case huge node trees
         * @returns {Boolean} wheter playlist is full
         */
        isFull() {
            return mega.slideshow.manager.state.isPlayMode && this.items.length >= maxItems;
        }
    };
});

lazy(mega.slideshow, 'step', () => {
    'use strict';

    /**
     * Slideshow step handler to determine playlist next iteration use cases
     */
    return {
        /**
         * Return info about next playlist iteration
         * @param {Number} playIndex - playlist index
         * @returns {Object} - backward & forward node ids for next steps
         */
        next: (playIndex) => {
            const {file, settings, playlist, manager} = mega.slideshow;

            const {isPlayMode} = manager.state;
            const isRepeat = settings.repeat.getValue();
            const playListLength = playlist.items.length;
            const nextStep = {};

            let prevPlayIndex;
            let nextPlayIndex;

            switch (playIndex) {
                case undefined:
                case -1:
                    break;
                case 0:
                    if (!isPlayMode || isRepeat) {
                        prevPlayIndex = playListLength - 1;
                    }
                    nextPlayIndex = 1;
                    break;
                case playListLength - 1:
                    prevPlayIndex = playIndex - 1;
                    if (!isPlayMode || isRepeat) {
                        nextPlayIndex = 0;
                    }
                    break;
                default:
                    prevPlayIndex = playIndex - 1;
                    nextPlayIndex = playIndex + 1;
            }

            if (prevPlayIndex !== undefined) {
                nextStep.backward = playlist.getNodeIdOnIndex(prevPlayIndex);
            }
            if (nextPlayIndex !== undefined) {
                nextStep.forward = playlist.getNodeIdOnIndex(nextPlayIndex);
            }
            else if (!file.state.isReady) {
                nextStep.forward = playlist.getNodeIdOnIndex(playIndex);
            }

            return nextStep;
        },

        /**
         * Return info about next playlist iteration when playlist is re-started from first item
         * @param {Number} playIndex - playlist index
         * @returns {Object} - backward & forward node ids for next steps
         */
        reset: (playIndex) => {
            const {playlist} = mega.slideshow;

            const playlistLength = playlist.items.length;

            let prevPlayIndex;
            let nextPlayIndex;

            if (playIndex === -1) {
                prevPlayIndex = playlistLength - 1;
                nextPlayIndex = 0;
            }
            else {
                prevPlayIndex = playlistLength - (playIndex === playlistLength - 1 ? 2 : 1);
                nextPlayIndex = playIndex === 0 ? 1 : 0;
            }

            return {
                backward: playlist.getNodeIdOnIndex(prevPlayIndex),
                forward: playlist.getNodeIdOnIndex(nextPlayIndex)
            };
        },
    };
});

lazy(mega.slideshow, 'utils', () => {
    'use strict';

    /**
     * Slideshow utils for MegaData operations
     */
    return {
        /**
         * Check if node is in current dir tree (root or subtree)
         * @param {MegaNode} node - node to check
         * @returns {Boolean} whether node is in current dir tree
         */
        isNodeInCurrentTree: (node) => {
            return M.getPath(node.h).includes(M.currentdirid.replace('out-shares/', ''));
        },

        /**
         * Return node id (handler) for chat or default
         * @param {MegaNode} node - node to check
         * @returns {String} node id
         */
        getNodeIdOnIndex: (node) => {
            if (node !== undefined) {
                return node[M.chat ? 'ch' : 'h'];
            }
        },

        /**
         * Open current folder
         * @returns {void}
         */
        setCurrentDir: ()=> {
            M.openFolder(M.currentdirid, true);
        },

        /**
         * Filter nodes argument depending on current situation
         * @param {MegaNode[]} nodes - list of nodes to filter
         * @param {Boolean} isPlayMode - whether slideshow is on play mode or not
         * @returns {Function}
         */
        filterNodes: (nodes, isPlayMode) => {
            if (nodes !== undefined) {
                return () => true;
            }
            else if (isPlayMode) {
                return (n) => n.s && (n.fa || !M.getNodeShare(n).down) && is_image3(n);
            }
            else if (is_mobile) {
                return (n) => (n.fa || !M.getNodeShare(n).down) && (is_video(n) || is_image3(n));
            }
            return (n) => (n.fa || !M.getNodeShare(n).down) && (is_image2(n) || is_video(n));
        },

        /**
         * Check if current dir is a default flat (no sub-folders)
         * @returns {Boolean} whether current dir is flat
         */
        isCurrentDirFlat: () => {
            // TODO replace isCurrentDirFlat function body with line below once WEB-14237 MR is merged into develop
            // M.chat ||
            //   M.isDynPage(M.currentdirid) ||
            //   ['recents','photos','images','favourites'].includes(M.currentdirid);

            return M.chat ||
                ['recents', 'photos', 'images', 'favourites', 'faves'].includes(M.currentdirid);
        },
    };
});

lazy(mega.slideshow.settings, 'options', () => {
    'use strict';

    return class SlideshowOptionsSetting {
        /**
         * Settings options base class
         * @param {String} name - setting name
         * @param {String} defaultConfig - setting default config if no available
         * @param {Object} config  - setting config definition
         * @returns {SlideshowOptionsSetting} instance
         */
        constructor(name, defaultConfig, config) {
            this.name = name;
            this._defaultConfig = defaultConfig;
            this._config = config;

            Object.freeze(this);
        }

        /**
         * Return current config value
         * @returns {*} - current config value
         */
        getValue() {
            return this.getConfig().value;
        }

        /**
         * Return current config cfg
         * @returns {Number} - current config cfg
         */
        getDefaultCfg() {
            return this.getConfig().cfg;
        }

        /**
         * Return current config or default value if undefined
         * TODO: new slideshow not implemented in mobile version
         * @returns {Object} - current config
         */
        getConfig() {
            const cfg = fmconfig.viewercfg ? fmconfig.viewercfg[this.name] : undefined;

            let id = this._defaultConfig;

            if (!is_mobile) {
                for (const [k, v] of Object.entries(this._config)) {
                    if (v.cfg === cfg) {
                        id = k;
                        break;
                    }
                }
            }

            return this._config[id];
        }
    };
});

lazy(mega.slideshow.settings, 'switch', () => {
    'use strict';

    return class SlideshowSwitchSetting {
        /**
         * Settings switch base class
         * @param {String} name - setting name
         * @param {Boolean} defaultValue - default value
         * @param {Function} isAllowed - whether switch is allowed or not
         * @param {Boolean} isImplemented - whether current switch setting is implemented and must be shown or not.
         *                                  This parameter will be useless when include sub-folders setting
         *                                  is definetely integrated
         * @returns {SlideshowSwitchSetting} instance
         */
        constructor(name, defaultValue, isAllowed, isImplemented) {
            this.name = name;
            this._defaultValue = defaultValue || 0;
            this._isAllowed = isAllowed;
            this._isImplemented = isImplemented === undefined ? true : isImplemented;

            Object.freeze(this);
        }

        /**
         * Return current config value or default value if undefined or is_mobile
         * TODO: new slideshow not implemented in mobile version
         * @returns {*} - current config value
         */
        getValue() {
            return !is_mobile &&
            this._isImplemented &&
            fmconfig.viewercfg && fmconfig.viewercfg[this.name] !== undefined ?
                fmconfig.viewercfg[this.name] :
                this._defaultValue;
        }

        /**
         * Return switch default value
         * @returns {Boolean} enabled / disabled
         */
        getDefaultCfg() {
            return this._defaultValue;
        }

        /**
         * Render slideshow settings UI according to config values
         * Settings UI elements will be provided with config change event bindings
         * @param {Object} $container - jquery element containing settings
         * @param {Function} onUpdate - to be called when setting is changed
         * @returns {void}
         */
        render($container, onUpdate) {
            if (!this._isImplemented) {
                return;
            }

            const $switch = $(`#${this.name}`, $container);

            let toggle = (onChange) => {
                let value;
                if ($switch.hasClass('toggle-on')) {
                    $switch.removeClass('toggle-on');
                    value = 0;
                }
                else {
                    $switch.addClass('toggle-on');
                    value = 1;
                }

                $switch.trigger('update.accessibility');

                if (typeof onChange === 'function') {
                    onChange(value);
                }
            };

            const value = this.getValue();
            if (value && !$switch.hasClass('toggle-on')
                || !value && $switch.hasClass('toggle-on')) {
                toggle();
            }
            else {
                $switch.trigger('update.accessibility');
            }

            if (typeof this._isAllowed === 'function') {
                if (this._isAllowed()) {
                    $switch.closest('li').removeClass('disabled');
                }
                else {
                    $switch.closest('li').addClass('disabled');
                    $switch.removeClass('toggle-on');
                    $switch.trigger('update.accessibility');
                    toggle = () => false;
                }
            }

            Soon(() => {
                $('.no-trans-init', $switch).removeClass('no-trans-init');
            });

            $switch.rebind(`click.slideshow-${this.name}`, () => toggle((value) => onUpdate(this.name, value)));
        }
    };
});

lazy(mega.slideshow.settings, 'order', () => {
    'use strict';

    const name = 'order';

    return new class SlideshowOrderSetting extends mega.slideshow.settings.options {
        /**
         * Order setting handler
         * @returns {SlideshowOrderSetting} instance
         */
        constructor() {
            super(
                name,
                'shuffle',
                {
                    shuffle: {
                        cfg: 1,
                        icon: 'icon-shuffle',
                        absolute: false,
                        value: (indexList) => shuffle(indexList)
                    },
                    newest: {
                        cfg: 2,
                        icon: 'icon-hourglass-new',
                        absolute: true,
                        value: (indexList, nodeList) => this._timeSort(indexList, nodeList, -1)
                    },
                    oldest: {
                        cfg: 3,
                        icon: 'icon-hourglass-old',
                        absolute: true,
                        value: (indexList, nodeList) => this._timeSort(indexList, nodeList, 1)
                    }
                }
            );
        }

        /**
         * Return current config absolute
         * @returns {Boolean} whether is aboslute
         */
        isAbsolute() {
            return this.getConfig().absolute;
        }

        /**
         * Render slideshow settings UI according to config values
         * Settings UI elements will be provided with config change event bindings
         * @param {Object} $container - jquery element containing settings
         * @param {Function} onUpdate - to be called when setting is changed
         * @returns {void}
         */
        render($container, onUpdate) {
            const $button = $(`button.${this.name}`, $container);
            const $options = $(`nav.${this.name}`, $container);

            const clickHandler = (id) => {
                const $button = $(`button.${this.name}`, $container);
                const $options = $(`nav.${this.name}`, $container);

                if (!$(`button.${id}`, $options).hasClass('disabled')) {
                    onUpdate(this.name, this._config[id].cfg);

                    for (const [k, v] of Object.entries(this._config)) {
                        const button = $(`button.${k}`, $options);
                        if (k === id) {
                            button.addClass('active');
                            $('i:last', $button).addClass(v.icon);
                            $(`button.${k} i.icon-active`, $options).removeClass('hidden');
                        }
                        else {
                            button.removeClass('active');
                            $('i:last', $button).removeClass(v.icon);
                            $(`button.${k} i.icon-active`, $options).addClass('hidden');
                        }
                    }
                }
            };

            const cfg = fmconfig.viewercfg ? fmconfig.viewercfg[this.name] : undefined;

            let id = this._defaultConfig;
            for (const [k, v] of Object.entries(this._config)) {
                const button = $(`button.${k}`, $options);
                if (v.cfg === cfg) {
                    id = k;
                    button.addClass('active');
                }
                else {
                    button.removeClass('active');
                }
                $(`button.${k} i:first`, $options).addClass(v.icon);
                button.rebind('click.slideshow-order', () => clickHandler(k));
            }

            $('i:last', $button).addClass(this._config[id].icon);
            $(`button.${id} i.icon-active`, $options).removeClass('hidden');
        }

        /**
         * To be called when any setting is changed
         * Set order defaultConfig (shuffle) and disable other order options or enable all
         * @param {Object} $container - jquery element containing settings
         * @param {*} name - setting name
         * @returns {void}
         */
        onConfigChange($container, name) {
            const {utils, manager, settings} = mega.slideshow;

            if (this.name === name) {
                manager.setState({isReset: true, isChangeOrder: true});
            }

            if (name === undefined || name === settings.sub.name) {
                let id;
                if (!utils.isCurrentDirFlat() && settings.sub.getValue() === 1) {
                    id = this._defaultConfig;
                    fmconfig.viewercfg[this.name] = this._config[id].cfg;
                    mega.config.set('viewercfg', fmconfig.viewercfg);
                }
                this._enable($container, id);
            }
        }

        /**
         * Set order defaultConfig (shuffle) and disable other order options or enable all
         * determined by "id"
         * @param {Object} $container - jquery element containing settings
         * @param {String} id - specific setting
         * @returns {void}
         */
        _enable($container, id) {
            const $button = $(`button.${this.name}`, $container);
            const $options = $(`nav.${this.name}`, $container);

            for (const [k, v] of Object.entries(this._config)) {
                if (id === undefined) {
                    if (v.cfg === this.getDefaultCfg()) {
                        $('i:last', $button).addClass(v.icon);
                        $(`button.${k} i.icon-active`, $options).removeClass('hidden');
                    }
                    else {
                        $('i:last', $button).removeClass(v.icon);
                        $(`button.${k} i.icon-active`, $options).addClass('hidden');
                    }
                    $(`button.${k}`, $options).removeClass('disabled');
                }
                else if (k === this._defaultConfig) {
                    $('i:last', $button).addClass(v.icon);
                    $(`button.${k} i.icon-active`, $options).removeClass('hidden');
                    $(`button.${k}`, $options).removeClass('disabled');
                }
                else {
                    $('i:last', $button).removeClass(v.icon);
                    $(`button.${k} i.icon-active`, $options).addClass('hidden');
                    $(`button.${k}`, $options).addClass('disabled');
                }
            }
        }

        /**
         * Sort list of indexes
         * In case chat items, given list of indexes is already time sorted (ascending), reversed_list (descending)
         * Otherwise, order will be based on the mtime and name of the nodes they correspond to
         * @param {Array} indexList - list of indexes to sort
         * @param {Array} nodeList - list of nodes referenced on the list of indexes
         * @param {Number} d - sort direction. 1: ascending, -1: descending
         * @returns {Array} Sorted list of indexes
         */
        _timeSort(indexList, nodeList, d) {
            if (M.chat) {
                return d === 1 ? indexList : indexList.reverse();
            }

            return indexList.sort((a, b) => {
                a = nodeList[a];
                b = nodeList[b];

                const time1 = a.mtime - a.mtime % 60;
                const time2 = b.mtime - b.mtime % 60;
                if (time1 !== time2) {
                    return (time1 < time2 ? -1 : 1) * d;
                }

                return M.compareStrings(a.name, b.name, d);
            });
        }
    };
});

lazy(mega.slideshow.settings, 'speed', () => {
    'use strict';

    const name = 'speed';
    const shortText = l.ss_setting_speed_seconds;

    return new class SlideshowSpeedSetting extends mega.slideshow.settings.options {
        /**
         * Speed setting handler
         * @returns {SlideshowSpeedSetting} instance
         */
        constructor() {
            super(
                name,
                'normal',
                {
                    slow: {cfg: 1, value: 8000, longText: l.ss_settings_speed_opt_1},
                    normal: {cfg: 2, value: 4000, longText: l.ss_settings_speed_opt_2},
                    fast: {cfg: 3, value: 2000, longText: l.ss_settings_speed_opt_3}
                }
            );
        }

        /**
         * Render slideshow settings UI according to config values
         * Settings UI elements will be provided with config change event bindings
         * @param {Object} $container - jquery element containing settings
         * @param {Function} onUpdate - to be called when setting is changed
         * @returns {void}
         */
        render($container, onUpdate) {
            const $button = $(`button.${this.name}`, $container);
            const $options = $(`nav.${this.name}`, $container);

            const clickHandler = (id) => {
                onUpdate(this.name, this._config[id].cfg);

                for (const [k, v] of Object.entries(this._config)) {
                    const button = $(`button.${k}`, $options);
                    if (k === id) {
                        button.addClass('active');
                        $('.current', $button).safeHTML(this._getText(v, true));
                        $(`button.${k} i.icon-active`, $options).removeClass('hidden');
                    }
                    else {
                        button.removeClass('active');
                        $(`button.${k} i.icon-active`, $options).addClass('hidden');
                    }
                }
            };

            const cfg = fmconfig.viewercfg ? fmconfig.viewercfg[this.name] : undefined;

            let id = this._defaultConfig;
            for (const [k, v] of Object.entries(this._config)) {
                const button = $(`button.${k}`, $options);
                if (v.cfg === cfg) {
                    id = k;
                    button.addClass('active');
                }
                else {
                    button.removeClass('active');
                }
                $(`button.${k} span`, $options).safeHTML(this._getText(v));
                button.rebind('click.slideshow-speed', () => clickHandler(k));
            }

            $('.current', $button).safeHTML(this._getText(this._config[id], true));
            $(`button.${id} i.icon-active`, $options).removeClass('hidden');
        }

        /**
         * Return setting related translated label text
         * @param {Object} config - specific config
         * @param {Boolean} isShort - whether to use short label
         * @returns {String} translated label text
         */
        _getText(config, isShort) {
            return (isShort ? shortText : config.longText).replace('%1', config.value / 1000);
        }
    };
});

lazy(mega.slideshow.settings, 'repeat', () => {
    'use strict';

    const name = 'repeat';

    return new class SlideshowRepeatSetting extends mega.slideshow.settings.switch {
        /**
         * repeat setting handler
         * @returns {SlideshowRepeatSetting} instance
         */
        constructor() {
            super(name, 1);
        }
    };
});

lazy(mega.slideshow.settings, 'sub', () => {
    'use strict';

    const name = 'sub';

    return new class SlideshowSubSetting extends mega.slideshow.settings.switch {
        /**
         * sub setting handler
         * @returns {SlideshowSubSetting} instance
         */
        constructor() {
            super(
                name,
                0,
                () => !mega.slideshow.utils.isCurrentDirFlat(),
                // set to "false" to deactivate include sub-folders setting functionality
                false
            );
        }

        /**
         * Return if settings have to be rendered: hasToDisable and switch not disabled or viceversa
         * @param {Object} $container - jquery element containing settings
         * @returns {Boolean} whether settings have to update render
         */
        hasToUpdateRender($container) {
            if (!this._isImplemented || typeof this._isAllowed !== 'function') {
                return false;
            }

            const $parent = $(`#${this.name}`, $container).closest('li');
            return this._isAllowed() ?
                $parent.hasClass('disabled') :
                !$parent.hasClass('disabled');
        }

        /**
         * Handle setting changes
         * @param {*} _ unused
         * @param {String} name - name of the setting changed
         * @param {Number} cfg - value of the setting changed
         * @returns {void}
         */
        onConfigChange(_, name, cfg) {
            if (name === this.name && cfg !== undefined) {
                const {utils, manager} = mega.slideshow;
                if (!cfg) {
                    utils.setCurrentDir();
                }
                manager.setState({isReset: true, isAbortFetch: !cfg});
            }
        }
    };
});

lazy(mega.slideshow.settings, 'manager', () => {
    'use strict';

    return new class SlideshowSettingsManager {
        /**
         * Slideshow settings manager / facade exposing slideshow playlist settings operations.
         * Can handle as many settings as wanted just by defining them in "_settings" property
         * @returns {SlideshowSettingsManager} instance
         */
        constructor() {
            const {order, speed, repeat, sub} = mega.slideshow.settings;
            this._settings = [speed, order, repeat, sub];

            Object.freeze(this);
        }

        /**
         * Check if settings current render has to be updated
         * @param {Object} $container - jquery element containing settings
         * @returns {Boolean} whether current render must be updated
         */
        hasToUpdateRender($container) {
            for (let i = 0; i < this._settings.length; i++) {
                const setting = this._settings[i];
                if (typeof setting.hasToUpdateRender === 'function' && setting.hasToUpdateRender($container)) {
                    return true;
                }
            }
            return false;
        }

        /**
         * Render slideshow settings UI according to config values
         * Settings UI elements will be provided with config change event bindings
         * Set default config in case undefined
         * @param {Object} $container - jquery element containing settings
         * @param {Function} onConfigChange - apply on config change
         * @returns {void}
         */
        render($container, onConfigChange) {
            const setSettingsDefaults = (exclude) => {
                const viewercfg = {};
                for (let i = 0; i < this._settings.length; i++) {
                    const setting = this._settings[i];
                    assert(typeof setting.getDefaultCfg === 'function',
                           `"${setting.name}" setting must implement "getDefaultCfg" method`);
                    if (exclude === undefined || setting.name !== exclude) {
                        viewercfg[setting.name] = setting.getDefaultCfg();
                    }
                }
                fmconfig.viewercfg = viewercfg;
            };

            const onUpdate = (name, cfg) => {
                if (fmconfig.viewercfg === undefined) {
                    setSettingsDefaults(name);
                }
                if (cfg !== fmconfig.viewercfg[name]) {
                    fmconfig.viewercfg[name] = cfg;
                    mega.config.set('viewercfg', fmconfig.viewercfg);
                    onConfigChange(name);
                    this._onConfigChange($container, name, cfg);
                }
            };

            for (let i = 0; i < this._settings.length; i++) {
                const setting = this._settings[i];
                assert(typeof setting.render === 'function',
                       `"${setting.name}" setting must implement "render" method`);
                setting.render($container, onUpdate);
            }

            this._onConfigChange($container);
        }

        /**
         * Notify settings about changes in configuration
         * @param {Object} $container - jquery element containing settings
         * @param {String} name - setting name
         * @param {Number} cfg - config value
         * @returns {void}
         */
        _onConfigChange($container, name, cfg) {
            for (let i = 0; i < this._settings.length; i++) {
                const setting = this._settings[i];
                if (typeof setting.onConfigChange === 'function') {
                    setting.onConfigChange($container, name, cfg);
                }
            }
        }
    };
});

var previews = Object.create(null);
var preqs = Object.create(null);
var pfails = Object.create(null);
var slideshowid;

(function _imageViewerSlideShow(global) {
    "use strict";

    var zoom_mode;
    var origImgWidth;
    var slideshowplay;
    var slideshowpause;
    var origImgHeight;
    var slideshowTimer;
    var fullScreenManager;
    var _hideCounter = false;
    var switchedSides = false;
    var fitToWindow = Object.create(null);
    var _pdfSeen = false;
    var _docxSeen = false;
    var optionsMenu;
    var settingsMenu;
    var preselection;
    const broadcasts = [];
    const MOUSE_IDLE_TID = 'auto-hide-previewer-controls';

    const onConfigChange = (name) => {
        if (name === 'speed') {
            slideshow_timereset();
        }
    };

    const events = [
        'mega:openfolder',
        'updFileManagerUI',
        'chat_image_preview',
        'mega:gallery:view:after',
        'mega:close_fileversioning'
    ];

    const listener = () => {
        if (slideshowplay) {
            mega.slideshow.manager.setState({});
        }
    };

    for (let i = 0; i < events.length; i++) {
        mBroadcaster.addListener(events[i], listener);
    }

    function slideshow_handle(raw) {
        var result;

        if (slideshowid) {
            result = raw ? slideshowid : slideshowid.slice(-8);
        }
        return result || false;
    }

    function slideshow_legacySteps() {
        const $overlay = $('.media-viewer-container');
        const $controls = $('.gallery-btn', $overlay);
        const $counter = $('header .counter', $overlay);
        const $startButton = $('.v-btn.slideshow', $overlay);
        const forward = [];
        const backward = [];

        let slideShowItemCount = window.dl_node ? 2 : 0;
        const slideShowModeFilter = !slideShowItemCount && mega.slideshow.utils.filterNodes(undefined, true);

        let current;
        let pos = [];
        let filter = (n) => (n.fa || !M.getNodeShare(n).down) && (is_image2(n) || is_video(n));
        let index = (i) => M.v[i].h;

        if (M.chat) {
            index = (i) => M.v[i].ch;
        }
        else if (preselection) {
            index = (i) => preselection[i].h;
            filter = () => true;
        }

        const list = preselection || M.v;
        for (let i = 0, m = list.length; i < m; ++i) {

            if (filter(list[i])) {
                // is currently previewed item
                if (index(i) === slideshowid) {
                    current = i;
                }
                pos.push(i);

                if (slideShowItemCount < 2 && slideShowModeFilter(list[i])) {

                    ++slideShowItemCount;
                }
            }
        }

        const len = pos.length;
        if (len > 1) {
            const n = pos.indexOf(current);
            switch (n) {
                // last
                case len - 1:
                    forward.push(index(pos[0]));
                    backward.push(index(pos[n - 1]));
                    break;
                // first
                case 0:
                    forward.push(index(pos[n + 1]));
                    backward.push(index(pos[len - 1]));
                    break;
                case -1:
                    break;
                default:
                    forward.push(index(pos[n + 1]));
                    backward.push(index(pos[n - 1]));
            }

            $counter.removeClass('hidden');
            $controls.removeClass('hidden');

            $startButton.toggleClass('hidden', slideShowItemCount < 2);
            $counter.text(String(l.preview_counter || '').replace('%1', pos = n + 1).replace('%2', len));
        }
        else {
            $counter.addClass('hidden');
            $controls.addClass('hidden');
            $startButton.addClass('hidden');
        }

        if (_hideCounter || is_video(M.v[current])) {
            $counter.addClass('hidden');
        }

        return {backward, forward, pos, len};
    }

    function slideshowsteps() {

        if (slideshowplay) {
            const {playIndex, playLength, backward, forward} = mega.slideshow.manager.next(slideshowid);

            if (!mega.slideshow.manager.isLast(playIndex) && forward === undefined) {
                mega.slideshow.manager.setState({});
                slideshow_next();
            }

            if (slideshowplay && !slideshowpause && mega.slideshow.manager.isLast(playIndex) && forward === undefined) {
                slideshow_toggle_pause($('.sl-btn.playpause', '.slideshow-controls'));
            }

            return {backward: [backward], forward: [forward], len: playLength, pos: playIndex};
        }

        return slideshow_legacySteps();
    }

    function slideshow_move(dir, steps) {
        var valid = true;
        var h = slideshow_handle();
        var step = dir === 'next' ? 'forward' : 'backward';
        $.videoAutoFullScreen = $(document).fullScreen();

        for (const i in dl_queue) {
            if (dl_queue[i].id === h && dl_queue[i].preview) {
                valid = false;
                return false;
            }
        }

        if (!valid) {
            return;
        }

        steps = steps || slideshowsteps();
        if (steps[step].length > 0) {
            const newShownHandle = steps[step][0];
            if ($.videoAutoFullScreen && is_video(M.getNodeByHandle(newShownHandle))) {
                // Autoplay the next/prev video if it's in full screen mode
                $.autoplay = newShownHandle;
            }

            mBroadcaster.sendMessage(`slideshow:${dir}`, steps);
            slideshow(newShownHandle);

            if (is_mobile) {
                mobile.appBanner.updateBanner(newShownHandle);
            }
            else {
                // Rerender info panel when moving to next/previous at slide show.
                mega.ui.mInfoPanel.reRenderIfVisible([newShownHandle]);
            }
        }

        slideshow_timereset();
    }

    function slideshow_next(steps) {
        slideshow_move('next', steps);
    }

    function slideshow_prev(steps) {
        slideshow_move('prev', steps);
    }

    function slideshow_fullscreen($overlay) {
        var $button = $('footer .v-btn.fullscreen', $overlay);

        // Set the video container's fullscreen state
        var setFullscreenData = function(state) {

            if (page === 'download') {
                updateDownloadPageContainer($overlay, state);
                return false;
            }

            if (state) {
                $overlay.addClass('fullscreen').removeClass('browserscreen');
                $('i', $button).removeClass('icon-fullscreen-enter').addClass('icon-fullscreen-leave');
            }
            else {
                $overlay.addClass('browserscreen').removeClass('fullscreen');
                $('i', $button).removeClass('icon-fullscreen-leave').addClass('icon-fullscreen-enter');

                // disable slideshow-mode exiting from full screen
                if (slideshowplay) {
                    slideshow_imgControls(1);
                }
            }

            if (!$overlay.is('.video-theatre-mode')) {
                slideshow_imgPosition($overlay);
            }
        };

        fullScreenManager = FullScreenManager($button, $overlay).change(setFullscreenData);
    }

    function updateDownloadPageContainer($overlay, state) {

        var $button = $('footer .v-btn.fullscreen', $overlay);

        if (state) {
            $overlay.parents('.download.download-page').addClass('fullscreen').removeClass('browserscreen');
            $('i', $button).removeClass('icon-fullscreen-enter').addClass('icon-fullscreen-leave');
            $overlay.addClass('fullscreen').removeClass('browserscreen');
        }
        else {
            $overlay.parents('.download.download-page').removeClass('browserscreen fullscreen');
            $('i', $button).removeClass('icon-fullscreen-leave').addClass('icon-fullscreen-enter');
            $overlay.removeClass('browserscreen fullscreen');
            slideshow_imgPosition($overlay);
        }

        if (!$overlay.is('.video-theatre-mode')) {
            slideshow_imgPosition($overlay);
        }
    }

    function slideshow_favourite(n, $overlay) {
        var $favButton = $('.context-menu .favourite', $overlay);
        var root = M.getNodeRoot(n && n.h || false);

        if (!n
            || !n.p
            || root === M.InboxID
            || root === 'shares'
            || folderlink
            || root === M.RubbishID
            || (M.getNodeByHandle(n.h) && !M.getNodeByHandle(n.h).u && M.getNodeRights(n.p) < 2)
        ) {
            $favButton.addClass('hidden');
        }
        else {
            $favButton.removeClass('hidden');

            $favButton.rebind('click.mediaviewer', function() {
                var $button = $(this);
                var newFavState = Number(!M.isFavourite(n.h));

                M.favourite(n.h, newFavState);

                if (newFavState) {
                    $('span', $button).text(l[5872]);
                    if (is_video(n)) {
                        $('i', $button).removeClass('icon-favourite')
                            .addClass('icon-heart-broken-small-regular-outline');
                    }
                    else {
                        $('i', $button).removeClass('icon-favourite').addClass('icon-favourite-removed');
                    }
                }
                else {
                    $('span', $button).text(l[5871]);
                    if (is_video(n)) {
                        $('i', $button).removeClass('icon-heart-broken-small-regular-outline')
                            .addClass('icon-favourite');
                    }
                    else {
                        $('i', $button).removeClass('icon-favourite-removed').addClass('icon-favourite');
                    }
                }
            });

            // Change favourite icon
            if (M.isFavourite(n.h)) {
                const icon = is_video(n) ? 'icon-heart-broken-small-regular-outline' : 'icon-favourite-removed';
                $('span', $favButton).text(l[5872]);
                $('i', $favButton).removeClass().addClass(`sprite-fm-mono ${icon}`);
            }
            else {
                $('span', $favButton).text(l[5871]);
                $('i', $favButton).removeClass().addClass('sprite-fm-mono icon-favourite');
            }
        }
    }

    function slideshow_bin(n, $overlay) {
        const $infoButton = $('.v-btn.info', $overlay);
        const $optionButton = $('.v-btn.options', $overlay);
        const $sendToChat = $('.v-btn.send-to-chat', $overlay);
        const root = M.getNodeRoot(n && n.h || false);

        if (root === M.RubbishID) {
            $infoButton.removeClass('hidden');
            $optionButton.addClass('hidden');
            $sendToChat.addClass('hidden');
        }
        else {
            $infoButton.addClass('hidden');

            // Keep the Info panel option hidden on public links (but usable in regular Cloud Drive etc)
            const currentSitePath = getSitePath();
            if (!isPublicLink(currentSitePath)) {
                $optionButton.removeClass('hidden');
            }
        }

    }

    function slideshow_remove(n, $overlay) {

        var $removeButton = $('.context-menu .remove', $overlay);
        const $removeButtonV = $('.v-btn.remove', $overlay);
        var $divider = $removeButton.closest('li').prev('.divider');
        var root = M.getNodeRoot(n && n.h || false);
        const $sendToChatButton = $('.context-menu .send-to-chat', $overlay);

        if (!n || !n.p || root === M.InboxID || (root === 'shares' && M.getNodeRights(n.p) < 2) || folderlink ||
            (M.getNodeByHandle(n.h) && !M.getNodeByHandle(n.h).u && M.getNodeRights(n.p) < 2) || M.chat) {

            $removeButton.addClass('hidden');
            $removeButtonV.addClass('hidden');
            $divider.addClass('hidden');
        }
        else if (is_mobile) {

            $removeButtonV.rebind('click.mediaviewer', () => {
            // TODO: work on this in view files ticket
            //     // Show the folder/file delete overlay
            //     mobile.deleteOverlay.show(n.h, () => {

                //     // After successful delete, hide the preview slideshow
                //     history.back();
                // });

            //     // Prevent double tap
            //     return false;
            });
        }
        else {
            $removeButton.removeClass('hidden');

            if (root === M.RubbishID) {
                $removeButtonV.removeClass('hidden');
            }
            else {
                $removeButtonV.addClass('hidden');
            }

            $divider.removeClass('hidden');

            const removeFunc = () => {
                if (M.isInvalidUserStatus()) {
                    history.back();
                    return false;
                }

                // Has to exit the full screen mode in order to show remove confirmation diagram
                if ($(document).fullScreen()) {
                    $(document).fullScreen(false);
                }

                fmremove();
                return false;
            };

            $removeButton.rebind('click.mediaviewer', removeFunc);
            $removeButtonV.rebind('click.mediaviewer', removeFunc);
        }

        if (is_video(n)) {
            $removeButton.addClass('mask-color-error');
            $('span', $removeButton).addClass('color-error');
            if (fminitialized && !folderlink && u_type === 3 && M.currentrootid !== M.RubbishID) {
                $sendToChatButton.removeClass('hidden');
                $sendToChatButton.closest('li').prev('.divider').removeClass('hidden');
            }
            else {
                $sendToChatButton.addClass('hidden');
                $sendToChatButton.closest('li').prev('.divider').addClass('hidden');
            }
        }
        else {
            $removeButton.removeClass('mask-color-error');
            $('span', $removeButton).removeClass('color-error');
            $sendToChatButton.addClass('hidden');
            $sendToChatButton.closest('li').prev('.divider').addClass('hidden');
        }
    }

    function slideshow_node(id, $overlay) {
        var n = M.getNodeByHandle(id);

        if (!n) {
            if (typeof id === 'object') {
                n = new MegaNode(id);
            }
            else if (typeof dl_node !== 'undefined' && dl_node.h === id) {
                n = dl_node;
            }
        }

        if ($overlay) {
            var root = M.getNodeRoot(n && n.h || false);
            var $getLinkBtn = $('.v-btn.getlink', $overlay);

            if (!n
                || !n.p
                || root === 'shares'
                || root === M.RubbishID
                || (pfcol)
                || (
                    !folderlink
                    && M.getNodeByHandle(n.h)
                    && !M.getNodeByHandle(n.h).u
                    && M.getNodeRights(n.p) < 2
                )
            ) {
                $getLinkBtn.addClass('hidden');
            }
            else {

                $getLinkBtn.removeClass('hidden');
                $getLinkBtn.rebind('click.mediaviewer', function() {
                    if ($getLinkBtn.hasClass('disabled')) {
                        return;
                    }
                    $getLinkBtn.addClass('disabled');
                    tSleep(3).then(() => $getLinkBtn.removeClass('disabled'));

                    if (is_mobile) {
                        mobile.linkManagement.showOverlay(n.h);
                    }
                    else {
                        $(document).fullScreen(false);

                        if (u_type === 0) {
                            ephemeralDialog(l[1005]);
                        }
                        else {
                            mega.Share.initCopyrightsDialog([slideshow_handle()]);
                        }
                    }

                    return false;
                });
            }
        }

        return n || false;
    }

    function slideshow_aborttimer() {
        if (slideshowTimer) {
            slideshowTimer.abort();
            slideshowTimer = null;
        }
    }

    function slideshow_timereset() {
        slideshow_aborttimer();

        if (slideshowplay && !slideshowpause) {

            (slideshowTimer = tSleep(mega.slideshow.settings.speed.getValue() / 1e3))
                .then(() => {
                    slideshow_next();
                })
                .catch(dump);

            if (is_mobile) {
                $(window).one('blur.slideshowLoseFocus', () => {
                    slideshow_aborttimer();
                });
            }
        }
    }

    function slideshow_zoomSlider(value = 100) {

        if (is_mobile) {
            mega.ui.viewerOverlay.zoom = value;
            return;
        }

        const container = document.querySelector('.media-viewer-container');
        const wrapper = container && container.querySelector('.zoom-slider-wrap');
        const $elm = $('.zoom-slider', wrapper);
        const setValue = tryCatch(() => {
            wrapper.dataset.perc = value;
            $elm.slider('value', value);
        });

        if (!wrapper) {
            if (d) {
                console.error('zoom-slider-wrap not found.');
            }
            return;
        }

        if ($elm.slider('instance')) {
            // Update existing slider.
            return setValue();
        }

        // Init zoom slider
        $elm.slider({
            min: 1,
            max: 1000,
            range: 'min',
            step: 0.01,
            change: function(e, ui) {
                $('.ui-slider-handle .mv-zoom-slider', this).text(formatPercentage(ui.value / 100));
                wrapper.dataset.perc = ui.value;
            },
            slide: function(e, ui) {
                $('.ui-slider-handle .mv-zoom-slider', this).text(formatPercentage(ui.value / 100));
                slideshow_zoom(container, false, ui.value);
            },
            create: () => {
                setValue();
                $('.ui-slider-handle', $elm).safeAppend(
                    `<div class="mv-zoom-slider dark-direct-tooltip"></div>
                    <i class="mv-zoom-slider-arrow sprite-fm-mono icon-tooltip-arrow"></i>`
                );
            }
        });
    };

    // Inits Image viewer bottom control bar
    function slideshow_imgControls(slideshow_stop, close) {
        var $overlay = $('.media-viewer-container', 'body');
        var $slideshowControls = $('.slideshow-controls', $overlay);
        var $slideshowControlsUpper = $('.slideshow-controls-upper', $overlay);
        var $imageControls = $('.image-controls', $overlay);
        var $viewerTopBar = $('header .viewer-bars', $overlay);
        var $prevNextButtons = $('.gallery-btn', $overlay);
        var $startButton = $('.v-btn.slideshow', $imageControls);
        var $pauseButton = $('.sl-btn.playpause', $slideshowControls);
        var $prevButton = $('.sl-btn.previous', $slideshowControls);
        var $nextButton = $('.sl-btn.next', $slideshowControls);
        var $zoomInButton = $('.v-btn.zoom-in', $imageControls);
        var $zoomOutButton = $('.v-btn.zoom-out', $imageControls);

        if (slideshow_stop) {
            $viewerTopBar.removeClass('hidden');
            $imageControls.removeClass('hidden');
            $prevNextButtons.removeClass('hidden');
            $slideshowControls.addClass('hidden');
            $slideshowControlsUpper.addClass('hidden');
            $overlay.removeClass('slideshow').off('mousewheel.imgzoom');
            slideshow_play(false, close);
            slideshowpause = false;
            $pauseButton.attr('data-state', 'pause');
            $('i', $pauseButton).removeClass('icon-play').addClass('icon-pause');

            slideshow_aborttimer();
            $(window).off('blur.slideshowLoseFocus');
            slideshowsteps(); // update x of y counter

            if (is_mobile) {
                M.noSleep(true).catch(dump);
            }

            return false;
        }

        $imageControls.removeClass('hidden');

        // Bind Slideshow Mode button
        $startButton.rebind('click.mediaviewer', function() {
            if (!slideshowplay || mega.slideshow.settings.manager.hasToUpdateRender(settingsMenu)) {

                // Settings menu initialization
                if (!settingsMenu) {
                    settingsMenu = contextMenu.create({
                        template: $('#media-viewer-settings-menu', $overlay)[0],
                        sibling: $('.sl-btn.settings', $overlay)[0],
                        animationDuration: 150,
                        boundingElement: $overlay[0]
                    });
                }

                // Slideshow initialization
                mega.slideshow.settings.manager.render(settingsMenu, onConfigChange);
                mega.slideshow.manager.setState({nodes: preselection});
            }

            $overlay.addClass('slideshow');
            slideshow_play(true);
            slideshow_timereset();
            $viewerTopBar.addClass('hidden');
            $imageControls.addClass('hidden');
            $slideshowControls.removeClass('hidden');
            $slideshowControlsUpper.removeClass('hidden');
            $prevNextButtons.addClass('hidden');
            zoom_mode = false;

            if (is_mobile) {
                eventlog(99835);
                M.noSleep().catch(dump);
                if (is_ios) {
                    // Due to the handling of the onload event with the previous image in iOS,
                    // force the call to img position
                    slideshow_imgPosition();
                }
            }

            // hack to start the slideshow in full screen mode
            if (fullScreenManager) {
                fullScreenManager.enterFullscreen();
            }

            return false;
        });

        // Bind Slideshow Pause button
        $pauseButton.rebind('click.mediaviewer', function() {
            slideshow_toggle_pause($(this));
            return false;
        });

        // Bind Slideshow Prev button
        $prevButton.rebind('click.mediaviewer', function() {
            slideshow_prev();
            return false;
        });

        // Bind Slideshow Next button
        $nextButton.rebind('click.mediaviewer', function() {
            slideshow_next();
            return false;
        });

        $('.v-btn.browserscreen', $overlay).rebind('click.media-viewer', () => {
            $overlay.addClass('browserscreen');
            $overlay.parents('.download.download-page').addClass('browserscreen');
            slideshow_imgPosition($overlay);
            return false;
        });

        // Bind ZoomIn button
        $zoomInButton.rebind('click.mediaviewer', function() {
            slideshow_zoom($overlay);
            return false;
        });

        // Bind ZoomOut button
        $zoomOutButton.rebind('click.mediaviewer', function() {
            slideshow_zoom($overlay, 1);
            return false;
        });

        // Allow mouse wheel to zoom in/out
        $('.media-viewer', $overlay).rebind('mousewheel.imgzoom', function(e) {
            var delta = Math.max(-1, Math.min(1, (e.wheelDelta || e.deltaY || -e.detail)));

            if (delta > 0) {
                $zoomInButton.trigger('click.mediaviewer');
            }
            else {
                $zoomOutButton.trigger('click.mediaviewer');
            }
        });

        // Bind Slideshow Close button
        $('.sl-btn.close', is_mobile ? $slideshowControls : $slideshowControlsUpper).rebind('click.mediaviewer', () => {
            slideshowplay_close();
            if (is_mobile && is_ios) {
                // Due to the handling of the onload event with the previous image in iOS,
                // force the call to img position
                slideshow_imgPosition();
            }
            return false;
        });
    }

    // Inits Pick and pan mode if image doesn't fit into the container
    function slideshow_pickpan($overlay, close) {
        var $imgWrap = $('.img-wrap', $overlay);
        var $img = $('img.active', $imgWrap);
        var wrapWidth = $imgWrap.outerWidth();
        var wrapHeight = $imgWrap.outerHeight();
        var imgWidth = switchedSides ? $img.height() : $img.width();
        var imgHeight = switchedSides ? $img.width() : $img.height();
        var dragStart = 0;
        var lastPos = {x: null, y: null};

        if (close) {
            $imgWrap.off('mousedown.pickpan touchstart.pickpan');
            $imgWrap.off('mouseup.pickpan mouseout.pickpan touchend.pickpan');
            $imgWrap.off('mousemove.pickpan touchmove.pickpan');
            return false;
        }

        // Get cursor last position before dragging
        $imgWrap.rebind('mousedown.pickpan touchstart.pickpan', function(event) {
            dragStart = (!event.touches || event.touches.length === 1) | 0; // double finger should not treated as drag
            lastPos = {x: event.pageX, y: event.pageY};
            $(this).addClass('picked');
        });

        // Stop dragging
        $imgWrap.rebind('mouseup.pickpan mouseout.pickpan touchend.pickpan', function() {
            dragStart = 0;
            $(this).removeClass('picked');
        });

        // Drag image if it doesn't fit into the container
        $imgWrap.rebind('mousemove.pickpan touchmove.pickpan', event => {
            if (dragStart) {

                const {pageX, pageY} = event.type === 'touchmove' ? event.touches[0] : event;

                var currentPos = {x: pageX, y: pageY};
                var changeX = currentPos.x - lastPos.x;
                var changeY = currentPos.y - lastPos.y;

                /* Save mouse position */
                lastPos = currentPos;

                var imgTop = $img.position().top;
                var imgLeft = $img.position().left;
                var imgTopNew = imgTop + changeY;
                var imgLeftNew = imgLeft + changeX;

                // Check if top and left do not fall outside the image
                if (wrapHeight >= imgHeight) {
                    imgTopNew = (wrapHeight - imgHeight) / 2;
                }
                else if (imgTopNew > 0) {
                    imgTopNew = 0;
                }
                else if (imgTopNew < (wrapHeight - imgHeight)) {
                    imgTopNew = wrapHeight - imgHeight;
                }
                if (wrapWidth >= imgWidth) {
                    imgLeftNew = (wrapWidth - imgWidth) / 2;
                }
                else if (imgLeftNew > 0) {
                    imgLeftNew = 0;
                }
                else if (imgLeftNew < (wrapWidth - imgWidth)) {
                    imgLeftNew = wrapWidth - imgWidth;
                }

                $img.css({
                    'left': imgLeftNew + 'px',
                    'top': imgTopNew + 'px'
                });

                return false;
            }
        });
    }

    // Zoom In/Out function
    function slideshow_zoom($overlay, zoomout, value) {
        const $img = $('.img-wrap img.active', $overlay);
        const $percLabel = $('.zoom-slider-wrap', $overlay);
        let newPerc = parseFloat($percLabel.attr('data-perc')) || 1;
        let newImgWidth;
        let zoomStep;

        if (value) {
            newPerc = parseFloat(value);
        }
        else if (zoomout) {
            zoomStep = (newPerc * 0.9).toFixed(2);
            newPerc = zoomStep >= 1 ? zoomStep : 1;
        }
        else if (!zoomout) {
            zoomStep = (newPerc * 1.2).toFixed(2);
            newPerc = zoomStep <= 1000 ? zoomStep : 1000;
        }

        newPerc /= devicePixelRatio * 100;
        newImgWidth = origImgWidth * newPerc;

        $img.css({
            'width': newImgWidth
        });

        zoom_mode = true;

        // Set zoom, position values and init pick and pan
        slideshow_imgPosition($overlay);
    }

    // Sets zoom percents and image position
    function slideshow_imgPosition($overlay) {
        const $imgWrap = $('.img-wrap', $overlay);
        const $img = $('img.active', $overlay);
        const id = $imgWrap.attr('data-image');
        const viewerWidth = $imgWrap.width();
        const viewerHeight = $imgWrap.height();
        let imgWidth = 0;
        let imgHeight = 0;
        let w_perc = 0;
        let h_perc = 0;
        let newImgWidth = 0;

        if (zoom_mode) {
            imgWidth = switchedSides ? $img.height() : $img.width();
            imgHeight = switchedSides ? $img.width() : $img.height();

            // Init pick and pan mode if Image larger its wrapper
            if (imgWidth > viewerWidth || imgHeight > viewerHeight) {
                slideshow_pickpan($overlay);
            }
            else {
                slideshow_pickpan($overlay, 1);
            }
        }
        else {
            w_perc = viewerWidth / origImgWidth;
            h_perc = viewerHeight / origImgHeight;
            $img.removeAttr('style');
            imgWidth = (switchedSides ? $img.height() : $img.width()) || origImgWidth;
            imgHeight = (switchedSides ? $img.width() : $img.height()) || origImgHeight;

            // Set minHeight, minWidth if image is bigger then browser window
            // Check if height fits browser window after reducing width
            if (origImgWidth > viewerWidth && origImgHeight * w_perc <= viewerHeight) {
                imgWidth = viewerWidth;
                imgHeight = origImgHeight * w_perc;
                newImgWidth = switchedSides ? imgHeight : imgWidth;
            }
            // Check if width fits browser window after reducing height
            else if ((origImgWidth > viewerWidth && origImgHeight * w_perc > viewerHeight)
                || (origImgWidth < viewerWidth && origImgHeight > viewerHeight)) {

                imgWidth = origImgWidth * h_perc;
                imgHeight = viewerHeight;
                newImgWidth = switchedSides ? imgHeight : imgWidth;
            }
            // Check if preview and original imgs are loading and height fits browser window after increasing width
            else if (fitToWindow[id] && origImgHeight < viewerHeight
                && origImgWidth < viewerWidth && origImgHeight * w_perc <= viewerHeight) {

                imgWidth = viewerWidth;
                imgHeight = origImgHeight * w_perc;
                newImgWidth = switchedSides ? imgHeight : imgWidth;
            }
            // Check if preview and original imgs are loading and width fits browser window after increasing height
            else if (fitToWindow[id] && imgHeight < viewerHeight
                && origImgWidth < viewerWidth && origImgWidth * h_perc <= viewerWidth) {

                imgWidth = origImgWidth * h_perc;
                imgHeight = viewerHeight;
                newImgWidth = switchedSides ? imgHeight : imgWidth;
            }
            else {
                newImgWidth = switchedSides ? origImgHeight : origImgWidth;
            }

            $img.css({
                'width': newImgWidth
            });
        }

        $img.css({
            'left': (viewerWidth - imgWidth) / 2,
            'top': (viewerHeight - imgHeight) / 2,
        });
        slideshow_zoomSlider(imgWidth / origImgWidth * 100 * devicePixelRatio);
    }

    // Mobile finger gesture
    function slideshow_gesture(h, elm, type) {

        // TODO: change to `!is_touchable` to support desktop touch device
        if (!is_mobile || !is_touchable || !mega.ui.viewerOverlay) {
            return;
        }

        const name = type ? 'iframeGesture' : 'gesture';

        // Lets reset
        if (mega.ui.viewerOverlay[name]) {

            mega.ui.viewerOverlay[name].destroy();
            delete mega.ui.viewerOverlay[name];
        }

        // no node passed means it is closing
        if (!elm) {

            delete mega.ui.viewerOverlay.zoom;

            return;
        }

        let containerSelector;

        if (type) {

            containerSelector = type === 'PDF' ? '#viewerContainer' : 'body';
            elm = elm.contentDocument;
        }
        else {
            containerSelector = is_video(M.getNodeByHandle(h)) ? '.video-block' : '.img-wrap';
            elm = elm.querySelector('.content');
        }

        console.assert(elm, 'Invalid element to initialise slideshow gesture');

        const options = {
            domNode: elm,
            onTouchStart: function() {

                const container = this.domNode.querySelector(containerSelector);
                const style = {
                    top: container.scrollTop,
                    left: container.scrollLeft,
                    width: container.offsetWidth,
                    height: container.offsetHeight
                };

                if (containerSelector === '.img-wrap') {

                    const img = container.querySelector('img.active');
                    const compstyle = img && getComputedStyle(img);

                    if (compstyle && compstyle.position === 'absolute') {

                        style.top = Math.abs(parseInt(compstyle.top));
                        style.left = Math.abs(parseInt(compstyle.left));
                        style.width = parseInt(compstyle.width);
                        style.height = parseInt(compstyle.height);
                    }
                }

                this.onEdge = {
                    top: style.top === 0,
                    right: (style.left + container.offsetWidth) / style.width > 0.999,
                    bottom: (style.top + container.offsetHeight) / style.height > 0.999,
                    left: style.left === 0
                };
            },
            onDragging: function(ev) {
                // Stop tap to be triggered
                ev.stopPropagation();
                return;
            }
        };

        if (name === 'iframeGesture') {
            options.iframeDoc = elm;
        }

        options.onSwipeRight = options.onSwipeLeft = options.onSwipeDown = options.onSwipeUp = ev => {
            ev.preventDefault();
        };

        if (page !== 'download') {

            options.onSwipeRight = function() {

                if (this.onEdge.left) {
                    slideshow_prev();
                }
            };

            options.onSwipeLeft = function() {

                if (this.onEdge.right) {
                    slideshow_next();
                }
            };
        }

        if (!type) {

            options.onPinchZoom = function(ev, mag) {

                mega.ui.viewerOverlay.zoom *= mag;
                slideshow_zoom($(elm), 0, mega.ui.viewerOverlay.zoom);
            };
        }
        else if (type === 'DOCX') {
            options.onPinchZoom = function(ev, mag) {

                const dElm = this.domNode.documentElement;
                const curr = parseFloat(dElm.style.transform.replace(/[^\d.]/g, '')) || 1;

                if (!this.initZoom) {
                    this.initZoom = curr;
                }

                const newVal = Math.max(curr * mag, this.initZoom);

                dElm.style.transform = `scale(${newVal.toFixed(6)})`;
                dElm.classList.add('scaled');
            };
        }

        mega.ui.viewerOverlay[name] = new MegaGesture(options);
    }

    function sendToChatHandler() {
        $(document).fullScreen(false);
        const $wrapper = $('.media-viewer-container', 'body');
        const video = $('video', $wrapper).get(0);
        if (video && !video.paused && !video.ended) {
            video.pause();
        }
        $.noOpenChatFromPreview = true;
        openCopyDialog('conversations');

        mBroadcaster.sendMessage('trk:event', 'preview', 'send-chat');
    }

    // Viewer Init
    // eslint-disable-next-line complexity
    function slideshow(id, close, hideCounter, filteredNodeArr) {
        if (!close && M.isInvalidUserStatus()) {
            return false;
        }

        var $overlay = $('.media-viewer-container', 'body');
        var $content = $('.content', $overlay);
        var $controls = $('footer, header, .gallery-btn', $overlay);
        var $imgWrap = $('.img-wrap', $content);
        const $pendingBlock = $('.viewer-pending', $content);
        var $imageControls = $('.image-controls', $overlay);
        var $zoomSlider = $('.zoom-slider-wrap', $imageControls);
        var $playVideoButton = $('.play-video-button', $content);
        var $video = $('video', $content);
        var $videoControls = $('.video-controls', $overlay);
        var $dlBut = $('.v-btn.download', $overlay);
        var $prevNextButtons = $('.gallery-btn', $content);
        var $document = $(document);
        const $sendToChat = $('.v-btn.send-to-chat', $overlay);
        const $playPauseButton = $('.play-pause-video-button', $content);
        const $watchAgainButton = $('.watch-again-button', $content);

        if (d) {
            console.log('slideshow', id, close, slideshowid);
        }

        if (close) {
            sessionStorage.removeItem('previewNode');
            sessionStorage.removeItem('previewTime');
            zoom_mode = false;
            switchedSides = false;
            slideshowid = false;
            $.videoAutoFullScreen = false;
            _hideCounter = false;
            slideshow_play(false, true);
            preselection = undefined;
            $overlay.removeClass('video video-theatre-mode mouse-idle slideshow fullscreen fullimage')
                .addClass('hidden');
            $playVideoButton.addClass('hidden');
            $watchAgainButton.addClass('hidden');
            $playPauseButton.addClass('hidden');
            $('i', $playPauseButton).removeClass().addClass('sprite-fm-mono icon-play-regular-solid');
            $videoControls.addClass('hidden');
            $zoomSlider.attr('data-perc', 100);
            $(window).off('resize.imgResize');
            $document.off('keydown.slideshow mousemove.idle');
            $imgWrap.attr('data-count', '');
            $('img', $imgWrap).attr('src', '').removeAttr('style').removeClass('active');
            $('.v-btn.active', $controls).removeClass('active');
            $('.speed i', $videoControls).removeClass()
                .addClass('sprite-fm-mono icon-playback-1x-small-regular-outline');
            $('.speed', $videoControls).removeClass('margin-2');
            $('.context-menu.playback-speed button i', $videoControls).addClass('hidden');
            $('.context-menu.playback-speed button.1x i', $videoControls).removeClass('hidden');
            $('div.video-subtitles', $content).remove();
            $('.context-menu.subtitles button i', $videoControls).addClass('hidden');
            $('.context-menu.subtitles button.off i', $videoControls).removeClass('hidden');
            $('.subtitles-wrapper', $videoControls).removeClass('hidden');
            $('button.subtitles', $videoControls).removeClass('mask-color-brand');
            $('.settings', $videoControls).removeClass('mask-color-brand');
            $('.settings i', $videoControls).removeClass('icon-settings-02-small-regular-solid')
                .addClass('icon-settings-02-small-regular-outline');
            if (optionsMenu) {
                contextMenu.close(optionsMenu);
            }
            if (settingsMenu) {
                contextMenu.close(settingsMenu);
            }
            if (fullScreenManager) {
                fullScreenManager.destroy();
                fullScreenManager = null;
            }
            for (var i in dl_queue) {
                if (dl_queue[i] && dl_queue[i].id === id) {
                    if (dl_queue[i].preview) {
                        dlmanager.abort(dl_queue[i]);
                    }
                    break;
                }
            }
            for (let i = broadcasts.length; i--;) {
                mBroadcaster.removeListener(broadcasts[i]);
            }
            slideshow_imgControls(1, true);
            mBroadcaster.sendMessage('slideshow:close');
            slideshow_freemem();
            $(window).off('blur.slideshowLoseFocus');

            if (is_mobile) {
                M.noSleep(true).catch(dump);
                if (mega.ui.viewerOverlay) {
                    mega.ui.viewerOverlay.hide();
                }
            }

            if (_pdfSeen) {
                _pdfSeen = false;

                tryCatch(function() {
                    var ev = document.createEvent("HTMLEvents");
                    ev.initEvent("pdfjs-cleanup.meganz", true);
                    document.getElementById('pdfpreviewdiv1').contentDocument.body.dispatchEvent(ev);
                })();
            }
            if (_docxSeen) {
                _docxSeen = false;
                tryCatch(() => {
                    const ev = new Event('docxviewercleanup');
                    document.getElementById('docxpreviewdiv1').contentDocument.dispatchEvent(ev);
                })();
            }

            slideshow_gesture();

            return false;
        }

        var n = slideshow_node(id, $overlay);
        if (!n) {
            return;
        }

        // Checking if this the first preview (not a preview navigation)
        if (!slideshowid) {
            // then pushing fake states of history/hash
            if (page !== 'download' && (!history.state || history.state.view !== id)) {
                pushHistoryState();

                if (n.p && !folderlink && M.getNodeRoot(n.p) !== M.RubbishID) {
                    onIdle(() => mega.ui.searchbar.recentlyOpened.addFile(id, false));
                }
            }
            _hideCounter = !d && hideCounter;
        }

        slideshowid = n.ch || n.h;
        if (window.selectionManager) {
            selectionManager.resetTo(n.h);
        }
        else {
            $.selected = [n.h];
        }
        mBroadcaster.sendMessage('slideshow:open', n);

        if (page !== 'download') {
            sessionStorage.setItem('previewNode', id);
            pushHistoryState(true, Object.assign({subpage: page}, history.state, {view: slideshowid}));
        }

        // Clear previousy set data
        zoom_mode = false;
        switchedSides = false;
        $('header .file-name', $overlay).text(n.name);
        $('.viewer-error, #pdfpreviewdiv1, #docxpreviewdiv1', $overlay).addClass('hidden');
        $('.viewer-progress', $overlay).addClass('vo-hidden');

        if (!is_mobile) {
            $imageControls.addClass('hidden');
        }
        $prevNextButtons.addClass('hidden');
        $playVideoButton.addClass('hidden');
        $watchAgainButton.addClass('hidden');
        $playPauseButton.addClass('hidden');
        $('i', $playPauseButton).removeClass().addClass('sprite-fm-mono icon-play-regular-solid');
        $('.viewer-progress p, .video-time-bar', $content).removeAttr('style');

        if (!slideshowplay) {
            $('img', $imgWrap).removeClass('active');
        }

        // Clear video file data
        $video.css('background-image', '').removeAttr('poster src').addClass('hidden');
        $videoControls.addClass('hidden');
        $('.video-time-bar', $videoControls).removeAttr('style');
        $('.video-progress-bar', $videoControls).removeAttr('title');
        $('.video-timing', $videoControls).text('');
        $('.speed i', $videoControls).removeClass()
            .addClass('sprite-fm-mono icon-playback-1x-small-regular-outline');
        $('.speed', $videoControls).removeClass('margin-2');
        $('.context-menu.playback-speed button i', $videoControls).addClass('hidden');
        $('.context-menu.playback-speed button.1x i', $videoControls).removeClass('hidden');
        $('div.video-subtitles', $content).remove();
        $('.context-menu.subtitles button i', $videoControls).addClass('hidden');
        $('.context-menu.subtitles button.off i', $videoControls).removeClass('hidden');
        $('.subtitles-wrapper', $videoControls).removeClass('hidden');
        $('button.subtitles', $videoControls).removeClass('mask-color-brand');
        $('.settings', $videoControls).removeClass('mask-color-brand');
        $('.settings i', $videoControls).removeClass('icon-settings-02-small-regular-solid')
            .addClass('icon-settings-02-small-regular-outline');

        // Init full screen icon and related data attributes
        if ($document.fullScreen()) {
            $('.v-btn.fullscreen i', $imageControls)
                .addClass('icon-fullscreen-leave')
                .removeClass('icon-fullscreen-enter');

            $content.attr('data-fullscreen', 'true');
            $('.v-btn.fs', $videoControls).addClass('cancel-fullscreen').removeClass('go-fullscreen');
            $('.v-btn.fs i', $videoControls).removeClass()
                .addClass('sprite-fm-mono icon-minimize-02-small-regular-outline');
            $('.fs-wrapper .tooltip', $videoControls).text(l.video_player_exit_fullscreen);
        }
        else {
            $('.v-btn.fullscreen i', $imageControls)
                .removeClass('icon-fullscreen-leave')
                .addClass('icon-fullscreen-enter');

            $content.attr('data-fullscreen', 'false');
            $('.v-btn.fs', $videoControls).removeClass('cancel-fullscreen').addClass('go-fullscreen');
            $('.v-btn.fs i', $videoControls).removeClass()
                .addClass('sprite-fm-mono icon-maximize-02-small-regular-outline');
            $('.fs-wrapper .tooltip', $videoControls).text(l.video_player_fullscreen);
        }

        // Turn off pick and pan mode
        slideshow_pickpan($overlay, 1);

        // Options context menu
        if (!optionsMenu) {
            optionsMenu = contextMenu.create({
                template: $('#media-viewer-options-menu', $overlay)[0],
                sibling: $('.v-btn.options', $overlay)[0],
                animationDuration: 150,
                boundingElement: $overlay[0]
            });
        }

        // Bind static events is viewer is not in slideshow mode to avoid unnecessary rebinds
        if (!slideshowplay) {
            $overlay.removeClass('fullscreen browserscreen mouse-idle slideshow video pdf docx');

            // Bind keydown events
            $document.rebind('keydown.slideshow', function(e) {
                const isDownloadPage = page === 'download';

                if (e.keyCode === 37 && slideshowid && !e.altKey && !e.ctrlKey && !isDownloadPage) {
                    mBroadcaster.sendMessage('trk:event', 'preview', 'arrow-key', this, self.slideshowid);
                    slideshow_prev();
                }
                else if (e.keyCode === 39 && slideshowid && !isDownloadPage) {
                    mBroadcaster.sendMessage('trk:event', 'preview', 'arrow-key', this, self.slideshowid);
                    slideshow_next();
                }
                else if (e.keyCode === 46 && fullScreenManager) {
                    fullScreenManager.exitFullscreen();
                }
                else if (e.keyCode === 27 && slideshowid && !$document.fullScreen()) {
                    mBroadcaster.sendMessage('trk:event', 'preview', 'close-btn', this, self.slideshowid);

                    if ($.dialog) {
                        closeDialog($.dialog);
                    }
                    else if ($.msgDialog) {
                        closeMsg();

                        if ($.warningCallback) {
                            $.warningCallback(false);
                            $.warningCallback = null;
                        }
                    }
                    else if (slideshowplay) {
                        slideshow_imgControls(1);
                    }
                    else if (isDownloadPage) {
                        $overlay.removeClass('fullscreen browserscreen');
                        $overlay.parents('.download.download-page').removeClass('fullscreen browserscreen');
                        slideshow_imgPosition($overlay);
                    }
                    else {
                        history.back();
                        return false;
                    }
                }
                else if ((e.keyCode === 8 || e.key === 'Backspace') && !isDownloadPage && !$.copyDialog
                        && !$.dialog && !$.msgDialog) {
                    history.back();
                    return false;
                }
            });

            // Close icon
            $('.v-btn.close, .viewer-error-close', $overlay).rebind('click.media-viewer', function() {
                mBroadcaster.sendMessage('trk:event', 'preview', 'close-btn', this, self.slideshowid);

                if (page === 'download') {
                    if ($(document).fullScreen()) {
                        fullScreenManager.exitFullscreen();
                    }
                    $overlay.removeClass('fullscreen browserscreen');
                    $overlay.parents('.download.download-page').removeClass('fullscreen browserscreen');
                    if (is_mobile) {
                        zoom_mode = false;
                    }
                    slideshow_imgPosition($overlay);
                    return false;
                }
                history.back();
                mega.ui.mInfoPanel.closeIfOpen();
                return false;
            });

            // Keep the Info panel option hidden on public links (but usable in regular Cloud Drive etc)
            const currentSitePath = getSitePath();
            if (isPublicLink(currentSitePath)) {
                $('.v-btn.options', $overlay).addClass('hidden');
            }

            // Properties icon
            $('.context-menu .info, .v-btn.info', $overlay).rebind('click.media-viewer', () => {
                $document.fullScreen(false);
                // Use original ID to render info from chats
                $.selected = [id];
                mega.ui.mInfoPanel.initInfoPanel();
                return false;
            });

            if (is_mobile) {

                $('.img-wrap', $overlay).rebind('tap.media-viewer', () => {

                    if (slideshowplay) {
                        return;
                    }

                    $overlay.toggleClass('fullimage');

                    slideshow_imgPosition($overlay);

                    if (mega.flags.ab_ads) {
                        mega.commercials.updateOverlays();
                    }

                    return false;
                });

                $('.go-fullscreen', $overlay).rebind('click.media-viewer', () => {
                    if (ua.details.os === "iPad") {
                        // iPad does not allow fullscreen mode for now
                        // therefore, we do not modify the header and imageControls
                        // since otherwise, we will not be able to revoke this action.
                        return;
                    }
                    if ($document.fullScreen()) {
                        $('header', $overlay).removeClass('hidden');
                        $imageControls.removeClass('hidden');
                    }
                    else {
                        $('header', $overlay).addClass('hidden');
                        $imageControls.addClass('hidden');
                    }
                });
            }
            else {
                // Options icon
                $('.v-btn.options', $overlay).rebind('click.media-viewer', function() {
                    var $this = $(this);

                    if ($(this).hasClass('hidden')) {
                        return false;
                    }
                    if ($this.hasClass('active')) {
                        $this.removeClass('active deactivated');
                        contextMenu.close(optionsMenu);
                    }
                    else {
                        $this.addClass('active deactivated').trigger('simpletipClose');
                        // xxx: no, this is not a window.open() call..
                        // eslint-disable-next-line local-rules/open
                        contextMenu.open(optionsMenu);
                    }
                    return false;
                });

                // Settings icon
                $('.sl-btn.settings', $overlay).rebind('click.media-viewer-settings', function() {
                    var $this = $(this);

                    if ($(this).hasClass('hidden')) {
                        return false;
                    }
                    if ($this.hasClass('active')) {
                        $this.removeClass('active deactivated');
                        $('i', $this).removeClass('icon-slider-filled');
                        $('i', $this).addClass('icon-slider-outline');

                        contextMenu.close(settingsMenu);
                        $overlay.removeClass('context-menu-open');
                    }
                    else {
                        $this.addClass('active deactivated').trigger('simpletipClose');
                        $('i', $this).removeClass('icon-slider-outline');
                        $('i', $this).addClass('icon-slider-filled');

                        // xxx: no, this is not a window.open() call..
                        // eslint-disable-next-line local-rules/open
                        contextMenu.open(settingsMenu);
                        $overlay.addClass('context-menu-open');
                    }
                    return false;
                });

                if (fminitialized && !folderlink && u_type === 3 && M.currentrootid !== M.RubbishID && !is_video(n)) {
                    $sendToChat.removeClass('hidden');
                }
                else if (is_video(n)) {
                    $sendToChat.addClass('hidden');
                }

                $sendToChat.rebind('click.media-viewer', () => {
                    if (megaChatIsReady) {
                        sendToChatHandler();
                    }
                    else {
                        showToast('send-chat', l[17794]);
                        mBroadcaster.once('chat_initialized', () => sendToChatHandler());
                    }
                });

                $('.context-menu .send-to-chat', $overlay).rebind('click.media-viewer', () => {
                    $sendToChat.trigger('click.media-viewer');
                });

                // Close context menu
                $overlay.rebind('mouseup.media-viewer', (e) => {

                    $('.v-btn.options', $overlay).removeClass('active deactivated');
                    contextMenu.close(optionsMenu);

                    if (!$(e.target).parents('.slideshow-context-settings').length) {
                        const $settingsButton = $('.sl-btn.settings', $overlay);
                        $settingsButton.removeClass('active deactivated');
                        $('i', $settingsButton).removeClass('icon-slider-filled');
                        $('i', $settingsButton).addClass('icon-slider-outline');
                        contextMenu.close(settingsMenu);
                        $overlay.removeClass('context-menu-open');
                    }
                });
            }

            // Favourite Icon
            slideshow_favourite(n, $overlay);

            // Remove Icon
            slideshow_remove(n, $overlay);

            if (filteredNodeArr && Array.isArray(filteredNodeArr)) {
                preselection = filteredNodeArr;
            }

            // Icons for rubbish bin
            slideshow_bin(n, $overlay);

            // Previous/Next viewer buttons
            const steps = slideshowsteps();

            if (M.chat) {
                const {pos, len} = steps;

                if (pos + 6 > len || pos - 4 < 0) {
                    if (len < 2) {
                        $.triggerSlideShow = slideshowid;
                    }

                    queueMicrotask(() => megaChat.retrieveSharedFilesHistory().catch(dump));
                }
            }

            if (steps.backward.length) {
                $prevNextButtons.filter('.previous').removeClass('hidden opacity-50').removeAttr('disabled');
            }
            if (steps.forward.length) {
                $prevNextButtons.filter('.next').removeClass('hidden opacity-50').removeAttr('disabled');
            }

            $prevNextButtons.rebind('click.mediaviewer', function() {

                if (!this.classList.contains('hidden') && M.v.length > 1) {
                    const steps = slideshowsteps();

                    if (this.classList.contains('previous')) {

                        if (steps.backward.length) {

                            slideshow_prev(steps);
                        }
                    }
                    else if (this.classList.contains('next') && steps.forward.length) {

                        slideshow_next(steps);
                    }
                }

                return false;
            });

            const idleAction = is_mobile ? 'touchstart' : 'mousemove';

            delay.cancel(MOUSE_IDLE_TID);
            $document.off(`${idleAction}.idle`);
            $controls.off('mousemove.idle');

            // Slideshow Mode Init
            if (is_image3(n)) {
                slideshow_imgControls();

                // Autohide controls
                (function _() {
                    $overlay.removeClass('mouse-idle');
                    delay(MOUSE_IDLE_TID, () => $overlay.addClass('mouse-idle'), 2e3);
                    $document.rebind(`${idleAction}.idle`, _);
                })();

                if (!is_mobile) {
                    $controls.rebind('mousemove.idle', () => {
                        onIdle(() => {
                            delay.cancel(MOUSE_IDLE_TID);
                        });
                    });
                }

                if (fullScreenManager && fullScreenManager.state) {
                    $('.viewer-bars', $overlay).noTransition(() => {
                        $overlay.addClass('fullscreen');
                    });
                }

                if (!fullScreenManager) {
                    slideshow_fullscreen($overlay);
                }
            }
        }

        $dlBut.rebind('click.media-viewer', function _dlButClick() {

            if (this.classList && this.classList.contains('disabled')) {
                return false;
            }

            var p = previews[n && n.h];

            if (p && p.full && Object(p.buffer).byteLength) {
                M.saveAs(p.buffer, n.name)
                    .catch((ex) => {
                        if (d) {
                            console.debug(ex);
                        }
                        p.full = p.buffer = false;
                        _dlButClick.call(this);
                    });
                return false;
            }

            if (is_mobile) {
                mobile.downloadOverlay.showOverlay(n.h);
                return false;
            }

            for (var i = dl_queue.length; i--;) {
                if (dl_queue[i] && dl_queue[i].id === slideshow_handle() && dl_queue[i].preview) {
                    dl_queue[i].preview = false;
                    M.openTransfersPanel();
                    return;
                }
            }

            if (pfcol) {
                tryCatch(() => eventlog(mega.gallery.isVideo(n) ? 99972 : 99973))();
            }

            // TODO: adapt the above code to work on the downloads page if we need to download the original
            if (page === 'download') {
                $('button.download-file').click();
            }
            else if (M.d[slideshow_handle()]) {
                M.addDownload([slideshow_handle()]);
            }
            else {
                M.addDownload([n]);
            }

            return false;
        });

        if ((n.p || M.chat || page === 'download') && M.getNodeRoot(n.p) !== M.RubbishID) {
            $dlBut.removeClass('hidden');
        }
        else {
            $dlBut.addClass('hidden');
        }

        if (previews[n.h]) {
            if (previews[n.h].fromChat) {
                previews[n.h].fromChat = null;

                if (previews[n.h].full) {
                    previewimg(n.h, previews[n.h].buffer);
                }
                else {
                    fetchsrc(n);
                }
            }
            else {
                previewsrc(n.h);
            }

            fetchnext();
        }
        else {
            $('img', $imgWrap).attr('src', '');
            if (is_video(n)) {
                $('.loader-grad', $content).removeClass('hidden');
            }
            else {
                $pendingBlock.removeClass('hidden');
            }

            if (!preqs[n.h]) {
                fetchsrc(n);
            }
        }

        $overlay.removeClass('hidden');

        if (mega.ui.viewerOverlay) {
            mega.ui.viewerOverlay.show(id);
        }
    }

    function slideshow_toggle_pause($button) {
        if ($button.attr('data-state') === 'pause') {
            $button.attr('data-state', 'play');
            $('i', $button).removeClass('icon-pause').addClass('icon-play');
            slideshowpause = true;
        }
        else {
            $button.attr('data-state', 'pause');
            $('i', $button).removeClass('icon-play').addClass('icon-pause');
            slideshowpause = false;
        }

        slideshow_timereset();
    }

    function slideshow_play(isPlayMode, isAbortFetch) {
        mega.slideshow.manager.setState({
            currentNodeId: slideshowid,
            isPlayMode,
            isAbortFetch,
            isNotBuildPlaylist: !isPlayMode && !slideshowplay
        });

        slideshowplay = isPlayMode;
    }

    function slideshowplay_close() {
        slideshow_imgControls(1, true);

        // hack to also stop fullscreen
        if (fullScreenManager) {
            fullScreenManager.exitFullscreen();
        }
    }

    function fetchnext() {
        var n = M.getNodeByHandle(slideshowsteps().forward[0]);

        if (String(n.fa).indexOf(':1*') > -1 && !preqs[n.h]) {

            if (!previews[n.h] || previews[n.h].fromChat) {

                if (previews[n.h]) {
                    previews[n.h].fromChat = null;
                }

                fetchsrc(n.h);
            }
        }
    }

    function fetchsrc(id) {
        var n = slideshow_node(id);
        if (!n) {
            console.error('Node "%s" not found...', id);
            return false;
        }

        var eot = function eot(id, err) {
            delete preqs[id];
            delete pfails[id];
            if (n.s > 13e7) {
                return previewimg(id, null);
            }
            M.addDownload([id], false, err ? -1 : true);
        };
        eot.timeout = 8500;

        var preview = function preview(ctx, h, u8) {
            previewimg(h, u8, ctx.type);

            if (isThumbnailMissing(n)) {
                createNodeThumbnail(n, u8);
            }
            if (h === slideshow_handle()) {
                fetchnext();
            }
            delete pfails[h];
        };


        if (d) {
            console.debug('slideshow.fetchsrc', id, n, n.h);
        }

        if (['pdf', 'docx'].includes(fileext(n.name))) {
            if (!preqs[n.h]) {
                preqs[n.h] = 1;

                const ext = fileext(n.name);
                M.gfsfetch(n.link || n.h, 0, -1).then((data) => {
                    const type = ext === 'pdf' ? 'application/pdf' : extmime.docx;

                    preview({ type }, n.h, data.buffer);

                }).catch((ex) => {
                    if (d) {
                        console.warn(`Failed to retrieve ${ext}, failing back to broken eye image...`, ex);
                    }

                    previewimg(n.h, null);
                    delete previews[n.h].buffer;
                    preqs[n.h] = 0; // to retry again
                    if (ex === EOVERQUOTA || Object(ex.target).status === 509) {
                        dlmanager.setUserFlags();
                        dlmanager.showOverQuotaDialog();
                    }
                });
            }
            return false;
        }

        if (is_video(n)) {
            if (!preqs[n.h]) {
                preqs[n.h] = 1;

                if (String(n.fa).indexOf(':1*') > 0) {
                    getImage(n, 1)
                        .then(uri => {
                            if (previews[n.h]) {
                                previews[n.h].poster = uri;
                            }
                            return uri;
                        })
                        .dump('preload.poster.' + n.h);
                }

                M.require('videostream').done(function() {
                    if (preqs[n.h]) {
                        previewimg(n.h, Array(26).join('x'), filemime(n, 'video/mp4'));
                    }
                }).fail(function() {
                    console.error('Failed to load videostream.js');
                });
            }
            return false;
        }

        if (pfails[n.h]) {
            // for slideshow_next/prev
            if (slideshow_handle() === n.h) {
                return eot(n.h, 1);
            }
            delete pfails[n.h];
        }

        preqs[n.h] = 1;
        const maxSize = parseInt(localStorage.maxPrvOrigSize) || 50;
        var loadOriginal = n.s < maxSize * 1048576 && is_image(n) === 1;
        var loadPreview = !loadOriginal || !slideshowplay && n.s > 1048576;
        var onPreviewError = loadOriginal ? previewimg.bind(window, n.h, null) : eot;
        var getPreview = api_getfileattr.bind(window, {[n.h]: n}, 1, preview, onPreviewError);

        if (d) {
            console.debug('slideshow.fetchsrc(%s), preview=%s original=%s', id, loadPreview, loadOriginal, n, n.h);
        }

        var isCached = previews[n.h] && previews[n.h].buffer && !slideshowplay;
        if (isCached) {
            // e.g. hackpatch for chat who already loaded the preview...
            if (n.s > 1048576) {
                loadPreview = true;
                getPreview = preview.bind(null, false, n.h, previews[n.h].buffer);
            }
            else {
                loadPreview = false;
                preview(false, n.h, previews[n.h].buffer);
            }
        }

        if (loadOriginal) {
            var $overlay = $('.media-viewer-container');
            var $progressBar = $('.viewer-progress', $overlay);

            var progress = function(perc) {
                var loadingDeg = 360 * perc / 100;

                if (slideshow_handle() !== n.h) {
                    if (d && ((perc | 0) % 10) < 1) {
                        console.debug('slideshow original image loading in background progress...', n.h, perc);
                    }
                    return;
                }
                $progressBar.removeClass('vo-hidden');

                if (loadingDeg <= 180) {
                    $('.right-c p', $progressBar).css('transform', 'rotate(' + loadingDeg + 'deg)');
                    $('.left-c p', $progressBar).removeAttr('style');
                }
                else {
                    $('.right-c p', $progressBar).css('transform', 'rotate(180deg)');
                    $('.left-c p', $progressBar).css('transform', 'rotate(' + (loadingDeg - 180) + 'deg)');
                }

                if (loadingDeg === 360) {
                    $progressBar.addClass('vo-hidden');
                    $('p', $progressBar).removeAttr('style');
                }
            };

            M.gfsfetch(n.link || n.h, 0, -1, progress).then((data) => {
                preview({type: filemime(n, 'image/jpeg')}, n.h, data.buffer);
                if (!exifImageRotation.fromImage) {
                    previews[n.h].orientation = parseInt(EXIF.readFromArrayBuffer(data, true).Orientation) || 1;
                }
            }).catch((ex) => {
                if (ex === EOVERQUOTA || Object(ex.target).status === 509) {
                    eventlog(99703, true);
                }

                if (d) {
                    console.debug('slideshow failed to load original %s', n.h, ex.target && ex.target.status || ex);
                }

                if (slideshow_handle() === n.h) {
                    $progressBar.addClass('vo-hidden');
                }

                if (!(loadPreview || isCached)) {
                    getPreview();
                }

                slideshow_timereset();
            });
        }

        if (loadPreview) {
            if (loadOriginal) {
                fitToWindow[n.h] = 1;
            }
            getPreview();
        }
    }

    // start streaming a video file
    function slideshow_videostream(id, $overlay) {
        if (!$overlay || !$overlay.length) {
            $overlay = $('video:visible').closest('.media-viewer');
        }
        var n = slideshow_node(id, $overlay);
        var $content = $('.content', $overlay);
        const autoPlay = $.autoplay === id;
        const $pendingBlock = $('.loader-grad', $content);
        var $video = $('video', $content);
        var $playVideoButton = $('.play-video-button', $content);
        let bgsize = 'auto';

        if (is_audio(n)) {
            bgsize = 'contain';
        }
        else {
            if (previews[id].fma === undefined) {
                previews[id].fma = MediaAttribute(n).data || false;
            }

            if (previews[id].fma.width > previews[id].fma.height) {
                bgsize = 'cover';
            }
        }

        $playVideoButton.rebind('click', function() {
            if (dlmanager.isOverQuota) {
                return dlmanager.showOverQuotaDialog();
            }

            var destroy = function() {
                $pendingBlock.addClass('hidden').end().trigger('video-destroy');

                if (preqs[n.h] && preqs[n.h] instanceof Streamer) {
                    mBroadcaster.removeListener(preqs[n.h].ev1);
                    mBroadcaster.removeListener(preqs[n.h].ev2);
                    mBroadcaster.removeListener(preqs[n.h].ev3);
                    mBroadcaster.removeListener(preqs[n.h].ev4);

                    preqs[n.h].kill();
                    preqs[n.h] = false;
                }

                sessionStorage.removeItem('previewNode');
                sessionStorage.removeItem('previewTime');
            };

            // Show loading spinner until video is playing
            $pendingBlock.removeClass('hidden');
            $('.video-controls', $overlay).removeClass('hidden');
            $overlay.addClass('video-theatre-mode');

            // Hide play button.
            $(this).addClass('hidden');
            $('.video-controls .playpause i', $overlay).removeClass('icon-play').addClass('icon-pause');

            if (is_mobile) {
                requestAnimationFrame(() => mega.initMobileVideoControlsToggle($overlay));
            }

            initVideoStream(n, $overlay, destroy).done(streamer => {
                preqs[n.h] = streamer;
                preqs[n.h].options.uclk = !autoPlay;

                preqs[n.h].ev1 = mBroadcaster.addListener('slideshow:next', destroy);
                preqs[n.h].ev2 = mBroadcaster.addListener('slideshow:prev', destroy);
                preqs[n.h].ev3 = mBroadcaster.addListener('slideshow:open', destroy);
                preqs[n.h].ev4 = mBroadcaster.addListener('slideshow:close', destroy);

                // If video is playing
                preqs[n.h].on('playing', function() {
                    var video = this.video;

                    if (video && video.duration) {

                        if (isThumbnailMissing(n) && is_video(n) === 1 && n.u === u_handle && n.f !== u_handle) {
                            var took = Math.round(2 * video.duration / 100);

                            if (d) {
                                console.debug('Video thumbnail missing, will take image at %s...',
                                    secondsToTime(took));
                            }

                            this.on('timeupdate', function() {
                                if (video.currentTime < took) {
                                    return true;
                                }

                                this.getImage().then(createNodeThumbnail.bind(null, n))
                                    .catch(console.warn.bind(console));
                            });
                        }

                        return false;
                    }

                    return true;
                });
            }).catch(console.warn.bind(console));
        });

        $overlay.addClass('video');
        $video.attr('controls', false).removeClass('hidden');
        $playVideoButton.removeClass('hidden');
        $pendingBlock.addClass('hidden');
        $('.img-wrap', $content).addClass('hidden');
        $content.removeClass('hidden');
        $('.viewer-pending', $content).addClass('hidden');

        if (n.name) {
            var c = MediaAttribute.getCodecStrings(n);
            if (c) {
                $('header .file-name', $overlay).attr('title', c);
            }
        }

        if (previews[id].poster !== undefined) {
            // $video.attr('poster', previews[id].poster);
            $video.css('background-size', bgsize);
            $video.css('background-image', `url(${previews[id].poster})`);
        }
        else if (String(n.fa).indexOf(':1*') > 0) {
            getImage(n, 1).then(function(uri) {

                previews[id].poster = uri;

                if (id === slideshow_handle()) {
                    if ($video.length && !$video[0].parentNode) {
                        // The video element got already destroyed/replaced due an error
                        $video = $('.content video', $overlay);
                    }

                    // $video.attr('poster', uri);
                    $video.css('background-size', bgsize);
                    $video.css('background-image', `url(${uri})`);
                }
            }).catch(console.debug.bind(console));
        }

        previews[id].poster = previews[id].poster || '';

        if ($.autoplay === id) {
            queueMicrotask(() => {
                $playVideoButton.trigger('click');
            });
            delete $.autoplay;
        }
    }

    function isThumbnailMissing(n) {
        return !M.chat && (!n.fa || !n.fa.includes(':0*')) && M.shouldCreateThumbnail(n.p);
    }

    function createNodeThumbnail(n, ab) {
        if (isThumbnailMissing(n)) {
            if (d) {
                console.log('Thumbnail found missing on preview, creating...', n.h, n);
            }
            var aes = new sjcl.cipher.aes([
                n.k[0] ^ n.k[4],
                n.k[1] ^ n.k[5],
                n.k[2] ^ n.k[6],
                n.k[3] ^ n.k[7]
            ]);
            var img = is_image(n);
            var vid = is_video(n);
            createnodethumbnail(n.h, aes, n.h, ab, {raw: img !== 1 && img, isVideo: vid});
        }
    }

    const require = async(html, js, ...other) => {
        const files = [html, ...other];

        if (!self.is_extension) {
            files.push(...js);
        }
        await M.require(...files);

        const map = require.map[html];
        html = translate(pages[html]);

        for (let [k, v] of map) {
            v = self.is_extension && js.includes(v) ? bootstaticpath + jsl2[v].f : window[v];

            assert(!!v, `${l[16]}, ${k}`);

            html = html.replace(k, v);
        }

        return html;
    };
    lazy(require, 'map', () => {
        return freeze({
            pdfviewer: new Map([
                ['viewer.js', 'pdfviewerjs'],
                ['viewer.css', 'pdfviewercss'],
                ['../build/pdf.js', 'pdfjs2']
            ]),
            docxviewer: new Map([
                ['docx.js', 'docxviewer_js'],
                ['viewer.css', 'docxviewercss'],
                ['docx-preview.js', 'docxpreview_js']
            ])
        });
    });

    // a method to fetch scripts and files needed to run pdfviewer
    // and then excute them on iframe element [#pdfpreviewdiv1]
    function prepareAndViewPdfViewer(data) {
        const signal = tryCatch(() => {
            const elm = document.getElementById('pdfpreviewdiv1');
            elm.classList.remove('hidden');

            const ev = document.createEvent("HTMLEvents");
            ev.initEvent("pdfjs-openfile.meganz", true);
            ev.data = data.buffer || data.src;
            elm.contentDocument.body.dispatchEvent(ev);
            slideshow_gesture(data.h, elm, 'PDF');
            return true;
        });

        if (_pdfSeen) {

            if (signal()) {
                return;
            }
        }

        require('pdfviewer', ['pdfjs2', 'pdfviewerjs'], 'pdfviewercss').then((myPage) => {
            const id = 'pdfpreviewdiv1';
            const pdfIframe = document.getElementById(id);
            const newPdfIframe = document.createElement('iframe');
            newPdfIframe.id = id;
            newPdfIframe.src = 'about:blank';

            if (pdfIframe) {

                // replace existing iframe to avoid History changes [push]
                pdfIframe.parentNode.replaceChild(newPdfIframe, pdfIframe);
            }
            else {
                // making pdf iframe for initial start
                const p = document.querySelector('.pdf .media-viewer .content');

                if (p) {
                    p.appendChild(newPdfIframe);
                }
            }

            var doc = newPdfIframe.contentWindow.document;
            doc.open();
            doc.write(myPage);
            doc.addEventListener('pdfjs-webViewerInitialized.meganz', function ack() {
                doc.removeEventListener('pdfjs-webViewerInitialized.meganz', ack);
                queueMicrotask(signal);
            });
            doc.close();
            _pdfSeen = true;
        }).catch(tell);
    }

    function prepareAndViewDocxViewer(data) {
        const signal = tryCatch(() => {
            const elem = document.getElementById('docxpreviewdiv1');
            elem.classList.remove('hidden');
            const ev = new Event('docxviewerload');
            ev.data = {
                blob: data.blob
            };
            elem.contentDocument.dispatchEvent(ev);
            slideshow_gesture(data.h, elem, 'DOCX');
        });

        if (_docxSeen) {
            signal();
            return;
        }

        require('docxviewer', ['docxpreview_js', 'docxviewer_js'], 'docxviewercss').then((myPage) => {
            const id = 'docxpreviewdiv1';
            const iframe = document.getElementById(id);
            const newIframe = document.createElement('iframe');
            newIframe.id = id;
            newIframe.src = 'about:blank';

            if (iframe) {

                // replace existing iframe to avoid History changes [push]
                iframe.parentNode.replaceChild(newIframe, iframe);
            }
            else {
                // making docx iframe for initial start
                const p = document.querySelector('.docx .media-viewer .content');

                if (p) {
                    p.appendChild(newIframe);
                }
            }

            const doc = newIframe.contentWindow.document;
            // eslint-disable-next-line local-rules/open
            doc.open();
            doc.write(myPage);
            doc.addEventListener('docxviewerready', function ready() {
                doc.removeEventListener('docxviewerready', ready);
                queueMicrotask(signal);
            });
            doc.addEventListener('docxviewererror', (ev) => {
                const { data } = ev;
                let errBody = '';
                if (data.error === -1) {
                    errBody = l.preview_failed_support;
                }
                else if (data.error === -2) {
                    errBody = l.preview_failed_temp;
                }
                msgDialog('error', '', l.preview_failed_title, errBody);
            });
            doc.close();
            _docxSeen = true;
        }).catch(tell);
    }

    function previewsrc(id) {
        var $overlay = $('.media-viewer-container', 'body');
        var $content = $('.content', $overlay);
        var $imgWrap = $('.img-wrap', $content);
        var $bottomBar = $('footer', $overlay);
        var $pendingBlock = $('.viewer-pending', $content);
        var $progressBlock = $('.viewer-progress', $content);

        var src = Object(previews[id]).src;
        if (!src) {
            console.error('Cannot preview %s', id);
            return;
        }

        var type = typeof previews[id].type === 'string' && previews[id].type || 'image/jpeg';
        mBroadcaster.sendMessage.apply(mBroadcaster, ['trk:event', 'preview'].concat(type.split('/')));

        $overlay.removeClass('pdf video video-theatre-mode');
        $('embed', $content).addClass('hidden');
        $('video', $content).addClass('hidden');
        $imgWrap.removeClass('hidden');
        $('#pdfpreviewdiv1, #docxpreviewdiv1', $content).addClass('hidden');
        $bottomBar.removeClass('hidden');

        if (previews[id].type === 'application/pdf') {
            $overlay.addClass('pdf');
            $pendingBlock.addClass('hidden');
            $progressBlock.addClass('vo-hidden');
            if (!is_mobile) {
                $bottomBar.addClass('hidden');
            }
            $imgWrap.addClass('hidden');
            // preview pdfs using pdfjs for all browsers #8036
            // to fix pdf compatibility - Bug #7796
            prepareAndViewPdfViewer(previews[id]);
            api_req({a: 'log', e: 99660, m: 'Previewed PDF Document.'});
            return;
        }
        if (previews[id].type === extmime.docx) {
            $overlay.addClass('docx');
            $pendingBlock.addClass('hidden');
            $progressBlock.addClass('vo-hidden');
            if (!is_mobile) {
                $bottomBar.addClass('hidden');
            }
            $imgWrap.addClass('hidden');
            prepareAndViewDocxViewer(previews[id]);
            eventlog(99819);
            return;
        }

        tryCatch(() => slideshow_gesture(previews[id].h, $overlay[0]), self.reportError)();

        const isVideoStream = /^(?:audio|video)\//i.test(previews[id].type);

        if (pfcol) {
            eventlog(isVideoStream ? 99970 : 99971);
        }

        if (isVideoStream) {
            return slideshow_videostream(id, $overlay);
        }

        // Choose img to set src for Slideshow transition effect
        var imgClass = $imgWrap.attr('data-count') === 'img1' ? 'img2' : 'img1';
        var replacement = false;

        if ($imgWrap.attr('data-image') === id) {
            replacement = $imgWrap.attr('data-count');
            if (replacement) {
                imgClass = replacement;

                if (d) {
                    console.debug('Replacing preview image with original', id, imgClass);
                }
            }
        }

        var img = new Image();
        img.onload = img.onerror = function(ev) {
            if (id !== slideshow_handle()) {
                if (d) {
                    console.debug('Moved to another image, not displaying %s...', id);
                }
                return;
            }
            var src1 = this.src;
            var $img = $('.' + imgClass, $imgWrap);
            var rot = previews[id].orientation | 0;

            if (slideshowplay) {
                if (previews[id].full
                    || previews[id].ffailed
                    || ev.type === 'error'
                    || is_image(M.getNodeByHandle(slideshowid)) !== 1) {

                    slideshow_timereset();
                }
            }

            if (ev.type === 'error') {
                src1 = noThumbURI;
                if (!replacement) {
                    // noThumbURI is a 240pt svg image over a 320pt container...
                    origImgWidth = origImgHeight = 320;
                }

                if (d) {
                    console.debug('slideshow failed to preview image...', id, src, previews[id].prev, ev);
                }

                // Restore last good preview
                if (previews[id].prev) {
                    URL.revokeObjectURL(previews[id].src);
                    previews[id] = previews[id].prev;
                    delete previews[id].prev;
                    previews[id].ffailed = 1;
                    this.src = previews[id].src;
                    return;
                }
            }
            else {
                switchedSides = rot > 4;

                if (switchedSides) {
                    origImgWidth = this.naturalHeight;
                    origImgHeight = this.naturalWidth;
                }
                else {
                    origImgWidth = this.naturalWidth;
                    origImgHeight = this.naturalHeight;
                }

                if (d) {
                    console.debug('slideshow loaded image %s:%sx%s, ' +
                        'orientation=%s', id, origImgWidth, origImgHeight, rot);
                }

                if (previews[id].fromChat !== undefined) {
                    replacement = false;
                }
            }

            // Apply img data to necessary image. If replacing preview->original,
            // update only the img's src and percent-label, to preserve any zoomed status.
            if (!replacement || switchedSides) {
                if (ua.details.engine === 'Gecko') {
                    // Prevent an issue where some previous images are shown moving to next
                    $('.img-wrap img', $overlay).attr('src', '');
                }
                $('img', $imgWrap).removeClass('active');
                $imgWrap.attr('data-count', imgClass);
                $imgWrap.attr('data-image', id);
                $img.attr('src', src1).one('load', () => {
                    $img.addClass('active');
                    slideshow_imgPosition($overlay);
                });

                if (previews[id].brokenEye) {
                    $img.addClass('broken-eye');
                }

                $(window).rebind('resize.imgResize', function() {
                    slideshow_imgPosition($overlay);
                });
            }
            else if (src1 !== noThumbURI) {
                $img.attr('src', src1).addClass('active');

                if ($img.hasClass('broken-eye')) {
                    $img.addClass('vo-hidden').removeClass('broken-eye');
                }

                // adjust zoom percent label
                onIdle(() => {
                    slideshow_imgPosition($overlay);
                    $img.removeClass('vo-hidden');
                });
            }

            // Apply exit orientation
            $img.removeClassWith('exif-rotation-').addClass('exif-rotation-' + rot).attr('data-exif', rot);

            $pendingBlock.addClass('hidden');
            $progressBlock.addClass('vo-hidden');
        };

        img.src = src;
    }

    function previewimg(id, uint8arr, type) {
        var blob;
        var n = M.getNodeByHandle(id);
        var brokenEye = false;

        if (uint8arr === null) {
            if (d) {
                console.debug('Using broken-eye image for %s...', id);
            }

            var svg = decodeURIComponent(noThumbURI.substr(noThumbURI.indexOf(',') + 1));
            var u8 = new Uint8Array(svg.length);
            for (var i = svg.length; i--;) {
                u8[i] = svg.charCodeAt(i);
            }
            uint8arr = u8;
            type = 'image/svg+xml';
            brokenEye = true;
        }

        type = typeof type === 'string' && type || 'image/jpeg';

        try {
            blob = new Blob([uint8arr], {type: type});
        }
        catch (ex) {
        }
        if (!blob || blob.size < 25) {
            blob = new Blob([uint8arr.buffer], {type: type});
        }

        if (previews[id]) {
            if (previews[id].full) {
                if (d && previews[id].fromChat !== null) {
                    console.warn('Not overwriting a full preview...', id);
                }
                if (id === slideshow_handle()) {
                    previewsrc(id);
                }
                return;
            }
            previews[id].prev = previews[id];
        }

        if (d) {
            console.debug('slideshow.previewimg', id, previews[id]);
        }

        previews[id] = Object.assign(Object.create(null), previews[id], {
            h: id,
            blob: blob,
            type: type,
            time: Date.now(),
            src: myURL.createObjectURL(blob),
            buffer: uint8arr.buffer || uint8arr,
            full: n.s === blob.size,
            brokenEye: brokenEye
        });

        if (n.hash) {
            // cache previews by hash to reuse them in the chat
            previews[id].hash = n.hash;
            previews[n.hash] = previews[id];
        }

        if (id === slideshow_handle()) {
            previewsrc(id);
        }

        // Ensure we are not eating too much memory...
        tSleep.schedule(7, slideshow_freemem);
    }

    function slideshow_freemem() {
        var i;
        var k;
        var size = 0;
        var now = Date.now();
        var slideshowid = slideshow_handle();
        var entries = array.unique(Object.values(previews));

        for (i = entries.length; i--;) {
            k = entries[i];
            size += k.buffer && k.buffer.byteLength || 0;
        }

        if (d) {
            console.debug('Previews cache is using %s of memory...', bytesToSize(size));
        }
        const limit = is_mobile ? 100 : 450;

        if (size > limit * 1048576) {
            size = 0;

            for (i = entries.length; i--;) {
                var p = entries[i];

                if (p.h === slideshowid || !p.buffer || (now - p.time) < 2e4) {
                    continue;
                }
                k = p.h;

                size += p.buffer.byteLength;
                p.buffer = p.full = preqs[k] = false;

                if (p.prev) {
                    previews[k] = p.prev;
                    delete p.prev;
                }

                if (p.type.startsWith('image') || p.type === 'application/pdf') {
                    URL.revokeObjectURL(p.src);
                    if (previews[k] === p) {
                        previews[k] = false;
                    }
                }

                if (!previews[k] && p.hash) {
                    previews[p.hash] = false;
                }
            }

            if (d) {
                console.debug('...freed %s', bytesToSize(size));
            }
        }
    }


    /**
     * @global
     */
    global.slideshow = slideshow;
    global.slideshow_next = slideshow_next;
    global.slideshow_prev = slideshow_prev;
    global.slideshow_handle = slideshow_handle;
    global.slideshow_steps = slideshowsteps;
    global.previewsrc = previewsrc;
    global.previewimg = previewimg;

})(self);

/* eslint-disable max-classes-per-file */
lazy(mega, 'fileRequestCommon', () => {
    'use strict';

    const logger = new MegaLogger('common', null, MegaLogger.getLogger('FileRequest'));
    const treeClass = 'file-request-folder';

    const ongoingRemoval = new Set();
    const dspOngoingRemoval = () => {
        const nodes = [...ongoingRemoval].map(h => Object.keys(M.c[h] || {})).flat().map(h => M.d[h]).filter(Boolean);

        ongoingRemoval.clear();
        mBroadcaster.sendMessage('mediainfo:collect', true, nodes);
    };
    const addOngoingRemoval = (h) => {
        ongoingRemoval.add(h);
        delay('file-request:ongoing-removal', dspOngoingRemoval, 2e3);
    };

    const refreshFileRequestPageList = () => {
        if (fminitialized && M.currentdirid === 'file-requests') {
            M.openFolder(M.currentdirid, true);
            selectionManager.clear_selection();
        }
    };

    const updateMobileNodeIcon = (nodeHandle) => {
        const component = MegaMobileNode.getNodeComponentByHandle(nodeHandle);

        if (component) {
            component.update('icon');
        }
    };

    const addFileRequestIcon = (puHandlePublicHandle) => {
        if (fminitialized && puHandlePublicHandle) {
            const puHandleObject = M.d[puHandlePublicHandle]
                || mega.fileRequestCommon.storage.getPuHandleByPublicHandle(puHandlePublicHandle);

            if (!puHandleObject) {
                if (d) {
                    logger.info('common.addFileRequestIcon - Failed to add icon', puHandleObject, puHandlePublicHandle);
                }
                return;
            }

            const nodeId = puHandleObject.h;
            if (is_mobile) {
                updateMobileNodeIcon(nodeId);
                return;
            }

            let $nodeId = $(`#${nodeId}`);
            const $tree = $(`#treea_${nodeId} span.nw-fm-tree-folder`);

            if (
                $nodeId.length === 0 &&
                !String(M.currentdirid).includes('chat') &&
                M.megaRender && M.megaRender.hasDOMNode(nodeId)
            ) {
                $nodeId = $(M.megaRender.getDOMNode(nodeId));
            }

            if (!$nodeId.length && !$tree.length) {
                return false;
            }

            const viewModeClass = M.viewmode ? 'span.item-type-icon-90' : 'span.item-type-icon';
            const folderClass = M.viewmode ? 'icon-folder-public-90' : 'icon-folder-public-24';

            $(viewModeClass, $nodeId).addClass(folderClass);

            if ($tree.length) {
                $tree.addClass(treeClass);
            }

            if (d) {
                logger.info(
                    'common.addFileRequestIcon - Added node icon',
                    nodeId,
                    puHandleObject,
                    puHandlePublicHandle
                );
            }
        }
    };

    const removeFileRequestIcon = (selectedNodeHandle) => {
        if (fminitialized && selectedNodeHandle) {
            const nodeId = selectedNodeHandle;
            if (is_mobile) {
                updateMobileNodeIcon(nodeId);
                return;
            }

            let node = document.getElementById(nodeId);

            if (node && M.megaRender && M.megaRender.hasDOMNode(nodeId)) {
                node = M.megaRender.getDOMNode(nodeId);

                const viewModeClass = M.viewmode ? 'span.item-type-icon-90' : 'span.item-type-icon';
                $(viewModeClass, node).removeClass('icon-folder-public-24 icon-folder-public-90')
                    .addClass(M.viewmode ? 'icon-folder-90' : 'icon-folder-24');
            }

            $(`#treea_${nodeId} span.nw-fm-tree-folder`)
                .removeClass(treeClass);
        }
    };

    const isEmpty = (input) => {
        return input === undefined || input === null || input === '';
    };

    class FileRequestApi {
        create(handle, title, description) {
            const data = {
                name: u_attr.name,
                email: u_attr.email,
                msg: title || '',
                description: description || ''
            };

            mLoadingSpinner.show('puf-create');

            eventlog(99773);
            return api.screq({n: handle, a: 'ul', d: 0, s: 2, data})
                .finally(() => {
                    mLoadingSpinner.hide('puf-create');
                });
        }

        // Remove public upload folder
        remove(handle) {

            addOngoingRemoval(handle);
            mLoadingSpinner.show('puf-remove');

            return api.screq({a: 'ul', d: 1, n: handle})
                .finally(() => {
                    mLoadingSpinner.hide('puf-remove');
                });
        }

        update(puPagePublicHandle, title, description, name, email) {
            const d = {
                name: name || u_attr.name,
                email: email || u_attr.email,
                msg: title,
                description: description
            };

            mLoadingSpinner.show('puf-update');

            return api.screq({a: 'ps', p: puPagePublicHandle, d})
                .finally(() => {
                    mLoadingSpinner.hide('puf-update');
                });
        }

        getPuPageList() {

            return api.req({a: 'pl'});
        }

        getPuPage(pageId) {

            return api.req({a: 'pg', p: pageId});
        }

        getOwnerPublicKey(ownerHandle) {

            return api.req({a: 'uk', u: ownerHandle}).then(({result: {pubk}}) => pubk);
        }
    }

    class FileRequestStorage {
        constructor() {
            this.cache = {
                puHandle: Object.create(null),
                puPage: Object.create(null),
                puMessages: Object.create(null)
            };
        }

        addPuMessage(puHandlePublicHandle) {
            this.cache.puMessages[puHandlePublicHandle] = 1;
        }

        hasPuMessage(puHandlePublicHandle) {
            return this.cache.puMessages[puHandlePublicHandle] !== undefined;
        }

        removePuMessage(puHandlePublicHandle) {
            if (this.cache.puMessages[puHandlePublicHandle]) {
                delete this.cache.puMessages[puHandlePublicHandle];
            }
        }

        removePuHandle(puHandleNodeHandle, puHandlePublicHandle) {
            if (d) {
                logger.info('Storage.removePuHandle', {
                    puHandleNodeHandle,
                    puHandlePublicHandle
                });
            }

            if (fmdb && !pfkey) {
                fmdb.del('puf', puHandlePublicHandle);
            }

            let nodeHandle = puHandleNodeHandle;
            if (!puHandleNodeHandle || !this.cache.puHandle[nodeHandle]) {
                nodeHandle = this.getPuHandleKeyByPublicHandle(puHandlePublicHandle);
            }

            if (nodeHandle && this.cache.puHandle[nodeHandle]) {
                delete this.cache.puHandle[nodeHandle];
            }

            if (fminitialized && nodeHandle) {
                removeFileRequestIcon(nodeHandle);
            }
        }

        addPuHandle(puHandleNodeHandle, puHandlePublicHandle, data, pagePublicHandle) {
            if (d) {
                logger.info('Storage.addPuHandle', {
                    puHandleNodeHandle,
                    puHandlePublicHandle
                });
            }
            let n = M.getNodeByHandle(puHandleNodeHandle);
            // Since the name is getting retrieved asynchronously, we can update it later
            if (!n.name) {
                if (d) {
                    logger.warn('Storage.addPuHandle - no name was found', n, puHandleNodeHandle, puHandlePublicHandle);
                }
            }

            const puHandleState = 2;
            const {name = ''} = n;
            let title = '';
            let description = '';

            if (data) {
                title = data.msg;
                description = data.description;

                if (d) {
                    logger.info('Storage.addPuHandle - with data', puHandleNodeHandle, puHandlePublicHandle);
                }
            }

            if (d) {
                logger.info(
                    'Storage.addPuHandle - puf add',
                    puHandlePublicHandle,
                    puHandleNodeHandle
                );
            }

            // This just make sure we have the entry saved on cache locally
            this.saveOrUpdatePuHandle(
                {
                    nodeHandle: puHandleNodeHandle,
                    title,
                    description,
                    name,
                    state: puHandleState,
                    publicHandle: puHandlePublicHandle,
                    pagePublicHandle
                }
            );
        }

        saveOrUpdatePuHandle(options, update) {
            if (!options.publicHandle) {
                logger.info(
                    'Storage.saveOrUpdatePuHandle - PUF Save/Update',
                    options.folderName,
                    options.nodeHandle
                );
            }

            let {
                nodeHandle,
                title,
                description,
                folderName,
                state,
                publicHandle,
                pagePublicHandle
            } = this.setPuHandleValues(options, update);

            // This is to look for
            if (!nodeHandle && publicHandle) {
                nodeHandle = this.getNodeHandleByPuHandle(publicHandle);
            }

            // Node handle should exist
            assert(typeof nodeHandle === 'string', 'saveOrUpdatePuHandle: No Handle - Check this',
                   publicHandle, [options, nodeHandle]);

            const puHandleCacheData = {
                p: pagePublicHandle || '', // Page public handle
                h: nodeHandle, // Node Handle
                ph: publicHandle, // Handle public handle
                fn: folderName, // Folder Name
                s: state, // state
                d: {
                    t: title || '', // Title
                    d: description || '' // Description
                }
            };

            this.cache.puHandle[nodeHandle] = puHandleCacheData;

            if (fmdb && !pfkey) {
                const d = {...puHandleCacheData};

                fmdb.add('puf', {ph: publicHandle, d});
            }

            if (fminitialized) {
                mega.fileRequestCommon.addFileRequestIcon(nodeHandle);
            }

            return puHandleCacheData;
        }

        setPuHandleValues(options, update) {
            let {
                nodeHandle,
                title,
                description,
                folderName,
                state,
                publicHandle,
                pagePublicHandle
            } = options;

            const currentCacheData = this.getPuHandleByNodeHandle(nodeHandle);
            if (currentCacheData) {
                folderName = isEmpty(folderName) ? currentCacheData.fn : folderName;
                title = isEmpty(title) && !update ? currentCacheData.d.t : title;
                description = isEmpty(description) && !update ? currentCacheData.d.d : description;
                publicHandle = isEmpty(publicHandle) ? currentCacheData.ph : publicHandle;
                pagePublicHandle = isEmpty(pagePublicHandle) ? currentCacheData.p : pagePublicHandle;
                state = isEmpty(state) ? currentCacheData.s : state;
            }

            return {
                nodeHandle,
                title,
                description,
                folderName,
                state,
                publicHandle,
                pagePublicHandle
            };
        }

        getPuHandleKeyByPublicHandle(puHandlePublicHandle) {
            let currentPuHandleObjectKey = null;
            const puHandleObjects = this.cache.puHandle;

            // Search puf.items with related PUP handle
            for (const key in puHandleObjects) {
                if (puHandleObjects[key]) {
                    const puHandleObject = puHandleObjects[key];
                    if (puHandleObject.ph === puHandlePublicHandle) {
                        currentPuHandleObjectKey = key;
                        break;
                    }
                }
            }

            return currentPuHandleObjectKey;
        }

        getPuHandleByPublicHandle(puHandlePublicHandle) {
            const currentPuHandleKey = this.getPuHandleKeyByPublicHandle(puHandlePublicHandle);

            if (!currentPuHandleKey) {
                return null;
            }

            return this.cache.puHandle[currentPuHandleKey];
        }

        getPuHandleByNodeHandle(nodeHandle) {
            if (!this.cache.puHandle) {
                return null;
            }

            return this.cache.puHandle[nodeHandle];
        }

        getPuPageByPageId(pageId) {
            if (!this.cache.puPage) {
                return null;
            }

            return this.cache.puPage[pageId];
        }

        getPuHandleList() {

            return this.cache.puHandle || false;
        }

        updatePuHandlePageId(
            puHandlePublicHandle,
            puPagePublicHandle,
            puHandleState
        ) {
            if (d) {
                logger.info('Storage.updatePuHandlePageId', {
                    puHandlePublicHandle,
                    puPagePublicHandle,
                    puHandleState
                });
            }

            const currentPuHandleKey = this.getPuHandleKeyByPublicHandle(puHandlePublicHandle);
            if (!currentPuHandleKey) {
                logger.info('Storage.updatePuHandlePageId - Update puf db', {
                    puHandlePublicHandle,
                    puPagePublicHandle
                });
                return null;
            }

            const currentPuHandleObject = this.saveOrUpdatePuHandle(
                {
                    nodeHandle: currentPuHandleKey,
                    state: puHandleState,
                    publicHandle: puHandlePublicHandle,
                    pagePublicHandle: puPagePublicHandle
                }
            );

            if (d) {
                logger.info('Storage.updatePuHandlePageId - Update puf db', {
                    puHandlePublicHandle,
                    currentPuHandleObject
                });
            }

            return currentPuHandleObject;
        }

        addPuPage(puPageObject) {
            if (d) {
                logger.info('Storage.addPuPage - Add PUP', {
                    puPageObject
                });
            }

            const puHandleState = puPageObject.s;
            const puHandlePublicHandle = puPageObject.ph;
            const puPagePublicHandle = puPageObject.p;

            // Update puf.items with related PUP handle
            const puHandleObject = this.updatePuHandlePageId(puHandlePublicHandle, puPagePublicHandle, puHandleState);
            if (!puHandleObject) {
                if (d) {
                    logger.error('Storage.addPuPage - no PUP object', {puPageObject});
                }
                return;
            }

            const folderName = puHandleObject.fn;
            const nodeHandle = puHandleObject.h;

            let title = '';
            let description = '';
            let message = '';

            if (puHandleObject.d) {
                title = puHandleObject.d.t;
                message = puHandleObject.d.t;
                description = puHandleObject.d.d;
            }
            else {
                title = puHandleObject.fn;
                message = puHandleObject.fn;
            }

            if (puPageObject.d) { // We override title and description and use what is stored in the API
                if ((!title.length || !message.length) && puPageObject.d.msg) {
                    title = puPageObject.d.msg;
                    message = puPageObject.d.msg;
                }
                if (!description.length && puPageObject.d.description) {
                    description = puPageObject.d.description;
                }
            }

            this.saveOrUpdatePuPage(
                {
                    nodeHandle,
                    title,
                    description,
                    message,
                    folderName,
                    state: puHandleState,
                    publicHandle: puHandlePublicHandle,
                    pagePublicHandle: puPagePublicHandle
                }
            );

            if (d) {
                logger.info('Storage.addPuPage - Save PUP Object', {
                    puPageObject,
                    puHandleObject
                });
            }
        }

        saveOrUpdatePuPage(options, update) {
            if (!options.pagePublicHandle) {
                logger.info(
                    'Storage.saveOrUpdatePuPage - PUF Save/Update',
                    options.folderName,
                    options.nodeHandle
                );
            }

            const {
                nodeHandle,
                title,
                description,
                message,
                folderName,
                state,
                publicHandle,
                pagePublicHandle,
                name
            } = this.setPuPageValues(options, update);

            const puHandleCacheData = {
                p : pagePublicHandle || '', // Page public handle
                h:  nodeHandle, // Node Handle
                ph: publicHandle, // Handle public handle
                fn: folderName, // Folder Name
                s:  state, // state
                msg: message,
                name: name || u_attr.name,
                d: {
                    t: title || '', // Title
                    d: description || '' // Description
                }
            };

            this.cache.puPage[pagePublicHandle] = puHandleCacheData;

            if (fmdb && !pfkey) {
                const d = {...puHandleCacheData};

                fmdb.add('pup', {p: pagePublicHandle, d});
            }

            return puHandleCacheData;
        }

        setPuPageValues(options, update) {
            let {
                nodeHandle,
                title,
                description,
                message,
                folderName,
                state,
                publicHandle,
                pagePublicHandle,
                name
            } = options;

            const currentCacheData = this.getPuPageByPageId(pagePublicHandle);
            if (currentCacheData) {
                nodeHandle = isEmpty(nodeHandle) ? currentCacheData.h : nodeHandle;
                folderName = isEmpty(folderName) ? currentCacheData.fn : folderName;
                title = isEmpty(title) && update ? currentCacheData.d.t : title;
                description = isEmpty(description) && update ? currentCacheData.d.d : description;
                publicHandle = isEmpty(publicHandle) ? currentCacheData.ph : publicHandle;
                pagePublicHandle = isEmpty(pagePublicHandle) ? currentCacheData.p : pagePublicHandle;
                state = isEmpty(state) ? currentCacheData.s : state;
                message = isEmpty(message) ? currentCacheData.msg : message;
                name = isEmpty(name) ? currentCacheData.name : name;
            }

            return {
                nodeHandle,
                title,
                description,
                message,
                folderName,
                state,
                publicHandle,
                pagePublicHandle,
                name
            };
        }

        updatePuPage(puPagePublicHandle, title, description) {
            if (d) {
                logger.info('Storage.updatePuPage - Update PUP', {
                    puPagePublicHandle,
                    title,
                    description
                });
            }

            // Update puf.items with related PUP handle
            const puPageObject = this.getPuPageByPageId(puPagePublicHandle);
            if (!puPageObject) {
                if (d) {
                    logger.error('Storage.updatePuPage - no PUP object', {puPagePublicHandle});
                }
                return;
            }

            let message = puPageObject.msg || '';

            if (isEmpty(title)) {
                title = puPageObject.d.t || '';
            }
            else {
                message = title;
            }

            if (isEmpty(description)) {
                description = puPageObject.d.d || '';
            }

            this.saveOrUpdatePuPage(
                {
                    title,
                    description,
                    message,
                    pagePublicHandle: puPagePublicHandle
                },
                true
            );

            if (d) {
                logger.info('Storage.addPuPage - Save PUP Object', {
                    puPageObject,
                    puPagePublicHandle
                });
            }
        }

        updatePuHandle(puHandleNodeHandle, title, description) {
            if (d) {
                logger.info('Storage.updatePuHandle - update PUH', {
                    puHandleNodeHandle,
                    title,
                    description
                });
            }

            this.saveOrUpdatePuHandle(
                {
                    nodeHandle: puHandleNodeHandle,
                    title,
                    description
                },
                true
            );
        }

        removePuPage(puPagePublicHandle, puHandlePublicHandle) {
            if (d) {
                logger.info('Storage.removePuPage - Remove PUP', {
                    puPagePublicHandle,
                    puHandlePublicHandle
                });
            }

            if (fmdb && !pfkey) {
                fmdb.del('pup', puPagePublicHandle);
            }

            let nodeHandle = null;
            if (this.cache.puPage[puPagePublicHandle]) {
                nodeHandle = this.cache.puPage[puPagePublicHandle].h;
                delete this.cache.puPage[puPagePublicHandle];
            }

            const puHandleObject = this.getPuHandleByPublicHandle(puHandlePublicHandle);
            if (puHandleObject) {
                this.removePuHandle(puHandleObject.h, puHandleObject.ph);
            }

            return nodeHandle;
        }

        removePuPageByNodeHandle(puHandleNodeHandle) {
            if (d) {
                logger.info('Storage.removePuPageByNodeHandle', {
                    puHandleNodeHandle
                });
            }

            const puHandleObject = this.cache.puHandle[puHandleNodeHandle];
            let puHandlePublicHandle = null;
            if (puHandleObject) {
                puHandlePublicHandle = puHandleObject.ph;
            }

            const puPageObjects = this.cache.puPage;

            // Search puf.items with related PUP handle
            for (const key in puPageObjects) {
                if (puPageObjects[key]) {
                    const puPageObject = puPageObjects[key];
                    const puPagePublicHandle = key;

                    if (puHandlePublicHandle === puPageObject.ph) {
                        if (fmdb && !pfkey) {
                            fmdb.del('pup', puPagePublicHandle);
                        }
                        if (this.cache.puPage[puPagePublicHandle]) {
                            delete this.cache.puPage[puPagePublicHandle];
                        }
                        break;
                    }
                }
            }

            if (fmdb && !pfkey) {
                fmdb.del('puf', puHandlePublicHandle);
            }
            if (this.cache.puHandle[puHandleNodeHandle]) {
                delete this.cache.puHandle[puHandleNodeHandle];
            }
        }

        updatePuHandleFolderName(nodeHandle, folderName) {
            return this.saveOrUpdatePuHandle(
                {
                    nodeHandle,
                    folderName
                }
            );
        }

        updatePuPageFolderName(pagePublicHandle, folderName) {
            return this.saveOrUpdatePuPage(
                {
                    folderName,
                    pagePublicHandle
                }
            );
        }

        isDropExist(selected) {
            let sel = Array.isArray(selected) ? [...selected] : [selected];
            const result = [];

            while (sel.length) {
                const id = sel.shift();
                if (this.getPuHandleByNodeHandle(id)) {
                    result.push(id);
                }

                if (M.tree[id]) {
                    sel = sel.concat(Object.keys(M.tree[id]));
                }
            }

            return result;
        }

        async processPuHandleFromDB(entries) {

            for (let i = entries.length; i--;) {
                const puHandleObject = entries[i];
                const nodeHandle = puHandleObject.h;

                this.cache.puHandle[nodeHandle] = puHandleObject;

                entries[i] = nodeHandle;
            }

            if ((entries = entries.filter(Boolean)).length) {

                return dbfetch.acquire(entries);
            }
        }

        processPuPageFromDB(entries) {

            for (let i = entries.length; i--;) {
                const puPageObject = entries[i];
                const puPageHandle = puPageObject.p;

                this.cache.puPage[puPageHandle] = puPageObject;
            }
        }

        getNodeHandleByPuHandle(puHandlePublicHandle) {
            if (!this.cache.puHandle) {
                return null;
            }

            const puHandleObjects = this.cache.puHandle;

            for (const key in puHandleObjects) {
                if (puHandleObjects[key]) {
                    const puHandleObject = puHandleObjects[key];

                    if (puHandleObject.ph === puHandlePublicHandle) {
                        return key;
                    }
                }
            }

            return null;
        }
    }

    class FileRequestGenerator {
        constructor() {
            this.codeTemplate = `<iframe width="%w" height="%h" frameborder="0" src="%s"></iframe>`;
            this.urlTemplate = ``;
        }

        generateCode(puPagePublicHandle, isLightTheme) {
            const width = 0;
            const height = 0;
            const theme = isLightTheme ? 'l' : 'd';
            const link = `${getBaseUrl()}/filerequest#!${puPagePublicHandle}!${theme}!${lang}`;

            return this.codeTemplate
                .replace('%w', width > 0 ? width : 250)
                .replace('%h', height > 0 ? height : 54)
                .replace('%s', link)
                .replace(`/[\\t\\n\\s]+/g`, ''); // Minimize
        }

        generateUrl(puPagePublicHandle) {
            return `${getBaseUrl()}/filerequest/${puPagePublicHandle}`;
        }

        generateUrlPreview(name, title, description, theme, pupHandle) {
            const extensionSymbol = is_extension ? '#' : '/';
            const encodedName = name ? `!n-${base64urlencode(to8(name))}` : '';
            const encodedTitle = title ? `!t-${base64urlencode(to8(title))}` : '';
            const encodedDescription = description ? `!d-${base64urlencode(to8(description))}` : '';
            const encodedTheme = theme ? `!m-${base64urlencode(to8(theme))}` : '';

            return `${getAppBaseUrl()}${extensionSymbol}` +
                `filerequest/${pupHandle || ''}${encodedName}${encodedTitle}${encodedDescription}${encodedTheme}`;
        }

        windowOpen(url) {
            // eslint-disable-next-line local-rules/open
            window.open(
                url,
                '_blank',
                'noopener,noreferrer,' +
                'width=770, height=770, resizable=no,' +
                'status=no, location=no, titlebar=no, toolbar=no'
            );
        }
    }

    class FileRequestActionHandler {
        processPublicUploadHandle(actionPacket) {
            if (window.d) {
                logger.info('Handler.processPublicUploadHandle - Handle puh', actionPacket);
            }

            const {h, ph, d} = actionPacket;

            if (d) {
                mega.fileRequest.storage.removePuHandle(h, ph);

                if (fminitialized) {
                    // @todo ideally we should not openFolder(true)
                    delay('fr:processPublicUploadHandle', refreshFileRequestPageList);
                }
            }
            else {
                mega.fileRequestCommon.storage.addPuHandle(h, ph);
            }
        }

        processUploadedPuHandles(fetchNodesResponse) {
            if (d) {
                logger.debug('[uph] processUploadedPuHandles', fetchNodesResponse);
            }

            for (let i = 0; i < fetchNodesResponse.length; ++i) {
                const {h, ph} = fetchNodesResponse[i];
                mega.fileRequestCommon.storage.addPuHandle(h, ph);
            }
        }

        processPublicUploadPage(actionPacket) {
            const state = actionPacket.s | 0;
            const doAdd = state === 2;

            if (d) {
                logger.info('Handler.processPublicUploadPage - %s pup', doAdd ? 'Add' : 'Remove', actionPacket);
            }

            assert(actionPacket && typeof actionPacket.p === 'string',
                   'processPublicUploadPage: No PUP Handle - Check this', actionPacket.ph, [actionPacket]);

            if (doAdd) {

                mega.fileRequest.storage.addPuPage(actionPacket);
            }
            else {

                mega.fileRequest.removePuPage(actionPacket);
            }
        }
    }

    /** @class mega.fileRequestCommon */
    return new class {
        constructor() {
            this.init();
        }

        init() {
            /** @class mega.fileRequestCommon.storage */
            lazy(this, 'storage', () => new FileRequestStorage);
            /** @class mega.fileRequestCommon.fileRequestApi */
            lazy(this, 'fileRequestApi', () => new FileRequestApi());
            /** @class mega.fileRequestCommon.generator */
            lazy(this, 'generator', () => new FileRequestGenerator);
            /** @class mega.fileRequestCommon.actionHandler */
            lazy(this, 'actionHandler', () => new FileRequestActionHandler());
            /** @function mega.fileRequestCommon.addFileRequestIcon */
            lazy(this, 'addFileRequestIcon', () => addFileRequestIcon);
        }
    };
});

/* eslint-disable max-classes-per-file */
lazy(mega, 'fileRequestUI', () => {
    'use strict';

    const megaInputSelector = '.mega-input';
    const megaInputWrapperSelector = '.mega-input-wrapper';
    const activeClass = 'active';
    const { generator } = mega.fileRequestCommon;

    class ReadOnlyInputComponent {
        constructor($selector) {
            this.$input = $selector;
            this.setContent(null);
            this.context = null;
        }

        update(context) {
            this.setContext(context);
            this.$input.val(this.getContent());
        }

        setContext(context) {
            this.context = context;
        }

        getContent() {
            return this.content;
        }

        setContent(content) {
            this.content = content;
        }
    }

    class EmbedCodeInputComponent extends ReadOnlyInputComponent {
        constructor($selector) {
            super($selector);

            this.puPagePublicHandle = null;
            this.lightTheme = null;
        }

        setContext(context) {
            this.puPagePublicHandle = context.puPagePublicHandle;
            this.lightTheme = context.lightTheme;

            this.setContent(
                generator
                    .generateCode(
                        this.puPagePublicHandle,
                        this.lightTheme
                    )
            );
        }
    }

    class ShareLinkInputComponent extends ReadOnlyInputComponent {
        constructor($selector) {
            super($selector);

            this.puPagePublicHandle = null;
        }

        setContext(context) {
            this.puPagePublicHandle = context.puPagePublicHandle;

            this.setContent(
                generator
                    .generateUrl(this.puPagePublicHandle)
            );
        }
    }

    class RadioComponent {
        constructor($selector, options) {
            this.$input = $selector;
            this.options = {
                events: {
                    change: nop // Placeholder
                },
                namespace: ''
            };
            this.setOptions(options);

            this.addEventHandlers();
        }

        getInput() {
            return this.$input;
        }

        setOptions(options){
            this.options = {...this.options, ...options};
        }

        addEventHandlers() {
            let namespace = this.options.namespace || '';
            if (namespace.length) {
                namespace = `.${namespace}`;
            }

            this.$input.rebind(`change${namespace}`, (evt) => {
                const inputElement = evt.target;
                const $input = $(inputElement);

                this.$input
                    .not(inputElement)
                    .addClass('radioOff')
                    .removeClass('radioOn')
                    .prop('checked', false)
                    .parent()
                    .addClass('radioOff')
                    .removeClass('radioOn'); // Clear all buttons

                $input
                    .removeClass('radioOff')
                    .addClass('radioOn')
                    .prop('checked', true);

                $input
                    .parent()
                    .addClass('radioOn')
                    .removeClass('radioOff');

                return this.options.events.change($input, this.getValue());
            });
        }

        eventOnChange(changeCallback) {
            if (typeof changeCallback !== 'function') {
                return;
            }

            this.options.events.change = changeCallback;
        }

        getValue() {
            return this.$input.filter(':checked').val() || null;
        }
    }

    class BaseClickableComponent {
        constructor($selector, options) {
            this.$input = $selector;
            this.options = {
                events: {
                    click: nop,
                },
                propagation: true,
                namespace: ''
            };

            this.action = is_mobile ? 'tap' : 'click';
            this.setOptions(options);
            this.addEventHandlers();
        }

        addEventHandlers() {
            let namespace = this.options.namespace || '';
            if (namespace.length) {
                namespace = `.${namespace}`;
            }

            const clickHandler = (evt) => {
                if (is_mobile && !this.options.doNotValidate && !validateUserAction()) {
                    return false;
                }

                const stopPropagation = typeof this.options.propagate !== 'undefined' && !this.options.propagate;
                const inputElement = evt.target;
                const $input = $(inputElement);
                const response = this.options.events.click($input);

                if (stopPropagation) {
                    return false;
                }

                return response;
            };

            if (this.options.onOff) {
                this.$input.off(`${this.action}`).on(`${this.action}`, clickHandler);
            }
            else {
                this.$input.rebind(`${this.action}${namespace}`, clickHandler);
            }

            return namespace;
        }

        setOptions(options) {
            this.options = {...this.options, ...options};
        }

        disable() {
            return this.$input
                .addClass('disabled')
                .attr('disabled', 'disabled');
        }

        enable() {
            return this.$input
                .removeClass('disabled')
                .removeAttr('disabled');
        }

        getInput() {
            return this.$input;
        }

        off() {
            this.$input.off(`.${this.options.namespace}` || null);
        }
    }

    class ButtonComponent extends BaseClickableComponent {
        eventOnClick(clickCallback) {
            if (typeof clickCallback !== 'function') {
                return;
            }

            this.options.events.click = clickCallback;
        }
    }

    class CopyButtonComponent extends ButtonComponent {
        constructor($selector, options) {
            super($selector, options);
            this.setOnClick();
        }

        setOnClick() {
            this.eventOnClick(($input) => {
                if (M.isInvalidUserStatus()) {
                    return;
                }

                const optionCallback = this.options.callback;
                if (!optionCallback) {
                    return;
                }

                if (typeof optionCallback !== 'function') {
                    return;
                }

                let copyOptions = optionCallback($input);
                if (typeof copyOptions === 'string') {
                    const outputString = copyOptions;
                    copyOptions = {
                        content: () => outputString,
                        toastText: null
                    };
                }

                if (typeof copyOptions.content === 'function') {
                    copyToClipboard(
                        copyOptions.content(),
                        this.getToastText(copyOptions.toastText),
                        copyOptions.className
                    );
                }
            });
        }

        getToastText(content) {
            if (typeof content === 'string') {
                return content;
            }

            return this.options.toastText || l[371];
        }
    }


    class PreviewButtonComponent extends ButtonComponent {
        constructor($selector, options) {
            super($selector, options);
            this.setOnClick();
        }

        setOnClick() {
            this.eventOnClick(($input) => {
                const optionCallback = this.options.callback;
                if (!optionCallback) {
                    return;
                }

                if (typeof optionCallback !== 'function') {
                    return;
                }

                const {
                    name, title, description, theme, pupHandle
                } = optionCallback($input);

                const url = generator.generateUrlPreview(
                    name,
                    title,
                    description,
                    theme,
                    pupHandle
                );

                if (url) {
                    generator
                        .windowOpen(url);
                }
            });
        }
    }

    class CloseButtonComponent extends ButtonComponent {
        constructor($selector, options) {
            super($selector, options);
            this.setOnClick();
        }

        setOnClick() {
            this.eventOnClick(() => {
                if (this.options.warning) {
                    showLoseChangesWarning().done(closeDialog);
                    return;
                }

                closeDialog();
            });
        }
    }

    class CloseMobileComponent extends ButtonComponent {
        constructor($selector, options) {

            options.doNotValidate = true;

            super($selector, options);
            this.setOnClick();
        }

        setOnClick() {
            this.eventOnClick(() => {
                this.closeDialog();
            });
        }

        closeDialog() {
            if (!this.options.$dialog) {
                return;
            }

            if (typeof this.options.post === 'function') {
                this.options.post();
            }

            this.options.$dialog.removeClass('overlay').addClass('hidden');
        }
    }

    class InputComponent extends BaseClickableComponent {
        addEventHandlers() {
            const namespace = super.addEventHandlers();

            this.$input.rebind(`input${namespace}`, (evt) => {
                const inputElement = evt.target;
                const $input = $(inputElement);
                return this.options.events.input($input);
            });
        }

        eventOnInput(inputCallback) {
            if (typeof inputCallback !== 'function') {
                return;
            }

            this.options.events.input = inputCallback;
        }

        getValue() {
            return this.$input.val();
        }

        setValue(newValue) {
            return this.$input.val(newValue);
        }

    }

    class ValidatableInputComponent extends InputComponent {
        constructor($selector, options) {
            super($selector, options);

            this.$input = $selector;
            this.$inputWrapper = this.$input.closest(this.options.selector || megaInputSelector);

            this.options.validations = Object.create(null);
            this.options.post = null;

            this.setOptions(options);
            this.eventOnInput(() => {
                this.validate();
                if (this.options.post && typeof this.options.post == 'function') {
                    this.options.post(this, this.options);
                }
            });
        }

        validate() {
            if (!this.options.validations) {
                return false;
            }

            const validationRules = this.options.validations;
            let validationPostCallback = this.options.postValidation;
            if (typeof this.options.postValidate !== 'function') {
                validationPostCallback = null;
            }

            if (validationRules.required) {
                const requiredOption = validationRules.required;
                const validationMessage = requiredOption.message;

                if (!this.getValue()) {
                    if (validationMessage) {
                        this.addErrorMessage(
                            validationMessage
                        );
                    }

                    if (validationPostCallback) {
                        validationPostCallback($input, false);
                    }

                    return false;
                }
            }

            if (validationRules.limit) {
                const limitOption = validationRules.limit;
                let validationMessage = limitOption.message;
                const maxLength = limitOption.max;
                const { formatMessage } = limitOption;

                if (formatMessage) {
                    validationMessage = mega.icu.format(validationMessage, maxLength);
                }

                if (this.getValue() && this.getValue().length > maxLength) {
                    if (validationMessage) {
                        this.addErrorMessage(
                            validationMessage
                        );
                    }

                    if (validationPostCallback) {
                        validationPostCallback($input, false);
                    }

                    return false;
                }
            }

            this.resetErrorMessage();

            if (validationPostCallback) {
                validationPostCallback($input, true);
            }
            return true;
        }

        addErrorMessage(message) {
            const $megaInputWrapper = this.$inputWrapper
                .closest(megaInputWrapperSelector);

            $megaInputWrapper.addClass('error msg');
            this.$input.addClass('errored');

            $('.message-container', $megaInputWrapper).text(message);
        }

        resetErrorMessage() {
            this.$inputWrapper
                .closest(megaInputWrapperSelector)
                .removeClass('error msg');

            this.$input.removeClass('errored');
        }

        setValue(newValue) {
            let namespace = this.options.namespace || '';
            if (namespace.length) {
                namespace = `.${namespace}`;
            }
            return this.$input
                .val(newValue)
                .trigger(`input${namespace}`);
        }

        reset() {
            this.setValue('');
            this.resetErrorMessage();
            this.getInput()
                .closest(megaInputSelector)
                .removeClass(activeClass);
        }
    }

    class ValidatableMobileComponent extends ValidatableInputComponent {
        addErrorMessage(message) {
            const $warningBlock = this.$inputWrapper
                .closest('.input-container')
                .find('.input-warning-block');

            $warningBlock.removeClass('hidden');

            $('.warning-text', $warningBlock).text(message);
        }

        resetErrorMessage() {
            this.$inputWrapper
                .closest('.input-container')
                .find('.input-warning-block')
                .addClass('hidden');
        }
    }


    class SelectFolderComponent {
        constructor($dialog) {
            this.$dialog = $dialog;

            this.$inputFolder = new InputComponent(
                $('.file-request-folder', this.$dialog)
            );

            this.$selectFolderButton =  new ButtonComponent($('.file-request-select-folder', this.$dialog));
            this.nodeHandle = null;
        }

        init() {
            this.$inputFolder.disable();
            this.$selectFolderButton.enable();
            this.$inputFolder
                .getInput()
                .removeClass('disabled')
                .closest(megaInputSelector)
                .addClass(activeClass);

            this.nodeHandle = null;
        }

        setFolder(folderName) {
            this.$inputFolder.setValue(folderName);
        }

        setNodeHandle(nodeHandle) {
            this.nodeHandle = nodeHandle;
        }

        addEventHandlers(options = false) {
            const namespace = options && options.namespace || '';
            this.$selectFolderButton.setOptions({
                namespace: namespace,
                events: {
                    click: ($input) => {
                        if ($input.is(':disabled')) {
                            return false;
                        }
                        closeDialog();

                        const {post} = options;
                        if (typeof post === 'function') {
                            openNewFileRequestDialog(this.nodeHandle).then(post).catch(dump);
                        }
                        return false;
                    }
                },
            });
        }

        off() {
            this.$selectFolderButton.off();
        }
    }

    class ClassCopyButtonComponent {
        constructor($dialog, options) {
            this.$dialog = $dialog;
            this.options = options;
            this.$copyButton = new CopyButtonComponent($('button.copy', this.$dialog));
        }

        addEventHandlers() {
            const copyOptions = this.options && this.options.copy || Object.create(null);
            const namespace = this.options && this.options.namespace || '';

            this.$copyButton.setOptions({
                namespace: namespace,
                callback: ($button) => {
                    const $inputSection  = $button.closest('.file-request-input');
                    const $input = $('.input-wrapper input', $inputSection);

                    if (!$input.length) {
                        return;
                    }

                    let option = null;
                    for (const key in copyOptions) {
                        if (copyOptions[key] && $input.hasClass(key)) {
                            option = copyOptions[key];
                            break;
                        }
                    }

                    return option;
                }
            });
        }
    }

    return {
        ReadOnlyInputComponent,
        EmbedCodeInputComponent,
        ShareLinkInputComponent,
        ButtonComponent,
        RadioComponent,
        CopyButtonComponent,
        PreviewButtonComponent,
        InputComponent,
        ValidatableInputComponent,
        SelectFolderComponent,
        ClassCopyButtonComponent,
        CloseButtonComponent,
        ValidatableMobileComponent,
        CloseMobileComponent
    };
});

/* eslint-disable max-classes-per-file */
lazy(mega, 'fileRequest', () => {
    'use strict';

    const cssMarginBottom = 'margin-bottom';
    const megaInputSelector = '.mega-input';
    const activeClass = 'active';

    const logger = MegaLogger.getLogger('FileRequest');

    const refreshFileRequestPageList = () => {
        if (fminitialized && M.currentdirid === 'file-requests') {
            M.openFolder(M.currentdirid, true);
        }
    };

    const openCreateDialogFromSelect = (selectedNodeHandle) => {
        if (selectedNodeHandle) {
            mega.fileRequest.dialogs.createDialog.init(selectedNodeHandle);
        }
    };

    const openNewDialogHandler = () => {
        openNewFileRequestDialog()
            .then(openCreateDialogFromSelect)
            .catch(dump);
        return false;
    };

    class BaseDialog {
        setShareLink() {
            if (!this.$shareLink) {
                return;
            }

            this.$shareLink.update({
                puPagePublicHandle: this.puPagePublicHandle
            });
        }
    }
    class CommonDialog extends BaseDialog {
        constructor() {
            super();

            // Fixed properties
            this.namespace = 'fr';

            // Changeable properties
            this.dialogClass = null;
            this.dialogTitle = null;
            this.dialogCaption = null;
            this.selectFolder = false;
            this.closeWarning = false;
            this.close = null;
            this.closePositive = false;
            this.sectionPrimary = false;
            this.sectionSecondary = false;
            this.save = null;
            this.savePositive = false;

            this.previewButtonPrimary = false;
            this.previewButtonFooter = false;

            this.stop = false;
            this.puPagePublicHandle = null;

            this.$dialog = $('.file-request', document.body);
            this.dialogClassBackup = this.$dialog.prop('class');

            this.$sectionDivider = $('.divider', this.$dialog);
            this.$sectionPrimary = $('.content-block.primary', this.$dialog);
            this.$sectionSecondary = $('.content-block.secondary', this.$dialog);
            this.$scrollableContent = $('.content .scrollable', this.$dialog);

            // Header
            this.$headerTitle = $('header .dialog-title', this.$dialog);
            this.$headerCaption = $('header .dialog-caption', this.$dialog);

            // Primary
            this.$selectFolderContainer = $('.form-row.select-folder', this.$sectionPrimary);
            this.$selectFolder = new mega.fileRequestUI.SelectFolderComponent(this.$dialog);

            this.$previewButtonContainer = $('.footer-container.preview', this.$sectionPrimary);
            this.$previewButtonFooter = new mega.fileRequestUI.PreviewButtonComponent(
                $('footer .file-request-preview-button', this.$dialog)
            );
            this.$previewButtons = new mega.fileRequestUI.PreviewButtonComponent(
                $('.file-request-preview-button', this.$dialog)
            );

            this.$inputTitle = new mega.fileRequestUI.ValidatableInputComponent(
                $('.file-request-title', this.$sectionPrimary), {
                    validations: {
                        limit: {
                            max: 80,
                            message: l.file_request_dialog_label_title_invalid
                        },
                        postValidation: ($input, result) => {
                            const $formRow = $input.closest('.form-row');
                            if ($formRow.length) {
                                if (result) {
                                    $formRow.css(cssMarginBottom, '0');
                                    return;
                                }
                                $formRow.css(cssMarginBottom, '');
                            }
                        }
                    },
                    namespace: this.namespace
                }
            );

            this.$inputDescription = new mega.fileRequestUI.ValidatableInputComponent(
                $('.file-request-description', this.$sectionPrimary), {
                    validations: {
                        limit: {
                            max: 500,
                            message: l.file_request_dialog_label_desc_invalid,
                            formatMessage: true
                        },
                    },
                    namespace: this.namespace
                }
            );

            // Secondary
            this.themeButtonSelector = '.embed-button-theme-input';
            this.$themeButton = new mega.fileRequestUI.RadioComponent(
                $(this.themeButtonSelector, this.$dialog), { namespace: 'frm' }
            );
            this.themeButtonWrapper = '.embed-button-select';
            this.$themeButtonWrapper = new mega.fileRequestUI.ButtonComponent(
                $(this.themeButtonWrapper, this.$dialog), { namespace: 'frm' }
            );

            this.$embedCode = new mega.fileRequestUI.EmbedCodeInputComponent(
                $('.file-request-embed-code', this.$dialog)
            );
            this.$shareLink = new mega.fileRequestUI.ShareLinkInputComponent(
                $('.file-request-share-link', this.$dialog)
            );
            this.$copyButton = new mega.fileRequestUI.ClassCopyButtonComponent(this.$dialog, {
                copy: {
                    'file-request-embed-code': {
                        content: () => {
                            console.log('content this', this);
                            return this.$embedCode.getContent();
                        },
                        toastText: l.file_request_action_copy_code,
                        className: 'clipboard-embed-code'
                    },
                    'file-request-share-link': {
                        content: () => {
                            console.log('content this share', this);
                            return this.$shareLink.getContent();
                        },
                        toastText: l.file_request_action_copy_link
                    },
                },
                namespace: this.namespace
            });

            // Footer
            this.$removeButton = new mega.fileRequestUI.ButtonComponent($('.file-request-remove-button', this.$dialog));
            this.$saveButton = new mega.fileRequestUI.ButtonComponent($('.file-request-save-button', this.$dialog));
            this.$closeButton = new mega.fileRequestUI.CloseButtonComponent(
                $('button.close, .file-request-close-button', this.$dialog),
                {
                    warning: this.closeWarning
                }
            );
            this.$closeButtonFooter = $('.file-request-close-button', this.$dialog);

            // Handler section
            // Primary
            this.$selectFolder.addEventHandlers({
                namespace: this.namespace,
                post: openCreateDialogFromSelect
            });

            const titleDescInputPostCallback = function(selfObject, options) {
                const $formRow = selfObject.getInput().closest('.form-row');
                const $charCount = $('.char-count', $formRow);
                const limit = options &&
                    options.validations &&
                    options.validations.limit ||
                    0;

                if (selfObject.getValue()) {
                    if ($charCount.length && limit && limit.max) {
                        const charLength = selfObject.getValue().length;
                        $charCount.text(`(${charLength}/${limit.max})`);
                    }

                    selfObject
                        .getInput()
                        .closest(megaInputSelector)
                        .addClass(activeClass);
                    return;
                }

                $charCount.text(``);
                selfObject
                    .getInput()
                    .closest(megaInputSelector)
                    .removeClass(activeClass);
            };

            this.$inputTitle.setOptions({
                post: titleDescInputPostCallback
            });

            this.$inputDescription.setOptions({
                post: titleDescInputPostCallback
            });

            // Secondary
            this.$previewButtons.setOptions({
                namespace: this.namespace,
                callback: () => {
                    const title = this.$inputTitle.getValue();
                    const description = this.$inputDescription.getValue();

                    return {
                        name: u_attr.name,
                        title,
                        description,
                        theme: u_attr && u_attr['^!webtheme'] !== undefined ? u_attr['^!webtheme'] : '',
                        pupHandle: this.puPagePublicHandle || null
                    };
                }
            });

            this.$themeButton.eventOnChange(($input) => {
                this.setEmbedCode();
                this.$themeButton.getInput().closest('.embed-block').removeClass(activeClass);
                $input.closest('.embed-block').addClass(activeClass);
                return false;
            });

            this.$themeButtonWrapper.eventOnClick(($input) => {
                if ($input.is(this.themeButtonSelector)) {
                    return;
                }

                let $parentElement = $input;
                if ($input.not(this.themeButtonWrapper)) {
                    $parentElement = $input.parent();
                }

                $(this.themeButtonSelector, $parentElement).trigger('click');
                return false;
            });

            this.$copyButton.addEventHandlers();
        }

        reset() {
            this.dialogClass = null;
            this.dialogTitle = null;
            this.dialogCaption = null;
            this.selectFolder = false;
            this.closeWarning = false;
            this.close = null;
            this.closePositive = false;
            this.sectionPrimary = false;
            this.sectionSecondary = false;

            this.save = null;
            this.savePositive = false;

            this.preview = false;
            this.previewButtonPrimary = false;
            this.previewButtonFooter = false;

            this.stop = false;
            this.puPagePublicHandle = null;

            // Reset section header
            this.$dialog.prop('class', this.dialogClassBackup);
            this.$headerTitle.text('');
            this.$headerCaption.text('').addClass('hidden');

            // Reset section primary
            this.$sectionPrimary.addClass('hidden');
            this.$selectFolderContainer.addClass('hidden');
            this.$selectFolder.init();
            this.$inputTitle.reset();
            this.$inputDescription.reset();
            this.$previewButtonContainer.addClass('hidden');

            // Reset Divider
            this.$sectionDivider.addClass('hidden');

            // Reset section
            this.$sectionSecondary.addClass('hidden');

            // Footer
            this.$previewButtonFooter.getInput().addClass('hidden');
            this.$removeButton.getInput().addClass('hidden');
            this.$closeButtonFooter.addClass('hidden').removeClass('positive');
            this.$saveButton.getInput().addClass('hidden').removeClass('positive');

            // dialog
            this.$dialog.off('dialog-closed');
        }

        initScrollbar(options) {
            initPerfectScrollbar(this.$scrollableContent, options || {});
            this.triggerClickOnRail(this.$scrollableContent);
        }

        init() {
            this.setDialogHeader();

            if (this.sectionPrimary) {
                this.setSectionPrimary();
            }

            if (this.sectionDivider) {
                this.$sectionDivider.removeClass('hidden');
            }

            if (this.sectionSecondary) {
                this.setSectionSecondary();
            }

            this.setFooter();
        }

        setFooter() {
            if (this.previewButtonFooter) {
                this.$previewButtonFooter.getInput().removeClass('hidden');
            }

            if (this.close) {
                this.$closeButtonFooter.removeClass('hidden');
                if (this.closePositive) {
                    this.$closeButtonFooter.addClass('positive');
                }
                $('span', this.$closeButtonFooter).text(this.close);

                this.$closeButton.setOptions({
                    warning: this.closeWarning
                });
            }

            if (this.save) {
                const $saveButton = this.$saveButton.getInput();
                $saveButton.removeClass('hidden');
                if (this.savePositive) {
                    $saveButton.addClass('positive');
                }
                $('span', $saveButton).text(this.save);
            }

            if (this.stop) {
                this.$removeButton.getInput().removeClass('hidden');
            }
        }

        setSectionPrimary() {
            this.$sectionPrimary.removeClass('hidden');

            if (this.selectFolder) {
                this.$selectFolderContainer.removeClass('hidden');
            }

            if (this.previewButtonPrimary) {
                this.$previewButtonContainer.removeClass('hidden');
            }
        }

        setSectionSecondary() {
            this.$sectionSecondary.removeClass('hidden');
        }

        setDialogHeader() {
            if (this.dialogClass) {
                this.$dialog.addClass(this.dialogClass);
            }
            if (this.dialogTitle) {
                this.$headerTitle.text(this.dialogTitle);
            }
            if (this.dialogCaption) {
                this.$headerCaption.text(this.dialogCaption).removeClass('hidden');
            }
        }

        isLightTheme() {
            if (!this.$themeButton) {
                return true;
            }

            const selectedValue = this.$themeButton.getValue();

            if (!selectedValue) {
                return true;
            }

            return selectedValue === "0";
        }

        setEmbedCode() {
            if (!this.$embedCode) {
                return;
            }

            this.$embedCode.update({
                puPagePublicHandle: this.puPagePublicHandle,
                lightTheme: this.isLightTheme()
            });
        }

        triggerClickOnRail($scrollableContent) {
            onIdle(() => {
                if (!$scrollableContent) {
                    return;
                }

                const $scrollableYRail = $('.ps__rail-y', $scrollableContent);
                if ($scrollableYRail.length) {
                    $('.ps__rail-y', $scrollableContent).trigger('click');
                    $scrollableContent.scrollTop(0);
                }
            });
        }
    }

    // Dialogs start
    class CreateDialog {
        constructor() {
            this.commonDialog = mega.fileRequest.commonDialog;
            this.context = null;
            this.fileObject = null;
            this.fileHandle = null;
            this.folderName = null;
        }

        init(selectedHandle) {
            // Reset fields
            this.commonDialog.reset();
            this.setDialog();
            this.commonDialog.init();
            this.addEventHandlers();

            // Reset error messages
            this.setContext({
                nodeHandle: selectedHandle
            });

            this.fileObject = M.d[selectedHandle];
            this.fileHandle = selectedHandle;
            this.folderName = this.fileObject && this.fileObject.name || null;
            if (this.folderName) {
                this.commonDialog.$selectFolder.setFolder(this.folderName);
                this.commonDialog.$selectFolder.setNodeHandle(selectedHandle);
            }

            M.safeShowDialog('file-request-create-dialog', this.commonDialog.$dialog);
            this.commonDialog.initScrollbar();
        }

        setContext(context) {
            this.context = context;
        }

        setDialog() {
            this.commonDialog.dialogClass = 'file-request-create-dialog';
            this.commonDialog.dialogTitle = l.file_request_dialog_create_title;
            this.commonDialog.dialogCaption = l.file_request_dialog_create_desc;
            this.commonDialog.closeWarning = true;
            this.commonDialog.selectFolder = true;
            this.commonDialog.sectionPrimary = true;
            this.commonDialog.close = l[82];
            this.commonDialog.save = l[158];
            this.commonDialog.savePositive = true;
            this.commonDialog.preview = true;
            this.commonDialog.previewButtonFooter = true;
        }

        addEventHandlers() {
            this.commonDialog.$saveButton.eventOnClick(() => {
                if (!this.commonDialog.$inputTitle.validate()) {
                    return;
                }

                if (!this.commonDialog.$inputDescription.validate()) {
                    return;
                }

                closeDialog();

                const title = this.commonDialog.$inputTitle.getValue();
                const description = this.commonDialog.$inputDescription.getValue();

                mega.fileRequest.create(this.context.nodeHandle, title, description).catch(dump);
            });
        }

        checkLoseChangesWarning() {
            if (this.commonDialog.$inputTitle.getValue().length ||
                this.commonDialog.$inputDescription.getValue().length) {
                return true;
            }
        }
    }

    class CreateSuccessDialog {
        constructor() {
            this.commonDialog = mega.fileRequest.commonDialog;
            this.context = null;
            this.puHandleObject = null;
            this.puPagePublicHandle = null;
        }

        init(context) {
            if (context) {
                this.setContext(context);
            }
            loadingDialog.hide();

            this.puHandleObject = mega.fileRequest.storage.getPuHandleByPublicHandle(context.ph);
            if (!this.puHandleObject) {
                if (d) {
                    logger.info('CreateSuccessDialog.init - No puHandleObject found', context);
                }
                return;
            }

            if (d) {
                logger.info('CreateSuccessDialog.init - puHandleObject found', this.puHandleObject);
            }

            this.puPagePublicHandle = this.puHandleObject.p;

            // Reset fields
            this.commonDialog.reset();
            this.setDialog();
            this.commonDialog.init();

            M.safeShowDialog('file-request-create-success-dialog', () => {
                this.commonDialog.setShareLink();
                this.commonDialog.setEmbedCode();
                this.commonDialog.initScrollbar({
                    scrollYMarginOffset: 20
                });

                this.commonDialog.$dialog.rebind('dialog-closed', () => {
                    this.commonDialog.$dialog.off('dialog-closed');
                    mega.fileRequest.storage.removePuMessage(context.ph);
                });

                return this.commonDialog.$dialog;
            });
        }

        setContext(context) {
            this.context = context;
        }

        setDialog() {
            this.commonDialog.dialogClass = 'file-request-create-success-dialog';
            this.commonDialog.dialogTitle = l.file_request_dialog_create_success_title;
            this.commonDialog.dialogCaption = l.file_request_dialog_create_success_desc;
            this.commonDialog.sectionSecondary = true;
            this.commonDialog.close = l[81];
            this.commonDialog.closePositive = true;
            this.commonDialog.puPagePublicHandle = this.puPagePublicHandle;
        }
    }

    class ManageDialog {
        constructor() {
            this.context = null;
            this.puHandleObject = null;
            this.puPagePublicHandle = null;
            this.commonDialog = mega.fileRequest.commonDialog;
        }

        init(context) {
            if (context) {
                this.setContext(context);
            }
            loadingDialog.hide();

            this.puHandleObject = mega.fileRequest.storage.getPuHandleByNodeHandle(context.h);
            if (!this.puHandleObject) {
                if (d) {
                    logger.info('ManageDialog.init - No puHandleObject found', context);
                }
                return;
            }

            if (d) {
                logger.info('ManageDialog.init - puHandleObject found', this.puHandleObject);
            }
            this.puPagePublicHandle = this.puHandleObject.p;

            M.safeShowDialog('file-request-manage-dialog', () => {
                eventlog(99774);

                // Reset fields
                this.commonDialog.reset();
                this.setDialog();
                this.commonDialog.init();
                this.addEventHandlers();

                this.commonDialog.setShareLink();
                this.commonDialog.setEmbedCode();

                // Reset fields
                const puHandleObjectData = this.puHandleObject.d;
                if (puHandleObjectData) {
                    this.commonDialog.$inputTitle.setValue(puHandleObjectData.t);
                    this.commonDialog.$inputDescription.setValue(puHandleObjectData.d);
                }
                else {
                    const message = this.puHandleObject.fn || '';
                    this.commonDialog.$inputTitle.setValue(message);
                    this.commonDialog.$inputDescription.setValue('');
                }

                this.commonDialog.initScrollbar();
                return this.commonDialog.$dialog;
            });
        }

        setDialog() {
            this.commonDialog.dialogClass = 'file-request-manage-dialog';
            this.commonDialog.dialogTitle = l.file_request_dialog_manage_title;

            this.commonDialog.closeWarning = true;
            this.commonDialog.sectionPrimary = true;
            this.commonDialog.close = l[82];
            this.commonDialog.save = l.msg_dlg_save;
            this.commonDialog.savePositive = true;
            this.commonDialog.preview = true;
            this.commonDialog.previewButtonPrimary = true;
            this.commonDialog.stop = true;

            this.commonDialog.sectionDivider = true;

            this.commonDialog.sectionSecondary = true;
            this.commonDialog.puPagePublicHandle = this.puPagePublicHandle;
        }

        setContext(context) {
            this.context = context;
        }

        addEventHandlers() {
            this.commonDialog.$saveButton.eventOnClick(async() => {
                if (!this.commonDialog.$inputTitle.validate()) {
                    return;
                }

                if (!this.commonDialog.$inputDescription.validate()) {
                    return;
                }

                this.commonDialog.$saveButton.disable();
                await mega.fileRequest.update(
                    this.puHandleObject.h,
                    this.commonDialog.$inputTitle.getValue(),
                    this.commonDialog.$inputDescription.getValue()
                );
                this.commonDialog.$saveButton.enable();

                closeDialog();
            });

            this.commonDialog.$removeButton.eventOnClick(() => {
                const title = l.file_request_dropdown_remove;
                const message = l.file_request_action_remove_prompt_title;
                const description = l.file_request_action_remove_prompt_desc;

                const removeDialogCallback = (res) => {
                    if (!res) {
                        return;
                    }
                    this.commonDialog.$removeButton.disable();

                    mega.fileRequest.remove(this.puHandleObject.h)
                        .catch(dump)
                        .finally(() => {
                            closeDialog();
                            this.commonDialog.$removeButton.enable();
                            showToast('warning2', l.file_request_action_remove);
                            selectionManager.clear_selection();
                        });
                };

                msgDialog(
                    `confirmation:!^${l.file_request_action_remove_prompt_button}!${l[82]}`,
                    title,
                    message,
                    description,
                    removeDialogCallback,
                    1
                );
            });
        }

        checkLoseChangesWarning() {
            let title = '';
            let description = '';

            const puHandleObjectData = this.puHandleObject.d;
            if (puHandleObjectData) {
                title = puHandleObjectData.t;
                description = puHandleObjectData.d;
            }
            else {
                const message = this.puHandleObject.fn || '';
                title = message;
                description = '';
            }

            if (this.commonDialog.$inputTitle.getValue() !== title ||
                this.commonDialog.$inputDescription.getValue() !== description) {
                return true;
            }
        }
    }

    class FileRequestContextMenu {
        constructor() {
            this.$contextMenu = null;
            this.$createButton = null;
            this.$manageButton = null;
            this.$copyLinkButton = null;
            this.$removeButton = null;

            this.$contextMenu = $('.dropdown.body.context', document.body);
            this.$createButton = new mega.fileRequestUI.ButtonComponent(
                $('.dropdown-item.file-request-create', this.$contextMenu), {
                    namespace: 'frcm'
                }
            );
            this.$manageButton = new mega.fileRequestUI.ButtonComponent(
                $('.dropdown-item.file-request-manage', this.$contextMenu), {
                    namespace: 'frcm'
                }
            );

            this.$copyLinkButton = new mega.fileRequestUI.CopyButtonComponent(
                $('.dropdown-item.file-request-copy-link', this.$contextMenu), {
                    namespace: 'frcm',
                    toastText: l.file_request_action_copy_link
                }
            );

            this.$removeButton = new mega.fileRequestUI.ButtonComponent(
                $('.dropdown-item.file-request-remove', this.$contextMenu), {
                    namespace: 'frcm'
                }
            );

            this.addEventHandlers();
        }

        addEventHandlers() {
            if (d > 1) {
                logger.info(
                    '#file-request #context-menu - Add Folder context menu event handlers',
                    this.$createButton.length
                );
            }

            this.$createButton.eventOnClick(() => {
                if (M.isInvalidUserStatus()) {
                    return;
                }

                const selectedNodeHandle = $.selected[0];
                mega.fileRequest.dialogs.createDialog.init(selectedNodeHandle);
            });

            this.$manageButton.eventOnClick(() => {
                if (M.isInvalidUserStatus()) {
                    return;
                }

                const selectedNodeHandle = $.selected[0];
                mega.fileRequest.dialogs.manageDialog.init({
                    h: selectedNodeHandle
                });
            });

            this.$copyLinkButton.setOptions({
                callback: () => {
                    const selectedNodeHandle = $.selected[0];
                    const puPagePublicHandle = mega.fileRequest
                        .storage
                        .getPuHandleByNodeHandle(selectedNodeHandle);

                    if (puPagePublicHandle) {
                        return mega.fileRequest
                            .generator
                            .generateUrl(puPagePublicHandle.p);
                    }

                    return null;
                }
            });

            const showRemoveDialog = (selectedNodeHandle, title, message, description) => {
                const type = `confirmation:!^${l.file_request_action_remove_prompt_button}!${l[82]}`;

                const _remove = () => {
                    mLoadingSpinner.show('puf-remove');

                    mega.fileRequest.remove(selectedNodeHandle, true)
                        .catch((ex) => {
                            if (ex !== ENOENT) {
                                logger.error(ex);
                                return;
                            }

                            onIdle(refreshFileRequestPageList);
                            return mega.fileRequest.storage.removePuPageByNodeHandle(selectedNodeHandle);
                        })
                        .finally(() => {
                            mLoadingSpinner.hide('puf-remove');
                        });

                    selectionManager.clear_selection();
                    showToast('warning2', l.file_request_action_remove);
                };

                msgDialog(type, title, message, description, (res) => res && _remove(), 1);
            };

            this.$removeButton.eventOnClick(() => {
                if (M.isInvalidUserStatus()) {
                    return;
                }

                const selectedNodeHandle = $.selected[0];
                if (!selectedNodeHandle) {
                    return;
                }

                const title = l.file_request_dropdown_remove;
                const message = l.file_request_action_remove_prompt_title;
                const description = l.file_request_action_remove_prompt_desc;

                showRemoveDialog(selectedNodeHandle, title, message, description);
            });
        }
    }

    /** @class mega.fileRequest */
    return new class FileRequest {
        constructor() {
            this.contextMenu = new FileRequestContextMenu();

            lazy(this, 'actionHandler', () => mega.fileRequestCommon.actionHandler);
            lazy(this, 'storage', () => mega.fileRequestCommon.storage);
            lazy(this, 'fileRequestApi', () => mega.fileRequestCommon.fileRequestApi);
            lazy(this, 'generator', () => mega.fileRequestCommon.generator);

            this.dialogs = {};

            lazy(this, 'commonDialog', () => new CommonDialog);
            lazy(this.dialogs, 'createDialog', () => new CreateDialog);
            lazy(this.dialogs, 'createSuccessDialog', () => new CreateSuccessDialog);
            lazy(this.dialogs, 'manageDialog', () => new ManageDialog);
        }

        async create(handle, title, description) {
            let puHandleObject = this.storage.getPuHandleByNodeHandle(handle);

            if (!puHandleObject) {

                puHandleObject = await this.fileRequestApi.create(handle, title, description)
                    .then((res) => {
                        const {pkt: {pup: {p}}, result: [ph, puf]} = res;
                        const c = this.storage.getPuHandleByNodeHandle(handle);

                        assert(c && c.p === p && c.ph === ph && c.p === puf, 'Invalid API response.', res, [c]);

                        onIdle(refreshFileRequestPageList);
                        this.storage.updatePuPage(c.p, title, description);
                        this.storage.updatePuHandle(c.h, title, description);

                        return c;
                    });
            }

            if (is_mobile) {
                eventlog(99834);
                mobile.fileRequestManagement.showFRUpdatedSheet(false);
            }
            else {
                mega.fileRequest.dialogs.createSuccessDialog.init({...puHandleObject});
            }
        }

        async update(handle, title, description) {
            const puHandleObject = this.storage.getPuHandleByNodeHandle(handle);

            if (!puHandleObject || puHandleObject && !puHandleObject.p) {
                return;
            }

            loadingDialog.show(); // Show dialog
            await this.fileRequestApi
                .update(puHandleObject.p, title, description)
                .catch(dump);

            this.storage.updatePuHandle(handle, title, description);
            this.storage.updatePuPage(puHandleObject.p, title, description);

            if (is_mobile) {
                mobile.fileRequestManagement.showFRUpdatedSheet(true);
            }

            loadingDialog.hide();
        }

        publicFolderExists(h, p = false) {
            const e = this.storage.cache.puHandle[h];

            return e && e.s !== 1 && (!p || e.p);
        }

        async removeList(handles, quiet) {
            if (typeof handles === 'string') {
                handles = [handles];
            }

            if (!Array.isArray(handles)) {
                handles = [];
            }

            if (handles.length && !quiet) {
                loadingDialog.pshow();
            }

            const promises = [];
            for (let index = handles.length; index--;) {
                const puHandleNodeHandle = handles[index];
                const puHandleObject = this.storage.getPuHandleByNodeHandle(puHandleNodeHandle);

                if (!puHandleObject) {
                    logger.warn(`Public Handle Object not found for Node: ${puHandleNodeHandle}`);
                }
                promises.push(this.fileRequestApi.remove(puHandleNodeHandle));
            }

            return Promise.allSettled(promises).finally(() => !quiet && loadingDialog.phide());
        }

        async remove(handle, quiet) {
            const puHandleObject = this.storage.getPuHandleByNodeHandle(handle);

            if (!puHandleObject) {
                return;
            }

            if (!quiet) {
                loadingDialog.show(); // Show dialog
            }

            return this.fileRequestApi.remove(handle)
                .finally(() => {
                    if (!quiet) {
                        loadingDialog.hide();
                    }
                });
        }

        removePuPage(publicUploadPage) {

            return this.storage.removePuPage(publicUploadPage.p, publicUploadPage.ph);
        }

        processPuPageFromDB(dbData) {
            return this.storage.processPuPageFromDB(dbData);
        }

        processPuHandleFromDB(dbData) {
            return this.storage.processPuHandleFromDB(dbData);
        }

        async getPuPage(puPageId, puHandleId) {

            return this.fileRequestApi.getPuPage(puPageId)
                .then(({result: puPage}) => {
                    this.storage.addPuPage(puPage);

                    const currentPuPage = this.storage.getPuPageByPageId(puPage.p);
                    if (currentPuPage && puPage.d) {
                        this.storage.updatePuHandle(currentPuPage.h, puPage.d.msg, puPage.d.description);
                    }

                    return puPage;
                })
                .catch((ex) => {
                    if (ex === ENOENT) {
                        this.storage.removePuPage(puPageId, puHandleId);

                        if (d) {
                            logger.warn('getPuPage(%s) Not found.', puPageId, puHandleId, ex);
                        }
                        return;
                    }

                    throw ex;
                });
        }

        async refreshPuPageList() {
            const promises = [];
            const {result: puPageList} = await this.fileRequestApi.getPuPageList();

            for (let index = puPageList.length; index--;) {
                const puPageId = puPageList[index].p;
                const puHandleId = puPageList[index].ph;
                const puHandleState = puPageList[index].s;

                if (!puPageId) {
                    if (d) {
                        logger.error(
                            'FileRequest.refreshPuPageList - Abnormal state - no puPageId',
                            puPageList[index]
                        );
                    }

                    continue;
                }

                // Lets check puHandle
                const nodeHandle = this.storage.getNodeHandleByPuHandle(puHandleId);
                if (nodeHandle) {
                    this.storage.saveOrUpdatePuHandle(
                        {
                            nodeHandle,
                            state: puHandleState,
                            publicHandle: puHandleId,
                            pagePublicHandle: puPageId
                        }
                    );

                    promises.push(this.getPuPage(puPageId, puHandleId));
                }
                else {
                    this.storage.removePuHandle(null, puHandleId);
                }
            }

            return Promise.all(promises);
        }

        async processUploadedPuHandles(fetchNodesResponse) {
            this.actionHandler.processUploadedPuHandles(fetchNodesResponse);
            return this.refreshPuPageList();
        }

        getPuHandleList() {
            return this.storage.getPuHandleList();
        }

        rebindListManageIcon(options) {
            const iconHandler = options && options.iconHandler || null;
            if (!iconHandler) {
                return;
            }

            $('.grid-scrolling-table .grid-file-request-manage', document)
                .rebind('click.frlm', function(ev) {
                    return iconHandler.call(this, true, 'tr', ev, {
                        post: (selected) => {
                            if (M.isInvalidUserStatus()) {
                                return;
                            }

                            mega.fileRequest.dialogs.manageDialog.init({
                                h: selected
                            });
                        }
                    });
                });
        }

        rebindTopMenuCreateIcon() {
            $('.fm-header-buttons .fm-new-file-request', document)
                .rebind('click.frtmc', openNewDialogHandler);
        }

        rebindPageEmptyCreateButton() {
            $('.fm-empty-file-requests .fm-new-file-request', document)
                .rebind('click.frpec', openNewDialogHandler);
        }

        showRemoveWarning(list) {
            return new Promise((resolve, reject) => {
                const fldName = list.length > 1
                    ? l[17626]
                    : l[17403].replace('%1', escapeHTML(M.d[list[0]].name));

                const ack = () => {
                    onIdle(closeDialog);
                    mega.fileRequest.removeList(list).always(dump).finally(resolve);
                };

                msgDialog('confirmation', l[1003], fldName, l[18229], (result) => {
                    if (result) {
                        return ack();
                    }
                    reject(EBLOCKED);
                });
            });
        }

        /**
         * Make sure that user knows that FileRequest wiil be cancelled if any
         * full shares or public links are available for target
         * @param {Array} handles Array of nodes id which will be moved
         * @param {String} target Target node
         *
         * @returns {Promise} returns premove check promise
         */
        async preMoveCheck(handles, target) {
            const list = [];
            const selected = Array.isArray(handles) ? handles : [handles];

            // Is there any FileRequest active for given handles?
            // Count for precise dlg message, will loop to the
            // end in case there is not FileRequest or if only 1 found
            for (let i = selected.length; i--;) {
                list.push(...mega.fileRequestCommon.storage.isDropExist(selected[i]));
            }

            if (list.length) {
                const isShared = await shared(target) || new mega.Share({}).isShareExist([target], false, true);

                if (isShared) {
                    await this.showRemoveWarning(list);
                }
            }

            return [selected, target];
        }

        /**
         * Update PUH data
         * @param {String} id Node id
         * @param {String} type 'msg' folder name, 'name' full name, 'email' email
         * @param {String} value
         *
         * @returns {Promise} update result
         */
        async updatePuHandleAttribute(nodeHandle, type, value) {
            if (!fminitialized) {
                return false;
            }

            const puHandleObject = this.storage.getPuHandleByNodeHandle(nodeHandle);
            if (!puHandleObject || type === 'msg' && value === puHandleObject.fn) {
                return false;
            }

            let name = u_attr.name;
            const puPageObject = this.storage.getPuPageByPageId(puHandleObject.p);
            if (puPageObject) {
                name = puPageObject.name;
            }

            let { t: msg, d: description } = puHandleObject.d;

            switch (type) {
                case 'name':
                    name = value;
                    break;
                case 'msg':
                    msg = value;
                    break;
                case 'description':
                    description = value;
                    break;
            }

            await this.fileRequestApi
                .update(
                    puHandleObject.p,
                    msg,
                    description,
                    name
                )
                .catch((ex) => {
                    dump(ex);
                    msgDialog('warninga', l[135], l[47], api_strerror(ex));
                });
        }

        async onRename(nodeHandle, newName) {
            const puHandleObject = this.storage.cache.puHandle[nodeHandle];
            if (!puHandleObject) {
                return false;
            }

            this.updatePuHandleAttribute(nodeHandle, 'msg', newName);

            this.storage.updatePuHandleFolderName(nodeHandle, newName);
            this.storage.updatePuPageFolderName(puHandleObject.p, newName);
        }

        async onUpdateUserName(newName) {
            const puHandleObjects = this.storage.cache.puHandle;
            if (!Object.keys(puHandleObjects).length) {
                return false;
            }

            for (const key in puHandleObjects) {
                if (Object.hasOwnProperty.call(puHandleObjects, key)) {
                    const puHandle = puHandleObjects[key];
                    if (puHandle.p) {
                        this.updatePuHandleAttribute(puHandle.h, 'name', newName);
                    }
                }
            }

            return true;
        }
    };
});

/**
 * Gets the sprite name for current webClient.
 *
 * @return {String} Sprite name
 */
lazy(mega.ui, 'sprites', () => {
    'use strict';

    const res = Object.create(null);

    res.mono = `sprite-${is_mobile ? 'mobile-' : ''}fm-mono`;
    res.theme = `sprite-${is_mobile ? 'mobile-' : ''}fm-theme`;
    res.uni = `sprite-${is_mobile ? 'mobile-' : ''}fm-uni`;

    return freeze(res);
});

// Global theme functions
(function(scope) {
    'use strict';

    // the MediaQueryList relating to the system theme
    let query = null;

    /**
     * Sets the theme class on the body
     *
     * @param {*} theme - the name of the theme class
     * @return {undefined}
     */
    const setBodyClass = function(theme) {
        const themeClass = 'theme-' + theme;
        if (!document.body.classList.contains(themeClass)) {
            document.body.classList.remove('theme-dark', 'theme-light');
            document.body.classList.add('theme-' + theme);
        }
    };

    /**
     * The event listener, used for add/remove operations
     *
     * @param {object} e - the event object
     * @return {undefined}
     */
    const listener = function(e) {
        if (
            !(
                (page.substr(0, 2) === 'P!' && page.length > 2)
                || page.substr(0, 5) === 'chat/'
                || is_chatlink
                || (is_fm() && page.substr(0, 5) !== 'start')
                || page === 'download'
                || page.substr(0, 11) === 'filerequest'
            )
        ) {
            return;
        }
        if (e.matches) {
            setBodyClass('dark');
        }
        else {
            setBodyClass('light');
        }
    };

    /**
     * Set based on the matching system theme.
     * @returns {void}
     */
    const setByMediaQuery = () => {
        query = window.matchMedia('(prefers-color-scheme: dark)');

        if (query.addEventListener) {
            query.addEventListener('change', listener);
        }
        else if (query.addListener) { // old Safari
            query.addListener(listener);
        }

        if (query.matches) {
            setBodyClass('dark');
        }
        else {
            setBodyClass('light');
        }
    };


    /**
     * Check if the dark mode theme is currently applied
     *
     * @returns {boolean} If the dark theme is applied
     */
    mega.ui.isDarkTheme = () => {
        const {classList} = document.body;
        return classList.contains('theme-dark') || classList.contains('theme-dark-forced');
    };


    /**
     * Sets the current theme, by value.
     * Does not store the change to localStorage, purely presentational.
     *
     * @param {*} [value] the value of the theme to set [0/"0":  follow system, 1/"1": light, 2/"2": dark]
     * @return {undefined}
     */
    mega.ui.setTheme = (value) => {
        if (query) {
            if (query.removeEventListener) {
                query.removeEventListener('change', listener);
            }
            else if (query.removeListener) { // old Safari
                query.removeListener(listener);
            }
        }

        if (value === undefined) {
            value = (window.u_attr && u_attr['^!webtheme'] || fmconfig.webtheme) | 0;
        }
        else {
            value = Math.max(0, value | 0);

            if (value < 3 && window.u_attr) {
                u_attr['^!webtheme'] = String(value);
            }
        }

        if (value === 2) {
            setBodyClass('dark');
        }
        else if (value !== 1 && window.matchMedia) {
            setByMediaQuery();
        }
        else {
            // if the browser doesn't support matching the system theme, set light mode
            setBodyClass('light');
        }
    };
})(window);

(function(scope, $) {
    var PUSH = Array.prototype.push;

    if (typeof lazy === 'undefined') lazy = function(a,b,c) { a[b] = c.call(a); }
    if (typeof delay === 'undefined') delay = function(a,b) { b() }
    if (typeof SoonFc === 'undefined') SoonFc = function(a,b) { return b }

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




    var MEGALIST_DEFAULTS = {
        /**
         * Static, fixed width of the item when rendered (incl margin, padding, etc)
         */
        'itemWidth': false,

        /**
         * Static, fixed height of the item when rendered (incl margin, padding, etc)
         */
        'itemHeight': false,

        /**
         * Static, fixed height of the header if exist
         */
        'headerHeight': 0,

        /**
         * Static, fixed spacing height on bottom of wrapper for x-axis scroller to not overlap item on bottom end
         */
        'bottomSpacing': 0,

        /**
         * Oredered list of item IDs
         */
        'items': false,

        /**
         * A Callback function, that receives 1 argument - itemID (string/int) and should return a DOM Object, HTML
         * String or a jQuery object that is the actual DOM node to be rendered/appended to the list.
         */
        'itemRenderFunction': false,

        /**
         * A Callback function, that receives 1 argument - itemID (string/int) and should remove a node out of the DOM.
         * String or a jQuery object that is the actual DOM node to be rendered/appended to the list.
         */
        'itemRemoveFunction': false,

        /**
         * Optional jQuery/CSS selector of an object to be used for appending. Must be a child of the container.
         * Mainly used for hacking around table's markup and required DOM Tree where, the container would be marked as
         * scrollable area, but the tbody would be used for appending the items.
         */
        'appendTo': false,

        /**
         * If set to `true` MegaList would dynamically append, but never remove any nodes.
         * This is useful for browsers which have issues doing DOM ops and mess up the actual overall user experience
         * in sites using the MegaList for showing stuff, that later on would be cleared when the user changes the page
         * (e.g. file managers, when the user goes to a different folder, the DOM is cleared out).
         */
        'appendOnly': false,

        /**
         * Optional feature to insert items before/after their previous nodes, instead of always appending them
         * to the bottom of the container.
         *
         * Note: Can be overwritten by render adapters (e.g. Table)
         */
        'preserveOrderInDOM': false,

        /**
         * By default, the `MegaList.RENDER_ADAPTERS.PositionAbsolute` would be used.
         */
        'renderAdapter': false,

        /**
         * Pass any PerfectScrollbar options here.
         */
        'perfectScrollOptions': {},

        /**
         * Number of extra rows to show (even that they would be out of the viewport and hidden).
         * Note: MegaList would render number of `extraRows` before and also `extraRows` after the visible items,
         * except for the cases where the end of the list is reached or the list's scroll position is at top.
         */
        'extraRows': 0,

        /**
         * Number of extra # of "pages" (e.g. container/scroll height / itemHeight) to batch when rendering, instead of
         * always appending/removing one by one nodes while scrolling (main goal - to reduce FF FPS drops when
         * scrolling)
         */
        'batchPages': 0,

        /**
         * Internal option, that would be used by the Table renderer which would force the prepend to always be after
         * a specific (runtime defined) DOM element
         * @private
         */
        '_alwaysPrependAfter': false,

        /**
         * Force MegaList to trigger a 'onUserScroll' jQuery Event if needed.
         */
        'enableUserScrollEvent': false
    };

    /**
     * Helper variable, that create unique IDs by auto incrementing for every new MegaList that gets initialised.
     *
     * @type {number}
     */
    var listId = 0;

    /**
     * MegaList provides everything needed for efficient rendering of thousands of DOM nodes in a scrollable
     * (overflown) list or a grid.
     *
     * @param listContainer {String|jQuery|DOMNode} the container, which would be used to append list items
     * @param options {Object} see MEGALIST_DEFAULTS for defaults and available options.
     * @constructor
     */
    var MegaList = function (listContainer, options) {
        assert(options.itemRenderFunction, 'itemRenderFunction was not provided.');

        this.listId = listId++;

        this.$listContainer = $(listContainer);
        this.$listContainer
            .css({'position': 'relative'})
            .addClass("megaList");
        this.listContainer = this.$listContainer[0];

        var items = options.items;
        delete options.items;
        if (!items) {
            items = [];
        }
        this.items = items;

        this.options = $.extend({}, MEGALIST_DEFAULTS, options);

        if (this.options.appendTo) {
            this.$content = $(this.options.appendTo, this.$listContainer);
            this.content = this.$content[0];
        }

        this._wasRendered = false;
        this._isUserScroll = false;

        /**
         * A dynamic cache to be used as a width/height/numeric calculations
         *
         * @type {{}}
         * @private
         */
        this._calculated = false;

        /**
         * A map of IDs which are currently rendered (cached as a map, so that we can reduce access to the DOM)
         *
         * @type {Array}
         * @private
         */
        this._currentlyRendered = {};


        /**
         * Init the render adapter
         */
        if (!this.options.renderAdapter) {
            this.options.renderAdapter = new MegaList.RENDER_ADAPTERS.PositionAbsolute();
        }
        // pass a reference to MegaList, so that _calculated and other stuff can be used.
        this.options.renderAdapter.setMegaList(this);

        Object.defineProperty(this, 'removeNode', {
            value(n, h) {
                const {itemRemoveFunction} = this.options;
                return itemRemoveFunction && itemRemoveFunction(n, h) || DOMUtils.removeNode(n);
            }
        });
    };

    MegaList.prototype.updateOptions = function(options) {

        assert(options.itemRenderFunction, 'itemRenderFunction was not provided.');

        const prevPrePusher = this.options.renderAdapter.prePusherDOMNode;
        const prevPostPusher = this.options.renderAdapter.postPusherDOMNode;

        if (prevPrePusher) {
            prevPrePusher.remove();
            prevPostPusher.remove();
        }

        if (this.options.renderAdapter.spaceMaintainerCount) {
            options.renderAdapter.spaceMaintainerCount = this.options.renderAdapter.spaceMaintainerCount;
        }

        this.options = $.extend({}, MEGALIST_DEFAULTS, options);

        this._calculated = false;

        if (!this.options.renderAdapter) {
            this.options.renderAdapter = new MegaList.RENDER_ADAPTERS.PositionAbsolute();
        }

        this.options.renderAdapter.setMegaList(this);

        if (this.options.renderAdapter._willRender) {
            this.options.renderAdapter._willRender();
        }

        this.scrollToTop();
        this.resized();
    };

    /**
     * Internal method used for generating unique (per MegaList) instance namespace string. (not prepended with "."!)
     *
     * @returns {string}
     * @private
     */
    MegaList.prototype._generateEventNamespace = function() {
        return "megalist" + this.listId;
    };

    MegaList.prototype.throttledOnScroll = function(e) {
        var self = this;
        delay('megalist:scroll:' + this.listId, function() {
            if (self._isUserScroll === true && self.listContainer === e.target) {
                if (self.options.enableUserScrollEvent) {
                    self.trigger('onUserScroll', e);
                }
                self._onScroll(e);
            }
        }, 30);
    };

    /**
     * Internal method that would be called when the MegaList renders to the DOM UI and is responsible for binding
     * the DOM events.
     *
     * @private
     */
    MegaList.prototype._bindEvents = function () {
        var self = this;
        var ns = self._generateEventNamespace();

        $(window).rebind("resize." + ns, SoonFc(40, self.resized.bind(self)));

        if (this.options.usingNativeScroll) {
            this.$listContainer.rebind('scroll.' + ns, self.throttledOnScroll.bind(self));
        }
        else {
            $(this.listContainer).rebind('ps-scroll-y.ps' + ns, self.throttledOnScroll.bind(self));
        }
    };

    /**
     * Called when .destroy is triggered. Should unbind any DOM events added by this MegaList instance.
     *
     * @private
     */
    MegaList.prototype._unbindEvents = function () {
        var ns = this._generateEventNamespace();

        $(window).off("resize." + ns);

        if (this.options.usingNativeScroll) {
            this.$listContainer.off('scroll.' + ns);
        }
        else {
            $(this.listContainer).off('ps-scroll-y.ps' + ns);
        }
    };

    /**
     * Add an item to the list.
     *
     * @param itemId {String}
     */
    MegaList.prototype.add = function (itemId) {
        this.batchAdd([itemId]);
    };

    /**
     * Remove and item from the list.
     *
     * @param itemId {String}
     */
    MegaList.prototype.remove = function (itemId) {
        this.batchRemove([itemId]);
    };

    /**
     * Optimised adding of entries, less DOM updates
     *
     * @param itemIdsArray {Array} Array of item IDs (Strings)
     */
    MegaList.prototype.batchAdd = function(itemIdsArray) {
        PUSH.apply(this.items, itemIdsArray);

        if (this._wasRendered) {
            this._contentUpdated();
            this._applyDOMChanges(true);
        }
    };

    /**
     * Optimised replacing of entries, less DOM updates
     *
     * @param items {Array} Array of item IDs (Strings)
     */
    MegaList.prototype.batchReplace = function(items) {
        this.items = items;

        if (this._wasRendered) {
            this._contentUpdated();
            this._applyDOMChanges(true);
        }
    };

    /**
     * Optimised removing of entries, less DOM updates
     *
     * @param itemIdsArray {Array} Array of item IDs (Strings)
     */
    MegaList.prototype.batchRemove = function(itemIdsArray) {
        var self = this;
        var requiresRerender = false;
        var itemsWereModified = false;

        itemIdsArray.forEach(function(itemId) {
            var itemIndex = self.items.indexOf(itemId);
            if (itemIndex > -1) {
                if (self.isRendered(itemId)) {
                    requiresRerender = true;
                    self.removeNode(self._currentlyRendered[itemId], itemId);
                    delete self._currentlyRendered[itemId];
                }
                self.items.splice(itemIndex, 1);
                itemsWereModified = true;
            }
        });

        if (itemsWereModified) {
            if (this._wasRendered) {
                this._contentUpdated();
            }

            if (requiresRerender) {
                this._repositionRenderedItems();
                this._applyDOMChanges(true);

            }
        }
    };

    /**
     * Checks if an item exists in the list.
     *
     * @param itemId {String}
     * @returns {boolean}
     */
    MegaList.prototype.has = function (itemId) {
        return this.items.indexOf(itemId) > -1;
    };

    /**
     * Checks if an item is currently rendered.
     *
     * @param itemId {String}
     * @returns {boolean}
     */
    MegaList.prototype.isRendered = function (itemId) {
        const n = this._currentlyRendered[itemId];

        if (n) {
            if (n.parentNode) {
                return true;
            }

            if (d) {
                console.warn(`MegaList: Found stale rendered node for "${itemId}"`, n);
            }
            delete this._currentlyRendered[itemId];
        }
        return false;
    };

    /**
     * Should be called when the list container is resized.
     * This method would be automatically called on window resize, so no need to do that in the implementing code.
     */
    MegaList.prototype.resized = function () {

        if (!this._wasRendered) {
            return;
        }
        this._calculated = false;
        this._contentUpdated(true);
        this._applyDOMChanges();

        // destroy PS if ALL items are visible
        if (
            this._calculated['visibleFirstItemNum'] === 0 &&
            this._calculated['visibleLastItemNum'] === this.items.length &&
            this._calculated['contentWidth'] <= this._calculated['scrollWidth'] &&
            this._calculated['contentHeight'] <= this._calculated['scrollHeight']
        ) {
            if (this._scrollIsInitialized === true) {
                this._scrollIsInitialized = false;
                if (!this.options.usingNativeScroll) {
                    Ps.destroy(this.listContainer);
                }
            }
        }
        else {
            // not all items are visible after a resize, should we init PS?
            if (this._scrollIsInitialized === false) {
                if (!this.options.usingNativeScroll) {
                    Ps.initialize(this.listContainer, this.options.perfectScrollOptions);
                }
                this._scrollIsInitialized = true;
            }
        }
    };


    /**
     * Same as jQuery(megaListInstance).bind('eventName', cb);
     *
     * @param eventName {String}
     * @param cb {Function}
     */
    MegaList.prototype.bind = function (eventName, cb) {
        $(this).on(eventName, cb);
    };

    /**
     * Same as jQuery(megaListInstance).unbind('eventName', cb) and then .bind('eventName', cb);
     *
     * @param eventName {String}
     * @param cb {Function}
     */
    MegaList.prototype.rebind = function (eventName, cb) {
        if (eventName.indexOf(".") === -1) {
            if (typeof console !== 'undefined' && console.error) {
                console.error("MegaList.rebind called with eventName that does not have a namespace, which is an" +
                    "anti-pattern");
            }
            return;
        }
        $(this).rebind(eventName, cb);
    };

    /**
     * Same as jQuery(megaListInstance).unbind('eventName', cb);
     * @param eventName {String}
     * @param cb {Function}
     */
    MegaList.prototype.unbind = function (eventName, cb) {
        $(this).unbind(eventName, cb);
    };

    /**
     * Same as jQuery(megaListInstance).trigger(...);
     */
    MegaList.prototype.trigger = function () {
        if (!this.$megaList) {
            this.$megaList = $(this);
        }
        this.$megaList.trigger.apply(this.$megaList, arguments);
    };


    /**
     * Force update the scrollable area.
     */
    MegaList.prototype.scrollUpdate = function() {
        if (this._scrollIsInitialized && !this.options.usingNativeScroll) {
            Ps.update(this.listContainer);
        }
    };

    /**
     * Scroll the scrollable area to a specific `posTop` or `posLeft`.
     * Passing undefined to `posTop` can be used to only scroll the area via `posLeft`
     *
     * @param posTop {Number|undefined}
     * @param [posLeft] {Number|undefined}
     */
    MegaList.prototype.scrollTo = function(posTop, posLeft) {
        this._calculated = false;

        if (typeof posTop !== 'undefined') {
            this.listContainer.scrollTop = posTop;
        }
        if (typeof posLeft !== 'undefined') {
            this.listContainer.scrollLeft = posLeft;
        }
        this.scrollUpdate();
        this._repositionRenderedItems();
        this._applyDOMChanges();
    };

    /**
     * Returns the current top position of the scrollable area
     *
     * @returns {number|*|Number|undefined}
     */
    MegaList.prototype.getScrollTop = function() {
        return this.listContainer.scrollTop;
    };

    /**
     * Returns the current left position of the scrollable area
     *
     * @returns {Number}
     */
    MegaList.prototype.getScrollLeft = function() {
        return this.listContainer.scrollLeft;
    };

    /**
     * Returns the scroll's height
     *
     * @returns {Number}
     */
    MegaList.prototype.getScrollHeight = function() {
        this._recalculate();
        return this._calculated['scrollHeight'];
    };

    /**
     * Returns the scroll's width
     *
     * @returns {Number}
     */
    MegaList.prototype.getScrollWidth = function() {
        this._recalculate();
        return this._calculated['scrollWidth'];
    };

    /**
     * Returns the total height of the list (incl. the overflown/not visible part).
     *
     * @returns {Number}
     */
    MegaList.prototype.getContentHeight = function() {
        this._recalculate();
        return this._calculated['contentHeight'];
    };

    /**
     * Returns the total width of the list (incl. the overflown/not visible part).
     * @returns {Number}
     */
    MegaList.prototype.getContentWidth = function() {
        this._recalculate();
        return this._calculated['contentWidth'];
    };

    /**
     * Returns true if the scrollable area is scrolled to top.
     *
     * @returns {boolean}
     */
    MegaList.prototype.isAtTop = function() {
        this._recalculate();
        return this._calculated['isAtTop'];
    };

    /**
     * Returns true if the scrollable area is scrolled to bottom.
     *
     * @returns {boolean}
     */
    MegaList.prototype.isAtBottom = function() {
        this._recalculate();
        return this._calculated['isAtBottom'];
    };

    /**
     * Returns a percent, representing the scroll position X.
     *
     * @returns {Number}
     */
    MegaList.prototype.getScrolledPercentX = function() {
        this._recalculate();
        return this._calculated['scrolledPercentX'];
    };

    /**
     * Returns a percent, representing the scroll position Y.
     *
     * @returns {*}
     */
    MegaList.prototype.getScrolledPercentY = function() {
        this._recalculate();
        return this._calculated['scrolledPercentY'];
    };

    /**
     * Scroll the Y axis of the list to `posPerc`
     *
     * @param posPerc {Number} A percent in the format of 0.0 - 1.0
     */
    MegaList.prototype.scrollToPercentY = function(posPerc) {
        var targetPx = this.getContentHeight() * posPerc;
        if (this.listContainer.scrollTop !== targetPx) {
            this.listContainer.scrollTop = targetPx;
            this._isUserScroll = false;
            this.scrollUpdate();
            this._onScroll();
            this._isUserScroll = true;
        }
    };

    /**
     * Scroll to specific Y position.
     *
     * @param posY {Number}
     */
    MegaList.prototype.scrollToY = function(posY) {
        if (this.listContainer.scrollTop !== posY) {
            this.listContainer.scrollTop = posY;
            this._isUserScroll = false;
            this.scrollUpdate();
            this._onScroll();
            this._isUserScroll = true;
        }
    };

    /**
     * Scroll to specific DOM Node.
     * Warning: The DOM Node should be a child of the listContainer, otherwise you may notice weird behaviour of this
     * function.
     *
     * @param element {DOMNode}
     */
    MegaList.prototype.scrollToDomElement = function(element) {

        if (!this._elementIsInViewport(element)) {
            this.listContainer.scrollTop = $(element)[0].offsetTop;
            this._isUserScroll = false;
            this.scrollUpdate();
            this._onScroll();
            this._isUserScroll = true;
        }
    };

    /**
     * Scroll to specific `itemId`
     *
     * @param itemId {String}
     * @returns {boolean} true if found, false if not found.
     */
    MegaList.prototype.scrollToItem = function(itemId) {
        var elementIndex = this.items.indexOf(itemId);
        if (elementIndex === -1) {
            return false;
        }

        var scrollToY = -1;
        var itemOffsetTop = Math.floor(elementIndex / this._calculated['itemsPerRow']) * this.options.itemHeight;
        var itemOffsetTopPlusHeight = itemOffsetTop + this.options.itemHeight;

        // check if the item is above the visible viewport
        if (itemOffsetTop < this._calculated['scrollTop']) {
            scrollToY = itemOffsetTop;
        }
        // check if the item is below the visible viewport
        else if (itemOffsetTopPlusHeight + this.options.headerHeight >
            (this._calculated['scrollTop'] + this._calculated['scrollHeight'])) {
            scrollToY = itemOffsetTopPlusHeight - this._calculated['scrollHeight'] +
                this.options.headerHeight + this.options.bottomSpacing;
        }

        // have to scroll
        if (scrollToY !== -1) {
            this.listContainer.scrollTop = scrollToY;
            this._isUserScroll = false;
            this.scrollUpdate();
            this._onScroll();
            this._isUserScroll = true;

            return true;
        }
        else {
            return false;
        }
    };


    /**
     * Alias to .scrollTo(0, 0)
     */
    MegaList.prototype.scrollToTop = function() {
        this.scrollTo(0, 0);
    };

    /**
     * Alias to .scrollToPercentY(1)
     */
    MegaList.prototype.scrollToBottom = function() {
        this.scrollToPercentY(1);
    };


    /**
     * Alias to .scrollTo(0, 0)
     */
    MegaList.prototype.scrollPageUp = function() {
        var top = this._calculated['scrollTop'];
        top -= this._calculated['scrollHeight'];
        if (top >= 0) {
            this.scrollTo(top);
        }
        else {
            this.scrollTo(0);
        }
    };

    /**
     * Alias to .scrollToPercentY(1)
     */
    MegaList.prototype.scrollPageDown = function() {
        var top = this._calculated['scrollTop'];
        top += this._calculated['scrollHeight'];
        if (top <= this._calculated['contentHeight'] - this._calculated['scrollHeight']) {
            this.scrollTo(top);
        }
        else {
            this.scrollTo(this._calculated['contentHeight'] - this._calculated['scrollHeight']);
        }
    };

    /**
     * Used in case you want to destroy the MegaList instance and its created DOM nodes
     */
    MegaList.prototype.destroy = function () {
        // destroy PS
        this._unbindEvents();

        this.items = [];
        this._wasRendered = false;

        if(!this.options.usingNativeScroll) {
            Ps.destroy(this.listContainer);
        }

        if (!this.options.appendTo && this.content) {
            DOMUtils.removeNode(this.content);
            this.$content = this.content = undefined;
        }
    };


    /**
     * Often you may want to initialise the MegaList, but not render it immediately (e.g. some items are still loading
     * and waiting to be added to the MegaList). Thats why, this method should be called so that the initial rendering
     * of the internal DOM nodes is done.
     */
    MegaList.prototype.initialRender = function () {
        assert(this._wasRendered === false, 'This MegaList is already rendered');


        if (!this.$content) {
            this.$content = $('<div class="megaList-content"></div>');
            this.$content.css({
                'position': 'relative'
            });
            this.content = this.$content[0];

            this.listContainer.appendChild(this.content);
        }

        if (!this.options.usingNativeScroll) {
            // init PS
            Ps.initialize(this.listContainer, this.options.perfectScrollOptions);
        }

        this._scrollIsInitialized = true;

        this._contentUpdated();

        if (this.options.renderAdapter._willRender) {
            this.options.renderAdapter._willRender();
        }
        this._wasRendered = true;

        this._applyDOMChanges();

        this.scrollUpdate();

        this._isUserScroll = true;

        // bind events
        this._bindEvents();

        if (this.options.renderAdapter._rendered) {
            this.options.renderAdapter._rendered();
        }
    };


    /**
     * Does recalculation of the internally precalculated values so that the DOM Re-paints are reduced to minimum,
     * while the user is scrolling up/down.
     * @private
     */
    MegaList.prototype._recalculate = function() {
        if (this._calculated) {
            return this._calculated;
        }
        var self = this;
        var calculated = this._calculated = Object.create(null);

        lazy(calculated, 'scrollWidth', function() {
            return self.$listContainer.innerWidth();
        });

        lazy(calculated, 'scrollHeight', function() {
            return self.$listContainer.innerHeight();
        });

        lazy(calculated, 'itemWidth', function() {
            if (self.options.itemWidth === false) {
                return this.contentWidth;
            }
            else if (typeof self.options.itemWidth === 'function') {
                return self.options.itemWidth();
            }
            return self.options.itemWidth;
        });

        lazy(calculated, 'contentWidth', function() {
            var contentWidth = self.$listContainer.children(":first").outerWidth();
            if (contentWidth) {
                return contentWidth;
            }
            return this.scrollWidth;
        });

        lazy(calculated, 'itemsPerRow', function() {
            return Math.max(1, Math.floor(this.contentWidth / this.itemWidth));
        });

        lazy(calculated, 'itemsPerPage', function() {
            return Math.ceil(this.scrollHeight / self.options.itemHeight) * this.itemsPerRow;
        });

        lazy(calculated, 'contentHeight', function() {
            return Math.ceil(self.items.length / this.itemsPerRow) * self.options.itemHeight +
                self.options.headerHeight + self.options.bottomSpacing;
        });

        lazy(calculated, 'scrollLeft', function() {
            return self.listContainer.scrollLeft;
        });
        lazy(calculated, 'scrollTop', function() {
            return self.listContainer.scrollTop;
        });
        lazy(calculated, 'scrolledPercentX', function() {
            return 100 / this.scrollWidth * this.scrollLeft;
        });
        lazy(calculated, 'scrolledPercentY', function() {
            return 100 / this.scrollHeight * this.scrollTop;
        });
        lazy(calculated, 'isAtTop', function() {
            return this.scrollTop === 0;
        });
        lazy(calculated, 'isAtBottom', function() {
            return self.listContainer.scrollTop === this.contentHeight - this.scrollHeight;
        });

        lazy(calculated, 'visibleFirstItemNum', function() {
            var value = 0;

            if (self.options.appendOnly !== true) {
                value = Math.floor(Math.floor(this.scrollTop / self.options.itemHeight) * this.itemsPerRow);

                if (value > 0) {
                    value = Math.max(0, value - (self.options.extraRows * this.itemsPerRow));
                }
            }

            return value;
        });

        lazy(calculated, 'visibleLastItemNum', function() {
            var value = Math.min(
                self.items.length,
                Math.ceil(
                    Math.ceil(this.scrollTop / self.options.itemHeight) *
                    this.itemsPerRow + this.itemsPerPage
                )
            );

            if (value < self.items.length) {
                value = Math.min(self.items.length, value + (self.options.extraRows * this.itemsPerRow));
            }

            return value;
        });

        if (this.options.batchPages > 0) {
            var perPage = calculated['itemsPerPage'];

            var visibleF = calculated['visibleFirstItemNum'];
            calculated['visibleFirstItemNum'] = Math.max(
                0,
                ((((visibleF - visibleF % perPage) / perPage) - 1) - this.options.batchPages) * perPage
            );

            var visibleL = calculated['visibleLastItemNum'];
            calculated['visibleLastItemNum'] = Math.min(
                this.items.length,
                ((((visibleL - visibleL % perPage) / perPage) + 1) + this.options.batchPages) * perPage
            );
        }

        return calculated;
    };

    /**
     * Internal method, that gets called when the MegaList's content gets updated (e.g. the internal list of item ids).
     *
     * @private
     */
    MegaList.prototype._contentUpdated = function(forced) {
        if (this._wasRendered || forced) {
            this._calculated = false;
            this._recalculate();

            if (this._lastContentHeight !== this._calculated['contentHeight']) {
                this._lastContentHeight = this._calculated['contentHeight'];
                this.content.style.height = this._calculated.contentHeight -
                    this.options.headerHeight - this.options.bottomSpacing + "px";
            }

            // scrolled out of the viewport if the last item in the list was removed? scroll back a little bit...
            if (this._calculated['scrollHeight'] + this._calculated['scrollTop'] > this._calculated['contentHeight']) {
                this.scrollToBottom();
            }
        }
    };

    /**
     * Internal method, that get called when DOM changes should be done (e.g. render new items since they got in/out
     * of the viewport)
     *
     * @var {bool} [contentWasUpdated] pass true to force dimension related updates
     * @private
     */
    MegaList.prototype._applyDOMChanges = function(contentWasUpdated) {
        this._recalculate();

        var first = this._calculated['visibleFirstItemNum'];
        var last = this._calculated['visibleLastItemNum'];

        // remove items before the first visible item
        if (this.options.appendOnly !== true) {
            for (var i = 0; i < first; i++) {
                var id = this.items[i];
                if (this._currentlyRendered[id]) {
                    contentWasUpdated = true;
                    this.removeNode(this._currentlyRendered[id], id);
                    delete this._currentlyRendered[id];
                }
            }

            // remove items after the last visible item
            for (var i = last; i < this.items.length; i++) {
                var id = this.items[i];
                if (this._currentlyRendered[id]) {
                    contentWasUpdated = true;
                    this.removeNode(this._currentlyRendered[id], id);
                    delete this._currentlyRendered[id];
                }
            }
        }

        var prependQueue = [];
        var appendQueue = [];

        // show items which are currently visible
        for(var i = first; i < last; i++) {
            var id = this.items[i];

            if (!this.isRendered(id)) {
                var renderedNode = this.options.itemRenderFunction(id);
                if (!renderedNode) {
                    console.warn('MegaList: Node not found...', id);
                    continue;
                }

                contentWasUpdated = true;
                if (this.options.renderAdapter._repositionRenderedItem) {
                    this.options.renderAdapter._repositionRenderedItem(id, renderedNode);
                }

                if (!this.options.preserveOrderInDOM) {
                    appendQueue.push(renderedNode);
                }
                else {
                    if (i === 0) {
                        if (this.options._alwaysPrependAfter) {
                            DOMUtils.appendAfter(renderedNode, this.options._alwaysPrependAfter);
                        }
                        else {
                            // DOMUtils.prepend(renderedNode, this.content);
                            prependQueue.push(renderedNode);
                        }
                    }
                    else {
                        var previousNodeId = this.items[i - 1];
                        if (this._currentlyRendered[previousNodeId]) {
                            DOMUtils.appendAfter(renderedNode, this._currentlyRendered[previousNodeId]);
                        }
                        else {
                            if (this.options._alwaysPrependAfter) {
                                DOMUtils.appendAfter(renderedNode, this.options._alwaysPrependAfter);
                            }
                            else  {
                                // no previous, render first
                                // DOMUtils.prepend(renderedNode, this.content);
                                appendQueue.push(renderedNode);
                            }
                        }
                    }
                }

                this._currentlyRendered[id] = renderedNode;

                var prependFragment = document.createDocumentFragment();
                prependQueue.forEach(function(node) {
                    DOMUtils.prepend(node, prependFragment);
                });

                DOMUtils.prepend(prependFragment, this.content);

                var appendFragment = document.createDocumentFragment();
                appendQueue.forEach(function(node) {
                    appendFragment.appendChild(node);
                });
                this.content.appendChild(appendFragment);
            }
            else {
                if (this.options.renderAdapter._repositionRenderedItem) {
                    this.options.renderAdapter._repositionRenderedItem(id);
                }
            }
        }

        if (contentWasUpdated === true) {
            if (this.options.renderAdapter._itemsRepositioned) {
                this.options.renderAdapter._itemsRepositioned();
            }

            const tick = 192;
            delay(`megalist:content-updated:${this.listId}`, () => {
                this._isUserScroll = false;
                this.scrollUpdate();
                this._isUserScroll = true;

                if (this.options.onContentUpdated) {
                    delay(`megalist:content-updated:feedback:${this.listId}`, this.options.onContentUpdated, tick << 1);
                }
            }, tick);
        }
    };

    /**
     * Internal method that *ONLY* repositions items, in case a call to `_applyDOMChanges` is NOT needed, but the
     * items in the list should be re-positioned.
     * Basically, a lightweight version of `_applyDOMChanges` that does NOT adds or removes DOM nodes.
     *
     * @private
     */
    MegaList.prototype._repositionRenderedItems = function() {
        var self = this;
        if (self.options.renderAdapter._repositionRenderedItem) {
            Object.keys(self._currentlyRendered).forEach(function (k) {
                self.options.renderAdapter._repositionRenderedItem(k);
            });
        }

        if (this.options.renderAdapter._itemsRepositioned) {
            this.options.renderAdapter._itemsRepositioned();
        }
    };

    /**
     * Internal method that gets called when the user scrolls.
     *
     * @param e {Event}
     * @private
     */
    MegaList.prototype._onScroll = function(e) {
        this._calculated = false;
        this._applyDOMChanges();
    };

    /**
     * Not-so efficient method of maintaining item ids in sync with your data source, but helpful enough for
     * quick prototypes or UIs which don't update their item lists too often.
     * Would update the internally stored item ids, with the idsArray.
     * Would take care of appending/prepending/positioning newly rendered elements in the UI properly with minimum DOM
     * updates.
     *
     * @param idsArray
     */
    MegaList.prototype.syncItemsFromArray = function(idsArray) {
        var self = this;
        var r = array.diff(this.items, idsArray);

        // IF initially the folder was empty, megaList may not had been rendered...so, lets check
        var requiresRerender = false;

        r.removed.forEach(function (itemId) {
            var itemIndex = self.items.indexOf(itemId);
            if (itemIndex > -1) {
                if (self.isRendered(itemId)) {
                    requiresRerender = true;
                    self.removeNode(self._currentlyRendered[itemId], itemId);
                    delete self._currentlyRendered[itemId];
                }
                self.items.splice(itemIndex, 1);
            }
        });

        r.added.forEach(function(itemId) {
            var itemIndex = self.items.indexOf(itemId);
            if (itemIndex === -1) {
                // XX: Can be made more optimal, e.g. to only rerender if prev/next was updated
                requiresRerender = true;

                var targetIndex = idsArray.indexOf(itemId);

                assert(targetIndex !== -1, 'targetIndex was -1, this should never happen.');

                if (targetIndex === 0) {
                    self.items.unshift(itemId);
                }
                else {
                    self.items.splice(targetIndex, 0, itemId);
                }
            }
        });

        if (this._wasRendered) {
            this._contentUpdated();
        }
        else {
            this.initialRender();
        }

        if (requiresRerender) {
            this._repositionRenderedItems();
            this._applyDOMChanges();

        }
    };

    /**
     * Utility function for reposition updated node to specific position, more optimal for single node is updated case
     *
     * @param id {{string}} id of item in the list which updated to trigger reposition
     * @param to {{int}} index of target position where item is moved to
     */

    // @TODO: currently using reposition item and then remove domnode to make it re-render again.
    // Need to find better way reposition existing item rather then re-create node after delete it.
    MegaList.prototype.repositionItem = function(id, to) {

        this.items.splice(to, 0, this.items.splice(this.items.indexOf(id), 1)[0]);

        if (this._currentlyRendered[id]) {
            this.removeNode(this._currentlyRendered[id], id)
        }

        this._contentUpdated();
        this._repositionRenderedItems();
        this._applyDOMChanges();
    }

    /**
     * Utility function for batch adding of new nodes on *specific* positions in the items list
     *
     * @param idsObj {{int,string}} a hash map with keys = position for the item to be added, string = item id
     */
    MegaList.prototype.batchAddFromMap = function(idsObj) {
        var self = this;

        // IF initially the folder was empty, megaList may not had been rendered...so, lets check
        var requiresRerender = false;

        Object.keys(idsObj).forEach(function(targetIndex) {
            var itemId = idsObj[targetIndex];

            var itemIndex = self.items.indexOf(itemId);
            if (itemIndex === -1) {
                // XX: Can be made more optimal, e.g. to only rerender if prev/next was updated
                requiresRerender = true;

                if (targetIndex === 0) {
                    self.items.unshift(itemId);
                    // console.error('1unshift', itemId);
                }
                else {
                    self.items.splice(targetIndex, 0, itemId);
                    // console.error('1splice', targetIndex, itemId);
                }
            }
            else if (itemIndex !== targetIndex) {
                requiresRerender = true;
                // delete item from the array
                // console.error('2remove', itemIndex);
                self.items.splice(itemIndex, 1);
                // add it back to the new target position
                // console.error('2add', targetIndex);
                self.items.splice(targetIndex, 0, itemId);
            }
        });

        if (this._wasRendered) {
            this._contentUpdated();
        }
        else {
            this.initialRender();
        }

        if (requiresRerender) {
            this._repositionRenderedItems();
            this._applyDOMChanges();

        }
    };

    /**
     * Basic util method to check if an element is in the visible viewport
     *
     * @param el {DOMNode|jQuery}
     * @returns {boolean}
     * @private
     */
    MegaList.prototype._elementIsInViewport = function isElementInViewport (el) {

        // refactored from:
        // http://stackoverflow.com/questions/123999/how-to-tell-if-a-dom-element-is-visible-in-the-current-viewport/

        if (typeof jQuery === "function" && el instanceof jQuery) {
            el = el[0];
        }

        var rect     = el.getBoundingClientRect(),
            vWidth   = window.innerWidth || doc.documentElement.clientWidth,
            vHeight  = window.innerHeight || doc.documentElement.clientHeight,
            efp      = function (x, y) { return document.elementFromPoint(x, y) };

        return rect.bottom > 0 &&
            rect.right > 0 &&
            rect.left < (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */ &&
            rect.top < (window.innerHeight || document.documentElement.clientHeight) /* or $(window).height() */;
    };

    MegaList.RENDER_ADAPTERS = {};

    MegaList.RENDER_ADAPTERS.PositionAbsolute = class PositionAbsoluteRenderAdapter {

        constructor(options) {

            this.options = options || {};
        }

        setMegaList(megaList) {

            this.megaList = megaList;
        }

        _repositionRenderedItem(itemId, node) {

            assert(this.megaList, 'megaList is not set.');

            const megaList = this.megaList;
            if (!node) {
                node = megaList._currentlyRendered[itemId];
                if (!node) {
                    return;
                }
            }
            const itemPos = megaList.items.indexOf(itemId);

            const css = {
                'position': 'absolute',
                'top': (megaList.options.itemHeight * Math.floor(itemPos/megaList._calculated['itemsPerRow'])) + "px"
            };

            if (megaList._calculated['itemsPerRow'] > 1) {
                css['left'] = ((itemPos % megaList._calculated['itemsPerRow']) * megaList.options.itemWidth) + "px";
            }
            node.classList.add('megaListItem');

            Object.keys(css).forEach(function(prop, i) {
                node.style[prop] = css[prop];
            });
        }

        _rendered() {

            const megaList = this.megaList;
            assert(megaList.$content, 'megaList.$content is not ready.');
            megaList.content.style.height = megaList._calculated['contentHeight'] + "px";
            if(!this.options.usingNativeScroll) {
                Ps.update(this.megaList.listContainer);
            }
        }
    };

    MegaList.RENDER_ADAPTERS.Table = class TableRenderAdapter {

        constructor(options) {

            this.options = options || {};
            this.options.pusher = 'tr';
        }

        setMegaList(megaList) {

            this.megaList = megaList;
            megaList.options.preserveOrderInDOM = true;
        }

        _willRender() {

            const megaList = this.megaList;

            this.prePusherDOMNode = document.createElement(this.options.pusher);
            this.postPusherDOMNode = document.createElement(this.options.pusher);

            DOMUtils.prepend(this.prePusherDOMNode, megaList.content);

            megaList.content.appendChild(this.postPusherDOMNode);

            megaList.options._alwaysPrependAfter = this.prePusherDOMNode;
        }

        _repositionRenderedItem(itemId, node) {

            assert(this.megaList, 'megaList is not set.');

            const megaList = this.megaList;
            if (!node) {
                node = megaList._currentlyRendered[itemId];
            }
            if (node && !node.classList.contains('megaListItem')) {
                node.classList.add('megaListItem');
            }
        }

        _itemsRepositioned() {

            assert(this.megaList, 'megaList is not set.');
            assert(this.prePusherDOMNode, 'prePusherDOMNode is not set, is the list rendered?');
            assert(this.postPusherDOMNode, 'postPusherDOMNode is not set, is the list rendered?');

            const megaList = this.megaList;
            const calculated = megaList._calculated;

            if (this.megaList.options.appendOnly !== true) {
                const prepusherHeight = calculated['visibleFirstItemNum'] * megaList.options.itemHeight;
                this.prePusherDOMNode.style.height = prepusherHeight + "px";
            }

            const postpusherHeight = (megaList.items.length - calculated['visibleLastItemNum']) * megaList.options.itemHeight;
            this.postPusherDOMNode.style.height = postpusherHeight + "px";
        }

        _rendered() {

            const megaList = this.megaList;
            megaList.content.style.height = megaList._calculated['contentHeight'] -
                megaList.options.headerHeight - megaList.options.bottomSpacing + "px";
            if(!this.options.usingNativeScroll) {
                Ps.update(megaList.listContainer);
            }
        }
    };

    MegaList.RENDER_ADAPTERS.List = class ListRenderAdapter extends MegaList.RENDER_ADAPTERS.Table {

        constructor(options) {

            super(options);
            this.options.pusher = 'div';
        }
    };

    MegaList.RENDER_ADAPTERS.Grid = class GridRenderAdapter extends MegaList.RENDER_ADAPTERS.List {

        constructor(options) {

            super(options);
            this.spaceMaintainerCount = 0;
        }

        setMegaList(megaList) {

            this.megaList = megaList;
        }

        _itemsRepositioned() {

            assert(this.megaList, 'megaList is not set.');
            assert(this.prePusherDOMNode, 'prePusherDOMNode is not set, is the list rendered?');
            assert(this.postPusherDOMNode, 'postPusherDOMNode is not set, is the list rendered?');

            const megaList = this.megaList;
            const calculated = megaList._calculated;
            const _calcSpace = idx => Math.ceil(idx / calculated.itemsPerRow) * megaList.options.itemHeight;

            if (!calculated) {
                return;
            }

            if (this.megaList.options.appendOnly !== true) {
                this.prePusherDOMNode.style.height = `${_calcSpace(calculated.visibleFirstItemNum)}px`;
            }

            this.postPusherDOMNode.style.height =
                `${_calcSpace(megaList.items.length - calculated.visibleLastItemNum)}px`;

            this.createFiller();
        }

        createFiller() {

            const megaList = this.megaList;
            const calculated = megaList._calculated;

            let spaceRequired = megaList.items.length % calculated.itemsPerRow;

            if (spaceRequired !== 0) {

                spaceRequired = calculated.itemsPerRow - spaceRequired - this.spaceMaintainerCount;

                while(spaceRequired > 0) {

                    const spacer = document.createElement('a');
                    spacer.className = 'mega-node fm-item fm-filler-item';
                    megaList.content.insertBefore(spacer, this.postPusherDOMNode);
                    spaceRequired--;
                    this.spaceMaintainerCount++;
                }
            }
        }        

        _rendered() {

            const megaList = this.megaList;
            assert(megaList.$content, 'megaList.$content is not ready.');
            megaList.content.style.height = megaList._calculated['contentHeight'] + "px";
            if(!this.options.usingNativeScroll) {
                Ps.update(this.megaList.listContainer);
            }
        }
    };

    scope.MegaList = MegaList;
})(window, jQuery);

/**
 * @file Functions which initialise and control the search bars at the top of every page
 * @property mega.ui.searchbar
 */
lazy(mega.ui, 'searchbar', () => {
    'use strict';

    let $topbar;
    let $dropdownSearch;
    let $dropdownEmptyState;
    let $dropdownRecents;
    let $dropdownResults;
    let $fileSearch;

    let showEmptyState;

    const recentlySearched = {

        justSearched: false,
        /**
         * Recently searched terms
         * @type {Set<string>}
         */
        terms: new Set(),

        /**
         * Number of search terms to show in view
         * @type {number}
         */
        numTermsInView: 5,

        /**
         * Maximum number of search terms to keep in persistent storage
         * @type {number}
         */
        maxStored: 20,

        /**
         * Saves current terms
         *
         * @return {Promise}
         */
        async save() {
            if (u_type > 0) {
                return M.setPersistentData(`${u_handle}!rs`, tlvstore.encrypt([...this.terms]));
            }
        },

        /**
         * Adds a search term to the list of search terms
         *
         * @param {string} term The search term
         * @return {Promise}
         */
        async addTerm(term) {
            // Delete the term if it exists
            this.terms.delete(term);
            // Append the term (to make recent terms appear first)
            this.terms.add(term);
            if (this.terms.size > this.maxStored) {
                const [firstTerm] = this.terms;
                this.terms.delete(firstTerm);
            }
            return this.save();
        },

        /**
         * Delete a search term from the list of search terms
         *
         * @param {string} term The search term
         * @return {Promise}
         */
        async deleteTerm(term) {
            this.terms.delete(term);
            this.update(true);
            return this.save();
        },

        /**
         * Clears the list of search terms
         *
         * @param {boolean} skipUpdate Is the view refreshed after clear
         * @return {Promise}
         */
        async clear(skipUpdate = false) {
            this.terms.clear();

            return M.delPersistentData(`${u_handle}!rs`)
                .finally(() => !skipUpdate && this.update(true));
        },

        /**
         * Initializes/refreshes the `recentlySearched` object
         *
         * @return {undefined}
         */
        async init() {
            return this.refresh();
        },

        /**
         * Repopulates recently searched terms from persistent storage
         *
         * @return {(undefined|Promise)} Returns a promise if logged in and things were fetched, otherwise undefined
         */
        async refresh() {
            if (this.terms.size === 0 && u_type > 0) {
                return M.getPersistentData(`${u_handle}!rs`)
                    .then((recentlySearched) => {

                        this.terms = new Set(Object.values(tlvstore.decrypt(recentlySearched)));
                    })
                    .catch((ex) => {
                        if (d && ex !== ENOENT) {
                            console.error(ex);
                        }

                        // empty state already exists, no need to initialize
                        return this.save();
                    });
            }
        },

        /**
         * Updates the recently searched section view
         *
         * @param {boolean} hasDeletedOrCleared Check if updating after a delete or clear
         * @return {undefined}
         */
        update(hasDeletedOrCleared = false) {
            removeVisibilityListeners();
            renderUpdatedDropdown(hasDeletedOrCleared);
            addVisibilityListeners();
        }
    };

    const recentlyOpened = {

        /**
         * Recently opened files
         * @type {Map<string,object>}
         */
        files: new Map(),

        /**
         * Number of opened files to show in view
         * @type {number}
         */
        numFilesInView: 5,

        /**
         * Maximum number of opened files to keep in persistent storage
         * @type {number}
         */
        maxStored: 20,

        /**
         * Initializes/Repopulates recently opened files array
         *
         * @return {undefined}
         */
        init() {
            return this.refresh();
        },

        /**
         * Adds to recently opened files by file handle
         *
         * @param {string} handle The file handle
         * @param {boolean} isEditable Set to true for text files, false for other
         *
         * @return {undefined}
         */
        addFile(handle, isEditable) {

            // If we are in a public folder, or if not logged in, do not add the file
            if (is_mobile || folderlink || !u_handle) {
                return;
            }

            // In some cases, when previewing files, the dropdown still remains, hide it, but check if its defined first
            if ($dropdownSearch) {
                hideDropdown();
            }

            if (mega.config.get('showRecents') === 1) {

                const newEntry = {h: handle, e: isEditable};

                // Delete the entry first to push older entries to last position
                this.files.delete(handle);
                this.files.set(handle, newEntry);

                // Check if we have exceeded the limit of stored files, remove first entry if we did
                if (this.files.size > this.maxStored) {
                    const [first_handle] = this.files.keys();
                    this.files.delete(first_handle);
                }

                return this.save();
            }
        },

        /**
         * Repopulates recently opened files array from persistent storage
         *
         * @return {Promise} Returns a promise if logged in and things were fetched.
         */
        async refresh() {
            if (u_type > 0) {
                await M.getPersistentData(`${u_handle}!ro`)
                    .then((recentlyOpened) => {
                        this.files = new Map(JSON.parse(tlvstore.decrypt(recentlyOpened)).map((v) => [v.h, v]));
                    })
                    .catch(nop);

                // If we are in a public folder, we skip the node fetching
                if (!pfid) {
                    return this.fetchNodes();
                }
            }
        },

        /**
         * Clears the list of search terms
         *
         * @return {undefined}
         */
        async clear() {
            this.files = new Map();
            return M.delPersistentData(`${u_handle}!ro`);
        },

        /**
         * Saves the recently opened files Map in persistent storage
         *
         * @return {undefined}
         */
        async save() {
            if (u_type > 0) {
                const data = tlvstore.encrypt(JSON.stringify([...recentlyOpened.files.values()]));

                return M.setPersistentData(`${u_handle}!ro`, data);
            }
        },
        /**
         * Checks if any node is missing in memory, fetches them, deletes if not available anymore
         *
         * @return {(undefined|Promise)} Returns a Promise if not a public link & things fetched. Otherwise undefined.
         */
        async fetchNodes() {
            const toFetch = [...this.files.keys()].filter(h => !M.getNodeByHandle(h));

            return dbfetch.acquire(toFetch).always(()=>{
                let anyDeleted = false;
                for (const h of this.files.keys()) {
                    if (!M.getNodeByHandle(h)
                        || M.getNodeRoot(h) === M.RubbishID
                        || typeof h === 'undefined') {

                        this.files.delete(h);
                        anyDeleted = true;
                    }
                }

                if (anyDeleted) {
                    return this.save();
                }
            });
        },
    };

    /**
     * Initialises the top searchbars and events attached to them
     *
     * @param {string} [currentPage] - the current page/location/URL
     * @return {undefined}
     */
    function initSearch(currentPage) {
        $topbar = $('#startholder .js-topbar, #fmholder .js-topbar');
        $dropdownSearch = $('.dropdown-search', $topbar);

        refreshSearch(currentPage);

        Promise.all([recentlySearched.init(), recentlyOpened.init()]).catch(dump);

        showEmptyState = recentlySearched.terms.size !== 0;

        $('#main-search-fake-form, #mini-search-fake-form', $topbar).rebind('submit.searchsubmit', function(e) {
            e.preventDefault();

            // Close node Info panel as not applicable after searching
            mega.ui.mInfoPanel.closeIfOpen();

            var val = $.trim($('.js-filesearcher', this).val());

            // if current page is search and value is empty result move to root.
            if (!val && window.page.includes('/search')) {
                $('.js-btnclearSearch', $(this)).addClass('hidden');
                loadSubPage(window.page.slice(0, window.page.indexOf('/search')));
            }
            else if (val.length >= 2 || !asciionly(val)) {
                M.fmSearchNodes(val).then(() => {
                    if (!M.search) {
                        mega.ui.mNodeFilter.resetFilterSelections();
                    }
                    if (!pfid) {
                        recentlySearched.justSearched = true;
                        if (mega.config.get('showRecents') === 1) {
                            recentlySearched.addTerm(val);
                        }
                        loadSubPage(`fm/search/${val}`);
                        hideDropdown();
                        addDropdownEventListeners();
                        showEmptyState = true;
                    }
                    onIdle(() => {
                        // get topbars again for switching between static and fm pages
                        $topbar = $('#startholder .js-topbar, #fmholder .js-topbar');
                        $dropdownSearch = $('.dropdown-search', $topbar);
                        $fileSearch = $('.js-filesearcher', $topbar);
                        $fileSearch.val(val);
                        if (!recentlySearched.justSearched) {
                            $('#main-search-fake-form .js-filesearcher', $topbar).trigger('focus');
                        }
                        $('.js-btnclearSearch', $topbar).removeClass('hidden');
                        hideDropdown();

                        if (pfid && mega.gallery) {
                            mega.gallery.clearMdView();
                        }

                        // fix a redirect from a bottompage with an 'old' class on it
                        $('body').removeClass('old');
                    });
                });
            }

            return false;
        });

        $('.js-filesearcher', $topbar).rebind('keyup.searchbar', (e) => {
            delay('searchbar.renderSuggestSearchedItems', () => renderSuggestSearchedItems(e), 1500);
        });

        $('.js-btnclearSearch', $topbar).rebind('click.searchclear', (e) => {
            e.preventDefault();

            // if this is folderlink, open folderlink root;
            if (folderlink) {
                M.nn = false;
                M.openFolder();
            }

            $('.js-btnclearSearch', $topbar).addClass('hidden');
            $fileSearch.val('').trigger('blur');

            // if current page is search result reset it.
            if (window.page.includes('/search')) {
                loadSubPage(window.page.slice(0, window.page.indexOf('/search')));
            }

            removeDropdownSearch();
            return false;
        });

        // Add all the relevant input event listeners for dropdown
        addDropdownEventListeners();

        // Mini search bar
        $('.topbar-mini-search', $topbar).rebind('click.mini-searchbar', () => {
            const $miniSearch = $('.mini-search', $topbar);
            $miniSearch.addClass('highlighted active');
            setTimeout(() => $('.mini-search input', $topbar).trigger('focus'), 350);
        });

        $('.mini-search input', $topbar)
            .rebind('keyup.mini-searchbar', function() {
                if ($(this).val().length) {
                    $('#mini-search-fake-form', $topbar).addClass('valid');
                }
                else {
                    $('#mini-search-fake-form', $topbar).removeClass('valid');
                }
            });

        $('.mini-search .topbar-mini-search-close', $topbar).rebind('click.close-mini-searchbar', () => {
            closeMiniSearch();
        });

    }

    /**
     * Adds event listeners related to the dropdown component
     *
     * @return {undefined}
     */
    function addDropdownEventListeners() {

        addVisibilityListeners();

        $dropdownResults = $('.dropdown-results', $dropdownSearch);
        $dropdownEmptyState = $('.dropdown-no-recents', $dropdownSearch);
        $dropdownRecents = $('.dropdown-recents', $dropdownSearch);
        $fileSearch = $('.js-filesearcher', $topbar);

        // Dropdown trigger when clicking after dropdown has been hidden
        $fileSearch.rebind('click.searchbar', () => {
            renderUpdatedDropdown().then(()=>{
                delay('searchbar.click', eventlog.bind(null, 99898));
                $dropdownResults.addClass('hidden');
            });
        });

        // Show only results if there is user provides text in the input
        $fileSearch.rebind('input.searchbar', ({target}) => {
            if (target.value.length > 0) {

                $dropdownSearch.removeClass('hidden');

                // Hide recents
                $('.dropdown-recents.dropdown-section', $dropdownSearch).addClass('hidden');
                $dropdownEmptyState.addClass('hidden');

                hideDropdown();

                // Show search results
                // $dropdownResultsSection.removeClass('hidden');
            }
            else {
                // Hide search results if input is blank
                $dropdownResults.addClass('hidden');

                renderUpdatedDropdown();
            }
        });

        // Clear all - Recently searched terms
        $('.js-dropdownClearRecentlySearched', $topbar).rebind('click.rsClear', () => {
            recentlySearched.clear();
        });
    }

    /**
     * Remove dropdown visibility listeners
     *
     * @return {undefined}
     */
    function removeVisibilityListeners() {
        $('.fmholder').unbind('click.searchbar');
        $fileSearch = $fileSearch || $('.js-filesearcher', $topbar);
        $fileSearch.unbind('focus.searchbar');
    }

    /**
     * Reattach dropdown visibility listeners
     *
     * @return {undefined}
     */
    function addVisibilityListeners() {

        $fileSearch = $fileSearch || $('.js-filesearcher', $topbar);

        // Dropdown trigger on focus
        $fileSearch.rebind('focus.searchbar', () => {
            showEmptyState = recentlySearched.terms.size !== 0
                && recentlyOpened.files.size !== 0;
            renderUpdatedDropdown();
        });


        // Escape key hides dropdown
        $('#bodyel').rebind('keydown.searchbar', (event) => {
            if (event.key === 'Escape') {
                hideDropdown();
            }
        });
    }

    /**
     * Shows the correct search bar and clears it.
     *
     * @param {string} [page] - the current page/location/URL
     * @return {undefined}
     */
    function refreshSearch(page) {
        if (!$topbar) {
            return initSearch(page);
        }
        page = page || window.page;

        showCorrectSearch(page);
        closeMiniSearch();

        $fileSearch = $fileSearch || $('.js-filesearcher', $topbar);

        // If we navigate back to the search page, show the search term and button
        if (page.includes('search/')) {
            $fileSearch.val(page.split('/').pop());
            $('.js-btnclearSearch', $topbar).removeClass('hidden');
        }
        else {
            $fileSearch.val('');
            $('.js-btnclearSearch', $topbar).addClass('hidden');
        }
    }

    /**
     * Shows/hides the different search bars depending on the current page
     *
     * @param {string} page - the URL path
     * @return {undefined}
     */
    function showCorrectSearch(page) {

        const $topbar = $('#startholder .js-topbar, #fmholder .js-topbar');
        const $miniSearch = $('.mini-search', $topbar);
        const $mainSearch = $('.searcher-wrapper .js-topbar-searcher', $topbar);

        // Show the correct search bar
        if ((u_type !== false || pfid) && !pfcol) {
            const rex = /\/(?:account|dashboard|user-management|refer|devices|rewind)/;
            const isSearch = page.startsWith('fm/search');

            if (M.chat || !is_fm() || (rex.test(page) && !isSearch)) {
                $miniSearch.removeClass('hidden');
                $mainSearch.addClass('hidden');
            }
            else {
                $miniSearch.addClass('hidden');
                $mainSearch.removeClass('hidden');
            }
        }
        else {
            // static (logged out), other pages
            $miniSearch.addClass('hidden');
            $mainSearch.addClass('hidden');
        }
    }

    /**
     * Hides the dropdown
     *
     * @param {boolean} resetDOMCache Set to true when its necessary to re-cache the DOM node
     *
     * @return {undefined}
     */
    function hideDropdown(resetDOMCache = false) {
        if (resetDOMCache || !$dropdownSearch) {
            $dropdownSearch = $('.dropdown-search', $topbar);
        }


        if ($dropdownSearch) {
            $dropdownSearch.addClass('hidden');
        }
    }

    /**
     * Renders the dropdown
     *
     * @param {boolean} hasDeletedOrCleared Set to true if after a delete or clear in `recentlySearched`
     * @return {undefined}
     */
    async function renderUpdatedDropdown(hasDeletedOrCleared = false) {

        if (folderlink) {
            return;
        }
        await Promise.all([recentlySearched.refresh(), recentlyOpened.refresh()]);

        const hideRecents = mega.config.get('showRecents') !== 1;
        const noRecentlySearched = recentlySearched.terms.size === 0;
        const noRecentlyOpened = recentlyOpened.files.size === 0;
        const noRecentActivity = noRecentlySearched && noRecentlyOpened;

        clearRecentMemoryIfRequired(hideRecents, noRecentActivity).catch(dump);

        // If we came from a delete/clear operation and there is no recent activity left to show,
        // Set the show empty state flag
        if (hasDeletedOrCleared && noRecentActivity) {
            showEmptyState = true;
        }

        $dropdownEmptyState = $dropdownEmptyState || $('.dropdown-no-recents', $dropdownSearch);
        $dropdownRecents = $dropdownRecents || $('.dropdown-recents', $dropdownSearch);

        // Hide dropdown if Hide Recents is on
        if (hideRecents || noRecentActivity && !showEmptyState) {
            hideDropdown();
            return;
        }

        // If recent activity is turned off, render recents
        $dropdownSearch.removeClass('hidden');

        // If there is no recent activity and the empty state flag is set,
        // show the empty state only
        if (noRecentActivity && showEmptyState) {
            $dropdownEmptyState.removeClass('hidden');
            $dropdownRecents.addClass('hidden');
            return;
        }

        if (noRecentActivity && !showEmptyState) {
            hideDropdown();
            return;
        }

        // Show recents section
        $dropdownEmptyState.addClass('hidden');
        $dropdownRecents.removeClass('hidden');

        // Show recently searched items
        renderRecentlySearchedItems();

        // Show recently opened files
        renderRecentlyOpenedItems();
    }

    /**
    * Clears the recent memory if required based on conditions.
    *
    * If the 'hideRecents' flag is active and there's recent activity, this function clears
    * the memory of recent searches and recent opened files.
    *
    * @param {boolean} hideRecents - Flag indicating if recent items should be hidden. Fetch this before passing.
    * @param {boolean} noRecentActivity - Flag indicating if there's no recent activity.
     * @return {Promise}
    */
    async function clearRecentMemoryIfRequired(hideRecents, noRecentActivity) {
        if (hideRecents && !noRecentActivity) {
            return Promise.all([recentlySearched.clear(), recentlyOpened.clear()]);
        }
    }

    /**
     * Populates the recently seached items section in the searchbar dropdown
     *
     * @return {undefined}
     */
    function renderRecentlySearchedItems() {

        $dropdownRecents = $dropdownRecents || $('.dropdown-recents', $dropdownSearch);

        const $dropdownRecentlySearched = $('.dropdown-recently-searched-wrapper', $dropdownRecents);

        const $itemTemplate = $('.dropdown-recently-searched-template', $dropdownRecents);

        if (recentlySearched.terms.size === 0) {
            $dropdownRecentlySearched.addClass('hidden');
            return;
        }

        $dropdownRecentlySearched.removeClass('hidden');

        const makeRecentlySearchedTermItem = (term) => {
            const $item = $itemTemplate.clone();
            $item.removeClass('dropdown-recently-searched-template hidden');
            $('.dropdown-recently-searched-item-text', $item).text(term);
            return $item.prop('outerHTML');
        };

        const $recentlySearchedBody = $('.dropdown-recently-searched > .dropdown-section-body', $dropdownRecents);

        $recentlySearchedBody.empty();

        const recentlySearchedArr = [...recentlySearched.terms];

        for (let i = recentlySearchedArr.length - 1, nb = 0;
            i >= 0 && nb < recentlySearched.numTermsInView;
            i--, nb++) {

            const item = makeRecentlySearchedTermItem(recentlySearchedArr[i]);
            $recentlySearchedBody.safeAppend(item);
        }

        $fileSearch = $fileSearch || $('.js-filesearcher', $topbar);

        // Onclick behavior for each item in recently searched terms
        // Clicking recently searched term - triggers the search again
        $('.dropdown-recently-searched-item', $dropdownRecents).rebind('click', function(event) {
            const itemText = $(this).children('div')[0].innerText;
            // If (x) is clicked, delete the item
            if ($(event.target).closest('.dropdown-recent-item-delete-icon').length !== 0) {
                recentlySearched.deleteTerm(itemText);
                return;
            }

            // Otherwise, trigger the search again
            delay('recentlySearched.click', eventlog.bind(null, 99899));
            $dropdownSearch.unbind('blur');
            $fileSearch.val(itemText);
            $('#main-search-fake-form', $topbar).trigger('submit');
            $dropdownSearch.rebind('blur', () => {
                hideDropdown();
            });
        });
    }

    /**
     * Populates the suggested searched items section in the searchbar dropdown
     *
     * @return {undefined}
     */
    function renderSuggestSearchedItems(event) {
        const term = $.trim($(event.currentTarget).val());

        if (term.length < 3 || event.key === 'Enter') {
            return removeDropdownSearch();
        }

        if (!$dropdownResults) {
            $dropdownResults = $('.dropdown-results', $dropdownSearch);
        }

        const $dropdownResultSearched = $('.dropdown-search-results', $dropdownResults);
        const $ddLoader = $('.search-loader', $dropdownSearch);

        $ddLoader.removeClass('hidden');
        const results = M.getFilterBy(M.getFilterBySearchFn(term));
        const nodes = results.filter(n => n.p !== M.RubbishID)
            .sort((a, b) => a.name.localeCompare(b.name))
            .sort((a, b) => a.name.length - b.name.length);

        if (nodes) {
            $ddLoader.addClass('hidden');
            $dropdownSearch.removeClass('hidden');
            $dropdownResults.removeClass('hidden');
        }

        if (!nodes || nodes.length === 0) {
            hideDropdown();
            $dropdownResultSearched.addClass('hidden');
            $('.js-btnclearSearch', $topbar).addClass('hidden');
            return;
        }

        const $itemTemplate = $('.dropdown-search-results-item-template', $dropdownResults);

        $dropdownResultSearched.removeClass('hidden');
        $('.js-btnclearSearch', $topbar).removeClass('hidden');

        const makeSearchResultItem = (node) => {
            const $item = $itemTemplate.clone();
            const $fileIconContainer = $('.dropdown-search-results-item-file-icon', $item);
            const $fileIcon = $('.item-type-icon', $fileIconContainer);
            const $match = $('.txt-bold', $item);
            const $suffix = $('.suffix', $item);
            const $dir = $('.dropdown-search-results-item-location', $item);
            const thumbUri = thumbnails.get(node.fa);

            // Highlight search text for the result filename/s
            const fileName = node.name;
            const index = fileName.toLowerCase().indexOf(term.toLowerCase());
            const match = fileName.slice(index, index + term.length);
            const suffix = fileName.slice(index + term.length, fileName.length);
            // Set location name Cloud drive or parent name
            let dir = node.p === M.RootID ? l[18051] : M.getNodeByHandle(node.p).name;

            if (index !== 0) {
                $('.prefix', $item).text(fileName.slice(0, index));
            }
            // Set location name into Incoming shares or Rubbish bin
            if (node.su && (!node.p || !M.d[node.p])) {
                dir = l[5542];
            }
            else if (node.p === M.RubbishID) {
                dir = l[167];
            }

            $item.removeClass('dropdown-search-results-item-template hidden');
            $item.attr('id', node.h);
            $match.text(match);
            $suffix.text(suffix);
            $dir.text(dir);
            $fileIcon.addClass(`icon-${fileIcon(node)}-24`);

            if (thumbUri) {
                const $imgNode = $('img', $fileIcon);
                $imgNode.attr('src', thumbUri);
                $fileIconContainer.addClass('thumb');
            }

            return $item.prop('outerHTML');
        };

        const $resultSearchBody = $('.dropdown-search-results > .dropdown-section-body', $dropdownResults);
        const maxSuggestions = 5;

        $resultSearchBody.empty();

        for (let i = 0; i < nodes.length && i < maxSuggestions; i++) {
            const item = makeSearchResultItem(nodes[i]);
            $resultSearchBody.safeAppend(item);
        }

        $('.dropdown-search-results-item', $dropdownResults).rebind('click.searchbar', (e) => {
            const h = $(e.currentTarget).attr('id');
            const n = M.getNodeByHandle(h);

            hideDropdown();
            $dropdownResultSearched.addClass('hidden');
            $resultSearchBody.empty();
            $('.js-filesearcher', $topbar).val('');

            if (n.t) {
                if (e.ctrlKey) {
                    $.ofShowNoFolders = true;
                }
                $('.top-context-menu').addClass('hidden');
                M.openFolder(h);
            }
            else if (M.getNodeRoot(n.h) === M.RubbishID) {
                propertiesDialog();
            }
            else if (is_image2(n) || is_video(n)) {
                if (is_video(n)) {
                    $.autoplay = h;
                }
                slideshow(h);
            }
            else if (is_text(n)) {
                $.selected = [h];
                $('.dropdown.body.context .dropdown-item.edit-file-item').trigger('click');
            }
            else {
                // Non previewable file should proceed to download
                M.addDownload([h]);
            }
        });
    }

    function removeDropdownSearch() {
        $dropdownSearch = $('.dropdown-search', $topbar).addClass('hidden');
        $('.dropdown-results', $dropdownSearch).addClass('hidden');
        $('.dropdown-search-results', $dropdownResults).addClass('hidden');
        $('.dropdown-search-results > .dropdown-section-body', $dropdownResults).empty();
    }

    /* Populates the recently opened items section in the searchbar dropdown
    *
    * @return {undefined}
    */
    function renderRecentlyOpenedItems() {

        $dropdownRecents = $('.dropdown-recents', $dropdownSearch);

        const $dropdownRecentlyOpened = $('.dropdown-recently-opened-wrapper', $dropdownRecents);

        if (recentlyOpened.files.size === 0) {
            $dropdownRecentlyOpened.addClass('hidden');
            return;
        }

        const $itemTemplate = $('.dropdown-recently-opened-template', $dropdownRecents);

        $dropdownRecentlyOpened.removeClass('hidden');

        const makeRecentlyOpenedFileItem = ({h: handle, e: editable}) => {

            // TODO: FIX SHARED LOGIC + ASYNC CONVERT
            const node = M.getNodeByHandle(handle);
            const parentNode = M.getNodeByHandle(node.p);
            const parentName = parentNode.h === M.RootID
                ? l[1687]
                : parentNode.name;
            const thumbUri = thumbnails.get(node.fa);

            const filename = node.name;
            const iconClass = fileIcon(node);
            const date = new Date(node.mtime * 1000);

            const $item = $itemTemplate.clone();
            const $icon = $('.item-type-icon', $item);

            $item.removeClass('dropdown-recently-opened-template hidden');
            $item.attr('data-id', handle);
            $item.attr('data-editable', editable);

            $icon.addClass(`icon-${iconClass}-24`);
            $('.dropdown-recently-opened-item-filename', $item).text(filename);
            $('.dropdown-recently-opened-item-location', $item).text(parentName);
            $('.dropdown-recently-opened-item-time', $item).text(time2date(date.getTime() / 1000, 1));

            if (thumbUri) {
                const $imgNode = $('img', $icon);
                $imgNode.attr('src', thumbUri);
                $('.dropdown-recently-opened-item-file-icon', $item).addClass('thumb');
            }

            return $item.prop('outerHTML');
        };

        const $recentlyOpenedBody = $('.dropdown-recently-opened > .dropdown-section-body', $dropdownRecents);

        $recentlyOpenedBody.empty();

        const recentlyOpenedArr = [...recentlyOpened.files.values()];

        for (let i = recentlyOpenedArr.length - 1, nb = 0;
            i >= 0 && nb < recentlyOpened.numFilesInView;
            i--, nb++) {
            if (M.getNodeByHandle(recentlyOpenedArr[i].h)) {
                const item = makeRecentlyOpenedFileItem(recentlyOpenedArr[i]);
                $recentlyOpenedBody.safeAppend(item);
            }
        }

        $fileSearch = $fileSearch || $('.js-filesearcher', $topbar);

        // Onclick behavior for each item in recently opened files
        // Clicking recently opened file - previews the file again
        $('.dropdown-recently-opened-item', $dropdownRecents).rebind('click.recentlyOpenedItem', function() {

            // Preview the file
            delay('recentlyOpened.click', eventlog.bind(null, 99905));
            hideDropdown();
            const {id, editable} = $(this).data();

            recentlyOpened.addFile(id, editable);

            M.viewMediaFile(id);
        });
    }

    /**
     * Closes the mini search back to a button, and clears the contents
     *
     * @return {undefined}
     */
    function closeMiniSearch() {
        const $miniSearch = $('.mini-search', $topbar);
        if ($miniSearch && ($miniSearch.hasClass('active') ||
            $miniSearch.hasClass('highlighted'))) {

            $miniSearch.removeClass('active highlighted');
            setTimeout(() => {
                $('.mini-search input', $topbar).value = '';
                $('form', $miniSearch).removeClass('valid');
            }, 350);
        }
    }

    /** @class mega.ui.searchbar */
    return freeze({
        init: initSearch,
        refresh: refreshSearch,
        closeMiniSearch,
        recentlySearched,
        recentlyOpened,
        addDropdownEventListeners,
    });
});

mBroadcaster.once('fm:initialized', () => {
    'use strict';
    mega.ui.searchbar.init();
});
