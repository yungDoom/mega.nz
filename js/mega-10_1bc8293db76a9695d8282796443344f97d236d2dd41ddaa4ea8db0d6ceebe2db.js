/* Bundle Includes:
 *   js/fm/fileTextEditor.js
 *   js/fm/textEditorUI.js
 *   js/transfers/xhr2.js
 *   js/transfers/queue.js
 *   js/transfers/utils.js
 *   js/transfers/meths/cache.js
 *   js/transfers/meths/memory.js
 *   js/transfers/meths/filesystem.js
 *   js/transfers/downloader.js
 *   js/transfers/decrypter.js
 *   js/transfers/download2.js
 *   js/transfers/meths.js
 *   js/transfers/upload2.js
 *   js/transfers/reader.js
 *   js/transfers/zip64.js
 *   js/transfers/cloudraid.js
 *   index.js
 *   js/filetypes.js
 */

/** This class is the core of text file editor.
 * It will handle uploading/downloading of data
 * and performs memory/bandwidth optimization.
*/

mega.fileTextEditor = new function FileTextEditor() {
    "use strict";
    // the maximum slots in memory for edited files
    // we have the maximum editable file size = 20MB --> max Total = 100MB
    var maxFilesInMemory = 5;

    var filesDataMap = Object.create(null);
    var slotIndex = 0;
    var slotsMap = [null, null, null, null, null];


    /**
     * store data in memory
     * @param {String} handle       Node handle
     * @param {String} data         File data
     * @returns {Void}              void
     */
    var storeFileData = function(handle, data) {
        // If the handle is already in a slot update the data
        if (slotsMap.includes(handle)) {
            filesDataMap[handle] = data;
            return;
        }
        // If there is something in the current slot dump it
        if (slotsMap[slotIndex]) {
            filesDataMap[slotsMap[slotIndex]] = null;
            delete filesDataMap[slotsMap[slotIndex]];
        }
        // Add the handle to the slot and increment the index
        slotsMap[slotIndex++] = handle;
        // store the data in memory
        filesDataMap[handle] = data;

        // round-robin
        if (slotIndex > maxFilesInMemory - 1) {
            slotIndex = 0;
        }
    };

    /**
     * Get as Text from Buffer
     * @param   {ArrayBuffer} buffer    Text Data in ArrayBuffer
     * @returns {Promise}               Promise of the Blob Text
     */
    this.getTextFromBuffer = function(buffer) {
        const bData = new Blob([buffer], { type: "text/plain" });
        return M.readBlob(bData, 'readAsText');
    };

    /**
     * Get cached data
     * @param {String} handle    Node handle
     */
    this.getCachedData = function(handle) {
        if (filesDataMap[handle]) {
            return filesDataMap[handle];
        }
    };

    /**
     * Cache data
     * @param {String} handle           Node handle
     * @param {String} text             Text content to be cached
     * @param {boolean} isPartialData   Is Partial data flag
     */
    this.cacheData = function(handle, text, isPartialData) {

        if (filesDataMap[handle]) {
            if (filesDataMap[handle].partial && !isPartialData) {
                this.clearCachedFileData(handle);
                storeFileData(handle, {text: text, partial: isPartialData});
            }
        }
        else {
            storeFileData(handle, {text: text, partial: isPartialData});
        }
    };

    /**
     * Get file data
     * @param {String} handle       Node handle
     * @returns {MegaPromise}       Promise of the operation
     */
    this.getFile = function(handle) {

        // eslint-disable-next-line local-rules/hints
        var operationPromise = new MegaPromise();
        var node = M.getNodeByHandle(handle);
        handle = node.link || node.h;

        // if called with no handle or invalid one, exit
        if (!handle) {
            if (d) {
                console.error('Handle rejected in getFile ' + handle);
            }
            return operationPromise.reject();
        }

        // if we have the data cached, return it.
        if (filesDataMap[handle]) {
            return operationPromise.resolve(filesDataMap[handle]);
        }

        // this is empty file, no need to bother Data Servers + API
        if (node.s <= 0 && M.d[node.h]) {
            storeFileData(handle, '');
            return operationPromise.resolve(filesDataMap[handle]);
        }
        else if (node.s <= 0) {
            showToast('view', l[22]);
            return operationPromise.reject();
        }

        // get the data
        M.gfsfetch(handle, 0, -1).then((data) => {

            if (data.buffer === null) {
                return operationPromise.reject();
            }
            var bData = new Blob([data.buffer], { type: "text/plain" });
            var binaryReader = new FileReader();


            binaryReader.addEventListener('loadend', function(e) {
                var text = e.srcElement.result;
                storeFileData(handle, text);
                operationPromise.resolve(filesDataMap[handle]);
            });
            binaryReader.readAsText(bData);

        }).catch((ex) => {
            if (ex === EOVERQUOTA || Object(ex.target).status === 509) {
                dlmanager.setUserFlags();
                dlmanager.showOverQuotaDialog();
            }
            // local file does not exist
            else if (ex === ENOENT) {
                showToast('view', l[22]);
            }
            operationPromise.reject();
        });

        return operationPromise;
    };

    /**
     * Set file's data (save it)
     * @param {String} handle           Node's handle
     * @param {String} content          Text content to be saved
     * @returns {MegaPromise}           Operation Promise
     */
    this.setFile = function(handle, content) {
        // eslint-disable-next-line local-rules/hints
        var operationPromise = new MegaPromise();

        // if called with no handle or invalid one, exit
        if (!handle || !M.d[handle]) {
            return operationPromise.reject();
        }

        var fileNode = M.d[handle];
        var fileType = filemime(fileNode);

        var nFile = new File([content], fileNode.name, { type: fileType });
        nFile.target = fileNode.p;
        nFile.id = ++__ul_id;
        nFile.path = '';
        nFile.isCreateFile = true;
        nFile._replaces = handle;
        nFile.promiseToInvoke = operationPromise;

        operationPromise.done(function(vHandle) {
            // no need to clear here, since we are adding + removing
            filesDataMap[handle] = null;
            delete filesDataMap[handle];
            filesDataMap[vHandle] = content;
        });

        ul_queue.push(nFile);
        return operationPromise;
    };

    /**
     * Save text file As
     * @param {String} newName          New name
     * @param {String} directory        Destination handle
     * @param {String} content          Text content to be saved
     * @param {String} nodeToSaveAs     Original node's handle
     * @returns {MegaPromise}           Operation Promise
     */
    this.saveFileAs = async function(newName, directory, content, nodeToSaveAs) {

        if (!newName || !directory || !(nodeToSaveAs || content)) {
            if (d) {
                console.error('saveFileAs is called incorrectly newName=' + newName +
                    ' dir=' + directory + ' !content=' + !content + ' nodetoSave=' + nodeToSaveAs);
            }
            throw EARGS;
        }

        // if content is not changed, then do a copy operation with new name
        if (typeof content === 'undefined' || content === null) {
            if (typeof nodeToSaveAs === 'string') {
                nodeToSaveAs = M.d[nodeToSaveAs];
            }
            var nNode = Object.create(null);
            var node = clone(nodeToSaveAs);

            node.name = M.getSafeName(newName);
            nNode.k = node.k;
            node.lbl = 0;
            node.fav = 0;
            delete node.rr;
            nNode.a = ab_to_base64(crypto_makeattr(node, nNode));
            nNode.h = node.h;
            nNode.t = node.t;

            var opTree = [nNode];
            opTree.opSize = node.s || 0;

            return M.copyNodes([nodeToSaveAs], directory, null, opTree);
        }
        // if content changed then do upload operation
        else {
            var fType = filemime(newName);
            var nFile = new File([content], newName, {type: fType});
            nFile.target = directory;
            nFile.id = ++__ul_id;
            nFile.path = '';
            nFile.isCreateFile = true;
            (nFile.promiseToInvoke = mega.promise)
                .then((nHandle) => {
                    storeFileData(nHandle, content);
                });

            ul_queue.push(nFile);
            return nFile.promiseToInvoke;
        }
    };

    /**
     * Remove previously created version, this is used when users do multiple saves to the same file.
     * @param {String} handle       Node's handle
     * @returns {Void}              void
     */
    this.removeOldVersion = function(handle) {
        api_req({ a: 'd', n: handle, v: 1 });
    };

    this.clearCachedFileData = function(handle) {
        if (filesDataMap[handle]) {
            filesDataMap[handle] = null;
            delete filesDataMap[handle];
        }
    };
};

/**
 * UI Controller to handle operations on the UI of text Editor
 * */
mega.textEditorUI = new function TextEditorUI() {
    "use strict";
    var $editorTextarea;

    var fileHandle;
    var versionHandle;
    var fileName;
    var savedFileData;

    var editor;
    var initialized = false;

    var $containerDialog;
    var $editorContainer;
    var $menuBar;
    var $saveButton;

    /**
     * Check if the file content has been changed and show a message if so
     * @param {String} msg          Message to show if file content is changed
     * @param {String} submsg       sub-message to show if file content is changed
     * @param {Function} callback   callback function to be called if file is not changed or user ignored changes.
     * @returns {Void}              void
     */
    var validateAction = function(msg, submsg, callback) {
        if (!$saveButton.hasClass('disabled')) {
            msgDialog(
                'confirmation',
                '',
                msg,
                submsg,
                function(e) {
                    if (e) {
                        callback();
                    }
                    else {
                        editor.focus();
                    }
                }
            );
        }
        else {
            callback();
        }
    };


    var selectedItemOpen = function(selected) {

        var openFile = function() {
            loadingDialog.show('common', l[23130]);
            var nodeHandle = ($.selected && $.selected[0]) || (selected && selected[0]);
            if (!nodeHandle) {
                loadingDialog.hide();
                return;
            }

            mega.fileTextEditor.getFile(nodeHandle).done(
                function(data) {
                    loadingDialog.hide();
                    mega.textEditorUI.setupEditor(M.d[nodeHandle].name, data, nodeHandle);
                }
            ).fail(function() {
                loadingDialog.hide();
            });
        };

        validateAction(l[22750], l[22754], openFile);

    };

    const bindEventsListner = function() {

        if (is_mobile) {
            return;
        }

        var changeListner = function() {
            $saveButton.removeClass('disabled');
            editor.off('change', changeListner);
        };

        editor.on('change', changeListner);

        $(window).rebind('keydown.texteditor', (e) => {
            if (e.code === 'Escape') {
                // IE not supported.
                confirmSaveOrExit();
            }
        });
    };

    var doClose = () => {
        $saveButton.addClass('disabled');
        $(window).off('keydown.texteditor');
        history.back();
        mega.textEditorUI.doClose();
    };

    var confirmSaveOrExit = () => {
        if ($saveButton.hasClass('disabled')) {
            doClose();
        }
        else {
            msgDialog(
                'save_discard_cancel',
                '',
                l.msg_dlg_modified_title,
                l.msg_dlg_modified_text,
                (e) => {
                    if (e === 1) {
                        $saveButton.trigger('click', doClose);
                    }
                    else if (e === 0) {
                        editor.focus();
                    }
                    else if (e === -1) {
                        doClose();
                    }
                }
            );
        }
    };

    var printText = function() {
        // Everything is sanitized.

        var mywindow = window.open('', escapeHTML(fileName), 'height=600,width=800');

        mywindow.document.write('<html><head><title>' + escapeHTML(fileName) + '</title>');
        mywindow.document.write('</head><body >');
        var textContent = mywindow.document.createElement('pre');
        textContent.textContent = editor.getValue();
        // eslint-disable-next-line no-restricted-properties
        mywindow.document.write(textContent.outerHTML);
        mywindow.document.write('</body></html>');

        mywindow.document.close();
        mywindow.focus();
        mywindow.print();
        mywindow.close();
        return true;
    };

    /** Init Controller
     * @param {jQuery} $viewerContainer  just use the plain text content block, aka viewer-mode
     *@returns {Void}       void
     */
    var init = function(txt, $viewerContainer) {
        $containerDialog = $viewerContainer || $('.text-editor-container', 'body');
        $editorContainer = $('.text-editor', $containerDialog.removeClass('hidden'));

        $editorTextarea = $('.content .txtar', $editorContainer);
        window.textEditorVisible = true;

        if (!editor) {
            editor = CodeMirror.fromTextArea($editorTextarea[0], {
                lineNumbers: true,
                scrollbarStyle: "overlay",
                autofocus: true,
                lineWrapping: true,
                readOnly: typeof $viewerContainer !== 'undefined'
            });
        }

        savedFileData = txt;
        editor.setValue(txt);

        if (initialized || is_mobile) {
            // Nothing else to do.
            return;
        }
        initialized = true;

        $editorContainer.resizable({
            handles: 'e',
            resize: function() {
                if (editor) {
                    editor.setSize();
                }
            }
        });

        if ($viewerContainer) {
            // No more business here.
            return;
        }

        $menuBar = $('.text-editor-bars', $editorContainer);
        $saveButton = $('.save-btn', $editorContainer);

        const fileMenu = contextMenu.create({
            template: $('#text-editor-file-menu', $containerDialog)[0],
            sibling: $('.file-btn', $containerDialog)[0],
            animationDuration: 150,
            boundingElement: $containerDialog[0]
        });

        const formatMenu = contextMenu.create({
            template: $('#text-editor-format-menu', $containerDialog)[0],
            sibling: $('.format-btn', $containerDialog)[0],
            animationDuration: 150,
            boundingElement: $containerDialog[0]
        });

        const $saveAsBtn = $('.file-menu .save-as-f', $editorContainer);

        $('.file-btn', $menuBar).rebind(
            'click.txt-editor',
            function textEditorMenuOpen() {
                if ($(this).hasClass('disabled')) {
                    return false;
                }
                contextMenu.toggle(fileMenu);
                return false;
            }
        );

        $('.format-btn', $menuBar).rebind(
            'click.txt-editor',
            function textEditorMenuOpen() {
                if ($(this).hasClass('disabled')) {
                    return false;
                }
                contextMenu.toggle(formatMenu);
                return false;
            }
        );

        $editorContainer.rebind(
            'mouseup.txt-editor',
            function textEditorGlobalClick() {
                contextMenu.close(fileMenu);
                contextMenu.close(formatMenu);
                return false;
            }
        );

        $('header .close-btn, .file-menu .close-f', $editorContainer).rebind(
            'click.txt-editor',
            function textEditorCloseBtnClick() {

                if (editor) {
                    confirmSaveOrExit();
                }
                else {
                    history.back();
                    mega.textEditorUI.doClose();
                }
                return false;
            }
        );

        $saveButton.rebind(
            'click.txt-editor',
            function textEditorSaveBtnClick(e, cb) {
                if ($(this).hasClass('disabled')) {
                    return false;
                }
                if (editor) {
                    $saveButton.addClass('disabled');

                    const getSavedFile = fh => {

                        if (!fh) {
                            $saveButton.removeClass('disabled');
                        }

                        mega.textEditorUI.getVersionedHandle(fh);

                        bindEventsListner();

                        if (fh) {
                            selectionManager.resetTo(fh, true);
                            fileName = M.d[fh].name;
                            $('.text-editor-file-name span', $editorContainer).text(fileName);
                        }

                        if (M.currentrootid !== M.RubbishID) {
                            mega.ui.searchbar.recentlyOpened.files.delete(fileHandle);
                            mega.ui.searchbar.recentlyOpened.addFile(fh, true);
                        }

                        if (cb && typeof cb === 'function') {
                            cb();
                        }
                    };

                    mega.textEditorUI.save(fileHandle, versionHandle, editor.getValue())
                        .then(getSavedFile)
                        .catch(tell)
                        .finally(() => {
                            loadingDialog.hide('common');
                        });
                }
            }
        );

        $('.file-menu .open-f', $menuBar).rebind(
            'click.txt-editor',
            function openFileClick() {
                M.initFileAndFolderSelectDialog('openFile', selectedItemOpen);
            }
        );

        $('.file-menu .save-f', $menuBar).rebind(
            'click.txt-editor',
            function saveFileMenuClick() {
                $saveButton.trigger('click');
            }
        );

        $('.file-menu .new-f', $menuBar).rebind(
            'click.txt-editor',
            function newFileMenuClick() {
                validateAction(
                    l[22750],
                    l[22752],
                    mega.textEditorUI.saveAs.bind(mega.textEditorUI, true)
                );
            }
        );

        $saveAsBtn.rebind('click.txt-editor', mega.textEditorUI.saveAs.bind(mega.textEditorUI, false));

        $('.file-menu .get-link-f', $menuBar).rebind(
            'click.txt-editor',
            function getLinkFileMenuClick() {
                selectionManager.clear_selection();
                selectionManager.add_to_selection(versionHandle || fileHandle);
                $('.dropdown.body.context .dropdown-item.getlink-item').trigger('click');
            }
        );

        $('.file-menu .send-contact-f', $menuBar).rebind(
            'click.txt-editor',
            function sendToContactMenuClick() {
                selectionManager.clear_selection();
                selectionManager.add_to_selection(versionHandle || fileHandle);
                $('.dropdown.body.context .dropdown-item.send-to-contact-item').trigger('click');
            }
        );

        $('.file-menu .print-f', $menuBar).rebind('click.txt-editor', printText);

        $('.format-menu .wrap-text', $editorContainer).rebind(
            'click.txt-editor',
            function wrapTextMenuClick() {
                const $tick = $('.icon-check', $(this));
                if ($tick.hasClass('hidden')) {
                    $tick.removeClass('hidden');
                    if (editor) {
                        editor.setOption('lineWrapping', true);
                    }
                }
                else {
                    $tick.addClass('hidden');
                    if (editor) {
                        editor.setOption('lineWrapping', false);
                    }
                }
            }
        );

        $('footer .download-btn', $editorContainer).rebind(
            'click.txt-editor',
            function downloadBtnClicked() {
                validateAction(
                    l[22750],
                    l[22753],
                    () => {
                        M.saveAs(savedFileData, fileName);
                    }
                );
            }
        );

        var hotkey = 'ctrlKey';
        if (ua.details.os === 'Apple') {
            $('button.open-f .shortcut', $editorContainer).text(' ');
            $('button.close-f .shortcut', $editorContainer).text(' ');
            $('button.save-f .shortcut', $editorContainer).text('\u2318 S');
            $('button.save-as-f .shortcut', $editorContainer).text('\u21E7\u2318 S');
            $('button.print-f .shortcut', $editorContainer).text('\u2318 P');
            hotkey = 'metaKey';
        }

        $editorContainer.rebind(
            'keydown.txt-editor',
            function keydownHandler(event) {
                if (event[hotkey]) {
                    switch (event.code) {
                        case 'KeyS':
                            if (event.shiftKey) {
                                $saveAsBtn.trigger('click');
                            }
                            else {
                                $saveButton.trigger('click');
                            }
                            return false;
                        case 'KeyO':
                            if (event.shiftKey) {
                                return true;
                            }
                            $('.context-menu .open-f', $editorContainer).trigger('click');
                            return false;
                        case 'KeyQ':
                            if (event.shiftKey) {
                                return true;
                            }
                            $('.context-menu .close-f', $editorContainer).trigger('click');
                            return false;
                        case 'KeyP':
                            if (event.shiftKey) {
                                return true;
                            }
                            $('.context-menu .print-f', $editorContainer).trigger('click');
                            return false;
                    }
                }
                return true;
            }
        );
    };

    this.save = async(fh, vh, val) => {
        const rights = M.getNodeRights(fh);
        let res;
        if (rights < 1) {
            this.saveAs(fh);
            return false;
        }

        loadingDialog.show('common', l[23131]);

        if (rights === 1 && M.getNodeRoot(fh) === 'shares') {
            const name = fileconflict.findNewName(M.getSafeName(M.d[fh].name), M.d[fh].p);
            res = await Promise.resolve(
                val
                    ? mega.fileTextEditor.saveFileAs(name, M.d[fileHandle].p, val)
                    : M.addNewFile(name, M.d[fileHandle].p)
            ).catch(dump);

            return res;
        }

        const data = await M.getStorageQuota();

        if (data.isFull) {
            loadingDialog.hide('common');
            ulmanager.ulShowOverStorageQuotaDialog();
            return false;
        }
        res = await Promise.resolve(mega.fileTextEditor.setFile(vh || fh, val)).catch(dump);
        return res;
    };

    this.saveAs = n => {
        // loadingDialog.show();
        let node = {name: 'New file.txt'};
        let contents = '';
        let editedTxt;

        if (typeof n === 'object') {
            node = n;
        }
        else if (!n) {
            editedTxt = editor.getValue();
            if (editedTxt === savedFileData) {
                editedTxt = null;
            }

            node = versionHandle || fileHandle;
            contents = editedTxt;
        }

        openSaveAsDialog(
            node,
            contents,
            async h => {

                $.selected = Array.isArray(h) ? h : [h];
                h = $.selected[0];
                const data = await M.getStorageQuota().catch(dump);

                loadingDialog.hide();

                if (data.isFull) {
                    ulmanager.ulShowOverStorageQuotaDialog();
                    return false;
                }

                if (is_mobile) {
                    mega.ui.viewerOverlay.show(h);
                }
                else {
                    mega.textEditorUI.setupEditor(M.d[h].name, editedTxt || savedFileData, h);
                }
                return h;
            }
        );
    };

    this.getVersionedHandle = function(fh) {
        if (versionHandle) {
            mega.fileTextEditor.removeOldVersion(versionHandle);
            versionHandle = fh;
        }
        else if (M.d[fileHandle] && M.d[fileHandle].s === 0) {
            mega.fileTextEditor.removeOldVersion(fileHandle);
            fileHandle = fh;
            versionHandle = '';
        }
        else {
            versionHandle = fh;
        }

        savedFileData = editor.getValue();

        return [fileHandle, versionHandle];
    };

    this.doClose = function() {
        if (editor) {
            editor.setValue('');
        }
        if ($containerDialog) {
            $containerDialog.addClass('hidden');
            window.textEditorVisible = false;
            mBroadcaster.sendMessage('textEditor:close');
        }
        mBroadcaster.sendMessage('text-editor:close');
    };

    /**
     * Setup and init Text editor.
     * @param {String} fName        File name
     * @param {String} txt          File textual content
     * @param {String} handle       Node handle
     * @param {Boolean} isReadonly  Flag to open Editor in read-only mode
     * @param {jQuery} $viewerContainer  just use the plain text content block, aka viewer-mode
     * @returns {Void}              void
     */
    this.setupEditor = function(fName, txt, handle, isReadonly, $viewerContainer) {
        return Promise.resolve(M.require('codemirror_js', 'codemirrorscroll_js')).then(() => {
            if ($viewerContainer) {
                this.cleanup();
                init(txt, $viewerContainer);

                // Stop scroll event propagation when scroll inside codemirror
                $('.CodeMirror-scroll', $editorContainer).rebind('scroll.txtviewer mousewheel.txtviewer', (e) => {
                    e.stopPropagation();

                    delay('txt.viewer:scroll-info', () => {
                        const info = editor && editor.getScrollInfo() || false;
                        const scrollPos = info.height - (info.top + info.clientHeight);
                        if (scrollPos <= 20) {
                            mBroadcaster.sendMessage('txt.viewer:scroll-bottom', editor);
                        }
                    }, 60);
                });
            }
            else {
                pushHistoryState();
                init(txt);
                mBroadcaster.sendMessage('textEditor:open');

                const root = M.getNodeRoot(handle);
                const inRubbishBin = root === M.RubbishID;

                // Without parentheses && will be applied first,
                // I want JS to start from left and go in with first match
                // eslint-disable-next-line no-extra-parens
                if (isReadonly || folderlink || (M.currentrootid === 'shares' && M.getNodeRights(handle) < 1) ||
                    inRubbishBin || root === M.InboxID) {
                    editor.options.readOnly = true;

                    if (is_mobile) {
                        editor.options.readOnly = 'nocursor';
                    }

                    $('header .file-btn', $editorContainer).addClass('disabled');
                    $('.save-btn', $editorContainer).addClass('hidden');

                    if (inRubbishBin) {
                        $('footer .download-btn', $editorContainer).addClass('hidden');
                    }
                }
                else {
                    editor.options.readOnly = false;
                    $('header .file-btn', $editorContainer).removeClass('disabled');
                    $('footer .save-btn', $editorContainer).removeClass('hidden');
                    $('footer .download-btn', $editorContainer).removeClass('hidden');
                }

                if (!is_mobile) {
                    bindEventsListner();
                    $saveButton.addClass('disabled');
                    $('.text-editor-file-name span', $editorContainer).text(fName);
                }

                editor.focus();
            }

            if (Array.isArray(handle)) {
                handle = handle[0];
            }

            fileHandle = handle;
            versionHandle = '';
            fileName = fName;
            if (page !== 'download') {
                eventlog(99807);
                if (M.currentrootid !== M.RubbishID) {
                    mega.ui.searchbar.recentlyOpened.addFile(handle, true);
                }
            }

            const $getLink = $('.file-menu .get-link-f', $menuBar);
            if (M.currentrootid === 'shares') {
                $getLink.addClass('hidden');
            }
            else {
                $getLink.removeClass('hidden');
            }

            this.editor = editor;
        });
    };

    /**
     * Clear editor instance to avoid container conflicts.
     * @returns {Void} void
     */
    this.cleanup = function() {
        this.doClose();
        if (editor) {
            editor.toTextArea();
        }
        editor = undefined;
        savedFileData = undefined;
        initialized = false;
    };
};

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2016 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

(function _xhrTransfersLogic(global) {
    "use strict";

    var xhrTimeout = parseInt(localStorage.xhrTimeout) || 12e4;
    var logger = MegaLogger.getLogger('xhr2');
    var debug = global.d && parseInt(localStorage.xhr2debug);
    var xhrStack = [];

    /**
     * Simulate high speed network.
     * @private
     */
    function HSBHttpRequest() {
        this.status = 0;
        this.upload = this;
        this.statusText = '';
        this.responseType = 'text';
        this.readyState = XMLHttpRequest.UNSENT;
        this.logger = new MegaLogger('HSBHttpRequest', {}, logger);
    };
    HSBHttpRequest.prototype = Object.freeze({
        constructor: HSBHttpRequest,

        open: function(meth, url) {
            this.logger.info(meth, url);
            this.readyState = XMLHttpRequest.OPENED;

            var size = url.split('/').pop().split('-');
            this.dataSize = size[1] - size[0] + 1;
        },
        send: function() {
            this.logger.info('send', arguments);

            var self = this;
            setTimeout(function() {
                (function tick(state) {
                    if (self.readyState === XMLHttpRequest.UNSENT) {
                        self.logger.error('aborted...');
                        return;
                    }
                    var done = (++state === XMLHttpRequest.DONE);

                    if (!done) {
                        setTimeout(function() {
                            tick(state);
                        }, 90 * Math.random());
                    }
                    else {
                        var ev = new $.Event('progress');
                        ev.target = self;
                        ev.loaded = ev.total = self.dataSize;
                        self.onprogress(ev);

                        self.response = new Uint8Array(self.dataSize).buffer;
                    }

                    self.readyStateChange('readystatechange', state, done ? 200 : undefined);

                })(1);
            }, 90 * Math.random());
        },
        abort: function() {
            this.readyStateChange('abort', XMLHttpRequest.DONE);
            this.readyState = XMLHttpRequest.UNSENT;
        },
        readyStateChange: function(name, state, status) {
            var ev = new $.Event(name);
            ev.target = this;

            this.readyState = state;

            if (status !== undefined) {
                this.status = parseInt(status);
            }
            if (this.onreadystatechange) {
                this.onreadystatechange(ev);
            }
        }
    });

    /**
     * Get a new reusable XMLHttpRequest
     * @private
     */
    var getXMLHttpRequest = function _xhr2() {
        if (debug > 6) {
            return new HSBHttpRequest();
        }

        var idx = xhrStack.length;
        while (idx--) {
            var state = xhrStack[idx].readyState;
            if (state === 4 || state === 0) {
                break;
            }
        }

        if (idx < 0) {
            idx = xhrStack.push(new XMLHttpRequest) - 1;
        }
        return xhrStack[idx];
    };

    /**
     * Creates a new XMLHttpRequest for a transfer.
     *
     * @param {Object} listener
     *     The instance creating the request, either Download or Upload
     */
    var getTransferXHR = function getTransferXHR(listener) {
        if (!(this instanceof getTransferXHR)) {
            return new getTransferXHR(listener);
        }
        if (debug) {
            logger.debug('Creating new XHR for "%s"', listener);
        }

        var self = this;
        var xhr = getXMLHttpRequest();

        if (listener instanceof ClassChunk && Array.isArray(listener.dl.url)) {
            var bytes = listener.url.match(/(\d+)-(\d+)$/).map(Number);
            xhr = new CloudRaidRequest(listener.dl, bytes[1], ++bytes[2]);
        }

        xhr.onerror = function(ev) {
            self.abort(ev);
        };

        xhr.onreadystatechange = function(ev) {
            var readyState = this.readyState;
            var _logger = self.logger || logger;

            self.setTimeout();
            if (debug > 1) {
                _logger.debug('readystatechange:%d', readyState);
            }

            if (readyState === XMLHttpRequest.DONE) {
                if (!use_ssl) {
                    dlmanager.checkHSTS(this);
                }

                if (Object(self.listener).onXHRready) {
                    var result = self.listener.onXHRready(ev);

                    if (debug) {
                        _logger.debug('onXHRready', result);
                    }

                    // We have finished with this request, cleanup
                    self.abort(result);
                }
            }
            else if (readyState === XMLHttpRequest.HEADERS_RECEIVED) {
                self._ttfb = Date.now() - self.sendTime;
            }
        };

        var progress = function(ev) {
            if (debug > 1) {
                var _logger = self.logger || logger;
                _logger.debug('progress %d/%d', ev.loaded, ev.total);
            }

            self.setTimeout();

            self.total = ev.total;
            self.loaded = ev.loaded;

            if (Object(self.listener).onXHRprogress) {
                self.listener.onXHRprogress(ev);
            }
        };

        if (listener instanceof ChunkUpload) {
            xhr.upload.onprogress = progress;
        }
        else {
            xhr.onprogress = progress;
        }
        progress = undefined;

        this.xhr = xhr;
        this.timeout = null;
        this.listener = listener;
        this.owner = String(listener);

        if (debug) {
            this.logger = new MegaLogger(this.owner, {}, logger);
        }

        xhr = undefined;
    };

    getTransferXHR.prototype = Object.freeze({
        // Mimic XMLHttpRequest properties
        get status() {
            return Object(this.xhr).status;
        },
        get statusText() {
            return Object(this.xhr).statusText;
        },
        get readyState() {
            return Object(this.xhr).readyState;
        },
        get responseType() {
            return Object(this.xhr).responseType;
        },
        set responseType(type) {
            Object(this.xhr).responseType = type;
        },
        get response() {
            return Object(this.xhr).response;
        },
        get constructor() {
            return Object(this.xhr).constructor;
        },

        // Mimic XMLHttpRequest methods
        open: function _open() {
            this.openTime = Date.now();
            this.xhr.constructor.prototype.open.apply(this.xhr, arguments);
        },
        send: function _send() {
            this.sendTime = Date.now();
            this.xhr.constructor.prototype.send.apply(this.xhr, arguments);
        },

        /**
         * Abort/cleanup this XMLHttpRequest
         * @param {Object|Number} ev XHR event or one of ABORT_*
         */
        abort: function _abort(ev) {
            var xhr = this.xhr;
            if (debug) {
                var _logger = this.logger || logger;
                _logger.debug('_abort(%s)', ev, this);
            }

            if (xhr) {
                var type = ev && ev.type || 'error';

                if (!use_ssl) {
                    dlmanager.checkHSTS(xhr);
                }

                if (this.listener) {
                    var listener = this.listener;
                    this.listener = null;

                    // Notify the listener if there was an error
                    if (ev === this.ABORT_EINTERNAL
                            || ev === this.ABORT_TIMEOUT) {

                        if (listener.onXHRerror) {
                            listener.onXHRerror(ev, xhr, type);
                        }
                    }
                }

                xhr.onerror = null;
                xhr.onprogress = null;
                xhr.upload.onprogress = null;
                xhr.onreadystatechange = null;

                this.xhr = null;
                xhr.constructor.prototype.abort.call(xhr);
            }

            this.abortTime = Date.now();
            this.clearTimeout();
        },

        // Wrapper for window's set/clear timeout
        setTimeout: function() {
            this.clearTimeout();

            this.timeout = setTimeout(function() {
                this.abort(this.ABORT_TIMEOUT);
            }.bind(this), xhrTimeout);

            // Keep a last activity record for this request
            this.xhrLastActivity = Date.now();
        },
        clearTimeout: function() {
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }
        },

        toString: function() {
            return '[object getTransferXHR(' + this.owner + ')]';
        },

        ABORT_CLEANUP: -0x80,
        ABORT_TIMEOUT: -0x81,
        ABORT_EINTERNAL: -0x82
    });

    /**
     * Cleanup XMLHttpRequest instances.
     * This is usually invoked when transfers have finished.
     */
    var clearTransferXHRs = function() {
        var idx = xhrStack.length;

        logger.debug('clearTransferXHRs', idx);

        while (idx--) {
            var state = xhrStack[idx].readyState;
            if (state !== 4 && state !== 0) {
                logger.warn('Aborting XHR at #%d', idx);

                xhrStack[idx].abort();
            }
        }
        xhrStack = [];
    };

    // Export globals
    global.getTransferXHR = getTransferXHR;
    global.clearTransferXHRs = clearTransferXHRs;
    if (debug) {
        global.xhrStack = xhrStack;
    }

})(this);

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2016 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

function MegaQueue(worker, limit, name) {
    'use strict';
    var parentLogger;
    this._limit = limit || 5;
    this._queue = [];
    this._running = 0;
    this._worker = worker;
    this._noTaskCount = 0;
    this._expanded = 0;
    this._qpaused = {};
    this._pending = [];

    Object.defineProperty(this, "qname", {
        value: String(name || 'unk'),
        writable: false
    });
    Object.defineProperty(this, '__identity', {
        value: `mQueue[${this.qname}.${makeUUID().substr(-12)}]`
    });
    Object.defineProperty(this, 'tryProcess', {
        value: tryCatch(() => this.process(), () => this._process())
    });

    switch (name) {
        case 'downloader':
        case 'zip-writer':
        case 'download-writer':
        case 'decrypter-worker':
            parentLogger = dlmanager.logger;
            break;
        case 'uploader':
        case 'ul-filereader':
        case 'encrypter-worker':
            parentLogger = ulmanager.logger;
            break;
    }
    this.logger = MegaLogger.getLogger(this.__identity, {}, parentLogger);

    if (MegaQueue.weakRef) {
        MegaQueue.weakRef.set(this, Object.getPrototypeOf(this));
    }

    MegaEvents.call(this);
}
inherits(MegaQueue, MegaEvents);

MegaQueue.weakRef = window.d > 1 && new WeakMap();

MegaQueue.prototype.getSize = function() {
    return this._limit;
};

MegaQueue.prototype.setSize = function(size) {
    this._limit = size;
    this._process();
};

MegaQueue.prototype.isEmpty = function() {
    return this._running === 0
        && this._queue.length === 0;
};

MegaQueue.prototype.isFinalising = function(threshold) {
    'use strict';
    return this._running <= (threshold || 1) && this._queue.length === 0;
};

MegaQueue.prototype.pushFirst = function(arg, next, self) {
    if (d) {
        var found;
        for (var i in this._queue) {
            if (this._queue[i][0] === arg) {
                found = true;
                break;
            }
        }
        console.assert(!found, 'Huh, that task already exists');
    }
    this._queue.unshift([arg, next, self]);
    this._process();
};

MegaQueue.prototype.resume = function() {
    this._paused = false;
    this._process();
    this.trigger('resume');
};

// eslint-disable-next-line strict
MegaQueue.prototype.canExpand = is_mobile ? () => false : function() {
    return this._limit <= this._running && Math.max(0, this._limit - this._expanded) << 3 >= this._running;
};

/**
 * Expand temporarily the queue size, it should be called
 * when a task is about to end (for sure) so a new
 * task can start.
 *
 * It is useful when download many tiny files
 */
MegaQueue.prototype.expand = function() {
    if (this.canExpand()) {
        this._limit++;
        this._expanded++;
        this._process();
        if (d) {
            this.logger.info("expand queue " + this._running);
        }
        return true;
    }
    return false;
};

MegaQueue.prototype.shrink = function() {
    this._limit = Math.max(this._limit - 1, 1);
    if (d) {
        this.logger.error("shrking queue to ", this._limit);
    }
    return this._limit;
};

MegaQueue.prototype.filter = function(gid, foreach) {
    var len = this._queue.length + $.len(this._qpaused);

    if (!len) {
        if (d) {
            this.logger.info('Nothing to filter', gid);
        }
    }
    else {
        if (!foreach) {
            foreach = function(aTask) {
                aTask = aTask[0];
                if (d && !aTask.destroy) {
                    this.logger.info('Removing Task ' + aTask);
                }
                if (aTask.destroy) {
                    aTask.destroy();
                }
            }.bind(this);
        }

        var tasks = this.slurp(gid);
        if (this._qpaused[gid]) {
            tasks = tasks.concat(this._qpaused[gid]);
            delete this._qpaused[gid];
        }

        tasks.map(foreach);

        // XXX: For Transfers, check if there might be leaked tasks without the file reference (ie, "dl" for dlQueue)

        if (d) {
            this.logger.info('Queue filtered, %d/%d tasks remaining',
                this._queue.length + $.len(this._qpaused), len, gid);
        }
    }
};

MegaQueue.prototype.slurp = function(gid) {
    var res = [];
    this._queue = this._queue.filter(function(item) {
        return item[0][gid] ? (res.push(item), false) : true;
    });
    return res;
};

MegaQueue.prototype.pause = function() {
    if (d > 1) {
        this.logger.info("pausing queue");
    }
    this._paused = true;
    this.trigger('pause');
};

MegaQueue.prototype.isPaused = function() {
    return this._paused;
};

MegaQueue.prototype.pushAll = function(tasks, next, error) {
    function CCQueueChecker(task, response) {
        if (response.length && response[0] === false) {
            /**
             *  The first argument of .done(false) is false, which
             *  means that something went wrong
             */
            return error(task, response);
        }
        array.remove(tasks, task);
        if (tasks.length === 0) {
            next();
        }
    }
    var i = 0;
    var len = tasks.length;

    for (i = 0; i < len; i++) {
        tasks[i].onQueueDone = CCQueueChecker;
        this.push(tasks[i]);
    }
};

MegaQueue.prototype.run_in_context = function(task) {
    'use strict';

    this._running++;
    this._pending.push(task[0]);

    this._worker(task[0], (...args) => {
        const [data, ack, scope] = task;
        task[0] = task[1] = task[2] = null;

        // this.logger.warn(`dsp task ${this._running}...`, this._pending.length, this._limit, [data]);

        if (data && this._queue) {

            if (!this._pending || !this._pending.includes(data)) {

                this.logger.warn('The Task is no longer pending...', data, this._pending);
            }
            else {
                this._running--;
                array.remove(this._pending, data);

                if (d) {
                    console.assert(this._running > -1, 'Queue inconsistency (RIC)');
                }
                const done = ack || data.onQueueDone;

                if (done) {
                    done.apply(scope || this, [data, args]);
                }

                if (this._queue && (!this.isEmpty() || Object.keys(this._qpaused).length)) {

                    this.tryProcess();
                }
            }
        }
    });
};

MegaQueue.prototype.validateTask = function() {
    return true;
};

MegaQueue.prototype.getNextTask = function(sp) {
    var r;
    var i = -1;
    while (++i < (this._queue && this._queue.length)) {
        if (!(this._queue && this._queue[i])) {
            srvlog('Invalid queue' + (this._queue ? ' entry' : '') + ' for ' + this.qname, sp);
            if (!this._queue) {
                break;
            }
        }
        else if ((r = this.validateTask(this._queue[i][0]))) {
            return r < 0 ? null : this._queue.splice(i, 1)[0];
        }
    }
    return null;
};

MegaQueue.prototype.process = function(sp) {
    var args;
    if (this._paused) {
        return false;
    }
    delay.cancel(this.__identity);

    if (!this._queue) {
        console.error('queue destroyed', this.qname, sp);
        return false;
    }
    while (this._running < this._limit && this._queue.length > 0) {
        args = this.getNextTask(sp);

        if (!args) {
            if (++this._noTaskCount === 666) {
                /**
                 * XXX: Prevent an infinite loop when there's a connection hang,
                 * with the UI reporting either "Temporary error; retrying" or
                 * a stalled % Status... [dc]
                 */
                this._noTaskCount = -1;
                if (!$.len(this._qpaused) && !uldl_hold) {
                    if (d) {
                        this.logger.error('*** CHECK THIS ***', this);
                    }
                    // srvlog('MegaQueue.getNextTask gave no tasks for too long... (' + this.qname + ')', sp);
                }
            }
            if (this._queue) {
                this._process(1600, sp);
            }
            return false;
        }

        this._noTaskCount = 0;
        this.run_in_context(args);

        if (this._queue) {
            this.trigger('working', args);
        }
    }

    if (!args) {
        if (this._expanded) {
            this._limit -= this._expanded;
            this._expanded = 0;
        }
        if (this.mull) {
            this.mull();
        }
    }

    return true;
};

MegaQueue.prototype.destroy = function() {
    if (!oIsFrozen(this)) {
        this.logger.info('', 'Destroying ' + this.qname, this._queue.length, this._pending);

        delay.cancel(this.__identity);

        /**
        this._pending.forEach(function(aRunningTask) {
            if (d) {
                this.logger.info('aRunningTask: ' + aRunningTask, aRunningTask);
            }
            if (aRunningTask && typeof aRunningTask.destroy === 'function') {
                try {
                    aRunningTask.destroy();
                }
                catch(ex) {
                    this.logger.error(ex);
                }
            }
        }.bind(this));
        /**/
        if (d) {
            if (this._queue.length !== 0) {
                var fn = 'error';
                switch (this.qname) {
                    case 'downloads':
                    case 'zip-writer':
                    case 'download-writer':
                        fn = (d > 1 ? 'warn' : 'debug');
                    default:
                        break;
                }
                this.logger[fn]('The queue "%s" was not empty.', this.qname, this._queue);
            }

            if (MegaQueue.weakRef) {
                MegaQueue.weakRef.delete(this);
            }
        }
        oDestroy(this);
    }
};

MegaQueue.prototype._process = function(ms, sp) {
    'use strict';
    if (!sp && d > 1) {
        sp = new Error(this.qname + ' stack pointer');
    }
    delay(this.__identity, () => this.process(sp), ms || 10);
};

MegaQueue.prototype.push = function(arg, next, self) {
    this._queue.push([arg, next, self]);
    // this.logger.debug('Queueing new task, total: %d', this._queue.length, arg);
    this.trigger('queue');
    this._process();
};

MegaQueue.prototype.unshift = function(arg, next, self) {
    this._queue.unshift([arg, next, self]);
    // this.logger.debug('Queueing new task, total: %d', this._queue.length, arg);
    this.trigger('queue');
    this._process();
};

function TransferQueue() {
    MegaQueue.prototype.constructor.apply(this, arguments);

    this.qbqq = [];
}

inherits(TransferQueue, MegaQueue);

TransferQueue.prototype.mull = function() {
    if (this.isEmpty() && $.len(this._qpaused)) {
        var gids = Object.keys(this._qpaused);
        while (gids.length) {
            var gid = gids.shift();
            if (this.dispatch(gid)) {
                if (d) {
                    this.logger.info('Dispatching transfer', gid);
                }
                break;
            }
        }
    }
};

TransferQueue.prototype.dispatch = function(gid) {
    // dispatch a paused transfer

    if (d) {
        this.logger.info('', 'TransferQueue.dispatch', gid);
    }

    if (!GlobalProgress[gid]) {
        this.logger.error('', 'No transfer associated with ' + gid);
    }
    else if (!this._qpaused[gid]) {
        this.logger.error('', 'This transfer is not in hold: ' + gid);
    }
    else if (!GlobalProgress[gid].paused) {
        this._queue = this._qpaused[gid].concat(this._queue);
        delete this._qpaused[gid];
        this._process();
        return true;
    }
    return false;
};

TransferQueue.prototype.isPaused = function(gid) {
    if (!gid) {
        return MegaQueue.prototype.isPaused.apply(this, arguments);
    }

    return Object(GlobalProgress[gid]).paused;
};

TransferQueue.prototype.pause = function(gid) {
    if (!gid) {
        return MegaQueue.prototype.pause.apply(this, arguments);
    }

    // pause single transfer
    if (GlobalProgress[gid] && !GlobalProgress[gid].paused) {
        var p = GlobalProgress[gid];
        var chunk;
        p.paused = true;
        while ((chunk = p.working.pop())) {
            if (d) {
                this.logger.info('Aborting by pause: ' + chunk);
            }
            chunk.abort();
            this.pushFirst(chunk);
            if (array.remove(this._pending, chunk, 1)) {
                this._running--;
                console.assert(this._running > -1, 'Queue inconsistency on pause');
            }
            else {
                this.logger.warn("Paused chunk was NOT in pending state: " + chunk, chunk, this);
            }
        }
        this._qpaused[gid] = this.slurp(gid).concat(this._qpaused[gid] || []);
        var $tr = $('#' + gid);
        if ($tr.hasClass('transfer-started')) {
            $tr.find('.speed').addClass('unknown').text(l[1651]);
            $tr.find('.eta').addClass('unknown').text('');
        } else {
            $tr.find('.speed').text('');
            $tr.find('.eta').text('');
        }
        GlobalProgress[gid].speed = 0; // reset speed
        if (($.transferprogress || {})[gid]) {
            $.transferprogress[gid][2] = 0; // reset speed
        }
        if (page !== 'download') {
            delay('percent_megatitle', percent_megatitle);
        }
    }
    else if (d) {
        if (!GlobalProgress[gid]) {
            this.logger.error('No transfer associated with ' + gid);
        }
        else {
            this.logger.info('This transfer is ALREADY paused: ' + gid);
        }
    }
};

TransferQueue.prototype.resume = function(gid) {
    if (!gid) {
        return MegaQueue.prototype.resume.apply(this, arguments);
    }

    if (GlobalProgress[gid] && GlobalProgress[gid].paused) {
        delete GlobalProgress[gid].paused;
        if (this.isEmpty()) {
            this.dispatch(gid);
        }
        $('#' + gid + ' .speed').text('');
    }
    else if (d) {
        if (!GlobalProgress[gid]) {
            this.logger.error('No transfer associated with ' + gid);
        }
        else {
            this.logger.error('This transfer is not paused: ' + gid);
        }

    }
};

TransferQueue.prototype.push = function(cl) {

    if (!(cl instanceof ClassFile)) {
        return MegaQueue.prototype.push.apply(this, arguments);
    }

    var self = this;
    var showToast = function() {
        if (M.addDownloadToast) {
            M.showTransferToast.apply(M, M.addDownloadToast);
            M.addDownloadToast = null;
        }
    };

    if (localStorage.ignoreLimitedBandwidth || Object(u_attr).p || cl.dl.byteOffset === cl.dl.size) {
        delay('show_toast', showToast);
        dlmanager.setUserFlags();
        return MegaQueue.prototype.push.apply(this, arguments);
    }

    this.pause();
    this.qbqq.push(toArray.apply(null, arguments));

    delay('TransferQueue:push', function() {
        var qbqq = self.qbqq;
        var dispatcher = function() {
            closeDialog();
            self.resume();

            for (let i = 0; i < qbqq.length; i++) {
                const args = qbqq[i];

                if (i < 32) {
                    const {dl} = args[0];

                    if (dl && dl.byteOffset !== dl.size) {

                        megaUtilsGFSFetch.getTicketData(dl).catch(dump);
                    }
                }
                MegaQueue.prototype.push.apply(self, args);
            }

            loadingDialog.hide();
            showToast();
        };
        self.qbqq = [];

        // loadingDialog.show();

        // Query the size being downloaded in other tabs
        watchdog.query('qbqdata').always(function(res) {
            // this will include currently-downloading and the ClassFiles in hold atm.
            var qbq = dlmanager.getQBQData();

            // if no error (Ie, no other tabs)
            if (typeof res !== 'number') {
                for (var i = res.length; i--;) {
                    qbq.p = qbq.p.concat(res[i].p || []);
                    qbq.n = qbq.n.concat(res[i].n || []);
                    qbq.s += res[i].s;
                }
            }
            qbq.a = 'qbq';
            qbq.s *= -1;

            // Set user flags, registered, pro, achievements
            dlmanager.setUserFlags();

            // Fire "Query bandwidth quota"
            api_req(qbq, {
                callback: function(res) {
                    // 0 = User has sufficient quota
                    // 1 = unregistered user, not enough quota
                    // 2 = registered user, not enough quota
                    // 3 = can't even get the first chunk
                    switch (res) {
                        case 1:
                        case 2:
                            dlmanager.showLimitedBandwidthDialog(res, dispatcher);
                            break;

                        default:
                            Soon(dispatcher);
                    }
                }
            });
        });
    }, 50);
};

/**
 * Set transfer status
 * @param {Object} dl The download object
 * @param {String} status The status text
 * @param {Boolean} [ethrow] Throw the exception noted in `status`
 * @param {Number} [lock] Lock the DOM node in the transfers panel.
 * @param {Boolean} [fatalError] Whther invoked from dlFatalEror()
 */
function setTransferStatus(dl, status, ethrow, lock, fatalError) {
    var id = dl && dlmanager.getGID(dl);
    var text = '' + status;

    if (ethrow) {
        fatalError = true;
    }

    if (page === 'download') {
        var $dlTopBar = $('.download.download-page');
        var $dlMainTNfo = $('.download.main-transfer-info');
        var $dlTopBarErrorBlock = $('.download.main-transfer-error', $dlTopBar);

        if (status === l[20666]) {
            $('.download.error-text', $dlTopBar).addClass('hidden');
            $('.download.over-transfer-quota', $dlTopBar).removeClass('hidden');
            $dlTopBarErrorBlock = $('.download.overquoata-error', $dlTopBar);
        }

        $dlTopBar.addClass('error');
        $('.download.speed-block', $dlTopBar).addClass('hidden');
        $('.download.eta-block', $dlTopBar).addClass('hidden');
        $('.bar-table .progress-block', $dlTopBar).addClass('hidden');

        $dlTopBarErrorBlock
            .removeClass('hidden')
            .attr('title', status)
            .find('span')
            .text(text);

        if (fatalError) {
            $('.mid-pause', $dlTopBar).addClass('hidden');
            $('.mega-button', $dlMainTNfo).addClass('hidden');
            dlmanager.setBrowserWarningClasses('.download.warning-block', 0, status);
        }
    }
    else {
        if (fatalError) {
            dlmanager.onDownloadFatalError = status;

            if (is_mobile && lock !== 2 && dl) {
                mobile.downloadOverlay.close();
                mobile.downloadOverlay.handleFatalError(dl, status);
            }
        }

        $('.transfer-table #' + id + ' .transfer-status')
            .attr('title', status)
            .text(text);
    }

    if (lock) {
        var $tr = $('.transfer-table #' + id)
            .addClass('transfer-completed')
            .removeClass('transfer-initiliazing')
            .attr('id', 'LOCKed_' + id);

        if (lock === 2) {
            $tr.remove();
        }
    }

    if (ethrow) {
        if (d) {
            console.error(status);
        }
        throw status;
    }
}

/**
 * Notify a download fatal error.
 * @param {Object} dl The download object
 * @param {Object|String} error The error object
 * @param {Boolean} [ethrow] Throw the exception noted in `status`
 * @param {Number} [lock] Lock the DOM node in the transfers panel.
 */
function dlFatalError(dl, error, ethrow, lock) {
    'use strict';

    var awaitingPromise = dl && dl.awaitingPromise;

    // Log the fatal error
    Soon(function() {
        if (awaitingPromise) {
            awaitingPromise.reject(error);
        }
        error = String(Object(error).message || error).replace(/\s+/g, ' ').trim();

        if (error.indexOf(l[16871]) < 0 && error.indexOf(l[16872]) < 0 && error.indexOf(l[1668]) < 0) {
            if (error.indexOf(String(l[5945]).split('[')[0]) > -1) {
                error = '5945, ' + (error.match(/\[(.*)]/) || '  ')[1];
            }
            // srvlog('dlFatalError: ' + error.substr(0, 60) + (window.Incognito ? ' (Incognito)' : ''));
            // ^ Let's stop logging Incognito issues, they are too common and we do have fallback logic anyway
            // Also stop obsolete browsers (e.g. attempting to use FlashIO, sigh) from logging errors
            if (!window.Incognito && mega.es2019 && !/^[\d\s,.]+$/.test(error)) {
                // srvlog('dlFatalError: ' + error.substr(0, 72));
                // @todo fix the Incognito flag.
                if (d) {
                    dlmanager.logger.warn(`dlFatalError: ${error}`, dl);
                }
            }
        }
    });

    // Set transfer status and abort it
    setTransferStatus(dl, error, ethrow, lock !== undefined ? lock : true, String(error).indexOf(l[1668]) < 0);
    dlmanager.abort(dl);
}

// Quick hack for sane average speed readings
function Speedometer(initialp) {
    if (!(this instanceof Speedometer)) {
        return new Speedometer(initialp);
    }
    this.interval = 200;
    this.num = 300;
    this.prevp = initialp;
    this.h = Object.create(null);
}
Speedometer.prototype.progress = function(p) {
    var now, min, oldest;
    var total;
    var t;

    now = Date.now();
    now -= now % this.interval;

    this.h[now] = (this.h[now] || 0) + p - this.prevp;
    this.prevp = p;

    min = now - this.interval * this.num;

    oldest = now;
    total = 0;

    for (t in this.h) {
        if (t < min) {
            delete this.h.bt;
        }
        else {
            if (t < oldest) {
                oldest = t;
            }
            total += this.h[t];
        }
    }

    if (now - oldest < 1000) {
        return 0;
    }

    p = 1000 * total / (now - oldest);

    // protect against negative returns due to repeated chunks etc.
    return p > 0 ? p : 0;
};

// compute final MAC from block MACs
function condenseMacs(macs, key) {
    'use strict';

    var i, j, mblk;
    var mac = [0, 0, 0, 0];
    var aes = Array.isArray(key) ? new sjcl.cipher.aes([key[0], key[1], key[2], key[3]]) : key;

    for (i = 0; i < macs.length; i++) {
        mblk = macs[i];

        for (j = 0; j < mblk.length; j += 4) {
            mac[0] ^= mblk[j];
            mac[1] ^= mblk[j + 1];
            mac[2] ^= mblk[j + 2];
            mac[3] ^= mblk[j + 3];

            mac = aes.encrypt(mac);
        }
    }

    return mac;
}

function chksum(buf) {
    var l, c, d;

    // eslint-disable-next-line no-constant-condition
    if (1) {
        var ll;

        c = new Uint32Array(3);

        ll = buf.byteLength;

        l = Math.floor(ll / 12);

        ll -= l * 12;

        if (l) {
            l *= 3;
            d = new Uint32Array(buf, 0, l);

            while (l) {
                l -= 3;

                c[0] ^= d[l];
                c[1] ^= d[l + 1];
                c[2] ^= d[l + 2];
            }
        }

        c = new Uint8Array(c.buffer);

        if (ll) {
            d = new Uint8Array(buf, buf.byteLength - ll, ll);

            while (ll--) c[ll] ^= d[ll];
        }
    }

    for (d = '', l = 0; l < 12; l++) {
        d += String.fromCharCode(c[l]);
    }

    return d;
}

(function __FileFingerprint(scope) {
    'use strict';
    var CRC_SIZE = 16;
    var BLOCK_SIZE = CRC_SIZE * 4;
    var MAX_TSINT = Math.pow(2, 32) - 1;

    function i2s(i) {
        return String.fromCharCode.call(String,
            i >> 24 & 0xff,
            i >> 16 & 0xff,
            i >> 8 & 0xff,
            i & 0xff);
    }

    function serialize(v) {
        var p = 0,
            b = [];
        v = Math.min(MAX_TSINT, parseInt(v));
        while (v > 0) {
            b[++p] = String.fromCharCode(v & 0xff);
            v >>>= 8;
        }
        b[0] = String.fromCharCode(p);
        return b.join("");
    }

    function makeCRCTable() {
        var c, crcTable = [];

        for (var n = 0; n < 256; ++n) {
            c = n;

            for (var k = 0; k < 8; ++k) {
                c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }

            crcTable[n] = c;
        }

        return crcTable;
    }

    function crc32(str, crc, len) {
        crc = crc ^ (-1);

        for (var i = 0; i < len; ++i) {
            crc = (crc >>> 8) ^ crc32table[(crc ^ str.charCodeAt(i)) & 0xFF];
        }

        return (crc ^ (-1)) >>> 0;
    }

    /**
     * Generate file fingerprint.
     * @param {File} file The file entry.
     * @returns {Promise}
     * @global
     */
    scope.getFingerprint = function(file) {
        return new Promise(function(resolve, reject) {
            var logger = d && new MegaLogger('fingerprint:'
                + file.size + ':..' + String(file.name).substr(-8), false, ulmanager.logger);

            if (!(file instanceof Blob && file.name)) {
                if (d) {
                    logger.debug('CHECK THIS', 'Unable to generate fingerprint..', [file]);
                    logger.debug('CHECK THIS', 'Invalid file entry', JSON.stringify(file));
                }
                return reject(new Error('Invalid file entry.'));
            }

            if (file.hash && file.ts) {
                if (d) {
                    logger.debug('Skipping file fingerprint, does already exists...');
                }
                return resolve({hash: file.hash, ts: file.ts});
            }

            if (d) {
                logger.info('Generating fingerprint...', file.name, [file]);
            }

            var size = file.size;
            var reader = new FileReader();
            reader.errorCount = 0;

            crc32table = scope.crc32table || (scope.crc32table = makeCRCTable());
            if (crc32table[1] !== 0x77073096) {
                throw new Error('Unexpected CRC32 Table...');
            }

            var timer;
            var resetTimeout = function(abort) {
                if (timer) {
                    clearTimeout(timer);
                    timer = false;
                }
                if (!abort) {
                    timer = setTimeout(function() {
                        if (d) {
                            logger.warn('Fingerprint timed out, the file is locked or unreadable.');
                        }
                        reject(0x8052000e);
                    }, 6e4);
                }
            };

            var finish = function(crc) {
                resetTimeout(1);
                var ts = (file.lastModifiedDate || file.lastModified || 0) / 1000;
                resolve({hash: base64urlencode(crc + serialize(ts)), ts: ts});
            };

            var readBlock = function(blob, callback) {
                resetTimeout();
                reader.onloadend = tryCatch(function(ev) {
                    var target = ev.target;
                    var error = target.error;

                    resetTimeout(1);
                    reader.onloadend = null;

                    if (error) {
                        if (++reader.errorCount > 10) {
                            return reject(error);
                        }

                        if (d) {
                            logger.warn('Failed to read block (%s), retrying...', error.name, [error]);
                        }
                        setTimeout(readBlock.bind(null, blob, callback), 4e3);
                    }
                    else {
                        callback(target.result);
                    }
                }, reject);

                reader.readAsBinaryString(blob);
            };

            if (size <= 8192) {
                return readBlock(file, function(data) {
                    var i;
                    var crc;

                    if (size <= CRC_SIZE) {
                        crc = data;
                        i = CRC_SIZE - crc.length;
                        while (i--) {
                            crc += "\x00";
                        }
                    }
                    else {
                        var tmp = [];

                        for (i = 0; i < 4; i++) {
                            var begin = parseInt(i * size / 4);
                            var len = parseInt(((i + 1) * size / 4) - begin);

                            tmp.push(i2s(crc32(data.substr(begin, len), 0, len)));
                        }

                        crc = tmp.join("");
                    }

                    finish(crc);
                });
            }

            var idx = 0;
            var max = 4;
            var tmp = [];
            var blocks = parseInt(8192 / (BLOCK_SIZE * 4));
            var sliceFn = file.slice ? 'slice' : (file.mozSlice ? 'mozSlice' : 'webkitSlice');

            (function step() {
                if (max === idx) {
                    return finish(tmp.join(""));
                }

                var blk = 0;
                var crc = 0;
                (function next() {
                    if (blocks === blk) {
                        tmp.push(i2s(crc));
                        return step(++idx);
                    }
                    if (typeof file[sliceFn] !== 'function') {
                        return reject(new Error(sliceFn + ' unavailable'));
                    }

                    var offset = parseInt((size - BLOCK_SIZE) * (idx * blocks + blk) / (4 * blocks - 1));

                    readBlock(file[sliceFn](offset, offset + BLOCK_SIZE), function(block) {
                        crc = crc32(block, crc, BLOCK_SIZE);
                        next(++blk);
                    });
                })();
            })();
        });
    };
})(self);

function bindTransfersMassEvents(context) {
    'use strict';
    const pauseIconClass = 'icon-pause';
    const playIconClass = 'icon-play-small';
    $('.transfer-pause-icon', context).rebind('click.transfers', function() {
        const $this = $(this);
        if ($this.hasClass('active')) {
            if (dlmanager.isOverQuota) {
                return dlmanager.showOverQuotaDialog();
            }
            if (ulmanager.ulOverStorageQuota) {
                ulmanager.ulShowOverStorageQuotaDialog();
                return false;
            }
        }

        if (!$this.hasClass('disabled')) {
            let $elm;
            if ($this.hasClass('active')) {
                // terms of service
                if (u_type || folderlink || Object(u_attr).terms || $('.transfer-table', '.fmholder').length === 0) {
                    Object.keys(dlQueue._qpaused).map(fm_tfsresume);
                    Object.keys(ulQueue._qpaused).map(fm_tfsresume);
                    uldl_hold = false;
                    ulQueue.resume();
                    dlQueue.resume();

                    $('span', $this.removeClass('active')).text(l[6993]);
                    $('i', $this).addClass(pauseIconClass).removeClass(playIconClass);

                    $elm = $('.transfer-table-wrapper tr', '.fmholder').removeClass('transfer-paused');
                    $elm = $('.link-transfer-status', $elm).removeClass('transfer-play').addClass('transfer-pause');
                    $('i', $elm).removeClass(playIconClass).addClass(pauseIconClass);
                    $('.nw-fm-left-icon', '.fm-holder').removeClass('paused');
                    const $otherButton =
                        $this.parent().hasClass('transfer-widget-footer')
                            ? $('.transfer-pause-icon', '.fm-transfers-header')
                            : $('.transfer-pause-icon', '.transfer-widget-footer');
                    $('span', $otherButton.removeClass('active')).text(l[6993]);
                    $('i', $otherButton).addClass(pauseIconClass).removeClass(playIconClass);
                }
                else {
                    msgDialog('error', 'terms', l[214]);
                    if (d) {
                        console.debug(l[214]);
                    }
                }
            }
            else {
                var $trs = $('.transfer-table tr:not(.transfer-completed)', '.fmholder');
                let ids;
                if ($('.transfer-table', '.fmholder').length) {
                    ids = [...Object.keys(M.tfsdomqueue), ...$trs.attrs('id')];
                }
                else {
                    ids = $('.transfer-progress-widget .transfer-task-row:not(.completed)', '.fmholder').attrs('id');
                    ids = ids.map((attr) => {
                        return attr.substr(4);
                    });
                }
                ids.map(fm_tfspause);

                dlQueue.pause();
                ulQueue.pause();
                uldl_hold = true;

                $('span', $this.addClass('active')).text(l[7101]);
                $('i', $this).removeClass(pauseIconClass).addClass(playIconClass);

                $trs.addClass('transfer-paused');
                $elm = $('.link-transfer-status', $trs).removeClass('transfer-pause').addClass('transfer-play');
                $('i', $elm).removeClass(pauseIconClass).addClass(playIconClass);
                $('.nw-fm-left-icon', '.fmholder').addClass('paused');
                const $otherButton =
                    $this.parent().hasClass('transfer-widget-footer')
                        ? $('.transfer-pause-icon', '.fm-transfers-header')
                        : $('.transfer-pause-icon', '.transfer-widget-footer');
                $('span', $otherButton.addClass('active')).text(l[7101]);
                $('i', $otherButton).removeClass(pauseIconClass).addClass(playIconClass);
            }
        }
    });

    $('.transfer-clear-all-icon', context).rebind('click.transfers', function() {
        if (!$(this).hasClass('disabled')) {
            msgDialog('confirmation', 'clear all transfers', l.cancel_transfers_dlg_title, l[7225], (e) => {
                if (!e) {
                    return;
                }

                const time = (tag, cb) => {
                    if (d) {
                        console.time(tag);
                    }
                    cb();

                    if (d) {
                        console.timeEnd(tag);
                    }
                };

                uldl_hold = true;
                if (typeof $.removeTransferItems === 'function' && Object.keys(M.tfsdomqueue).length) {
                    tfsheadupdate({
                        c: Object.keys(M.tfsdomqueue),
                    });
                }
                time('dlm:abort', () => dlmanager.abort(null));
                time('ulm:abort', () => ulmanager.abort(null));
                time('tfs:abort', () => {
                    if (typeof $.removeTransferItems === 'function') {
                        const keys = Object.keys(ulmanager.ulCompletingPhase);
                        if (d && keys.length) {
                            console.log('Not removing %d completing uploads', keys.length);
                        }
                        const $trs = $('.transfer-table tbody tr', '.fmholder');
                        $.removeTransferItems(keys.length ? $($trs.toArray().filter(r => !keys.includes(r.id))) : $trs);
                    }
                    else {
                        tfsheadupdate({
                            c: [...Object.keys(tfsheadupdate.stats.dl), ...Object.keys(tfsheadupdate.stats.ul)]
                        });
                        mega.tpw.clearRows(null);
                    }
                });

                later(() => {
                    if (uldl_hold) {
                        uldl_hold = false;
                        ulQueue.resume();
                        dlQueue.resume();
                        const $icon = $('.transfer-pause-icon', context).removeClass('active');
                        $('span', $icon).text(l[6993]);
                        $('i', $icon).removeClass(playIconClass).addClass(pauseIconClass);
                    }
                });
            });
        }
    });
}

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2016 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */
/**
 * CacheIO, intended to minimize real disk I/O when
 *          creating ZIPs with several small files.
 */
function CacheIO(dl_id, dl) {
    'use strict';

    let IO;
    let u8buf;
    let logger;
    let offsetI = 0;
    let offsetO = 0;
    let __max_chunk_size = 48 * 0x100000;

    if (d) {
        console.log('Creating new CacheIO instance', dl_id, dl);
    }

    function PUSH(done, buffer) {
        if (!buffer) {
            buffer = u8buf.subarray(0, offsetI);
        }
        const pos = offsetO;
        offsetO += buffer.byteLength;

        IO.write(buffer, pos, done);
    }

    function FILL(buffer) {
        u8buf.set(buffer, offsetI);
        offsetI += buffer.byteLength;
    }

    this.write = function(buffer, offset, done) {
        if (d) {
            logger.info('CacheIOing...', buffer.byteLength, offset, offsetI, offsetO);
        }

        if (offsetI + buffer.byteLength > __max_chunk_size) {
            const next = () => {
                if (next.write) {
                    next.write();
                    next.write = 0;
                }
                else {
                    if (buffer) {
                        FILL(buffer);
                    }
                    next.done();
                }
            };
            next.done = done;

            if (offsetI) {
                PUSH(next);
            }

            if (buffer.byteLength > __max_chunk_size) {
                next.write = function() {
                    PUSH(next, buffer);
                    buffer = undefined;
                };

                if (!offsetI) {
                    queueMicrotask(next);
                }
            }
            offsetI = 0;
        }
        else {
            FILL(buffer);
            done();
        }
    };

    this.download = function(...args) {
        function finish() {
            IO.download.apply(IO, args);
            u8buf = undefined;
        }

        if (offsetI) {
            PUSH(finish);
        }
        else {
            finish();
        }
    };

    this.setCredentials = function(url, size) {
        if (d) {
            logger = new MegaLogger('CacheIO', {}, dl.writer.logger);
            logger.info('CacheIO Begin', dl_id, arguments);
        }

        if (this.is_zip || !dl.zipid) {
            __max_chunk_size = Math.min(size + 4194304, __max_chunk_size);
            try {
                u8buf = new Uint8Array(__max_chunk_size);
            }
            catch (ex) {
                return dlFatalError(dl, ex);
            }

            IO = new dlMethod(dl_id, dl);
            IO.begin = this.begin;
            IO.is_zip = this.is_zip;
            IO.setCredentials.apply(IO, arguments);
        }
        else {
            this.begin();
        }
    };

    this.abort = function() {
        u8buf = undefined;
        if (IO && IO.abort) {
            IO.abort.apply(IO, arguments);
        }
    };
}

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2016 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

(function(scope) {
    var hasDownloadAttr = "download" in document.createElementNS("http://www.w3.org/1999/xhtml", "a");

    function MemoryIO(dl_id, dl) {
        var dblob;
        var logger;
        var offset = 0;

        if (d) {
            console.log('Creating new MemoryIO instance', dl_id, dl);
        }

        this.write = function(buffer, position, done) {
            if (!dblob) {
                return done();
            }
            try {
                dblob.push(new Blob([buffer]));
            }
            catch (e) {
                dlFatalError(dl, e);
            }
            offset += buffer.length;
            buffer = null;
            queueMicrotask(done);
        };

        this.download = function(name, path) {
            var blob = dblob && this.getBlob(name);

            if (!blob || this.completed) {
                if (d) {
                    console.log('Transfer already completed...', dl);
                }
            }
            else if (hasDownloadAttr) {
                var blob_url = myURL.createObjectURL(blob);
                setTimeout(function() {
                    myURL.revokeObjectURL(blob_url);
                    blob_url = undefined;
                }, 7e3);

                // prevent the beforeunload dispatcher from showing a dialog
                $.memIOSaveAttempt = dl_id;

                // prompt save dialog
                var dlLinkNode = document.getElementById('dllink');
                dlLinkNode.download = name;
                dlLinkNode.href = blob_url;

                // this click may triggers beforeunload...
                dlLinkNode.click();

                // restore beforeunload behavior...
                setTimeout(function() {
                    if ($.memIOSaveAttempt === dl_id) {
                        delete $.memIOSaveAttempt;
                    }
                }, 4e3);
            }
            else {
                this.openInBrowser(name);
            }

            this.completed = true;
            this.abort();
        };

        this.openInBrowser = function(name) {
            var blob = this.getBlob(name || dl.n);

            // XXX: As of Chrome 69+ the object/blob uri may gets automatically revoked
            //      when leaving the site, causing a later Download invocation to fail.
            var blobURI = myURL.createObjectURL(blob);

            mBroadcaster.once('visibilitychange:false', () => later(() => myURL.revokeObjectURL(blobURI)));
            // eslint-disable-next-line local-rules/open
            window.open(blobURI);
        };

        this.setCredentials = function(url, size, filename, chunks, sizes) {
            if (d) {
                logger = new MegaLogger('MemoryIO', {}, dl.writer && dl.writer.logger);
                logger.info('MemoryIO Begin', dl_id, Array.prototype.slice.call(arguments));
            }
            if (size > MemoryIO.fileSizeLimit) {
                dlFatalError(dl, Error(l[16872]));
                if (!this.is_zip) {
                    ASSERT(!this.begin || dl.awaitingPromise, "This should have been destroyed 'while initializing'");
                }
            }
            else {
                dblob = [];
                this.begin();
            }
        };

        this.abort = function() {
            dblob = undefined;
        };

        this.getBlob = function(name) {
            try {
                return new File(dblob, name, {type: filemime(name)});
            }
            catch (ex) {
            }
            return new Blob(dblob || [], {type: filemime(name)});
        };

        if (is_mobile) {
            this.abort = function() {};
        }
    }

    MemoryIO.usable = function() {
        return is_mobile || this.canSaveToDisk;
    };

    Object.defineProperty(MemoryIO, 'canSaveToDisk', {
        get: function() {
            return !!hasDownloadAttr;
        }
    });

    mBroadcaster.once('startMega', function() {
        var uad = ua.details || false;

        if (!MemoryIO.usable()) {
            MemoryIO.fileSizeLimit = 0;
        }
        else if (localStorage.dlFileSizeLimit) {
            MemoryIO.fileSizeLimit = parseInt(localStorage.dlFileSizeLimit);
        }
        else if (is_mobile) {
            MemoryIO.fileSizeLimit = 100 * (1024 * 1024);

            // If Chrome or Firefox on iOS, reduce the size to 1.3 MB
            if (navigator.userAgent.match(/CriOS/i) || navigator.userAgent.match(/FxiOS/i)) {
                MemoryIO.fileSizeLimit = 1.3 * (1024 * 1024);
            }
        }
        else if (uad.engine === 'Trident' || uad.browser === 'Edge') {
            MemoryIO.fileSizeLimit = 600 * 1024 * 1024;
        }
        else {
            var GiB = mega.chrome ? 2 : parseFloat(navigator.deviceMemory) || 1;

            if (mega.flags.dlmemcap > 0) {
                GiB = mega.flags.dlmemcap;
            }

            if (d) {
                console.info('Device Memory: %s GiB, limit: %s', navigator.deviceMemory, GiB);
            }
            MemoryIO.fileSizeLimit = 1024 * 1024 * 1024 * GiB;
        }
    });

    scope.MemoryIO = MemoryIO;
})(this);

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2016 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

(function(window) {
    "use strict";

    // https://dev.w3.org/2009/dap/file-system/file-writer.html#idl-def-FileWriter
    // https://dev.w3.org/2009/dap/file-system/file-dir-sys.html#the-entry-interface

    var TEMPORARY = window.TEMPORARY || 0,
        PERSISTENT = window.PERSISTENT || 1;

    var TEST_METHOD_SWITCHOVER = !!localStorage.testDLMethodSwitchover;

    function storage_s2n(s) {
        return s.toLowerCase() === 'persistent' ? PERSISTENT : TEMPORARY;
    }

    function storage_n2s(n) {
        return +n == PERSISTENT ? 'Persistent' : 'Temporary';
    }

    function queryUsageAndQuota(aType, aSuccess, aError) {
        var sType = storage_n2s(aType);

        if (navigator['webkit' + sType + 'Storage']) {
            return navigator['webkit' + sType + 'Storage'].queryUsageAndQuota(aSuccess, aError);
        }

        if (window.webkitStorageInfo) {
            return window.webkitStorageInfo.queryUsageAndQuota(aType, aSuccess, aError);
        }

        Soon(aError.bind(window, new Error('Unknown FileSystem API')));
    }

    function requestQuota(aType, aSize, aSuccess, aError) {
        var sType = storage_n2s(aType);

        if (navigator['webkit' + sType + 'Storage']) {
            return navigator['webkit' + sType + 'Storage'].requestQuota(aSize, aSuccess, aError);
        }

        if (window.webkitStorageInfo) {
            return window.webkitStorageInfo.requestQuota(aType, aSize, aSuccess, aError);
        }

        Soon(aError.bind(window, new Error('Unknown FileSystem API.')));
    }

    function isSecurityError(e) {
        return Object(e).name === 'SecurityError';
    }

    function checkSecurityError(e) {
        if (isSecurityError(e)) {
            window.Incognito = 0xC120E;

            assert(MemoryIO.usable(), 'No download method available...?!');
            dlMethod = MemoryIO;

            if (d) {
                console.warn('Switching to ' + dlMethod.name);
            }

            // https://code.google.com/p/chromium/issues/detail?id=375297
            if (!mega.chrome || parseInt(ua.details.version) < 58) {
                MemoryIO.fileSizeLimit = 496 * 1024 * 1024;
            }

            return true;
        }
    }

    function abortAndStartOver(dl, dl_id, e) {
        dlFatalError(dl, e, false, 2);

        onIdle(function() {
            if (dl_id !== dl.ph) {
                M.addWebDownload([dl_id]);
            }
            else {
                $.doFireDownload = true;
                M.resetUploadDownload();
                dlinfo(dlid, dlkey, false);
            }
        });
    }

    function canSwitchDownloadMethod(dl, dl_id, entry) {
        if (MemoryIO.usable() && dl.size < MemoryIO.fileSizeLimit) {
            if (entry && Object(dl.resumeInfo).byteOffset) {
                var tid = dlmanager.getResumeInfoTag(dl);
                dlmanager.resumeInfoCache[tid] = Object.assign(dl.resumeInfo, {entry: entry});
                dl.io.keepFileOnAbort = true;
            }
            dlMethod = MemoryIO;
            abortAndStartOver(dl, dl_id, Error(l[16871]));
            return true;
        }
    }

    function onSecurityErrorSwitchMethod(dl, dl_id, e) {
        if (checkSecurityError(e)) {
            abortAndStartOver(dl, dl_id, e);
            return true;
        }

        return false;
    }

    function clearit(storagetype, t, callback) {
        var tsec = t || dlmanager.fsExpiryThreshold;

        function errorHandler2(e) {
            if (d) {
                console.error('error', e);
            }
            if (callback) {
                callback(e);
            }
        }

        function toArray(list) {
            return Array.prototype.slice.call(list || [], 0);
        }

        function readentry() {
            if (entries.length == 0) {
                if (callback) {
                    callback(0);
                }
            }
            else if (i < entries.length) {
                var file = entries[i];
                if (file.isFile) {
                    file.getMetadata(function(metadata) {
                        // do not delete file while it's being copied from FS to DL folder
                        // conservative assumption that a file is being written at 1024 bytes per ms
                        // add 30000 ms margin

                        var deltime = metadata.modificationTime.getTime()
                            + tsec * 1000 + metadata.size / 1024 + 30000;

                        if (!dlmanager.isTrasferActive(file.name) && deltime < Date.now() && deltime < lastactive) {
                            file.remove(function() {
                                    totalsize += metadata.size;
                                    if (d) {
                                        console.log('temp file removed',
                                            file.name, bytesToSize(metadata.size));
                                    }

                                    dlmanager.remResumeInfo({ph: file.name});
                                    dlmanager.remResumeInfo({id: file.name});

                                    if (++del == entries.length && callback) {
                                        callback(totalsize);
                                    }
                                },
                                function() {
                                    if (d) {
                                        console.log('temp file removal failed',
                                            file.name, bytesToSize(metadata.size));
                                    }
                                    if (++del == entries.length && callback) {
                                        callback(totalsize);
                                    }
                                });
                        }
                        else {
                            if (d) {
                                console.log('tmp file too new to remove',
                                    file.name, bytesToSize(metadata.size),
                                    'Can be removed on ' + String(new Date(deltime)));
                            }
                            if (++del == entries.length && callback) {
                                callback(totalsize);
                            }
                        }
                    });
                }
                i++;
                readentry();
            }
        }

        function onInitFs(fs) {
            fs.root.getDirectory('mega', {
                create: true
            }, function(dirEntry) {
                function readEntries() {
                    dirReader.readEntries(function(results) {
                        if (!results.length) {
                            readentry();
                        }
                        else {
                            entries = entries.concat(toArray(results));
                            readEntries();
                        }
                    }, errorHandler2);
                }
                var dirReader = dirEntry.createReader();
                readEntries();
            }, errorHandler2);
        }
        var i = 0;
        var del = 0;
        var entries = [];
        var totalsize = 0;
        if (window.requestFileSystem) {
            queryUsageAndQuota(storagetype, function(used, remaining) {
                if (used + remaining) {
                    if (d) {
                        console.log('Cleaning %s Storage...',
                            storage_n2s(storagetype), bytesToSize(used), bytesToSize(remaining));
                    }
                    window.requestFileSystem(storagetype, 1024, onInitFs, errorHandler2);
                }
                else {
                    if (callback) {
                        callback(0);
                    }
                }
            }, errorHandler2);
        }
        else {
            errorHandler2();
        }
    }

    var WRITERR_DIAGTITLE = l[16871];
    var chrome_write_error_msg = 0;

    function free_space(callback, ms, delta) {
        /* error */
        clearit(0, delta | 0, function(s) {
            if (d) {
                console.log('Freed %s of temporary storage', bytesToSize(s));
            }

            // clear persistent files:
            clearit(1, delta | 0, function(s) {
                if (d) {
                    console.log('Freed %s of persistent storage', bytesToSize(s));
                }

                if (callback) {
                    setTimeout(function() {
                        callback(Object(s).name === 'SecurityError' ? s : null);
                    }, ms || 2600);
                }
            });
        });
    }

    var HUGE_QUOTA = 1024 * 1024 * 1024 * 100;

    function dl_getspace(reqsize, callback, max_retries) {
        function retry(aStorageType, aEvent) {
            if (d) {
                console.error('Retrying...', max_retries, arguments);
            }

            if (max_retries) {
                later(dl_getspace.bind(this, reqsize, callback, --max_retries));
            }
            else {
                callback(aStorageType, aEvent, -1);
            }
        }
        var zRetry = retry.bind(null, 0);

        if (typeof max_retries === 'undefined') {
            max_retries = 3;
        }

        if (d) {
            console.log("Requesting disk space for %s (%d bytes)", bytesToSize(reqsize), reqsize);
        }
        // return callback(0, {}, -1);

        queryUsageAndQuota(PERSISTENT, function onPQU(used, remaining) {
            if (d) {
                console.log('Used persistent storage: %s, remaining: %s',
                    bytesToSize(used), bytesToSize(remaining));
            }

            queryUsageAndQuota(TEMPORARY, function onTQU(tused, tremaining) {
                if (d) {
                    console.log('Used temporary storage: %s, remaining: %s',
                        bytesToSize(tused), bytesToSize(tremaining));
                }

                if (used > 0 || remaining > 0) {
                    if (remaining < reqsize) {
                        clearit(1, 300, retry.bind(null, 1));
                    }
                    else {
                        callback(PERSISTENT);
                    }
                }
                else {
                    /**
                     * Check if our temporary storage quota is sufficient to proceed.
                     * (require 400% + 100MB margin because the quota can change during the download)
                     */
                    if (tremaining > reqsize * 5 + 1024 * 1024 * 100) {
                        callback();
                    }
                    else if (tused + tremaining > reqsize * 5 + 1024 * 1024 * 100) {
                        clearit(0, 300, zRetry);
                    }
                    else {
                        /**
                         * Highly likely that we will run out of 20% of 50% of free our diskspace
                         * -> request persistent storage to be able to use all remaining disk space.
                         */
                        requestQuota(PERSISTENT, HUGE_QUOTA, function onRQ(grantedBytes) {
                            if (d) {
                                console.log('Granted persistent storage: %s',
                                    bytesToSize(grantedBytes));
                            }

                            if (grantedBytes == 0) {
                                // user canceled the quota request?
                                retry(0, {
                                    name: 'SecurityError'
                                });
                            }
                            else {
                                /**
                                 * Looks like Chrome is granting storage even in Incognito mode,
                                 * ideally it should call our errorHandler without bothering
                                 * the user... [CHROME 36.0.1985.125]
                                 */
                                window.requestFileSystem(PERSISTENT, grantedBytes,
                                    function(fs) {
                                        callback(PERSISTENT);
                                    },
                                    retry.bind(null, 1)
                                );
                            }
                        }, zRetry);
                    }
                }
            }, zRetry);
        }, zRetry);
    }

    function errorHandler(type, e) {
        switch (e.name) {
            case 'QuotaExceededError':
                alert('Error writing file, is your harddrive almost full? (' + type + ')');
                break;
            case 'NotFoundError':
                alert('NOT_FOUND_ERR in ' + type);
                break;
            case 'SecurityError':
                alert('File transfers do not work with Chrome Incognito. (Security Error in ' + type + ')');
                break;
            case 'InvalidModificationError':
                alert('INVALID_MODIFICATION_ERR in ' + type);
                break;
            case 'InvalidStateError':
                console.log('INVALID_STATE_ERROR in ' + type + ', retrying...');
                later(this.fsInitOp.bind(this));
                break;
            default:
                console.error('Unexpected error...', e.code, e.name, e);
                alert('requestFileSystem failed in ' + type);
        }
    }

    var nosplog = true;

    window.FileSystemAPI = function fsIO(dl_id, dl) {
        var
            dl_fw,
            dl_chunks = [],
            dl_chunksizes = [],
            dl_writing,
            dl_position = 0,
            dl_buffer,
            dl_geturl,
            dl_filesize,
            dl_filename,
            dl_done,
            dl_storagetype = 0,
            targetpos = 0,
            zfileEntry,
            wTimer,
            logger,
            failed = false,
            that = this;

        function dl_createtmpfile(fs) {
            var options = {
                create: true
            };
            fs.root.getDirectory('mega', options, function(dirEntry) {
                if (d) {
                    logger.info("Opening file for writing: mega/" + dl_id);
                }

                fs.root.getFile('mega/' + dl_id, options, function(fileEntry) {
                    fileEntry.createWriter(function(fileWriter) {
                        var resumeOffset = dl.byteOffset || 0;

                        if (d) {
                            logger.info('File "mega/' + dl_id + '" created');
                        }
                        dl_fw = fileWriter;

                        var beginDownload = function() {
                            if (that.begin) {
                                that.begin(null, resumeOffset);
                            }
                            else if (d) {
                                logger.error("No 'begin' function, this must be aborted...", dl);
                            }
                            that = false;
                        };

                        dl_fw.onerror = function(ev) {
                            /* onwriteend() will take care of it */
                            if (d) {
                                var error = Object(ev.target).error;
                                if (error) {
                                    logger.error(error.name, error.message);
                                }
                                else {
                                    logger.error(ev);
                                }
                            }
                        };

                        dl_fw.onwriteend = function() {
                            if (that) {
                                ASSERT(dl_fw.readyState === dl_fw.DONE, 'Error truncating file!');

                                if (dl_fw.readyState === dl_fw.DONE) {
                                    beginDownload();
                                }
                                return;
                            }

                            if (dl_fw.position == targetpos) {
                                chrome_write_error_msg = 0;
                                /* reset error counter */
                                dl_ack_write();
                            }
                            else {
                                logger.error('Short write (%d/%d)', dl_fw.position, targetpos, dl_fw.readyState);
                                // debugger;

                                /* try to release disk space and retry */
                                var onSpaceFreed = function() {
                                    if (!dl_fw) {
                                        logger.debug('Transfer %s cancelled while freeing space', dl_id);
                                        return;
                                    }
                                    if (!(++chrome_write_error_msg % 21) && !$.msgDialog) {
                                        chrome_write_error_msg = 0;

                                        if (canSwitchDownloadMethod(dl, dl_id, fileEntry)) {
                                            return;
                                        }

                                        if (nosplog) {
                                            nosplog = false;
                                            api_req({a: 'log', e: 99657, m: 'Out of HTML5 Offline Storage space.'});
                                        }

                                        msgDialog('warningb:' + l[103],
                                            WRITERR_DIAGTITLE,
                                            l[20817],
                                            str_mtrunc(dl_filename), function(cancel) {
                                                if (cancel) {
                                                    dlFatalError(dl, WRITERR_DIAGTITLE, false);
                                                }
                                            });
                                    }
                                    failed = true;
                                    dl_ack_write();
                                };

                                // Before downloads resume support we were just seeking back to the write offset,
                                // we now have to actually truncate the file so that any sudden reload will preserve
                                // the offset as stored in the resumable storage entry... at least more chances to it.
                                var oldOnWriteEnd = dl_fw.onwriteend;
                                var ackWrite = function() {
                                    dl_fw.onwriteend = oldOnWriteEnd;
                                    free_space(onSpaceFreed, 450, chrome_write_error_msg && 300);
                                };
                                var onError = function() {
                                    // Something went wrong, go back to seeking...
                                    try {
                                        dl_fw.seek(dl_position);
                                        ackWrite();
                                    }
                                    catch (ex) {
                                        dlFatalError(dl, ex);
                                    }
                                };

                                dl_fw.onwriteend = tryCatch(function() {
                                    var error = true;

                                    if (dl_fw.readyState === dl_fw.DONE) {
                                        if (dl_fw.position === dl_position) {
                                            logger.debug('Truncation succeed at offset ' + dl_position);
                                            error = false;
                                        }
                                        else {
                                            logger.warn('Truncation failed...', dl_fw.position, dl_position);
                                        }
                                    }
                                    else {
                                        logger.warn('Invalid state on truncation...', dl_fw.readyState);
                                    }

                                    if (error) {
                                        onError();
                                    }
                                    else {
                                        ackWrite();
                                    }
                                }, onError);

                                logger.debug('Truncating file to offset ' + dl_position);
                                onIdle(tryCatch(function() {
                                    dl_fw.truncate(dl_position);
                                }, function(ex) {
                                    logger.warn(ex);
                                    if (!canSwitchDownloadMethod(dl, dl_id, fileEntry)) {
                                        dlFatalError(dl, ex);
                                    }
                                }));
                            }
                        };
                        zfileEntry = fileEntry;

                        if (resumeOffset) {
                            if (resumeOffset === dl_fw.length) {
                                if (TEST_METHOD_SWITCHOVER && canSwitchDownloadMethod(dl, dl_id, fileEntry)) {
                                    console.info('---------- TESTING DOWNLOAD METHOD SWITCHOVER --------');
                                    return;
                                }
                                dl_fw.seek(resumeOffset);
                                onIdle(beginDownload);
                                return;
                            }

                            console.warn('Cannot resume, byteOffset mismatch %s-%s', resumeOffset, dl_fw.length);
                        }

                        resumeOffset = 0;
                        dl_fw.truncate(0);
                    },
                    errorHandler.bind(that, 'createWriter'));
                },
                errorHandler.bind(that, 'getFile'));

                options = undefined;
            },
            errorHandler.bind(that, 'getDirectory'));
        }

        this.fsInitOp = function check() {
            dl_getspace(dl_filesize, function(aStorageType, aEvent, aFail) {
                if (wTimer === null) {
                    return;
                }

                if (aFail === -1 && !isSecurityError(aEvent)) {
                    if (!canSwitchDownloadMethod(dl, dl_id, zfileEntry)) {
                        if (nosplog) {
                            nosplog = false;
                            api_req({a: 'log', e: 99658, m: 'Out of HTML5 Offline Storage space (open)'});
                        }

                        dlFatalError(dl, WRITERR_DIAGTITLE, false);
                        dlmanager.showMEGASyncOverlay(1, WRITERR_DIAGTITLE);
                    }

                    return;
                }
                dl_storagetype = aStorageType !== 1 ? 0 : 1;

                if (d) {
                    logger.info('Using Storage: ' + storage_n2s(dl_storagetype),
                        aStorageType, aEvent, aFail);
                }

                window.requestFileSystem(
                    dl_storagetype,
                    dl_filesize,
                    dl_createtmpfile,
                    function(e) {
                        if (!onSecurityErrorSwitchMethod(dl, dl_id, e)) {
                            if (!canSwitchDownloadMethod(dl, dl_id)) {
                                errorHandler.call(this, 'RequestFileSystem', e);
                            }
                        }
                    }.bind(this)
                );
            }.bind(this));
        };

        this.abort = function(err) {
            var _logger = logger || dlmanager.logger;
            _logger.debug('abort', err, wTimer, dl_id, dl_fw, zfileEntry);

            if (wTimer) {
                clearTimeout(wTimer);
            }
            wTimer = null;

            if (dl_fw) {
                if (err && !this.keepFileOnAbort) {
                    try {
                        var onWriteEnd = (function(writer, entry) {
                            return function() {
                                if (arguments.length) {
                                    _logger.debug('onWriteEnd', arguments);
                                }
                                if (entry) {
                                    entry.remove(
                                        _logger.debug.bind(_logger),
                                        _logger.error.bind(_logger)
                                    );
                                }
                                else if (writer) {
                                    writer.truncate(0);
                                }

                                writer = entry = undefined;
                            };
                        })(dl_fw, zfileEntry);

                        if (dl_fw.readyState === dl_fw.WRITING) {
                            dl_fw.onerror = dl_fw.onwriteend = onWriteEnd;
                        }
                        else {
                            dl_fw.onerror = dl_fw.onwriteend = function() {};
                            onWriteEnd();
                        }
                    }
                    catch (e) {
                        if (d) {
                            _logger.error(e);
                        }
                    }
                }
            }

            dl_fw = zfileEntry = null;
        };

        function dl_ack_write() {
            if (failed) {
                /* reset error flag */
                failed = false;
                logger.warn('write error, retrying...', dl_fw.readyState);

                wTimer = setTimeout(function() {
                    try {
                        dl_fw.write(new Blob([dl_buffer]));
                    }
                    catch (ex) {
                        dlFatalError(dl, ex);
                    }
                }, 2100);

                return;
            }

            if ($.msgDialog
                    // eslint-disable-next-line eqeqeq
                    && $('#msgDialog:visible header h2').text() == WRITERR_DIAGTITLE) {
                closeDialog();
            }

            dl_buffer = null;
            dl_writing = false;
            if (dl_done) {
                dl_done();
            } /* notify writer */
        }

        var testSwitchOver = localStorage.fsTestSwitchOver || 0;

        this.write = function(buffer, position, done) {
            if (dl_writing || position != dl_fw.position) {
                throw new Error([position, buffer.length, position + buffer.length, dl_fw.position]);
            }

            failed = false;
            targetpos = buffer.length + dl_fw.position;
            dl_writing = true;
            dl_position = position;
            dl_buffer = buffer
            dl_done = done;

            if (d) {
                logger.info("Write " + buffer.length + " bytes at " + position + "/" + dl_fw.position);
            }

            if (testSwitchOver && position > 0x1000000 && canSwitchDownloadMethod(dl, dl_id, zfileEntry)) {
                return;
            }

            try {
                dl_fw.write(new Blob([buffer]));
            }
            catch (e) {
                dlFatalError(dl, e);
            }
        };

        this.download = function(name, path) {
            if (d) {
                var _logger = logger || dlmanager.logger;
                _logger.debug('download', name, path, dl_fw, zfileEntry);
            }

            if (!zfileEntry) {
                // aborted.
                return;
            }

            var saveLink = function(objectURL) {
                var node = document.getElementById('dllink');
                var link = typeof objectURL === 'string' && objectURL;

                node.download = name;
                node.href = link || zfileEntry.toURL();

                // prevent the beforeunload dispatcher from showing a dialog
                $.memIOSaveAttempt = dl_id;

                node.click();

                if (link) {
                    later(function() {
                        myURL.revokeObjectURL(link);
                    });
                }

                // restore beforeunload behavior...
                setTimeout(function() {
                    if ($.memIOSaveAttempt === dl_id) {
                        delete $.memIOSaveAttempt;
                    }
                }, 4e3);
            };

            var saveFile = function(file) {
                try {
                    file = new File([file], name, {
                        type: filemime(name)
                    });

                    saveLink(myURL.createObjectURL(file));
                }
                catch (ex) {
                    logger.error(ex);
                    saveLink();
                }
            };

            if (typeof zfileEntry.file === 'function') {
                try {
                    return zfileEntry.file(saveFile, saveLink);
                }
                catch (ex) {
                    logger.error(ex);
                }
            }

            saveLink();
        };

        this.setCredentials = function(url, size, filename, chunks, sizes) {
            logger = new MegaLogger('FileSystemAPI', {}, dl.writer.logger);
            dl_geturl = url;
            dl_filesize = size;
            dl_filename = filename;
            dl_chunks = chunks;
            dl_chunksizes = sizes;

            // Try to free space before starting the download.
            free_space(this.fsInitOp.bind(this), 50);
        };

        this.keepFileOnAbort = false;
        this.hasResumeSupport = true;
    };

    if (window.d) {
        window.free_space = free_space;
    }

    if (navigator.webkitGetUserMedia) {
        mBroadcaster.once('startMega', function __setup_fs() {
            WRITERR_DIAGTITLE = l[16871];

            if (dlMethod === FileSystemAPI) {
                if (window.requestFileSystem) {
                    window.requestFileSystem(0, 0x10000,
                        function(fs) {
                            free_space(checkSecurityError);
                        },
                        checkSecurityError
                    );
                }
                else if (MemoryIO.usable()) {
                    dlMethod = MemoryIO;
                }
                else {
                    dlMethod = false;
                }
            }
        });
    }
})(this);

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2016 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

// Keep a record of active transfers.
var GlobalProgress = Object.create(null);
var gfsttfbhosts = Object.create(null);
var __ccXID = 0;

if (localStorage.aTransfers) {
    onIdle(function() {
        'use strict';
        var data = {};
        var now = Date.now();
        try {
            data = JSON.parse(localStorage.aTransfers);
        }
        catch (e) {}
        for (var r in data) {
            // Let's assume there was a system/browser crash...
            if ((now - data[r]) > 86400000) {
                delete data[r];
            }
        }
        if (!$.len(data)) {
            delete localStorage.aTransfers;
        }
        else {
            localStorage.aTransfers = JSON.stringify(data);
        }
    });
}

function ClassChunk(task) {
    this.task = task;
    this.dl = task.download;
    this.url = task.url;
    this.size = task.size;
    this.io = task.download.io;
    this.done = false;
    this.avg = [0, 0];
    this.gid = task.file.gid;
    this.xid = this.gid + "_" + (++__ccXID);
    this.failed = false;
    this.altport = false;
    // this.backoff  = 1936+Math.floor(Math.random()*2e3);
    this.lastPing = Date.now();
    this.lastUpdate = Date.now();
    this.Progress = GlobalProgress[this.gid];
    this.Progress.dl_xr = this.Progress.dl_xr || dlmanager.mGetXR(); // global download progress
    this.Progress.speed = this.Progress.speed || 1;
    this.Progress.size = this.Progress.size || (this.dl.zipid ? Zips[this.dl.zipid].size : this.io.size);
    this.Progress.dl_lastprogress = this.Progress.dl_lastprogress || 0;
    this.Progress.dl_prevprogress = this.Progress.dl_prevprogress || this.dl.byteOffset || 0;
    this.Progress.data[this.xid] = [0, task.size];
    this[this.gid] = !0;
}

ClassChunk.prototype.toString = function() {
    return "[ClassChunk " + this.xid + "]";
};

ClassChunk.prototype.abort = function() {
    if (this.oet) {
        clearTimeout(this.oet);
    }
    if (this.xhr) {
        if (d) {
            dlmanager.logger.log(this + " ttfb@%s: %sms", this.xhr._host, this.xhr._ttfb);
        }
        if (!(gfsttfbhosts[this.xhr._host] > 5000) && this.xhr._ttfb > 5000) {
            api_req({a: 'log', e: 99671, m: 'ttfb:' + this.xhr._ttfb + '@' + this.xhr._host});
        }
        gfsttfbhosts[this.xhr._host] = this.xhr._ttfb;
        this.xhr.abort(this.xhr.ABORT_CLEANUP);
    }
    if (this.Progress) {
        array.remove(this.Progress.working, this, 1);
    }
    delete this.xhr;
};

// destroy
ClassChunk.prototype.destroy = function() {
    if (d) {
        dlmanager.logger.info('Destroying ' + this);
    }
    this.abort();
    oDestroy(this);
};

// shouldIReportDone
ClassChunk.prototype.shouldIReportDone = function(report_done) {
    var pbx = this.Progress.data[this.xid];
    if (!pbx) {
        return;
    }

    if (!report_done) {
        report_done = !this.done && dlQueue.canExpand()
            && (pbx[1] - pbx[0]) / this.Progress.speed <= dlmanager.dlDoneThreshold;
    }

    if (report_done) {
        if (d) {
            dlmanager.logger.info(this + ' reporting done() earlier to start another download.');
        }
        this.done = true;
        dlQueue.expand();
        dlmanager.preFetchDownloadTickets(this.dl.pos);
    }

    return report_done;
};

// updateProgress
ClassChunk.prototype.updateProgress = function(force) {
    if (uldl_hold) {
        // do not update the UI
        return false;
    }

    // var r = this.shouldIReportDone(force === 2);
    var r = force !== 2 ? this.shouldIReportDone() : 0x7f;
    if (this.Progress.dl_lastprogress + 200 > Date.now() && !force) {
        // too soon
        return false;
    }

    var _data = this.Progress.data;
    var _progress = this.Progress.done;
    for (var i in _data) {
        if (_data.hasOwnProperty(i)) {
            _progress += _data[i][0];
        }
    }

    if (this.dl.byteOffset) {
        _progress += this.dl.byteOffset;
    }

    this.dl.onDownloadProgress(
            this.dl.dl_id,
            Math.min(99, Math.floor(_progress / this.Progress.size * 100)),
            _progress, // global progress
            this.Progress.size, // total download size
            this.Progress.speed = this.Progress.dl_xr.update(_progress - this.Progress.dl_prevprogress), // speed
            this.dl.pos, // this download position
            force && force !== 2
        );

    this.Progress.dl_prevprogress = _progress;
    this.Progress.dl_lastprogress = Date.now();

    if (force !== 2 && dlmanager.isOverQuota) {
        dlmanager.onNolongerOverquota();
    }

    return r;
};

// isCancelled
ClassChunk.prototype.isCancelled = function() {
    if (!this.dl) {
        return true;
    }
    var is_cancelled = this.dl.cancelled;
    if (!is_cancelled) {
        if (typeof (this.dl.pos) !== 'number') {
            this.dl.pos = dlmanager.getDownloadByHandle(this.dl.id).pos;
        }
        is_cancelled = !dl_queue[this.dl.pos] || !dl_queue[this.dl.pos].n;
    }
    if (is_cancelled) {
        if (d) {
            dlmanager.logger.info(this + " aborting itself because download was canceled.", this.task.chunk_id);
        }
        this.dl.cancelled = true;
        this.finish_download();
        this.task.file.destroy();
        this.destroy();
    }
    return is_cancelled;
};

// finish_download
ClassChunk.prototype.finish_download = function() {
    if (d) {
        ASSERT(this.xhr || !this.dl || this.dl.cancelled, "Don't call me twice!");
    }
    if (this.xhr) {
        this.abort();
        this.task_done.apply(this, arguments);
    }
};

ClassChunk.prototype.onXHRprogress = function(xhrEvent) {
    if (!this.Progress.data[this.xid] || this.isCancelled()) {
        return;
    }
    // if (args[0].loaded) this.Progress.data[this.xid][0] = args[0].loaded;
    // this.updateProgress(!!args[0].zSaaDc ? 0x9a : 0);
    this.Progress.data[this.xid][0] = xhrEvent.loaded;
    this.updateProgress();
};

ClassChunk.prototype.onXHRerror = function(args, xhr) {
    if (d) {
        dlmanager.logger.error('ClassChunk.onXHRerror', this.task && this.task.chunk_id, args, xhr, this);
    }
    if (this.isCancelled() || !this.Progress.data[this.xid]) {
        return console.warn('This chunk should have been destroyed before reaching onerror...');
    }

    this.Progress.data[this.xid][0] = 0; /* reset progress */
    this.updateProgress(2);

    var chunk = this;
    var status = xhr.readyState > 1 && xhr.status;

    this.oet = setTimeout(function() {
        chunk.finish_download(false, {responseStatus: status});
        chunk = undefined;
    }, status === 509 || (3950 + Math.floor(Math.random() * 2e3)));
};

ClassChunk.prototype.onXHRready = function(xhrEvent) {
    var r;
    if (this.isCancelled()) {
        return;
    }
    var xhr = xhrEvent.target;
    try {
        r = xhr.response || {};
        xhr.response = false;
    }
    catch (e) {}
    if (r && r.byteLength === this.size) {
        this.Progress.done += r.byteLength;
        delete this.Progress.data[this.xid];
        this.updateProgress(true);
        if (navigator.appName !== 'Opera') {
            this.io.dl_bytesreceived += r.byteLength;
        }
        this.dl.decrypter++;
        Decrypter.push([
            [this.dl, this.task.offset],
            this.dl.nonce,
            this.task.offset / 16,
            new Uint8Array(r)
        ]);
        this.dl.retries = 0;
        this.finish_download();
        this.destroy();
    }
    else if (!this.dl.cancelled) {
        if (d) {
            dlmanager.logger.error("HTTP FAILED",
                this.dl.n, xhr.status, "am i done? " + this.done, r && r.byteLength, this.size);
        }
        if (dlMethod === MemoryIO) {
            try {
                r = new Uint8Array(0x1000000);
            }
            catch (e) {
                // We're running out of memory..
                dlmanager.logger.error('Uh, oh...', e);
                dlFatalError(this.dl, e);
            }
        }
        return Object(this.xhr).ABORT_EINTERNAL;
    }
};

ClassChunk.prototype.run = function(task_done) {
    if (this.isCancelled()) {
        return;
    }

    if (this.size < 100 * 1024 && dlQueue.expand()) {
        /**
         *  It is an small chunk and we *should* finish soon if everything goes
         *  fine. We release our slot so another chunk can start now. It is useful
         *  to speed up tiny downloads on a ZIP file
         */
        this.done = true;
    }

    this.task_done = task_done;
    if (!this.io.dl_bytesreceived) {
        this.io.dl_bytesreceived = 0;
    }

    this.Progress.working.push(this);

    // HACK: In case of 509s, construct the url from the dl object which must be up-to-date
    this.url = this.dl.url +  "/" + this.url.replace(/.+\//, '');

    /* let the fun begin! */
    this.url = dlmanager.uChangePort(this.url, this.altport ? 8080 : 0);
    if (d) {
        dlmanager.logger.info(this + " Fetching ", this.url);
    }
    this.xhr = getTransferXHR(this);
    this.xhr._murl = this.url;
    this.xhr._host = String(this.url).match(/\/\/(\w+)\./);
    if (this.xhr._host) {
        this.xhr._host = this.xhr._host[1];
    }

    this.xhr.open('POST', this.url, true);
    this.xhr.responseType = 'arraybuffer';
    this.xhr.send();

    if (Object(this.xhr.constructor).name === 'HSBHttpRequest') {
        skipcheck = true;
    }
};

// ClassFile
function ClassEmptyChunk(dl) {
    this.task = {
        zipid: dl.zipid,
        id: dl.id
    };
    this.dl = dl;
}

ClassEmptyChunk.prototype.run = function(task_done) {
    if (this.dl.zipid) {
        this.dl.writer.push({
            data: new Uint8Array(0),
            offset: 0
        });
        Soon(task_done);
    }
    else {
        this.dl.io.write(new Uint8Array(0), 0, function() {
            task_done();
            this.dl.ready();
            oDestroy(this);
        }.bind(this));
    }
}

function ClassFile(dl) {
    this.task = dl;
    this.dl = dl;
    this.gid = dlmanager.getGID(dl);
    if (!dl.zipid || !GlobalProgress[this.gid]) {
        GlobalProgress[this.gid] = {
            data: {},
            done: 0,
            working: []
        };
        dlmanager.dlSetActiveTransfer(dl.zipid || dl.dl_id);
    }
    this[this.gid] = !0;
    this.dl.owner = this;
}

ClassFile.prototype.toString = function() {
    if (d && d > 1) {
        return "[ClassFile " + this.gid + "/" + (this.dl ? (this.dl.zipname || this.dl.n) : '') + "]";
    }
    return "[ClassFile " + this.gid + "]";
};

ClassFile.prototype.abortTimers = function() {
    if (this.dl) {
        if (this.dl.retry_t) {
            this.dl.retry_t.abort();
            delete this.dl.retry_t;
        }
    }
};

ClassFile.prototype.destroy = function() {
    if (d) {
        dlmanager.logger.info('Destroying ' + this,
            this.dl ? (this.dl.cancelled ? 'cancelled' : 'finished') : 'expunged');
    }
    if (!this.dl) {
        return;
    }

    this.abortTimers();

    if (this.dl.cancelled) {
        if (this.dl.zipid && Zips[this.dl.zipid]) {
            Zips[this.dl.zipid].destroy(0xbadf);
        }
    }
    else {
        var skipMacIntegrityCheck = typeof skipcheck !== 'undefined' && skipcheck;
        var macIntegritySuccess = this.emptyFile || dlmanager.checkLostChunks(this.dl);

        if (skipMacIntegrityCheck && !macIntegritySuccess) {
            console.warn('MAC Integrity failed, but ignoring...', this.dl);
            dlmanager.logDecryptionError(this.dl, true);
        }

        if (!macIntegritySuccess && !skipMacIntegrityCheck) {
            dlmanager.dlReportStatus(this.dl, EKEY);

            if (Zips[this.dl.zipid]) {
                Zips[this.dl.zipid].destroy(EKEY);
            }
        }
        else if (this.dl.zipid) {
            Zips[this.dl.zipid].done(this);
        }
        else {
            mBroadcaster.sendMessage('trk:event', 'download', 'completed');

            this.dl.onDownloadProgress(
                this.dl.dl_id, 100,
                this.dl.size,
                this.dl.size, 0,
                this.dl.pos
            );

            this.dl.onBeforeDownloadComplete(this.dl);
            if (!this.dl.preview) {
                this.dl.io.download(this.dl.zipname || this.dl.n, this.dl.p || '');
            }
            this.dl.onDownloadComplete(this.dl);
            dlmanager.cleanupUI(this.dl, true);
        }
    }

    if (!this.dl.zipid) {
        delete GlobalProgress[this.gid];
    }
    dlmanager.dlClearActiveTransfer(this.dl.zipid || this.dl.dl_id);

    this.dl.ready = function onDeadEnd() {
        if (d) {
            dlmanager.logger.warn('We reached a dead end..');
        }
    };

    this.dl.writer.destroy();
    oDestroy(this);
}

ClassFile.prototype.run = function(task_done) {
    var cancelled = oIsFrozen(this) || !this.dl || this.dl.cancelled;

    if (cancelled || !this.gid || !GlobalProgress[this.gid]) {
        if (dlmanager.fetchingFile) {
            dlmanager.fetchingFile = 0;
        }
        if (!cancelled) {
            dlmanager.logger.warn('Invalid %s state.', this, this);
        }
        return task_done();
    }

    dlmanager.fetchingFile = 1; /* Block the fetchingFile state */
    this.dl.retries = 0; /* set the retries flag */

    // dlmanager.logger.info("dl_key " + this.dl.key);
    if (!GlobalProgress[this.gid].started) {
        GlobalProgress[this.gid].started = true;
        this.dl.onDownloadStart(this.dl);
        if (!this.dl.zipid) {
            mBroadcaster.sendMessage('trk:event', 'download', 'started');
        }
    }

    this.dl.ready = function() {
        if (d) {
            this.dl.writer.logger.info(this + ' readyState',
                this.chunkFinished, this.dl.writer.isEmpty(), this.dl.decrypter);
        }
        if (this.chunkFinished && this.dl.decrypter === 0 && this.dl.writer.isEmpty()) {
            this.destroy();
        }
    }.bind(this);

    this.dl.io.begin = function(newName, resumeOffset) {
        /* jshint -W074 */
        var tasks = [];

        if (!this.dl || this.dl.cancelled) {
            if (d) {
                dlmanager.logger.info(this + ' cancelled while initializing.');
            }
        }
        else if (!GlobalProgress[this.gid]) {
            if (d) {
                dlmanager.logger.info(this + ' has no associated progress instance, cancelled while initializing?');
            }
        }
        else {

            if (newName) {
                newName = M.getSafeName(newName);

                if (this.dl.zipid) {
                    this.dl.zipname = newName;
                }
                else {
                    this.dl.n = newName;
                }

                $('#' + dlmanager.getGID(this.dl) + ' .tranfer-filetype-txt').text(newName);
            }

            if (this.dl.pzBufferStateChange) {
                api_req({a: 'log', e: 99654, m: 'download resume from method switchover'});

                resumeOffset = this.dl.pzBufferStateChange.byteLength;
            }

            if (this.dl.byteOffset && resumeOffset !== this.dl.byteOffset) {
                if (d) {
                    dlmanager.logger.info(this + ' cannot resume at offset %s, %s given',
                        this.dl.byteOffset, resumeOffset);
                }

                this.dl.macs = this.dl.resumeInfo.macs = Object.create(null);
                this.dl.byteOffset = this.dl.resumeInfo.byteOffset = 0;

                api_req({a: 'log', e: 99651, m: 'download resume attempt failed'});
            }
            else if (resumeOffset) {
                this.dl.urls = this.dl.urls.filter(function(u) {
                    return u.offset >= resumeOffset;
                });

                this.dl.writer.pos = resumeOffset;

                if (this.dl.urls.length) {
                    api_req({a: 'log', e: 99652, m: 'download resume'});
                }
                else {
                    api_req({a: 'log', e: 99653, m: 'download resume for completed file'});
                }
            }

            if (d) {
                dlmanager.logger.info(this + ' Adding %d tasks...', this.dl.urls.length);
            }

            for (var i = this.dl.urls.length; i--;) {
                var url = this.dl.urls[i];

                tasks.push(new ClassChunk({
                    url: url.url,
                    size: url.size,
                    offset: url.offset,
                    download: this.dl,
                    chunk_id: i,
                    zipid: this.dl.zipid,
                    id: this.dl.id,
                    file: this
                }));
            }

            if ((this.emptyFile = (tasks.length === 0)) && this.dl.zipid) {
                tasks.push(new ClassEmptyChunk(this.dl));
            }

            if (tasks.length > 0) {
                dlQueue.pushAll(tasks,
                    function onChunkFinished() {
                        this.chunkFinished = true;
                    }.bind(this), dlmanager.failureFunction.bind(dlmanager));
            }
        }

        if (task_done) {
            dlmanager.fetchingFile = 0;
            task_done();

            if (this.dl) {
                delete this.dl.urls;
                delete this.dl.io.begin;
            }
            task_done = null;
        }

        if (tasks.length === 0) {
            // force file download
            this.destroy();
        }
    }.bind(this);

    dlmanager.dlGetUrl(this.dl, (error, res) => {
        var cancelOnInit = function(force) {
            if (!this.dl || this.dl.cancelled || force) {
                if (d) {
                    dlmanager.logger.error('Knock, knock..', this.dl);
                }
                if (this.dl) {
                    /* Remove leaked items from dlQueue & dl_queue */
                    dlmanager.abort(this.dl);
                    this.destroy(); // XXX: should be expunged already
                }
                return true;
            }
            return false;
        }.bind(this);

        var onError = function(error) {
            if (error && task_done) {
                // release worker
                dlmanager.fetchingFile = 0;
                Soon(task_done);
                task_done = null;
            }
            return error;
        };

        if (cancelOnInit()) {
            error = true;
        }
        else if (error) {
            var fatal = (error === EBLOCKED || error === ETOOMANY);

            this.dlGetUrlErrors = (this.dlGetUrlErrors | 0) + 1;

            if (this.dl.zipid && (fatal || this.dlGetUrlErrors > 20)) {
                // Prevent stuck ZIP downloads if there are repetitive errors for some of the files
                // TODO: show notification to the user about empty files in the zip?
                console.error('Too many errors for "' + this.dl.n + '", saving as 0-bytes...');

                if (error === EBLOCKED) {
                    Zips[this.dl.zipid].eblocked++;
                }

                try {
                    this.dl.size = 0;
                    this.dl.urls = [];
                    return this.dl.io.setCredentials("", 0, this.dl.n);
                }
                catch (e) {
                    setTransferStatus(this.dl, e, true);
                }
            }
            else if (fatal) {
                if (this.dl) {
                    dlmanager.dlReportStatus(this.dl, error);
                }
                cancelOnInit(true);
            }
            else {
                var onGetUrlError = function onGetUrlError() {
                    if (!cancelOnInit()) {
                        this.dl.retry_t = null;
                        dlmanager.logger.info(this + ' Retrying dlGetUrl for ' + this.dl.n);
                        dlmanager.dlQueuePushBack(this);
                    }
                }.bind(this);

                if (error === EOVERQUOTA) {
                    dlmanager.logger.warn(this + ' Got EOVERQUOTA, holding...');
                    dlmanager.showOverQuotaDialog(onGetUrlError);
                    this.dlGetUrlErrors = 0;
                }
                else {
                    dlmanager.dlRetryInterval *= 1.2;
                    if (dlmanager.dlRetryInterval > 2e5) {
                        dlmanager.dlRetryInterval = 2e5;
                    }
                    (this.dl.retry_t = tSleep(dlmanager.dlRetryInterval / 1e3)).then(onGetUrlError).catch(dump);
                    dlmanager.logger.warn(this + ' Retry to fetch url in %dms, error:%s',
                                            dlmanager.dlRetryInterval, error);
                }
            }
        }
        else {
            const init = (resumeInfo) => {
                dlmanager.initDownload(this, res, resumeInfo)
                    .then((info) => {
                        if (!onError(cancelOnInit()) && d > 1) {
                            dlmanager.logger.debug('initDownload succeed', info, resumeInfo);
                        }
                    })
                    .catch((ex) => {
                        if (ex === EEXPIRED) {
                            // already aborted.
                            return;
                        }
                        if (d) {
                            dlmanager.logger.error('initDownload error', ex);
                        }
                        dlFatalError(this.dl, escapeHTML(l[5945]).replace('{0}', ex));
                        cancelOnInit(true);
                        onError(ex);
                    });
            };

            if (dlmanager.dlResumeThreshold > res.s) {

                init(false);
            }
            else {
                dlmanager.getResumeInfo(this.dl, init);
            }
        }

        if (error) {
            onError(error);
        }

    });
};

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2016 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

mBroadcaster.once('startMega', function _setupDecrypter() {
    'use strict';

    var decrypter = CreateWorkers('decrypter.js', function(context, e, done) {
        var dl = context[0];
        var offset = context[1];

        if (typeof (e.data) === "string") {
            if (e.data[0] === '[') {
                var pos = offset;
                var t = JSON.parse(e.data);
                for (var i = 0; i < t.length; i += 4) {
                    dl.macs[pos] = [t[i], t[i + 1], t[i + 2], t[i + 3]];
                    pos += 1048576;
                }
            }
            if (d > 1) {
                decrypter.logger.info("worker replied string", e.data, dl.macs);
            }
        }
        else {
            var plain = new Uint8Array(e.data.buffer || e.data);
            if (d) {
                decrypter.logger.info("Decrypt done", dl.cancelled);
            }
            dl.decrypter--;
            if (!dl.cancelled) {
                if (oIsFrozen(dl.writer)) {
                    if (d) {
                        decrypter.logger.warn('Writer is frozen.', dl);
                    }
                }
                else {
                    dl.writer.push({
                        data: plain,
                        offset: offset
                    });
                }
            }
            plain = null;
            done();
        }
    });

    dlmanager.logger.options.levelColors = {
        'ERROR': '#fe1111',
        'DEBUG': '#0000ff',
        'WARN':  '#C25700',
        'INFO':  '#189530',
        'LOG':   '#000044'
    };
    Object.defineProperty(window, 'Decrypter', { value: decrypter });
});

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2016 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

var dlmanager = {
    // Keep in track real active downloads.
    // ETA (in seconds) to consider a download finished, used to speed up chunks.
    // Despite the fact that the DownloadQueue has a limitted size,
    // to speed up things for tiny downloads each download is able to
    // report to the scheduler that they are done when it may not be necessarily
    // true (but they are for instance close to their finish)
    dlDoneThreshold: 3,
    // How many queue IO we want before pausing the XHR fetching,
    // useful when we have internet faster than our IO
    ioThrottleLimit: 6,
    isOverQuota : false,
    ioThrottlePaused: false,
    fetchingFile: false,
    dlLastQuotaWarning: 0,
    dlRetryInterval: 1000,
    dlMaxChunkSize: 16 * 1048576,
    dlResumeThreshold: 0x200000,
    fsExpiryThreshold: 172800,
    isDownloading: false,
    dlZipID: 0,
    gotHSTS: false,
    resumeInfoTag: 'dlrv2!',
    resumeInfoCache: Object.create(null),
    logger: MegaLogger.getLogger('dlmanager'),

    /**
     * Set user flags for the limitation dialogs.
     * @alias dlmanager.lmtUserFlags
     */
    setUserFlags: function() {
        this.lmtUserFlags = 0;

        // Possible flag values:
        // 01 = this.LMT_ISREGISTERED
        // 02 = this.LMT_ISPRO
        // 03 = this.LMT_ISREGISTERED | this.LMT_ISPRO
        // 04 = this.LMT_HASACHIEVEMENTS
        // 05 = this.LMT_ISREGISTERED | this.LMT_HASACHIEVEMENTS
        // 07 = this.LMT_ISREGISTERED | this.LMT_ISPRO | this.LMT_HASACHIEVEMENTS
        // 09 = this.LMT_ISREGISTERED | this.LMT_PRO3
        // 13 = this.LMT_ISREGISTERED | this.LMT_PRO3 | this.LMT_HASACHIEVEMENTS

        if (u_type) {
            this.lmtUserFlags |= this.LMT_ISREGISTERED;

            if (Object(u_attr).p) {
                this.lmtUserFlags |= this.LMT_ISPRO;

                if (u_attr.p === 3) {
                    this.lmtUserFlags |= this.LMT_PRO3;
                }
            }
        }

        if (mega.achievem) {
            mega.achievem.enabled()
                .done(function() {
                    dlmanager.lmtUserFlags |= dlmanager.LMT_HASACHIEVEMENTS;
                });
        }
    },

    getResumeInfo: function(dl, callback) {
        'use strict';

        if (!dl) {
            return MegaPromise.reject(EINCOMPLETE);
        }

        if (typeof dl === 'string') {
            dl = {ph: dl, hasResumeSupport: true};
        }
        var promise;
        var tag = this.getResumeInfoTag(dl);

        if (d) {
            this.logger.debug('getResumeInfo', tag, dl);
        }

        if (this.resumeInfoCache[tag]) {
            this.resumeInfoCache[tag].tag = tag;
            promise = MegaPromise.resolve(this.resumeInfoCache[tag]);
        }
        else if (!dl.hasResumeSupport) {
            promise = MegaPromise.resolve(false);
        }
        else {
            promise = M.getPersistentData(tag, true);
        }

        if (typeof callback === 'function') {
            promise.then(callback).catch(callback.bind(null, false));
        }

        return promise;
    },

    remResumeInfo: function(dl) {
        'use strict';

        if (!dl) {
            return MegaPromise.reject(EINCOMPLETE);
        }

        if (typeof dl === 'string') {
            dl = {ph: dl};
        }

        if (d) {
            this.logger.debug('remResumeInfo', this.getResumeInfoTag(dl), dl);
        }

        return M.delPersistentData(this.getResumeInfoTag(dl));
    },

    setResumeInfo: function(dl, byteOffset) {
        'use strict';

        if (!dl || !dl.resumeInfo || !dl.hasResumeSupport) {
            return MegaPromise.reject(EINCOMPLETE);
        }

        dl.resumeInfo.macs = dl.macs;
        dl.resumeInfo.byteOffset = byteOffset;

        if (d) {
            this.logger.debug('setResumeInfo', this.getResumeInfoTag(dl), dl.resumeInfo, dl);
        }

        return M.setPersistentData(this.getResumeInfoTag(dl), dl.resumeInfo, true);
    },

    // @private
    getResumeInfoTag: function(dl) {
        'use strict';

        return this.resumeInfoTag + (dl.ph ? dl.ph : u_handle + dl.id);
    },

    /**
     * Check whether a downloaded file can be viewed within the browser through a blob/data URI in mobile.
     * @param {Object|String} n An ufs-node or filename
     * @returns {Boolean}
     */
    openInBrowser: function(n) {
        'use strict';

        // These browsers do not support opening blob.
        if (ua.details.brand === 'FxiOS'
            || ua.details.brand === 'CriOS'
            || ua.details.browser === 'Opera'
            || ua.details.browser === 'MiuiBrowser'
            || ua.details.browser === 'SamsungBrowser') {

            return false;
        }

        var exts = ["pdf", "txt", "png", "gif", "jpg", "jpeg"];

        if (ua.details.engine === 'Gecko') {
            exts.push('mp4', 'm4a', 'mp3', 'webm', 'ogg');
        }

        if (is_ios) {
            exts.push("doc", "docx", "ods", "odt", "ppt", "pptx", "rtf", "xls", "xlsx");
        }

        return localStorage.openAllInBrowser || exts.indexOf(fileext(n.n || n.name || n)) !== -1;
    },

    /**
     * Check whether the browser does support saving downloaded data to disk
     * @param {Object|String} n An ufs-node or filename
     * @returns {Number} 1: yes, 0: no, -1: can be viewed in a blob:
     */
    canSaveToDisk: function(n) {
        'use strict';

        if (dlMethod === MemoryIO && !MemoryIO.canSaveToDisk) {
            // if cannot be saved to disk, check whether at least we can open it within the browser.
            return this.openInBrowser(n) ? -1 : 0;
        }

        return 1;
    },

    /**
     * For a resumable download, check the filesize on disk
     * @param {String} handle Node handle
     * @param {String} filename The filename..
     * @returns {MegaPromise}
     */
    getFileSizeOnDisk: promisify(function(resolve, reject, handle, filename) {
        'use strict';

        if (dlMethod === FileSystemAPI) {
            M.getFileEntryMetadata('mega/' + handle)
                .then(function(metadata) {
                    resolve(metadata.size);
                }).catch(reject);
        }
        else {
            reject(EACCESS);
        }
    }),

    /**
     * Initialize download
     * @param {ClassFile} file The class file instance
     * @param {Object} gres The API reply to the `g` request
     * @param {Object} resumeInfo Resumable info, if any
     * @returns {Promise}
     */
    initDownload: function(file, gres, resumeInfo) {
        'use strict';

        if (!(file instanceof ClassFile)) {
            return Promise.reject(EARGS);
        }
        if (!file.dl || !Object(file.dl.io).setCredentials) {
            return Promise.reject(EACCESS);
        }
        if (!gres || typeof gres !== 'object' || file.dl.size !== gres.s) {
            return Promise.reject(EFAILED);
        }
        if (file.dl.cancelled) {
            return Promise.reject(EEXPIRED);
        }
        const {dl} = file;
        const {promise} = mega;

        var dl_urls = [];
        var dl_chunks = [];
        var dl_chunksizes = {};
        var dl_filesize = dl.size;
        var byteOffset = resumeInfo.byteOffset || 0;

        var p = 0;
        var pp = 0;
        for (var i = 1; i <= 8 && p < dl_filesize - i * 131072; i++) {
            dl_chunksizes[p] = i * 131072;
            dl_chunks.push(p);
            pp = p;
            p += dl_chunksizes[p];
        }

        var chunksize = dl_filesize / dlQueue._limit / 2;
        if (chunksize > dlmanager.dlMaxChunkSize) {
            chunksize = dlmanager.dlMaxChunkSize;
        }
        else if (chunksize <= 1048576) {
            chunksize = 1048576;
        }
        else {
            chunksize = 1048576 * Math.floor(chunksize / 1048576);
        }

        /**
        var reserved = dl_filesize - (chunksize * (dlQueue._limit - 1));
        while (p < dl_filesize) {
            dl_chunksizes[p] = p > reserved ? 1048576 : chunksize;
            dl_chunks.push(p);
            pp = p;
            p += dl_chunksizes[p];
        }
        /**/
        while (p < dl_filesize) {
            var length = Math.floor((dl_filesize - p) / 1048576 + 1) * 1048576;
            if (length > chunksize) {
                length = chunksize;
            }
            dl_chunksizes[p] = length;
            dl_chunks.push(p);
            pp = p;
            p += length;
        }
        /**/

        if (!(dl_chunksizes[pp] = dl_filesize - pp)) {
            delete dl_chunksizes[pp];
            delete dl_chunks[dl_chunks.length - 1];
        }

        for (var j = dl_chunks.length; j--;) {
            if (dl_chunks[j] !== undefined) {
                var offset = dl_chunks[j];

                dl_urls.push({
                    url: gres.g + '/' + offset + '-' + (offset + dl_chunksizes[offset] - 1),
                    size: dl_chunksizes[offset],
                    offset: offset
                });
            }
        }

        if (resumeInfo && typeof resumeInfo !== 'object') {
            dlmanager.logger.warn('Invalid resumeInfo entry.', resumeInfo, file);
            resumeInfo = false;
        }

        dl.url = gres.g;
        dl.urls = dl_urls;
        dl.macs = resumeInfo.macs || dl.macs || Object.create(null);
        dl.resumeInfo = resumeInfo || Object.create(null);
        dl.byteOffset = dl.resumeInfo.byteOffset = byteOffset;

        var result = {
            chunks: dl_chunks,
            offsets: dl_chunksizes
        };

        var startDownload = function() {
            try {
                dl.io.setCredentials(dl.url, dl.size, dl.n, dl_chunks, dl_chunksizes, resumeInfo);
                promise.resolve(result);
            }
            catch (ex) {
                setTransferStatus(dl, ex);
                promise.reject(ex);
            }
        };

        if (resumeInfo.entry) {
            delete dlmanager.resumeInfoCache[resumeInfo.tag];

            M.readFileEntry(resumeInfo.entry)
                .then(function(ab) {
                    if (ab instanceof ArrayBuffer && ab.byteLength === dl.byteOffset) {
                        dl.pzBufferStateChange = ab;
                    }
                    else {
                        console.warn('Invalid pzBufferStateChange...', ab, dl.byteOffset);
                    }
                })
                .always(function() {
                    onIdle(startDownload);
                    resumeInfo.entry.remove(function() {});
                    delete resumeInfo.entry;
                });
        }
        else {
            startDownload();
        }

        return promise;
    },

    /**
     * Browser query on maximum downloadable file size
     * @returns {MegaPromise}
     */
    getMaximumDownloadSize: function() {
        'use strict';

        var promise = new MegaPromise();

        var max = function() {
            promise.resolve(Math.pow(2, is_mobile ? 32 : 53));
        };

        if (dlMethod === FileSystemAPI) {
            var success = function(used, remaining) {
                if (remaining < 1) {
                    // either the user hasn't granted persistent quota or
                    // we're in Incognito..let FileSystemAPI deal with it
                    max();
                }
                else {
                    promise.resolve(Math.max(remaining, MemoryIO.fileSizeLimit));
                }
            };

            if (navigator.webkitPersistentStorage) {
                navigator.webkitPersistentStorage.queryUsageAndQuota(success, max);
            }
            else if (window.webkitStorageInfo) {
                window.webkitStorageInfo.queryUsageAndQuota(1, success, max);
            }
            else {
                // Hmm...
                promise.resolve(-1);
            }
        }
        else if (dlMethod === MemoryIO) {
            promise.resolve(MemoryIO.fileSizeLimit);
        }
        else {
            max();
        }

        return promise;
    },

    newUrl: function DM_newUrl(dl, callback) {
        var gid = dl.dl_id || dl.ph;

        if (callback) {
            if (!this._newUrlQueue) {
                this._newUrlQueue = {};
            }

            if (this._newUrlQueue.hasOwnProperty(gid)) {
                this._newUrlQueue[gid].push(callback);
                return;
            }
            this._newUrlQueue[gid] = [callback];
        }
        if (d) {
            dlmanager.logger.info("Retrieving New URLs for", gid);
        }
        const {dlQueue} = window;

        dlQueue.pause();
        delete dl.dlTicketData;
        dlmanager.dlGetUrl(dl, function(error, res, o) {
            if (error) {
                return later(this.newUrl.bind(this, dl));
            }
            dl.url = res.g;

            var changed = 0;
            for (var i = 0; i < dlQueue._queue.length; i++) {
                const e = dlQueue._queue[i][0];

                if (e.dl === dl) {
                    e.url = `${res.g}/${String(e.url).replace(/.+\//, '')}`;
                    changed++;
                }
            }
            if (Object(this._newUrlQueue).hasOwnProperty(gid)) {
                this._newUrlQueue[gid]
                    .forEach(function(callback) {
                        callback(res.g, res);
                    });
                delete this._newUrlQueue[gid];
            }
            dlmanager.logger.info("Resuming, got new URL for %s", gid, res.g, changed, res);
            dlQueue.resume();
        }.bind(this));
    },

    uChangePort: function DM_uChangePort(url, port) {
        if (!this.gotHSTS && String(url).substr(0,5) === 'http:') {
            var uri = document.createElement('a');
            uri.href = url;

            if (port) {
                url = url.replace(uri.host, uri.hostname + ':' + port);
            }
            else if (uri.host !== uri.hostname) {
                url = url.replace(uri.host, uri.hostname);
            }
        }

        return url;
    },

    checkHSTS: function(xhr) {
        if (!use_ssl && !this.gotHSTS) {
            try {
                if (String(xhr.responseURL).substr(0, 6) === 'https:') {
                    this.gotHSTS = true;
                }
            }
            catch (ex) {
                if (d) {
                    this.logger.error(ex);
                }
            }
        }
    },

    cleanupUI: function DM_cleanupUI(gid) {
        if (typeof gid === 'object') {
            gid = this.getGID(gid);
        }

        var l = dl_queue.length;
        while (l--) {
            var dl = dl_queue[l];

            if (gid === this.getGID(dl)) {
                if (d) {
                    dlmanager.logger.info('cleanupUI', gid, dl.n, dl.zipname);
                }

                if (dl.io instanceof MemoryIO) {
                    dl.io.abort();
                }
                // oDestroy(dl.io);
                dl_queue[l] = Object.freeze({});
            }
        }
    },

    getGID: function DM_GetGID(dl) {
        return dl.zipid ? 'zip_' + dl.zipid : 'dl_' + (dl.dl_id || dl.ph);
    },

    dlGetUrl: function DM_dlGetUrl(dl, callback) {
        'use strict';

        if (dl.byteOffset && dl.byteOffset === dl.size) {
            // Completed download.
            return callback(false, {s: dl.size, g: dl.url || 'https://localhost.save-file.mega.nz/dl/1234'});
        }

        const ctx = {
            object: dl,
            next: callback,
            dl_key: dl.key
        };

        if (typeof dl.dlTicketData === 'object') {

            return this.dlGetUrlDone(dl.dlTicketData, ctx);
        }
        this.preFetchDownloadTickets(dl.pos);

        return megaUtilsGFSFetch.getTicketData(dl)
            .then((res) => {

                this.dlGetUrlDone(res, ctx);

                return res;
            })
            .catch((ex) => {
                this.logger.error('Failed to retrieve download ticket.', ex, [dl]);
                callback(ex);
            });
    },

    preFetchDownloadTickets(index, limit, queue, space, ridge) {
        'use strict';

        index = index || 0;
        limit = limit || 7;
        queue = queue || dl_queue;
        space = space || 96 * 1024;
        ridge = ridge || limit << 3;

        if (d) {
            this.logger.info('prefetching download tickets...', index, limit, ridge, space, [queue]);
        }

        let c = 0;
        for (let i = index; queue[i]; ++i) {
            const dl = queue[i].dl || queue[i];

            if (!('dlTicketData' in dl) && dl.byteOffset !== dl.size) {

                ++c;
                megaUtilsGFSFetch.getTicketData(dl).catch(dump);

                if (!--ridge || dl.size > space && !--limit) {
                    break;
                }
            }
        }

        if (d) {
            this.logger.info('...queued %d download tickets.', c);
        }
    },

    _clearGp: function() {
        'use strict';
        for (const k in GlobalProgress) {
            if (k[0] !== 'u') {
                let chunk;
                const w = GlobalProgress[k].working;
                while ((chunk = w.pop())) {
                    let result = chunk.isCancelled();
                    if (!result) {
                        this.logger.error('Download chunk %s(%s) should have been cancelled itself.', k, chunk);
                    }
                }
            }
        }
    },

    abortAll: function DM_abort_all() {
        'use strict';
        const dlQueue = window.dlQueue;
        const abort = tryCatch(dl => {
            if (typeof dl.io.abort === "function") {
                if (d) {
                    dlmanager.logger.info('IO.abort', dl);
                }
                dl.io.abort("User cancelled");
            }
        }, ex => {
            dlmanager.logger.error(ex);
        });

        const destroy = function(task) {
            task = task[0];
            if (task instanceof ClassChunk && !task.isCancelled() && task.destroy) {
                task.destroy();
            }
        };

        for (let k = dl_queue.length; k--;) {
            const dl = dl_queue[k];
            if (dl.id) {
                if (!dl.cancelled) {
                    if (dl.hasResumeSupport) {
                        dlmanager.remResumeInfo(dl).dump();
                    }
                    abort(dl);
                }
                dl.cancelled = true;
                if (dl.zipid && Zips[dl.zipid]) {
                    Zips[dl.zipid].cancelled = true;
                }
                if (dl.io && typeof dl.io.begin === 'function') {
                    /* Canceled while Initializing? Let's free up stuff
                     * and notify the scheduler for the running task
                     */
                    dl.io.begin();
                }
                if (dl.io instanceof MemoryIO) {
                    dl.io.abort();
                }
                dl_queue[k] = Object.freeze({});
            }
        }

        dlQueue._queue.forEach(destroy);
        Object.values(dlQueue._qpaused).forEach(destroy);

        this._clearGp();
        dlQueue._qpaused = {};
    },

    abort: function DM_abort(gid, keepUI) {

        if (gid === null || Array.isArray(gid)) {
            this._multiAbort = 1;

            if (gid) {
                gid.forEach(function(dl) {
                    dlmanager.abort(dl, keepUI);
                });
            }
            else {
                dlmanager.abortAll();
            }

            delete this._multiAbort;
            Soon(M.resetUploadDownload);
        }
        else {
            if (typeof gid === 'object') {
                gid = this.getGID(gid);
            }
            else if (!gid || gid[0] === 'u') {
                return;
            }

            var found = 0;
            var l = dl_queue.length;
            while (l--) {
                var dl = dl_queue[l];

                if (gid === this.getGID(dl)) {
                    if (!dl.cancelled) {
                        if (dl.hasResumeSupport) {
                            dlmanager.remResumeInfo(dl).dump();
                        }

                        try {
                            if (dl.io && typeof dl.io.abort === "function") {
                                if (d) {
                                    dlmanager.logger.info('IO.abort', gid, dl);
                                }
                                dl.io.abort("User cancelled");
                            }
                        }
                        catch (e) {
                            dlmanager.logger.error(e);
                        }
                    }
                    dl.cancelled = true;
                    if (dl.zipid && Zips[dl.zipid]) {
                        Zips[dl.zipid].cancelled = true;
                    }
                    if (dl.io && typeof dl.io.begin === 'function') {
                        /* Canceled while Initializing? Let's free up stuff
                         * and notify the scheduler for the running task
                         */
                        dl.io.begin();
                    }
                    found++;
                }
            }

            if (!found) {
                this.logger.warn('Download %s was not found in dl_queue', gid);
            }
            else if (found > 1 && gid[0] !== 'z') {
                this.logger.error('Too many matches looking for %s in dl_queue (!?)', gid);
            }

            if (!keepUI) {
                this.cleanupUI(gid);
            }

            /* We rely on `dl.cancelled` to let chunks destroy himself.
             * However, if the dl is paused we might end up with the
             + ClassFile.destroy uncalled, which will be leaking.
             */
            var foreach;
            if (dlQueue._qpaused[gid]) {
                foreach = function(task) {
                    task = task[0];
                    return task instanceof ClassChunk && task.isCancelled() || task.destroy();
                };
            }
            dlQueue.filter(gid, foreach);

            /* Active chunks might are stuck waiting reply,
             * which won't get destroyed itself right away.
             */
            if (GlobalProgress[gid]) {
                var chunk;
                var w = GlobalProgress[gid].working;
                while ((chunk = w.pop())) {
                    var result = chunk.isCancelled();
                    this.logger.assert(result, 'Download chunk %s(%s) should have been cancelled itself.', gid, chunk);
                }
            }

            if (!this._multiAbort) {
                Soon(M.resetUploadDownload);
            }
        }
    },

    dlGetUrlDone: function DM_dlGetUrlDone(res, ctx) {
        'use strict';
        let error = res.e;
        const dl = ctx.object;

        if (!res.e) {
            const key = [
                ctx.dl_key[0] ^ ctx.dl_key[4],
                ctx.dl_key[1] ^ ctx.dl_key[5],
                ctx.dl_key[2] ^ ctx.dl_key[6],
                ctx.dl_key[3] ^ ctx.dl_key[7]
            ];
            const attr = dec_attr(base64_to_ab(res.at), key);

            if (typeof attr === 'object' && typeof attr.n === 'string') {
                const minSize = 1e3;

                if (d) {
                    console.assert(res.s > minSize || !ctx.object.preview, 'What are we previewing?');
                }

                if (page !== 'download'
                    && (
                        !res.fa
                        || !String(res.fa).includes(':0*')
                        || !String(res.fa).includes(':1*')
                        || ctx.object.preview === -1
                    )
                    && res.s > minSize
                    && M.shouldCreateThumbnail(dl.h)
                    && !sessionStorage.gOOMtrap) {

                    const image = is_image(attr.n);
                    const audio = !image && is_audio(attr.n);
                    const video = !audio && is_video(attr.n);
                    const limit = 96 * 1048576;

                    if (res.s < limit && (image || audio) || video) {
                        if (d) {
                            this.logger.warn(
                                '[%s] Missing thumb/prev, will try to generate...', attr.n, [res], [attr]
                            );
                        }

                        tryCatch(() => {
                            Object.defineProperty(ctx.object, 'misThumbData', {
                                writable: true,
                                value: new ArrayBuffer(Math.min(res.s, limit))
                            });
                        }, () => {
                            sessionStorage.gOOMtrap = 1;
                        })();
                    }
                }

                // dlmanager.onNolongerOverquota();
                return ctx.next(false, res, attr, ctx.object);
            }
        }
        error = error < 0 && parseInt(error) || EKEY;

        dlmanager.dlReportStatus(dl, error);

        ctx.next(error || new Error("failed"));
    },

    onNolongerOverquota: function() {
        'use strict';

        dlmanager.isOverQuota = false;
        dlmanager.isOverFreeQuota = false;
        $('.limited-bandwidth-dialog button.js-close, .limited-bandwidth-dialog .fm-dialog-close').trigger('click');
    },

    dlQueuePushBack: function DM_dlQueuePushBack(aTask) {
        var isValidTask = aTask && (aTask.onQueueDone || aTask instanceof ClassFile);

        dlmanager.logger.debug('dlQueuePushBack', isValidTask, aTask);

        if (ASSERT(isValidTask, 'dlQueuePushBack: Invalid aTask...')) {
            dlQueue.pushFirst(aTask);

            if (dlmanager.ioThrottlePaused) {
                delay('dlQueuePushBack', dlQueue.resume.bind(dlQueue), 40);
            }
        }
    },

    logDecryptionError: function(dl, skipped) {
        'use strict';

        if (dl && Array.isArray(dl.url)) {
            // Decryption error from direct CloudRAID download

            var str = "";
            if (dl.cloudRaidSettings) {
                str += "f:" + dl.cloudRaidSettings.onFails;
                str += " t:" + dl.cloudRaidSettings.timeouts;
                str += " sg:" + dl.cloudRaidSettings.startglitches;
                str += " tmf:" + dl.cloudRaidSettings.toomanyfails;
            }

            eventlog(99720, JSON.stringify([3, dl && dl.id, str, skipped ? 1 : 0]));
        }
        else if (String(dl && dl.url).length > 256) {
            // Decryption error from proxied CloudRAID download

            eventlog(99706, JSON.stringify([2, dl && dl.id, skipped ? 1 : 0]));
        }
        else {
            eventlog(99711, JSON.stringify([2, dl && dl.id, skipped ? 1 : 0]));
        }
    },

    dlReportStatus: function DM_reportstatus(dl, code) {
        this.logger.warn('dlReportStatus', code, this.getGID(dl), dl);

        if (dl) {
            dl.lasterror = code;
            dl.onDownloadError(dl, code);
        }

        var eekey = code === EKEY;
        if (eekey || code === EACCESS || code === ETOOMANY || code === ENOENT) {
            // TODO: Check if other codes should raise abort()

            later(() => {
                dlmanager.abort(dl, eekey);
            });

            if (M.chat) {
                window.toaster.main.hideAll().then(() => {
                    showToast('download', eekey ? l[24] : l[20228]);
                });
            }
            else if (code === ETOOMANY) {

                // If `g` request return ETOOMANY, it means the user who originally owned the file is suspended.
                showToast('download', l[20822]);
            }
        }

        if (code === EBLOCKED) {
            showToast('download', l[20705]);
        }

        if (eekey) {
            this.logDecryptionError(dl);
        }

        if (code === ETEMPUNAVAIL) {
            eventlog(99698, true);
        }
    },

    dlClearActiveTransfer: tryCatch(function DM_dlClearActiveTransfer(dl_id) {
        'use strict';

        if (is_mobile) {
            return;
        }
        var data = JSON.parse(localStorage.aTransfers || '{}');
        if (data[dl_id]) {
            delete data[dl_id];
            if (!$.len(data)) {
                delete localStorage.aTransfers;
            }
            else {
                localStorage.aTransfers = JSON.stringify(data);
            }
        }
    }),

    dlSetActiveTransfer: tryCatch(function DM_dlSetActiveTransfer(dl_id) {
        'use strict';

        if (is_mobile) {
            return;
        }
        var data = JSON.parse(localStorage.aTransfers || '{}');
        data[dl_id] = Date.now();
        localStorage.aTransfers = JSON.stringify(data);
    }),

    isTrasferActive: function DM_isTrasferActive(dl_id) {
        var date = null;

        if (localStorage.aTransfers) {
            var data = JSON.parse(localStorage.aTransfers);

            date = data[dl_id];
        }

        if (typeof dlpage_ph === 'string' && dlpage_ph === dl_id) {
            date = Date.now();
        }

        return date;
    },

    failureFunction: function DM_failureFunction(task, args) {
        var code = args[1].responseStatus || 0;
        var dl = task.task.download;

        if (d) {
            dlmanager.logger.error('Fai1ure',
                dl.zipname || dl.n, code, task.task.chunk_id, task.task.offset, task.onQueueDone.name);
        }

        if (code === 509) {
            if (!dl.log509 && Object(u_attr).p) {
                dl.log509 = 1;
                api_req({ a: 'log', e: 99614, m: 'PRO user got 509' });
            }
            this.showOverQuotaDialog(task);
            dlmanager.dlReportStatus(dl, EOVERQUOTA);
            return 1;
        }

        /* update UI */
        dlmanager.dlReportStatus(dl, EAGAIN);

        if (code === 403 || code === 404) {
            dlmanager.newUrl(dl, function(rg) {
                if (!task.url) {
                    return;
                }
                task.url = rg + "/" + task.url.replace(/.+\//, '');
                dlmanager.dlQueuePushBack(task);
            });
        }
        else {
            /* check for network error  */
            dl.dl_failed = true;
            task.altport = !task.altport;
            api_reportfailure(hostname(dl.url), ulmanager.networkErrorCheck);
            dlmanager.dlQueuePushBack(task);
        }

        return 2;
    },

    getDownloadByHandle: function DM_IdToFile(handle) {
        var dl = null;
        if (handle) {
            for (var i in dl_queue) {
                if (dl_queue.hasOwnProperty(i)) {
                    var dlh = dl_queue[i].ph || dl_queue[i].id;
                    if (dlh === handle) {
                        dl = dl_queue[i];
                        break;
                    }
                }
            }
        }
        return dl;
    },

    throttleByIO: function DM_throttleByIO(writer) {
        writer.on('queue', function() {
            if (writer._queue.length >= dlmanager.ioThrottleLimit && !dlQueue.isPaused()) {
                writer.logger.info("IO_THROTTLE: pause XHR");
                dlQueue.pause();
                dlmanager.ioThrottlePaused = true;

                if (page === 'download') {
                    $('.download.status-txt').text(l[8579]);
                }
            }
        });

        writer.on('working', function() {
            if (writer._queue.length < dlmanager.ioThrottleLimit && dlmanager.ioThrottlePaused) {
                writer.logger.info("IO_THROTTLE: resume XHR");
                dlQueue.resume();
                dlmanager.ioThrottlePaused = false;

                if (page === 'download') {
                    $('.download.status-txt').text(l[258]);
                }
            }
        });
    },

    checkLostChunks: function DM_checkLostChunks(file) {
        'use strict';
        var dl_key = file.key;

        if (!this.verifyIntegrity(file)) {
            return false;
        }

        if (file.misThumbData) {
            var options = {
                onPreviewRetry: file.preview === -1
            };
            if (!file.zipid) {
                options.raw = is_rawimage(file.n) || mThumbHandler.has(file.n);
            }
            createnodethumbnail(
                file.id,
                new sjcl.cipher.aes([
                    dl_key[0] ^ dl_key[4],
                    dl_key[1] ^ dl_key[5],
                    dl_key[2] ^ dl_key[6],
                    dl_key[3] ^ dl_key[7]
                ]),
                ++ulmanager.ulFaId,
                file.misThumbData,
                options
            );
            file.misThumbData = false;
        }

        return true;
    },

    /** compute final MAC from block MACs, allow for EOF chunk race gaps */
    verifyIntegrity: function(dl) {
        'use strict';
        const match = (mac) => dl.key[6] === (mac[0] ^ mac[1]) && dl.key[7] === (mac[2] ^ mac[3]);
        const macs = Object.keys(dl.macs).map(Number).sort((a, b) => a - b).map(v => dl.macs[v]);
        const aes = new sjcl.cipher.aes([
            dl.key[0] ^ dl.key[4], dl.key[1] ^ dl.key[5], dl.key[2] ^ dl.key[6], dl.key[3] ^ dl.key[7]
        ]);

        let mac = condenseMacs(macs, aes);

        // normal case, correct file, correct mac
        if (match(mac)) {
            return true;
        }

        // up to two connections lost the race, up to 32MB (ie chunks) each
        const end = macs.length;
        const max = Math.min(32 * 2, end);
        const gap = (macs, gapStart, gapEnd) => {
            let mac = [0, 0, 0, 0];

            for (let i = 0; i < macs.length; ++i) {
                if (i < gapStart || i >= gapEnd) {
                    let mblk = macs[i];

                    for (let j = 0; j < mblk.length; j += 4) {
                        mac[0] ^= mblk[j];
                        mac[1] ^= mblk[j + 1];
                        mac[2] ^= mblk[j + 2];
                        mac[3] ^= mblk[j + 3];

                        mac = aes.encrypt(mac);
                    }
                }
            }
            return mac;
        };

        // most likely - a single connection gap (possibly two combined)
        for (let countBack = 1; countBack <= max; ++countBack) {
            const start1 = end - countBack;

            for (let len1 = 1; len1 <= 64 && start1 + len1 <= end; ++len1) {
                mac = gap(macs, start1, start1 + len1);

                if (match(mac)) {
                    if (d) {
                        this.logger.warn(dl.owner + ' Resolved MAC Gap %d-%d/%d', start1, start1 + len1, end);
                    }
                    eventlog(99739);
                    return true;
                }
            }
        }

        return false;
    },

    dlWriter: function DM_dl_writer(dl, is_ready) {
        'use strict';

        function finish_write(task, done) {
            task.data = undefined;
            done();

            if (typeof task.callback === "function") {
                task.callback();
            }
            if (dl.ready) {
                // tell the download scheduler we're done.
                dl.ready();
            }
        }

        function safeWrite(data, offset, callback) {
            var abort = function swa(ex) {
                console.error(ex);
                dlFatalError(dl, ex);
            };

            try {
                dl.io.write(data, offset, tryCatch(callback, abort));
            }
            catch (ex) {
                abort(ex);
            }
        }

        dl.writer = new MegaQueue(function dlIOWriterStub(task, done) {
            if (!task.data.byteLength || dl.cancelled) {
                if (d) {
                    dl.writer.logger.error(dl.cancelled ? "download cancelled" : "writing empty chunk");
                }
                return finish_write(task, done);
            }
            var logger = dl.writer && dl.writer.logger || dlmanager.logger;

            var abLen = task.data.byteLength;
            var ready = function _onWriterReady() {
                if (dl.cancelled || oIsFrozen(dl.writer)) {
                    if (d) {
                        logger.debug('Download canceled while writing to disk...', dl.cancelled, [dl]);
                    }
                    return;
                }
                dl.writer.pos += abLen;

                if (dl.misThumbData && task.offset + abLen <= dl.misThumbData.byteLength) {
                    new Uint8Array(
                        dl.misThumbData,
                        task.offset,
                        abLen
                    ).set(task.data);
                }

                if (dlmanager.dlResumeThreshold > dl.size) {

                    return finish_write(task, done);
                }

                dlmanager.setResumeInfo(dl, dl.writer.pos)
                    .always(function() {
                        finish_write(task, done);
                    });
            };

            var writeTaskChunk = function() {
                safeWrite(task.data, task.offset, ready);
            };

            if (dl.pzBufferStateChange) {
                safeWrite(dl.pzBufferStateChange, 0, writeTaskChunk);
                delete dl.pzBufferStateChange;
            }
            else {
                writeTaskChunk();
            }

        }, 1, 'download-writer');

        dlmanager.throttleByIO(dl.writer);

        dl.writer.pos = 0;

        dl.writer.validateTask = function(t) {
            var r = (!is_ready || is_ready()) && t.offset === dl.writer.pos;
            // if (d) this.logger.info('validateTask', r, t.offset, dl.writer.pos, t, dl, dl.writer);
            return r;
        };
    },

    mGetXR: function DM_getxr() {
        'use strict';

        return Object.assign(Object.create(null), {
            update: function(b) {
                var ts = Date.now();
                if (b < 0) {
                    this.tb = Object.create(null);
                    this.st = 0;
                    return 0;
                }
                if (b) {
                    this.tb[ts] = this.tb[ts] ? this.tb[ts] + b : b;
                }
                b = 0;
                for (var t in this.tb) {
                    if (t < ts - this.window) {
                        delete this.tb[t];
                    }
                    else {
                        b += this.tb[t];
                    }
                }
                if (!b) {
                    this.st = 0;
                    return 0;
                }
                else if (!this.st) {
                    this.st = ts;
                }

                if (!(ts -= this.st)) {
                    return 0;
                }

                if (ts > this.window) {
                    ts = this.window;
                }

                return b / ts;
            },

            st: 0,
            window: 60000,
            tb: Object.create(null)
        });
    },

    _quotaPushBack: {},
    _dlQuotaListener: [],

    _onQuotaRetry: function DM_onQuotaRetry(getNewUrl, sid) {
        delay.cancel('overquota:retry');
        this.setUserFlags();

        var ids = dlmanager.getCurrentDownloads();
        // $('.limited-bandwidth-dialog button.js-close').trigger('click');

        if (d) {
            this.logger.debug('_onQuotaRetry', getNewUrl, ids, this._dlQuotaListener.length, this._dlQuotaListener);
        }

        if (this.onOverquotaWithAchievements) {
            closeDialog();
            topmenuUI();

            dlmanager._achievementsListDialog();
            delete this.onOverquotaWithAchievements;
            return;
        }

        if (this.isOverFreeQuota) {
            closeDialog();
            topmenuUI();

            if (sid) {
                this.isOverFreeQuota = sid;
            }
        }

        if (page === 'download') {
            var $dtb = $('.download.download-page');
            $dtb.removeClass('stream-overquota overquota');
            $('.download.over-transfer-quota', $dtb).addClass('hidden');
            $(window).trigger('resize');
        }
        else if (ids.length) {
            if (is_mobile) {
                mega.ui.sheet.hide();
                mobile.downloadOverlay.downloadTransfer.resetTransfer();
            }
            else {
                resetOverQuotaTransfers(ids);
            }
        }

        for (var i = 0; i < this._dlQuotaListener.length; ++i) {
            if (typeof this._dlQuotaListener[i] === "function") {
                this._dlQuotaListener[i]();
            }
        }
        this._dlQuotaListener = [];

        var tasks = [];

        for (var gid in this._quotaPushBack) {
            if (this._quotaPushBack.hasOwnProperty(gid)
                    && this._quotaPushBack[gid].onQueueDone) {

                tasks.push(this._quotaPushBack[gid]);
            }
        }
        this._quotaPushBack = {};

        this.logger.debug('_onQuotaRetry', tasks.length, tasks);

        if (getNewUrl && tasks.length) {
            var len = tasks.length;

            tasks.forEach(function(task) {
                var dl = task.task.download;

                dlmanager.newUrl(dl, function(rg) {
                    if (task.url) {
                        task.url = rg + "/" + task.url.replace(/.+\//, '');
                        dlmanager.dlQueuePushBack(task);
                    }

                    if (!--len) {
                        ids.forEach(fm_tfsresume);
                    }
                });
            });
        }
        else {
            tasks.forEach(this.dlQueuePushBack);
            ids.forEach(fm_tfsresume);
        }
    },

    _achievementsListDialog: function($dialog) {
        'use strict';

        if (d) {
            this.logger.info('_achievementsListDialog', this.onOverquotaWithAchievements, $dialog);
        }

        mega.achievem.achievementsListDialog(function() {
            dlmanager._onOverquotaDispatchRetry($dialog);
        });
    },

    _onOverquotaDispatchRetry: function($dialog) {
        'use strict';

        this.setUserFlags();

        if (d) {
            this.logger.info('_onOverquotaDispatchRetry', this.lmtUserFlags, $dialog);
        }

        if (this.onLimitedBandwidth) {
            // pre-warning dialog
            this.onLimitedBandwidth();
        }
        else {
            // from overquota dialog
            this._onQuotaRetry(true);
        }

        if ($dialog) {
            // update transfers buttons on the download page...
            this._overquotaClickListeners($dialog);
        }
    },

    _onOverQuotaAttemptRetry: function(sid) {
        'use strict';

        if (!this.onOverquotaWithAchievements) {
            if (this.isOverQuota) {
                delay.cancel('overquota:uqft');

                if (this.isOverFreeQuota) {
                    this._onQuotaRetry(true, sid);
                }
                else {
                    this.uqFastTrack = !Object(u_attr).p;
                    delay('overquota:uqft', this._overquotaInfo.bind(this), 900);
                }
            }

            if (typeof this.onLimitedBandwidth === 'function') {
                this.onLimitedBandwidth();
            }
        }
    },

    _overquotaInfo: function() {
        'use strict';

        const onQuotaInfo = (res) => {
            const $dialog = $('.limited-bandwidth-dialog', 'body');

            let timeLeft = 3600;
            if (u_type > 2 && u_attr.p) {
                timeLeft = (res.suntil || 0) - unixtime();
                timeLeft = timeLeft > 0 ? timeLeft : 0;
            }
            else if (Object(res.tah).length) {

                let add = 1;
                // let size = 0;

                timeLeft = 3600 - ((res.bt | 0) % 3600);

                for (let i = 0; i < res.tah.length; i++) {
                    // size += res.tah[i];

                    if (res.tah[i]) {
                        add = 0;
                    }
                    else if (add) {
                        timeLeft += 3600;
                    }
                }
            }

            clearInterval(this._overQuotaTimeLeftTick);
            if (timeLeft < 3600 * 24) {
                delay('overquota:retry', () => this._onQuotaRetry(), timeLeft * 1000);
            }

            let $dlPageCountdown = $('.download.transfer-overquota-txt', 'body')
                .text(String(l[7100]).replace('%1', ''));

            if (!$dlPageCountdown.is(':visible')) {
                $dlPageCountdown = null;
            }

            this._overquotaClickListeners($dialog);
            let lastCheck = Date.now();

            if ($dialog.is(':visible') || $dlPageCountdown) {
                const $countdown = $('.countdown', $dialog).removeClass('hidden');
                const tick = () => {
                    const curTime = Date.now();
                    if (lastCheck + 1000 < curTime) {
                        // Convert ms to s and remove difference from remaining
                        timeLeft -= Math.floor((curTime - lastCheck) / 1000);
                        if (timeLeft < 3600 * 24) {
                            delay('overquota:retry', () => this._onQuotaRetry(), timeLeft * 1000);
                        }
                    }
                    lastCheck = curTime;
                    const time = secondsToTimeLong(timeLeft--);

                    if (time) {
                        $countdown.safeHTML(time);
                        $countdown.removeClass('hidden');

                        if ($dlPageCountdown) {
                            const html = `<span class="countdown">${secondsToTimeLong(timeLeft)}</span>`;
                            $dlPageCountdown.safeHTML(escapeHTML(l[7100]).replace('%1', html));
                        }
                    }
                    else {
                        $countdown.text('');
                        $countdown.addClass('hidden');

                        if ($dlPageCountdown) {
                            $dlPageCountdown.text(String(l[7100]).replace('%1', ''));
                        }
                        clearInterval(dlmanager._overQuotaTimeLeftTick);
                    }
                };

                tick();
                this._overQuotaTimeLeftTick = setInterval(tick, 1000);
            }
        };

        api.req({a: 'uq', xfer: 1, pro: 1}, {cache: -10}).then(({result: res}) => {
            delay('overquotainfo:reply.success', () => {
                if (typeof res === "number") {
                    // Error, just keep retrying
                    onIdle(() => this._overquotaInfo());
                    return;
                }

                // XXX: replaced uqFastTrack usage by directly checking for pro flag ...
                if (this.onOverQuotaProClicked && u_type) {
                    // The user loged/registered in another tab, poll the uq command every
                    // 30 seconds until we find a pro status and then retry with fresh download

                    const proStatus = res.mxfer;
                    this.logger.debug('overquota:proStatus', proStatus);

                    delay('overquota:uqft', () => this._overquotaInfo(), 30000);
                }

                onQuotaInfo(res);
            });
        }).catch((ex) => {
            if (d) {
                dlmanager.logger.warn('_overquotaInfo', ex);
            }

            delay('overquotainfo:reply.error', () => this._overquotaInfo(), 2e3);
        });
    },

    _overquotaClickListeners($dialog, flags, preWarning) {
        'use strict';

        var self = this;
        var unbindEvents = function() {
            $(window).unbind('resize.overQuotaDialog');
            $('.fm-dialog-overlay', 'body').unbind('click.closeOverQuotaDialog');
        };
        var closeDialog = function() {
            if ($.dialog === 'download-pre-warning') {
                $.dialog = 'was-pre-warning';
            }
            unbindEvents();
            window.closeDialog();
        };
        var open = function(url) {
            if (is_mobile) {
                location.href = url;
                return false;
            }
            window.open.apply(window, arguments);
        };
        var onclick = function onProClicked() {
            if (preWarning) {
                api_req({a: 'log', e: 99643, m: 'on overquota pre-warning upgrade/pro-plans clicked'});
            }
            else {
                self.onOverQuotaProClicked = true;
                delay('overquota:uqft', self._overquotaInfo.bind(self), 30000);
                api_req({a: 'log', e: 99640, m: 'on overquota pro-plans clicked'});
            }

            if ($(this).hasClass('plan-button')) {
                sessionStorage.fromOverquotaPeriod = $(this).parent().data('period');
                open(getAppBaseUrl() + '#propay_' + $(this).closest('.plan').data('payment'));
            }
            else {
                if (flags & dlmanager.LMT_PRO3) {
                    // Scroll to flexi section of pro page
                    sessionStorage.mScrollTo = 'flexi';
                }
                else if ($dialog.hasClass('pro-mini')) {
                    // Use the same flag to indicate the exclusive offer tab should be opened
                    // to prevent the browser extension from breaking
                    sessionStorage.mScrollTo = 'exc';
                }

                open(getAppBaseUrl() + '#pro');
            }

            return false;
        };

        flags = flags !== undefined ? flags : this.lmtUserFlags;

        if (preWarning) {
            localStorage.seenQuotaPreWarn = Date.now();

            $('.msg-overquota', $dialog).addClass('hidden');
            $('.msg-prewarning', $dialog).removeClass('hidden');
            $('.dialog-action', $dialog)
                .text(flags & dlmanager.LMT_PRO3 ? l[6826] : l[17091])
                .rebind('click', this.onLimitedBandwidth.bind(this));

            $('button.positive.upgrade', $dialog).text(l[433]);
        }
        else {
            $('.msg-overquota', $dialog).removeClass('hidden');
            $('.msg-prewarning', $dialog).addClass('hidden');

            $('button.positive.upgrade', $dialog).text(l.upgrade_now);

            $('.dialog-action', $dialog)
                .text(flags & this.LMT_PRO3 ? l.ok_button : l.wait_for_free_tq_btn_text);

            $('.video-theatre-mode:visible').addClass('paused');

            if (page === 'download') {
                var $dtb = $('.download.download-page');

                $('.see-our-plans', $dtb).rebind('click', onclick);

                $('.download.over-transfer-quota', $dtb).removeClass('hidden');
                $('.resume-download', $dtb).removeClass('hidden');
                $dtb.addClass('stream-overquota');
                $(window).trigger('resize');
            }
        }

        $('button.js-close, .fm-dialog-close, .dialog-action', $dialog).add($('.fm-dialog-overlay'))
            .rebind('click.closeOverQuotaDialog', () => {

                unbindEvents();
            });

        $('button.positive.upgrade, .plan-button', $dialog).rebind('click', onclick);

        if (flags & this.LMT_ISPRO) {
            $dialog.addClass(flags & this.LMT_PRO3 ? 'pro3' : 'pro');
        }
        else if (!(flags & this.LMT_ISREGISTERED)) {
            if (preWarning && !u_wasloggedin()) {
                api_req({a: 'log', e: 99646, m: 'on pre-warning not-logged-in'});
            }

            var $pan = $('.not-logged.no-achievements', $dialog);

            if ($pan.length && !$pan.hasClass('flag-pcset')) {
                $pan.addClass('flag-pcset');

                api.req({a: 'efqb'}).then(({result: val}) => {
                    if (val) {
                        $pan.text(String($pan.text()).replace('10%', `${val | 0}%`));
                    }
                });
            }
        }

        if (flags & this.LMT_HASACHIEVEMENTS) {
            $dialog.addClass('achievements');
            localStorage.gotOverquotaWithAchievements = 1;
        }
    },

    _setOverQuotaState: function DM_setOverQuotaState(dlTask) {
        this.isOverQuota = true;
        localStorage.seenOverQuotaDialog = Date.now();
        this.logger.debug('_setOverQuotaState', dlTask);

        if (typeof dlTask === "function") {
            this._dlQuotaListener.push(dlTask);
        }
        else if (dlTask) {
            this._quotaPushBack[dlTask.gid] = dlTask;
        }

        this.getCurrentDownloads()
            .forEach(function(gid) {
                fm_tfspause(gid, true);
            });
    },

    showOverQuotaRegisterDialog: function DM_freeQuotaDialog(dlTask) {

        this._setOverQuotaState(dlTask);

        // did we get a sid from another tab? (watchdog:setsid)
        if (typeof this.isOverFreeQuota === 'string') {
            // Yup, delay a retry...
            return delay('overfreequota:retry', this._onQuotaRetry.bind(this, true), 1200);
        }
        this.isOverFreeQuota = true;

        if (localStorage.awaitingConfirmationAccount) {
            var accountData = JSON.parse(localStorage.awaitingConfirmationAccount);
            this.logger.debug('showOverQuotaRegisterDialog: awaitingConfirmationAccount!');
            return mega.ui.sendSignupLinkDialog(accountData);
        }

        api_req({a: 'log', e: 99613, m: 'on overquota register dialog shown'});

        mega.ui.showRegisterDialog({
            title: l[17],
            body: '<p>' + l[8834] + '</p><p>' + l[8833] + '</p><h2>' + l[1095] + '</h2>',
            showLogin: true,

            onAccountCreated: function(gotLoggedIn, accountData) {
                if (gotLoggedIn) {
                    // dlmanager._onQuotaRetry(true);
                    dlmanager._onOverquotaDispatchRetry();

                    api_req({a: 'log', e: 99649, m: 'on overquota logged-in through register dialog.'});
                }
                else {
                    security.register.cacheRegistrationData(accountData);
                    mega.ui.sendSignupLinkDialog(accountData);

                    api_req({a: 'log', e: 99650, m: 'on overquota account created.'});
                }
            }
        });
    },

    updateOBQDialogBlurb($dialog, miniPlanId, isStreaming) {
        'use strict';

        const flags = this.lmtUserFlags;
        const planName = miniPlanId ? pro.getProPlanName(miniPlanId) : '';

        if ($dialog.hasClass('uploads')) {
            $('.transfer-overquota-txt', $dialog).text(miniPlanId ? l.upgrade_resume_uploading : l[19136]);
        }
        else if ($dialog.hasClass('exceeded')) {
            const $overQuotaMsg = $('p.msg-overquota', $dialog).empty();
            let type = isStreaming ? 'stream_media' : 'dl';

            if (flags & dlmanager.LMT_ISPRO) {
                if (miniPlanId && (miniPlanId === u_attr.p) && !isStreaming) {
                    $overQuotaMsg.safeAppend(l.dl_tq_exceeded_more_mini.replace('%1', planName));
                }
                else {
                    const plan = flags & dlmanager.LMT_PRO3 ? 'pro3' : 'pro';
                    $overQuotaMsg.safeAppend(l[`${type}_tq_exceeded_${plan}`]);
                }
            }
            else {
                const level = miniPlanId ? 'mini' : 'free';
                type = isStreaming ? 'streaming' : 'dl';

                let string = l[`${type}_tq_exc_${level}_desktop`];
                if (level === 'mini') {
                    string = string.replace('%2', planName);
                }

                $overQuotaMsg.safeAppend(string);
            }
        }
        else {
            const level = miniPlanId ? 'mini' : 'free';

            let string = l[`dl_limited_tq_${level}`];
            if (miniPlanId) {
                string = string.replace('%1', planName);
            }

            $('p.msg-prewarning', $dialog).empty().safeAppend(string);
        }
    },

    prepareOBQDialogPlans($dialog, lowestPlanIsMini, miniPlanId) {
        'use strict';

        const $pricingBoxTemplate = $('.plan.template', $dialog);

        if (lowestPlanIsMini) {
            const $monthlyCard = $pricingBoxTemplate.clone(true).appendTo($pricingBoxTemplate.parent());
            $monthlyCard
                .removeClass('template')
                .addClass(`pro${miniPlanId}`)
                .toggleClass('starter', miniPlanId === pro.ACCOUNT_LEVEL_STARTER)
                .attr('data-payment', miniPlanId)
                .attr('data-period', 1);

            if (pro.filter.simple.yearlyMiniPlans.has(miniPlanId)) {
                const $yearlyCard = $pricingBoxTemplate.clone(true).appendTo($pricingBoxTemplate.parent());
                $yearlyCard
                    .removeClass('template')
                    .addClass(`pro${miniPlanId}`)
                    .attr('data-payment', miniPlanId)
                    .attr('data-period', 12);

                $('.pricing-page.plan-button', $monthlyCard).removeClass('positive');
            }
        }
        else {
            const planIds = [4, 1, 2, 3];

            for (const id of planIds) {
                const $newNode = $pricingBoxTemplate.clone(true).appendTo($pricingBoxTemplate.parent());
                $newNode.removeClass('template').addClass(`pro${id}`).attr('data-payment', id);
            }

            $('.pricing-page.radio-buttons', $dialog).removeClass('hidden');
            pro.proplan.initPlanPeriodControls($dialog);
        }
        $pricingBoxTemplate.remove();
        var $pricingBoxes = $('.plan', $dialog);

        // Set yearly prices by default if not showing mini plan cards
        const preSelectedPeriod = lowestPlanIsMini ? 1 : ((sessionStorage.getItem('pro.period') | 0) || 12);
        pro.proplan.updateEachPriceBlock("D", $pricingBoxes, $dialog, preSelectedPeriod);
    },

    setPlanPrices($dialog, showDialogCb) {
        'use strict';

        var $scrollBlock = $('.scrollable', $dialog);

        // Set scroll to top
        $scrollBlock.scrollTop(0);

        // Load the membership plans
        pro.loadMembershipPlans(function() {

            const slideshowPreview = slideshowid && is_video(M.getNodeByHandle(slideshowid));
            const isStreaming = !dlmanager.isDownloading && (dlmanager.isStreaming || slideshowPreview);

            const lowestPlanIsMini = pro.filter.simple.miniPlans.has(pro.minPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL]);
            let miniPlanId;
            if (lowestPlanIsMini) {
                $dialog.addClass('pro-mini');

                if (isStreaming) {
                    $dialog.addClass('no-cards');
                }
                miniPlanId = lowestPlanIsMini ? pro.filter.miniMin[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] : '';
            }

            // Update the blurb text of the dialog
            dlmanager.updateOBQDialogBlurb($dialog, miniPlanId, isStreaming);

            // Render the plan details if required
            if (!$dialog.hasClass('no-cards')) {
                dlmanager.prepareOBQDialogPlans($dialog, lowestPlanIsMini, miniPlanId);
            }

            if (dlmanager.isOverQuota) {
                dlmanager._overquotaInfo();
            }

            if (!is_mobile) {

                // Check if touch device
                var is_touch = function() {
                    return 'ontouchstart' in window || 'onmsgesturechange' in window;
                };

                // Initialise scrolling
                if (!is_touch()) {
                    if ($scrollBlock.is('.ps')) {
                        Ps.update($scrollBlock[0]);
                    }
                    else {
                        Ps.initialize($scrollBlock[0]);
                    }
                }
            }

            // Run the callback function (to show the dialog) if one exists
            if (typeof showDialogCb === 'function') {
                showDialogCb();
            }
        });
    },

    showLimitedBandwidthDialog: function(res, callback, flags) {
        'use strict';

        var $dialog = $('.limited-bandwidth-dialog');

        loadingDialog.hide();
        this.onLimitedBandwidth = function() {
            if (callback) {
                $dialog.removeClass('exceeded achievements pro3 pro pro-mini no-cards uploads');
                $('.dialog-action, button.js-close, .fm-dialog-close', $dialog).off('click');
                $('button.positive.upgrade, .pricing-page.plan', $dialog).off('click');

                if ($.dialog === 'download-pre-warning') {
                    $.dialog = false;
                }
                closeDialog();
                Soon(callback);
                callback = $dialog = undefined;

                if (is_mobile) {
                    tryCatch(() => mobile.overBandwidthQuota.closeSheet())();
                }
            }
            delete this.onLimitedBandwidth;
            return false;
        };

        flags = flags !== undefined ? flags : this.lmtUserFlags;

        if (d) {
            // as per ticket 6446
            // /* 01 */ flags = this.LMT_ISREGISTERED | this.LMT_HASACHIEVEMENTS;
            // /* 02 */ flags = this.LMT_HASACHIEVEMENTS;
            // /* 03 */ flags = 0;
            // /* 04 */ flags = this.LMT_ISREGISTERED;

            this.lmtUserFlags = flags;
        }

        if (is_mobile) {
            mobile.overBandwidthQuota.show(false);
            return;
        }

        $dialog.removeClass('exceeded achievements pro3 pro pro-mini no-cards uploads');

        // Load the membership plans, then show the dialog
        dlmanager.setPlanPrices($dialog, () => {
            M.safeShowDialog('download-pre-warning', () => {
                eventlog(99617);// overquota pre-warning shown.

                uiCheckboxes($dialog, 'ignoreLimitedBandwidth');
                dlmanager._overquotaClickListeners($dialog, flags, res || true);

                return $dialog;
            });
        });
    },

    showOverQuotaDialog: function DM_quotaDialog(dlTask, flags) {
        'use strict';

        flags = flags !== undefined ? flags : this.lmtUserFlags;

        if (d) {
            // as per ticket 6446
            // /* 05 */ flags = this.LMT_ISREGISTERED | this.LMT_HASACHIEVEMENTS;
            // /* 06 */ flags = this.LMT_HASACHIEVEMENTS;
            // /* 07 */ flags = 0;
            // /* 08 */ flags = this.LMT_ISREGISTERED;
            // /* 09 */ flags = this.LMT_ISREGISTERED | this.LMT_ISPRO | this.LMT_HASACHIEVEMENTS;
            // /* 10 */ flags = this.LMT_ISREGISTERED | this.LMT_ISPRO;

            this.lmtUserFlags = flags;
        }

        if (this.efq && !(flags & this.LMT_ISREGISTERED)) {
            return this.showOverQuotaRegisterDialog(dlTask);
        }
        loadingDialog.hide();

        var $dialog = $('.limited-bandwidth-dialog');

        $(document).fullScreen(false);
        this._setOverQuotaState(dlTask);

        if (is_mobile) {
            mobile.overBandwidthQuota.show(true);
            return;
        }

        if ($dialog.is(':visible') && !$dialog.hasClass('uploads')) {
            this.logger.info('showOverQuotaDialog', 'visible already.');
            return;
        }

        if ($('.achievements-list-dialog').is(':visible')) {
            this.logger.info('showOverQuotaDialog', 'Achievements dialog visible.');
            return;
        }

        $dialog.removeClass('achievements pro3 pro pro-mini no-cards uploads').addClass('exceeded');

        // Load the membership plans, then show the dialog
        dlmanager.setPlanPrices($dialog, () => {
            M.safeShowDialog('download-overquota', () => {
                $('.header-before-icon.exceeded', $dialog).text(l[17]);


                dlmanager._overquotaClickListeners($dialog, flags);

                $('.fm-dialog-overlay').rebind(
                    'click.dloverq', dlmanager.doCloseModal.bind(dlmanager, 'dloverq', $dialog)
                );

                $dialog
                    .rebind('dialog-closed', dlmanager.doCloseModal.bind(dlmanager, 'dloverq', $dialog));

                $('button.js-close, .fm-dialog-close, .dialog-action', $dialog).rebind(
                    'click.quota', dlmanager.doCloseModal.bind(dlmanager, 'dloverq', $dialog)
                );

                if (window.pfcol) {
                    eventlog(99956);
                }
                eventlog(99648);

                return $dialog;
            });
        });
    },

    doCloseModal(overlayEvent, $dialog) {
        'use strict';

        if (!$('span.countdown').is(':visible')) {
            clearInterval(dlmanager._overQuotaTimeLeftTick);
        }
        $('.fm-dialog-overlay').off(`click.${overlayEvent}`);
        $dialog.off('dialog-closed');
        $('button.js-close, .fm-dialog-close', $dialog).off('click.quota');
        closeDialog();

        return false;
    },

    showNothingToDownloadDialog: function DM_noDownloadDialog(callback) {
        'use strict';

        loadingDialog.hide();
        msgDialog('warningb', '', l.empty_download_dlg_title, l.empty_download_dlg_text, callback);
    },

    getCurrentDownloads: function() {
        return array.unique(dl_queue.filter(isQueueActive).map(dlmanager.getGID));
    },

    getCurrentDownloadsSize: function(sri) {
        var size = 0;

        if (typeof dl_queue === 'undefined') {
            return size;
        }

        dl_queue
            .filter(isQueueActive)
            .map(function(dl) {
                size += dl.size;

                if (sri) {
                    // Subtract resume info

                    if (dl.byteOffset) {
                        size -= dl.byteOffset;
                    }
                }
            });

        return size;
    },

    getQBQData: function() {
        'use strict';

        var q = {p: [], n: [], s: 0};

        dl_queue
            .filter(isQueueActive)
            .map(function(dl) {
                if (!dl.loaded || dl.size - dl.loaded) {
                    if (dl.ph) {
                        q.p.push(dl.ph);
                    }
                    else {
                        q.n.push(dl.id);
                    }

                    if (dl.loaded) {
                        q.s += dl.loaded;
                    }
                }
            });

        return q;
    },

    /**
     * Check whether MEGAsync is running.
     *
     * @param {String}  minVersion      The min MEGAsync version required.
     * @param {Boolean} getVersionInfo  Do not reject the promise if the min version is not
     *                                  meet, instead resolve it providing an ERANGE result.
     * @return {MegaPromise}
     */
    isMEGAsyncRunning: function(minVersion, getVersionInfo) {
        var timeout = 400;
        var logger = this.logger;
        var promise = new MegaPromise();

        var resolve = function() {
            if (promise) {
                loadingDialog.hide();
                logger.debug('isMEGAsyncRunning: YUP', arguments);

                promise.resolve.apply(promise, arguments);
                promise = undefined;
            }
        };
        var reject = function(e) {
            if (promise) {
                loadingDialog.hide();
                logger.debug('isMEGAsyncRunning: NOPE', e);

                promise.reject.apply(promise, arguments);
                promise = undefined;
            }
        };
        var loader = function() {
            if (typeof megasync === 'undefined') {
                return reject(EACCESS);
            }
            megasync.isInstalled(function(err, is) {
                if (err || !is) {
                    reject(err || ENOENT);
                }
                else {
                    var verNotMeet = false;

                    // if a min version is required, check for it
                    if (minVersion) {
                        var runningVersion = M.vtol(is.v);

                        if (typeof minVersion !== 'number'
                                || parseInt(minVersion) !== minVersion) {

                            minVersion = M.vtol(minVersion);
                        }

                        if (runningVersion < minVersion) {
                            if (!getVersionInfo) {
                                return reject(ERANGE);
                            }

                            verNotMeet = ERANGE;
                        }
                    }

                    var syncData = clone(is);
                    syncData.verNotMeet = verNotMeet;

                    resolve(megasync, syncData);
                }
            });
        };

        loadingDialog.show();
        logger.debug('isMEGAsyncRunning: checking...');

        if (typeof megasync === 'undefined') {
            timeout = 4000;
            M.require('megasync_js').always(loader);
        }
        else {
            onIdle(loader);
        }

        setTimeout(reject, timeout);

        return promise;
    },

    setBrowserWarningClasses: function(selector, $container, message) {
        'use strict';

        var uad = ua.details || false;
        var $elm = $(selector, $container);

        if (message) {
            $elm.addClass('default-warning');
        }
        else if (String(uad.browser).startsWith('Edg')) {
            $elm.addClass('edge');
        }
        else if (window.safari) {
            $elm.addClass('safari');
        }
        else if (window.opr) {
            $elm.addClass('opera');
        }
        else if (mega.chrome) {
            $elm.addClass('chrome');
        }
        else if (uad.engine === 'Gecko') {
            $elm.addClass('ff');
        }
        else if (uad.engine === 'Trident') {
            $elm.addClass('ie');
        }

        var setText = function(locale, $elm) {
            var text = uad.browser ? String(locale).replace('%1', uad.browser) : l[16883];

            if (message) {
                text = l[1676] + ': ' + message + '<br/>' + l[16870] + ' %2';
            }

            if (mega.chrome) {
                if (window.Incognito) {
                    text = text.replace('%2', '(' + l[16869] + ')');
                }
                else if (message) {
                    text = text.replace('%2', '');
                }
                else if (is_extension) {
                    text = l[17792];
                }
                else {
                    text = l[17793];

                    onIdle(function() {
                        $('.freeupdiskspace').rebind('click', function() {
                            var $dialog = $('.megasync-overlay');
                            $('.megasync-close, button.js-close, .fm-dialog-close', $dialog).click();

                            msgDialog('warningb', l[882], l[7157], 0, async(yes) => {
                                if (yes) {
                                    loadingDialog.show();
                                    await Promise.allSettled([eventlog(99682), M.clearFileSystemStorage()]);
                                    location.reload(true);
                                }
                            });
                            return false;
                        });
                    });
                }
            }
            else {
                text = text.replace('%2', '(' + l[16868] + ')');
            }

            $elm.find('span.txt').safeHTML(text);
        };

        $('.mega-button', $elm).rebind('click', function() {
            if (typeof megasync === 'undefined') {
                console.error('Failed to load megasync.js');
            }
            else {
                if (typeof dlpage_ph === 'string') {
                    megasync.download(dlpage_ph, dlpage_key);
                }
                else {
                    window.open(
                        megasync.getMegaSyncUrl() || 'https://mega.io/desktop',
                        '_blank',
                        'noopener,noreferrer'
                    );
                }
            }
            if ($('.download.download-page').hasClass('video')) {
                $elm.removeClass('visible');
            }
        });

        $('button.js-close, .fm-dialog-close', $elm).rebind('click', function() {
            $elm.removeClass('visible');
        });

        if ($container && $elm) {
            setText(l[16866], $elm);
            $container.addClass('warning');
        }
        else {
            setText(l[16865], $elm.addClass('visible'));
        }
    },

    // MEGAsync dialog If filesize is too big for downloading through browser
    showMEGASyncOverlay: function(onSizeExceed, dlStateError) {
        'use strict';

        //M.require('megasync_js').dump();

        var $overlay = $('.megasync-overlay');
        var $body = $('body');

        var hideOverlay = function() {
            $body.off('keyup.msd');
            $overlay.addClass('hidden');
            $body.removeClass('overlayed');
            $overlay.hide();
            return false;
        };

        $overlay.addClass('msd-dialog').removeClass('hidden downloading');
        $body.addClass('overlayed');
        $overlay.show();

        var $slides = $overlay.find('.megasync-slide');
        var $currentSlide = $slides.filter('.megasync-slide:not(.hidden)').first();
        var $sliderControl = $('button.megasync-slider', $overlay);
        var $sliderPrevButton = $sliderControl.filter('.prev');
        var $sliderNextButton = $sliderControl.filter('.next');

        $slides.removeClass('prev current next');
        $currentSlide.addClass('current');
        $currentSlide.prev().not('.hidden').addClass('prev');
        $currentSlide.next().not('.hidden').addClass('next');
        $sliderPrevButton.addClass('disabled');
        $sliderNextButton.removeClass('disabled');

        $sliderControl.rebind('click', function() {
            var $this = $(this);
            var $currentSlide = $overlay.find('.megasync-slide.current');
            var $prevSlide = $currentSlide.prev().not('.hidden');
            var $nextSlide = $currentSlide.next().not('.hidden');

            if ($this.hasClass('disabled')) {
                return false;
            }

            if ($this.hasClass('prev') && $prevSlide.length) {
                $slides.removeClass('prev current next');
                $prevSlide.addClass('current');
                $currentSlide.addClass('next');
                $sliderNextButton.removeClass('disabled');

                if ($prevSlide.prev().not('.hidden').length) {
                    $prevSlide.prev().addClass('prev');
                    $sliderPrevButton.removeClass('disabled');
                }
                else {
                    $sliderPrevButton.addClass('disabled');
                }
            }
            else if ($nextSlide.length) {
                $slides.removeClass('prev current next');
                $nextSlide.addClass('current');
                $currentSlide.addClass('prev');
                $sliderPrevButton.removeClass('disabled');

                if ($nextSlide.next().not('.hidden').length) {
                    $nextSlide.next().addClass('next');
                    $sliderNextButton.removeClass('disabled');
                }
                else {
                    $sliderNextButton.addClass('disabled');
                }
            }
        });

        if (onSizeExceed) {
            dlmanager.setBrowserWarningClasses('.megasync-bottom-warning', $overlay, dlStateError);
        }

        $('button.download-megasync', $overlay).rebind('click', function() {
            if (typeof megasync === 'undefined') {
                console.error('Failed to load megasync.js');
            }
            else if (typeof dlpage_ph === 'string' && megasync.getUserOS() !== 'linux') {
                megasync.download(dlpage_ph, dlpage_key);
            }
            else {
                window.open(
                    megasync.getMegaSyncUrl() || 'https://mega.io/desktop',
                    '_blank',
                    'noopener,noreferrer'
                );
                hideOverlay();
            }

            return false;
        });

        $('.megasync-info-txt a', $overlay).rebind('click', function() {
            hideOverlay();
            loadSubPage('pro');
        });

        $('.megasync-close, button.js-close, .fm-dialog-close', $overlay).rebind('click', hideOverlay);

        $body.rebind('keyup.msd', function(e) {
            if (e.keyCode === 27) {
                hideOverlay();
            }
        });

        $('a.clickurl', $overlay).rebind('click', function() {
            open(this.href);
            return false;
        });
    }
};

/** @name dlmanager.LMT_ISPRO */
/** @name dlmanager.LMT_ISREGISTERED */
/** @name dlmanager.LMT_HASACHIEVEMENTS */
/** @name dlmanager.LMT_PRO3 */
makeEnum(['ISREGISTERED', 'ISPRO', 'HASACHIEVEMENTS', 'PRO3'], 'LMT_', dlmanager);

var dlQueue = new TransferQueue(function _downloader(task, done) {
    if (!task.dl) {
        dlQueue.logger.info('Skipping frozen task ' + task);
        return done();
    }
    return task.run(done);
}, 4, 'downloader');

// chunk scheduler
dlQueue.validateTask = function(pzTask) {
    var r = pzTask instanceof ClassChunk || pzTask instanceof ClassEmptyChunk;

    if (!r && pzTask instanceof ClassFile && !dlmanager.fetchingFile) {
        var j = this._queue.length;
        while (j--) {
            if (this._queue[j][0] instanceof ClassChunk) {
                break;
            }
        }

        if ((r = (j === -1)) && $.len(this._qpaused)) {
            // fm_tfsorderupd(); check commit history if we ever want to bring this back (with a good revamp in place)

            // About to start a new download, check if a previously paused dl was resumed.
            var p1 = M.t[pzTask.gid];
            for (var i = 0; i < p1; ++i) {
                var gid = M.t[i];
                if (this._qpaused[gid] && this.dispatch(gid)) {
                    return -0xBEEF;
                }
            }
        }
    }
    return r;
};

/**
 *  DownloadQueue
 *
 *  Array extension to override push, so we can easily
 *  kick up the download (or queue it) without modifying the
 *  caller codes
 */
function DownloadQueue() {}
inherits(DownloadQueue, Array);

DownloadQueue.prototype.push = function() {
    var pos = Array.prototype.push.apply(this, arguments);
    var id = pos - 1;
    var dl = this[id];
    var dl_id = dl.ph || dl.id;
    var dl_key = dl.key;
    var dlIO;

    if (!self.dlMethod) {
        onIdle(() => dlFatalError(dl, l[9065]));
        return pos;
    }

    if (dl.zipid) {
        if (!Zips[dl.zipid]) {
            Zips[dl.zipid] = new ZipWriter(dl.zipid, dl);
        }
        dlIO = Zips[dl.zipid].addEntryFile(dl);
    }
    else {
        if (dl.preview || Math.min(MemoryIO.fileSizeLimit, 90 * 1048576) > dl.size) {
            dlIO = new MemoryIO(dl_id, dl);
        }
        else {
            dlIO = new dlMethod(dl_id, dl);
        }
    }

    dl.aes = new sjcl.cipher.aes([
        dl_key[0] ^ dl_key[4],
        dl_key[1] ^ dl_key[5],
        dl_key[2] ^ dl_key[6],
        dl_key[3] ^ dl_key[7]
    ]);
    dl.nonce = JSON.stringify([
        dl_key[0] ^ dl_key[4],
        dl_key[1] ^ dl_key[5],
        dl_key[2] ^ dl_key[6],
        dl_key[3] ^ dl_key[7], dl_key[4], dl_key[5]
    ]);

    dl.pos = id; // download position in the queue
    dl.dl_id = dl_id; // download id
    dl.io = dlIO;
    // Use IO object to keep in track of progress
    // and speed
    dl.io.progress = 0;
    dl.io.size = dl.size;
    dl.decrypter = 0;
    dl.n = M.getSafeName(dl.n);

    if (!dl.zipid) {
        dlmanager.dlWriter(dl);
    }
    else {
        dl.writer = dlIO;
    }
    Object.defineProperty(dl, 'hasResumeSupport', {value: dl.io.hasResumeSupport});

    dl.macs = Object.create(null);

    dlQueue.push(new ClassFile(dl));

    return pos;
};

mBroadcaster.once('startMega', () => {
    'use strict';

    api.observe('setsid', (sid) => {
        delay('overquota:retry', () => dlmanager._onOverQuotaAttemptRetry(sid));
    });
});

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2016 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

var dlMethod;

window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

if (localStorage.dlMethod) {
    dlMethod = window[localStorage.dlMethod];
}
else if (window.requestFileSystem) {
    dlMethod = FileSystemAPI;
}
else if (MemoryIO.usable()) {
    dlMethod = MemoryIO;
}
else {
    dlMethod = false;
    console.error(`No download method available! ${ua}`);
}

if (typeof dlMethod.init === 'function') {
    dlMethod.init();
}

var dl_queue = new DownloadQueue();

if (is_mobile) {
    dlmanager.ioThrottleLimit = 2;
    dlmanager.fsExpiryThreshold = 10800;
    dlmanager.dlMaxChunkSize = 4 * 1048576;
}

mBroadcaster.once('startMega', function() {
    'use strict';

    M.onFileManagerReady(true, function() {
        var prefix = dlmanager.resumeInfoTag + u_handle;

        // automatically resume transfers on fm initialization
        M.getPersistentDataEntries(prefix)
            .then(function(entries) {
                entries = entries.map(function(entry) {
                    return entry.substr(prefix.length);
                });

                dbfetch.geta(entries)
                    .always(function() {
                        for (var i = entries.length; i--;) {
                            if (!M.d[entries[i]]) {
                                entries.splice(i, 1);
                            }
                        }

                        if (entries.length) {

                            // Cancel transfers callback.
                            var cancelTransfers = function() {
                                for (var i = entries.length; i--;) {
                                    M.delPersistentData(prefix + entries[i]);
                                }
                            };

                            // Continue transfers callback.
                            var continueTransfers = function() {
                                if (d) {
                                    dlmanager.logger.info('Resuming transfers...', entries);
                                }

                                M.addDownload(entries);
                            };

                            if (is_mobile) {
                                // We only resume a single download on mobile.
                                mobile.downloadOverlay.resumeDownload(entries[0]);
                            }
                            else {
                                var $dialog = $('.mega-dialog.resume-transfer');

                                $('button.js-close, .cancel', $dialog).rebind('click', function() {
                                    closeDialog();
                                    cancelTransfers();
                                });

                                $('.resume-transfers-button', $dialog).rebind('click', function() {
                                    closeDialog();
                                    continueTransfers();
                                });

                                M.safeShowDialog('resume-transfer', $dialog);
                            }
                        }
                    });
            }, console.debug.bind(console, 'persistent storage not granted'));
    });
});

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2016 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

/* eslint-disable no-use-before-define */
var uldl_hold = false;

var ulmanager = {
    ulFaId: 0,
    ulSize: 0,
    ulIDToNode: Object.create(null),
    ulEventData: Object.create(null),
    isUploading: false,
    ulSetupQueue: false,
    ulStartingPhase: false,
    ulCompletingPhase: Object.create(null),
    ulOverStorageQuota: false,
    ulOverStorageQueue: [],
    ulFinalizeQueue: [],
    ulBlockSize: 131072,
    ulBlockExtraSize: 1048576,
    ulMaxFastTrackSize: 1048576 * 3,
    ulMaxConcurrentSize: 1048576 * 10,
    logger: MegaLogger.getLogger('ulmanager'),

    // Errors megad might return while uploading
    ulErrorMap: Object.freeze({
        "EAGAIN":    -3,
        "EFAILED":   -4,
        "ENOTFOUND": -5,
        "ETOOMANY":  -6,
        "ERANGE":    -7,
        "EEXPIRED":  -8,
        "EKEY":     -14
    }),

    ulStrError: function UM_ulStrError(code) {
        code = parseInt(code);
        var keys = Object.keys(this.ulErrorMap);
        var values = obj_values(this.ulErrorMap);
        return keys[values.indexOf(code)] || code;
    },

    ulHideOverStorageQuotaDialog: function() {
        'use strict';

        $(window).unbind('resize.overQuotaDialog');
        $('.fm-dialog-overlay', 'body').unbind('click.closeOverQuotaDialog');
        window.closeDialog();
    },

    ulShowOverStorageQuotaDialog: function(aFileUpload) {
        'use strict';

        var $dialog = $('.limited-bandwidth-dialog');

        ulQueue.pause();
        this.ulOverStorageQuota = true;

        // clear completed uploads and set over quota for the rest.
        if ($.removeTransferItems) {
            $.removeTransferItems();
        }
        for (var kk = 0; kk < ul_queue.length; kk++) {
            onUploadError(ul_queue[kk], l[1010], l[1010], null, true);
        }

        // Store the entry whose upload ticket failed to resume it later
        if (aFileUpload) {
            this.ulOverStorageQueue.push(aFileUpload);
        }

        // Inform user that upload file request is not available anymore
        if (is_megadrop) {
            mBroadcaster.sendMessage('FileRequest:overquota');
            return; // Disable quota dialog
        }

        if (is_mobile) {
            mobile.overStorageQuota.show();
            return;
        }

        M.safeShowDialog('upload-overquota', () => {
            // Hide loading dialog as from new text file
            loadingDialog.phide();

            $dialog.removeClass('achievements pro3 pro pro-mini no-cards').addClass('uploads exceeded');
            $('.header-before-icon.exceeded', $dialog).text(l[19135]);
            $('.pricing-page.plan .plan-button', $dialog).rebind('click', function() {
                eventlog(99700, true);
                sessionStorage.fromOverquotaPeriod = $(this).parent().data('period');
                open(getAppBaseUrl() + '#propay_' + $(this).closest('.plan').data('payment'));
                return false;
            });

            $('button.js-close, .fm-dialog-close', $dialog).add($('.fm-dialog-overlay'))
                .rebind('click.closeOverQuotaDialog', () => {

                    ulmanager.ulHideOverStorageQuotaDialog();
                });

            // Load the membership plans
            dlmanager.setPlanPrices($dialog);

            eventlog(99699, true);
            return $dialog;
        });
    },

    ulResumeOverStorageQuotaState: function() {
        'use strict';

        if ($('.mega-dialog.limited-bandwidth-dialog').is(':visible')) {

            ulmanager.ulHideOverStorageQuotaDialog();
        }

        ulQueue.resume();
        this.ulOverStorageQuota = false;

        if (!this.ulOverStorageQueue.length) {
            if (d) {
                ulmanager.logger.info('ulResumeOverStorageQuotaState: Nothing to resume.');
            }
        }
        else {
            // clear completed uploads and remove over quota state for the rest.
            if ($.removeTransferItems) {
                $.removeTransferItems();
            }
            $("tr[id^='ul_']").removeClass('transfer-error').find('.transfer-status').text(l[7227]);

            this.ulOverStorageQueue.forEach(function(aFileUpload) {
                var ul = aFileUpload.ul;

                if (d) {
                    ulmanager.logger.info('Attempting to resume ' + aFileUpload, [ul], aFileUpload);
                }

                if (ul) {
                    ul.uReqFired = null;
                    ulmanager.ulStart(aFileUpload);
                }
                else if (oIsFrozen(aFileUpload)) {
                    console.warn('Frozen upload while resuming...', aFileUpload);
                }
                else {
                    // re-fire the putnodes api request for which we got the -17
                    console.assert(Object(aFileUpload[0]).a === 'p', 'check this...');
                    ulmanager.ulComplete(...aFileUpload);
                }
            });
        }

        this.ulOverStorageQueue = [];
    },

    getGID: function UM_GetGID(ul) {
        return 'ul_' + (ul && ul.id);
    },

    getEventDataByHandle: function(h) {
        'use strict';

        for (var id in this.ulEventData) {
            if (this.ulEventData[id].h === h) {
                return this.ulEventData[id];
            }
        }

        return false;
    },

    getUploadByID: function(id) {
        'use strict';

        var queue = ul_queue.filter(isQueueActive);
        for (var i = queue.length; i--;) {
            var q = queue[i];

            if (q.id === id || this.getGID(q) === id) {
                return q;
            }
        }

        return false;
    },

    isUploadActive: function(id) {
        'use strict';
        var gid = typeof id === 'object' ? this.getGID(id) : id;
        return document.getElementById(gid) || this.getUploadByID(gid).starttime > 0;
    },

    /**
     * Wait for an upload to finish.
     * @param {Number} aUploadID The unique upload identifier.
     * @return {MegaPromise}
     */
    onUploadFinished: function(aUploadID) {
        'use strict';
        return new Promise((resolve, reject) => {
            var _ev1;
            var _ev2;
            var _ev3;
            if (typeof aUploadID !== 'number' || aUploadID < 8001) {
                return reject(EARGS);
            }
            var queue = ul_queue.filter(isQueueActive);
            var i = queue.length;

            while (i--) {
                if (queue[i].id === aUploadID) {
                    break;
                }
            }

            if (i < 0) {
                // there is no such upload in the queue
                return reject(ENOENT);
            }

            var done = function(id, result) {
                if (id === aUploadID) {
                    mBroadcaster.removeListener(_ev1);
                    mBroadcaster.removeListener(_ev2);
                    mBroadcaster.removeListener(_ev3);

                    // result will be either the node handle for the new uploaded file or an error
                    resolve(result);
                }
            };

            _ev1 = mBroadcaster.addListener('upload:error', done);
            _ev2 = mBroadcaster.addListener('upload:abort', done);
            _ev3 = mBroadcaster.addListener('upload:completion', done);
        });
    },

    /**
     * Hold up an upload until another have finished, i.e. because we have to upload it as a version
     * @param {File} aFile The upload file instance
     * @param {Number} aUploadID The upload ID to wait to finish.
     * @param {Boolean} [aVersion] Whether we're actually creating a version.
     */
    holdUntilUploadFinished: function(aFile, aUploadID, aVersion) {
        'use strict';
        var promise = new MegaPromise();
        var logger = d && new MegaLogger('ulhold[' + aUploadID + '>' + aFile.id + ']', null, this.logger);

        if (d) {
            logger.debug('Waiting for upload %d to finish...', aUploadID, [aFile]);
        }

        this.onUploadFinished(aUploadID).always((h) => {
            if (d) {
                logger.debug('Upload %s finished...', aUploadID, h);
            }

            if (aVersion) {
                if (typeof h !== 'string' || !M.d[h]) {
                    var n = fileconflict.getNodeByName(aFile.target, aFile.name);
                    h = n && n.h;

                    if (d) {
                        logger.debug('Seek node gave %s', h, M.getNodeByHandle(h));
                    }
                }

                if (h) {
                    aFile._replaces = h;
                }
            }

            if (d) {
                logger.debug('Starting upload %s...', aFile.id, aFile._replaces, [aFile]);
            }
            ul_queue.push(aFile);
            promise.resolve(aFile, h);
        });

        return promise;
    },

    abortAll: function() {
        'use strict';
        const ulQueue = window.ulQueue;
        const fileUploadInstances = [];

        const destroy = function(task) {
            if ((task = task && task[0] || task || !1).destroy) {
                task.destroy(-0xbeef);
            }
        };

        const abort = (ul, gid, idx) => {
            if (d) {
                ulmanager.logger.info('Aborting ' + gid, ul.name);
            }
            ul.abort = true;
            fileUploadInstances.push([ul.owner, idx]);

            const gp = GlobalProgress[gid];
            if (gp && !gp.paused) {
                gp.paused = true;

                let chunk;
                while ((chunk = gp.working.pop())) {
                    chunk.abort();
                    if (array.remove(ulQueue._pending, chunk, 1)) {
                        console.assert(--ulQueue._running > -1, 'Queue inconsistency on pause[abort]');
                    }
                }
            }
        };

        ulQueue.pause();

        for (let i = ul_queue.length; i--;) {
            const ul = ul_queue[i];
            if (ul.id) {
                const gid = 'ul_' + ul.id;

                if (ulmanager.ulCompletingPhase[gid]) {
                    if (d) {
                        ulmanager.logger.debug('Not aborting %s, it is completing...', gid, ul);
                    }
                }
                else {
                    abort(ul, gid, i);
                }
            }
        }

        ulQueue._queue.forEach(destroy);
        Object.values(ulQueue._qpaused).forEach(destroy);

        for (let i = fileUploadInstances.length; i--;) {
            const [ul, idx] = fileUploadInstances[i];

            if (ul) {
                if (ul.file) {
                    mBroadcaster.sendMessage('upload:abort', ul.file.id, -0xDEADBEEF);
                }
                ul.destroy(-0xbeef);
            }
            ul_queue[idx] = Object.freeze({});
        }

        ulQueue._queue = [];
        ulQueue._qpaused = {};
        ulQueue.resume();
    },

    abort: function UM_abort(gid) {
        'use strict';

        if (gid === null || Array.isArray(gid)) {
            this._multiAbort = 1;

            if (gid) {
                gid.forEach(this.abort.bind(this));
            }
            else {
                this.ulSetupQueue = false;
                M.tfsdomqueue = Object.create(null);
                this.abortAll();
            }

            delete this._multiAbort;
            Soon(M.resetUploadDownload);
        }
        else {
            if (typeof gid === 'object') {
                gid = this.getGID(gid);
            }
            else if (gid[0] !== 'u') {
                return;
            }

            var l = ul_queue.length;
            var FUs = [];
            while (l--) {
                var ul = ul_queue[l];

                if (gid === this.getGID(ul)) {
                    if (ulmanager.ulCompletingPhase[gid]) {
                        if (d) {
                            ulmanager.logger.debug('Not aborting %s, it is completing...', gid, ul);
                        }
                        continue;
                    }
                    if (d) {
                        ulmanager.logger.info('Aborting ' + gid, ul.name);
                    }

                    ul.abort = true;
                    FUs.push([ul.owner, l]);
                }
            }

            ulQueue.pause(gid);
            ulQueue.filter(gid);
            FUs.map(function(o) {
                var ul = o[0];
                var idx = o[1];

                if (ul) {
                    if (ul.file) {
                        mBroadcaster.sendMessage('upload:abort', ul.file.id, -0xDEADBEEF);
                    }
                    ul.destroy();
                }
                ul_queue[idx] = Object.freeze({});
            });
            if (!this._multiAbort) {
                Soon(M.resetUploadDownload);
            }
        }
    },

    restart: function UM_restart(file, reason, xhr) {
        // Upload failed - restarting...
        onUploadError(file, l[20917], reason, xhr);

        // reschedule
        ulQueue.poke(file);
    },

    retry: function UM_retry(file, chunk, reason, xhr) {
        var start = chunk.start;
        var end = chunk.end;
        var cid = String(chunk);
        var altport = !chunk.altport;
        var suffix = chunk.suffix;
        var bytes = suffix && chunk.bytes;

        file.ul_failed = true;
        api_reportfailure(hostname(file.posturl), ulmanager.networkErrorCheck);

        // reschedule

        ulQueue.pause(); // Hmm..
        if (!file.__umRetries) {
            file.__umRetries = 1;
        }
        if (!file.__umRetryTimer) {
            file.__umRetryTimer = {};
        }
        var tid = ++file.__umRetries;
        file.__umRetryTimer[tid] = setTimeout(function() {
            // Could become frozen {} after this timeout.
            if (!file.id) {
                return;
            }

            var q = file.__umRetryTimer || {};
            delete q[tid];

            if (reason.indexOf('IO failed') === -1) {
                tid = --file.__umRetries;
            }

            if (tid < 34) {
                var newTask = new ChunkUpload(file, start, end, altport);
                if (suffix) {
                    newTask.suffix = suffix;
                    newTask.bytes = bytes;
                }
                ulQueue.pushFirst(newTask);
            }
            else {
                if (d) {
                    ulmanager.logger.error('Too many retries for ' + cid);
                }
                var fileName = htmlentities(file.name);
                var errorstr = reason.match(/"([^"]+)"/);

                if (errorstr) {
                    errorstr = errorstr.pop();
                }
                else {
                    errorstr = reason.substr(0, 50) + '...';
                }
                if (!file.isCreateFile) {
                    $('#ul_' + file.id + ' .transfer-status').text(errorstr);
                }
                msgDialog('warninga', l[1309], l[1498] + ': ' + fileName, reason);
                ulmanager.abort(file);
            }
            if (!$.len(q)) {
                delete file.__umRetryTimer;
                ulQueue.resume();
            }
        }, 950 + Math.floor(Math.random() * 2e3));

        // "Upload failed - retrying"
        onUploadError(file, l[20918],
            reason.substr(0, 2) === 'IO' ? 'IO Failed' : reason,
            xhr);

        chunk.done(); /* release worker */
    },

    isReady: function UM_isReady(Task) /* unused */ {
        return !Task.file.paused || Task.__retry;
    },

    /**
     *  Check if the network is up!
     *
     *  This function is called when an error happen at the upload
     *  stage *and* it is anything *but* network issue.
     */
    networkErrorCheck: function UM_network_error_check() {
        var i = 0;
        var ul = {
            error: 0,
            retries: 0
        };
        var dl = {
            error: 0,
            retries: 0
        }

        for (i = 0; i < dl_queue.length; i++) {
            if (dl_queue[i] && dl_queue[i].dl_failed) {
                if (d) {
                    dlmanager.logger.info('Failed download:',
                        dl_queue[i].zipname || dl_queue[i].n,
                        'Retries: ' + dl_queue[i].retries, dl_queue[i].zipid);
                }
                dl.retries += dl_queue[i].retries;
                if (dl_queue[i].retries++ === 5) {
                    /**
                     *  The user has internet yet the download keeps failing
                     *  we request the server a new download url but unlike in upload
                     *  this is fine because we resume the download
                     */
                    dlmanager.newUrl(dl_queue[i]);
                    dl.retries = 0;
                }
                dl.error++;
            }
        }

        for (i = 0; i < ul_queue.length; i++) {
            if (ul_queue[i] && ul_queue[i].ul_failed) {
                ul.retries += ul_queue[i].retries;
                if (ul_queue[i].retries++ === 10) {
                    /**
                     *  Worst case ever. The client has internet *but*
                     *  this upload keeps failing in the last 10 minutes.
                     *
                     *  We request a new upload URL to the server, and the upload
                     *  starts from scratch
                     */
                    if (d) {
                        ulmanager.logger.error("restarting because it failed", ul_queue[i].retries, 'times', ul);
                    }
                    ulmanager.restart(ul_queue[i], 'peer-err');
                    ul_queue[i].retries = 0;
                }
                ul.error++;
            }
        }

        /**
         *  Check for error on upload and downloads
         *
         *  If we have many errors (average of 3 errors)
         *  we try to shrink the number of connections to the
         *  server to see if that fixes the problem
         */
        $([ul, dl]).each(function(i, k) {
                var ratio = k.retries / k.error;
                if (ratio > 0 && ratio % 8 === 0) {
                    // if we're failing in average for the 3rd time,
                    // lets shrink our upload queue size
                    if (d) {
                        var mng = (k === ul ? ulmanager : dlmanager);
                        mng.logger.warn(' --- SHRINKING --- ');
                    }
                    var queue = (k === ul ? ulQueue : dlQueue);
                    queue.shrink();
                }
            });
    },

    ulFinalize: function UM_ul_finalize(file, target) {
        if (d) {
            ulmanager.logger.info(file.name, "ul_finalize", file.target, target);
        }
        if (file.repair) {
            file.target = target = M.RubbishID;
        }
        target = target || file.target || M.RootID;

        ASSERT(file.filekey, "*** filekey is missing ***");

        var n = {
            name: file.name,
            hash: file.hash,
            k: file.filekey
        };

        if (d) {
            // if it's set but undefined, the file-conflict dialog failed to properly locate a file/node...
            console.assert(file._replaces || !("_replaces" in file), 'Unexpected file versioning state...');
        }

        if (file._replaces) {
            const r = M.getNodeByHandle(file._replaces);

            if (r.fav) {
                n.fav = r.fav;
            }
            if (r.lbl) {
                n.lbl = r.lbl;
            }
            if (r.des) {
                n.des = r.des;
            }
        }

        var req_type = 'p';
        var dir = target;

        // Put to public upload folder
        if (is_megadrop) {
            req_type = 'pp';
            target = mega.fileRequestUpload.getUploadPageOwnerHandle();
            dir = mega.fileRequestUpload.getUploadPagePuHandle();
        }

        var req = {
            v: 3,
            a: req_type,
            t: dir,
            n: [{
                t: 0,
                h: file.response,
                a: ab_to_base64(crypto_makeattr(n)),
                k: target.length === 11
                    ? base64urlencode(encryptto(target, a32_to_str(file.filekey)))
                    : a32_to_base64(encrypt_key(u_k_aes, file.filekey))
            }],
            i: requesti
        };

        var ctx = {
            file: file,
            target: target,
            size: file.size,
            faid: file.faid,
            ul_queue_num: file.pos,
        };

        if (file._replaces) {
            req.n[0].ov = file._replaces;
        }
        if (file.faid) {
            req.n[0].fa = api_getfa(file.faid);
        }
        if (file.ddfa) {
            // fa from deduplication
            req.n[0].fa = file.ddfa;
        }

        if (req.t === M.InboxID && self.vw) {
            req.vw = 1;
        }

        queueMicrotask(() => {
            for (var k in M.tfsdomqueue) {
                if (k[0] === 'u') {
                    addToTransferTable(k, M.tfsdomqueue[k], 1);
                    delete M.tfsdomqueue[k];
                    break;
                }
            }
        });

        if (d) {
            ulmanager.logger.info("Completing upload for %s, into %s", file.name, target, req);
            console.assert(file.owner && file.owner.gid, 'No assoc owner..');
        }

        if (file.owner) {
            this.ulCompletingPhase[file.owner.gid] = Date.now();
        }

        if (this.ulFinalizeQueue.push([n, req, ctx]) > ulQueue.maxActiveTransfers || ulQueue.isFinalising()) {
            this.ulCompletePending();
        }
        else {
            delay('ul.finalize:dsp', () => this.ulCompletePending(), 4e3);
        }
    },

    ulGetPostURL: function UM_ul_get_posturl(File) {
        'use strict';
        return function(res, ctx) {

            // If cancelled
            if (!File.ul) {
                return;
            }

            if (!ul_queue[ctx.reqindex] || Object.isFrozen(ul_queue[ctx.reqindex])) {
                ulmanager.logger.warn(`Upload at ${ctx.reqindex} seems cancelled, but 'ul' did exist.`, res, ctx, File);
                return;
            }

            // If the response is that the user is over quota
            if (res === EOVERQUOTA || res === EGOINGOVERQUOTA) {

                // Show a warning popup
                ulmanager.ulShowOverStorageQuotaDialog(File, res);

                // Return early so it does not retry automatically and spam the API server with requests
                return false;
            }

            // If the response is that the business account is suspended
            if (res === EBUSINESSPASTDUE && page.substr(0, 11) === 'filerequest') {
                mBroadcaster.sendMessage('upload:error', File.ul.id, res);
                return false;
            }

            // Reset in case of a retry
            delete ul_queue[ctx.reqindex].posturl;

            if (typeof res === 'object') {
                if (typeof res.p === "string" && res.p.length > 0) {
                    ul_queue[ctx.reqindex].posturl = res.p;

                    if (ul_queue[ctx.reqindex].readyToStart) {
                        if (ctx.reqindex !== File.ul.pos) {
                            ulmanager.ulUpload(ul_queue[ctx.reqindex].readyToStart);
                        }
                        delete ul_queue[ctx.reqindex].readyToStart;
                    }
                }
            }

            if (ctx.reqindex === File.ul.pos) {
                if (ul_queue[ctx.reqindex].posturl) {
                    ulmanager.ulUpload(File);
                }
                else {
                    // Retry
                    ulmanager.ulStart(File);
                }
            }
        };
    },

    ulStart: function UM_ul_start(File) {
        'use strict';

        if (!File.file) {
            return false;
        }
        if (File.file.posturl) {
            return ulmanager.ulUpload(File);
        }
        var maxpf = 128 * 1048576;
        var next = ulmanager.ulGetPostURL(File);
        var total = 0;
        var len = ul_queue.length;
        var max = File.file.pos + Math.max(21, ulQueue.maxActiveTransfers >> 1);

        for (var i = File.file.pos; i < len && i < max && maxpf > 0; i++) {
            var cfile = ul_queue[i];
            if (!isQueueActive(cfile)) {
                continue;
            }
            if (cfile.uReqFired) {
                if (i === File.file.pos) {
                    cfile.readyToStart = File;
                }
                continue;
            }
            cfile.uReqFired = Date.now();
            var req = {
                a: 'u',
                v: 2,
                ssl: use_ssl,
                ms: fmconfig.ul_maxSpeed | 0,
                s: cfile.size,
                r: cfile.retries,
                e: cfile.ul_lastreason,
            };
            if (File.file.ownerId) {
                req.t = File.file.ownerId;
            }
            api_req(req, {
                reqindex: i,
                callback: next
            });
            maxpf -= cfile.size;
            total++;
        }
        if (d) {
            ulmanager.logger.info('request urls for ', total, ' files');
        }
    },

    ulUpload: function UM_ul_upload(File) {
        var i;
        var file = File.file;

        if (file.repair) {
            var ul_key = file.repair;

            file.ul_key = [
                ul_key[0] ^ ul_key[4],
                ul_key[1] ^ ul_key[5],
                ul_key[2] ^ ul_key[6],
                ul_key[3] ^ ul_key[7],
                ul_key[4],
                ul_key[5]
            ];
        }
        else if (!file.ul_key) {
            file.ul_key = Array(6);
            // generate ul_key and nonce
            for (i = 6; i--;) {
                file.ul_key[i] = rand(0x100000000);
            }
        }

        file.ul_offsets = [];
        file.ul_lastProgressUpdate = 0;
        file.ul_macs = Object.create(null);
        file.ul_keyNonce = JSON.stringify(file.ul_key);
        file.ul_aes = new sjcl.cipher.aes([
            file.ul_key[0], file.ul_key[1], file.ul_key[2], file.ul_key[3]
        ]);

        if (file.size) {
            var pp;
            var p = 0;
            var tasks = Object.create(null);
            var ulBlockExtraSize = ulmanager.ulBlockExtraSize;
            //var boost = !mega.chrome || parseInt(ua.details.version) < 68;
			var boost = false;

            if (file.size > 0x1880000 && boost) {
                tasks[p] = new ChunkUpload(file, p, 0x480000);
                p += 0x480000;

                for (i = 2; i < 4; i++) {
                    tasks[p] = new ChunkUpload(file, p, i * 0x400000);
                    pp = p;
                    p += i * 0x400000;
                }

                ulBlockExtraSize = 16 * 1048576;
            }
            else {
                for (i = 1; i <= 8 && p < file.size - i * ulmanager.ulBlockSize; i++) {
                    tasks[p] = new ChunkUpload(file, p, i * ulmanager.ulBlockSize);
                    pp = p;
                    p += i * ulmanager.ulBlockSize;
                }
            }

            while (p < file.size) {
                tasks[p] = new ChunkUpload(file, p, ulBlockExtraSize);
                pp = p;
                p += ulBlockExtraSize;
            }

            if (file.size - pp > 0) {
                tasks[pp] = new ChunkUpload(file, pp, file.size - pp);
            }

            // if (d) ulmanager.logger.info('ulTasks', tasks);
            Object.keys(tasks).reverse().forEach(function(k) {
                file.ul_offsets.push({
                    byteOffset: parseInt(k),
                    byteLength: tasks[k].end
                });
                ulQueue.pushFirst(tasks[k]);
            });
        }
        else {
            ulQueue.pushFirst(new ChunkUpload(file, 0, 0));
        }

        if (!file.faid && !window.omitthumb) {
            var img = is_image(file.name);
            var vid = is_video(file.name);

            if (img || vid) {
                file.faid = ++ulmanager.ulFaId;

                createthumbnail(
                    file,
                    file.ul_aes,
                    file.faid,
                    null, null,
                    {raw: img !== 1 && img, isVideo: vid}
                ).catch(nop);

                var uled = ulmanager.ulEventData[file.id];
                if (uled) {
                    if (vid) {
                        if (d) {
                            console.debug('Increasing expected file attributes for the chat to be aware...');
                            console.assert(uled.efa === 1, 'Check this...');
                        }
                        uled.efa += 2;
                    }
                    uled.faid = file.faid;
                }
            }
        }

        if (!file.isCreateFile) {
            M.ulstart(file);
        }
        if (file.done_starting) {
            file.done_starting();
        }
    },

    ulComplete: function(req, ctx) {
        'use strict';
        api.screq(req)
            .catch(echo)
            .then((res) => {
                ulmanager.ulCompletePending2(res, ctx);
            })
            .catch(reportError);
    },

    ulCompletePending: function() {
        'use strict';
        const self = this;
        delay.cancel('ul.finalize:dsp');

        // Ensure no -3s atm..
        api.req({a: 'ping'}).always(function dsp() {
            // @todo per target folder rather!
            if ($.getExportLinkInProgress) {
                if (d) {
                    self.logger.debug('Holding upload(s) until link-export completed...');
                }
                mBroadcaster.once('export-link:completed', () => onIdle(dsp));
                return;
            }

            const q = self.ulFinalizeQueue;
            self.ulFinalizeQueue = [];

            for (let i = q.length; i--;) {
                const [n, req, ctx] = q[i];

                const sn = M.getShareNodesSync(req.t, null, true);
                if (sn.length) {
                    req.cr = crypto_makecr([n], sn, false);
                    req.cr[1][0] = req.n[0].h;
                }

                ulmanager.ulComplete(req, ctx);
            }
        });
    },

    ulCompletePending2: function UM_ul_completepending2(res, ctx) {
        'use strict';

        if (d) {
            ulmanager.logger.info("ul_completepending2", res, ctx);
        }

        if (typeof res === 'object' && 'st' in res) {
            const h = res.handle;

            console.assert(res.result !== 0 || String(ctx.target).length === 11, 'unexpected upload completion reply.');

            if (ctx.faid && h) {
                // @todo should we fire 'pp' in v2 mode for this to work?..
                api_attachfileattr(h, ctx.faid);
            }

            if (ul_queue[ctx.ul_queue_num]) {
                ulmanager.ulIDToNode[ulmanager.getGID(ul_queue[ctx.ul_queue_num])] = h || ctx.target;
                M.ulcomplete(ul_queue[ctx.ul_queue_num], h || false, ctx.faid);
            }

            if (MediaInfoLib.isFileSupported(h)) {
                var n = M.d[h] || false;
                var file = ctx.file;
                var done = function() {
                    // get thumb/prev created if it wasn't already, eg. an mp4 renamed as avi/mov/etc
                    if (is_video(n) === 1 && String(n.fa).indexOf(':0*') < 0 && !Object(file).__getVTNPid) {
                        var aes = new sjcl.cipher.aes([
                            n.k[0] ^ n.k[4], n.k[1] ^ n.k[5], n.k[2] ^ n.k[6], n.k[3] ^ n.k[7]
                        ]);
                        createnodethumbnail(n.h, aes, n.h, null, {isVideo: true}, null, file);
                    }
                };

                if (String(n.fa).indexOf(':8*') < 0 && file.size > 16) {
                    MediaAttribute(n).parse(file).then(done).catch(function(ex) {
                        if (d) {
                            console.warn('MediaAttribute', ex);
                        }
                        mBroadcaster.sendMessage('fa:error', h, ex, 0, 1);
                    });
                }
                else {
                    done();
                }
            }

            if (ctx.file.owner) {
                ctx.file.ul_failed = false;
                ctx.file.retries = 0;
            }
        }
        else {
            let inShareOQ = false;
            const {payload, result} = res;

            res = result;
            if (res === EOVERQUOTA && payload.a === 'p') {
                if (sharer(ctx.target)) {
                    inShareOQ = true;
                }
                else {
                    return ulmanager.ulShowOverStorageQuotaDialog([payload, ctx]);
                }
            }
            var ul = ul_queue[ctx.ul_queue_num];

            if (!ul && res === EACCESS) {
                ulmanager.logger.warn('This upload was already aborted, resorting to context...', ctx.file);
                ul = ctx.file;
            }

            M.ulerror(ul, inShareOQ ? ESHAREROVERQUOTA : res);

            if (res !== EOVERQUOTA && res !== EGOINGOVERQUOTA) {
                console.warn(`Unexpected upload completion server response (${res} @ ${hostname(ctx.file.posturl)})`);
            }
        }
        delete ulmanager.ulCompletingPhase['ul_' + ctx.file.id];

        if (ctx.file.owner) {
            ctx.file.owner.destroy();
        }
        else if (!oIsFrozen(ctx.file)) {
            oDestroy(ctx.file);
        }
    },

    ulDeDuplicate: function UM_ul_deduplicate(File, identical, mNode) {
        var n;
        var uq = File.ul;

        const skipIdentical = (fmconfig.ul_skipIdentical | 0) || File.file.chatid;
        if (identical && skipIdentical) {
            // If attaching to chat apply apps behaviour and use the existing node.
            n = identical;
        }
        else if ((!M.h[uq.hash] || !M.h[uq.hash].size) && !identical) {
            return ulmanager.ulStart(File);
        }
        else if (M.h[uq.hash]) {
            if (!(n = mNode)) {
                const [h] = M.h[uq.hash];
                n = M.d[h];
            }

            if (!identical && n && uq.size !== n.s) {
                if (d) {
                    ulmanager.logger.warn('fingerprint clash!', n.h, [n], File);
                }
                eventlog(99749, JSON.stringify([1, parseInt(uq.size), parseInt(n.s)]));
                return ulmanager.ulStart(File);
            }
            if (skipIdentical) {
                identical = n;
            }
        }
        if (!n) {
            return ulmanager.ulStart(File);
        }
        if (d) {
            ulmanager.logger.info('[%s] deduplicating file %s', n.h, File.file.name, n);
        }
        api_req({
            a: 'g',
            g: 1,
            ssl: use_ssl,
            n: n.h
        }, {
            uq: uq,
            n: n,
            skipfile: skipIdentical && identical,
            callback: function(res, ctx) {
                if (d) {
                    ulmanager.logger.info('[%s] deduplication result:', ctx.n.h, res.e, res, ctx.skipfile);
                }
                if (oIsFrozen(File)) {
                    ulmanager.logger.warn('Upload aborted on deduplication...', File);
                }
                else if (res.e === ETEMPUNAVAIL && ctx.skipfile) {
                    ctx.uq.repair = ctx.n.k;
                    ulmanager.ulStart(File);
                }
                else if (typeof res === 'number' || res.e) {
                    ulmanager.ulStart(File);
                }
                else if (ctx.skipfile) {
                    if (!(uq.skipfile = !File.file.chatid)) {
                        const eventData = ulmanager.ulEventData[File.file.id];
                        if (eventData) {
                            if (d) {
                                ulmanager.logger.info('[%s] Cleaning efa on deduplication ' +
                                    'for the chat to be aware...', ctx.n.h, eventData.efa);
                            }
                            eventData.efa = 0;
                        }
                    }
                    ulmanager.ulIDToNode[ulmanager.getGID(uq)] = ctx.n.h;
                    M.ulcomplete(uq, ctx.n.h);
                    File.file.ul_failed = false;
                    File.file.retries = 0;
                    File.file.done_starting();
                }
                else {
                    File.file.filekey = ctx.n.k;
                    File.file.response = ctx.n.h;
                    File.file.ddfa = ctx.n.fa;
                    File.file.path = ctx.uq.path;
                    File.file.name = ctx.uq.name;

                    var eventData = ulmanager.ulEventData[File.file.id];
                    if (eventData) {
                        var efa = ctx.n.fa ? String(ctx.n.fa).split('/').length : 0;

                        if (eventData.efa !== efa) {
                            if (d) {
                                ulmanager.logger.info('[%s] Fixing up efa on deduplication ' +
                                    'for the chat to be aware... (%s != %s)', ctx.n.h, eventData.efa, efa);
                            }
                            eventData.efa = efa;
                        }
                    }

                    // File.file.done_starting();
                    ulmanager.ulFinalize(File.file);
                }
            }
        });
    },

    ulIdentical: function UM_ul_Identical(file) {
        var nodes = M.c[file.target];
        if (nodes) {
            for (var node in nodes) {
                node = M.d[node];

                if (node
                        && file.size === node.s
                        && file.name === node.name
                        && file.hash === node.hash) {
                    return node;
                }
            }
        }
        return false;
    },

    /**
     * Initialize upload on fingerprint creation.
     *
     * @param {Object}  aFileUpload  FileUpload instance
     * @param {Object}  aFile        File API interface instance
     * @param {Boolean} [aForce]     Ignore locking queue.
     */
    ulSetup: function ulSetup(aFileUpload, aFile, aForce) {
        'use strict';

        var dequeue = function ulSetupDQ() {
            if (ulmanager.ulSetupQueue.length) {
                var upload = ulmanager.ulSetupQueue.shift();
                onIdle(ulmanager.ulSetup.bind(ulmanager, upload, upload.file, true));
            }
            else {
                ulmanager.ulSetupQueue = false;
            }
        };

        if (!aFileUpload || !aFile || aFileUpload.file !== aFile || !aFile.hash) {
            if (d) {
                console.warn('Invalid upload instance, cancelled?', oIsFrozen(aFileUpload), aFileUpload, aFile);
            }
            return onIdle(dequeue);
        }

        if (!aForce) {
            if (this.ulSetupQueue) {
                return this.ulSetupQueue.push(aFileUpload);
            }
            this.ulSetupQueue = [];
        }

        var hashNode;
        var startUpload = function _startUpload() {
            onIdle(dequeue);

            var identical = ulmanager.ulIdentical(aFile);
            ulmanager.logger.info(aFile.name, "fingerprint", aFile.hash, M.h[aFile.hash], identical);

            if (M.h[aFile.hash] && M.h[aFile.hash].size || identical) {
                ulmanager.ulDeDuplicate(aFileUpload, identical, hashNode);
            }
            else {
                ulmanager.ulStart(aFileUpload);
            }
        };

        if (is_megadrop) {
            return startUpload();
        }

        var promises = [];

        if (!M.c[aFile.target]) {
            promises.push(dbfetch.get(aFile.target));
        }

        const [h] = M.h[aFile.hash] || [];
        if (!M.d[h]) {
            promises.push(dbfetch.hash(aFile.hash).then(node => (hashNode = node)));
        }

        if (promises.length) {
            Promise.allSettled(promises).then(startUpload);
        }
        else {
            startUpload();
        }
    },

    /**
     * Abort and Clear items in upload list those are targeting a deleted folder.
     * This is triggered by `d` action packet.
     *
     * @param {String|Array} handles  handle(s) of deleted node(s)
     */
    ulClearTargetDeleted: function(handles) {
        'use strict';

        if (!ul_queue.length) {
            return false;
        }
        if (!Array.isArray(handles)) {
            handles = [handles];
        }

        var toAbort = [];
        for (var i = ul_queue.length; i--;) {
            var ul = isQueueActive(ul_queue[i]) && ul_queue[i] || false;

            if (ul && handles.indexOf(ul.target) !== -1) {
                var gid = ulmanager.getGID(ul);
                toAbort.push(gid);
                $('.transfer-status', $('#' + gid).addClass('transfer-error')).text(l[20634]);
                tfsheadupdate({e: gid});
                mega.tpw.errorDownloadUpload(mega.tpw.UPLOAD, ul, l[20634]);
            }
        }

        if (toAbort.length) {
            eventlog(99726);
            ulmanager.abort(toAbort);
        }
    }
};


function UploadQueue() {}
inherits(UploadQueue, Array);

UploadQueue.prototype.push = function() {
    var pos = Array.prototype.push.apply(this, arguments) - 1;
    var file = this[pos];

    file.pos = pos;
    ulQueue.poke(file);

    return pos + 1;
};


function ChunkUpload(file, start, end, altport) {
    this.file = file;
    this.ul = file;
    this.start = start;
    this.end = end;
    this.gid = file.owner.gid;
    this.xid = this.gid + '_' + start + '-' + end;
    this.jid = (Math.random() * Date.now()).toString(36);
    this.altport = altport;
    this.logger = new MegaLogger(String(this), {}, ulmanager.logger);
    this[this.gid] = !0;
    // if (d) ulmanager.logger.info('Creating ' + this);
}

ChunkUpload.prototype.toString = function() {
    return "[ChunkUpload " + this.xid + "$" + this.jid + "]";
};

ChunkUpload.prototype.destroy = function() {
    // if (d) ulmanager.logger.info('Destroying ' + this);
    this.abort();
    oDestroy(this);
};

ChunkUpload.prototype.updateprogress = function() {
    if (this.file.paused || this.file.complete || uldl_hold) {
        return;
    }

    var p = this.file.progress;
    var tp = this.file.sent || 0;
    for (var i in p) {
        tp += p[i];
    }

    // only start measuring progress once the TCP buffers are filled
    // (assumes a modern TCP stack with a large intial window)
    if (!this.file.speedometer && this.file.progressevents > 5) {
        this.file.speedometer = Speedometer(tp);
    }
    this.file.progressevents = (this.file.progressevents || 0) + 1;
    p = GlobalProgress[this.gid].speed = this.file.speedometer ? this.file.speedometer.progress(tp) : 0;

    if (!this.file.isCreateFile) {
        M.ulprogress(this.file, Math.floor(tp / this.file.size * 100), tp, this.file.size, p);
    }

    if (tp === this.file.size) {
        this.file.complete = true;
    }
};

ChunkUpload.prototype.abort = function() {
    if (d > 1 && this.logger) {
        this.logger.info('Aborting', this.oet, Boolean(this.xhr));
    }

    if (this.oet) {
        clearTimeout(this.oet);
    }
    if (this.xhr) {
        this.xhr.abort(this.xhr.ABORT_CLEANUP);
    }
    if (GlobalProgress[this.gid]) {
        array.remove(GlobalProgress[this.gid].working, this, 1);
    }
    else if (d && this.logger) {
        this.logger.error('This should not be reached twice or after FileUpload destroy...', this);
    }
    delete this.xhr;
};

ChunkUpload.prototype.onXHRprogress = function(xhrEvent) {
    if (!this.file || !this.file.progress || this.file.abort) {
        return this.done && this.done();
    }
    var now = Date.now();
    if ((now - this.file.ul_lastProgressUpdate) > 200) {
        this.file.ul_lastProgressUpdate = now;
        this.file.progress[this.start] = xhrEvent.loaded;
        this.updateprogress();
    }
};

ChunkUpload.prototype.onXHRerror = function(args, xhr, reason) {
    if (this.file && !this.file.abort && this.file.progress) {
        this.file.progress[this.start] = 0;
        this.updateprogress();

        if (!xhr) {
            xhr = this.xhr;
        }
        if (args === "$FATAL") {
            ulmanager.restart(this.file, reason, xhr);
        }
        else {
            ulmanager.retry(this.file, this, "xhr failed: " + reason, xhr);
        }
    }
    this.done();
}

ChunkUpload.prototype.onXHRready = function(xhrEvent) {
    if (!this.file || !this.file.progress) {
        if (d) {
            this.logger.error('Upload aborted...', this);
        }
        return Soon(this.done.bind(this));
    }
    var self = this;
    var xhr = xhrEvent.target;
    var response = xhr.response;
    var isValidType = (response instanceof ArrayBuffer);
    xhrEvent = undefined;

    if (isValidType && xhr.status === 200 && xhr.statusText === 'OK') {

        if (!response.byteLength || response.byteLength === 36) {
            this.file.sent += this.bytes.buffer.length || this.bytes.length;
            delete this.file.progress[this.start];
            this.updateprogress();

            if (response.byteLength === 36) {
                var ul_key = this.file.ul_key;
                var t = Object.keys(this.file.ul_macs).map(Number);
                t.sort(function(a, b) {
                    return a - b;
                });
                for (var i = 0; i < t.length; i++) {
                    t[i] = this.file.ul_macs[t[i]];
                }
                var mac = condenseMacs(t, this.file.ul_key);

                var filekey = [
                    ul_key[0] ^ ul_key[4],
                    ul_key[1] ^ ul_key[5],
                    ul_key[2] ^ mac[0] ^ mac[1],
                    ul_key[3] ^ mac[2] ^ mac[3],
                    ul_key[4],
                    ul_key[5],
                    mac[0] ^ mac[1],
                    mac[2] ^ mac[3]
                ];

                if (u_k_aes && this.gid && !ulmanager.ulCompletingPhase[this.gid]) {
                    var u8 = new Uint8Array(response);

                    this.file.filekey = filekey;
                    this.file.response = (u8[35] === 1)
                        ? ab_to_base64(response)
                        : ab_to_str(response);
                    ulmanager.ulFinalize(this.file);
                    u8 = undefined;
                }
                else {
                    console.assert(false, 'check this...');
                }
            }

            this.bytes = null;

            this.file.retries = 0; /* reset error flag */

            return this.done();
        }
        else {
            var resp = ab_to_str(response);
            var estr = ulmanager.ulStrError(resp);
            this.logger.error("Invalid upload response: ", resp, estr);
            if (estr !== "EKEY") {
                return this.onXHRerror("$FATAL", null,
                    (estr ? (estr + " error")
                    : "IUR[" + String(resp).trim().substr(0, 5) + "]"));
            }
        }
    }

    this.srverr = xhr.status + 1;

    var errstr = 'BRFS [l:Unk]';
    if (isValidType) {
        if (response.byteLength && response.byteLength < 5) {
            errstr = 'BRFS [s:' + ab_to_str(response) + ']';
        }
        else if (xhr.status >= 400) {
            errstr = 'BRFS [-]';
        }
        else {
            errstr = 'BRFS [l:' + response.byteLength + ']';
        }
    }

    this.oet = setTimeout(function() {
        if (!oIsFrozen(self)) {
            self.onXHRerror(null, xhr, errstr);
        }
        self = undefined;
    }, 1950 + Math.floor(Math.random() * 2e3));

    if (d) {
        this.logger.warn("Bad response from server, status(%s:%s)",
            xhr.status,
            xhr.statusText,
            isValidType,
            this.file.name
        );
    }

    response = undefined;
}

ChunkUpload.prototype.upload = function() {
    'use strict';

    var url, xhr;
    var self = this;
    var logger = self.logger || ulmanager.logger;

    if (!this.file) {
        if (d) {
            logger.error('This upload was cancelled while the Encrypter was working,'
                + ' prevent this aborting it beforehand');
        }
        return;
    }

    if (!GlobalProgress[this.gid]) {
        return this.logger.error('No upload associated with gid ' + this.gid);
    }
    if (GlobalProgress[this.gid].paused) {
        return this.logger.info('Encrypter finished, but the upload was paused meanwhile.');
    }

    if (!this.file.posturl) {
        onUploadError(this.file, 'Internal error (0xBADF001)');
        if (!this.file.abort) {
            ASSERT(0, 'No PostURL! ' + (typeof this.file.posturl));
        }
        return;
    }

    xhr = getTransferXHR(this);
    url = dlmanager.uChangePort(this.file.posturl + this.suffix, this.altport ? 8080 : 0);
    xhr._murl = url;

    if (d > 1) {
        this.logger.info("pushing", url);
    }

    tryCatch(function() {
        xhr.open('POST', url);
        xhr.responseType = 'arraybuffer';
        xhr.send(self.bytes.buffer);
        self.xhr = xhr;
    }, function(ex) {
        if (self.file) {
            logger.warn('fatal upload error, attempting to restart...', String(ex.message || ex), [self, ex]);
            ulmanager.restart(self.file, ex.message || ex);
        }
        else {
            logger.debug('fatal upload error, holding while restarting...', String(ex.message || ex), [self, ex]);
        }
    })();
};

ChunkUpload.prototype.io_ready = function(res) {
    'use strict';

    if (res < 0 || !this.file || !this.file.ul_keyNonce) {
        if (this.file && !oIsFrozen(this.file)) {
            if (d) {
                this.logger.error('UL IO Error', res);
            }

            if (this.file.done_starting) {
                this.file.done_starting();
            }
            ulmanager.retry(this.file, this, "IO failed: " + res);
        }
        else {
            if (d && this.logger) {
                this.logger.error('The FileReader finished, but this upload was cancelled...');
            }
        }
    }
    else {
        this.bytes = res.bytes;
        this.suffix = res.suffix;
        Object.assign(this.file.ul_macs, res.file.ul_macs);
        this.upload();
    }
};

ChunkUpload.prototype.done = function(ee) {
    if (d > 1 && this.logger) {
        this.logger.info('.done');
    }

    if (this._done) {
        /* release worker */
        this._done();

        /* clean up references */
        this.destroy();
    }
};

ChunkUpload.prototype.run = function(done) {
    this._done = done;
    if (this.bytes && this.suffix) {
        this.logger.info('.run', 'Reusing previously encrypted data.');
        this.upload();
    }
    else if (this.file.size === 0) {
        this.logger.info('.run', 'Uploading 0-bytes file...');
        this.bytes = new Uint8Array(0);
        this.suffix = '/0?c=AAAAAAAAAAAAAAAA';
        this.upload();
    }
    else if (!this.start && localStorage.ulFailTest) {
        this.logger.warn('Intentionally blocking the first chunk.');
    }
    else {
        if (d > 1) {
            this.logger.info('.run');
        }
        if (!this.file.ul_reader) {
            this.file.ul_reader = new FileUploadReader(this.file);

            if (d > 1) {
                if (!window.ul_reader) {
                    window.ul_reader = [];
                }
                window.ul_reader.push(this.file.ul_reader);
            }
        }
        var self = this;
        this.file.ul_reader.getChunk(this.start, function(res) {
            self.io_ready(res);
        });
    }
    array.remove(GlobalProgress[this.gid].working, this, 1);
    GlobalProgress[this.gid].working.push(this);
};

function FileUpload(file) {
    this.file = file;
    this.ul = file;
    this.gid = 'ul_' + this.ul.id;
    this[this.gid] = !0;
    GlobalProgress[this.gid] = {
        working: []
    };
}

FileUpload.prototype.toString = function() {
    return "[FileUpload " + this.gid + "]";
};

FileUpload.prototype.destroy = function(mul) {
    'use strict';
    if (d) {
        ulmanager.logger.info('Destroying ' + this);
    }
    if (!this.file) {
        return;
    }
    if (Object(GlobalProgress[this.gid]).started) {
        ulmanager.ulSize -= this.file.size;
    }

    // Hmm, looks like there are more ChunkUploads than what we really upload (!?)
    if (d) {
        ASSERT(GlobalProgress[this.gid].working.length === 0, 'Huh, there are working upload chunks?..');
    }
    ASSERT(this.file.owner === this, 'Invalid FileUpload Owner...');
    window.ulQueue.poke(this.file, mul === -0xbeef ? mul : 0xdead);
    if (this.file.done_starting) {
        this.file.done_starting();
    }
    delete GlobalProgress[this.gid];
    oDestroy(this.file);
    oDestroy(this);
};

FileUpload.prototype.run = function(done) {
    var file = this.file;
    var self = this;

    file.abort = false; /* fix in case it restarts from scratch */
    file.ul_failed = false;
    file.retries = 0;
    file.xr = dlmanager.mGetXR();
    file.ul_lastreason = file.ul_lastreason || 0;

    var domNode = document.getElementById('ul_' + file.id);
    if (ulmanager.ulStartingPhase || !(domNode || file.isCreateFile)) {
        done();
        ASSERT(0, "This shouldn't happen");
        return ulQueue.pushFirst(this);
    }

    if (!GlobalProgress[this.gid].started) {
        GlobalProgress[this.gid].started = true;
    }

    if (d) {
        ulmanager.logger.info(file.name, "starting upload", file.id);
    }
    if (!file.isCreateFile) {
        domNode.classList.add('transfer-initiliazing');
        const transferStatus = domNode.querySelector('.transfer-status');
        if (transferStatus) {
            transferStatus.textContent = l[1042];
        }
    }

    ulmanager.ulSize += file.size;
    // ulmanager.ulStartingPhase = true;

    var started = false;
    file.done_starting = function() {
        if (started) {
            return;
        }
        started = true;
        ulmanager.ulStartingPhase = false;
        delete file.done_starting;

        if (ulmanager.ulSize < ulmanager.ulMaxConcurrentSize) {

            if (file.size < ulmanager.ulMaxFastTrackSize) {
                var size = ulQueue.getSize();
                var max  = ulQueue.maxActiveTransfers;

                if (size < max && ulQueue.canExpand(max)) {
                    ulQueue.setSize(size + 1);
                }
            }
        }
        else {
            ulQueue.setSize((fmconfig.ul_maxSlots | 0) || 4);
        }

        file = self = false;
        done();
    };

    getFingerprint(file).then(function(result) {
        if (!(file && self.file)) {
            ulmanager.logger.info('Fingerprint generation finished, but the upload was canceled meanwhile...');
        }
        else if (file.hash === result.hash) {
            // Retrying.
            setTimeout(ulmanager.ulStart.bind(ulmanager, self), 950 + Math.floor(Math.random() * 4e3));
        }
        else {
            file.ts = result.ts;
            file.hash = result.hash;
            ulmanager.ulSetup(self, file);
        }
    }).catch(function(ex) {
        // TODO: Improve further what error message we do show to the user.
        var error = ex.name !== 'Error' && ex.name || ex;

        eventlog(99727, JSON.stringify([1, String(error)]));

        if (error === 0x8052000e) {
            // File is locked
            error = l[7399];
        }
        else if (error === 'SecurityError') {
            // "Access denied"
            error = l[1667];
        }
        else {
            // "Read error"
            error = l[1677];
        }

        if (d) {
            ulmanager.logger.error('FINGERPRINT ERROR ("%s")', error, file.name, file.size, ex.message, [ex]);
        }

        if (file && self.file) {
            onUploadError(file, error);

            if (page.substr(0, 11) === 'filerequest') {
                mBroadcaster.sendMessage('upload:error', file.id, error);
                return;
            }

            var that = self;
            ulmanager.abort(file);
            that.destroy();
        }
    });
};

function isQueueActive(q) {
    return typeof q.id !== 'undefined';
}

var ulQueue = new TransferQueue(function _workerUploader(task, done) {
    if (d && d > 1) {
        ulQueue.logger.info('worker_uploader', task, done);
    }
    task.run(done);
}, is_ios && isMediaSourceSupported() ? 1 : 4, 'uploader');

ulQueue.poke = function(file, meth) {
    'use strict';
    let quick = false;
    if (meth === -0xbeef) {
        quick = true;
        meth = 0xdead;
    }
    if (file.owner) {
        var gid = ulmanager.getGID(file);

        file.retries = 0;
        file.sent = 0;
        file.progress = Object.create(null);
        file.posturl = "";
        file.uReqFired = null;
        file.abort = true;

        if (!quick) {
            ulQueue.pause(gid);
            ulQueue.filter(gid);
        }

        if (file.__umRetryTimer) {
            var t = file.__umRetryTimer;
            for (var i in t) {
                if (t.hasOwnProperty(i)) {
                    clearTimeout(t[i]);
                }
            }

            if (!quick) {
                ulQueue.resume();
            }
        }
        if (file.ul_reader) {
            file.ul_reader.destroy();
            file.ul_reader = null;
        }
        if (!meth) {
            meth = 'pushFirst';
        }

        delete file.__umRetries;
        delete file.__umRetryTimer;
    }

    if (meth !== 0xdead) {
        if (!meth && file.isCreateFile && file.size === 0) {
            meth = 'pushFirst';
        }

        file.sent = 0;
        file.progress = Object.create(null);
        file.owner = new FileUpload(file);
        ulQueue[meth || 'push'](file.owner);
    }
};

ulQueue.validateTask = function(pzTask) {
    // XXX: pzTask.file *must* be valid, it doesn't sometimes which indicates
    // a problem somewhere with the entry not getting removed from ulQueue._queue
    if (pzTask instanceof ChunkUpload && pzTask.file && (!pzTask.file.paused || pzTask.__retry)) {
        return true;
    }

    if (pzTask instanceof FileUpload
        && !ulmanager.ulStartingPhase
        && (document.getElementById('ul_' + pzTask.file.id) || pzTask.file.isCreateFile)) {

        return true;
    }

    return false;
};

ulQueue.canExpand = function(max) {
    max = max || this.maxActiveTransfers;
    return !is_mobile && this._running < max;
};

Object.defineProperty(ulQueue, 'maxActiveTransfers', {
    get: is_mobile
        ? function() {
            // If on mobile, there's only 1 upload at a time and the desktop calculation below fails
            return 1;
        }
        : function() {
            return Math.min(Math.floor(M.getTransferTableLengths().size / 1.6), 36);
        }
});

mBroadcaster.once('startMega', function _setupEncrypter() {
    'use strict';
    var encrypter = CreateWorkers('encrypter.js', function(context, e, done) {
        var file = context.file;
        if (!file || !file.ul_macs) {
            // TODO: This upload was cancelled, we should terminate the worker rather than waiting
            if (d) {
                encrypter.logger.error('This upload was cancelled, should terminate the worker rather than waiting');
            }
            return typeof e.data === 'string' || done();
        }

        // target byteOffset as defined at CreateWorkers()
        var offset = e.target.byteOffset;// || context.start;

        if (typeof e.data === 'string') {
            if (e.data[0] === '[') {
                file.ul_macs[offset] = JSON.parse(e.data);
            }
            else {
                encrypter.logger.info('WORKER:', e.data);
            }
        }
        else {
            if (context.appendMode) {
                context.bytes.set(new Uint8Array(e.data.buffer || e.data), offset);
            }
            else {
                context.bytes = new Uint8Array(e.data.buffer || e.data);
            }
            context.suffix = '/' + context.start + '?c=' + base64urlencode(chksum(context.bytes.buffer));
            done();
        }
    });

    ulmanager.logger.options.levelColors = {
        'ERROR': '#fe1111',
        'DEBUG': '#0000ff',
        'WARN':  '#C25700',
        'INFO':  '#44829D',
        'LOG':   '#000044'
    };
    Object.defineProperty(window, 'Encrypter', { value: encrypter });
});

var ul_queue = new UploadQueue();

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2018 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

/**
 * FileReader wrapper maintaining a pipeline of encrypted chunks.
 * @param {File} file The file instance
 * @constructor
 */
function FileUploadReader(file) {
    'use strict';

    this.index = 0;
    this.cached = 0;
    this.reading = 0;
    this.inflight = 0;

    this.file = file;
    this.offsets = file.ul_offsets.reverse();

    this.queue = Object.create(null);
    this.cache = Object.create(null);

    this.fs = new FileReader();
}

FileUploadReader.prototype = Object.create(null);

Object.defineProperty(FileUploadReader.prototype, 'constructor', {
    value: FileUploadReader
});

/**
 * Get an encrypted chunk from disk
 * @param {Number} offset The byte offset
 * @param {Function} callback
 */
FileUploadReader.prototype.getChunk = function(offset, callback) {
    'use strict';

    this.queue[offset] = callback;
    this._drain(offset);
};

// @private
FileUploadReader.prototype._drain = function(offset) {
    'use strict';

    if (this.cache[offset]) {
        var callback = this.queue[offset];

        if (callback) {
            var data = this.cache[offset];

            onIdle(function() {
                callback(data);
            });
            delete this.cache[offset];
            delete this.queue[offset];
            this.cached--;
        }
    }
    this._read();
};

// @private
FileUploadReader.prototype._dispatch = function(chunk, data) {
    'use strict';

    if (this.cache) {
        var offset = chunk.byteOffset;

        this.inflight++;
        this.reading--;
        this._read();

        if (data) {
            this._encrypt(chunk, data).then(this._setCacheItem.bind(this, offset)).catch(console.error.bind(console));
        }
        else {
            this._setCacheItem(offset, EFAILED);
        }
    }
};

// @private
FileUploadReader.prototype._setCacheItem = function(offset, data) {
    'use strict';

    if (this.cache) {
        this.cached++;
        this.inflight--;
        this.cache[offset] = data;
        this._drain(offset);
    }
};

// @private
FileUploadReader.prototype._read = function() {
    'use strict';

    if (this.cached + this.inflight > 31 || this.reading) {
        return;
    }
    this.reading++;

    var self = this;
    var chunk = this.offsets[this.index++];

    if (!chunk) {
        this.finished = Date.now();
        return;
    }

    this._getArrayBuffer(chunk.byteOffset, chunk.byteLength)
        .then(function(data) {
            self._dispatch(chunk, data);
        })
        .catch(function(ex) {
            if (d) {
                console.warn('FileUploadReader(%s)', chunk.byteOffset, chunk, ex);
            }
            self.index--;

            // TODO: check how reliably is this weak error handling...
            setTimeout(function() {
                self._dispatch(chunk);
            }, 2000);
        });
};

// @private
FileUploadReader.prototype._encrypt = function(chunk, data) {
    'use strict';

    var ctx = {
        file: {ul_macs: {}},
        start: chunk.byteOffset
    };
    var nonce = this.file.ul_keyNonce;

    return new Promise(function(resolve) {
        var chunks = 1;
        var ack = function() {
            if (!--chunks) {
                resolve(ctx);
            }
        };

        if (chunk.byteOffset === 0 && data.byteLength === 0x480000) {
            // split to chunk boundaries
            var offset = 0;
            var blockSize = ulmanager.ulBlockSize;

            chunks = 8;
            for (var i = 1; i <= 8; i++) {
                Encrypter.push([ctx, nonce, offset / 16, data.slice(offset, offset + (i * blockSize))], ack);
                offset += i * blockSize;
            }

            ctx.bytes = data;
            ctx.appendMode = true;
        }
        else {
            Encrypter.push([ctx, nonce, chunk.byteOffset / 16, data], ack);
        }
    });
};

// @private
FileUploadReader.prototype._getArrayBuffer = function(offset, length) {
    'use strict';

    var fs = this.fs;
    var file = this.file;
    return new Promise(function(resolve, reject) {
        var blob;

        fs.onloadend = function(ev) {
            var error = true;
            var target = ev.target;

            if (target.readyState === FileReader.DONE) {
                if (target.result instanceof ArrayBuffer) {
                    try {
                        return resolve(new Uint8Array(target.result));
                    }
                    catch (e) {
                        error = e;
                    }
                }
            }

            reject(error);
        };
        fs.onerror = reject;

        if (file.slice) {
            blob = file.slice(offset, offset + length);
        }
        else if (file.mozSlice) {
            blob = file.mozSlice(offset, offset + length);
        }
        else {
            blob = file.webkitSlice(offset, offset + length);
        }

        fs.readAsArrayBuffer(blob);
        file = blob = fs = undefined;
    });
};

FileUploadReader.prototype.destroy = function() {
    'use strict';

    this.fs = null;
    this.file = null;
    this.queue = null;
    this.cache = null;
    this.offsets = null;
};

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2016 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

function ezBuffer(size) {
    var obj = new Uint8Array(size),
        buffer = new DataView(obj.buffer),
        offset = 0;
    return {
        debug: function() {
            console.error(["DEBUG", offset, obj.length]);
        },
        getArray: function() {
            var bytes = []
            $.each(obj, function(i, val) {
                bytes.push(val);
            });
            return bytes;
        },
        getBytes: function() {
            return obj;
        },
        appendBytes: function(text) {
            var isArray = typeof text != "string";
            for (var i = text.length; i--;) {
                if (isArray) {
                    obj[offset + i] = text[i];
                }
                else {
                    // We assume it is an string
                    obj[offset + i] = text.charCodeAt(i);
                }
            }
            offset += text.length
        },
        i64: function(number, bigendian) {
            buffer.setBigInt64(offset, BigInt(number), !bigendian);
            offset += 8;
        },
        i32: function(number, bigendian) {
            buffer.setInt32(offset, number, !bigendian);
            offset += 4;
        },
        i16: function(number, bigendian) {
            buffer.setInt16(offset, number, !bigendian);
            offset += 2;
        },
        i8: function(number, bigendian) {
            buffer.setInt8(offset, number, !bigendian);
            offset += 1;
        },
        resize: function(newsize) {
            var zclass = obj.constructor,
                zobj = new zclass(newsize)
            zobj.set(obj, 0);
            obj = zobj;
            buffer = new DataView(obj.buffer)
            return obj;
        },
        /**
         *  Check if the current bytestream has enough
         *  size to add "size" more bytes. If it doesn't have
         *  we return a new bytestream object
         */
        resizeIfNeeded: function(size) {
            if (obj.length < (size + offset)) {
                return this.resize(size + offset);
            }
            return obj;
        }
    };
}

var Zips = {};

var ZIPClass = function(totalSize) {
    var self = this,
        maxZipSize = Math.pow(2, 31) * .9,
        isZip64 = totalSize > maxZipSize || localStorage.zip64 == 1

    this.isZip64 = isZip64 /* make it public */

    if (isZip64 && !mega.config.get('zip64n')) {
        mega.config.set('zip64n', 1);
        msgDialog('warninga', l[34], l[2033]);
    }

    // Constants
    var fileHeaderLen               = 30
        , noCompression             = 0
        , zipVersion                = isZip64 ? 45 : 20
        , defaultFlags              = 0x808 /* UTF-8 */
        , i32max                    = 0xffffffff
        , i16max                    = 0xffff
        , zip64ExtraId              = 0x0001
        , zipUtf8ExtraId            = 0x7075
        , directory64LocLen         = 20
        , directory64EndLen         = 56
        , directoryEndLen           = 22
        , fileHeaderSignature       = 0x04034b50
        , directory64LocSignature   = 0x07064b50
        , directory64EndSignature   = 0x06064b50
        , directoryEndSignature     = 0x06054b50
        , dataDescriptorSignature   = 0x08074b50 // de-facto standard; required by OS X Finder
        , directoryHeaderSignature  = 0x02014b50
        , dataDescriptorLen         = 16
        , dataDescriptor64Len       = 24
        , directoryHeaderLen        = 46

    /* ZipHeader  */
    /**
     *  ZipHeader struct
     */
    function ZipHeader() {
            this.readerVersion = zipVersion;
            this.Flags = defaultFlags;
            this.Method = noCompression;
            this.date = 0
            this.crc32 = 0;
            this.size = 0;
            this.unsize = 0;
            this.file = "";
            this.extra = [];

            this.getBytes = function() {
                var buf = ezBuffer(fileHeaderLen + this.file.length + this.extra.length);
                buf.i32(fileHeaderSignature)
                buf.i16(this.readerVersion);
                buf.i16(this.Flags)
                buf.i16(this.Method)
                DosDateTime(this.date, buf)
                buf.i32(this.crc32); // crc32
                buf.i32(this.size); // compress size
                buf.i32(this.unsize); // uncompress size
                buf.i16(this.file.length);
                buf.i16(this.extra.length);
                buf.appendBytes(this.file);
                buf.appendBytes(this.extra);
                return buf.getBytes();
            }
        }

    // ZipCentralDirectory
    function ZipCentralDirectory() {
        this.creatorVersion = zipVersion;
        this.readerVersion = zipVersion;
        this.Flags = defaultFlags;
        this.Method = noCompression;
        this.date = 0;
        this.crc32 = 0;
        this.file = ""
        this.size = 0; // compressed size
        this.unsize = 0; // uncompressed size
        this.offset = 0;
        this.externalAttr = 0;

        this.getBytes = function() {
            var extra = [],
                ebuf;

            if (isZip64) {
                ebuf = ezBuffer(28); // 2xi16 + 3xi64
                ebuf.i16(zip64ExtraId);
                ebuf.i16(24);
                ebuf.i64(this.size);
                ebuf.i64(this.unsize);
                ebuf.i64(this.offset);
                extra = extra.concat(ebuf.getArray());
            }

            var buf = ezBuffer(directoryHeaderLen + this.file.length + extra.length);
            buf.i32(directoryHeaderSignature);
            buf.i16(this.creatorVersion);
            buf.i16(this.readerVersion);
            buf.i16(this.Flags);
            buf.i16(this.Method)
            DosDateTime(this.date, buf)
            buf.i32(this.crc32);
            buf.i32(isZip64 ? i32max : this.size);
            buf.i32(isZip64 ? i32max : this.unsize);
            buf.i16(this.file.length);
            buf.i16(extra.length);
            buf.i16(0); // no comments
            buf.i32(0); // disk number
            buf.i32(this.externalAttr);
            buf.i32(isZip64 ? i32max : this.offset);
            buf.appendBytes(this.file);
            buf.appendBytes(extra);

            return buf.getBytes();
        }
    }

    // ZipDataDescriptor
    function ZipDataDescriptor() {
        this.crc32 = 0;
        this.size = 0;
        this.unsize = 0;

        this.getBytes = function() {
            var buf = ezBuffer(isZip64 ? dataDescriptor64Len : dataDescriptorLen);
            buf.i32(dataDescriptorSignature);
            buf.i32(this.crc32);
            if (isZip64) {
                buf.i64(this.size);
                buf.i64(this.unsize);
            }
            else {
                buf.i32(this.size);
                buf.i32(this.unsize);
            }
            return buf.getBytes();
        };
    }

    // DosDateTime
    /**
     *  Set an unix time (or now if missing) in the zip
     *  expected format
     */
    function DosDateTime(sec, buf) {
        var date = new Date(),
            dosTime, dosDate;

        if (sec) {
            date = new Date(sec * 1000);
        }

        dosTime = date.getHours();
        dosTime = dosTime << 6;
        dosTime = dosTime | date.getMinutes();
        dosTime = dosTime << 5;
        dosTime = dosTime | date.getSeconds() / 2;

        dosDate = date.getFullYear() - 1980;
        dosDate = dosDate << 4;
        dosDate = dosDate | (date.getMonth() + 1);
        dosDate = dosDate << 5;
        dosDate = dosDate | date.getDate();

        buf.i16(dosTime);
        buf.i16(dosDate);
    }

    self.writeCentralDir = function(filename, size, time, crc32, directory, headerpos) {
        filename = to8(filename)
        var dirRecord = new ZipCentralDirectory();
        dirRecord.file = filename;
        dirRecord.date = time;
        dirRecord.size = size;
        dirRecord.unsize = size;
        dirRecord.crc32 = crc32;
        dirRecord.offset = headerpos;
        dirRecord.externalAttr = directory ? 1 : 0;

        var dataDescriptor = new ZipDataDescriptor();
        dataDescriptor.crc32 = crc32;
        dataDescriptor.size = size;
        dataDescriptor.unsize = size;

        return {
            dirRecord: dirRecord.getBytes(),
            dataDescriptor: dataDescriptor.getBytes()
        };
    }

    self.writeSuffix = function(pos, dirData) {
        var dirDatalength = 0;
        for (var i in dirData) {
            dirDatalength += dirData[i].length;
        }

        var buf = ezBuffer(22);
        if (isZip64) {
            var xbuf = new ezBuffer(directory64EndLen + directory64LocLen)
            xbuf.i32(directory64EndSignature)
                // directory64EndLen - 4 bytes - 8 bytes
            xbuf.i64(directory64EndLen - 4 - 8)
            xbuf.i16(zipVersion)
            xbuf.i16(zipVersion)
            xbuf.i32(0) // disk number
            xbuf.i32(0) // number of the disk with the start of the central directory
            xbuf.i64(dirData.length)
            xbuf.i64(dirData.length)
            xbuf.i64(dirDatalength);
            xbuf.i64(pos);

            xbuf.i32(directory64LocSignature)
            xbuf.i32(0)
            xbuf.i64(pos + dirDatalength)
            xbuf.i32(1) // total number of disks
            buf.resize(22 + xbuf.getBytes().length)
            buf.appendBytes(xbuf.getBytes());
        }

        buf.i32(directoryEndSignature)
        buf.i32(0); // skip
        buf.i16(isZip64 ? i16max : dirData.length)
        buf.i16(isZip64 ? i16max : dirData.length)
        buf.i32(isZip64 ? i32max : dirDatalength);
        buf.i32(isZip64 ? i32max : pos);
        buf.i16(0); // no comments

        return buf.getBytes();
    };

    self.writeHeader = function(filename, size, date) {
        filename = to8(filename)
        var header = new ZipHeader();
        header.file = filename;
        header.size = size;
        header.date = date;

        var ebuf = ezBuffer(1 + 4 + 4 + filename.length)
        ebuf.i16(zipUtf8ExtraId)
        ebuf.i16(5 + filename.length) // size
        ebuf.i8(1) // version
        ebuf.i32(crc32(filename))
        ebuf.appendBytes(filename)
        header.extra = ebuf.getArray();

        return header.getBytes();
    }
}

/**
 *  ZipEntryIO
 *
 *  It implements a FileIO object but underneath it writes using
 *  `ZipWriter.write()` method. This object adds a few bytes before and after
 *  the buffer itself, some zip structures.
 */
function ZipEntryIO(zipWriter, aFile) {
    this.file = aFile;
    this.zipWriter = zipWriter;
    this.queued = 0;
    this.logger = MegaLogger.getLogger('ZipEntryIO', {}, dlmanager.logger);
};

ZipEntryIO.prototype.toString = function() {
    return "[ZipEntry " + (this.file && this.file.n) + "]";
};
ZipEntryIO.prototype.destroy = function() {
    if (!oIsFrozen(this)) {
        var dl = this.file || {};
        if (d) {
            this.logger.info('Destroying ' + this);
        }
        if (/*dl.cancelled && */dl.owner) {
            // call ClassFile.abortTimers
            dl.owner.abortTimers();
        }
        oDestroy(this);
    }
};

ZipEntryIO.prototype.abort = function(e) {
    if (this.zipWriter) {
        // this.zipWriter.destroy(e);
        this.destroy();
    }
};

ZipEntryIO.prototype.isEmpty = function() {
    return this.queued == 0;
}

ZipEntryIO.prototype.setCredentials = function() {
    this.begin();
};

ZipEntryIO.prototype.push = function(obj) {
    'use strict';
    if (oIsFrozen(this) || oIsFrozen(this.zipWriter)) {
        console.warn('The ZipWriter instance have already been destroyed.', this);
        return;
    }
    this.queued++;
    obj.zfile = this;
    this.zipWriter.zwriter.push(obj, () => {
        if (this.queued) {
            this.queued--;
            if (Object(this.file).ready) {
                this.file.ready();
            }
        }
    });
};

function ZipWriter(dl_id, dl) {
    this.dl = dl;
    this.size = 0
    this.nfiles = 0
    this.is_ready = false
    this.queues = [];
    this.hashes = {};
    this.dirData = [];
    this.offset = 0;
    this.file_offset = 0;
    this.eblocked = 0;

    this.io = dlMethod === MemoryIO ? new dlMethod(dl_id, dl) : new CacheIO(dl_id, dl);

    this.io.is_zip = true;
    this.zwriter = new MegaQueue(dlZipWriterIOWorker.bind(this), 1, 'zip-writer');
    this.zwriter.validateTask = dlZipWriterValidate.bind(this);
    this.logger = MegaLogger.getLogger('ZipWriter', {}, dlmanager.logger);

    this.io.begin = () => {
        if (this.zwriter) {
            this.is_ready = true;
            this.zwriter.process();
        }
    };
}

ZipWriter.prototype.toString = function() {
    return "[ZipWriter " + (this.dl && this.dl.zipname) + "]";
};

ZipWriter.prototype.createZipObject = function() {
    if (!this.ZipObject) {

        this.ZipObject = new ZIPClass(this.size);

        if (this.ZipObject.isZip64) {
            this.size += this.nfiles * 28 // extra bytes for each ZipCentralDirectory
            this.size += this.nfiles * 24 // extra bytes for each dataDescriptor
            this.size += 98 // final bytes
        }
        else {
            this.size += this.nfiles * 16 // extra bytes for each dataDescriptor
            this.size += 22 // final bytes
        }
        if (d) {
            this.logger.info("isZip64", this.ZipObject.isZip64, this.size);
        }

        this.io.setCredentials("", this.size, this.dl.zipname);
    }
    return this.ZipObject;
};

ZipWriter.prototype.destroy = function(error) {
    if (d) {
        this.logger.info('Destroying ' + this, this.cancelled);
    }
    if (this.dl) {
        var dl = this.dl;
        this.zwriter.destroy();
        delete Zips[dl.zipid];
        delete GlobalProgress['zip_' + dl.zipid];
        if (error || this.cancelled) {
            if (this.io.abort) {
                this.io.abort(error || this);
            }
        }
        else {
            dlmanager.cleanupUI(dl, true);
        }
        oDestroy(this);
    }
}

function dlZipWriterIOWorker(task, done) {
    'use strict';
    const {file} = task.zfile;

    if (typeof file === 'undefined') {
        if (d) {
            console.error('File aborted...', task);
        }
        return done();
    }

    this.hashes[file.id] = crc32(task.data, this.hashes[file.id] || 0, task.data.byteLength)
    this.file_offset += task.data.byteLength;

    const buffer = task.data;
    const write = (buffer, done) => {
        const pos = this.offset;

        this.offset += buffer.byteLength;
        this.io.write(buffer, pos, done);
    };

    if (file.data) {
        try {
            new Uint8Array(file.data, task.offset, buffer.byteLength).set(buffer);
        }
        catch (ex) {}
    }

    if (task.offset === 0) {
        var header = this.ZipObject.writeHeader(
            file.p + file.n,
            file.size,
            file.t
        );
        file.io.entryPos = this.offset;

        /* replace task.data */
        delete task.data;

        write(header, () => write(buffer, done));
    }
    else {
        write(buffer, done);
    }
}

function dlZipWriterValidate(t) {
    if (!this.ZipObject) {
        this.createZipObject(); /* create the zipobject if it doesnt exists */
        if (!this.ZipObject) {
            return false;
        }
    }

    return this.is_ready && t.zfile == this.queues[0] && t.offset == this.file_offset;
};

ZipWriter.prototype.done = function(zfile) {
    var file = zfile.dl;
    var centralDir = this.ZipObject.writeCentralDir(
        file.p + file.n,
        file.size,
        file.t,
        this.hashes[file.id],
        false,
        file.io.entryPos
    );

    this.dirData.push(centralDir.dirRecord)

    this.zwriter.pause(); /* pause all IO */
    this.queues.shift();

    var buffer = centralDir.dataDescriptor

    if (this.queues.length == 0) {
        var end = this.ZipObject.writeSuffix(buffer.byteLength + this.offset, this.dirData),
            size = 0,
            offset = buffer.byteLength,
            buf

        for (var i in this.dirData) {
            size += this.dirData[i].byteLength;
        }

        buf = new Uint8Array(buffer.byteLength + size + end.byteLength);
        buf.set(buffer, 0);

        for (var i in this.dirData) {
            buf.set(this.dirData[i], offset);
            offset += this.dirData[i].byteLength;
        }

        buf.set(end, offset);

        return this.io.write(buf, this.offset, this._eof.bind(this));
    }

    this.io.write(buffer, this.offset, this.finalize_file.bind(this));
    this.offset += buffer.byteLength;
}

ZipWriter.prototype.finalize_file = function() {
    if (!oIsFrozen(this)) {
        this.file_offset = 0;
        this.zwriter.resume();
    }
};

ZipWriter.prototype._eof = function() {

    'use strict';

    var msg;

    if (this.eblocked === this.nfiles) {
        msg = this.nfiles === 1 ? l[20818] : l[20819];
        msgDialog('warninga', 'Warning', escapeHTML(msg));
        this.dl.onDownloadError(this.dl, EBLOCKED);
        this.destroy();
        return false;
    }
    else if (this.eblocked) {
        msg = mega.icu.format(l[20820],  this.nfiles - this.eblocked)
            .replace('%1', mega.icu.format(l.download_and_import_items_count,  this.nfiles));
        msgDialog('warninga', 'Warning', escapeHTML(msg));
    }

    this.dl.onBeforeDownloadComplete(this.dl.pos);
    this.io.download(this.dl.zipname, '');
    this.dl.onDownloadComplete(this.dl);
    this.destroy();
};

ZipWriter.prototype.addEntryFile = function(file) {
    var io = new ZipEntryIO(this, file);
    this.queues.push(io);
    this.nfiles++
        this.size += file.size
        + 30 + 9 + 2 * (file.p.length + file.n.length) /* header */
        + 46 + file.p.length + file.n.length /* dirRecord */
    return io;
};

// crc32
var crc32table = [
    0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA,
    0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3,
    0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988,
    0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91,
    0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE,
    0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
    0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC,
    0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5,
    0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172,
    0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,
    0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940,
    0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
    0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116,
    0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,
    0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,
    0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,
    0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A,
    0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
    0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818,
    0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,
    0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,
    0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457,
    0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C,
    0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
    0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2,
    0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB,
    0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0,
    0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,
    0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086,
    0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
    0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4,
    0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD,
    0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A,
    0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683,
    0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8,
    0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
    0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE,
    0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7,
    0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC,
    0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,
    0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252,
    0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
    0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60,
    0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79,
    0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,
    0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F,
    0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04,
    0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
    0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A,
    0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,
    0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38,
    0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21,
    0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E,
    0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
    0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C,
    0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,
    0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2,
    0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB,
    0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0,
    0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
    0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6,
    0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF,
    0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,
    0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D
];

function crc32(data, crc, len) {
    if (typeof crc === "undefined") {
        crc = 0;
    }
    if (typeof len === "undefined") {
        len = data.length;
    }

    var x = 0;
    var y = 0;

    var off = data.length - len;

    crc = crc ^ -1;

    for (var i = 0; i < len; i++) {
        y = (crc ^ data[i + off]) & 0xFF;
        x = crc32table[y];
        crc = (crc >>> 8) ^ x;
    }

    return crc ^ -1;
}

/* ***************** BEGIN MEGA LIMITED CODE REVIEW LICENCE *****************
 *
 * Copyright (c) 2018 by Mega Limited, Auckland, New Zealand
 * All rights reserved.
 *
 * This licence grants you the rights, and only the rights, set out below,
 * to access and review Mega's code. If you take advantage of these rights,
 * you accept this licence. If you do not accept the licence,
 * do not access the code.
 *
 * Words used in the Mega Limited Terms of Service [https://127.0.0.1/terms]
 * have the same meaning in this licence. Where there is any inconsistency
 * between this licence and those Terms of Service, these terms prevail.
 *
 * 1. This licence does not grant you any rights to use Mega's name, logo,
 *    or trademarks and you must not in any way indicate you are authorised
 *    to speak on behalf of Mega.
 *
 * 2. If you issue proceedings in any jurisdiction against Mega because you
 *    consider Mega has infringed copyright or any patent right in respect
 *    of the code (including any joinder or counterclaim), your licence to
 *    the code is automatically terminated.
 *
 * 3. THE CODE IS MADE AVAILABLE "AS-IS" AND WITHOUT ANY EXPRESS OF IMPLIED
 *    GUARANTEES AS TO FITNESS, MERCHANTABILITY, NON-INFRINGEMENT OR OTHERWISE.
 *    IT IS NOT BEING PROVIDED IN TRADE BUT ON A VOLUNTARY BASIS ON OUR PART
 *    AND YOURS AND IS NOT MADE AVAILABLE FOR CONSUMER USE OR ANY OTHER USE
 *    OUTSIDE THE TERMS OF THIS LICENCE. ANYONE ACCESSING THE CODE SHOULD HAVE
 *    THE REQUISITE EXPERTISE TO SECURE THEIR OWN SYSTEM AND DEVICES AND TO
 *    ACCESS AND USE THE CODE FOR REVIEW PURPOSES. YOU BEAR THE RISK OF
 *    ACCESSING AND USING IT. IN PARTICULAR, MEGA BEARS NO LIABILITY FOR ANY
 *    INTERFERENCE WITH OR ADVERSE EFFECT ON YOUR SYSTEM OR DEVICES AS A
 *    RESULT OF YOUR ACCESSING AND USING THE CODE.
 *
 * Read the full and most up-to-date version at:
 *    https://github.com/meganz/webclient/blob/master/LICENCE.md
 *
 * ***************** END MEGA LIMITED CODE REVIEW LICENCE ***************** */

(function megaCloudRaid(global) {
    'use strict';

    const DEBUG = window.d > 0;
    const DEBUG_VERBOSE = window.d > 1;
    const DEBUG_TRACE = !!localStorage.cloudRaidDebug;

    const logger = MegaLogger.getLogger('cloudraid');
    logger.options.levelColors = {
        'ERROR': '#d90007',
        'DEBUG': '#9591a7',
        'WARN': '#ebb200',
        'INFO': '#818dff',
        'LOG': '#808f8d'
    };

    var roundUpToMultiple = function(n, factor) {
        return (n + factor - 1) - ((n + factor - 1) % factor);
    };

    var roundDownToMultiple = function (n, factor) {
        return n - (n % factor);
    };

    /**
     * Helper class for CloudRaidRequest, keeps the data per channel in one instance.
     * @param {Number} partNum Raid part number
     * @param {String} baseUrl The URL to the storage server.
     * @constructor
     * @private
     */
    function CloudRaidPartFetcher(partNum, baseUrl) {

        // each chunk of part data downloaded is appended here
        this.filePieces = [];

        // increments on any fail.  Receiving data successfully resets it to 0
        this.failCount = 0;

        // track where each part has gotten to in the overall part of the file
        this.lastPos = 0;

        // channel is paused if it gets more than 3 chunks ahead of the
        // slowest channel, to avoid using too much memory for buffers
        this.channelPauseCount = 0;
        this.channelPauseMillisec = 0;
        this.timedout = false;
        this.readTimeoutId = null;
        this.delayedinitialconnect = null;

        // raid part number
        this.partNum = partNum;

        // URL of this part's data
        this.baseUrl = baseUrl;

        // AbortController lets us terminate a fetch() operation (eg. on timeout). We can't reuse it after
        // it's been signalled though, eg timeout on this part, then another, then back to this one
        this.abortController = null;
        this.signal = null;
        this.reader = null;
        this.reading = false;
        this.done = false;

        // Whether abort was signalled from the higher layer.
        this.highlevelabort = false;
    }

    CloudRaidPartFetcher.prototype = Object.create(null, {constructor: {value: CloudRaidPartFetcher}});
    CloudRaidPartFetcher.prototype.abort = function() {

        if (this.abortController) {
            this.abortController.abort();
            this.abortController = false;
        }

        if (this.delayedinitialconnect) {
            clearTimeout(this.delayedinitialconnect);
            this.delayedinitialconnect = false;
        }

        this.done = false;
        this.signal = false;
        this.reader = false;
        this.reading = false;
        this.timedout = false;

        return this;
    };
    Object.freeze(CloudRaidPartFetcher.prototype);


    /**
     * CloudRaidRequest
     * @param {Object} aDownload The download object, containing the 'g' reply
     * @param {Number} [aStartOffset] Offset from where to start downloading
     * @param {Number} [aEndOffset] Download data up to this offset
     * @param {*} [aFiveChannelsMode] 5-channel mode strategy.
     * @constructor
     *
     * Downloads CloudRAID files, which means files are split into 5 pieces + XOR, across 6 servers.
     * Each 16 byte file sector is distributed across the servers in round robin fashion.
     * Any 5 of the 6 sectors at a given point in the file are enough to reconstitute the file data at that point.
     *
     * Strategy:  First try to download 6 channels, and drop the slowest-to-respond channel.
     *            Build the file from the 5. In case of a failure or timeout on any channel,
     *            stop using that channel and use the currently unused one.
     */
    function CloudRaidRequest(aDownload, aStartOffset, aEndOffset, aFiveChannelsMode) {
        var baseURLs = aDownload.url || aDownload.g;
        var fileSize = aDownload.size || aDownload.s;

        this.response = false;
        this.outputByteCount = 0;
        this.wholeFileDatalinePos = 0;

        // Only known once the download is initialised
        this.fullFileSize = 0;

        // Only deliver data from this position in the file onwards (0-based)
        this.fileStartPos = 0;

        // Only read data up to this position in the file (exclusive, 0-based).
        // We may need to read data past the fileEndDeliverPos so that we can get enough data to xor the last sector
        this.fileEndReadPos = 0;

        // Only deliver data up to this position in the file (exclusive, 0-based)
        this.fileEndDeliverPos = 0;

        // starts at -1, indicating we are trying 6 channels, and we will abandon the slowest.
        // once we get the headers for 5 of the channels, it is the channel number that is not being fetched
        this.initialChannelMode = -1;

        this.lastFailureTime = null;
        this.startTime = null;
        this.bytesProcessed = 0;
        this.totalRequests = 0;
        this.channelReplyState = 0;
        this.finished = false;

        // XMLHttpRequest properties
        this.status = 0;
        this.upload = this;
        this.readyState = XMLHttpRequest.UNSENT;

        this.part = [];
        for (var i = this.RAIDPARTS; i--;) {
            this.part[i] = new CloudRaidPartFetcher(i, baseURLs[i]);
        }

        if (aStartOffset === undefined) {
            aEndOffset = -1;
            aStartOffset = 0;
        }

        this.fullFileSize = fileSize;
        this.fileStartPos = aStartOffset;
        this.startTime = performance.now();
        this.fileEndDeliverPos = (aEndOffset === -1 ? this.fullFileSize : aEndOffset);
        this.fileEndReadPos = Math.min(this.fullFileSize, roundUpToMultiple(this.fileEndDeliverPos, this.RAIDLINE));
        this.wholeFileDatalinePos = (this.fileStartPos - (this.fileStartPos % this.RAIDLINE));
        this.expectedBytes = this.fileEndDeliverPos - this.fileStartPos;

        // skip this amount of data in the first raid line to start at requested byte
        this.skipBeginningData = this.fileStartPos - this.wholeFileDatalinePos;

        // Setup CloudRAID Settings inherited between CloudRaidRequest instances.
        var cloudRaidSettings = aDownload.cloudRaidSettings;
        if (!cloudRaidSettings || cloudRaidSettings.baseURLs !== baseURLs) {
            cloudRaidSettings = aDownload.cloudRaidSettings = Object.create(null);
            cloudRaidSettings.baseURLs = baseURLs;
            cloudRaidSettings.onFails = 0;
            cloudRaidSettings.timeouts = 0;
            cloudRaidSettings.toomanyfails = 0;
            cloudRaidSettings.startglitches = 0;
        }
        this.cloudRaidSettings = cloudRaidSettings;

        // Set the initial channel mode if we already know which server is slowest
        if (this.cloudRaidSettings.lastFailedChannel !== undefined) {
            this.initialChannelMode = this.cloudRaidSettings.lastFailedChannel;
        }

        var lid = false;
        if (d) {
            var uuid = makeUUID();
            lid = cloudRaidSettings.iid || ((aDownload.id || aDownload.handle) + uuid.substr(-13, 5));
            cloudRaidSettings.iid = lid;
            lid += '-' + uuid.slice(-6) + ':' + this.fileStartPos + '-' + this.fileEndDeliverPos;
        }
        this.logger = new MegaLogger(lid, logger.options, logger);

        if (!DEBUG_TRACE) {
            this.logger.debug = function() {};
        }

        if (DEBUG) {
            this.logger.info("Initiating CloudRAID Request...", this);
        }
    }

    /**
     * Promise-based CloudRaidRequest fetcher helper
     * @param {Object} aData An object containing the 'g' reply
     * @param {Number} [aStartOffset] Offset from where to start downloading
     * @param {Number} [aEndOffset] Download data up to this offset
     * @param {Function} [aProgress] Progressing function
     * @returns {Promise}
     */
    CloudRaidRequest.fetch = function(aData, aStartOffset, aEndOffset, aProgress) {
        return new Promise(function(resolve, reject) {
            var xhr = new CloudRaidRequest(aData, aStartOffset, aEndOffset);

            xhr.onloadend = function(ev) {

                if (this.outputByteCount === this.expectedBytes) {
                    resolve(ev);
                }
                else {
                    this.response = false;
                    reject(ev);
                }

                // cleanup
                this.abort();
            };

            xhr.onprogress = aProgress || null;
            xhr.send();
        });
    };

    CloudRaidRequest.prototype = Object.create(null, {
        constructor: {
            value: CloudRaidRequest
        },
        open: {
            value: function _open() {
                this.readyState = XMLHttpRequest.OPENED;
            }
        },
        send: {
            value: function _send() {
                this.startTime = performance.now();
                this.start5Channel(this.initialChannelMode);
            }
        },
        abort: {
            value: function _abort() {

                this.highlevelabort = true;
                for (var i = this.RAIDPARTS; i--;) {
                    this.part[i].abort();
                }

                this.dispatchEvent('abort', XMLHttpRequest.DONE);
                this.readyState = XMLHttpRequest.UNSENT;
            }
        },
        dispatchEvent: {
            value: tryCatch(function _dispatchEvent(name, state, data) {
                if (DEBUG) {
                    this.logger.debug('dispatchEvent', name, state, data, this.readyState);
                }

                if (typeof state !== 'number') {
                    data = state;
                }
                else {
                    this.readyState = state;
                }

                if (typeof this['on' + name] === 'function') {
                    var ev = new $.Event(name);
                    ev.target = this;

                    if (typeof data === 'object') {
                        Object.assign(ev, data);
                    }
                    this['on' + name].call(this, ev);
                }
            })
        }
    });

    CloudRaidRequest.prototype.RAIDPARTS = 6;
    CloudRaidRequest.prototype.RAIDSECTOR = 16;
    CloudRaidRequest.prototype.RAIDLINE = 16 * 5;

    // With slow data speeds, and/or high cpu, we may not see data
    // from a working fetch for over 40 seconds (experimentally determined)
    CloudRaidRequest.prototype.FETCH_DATA_TIMEOUT_MS = 115000;

    // Switch source for received http error codes.
    CloudRaidRequest.prototype.EC_SWITCH_SOURCE = {408: 1, 409: 1, 429: 1, 503: 1};

    CloudRaidRequest.prototype.onPartFailure = function(failedPartNum, partStatus) {
        var self = this;

        this.cloudRaidSettings.onFails += 1;

        this.part[failedPartNum].failCount++;
        this.lastFailureTime = Date.now();

        if (DEBUG) {
            this.logger.warn("Recovering from fail, part %s", failedPartNum,
                this.part[0].failCount, this.part[1].failCount, this.part[2].failCount,
                this.part[3].failCount, this.part[4].failCount, this.part[5].failCount);
        }

        this.cloudRaidSettings.lastFailedChannel = failedPartNum;

        var sumFails = 0;
        for (var i = this.RAIDPARTS; i--;) {
            sumFails += this.part[i].failCount;
        }

        if (sumFails > 2 || partStatus > 200 && !this.EC_SWITCH_SOURCE[partStatus | 0]) {
            // three fails across all channels, when any data received would reset the count on that channel
            if (DEBUG) {
                this.logger.error("%s, aborting chunk download and retrying...",
                    sumFails > 2 ? 'too many fails' : 'network error');
            }
            this.response = false;
            this.cloudRaidSettings.toomanyfails++;
            return this.dispatchLoadEnd(partStatus);
        }

        var partStartPos = this.wholeFileDatalinePos / (this.RAIDPARTS - 1);

        if (this.initialChannelMode < 0) {
            this.cloudRaidSettings.startglitches += 1;
            // we haven't decided which channel to skip yet.  Eg. on the first 5 connects, this one reports
            // back first with connection refused. in this case, try again but on a bit of a delay.
            // Probably this one will turn out to be the slowest, and be cancelled anyway.
            if (DEBUG) {
                this.logger.debug("We will retry channel %s shortly...", failedPartNum);
            }

            this.part[failedPartNum].delayedinitialconnect = setTimeout(function() {
                self.startPart(failedPartNum, partStartPos, self.initialChannelMode);
            }, 1000);
        }
        else {
            // turn the faulty channel (which is already stopped) into the idle
            // channel (which already reached the end), and start reading from the old idle channel
            if (DEBUG) {
                this.logger.debug("Resetting channels %s and %s", this.initialChannelMode, failedPartNum);
            }

            this.part[failedPartNum].filePieces = [];
            this.part[this.initialChannelMode].filePieces = [];
            this.startPart(failedPartNum, partStartPos, failedPartNum);
            this.startPart(this.initialChannelMode, partStartPos, failedPartNum);
            this.initialChannelMode = failedPartNum;
        }

    };

    CloudRaidRequest.prototype.dispatchLoadEnd = function(status) {
        this.status = status | 0;
        this.dispatchEvent('readystatechange', XMLHttpRequest.DONE);
        this.dispatchEvent('loadend');
    };

    CloudRaidRequest.prototype.skipStrategy = function(partNum, failedPartNum) {
        if (failedPartNum === -1) {
            // try 6 but drop the last one to report onloadstart()
            return -3;

            // (not used for now) 6 channel mode, skipping every 6th one starting at the partNum'th
            // return partNum;
        }

        if (partNum === failedPartNum) {
            // skip all since this channel failed last time
            return -2;
        }

        // don't skip any
        return -1;
    };

    CloudRaidRequest.prototype.start5Channel = function (failedPartNum) {
        var i;

        // keep outputpieces that we have so far, of course, but throw away any further
        // chunks we have already as some of them will be 'skipped' and not have actual data
        for (i = this.RAIDPARTS; i--;) {
            this.part[i].filePieces = [];
        }

        // start on a raid line boundary
        var partStartPos = this.wholeFileDatalinePos / (this.RAIDPARTS - 1);

        if (DEBUG) {
            this.logger.debug("Begin reading file from position %s, each part from %s",
                this.wholeFileDatalinePos, partStartPos);
        }

        for (i = this.RAIDPARTS; i--;) {
            this.startPart(i, partStartPos, failedPartNum);
        }
    };

    CloudRaidRequest.prototype.startPart = function(partNum, partStartPos, failedPartNum) {
        var partSize = this.calcFilePartSize(partNum, this.fileEndReadPos);
        var skipStrategy = this.skipStrategy(partNum, failedPartNum);

        if (DEBUG_TRACE) {
            if (skipStrategy === -2) {
                this.logger.debug("part %s not downloading", partNum);
            }
            else if (skipStrategy === -1) {
                this.logger.debug("part %s not skipping", partNum);
            }
        }

        this.part[partNum].abort();
        this.loadPart(partNum, partStartPos, partSize, skipStrategy);
    };


    CloudRaidRequest.prototype.calcFilePartSize = function(part, filesize) {
        // compute the size of this raid part based on the original file size len
        var r = filesize % this.RAIDLINE;
        var t = Math.min(this.RAIDSECTOR, Math.max(0, r - (part - (part === 0 ? 0 : 1)) * this.RAIDSECTOR));

        return (filesize - r) / (this.RAIDPARTS - 1) + t;
    };


    CloudRaidRequest.prototype.recoverFromParity = function(target, buffers, offset, dst) {
        // target is already initialised to 0 so we can xor directly into it
        for (let i = this.RAIDPARTS; i--;) {
            if (!buffers[i].skipped) {
                const buf = buffers[i].buffer;
                const ptr = offset + buffers[i].used;
                for (let p = this.RAIDSECTOR; p--;) {
                    target[dst + p] ^= buf[ptr + p];
                }
            }
        }
    };

    CloudRaidRequest.prototype.getInputBuffer = function (piecesPos, piecesLen, pieces) {

        let pos = piecesPos;
        let dataremaining = piecesLen * (this.RAIDPARTS - 1);
        const fileBuf = new Uint8Array(dataremaining);
        const datalines = piecesLen / this.RAIDSECTOR;

        for (let dataline = 0; dataline < datalines; ++dataline) {
            for (let i = 1; i < this.RAIDPARTS; i++) {
                const s = Math.min(dataremaining, this.RAIDSECTOR);
                if (s > 0 && pieces[i] !== null) {
                    const ptr = dataline * this.RAIDLINE + (i - 1) * this.RAIDSECTOR;

                    if (pieces[i].skipped) {
                        this.recoverFromParity(fileBuf, pieces, pos - piecesPos, ptr);
                    }
                    else {
                        const offset = pieces[i].used + pos - piecesPos;
                        const source = pieces[i].buffer.subarray(offset, offset + s);
                        fileBuf.set(source, ptr);
                    }
                    dataremaining -= s;
                }
            }
            pos += this.RAIDSECTOR;
        }
        return fileBuf;
    };

    CloudRaidRequest.prototype.combineSectors = function (piecesPos, piecesLen, pieces, eofexcess) {
        var skipFileBack = eofexcess;
        var skipFileFront = 0;

        var fileBuf = this.getInputBuffer(piecesPos, piecesLen, pieces);

        // chop off any excess data after the last dataline has been xor'd
        if (this.outputByteCount + fileBuf.byteLength - eofexcess >= (this.fileEndReadPos - this.fileStartPos)) {
            skipFileBack += this.fileEndReadPos - this.fileEndDeliverPos;
        }

        if (this.skipBeginningData > 0) {
            skipFileFront = this.skipBeginningData; // it's always less than one raidline
            this.skipBeginningData = 0;
        }

        var deliverByteLen = fileBuf.byteLength - skipFileBack - skipFileFront;
        var dataToDeliver = deliverByteLen === fileBuf.byteLength ? fileBuf
            : fileBuf.subarray(skipFileFront, deliverByteLen + skipFileFront);

        // fill in the buffer with the new full-file rows
        if (!this.response) {
            this.response = new Uint8Array(this.expectedBytes);
        }
        this.response.set(dataToDeliver, this.outputByteCount);

        this.outputByteCount += deliverByteLen;
        this.wholeFileDatalinePos += fileBuf.byteLength;

        // notify of progress anytime we construct rows of the original
        // file for smooth data rate display (and avoiding timeouts)
        if (this.outputByteCount && this.onprogress) {
            var progress = this.dispatchEvent.bind(this, 'progress', {
                lengthComputable: 1,
                total: this.expectedBytes,
                loaded: this.outputByteCount
            });
            delay(this.logger.name, progress, 190);
        }

        if (this.outputByteCount === this.expectedBytes) {

            this.finished = true;

            if (DEBUG_VERBOSE) {
                var channelPauseMs = 0;
                var channelPauseCount = 0;
                var ms = Math.max(1, performance.now() - this.startTime);

                for (var i = this.RAIDPARTS; i--;) {
                    channelPauseMs += this.part[i].channelPauseMillisec;
                    channelPauseCount += this.part[i].channelPauseCount;
                }

                this.logger.log("Chunk complete, %d bytes (Took %dms, %d bytes/sec) " +
                    "bandwidth efficiency: %f, total channel pauses: %d (%dms) - %d requests sent.",
                    this.outputByteCount, ms, this.outputByteCount * 1000 / ms,
                    this.outputByteCount / this.bytesProcessed, channelPauseCount, channelPauseMs, this.totalRequests);
            }

            onIdle(this.dispatchLoadEnd.bind(this, 200));
        }
    };

    CloudRaidRequest.prototype.discardUsedParts = function (piecesize) {
        // remove from the beginning of each part's list of received data
        for (var i = this.RAIDPARTS; i--;) {
            var n = piecesize;
            var fp = this.part[i].filePieces;
            while (n > 0 && fp.length > 0 && (fp[0].buffer.byteLength - fp[0].used <= n)) {
                n -= fp[0].buffer.byteLength - fp[0].used;
                fp.shift();
            }
            if (fp.length > 0) {
                fp[0].used += n;
            }
        }
    };

    CloudRaidRequest.prototype.queueReceivedPiece = function(partNum, piece) {

        this.part[partNum].filePieces.push(piece);

        while (1) {
            var i;
            var fp;
            var tocombine = [];
            var combinesize = 1 << 20;

            for (i = this.RAIDPARTS; i--;) {
                fp = this.part[i].filePieces;

                if (!fp.length) {
                    combinesize = 0;
                }
                else {
                    combinesize = Math.min(combinesize, fp[0].buffer.byteLength - fp[0].used);

                    if ((fp[0].partpos + fp[0].used)*5 != this.wholeFileDatalinePos) {
                        this.logger.error('ERROR: partpos dataline mismatch %s %s %s', (fp[0].partpos + fp[0].used), this.wholeFileDatalinePos, partNum);
                    }
                }
            }

            var fulllinesize = roundDownToMultiple(combinesize, this.RAIDSECTOR);
            var lastline = this.wholeFileDatalinePos >= roundDownToMultiple(this.fileEndReadPos, this.RAIDLINE);

            if (fulllinesize > 0) {

                for (i = 0; i < this.RAIDPARTS; ++i) {
                    tocombine.push(this.part[i].filePieces[0]);
                }

                this.combineSectors(this.wholeFileDatalinePos/5, fulllinesize, tocombine, 0);
                this.discardUsedParts(fulllinesize);
                continue;
            }
            else if (combinesize > 0 || lastline) {

                var part1len = 0;
                var part0len = 0;
                var totalsize = 0;

                for (i = 0; i < this.RAIDPARTS; ++i) {
                    var loaded = 0;
                    var b = new ArrayBuffer(this.RAIDSECTOR);

                    fp = this.part[i].filePieces;
                    for (var j = 0; loaded < this.RAIDSECTOR && j < fp.length; ++j) {
                        var toload = Math.min(fp[j].buffer.byteLength - fp[j].used, this.RAIDSECTOR - loaded);
                        var target = new Uint8Array(b, loaded, toload);
                        var source = fp[j].buffer.subarray(fp[j].used, fp[j].used + toload);
                        target.set(source);
                        loaded += toload;
                    }

                    if (i > 0) {
                        totalsize += loaded;
                    }
                    if (i === 0) {
                        part0len = loaded;
                    }
                    if (i === 1) {
                        part1len = loaded;
                    }

                    tocombine.push({
                        'used': 0,
                        'partpos': this.wholeFileDatalinePos/5,
                        'skipped': !fp.length ? false : fp[0].skipped,
                        'buffer': new Uint8Array(b, 0, this.RAIDSECTOR)
                    });
                }

                if (part1len === part0len && (totalsize === this.RAIDLINE || totalsize === this.fileEndReadPos - this.wholeFileDatalinePos)) {
                    this.combineSectors(
                        this.wholeFileDatalinePos/5, this.RAIDSECTOR, tocombine,
                        (totalsize === this.RAIDLINE) ? 0 : this.RAIDLINE - totalsize
                    );
                    this.discardUsedParts(this.RAIDSECTOR);
                    continue;
                }
            }
            break;
        }
        this.checkReadParts();
    };

    CloudRaidRequest.prototype.checkReadParts = function() {
        var i;
        var part;
        var torequest = [];

        for (i = this.RAIDPARTS; i--;) {
            part = this.part[i];

            if (part.reader && !part.reading && !part.done && (part.pos < this.wholeFileDatalinePos/5 + 81920)) {
                torequest.push(part);
            }
        }

        // read from the most-behind socket first
        torequest.sort(function(a, b) {
            return a.pos - b.pos;
        });

        for (i = 0; i < torequest.length; i++) {
            part = torequest[i];

            if (DEBUG_VERBOSE) {
                this.logger.debug("part %s reading again from %s", part.partNum, part.pos);
            }
            this.readFetchData(part.partNum);
        }
    };

    CloudRaidRequest.prototype.loadPart = function(partNum, pos, endpos, skipchunkcount) {
        const part = this.part[partNum];

        this._loadPart(part, pos, endpos, skipchunkcount)
            .catch((ex) => {
                part.reading = false;
                this.fetchReadExceptionHandler(ex, partNum);
            });
    };

    CloudRaidRequest.prototype._loadPart = async function(part, pos, endpos, skipchunkcount) {
        const {partNum, baseUrl} = part;

        if (pos >= endpos) {
            // put one more 0-size piece on the end, which makes it easy to rebuild the last raidline of the file
            if (!this.finished) {
                this.queueReceivedPiece(partNum, {
                    'skipped': false,
                    'used': 0,
                    'partpos': pos,
                    'buffer': new Uint8Array(0)
                });
                part.done = true;
            }
            return;
        }

        const chunksize = endpos - pos;

        // -1 indicates no skipping, load all data.
        // -2 indicates skipping all which is used when one channel has had a failure
        // -3 indicates we are starting a new download, and the slowest connection to respond should be discarded.
        if (skipchunkcount === -2) {
            // skip this chunk, the other 5 channels will load the corresponding parts and we can xor to reassemble
            // fill in the buffer with an empty array to keep the algo simple
            var filePiece = {
                'used': 0,
                'partpos': pos,
                'skipped': true,
                'buffer': new Uint8Array(chunksize)
            };
            const lastPos = pos + chunksize;
            this.part[partNum].lastPos = lastPos;
            this.queueReceivedPiece(partNum, filePiece);
            return this._loadPart(part, lastPos, endpos, skipchunkcount);
        }

        const pieceUrl = `${baseUrl}/${pos}-${pos + chunksize - 1}`;

        if (DEBUG_VERBOSE) {
            this.logger.log("Part %s pos: %s chunksize: %s from: %s", partNum, pos, chunksize, pieceUrl);
        }

        this.totalRequests++;

        // Execute the fetch, with continuation functions for each buffer piece that arrives
        part.abortController = new AbortController();
        part.signal = part.abortController.signal;
        part.timedout = false;
        part.pos = pos;
        part.endpos = endpos;
        part.skipchunkcount = skipchunkcount;

        part.reading = true;
        return fetch(pieceUrl, {signal: part.signal})
            .then((response) => {
                part.reading = false;
                return this.processFetchResponse(partNum, response);
            });
    };

    CloudRaidRequest.prototype.processFetchResponse = function(partNum, fetchResponse) {

        if (this.readyState < XMLHttpRequest.HEADERS_RECEIVED) {
            this.status = fetchResponse.status | 0;
            this.dispatchEvent('readystatechange', XMLHttpRequest.HEADERS_RECEIVED);
            this.dispatchEvent('readystatechange', XMLHttpRequest.LOADING);
        }

        if (fetchResponse.status !== 200) {
            if (DEBUG) {
                this.logger.error("response status: %s %s", fetchResponse.status, fetchResponse.ok);
            }
            this.onPartFailure(partNum, fetchResponse.status);
            return;
        }

        // Check whether we need to drop the slowest channel/connection.
        if (this.part[partNum].skipchunkcount === -3 && this.channelReplyState !== 63) {
            var mia = -1;

            this.channelReplyState |= (1 << partNum);

            if (DEBUG) {
                this.logger.debug("received reply on: %s bitfield now: %s", partNum, this.channelReplyState);
            }

            for (var i = this.RAIDPARTS; i--;) {
                if ((this.channelReplyState | (1 << i)) === 63) {
                    mia = i;
                }
            }

            if (mia !== -1) {
                if (DEBUG) {
                    this.logger.info("All channels but %s are working, closing channel %s.", mia, mia);
                }
                this.cloudRaidSettings.lastFailedChannel = mia;

                this.part[mia].abort();
                this.channelReplyState = 63;
                this.initialChannelMode = mia;

                // all channels start at the same pos, and if skipchunkcount === -3 then this is
                // the first chunk for all, so that one can generate dummy data from 'pos'.
                this.loadPart(mia, this.part[mia].pos, this.part[mia].endpos, -2);
            }
        }

        // stream the reply body
        const part = this.part[partNum];
        part.reader = fetchResponse.body.getReader();
        return this._readFetchData(part);
    };

    CloudRaidRequest.prototype.readFetchData = function(partNum) {
        const part = this.part[partNum];

        this._readFetchData(part)
            .catch((ex) => {
                part.reading = false;
                this.fetchReadExceptionHandler(ex, partNum);
            });
    };

    CloudRaidRequest.prototype._readFetchData = async function(part) {

        part.timedout = false;
        part.readTimeoutId = setTimeout(() => {
            part.timedout = true;

            if (part.abortController) {
                tryCatch(() => part.abortController.abort())();
            }
        }, this.FETCH_DATA_TIMEOUT_MS);

        part.reading = true;
        return part.reader.read()
            .then((r) => {
                part.reading = false;
                this.processFetchData(part.partNum, r.done, r.value);
            });
    };

    CloudRaidRequest.prototype.processFetchData = function(partNum, done, value) {

        var part = this.part[partNum];
        clearTimeout(part.readTimeoutId);
        part.readTimeoutId = null;

        if (done) {
            this.loadPart(partNum, part.pos, part.endpos, part.skipchunkcount);
            return;
        }

        if (DEBUG_TRACE) {
            this.logger.debug("Received data on part %s: %s bytes", partNum, value.byteLength);
        }

        var filePiece = {
            'skipped': false,
            'used': 0,
            'partpos': part.pos,
            'buffer': value
        };

        part.pos += value.length;

        this.bytesProcessed += value.length;
        part.lastPos = part.pos;

        if (part.failCount > 0) {
            part.failCount = 0;
            if (DEBUG_TRACE) {
                this.logger.debug("Reset fail count on part %s.", partNum,
                    this.part[0].failCount, this.part[1].failCount, this.part[2].failCount,
                    this.part[3].failCount, this.part[4].failCount, this.part[5].failCount);
            }
        }

        this.queueReceivedPiece(partNum, filePiece);
    };

    CloudRaidRequest.prototype.fetchReadExceptionHandler = function (ex, partNum) {

        var part = this.part[partNum];

        if (part.readTimeoutId !== null) {
            clearTimeout(part.readTimeoutId);
            part.readTimeoutId = null;
        }

        if (ex.name === 'AbortError') {
            if (this.highlevelabort) {
                this.logger.debug("Part %s exiting...", partNum);
            }
            else if (part.timedout) {
                this.cloudRaidSettings.timeouts += 1;
                // switch to the currently idle channel instead, and pick up from there.
                if (DEBUG) {
                    this.logger.warn("Timeout on part %s", partNum);
                }
                this.onPartFailure(partNum, 408);
                part.timedout = false;
            }
            else if (DEBUG) {
                this.logger.debug('Fetch on %s would have been the slowest (or failed).', partNum);
            }
        }
        else {
            if (DEBUG) {
                this.logger.warn("Caught exception from fetch on part: %s", partNum, ex);
            }
            this.onPartFailure(partNum, 409);
        }
    };

    Object.freeze(CloudRaidRequest.prototype);
    Object.defineProperty(global, 'CloudRaidRequest', {value: Object.freeze(CloudRaidRequest)});

})(self);

/**
 * global MegaData instance
 * @name M
 */
var M = null;
var dlid = false;
var dlkey = false;
var cn_url = false;
var init_l = true;
var pfkey = false;
var pfcol = false;
var pfid = false;
var pfhandle = false;
var n_h = false;
var u_n = false;
var n_k_aes = false;
var fmdirid = false;
var u_type, cur_page, u_checked;
var confirmcode = false;
var confirmok = false;
var hash = window.location.hash;
var chrome_msg = false;
var init_anoupload = false;
var pwchangecode = false;
var resetpwcode = false;
var resetpwemail = '';
var mobileparsed = false;
var mobilekeygen = false;
var subdirid = false;
var subsubdirid = false;
var unread;
var account = false;
var register_txt = false;
var login_next = false;
var loggedout = false;
var flhashchange = false;
var avatars = Object.create(null);
var mega_title = 'MEGA';

var pro_json = '[[["N02zLAiWqRU",1,500,1024,1,"9.99","EUR"],["zqdkqTtOtGc",1,500,1024,12,"99.99","EUR"],["j-r9sea9qW4",2,2048,4096,1,"19.99","EUR"],["990PKO93JQU",2,2048,4096,12,"199.99","EUR"],["bG-i_SoVUd0",3,4096,8182,1,"29.99","EUR"],["e4dkakbTRWQ",3,4096,8182,12,"299.99","EUR"]]]';

pages.placeholder = '<div class="bottom-page scroll-block placeholder selectable-txt">' +
    '((TOP))' +
    '<div class="main-pad-block">' +
    '<div class="main-mid-pad new-bottom-pages"></div>' +
    '</div>';

mBroadcaster.once('startMega', function() {
    'use strict';

    if (pages['dialogs-common']) {
        $('body').safeAppend(translate(pages['dialogs-common'].replace(/{staticpath}/g, staticpath)));
        delete pages['dialogs-common'];
    }

    // Set class if gbot
    if (is_bot) {
        document.documentElement.classList.add('gbot');
    }
    else {
        document.documentElement.classList.remove('gbot');
    }

    // Add language class to body for CSS fixes for specific language strings
    document.body.classList.add(lang);

    if (({'fa': 1,'ar': 1,'he': 1})[lang]) {
        document.body.classList.add('rtl');
    }

    if (is_mobile) {

        const usingMobPages = ['placeholder', 'register', 'key', 'support', 'keybackup',
                               'disputenotice', 'download', 'reset', 'propay', 'login'];

        for (let i = usingMobPages.length; i--;) {

            delete pages[usingMobPages[i]];
            jsl_loaded[usingMobPages[i]] = 1;
        }

        pages = new Proxy(pages, {
            get(target, prop) {
                if (target[prop] === undefined) {
                    if (d) {
                        console.info(`[proxy] providing 'mobile' page for '${prop}'`);
                    }
                    return target.mobile || '';
                }
                return target[prop] || '';
            }
        });
    }
});

mBroadcaster.once('startMega:desktop', function() {
    'use strict';

    var $body = $('body');
    var p = ['chat', 'onboarding', 'dialogs'];

    for (var i = p.length; i--;) {
        if (typeof pages[p[i]] === 'string') {
            $body.safeAppend(translate(pages[p[i]].replace(/{staticpath}/g, staticpath)));
            delete pages[p[i]];
        }
    }
});

function startMega() {
    'use strict';

    jsl = [];
    mBroadcaster.sendMessage('startMega');

    if (is_mobile) {
        mBroadcaster.sendMessage('startMega:mobile');
        mBroadcaster.removeListeners('startMega:desktop');
    }
    else {
        mBroadcaster.sendMessage('startMega:desktop');
        mBroadcaster.removeListeners('startMega:mobile');
    }

    if (silent_loading) {
        loadingDialog.hide('jsl-loader');
        onIdle(silent_loading);
        silent_loading = false;
    }
    else {
        init_page();
    }
}

function topMenu(close) {
    'use strict';

    let $currentContainer;
    const fmholder = document.getElementById('fmholder');

    // If #startholder is visible, #fmholder is not
    if (fmholder.classList.contains('hidden') || fmholder.style.display === 'none') {
        $currentContainer = $('#startholder');
    }
    else {
        $currentContainer = $(fmholder);
    }

    var $topMenuBtn = $('.js-more-menu', $currentContainer);
    var $topMenu = $('.top-menu-popup', $currentContainer);
    var $scrollBlock = $('.top-menu-scroll', $topMenu);
    var $mobileOverlay = $('.mobile.dark-overlay', 'body');

    if (close) {
        $.topMenu = '';
        $topMenuBtn.removeClass('menu-open');

        $topMenu.addClass('o-hidden');

        // If on mobile, hide the menu and also remove the close click/tap handler on the dark background overlay
        if (is_mobile) {
            $('html').removeClass('overlayed');
            $mobileOverlay.addClass('hidden').removeClass('active').unbind('tap.topmenu');
        }
        $(window).off('resize.topmenu');
        if (M.chat && megaChatIsReady) {
            megaChat.plugins.chatOnboarding.checkAndShowStep();
        }
    }
    else {
        $.topMenu = 'topmenu';
        $topMenuBtn.addClass('menu-open');
        $topMenu.removeClass('o-hidden');

        if (M.chat && $.dialog === 'onboardingDialog') {
            closeDialog();
        }

        if (u_type) {
            const $menuAvatar = $('.avatar-block', $topMenu);
            if (!$menuAvatar.hasClass('rendered')) {
                $menuAvatar.addClass('rendered');
                $('.wrapper', $menuAvatar).safeHTML(useravatar.contact(u_handle));
            }

            $('.top-menu-logged .loader', $topMenu).addClass('loading');

            Promise.resolve(M.storageQuotaCache || M.getStorageQuota())
                .then((data) => {

                    topMenuDataUpdate(data);

                    if (fminitialized && !folderlink && M.currentTreeType === 'cloud-drive') {

                        return M.checkLeftStorageBlock(data);
                    }
                })
                .catch(dump);
        }

        if (!is_mobile) {
            topMenuScroll($scrollBlock);
        }
        else {

            // Show the dark backround overlay behind the menu and if it's clicked, close the menu
            $('html').addClass('overlayed');
            $mobileOverlay.removeClass('hidden').addClass('active').rebind('tap.topmenu', function() {
                topMenu(true);
                return false;
            });
        }
    }
}

/* Update used storage info*/
function topMenuDataUpdate(data) {
    'use strict';

    var storageHtml;
    var $storageBlock = $('.top-menu-logged', '.top-menu-popup').removeClass('going-out exceeded');
    var space_used = bytesToSize(data.used);
    var space = bytesToSize(data.max, 0);
    var perc = data.percent;

    if (perc >= 100) {
        $storageBlock.addClass('exceeded');
    }
    else if (perc >= data.uslw / 100) {
        $storageBlock.addClass('going-out');
    }

    // Show only space_used for Business and Pro Flexi accounts
    if (u_attr && (u_attr.b || u_attr.pf)) {
        storageHtml = '<span>' +  space_used + '</span>';
    }
    else {
        storageHtml = l[1607].replace('%1', '<span>' +  space_used + '</span>')
            .replace('%2', space);
    }

    $('.loader', $storageBlock).removeClass('loading');
    $('.storage-txt', $storageBlock).safeHTML(storageHtml);
    const $storageBar = $('.storage', $storageBlock);

    if (u_attr && !u_attr.pf) {
        $('span', $storageBar).outerWidth(perc + '%');
        $storageBar.removeClass('hidden');
    }
    else {
        $storageBar.addClass('hidden');
    }
}

function topMenuScroll($scrollBlock) {
    "use strict";

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

function scrollMenu() {
    "use strict";

    $('.bottom-pages .fmholder').rebind('scroll.devmenu', function() {
        if (page === 'doc' || page.substr(0, 9) === 'corporate' || page === 'sdk' || page === 'dev') {
            var $menu = $('.new-left-menu-block');
            var topPos = $(this).scrollTop();
            if (topPos > 0) {
                if (topPos + $menu.outerHeight() + 106 <= $('.main-mid-pad').outerHeight()) {
                    $menu.css('top', topPos + 50 + 'px').addClass('floating');
                }
                else {
                    $menu.removeClass('floating');
                }
            }
            else {
                $menu.removeAttr('style');
            }
        }
    });
}

function topPopupAlign(button, popup, topPos) {
    'use strict';

    const popupAlign = () => {
        var $button = $(button),
            $popup = $(popup),
            $popupArrow = $popup.children('.dropdown-white-arrow'),
            pageWidth,
            popupLeftPos,
            arrowLeftPos,
            buttonTopPos,
            headerWidth;

        if ($button.length && $popup.length) {
            pageWidth = $('body').outerWidth();
            headerWidth = $('.top-head').outerWidth();
            $popup.removeAttr('style');
            $popupArrow.removeAttr('style');
            popupLeftPos = $button.offset().left
                + $button.outerWidth() / 2
                - $popup.outerWidth() / 2;
            if (topPos) {
                $popup.css('top', topPos + 'px');
            }
            else {
                buttonTopPos = $button.offset().top + $button.outerHeight();
                $popup.css('top', buttonTopPos + 13 + 'px');
            }

            if (popupLeftPos > 10) {
                if (popupLeftPos + $popup.outerWidth() + 10 > pageWidth) {
                    $popup.css({
                        left: 'auto',
                        right: '10px'
                    });
                    $popupArrow.css(
                        'left', $button.offset().left - $button.outerWidth() / 2
                    );
                }
                else {
                    $popup.css('left', popupLeftPos + 'px');
                }
            }
            else {
                $popup.css('left', '10px');
                arrowLeftPos = $button.offset().left
                    - $button.outerWidth() / 2;
                $popupArrow.css({
                    left: arrowLeftPos + 22
                })
            }
        }
    };

    // If top menu is opened - set timeout to count correct positions
    if (!$('.top-menu-popup').hasClass('o-hidden') || $('body').hasClass('hidden')) {

        tSleep(0.2).then(() => requestAnimationFrame(popupAlign));
    }
    else {
        requestAnimationFrame(popupAlign);
    }
}

function init_page() {
    page = String(page || (u_type ? 'fm' : 'start'));

    if (!window.M || is_megadrop) {
        return console.warn('Something went wrong, the initialization did not completed...');
    }

    if (mega.ensureAccessibility) {
        if (mega.ensureAccessibility() !== 'accessible') {
            console.error('Unable to ensure accessibility...');
            return false;
        }
        delete mega.ensureAccessibility;
    }

    // If they are transferring from mega.co.nz
    if (page.substr(0, 13) == 'sitetransfer!') {

        // If false, then the page is changing hash URL so don't continue past here
        if (M.transferFromMegaCoNz() === false) {
            return false;
        }
    }

    // Users that logged in and are suspended (requiring special SMS unlock) are not allowed to go anywhere else in the
    // site until they validate their account. So if they clicked the browser back button, then they should get logged
    // out or they will end up with with a partially logged in account stuck in an infinite loop. This logout is not
    // triggered on the mobile web sms/ pages because a session is still required to talk with the API to get unlocked.
    if (window.doUnloadLogOut) {
        return false;
    }

    dlkey = false;

    var pageBeginLetters = page.substr(0, 2);

    if (page.length > 2 && (page[0] === '!' || pageBeginLetters === 'F!')) {
        // Convering old links to new links format.
        page = page[0] === 'F' ? page.replace('F!', 'folder/').replace('!', '#')
            .replace('!', '/folder/').replace('?', '/file/')
            : page.replace('!', 'file/').replace('!', '#');

        history.replaceState({ subpage: page }, "", (hashLogic ? '#' : '/') + page);
        return init_page();
    }

    if (page.substr(0, 5) === 'file/') {
        dlid = page.substr(5, 8).replace(/[^\w-]+/g, '');
        dlkey = page.substr(14).replace(/[^\w-].+$/, '');

        if (M.hasPendingTransfers() && $.lastSeenFilelink !== getSitePath()) {
            page = 'download';

            M.abortTransfers().then(() => location.reload()).catch(() => loadSubPage($.lastSeenFilelink));
            return;
        }
        $.lastSeenFilelink = getSitePath();
    }

    // Rmove business class to affect the top header
    // Remove bottom-page class and old class
    // Remove pro class when user come back from pro page
    document.body.classList.remove('business', 'bottom-pages', 'old', 'pro', 'mega-lite-mode');

    // Add mega-lite-mode class to hide/show various elements in MEGA Lite mode
    if (mega.lite.inLiteMode) {
        document.body.classList.add('mega-lite-mode');
    }

    // Redirect url to extensions when it tries to go plugin or chrome or firefox
    if (page === 'plugin') {
        mega.redirect('mega.io', 'extensions', false, false);
        return false;
    }

    if (page === "fm/contacts") {
        // force replace of page history, so that back won't cause the user to go back to an empty fm/contacts
        loadSubPage("/fm/chat/contacts");
        return false;
    }
    if (page === "fm/ipc") {
        if (u_type) {
            return loadSubPage("/fm/chat/contacts/received");
        }
        login_next = '/fm/chat/contacts/received';
        return loadSubPage('/login');
    }
    if (page === "fm/opc") {
        return loadSubPage("/fm/chat/contacts/sent");
    }

    $('#loading').hide();
    if (window.loadingDialog) {
        loadingDialog.hide('force');
    }

    if (is_chatlink || page.substr(0, 5) === 'chat/') {
        if (fminitialized && megaChatIsReady) {
            // tried to navigate internally to a chat link, do a force redirect.
            // Can be triggered by the back button.
            assert(
                megaChat.initialChatId,
                'missing .initialChatId, did this page initialized from a standalone chat/meeting link?'
            );
            loadSubPage(`fm/chat/c/${megaChat.initialChatId}`);
            return false;
        }

        page = page.slice(0, 36);
        const [publicChatHandle, publicChatKey] = page.replace('chat/', '').split('#');
        if (!publicChatHandle || publicChatHandle.length !== 8 || !publicChatKey || publicChatKey.length !== 22) {
            return u_type
                ? loadSubPage('fm/chat')
                : mega.redirect('mega.io', 'chatandmeetings', false, false);
        }

        if (typeof is_chatlink !== 'object') {
            is_chatlink = Object.create(null);
        }

        Object.defineProperties(is_chatlink, {
            ph: { value: publicChatHandle },
            key: { value: publicChatKey },
            pnh: {
                get: function() {
                    return this.url && this.ph;
                }
            }
        });

        M.chat = true;
        if (!u_handle) {
            assert(!u_type);
            u_handle = "AAAAAAAAAAA";
        }

        parsepage(pages.chatlink);


        const init = () => {
            init_chat(0x104DF11E5)
                .then(() => megaChat.renderListing(page, true))
                .then(() => megaChat.renderMyStatus())
                .then(() => {
                    document.querySelector('.chat-links-preview .chat-links-logo-header a.logo')
                        .addEventListener('click', () => {
                            is_chatlink = false;
                            delete megaChat.initialPubChatHandle;
                            delete M.currentdirid;
                            megaChat.destroy();
                            if (u_type) {
                                loadSubPage("fm");
                            }
                            else {
                                loadSubPage("start");
                            }
                        });

                    $(`.chat-links-preview${is_mobile ? '.mobile' : '.section'}`).removeClass('hidden');
                })
                .dump('init_chat');
        };

        // Authring (user's keys) are required to be loaded before the chat is, otherwise strongvelope would init
        // with undefined pub keys
        if (u_type) {
            // show loading
            for (const node of document.querySelectorAll(
                '.section.chat-links-preview, .section.chat-links-preview .fm-chat-is-loading'
            )) {
                node.classList.remove('hidden');
            }

            // init authring -> init chat
            authring.onAuthringReady()
                .then(init, (ex) => {
                    console.error("Failed to initialize authring:", ex);
                });
        }
        else {
            init();
        }

        mega.ui.setTheme();

        return;
    }
    is_chatlink = false;

    var oldPFKey = pfkey;

    // contact link handling...
    if (pageBeginLetters === 'C!' && page.length > 2) {
        var ctLink = page.substring(2, page.length);
        if (!is_mobile) {
            if (!u_type) {
                parsepage(pages.placeholder);
                openContactInfoLink(ctLink);
                return;
            }
            else {
                page = 'fm/chat/contacts';
                mBroadcaster.once('fm:initialized', function() {
                    openContactInfoLink(ctLink);
                });
            }
        }
        else {
            var processContactLink = function() {
                if (!mega.ui.contactLinkCardDialog) {
                    var contactLinkCardHtml = pages['mobile-add-contact-card'];
                    if (contactLinkCardHtml) {
                        mega.ui.contactLinkCardDialog = contactLinkCardHtml;
                    }
                }
                var contactInfoCard = new MobileContactLink(ctLink);
                contactInfoCard.showContactLinkInfo();
            };
            if (!u_type) {
                parsepage(pages.placeholder);
                processContactLink();
                return;
            }
            else {
                loadSubPage('fm');
                M.onFileManagerReady(processContactLink);
                return;
            }
        }
    }

    var newLinkSelector = '';
    if (page.startsWith('folder/') || page.startsWith('collection/')) {
        const pos = page.indexOf('/') + 1;
        let phLen = page.indexOf('#');
        let possibleS = -1;

        if (phLen < 0) {
            phLen = page.length;

            possibleS = page.indexOf('/f', pos);
            if (possibleS > -1) {
                phLen = possibleS;
            }
        }

        pfid = page.substr(pos, phLen - pos).replace(/[^\w-]+/g, "");

        // check if we have key
        pfkey = false;
        pfhandle = false;
        pfcol = page.startsWith('collection/');

        if (page.length - phLen > 2) {
            if (possibleS === -1) {
                phLen++;
            }
            const [linkRemaining] = page.substr(phLen, page.length - phLen).split('?');
            var fileSelectorPlace = linkRemaining.indexOf('/file/');
            var folderSelectorPlace = linkRemaining.indexOf('/folder/');
            var selectorIsValid = false;

            if (fileSelectorPlace > -1 || folderSelectorPlace > -1) {
                selectorIsValid = true;
            }

            if (selectorIsValid && fileSelectorPlace > -1 && folderSelectorPlace > -1) {
                selectorIsValid = false;
            }

            var keyCutPlace;
            if (selectorIsValid) {
                if (fileSelectorPlace > -1) {
                    keyCutPlace = fileSelectorPlace;

                    if (linkRemaining.length - 6 - fileSelectorPlace > 2) {
                        $.autoSelectNode = linkRemaining.substring(fileSelectorPlace + 6, linkRemaining.length);
                        $.autoSelectNode = $.autoSelectNode.replace(/[^\w-]+/g, "");
                    }
                }
                else {
                    keyCutPlace = folderSelectorPlace;

                    if (linkRemaining.length - 8 - folderSelectorPlace > 2) {
                        pfhandle = linkRemaining.substring(folderSelectorPlace + 8, linkRemaining.length);
                        pfhandle = pfhandle.replace(/[^\w-]+/g, "");
                        newLinkSelector = '/folder/' + pfhandle;
                    }

                }
            }
            else {
                keyCutPlace = Math.min(fileSelectorPlace, folderSelectorPlace);
                if (keyCutPlace === -1) {
                    keyCutPlace = linkRemaining.length;
                }
            }
            pfkey = linkRemaining.substring(0, keyCutPlace).replace(/[^\w-]+/g, "").slice(0, 22) || false;
        }

        n_h = pfid;
        if (!flhashchange || pfkey !== oldPFKey || pfkey.length !== 22 || pfid.length !== 8) {
            closeDialog();

            const data = JSON.stringify([
                1,
                !oldPFKey | 0, !!flhashchange | 0, (pfkey !== oldPFKey) | 0,
                pfkey.length | 0, pfid.length | 0, window[`preflight-folder-link-error:${pfid}`] | 0
            ]);
            eventlog(pfcol ? is_mobile ? 99911 : 99910 : is_mobile ? 99631 : 99632, data, true);

            if (pfid.length !== 8 || window['preflight-folder-link-error:' + pfid]) {
                folderreqerr(false, window['preflight-folder-link-error:' + pfid] || EARGS);
                return false;
            }

            if (pfkey.length === 22) {
                api_setfolder(n_h);
                waitsc.poke();
                u_n = pfid;
            }
            else {
                // Insert placeholder background page while waiting for user input
                parsepage(pages.placeholder);

                // Let's apply theme for this dialog
                mega.ui.setTheme();
                onIdle(topmenuUI);

                // Show the decryption key dialog on top
                mKeyDialog(pfid, true, pfkey, newLinkSelector)
                    .catch(() => {
                        loadSubPage('start');
                    });

                pfkey = false;
                return false;
            }

            if (fminitialized && (!folderlink || pfkey !== oldPFKey)) {
                // Clean up internal state in case we're navigating back to a folderlink
                M.currentdirid = M.RootID = M.currentCustomView = undefined;
                delete $.onImportCopyNodes;
                delete $.mcImport;
                delete $.albumImport;
            }
        }

        if (pfhandle) {
            page = 'fm/' + pfhandle;
        }
        else {
            page = 'fm';
        }
    }
    else if (!flhashchange || page !== 'fm/transfers') {
        if (pfcol) {
            pfcol = false;
            mega.gallery.albums.disposeAll();
            mega.gallery.removeDbActionCache();
            mega.gallery.albumsRendered = false;
        }
        n_h = false;
        u_n = false;
        pfkey = false;
        pfid = false;
        pfhandle = false;
    }
    confirmcode = false;
    pwchangecode = false;

    if (pageBeginLetters.toLowerCase() === 'n!') {
        return invalidLinkError();
    }

    if (page.substr(0, 7) === 'confirm') {
        confirmcode = page.replace("confirm", "");
        page = 'confirm';
    }

    if (page.substr(0, 7) == 'pwreset') {
        resetpwcode = page.replace("pwreset", "");
        page = 'resetpassword';
    }

    // If password revert link, use generic background page, show the dialog and pass in the code
    if (page.substr(0, 8) === 'pwrevert') {
        parsepage(pages.placeholder);
        passwordRevert.init(page);

        // Make sure placeholder background is shown
        return false;
    }

    if ((pfkey && !flhashchange || dlkey) && !location.hash) {
        return location.replace(getAppBaseUrl());
    }

    if (!$.mcImport && $.dialog !== 'cookies-dialog' && typeof closeDialog === 'function') {
        closeDialog();
    }

    // Pages that can be viewed while being logged in and registered but not yet email confirmed
    if ((page.substr(0, 1) !== '!')
        && (page.substr(0, 3) !== 'pro')
        && (page.substr(0, 5) !== 'start' || is_fm())
        && (page.substr(0, 13) !== 'discountpromo') // Discount Promo with regular discount code on the end
        && (page.substr(0, 2) !== 's/')       // Discount Promo short URL e.g. /s/blackfriday
        && (page.substr(0, 8) !== 'payment-') // Payment URLs e.g. /payment-ecp-success, /payment-sabadell-failure etc
        && (page !== 'refer')
        && (page !== 'contact')
        && (page !== 'mobileapp')
        && (page !== 'nas')
        && (page !== 'extensions')
        && (page !== 'chrome')
        && (page !== 'firefox')
        && (page !== 'edge')
        && (page !== 'desktop')
        && (page !== 'sync')
        && (page !== 'cmd')
        && (page !== 'terms')
        && (page !== 'privacy')
        && (page !== 'gdpr')
        && (page !== 'takendown')
        && (page !== 'resellers')
        && (page !== 'security')
        && (page !== 'storage')
        && (page !== 'objectstorage')
        && (page !== 'megabackup')
        && (page !== 'collaboration')
        && (page !== 'securechat')
        && (page !== 'unsub')
        && (page !== 'cookie')
        && (page.indexOf('file/') === -1)
        && (page.indexOf('folder/') === -1)
        && !page.startsWith('collection/')
        && localStorage.awaitingConfirmationAccount) {

        var acc = JSON.parse(localStorage.awaitingConfirmationAccount);

        // if visiting a #confirm link, or they confirmed it elsewhere.
        if (confirmcode || u_type > 1) {
            delete localStorage.awaitingConfirmationAccount;
        }
        else {
            parsepage(pages.placeholder);

            // Show signup link dialog for mobile
            if (is_mobile) {
                mobile.register.showConfirmEmailScreen(acc);
                return false;
            }
            else {
                // Insert placeholder page while waiting for user input
                return mega.ui.sendSignupLinkDialog(acc, function () {
                    // The user clicked 'close', abort and start over...
                    delete localStorage.awaitingConfirmationAccount;
                    init_page();
                });
            }
        }
    }

    // If the account has just finished being cancelled
    if (localStorage.beingAccountCancellation) {
        // Insert placeholder page while waiting for user input
        parsepage(pages.placeholder);

        // Show message that the account has been cancelled successfully
        msgDialog('warninga', l[6188], l[6189], '', loadSubPage.bind(null, 'start'));

        delete localStorage.beingAccountCancellation;
        return false;
    }

    if (page.substr(0, 2) === 'P!' && page.length > 2) {
        // Password protected link decryption dialog
        parsepage(pages.placeholder);

        if (is_mobile) {
            mobile.passwordDecryption.show(page);
        }
        else {
            exportPassword.decrypt.init(page);
        }

        // lets set them for the dialog.
        mega.ui.setTheme();
    }
    else if (page.substr(0, 4) === 'blog') {
        window.location.replace('https://blog.mega.io');
    }
    else if (page.substr(0, 6) == 'verify') {
        if (is_mobile) {
            mobile.settings.account.verifyEmail.init();
        }
        else {
            parsepage(pages.change_email);
            emailchange.main();
        }
    }
    else if (page === 'corporate/reviews') {
        window.location.replace('/login');  // Page removed
    }
    else if (page.substr(0, 9) === 'corporate') {
        mega.redirect('mega.io', 'media', false, false);
    }
    // If user has been invited to join MEGA and they are not already registered
    else if (page.substr(0, 9) == 'newsignup') {

        // Get the email and hash checksum from after the #newsignup tag
        var emailAndHash = page.substr(9);
        var emailAndHashDecoded = base64urldecode(emailAndHash);

        // Separate the email and checksum portions
        var endOfEmailPosition = emailAndHashDecoded.length - 8;
        var email = emailAndHashDecoded.substring(0, endOfEmailPosition);
        var hashChecksum = emailAndHashDecoded.substring(endOfEmailPosition);

        // Hash the email address
        var hashBytes = asmCrypto.SHA512.bytes(email);

        // Convert the first 8 bytes of the email to a Latin1 string for comparison
        var byteString = '';
        for (var i = 0; i < 8; i++) {
            byteString += String.fromCharCode(parseInt(hashBytes[i]));
        }

        // Unset registration email
        localStorage.removeItem('registeremail');

        // If the checksum matches, redirect to #register page
        if (hashChecksum === byteString) {

            // Store in the localstorage as this gets pre-populated into the register form
            localStorage.registeremail = email;

            // Redirect to the register page
            loadSubPage('register');
        }
        else {
            // Redirect to the register page
            loadSubPage('register');

            // Show message
            alert('We can\'t decipher your invite link, please check you copied the link correctly, or sign up manually with the same email address.');
        }
    }
    else if (page.length > 14 && page.substr(0, 14) === 'businesssignup') {
        if (is_mobile) {
            parsepage(pages.mobile);
            mega.ui.setTheme();
            mobile.passwordDecryption.show();
        }
        else {
            var signupCodeEncrypted = page.substring(14, page.length);
            M.require('businessAcc_js', 'businessAccUI_js').done(function () {
                var business = new BusinessAccountUI();
                business.showLinkPasswordDialog(signupCodeEncrypted);
            });
        }

    }
    else if (page.length > 14 && page.substr(0, 14) === 'businessinvite') {
        if (is_mobile) {
            parsepage(pages.mobile);
        }
        var signupCode = page.substring(14, page.length);
        M.require('businessAcc_js', 'businessAccUI_js').done(function () {
            var business = new BusinessAccountUI();
            business.openInvitationLink(signupCode);
        });
    }
    else if (page === 'confirm') {

        loadingDialog.show();
        security.register.verifyEmailConfirmCode(confirmcode)
            .then(({email}) => {

                page = 'login';
                confirmok = true;
                parsepage(pages.login);
                onIdle(topmenuUI);

                if (is_mobile) {
                    mobile.register.showConfirmAccountScreen(email);
                }
                else {
                    login_txt = l[378];
                    init_login();

                    if (email) {
                        $('#login-name2').val(email).blur();
                        $('.register-st2-button').addClass('active');
                        $('#login-name2').prop('readonly', true);
                    }
                }
            })
            .catch((ex) => {
                if (ex === EROLLEDBACK) {
                    return;
                }

                page = 'login';
                parsepage(pages.login);

                if (is_mobile) {
                    mobile.register.showConfirmAccountFailure(ex);
                }
                else {
                    login_txt = ex === ENOENT ? l[19788] : String(ex).includes(l[703]) && l[703] || `${l[705]} ${ex}`;

                    init_login();
                    topmenuUI();
                }
            })
            .finally(() => {
                loadingDialog.hide();
            });
    }
    else if (page.startsWith('emailverify')) {
        return security.showVerifyEmailDialog('login-to-account');
    }
    else if (u_type == 2) {
        parsepage(pages.key);
        if (is_mobile) {
            mobile.register.showGeneratingKeysScreen();
        }
        init_key();
    }
    else if (page == 'login') {
        if (u_storage.sid) {
            loadSubPage('fm');
            return false;
        }
        if (window.nextPage) {
            login_next = window.nextPage;
            login_txt =  login_next === 'support' ? l.support_redirect_login : l[24766];
            delete window.nextPage;
        }
        parsepage(pages.login);
        if (is_mobile) {
            MegaMobileHeader.init(true);
            mobile.signin.show();
        }
        else {
            init_login();
        }
    }
    else if (is_mobile && isEphemeral() && is_fm()) {
        // Log out and redirect to start page it's the ephemeral session on mobile web
        u_logout(true);
        page = '';
        loadSubPage('start');
        return false;
    }
    else if (is_mobile && u_type && (page === 'fm/dashboard' || page === 'start')) {
        loadSubPage('fm');
        return false;
    }
    else if (page === 'achievements') {
        mega.redirect('mega.io', 'achievements', false, false);
    }
    else if (!is_mobile && page === 'fm/account/achievements') {
        $.openAchievemetsDialog = true;
        loadSubPage('fm/account/plan');
        return false;
    }
    else if (!mega.flags.refpr && page.substr(0, 8) === 'fm/refer') {
        loadSubPage('fm');
        return false;
    }
    else if (is_mobile && (page.startsWith('twofactor') || page.startsWith('sms'))) {
        loadSubPage(`fm/account/${page}`);
        return false;
    }
    else if (page === 'fm/account/profile') {

        // Handle old invalid links from emails and redirect them back to fm/account
        loadSubPage('fm/account');
        return false;
    }
    else if (page == 'account') {
        loadSubPage('fm/account');
        return false;
    }
    else if (page == 'dashboard') {
        loadSubPage('fm/dashboard');
        return false;
    }
    else if (page == 'register') {
        if (u_storage.sid && u_type !== 0) {
            loadSubPage('fm');
            return false;
        }

        parsepage(pages.register);

        if (is_mobile) {
            if (window.pickedPlan) {
                sessionStorage.proPageContinuePlanNum = window.pickedPlan;
                delete window.pickedPlan;
            }
            mobile.register.show();
        }
        else {
            init_register();
        }
        eventlog(500272);
    }
    else if ((page.substr(0, 9) === 'registerb')) { // business register
        getUAOParameter(page, 'registerb');

        parsepage(pages.registerb);
        document.body.classList.add('business');
        var regBusiness = new BusinessRegister();
        regBusiness.initPage();
    }
    else if (!is_mobile && page === 'fm/account/history') {
        $.scrollIntoSection = '.session-history';
        loadSubPage('fm/account/security');
        return false;
    }
    else if (page === 'fm/links') {
        loadSubPage('fm/public-links');
        return false;
    }
    else if (page == 'key') {
        parsepage(pages.key);
        if (is_mobile) {
            mobile.register.showGeneratingKeysScreen();
        }
        init_key();
    }
    else if (page === 'support') {
        if (is_mobile) {
            parsepage(pages.support);
            mobile.support.init();
        }
        else if (u_type === 0) {
            loadSubPage('register');
            return false;
        }
        else {
            parsepage(pages.support);
            support.initUI();
        }
    }
    else if (page == 'contact') {
        mega.redirect('mega.io', 'contact', false, false);
    }
    else if (page.substr(0, 4) === 'help') {
        return location.replace(l.mega_help_host + location.hash);
    }
    else if (page === 'privacy' || page === 'gdpr') {
        mega.redirect('mega.io', 'privacy', false, false);
    }
    else if (page === 'privacycompany') {
        mega.redirect('mega.io', 'security', false, false);
    }
    else if (page === 'dev' || page === 'developers' || page === 'doc' || page === 'sdk' || page === 'sourcecode') {
        mega.redirect('mega.io', 'developers', false, false);
    }
    else if (page === 'sdkterms') {
        mega.redirect('mega.io', 'sdkterms', false, false);
    }
    else if (page === 'backup') {
        // Redirect to the new url when access the old /backup path.
        loadSubPage('keybackup');
        return false;
    }
    else if (page === 'keybackup' && !u_type) {
        login_next = page;
        login_txt = l[1298];
        return loadSubPage('login');
    }
    else if (page === 'keybackup') {
        if (is_mobile) {
            loadSubPage('fm/account/security/backup-key', 'override');
            return false;
        }
        else {
            parsepage(pages.keybackup);
            init_backup();
        }
    }
    else if (page.substr(0, 6) === 'cancel' && page.length > 24) {

        // If logged in
        if (u_type) {
            var ac = new mega.AccountClosure();

            // Validate code with current logged in session
            ac.validateCodeWithSession().done(function() {
                if (is_mobile) {
                    parsepage(pages.mobile);
                    mobile.settings.account.verifyDelete.init();
                }
                else {
                    ac.handleFeedback();
                }
            }).fail((res) => {
                // If this is not errored from server but failed verification
                if (typeof res !== 'number') {
                    if (is_mobile) {
                        parsepage(pages.mobile);
                    }
                    msgDialog('warninga', l[135], l[22001], false, () => {
                        loadSubPage('fm');
                    });
                }
            });
        }
        else {
            // Unable to cancel, not logged in
            if (is_mobile) {
                parsepage(pages.mobile);
                login_next = page;
                msgDialog('warninga', l[5841], l.account_login_to_continue, false, () => {
                    loadSubPage('login');
                });
            }
            else {
                mega.ui.showLoginRequiredDialog({
                    title: l[6186],
                    textContent: l[5841]
                })
                .done(init_page)
                .fail(function (aError) {
                    if (aError) {
                        alert(aError);
                    }
                    loadSubPage('start');
                });
            }
        }
    }
    else if (page === 'wiretransfer') {

        api_req({ a: 'ufpqfull', t: 0, d: 0 }, {

            callback: function(gatewayOptions) {

                // if wiretransfer method is disabled by api, redirect to fm.
                if (!gatewayOptions.some(gateway => gateway.gatewayId === 999)) {
                    return loadSubPage('fm');
                }

                parsepage(pages.placeholder);

                if (u_type === 3) {
                    wireTransferDialog
                        .init(function onClose() {
                            loadSubPage('fm');
                        });
                }
                else if (is_mobile) {
                    login_next = 'wiretransfer';
                    loadSubPage('login');

                }
                else {
                    mega.ui.showLoginRequiredDialog({
                        minUserType: 3,
                        skipInitialDialog: 1
                    })
                        .done(init_page)
                        .fail(aError => {
                            if (aError) {
                                alert(aError);
                            }
                            loadSubPage('start');
                        });
                }
            }
        });
    }

    // Initial recovery process page to choose whether to recover with Master/Recovery Key or park the account
    else if (page === 'recovery') {
        if (is_mobile) {
            if (u_type) {
                loadSubPage('fm/account');
                return false;
            }
            else {
                parsepage(pages.recovery);
                //mobile.recovery.init();
                var recov = new AccountRecoveryControl();
                mega.accountController = recov;
                mega.accountController.showStep();
            }
        }
        else {
            if (u_type) {
                loadSubPage('fm/account/security');
                return false;
            }
            else {
                parsepage(pages.recovery);
                //var accountRecovery = new mega.AccountRecovery();
                //accountRecovery.initRecovery();
                var recov = new AccountRecoveryControl();
                mega.accountController = recov;
                mega.accountController.showStep();
            }
        }
    }

    // Page for mobile to let them recover by Master/Recovery Key
    else if (is_mobile && page === 'recoverybykey') {
        parsepage(pages.mobile);
        mobile.recovery.sendEmail.init(mobile.recovery.sendEmail.RECOVERY_TYPE_KEY);
    }

    // Page for mobile to let them park their account (start a new account with the same email)
    else if (is_mobile && page === 'recoverybypark') {
        parsepage(pages.mobile);
        mobile.recovery.sendEmail.init(mobile.recovery.sendEmail.RECOVERY_TYPE_PARK);
    }

    // Code for handling the return from a #recover email link
    else if (page.substr(0, 7) === 'recover' && page.length > 25) {
        parsepage(pages.reset);
        if (is_mobile) {
            mobile.recovery.fromEmailLink.init();
        }
        else {
            init_reset();
        }
    }

    // Page for mobile to enter (or upload) their Master/Recovery Key
    else if (is_mobile && page === 'recoveryenterkey') {
        parsepage(pages.mobile);
        mobile.recovery.enterKey.init();
    }

    // Page for mobile to let them change their password after they have entered their Master/Recovery key
    else if (is_mobile && page === 'recoverykeychangepass') {
        parsepage(pages.mobile);
        mobile.recovery.changePassword.init('key');
    }

    // Page for mobile to let the user change their password and finish parking their account
    else if (is_mobile && page === 'recoveryparkchangepass') {
        parsepage(pages.mobile);
        mobile.recovery.changePassword.init('park');
    }
    else if (page === 'about/reliability') {
        mega.redirect('mega.io', 'reliability', false, false);
    }
    else if (page === 'about/privacy') {
        mega.redirect('mega.io', 'security', false, false);
    }
    else if (page === 'about/jobs') {
        window.location.replace('https://careers.mega.nz');
    }
    else if (page === 'about/main' || page.substr(0, 5) === 'about') {
        mega.redirect('mega.io', 'about', false, false);
    }
    else if (page.substr(0, 5) === 'terms') {
        mega.redirect('mega.io', 'terms', false, false);
    }
    else if (page === 'security') {
        mega.redirect('mega.io', 'security', false, false);
    }
    else if (page === 'security/bug-bounty') {
        mega.redirect('mega.io', 'bug-bounty', false, false);
    }
    else if (page === 'takedown') {
        mega.redirect('mega.io', 'takedown', false, false);
    }
    else if (page === 'copyrightnotice') {
        mega.redirect('mega.io', 'copyrightnotice', false, false);
    }
    else if (page === 'copyright') {
        mega.redirect('mega.io', 'copyright', false, false);
    }
    else if (page === 'disputenotice') {
        parsepage(pages.disputenotice);
        copyright.init_cndispute();
    }
    else if (page === 'dispute') {
        mega.redirect('mega.io', 'dispute', false, false);
    }
    else if (page.substr(0, 3) === 'pro') {

        /* jshint -W018 */
        if (page.substr(0, 6) === 'propay') {
            parsepage(pages.propay);
            pro.propay.init();
        }
        else {
            pro.proplan2.initPage();
        }
    }
    else if (page.substr(0, 7) === 'payment') {
        var isBussiness = page.indexOf('-b') !== -1;

        if (!isBussiness || is_mobile) {
            // Load the Pro page in the background
            parsepage(pages.proplan);
            if (!isBussiness) {
                pro.proplan.init();
            }
        }
        else {
            mega.redirect('mega.io', 'business', false, false);
        }

        // Process the return URL from the payment provider and show a success/failure dialog if applicable
        pro.proplan.processReturnUrlFromProvider(page);
    }
    else if (page === 'thanks') {
        let $dialogOverlay = $('.thankyou-dialog').removeClass('hidden');
        let $backgroundOverlay = $('.thankyou-dialog-overlay').removeClass('hidden');

        parsepage(pages.placeholder);
        $('.thankyou-txt', $dialogOverlay).safeAppend(l[24852]);
        $('.thankyou-button, .thankyou-close', $dialogOverlay)
            .removeClass('hidden')
            .rebind('click', function() {
                $backgroundOverlay.addClass('hidden').removeClass('thankyou-dialog-overlay');
                $dialogOverlay.addClass('hidden');
                loadSubPage(loggedout || u_type === false ? 'start' : 'fm', 'override');
                return false;
            });
    }
    else if (page.substr(0, 5) === 'repay') {

        // If Business master account (or Pro Flexi account) and expired/grace period, load the Repay page
        if ((typeof u_attr !== 'undefined' && u_attr.b && u_attr.b.m && pro.isExpiredOrInGracePeriod(u_attr.b.s)) ||
            (typeof u_attr !== 'undefined' && u_attr.pf && pro.isExpiredOrInGracePeriod(u_attr.pf.s))) {

            getUAOParameter(page, 'repay');
            parsepage(pages.repay);
            var repayPage = new RepayPage();
            repayPage.initPage();
        }
        else {
            loadSubPage('start');
            return;
        }
    }
    else if (page === 'credits') {
        if (u_type) {
            loadSubPage('fm');
        }
        else {
            mega.redirect('mega.io', '', false, false);
        }
    }
    else if (page === 'mobile' || page === 'android' || page === 'ios' || page === 'uwp' || page === 'wp' ||
             page === 'mobileapp') {

        mega.redirect('mega.io', 'mobile', false, false);
    }
    else if (page === 'nas') {
        mega.redirect('mega.io', 'nas', false, false);
    }
    else if (page === 'refer') {
        mega.redirect('mega.io', 'refer', false, false);
    }
    else if (page.substring(0, 7) === 'special') {
        parsepage(pages.special);
        troyhuntCampaign.init();
    }
    else if (page === 'extensions' || page === 'chrome' || page === 'firefox' || page === 'edge' || page === 'plugin') {
        mega.redirect('mega.io', 'extensions', false, false);
    }
    else if (page === 'business') {
        mega.redirect('mega.io', 'business', false, false);
    }
    else if (page.substr(0, 7) === 'desktop' || page === 'sync') {
        mega.redirect('mega.io', 'desktop', false, false);
    }
    else if (page === 'syncing') {
        mega.redirect('mega.io', 'syncing', false, false);
    }
    else if (page == 'cmd') {
        mega.redirect('mega.io', 'cmd', false, false);
    }
    else if (page == 'resellers') {
        mega.redirect('mega.io', 'resellers', false, false);
    }
    else if (page === 'storage') {
        mega.redirect('mega.io', 'storage', false, false);
    }
    else if (page === 'securechat') {
        mega.redirect('mega.io', 'chatandmeetings', false, false);
    }
    else if (page === 'collaboration') {
        mega.redirect('mega.io', 'share', false, false);
    }
    else if (page === 'objectstorage') {
        mega.redirect('mega.io', 'objectstorage', false, false);
    }
    else if (page === 'megabackup') {
        mega.redirect('mega.io', 'megabackup', false, false);
    }
    else if (page == 'done') {
        parsepage(pages.done);
        init_done();
    }
    else if (page === 'cookie') {
        if (mega.flags.ab_adse) {
            parsepage(pages.cookiepolicy);
            $cookiePolicyPage = $('body #mainlayout #startholder .bottom-page.cookie-policy');
            $('.cookie-policy .cookiesdialog', $cookiePolicyPage).rebind('click', () => {
                csp.trigger().dump('csp.trigger');
            });
        }
        else {
            mega.redirect('mega.io', 'cookie', false, false);
        }
    }
    else if (page === 'cookiedialog') {

        // This is a page to directly show the cookie settings dialog, usually users are redirected here from mega.io
        parsepage(pages.placeholder);
        csp.trigger().dump('csp.trigger');
    }
    else if (page === 'smsdialog') {

        parsepage(pages.placeholder);

        // Only allow if fully registered and logged in
        if (u_type) {
            sms.phoneInput.init();
        }
        else {
            login_next = page;
            login_txt = l[1298];
            loadSubPage('login', 'override');
        }
    }
    else if (page.substr(0, 5) === 'unsub') {
        // Non-registered user unsubsribe from emails.
        if (is_mobile) {
            parsepage(pages.mobile);
        }
        M.require('unsub_js').done(function() {
            EmailUnsubscribe.unsubscribe();
        });
    }
    else if (dlid) {
        page = 'download';
        if (typeof fdl_queue_var !== 'undefined') {
            var handle = Object(fdl_queue_var).ph || '';
            var $tr = $('.transfer-table tr#dl_' + handle);
            if ($tr.length) {
                var dl = dlmanager.getDownloadByHandle(handle);
                if (dl) {
                    dl.onDownloadProgress = dlprogress;
                    dl.onDownloadComplete = dlcomplete;
                    dl.onDownloadError = M.dlerror;
                    $tr.remove();
                }
            }
        }

        parsepage(pages.download);

        dlinfo(dlid, dlkey, false);
        topmenuUI();
    }
    else if (page.substr(0, 5) === 'reset') {
        localStorage.clear();
        sessionStorage.clear();
        loadSubPage(page.substr(6) || 'fm');
        return location.reload(true);
    }
    else if (page.substr(0, 5) === 'debug') {
        localStorage.d = 1;
        localStorage.minLogLevel = 0;
        loadSubPage(page.substr(6) || 'fm');
        return location.reload(true);
    }
    else if (page.substr(0, 4) === 'test') {
        test(page.substr(4));
    }

    // An URL to let users force load MEGA Lite mode (e.g. for users with large accounts and difficulty getting in,
    // but are below the threshold that would normally prompt them to try MEGA Lite i.e. > 1.5 million nodes).
    else if (page.substr(0, 12) === 'loadmegalite') {

        localStorage.megaLiteMode = '1';

        loadSubPage('login');

        return location.reload();
    }

    // New multi-discount handling with discount promotion page e.g.
    // /discountpromoJ2iPNEWqiTM-yhsuGkOToh or short sale URLs e.g. /s/blackfriday
    else if (page.substr(0, 13) === 'discountpromo' || page.substr(0, 2) === 's/') {
        return new DiscountPromo();
    }

    // Existing discount handling system, redirects straight into the Pro Payment page showing the discount
    else if (page.substr(0, 8) === 'discount') {

        // discount code from URL #discountxR7xVwBkNjcerUKpjqO6bQ
        if (is_mobile) {
            parsepage(pages.mobile);
        }
        return pro.proplan.handleDiscount(page);
    }

    /**
     * If voucher code from url e.g. #voucherZUSA63A8WEYTPSXU4985
     */
    else if (page.substr(0, 7) === 'voucher') {

        if (mega.voucher && mega.voucher.redeemSuccess) {
            return loadSubPage('pro');
        }

        // Get the voucher code from the URL.
        var voucherCode = page.substr(7);

        // Store in localStorage to be used by the Pro page or when returning from login
        localStorage.setItem('voucher', voucherCode);
        localStorage.setItem('voucherExpiry', Date.now() + 36e5);

        // If not logged in, direct them to login or register first
        if (!u_type) {
            if (typeof redeem === 'undefined') {
                // we have voucher directly
                if (u_wasloggedin()) {
                    login_txt = l[7712];
                    loadSubPage('login');
                }
                else {
                    register_txt = l[7712];
                    loadSubPage('register');
                }
                return false;
            }
            else {
                // we are coming from redeem page
                redeem.showVoucherInfoDialog();
            }
        }
        else if (u_type < 3) {
            // If their account is ephemeral and the email is not confirmed, then show them a dialog to warn them and
            // make sure they confirm first otherwise we get lots of chargebacks from users paying in the wrong account
            msgDialog('warningb', l[8666], l[8665], false, function () {
                loadSubPage('fm');
            });
        }
        else {
            // Show the voucher info to the user before proceeding to redeem.
            if (typeof redeem !== 'undefined' && mega.voucher) {
                return redeem.showVoucherInfoDialog();
            }
            // Otherwise go to the Redeem page which will detect the voucher code and show a dialog
            loadSubPage('redeem');
            return false;
        }
    }

    // Load the direct voucher redeem page
    else if (page.substr(0, 6) === 'redeem') {
        const storageVoucher = localStorage.voucher;
        if (storageVoucher && (u_type > 2 || window.bCreatedVoucher)) {
            // To complete the redeem voucher process after user logs in if the voucher code exists
            parsepage(pages[is_mobile ? 'mobile' : 'redeem']);
            redeem.init();
        }
        else {
            // No voucher found, ask to enter it.
            // Or back to the voucher redeem page without completion of login or register if entered code before
            parsepage(pages.redeem);
            const vCode = page.substr(6);
            redeem.setupVoucherInputbox((vCode.length > 10 && vCode.length < 25) ? vCode : storageVoucher);
        }
    }

    // If they recently tried to redeem their voucher but were not logged in or registered then direct them to the
    // #redeem page to complete their purchase. For newly registered users this happens after key creation is complete.
    else if ((localStorage.getItem('voucher') !== null) && (u_type === 3)) {
        loadSubPage('redeem');
        return false;
    }
    else if (localStorage.getItem('addContact') !== null && u_type === 3) {
        var contactRequestInfo = JSON.parse(localStorage.getItem('addContact'));
        var contactHandle = contactRequestInfo.u;
        var contactRequestTime = contactRequestInfo.unixTime;
        M.setUser(contactHandle, {
            u: contactHandle,
            h: contactHandle,
            c: undefined
        });

        var TWO_HOURS_IN_SECONDS = 7200;

        var addContact = function (ownerEmail, targetEmail) {
            M.inviteContact(ownerEmail, targetEmail);
            localStorage.removeItem('addContact');
            return init_page();
        };

        if ((unixtime() - TWO_HOURS_IN_SECONDS) < contactRequestTime) {
            M.syncContactEmail(contactHandle, true)
                .then(function(email) {
                    addContact(u_attr.email, email);
                })
                .catch(function(ex) {
                    console.error(contactHandle, ex);
                    localStorage.removeItem('addContact');
                });
        }
    }
    else if (is_fm()) {
        let id = false;
        if (page.substr(0, 2) === 'fm') {
            id = page.replace('fm/', '');
            if (id.length < 5 && id !== 'chat') {
                id = false;
            }
        }

        if (d) {
            console.log('Setting up fm...', id, pfid, fminitialized, M.currentdirid);
        }

        // FIXME
        // all global state must be encapsulated in a single object -
        // we can then comfortably switch between states by changing the
        // current object and switching UI/XHR comms/IndexedDB

        // switch between FM & folderlinks (completely reinitialize)
        if ((!pfid && folderlink) || (pfid && folderlink === 0) || pfkey !== oldPFKey) {

            u_reset();
            folderlink = 0;

            if (u_sid) {
                api_setsid(u_sid);
            }
            if (pfid) {
                api_setfolder(n_h);
            }
        }

        // Set System default theme or any previously selected
        mega.ui.setTheme();

        if (!id && fminitialized) {
            id = M.RootID;
        }
        delete localStorage.keycomplete;

        if (!fminitialized) {
            if (is_mobile) {
                $('#fmholder').safeHTML(translate(pages['mobile'].replace(/{staticpath}/g, staticpath)));
            }
            else {
                fm_addhtml();
            }

            assert(!is_chatlink);
            mega.initLoadReport();
            loadfm();

            if (id) {
                M.currentdirid = id;
            }
        }
        else if ((!pfid || flhashchange) && (id && id !== M.currentdirid || page === 'start')) {
            M.openFolder(id, true);
        }
        else {
            if (ul_queue.length > 0) {
                M.openTransfersPanel();
            }

            if (u_type === 0 && !u_attr.terms && !is_eplusplus) {
                $.termsAgree = function () {
                    u_attr.terms = 1;
                    api_req({ a: 'up', terms: 'Mq' });
                    // queued work is continued when user accept terms of service
                    let $icon = $('.transfer-pause-icon').removeClass('active');
                    $('i', $icon).removeClass('icon-play-small').addClass('icon-pause');
                    $('.nw-fm-left-icon.transfers').removeClass('paused');
                    dlQueue.resume();
                    ulQueue.resume();
                    uldl_hold = false;
                    if (ul_queue.length > 0) {
                        M.showTransferToast('u', ul_queue.length);
                    }
                };

                $.termsDeny = function () {
                    loadingDialog.show();
                    ulmanager.abort(null);
                    Soon(function() {
                        u_logout().then(() => location.reload());
                    });
                };

                dlQueue.pause();
                ulQueue.pause();
                uldl_hold = true;

                if (!is_mobile) {
                    M.safeShowDialog('terms', () => {
                        msgDialog(
                            `confirmation:!^${l[1037]}!${l[82]}`,
                            '',
                            l.terms_dialog_title,
                            l.terms_dialog_text,
                            e => {
                                if (e) {
                                    $.termsAgree();
                                }
                                else {
                                    $.termsDeny();
                                }
                                onIdle(() => closeDialog());
                            }
                        );
                        return $('#msgDialog');
                    });

                }
            }
        }

        $('#pageholder, #startholder').addClass('hidden');

        // Prevent duplicate HTML content breaking things
        // what a strange solution!  [emptying #startholder!]
        // we should have fixed duplicated classes, ids in the html..
        if (is_mobile) {
            $('#startholder').empty();
        }

        $('.nw-fm-left-icons-panel').removeClass('hidden');
        let fmholder = document.getElementById('fmholder');
        // try to determinate visibility, without needing to use :visible
        if (!fmholder || fmholder.classList.contains("hidden") || fmholder.style.display === "none") {
            if (fmholder) {
                fmholder.removeAttribute("style");
                fmholder.classList.remove('hidden');
            }
            if (fminitialized && !is_mobile) {
                M.addViewUI();

                if ($.transferHeader) {
                    $.transferHeader();
                }
            }
        }

        if (!is_mobile && typeof fdl_queue_var !== 'undefined') {
            if (!$('.transfer-table tr#dl_' + Object(fdl_queue_var).ph).length) {
                var fdl = dlmanager.getDownloadByHandle(Object(fdl_queue_var).ph);
                if (fdl && fdl_queue_var.dlkey === dlpage_key) {

                    onIdle(() => {
                        M.putToTransferTable(fdl);
                        M.onDownloadAdded(1, dlQueue.isPaused(dlmanager.getGID(fdl)));

                        fdl.onDownloadProgress = M.dlprogress;
                        fdl.onDownloadComplete = M.dlcomplete;
                        fdl.onBeforeDownloadComplete = M.dlbeforecomplete;
                        fdl.onDownloadError = M.dlerror;
                    });
                }
            }
        }

        pagemetadata();
    }
    else if (page.substr(0, 2) == 'fm' && !u_type) {
        if (loggedout || (u_type === false && page !== 'fm/refer')) {
            loadSubPage('start', 'override');
            return false;
        }
        login_next = page;
        login_txt = l[1298];
        loadSubPage('login', 'override');
    }
    else if (page === 'hashtransfer') {

        // The site transfer defaults to here and we are waiting for that to finish before redirecting elsewhere
        parsepage(pages.placeholder);
        return false;
    }
    else {
        // Due to the new mega.io site there is no more /start page (and no more ephemeral accounts)
        if (is_extension) {
            loadSubPage('login');
        }
        else {
            // For regular webclient we replace the whole URL
            // and preserve search parameters as the replace will reload memory.
            window.location.replace('/login' + locationSearchParams);
        }
    }

    // Initialise the update check system
    if (typeof alarm !== 'undefined') {
        alarm.siteUpdate.init();
    }
    topmenuUI();

    if (!window.is_karma && mega.metatags) {
        mega.metatags.checkPageMatchesURL();
    }

    loggedout = false;
    flhashchange = false;

    onIdle(blockChromePasswordManager);
}

function topbarUITogglePresence(topbar) {

    'use strict';

    const element = topbar.querySelector('.js-activity-status');
    const setStatusElem = topbar.querySelector('.js-dropdown-account .status-dropdown');

    if (element) {
        element.classList.add('hidden');
        setStatusElem.classList.add('hidden');

        // ActivityStatus Code
        // If the chat is disabled, or the presence lib isn't loading,
        // don't show the green status icon and the Set Status option in the header.
        if (!pfid && megaChatIsReady && megaChat.userPresence !== undefined) {
            element.classList.remove('hidden');
            setStatusElem.classList.remove('hidden');
            megaChat._renderMyStatus();
        }
    }
}

function topbarUI(holderId) {
    'use strict';

    let element;
    const holder = document.getElementById(holderId);
    const topbar = holder && holder.querySelector('.js-topbar');

    if (!topbar) {
        return;
    }
    onIdle(() => mega.ui.searchbar.refresh());

    topbarUITogglePresence(topbar);

    element = topbar.querySelector('.js-dropdown-account');

    if (element) {
        element.classList[u_type ? 'remove' : 'add']('hidden');
    }

    element = topbar.querySelector('.js-topbar-searcher');

    if (element) {
        element.classList[fminitialized ? 'remove' : 'add']('hidden');
    }

    const theme = u_attr && u_attr['^!webtheme'] !== undefined ? u_attr['^!webtheme'] : 0;
    let logoClass = 'mega-logo-dark';

    $('.logo-full', '.js-topbar').removeClass('img-mega-logo-light', 'mega-logo-dark');
    if (theme === '1'){
        logoClass = 'img-mega-logo-light';
    }
    else {
        logoClass = 'mega-logo-dark';
    }
    $('.logo-full', '.js-topbar').addClass(logoClass);

    element = topbar.querySelector('.js-dropdown-notification');

    if (element) {
        element.classList[fminitialized && !folderlink && u_type === 3 ? 'remove' : 'add']('hidden');
    }

    if (u_type === 3 && u_attr && u_attr.fullname && (element = topbar.querySelector('.name'))) {
        $(element).text(u_attr.fullname).attr('data-simpletip', u_attr.fullname);
    }

    if (u_type && u_attr && u_attr.email && (element = topbar.querySelector('.email'))) {
        $(element).text(u_attr.email).attr('data-simpletip', u_attr.email);
    }

    // Initialise the Back to MEGA button (only shown if in MEGA Lite mode)
    if (mega.lite.inLiteMode) {
        mega.lite.initBackToMegaButton();
    }

    $('.js-topbaravatar, .js-activity-status', topbar).rebind('click', function() {
        const $wrap = $(this).closest('.js-dropdown-account');
        const $btn = $('.downloadmega', $wrap).parent();
        if (!$btn.hasClass('sync-checked')) {
            megasync.isInstalled((err, is) => {
                if (!err || is) {
                    $btn.addClass('hidden');
                }
                $btn.addClass('sync-checked');
            });
        }

        const container = this.parentNode;
        if (container.classList.contains("show")) {
            container.classList.remove("show");
        }
        else {
            if (fmconfig.rvonbrddl === 1) {
                $('.js-accountbtn.feedback', topbar).removeClass('highlight');
            }

            const $accountAvatar = $('.js-account-avatar', topbar);
            if (!$accountAvatar.hasClass('rendered')) {
                $accountAvatar.addClass('rendered').safeHTML(useravatar.contact(u_handle));
            }
            container.classList.add("show");

            const accountName = topbar.querySelector('span.name');
            const accountEmail = topbar.querySelector('span.email');
            // If the user full name is too long, shrink and add the simpletip to show the full name
            if (accountName.scrollWidth > accountName.offsetWidth) {
                accountName.classList.add('simpletip');
            }
            else {
                accountName.classList.remove('simpletip');
            }
            // If the user email is too long, shrink and add the simpletip to show the full email
            if (accountEmail.scrollWidth > accountEmail.offsetWidth) {
                accountEmail.classList.add('simpletip');
            }
            else {
                accountEmail.classList.remove('simpletip');
            }
        }
    });

    $('.js-accountbtn', topbar).rebind('click.topAccBtn', function(){

        if (this.classList.contains('settings')) {
            loadSubPage('fm/account');
        }
        else if (this.classList.contains('achievements')) {
            mega.achievem.achievementsListDialog();
        }
        else if (this.classList.contains('logout')) {
            mLogout();
        }
        else if (this.classList.contains('feedback')) {
            mega.config.set('rvonbrddl', 1);
            window.open(
                'https://survey.mega.co.nz/index.php?r=survey/index&sid=692176&lang=en',
                '_blank',
                'noopener,noreferrer'
            );
        }
        var dropdown = document.getElementsByClassName('js-dropdown-account');

        for (i = dropdown.length; i--;) {
            dropdown[i].classList.remove('show');
        }
        if (!this.classList.contains('logout') && !$('.fm-dialog-overlay').hasClass('hidden')) {
            $('.fm-dialog-overlay').addClass('hidden');
        }
    });

    $('.js-accountsubmenu', topbar).rebind('mouseover.topSubmenu', function() {
        $('.js-statuslist', this).removeClass('hidden');
        $(this).on('mouseout.topSubmenu', () => {
            $('.js-statuslist', this).addClass('hidden');
            $(this).off('mouseout.topSubmenu');
        });
    });
}

function topmenuUI() {

    'use strict';

    var topMenuElm = document.getElementById('topmenu');

    if (topMenuElm) {
        var topHeader = topMenuElm.querySelector('.top-head');

        if (!topHeader) {
            $(topMenuElm).safeHTML(parsetopmenu());

            if (!is_fm()) {
                $('.top-head .logo', topMenuElm).css("display", "block");
            }
        }

        $.tresizer();
    }

    const holderId = is_fm() && page !== 'start' ? 'fmholder' : 'startholder';

    topbarUI(holderId);

    var $topMenu = $('.top-menu-popup', 'body');
    var $topHeader = is_mobile ? $('.fm-header', 'body') : $('.top-head', '#' + holderId);
    var $topBar = is_mobile ? $('.fm-header', 'body') : $('.js-topbar', '#' + holderId);
    var $menuFmItem = $('.top-menu-item.fm', $topMenu);
    var $menuLogoutButton = $('.logout', $topMenu);
    var $menuAuthButtons = $('.top-menu-item.register,.top-menu-item.login', $topMenu);
    var $menuLoggedBlock = $('.top-menu-logged', $topMenu);
    var $menuRefreshItem = $('.top-menu-item.refresh-item', $topMenu);
    var $menuHomeItem = $('.top-menu-item.start', $topMenu);
    var $menuPricingItem = $('.top-menu-item.pro', $topMenu);
    const $menuAchievementsItem = $('.top-menu-item.achievements', $topMenu);
    var $menuBackupItem = $('.top-menu-item.backup', $topMenu);
    var $menuAffiliateItem = $('.top-menu-item.affiliate', $topMenu);
    var $menuFeedbackItem = $('.top-menu-item.feedback', $topMenu);
    var $menuUserinfo = $('.top-menu-account-info', $menuLoggedBlock);
    var $menuUsername = $('.name', $menuUserinfo);
    var $menuAvatar = $('.avatar-block', $menuUserinfo);
    var $menuUpgradeAccount = $('.upgrade-your-account', $topMenu);
    var $headerActivityBlock = $('.activity-status-block .activity-status,.activity-status-block', $topHeader);
    var $headerIndividual = $('.individual', $topHeader);
    var $headerIndividualSpan = $('.individual span', $topHeader);
    var $headerSearch = $('.mini-search', $topHeader);
    var $headerButtons = $('.top-buttons', $topHeader);
    var $loginButton = $('.top-login-button', $headerButtons);
    var $headerRegisterBotton = $('.create-account-button', $headerButtons);
    var $headerSetStatus = $('.js-dropdown-account .status-dropdown', $topHeader);
    var $headerAchievements = $('.js-accountbtn.achievements', $topHeader);
    var $headerDownloadMega = $('.js-accountbtn.downloadmega', $topHeader);
    const $topBarAvatar = $('.js-topbaravatar', $topBar);
    const $topMenuActivityBlock = $('.activity-status-block', $menuUserinfo);

    if (u_type === 0) {
        $('span', $loginButton).text(l[967]);
    }

    $menuLoggedBlock.addClass('hidden').removeClass('business-acc');
    $menuBackupItem.addClass('hidden').next('.top-menu-divider').addClass('hidden');
    $menuHomeItem.removeClass('hidden');
    $menuPricingItem.removeClass('hidden');
    $menuAchievementsItem.removeClass('hidden');
    $menuFmItem.addClass('hidden');
    $menuLogoutButton.addClass('hidden');
    $menuAuthButtons.addClass('hidden');
    $menuRefreshItem.addClass('hidden');
    $menuAffiliateItem.addClass('hidden');
    $menuUsername.addClass('hidden');
    $menuUpgradeAccount.removeClass('hidden');
    $menuAvatar.removeClass('presence');
    $topMenuActivityBlock.addClass('hidden');

    $headerActivityBlock.addClass('hidden');
    $headerIndividualSpan.text(l[19702]); // try Mega Business
    $headerSetStatus.addClass('hidden');
    $headerAchievements.addClass('hidden');
    $('.membership-status, .top-head .user-name', $topHeader).addClass('hidden');

    // Show/hide MEGA for Business/ Try Individual button
    if (u_type > 0 || u_type === 0 && is_fm()) {
        $headerIndividual.addClass('hidden');
    }
    else {
        $headerIndividual.removeClass('hidden');
    }

    if (!fminitialized) {
        $headerSearch.addClass('hidden');
    }

    if (page === 'download') {
        $menuRefreshItem.removeClass('hidden');
    }
    if (page === 'registerb') {
        $headerIndividualSpan.text(l[19529]); // try Mega MEGA Indivisual
    }

    var avatar = window.useravatar && useravatar.mine();
    if (!avatar) {
        $menuAvatar.addClass('hidden');
    }
    else {
        $menuAvatar.removeClass('hidden');
    }

    // Show active item in main menu
    var section = page.split('/')[0];
    if (section === 'fm') {
        section = page.split('/')[1];
    }

    if (page.indexOf('fm/refer') === 0) {
        section = 'affiliate-dashboard';
    }
    else if (page === 'refer') {
        section = 'affiliate';
    }

    // Get all menu items
    var $topMenuItems = $('.top-menu-item', $topMenu);

    // Remove red bar from all menu items
    $topMenuItems.removeClass('active');

    // If in mobile My Account section, show red bar
    if (is_mobile && page.indexOf('fm') === 0) {
        $topMenuItems.filter('.fm').addClass('active');
    }
    else if (section) {
        // just in case, a payment provider appended any ?returnurl vars
        const selector = section.split('?')[0].replace(/[^A-Z_a-z-]/g, "");

        if (selector.length) {
            const $menuItem = $topMenuItems.filter(`.${selector}`);
            const $parent = $menuItem.parent('.top-submenu');

            $menuItem.addClass('active');

            if ($parent.length) {
                $parent.prev().addClass('expanded');
            }
        }
        else if (d) {
            console.error('Invalid section...', section);
        }
    }

    if (u_type === 3 && u_attr.fullname) {
        $('.user-name', $topHeader).text(u_attr.fullname).removeClass('hidden');
        $menuUsername.text(u_attr.fullname).removeClass('hidden');
    }

    if (mega.flags.refpr) {
        $menuAffiliateItem.removeClass('hidden');
    }

    // Show language in top menu
    $('.top-menu-item.languages span', $topMenu).text(languages[lang][2]);

    // Show version in top menu
    var $versionButton = $('.top-mega-version', $topMenu).text('v. ' + M.getSiteVersion());

    if ($versionButton.length) {
        let versionClickCounter = 0;

        $versionButton.rebind('click.versionupdate', () => {
            if (++versionClickCounter >= 3) {
                mega.developerSettings.show();
            }
            delay('top-version-click', () => {
                versionClickCounter = 0;
            }, 1000);
        });
    }

    if (u_type > 0) {

        $menuHomeItem.addClass('hidden');
        $menuFmItem.removeClass('hidden');
        $menuLogoutButton.removeClass('hidden');
        $menuBackupItem.removeClass('hidden').next('.top-menu-divider').removeClass('hidden');
        $menuLoggedBlock.removeClass('hidden');
        $menuFeedbackItem.removeClass('hidden');

        // for top menu, load avatar and show for logged in user
        if (!$topBarAvatar.hasClass('rendered')) {

            delay('load-own-avatar', async() => {
                $topBarAvatar.addClass('rendered');
                await Promise.resolve(useravatar.loadAvatar(u_handle)).catch(nop);
                $('.avatar', $topBarAvatar).safeHTML(useravatar.contact(u_handle));
            }, 888);
        }

        $headerButtons.addClass('hidden');
        $loginButton.addClass('hidden');
        $('.dropdown.top-login-popup', $topHeader).addClass('hidden');
        $('.membership-status', $topHeader).removeClass('hidden');
        $('.top-change-language', $topHeader).addClass('hidden');
        $headerRegisterBotton.addClass('hidden');
        $('.membership-status-block', $topHeader).removeClass('hidden');

        // Show the rocket icon if achievements are enabled
        mega.achievem.enabled()
            .done(function () {
                $headerAchievements.removeClass('hidden');
            })
            .fail(function () {
                $headerAchievements.addClass('hidden');
            });

        if (u_attr.email) {
            $('.email', $menuUserinfo).text(u_attr.email);
        }

        // If Pro Flexi, hide the Upgrade button and Pricing link
        if (u_attr.pf) {
            if (u_attr.pf.s === pro.ACCOUNT_STATUS_ENABLED) {
                $menuUpgradeAccount.addClass('hidden');
                $menuPricingItem.addClass('hidden');
            }

            // If Pro Flexi Expired or in Grace Period, show the Reactive button and Pricing link
            else if (is_mobile) {
                $('.upgrade-your-account', $topMenu).text(l.reactivate_account_short);
            }
            else {
                $('.upgrade-your-account span', $topMenu).text(l.reactivate_account_short);
            }
        }

        document.body.classList.remove('free', 'lite', 'pro-user');

        // If Business or Pro Flexi always show the name (even if expired, which is when u_attr.p is undefined)
        if (u_attr.b || u_attr.pf) {
            $('.plan', $menuLoggedBlock).text(
                pro.getProPlanName(u_attr.b ? pro.ACCOUNT_LEVEL_BUSINESS : pro.ACCOUNT_LEVEL_PRO_FLEXI)
            );
            document.body.classList.add('pro-user');
        }

        // If a Lite/Pro plan has been purchased
        else if (u_attr.p) {

            // Set the plan text
            var proNum = u_attr.p;
            var purchasedPlan = pro.getProPlanName(proNum);

            // Set colour of plan and body class
            var cssClass;

            if (proNum === pro.ACCOUNT_LEVEL_PRO_LITE) {
                cssClass = 'lite';
                document.body.classList.add('lite');
            }
            else {
                cssClass = 'pro' + proNum;
            }

            // Show the Pro badge
            $('.plan', $menuLoggedBlock).text(purchasedPlan);
            document.body.classList.add('pro-user');
        }
        else {
            // Show the free badge
            $('.plan', $menuLoggedBlock).text(l[1150]);
            $('.membership-status', $topHeader).attr('class', 'tiny-icon membership-status free');
            document.body.classList.add('free');
        }

        if (is_fm()) {
            $menuRefreshItem.removeClass('hidden');

            if (self.d && !self.is_extension && !String(location.host).includes('mega.')) {
                $('.top-menu-item.infinity-item span', $topMenu)
                    .text(`${mega.infinity ? l.leave : l[5906]} Infinity \u{1F343}`)
                    .parent()
                    .rebind('click', () => M.reload(-0x7e080f))
                    .removeClass('hidden');
            }
        }

        if (pfcol) {
            $('.fm-import-to-cloudrive span', '.folder-link-btns-container').text(l.context_menu_import);
        }

        // If the chat is disabled, or the presence lib isn't loading,
        // don't show the green status icon and the Set Status option in the header.
        if (!pfid && megaChatIsReady && megaChat.userPresence !== undefined) {
            $headerActivityBlock.removeClass('hidden');
            $headerSetStatus.removeClass('hidden');
            $menuAvatar.addClass('presence');
            $topMenuActivityBlock.removeClass('hidden');
            megaChat._renderMyStatus();
        }

        // if this is a business account
        if (u_attr && u_attr.b) {
            $menuLoggedBlock.addClass('business-acc');
            $menuUpgradeAccount.addClass('hidden');

            if (u_attr.b.s !== -1) {

                $headerAchievements.addClass('hidden');

                // Hide Pricing menu item for Business sub accounts and admin expired
                $menuPricingItem.addClass('hidden');
            }
            document.body.classList.add('business-user');

            // If Business Expired or in Grace Period, and this is the business master account,
            // show the Reactivate button
            if (u_attr.b.m && u_attr.b.s !== pro.ACCOUNT_STATUS_ENABLED) {
                if (is_mobile) {
                    $('.upgrade-your-account', $topMenu).text(l.reactivate_account_short);
                }
                else {
                    $('.upgrade-your-account span', $topMenu).text(l.reactivate_account_short);
                }
                $menuUpgradeAccount.removeClass('hidden');
            }
        }
        else {
            document.body.classList.remove('business-user');
        }

        if (u_type && (!mega.flags.ach || Object(window.u_attr).b)) {
            // Hide Achievements menu item for an non-achievement account and business account
            $menuAchievementsItem.addClass('hidden');
        }

        // Show PRO plan expired warning popup (if applicable)
        alarm.planExpired.render();
    }
    else {
        if (u_type === 0 && !confirmok && page !== 'key') {

            $('.top-menu-item.register span', $topMenu).text(l[968]);

            // If they have purchased Pro but not activated yet, show a warning
            if (isNonActivatedAccount()) {
                alarm.nonActivatedAccount.render();
            }

            // Otherwise show the ephemeral session warning
            else if (!is_eplusplus && ($.len(M.c[M.RootID] || {})) && page !== 'register') {
                if (alarm.ephemeralSession) {
                    alarm.ephemeralSession.render();
                }
            }
        }

        $menuLoggedBlock.addClass('hidden');
        $('.membership-status-block', $topHeader).addClass('hidden');
        $headerAchievements.addClass('hidden');
        $headerButtons.removeClass('hidden');
        $headerRegisterBotton.removeClass('hidden');

        $headerRegisterBotton.rebind('click.register', function() {
            if ($(this).hasClass('business-reg')) {
                loadSubPage('registerb');
            }
            else {
                if (page === 'login') {
                    delay('loginregisterevlog', () => eventlog(99798));
                }
                loadSubPage('register');
            }
        });

        $loginButton.removeClass('hidden').rebind('click.auth', function() {
            if (u_type === 0) {
                mLogout();
            }
            else {
                var c = $('.dropdown.top-login-popup', $topHeader).attr('class');
                if (c && c.indexOf('hidden') > -1) {
                    if (page === 'register') {
                        delay('registerloginevlog', () => eventlog(99818));
                    }
                    tooltiplogin.init();
                }
                else {
                    tooltiplogin.init(1);
                }
            }
        });

        if (page === 'login') {
            $loginButton.addClass('hidden');
        }
        if (page === 'register' || page === 'registerb') {
            $headerRegisterBotton.addClass('hidden');
        }

        // Only show top language change icon if not logged in
        if (u_type === false) {

            // Get current language
            var $topChangeLang = $('.top-change-language', $topHeader);
            var $topChangeLangName = $('.top-change-language-name', $topChangeLang);

            //TODO: Change translated values on short translated
            //var languageName = ln[lang];

            // Init the top header change language button
            $topChangeLangName.text(getRemappedLangCode(lang));
            $topChangeLang.removeClass('hidden');
            $topChangeLang.rebind('click.changelang', function() {

                // Add log to see how often they click to change language
                api_req({ a: 'log', e: 99600, m: 'Language menu opened from top header' });

                // Open the language dialog
                langDialog.show();
            });
        }

        $menuAuthButtons.removeClass('hidden');

        if (u_type === 0) {
            $('.top-menu-item.login', $topMenu).addClass('o-hidden');
            $menuLogoutButton.removeClass('hidden');
        }
    }

    $.hideTopMenu = function (e) {

        var c;
        let $target;
        let element;
        let elements;
        let parent;
        let i;

        if (e) {

            parent = e.target.parentNode;
            // if event is triggered by inner element of mega-button, try pull classname of the button.
            c = parent && parent.classList.contains('mega-button') ? parent.className : e.target.className;
        }
        c = typeof c === 'string' ? c : '';
        elements = document.getElementsByClassName('js-more-menu menu-open');

        if (!e || !e.target.closest('.top-menu-popup, .js-more-menu') && elements.length &&
            (!c || !c.includes('top-icon menu') && !c.includes('top-menu-popup'))) {
            topMenu(1);
        }

        if (!e || e.target.closest('.top-menu-popup') &&
            (!c || !c.includes('activity-status') && !c.includes('loading'))) {
            $headerActivityBlock.removeClass('active');
        }

        if (!e || !e.target.closest('.top-login-popup') &&
            (!c || !c.includes('top-login-popup') && !c.includes('top-login-button'))) {
            $topHeader.find('.dropdown.top-login-popup').addClass('hidden');
        }

        if (!e || !e.target.closest('.create-new-folder') &&
            (!c || !c.includes('fm-new-folder'))) {

            const c3 = String(e && e.target && Object(e.target.parentNode).className || '');

            if (!c3.includes('fm-new-folder')) {

                element = document.getElementsByClassName('fm-new-folder').item(0);

                if (element) {
                    element.classList.remove('active', 'filled-input');
                }

                element = document.getElementsByClassName('create-new-folder').item(0);

                if (element) {
                    element.classList.add('hidden');
                }
            }
        }

        if ((!e || !e.target.closest('.fm-add-user, .add-user-popup')) &&
            (!c || c.indexOf('fm-add-user') === -1)) {

            element = document.getElementsByClassName('fm-add-user').item(0);

            if (element) {
                element.classList.remove('active');
            }

            element = document.getElementsByClassName('add-user-popup').item(0);

            if (element) {
                element.classList.add('hidden');
                element.removeAttribute('style');
            }
        }

        if (!e || (!e.target.closest('.js-dropdown-notification') &&
            ((c && c.indexOf('js-topbarnotification') === -1) || !c))) {
            notify.closePopup();
        }

        if (!e || (!e.target.closest('.js-dropdown-warning') &&
            ((c && c.indexOf('js-dropdown-warning') === -1) || !c))) {
            elements = document.getElementsByClassName('js-dropdown-warning');
            for (i = elements.length; i--;) {
                elements[i].classList.remove('show');
            }
        }

        if (!e ||
            (
                !e.target.closest('.js-dropdown-account') &&
                (
                    c && c.indexOf('js-topbaravatar') === -1 ||
                    !c
                )
            )) {

            elements = document.getElementsByClassName('js-dropdown-account');

            for (i = elements.length; i--;) {
                elements[i].classList.remove('show');
            }
        }

        if (!e || !(parent && parent.classList.contains('js-dropdown-account'))) {
            $('.fm-breadcrumbs-block .dropdown').removeClass('active');
        }
    };

    $('#pageholder, #startholder', 'body').rebind('mousedown.hidetopmenu', function(e) {
        if (typeof $.hideTopMenu === 'function') {
            $.hideTopMenu(e);
        }
    });

    $headerAchievements.rebind('click.achievements', function() {
        mega.achievem.achievementsListDialog();
    });

    $headerDownloadMega.rebind('click.downloadmega', function() {
        mega.redirect('mega.io', 'desktop', false, false, false);
    });

    // try individual button in business mode
    $headerIndividual.rebind('click.individual', function() {
        if (page === 'business') {
            sessionStorage.setItem('pro.subsection', 'individual');
            loadSubPage('pro');
        }
        else if (page === 'registerb') {
            loadSubPage('register');
        }
        else if (page === 'register') {
            delay('registermovebusevlog', () => eventlog(99794));
            loadSubPage('registerb');
        }
        else {
            if (folderlink) {
                eventlog(99750);
            }
            if (page === 'login') {
                delay('loginmovebusevlog', () => eventlog(99795));
            }
            mega.redirect('mega.io', 'business', false, false, false);
        }
    });

    $('.js-more-menu, .top-icon.menu', '.fmholder').rebind('click.openmenu', function() {
        if ($.liTooltipTimer) {
            clearTimeout($.liTooltipTimer);
        }
        topMenu();
    });

    $('.close', $topMenu).rebind('click.closemenu', function() {
        topMenu(1);
    });

    $('.top-user-status-popup .dropdown-item', $topHeader)
        .rebind('click.topui', function (e) {
            var $this = $(this);

            if ($this.attr('class').indexOf('active') === -1) {
                $topHeader.find('.top-user-status-popup .dropdown-item')
                    .removeClass('active');
                $headerActivityBlock.removeClass('active');

                if (!megaChatIsReady && !megaChatIsDisabled) {
                    var presence = $(this).data("presence");
                    localStorage.megaChatPresence = presence;
                    localStorage.megaChatPresenceMtime = unixtime();

                    $headerActivityBlock.addClass("fadeinout");
                    loadSubPage('fm/chat');
                }
            }
        });

    $('.top-menu-item, .logout', $topMenu)
        // eslint-disable-next-line complexity -- @todo refactor
        .rebind('click.menuitem tap.menuitem', function(ev) {
            var $this = $(this);
            var className = $this.attr('class') || '';

            if (className.indexOf('submenu-item') > -1) {
                if (className.indexOf('expanded') > -1) {

                    $(this).removeClass('expanded');
                }
                else {
                    $(this).addClass('expanded');
                }
                if (!is_mobile) {

                    delay('sideMenuScroll', function() {
                        topMenuScroll($('.top-menu-scroll', $topMenu));
                    }, 200);
                }
            }
            else if (className.indexOf('cookies-settings') > -1) {
                topMenu(1);
                if ('csp' in window) {
                    csp.trigger().dump('csp.trigger');
                }
            }
            else {
                if ($('.light-overlay', 'body').is(':visible')) {
                    loadingInitDialog.hide();
                }

                topMenu(1);

                // Close node Info panel as not applicable after switching pages
                if (mega.ui.mInfoPanel) {
                    mega.ui.mInfoPanel.closeIfOpen();
                }

                var subpage;
                /*  TODO: Add bird when its done */
                var subPages = [
                    'about', 'account', 'achievements', 'affiliate', 'bug-bounty', 'business',
                    'chatandmeetings', 'cmd', 'collaboration', 'contact', 'cookie', 'copyright',
                    'corporate', 'credits', 'desktop', 'developers', 'dispute', 'doc',
                    'extensions', 'keybackup', 'login', 'media', 'mega', 'megabackup', 'mobile',
                    'mobileapp', 'nas', 'objectstorage',
                    'privacy', 'pro', 'register', 'reliability', 'resellers', 'sdk',
                    'securechat', 'security', 'share', 'sitemap', 'sourcecode', 'special',
                    'start', 'storage', 'support', 'syncing', 'takedown', 'terms', 'transparency'
                ];
                const ioPages = [
                    'about', 'achievements', 'affiliate', 'bug-bounty', 'business',
                    'chatandmeetings', 'cmd', 'collaboration', 'contact', 'cookie', 'copyright',
                    'corporate', 'desktop', 'developers', 'dispute', 'doc', 'extensions', 'media',
                    'megabackup', 'mobile', 'mobileapp', 'nas', 'objectstorage', 'privacy',
                    'reliability', 'resellers', 'sdk', 'securechat', 'security', 'share',
                    'sourcecode', 'storage', 'syncing', 'takedown', 'terms', 'transparency'
                ];
                var moveTo = {
                    account: 'fm/account',
                    affiliate: 'refer',
                    corporate: 'media',
                    collaboration: 'share',
                    securechat: 'chatandmeetings',
                };

                for (var i = subPages.length; i--;) {
                    if (this.classList.contains(subPages[i])) {
                        subpage = subPages[i];
                        break;
                    }
                }

                if (is_mobile && className.indexOf('fm') > -1) {
                    mobile.loadCloudDrivePage();
                }
                else if (!is_mobile && subpage === 'keybackup') {
                    M.showRecoveryKeyDialog(2);
                }
                else if (subpage === 'cookie' && mega.flags.ab_adse) {
                    window.open(`${getBaseUrl()}/cookie`, '_blank', 'noopener,noreferrer');
                }
                else if (subpage) {
                    if (ioPages.includes(subpage)) {
                        mega.redirect('mega.io', moveTo[subpage] || subpage, false, false, false);
                        return false;
                    }
                    // Clear login_next variable before load subpages each time
                    login_next = false;

                    if (is_mobile && subpage === 'keybackup') {
                        eventlog(99853);
                    }

                    loadSubPage(moveTo[subpage] || subpage);
                }
                else if (className.indexOf('feedback') > -1) {
                    // Show the Feedback dialog
                    var feedbackDialog = mega.ui.FeedbackDialog.singleton($(this));
                    feedbackDialog._type = 'top-button';
                }
                else if (className.indexOf('refresh') > -1) {
                    if (is_mobile) {
                        eventlog(99852);
                    }
                    M.reload(ev.ctrlKey || ev.metaKey);
                }
                else if (!is_mobile && className.indexOf('languages') > -1) {
                    langDialog.show();
                }
                else if (className.indexOf('logout') > -1) {
                    mLogout();
                }
                else if (className.includes('help')) {
                    window.open(l.mega_help_host, '_blank', 'noopener');
                }
                else if (className.includes('blog')) {
                    window.open('https://blog.mega.io', '_blank', 'noopener');
                }
                else if (className.includes('jobs') || className.includes('careers')) {
                    window.open('https://careers.mega.nz', '_blank', 'noopener');
                }
            }
            return false;
        });

    $menuUserinfo.rebind('click.openaccount', function() {
        topMenu(1);
        loadSubPage('fm/account');
    });

    $menuUpgradeAccount.rebind('click.openpricing', function() {
        if (is_mobile) {
            eventlog(99851);
        }

        topMenu(1);
        loadSubPage('pro');
    });

    // Old version lang menu, need to deprecate it once new menu fully applied on logged out pages
    if (is_mobile) {
        mobile.languageMenu.oldMenu();
    }

    // Hover tooltip for top-menu elements and sidebar icons
    $('.nw-fm-left-icon, .js-top-buttons').rebind('mouseover.nw-fm-left-icon', function() {
        var $this = $(this);
        var $tooltip = $this.find('.dark-tooltip');
        var tooltipPos;
        var tooltipWidth;
        var buttonPos;

        if ($.liTooltipTimer) {
            clearTimeout($.liTooltipTimer);
        }
        $.liTooltipTimer = window.setTimeout(
            function () {
                if (!$tooltip.parent().is(':visible')) {
                    return;
                }
                if ($tooltip.hasClass('top')) {
                    tooltipWidth = $tooltip.outerWidth();
                    buttonPos = $this.position().left;
                    tooltipPos = buttonPos + $this.outerWidth() / 2 - tooltipWidth / 2;
                    if ($(document.body).width() - ($this.offset().left + tooltipPos + tooltipWidth) > 0) {
                        $tooltip.css({
                            'left': tooltipPos,
                            'right': 'auto'
                        });
                    }
                    else {
                        $tooltip.css({
                            'left': 'auto',
                            'right': 0
                        });
                    }
                }
                $tooltip.addClass('hovered');
            }, 100);
    })
        .rebind('mouseout.nw-fm-left-icon', function () {
            $(this).find('.dark-tooltip').removeClass('hovered');
            clearTimeout($.liTooltipTimer);
        });

    // If the user name in the header is clicked, take them to the account overview page
    $('.user-name', $topHeader).rebind('click.showaccount', function() {
        loadSubPage('fm/account');
    });

    // If the main Mega M logo in the header is clicked
    $('.logo, .logo-full', '.top-head, .fm-main, .bar-table').rebind('click', () => {
        if (typeof loadingInitDialog === 'undefined' || !loadingInitDialog.active) {
            loadSubPage(u_type ? 'fm' : 'start');
        }
    });

    /**
     * this is closing the EFQ email confirm dialog, if needed for something else ask before re-enabling [dc]
    if (!$('.mega-dialog.registration-page-success').hasClass('hidden')) {
        $('.mega-dialog.registration-page-success').addClass('hidden');
        $('.fm-dialog-overlay').addClass('hidden');
        document.body.classList.remove('overlayed');
    }*/

    /**
     * why was this needed here?
    if (ulmanager.isUploading || dlmanager.isDownloading) {
        $('.widget-block').removeClass('hidden');
    }*/

    $('.widget-block').rebind('click', function (e) {
        if ($.infoscroll && page == 'download') {
            startpageMain();
        }
        else if ($.dlhash) {
            // XXX TODO FIXME check this
            loadSubPage($.dlhash);
        }
        else if (folderlink && M.lastSeenFolderLink) {
            mBroadcaster.once('mega:openfolder', SoonFc(function () {
                $('.nw-fm-left-icon.transfers').click();
            }));
            loadSubPage(M.lastSeenFolderLink);
        }
        else {
            loadSubPage('fm');
        }
    });

    // Initialise the header icon for mobile
    if (is_mobile) {
        mobile.initHeaderMegaIcon();
    }

    // Initialise notification popup and tooltip
    if (typeof notify === 'object') {
        notify.init();
    }

    if (u_type === 3 && mega.ui.passwordReminderDialog) {
        if (is_mobile) {
            mega.ui.passwordReminderDialog.prepare();
        }
        else {
            mega.ui.passwordReminderDialog.onTopmenuReinit();
        }
    }
}

function is_fm() {
    var r = !!pfid;

    if (typeof page !== 'string') {
        if (d) {
            console.error(`Unexpected page '${window.page}'`, window.page);
        }
        page = String(window.page || '');
    }

    if (!r && (u_type !== false)) {
        r = page === '' || page === 'start' || page === 'index'
            || page.substr(0, 2) === 'fm' || page.substr(0, 7) === 'account';
    }

    if (!r && page.substr(0, 4) === "chat") {
        r = true;
    }

    if (d > 2) {
        console.warn('is_fm', r, page, hash);
    }

    return r;
}

/**
 *  Process a given template (which has been loaded already in `pages[]`)
 *  and return the translated HTML code.
 *
 *  @param {String} name    Template name
 *  @returns {String}       The HTML ready to be used
 */
function getTemplate(name) {

    return translate('' + pages[name]).replace(/{staticpath}/g, staticpath);
}

function pagemetadata() {
    'use strict';
    if (window.is_karma) {
        return;
    }
    const page = String(window.page || '');
    var metas = mega.metatags.getPageMetaTags(page);
    var mega_desc = metas.mega_desc || mega.whoami;
    mega_title = metas.mega_title || 'MEGA';

    $('meta[name=description]').remove();
    $('head').append('<meta name="description" content="' + String(mega_desc).replace(/[<">]/g, '') + '">');
    document.title = mega_title;
    megatitle();

    if (pagemetadata.last !== page) {
        mBroadcaster.sendMessage('pagemetadata', metas);
    }
    pagemetadata.last = page;
}

pagemetadata.last = null;


function parsepage(pagehtml) {
    'use strict';

    $('#fmholder, #pageholder, #startholder').addClass('hidden');
    pagemetadata();

    pagehtml = translate('' + pagehtml).replace(/{staticpath}/g, staticpath);

    if (pagehtml.indexOf('((TOP))') > -1) {
        pagehtml = pagehtml.replace(/\(\(TOP\)\)/g, parsetopmenu());
    }
    if (pagehtml.indexOf('((BOTTOM))') > -1) {
        pagehtml = pagehtml.replace(/\(\(BOTTOM\)\)/g, translate(pages.bottom2));
    }
    if (pagehtml.indexOf('((PAGESMENU))') > -1) {
        pagehtml = pagehtml.replace(/\(\(PAGESMENU\)\)/g, translate(pages.pagesmenu));
    }
    if (is_chrome_web_ext || is_firefox_web_ext) {
        pagehtml = pagehtml.replace(/\/#/g, '/' + urlrootfile + '#');
    }

    if (!$.mTransferWidgetPage && pages.transferwidget) {
        $.mTransferWidgetPage = translate(pages.transferwidget);
    }
    pagehtml = (($.mTransferWidgetPage || '') + pagehtml).replace(/{staticpath}/g, staticpath);

    $('#startholder').safeHTML(pagehtml).removeClass('hidden');

    // With new mobile page render, startholder page should not have M.currentdirid kept to avoid bug
    if (is_mobile) {
        delete M.currentdirid;
    }

    // if this is bottom page & not Download Page we have to enforce light mode for now.
    if (page === 'download') {
        mega.ui.setTheme();
    }
    else {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light', 'bottom-pages');
    }

    $('body, html, .bottom-pages .fmholder').stop(true, true).scrollTop(0);
    bottompage.init();

    if (typeof M.initUIKeyEvents === 'function') {
        M.initUIKeyEvents();
    }
    onIdle(clickURLs);
    onIdle(scrollToURLs);
    onIdle(topmenuUI);
}

function parsetopmenu() {
    var top;

    if (is_mobile) {
        top = pages['top-mobile'].replace(/{staticpath}/g, staticpath);
    }
    else {
        top = pages['top'].replace(/{staticpath}/g, staticpath);
    }
    if (is_chrome_web_ext || is_firefox_web_ext) {
        top = top.replace(/\/#/g, '/' + urlrootfile + '#');
    }
    top = top.replace("{avatar-top}", window.useravatar && useravatar.mine() || '');
    top = translate(top);
    return top;
}


function loadSubPage(tpage, event) {
    'use strict';

    tpage = getCleanSitePath(tpage);

    if ('rad' in mega) {
        mega.rad.log('NAV', [page, tpage, !!event]);
    }

    if (typeof dlPageCleanup === 'function' && tpage[0] !== '!') {
        dlPageCleanup();
    }

    if (window.slideshowid) {
        mBroadcaster.sendMessage('trk:event', 'preview', 'close-nav', tpage, slideshowid);

        slideshow(0, 1);
    }

    if (window.textEditorVisible) {
        // if we are loading a page and text editor was visible, then hide it.
        mega.textEditorUI.doClose();
    }

    if (window.versiondialogid) {
        fileversioning.closeFileVersioningDialog(window.versiondialogid);
    }

    if (event && Object(event.state).view) {
        onIdle(function() {
            slideshow(event.state.view);
        });
        return false;
    }

    if (folderlink) {
        flhashchange = true;
    }
    else if (tpage === page) {
        return false;
    }

    if (M.chat && megaChatIsReady) {
        // navigating within the chat, skip the bloatware
        // xxx: if there is a page containing "chat" but not belonging to chat, megaChat.navigate() should take care.
        if (tpage.includes('chat')) {
            if (fminitialized && tpage.startsWith("chat/")) {
                // tried to navigate internally to a chat link, do a force redirect.
                // Can be triggered by the back button.
                tpage = `fm/chat/c/${megaChat.initialChatId || tpage.substr(5)}`;
            }
            megaChat.navigate(tpage, event).catch(dump);
            return false;
        }

        // clear the flag if navigating to an static page..
        M.chat = tpage.substr(0, 2) === 'fm';
        if (!M.chat) {
            megaChat.cleanup(true);
        }
    }

    // TODO: check what this was for and its relevance
    var overlay = document.getElementById('overlay');
    if (overlay && overlay.style.display == '' && !is_fm()) {
        document.location.hash = hash;
        return false;
    }

    mBroadcaster.sendMessage('beforepagechange', tpage);
    if (window.is_chatlink) {
        window.is_chatlink = false;
        delete M.currentdirid;

        if (megaChatIsReady) {
            delete megaChat.initialPubChatHandle;
            megaChat.destroy();
        }
    }
    dlid = false;

    if (tpage) {
        page = tpage;
    }
    else {
        page = '';
    }

    let hold;
    if (page) {
        const tmp = [];

        for (var p in subpages) {
            if (page.substr(0, p.length) === p) {
                for (var i in subpages[p]) {
                    if (!jsl_loaded[jsl2[subpages[p][i]].n]) {
                        tmp.push(jsl2[subpages[p][i]]);
                    }
                }
            }
        }

        if (tmp.length) {
            if (d) {
                console.info('loadSubPage: About to load required resources...', tmp);
            }

            if (jsl.length) {
                if (d) {
                    console.warn('loadSubPage: There are pending requests running, holding it..');
                }

                var oldSL = silent_loading;
                silent_loading = function() {
                    if (oldSL) {
                        tryCatch(oldSL)();
                    }
                    page = false;
                    loadSubPage(tpage, event);
                };

                return;
            }

            jsl = tmp;
            hold = true;
        }
    }

    if (event && event.type === 'popstate' || event === 'override') {
        // In case we navigated to a location.hash, clean it up replacing the current history entry.
        pushHistoryState(true, page);
    }
    else {
        pushHistoryState(page);
    }

    // since hash changing above will fire popstate event, which in its turn will call
    // loadsubpage again. We will end up in folderlinks issue when they are decrypted with a provided key.
    if (page !== '' && page !== tpage) {
        if (d) {
            console.warn('LoadSubPage arrived to IF statement proving race-condition');
        }
        return false;
    }

    if (hold) {
        loadingDialog.show('jsl-loader');
        jsl_start();
    }
    else {
        init_page();
    }
    mBroadcaster.sendMessage('pagechange', tpage);
}

window.addEventListener('popstate', function(event) {
    'use strict';

    var state = event.state || {};
    var add = state.searchString || '';
    loadSubPage((state.subpage || state.fmpage || getCleanSitePath() || location.hash) + add, event);
}, {
    capture: true,
    passive: true,
});

window.addEventListener('beforeunload', () => {
    'use strict';

    if ('rad' in mega) {
        mega.rad.flush().dump('rad.flush');
    }

    if (megaChatIsReady && megaChat.activeCall) {
        megaChat.playSound(megaChat.SOUNDS.ALERT);
        return false;
    }

    if (window.dlmanager && (dlmanager.isDownloading || ulmanager.isUploading)) {
        return $.memIOSaveAttempt ? null : l[377];
    }

    if (window.fmdb && window.currsn && fminitialized
        && Object(fmdb.pending).length && Object.keys(fmdb.pending[0] || {}).length) {

        setsn(currsn);
        return l[16168];
    }

    if (window.doUnloadLogOut) {
        u_logout();
        delete window.doUnloadLogOut;
    }
    mBroadcaster.crossTab.leave();

}, {capture: true});

window.addEventListener('unload', () => {
    'use strict';
    if (window.doUnloadLogOut) {
        u_logout();
    }
    mBroadcaster.crossTab.leave();

    if (typeof dlpage_ph === 'string') {
        // Clear the download activity flag navigating away on the downloads page.
        dlmanager.dlClearActiveTransfer(dlpage_ph);
    }
}, {capture: true});

mBroadcaster.once('startMega', () => {
    'use strict';
    // Based on https://github.com/GoogleChromeLabs/page-lifecycle

    const getState = () => {
        return document.visibilityState === 'hidden' ? 'hidden' : document.hasFocus() ? 'active' : 'passive';
    };
    let state = getState();

    const onStateChange = (event) => {
        const nextState = (
            event.type === 'pagehide'
                ? event.persisted ? 'frozen' : 'terminated'
                : event.type === 'freeze' ? 'frozen' : getState()
        );
        const prevState = state;

        if (nextState !== prevState) {
            if (d) {
                const date = new Date().toISOString();
                console.info(`[${date}] Page state change from event ${event.type}, ${prevState} -> ${nextState}`);
            }
            state = nextState;

            mBroadcaster.sendMessage('statechange', {prevState, state, event});

            if ('rad' in mega) {
                mega.rad.flush().dump('rad.flush');
            }
        }
    };

    if (!self.is_karma) {
        const EVENTS = ['blur', 'focus', 'freeze', 'pageshow', 'pagehide', 'resume', 'visibilitychange'];

        for (let i = EVENTS.length; i--;) {
            addEventListener(EVENTS[i], onStateChange, true);
        }
    }
});

mBroadcaster.once('boot_done', () => {
    'use strict';
    M = new MegaData();

    if (!self.is_karma) {
        tryCatch(() => {
            Object.defineProperty(self, 'onbeforeunload', {
                value: null,
                writable: false
            });

            Object.defineProperty(self, 'onunload', {
                value: null,
                writable: false
            });
        })();

        Object.defineProperty(mega, 'ensureAccessibility', {
            configurable: true,
            value: tryCatch(() => {

                if (!window.mainlayout) {
                    delete window.mainlayout;
                    Object.defineProperty(window, 'mainlayout', {
                        value: document.getElementById('mainlayout')
                    });
                }
                assert(window.mainlayout && mainlayout.nodeType > 0, l[8642]);
                return 'accessible';
            }, (ex) => {
                window.onerror = null;
                onIdle(() => siteLoadError(ex, 'mainlayout'));

                const data = tryCatch(() =>
                    [...document.body.children]
                        .map(n => n.tagName + (n.id ? `#${n.id}` : `.${n.classList[0] || ''}`))
                )();
                eventlog(99930, String(data || 'N/A').slice(0, 380), true);
            })
        });
    }

    onIdle(() => {
        // Initialise the Public Service Announcement system if loaded
        if (typeof psa !== 'undefined') {
            psa.init().catch(dump.bind(null, 'psa'));
        }
    });

    onIdle(async() => {
        if (window.ethereum && !await M.getPersistentData('reportedMetamask').catch(nop)) {
            eventlog(99791);
            M.setPersistentData('reportedMetamask', true).catch(dump);
        }
    });

    // Currently only used in chat so don't bother trying to register for mobile browsers.
    if (window.isSecureContext && !is_mobile && !is_karma && !is_iframed) {
        onIdle(tryCatch(() => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register(`${is_extension ? '' : '/'}sw.js?v=1`).catch(dump);
            }
        }));
    }

    if (!u_sid) {
        mBroadcaster.sendMessage(mega.flags ? 'global-mega-flags' : 'update-api-search-params');
    }
    else if (self.loginresponse === EBLOCKED) {
        window.startMega = window.eventlog = dump;
        api.setSID(u_sid);
        return api.send('ug');
    }

    // ---------------------------------------------------------------------

    if (d) {
        if (!window.crossOriginIsolated) {
            if (window.crossOriginIsolated === false) {
                console.warn('cross-origin isolation is not enabled...');
            }
            return;
        }

        (function memoryMeasurement() {
            var performMeasurement = tryCatch(function() {
                performance.measureMemory()
                    .then(function(result) {
                        onIdle(memoryMeasurement);
                        console.info('Memory usage:', result);
                    });
            });

            if (!performance.measureMemory) {
                console.debug('performance.measureMemory() is not available.');
                return;
            }
            var interval = -Math.log(Math.random()) * 2e4;
            console.info('Scheduling memory measurement in %d seconds.', Math.round(interval / 1e3));
            setTimeout(performMeasurement, interval);
        })();
    }
});

mBroadcaster.addListener('fm:initialized', () => {
    'use strict';

    if (folderlink) {
        return;
    }

    onIdle(() => {
        // Add the dynamic notifications
        if (typeof notify.addDynamicNotifications !== 'undefined') {
            notify.addDynamicNotifications().catch(dump);
        }
    });

    return 0xDEAD;
});

// After open folder call, check if we should restore any previously opened preview node.
mBroadcaster.once('mega:openfolder', () => {
    'use strict';

    const {previewNode} = sessionStorage;
    if (previewNode) {
        sessionStorage.removeItem('previewNode');

        // No need to re-initiate preview when on Album page
        if (!M.isAlbumsPage()) {
            slideshow(previewNode);
        }
    }

    // Send some data to mega.io that we logged in
    if (u_type > 2) {
        initMegaIoIframe(true);
    }

    return 0xDEAD;
});

mBroadcaster.addListener('global-mega-flags', () => {
    'use strict';

    mBroadcaster.sendMessage('update-api-search-params');
});

mBroadcaster.addListener('update-api-search-params', async() => {
    'use strict';
    if (!self.M) {
        return;
    }

    let qs = null;
    const {apiut: ut, jid, afo} = localStorage;

    if (mega.flags.jid && !localStorage.njt) {
        let j = jid || await M.getPersistentData('jid').catch(nop);
        if (!j) {
            localStorage.jid = j = mega.flags.jid;
            M.setPersistentData('jid', j).catch(dump);
        }
        qs = {...qs, j};
    }

    if (ut) {

        qs = {...qs, ut};
    }

    if (afo) {

        qs = {...qs, ...JSON.parse(afo)};
    }

    api.recycleURLSearchParams('ut,j', qs);
});

var ext = {};
var extensions = {
    'threed': [['3ds', '3dm', 'max', 'obj'], '3D'],
    'aftereffects': [['aep', 'aet'], 'Adobe Aftereffects'],
    'audio': [['mp3', 'wav', '3ga', 'aif', 'aiff', 'flac', 'iff', 'm4a', 'wma'], 'Audio'],
    'cad': [['dxf', 'dwg'], 'CAD'],
    'compressed': [['zip', 'rar', 'tgz', 'gz', 'bz2', 'tbz', 'tar', '7z', 'sitx'], 'Compressed'],
    'dmg': [['dmg'], 'Disk Image'],
    'excel': [['xls', 'xlsx', 'xlt', 'xltm'], 'Excel'],
    'executable': [['exe', 'com', 'bin', 'apk', 'app', 'msi', 'cmd', 'gadget'], 'Executable'],
    'font': [['fnt', 'otf', 'ttf', 'fon'], 'Font'],
    'generic': [['*'], 'File'],
    'illustrator': [['ai', 'ait'], 'Adobe Illustrator'],
    'image': [['gif', 'tiff', 'tif', 'bmp', 'png', 'tga', 'jpg', 'jpeg', 'jxl', 'heic', 'webp', 'avif'], 'Image'],
    'indesign': [['indd'], 'Adobe InDesign'],
    'keynote': [['key'], 'Apple Keynote'],
    'mega': [['megaignore'], 'Mega Ignore'],
    'numbers': [['numbers'], 'Apple Numbers'],
    'openoffice': [['sxw', 'stw', 'sxc', 'stc', 'sxi', 'sti', 'sxd', 'std', 'sxm'], 'OpenOffice'],
    'pages': [['pages'], 'Apple Pages'],
    'pdf': [['pdf'], 'PDF'],
    'photoshop': [['abr', 'psb', 'psd'], 'Adobe Photoshop'],
    'powerpoint': [['pps', 'ppt', 'pptx'], 'Powerpoint'],
    'premiere': [['prproj', 'ppj'], 'Adobe Premiere'],
    'experiencedesign': [['xd'], 'Adobe XD'],
    'raw': [
        Object.keys(is_image.raw)
            .map(function(e) {
                'use strict';
                return e.toLowerCase();
            }),
        l[20240] || 'RAW Image'
    ],
    'sketch': [['sketch'], 'Sketch'],
    'spreadsheet': [['ods', 'ots', 'gsheet', 'nb', 'xlr'], 'Spreadsheet'],
    'torrent': [['torrent'], 'Torrent'],
    'text': [['txt', 'ans', 'ascii', 'log', 'wpd', 'json', 'md', 'org'], 'Text', 'pages'],
    'vector': [['svgz', 'svg', 'cdr', 'eps'], 'Vector'],
    'video': [['mkv', 'webm', 'avi', 'mp4', 'm4v', 'mpg', 'mpeg', 'mov', '3g2', '3gp', 'asf', 'wmv', 'vob'], 'Video'],
    'web-data': [['html', 'xml', 'shtml', 'dhtml', 'js', 'css', 'jar', 'java', 'class'], 'Web Client Code'],
    'web-lang': [[
        'php', 'php3', 'php4', 'php5', 'phtml', 'inc', 'asp', 'pl', 'cgi', 'py', 'sql', 'accdb', 'db', 'dbf', 'mdb',
        'pdb', 'c', 'cpp', 'h', 'cs', 'sh', 'vb', 'swift'], 'Web Server Code'],
    'word': [['doc', 'docx', 'dotx', 'wps', 'odt', 'rtf'], 'MS Word']
};

var extmime = {
    "3ds": "image/x-3ds",
    "3g2": "video/3gpp2",
    "3gp": "video/3gpp",
    "7z": "application/x-7z-compressed",
    "aac": "audio/x-aac",
    "abw": "application/x-abiword",
    "ace": "application/x-ace-compressed",
    "adp": "audio/adpcm",
    "aif": "audio/x-aiff",
    "aifc": "audio/x-aiff",
    "aiff": "audio/x-aiff",
    "apk": "application/vnd.android.package-archive",
    "asf": "video/x-ms-asf",
    "asx": "video/x-ms-asf",
    "atom": "application/atom+xml",
    "au": "audio/basic",
    "avi": "video/x-msvideo",
    "avif": "image/avif",
    "bat": "application/x-msdownload",
    "bmp": "image/bmp",
    "btif": "image/prs.btif",
    "bz": "application/x-bzip",
    "bz2": "application/x-bzip2",
    "caf": "audio/x-caf",
    "cgm": "image/cgm",
    "cmx": "image/x-cmx",
    "com": "application/x-msdownload",
    "conf": "text/plain",
    "css": "text/css",
    "csv": "text/csv",
    "dbk": "application/docbook+xml",
    "deb": "application/x-debian-package",
    "def": "text/plain",
    "djv": "image/vnd.djvu",
    "djvu": "image/vnd.djvu",
    "dll": "application/x-msdownload",
    "dmg": "application/x-apple-diskimage",
    "doc": "application/msword",
    "docm": "application/vnd.ms-word.document.macroenabled.12",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "dot": "application/msword",
    "dotm": "application/vnd.ms-word.template.macroenabled.12",
    "dotx": "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
    "dra": "audio/vnd.dra",
    "dtd": "application/xml-dtd",
    "dts": "audio/vnd.dts",
    "dtshd": "audio/vnd.dts.hd",
    "dvb": "video/vnd.dvb.file",
    "dwg": "image/vnd.dwg",
    "dxf": "image/vnd.dxf",
    "ecelp4800": "audio/vnd.nuera.ecelp4800",
    "ecelp7470": "audio/vnd.nuera.ecelp7470",
    "ecelp9600": "audio/vnd.nuera.ecelp9600",
    "emf": "application/x-msmetafile",
    "emz": "application/x-msmetafile",
    "eol": "audio/vnd.digital-winds",
    "epub": "application/epub+zip",
    "exe": "application/x-msdownload",
    "f4v": "video/x-f4v",
    "fbs": "image/vnd.fastbidsheet",
    "fh": "image/x-freehand",
    "fh4": "image/x-freehand",
    "fh5": "image/x-freehand",
    "fh7": "image/x-freehand",
    "fhc": "image/x-freehand",
    "flac": "audio/x-flac",
    "fli": "video/x-fli",
    "flv": "video/x-flv",
    "fpx": "image/vnd.fpx",
    "fst": "image/vnd.fst",
    "fvt": "video/vnd.fvt",
    "g3": "image/g3fax",
    "gif": "image/gif",
    "h261": "video/h261",
    "h263": "video/h263",
    "h264": "video/h264",
    "heif": "image/heif",
    "heic": "image/heic",
    "htm": "text/html",
    "html": "text/html",
    "ico": "image/x-icon",
    "ief": "image/ief",
    "iso": "application/x-iso9660-image",
    "jpe": "image/jpeg",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "jpgm": "video/jpm",
    "jpgv": "video/jpeg",
    "jpm": "video/jpm",
    "json": "application/json",
    "jxl": "image/jxl",
    "jsonml": "application/jsonml+json",
    "kar": "audio/midi",
    "ktx": "image/ktx",
    "list": "text/plain",
    "log": "text/plain",
    "lvp": "audio/vnd.lucent.voice",
    "m13": "application/x-msmediaview",
    "m14": "application/x-msmediaview",
    "m1v": "video/mpeg",
    "m21": "application/mp21",
    "m2a": "audio/mpeg",
    "m2v": "video/mpeg",
    "m3a": "audio/mpeg",
    "m3u": "audio/x-mpegurl",
    "m3u8": "application/vnd.apple.mpegurl",
    "m4a": "audio/mp4",
    "m4u": "video/vnd.mpegurl",
    "m4v": "video/x-m4v",
    "mdi": "image/vnd.ms-modi",
    "mid": "audio/midi",
    "midi": "audio/midi",
    "mj2": "video/mj2",
    "mjp2": "video/mj2",
    "mk3d": "video/x-matroska",
    "mka": "audio/x-matroska",
    "mks": "video/x-matroska",
    "mkv": "video/x-matroska",
    "mmr": "image/vnd.fujixerox.edmics-mmr",
    "mng": "video/x-mng",
    "mov": "video/quicktime",
    "movie": "video/x-sgi-movie",
    "mp2": "audio/mpeg",
    "mp21": "application/mp21",
    "mp2a": "audio/mpeg",
    "mp3": "audio/mpeg",
    "mp4": "video/mp4",
    "mp4a": "audio/mp4",
    "mp4s": "application/mp4",
    "mp4v": "video/mp4",
    "mpe": "video/mpeg",
    "mpeg": "video/mpeg",
    "mpg": "video/mpeg",
    "mpg4": "video/mp4",
    "mpga": "audio/mpeg",
    "mpkg": "application/vnd.apple.installer+xml",
    "msi": "application/x-msdownload",
    "mvb": "application/x-msmediaview",
    "mxf": "application/mxf",
    "mxml": "application/xv+xml",
    "mxu": "video/vnd.mpegurl",
    "npx": "image/vnd.net-fpx",
    "odb": "application/vnd.oasis.opendocument.database",
    "odc": "application/vnd.oasis.opendocument.chart",
    "odf": "application/vnd.oasis.opendocument.formula",
    "odft": "application/vnd.oasis.opendocument.formula-template",
    "odg": "application/vnd.oasis.opendocument.graphics",
    "odi": "application/vnd.oasis.opendocument.image",
    "odm": "application/vnd.oasis.opendocument.text-master",
    "odp": "application/vnd.oasis.opendocument.presentation",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",
    "odt": "application/vnd.oasis.opendocument.text",
    "oga": "audio/ogg",
    "ogg": "audio/ogg",
    "ogv": "video/ogg",
    "ogx": "application/ogg",
    "otc": "application/vnd.oasis.opendocument.chart-template",
    "otg": "application/vnd.oasis.opendocument.graphics-template",
    "oth": "application/vnd.oasis.opendocument.text-web",
    "oti": "application/vnd.oasis.opendocument.image-template",
    "otp": "application/vnd.oasis.opendocument.presentation-template",
    "ots": "application/vnd.oasis.opendocument.spreadsheet-template",
    "ott": "application/vnd.oasis.opendocument.text-template",
    "oxt": "application/vnd.openofficeorg.extension",
    "pbm": "image/x-portable-bitmap",
    "pct": "image/x-pict",
    "pcx": "image/x-pcx",
    "pdf": "application/pdf",
    "pgm": "image/x-portable-graymap",
    "pic": "image/x-pict",
    "plb": "application/vnd.3gpp.pic-bw-large",
    "png": "image/png",
    "pnm": "image/x-portable-anymap",
    "pot": "application/vnd.ms-powerpoint",
    "potx": "application/vnd.openxmlformats-officedocument.presentationml.template",
    "ppm": "image/x-portable-pixmap",
    "pps": "application/vnd.ms-powerpoint",
    "ppsx": "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "psb": "application/vnd.3gpp.pic-bw-small",
    "psd": "image/vnd.adobe.photoshop",
    "pvb": "application/vnd.3gpp.pic-bw-var",
    "pya": "audio/vnd.ms-playready.media.pya",
    "pyv": "video/vnd.ms-playready.media.pyv",
    "qt": "video/quicktime",
    "ra": "audio/x-pn-realaudio",
    "ram": "audio/x-pn-realaudio",
    "ras": "image/x-cmu-raster",
    "rgb": "image/x-rgb",
    "rip": "audio/vnd.rip",
    "rlc": "image/vnd.fujixerox.edmics-rlc",
    "rmi": "audio/midi",
    "rmp": "audio/x-pn-realaudio-plugin",
    "s3m": "audio/s3m",
    "sgi": "image/sgi",
    "sgm": "text/sgml",
    "sgml": "text/sgml",
    "sid": "image/x-mrsid-image",
    "sil": "audio/silk",
    "sldx": "application/vnd.openxmlformats-officedocument.presentationml.slide",
    "smv": "video/x-smv",
    "snd": "audio/basic",
    "spx": "audio/ogg",
    "srt": "application/x-subrip",
    "sub": "text/vnd.dvb.subtitle",
    "svg": "image/svg+xml",
    "svgz": "image/svg+xml",
    "swf": "application/x-shockwave-flash",
    "tcap": "application/vnd.3gpp2.tcap",
    "text": "text/plain",
    "tga": "image/x-tga",
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "torrent": "application/x-bittorrent",
    "tsv": "text/tab-separated-values",
    "ttl": "text/turtle",
    "txt": "text/plain",
    "udeb": "application/x-debian-package",
    "uva": "audio/vnd.dece.audio",
    "uvg": "image/vnd.dece.graphic",
    "uvh": "video/vnd.dece.hd",
    "uvi": "image/vnd.dece.graphic",
    "uvm": "video/vnd.dece.mobile",
    "uvp": "video/vnd.dece.pd",
    "uvs": "video/vnd.dece.sd",
    "uvu": "video/vnd.uvvu.mp4",
    "uvv": "video/vnd.dece.video",
    "uvva": "audio/vnd.dece.audio",
    "uvvg": "image/vnd.dece.graphic",
    "uvvh": "video/vnd.dece.hd",
    "uvvi": "image/vnd.dece.graphic",
    "uvvm": "video/vnd.dece.mobile",
    "uvvp": "video/vnd.dece.pd",
    "uvvs": "video/vnd.dece.sd",
    "uvvu": "video/vnd.uvvu.mp4",
    "uvvv": "video/vnd.dece.video",
    "viv": "video/vnd.vivo",
    "vob": "video/x-ms-vob",
    "wav": "audio/x-wav",
    "wax": "audio/x-ms-wax",
    "wbmp": "image/vnd.wap.wbmp",
    "wdp": "image/vnd.ms-photo",
    "weba": "audio/webm",
    "webm": "video/webm",
    "webp": "image/webp",
    "wm": "video/x-ms-wm",
    "wma": "audio/x-ms-wma",
    "wmf": "application/x-msmetafile",
    "wmv": "video/x-ms-wmv",
    "wmx": "video/x-ms-wmx",
    "wvx": "video/x-ms-wvx",
    "xap": "application/x-silverlight-app",
    "xbm": "image/x-xbitmap",
    "xht": "application/xhtml+xml",
    "xhtml": "application/xhtml+xml",
    "xhvml": "application/xv+xml",
    "xif": "image/vnd.xiff",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xltx": "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
    "xm": "audio/xm",
    "xml": "application/xml",
    "xop": "application/xop+xml",
    "xpl": "application/xproc+xml",
    "xpm": "image/x-xpixmap",
    "xsl": "application/xml",
    "xslt": "application/xslt+xml",
    "xspf": "application/xspf+xml",
    "xvm": "application/xv+xml",
    "xvml": "application/xv+xml",
    "xwd": "image/x-xwindowdump",
    "zip": "application/zip",

    // RAW Images
    "3fr": "image/x-hasselblad-3fr",
    "ari": "image/z-arrialexa-ari",
    "arw": "image/x-sony-arw",
    "arq": "image/x-sony-arq",
    "bay": "image/x-casio-bay",
    "bmq": "image/x-nucore-bmq",
    "cap": "image/x-phaseone-cap",
    "cr2": "image/x-canon-cr2",
    "cr3": "image/x-canon-cr3",
    "crw": "image/x-canon-crw",
    "cs1": "image/x-sinar-cs1",
    "dc2": "image/x-kodak-dc2",
    "dcr": "image/x-kodak-dcr",
    "dng": "image/x-dcraw",
    "dsc": "image/x-kodak-dsc",
    "drf": "image/x-kodak-drf",
    "erf": "image/x-epson-erf",
    "eip": "image/x-phaseone-eip",
    "fff": "image/x-hasselblad-fff",
    "iiq": "image/x-phaseone-iiq",
    "k25": "image/x-kodak-k25",
    "kc2": "image/x-kodak-kc2",
    "kdc": "image/x-kodak-kdc",
    "mdc": "image/x-monolta-mdc",
    "mef": "image/x-mamiya-mef",
    "mos": "image/x-leaf-mos",
    "mrw": "image/x-minolta-mrw",
    "nef": "image/x-nikon-nef",
    "nrw": "image/x-nikon-nrw",
    "obm": "image/x-olympus-obm",
    "orf": "image/x-olympus-orf",
    "ori": "image/x-olympus-ori",
    "pef": "image/x-pentax-pef",
    "ptx": "image/x-pentax-ptx",
    "pxn": "image/x-logitech-pxn",
    "qtk": "image/x-apple-qtx",
    "raf": "image/x-fuji-raf",
    "raw": "image/x-panasonic-raw",
    "rdc": "image/x-difoma-rdc",
    "rw2": "image/x-panasonic-rw2",
    "rwz": "image/x-rawzor-rwz",
    "rwl": "image/x-leica-rwl",
    "sr2": "image/x-sony-sr2",
    "srf": "image/x-sony-srf",
    "srw": "image/x-samsung-srw",
    "sti": "image/x-sinar-sti",
    "x3f": "image/x-sigma-x3f",
    "ciff": "image/x-canon-crw",
    "cine": "image/x-phantom-cine",
    "ia": "image/x-sinar-ia",

    // Uncommon Images
    "aces": "image/aces",
    "avci": "image/avci",
    "avcs": "image/avcs",
    "fits": "image/fits",
    "g3fax": "image/g3fax",
    "hej2k": "image/hej2k",
    "hsj2": "image/hsj2",
    "jls": "image/jls",
    "jp2": "image/jp2",
    "jph": "image/jph",
    "jphc": "image/jphc",
    "jpx": "image/jpx",
    "jxr": "image/jxr",
    "jxrA": "image/jxrA",
    "jxrS": "image/jxrS",
    "jxs": "image/jxs",
    "jxsc": "image/jxsc",
    "jxsi": "image/jxsi",
    "jxss": "image/jxss",
    "naplps": "image/naplps",
    "pti": "image/prs.pti",
    "t38": "image/t38"
};

mBroadcaster.once('boot_done', () => {
    'use strict';
    const extdesc = {
        '3ds': l[20238],
        '3dm': l[20239],
        '3fr': l[20240],
        '3g2': l[20241],
        '3gp': l[20375],
        '7z': l[20242],
        'accdb': l[20243],
        'aep': l[20244],
        'aet': l[20378],
        'ai': l[20245],
        'aif': l[20246],
        'aiff': l[20246],
        'ait': l[20379],
        'ans': l[20247],
        'apk': l[1890],
        'app': l[20248],
        'arw': l[20240],
        'as': l[20249],
        'asc': l[20250],
        'ascii': l[20251],
        'asf': l[20252],
        'asp': l[20253],
        'aspx': l[20380],
        'asx': l[20254],
        'avi': l[20255],
        'avif': l[23431],
        'bat': l[20256],
        'bay': l[20257],
        'bmp': l[20258],
        'bz2': l[20259],
        'c': l[20260],
        'cc': l[20261],
        'cdr': l[20262],
        'cgi': l[20263],
        'class': l[20264],
        'com': l[20265],
        'cpp': l[20261],
        'cr2': l[20266],
        'css': l[20267],
        'cxx': l[20261],
        'dcr': l[20240],
        'db': l[20376],
        'dbf': l[20376],
        'dhtml': l[20268],
        'dll': l[20269],
        'dng': l[20270],
        'dmg': l[20271],
        'doc': l[20272],
        'docx': l[20381],
        'dotx': l[20273],
        'dwg': l[20274],
        'dwt': l[20275],
        'dxf': l[20276],
        'eps': l[20277],
        'exe': l[20278],
        'fff': l[20240],
        'fla': l[20279],
        'flac': l[20280],
        'flv': l[20281],
        'fnt': l[20282],
        'fon': l[20283],
        'gadget': l[20284],
        'gif': l[20285],
        'gpx': l[20286],
        'gsheet': l[20287],
        'gz': l[20288],
        'h': l[20289],
        'heic': l[20290],
        'hpp': l[20289],
        'htm': l[20291],
        'html': l[20291],
        'iff': l[20292],
        'inc': l[20293],
        'indd': l[20294],
        'iso': l[20295],
        'jar': l[20296],
        'java': l[20297],
        'jpeg': l[20298],
        'jpg': l[20298],
        'js': l[20299],
        'key': l[20300],
        'kml': l[20301],
        'log': l[20302],
        'm3u': l[20303],
        'm4a': l[20304],
        'max': l[20305],
        'mdb': l[20306],
        'mef': l[20240],
        'mid': l[20307],
        'midi': l[20307],
        'mkv': l[20308],
        'mov': l[20309],
        'mp3': l[20310],
        'mpeg': l[20311],
        'mpg': l[20311],
        'mrw': l[20266],
        'msi': l[20312],
        'nb': l[20313],
        'numbers': l[20314],
        'nef': l[20240],
        'obj': l[20315],
        'ods': l[20370],
        'odt': l[20316],
        'otf': l[20317],
        'ots': l[20382],
        'orf': l[20240],
        'pages': l[20318],
        'pcast': l[20319],
        'pdb': l[20377],
        'pdf': l[20320],
        'pef': l[20240],
        'php': l[20321],
        'php3': l[20321],
        'php4': l[20321],
        'php5': l[20321],
        'phtml': l[20322],
        'pl': l[20323],
        'pls': l[20324],
        'png': l[20325],
        'ppj': l[20326],
        'pps': l[20327],
        'ppt': l[20327],
        'pptx': l[20327],
        'prproj': l[20326],
        'ps': l[20328],
        'psb': l[20329],
        'psd': l[20383],
        'py': l[20330],
        'ra': l[20331],
        'ram': l[20384],
        'rar': l[20332],
        'rm': l[20333],
        'rtf': l[20334],
        'rw2': l[20335],
        'rwl': l[20240],
        'sh': l[20336],
        'shtml': l[20337],
        'sitx': l[20338],
        'sql': l[20339],
        'sketch': l[20340],
        'srf': l[20341],
        'srt': l[20342],
        'stc': l[20343],
        'std': l[20367],
        'sti': l[20368],
        'stw': l[20369],
        'svg': l[20344],
        'svgz': l[20385],
        'swf': l[20345],
        'sxc': l[20370],
        'sxd': l[20371],
        'sxi': l[20372],
        'sxm': l[20373],
        'sxw': l[20374],
        'tar': l[16689],
        'tbz': l[20346],
        'tga': l[20347],
        'tgz': l[20386],
        'tif': l[20348],
        'tiff': l[20349],
        'torrent': l[20350],
        'ttf': l[20351],
        'txt': l[20387],
        'vcf': l[20352],
        'vob': l[20353],
        'wav': l[20354],
        'webm': l[20355],
        'webp': l[20356],
        'wma': l[20357],
        'wmv': l[20358],
        'wpd': l[20359],
        'wps': l[20360],
        'xhtml': l[20361],
        'xlr': l[20388],
        'xls': l[20362],
        'xlsx': l[20389],
        'xlt': l[20390],
        'xltm': l[20391],
        'xml': l[20363],
        'zip': l[20364],
        'mp4': l[20365],
        'vb': l[22676],
        'swift': l[22677]
    };

    for (const idx in freeze(extensions)) {
        const type = extensions[idx][0];
        const desc = extensions[idx][1];

        for (let i = type.length; i--;) {
            const m = type[i];
            ext[m] = [idx, extdesc[m] || desc];
        }
    }
    freeze(ext);
    freeze(extmime);
});

function filemime(n, def) {
    'use strict';
    if (typeof n === 'object') {
        n = n.name;
    }
    var fext = fileext(String(n));
    return extmime[fext] || def || 'application/octet-stream';
}

/**
 * Get file type
 * @param {MegaNode|String} n       ufs-node, or file-name
 * @param {Boolean} [getFullType]   Return full detailed array of the type
 * @param {Boolean} [ik]            {@link fileext}
 * @returns {String|Array}          Extension Desc, or full type info
 */
function filetype(n, getFullType, ik) {
    "use strict";
    var name = String(n && (n.name || n.n) || n || '');
    var node = typeof n === 'object' ? n : {name: name};
    var fext = fileext(name, 0, ik);

    if (!ext[fext]) {
        var t = is_video(node);
        if (t > 0) {
            fext = extensions[t > 1 ? 'audio' : 'video'][0][0];
        }
    }

    if (ext[fext]) {
        if (getFullType) {
            return ext[fext];
        }
        return ext[fext][1];
    }

    return fext.length ? l[20366].replace('%1', fext.toUpperCase()) : l[18055];
}

/**
 * Get backed up device Icon
 * @param {String} name Device User Agent or Device name
 * @param {Number} type Device type number, 3 and 4 are mobile
 * @returns {String} Device Icon name
 */
function deviceIcon(name, type) {
    "use strict";

    const classMap = freeze({
        'Android': 'mobile-android',
        'iPhone': 'mobile-ios',
        'Apple': 'pc-mac',
        'Windows': 'pc-win',
        'Linux': 'pc-linux'
    });

    const os = browserdetails(name).os;

    if (classMap[os]) {
        return classMap[os];
    }
    // Fallback to generic
    if (type === 3 || type === 4) {
        return 'mobile';
    }
    return 'pc';
}

/**
 * Get folder type Icon
 * @param {Object} node A MEGA folder node
 * @param {String} [root] A MEGA node handle of the root folder
 * @returns {String} Folder Icon name
 */
function folderIcon(node, root) {
    'use strict';

    let folderIcon = '';
    root = root || M.getNodeRoot(node.h);

    if (root === M.RubbishID) {
        folderIcon = 'rubbish-';
    }

    if (node.t & M.IS_SHARED || M.ps[node.h] || M.getNodeShareUsers(node, 'EXP').length) {

        if (M.getS4NodeType(node) === 'bucket') {
            return `${folderIcon}bucket-share`;
        }

        return `${folderIcon}folder-outgoing`;
    }
    // Incoming share
    else if (node.su) {
        return `${folderIcon}folder-incoming`;
    }
    // My chat files
    else if (node.h === M.cf.h) {
        return `${folderIcon}folder-chat`;
    }
    // Camera uploads
    else if (node.h === M.CameraId) {
        return `${folderIcon}folder-camera-uploads`;
    }
    // S4 Object storage
    else if (M.getS4NodeType(node) === 'bucket') {
        return `${folderIcon}bucket`;
    }
    // File request folder
    else if (mega.fileRequest.publicFolderExists(node.h)) {
        return `${folderIcon}folder-public`;
    }

    // Backups
    if (root === M.InboxID) {

        // Backed up device icon
        if (node.devid) {

            // Get OS icon
            return deviceIcon(node.name);
        }
        // Backed up external device icon
        if (node.drvid) {

            // Ignore rubbish bin suffix
            return 'ex-device';
        }
    }

    return `${folderIcon}folder`;
}

/**
 * Get filte type Icon
 * @param {Object} node A MEGA folder node or just an Object with a 'name' key for files
 * @returns {String} Folder Icon name
 */
function fileIcon(node) {
    'use strict';

    if (!node) {
        return 'generic';
    }

    let icon = '';
    let rubPrefix = '';
    const root = M.getNodeRoot(node.h);

    if (node.t === 1 && root === M.RubbishID) {
        rubPrefix = 'rubbish-';
    }

    if (node.t) {
        return folderIcon(node, root);
    }
    else if ((icon = ext[fileext(node.name, 0, 1)]) && icon[0] !== 'mega') {
        return rubPrefix + icon[0];
    }
    else if ((icon = is_video(node)) > 0) {
        return rubPrefix + (icon > 1 ? 'audio' : 'video');
    }

    return `${rubPrefix}generic`;
}

function fileext(name, upper, iknowwhatimdoing) {
    'use strict';

    name = String(name || '');
    if (!name) {
        name = 'unknown';
    }

    var ext = name.substr(name.lastIndexOf('.') + 1);
    if (ext === name) {
        ext = '';
    }
    else if (!iknowwhatimdoing) {
        ext = ext
            .replace(/<[^>]*>/g, '')
            .replace(/[^\w+]/g, '');

        if (ext.length > 10) {
            ext = ext.substr(0, 10);
        }
    }

    return upper ? ext.toUpperCase() : ext.toLowerCase();
}
