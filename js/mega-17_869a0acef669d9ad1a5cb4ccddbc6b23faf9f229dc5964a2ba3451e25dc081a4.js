/* Bundle Includes:
 *   js/fm/megadata/nodes.js
 *   js/fm/megadata/openfolder.js
 *   js/fm/megadata/render.js
 *   js/fm/megadata/render-breadcrumbs.js
 *   js/fm/megadata/shares.js
 *   js/fm/megadata/sort.js
 *   js/fm/megadata/transfers.js
 *   js/fm/megadata/tree.js
 *   js/fm/megadata/reset.js
 *   html/js/megasync.js
 *   js/fm/linkinfohelper.js
 *   js/fm/affiliatedata.js
 *   js/eaffiliate.js
 *   js/fm/affiliateRedemption.js
 *   js/ui/megaGesture.js
 */

(function(global) {
    "use strict";
    const delInShareQueue = Object.create(null);
    const delUINode = tryCatch(h => removeUInode(h));

    const clearIndex = function(h) {
        if (this.nn && h in this.nn) {
            delete this.nn[h];
        }
        if (h in this.u) {
            this.u[h].c = 0;
        }
        if (this.su.EXP && h in this.su.EXP) {
            delete this.su.EXP[h];
        }
    };
    const delNodeVersions = function(p, h) {
        const v = fileversioning.getVersionHandles(h);

        if (v.length) {
            if (d) {
                console.debug('delNodeVersions(%s/%s)...', p, h, v);
            }

            for (let i = v.length; i--;) {
                // eslint-disable-next-line no-use-before-define
                delNodeIterator.call(this, v[i]);
            }
        }
    };
    const delNodeIterator = function(h, delInShareQ, level = 0) {
        const n = this.d[h];

        if (fminitialized) {
            delUINode(h);
        }

        if (this.c[h] && h.length < 11) {
            const c = Object.keys(this.c[h]);
            let l = c.length;

            while (l--) {
                const n = this.d[c[l]];

                if (n && n.tvf && !n.t) {
                    delNodeVersions.call(this, h, c[l]);
                }
                delNodeIterator.call(this, c[l], delInShareQ, l);
            }
            delete this.c[h];
        }

        if (fmdb) {
            fmdb.del('f', h);

            if (!n || n.ph) {
                fmdb.del('ph', h);
            }
        }

        if (n) {
            if (n.su) {
                // this is an inbound share
                delete this.c.shares[h];
                if (this.tree.shares) {
                    delete this.tree.shares[h];
                }
                delInShareQ.push(`${n.su}*${h}`);
                this.delIndex(n.su, h);
            }

            if (!level) {
                this.delIndex(n.p, h);
            }
            this.delHash(n);
            delete this.d[h];
        }

        clearIndex.call(this, h);
    };

    MegaData.prototype.delNode = function(h, ignoreDB, isBeingMoved) {
        const delInShareQ = delInShareQueue[h] = delInShareQueue[h] || [];

        if (d) {
            console.group('delNode(%s)', h);
        }
        // console.time(`delNode.${h}`);

        if (fminitialized) {
            // Handle Inbox/RubbishBin UI changes
            delay('fmLeftMenuUI', fmLeftMenuUI);
        }

        if (this.d[h] && !this.d[h].t && this.d[h].tvf) {
            const versions = fileversioning.getAllVersionsSync(h);
            for (let i = versions.length; i--;) {
                ufsc.delNode(versions[i].h, ignoreDB);
            }
        }
        else {
            // remove ufssizecache records
            if (h.length === 8) {
                ufsc.delNode(h, ignoreDB);
            }
        }

        // node deletion traversal
        delNodeIterator.call(this, h, delInShareQ);

        if (!isBeingMoved && delInShareQ.length) {
            const nodes = delInShareQ.map(uh => uh.substr(12));

            mega.keyMgr.enqueueShareRevocation(nodes);
        }

        if (fmdb && !ignoreDB) {
            // Perform DB deletions once we got acknowledge from API (action-packets)
            // which we can't do above because M.d[h] might be already deleted.
            for (let i = delInShareQ.length; i--;) {
                fmdb.del('s', delInShareQ[i]);
            }
            delete delInShareQueue[h];
        }

        if (d) {
            console.groupEnd();
        }
        // console.timeEnd(`delNode.${h}`);
    };
})(this);

MegaData.prototype.addNode = function(n, ignoreDB) {
    "use strict";

    if (n.su) {
        var u = this.u[n.su];
        if (u) {
            u.h = u.u;
            u.t = 1;
            u.p = 'contacts';
            this.addNode(u);
        }
        else if (d) {
            console.warn('No user record for incoming share', n.su);
        }
    }

    if (n.t < 2) {
        crypto_decryptnode(n);
        this.nodeUpdated(n, ignoreDB);
    }
    if (this.d[n.h] && this.d[n.h].shares) {
        n.shares = this.d[n.h].shares;
    }
    emplacenode(n);

    // sync data objs M.u <-> M.d
    if (n.h in this.u && this.u[n.h] !== n) {
        for (var k in n) {
            // merge changes from n->M.u[n.h]
            if (k !== 'name' && k in MEGA_USER_STRUCT) {
                this.u[n.h][k] = n[k];
            }
        }
        this.d[n.h] = this.u[n.h];
    }

    if (fminitialized) {
        newnodes.push(n);

        // Handle Inbox/RubbishBin UI changes
        delay('fmLeftMenuUI', fmLeftMenuUI);
    }
};

MegaData.prototype.delHash = function(n) {
    "use strict";

    if (this.h[n.hash] && this.h[n.hash].has(n.h)) {
        this.h[n.hash].delete(n.h);

        if (!this.h[n.hash].size) {
            delete this.h[n.hash];
        }
    }
};

MegaData.prototype.delIndex = function(p, h) {
    "use strict";
    // console.warn(`delIndex.${p}.${h}`);

    if (this.c[p] && this.c[p][h]) {
        delete this.c[p][h];
    }

    let empty = true;
    // eslint-disable-next-line no-unused-vars
    for (const i in this.c[p]) {
        empty = false;
        break;
    }
    if (empty) {
        delete this.c[p];
        if (fminitialized) {
            $(`#treea_${p}`).removeClass('contains-folders');
        }
    }
};

// eslint-disable-next-line complexity
MegaData.prototype.getPath = function(id) {
    'use strict';

    var result = [];
    var loop = true;
    var inshare;
    const cv = this.isCustomView(id);

    id = cv ? cv.nodeID : id;

    while (loop) {
        if (id === 'contacts' && result.length > 1) {
            id = 'shares';
        }

        if (inshare && !this.d[id]) {
            // we reached the inshare root, use the owner next
            id = inshare;
        }

        if (
            this.d[id]
            || id === 'messages'
            || id === 'shares'
            || id === 'out-shares'
            || id === 'public-links'
            || id === this.InboxID
            || id === 'contacts'
            || (id === 'albums' || cv && cv.type === 'albums')
            || M.isDynPage(id)
            || mega.gallery.sections[id]
            || id === 'file-requests'
            || id === 's4'
        ) {
            result.push(id);
        }
        else if (cv.type === 's4' && 'utils' in s4) {
            // Get S4 subpath for subpages other than Containers and Buckets
            // Container and Bucket will using existing method as it's node handle exist in M.d.
            return s4.utils.getS4SubPath(cv.original);
        }
        else if (!id || id.length !== 11) {
            return [];
        }
        else if (inshare && id.length === 11 && !this.d[id]) {
            result.push(id, 'shares');
            return result;
        }
        else if (window.megaChatIsReady && megaChat.chats[id]) {
            return [id, 'contacts'];
        }

        if (
            id === this.RootID
            || id === 'shares'
            || id === 'messages'
            || id === this.RubbishID
            || id === this.InboxID
            || M.isDynPage(id)
            || id === 'contacts'
        ) {
            loop = false;
        }

        if (loop) {

            if (id === 's4' || !(this.d[id] && this.d[id].p)) {
                break;
            }

            if (this.d[id].s4 && this.d[id].p === this.RootID) {
                id = 's4';
                continue;
            }

            inshare = this.d[id].su;
            id = this.d[id].p;
        }
    }

    // Get path for Out-shares, Public links, Discovery, and Albums.
    // This also cut off all path from invalid out-share and public-link path and return []
    if (cv && result.length > 1) {

        var outShareTree = M.getOutShareTree();

        for (var i = result.length - 1; i >= 0; i--) {
            if (cv.type === 'public-links' && typeof M.su.EXP !== 'undefined' && M.su.EXP[result[i]]) {
                result[i + 1] = 'public-links';
                break;
            }
            else if (cv.type === 'out-shares' && outShareTree[result[i]]) {
                result[i + 1] = 'out-shares';
                break;
            }
            else if (cv.type === 'gallery' && cv.nodeID === result[i]) {
                result[i + 1] = 'discovery';
                break;
            }
            else if (cv.type === 's4' && cv.containerID === result[i]) {
                result[i + 1] = 's4';
                break;
            }
            else if (cv.type === 'file-requests' && mega.fileRequest.publicFolderExists(result[i], true)) {
                result[i + 1] = 'file-requests';
                break;
            }
            result.pop();
        }
    }

    return result;
};

/**
 * @param {String|MegaNode} node ufs-node [handle]
 * @param {String} [sep] file/path separator
 * @returns {string}
 */
MegaData.prototype.getNamedPath = function(node, sep) {
    'use strict';

    return this.getPath(node).map(h => this.getNameByHandle(h) || h).reverse().join(sep || '\u241c');
};

/**
 * Check entered path or id is a custom view like out-shares and public-links
 * If it is, return a set of object that contain detail of it.
 * If it is not, return false
 * @param {String} pathOrID Path or id of current element.
 * @return {Object|Boolean}
 */
MegaData.prototype.isCustomView = function(pathOrID) {

    "use strict";

    if (!pathOrID || typeof pathOrID !== 'string') {
        return false;
    }
    var result = Object.create(null);
    const node = M.getNodeByHandle(pathOrID.substr(0, 8));
    result.original = pathOrID;

    // Basic gallery view
    if (mega.gallery.sections[pathOrID]) {
        result.type = 'gallery';
        result.nodeID = pathOrID;
        result.prefixTree = '';
        result.prefixPath = '';
    }
    // Check whether the node is a bucket or a container
    else if ('utils' in s4 && node.s4 && node.t && this.getS4NodeType(node)) {
        result.original = pathOrID.replace(/_/g, '/');
        const s4path = s4.utils.getS4SubPath(result.original).reverse();

        result.original = s4path[1] === s4path[2] ? `${s4path[1]}` : result.original;
        result.prefixTree = '';
        result.prefixPath = '';
        result.containerID = s4path[1];
        result.type = 's4';

        if (s4path.length > 2) {
            result.nodeID = s4path[2];
            result.prefixPath = `${s4path[1]}/`;
            result.subType = ['keys', 'policies', 'users', 'groups'].includes(s4path[2]) ? s4path[2] : 'bucket';
        }
        else if (s4path.length === 2 && node.p !== M.RootID) {
            result.containerID = node.p;
            result.nodeID = s4path[1];
            result.prefixPath = `${node.p}/`;
            result.subType = 'bucket';
        }
        else if (s4path.length === 2) {
            result.nodeID = s4path[1];
            result.subType = 'container';
        }
    }
    // Media discovery view
    else if (pathOrID.startsWith('discovery')) {
        result.type = 'gallery';
        result.nodeID = pathOrID.replace('discovery/', '');
        result.prefixTree = '';
        result.prefixPath = 'discovery/';
    }
    // Albums view
    else if (pathOrID === 'albums') {
        result.type = 'albums';
        result.nodeID = pathOrID;
        result.prefixTree = '';
        result.prefixPath = '';
    }
    // Specific album view
    else if (pathOrID.startsWith('albums/')) {
        result.type = 'albums';
        result.nodeID = pathOrID.replace('albums/', '');
        result.prefixTree = '';
        result.prefixPath = 'albums/';
    }
    // This is a out-share id from tree
    else if (pathOrID.substr(0, 3) === 'os_') {
        result.type = 'out-shares';
        result.nodeID = pathOrID.replace('os_', '');
        result.prefixTree = 'os_';
        result.prefixPath = 'out-shares/';
    }
    // This is a public-link id from tree
    else if (pathOrID.substr(0, 3) === 'pl_') {
        result.type = 'public-links';
        result.nodeID = pathOrID.replace('pl_', '');
        result.prefixTree = 'pl_';
        result.prefixPath = 'public-links/';
    }
    // This is a out-share path
    else if (pathOrID.substr(0, 11) === 'out-shares/') {
        result.type = 'out-shares';
        result.nodeID = pathOrID.replace('out-shares/', '');
        result.prefixTree = 'os_';
        result.prefixPath = 'out-shares/';
    }
    // This is a public-link path
    else if (pathOrID.substr(0, 13) === 'public-links/') {
        result.type = 'public-links';
        result.nodeID = pathOrID.replace('public-links/', '');
        result.prefixTree = 'pl_';
        result.prefixPath = 'public-links/';
    }
    else if (pathOrID.substr(0, 14) === 'file-requests/') {
        result.type = 'file-requests';
        result.nodeID = pathOrID.replace('file-requests/', '');
        result.prefixTree = 'fr_';
        result.prefixPath = 'file-requests/';
    }
    else if (pathOrID === 'out-shares') {
        result.type = result.nodeID = 'out-shares';
        result.prefixTree = 'os_';
        result.prefixPath = '';
    }
    else if (pathOrID === 'public-links') {
        result.type = result.nodeID = 'public-links';
        result.prefixTree = 'pl_';
        result.prefixPath = '';
    }
    else if (pathOrID === 'file-requests') {
        result.type = result.nodeID = 'file-requests';
        result.prefixTree = 'fr_';
        result.prefixPath = '';
    }

    // This is not a out-share or a public-link
    else {
        result = false;
    }
    return result;
};

/**
 * Clear the list of selected nodes, and returns it (Under mobile by using $.selected, SelectionManager under desktop)
 * @returns {Array} previously selected nodes;
 */
MegaData.prototype.clearSelectedNodes = function() {
    'use strict';
    let res = $.selected || [];

    if (window.selectionManager) {
        res = selectionManager.clear_selection();
    }
    else {
        $.selected = [];
    }

    return res;
};

/**
 * Select nodes in the current view, taking care of desktop or mobile
 * @param {String|Array} handles ufs-node's handle(s) to select.
 * @param {Boolean} [clean] expunge previously selected nodes
 */
MegaData.prototype.addSelectedNodes = function(handles, clean) {
    'use strict';
    if (!Array.isArray(handles)) {
        handles = [handles];
    }
    $.selected = clean ? [] : this.clearSelectedNodes();
    $.selected.push(...handles.filter(Boolean));

    // This will take care of re-initializing the selection-manager on desktop.
    reselect(1);
};

/**
 * Checking if is the page is in Gallery section
 * @param {String} [path] Path to check or this.currentdirid
 * @returns {Boolean}
 */
MegaData.prototype.isGalleryPage = function(path) {
    'use strict';
    const customView = !path || path === this.currentdirid ? this.currentCustomView : this.isCustomView(path);

    return customView && customView.type === 'gallery';
};

/**
 * Checking if is the page is in Gallery section
 * @param {Number} [type] Type to check the page against:
 * 0 - Any album,
 * 1 - Albums main index page
 * 2 - A single album page (private or public)
 * @param {String} [path] Path to check or this.currentdirid
 * @returns {Boolean}
 */
MegaData.prototype.isAlbumsPage = function(type, path) {
    'use strict';

    type |= 0;

    if (pfid && (!type || type === 2) && mega.gallery.albums && mega.gallery.albums.isPublic) {
        return true;
    }

    path = String(path || this.currentdirid);
    const customView = path === this.currentdirid ? this.currentCustomView : this.isCustomView(path);

    return customView.type === 'albums'
        && !type
        || (type === 1 && path === 'albums')
        || (type === 2 && path.startsWith('albums/'))
        || false;
};

/**
 * Handle rubbish bin permanent items removal
 * How this works?
 * In case that param 'all' is true, then all items from rubbish are removed
 * In case that param 'all' is false, then selected nodes/items are removed and all child nodes/items if any
 * @param {Boolean} all To remove all or just selected nodes/items
 */
MegaData.prototype.clearRubbish = async function(all) {
    "use strict";

    if (M.isInvalidUserStatus()) {
        throw new MEGAException('[clearRubbish] Invalid user state.');
    }

    if (M.account) {
        // reset cached account data
        M.account.lastupdate = 0;
    }

    mLoadingSpinner.show('clear-rubbish');

    let res;
    const error = (ex) => {
        error.found = ex;
    };
    const handles = this.clearSelectedNodes();

    if (all) {
        queueMicrotask(() => {
            ulmanager.ulClearTargetDeleted(M.getTreeHandles(M.RubbishID));
        });
        res = await api.screq('dr').catch(error);
    }
    else {
        const promises = [];

        // Check is there an upload target the deleted folder.
        queueMicrotask(() => {
            ulmanager.ulClearTargetDeleted(handles);
        });

        for (let i = handles.length; i--;) {
            promises.push(api.screq({a: 'd', n: handles[i]}));
        }

        res = await Promise.allSettled(promises);
        for (let i = res.length; i--;) {
            if (res[i].reason) {
                console.warn(res[i].reason);
                error.found = res[i].reason;
            }
            res[i] = res[i].value;
        }
    }

    mLoadingSpinner.hide('clear-rubbish');

    if (error.found) {
        throw error.found;
    }

    return res;
};

/**
 * Confirm newly established nodes at specific locations retains expected validity.
 * @param {String|Array} nodes ufs-node's handle, or an array of them.
 * @name confirmNodesAtLocation
 * @memberOf MegaData.prototype
 * @returns {Promise<*>} ack
 */
lazy(MegaData.prototype, 'confirmNodesAtLocation', () => {
    'use strict';
    let promise;
    const bulk = new Set();
    const sml = `NAL.${makeUUID()}`;

    const attachS4Bucket = async(n) => {
        const name = n.name;
        return s4.kernel.bucket.create(n.p, n)
            .then(() => {
                if (name !== n.name) {
                    showToast('info', l.s4_bucket_autorename.replace('%1', n.name));
                }
            })
            .catch((ex) => {
                if (d) {
                    console.error(`Failed to establish S4 Bucket from existing node (${n.h})...`, ex, n);
                }
                return M.moveToRubbish(n.h);
            });
    };

    const dequeue = async(nodes) => {
        const promises = [];
        const parents = Object.create(null);

        for (let i = nodes.length; i--;) {
            const n = M.getNodeByHandle(nodes[i]);

            if (n) {
                const p = M.getNodeByHandle(n.p);
                const ps4t = p.s4 && 'kernel' in s4 && s4.kernel.getS4NodeType(p);

                if (n.s4) {
                    if (d) {
                        console.warn(`Revoking S4 attribute for ${n.h}`);
                    }

                    if (ps4t !== 'container') {
                        promises.push(api.setNodeAttributes(n, {s4: undefined}));
                    }
                }

                if (ps4t) {

                    if (ps4t === 'container') {
                        promises.push(attachS4Bucket(n));
                    }
                    else if (ps4t === 'bucket') {

                        // @todo if type is bucket, validate expected object-type
                    }
                }

                parents[n.p] = n;
            }
        }

        if (promises.length) {
            await Promise.all(promises);
        }

        return parents;
    };

    const dispatcher = () => {
        const {resolve, reject} = promise;

        dequeue([...bulk])
            .then(resolve)
            .catch((ex) => {
                if (d) {
                    console.error('confirmNodesAtLocation', ex);
                }
                reject(ex);
            });

        bulk.clear();
        promise = null;
    };

    return (nodes) => {
        if (Array.isArray(nodes)) {
            nodes.map(bulk.add, bulk);
        }
        else {
            bulk.add(nodes);
        }
        delay(sml, dispatcher);
        return promise || (promise = mega.promise);
    };
});

// This function has a special hacky purpose, don't use it if you don't know what it does, use M.copyNodes instead.
MegaData.prototype.injectNodes = function(nodes, target, callback) {
    'use strict';
    if (!Array.isArray(nodes)) {
        nodes = [nodes];
    }
    let sane = nodes.filter((node) => this.isFileNode(node));

    if (sane.length !== nodes.length) {
        console.warn('injectNodes: Found invalid nodes.');
    }

    if (!sane.length) {
        return false;
    }

    nodes = [];
    sane = sane.map((node) => {
        if (!M.d[node.h]) {
            nodes.push(node.h);
            M.d[node.h] = node;
        }
        return node.h;
    });

    this.copyNodes(sane, target)
        .always((res) => {

            for (let i = nodes.length; i--;) {
                delete M.d[nodes[i]];
            }

            callback(res);
        });

    return nodes.length;
};

/**
 * Copy and/or import nodes.
 * @param {Array}       cn            Array of nodes that needs to be copied
 * @param {String}      t             Destination node handle
 * @param {Boolean}     [del]         Should we delete the node after copying? (Like a move operation)
 * @param {Array}       [tree]        optional tree from M.getCopyNodes
 * @returns {Promise} array of node-handles copied.
 */
MegaData.prototype.copyNodes = async function(cn, t, del, tree) {
    'use strict';
    const todel = [];
    const contact = String(t).length === 11;

    if (M.isInvalidUserStatus()) {
        throw EINTERNAL;
    }

    if (contact) {
        await api_cachepubkeys([t]);
    }

    if (!tree) {
        if (this.isFileNode(cn)) {
            tree = [cn];
        }
        else if ($.onImportCopyNodes) {
            tree = $.onImportCopyNodes;
            tree.isImporting = true;
        }
        else {
            // 1. get all nodes into memory
            tree = await this.getCopyNodes(cn, t, async() => {
                const handles = [...cn];
                const names = Object.create(null);
                const parents = Object.create(null);

                // 2. check for conflicts
                if (t !== M.RubbishID) {
                    const files = await fileconflict.check(cn, t, 'copy');

                    handles.length = 0;
                    for (let i = files.length; i--;) {
                        const n = files[i];

                        handles.push(n.h);
                        names[n.h] = n.name;

                        if (n._replaces) {
                            todel.push(n._replaces);
                        }
                        if (n.keepParent) {
                            parents[n.h] = n.keepParent;
                            del = false;
                            // it's complicated. For now if merging involved we wont delete
                            // as move to/from inshare is excuted as copy + del
                            // ---> here i am stopping 'del'
                        }
                    }

                    if (del) {
                        // Ensure we do only remove nodes agreed on the conflict resolution
                        cn = handles;
                    }
                }

                // 3. provide data back to getCopyNodes
                return {names, handles, parents};
            });
        }
    }

    if (!Object(tree).length) {
        // we may receive an empty array, for example if the user cancelled the fileconflict dialog

        return;
    }

    if (del) {
        await Promise.resolve(mega.fileRequestCommon.storage.isDropExist(cn))
            .then((shared) => {

                for (let i = tree.length; i--;) {
                    const n = this.getNodeByHandle(tree[i].h);

                    console.assert(n, 'Node not found... (%s)', tree[i].h);

                    if (n.shares || M.ps[n.h]) {
                        shared.push(n.h);
                    }
                }

                if (shared.length) {

                    // Confirm with the user the operation will revoke shares and he wants to
                    const type = `confirmation:!^${l[62]}!${l[16499]}`;

                    return asyncMsgDialog(type, l[870], l.shares_links_will_be_remove, l[6994], async(yes) => {
                        if (yes) {
                            return this.revokeShares(shared);
                        }
                        throw EBLOCKED;
                    });
                }
            });
    }

    if (tree.opSize) {

        await this.checkGoingOverStorageQuota(tree.opSize)
            .catch((ex) => {
                if (ex === EGOINGOVERQUOTA) {
                    // don't show an additional dialog for this error
                    throw EBLOCKED;
                }
                throw ex;
            });
    }
    const createAttribute = tryCatch((n, nn) => ab_to_base64(crypto_makeattr(n, nn)));

    const addRestoreAttribute = (t) => {
        for (let i = 0; i < cn.length; i++) {
            const src = this.getNodeByHandle(cn[i]);
            if (!src || this.getNodeRoot(src.h) === M.RubbishID) {
                continue;
            }

            for (let x = 0; x < t.length; x++) {
                if (t[x].h === src.h) {

                    if (d) {
                        console.debug('Adding restore attribute to %s with %s', t[x].h, src.p);
                    }
                    const n = {...M.d[t[x].h]};
                    const nn = Object.create(null);

                    if (!n.t) {
                        nn.k = n.k;
                    }
                    n.rr = src.p;

                    if (!(nn.a = createAttribute(n, nn))) {

                        console.warn(`Failed to create attribute for node ${n.h}, ignoring...`);
                        continue;
                    }

                    // new node inherits handle, parent and type
                    nn.h = n.h;
                    nn.t = n.t;

                    t[x] = nn;
                    break;
                }
            }
        }
    };

    const createAPIRequests = (targets) => {
        const request = [];

        for (const t in targets) {
            const req = {a: 'p', sm: 1, v: 3, t, n: targets[t]};

            const sn = this.getShareNodesSync(t, null, true);
            if (sn.length) {
                req.cr = crypto_makecr(targets[t], sn, false);
            }

            // eventually append 'cauth' ticket in the objj req.
            if (M.chat && megaChatIsReady) {
                megaChat.eventuallyAddDldTicketToReq(req);
            }

            if (t === this.RubbishID) {
                // since we are copying to rubbish we don't have multiple "d" as duplications are allowed in Rubbish
                // but below code is generic and will work regardless
                addRestoreAttribute(targets[t]);
            }

            const c = (t || "").length === 11;
            for (let i = 0; i < targets[t].length; i++) {

                targets[t][i].k = c
                    ? base64urlencode(encryptto(t, a32_to_str(targets[t][i].k)))
                    : a32_to_base64(encrypt_key(u_k_aes, targets[t][i].k));
            }

            if (c || t === M.InboxID) {
                req.vw = 1;
            }

            request.push(req);
        }

        return request.length < 2 ? request[0] : request;
    };

    const targets = Object.create(null);
    for (let i = 0; i < tree.length; i++) {
        const dst = tree[i].newTarget || t;

        if (targets[dst]) {
            targets[dst].push(tree[i]);
        }
        else {
            targets[dst] = [tree[i]];
        }
        delete tree[i].newTarget;
    }

    if (contact || tree.isImporting) {
        onIdle(getsc);
    }

    return api.screq(createAPIRequests(targets))
        .then(({pkt, result}) => {

            if (del) {
                let ops = 0;
                const promises = [];
                const sign = Symbol('skip');

                for (let i = cn.length; i--;) {

                    if (result[i]) {
                        console.error('copy failed, %s', cn[i], result[i]);
                        promises.push(sign);
                    }
                    else {
                        const req = {
                            a: 'd',
                            n: cn[i]
                        };
                        if (treetype(cn[i]) === 'inbox') {
                            req.vw = 1;
                        }
                        ++ops;
                        promises.push(api.screq(req));
                    }
                }

                if (ops) {
                    Promise.allSettled(promises)
                        .then((res) => {
                            for (let i = res.length; i--;) {

                                if (res[i].status === 'rejected') {
                                    const reason = api_strerror(res[i].reason | 0);
                                    const message = `${l[6949]}, ${this.getNamedPath(cn[i])}: ${reason}`;

                                    console.error(message);
                                    showToast('warning', message);
                                }
                            }
                            dump(res);
                        })
                        .catch(tell);
                }
            }

            if (todel.length) {
                this.safeRemoveNodes(todel).catch(dump);
            }

            const total = tree.length;
            const success = total - Object.keys(result).length;

            if (total && success < total) {
                if (success) {
                    const items = mega.icu.format(l.download_and_import_items_count, total);
                    const message = mega.icu.format(l[8683], success).replace('%1', items);

                    msgDialog('warninga', l[882], message);
                }
                else {
                    msgDialog('error', l[882], l[2507]);
                }
            }

            result = [];
            for (let i = pkt.length; i--;) {
                const {scnodes} = pkt[i];
                if (scnodes) {
                    result.push(...scnodes.map(n => n.h));
                }
            }

            // @todo better error handling..
            this.confirmNodesAtLocation(result).catch(tell);

            return result;

        })
        .catch((ex) => {
            // If target of copy/move is in-shared folder, -17 may means ESHAREROVERQUOTA
            M.ulerror(null, ex === EOVERQUOTA && sharer(t) ? ESHAREROVERQUOTA : ex);

            throw ex;
        });
};

/**
 * Move nodes.
 * @param {Array}   n       Array of node handles
 * @param {String}  t       Target folder node handle
 * @param {Number} [folderConflictResolution] pass a default conflict resolution {optional}
 * @returns {Promise} Resolves with the number of moves
 */
MegaData.prototype.moveNodes = async function(n, t, folderConflictResolution) {
    'use strict';

    if (M.isInvalidUserStatus()) {
        throw EINTERNAL;
    }

    const todel = [];
    const promises = [];
    const handles = array.unique(n);
    const names = Object.create(null);
    const mergedFolder = Object.create(null);
    const parentsToKeep = Object.create(null);

    const collect = this.collectNodes(n, t, t && t !== this.RubbishID);

    if (newnodes.length) {
        promises.push(this.updFileManagerUI());
    }
    if (collect) {
        promises.push(collect);
    }
    if (promises.length) {
        await Promise.all(promises).catch(dump);
    }

    const cleanEmptyMergedFolders = () => {
        if (Object.keys(mergedFolder).length) {
            // cleaning empty folders (moved).
            // during merging folders may still have some items (user chose dont move for
            // one or more files).
            // therefore, we check folders in src, if found empty --> clean.
            const recursiveFolderCheck = (handle) => {
                let cleanMe = true;
                const tempDeleted = [];

                for (const h in this.c[handle]) {
                    if (!this.d[h].t) {
                        return false;
                    }

                    const res = recursiveFolderCheck(h);
                    if (res) {
                        tempDeleted.push(h);
                    }
                    else {
                        cleanMe = false;
                    }
                }

                if (cleanMe) {
                    for (let i = 0; i < tempDeleted.length; i++) {
                        const loc = todel.indexOf(tempDeleted[i]);
                        if (loc >= 0) {
                            todel.splice(loc, 1);
                        }
                    }

                    todel.push(handle);
                    return true;
                }
            };

            for (let i = 0; i < n.length; i++) {
                if (mergedFolder[n[i]]) {
                    recursiveFolderCheck(n[i]);
                }
            }
        }
    };

    const getPreEmptiveAttributeChanges = (n, p, a) => {
        let c = 0;

        a = a || Object.create(null);

        if (n.s4) {
            if (d) {
                console.warn('[%s] Removing S4 attribute...', n.h, n.s4, p);
            }

            c++;
            a.s4 = undefined;
        }

        if (names[n.h] && names[n.h] !== n.name) {
            if (d) {
                console.debug('[%s] Renaming node...', n.h, [n.name], [names[n.h]]);
            }

            c++;
            a.name = names[n.h];
        }

        return c && a;
    };

    // Get on due node attribute changes.
    const getAttributeChanges = (n, p, target, root) => {
        let c = 0;
        const a = Object.create(null);

        if (target === this.RubbishID && root !== this.RubbishID) {

            if (!n.rr || n.rr !== p) {

                if (d) {
                    console.debug('[%s] Adding Restore attribute...', n.h, n.rr, p);
                }

                c++;
                a.rr = p;
            }
        }
        else if (n.rr) {

            if (d) {
                console.debug('[%s] Removing Restore attribute...', n.h, n.rr, p);
            }

            c++;
            a.rr = undefined;
        }

        return getPreEmptiveAttributeChanges(n, p, a) || c && a;
    };

    // Fire an api request to move a node or a group of them to a specific location.
    const sendAPIRequest = (handles) => {

        // Perform node collection to initiate the move operation.
        const nodes = [];
        const request = [];
        const promises = [];
        const targets = Object.create(null);

        for (let i = 0; i < handles.length; i++) {
            const dst = parentsToKeep[handles[i]] || t;

            if (targets[dst]) {
                targets[dst].push(handles[i]);
            }
            else {
                targets[dst] = [handles[i]];
            }
        }

        for (const t in targets) {

            for (let i = 0; i < targets[t].length; i++) {
                let n = targets[t][i];
                const req = {a: 'm', t, n};

                if (this.getNodeRoot(req.n) === this.InboxID) {

                    mega.backupCenter.ackVaultWriteAccess(req.n, req);
                }
                request.push(processmove(req));

                if ((n = this.getNodeByHandle(n))) {

                    nodes.push([{...n}, t, this.getNodeRoot(n.h)]);

                    const a = getPreEmptiveAttributeChanges(n);
                    if (a) {
                        promises.push(api.setNodeAttributes(n, a));
                    }
                }
            }
        }

        const cleanups = () => {
            // clean merged empty folders if any
            cleanEmptyMergedFolders();

            if (todel.length) {
                // finish operation removing dangling nodes, if any
                this.safeRemoveNodes(todel).catch(dump);
            }
        };

        if (request.length) {

            return Promise.all([mega.keyMgr.moveNodesApiReq(request.length < 2 ? request[0] : request), ...promises])
                .then(([{result, st}]) => {
                    const promises = [];

                    assert(result === 0, `APIv3 ${l[16]}...rc:${result}`);
                    assert(st && typeof st === 'string', `APIv3 ${l[16]}...st:${st}`);

                    for (let i = nodes.length; i--;) {
                        const [{h, p}, target, root] = nodes[i];
                        const n = this.getNodeByHandle(h);

                        assert(n.h === h && n.p !== p && n.p === target, `APIv3 ${l[16]}...mv:${n.h}`);

                        const a = getAttributeChanges(n, p, target, root);
                        if (a) {
                            promises.push(api.setNodeAttributes(n, a));
                        }

                        nodes[i] = h;
                    }

                    return Promise.all(promises).then(() => M.confirmNodesAtLocation(nodes)).then(() => st);
                })
                .then((res) => {
                    $.tresizer();
                    onIdle(fmLeftMenuUI);

                    cleanups();

                    return res;
                })
                .catch(tell);
        }

        // we might have a dummy move operation that include empty folder.
        cleanups();
    };

    // per specs, if one of merged folders [src or dest] has sharing --> stop
    const handleConflictResolution = (files) => {
        let sharingIssueBetweenMerged = false;
        if (!files.length) {
            // user canceled the operation.
            throw EBLOCKED;
        }
        for (let i = 0; i < files.length; i++) {
            const n = files[i];

            if (n._mergedFolderWith) {
                mergedFolder[n.h] = n._mergedFolderWith;

                let s = this.getShareNodesSync(n.h);
                if (s && s.length) {
                    sharingIssueBetweenMerged = true;
                    break;
                }
                s = this.getShareNodesSync(n._mergedFolderWith);
                if (s && s.length) {
                    sharingIssueBetweenMerged = true;
                    break;
                }

                // ignore this node, nothing to do
                continue;
            }
            names[n.h] = n.name;

            if (n._replaces) {
                todel.push(n._replaces);
            }
            if (n.keepParent) {
                parentsToKeep[n.h] = n.keepParent;
            }

            handles.push(n.h);
        }

        if (sharingIssueBetweenMerged) {

            return asyncMsgDialog('warningb', l[135], l[47], l[17739])
                .always(() => {
                    throw EBLOCKED;
                });
        }
    };

    // If the target folder is not the Rubbish, check whether we have to handle conflicts.
    if (t !== this.RubbishID) {
        handles.length = 0;

        await mega.fileRequest.preMoveCheck(n, t)
            .then(([n, t]) => {

                return fileconflict.check(n, t, 'move', null, folderConflictResolution)
                    .then(handleConflictResolution);
            });
    }

    return sendAPIRequest(handles);
};

/**
 * Helper function to move nodes falling back to copy+delete under inshares.
 *
 * @param {String} target  The handle for the target folder to move nodes into
 * @param {Array} [nodes]  Array of nodes to move, $.selected if none provided
 * @returns {Promise}
 */
MegaData.prototype.safeMoveNodes = async function safeMoveNodes(target, nodes) {
    'use strict';

    if (M.isInvalidUserStatus()) {
        throw EINTERNAL;
    }
    nodes = array.unique(nodes || $.selected || []);

    let c = 0;
    const pending = this.collectNodes(nodes, target);
    if (pending) {
        await pending;
    }

    const copy = [];
    const move = [];
    const promises = [];
    const totype = treetype(target);

    if (d) {
        ++c;
        console.group('safeMoveNodes for %s nodes to target %s (%s)', nodes.length, target, totype, nodes);
    }

    for (let i = nodes.length; i--;) {
        const node = nodes[i];
        const fromtype = treetype(node);

        if (fromtype === totype) {

            if (!this.isCircular(node, target)) {

                if (totype !== 'shares' || sharer(node) === sharer(target)) {

                    move.push(node);
                }
                else {
                    copy.push(node);
                }
            }
        }
        else {
            copy.push(node);
        }
    }

    if (copy.length) {
        console.debug('Performing %s copy+del operations...', copy.length);
        promises.push(M.copyNodes(copy, target, true));
    }
    if (move.length) {
        console.debug('Performing %s move operations...', move.length);
        promises.push(M.moveNodes(move, target));
    }
    M.clearSelectedNodes();

    if (promises.length) {

        await Promise.all(promises);
    }

    if (c) {
        console.groupEnd();
    }
};

/**
 * Helper function to remove nodes, either sending them to Rubbish or permanently.
 * @param {String|Array} handles The handle(s) to remove
 * @returns {Promise}
 */
MegaData.prototype.safeRemoveNodes = function(handles) {
    'use strict';

    if (M.isInvalidUserStatus()) {
        return Promise.reject(EINTERNAL);
    }

    handles = handles || [];

    if (!Array.isArray(handles)) {
        handles = [handles];
    }
    handles = array.unique(handles);

    // Load required nodes into memory.
    return dbfetch.geta(handles).then(() => {
        var i;
        var toDel = [];
        var toMove = [];
        var promises = [];

        for (i = handles.length; i--;) {
            var h = handles[i];
            var n = M.getNodeByHandle(h);
            const fromtype = treetype(h);

            if (fromtype === 'shares' || fromtype === 'inbox' || n.p === M.RubbishID) {
                toDel.push(h);
            }
            else {
                toMove.push(h);
            }
        }

        if (toMove.length) {
            promises.push(M.moveNodes(toMove, M.RubbishID));
        }

        if (toDel.length) {
            for (i = toDel.length; i--;) {
                const req = {a: 'd', n: toDel[i]};
                if (M.getNodeRoot(req.n) === M.InboxID) {
                    mega.backupCenter.ackVaultWriteAccess(req.n, req);
                }
                promises.push(api.screq(req));
            }
        }

        return Promise.all(promises);
    });
};

/**
 * Revert nodes sent to the rubbish, i.e. they must have `rr` attributes
 * @param {String|Array} handles The handle(s) to revert
 * @returns {Promise}
 */
MegaData.prototype.revertRubbishNodes = mutex('restore-nodes', function(resolve, reject, handles) {
    'use strict';

    if (M.isInvalidUserStatus()) {
        return reject(EINTERNAL);
    }

    handles = handles || [];
    if (!Array.isArray(handles)) {
        handles = [handles];
    }
    handles = array.unique(handles);

    if (d) {
        console.group('revertRubbishNodes for %s nodes...', handles.length, handles);
    }

    const promptFor = new Set([M.InboxID]);

    const finish = async({nodes, selTarget, targets}) => {

        // removeUInode may queued another `delay('openfolder', ...)`, let's overwrite it.
        delay.cancel('openfolder');

        const prompt = [...promptFor];
        for (let i = prompt.length; i--;) {
            const sel = targets[prompt[i]];

            if (sel) {
                M.addSelectedNodes(sel, true);

                const target = await selectFolderDialog('move').catch(dump);
                if (target) {
                    selTarget = [target, nodes = sel];
                    await M.moveNodes(sel, target, 3).catch(dump);
                }
            }
        }

        if (!is_mobile) {
            delay('openfolder', () => {
                M.openFolder(selTarget[0])
                    .catch(dump)
                    .finally(() => {
                        M.addSelectedNodes(nodes.length && nodes || selTarget[1], true);
                    });
            }, 90);
        }

        return targets;
    };

    // Load required nodes into memory.
    dbfetch.geta(handles).then(() => {
        const to = new Set();

        for (let i = handles.length; i--;) {
            const h = handles[i];
            const n = this.getNodeByHandle(h);

            if (!n) {
                if (d) {
                    console.debug('revertRubbishNodes: node not found.', h);
                }
            }
            else if (n.rr) {
                to.add(n.rr);
            }
        }

        return to.size && dbfetch.geta([...to]);
    }).then(() => {
        const targets = Object.create(null);

        for (let i = handles.length; i--;) {
            const h = handles[i];
            const n = this.getNodeByHandle(h);

            let target = n.rr;
            const root = target && this.getNodeRoot(target);

            if (this.getNodeRoot(h) !== M.RubbishID) {
                continue;
            }

            if (!M.d[target] || root === M.RubbishID || M.getNodeRights(target) < 2) {
                if (d) {
                    console.warn('Reverting falling back to cloud root for %s.', h, target, n);
                }
                target = M.RootID;
            }
            else if (promptFor.has(root)) {
                target = root;
            }

            if (targets[target]) {
                targets[target].push(h);
            }
            else {
                targets[target] = [h];
            }
        }
        assert($.len(targets), 'Invalid invocation, nothing to restore.', handles);

        let selTarget;
        const promises = [];

        for (var k in targets) {
            if (!promptFor.has(k)) {
                if (d) {
                    console.debug('Reverting %s into %s...', targets[k], k);
                }

                promises.push(this.safeMoveNodes(k, targets[k]));
            }
            selTarget = [k, targets[k]];
        }

        return Promise.all(promises)
            .then((handles) => {

                // we will only get new nodes if a copy+del was invoked.
                const nodes = handles.flat().map((h) => M.d[h]).filter(Boolean);

                return {nodes, selTarget, targets};
            });
    }).then(finish).then(resolve).catch(reject).finally(() => console.groupEnd());
});

/**
 * Helper to move nodes to the rubbish bin
 * @param {String|Array} handles The handle(s) to move
 * @returns {Promise}
 */
MegaData.prototype.moveToRubbish = async function(handles) {
    'use strict';
    let tag;

    if (!Array.isArray(handles)) {
        handles = [handles];
    }
    handles = array.unique(handles);

    if (d) {
        tag = MurmurHash3(handles.join('~')).toString(36);
        console.group('[%s] moveToRubbish %s nodes...', tag, handles.length, handles);
        console.time(`moveToRubbish.${tag}`);
    }

    const pending = this.collectNodes(handles);
    if (pending) {
        await pending;
    }
    // @todo revoke + move in batched-mode.

    // always revoke any sharing status recursively across the affected nodes
    return Promise.all([this.revokeShares(handles), this.safeMoveNodes(this.RubbishID, handles)])
        .finally(() => {
            if (d) {
                console.timeEnd(`moveToRubbish.${tag}`);
                console.groupEnd();
            }
        });
};

/**
 * Stop sharing nodes recursively across provided handles.
 * @param {String|Array} handles The root node handle(s) to stop sharing
 * @returns {Promise}
 */
MegaData.prototype.revokeShares = async function(handles) {
    'use strict';

    if (M.isInvalidUserStatus()) {
        throw EINTERNAL;
    }

    if (d) {
        console.group('revokeShares for %s nodes...', handles.length, handles);
    }

    const pending = this.collectNodes(handles);
    if (pending) {
        await pending;
    }

    const links = [];
    const folders = [];

    const tree = (() => {
        let res = [];

        for (let i = handles.length; i--;) {
            const n = this.d[handles[i]];

            if (n) {
                if (n.t) {
                    folders.push(n.h);
                }
                if (n.ph) {
                    links.push(n.h);
                }
                res = [...res, ...this.getNodesSync(n.h, true)];
            }
            else if (d) {
                console.warn('revokeShares: node not found.', handles[i]);
            }
        }
        return res;
    })();

    const promises = (() => {
        const res = [];

        for (let i = tree.length; i--;) {
            const h = tree[i];

            for (const share in Object(this.d[h]).shares) {
                const user = this.d[h].shares[share].u;

                if (user === 'EXP') {
                    links.push(h);
                }
                else {
                    if (d) {
                        console.debug('Revoking shared folder %s with user %s...', h, user);
                    }
                    res.push(this.revokeFolderShare(h, user));
                }
            }

            for (var u in this.ps[h]) {
                if (d) {
                    console.debug('Revoking pending shared folder %s with user %s...', h, u);
                }
                res.push(this.revokeFolderShare(h, u, true));
            }
        }

        return res;
    })();

    let res = false;

    // delete pending outshares for the deleted nodes
    if (folders.length) {
        promises.push(mega.keyMgr.deletePendingOutShares(folders));
    }

    const widgets = mega.fileRequestCommon.storage.isDropExist(folders);
    if (widgets.length) {

        if (d) {
            console.debug('Revoking %s File request folders...', widgets.length);
        }

        promises.push(mega.fileRequest.removeList(widgets, true));
    }

    if (links.length) {

        if (d) {
            console.debug('Revoking %s public links...', links.length);
        }

        const exportLink = new mega.Share.ExportLink({'updateUI': true, 'nodesToProcess': array.unique(links)});
        promises.push(exportLink.removeExportLink(true));
    }

    if (promises.length) {

        if (d) {
            console.debug('revokeShares: awaiting for %s promises...', promises.length);
        }

        res = await Promise.allSettled(promises);
    }

    if (d) {
        console.groupEnd();
    }

    return res;
};

/**
 * Revoke folder share by invoking an s2 request.
 * @param {String} h The ufs-node handle
 * @param {String} usr The user-handle this node is shared with, or pcr id
 * @returns {Promise}
 */
MegaData.prototype.revokeFolderShare = function(h, usr) {
    'use strict';

    if (M.isInvalidUserStatus()) {
        return Promise.reject(EINTERNAL);
    }

    if (String(h).length !== 8 || String(usr).length !== 11) {
        if (d) {
            console.warn('revokeFolderShare: Invalid arguments...', h, usr);
        }
        return Promise.reject(EARGS);
    }

    return api.screq({a: 's2', n: h, s: [{u: Object(M.opc[usr]).m || usr, r: ''}], ha: '', i: requesti})
        .then(({result}) => {

            if (!result.r || result.r[0] !== 0) {
                if (d) {
                    console.warn('revokeFolderShare failed.', result, h, usr);
                }
                throw new Error('revokeFolderShare failed.');
            }
        });
};

/**
 * Function to invoke when a node has been modified.
 * @param {Object|MegaNode} n The ufs-node that got updated.
 * @param {Boolean} [ignoreDB] Whether to prevent saving to DB
 */
MegaData.prototype.nodeUpdated = function(n, ignoreDB) {
    if (n.h && n.h.length == 8) {
        if (n.t && n.td === undefined) {
            // Either this is a newly created folder or it comes from a fresh gettree
            n.td = 0;
            n.tf = 0;
            n.tb = 0;
        }

        if (this.nn && n.name && !n.fv) {
            this.nn[n.h] = n.name;
        }

        // update My chat files folder
        if (this.cf.h === n.h) {
            this.cf = n.p === M.RubbishID ? false : n;
        }

        // sync missingkeys with this node's key status
        if (crypto_keyok(n)) {
            // mark as fixed if necessary
            if (missingkeys[n.h]) {
                crypto_keyfixed(n.h);
            }
        }
        else {
            // always report missing keys as more shares may
            // now be affected
            if (n.k) {
                crypto_reportmissingkey(n);
            }
        }

        // maintain special incoming shares index
        if (n.su) {
            if (!this.c[n.su]) {
                this.c[n.su] = Object.create(null);
            }
            this.c[n.su][n.h] = n.t + 1;

            /*
            if (!M.d[n.p]) {
                n.sp = n.p;
                n.p = '';
            }*/

            if (!this.c.shares[n.h]) {
                if (n.sk && !u_sharekeys[n.h]) {
                    // extract sharekey from node's sk property
                    var k = crypto_process_sharekey(n.h, n.sk);
                    if (k !== false) {
                        crypto_setsharekey(n.h, k, ignoreDB);
                    }
                }

                this.c.shares[n.h] = { su: n.su, r: n.r, t: n.h };

                if (u_sharekeys[n.h]) {
                    this.c.shares[n.h].sk = a32_to_base64(u_sharekeys[n.h][0]);
                }

                if (fmdb && !ignoreDB) {
                    fmdb.add('s', {
                        o_t: `${n.su}*${n.h}`,
                        d: this.c.shares[n.h]
                    });
                }
            }
        }

        // store this node into IndexedDB
        ufsc.addToDB(n);

        // fire realtime UI updates if - and only if - required.
        if (fminitialized) {
            const {type} = this.currentCustomView || !1;

            // if node in cached mode in editor, clear it
            if (mega.fileTextEditor) {
                mega.fileTextEditor.clearCachedFileData(n.h);
            }

            if (type === 'gallery' || this.gallery) {
                tryCatch(() => mega.gallery.checkEveryGalleryUpdate(n))();
                tryCatch(() => mega.gallery.albums.onCDNodeUpdate(n))();
            }
            else if (type === 'albums') {
                tryCatch(() => mega.gallery.albums.onCDNodeUpdate(n))();
                mega.gallery.nodeUpdated = true;
            }
            else {
                mega.gallery.nodeUpdated = true;
                mega.gallery.albumsRendered = false;
            }

            if (this.isDynPage(this.currentdirid) > 1) {
                this.dynContentLoader[this.currentdirid].sync(n);
            }

            // Update versioning dialog if it is open and the folder is its parent folder,
            // the purpose of the following code is to update permisions of historical files.
            if ($.selected && $.selected.length && window.versiondialogid) {
                let parent = $.selected[0];

                while ((parent = this.getNodeByHandle(parent).p)) {
                    if (parent === n.h) {
                        fileversioning.updateFileVersioningDialog();
                        break;
                    }
                }
            }

            mBroadcaster.sendMessage(`nodeUpdated:${n.h}`);
        }
    }
};


/**
 * Fire DOM updating when a folder node's size gets updated
 * @param {MegaNode} node  node object to update in UI
 */
MegaData.prototype.onFolderSizeChangeUIUpdate = function(node) {
    "use strict";
    var p = this.viewmode === 0 && this.currentdirid || false;
    if (p && String(p).slice(-8) === node.p || M.currentCustomView || p === 'shares') {
        var elm = document.getElementById(node.h);

        if (elm) {
            var s1 = elm.querySelector('.size');
            var s2 = elm.querySelector('.shared-folder-size');

            if (s1 || s2) {
                var sizeText = bytesToSize(node.tb);

                if (s1) {
                    s1.textContent = sizeText;
                }
                if (s2) {
                    s2.textContent = sizeText;

                    if ((s2 = elm.querySelector('.shared-folder-info'))) {
                        s2.textContent = fm_contains(node.tf, node.td);
                    }
                }
            }
        }

        // @todo consider bringing back an approach to re-sort by size, one that wouldn't lead to uncaught exceptions.
    }
};

/**
 * Fire DOM updating when a node gets a new name
 * @param {String} itemHandle  node's handle
 * @param {String} newItemName the new name
 */
MegaData.prototype.onRenameUIUpdate = function(itemHandle, newItemName) {
    'use strict';

    if (fminitialized) {
        const n = this.getNodeByHandle(itemHandle);
        const domListNode = document.getElementById(n.h);
        const domTreeNode = document.getElementById(`treea_${n.h}`);

        // DOM update, left and right panel in 'Cloud Drive' tab
        if (domListNode) {
            const selectors = [
                '.file-block-title',
                '.shared-folder-name',
                '.mobile.fm-item-name',
                '.tranfer-filetype-txt'
            ];
            $(selectors.join(', '), domListNode).text(newItemName);
        }

        // DOM update, left and right panel in "Shared with me' tab
        if (domTreeNode) {
            $('span:nth-child(2)', domTreeNode).text(newItemName);
        }

        // DOM update, right panel view during browsing shared content
        if (M.currentdirid === itemHandle) {
            $('.shared-details-block .shared-details-pad .shared-details-folder-name').text(newItemName);
        }

        // DOM update, breadcrumbs in 'Shared with me' tab
        if (document.getElementById(`path_${n.h}`)) {
            delay('render:path_breadcrumbs', () => this.renderPathBreadcrumbs());
        }

        mega.fileRequest.onRename(itemHandle, newItemName);

        // update file versioning dialog if the name of the versioned file changes.
        if (!n.t && n.tvf > 0) {
            fileversioning.updateFileVersioningDialog(itemHandle);
        }
        fm_updated(n);

        if (document.getElementById(`treeli_${n.h}`)) {
            // Since n.h may not be a folder, we need to do some check to ensure we really need to do a tree redraw.
            // In case its rendered in the dom as #treeli_hash, then this is 100% a folder that was rendered in its old
            // order.
            // Last but not least, we throttle this, so that big move/rename operations would only redraw the tree once
            delay('onRenameUIUpdateTreePane', () => this.redrawTree());
        }

        if (this.recentsRender) {
            this.recentsRender.nodeChanged(itemHandle);
        }
    }
};

MegaData.prototype.rename = async function(itemHandle, newItemName) {
    'use strict';
    const n = this.getNodeByHandle(itemHandle);

    if (d) {
        console.assert(!n || n.name !== newItemName, 'Unneeded rename invoked.');
    }

    if (n && n.name !== newItemName) {
        const prop = {name: newItemName};

        if (n.s4) {
            const res = 'kernel' in s4 && s4.kernel.validateForeignAction('rename', {node: n, ...prop});

            if (res) {
                if (res instanceof Promise) {
                    return res;
                }
                prop.name = res;
            }
        }

        return api.setNodeAttributes(n, prop);
    }
};

/**
 * Colour Label context menu update
 *
 * @param {Array | string} handles Selected nodes handles
 */
MegaData.prototype.colourLabelcmUpdate = function(handles) {

    'use strict';

    if (fminitialized && handles) {
        if (!Array.isArray(handles)) {
            handles = [handles];
        }

        const $items = $('.files-menu .dropdown-colour-item');
        const values = [];
        let hasLabelCnt = 0;

        for (let i = handles.length; i--;) {
            const node = M.d[handles[i]];
            if (!node) {
                if (d) {
                    console.warn('Node not found.', handles[i]);
                }
                continue;
            }

            if (node.lbl) {
                hasLabelCnt++;
                if (!values.includes(node.lbl)) {
                    values.push(node.lbl);
                }
            }
        }

        // Determine all nodes have the same label
        const isUnifiedLabel = values.length === 1 && handles.length === hasLabelCnt;

        // Reset label submenu
        $items.removeClass('active update-to');

        // Add active state label
        if (values.length > 0) {
            $items.addClass('update-to');

            for (let j = values.length; j--;) {
                $items.filter(`[data-label-id=${values[j]}]`).addClass('active');
            }

            if (isUnifiedLabel) {
                // Remove the 'update-to' classname since all nodes have the same label
                $items.filter(`[data-label-id=${values[0]}]`).removeClass('update-to');
            }
        }
    }
};

MegaData.prototype.getLabelClassFromId = function(id) {
    'use strict';
    return {
        '1': 'red', '2': 'orange', '3': 'yellow',
        '4': 'green', '5': 'blue', '6': 'purple', '7': 'grey'
    }[id] || '';
};

/**
 * labelDomUpdate
 *
 * @param {String} handle
 * @param {Number} value Current labelId
 */
MegaData.prototype.labelDomUpdate = function(handle, value) {
    "use strict";

    if (fminitialized) {

        const n = M.d[handle] || false;

        var labelId = parseInt(value);
        var removeClasses = 'colour-label red orange yellow blue green grey purple';
        var color = '<div class="colour-label-ind %1"></div>';
        var prefixTree = M.currentCustomView.prefixTree || '';
        var $treeElements = $(`#treea_${handle}`).add(`#treea_os_${handle}`).add(`#treea_pl_${handle}`);

        // Remove all colour label classes
        var $item = $(M.megaRender && M.megaRender.nodeMap[handle] || `#${handle}`);
        $item.removeClass(removeClasses);
        $('a', $item).removeClass(removeClasses);
        $('.label', $item).text('');
        $treeElements.removeClass('labeled');
        $('.colour-label-ind', $treeElements).remove();

        if (labelId) {
            // Add colour label classes.
            var lblColor = M.getLabelClassFromId(labelId);
            var colourClass = `colour-label ${lblColor}`;

            $item.addClass(colourClass);
            $('a', $item).addClass(colourClass);
            $('.nw-fm-tree-iconwrap', $treeElements)
                .safePrepend(color.replace('%1', M.getLabelClassFromId(labelId))).addClass('labeled');
            if (M.megaRender) {
                $('.label', $item).text(M.megaRender.labelsColors[lblColor]);
            }
        }

        var currentTreeLabel = M.filterTreePanel[`${M.currentTreeType}-label`];
        // if current tree is on filtering
        if (currentTreeLabel && Object.keys(currentTreeLabel).length > 0) {
            // and action is assigning new tag
            if (labelId && currentTreeLabel[labelId]) {
                $(`#treeli_${prefixTree}${handle}`).removeClass("tree-item-on-filter-hidden");
            }
            // and action is unassigning old tag
            else {
                $(`#treeli_${prefixTree}${handle}`).addClass("tree-item-on-filter-hidden");
            }
        }

        // make filter enable/disable depending on filter availabilty.
        $('.dropdown-section .dropdown-item-label')
            .add('.dropdown-section.filter-by .labels')
            .addClass('disabled static');

        if (M.isLabelExistNodeList(M.v)) {
            $('.dropdown-section .dropdown-item-label')
                .add('.dropdown-section.filter-by .labels')
                .removeClass('disabled static');
        }

        const {n: dir} = M.sortmode || {};

        if (n.p === M.currentdirid && dir === 'label') {

            const domNode = M.megaRender && M.megaRender.nodeMap[n.h] || document.getElementById(n.h);

            this.updateDomNodePosition(n, domNode);
        }
    }
};

/**
 * Labeling of nodes updates DOM and API
 *
 * @param {Array | string} handles Selected nodes handles
 * @param {Integer} newLabelState Numeric value of the new label
 */
MegaData.prototype.labeling = function(handles, newLabelState) {

    'use strict';

    if (fminitialized && handles) {
        onIdle(() => this.initLabelFilter(this.v));

        if (!Array.isArray(handles)) {
            handles = [handles];
        }
        newLabelState |= 0;

        handles.map(h => this.getNodeRights(h) > 1 && this.getNodeByHandle(h))
            .filter(Boolean)
            .map(n => {

                if (n.tvf) {
                    fileversioning.labelVersions(n.h, newLabelState);
                }

                return api.setNodeAttributes(n, {lbl: newLabelState}).catch(tell);
            });
    }
};

MegaData.prototype.labelFilterBlockUI = function() {
    "use strict";

    var type = M.currentLabelType;
    // Hide all filter DOM elements
    $('.fm-right-header.fm .filter-block.body').addClass('hidden');
    $('.files-grid-view.fm .filter-block.body').addClass('hidden');

    if (M.currentLabelFilter) {

        if (M.viewmode) {// Block view
            if (type === 'shares') {
                $(`.fm-right-header.fm .filter-block.${type}.body`).removeClass('hidden');
            }
            else if (type === 'contact') {
                $('.filter-block.body').addClass('hidden');
                $('.fm-right-header.fm .filter-block.body').addClass('hidden');
            }
            else {
                $(`.filter-block.${type}.body`).addClass('hidden');
                $(`.fm-right-header.fm .filter-block.${type}.body`).removeClass('hidden');
            }
        }
        else if (type === 'shares') {
            $(`.fm-right-header.fm .filter-block.${type}.body`).removeClass('hidden');
        }
        else if (type === 'contact') {
            $('.filter-block.body').addClass('hidden');
            $('.fm-right-header.fm .filter-block.body').addClass('hidden');
        }
        else {
            $(`.fm-right-header.fm .filter-block.${type}.body`).addClass('hidden');
            $(`.filter-block.${type}.body`).removeClass('hidden');
        }
    }
};

MegaData.prototype.labelType = function() {
    "use strict";

    var result = 'fm';
    switch (M.currentrootid) {
        case 'shares':
            result = 'shares';
            break;
        case 'out-shares':
            result = 'out-shares';
            break;
        case 'public-links':
            result = 'public-links';
            break;
        case M.RubbishID:
            result = 'rubbish';
            break;
        case 'contacts':
            result = 'contacts';
            break;
        default:
            break;
    }

    return result;
};

/*
 * update clicked label's display info
 *
 * @param {Object} e  event triggered to excuting this.
 */
MegaData.prototype.updateLabelInfo = function(e) {
    "use strict";
    const $target = $(e.target);
    const labelTxt = $target.data('label-txt');

    const map = {
        0: {
            'Red': l[19570], 'Orange': l[19574], 'Yellow': l[19578],
            'Green': l[19582], 'Blue': l[19586], 'Purple': l[19590], 'Grey': l[19594],
        },
        1: {
            'Red': l[19571], 'Orange': l[19575], 'Yellow': l[19579],
            'Green': l[19583], 'Blue': l[19587], 'Purple': l[19591], 'Grey': l[19595]
        }
    };

    $('.labels .dropdown-color-info')
        .safeHTML(map[$target.hasClass('active') | 0][labelTxt] || labelTxt)
        .addClass('active');
};

/*
 * filter fm and shared with me by tag colour
 *
 * @param {Object} e  event triggered to excuting this.
 */
MegaData.prototype.applyLabelFilter = function(e) {
    "use strict";

    var $t = $(e.target);
    var labelId = parseInt($t.data('label-id'));
    var type = M.currentLabelType;
    var $menuItems = $('.colour-sorting-menu .dropdown-colour-item');
    var $filterBlock = $(`.filter-block.${type}.body`);
    var fltIndicator = '<div class="colour-label-ind %1"></div>';
    var obj = M.filterLabel[type];// Global var holding colour tag filter information for fm and shares

    obj[labelId] = !obj[labelId];

    if (obj[labelId]) {
        $menuItems.filter(`[data-label-id=${labelId}]`).addClass('active');
        $filterBlock.find('.content').append(fltIndicator.replace('%1', M.getLabelClassFromId(labelId)));

        if (M.viewmode) {// Block view
            $(`.fm-right-header.fm .filter-block.${type}.body`).removeClass('hidden');
        }
        else if (M.currentrootid === M.RootID || M.currentrootid === M.RubbishID) {
            $(`.filter-block.${type}.body`).removeClass('hidden');
        }
        else {
            $(`.fm-right-header.fm .filter-block.${type}.body`).removeClass('hidden');
        }
    }
    else {
        delete obj[labelId];

        $menuItems.filter(`[data-label-id=${labelId}]`).removeClass('active');
        $(`.colour-label-ind.${M.getLabelClassFromId(labelId)}`, $filterBlock).remove();
        if (!Object.keys(obj).length) {
            delete M.filterLabel[type];
            $filterBlock.addClass('hidden');
            $.hideContextMenu();
        }
    }

    M.updateLabelInfo(e);
    M.openFolder(M.currentdirid, true);
};

/*
 * Check nodelist contains label
 *
 * @param {Object} nodelist     array of nodes
 *
 * @return {Boolean}
 */

MegaData.prototype.isLabelExistNodeList = function(nodelist) {
    "use strict";

    for (var i = nodelist && nodelist.length; i--;) {
        var lbl = (nodelist[i] || {}).lbl | 0;
        if (lbl) {
            return true;
        }
    }
    return false;
};

/*
 * init label filter and sort if node item has label.
 *
 * @param {Object} nodelist     array of nodes
 */

MegaData.prototype.initLabelFilter = function(nodelist) {
    "use strict";

    if (d){
        console.log('checking label is existing');
    }

    var $fmMenu = $('.colour-sorting-menu .dropdown-section .dropdown-item-label')
        .add('.colour-sorting-menu .dropdown-section.filter-by .labels');

    if (this.isLabelExistNodeList(nodelist)){
        $fmMenu.removeClass('disabled static');
        if (d){
            console.log('label exist on node list, label filter is ON');
        }
    }
    else {
        $fmMenu.addClass('disabled static');
        if (d){
            console.log('no label exist on node list, label filter is OFF');
        }
    }
};

/**
 * favouriteDomUpdate
 *
 * @param {Object} node      Node object
 * @param {Number} favState  Favourites state 0 or 1
 */
MegaData.prototype.favouriteDomUpdate = function(node, favState) {
    'use strict';
    if (fminitialized) {

        delay(`fav.dom-update.${node.h}`, () => {

            if (M.currentrootid === 'shares') {
                return;
            }

            const domListNode = M.megaRender && M.megaRender.nodeMap[node.h] || document.getElementById(node.h);

            if (domListNode) {
                const $gridView = $('.grid-status-icon', domListNode);
                const $blockView = $('.file-status-icon', domListNode);

                if (favState) {
                    // Add favourite
                    $gridView.removeClass('icon-dot').addClass('icon-favourite-filled');
                    $blockView.addClass('icon-favourite-filled');
                }
                else {
                    // Remove from favourites
                    $gridView.removeClass('icon-favourite-filled').addClass('icon-dot');
                    $blockView.removeClass('icon-favourite-filled');
                }
            }

            const {n} = M.sortmode || {};

            if (node.p === M.currentdirid && n === 'fav') {
                this.updateDomNodePosition(node, domListNode);
            }
        });
    }
};

MegaData.prototype.updateDomNodePosition = function(node, domNode) {

    'use strict';

    this.sort();
    const newindex = this.v.findIndex(n => n.h === node.h);

    if (this.megaRender && this.megaRender.megaList) {
        this.megaRender.megaList.repositionItem(node.h, newindex);
    }
    else if (domNode) {

        const {parentNode} = domNode;

        // item moved to last just using append
        if (newindex === this.v.length) {
            parentNode.appendChild(domNode);
        }
        else {
            parentNode.insertBefore(domNode, parentNode.childNodes[newindex]);
        }
    }
};

/**
 * Change node favourite state.
 * @param {Array}   handles     An array containing node handles
 * @param {Number}  newFavState Favourites state 0 or 1
 */
MegaData.prototype.favourite = function(handles, newFavState) {
    'use strict';

    if (fminitialized) {
        const exportLink = new mega.Share.ExportLink({});

        if (!Array.isArray(handles)) {
            handles = [handles];
        }
        const nodes = handles.map(h => this.getNodeByHandle(h)).filter(n => n && !exportLink.isTakenDown(n));

        for (let i = nodes.length; i--;) {
            const n = nodes[i];

            if (n.tvf) {
                fileversioning.favouriteVersions(n.h, newFavState).catch(dump);
            }
            api.setNodeAttributes(n, {fav: newFavState | 0}).catch(tell);
        }
    }
};

/**
 * isFavourite
 *
 * Search throught items via nodes and report about fav attribute
 * @param {Array} nodes Array of nodes Id
 * @returns {Boolean}
 */
MegaData.prototype.isFavourite = function(nodes) {
    'use strict';

    if (!Array.isArray(nodes)) {
        nodes = [nodes];
    }

    for (let i = nodes.length; i--;) {
        if (M.getNodeByHandle(nodes[i]).fav) {
            return true;
        }
    }
};

/**
 * versioningDomUpdate
 *
 * @param {Handle} fh      Node handle
 * @param {Number} versionsNumber  Number of previous versions.
 */
MegaData.prototype.versioningDomUpdate = function(fh) {

    var $nodeView = $(`#${fh}`);

    // For cached node but not rendered on dom, using cached selector will update missing dom node as well
    if (M.megaRender && M.megaRender.nodeMap[fh]) {
        $nodeView = $(M.megaRender.nodeMap[fh]);
    }

    var $versionsCol = $nodeView.find('td[megatype="versions"]');

    if (M.d[fh] && M.d[fh].tvf) {// Add versioning
        $nodeView.addClass('versioning');
        if ($versionsCol && $versionsCol.length) {
            var $verHtml = M.megaRender.versionColumnPrepare(M.d[fh].tvf, M.d[fh].tvb || 0);
            $versionsCol.empty().append($verHtml);
        }
    }
    else {// Remove versioning
        $nodeView.removeClass('versioning');
        if ($versionsCol && $versionsCol.length) {
            $versionsCol.empty();
        }
    }
};

MegaData.prototype.getNode = function(idOrObj) {
    if (isString(idOrObj) === true && this.d[idOrObj]) {
        return this.d[idOrObj];
    }
    else if (idOrObj && typeof idOrObj.t !== 'undefined') {
        return idOrObj;
    }

    return false;

};

/**
 * Returns all nodes under root (the entire tree)
 * FIXME: add reporting about how many nodes were dropped in the process
 *
 * @param {String}  root
 * @param {Boolean} [includeroot]  includes root itself
 * @param {Boolean} [excludebad]   prunes everything that's undecryptable - good nodes under a
 *                                 bad parent will NOT be returned to keep the result tree-shaped.
 * @param {Boolean} [excludeverions]  excludes file versions.
 * @returns {Promise}
 */
MegaData.prototype.getNodes = async function fm_getnodes(root, includeroot, excludebad, excludeverions) {
    'use strict';
    await dbfetch.coll([root]);
    return M.getNodesSync(root, includeroot, excludebad, excludeverions);
};

/**
 * Returns all nodes under root (the entire tree)
 * FIXME: add reporting about how many nodes were dropped in the process
 *
 * @param {String}  root
 * @param {Boolean} [includeroot]  includes root itself
 * @param {Boolean} [excludebad]   prunes everything that's undecryptable - good nodes under a
 *                                 bad parent will NOT be returned to keep the result tree-shaped.
 * @param {Boolean} [excludeverions]  excludes file versions.
 * @returns {Array}
 */
MegaData.prototype.getNodesSync = function fm_getnodessync(root, includeroot, excludebad, excludeverions) {
    var nodes = [];
    var parents = [root];
    var newparents;
    var i;

    while ((i = parents.length)) {

        newparents = [];

        while (i--) {
            const n = this.getNodeByHandle(parents[i]);

            // must exist and optionally be fully decrypted to qualify
            if (n && (!excludebad || !n.a)) {
                nodes.push(parents[i]);
                if (this.c[parents[i]] &&
                    (excludeverions && this.d[parents[i]].t || !excludeverions)) {
                    newparents = newparents.concat(Object.keys(this.c[parents[i]]));
                }
            }
        }

        parents = newparents;
    }

    if (!includeroot) {
        nodes.shift();
    }
    return nodes;
};

/**
 * Collect nodes recursively, as needed for a copy/move operation.
 * @param {String|Array} handles The node handles to retrieve recursively.
 * @param {String|Array} [targets] Optional target(s) these nodes will be moved into.
 * @param {Boolean} [recurse] get whole of target's sub-tree
 * @returns {Promise|*} a promise if retrieval was required.
 */
MegaData.prototype.collectNodes = function(handles, targets, recurse) {
    'use strict';
    var promises = [];

    if (targets) {
        if (!Array.isArray(targets)) {
            targets = [targets];
        }
        targets = array.unique(targets);

        if (recurse) {
            promises.push(dbfetch.coll(targets));
        }
        else {

            for (var t = targets.length; t--;) {
                if (M.c[targets[t]]) {
                    targets.splice(t, 1);
                }
            }

            if (targets.length) {
                promises.push(dbfetch.geta(targets));
            }
        }
    }

    if (!Array.isArray(handles)) {
        handles = [handles];
    }
    handles = array.unique(handles);

    for (var i = handles.length; i--;) {
        const h = handles[i];
        const n = this.getNodeByHandle(h);

        if (n && (!n.t || M.c[h])) {
            handles.splice(i, 1);
        }
    }

    if (handles.length) {
        promises.push(dbfetch.coll(handles));
    }
    else if (!promises.length) {
        return false;
    }

    if (d) {
        console.warn('collectNodes', handles, targets);
    }

    return Promise.allSettled(promises);
};

/**
 * Get all clean (decrypted) subtrees under cn
 * FIXME: return total number of nodes omitted because of decryption issues
 *
 * @param {Array}           handles Node handles
 * @param {Array|String}    [target] destination folder for the copy-operation.
 * @param {Object|Function} [names] Object containing handle:name to perform renaming over these nodes,
 *                                  or a function returning a promise which will be fulfilled with them.
 * @returns {Promise}
 */
MegaData.prototype.getCopyNodes = async function(handles, target, names) {
    'use strict';
    await this.collectNodes(handles, target, target !== this.RubbishID);
    const res = typeof names === 'function' ? await names(handles) : {handles, names};

    return this.getCopyNodesSync(res.handles, res.names, res.parents);
};

/**
 * Get all clean (decrypted) subtrees under cn
 * FIXME: return total number of nodes omitted because of decryption issues
 *
 * @param {Array} handles An array of node's handles
 * @param {Object} [names] Object containing handle:name to perform renaming over these nodes
 * @returns {Array}
 */
MegaData.prototype.getCopyNodesSync = function fm_getcopynodesync(handles, names, presevedParents) {
    let tree = [];
    let opSize = 0;
    const res = [];

    // add all subtrees under handles[], including the roots
    for (let i = 0; i < handles.length; i++) {
        var tempR = this.getNodesSync(handles[i], true, true);
        if (presevedParents && presevedParents[handles[i]]) {
            for (var kh = 0; kh < tempR.length; kh++) {
                if (!presevedParents[tempR[kh]]) {
                    presevedParents[tempR[kh]] = presevedParents[handles[i]];
                }
            }
        }
        tree = [...tree, ...tempR];
    }

    for (let i = 0; i < tree.length; i++) {
        const n = {...this.getNodeByHandle(tree[i])};

        if (!n.h) {
            if (d) {
                console.warn('Node not found', tree[i]);
            }
            continue;
        }

        // repackage/-encrypt n for processing by the `p` API
        const nn = Object.create(null);

        // copied folders receive a new random key
        // copied files must retain their existing key
        if (!n.t) {
            nn.k = n.k;
        }

        // check if renaming should be done
        if (names && names[n.h] && names[n.h] !== n.name) {
            n.name = M.getSafeName(names[n.h]);
        }

        // check it need to clear node attribute
        if ($.clearCopyNodeAttr) {
            delete n.s4;
            delete n.lbl;
            delete n.fav;
        }

        // regardless to where the copy is remove rr
        delete n.rr;

        // new node inherits all attributes
        nn.a = ab_to_base64(crypto_makeattr(n, nn));

        // new node inherits handle, parent and type
        nn.h = n.h;
        nn.p = n.p;
        nn.t = n.t;

        if (presevedParents && presevedParents[n.h]) {
            nn.newTarget = presevedParents[n.h];
        }

        // remove parent unless child
        for (let j = 0; j < handles.length; j++) {
            if (handles[j] === nn.h) {
                delete nn.p;
                break;
            }
        }

        // count total size
        if (!n.t) {
            opSize += n.s || 0;
        }

        res.push(nn);
    }

    res.opSize = opSize;

    return res;
};

/**
 * Get all parent nodes having a u_sharekey
 *
 * @param {String} h       Node handle
 * @param {Object} [root]  output object to get the path root
 * @returns {Promise}
 */
MegaData.prototype.getShareNodes = async function(h, root, findShareKeys) {
    'use strict';
    if (!this.d[h]) {
        await dbfetch.acquire(h);
    }
    const out = root || {};
    const sharenodes = this.getShareNodesSync(h, out, findShareKeys);
    return {sharenodes, root: out.handle};
};

/**
 * Get all parent nodes having a u_sharekey
 *
 * @param {String} h       Node handle
 * @param {Object} [root]  output object to get the path root
 * @param {Boolean} [findShareKeys] check if the node was ever shared, not just currently shared.
 * @returns {Array}
 */
MegaData.prototype.getShareNodesSync = function fm_getsharenodessync(h, root, findShareKeys) {
    'use strict';

    const sn = [h, []];

    mega.keyMgr.setRefShareNodes(sn, root, findShareKeys);

    return sn[1];
};

/**
 * Retrieve a list of recent nodes
 * @param {Number} [limit] Limit the returned results, defaults to last 10000 nodes.
 * @param {Number} [until] Get nodes not older than this unix timestamp, defaults to nodes from past month.
 * @return {Promise}
 */
MegaData.prototype.getRecentNodes = function(limit, until) {
    'use strict';
    console.time("recents:collectNodes");

    return new Promise((resolve) => {
        var rubTree = M.getTreeHandles(M.RubbishID);
        var rubFilter = function(n) {
            return !rubTree.includes(n.p);
        };
        var getLocalNodes = function() {
            rubTree = rubFilter.tree;
            var nodes = Object.values(M.d)
                .filter((n) => {
                    return !n.t && n.ts > until && rubFilter(n);
                });

            resolve(nodes, limit);
        };
        rubFilter.tree = rubTree;
        limit = limit | 0 || 1e4;
        until = until || Math.round((Date.now() - 7776e6) / 1e3);

        if (fmdb) {
            rubTree = rubTree.map((h) => {
                return fmdb.toStore(h);
            });
            var binRubFilter = function(n) {
                for (var i = rubTree.length; i--;) {
                    if (!indexedDB.cmp(rubTree[i], n.p)) {
                        return false;
                    }
                }
                return true;
            };
            var dbRubFilter = FMDB.$useBinaryKeys ? binRubFilter : rubFilter;
            var options = {
                limit: limit,

                query: function(db) {
                    return db.orderBy('t').reverse().filter(dbRubFilter)
                        .until((row) => {
                            return until > row.t;
                        });
                },
                include: function(row) {
                    return row.t > until;
                }
            };
            fmdb.getbykey('f', options)
                .then((nodes) => {
                    if (nodes.length) {
                        const sort = M.getSortByDateTimeFn();
                        nodes = nodes.filter(n => !n.fv).sort((a, b) => sort(a, b, -1));
                        console.timeEnd("recents:collectNodes");
                        resolve(limit ? nodes.slice(0, limit) : nodes);
                        resolve = null;
                    }
                })
                .finally(() => {
                    if (resolve) {
                        getLocalNodes();
                    }
                });
        }
        else {
            getLocalNodes();
        }
    });
};

/**
 * Get Recent Actions
 * @param {Number} [limit] Limit the returned nodes in the interactions results, defaults to last 10000 nodes.
 * @param {Number} [until] Get nodes not older than this unix timestamp, defaults to nodes from past month.
 * @return {Promise}
 */
MegaData.prototype.getRecentActionsList = function(limit, until) {
    'use strict';

    var tree = Object.assign.apply(null, [{}].concat(Object.values(M.tree)));

    // Get date from timestamp with Today & Yesterday titles.
    var getDate = function(ts) {
        var today = moment().startOf('day');
        var yesterday = today.clone().subtract(1, 'days');
        var format = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'};

        getDate = function(ts) {
            var date = moment(ts * 1e3);
            return date.isSame(today, 'd')
                ? l[1301]
                : date.isSame(yesterday, 'd')
                    ? l[1302]
                    : time2date(ts, 4);
        };
        return getDate(ts);
    };

    // Sort array of objects by ts, most recent first.
    var byTimeDesc = function(a, b) {
        if (a.ts === b.ts) {
            return 0;
        }
        return a.ts > b.ts ? -1 : 1;
    };

    // Create a new action object based off first node in group.
    var newActionBucket = function(n, actionType, blockType) {
        var b = [];
        b.ts = n.ts;
        b.date = getDate(b.ts);
        b.path = [];
        b.user = n.u;
        b.action = actionType;
        b.type = blockType;
        var {p} = n;

        while (tree[p]) {
            var t = tree[p];
            p = t.p;
            b.path.push({
                name: t.h === M.RootID ? l[164] : t.name || t.h,
                h: t.h,
                pathPart: true
            });
            if (t.t & M.IS_SHARED) {
                b.outshare = true;
            }
            if (t.su && !tree[p]) {
                b.path.push({
                    name: l[5542],
                    h: 'shares',
                    pathPart: true
                });
                b.inshare = true;
            }
        }
        return b;
    };

    return new Promise((resolve, reject) => {
        M.getRecentNodes(limit, until).then((nodes) => {
            console.time("recents:collateActions");
            nodes.sort(byTimeDesc);

            // Index is used for finding correct bucket for node.
            var index = {};

            // Action list to return to caller.
            var recentActions = [];
            recentActions.nodeCount = nodes.length;

            // Radix sort nodes into buckets.
            for (var i = 0; i < nodes.length; i++) {
                var n = new MegaNode(nodes[i]);
                var actionType = n.tvf ? "updated" : "added";
                var blockType = is_image2(n) || is_video(n) === 1 ? 'media' : 'files';
                index[n.u] = index[n.u] || Object.create(null);
                index[n.u][n.p] = index[n.u][n.p] || Object.create(null);
                index[n.u][n.p][actionType] = index[n.u][n.p][actionType] || Object.create(null);
                index[n.u][n.p][actionType][blockType] = index[n.u][n.p][actionType][blockType] || { endts: 0 };

                // Split nodes into groups based on time separation.
                var bucket = index[n.u][n.p][actionType][blockType];
                if (bucket.endts === 0 || n.ts < bucket.endts) {
                    bucket.endts = n.ts - 21600; // 6 Hours
                    bucket.group = newActionBucket(n, actionType, blockType);
                    recentActions.push(bucket.group);
                }

                // Populate node properties.
                n.recent = true;
                delete n.ar;

                // Add node to bucket.
                bucket.group.push(n);
            }

            console.timeEnd("recents:collateActions");
            M.recentActions = recentActions;
            resolve(recentActions);
        }).catch(reject);
    });
};

/**
 * Retrieve all folders hierarchy starting from provided handle
 * @param {String} h The root node handle
 * @return {Array} node handles
 */
MegaData.prototype.getTreeHandles = function _(h) {
    'use strict';

    var result = [h];
    var tree = Object.keys(M.tree[h] || {});

    for (var i = tree.length; i--;) {
        result.push.apply(result, _(tree[i]));
    }

    return result;
};

/**
 * Retrieve node rights.
 * @details Former rightsById()
 * @param {String} id The node handle
 * @returns {Number} 0: read-only, 1: read-and-write, 2: full-access
 */
MegaData.prototype.getNodeRights = function(id) {
    "use strict";

    if (this.isDynPage(id)) {
        return this.dynContentLoader[id].options.rights | 0;
    }

    if (folderlink || !id || id.length !== 8 || id === 'policies') {
        return false;
    }

    if (this.getS4NodeType(id) === 'container') {
        return 0;
    }

    while (this.d[id] && this.d[id].p) {
        if (this.d[id].r >= 0) {
            if (missingkeys[id]) {
                return 0;
            }
            return this.d[id].r;
        }
        id = this.d[id].p;
    }

    return 2;
};

/**
 * Retrieve the root node handle.
 * @details Former RootbyId()
 * @param {String} id The node handle.
 */
MegaData.prototype.getNodeRoot = function(id) {
    "use strict";
    if (id === 'recents') {
        return id;
    }
    if (typeof id === 'string') {
        id = id.replace('chat/', '');
    }
    var p = this.getPath(id);
    return p[p.length - 1];
};

/**
 * Check whether a node is in the root
 * @param {MegaNode|Object} n ufs-node, or raw node object.
 * @param {Boolean} [any] in any root, or just RootID.
 * @returns {Boolean|Number} value
 */
MegaData.prototype.isInRoot = function(n, any) {
    'use strict';

    if (n.t > 1 && n.t < 5) {
        // It's a root node itself.
        return -1;
    }

    return n.p && n.p.length === 8 && (n.p === this.RootID || any && (n.p === this.InboxID || n.p === this.RubbishID));
};

// returns true if h1 cannot be moved into h2 without creating circular linkage, false otherwise
MegaData.prototype.isCircular = function(h1, h2) {
    "use strict";

    if (this.d[h1] && this.d[h1].p === h2) {
        return true;
    }

    for (; ;) {
        if (h1 === h2) {
            return true;
        }

        if (!this.d[h2]) {
            return false;
        }

        h2 = this.d[h2].p;
    }
};

/**
 * Can be used to be passed to ['nodeId', {nodeObj}].every(...).
 *
 * @param element
 * @param index
 * @param array
 * @returns {boolean}
 * @private
 */
MegaData.prototype._everyTypeFile = function(element, index, array) {
    var node = this.getNode(element);
    return node && node.t === 0;
};

/**
 * Can be used to be passed to ['nodeId', {nodeObj}].every(...).
 *
 * @param element
 * @param index
 * @param array
 * @returns {boolean}
 * @private
 */
MegaData.prototype._everyTypeFolder = function(element, index, array) {
    var node = this.getNode(element);
    return node && node.t;
};

/**
 * Will return true/false if the passed node Id/node object/array of nodeids or objects is/are all files.
 *
 * @param nodesId {String|Object|Array}
 * @returns {boolean}
 */
MegaData.prototype.isFile = function(nodesId) {
    var nodes = nodesId;
    if (!Array.isArray(nodesId)) {
        nodes = [nodesId];
    }

    return nodes.every(this._everyTypeFile.bind(this));
};

/**
 * Will return true/false if the passed node Id/node object/array of nodeids or objects is/are all folders.
 *
 * @param nodesId {String|Object|Array}
 * @returns {boolean}
 */
MegaData.prototype.isFolder = function(nodesId) {
    var nodes = nodesId;
    if (!Array.isArray(nodesId)) {
        nodes = [nodesId];
    }

    return nodes.every(this._everyTypeFolder.bind(this));
};

/**
 * Create new folder on the cloud
 * @param {String} target The handle where the folder will be created.
 * @param {String|Array} name Either a string with the folder name to create, or an array of them.
 * @return {Promise} the handle of the deeper created folder.
 */
MegaData.prototype.createFolder = promisify(function(resolve, reject, target, name, attrs) {
    "use strict";
    var self = this;
    var inflight = self.cfInflightR;

    target = String(target || M.RootID);

    // Prevent unneeded API calls if target is not a valid handle
    if (target.length !== 8 && target.length !== 11) {
        return reject(EACCESS);
    }

    if (Array.isArray(name)) {
        name = name.map(String.trim).filter(String);

        if (name.length) {
            // Iterate through the array of folder names, creating one at a time
            (function next(target, folderName) {
                self.createFolder(target, folderName)
                    .then((folderHandle) => {
                        if (name.length) {
                            next(folderHandle, name.shift());
                        }
                        else {
                            resolve(folderHandle);
                        }
                    })
                    .catch(reject);
            })(target, name.shift());
            return;
        }

        name = null;
    }

    if (!name) {
        return resolve(target);
    }

    if (!inflight[target]) {
        inflight[target] = Object.create(null);
    }
    if (!inflight[target][name]) {
        inflight[target][name] = [];
    }

    if (inflight[target][name].push([resolve, reject]) > 1) {
        if (d) {
            console.debug('deduplicated folder creation attempt on %s for "%s"...', target, name);
        }
        return;
    }

    var _dispatch = function(idx, result) {
        var queue = inflight[target][name];

        delete inflight[target][name];
        if (!$.len(inflight[target])) {
            delete inflight[target];
        }

        for (var i = 0; i < queue.length; i++) {
            queue[i][idx](result);
        }
    };
    reject = _dispatch.bind(null, 1);
    resolve = _dispatch.bind(null, 0);

    var _done = function cfDone() {

        if (M.c[target]) {
            // Check if a folder with the same name already exists.
            for (var handle in M.c[target]) {
                if (M.d[handle] && M.d[handle].t && M.d[handle].name === name) {
                    return resolve(M.d[handle].h);
                }
            }
        }

        const n = {...attrs, name};
        if (M.d[target].s4 && 'kernel' in s4) {
            s4.kernel.setNodeAttributesByRef(target, n);
        }

        var attr = ab_to_base64(crypto_makeattr(n));
        var key = a32_to_base64(encrypt_key(u_k_aes, n.k));
        var req = {a: 'p', t: target, n: [{h: 'xxxxxxxx', t: 1, a: attr, k: key}], i: requesti};
        var sn = M.getShareNodesSync(target, null, true);

        if (sn.length) {
            req.cr = crypto_makecr([n], sn, false);
            req.cr[1][0] = 'xxxxxxxx';
        }

        api.screq(req).then(({handle}) => resolve(handle))
            .then(() => {
                if (M.d[target].s4 && name !== n.name) {
                    showToast('info', l.s4_bucket_autorename.replace('%1', n.name));
                }
            }).catch(reject);
    };

    if (M.c[target]) {
        _done();
    }
    else {
        dbfetch.get(target).always(_done);
    }
});

/**
 * Create new folder on the cloud
 * @param {Object} paths Object containing folders on keys, node handles will be filled as their values
 * @param {String} target Node handle where the paths will be created
 * @return {Promise}
 */
MegaData.prototype.createFolders = promisify(function(resolve, reject, paths, target) {
    'use strict';
    const kind = Symbol('~\\:<p*>');
    const logger = d && MegaLogger.getLogger('mkdir', false, this.logger);

    // paths walker to create hierarchy
    var walk = function(paths, s) {
        var p = paths.shift();

        if (p) {
            s = walk(paths, s[p] = s[p] || Object.create(null));
        }
        return s;
    };

    var struct = Object.create(null);
    var folders = Object.keys(paths);

    // create paths hierarchy
    for (var i = folders.length; i--;) {
        var path = folders[i];

        Object.defineProperty(walk(M.getSafePath(path), struct), kind, {value: path});
    }
    folders = folders.length;

    (function _mkdir(s, t) {
        if (d > 1) {
            logger.debug('mkdir under %s (%s) for...', t, M.getNodeByHandle(t).name, s);
        }
        Object.keys(s).forEach((name) => {
            M.createFolder(t, name).always((res) => {
                if (res.length !== 8) {
                    if (d) {
                        const err = 'Failed to create folder "%s" on target %s(%s)';
                        logger.warn(err, name, t, M.getNodeByHandle(t).name, res);
                    }
                    return reject(res);
                }

                var c = s[name]; // children for the just created folder

                if (c[kind]) {
                    if (d) {
                        console.assert(paths[c[kind]] === null, 'Hmm... check this...');
                    }

                    // record created folder node handle
                    paths[c[kind]] = res;
                    folders--;
                }

                if (d > 1) {
                    logger.debug('folder "%s" got handle %s on %s (%s)', name, res, t, M.getNodeByHandle(t).name);
                }

                onIdle(_mkdir.bind(null, c, res));
            });
        });

        if (!folders) {
            if (d) {
                logger.info('Operation completed.', paths);
            }
            resolve(paths);
        }
    })(struct, target);
});

// leave incoming share h
// FIXME: implement sn tagging to prevent race condition
MegaData.prototype.leaveShare = promisify(function(resolve, reject, h) {
    "use strict";

    if (d) {
        console.warn('leaveShare', h);
    }

    // leaving inner nested shares is not allowed: walk to the share root
    while (this.d[h] && this.d[this.d[h].p]) {
        h = this.d[h].p;
    }

    if (this.d[h] && this.d[h].su) {
        mLoadingSpinner.show('leave-share');

        api.screq({a: 'd', n: h})
            .then(resolve)
            .catch(ex => {
                if (d) {
                    console.warn('leaveShare', h, ex);
                }
                reject(ex);
            })
            .finally(() => {
                mLoadingSpinner.hide('leave-share');
            });
    }
    else {
        if (d) {
            console.warn('Cannot leaveShare', h);
        }
        reject(ENOENT);
    }
});

/**
 * Creates a new public link if one does not already exist.
 * @param {String} handle ufs-node handle, file or folder.
 * @returns {Promise<{ph, n: ({ph}|*|boolean), key: *}>}
 */
MegaData.prototype.createPublicLink = async function(handle) {
    'use strict';

    await dbfetch.get(handle);
    const n = this.getNodeByHandle(handle);

    if (n.t && this.getNodeShare(n).h !== n.h) {
        await api_setshare(n.h, [{u: 'EXP', r: 0}]);
        if (d) {
            console.assert(n.ph, 'Public handle not found...?!');
        }
    }

    if (!n.ph) {
        await api.screq({a: 'l', n: n.h});
    }

    if (!n.ph) {
        throw new Error('Unexpected failure retrieving public handle...');
    }

    const res = {n, ph: n.ph, key: n.t ? u_sharekeys[n.h][0] : n.k};

    res.link = mega.flags.nlfe
        ? `${getBaseUrl()}/${n.t ? 'folder' : 'file'}/${res.ph}#${a32_to_base64(res.key)}`
        : `${getBaseUrl()}/#${n.t ? 'F' : ''}!${res.ph}!${a32_to_base64(res.key)}`;

    return res;
};

/**
 * Retrieve node share.
 * @param {String|Object} node cloud node or handle
 * @param {String} [user] The user's handle
 * @return {Object} the share object, or false if not found.
 */
MegaData.prototype.getNodeShare = function(node, user) {
    "use strict";

    user = user || 'EXP';

    if (typeof node !== 'object') {
        node = this.getNodeByHandle(node);
    }

    if (node && node.shares && user in node.shares) {
        return node.shares[user];
    }

    return false;
};

/**
 * Retrieve all users a node is being shared with
 * @param {Object} node    The ufs-node
 * @param {String} exclude A list of users to exclude
 * @return {Array} users list
 */
MegaData.prototype.getNodeShareUsers = function(node, exclude) {
    "use strict";

    var result = [];

    if (typeof node !== 'object') {
        node = this.getNodeByHandle(node);
    }

    if (node && node.shares) {
        var users = Object.keys(node.shares);

        if (exclude) {
            if (!Array.isArray(exclude)) {
                exclude = [exclude];
            }

            users = users.filter((user) => {
                return !exclude.includes(user);
            });
        }

        result = users;
    }

    return result;
};

/**
 * Collect users to whom nodes are being shared.
 * @param {Array} nodes An array of nodes, or handles
 * @param {Boolean} [userobj] Whether return user-objects of just their handles
 * @returns {Array} an array of user-handles/objects
 */
MegaData.prototype.getSharingUsers = function(nodes, userobj) {
    "use strict";

    var users = [];

    if (!Array.isArray(nodes)) {
        nodes = [nodes];
    }

    for (var i = nodes.length; i--;) {
        var node = nodes[i] || false;

        // It's a handle?
        if (typeof node === 'string') {
            node = this.getNodeByHandle(node);
        }

        // outbound shares
        if (node.shares) {
            users = users.concat(this.getNodeShareUsers(node, 'EXP'));
        }

        // inbound shares
        if (node.su) {
            users.push(node.su);
        }

        // outbound pending shares
        if (this.ps[node.h]) {
            users = users.concat(Object.keys(this.ps[node.h]));
        }
    }

    users = array.unique(users);

    if (userobj) {
        users = users.map((h) => {
            return M.getUserByHandle(h);
        });
    }

    return users;
};

/** @function MegaData.prototype.nodeShare */
lazy(MegaData.prototype, 'nodeShare', () => {
    'use strict';
    let lock = false;
    let inflight = new Map();
    const tick = Promise.resolve();
    const debug = d > 2 ? console.debug.bind(console, '[mdNodeShare]') : nop;

    const setNodeShare = tryCatch((h, s, ignoreDB) => {
        const n = M.d[h];
        if (!n || !s) {
            if (d && s) {
                debug(`Node ${h} not found.`, s, ignoreDB);
            }
            return;
        }
        let updnode = false;
        debug(`Establishing node-share for ${h}`, s, [n]);

        if (typeof n.shares === 'undefined') {
            n.shares = Object.create(null);
        }
        n.shares[s.u] = s;

        // Maintain special outgoing shares index by user
        if (!M.su[s.u]) {
            M.su[s.u] = Object.create(null);
        }
        M.su[s.u][h] = 1;

        // Restore Public link handle, we may do lose it from a move operation (d->t)
        if (s.u === 'EXP' && !n.ph) {
            n.ph = s.ph;
            updnode = true;
            debug('Restored lost public-handle...', s, n);
        }

        if (n.t) {
            // update tree node flags
            if (!updnode) {
                ufsc.addTreeNode(n);
            }
        }
        else if (n.fa && s.u === 'EXP' && s.down) {
            debug('cleaning fa for taken-down node...', n.fa, [n], s);
            if (thumbnails.has(n.fa)) {
                thumbnails.replace(n.h, null);
            }
            delete n.fa;
            updnode = true;
        }

        if (updnode) {
            M.nodeUpdated(n);
        }

        if (fmdb && !ignoreDB && !pfkey) {
            fmdb.add('s', {o_t: `${h}*${s.u}`, d: s});

            if (u_sharekeys[h]) {
                fmdb.add('ok', {
                    h: h,
                    d: {
                        k: a32_to_base64(encrypt_key(u_k_aes, u_sharekeys[h][0])),
                        ha: crypto_handleauth(h)
                    }
                });
            }
            else if (d && !M.getNodeShare(h)) {
                console.warn(`No share key for node ${h}`, n);
            }
        }

        if (fminitialized) {
            sharedUInode(h);
        }
    });

    return async function mdNodeShare(h, s, ignoreDB) {
        if (this.d[h]) {
            return setNodeShare(h, s, ignoreDB);
        }

        if (inflight.has(h)) {
            inflight.get(h).push([h, s, ignoreDB]);
        }
        else {
            inflight.set(h, [[h, s, ignoreDB]]);
        }

        // wait for concurrent calls within the same tick.
        await tick;

        debug('acquiring lock....', h);

        // too fancy for eslint?..
        // eslint-disable-next-line no-unmodified-loop-condition
        while (lock) {
            await tSleep(1);
        }

        // dispatch inflight entries - FIFO
        if (inflight.size) {
            lock = true;

            let q = inflight;
            inflight = new Map();

            await dbfetch.acquire([...q.keys()]);

            q = [...q.values()].flat();
            for (let i = q.length; i--;) {
                setNodeShare(...q[i]);
            }

            // We're done, release the lock for the awaiting callers
            lock = false;
        }
    };
});

/**
 * Remove outbound share.
 * @param {String}  h    Node handle.
 * @param {String}  u    User handle to remove the associated share
 * @param {Boolean} okd  Whether API notified the node is no longer
 *                       shared with anybody else and therefore the
 *                       owner share key must be removed too.
 */
MegaData.prototype.delNodeShare = function(h, u, okd) {
    "use strict";

    if (this.d[h] && typeof this.d[h].shares !== 'undefined') {
        var updnode;

        if (this.su[u]) {
            delete this.su[u][h];
        }

        if (fmdb) {
            fmdb.del('s', `${h}*${u}`);
        }

        api_updfkey(h);
        delete this.d[h].shares[u];

        if (u === 'EXP' && this.d[h].ph) {
            delete this.d[h].ph;

            if (fmdb) {
                fmdb.del('ph', h);
            }

            updnode = true;
        }

        var a;
        for (var i in this.d[h].shares) {

            // If there is only public link in shares, and deletion is not target public link.
            if (i === 'EXP' && Object.keys(this.d[h].shares).length === 1 && u !== 'EXP') {
                updnode = true;
            }

            if (this.d[h].shares[i]) {
                a = true;
                break;
            }
        }

        if (!a) {
            delete this.d[h].shares;
            updnode = true;

            if (!M.ps[h]) {
                // out-share revoked, clear bit from trusted-share-keys
                mega.keyMgr.revokeUsedNewShareKey(h).catch(dump);
            }
        }

        if (updnode) {
            this.nodeUpdated(this.d[h]);

            if (fminitialized) {
                sharedUInode(h);
            }
        }
    }

    if (okd) {
        // The node is no longer shared with anybody, ensure it's properly cleared..

        // nb: ref to commit history.
        console.error(`The 'okd' flag is discontinued.`);
    }
};


/**
 * Retrieve an user object by its handle
 * @param {String} handle The user's handle
 * @return {Object} The user object, of false if not found
 */
MegaData.prototype.getUserByHandle = function(handle) {
    "use strict";

    var user = false;

    if (Object(this.u).hasOwnProperty(handle)) {
        user = this.u[handle];

        if (user instanceof MegaDataObject) {
            user = user._data;
        }
    }
    else if (this.opc[handle]) {
        user = this.opc[handle];
    }
    else if (this.ipc[handle]) {
        user = this.ipc[handle];
    }

    if (!user && handle === u_handle) {
        user = u_attr;
    }

    return user;
};

/**
 * Retrieve an user object by its email
 * @param {String} email The user's handle
 * @return {Object} The user object, of false if not found
 */
MegaData.prototype.getUserByEmail = function(email) {
    var user = false;

    M.u.every((contact, u) => {
        if (M.u[u].m === email) {
            // Found the user object
            user = M.u[u];

            if (user instanceof MegaDataObject) {
                user = user._data;
            }
            return false;
        }
        return true;
    });

    return user;
};

/**
 * Retrieve an user object
 * @param {String} str An email or handle
 * @return {Object} The user object, of false if not found
 */
MegaData.prototype.getUser = function(str) {
    "use strict";

    var user = false;

    if (typeof str !== 'string') {
        // Check if it's an user object already..

        if (Object(str).hasOwnProperty('u')) {
            // Yup, likely.. let's see
            user = this.getUserByHandle(str.u);
        }
    }
    else if (str.length === 11) {
        // It's an user handle
        user = this.getUserByHandle(str);
    }
    else if (str.indexOf('@') > 0) {
        // It's an email..
        user = this.getUserByEmail(str);
    }

    return user;
};

/**
 * Retrieve the name of an user or ufs node by its handle
 * @param {String} handle The handle
 * @return {String} the name, of an empty string if not found
 */
MegaData.prototype.getNameByHandle = function(handle) {
    "use strict";

    var result = '';

    handle = String(handle);

    if (handle.length === 11) {
        var user = this.getUserByHandle(handle);

        // If user exists locally, use Nickname or FirstName LastName or fallback to email
        if (user) {
            result = nicknames.getNickname(user) || user.m;
        }
        else if (window.megaChatIsReady && megaChat.chats[handle]) {
            var chat = megaChat.chats[handle];
            result = chat.topic;
            if (!result) {
                var members = Object.keys(chat.members || {});
                array.remove(members, u_handle);
                result = members.map((h) => {
                    user = M.getUserByHandle(h);
                    return user ? user.name && $.trim(user.name) || user.m : h;
                }).join(', ');
            }
        }
    }
    else if (handle.length === 8) {
        var node = this.getNodeByHandle(handle);

        if (node) {
            if (node.name) {
                result = node.name;
            }
            else if (missingkeys[handle]) {
                result = node.t ? l[8686] : l[8687];
            }
            else {
                const map = {
                    [M.RootID]: l[164],
                    [M.InboxID]: l[166],
                    [M.RubbishID]: l[167],
                    [M.BackupsId]: l.restricted_folder_button
                };
                result = map[handle] || result;
            }
        }
    }

    return String(result);
};

/**
 * Retrieve an ufs node by its handle
 * @param {String} handle The node's handle
 * @return {Object} The node object, of false if not found
 */
MegaData.prototype.getNodeByHandle = function(handle) {
    "use strict";

    if (this.d[handle]) {
        return this.d[handle];
    }

    if (this.chd[handle]) {
        return this.chd[handle];
    }

    for (var i = this.v.length; i--;) {
        if (this.v[i].h === handle) {
            return this.v[i];
        }
    }

    if (handle && handle.length === 8) {
        // @todo we should not need this...

        for (const ch in this.chd) {
            const n = this.chd[ch];

            if (n.h === handle) {
                if (d > 2) {
                    console.warn('Found chat node by raw handle %s, you may provide the chat handle %s', n.h, ch);
                }
                return n;
            }
        }
    }

    return false;
};

/**
 * Retrieve the parent of an ufs node
 * @param {String|Object} node The node or its handle
 * @return {Object} The parent handle, of false if not found
 */
MegaData.prototype.getNodeParent = function(node) {
    "use strict";

    if (typeof node === 'string') {
        node = this.getNodeByHandle(node);
    }

    if (node && node.su) {
        // This might be a nested inshare, only return the parent as long it does exists.
        return this.d[node.p] ? node.p : 'shares';
    }

    return node && node.p || false;
};

/**
 * Refresh UI on node removal.
 * @param {String} handle The ufs-node's handle.
 * @param {String} [parent] this node's parent.
 */
MegaData.prototype.nodeRemovalUIRefresh = function(handle, parent) {
    'use strict';
    const n = this.getNodeByHandle(handle);
    const customView = this.currentCustomView;
    const currentDir = customView && customView.nodeID || this.currentdirid;

    if (n.t && (currentDir === n.h || this.isCircular(n.h, currentDir))) {
        // If the node being removed is a folder, get out of it to the nearest available parent
        const root = this.getNodeRoot(parent || n.h);
        const path = this.getPath(parent || this.getNodeParent(n) || root);

        // Mark this node as pending to prevent going to the Rubbish meanwhile parsing action-packets..
        this.nodeRemovalUIRefresh.pending = n.h;

        delay('openfolder', () => {
            let target = null;
            let promise = Promise.resolve();

            for (let i = 0; i < path.length; ++i) {
                const n = this.getNodeByHandle(path[i]);
                if (n && this.getNodeRoot(n.h) !== this.RubbishID) {
                    target = path[i];
                    break;
                }
            }

            if (d) {
                console.debug('nodeRemovalUIRefresh(%s)', handle, target, path);
            }

            if (!target && path[0] === this.RubbishID) {
                // fired 'dr'
                target = path[0];
            }

            if (target && this.getNodeRoot(handle) !== root) {
                if (customView) {
                    target = target === this.RootID ? customView.type : customView.prefixPath + target;
                }
                promise = this.openFolder(target);
            }

            this.nodeRemovalUIRefresh.pending = null;
            delay('redraw-tree', () => promise.then(() => this.redrawTree()));
        }, 90);
    }
};

/**
 * Retrieve media properties for a file node.
 * @param {MegaNode|String} node An ufs node or handle
 * @return {Object} Media properties.
 */
MegaData.prototype.getMediaProperties = function(node) {
    'use strict';
    node = typeof node === 'string' ? this.getNodeByHandle(node) : node;

    if (this.getNodeShare(node).down) {
        // File is taken down.
        return {icon: fileIcon(node)};
    }

    var isText = false;
    var isImage = is_image2(node);
    var mediaType = is_video(node);
    var isVideo = mediaType > 0;
    var isAudio = mediaType > 1;
    var isPreviewable = isImage || isVideo;

    if (!isPreviewable && is_text(node)) {
        isText = isPreviewable = true;
    }

    return {
        isText: isText,
        isImage: isImage,
        isVideo: isVideo,
        isAudio: isAudio,
        icon: fileIcon(node),
        isPreviewable: isPreviewable,
        showThumbnail: String(node.fa).indexOf(':1*') > 0
    };
};

/**
 * Preview a node in-browser.
 * @param {MegaNode|String} node An ufs node or handle
 * @return {Boolean} whether it was shown.
 */
MegaData.prototype.viewMediaFile = function(node) {
    'use strict';
    node = typeof node === 'string' ? this.getNodeByHandle(node) : node;
    var prop = M.getMediaProperties(node);
    var handle = node.ch || node.h;
    var result = true;

    console.assert(prop.isPreviewable, 'This is not viewable..');

    if (prop.isText) {
        loadingDialog.show();
        mega.fileTextEditor.getFile(handle)
            .then((data) => {
                loadingDialog.hide();
                mega.textEditorUI.setupEditor(node.name, data, handle, true);
            })
            .catch((ex) => {
                console.warn(ex);
                loadingDialog.hide();
            });
    }
    else if (typeof slideshow === 'function') {
        if (prop.isVideo) {
            $.autoplay = node.h;
        }
        slideshow(handle, 0, true);
    }
    else {
        console.assert(is_mobile, 'Where are we?...');
        result = false;
    }

    return result;
};

/**
 * Retrieve dashboard statistics data
 */
MegaData.prototype.getDashboardData = function() {
    "use strict";

    var res = Object.create(null);
    var s = this.account.stats;

    res.files = {
        cnt: s[this.RootID].files - s[this.RootID].vfiles,
        size: s[this.RootID].bytes - s[this.RootID].vbytes
    };
    res.folders = { cnt: s[this.RootID].folders, size: s[this.RootID].fsize };
    res.rubbish = { cnt: s[this.RubbishID].files, size: s[this.RubbishID].bytes };
    res.ishares = { cnt: s.inshares.items, size: s.inshares.bytes, xfiles: s.inshares.files };
    res.oshares = { cnt: s.outshares.items, size: s.outshares.bytes };

    res.backups = {
        cnt: this.d[this.BackupsId] ? this.d[this.BackupsId].td : 0,
        size: this.d[this.BackupsId] ? this.d[this.BackupsId].tb : 0,
        xfiles: this.d[this.BackupsId] ? this.d[this.BackupsId].tf : 0
    };
    res.links = { cnt: s.links.folders, size: s.links.bytes, xfiles: s.links.files };
    res.versions = {
        cnt: s[this.RootID].vfiles + s[this.InboxID].vfiles,
        size: s[this.RootID].vbytes + s[this.InboxID].vbytes
    };

    return res;
};

/**
 * Check whether an object is a file node
 * @param {String} n The object to check
 * @return {Boolean}
 */
MegaData.prototype.isFileNode = function(n) {
    "use strict";

    return crypto_keyok(n) && !n.t;
};

/**
 * called when user try to remove pending contact from shared dialog
 * should be changed case M.ps structure is changed, take a look at processPS()
 *
 * @param {string} nodeHandle
 * @param {string} pendingContactId
 *
 *
 */
MegaData.prototype.deletePendingShare = function(nodeHandle, pendingContactId) {
    "use strict";

    if (this.d[nodeHandle]) {

        if (this.ps[nodeHandle] && this.ps[nodeHandle][pendingContactId]) {
            this.delPS(pendingContactId, nodeHandle);

            if (this.ps[nodeHandle] === undefined &&
                (this.d[nodeHandle].shares === undefined ||
                    'EXP' in this.d[nodeHandle].shares && Object.keys(this.d[nodeHandle].shares).length === 1)) {
                this.nodeUpdated(M.d[nodeHandle]);
            }
        }
    }
};

MegaData.prototype.emptySharefolderUI = tryCatch(function(lSel) {
    "use strict";

    const contentBlock = document.querySelector('.shared-folder-content');
    let selectedView = null;
    let emptyBlock = null;
    let clonedEmptyBlock = null;
    const emptyBlockFilter = mega.ui.mNodeFilter && mega.ui.mNodeFilter.selectedFilters
        ? '.fm-empty-search' : '.fm-empty-folder';

    if (!contentBlock) {
        return;
    }

    selectedView = contentBlock.querySelector(lSel || this.fsViewSel);
    emptyBlock = contentBlock.querySelector('.fm-empty-sharef');

    if (!selectedView || emptyBlock) {
        return;
    }

    clonedEmptyBlock = document.querySelector(emptyBlockFilter).cloneNode(true);
    clonedEmptyBlock.classList.remove('hidden');
    clonedEmptyBlock.classList.add('fm-empty-sharef');

    selectedView.classList.add('hidden');
    selectedView.parentNode.insertBefore(clonedEmptyBlock, selectedView);
    contentBlock.classList.remove('hidden');

    $.tresizer();
});


/**
 * M.disableCircularTargets
 *
 * Disable parent tree DOM element and all children.
 * @param {String} pref, id prefix i.e. { #fi_, #mctreea_ }
 */
MegaData.prototype.disableCircularTargets = function disableCircularTargets(pref) {
    "use strict";

    var nodes = $.selected || [];

    for (var s = nodes.length; s--;) {
        var handle = nodes[s];
        var node = M.d[handle];

        if (node) {
            $(pref + handle).addClass('disabled');

            if (node.p) {
                // Disable parent dir
                $(pref + node.p).addClass('disabled');

                // Disable moving to rubbish from rubbish
                if (M.getNodeRoot(handle) === M.RubbishID) {
                    $(pref + M.RubbishID).addClass('disabled');
                }
            }
            else if (d && node.t < 2 && node.h !== M.RootID /* folderlink*/) {
                console.error('M.disableCircularTargets: parent-less node!', handle, pref);
            }
        }
        else if (d > 1) {
            console.warn('[disableCircularTargets] Node %s%s not found.', pref, handle);
        }

        // Disable all children folders
        this.disableDescendantFolders(handle, pref);
    }
};

/**
 * Disable descendant folders
 * @param {String} id The node handle
 * @param {String} pref, id prefix i.e. { #fi_, #mctreea_ }
 */
MegaData.prototype.disableDescendantFolders = function(id, pref) {
    'use strict';

    if (this.tree[id]) {
        var folders = Object.values(this.tree[id]);

        for (var i = folders.length; i--;) {
            var {h} = folders[i];

            if (this.tree[h]) {
                this.disableDescendantFolders(h, pref);
            }
            $(pref + h).addClass('disabled');
        }
    }
};

/**
 * Import welcome pdf into the current account.
 * @returns {Promise}
 */
MegaData.prototype.importWelcomePDF = async function() {
    'use strict';

    const {result: {ph, k}} = await api.req({a: 'wpdf'});
    const {result: {at}} = await api.req({a: 'g', p: ph});

    if (d) {
        console.info('Importing Welcome PDF (%s)', ph, at);
    }

    assert(typeof at === 'string');
    return this.importFileLink(ph, k, at);
};

/**
 * Retrieve public-link node.
 * @param {String} ph public-handle
 * @param {String} key decryption key
 * @return {Promise<MegaNode>} decrypted node.
 */
MegaData.prototype.getFileLinkNode = async function(ph, key) {
    'use strict';
    let n;
    if ((key = base64_to_a32(key).slice(0, 8)).length === 8
        && (n = (await api.req({a: 'g', p: ph})).result).at) {

        n.a = n.at;
        crypto_procattr(n, key);
        if (n.name) {
            n = new MegaNode({...n, t: 0, ph, h: ph, k: key});
            n.shares = {EXP: {u: "EXP", r: 0, ...n}};
        }
    }
    assert(n && n.name, api_strerror(EKEY));

    return n;
};

// eslint-disable-next-line complexity -- @private
MegaData.prototype.bulkLinkReview = async function(data, clean) {
    'use strict';
    const h = '00000000';
    const nodes = this.d;
    const trees = this.c;

    mLoadingSpinner.show('cmp-link-review');

    if (this.RootID !== h || clean) {
        u_reset();
        if (megaChatIsReady) {
            megaChat.destroy(true);
        }
        fm_addhtml();
        mega.ui.setTheme(2);
        mega.loadReport = {};
        eventlog = loadfm = fetchfm = dump;
        mclp = MediaInfoLib.getMediaCodecsList();

        this.reset();
        this.addNode({h, p: '', u: "gTxFhlOd_LQ", t: 2, k: [0, 0, 0, 0], ts: 0, name: "\u{1F46E}"});

        folderlink = pfid = this.RootID;
        pfkey = a32_to_base64(this.d[this.RootID].k);

        await loadfm_done(-0x800e0fff);
    }
    ufsc = new UFSSizeCache();

    const promises = [];
    const links = Object.create(null);
    const addLink = (ph, key) => this.getFileLinkNode(ph, key)
        .then((n) => {
            n.foreign = 1;
            n.p = this.RootID;
            n.link = `${ph}!${key}`;
            this.addNode(n);
        })
        .catch(dump.bind(null, `${ph}!${key}`));

    let m;
    const filter = new Set(Array.isArray(data) ? data : []);
    const rex = /(?:[!/]|^)([\w-]{8})[!#]([\w-]{22,43})\b/g;

    while ((m = rex.exec(data))) {
        const [, ph, key] = m;

        if (key.length > 22) {
            promises.push(addLink(ph, key));
        }
        else {
            links[ph] = key;
        }

        if ('/?!'.includes(data[rex.lastIndex])) {
            filter.add(data.slice(rex.lastIndex).split(/\W/, 2)[1]);
        }
    }

    await Promise.all(promises)
        .then(() => this.updFileManagerUI())
        .catch(dump);

    const add = (n) => {
        if (!n_h) {
            n_h = n.h;
            n.p = this.RootID;
            decWorkerPool.signal({d, pfkey, n_h, secureKeyMgr: self.secureKeyMgr, allowNullKeys: self.allowNullKeys});
        }
        n.foreign = 1;
        n.nauth = pfid;
        n.pfid = pfid;
        n.pfkey = pfkey;
        decWorkerPool.postNode(n);
    };
    const ch = api.addChannel(-1, 'cs', freeze({'[': tree_residue, '[{[f{': add}));

    for (const ph in links) {
        n_h = null;
        pfid = ph;
        pfkey = links[ph];
        api_setfolder(ph);
        await api.req({a: 'f', c: 1, r: 1}, ch).catch(dump);

        const n = M.d[n_h];
        if (n) {
            this.addNode(n);
        }
        console.assert(n, `Failed to load ${ph}!${pfkey}`);
    }
    api.removeChannel(ch);

    n_h = null;
    folderlink = pfid = this.RootID;
    pfkey = a32_to_base64(this.d[this.RootID].k);

    await ufsc.save();

    if (filter.size) {
        const nh = [...filter];
        const tree = this.tree[this.RootID] || {};

        for (let i = nh.length; i--;) {
            const n = this.d[nh[i]] || nodes[nh[i]];

            n.p = this.RootID;
            this.addNode(n);

            if (!this.c[n.h]) {
                const c = Object.keys(this.c[n.h] = trees[n.h] || {});

                for (let j = c.length; j--;) {
                    const h = c[j];
                    this.d[h] = nodes[h];
                }
                ufsc.addNode(n);
            }
        }

        this.c[this.RootID] =
            Object.keys(this.c[this.RootID])
                .reduce((s, h) => {
                    if (filter.has(h) || this.d[h].ph) {
                        s[h] = -1;
                    }
                    else {
                        delete tree[h];
                    }
                    return s;
                }, {});
    }
    mLoadingSpinner.hide('cmp-link-review');

    return this.updFileManagerUI();
};

MegaData.prototype.bulkFileLinkImport = async function(data, target, verify) {
    'use strict';
    const req = {a: 'p', n: [], cr: [[], [], []]};
    let links = Object.create(null);

    String(data).replace(/(?:[!/]|^)([\w-]{8})[!#]([\w-]{43})\b/g, (x, ph, key) => {
        links[ph] = this.getFileLinkNode(ph, key).catch(dump.bind(null, ph));
    });

    for (const ph in links) {
        links[ph] = await links[ph];
    }

    if (verify) {
        [links, target] = await verify(links, target);
    }
    req.t = target = target || M.currentdirid;

    // eslint-disable-next-line guard-for-in
    for (const ph in links) {
        const n = links[ph];

        if (n instanceof MegaNode) {
            if (u_sharekeys[target]) {
                req.cr[2].push(0, req.cr[2].length / 3, a32_to_base64(encrypt_key(u_sharekeys[target][1], n.k)));
            }
            req.n.push({ph, t: 0, a: n.at, fa: n.fa, ov: n.ov, k: a32_to_base64(encrypt_key(u_k_aes, n.k))});
        }
    }

    if (req.cr[2].length) {
        req.cr[0][0] = target;
    }
    else {
        delete req.cr;
    }

    console.info('bulkFileLinkImport', links, req);

    return api.screq(req);
};

/**
 * Import file link
 * @param {String} ph  Public handle
 * @param {String} key  Node key
 * @param {String} attr Node attributes
 * @param {String} [srcNode] Prompt the user to choose a target for this source node...
 * @returns {Promise}
 */
MegaData.prototype.importFileLink = function importFileLink(ph, key, attr, srcNode) {
    'use strict';
    return new Promise((resolve, reject) => {
        var req = {a: 'p'};
        var n = {
            t: 0,
            ph: ph,
            a: attr,
            k: a32_to_base64(encrypt_key(u_k_aes, base64_to_a32(key).slice(0, 8)))
        };

        var _import = function(target) {
            req.n = [n];
            req.t = target;

            api.screq(req)
                .then(resolve)
                .catch((ex) => {
                    M.ulerror(null, ex);
                    reject(ex);
                });
        };

        if (srcNode) {
            $.mcImport = true;
            $.saveToDialogPromise = reject;

            // Remove original fav and lbl for new node.
            delete srcNode.fav;
            delete srcNode.lbl;

            n.a = ab_to_base64(crypto_makeattr(srcNode));

            openSaveToDialog(srcNode, (srcNode, target) => {
                M.getShareNodes(target, null, true).then(({sharenodes}) => {
                    const {name} = srcNode;

                    fileconflict.check([srcNode], target, 'import').always((files) => {
                        var file = files && files[0];

                        if (file) {
                            if (file._replaces) {
                                n.ov = file._replaces;
                            }

                            if (file.fa) {
                                n.fa = file.fa;
                            }

                            if (name !== file.name) {
                                n.a = ab_to_base64(crypto_makeattr(file));
                            }

                            if (sharenodes && sharenodes.length) {
                                req.cr = crypto_makecr([file], sharenodes, false);
                            }

                            _import(target);
                            M.openFolder(target);
                        }
                        else {
                            reject(EBLOCKED);
                        }
                    });
                }).catch(reject);
            });
        }
        else {
            _import(!folderlink && M.RootID ? M.RootID : undefined);
        }
    });
};

/**
 * Import folderlink nodes
 * @param {Array} nodes The array of nodes to import
 */
MegaData.prototype.importFolderLinkNodes = function importFolderLinkNodes(nodes) {
    "use strict";
    const {pfid, pfcol} = window;

    var _import = function(data) {
        M.onFileManagerReady(() => {
            loadingDialog.hide('import');
            openCopyDialog(() => {
                $.mcImport = true;
                $.selected = data[0];
                $.onImportCopyNodes = data[1];
                $.onImportCopyNodes.opSize = data[2];

                // This is an album import dialog, entering $.albumImport mode
                if (data[3] === '<pfcol>') {
                    console.assert($.albumImport, 'Error: Failed to load temporary value from session storage...');
                    mega.gallery.albumsRendered = false;
                }

                if (d) {
                    console.log('Importing Nodes...', $.selected, $.onImportCopyNodes, data[2]);
                }
            });
        });
    };

    if (($.onImportCopyNodes || sessionStorage.folderLinkImport) && !folderlink) {
        loadingDialog.show('import');
        if ($.onImportCopyNodes) {
            _import($.onImportCopyNodes);
        }
        else {
            var kv = MegaDexie.create(u_handle);
            var key = `import.${sessionStorage.folderLinkImport}`;

            kv.get(key)
                .then((data) => {
                    _import(data);
                    kv.remove(key, true).dump(key);
                })
                .catch((ex) => {
                    if (ex && d) {
                        console.error(ex);
                    }
                    loadingDialog.hide('import');
                    kv.remove(key, true).dump(key);

                    if (ex) {
                        tell(`${l[2507]}: ${ex}`);
                    }
                });
        }
        nodes = null;
        delete sessionStorage.folderLinkImport;
    }

    var sel = [].concat(nodes || []);

    if (sel.length) {
        var FLRootID = M.RootID;

        mega.ui.showLoginRequiredDialog({
            title: l.login_signup_dlg_title,
            textContent: l.login_signup_dlg_msg,
            showRegister: true
        }).then(() => {
            loadingDialog.show();

            tryCatch(() => {
                sessionStorage.folderLinkImport = FLRootID;
            })();

            // It is import so need to clear existing attribute for new node.
            $.clearCopyNodeAttr = true;

            return M.getCopyNodes(sel)
                .then((nodes) => {
                    var data = [sel, nodes, nodes.opSize];
                    var fallback = function() {
                        $.onImportCopyNodes = data;
                        loadSubPage('fm');
                    };

                    if (pfcol) {
                        this.preparePublicSetImport(pfid, data);
                        sessionStorage.albumLinkImport = pfid;
                    }

                    if (!sessionStorage.folderLinkImport || nodes.length > 6000) {
                        fallback();
                    }
                    else {
                        MegaDexie.create(u_handle)
                            .set(`import.${FLRootID}`, data)
                            .then(() => {
                                loadSubPage('fm');
                            })
                            .catch((ex) => {
                                if (d) {
                                    console.warn('Cannot import using indexedDB...', ex);
                                }
                                fallback();
                            });
                    }
                });
        }).catch((ex) => {
            // If no ex, it was canceled
            if (ex) {
                tell(ex);
            }
        }).finally(() => {
            delete $.clearCopyNodeAttr;
        });
    }
};

/**
 * @param {String} pfid public-folder/link's ID to be used during the import
 * @param {Array<(String|MegaNode[])>} data The array of selections and nodes to import
 */
MegaData.prototype.preparePublicSetImport = function(pfid, data) {
    'use strict';

    const [sel, nodes] = data;

    if (sel[0] !== pfid) {
        const n = M.d[pfid];
        const nn = Object.create(null);

        nn.t = 1;
        nn.h = n.h;
        nn.a = ab_to_base64(crypto_makeattr(n, nn));

        for (let i = nodes.length; i--;) {
            nodes[i].p = pfid;
        }
        nodes.unshift(nn);
    }

    data.push('<pfcol>');
};

/**
 * Check whether we can generate thumbnails for nodes going into specific folders/sections.
 * @param {String} [target] folder node, or current folder if unspecified
 * @returns {Boolean}
 */
MegaData.prototype.shouldCreateThumbnail = function(target) {
    'use strict';

    // @todo: Fix after the proxy server changes are released.
    if (self.omitthumb !== false) {
        return !self.omitthumb;
    }

    target = target || this.currentCustomView.nodeID || this.currentdirid || this.lastSeenCloudFolder;

    return fmconfig.s4thumbs === 1 || this.getNodeRoot(target) !== 's4';
};

/**
 * Simplified check whether an object is a S4 container or bucket node
 * @param {MegaNode|Object|String} n The object to check
 * @returns {String} Node type
 */
MegaData.prototype.getS4NodeType = function(n) {
    "use strict";

    if (typeof n === 'string') {
        n = this.getNodeByHandle(n);
    }

    if (crypto_keyok(n)) {

        if (n.s4 && n.p === this.RootID) {
            return 'container';
        }

        if ((n = M.d[n.p]) && n.s4 && n.p === this.RootID) {
            return 'bucket';
        }
    }

    return false;
};

/**
 * Utility functions to handle 'My chat files' folder.
 * @name myChatFilesFolder
 * @memberOf MegaData
 * @type {Object}
 */
lazy(MegaData.prototype, 'myChatFilesFolder', () => {

    'use strict';

    return mega.attr.getFolderFactory(
        "cf",
        false,
        true,
        'h',
        [l[20157], 'My chat files'],
        base64urlencode,
        base64urldecode
    ).change((handle) => {

        if (handle) {
            const treeItem = document.querySelector(`[id="treea_${handle}"] .nw-fm-tree-folder`);
            const fmItem = document.querySelector(`[id="${handle}"] .folder`);

            if (treeItem) {
                treeItem.classList.add('chat-folder');
            }

            if (fmItem) {
                fmItem.classList.add('folder-chat', 'icon-folder-chat-90');
                fmItem.classList.remove('icon-folder-90');
            }
        }
    });
});

/**
 * Set node description attribute
 * @param {MegaNode|Object|String} itemHandle node handle
 * @param {String} newItemDescription node description text
 * @returns {Promise} promise
 */
MegaData.prototype.setNodeDescription = async function(itemHandle, newItemDescription) {
    'use strict';
    const n = this.getNodeByHandle(itemHandle);

    if (d) {
        console.assert(!n || n.des !== newItemDescription, 'Unneeded set description invoked.');
    }

    if (n && n.des !== newItemDescription) {
        const prop = {des: newItemDescription};

        // TODO S4

        // Save also to other version of the node
        if (n.tvf) {
            fileversioning.descriptionVersions(n.h, newItemDescription);
        }

        return api.setNodeAttributes(n, prop);
    }
};

(function(global) {
    "use strict"; /* jshint -W089 */
    /* eslint-disable complexity */// <- @todo ...

    const dynPages = {
        'faves': {
            /**
             * Filter nodes by.
             * @param {MegaNode} n - node
             * @returns {Boolean} match criteria result
             */
            filter(n) {
                if (!(n && n.fav && !n.fv && !n.rr)) {
                    return false;
                }

                if (M.currentLabelFilter && !M.filterByLabel(n)) {
                    return false;
                }

                const root = M.getNodeRoot(n.h);
                return root !== M.RubbishID && root !== 'shares';
            },
            /**
             * Internal properties, populated as options.
             * @private
             */
            get properties() {
                return {
                    /**
                     * Container rights, as per getNodeRights() 0: read-only, 1: read-and-write, 2: full-access
                     * @type Number
                     */
                    rights: 0,
                    /**
                     * Under what place is shown.
                     * @type {String}
                     */
                    location: 'cloud-drive',
                    /**
                     * Common type, long-name, etc
                     * @type String
                     */
                    type: 'favourites',
                    /**
                     * Localized name
                     * @type String
                     */
                    localeName: l.gallery_favourites
                };
            }
        }
    };
    Object.setPrototypeOf(dynPages, null);
    Object.freeze(dynPages);

    /**
     * Dynamic content loader
     * @param {Object} obj destructible
     * @param {String} obj.section The FM section/page name, i.e. `fm/${section}`
     * @param {Function|String} obj.filter MegaNode filter, or property to filter nodes for.
     * @param {Object} [obj.options] Additional internal options.
     * @constructor
     */
    class DynContentLoader {
        constructor({section, filter, ...options}) {
            if (typeof filter === 'string') {
                const prop = filter;
                filter = (n) => n && !!n[prop];
            }

            Object.defineProperty(this, 'filter', {value: filter});
            Object.defineProperty(this, 'section', {value: section});
            Object.defineProperty(this, 'options', {value: {...options.properties}});

            Object.defineProperty(this, 'inflight', {value: new Set()});
            Object.defineProperty(this, '__ident_0', {value: `dcl:${section}.${makeUUID()}`});

            console.assert(!DynContentLoader.instances.has(section), `dcl:${section} already exists..`);
            DynContentLoader.instances.add(section);

            /** @type {Boolean|Promise} */
            this.ready = false;
        }

        /**
         * Tells whether the section is active (i.e. in current view to the user)
         * @returns {boolean} to be or not to be
         */
        get visible() {
            return M.currentdirid === this.section;
        }

        /**
         * Sort nodes based on current sorting parameters
         * @returns {void}
         */
        sortNodes() {
            const {sortmode, sortRules} = M;

            if (sortmode) {
                const {n, d} = sortmode;
                const sort = sortRules[n];

                if (typeof sort === 'function') {
                    return sort(d);
                }
            }
            return M.sort();
        }

        /**
         * Initialize rendering for the section.
         * @returns {Promise<*>} void
         */
        async setup() {
            if (!this.ready) {
                document.documentElement.classList.add('wait-cursor');

                this.ready = this.fetch().catch(dump)
                    .finally(() => {
                        if (this.visible) {
                            document.documentElement.classList.remove('wait-cursor');
                        }
                        this.ready = true;
                    });
            }

            return this.update();
        }

        /**
         * Preload required nodes from FMDB.
         * @returns {Promise<*>} void
         */
        async fetch() {
            const opts = Object.assign({limit: 200, offset: 0}, this.options);

            const inflight = [];
            await fmdb.getchunk('f', opts, (chunk) => {
                opts.offset += opts.limit;
                opts.limit = Math.min(122880, opts.limit << 1);

                const bulk = [];
                for (let i = chunk.length; i--;) {
                    const n = chunk[i];

                    if (!M.d[n.h] && this.filter(n)) {
                        bulk.push(n.h);
                    }
                }

                if (bulk.length) {
                    inflight.push(
                        dbfetch.geta(bulk)
                            .then(() => this.visible && this.update(bulk.map(h => M.d[h])))
                            .catch(dump)
                    );
                }
            });

            return inflight.length && Promise.allSettled(inflight);
        }

        /**
         * Update the list of filtered nodes by the property
         * @param {Array} [nodes] Array of filtered MegaNodes, if none given this is the first rendering attempt.
         * @returns {*} void
         */
        update(nodes) {
            if (nodes) {
                const {v: list, megaRender: {megaList} = false} = M;

                if (nodes.length) {
                    list.push(...nodes.filter(this.filter));
                    this.sortNodes();
                }

                if (megaList && list.length) {
                    megaList.batchReplace(list);
                }
                else {
                    M.renderMain(false);
                }
            }
            else {
                M.v = [];
                for (const h in M.d) {
                    if (this.filter(M.d[h])) {
                        M.v.push(M.d[h]);
                    }
                }
            }

            if (!M.v.length) {
                this.setEmptyPage().catch(dump);
            }
        }

        /**
         * Synchronize updated nodes.
         * @param {MegaNode} n The ufs-node being updated
         * @returns {void} void
         */
        sync(n) {
            if (this.visible) {
                this.inflight.add(n.h);

                delay(this.__ident_0, () => {
                    const inflight = new Set(this.inflight);
                    this.inflight.clear();

                    if (this.visible && inflight.size) {
                        for (let i = M.v.length; i--;) {
                            const {h} = M.v[i];

                            if (inflight.has(h)) {
                                const n = M.d[h];

                                if (!this.filter(n)) {
                                    removeUInode(n.h);
                                }
                                inflight.delete(h);
                            }
                        }
                        this.update([...inflight].map(h => M.d[h]));
                    }
                }, 35);
            }
        }

        async setEmptyPage() {
            await this.ready;
            if (this.visible && !M.v.length) {
                $(`.fm-empty-${this.section}`, '.fm-right-files-block').removeClass('hidden');
            }
        }

        get [Symbol.toStringTag]() {
            return 'DynContentLoader';
        }
    }

    Object.defineProperty(DynContentLoader, 'instances', {value: new Set()});

    // map handle to root name
    var maph = function(h) {
        if (h === M.RootID) {
            return h + ' (RootID)';
        }
        if (h === M.InboxID) {
            return h + ' (InboxID)';
        }
        if (h === M.RubbishID) {
            return h + ' (RubbishID)';
        }

        if (d > 1) {
            return h + ' ('
                + M.getPath(M.currentdirid)
                    .reverse()
                    .map(function(h) {
                        return M.getNameByHandle(h);
                    })
                    .join('/')
                + ')';
        }

        return h;
    };

    // deferred page handlers
    const pipe = freeze({
        sink: freeze({
            account() {
                accountUI();
            },
            dashboard() {
                dashboardUI();
            },
            devices() {
                if (mega.backupCenter) {
                    return mega.backupCenter.openSection();
                }
                M.openFolder('fm');
            },
            recents() {
                openRecents();
            },
            refer() {
                affiliateUI();
            },
            transfers() {
                console.assert(M.v && M.v.length === 0, 'view list must be empty');
            }
        }),

        thrown(ex) {
            self.reportError(ex);
            return M.openFolder('fm');
        },

        has(id) {
            if (this.sink[id]) {
                return this.sink[id];
            }
            const p = Object.keys(this.sink);

            for (let i = p.length; i--;) {

                if (id.startsWith(p[i])) {

                    return this.sink[p[i]];
                }
            }
        }
    });

    /**
     * Invoke M.openFolder() completion.
     *
     * @param {String}      id               The folder id
     * @param {Boolean}     first            Whether this is the first open call
     * @private
     */
    var _openFolderCompletion = function(id, first) {
        // if the id is a file handle, then set the folder id as the file's folder.
        var n;
        var fid;

        if (M.d[id] && (M.d[id].t === 0)) {
            fid = fileversioning.getTopNodeSync(id);
            id = M.d[fid].p;
        }
        this.previousdirid = this.currentdirid;
        this.currentdirid = id;
        this.currentrootid = this.chat ? "chat" : this.getNodeRoot(id);
        this.currentLabelType = M.labelType();
        this.currentLabelFilter = M.filterLabel[this.currentLabelType];
        this.fmsorting = id === 'shares' || id === 'out-shares' || id === 'public-links' ?
            0 : fmconfig.uisorting | 0;
        this.currentCustomView = this.isCustomView(id);

        if (first) {
            fminitialized = true;

            mBroadcaster.sendMessage('fm:initialized');
            if (d) {
                console.log('d%s, c%s, t%s', $.len(this.d), $.len(this.c), $.len(this.tree));
                console.log('RootID=%s, InboxID=%s, RubbishID=%s', this.RootID, this.InboxID, this.RubbishID);
            }
        }

        if (d) {
            console.log('previd=%s, currid=%s, currroot=%s',
                maph(this.previousdirid), maph(this.currentdirid), maph(this.currentrootid));
        }

        if (this.currentrootid === this.RootID) {
            this.lastSeenCloudFolder = this.currentdirid;
        }
        else if (this.currentrootid === 's4') {
            let target = id;

            if (!('kernel' in s4 && (target = s4.utils.validateS4Url(id)))) {
                console.error('invalid code-path...');
                return this.openFolder('fm').catch(dump);
            }

            if (target !== id) {
                this.currentdirid = id = target;
                this.currentCustomView = this.isCustomView(id);
            }

            // Render S4 section / S4 FM header
            queueMicrotask(() => s4.ui.render());
        }

        const $fmRightFilesBlock = $('.fm-right-files-block');
        const $fmRightHeader = $('.fm-right-header', $fmRightFilesBlock);
        const $resultsCount = $('.fm-search-count', $fmRightHeader).addClass('hidden');

        $('.nw-fm-tree-item.opened').removeClass('opened');
        $('.fm-notification-block.duplicated-items-found').removeClass('visible');
        $('.fm-breadcrumbs-wrapper, .column-settings.overlap', $fmRightFilesBlock).removeClass('hidden');

        if (folderlink && !pfcol || id !== M.RootID && M.currentrootid === M.RootID) {
            this.gallery = 0;
            if ((fmconfig.uiviewmode | 0) && fmconfig.viewmode === 2 ||
                typeof fmconfig.viewmodes !== 'undefined' && typeof fmconfig.viewmodes[id] !== 'undefined'
                && fmconfig.viewmodes[id] === 2) {
                this.gallery = 1;
            }
            $('.fm-files-view-icon').filter('.media-view').removeClass('hidden');
        }
        else {
            $('.fm-files-view-icon').filter('.media-view').addClass('hidden');
        }

        if (mega.ui.mNodeFilter) {
            // XXX: Do not reset the filter selections if navigated to the same location.
            let stash = this.previousdirid === this.currentdirid;

            if (!stash && this.previousdirid) {
                stash = this.search && String(this.previousdirid).substr(0, 6) === 'search';
            }
            mega.ui.mNodeFilter.resetFilterSelections(stash);
        }

        if (id === undefined && folderlink) {
            // Error reading shared folder link! (Eg, server gave a -11 (EACCESS) error)
            // Force cleaning the current cloud contents and showing an empty msg
            this.renderMain();
        }
        // Skip M.renderMain and clear folder nodes for sections without viewmode switchers
        else if (this.chat || !id ||
            (this.gallery && (!is_mobile || !pfcol)) ||
            id.substr(0, 7) === 'account' ||
            id.substr(0, 7) === 'devices' ||
            id.substr(0, 9) === 'dashboard' ||
            id.substr(0, 15) === 'user-management' ||
            id.substr(0, 5) === 'refer') {

            this.v = [];
            delay.cancel('rmSetupUI');

            if (typeof sharedFolderUI === 'function') {
                // Remove shares-specific UI.
                sharedFolderUI();
            }

            if (this.gallery) {
                queueMicrotask(() => {
                    galleryUI(this.gallery > 1 && this.currentCustomView.nodeID);
                });
            }
        }
        else {

            if (d) {
                console.time('time for rendering');
            }

            $fmRightFilesBlock.removeClass('hidden');

            if (id === 'transfers') {
                this.v = [];
            }
            else if ($.ofShowNoFolders) {
                delete $.ofShowNoFolders;

                this.v = (function _(v) {
                    var p = [];
                    var hton = function(h) {
                        return M.d[h];
                    };
                    var fltn = function(h) {
                        var n = M.d[h];
                        if (n) {
                            if (!n.t) {
                                return h;
                            }
                            p.push(h);
                        }
                        return '';
                    };
                    return v.reduce(function(v, h) {
                        return v.concat(Object.keys(M.c[h] || {}));
                    }, []).map(fltn).filter(String).map(hton).concat(p.length ? _(p) : []);
                })([id]);
            }
            else if (id.substr(0, 6) === 'search') {
                this.filterBySearch(this.currentdirid);
                $('.fm-breadcrumbs-wrapper', $fmRightHeader).addClass('hidden');
                $('.column-settings.overlap').addClass('hidden');
                $resultsCount.removeClass('hidden');
                $resultsCount.text(mega.icu.format(l.search_results_count, M.v.length));
            }
            else if (this.currentCustomView) {
                this.filterByParent(this.currentCustomView.nodeID);
            }
            else if (dynPages[id]) {
                this.dynContentLoader[id].setup().catch(dump);
            }
            else {
                this.filterByParent(this.currentdirid);
            }

            if (id.substr(0, 9) !== 'transfers') {
                this.labelFilterBlockUI();
            }


            var viewmode = 0;// 0 is list view, 1 block view
            if (this.overrideViewMode !== undefined) {
                viewmode = this.overrideViewMode;
                delete this.overrideViewMode;
            }
            else if (fmconfig.uiviewmode | 0) {
                viewmode = fmconfig.viewmode | 0;
            }
            else if (typeof fmconfig.viewmodes !== 'undefined' && typeof fmconfig.viewmodes[id] !== 'undefined') {
                viewmode = fmconfig.viewmodes[id];
            }
            else if (this.currentCustomView && typeof fmconfig.viewmodes !== 'undefined'
                && typeof fmconfig.viewmodes[this.currentCustomView.original] !== 'undefined') {
                viewmode = fmconfig.viewmodes[this.currentCustomView.original];
            }
            else {
                for (var i = Math.min(this.v.length, 200); i--;) {
                    n = this.v[i];

                    if (String(n.fa).indexOf(':0*') > 0 || is_image2(n)
                        || is_video(n) || MediaInfoLib.isFileSupported(n)) {

                        viewmode = 1;
                        break;
                    }
                }
            }
            this.viewmode = viewmode;

            // Default to Thumbnail View When Media Discovery View Not Available
            if (this.viewmode === 2) {
                this.viewmode = 1;
            }

            if (is_mobile) {
                // Ignore sort modes set in desktop until that is supported in mobile...
                // this.overrideSortMode = this.overrideSortMode || ['name', 1];
            }

            if (this.overrideSortMode) {
                this.doSort(this.overrideSortMode[0], this.overrideSortMode[1]);
                delete this.overrideSortMode;
            }
            else if (this.fmsorting && fmconfig.sorting) {
                this.doSort(fmconfig.sorting.n, fmconfig.sorting.d);
            }
            else if (fmconfig.sortmodes && fmconfig.sortmodes[id]) {
                this.doSort(fmconfig.sortmodes[id].n, fmconfig.sortmodes[id].d);
            }
            else {
                this.doSort('name', 1);
            }
            this.renderMain();

            if (fminitialized && !is_mobile) {
                var currentdirid = this.currentdirid;

                if (id.substr(0, 6) === 'search') {
                    currentdirid = this.RootID;

                    if (this.d[this.previousdirid]) {
                        currentdirid = this.previousdirid;
                    }
                }

                var prefixPath = '';
                var treeid = currentdirid;
                var nodeid = currentdirid;

                if (this.currentCustomView) {
                    treeid = this.currentCustomView.prefixTree + this.currentCustomView.nodeID;
                    nodeid = this.currentCustomView.nodeID;
                    prefixPath = this.currentCustomView.prefixPath;
                }

                if (treeid.indexOf('/') > -1) {
                    treeid = treeid.split('/')[0];
                }

                if (!document.getElementById(`treea_${treeid}`)) {
                    n = this.d[nodeid];
                    if (n && n.p) {
                        M.onTreeUIOpen(prefixPath + n.p, false, true);
                    }
                }

                M.onTreeUIOpen(currentdirid);
                $('#treea_' + treeid).addClass('opened');

                onIdle(() => {
                    M.renderPathBreadcrumbs(fid);
                });
            }
            if (d) {
                console.timeEnd('time for rendering');
            }
        }

        let path = `fm/${this.currentdirid}`;

        // If a folderlink, and entering a new folder.
        if (pfid && this.currentrootid === this.RootID) {
            let target = '';

            if (this.currentdirid !== this.RootID) {
                target = `/folder/${this.currentdirid}`;
            }
            else if ($.autoSelectNode) {
                const n = this.getNodeByHandle($.autoSelectNode);
                if (n.p) {
                    target = `/folder/${n.p}`;
                }
            }
            path = `folder/${pfid}#${pfkey}${target}`;

            if (window.pfcol) {
                path = path.replace('folder/', 'collection/');
            }
            this.lastSeenFolderLink = path;
        }

        if (!this.chat && getSitePath() !== `/${path}`) {
            loadSubPage(path);
        }

        delay('render:search_breadcrumbs', () => M.renderSearchBreadcrumbs());
        M.initLabelFilter(this.v);
        // Potentially getting back?
        // M.treeSearchUI();
        // M.treeSortUI();
        // M.treeFilterUI();
        // M.redrawTreeFilterUI();
    };

    // ------------------------------------------------------------------------
    // ------------------------------------------------------------------------
    // ------------------------------------------------------------------------
    /**
     * Open Cloud Folder or Site Section/Page
     *
     * @param {String}  id      The folder id
     * @param {Boolean} [force] If that folder is already open, re-render it
     * @returns {Promise} fulfilled on completion
     */
    MegaData.prototype.openFolder = async function(id, force) {
        let isFirstOpen, fetchDBNodes, fetchDBShares, sink;

        document.documentElement.classList.remove('wait-cursor');

        if (d) {
            console.warn('openFolder(%s, %s), currentdir=%s, fmloaded=%s',
                maph(id), force, maph(this.currentdirid), loadfm.loaded);
        }

        if (!loadfm.loaded) {
            console.error('Internal error, do not call openFolder before the cloud finished loading.');
            throw EACCESS;
        }

        if (!fminitialized) {
            isFirstOpen = true;
        }
        else if (id && id === this.currentdirid && !force) {
            // Do nothing if same path is chosen
            return EEXIST;
        }
        let cv = this.isCustomView(id);

        const $viewIcons =
            $(`.fm-files-view-icon${pfid ? '' : ':not(.media-view)'}`)
                .removeClass('hidden');
        $('.fm-right-account-block, .fm-right-block, .fm-filter-chips-wrapper').addClass('hidden');

        this.chat = false;
        this.search = false;
        this.recents = false;
        this.albums = false;

        if (
            this.gallery
            && (
                mega.gallery.sections[id]
                || (pfid && $viewIcons.filter('.media-view').hasClass('active'))
            )
        ) {
            // @todo call completion (?)
            $('.gallery-tabs-bl', '.fm-right-files-block').removeClass('hidden');
        }
        else {
            this.gallery = false;
        }

        if (id === 'rubbish') {
            id = this.RubbishID;
        }
        else if (id === 'backups') {
            id = this.BackupsId || this.RootID;
        }
        else if (id === 'inbox') {
            id = this.InboxID;
        }
        else if (id === 'cloudroot' || id === 'fm' || id === this.InboxID && !window.vw) {
            id = this.RootID;
        }
        else if (id && id.substr(0, 4) === 'chat') {
            if (is_mobile) {
                // @todo implement the chat on mobile :)
                id = this.RootID;
            }
            else {
                var self = this;
                this.chat = true;

                return new Promise((resolve, reject) => {
                    _openFolderCompletion.call(self, id, isFirstOpen);

                    if (isFirstOpen) {
                        // do not wait for the chat to load on the first call
                        resolve(id);
                    }

                    onIdle(function _(isInitial) {
                        if (!megaChatIsReady) {
                            // Wait for the chat to be ready (lazy loading)
                            M.renderChatIsLoading();
                            return mBroadcaster.once('chat_initialized', SoonFc(20, _.bind(this, true)));
                        }
                        if (!self.chat) {
                            // We moved elsewhere meanwhile
                            return reject(EACCESS);
                        }

                        M.addTreeUI();
                        megaChat.renderListing(id, isInitial).then(resolve).catch(reject);
                    });
                });
            }
        }
        else if (id && id.substr(0, 15) === 'user-management' && is_mobile) {

            id = this.RootID;
        }
        else if (id && id.substr(0, 15) === 'user-management' && u_attr && u_attr.pf) {

            M.onFileManagerReady(() => {

                M.onSectionUIOpen('user-management');

                // If Pro Flexi flexi, show just the invoices
                M.require('businessAcc_js', 'businessAccUI_js').done(() => {

                    var usersM = new BusinessAccountUI();

                    usersM.viewBusinessInvoicesPage();
                });
            });
        }
        else if (id && id.substr(0, 15) === 'user-management') {

            // @todo move elsewhere, likely within one of those business files.
            M.onFileManagerReady(() => {

                M.onSectionUIOpen('user-management');

                // id = 'user-management';
                M.require('businessAcc_js', 'businessAccUI_js').done(() => {

                    if (!new BusinessAccount().isBusinessMasterAcc()) {
                        return M.openFolder('cloudroot');
                    }
                    const subPage = id.replace('/', '').split('user-management')[1];
                    if (u_attr.b.s === -1 && !(subPage && subPage === 'account')) {
                        return M.openFolder('cloudroot');
                    }

                    var usersM = new BusinessAccountUI();

                    // checking if we loaded sub-users and drew them
                    if (!usersM.initialized) {

                        // if not, then the fastest way is to render the business home page
                        usersM.viewSubAccountListUI(undefined, undefined, true);
                    }
                    else if (usersM.isRedrawNeeded(M.suba, usersM.business.previousSubList)) {
                        usersM.viewSubAccountListUI(undefined, undefined, true);
                    }

                    if (subPage && subPage.length > 2) {
                        if (subPage === 'account') {
                            usersM.viewBusinessAccountPage();
                        }
                        else if (subPage === 'invoices') {
                            usersM.viewBusinessInvoicesPage();
                        }
                        else if (subPage.indexOf('invdet!') > -1) {
                            var invId = subPage.split('!')[1];
                            usersM.viewInvoiceDetail(invId);
                        }
                        else if (subPage.length === 11) {
                            usersM.viewSubAccountInfoUI(subPage);
                        }
                        else {
                            usersM.viewSubAccountListUI();
                        }
                    }
                    else {
                        // No need to check if the current object is not the first instance
                        // because rendering is optimized inside it
                        usersM.viewSubAccountListUI();
                    }
                });
            });
        }
        else if (id === 'shares') {
            id = 'shares';
        }
        else if (id === 'out-shares') {
            id = 'out-shares';
        }
        else if (id === 'public-links') {
            id = 'public-links';
        }
        else if (id === 'file-requests') {
            id = 'file-requests';
        }
        else if (id && id.substr(0, 7) === 'search/') {
            this.search = true;
        }
        else if (id && id.substr(0, 10) === 'discovery/') {
            if (cv.nodeID === M.RootID || cv.nodeID === M.RubbishID || !M.d[cv.nodeID]) {
                // Preventing MD on root folder
                return M.openFolder('cloudroot');
            }

            fetchDBNodes = true;
            id = cv.nodeID;

            this.gallery = 2;
        }
        else if (cv.type === 'gallery' || window.pfcol) {
            this.albums = 1;
            this.gallery = 1;
        }
        else if (cv.type === 's4') {

            id = cv.nodeID;
            fetchDBNodes = ['container', 'bucket'].includes(cv.subType) && id.length === 8;
        }
        else if (
            id &&
            (
                id.substr(0, 11) === 'out-shares/' ||
                id.substr(0, 13) === 'public-links/' ||
                id.substr(0, 14) === 'file-requests/'
            )
        ) {
            fetchDBNodes = true;
            id = cv.nodeID;
        }
        else if (String(id).length === 11 && !id.includes('/')) {
            if (M.u[id] && id !== u_handle) {
                loadSubPage('fm/chat/contacts/' + id);
            }
            else {
                loadSubPage('fm/chat/contacts');
            }
            return EAGAIN;
        }
        else if (id && id.startsWith('albums')) {
            this.albums = true;
        }
        else {
            if (id && id.substr(0, 9) === 'versions/') {
                id = id.substr(9);
            }
            if (!id) {
                id = this.RootID;
            }
            else if ((sink = pipe.has(id))) {
                if (d) {
                    console.info(`Using deferred sink for ${id}...`);
                }
            }
            else if (!this.d[id] || this.d[id].t && !this.c[id]) {
                fetchDBNodes = !id || id.length !== 8 ? -1 : !!window.fmdb;
            }
        }

        if (!this.chat && megaChatIsReady) {
            megaChat.cleanup();
        }

        const {promise} = mega;
        const masterPromise = promise.then((h) => {
            if (d) {
                console.warn('openFolder completed for %s, currentdir=%s', maph(id), maph(M.currentdirid));
                console.assert(String(id).endsWith(h));
            }

            delay(`mega:openfolder!${id}`, () => {
                if (M.currentdirid !== id) {
                    return;
                }

                if (sink) {
                    tryCatch(sink, pipe.thrown)(id);
                }

                if ($.autoSelectNode) {
                    $.selected = [$.autoSelectNode];
                    delete $.autoSelectNode;
                    reselect(1);
                }
                mBroadcaster.sendMessage('mega:openfolder', id);
                $.tresizer();
            }, 90);

            return h;
        });

        fetchDBNodes = fetchDBNodes || dbfetch.isLoading(id);

        if (fetchDBNodes > 0 || $.ofShowNoFolders) {

            if ($.ofShowNoFolders) {
                if (fmdb) {
                    await dbfetch.tree([id]);
                }
            }
            else if (id && !dynPages[id]) {
                const stream = fminitialized && !is_mobile;

                if (stream) {
                    // eslint-disable-next-line local-rules/open -- not a window.open() call.
                    await dbfetch.open(id, promise).catch(dump);
                }
                else if (!this.d[id] || this.d[id].t && !this.c[id]) {

                    await dbfetch.get(id);
                }
            }
        }

        // Check this is valid custom view page. If not, head to its root page.
        if (cv && !M.getPath(cv.original).length) {
            cv = M.isCustomView(cv.type);

            if (!cv) {
                id = M.RootID;
            }
        }
        else if (M.getPath(id).pop() === 'shares') {

            fetchDBShares = true;
        }
        else if (!this.d[id] && !dynPages[id] && !sink && (pfid || fetchDBNodes)) {

            id = M.RootID;
        }

        if (fetchDBShares) {
            const handles = Object.keys(M.c.shares || {});

            for (let i = handles.length; i--;) {
                if (M.d[handles[i]]) {
                    handles.splice(i, 1);
                }
            }

            if (handles.length) {
                if (mega.infinity && !$.inSharesRebuild) {
                    // @todo validate which nodes are legit to query here
                    loadingDialog.show();
                }
                await dbfetch.geta(handles).catch(dump);
            }

            if (!$.inSharesRebuild) {
                $.inSharesRebuild = Date.now();

                queueMicrotask(() => {
                    mega.keyMgr.decryptInShares()
                        .then(() => {
                            return this.showContactVerificationDialog();
                        })
                        .catch(dump);
                });
                M.buildtree({h: 'shares'}, M.buildtree.FORCE_REBUILD);
            }
        }

        // In MEGA Lite mode, remove this temporary class
        if (mega.lite.inLiteMode) {
            $('.files-grid-view.fm').removeClass('mega-lite-hidden');
        }

        _openFolderCompletion.call(this, id = cv.original || id, isFirstOpen);

        onIdle(() => {
            promise.resolve(id);
        });
        return masterPromise;
    };

    /**
     * Tells whether this is dynamic-handled site section.
     * @param {String} name page/section name.
     * @returns {Number} 0: no, -1: yes, but not initialized yet, 1: yes, but not visible, 2: yes, and visible
     */
    MegaData.prototype.isDynPage = function(name) {
        if (!dynPages[name]) {
            return 0;
        }

        if (!DynContentLoader.instances.has(name)) {
            return -1;
        }

        return this.dynContentLoader[name].visible + 1;
    };

    /** @property MegaData.dynContentLoader */
    lazy(MegaData.prototype, 'dynContentLoader', () => {
        const obj = Object.create(null);
        Object.keys(dynPages)
            .reduce((o, k) =>
                lazy(o, k, () => new DynContentLoader({section: k, ...dynPages[k]})), obj);
        return obj;
    });
})(this);

/**
 * Render cloud listing layout.
 * @param {Boolean} aUpdate  Whether we're updating the list
 */
MegaData.prototype.renderMain = function(aUpdate) {
    'use strict';
    var container;
    var numRenderedNodes = -1;

    if (d) {
        console.time('renderMain');
    }

    if (!aUpdate) {
        if (this.megaRender) {
            this.megaRender.destroy();
        }
        this.megaRender = new MegaRender(this.viewmode);
    }
    else if (!this.megaRender) {

        console.timeEnd('renderMain');
        return;
    }

    if (this.previousdirid === "recents" && this.recentsRender) {
        this.recentsRender.cleanup();
    }

    // cleanupLayout will render an "empty grid" layout if there
    // are no nodes in the current list (Ie, M.v), if so no need
    // to call renderLayout therefore.
    if (this.megaRender.cleanupLayout(aUpdate, this.v, this.fsViewSel)) {
        numRenderedNodes = this.megaRender.renderLayout(aUpdate, this.v);
        container = this.megaRender.container;
    }

    // No need to bind mouse events etc (gridUI/iconUI/selecddUI)
    // if there weren't new rendered nodes (Ie, they were cached)
    if (numRenderedNodes) {
        if (!aUpdate) {
            if (this.viewmode) {
                thumbnails.cleanup();
            }
        }
        this.rmSetupUI(aUpdate, aUpdate ? !!$.dbOpenHandle : false);
    }

    this.initShortcutsAndSelection(container, aUpdate);

    if (!container || typeof container === 'string') {
        this.megaRender.destroy();
        delete this.megaRender;
    }
    else if (!aUpdate) {
        Object.defineProperty(this, 'rmItemsInView', {
            get() {
                const l = Object(M.megaRender).megaList;
                const c = l && l._calculated || false;
                return c.itemsPerPage + c.itemsPerRow | 0;
            },
            configurable: true
        });
    }

    if (d) {
        console.timeEnd('renderMain');
    }
};


/**
 * Helper for M.renderMain
 * @param {Boolean} u Whether we're just updating the list
 */
MegaData.prototype.rmSetupUI = function(u, refresh) {
    'use strict';
    if (this.gallery) {
        return;
    }

    if (this.viewmode === 1) {
        M.addIconUI(u, refresh);
    }
    else {
        M.addGridUIDelayed(refresh);
    }
    if (!u) {
        fm_thumbnails();
    }
    onIdle(fmtopUI);

    if (this.onRenderFinished) {
        onIdle(this.onRenderFinished);
        delete this.onRenderFinished;
    }

    var cmIconHandler = function _cmIconHandler(listView, elm, ev, options) {
        const isDefault = typeof options === 'undefined';
        const postEventHandler = options && options.post || null;

        $.hideContextMenu(ev);
        var target = listView ? $(this).closest('tr') : $(this).parents('.data-block-view');

        if (!target.hasClass('ui-selected')) {
            target.parent().find(elm).removeClass('ui-selected');
            selectionManager.clear_selection();
        }
        target.addClass('ui-selected');

        selectionManager.add_to_selection(target.attr('id'));
        $.gridLastSelected = target[0];

        ev.preventDefault();
        ev.stopPropagation(); // do not treat it as a regular click on the file
        ev.currentTarget = target;

        if (isDefault) {
            delay('render:search_breadcrumbs', () => M.renderSearchBreadcrumbs());

            if ($(this).hasClass('active')) {
                $(this).removeClass('active');
            }
            else {
                M.contextMenuUI(ev, 1);
                $(this).addClass('active');
            }
        }

        if (postEventHandler) {
            postEventHandler.call(this, target.attr('id'));
        }

        return false;
    };

    const cvHandler = (ev, element) => {
        if (!element.hasClass('ui-selected')) {
            element.parent().find(true).removeClass('ui-selected');
            selectionManager.clear_selection();
        }
        element.addClass('ui-selected');
        ev.preventDefault();
        ev.stopPropagation(); // do not treat it as a regular click on the file
        ev.currentTarget = element;

        selectionManager.add_to_selection(element.attr('id'));
        return fingerprintDialog(M.d[$.selected[0]].su);
    };

    $('.grid-scrolling-table .grid-url-arrow').rebind('click', function(ev) {
        return cmIconHandler.call(this, true, 'tr', ev);
    });
    $('.data-block-view .file-settings-icon').rebind('click', function(ev) {
        return cmIconHandler.call(this, false, 'a', ev);
    });
    $('.grid-scrolling-table .fm-user-verification span').rebind('click.sharesui', function(ev) {
        var target = $(this).closest('tr');
        return cvHandler(ev, target);
    });
    $('.shared-blocks-view .fm-user-verification span').rebind('click.sharesui', function(ev) {
        var target = $(this).closest('a');
        return cvHandler(ev, target);
    });
    if (M.currentrootid === 'file-requests') {
        mega.fileRequest.rebindListManageIcon({
            iconHandler: cmIconHandler
        });
    }

    if (!u) {

        // Re-add the searchbar dropdown event listeners
        mega.ui.searchbar.addDropdownEventListeners();

        if (this.currentrootid === 'shares') {
            let savedUserSelection = null;

            var prepareShareMenuHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget = $('#treea_' + M.currentdirid);
                e.calculatePosition = true;
                if (d) {
                    console.assert(e.currentTarget.length === 1, `Tree ${M.currentdirid} not found.`, e);
                }
            };

            $('.shared-details-info-block .grid-url-arrow').rebind('click.sharesui', function(e) {

                const $this = $(this);
                prepareShareMenuHandler(e);

                if ($this.hasClass('active')) {
                    $this.removeClass('active');
                    $.hideContextMenu();
                }
                else {
                    // Close Info panel as no longer applicable (they clicked on the parent folder context menu)
                    mega.ui.mInfoPanel.closeIfOpen();
                    $.hideContextMenu();

                    // Set selection to the parent share dir so the context menu can Download/Copy/Info on the parent
                    selectionManager.resetTo(M.currentdirid);

                    M.contextMenuUI(e, 1);
                    $this.addClass('active');
                }
            });

            $('.shared-details-info-block .fm-share-download').rebind('click', function(e) {
                const $this = $(this);
                if ($this.hasClass('disabled')) {
                    console.warn('disabled');
                    return false;
                }
                prepareShareMenuHandler(e);

                if ($this.hasClass('active')) {
                    $this.removeClass('active');
                    $.hideContextMenu();

                    if (window.selectionManager) {
                        selectionManager.clear_selection();
                    }
                    else {
                        $.selected = [];
                    }
                }
                else {
                    $.hideContextMenu();
                    $this.addClass('active disabled');
                    megasync.isInstalled((err, is) => {
                        if (!$this.hasClass('disabled')) {
                            return false;
                        }
                        $this.removeClass('disabled');

                        if (window.selectionManager) {
                            // selectionManager.resetTo(M.currentdirid);
                            selectionManager.select_all();
                        }
                        else {
                            $.selected = [M.currentdirid];
                        }

                        if (!err || is) {
                            M.addDownload($.selected);
                        }
                        else {
                            const {top, left} = $this.offset();
                            e.clientY = top + $this.height();
                            e.clientX = left;
                            M.contextMenuUI(e, 3);
                        }
                    });
                }
            });

            $('.shared-details-info-block .fm-share-copy').rebind('click', function () {
                if (!$.selected || !$.selected.length) {
                    var $selectedFromTree = $('#treesub_shares' + ' .nw-fm-tree-item.selected');
                    if ($selectedFromTree && $selectedFromTree.length) {
                        var tempTree = [];
                        for (var i = 0; i < $selectedFromTree.length; i++) {
                            var selectedElement = $selectedFromTree[i].id;
                            tempTree.push(selectedElement.replace('treea_', ''));
                        }
                        $.selected = tempTree;
                    }
                }
                openCopyDialog();
            });

            // From inside a shared directory e.g. #fm/INlx1Kba and the user clicks the 'Leave share' button
            $('.shared-details-info-block .fm-leave-share').rebind('click', function(e) {
                if (M.isInvalidUserStatus()) {
                    return;
                }

                // Get the share ID from the hash in the URL
                var shareId = getSitePath().replace('/fm/', '');

                // Remove user from the share
                M.leaveShare(shareId).catch(ex => {
                    if (ex === EMASTERONLY) {
                        msgDialog('warningb', '',
                                  l.err_bus_sub_leave_share_dlg_title, l.err_bus_sub_leave_share_dlg_text);
                    }
                });
            });
        }
    }
};

MegaData.prototype.renderTree = function() {
    'use strict';
    var build = tryCatch(function(h) {
        M.buildtree({h: h}, M.buildtree.FORCE_REBUILD);
    });

    if (s4.ui) {
        build('s4');
    }
    build('shares');

    // We are no longer build this tree, however, just leave this for potential later usage.
    // build('out-shares');
    // build('public-links');
    // build(M.InboxID);

    build(M.RootID);
    build(M.RubbishID);

    M.addTreeUIDelayed();
};

MegaData.prototype.hideEmptyGrids = function hideEmptyGrids() {
    'use strict';
    const excluded = ['.transfer-panel-empty-txt', '.fm-recents', '.fm-empty-contacts'];
    $(`.fm-empty-section:not(${excluded.join(',')})`).addClass('hidden');
    $('.fm-empty-section.fm-empty-sharef').remove();
};

/**
 * A function, which would be called on every DOM update (or scroll). This func would implement
 * throttling, so that we won't update the UI components too often.
 *
 */
MegaData.prototype.rmSetupUIDelayed = function(ms) {
    'use strict';
    delay('rmSetupUI', () => this.rmSetupUI(false, true), Math.max(ms | 0, 75));
};

MegaData.prototype.megaListRemoveNode = function(aNode, aHandle) {
    'use strict';
    const {megaRender} = M;
    if (!megaRender) {
        if (d) {
            console.warn('Ignoring invalid MegaRender state..', aHandle);
        }
        return false;
    }

    aHandle = aHandle || aNode.id;
    const node = megaRender.revokeDOMNode(aHandle, true);
    if (!node) {
        if (d) {
            console.warn('revokeDOMNode failed..', aHandle);
        }
        return false;
    }
    return true;
};

MegaData.prototype.megaListRenderNode = function(aHandle) {
    'use strict';
    var megaRender = M.megaRender;
    if (!megaRender) {
        if (d) {
            console.warn('Ignoring invalid MegaRender state..', aHandle);
        }
        return false;
    }
    if (!M.d[aHandle]) {
        if (d) {
            console.warn("megaListRenderNode was called with aHandle '%s' which was not found in M.d", aHandle);
        }
        return false;
    }
    megaRender.numInsertedDOMNodes++;

    var node = megaRender.getDOMNode(aHandle);
    if (!node) {
        if (d) {
            console.warn('getDOMNode failed..', aHandle);
        }
        return false;
    }

    if (!is_mobile) {
        if (!node.__hasMCV) {
            node.__hasMCV = true;
            megaRender.setDOMColumnsWidth(node);
        }

        var selList = selectionManager && selectionManager.selected_list ? selectionManager.selected_list : $.selected;

        if (selList && selList.length) {
            if (selList.includes(aHandle)) {
                node.classList.add('ui-selected');
            }
            else {
                node.classList.remove('ui-selected');
            }
            node.classList.remove('ui-selectee');
        }
        else if (selList && selList.length === 0) {
            node.classList.remove('ui-selected');
        }
    }

    if (M.d[aHandle]) {
        M.d[aHandle].seen = true;
    }

    return node;
};

/**
 * Render a simplified "chat is loading" state UI for when the chat is still not ready but an /fm/chat(?/...) url was
 * accessed.
 */
MegaData.prototype.renderChatIsLoading = function() {
    'use strict';
    M.onSectionUIOpen('conversations');

    M.hideEmptyGrids();

    $('.fm-files-view-icon').addClass('hidden');
    $('.fm-blocks-view').addClass('hidden');
    $('.files-grid-view').addClass('hidden');
    $('.fm-right-account-block').addClass('hidden');

    $('.shared-grid-view,.shared-blocks-view').addClass('hidden');

    $('.fm-right-files-block, .fm-left-panel').addClass('hidden');

    $('.section.conversations').removeClass('hidden');
    $('.section.conversations .fm-chat-is-loading').removeClass('hidden');
};

(function() {
    'use strict';

    /**
     * A helper function which can be used to render breadcrumbs anywhere in the application.
     * Relies on having the same HTML structure as the main cloud drive breadcrumbs.
     *
     * @param {Array} items - a list of breadcrumbs
     * @param {HTMLElement} scope - the wrapper/parent element of the breadcrumbs, used for scoping selectors
     * @param {function} dictionary - a function which will convert a folder id into a breadcumb datun
     * @param {function} clickAction - the function that will be called on clicking a breadcrumb
     * @return {undefined}
     */
    MegaData.prototype.renderBreadcrumbs = function(items, scope, dictionary, clickAction) {
        if (!(scope && scope.parentNode)) {
            return;
        }

        const block = scope.querySelector('.fm-breadcrumbs-block');
        const $block = $(block);
        const dropdown = scope.querySelector('.breadcrumb-dropdown');

        let { html, extraItems } = getPathHTML(items, dictionary, block);

        if (html && html !== '') {
            $block.safeHTML(html);
        }

        removeSimpleTip($('.fm-breadcrumbs', $block));
        showHideBreadcrumbDropdown(extraItems, scope, dropdown);
        if (!scope.parentNode.classList.contains('simpletip-tooltip')) {
            applyBreadcrumbEventHandlers(scope, dropdown, clickAction);
        }
    };

    /**
     * Render the breadcrumbs at the top of the cloud drive, shares, public links and rubbish bin pages.
     *
     * @param {string} fileHandle - the id of the selected file or folder
     * @return {undefined}
     */
    MegaData.prototype.renderPathBreadcrumbs = function(fileHandle, isInfoBlock = false, isSimpletip = false) {
        let scope;

        if (isInfoBlock) {
            scope = document.querySelector('.properties-breadcrumb .fm-breadcrumbs-wrapper');
        }
        else if (isSimpletip) {
            scope = document.querySelector('.simpletip-tooltip .fm-breadcrumbs-wrapper');
        }
        else {
            scope = document.querySelector('.fm-right-files-block .fm-right-header .fm-breadcrumbs-wrapper');
        }

        if (!scope) {
            console.assert(false, 'invalid scope');
            return;
        }

        let items = this.getPath(fileHandle || this.currentdirid);
        const hasRewind = scope.classList.contains('rewind');

        const dictionary = handle => {
            let name = '';
            let typeClass = '';

            const cases = {
                [this.RootID]: () => {
                    if (folderlink && this.d[this.RootID]) {
                        name = this.d[this.RootID].name;
                        typeClass = 'folder';
                    }
                    else {
                        typeClass = 'cloud-drive';
                        name = l[164];
                    }
                },
                contacts: () => {
                    typeClass = 'contacts';
                    name = l[165];
                },
                opc: () => {
                    typeClass = 'sent-requests';
                    name = l[5862];
                },
                ipc: () => {
                    typeClass = 'received-requests';
                    name = l[5863];
                },
                shares: () => {
                    typeClass = 'shared-with-me';
                    name = l[5542];
                },
                'out-shares': () => {
                    typeClass = 'out-shares';
                    name = l[5543];
                },
                'public-links': () => {
                    typeClass = 'pub-links';
                    name = l[16516];
                },
                'file-requests': () => {
                    typeClass = 'file-requests';
                    name = l.file_request_title;
                },
                [this.RubbishID]: () => {
                    typeClass = 'rubbish-bin';
                    name = l[167];
                },
                messages: () => {
                    typeClass = 'messages';
                    name = l[166];
                }
            };

            if (this.BackupsId) {
                cases[this.BackupsId] = () => {
                    typeClass = 'backups';
                    name = l.restricted_folder_button;
                };
            }

            if (cases[handle]) {
                cases[handle]();
            }
            else {
                const n = this.d[handle];
                if (n) {
                    if (n.name) {
                        name = n.name;
                    }
                    if (n.t) {
                        typeClass = 'folder';
                    }
                }
                if (handle.length === 11) {
                    typeClass = 'contact selectable-txt';

                    // Contact should not appears on other than chat/contact pages
                    if (M.currentrootid !== 'chat') {
                        name = '';
                    }
                }
                else if (folderlink) {
                    typeClass = 'folder-link';
                }
                else {
                    typeClass = 'folder';
                }

                if (M.isDynPage(handle)) {
                    const {type, localeName} = this.dynContentLoader[handle].options;
                    if (type) {
                        typeClass = type;
                    }
                    if (localeName) {
                        name = localeName;
                    }
                }
                else if (M.dyh) {
                    const {type, localeName} = M.dyh('breadcrumb-properties', handle);
                    if (type) {
                        typeClass = type;
                    }
                    if (localeName) {
                        name = localeName;
                    }
                }
            }

            return {
                name,
                typeClass,
                id: handle
            };
        };

        this.renderBreadcrumbs(items, scope, dictionary, id => {
            if (hasRewind) {
                return;
            }

            breadcrumbClickHandler.call(this, id);
        });

        // if on info dialog we do not want to open the file versioning dialog
        if (!is_mobile && fileHandle && !isInfoBlock && !isSimpletip) {
            fileversioning.fileVersioningDialog(fileHandle);
        }
    };

    /**
     * Render the breadcrumbs at the bottom of the search page.
     * TODO: unify this with MegaData.renderPathBreadcrumbs
     *
     * @return {undefined}
     */
    MegaData.prototype.renderSearchBreadcrumbs = function() {
        const block = document.querySelector('.fm-main .fm-right-files-block:not(.in-chat)');

        if (this.currentdirid && this.currentdirid.substr(0, 7) === 'search/') {
            if (block) {
                block.classList.remove('search-multi');
            }
            if (self.selectionManager && selectionManager.selected_list.length > 0) {
                block.classList.add('search');

                const scope = block.querySelector('.search-bottom-wrapper');
                scope.classList.remove('hidden');
                const items = this.getPath(selectionManager.selected_list[0]);

                const dictionary = handle => {
                    let id = '';
                    let typeClass = '';
                    let name = '';

                    if (handle.length === 11 && this.u[handle]) {
                        id = handle;
                        typeClass = 'contacts-item';
                        name = this.u[handle].m;
                    }
                    else if (handle === this.RootID && !folderlink) {
                        id = this.RootID;
                        typeClass = 'cloud-drive';
                        name = l[164];
                    }
                    else if (handle === this.RubbishID) {
                        id = this.RubbishID;
                        typeClass = 'recycle-item';
                        name = l[168];
                    }
                    else if (this.BackupsId && handle === this.BackupsId) {
                        id = this.BackupsId;
                        typeClass = 'backups';
                        name = l.restricted_folder_button;
                    }
                    else {
                        const n = this.d[handle];
                        if (n) {
                            id = n.h;
                            name = n.name || '';
                            typeClass = n.t && 'folder' || '';

                            if (n.s4 && n.p === this.RootID) {
                                name = l.obj_storage;
                                typeClass = 's4-object-storage';
                            }
                            else if (this.d[n.p] && this.d[n.p].s4 && this.d[n.p].p === this.RootID) {
                                typeClass = 's4-buckets';
                            }
                        }
                    }

                    return {
                        id,
                        typeClass,
                        name
                    };
                };

                if (selectionManager.selected_list.length === 1) {
                    this.renderBreadcrumbs(items, scope, dictionary, id => {
                        breadcrumbClickHandler.call(this, id);
                    });
                }
                else {
                    scope.classList.add('hidden');
                    block.classList.add('search-multi');
                }

                return;
            }
        }

        if (block) {
            block.classList.remove('search');
        }
    };

    /* Private methods */

    /** Gets the HTML to populate a dropdown of breadcrumbs
     * @param {Array} items - an array of breadcrumb items
     * @return {string} - the HTML to represent the items
     */
    function getBreadcrumbDropdownHTML(items) {
        let contents = '';

        for (let item of items) {

            let icon = '';

            if (item.type === 's4-object-storage') {
                icon = 'icon-object-storage';
            }
            else if (item.type === 's4-buckets') {
                icon = 'icon-bucket-filled';
            }
            else if (item.type === 's4-policies') {
                icon = 'icon-policy-filled';
            }
            else if (item.type === 's4-users') {
                icon = 'icon-user-filled';
            }
            else if (item.type === 's4-groups') {
                icon = 'icon-contacts';
            }
            else if (item.type === 'cloud-drive') {
                icon = 'icon-cloud';
            }
            else if (item.type === 'backups') {
                icon = 'icon-database-filled';
            }
            else if (item.type === 'folder' || item.type === 'folder-link') {
                icon = 'icon-folder-filled';
            }

            contents +=
                `<a class="crumb-drop-link" data-id="${escapeHTML(item.id)}">
                    ${icon === '' ? '' : `<i class="sprite-fm-mono ${icon} icon24"></i>`}
                    <span>${escapeHTML(item.name)}</span>
                </a>`;
        }

        return contents;
    }

    /**
     * Show or hide the breadcrumb dropdown, depending on whether there are items to show in it
     *
     * @param {Array} extraItems - the items to be shown in the dropdown
     * @param {HTMLElement} scope - the wrapper element for the breadcrumbs
     * @param {HTMLElement} dropdown - the dropdown for breadcrumbs which are not shown
     * @return {undefined}
     */
    function showHideBreadcrumbDropdown(extraItems, scope, dropdown) {
        // if we're not displaying the full path, show the dropdown button
        if (extraItems.length) {
            scope.querySelector('.crumb-overflow-link').classList.remove('hidden');
            $(dropdown).safeHTML(getBreadcrumbDropdownHTML(extraItems));
        }
        // otherwise, hide the dropdown button
        else {
            scope.querySelector('.crumb-overflow-link').classList.add('hidden');
        }
    }

    /**
     * Apply events to the main breadcrumbs and any in the overflow dropdown.
     *
     * @param {HTMLElement} scope - the wrapper element for the breadcrumbs
     * @param {HTMLElement} dropdown - the dropdown for breadcrumbs which are not shown
     * @param {function} clickAction - what to do when a breadcrumb is clicked
     * @return {undefined}
     */
    function applyBreadcrumbEventHandlers(scope, dropdown, clickAction) {
        $('.breadcrumb-dropdown-link', scope)
            .rebind('click.breadcrumb-dropdown', function(e) {
                if ($(this).hasClass('info-dlg')) {
                    e.stopPropagation();
                }

                dropdown.classList.toggle('active');

                if (dropdown.classList.contains('active')) {
                    if (dropdown.classList.contains('ps')) {
                        Ps.update(dropdown);
                    }
                    else {
                        Ps.initialize(dropdown);
                    }
                }
            });

        $('.crumb-drop-link, .fm-breadcrumbs', scope).rebind('click.breadcrumb', function(e) {
            dropdown.classList.remove('active');
            let id = $(e.currentTarget).data('id');

            if (id) {
                clickAction(id);
            }
        });

        $('.fm-breadcrumbs', scope).rebind('contextmenu.breadcrumb', () => {
            return false;
        });
    }

    /**
     * Returns the HTML for a full set of breadcrumbs.
     *
     * @param {Array} items - the items in the path
     * @param {function} dictionary - a function which will convert the item id into a full breadcrumb datum
     * @param {HTMLElement} container - the HTMLElement that contains the breadcrumbs
     * @return {object} - the HTML for the breadcrumbs and the list of parent folders not in the breadcrumbs
     */
    function getPathHTML(items, dictionary, container) {
        let html = '';
        let currentPathLength = items.length === 3 ? 12 : 0;
        const maxPathLength = getMaxPathLength(14, container);
        let extraItems = [];
        let isInfoBlock = false;
        let isSimpletip = false;
        let lastPos = 0;

        if (container.parentNode.parentNode.classList.contains('simpletip-tooltip')) {
            isSimpletip = true;
        }
        else if (container.classList.contains('location')) {
            items.shift(); // Show location of item without item itself
        }
        else if (container.classList.contains('info')) {
            isInfoBlock = true;
        }

        const isDyhRoot = M.dyh ? M.dyh('is-breadcrumb-root', items) : false;

        for (let i = 0; i < items.length; i++) {

            if (isSimpletip && i === lastPos) {
                continue;
            }

            let {name, typeClass, id} = dictionary(items[i]);

            // Some items are not shown, so if we don't have a name, don't show this breadcrumb
            // Don't include the contact name (can be removed later if you want it back)
            if (name !== '') {

                const isLastItem = isSimpletip ? i === lastPos + 1 : i === lastPos;
                const isRoot = i === items.length - 1;
                const icon = `${mega.ui.sprites.mono} icon-arrow-right`;
                let item;
                // if we won't have space, add it to the dropdown, but always render the current folder,
                // and root if there are no extraItems
                // for info block we show max 2 items in the in-view breadcrumb
                if (!isDyhRoot && !isLastItem && !isSimpletip &&
                    (currentPathLength > maxPathLength && !isInfoBlock) || (isInfoBlock && i > 1)) {
                    extraItems.push({
                        name,
                        type: typeClass,
                        id
                    });
                }
                // otherwise, add it to the main breadcrumb
                else {
                    name = escapeHTML(name);
                    item = escapeHTML(items[i]);
                    html =
                        `<a class="fm-breadcrumbs ${escapeHTML(typeClass)} ${
                            isRoot || isDyhRoot ? 'root' : ''} ui-droppable"
                            data-id="${item}" id="pathbc-${item}">
                            <span
                                class="right-arrow-bg simpletip simpletip-tc">
                                ${isRoot ? `<span class="not-loading selectable-txt">
                                        ${name}
                                    </span>
                                    <i class="loading sprite-fm-theme icon-loading-spinner"></i>` : name}
                            </span>
                            ${isLastItem ? '' : `<i class="next-arrow ${icon} icon16"></i>`}
                        </a>` + html;

                    // add on some space for the arrow
                    if (isLastItem) {
                        currentPathLength += 6;
                    }
                }
                currentPathLength += name.length;
            }
            // if items in front have empty name, treat next item as last item.
            else if (lastPos === i) {
                lastPos++;
            }
        }

        return { html, extraItems };
    }

    function removeSimpleTip($breadCrumbs) {
        let $currentBreadcrumb;
        for (let i = 0; i < $breadCrumbs.length; i++) {
            $currentBreadcrumb = $($breadCrumbs[i]);
            if ($('span', $currentBreadcrumb).get(0).offsetWidth >= $('span', $currentBreadcrumb).get(0).scrollWidth
                || $currentBreadcrumb.parents('.simpletip-tooltip').length > 0) {
                $('.right-arrow-bg', $currentBreadcrumb).removeClass('simpletip');
            }
        }
    }

    /**
     * Get the (approximate) maximum number of cahracters that can be shown in the breadcrumb container
     *
     * @param {number} fontSize - the font size used for the breadcrumbs
     * @param {HTMLElement} container - the breadcrumbs' container
     * @return {number} - the maximum number of characters
     */
    function getMaxPathLength(fontSize, container) {
        // ~= font size / 2 - fudge factor for approximate average character width
        const maxCharacterWidth = fontSize / 1.5;

        // Assume the largest character is ~square (W/M/etc.), and calc the max number of characters we can show
        return container.offsetWidth / maxCharacterWidth;
    }

    /**
     * Handles clicks on the cloud drive and search breadcrumbs.
     * Note: Must be called with context for `this` to work.
     *
     * @param {string} id - the folder ID, or special ID of the destination
     * @return {undefined}
     */
    function breadcrumbClickHandler(id) {
        const n = this.d[id];
        const specialCases = [
            'shares',
            'out-shares',
            'public-links',
            'file-requests'
        ];
        mBroadcaster.sendMessage('trk:event', 'breadcrumb', 'click', id);

        // super special case (contact)
        if (M.u.hasOwnProperty(id)) {
            loadSubPage("chat/contacts/" + id);
        }
        else if (n) {
            id = n.h;
            let toSelect;

            if (!n.t) {
                toSelect = id;
                id = n.p;
            }

            if (
                M.currentCustomView
                && M.currentCustomView.type !== 'albums'
                && !(M.currentCustomView.prefixPath === 'discovery/' && id === M.RootID)
            ) {
                id = M.currentCustomView.prefixPath + id;
            }

            this.openFolder(id)
                .always(() => {
                    if (toSelect) {
                        $.selected = [toSelect];
                        reselect(1);
                    }
                });
        }
        else if (specialCases.includes(id)) {
            this.openFolder(id);
        }
        else if (M.dyh) {
            M.dyh('breadcrumb-click', id);
        }
    }
})();

/**
 * Initializes Shares UI.
 */
MegaData.prototype.sharesUI = function() {
    "use strict";

    $('.shares-tab-lnk').rebind('click', function() {
        var $this = $(this);
        var folder = escapeHTML($this.attr('data-folder'));

        M.openFolder(folder);
    });
};

/**
 * Open the share dialog
 */
MegaData.prototype.openSharingDialog = function(target) {
    'use strict';

    if (M.isInvalidUserStatus()) {
        return;
    }
    if (u_type === 0) {
        return ephemeralDialog(l[1006]);
    }

    var $dialog = $('.mega-dialog.share-dialog');

    $('.fm-dialog-overlay').rebind('click.closeShareDLG', function() {
        // When click the overlay, only close the share dialog if the lost changes warning dialog isn't there.
        if ($.dialog === 'share' && $('.mega-dialog.confirmation:not(.hidden)').length === 0) {
            showLoseChangesWarning().done(closeDialog);
            return false;
        }
    });

    $(window).rebind('keydown.closeShareDLG', function(e) {
        // When press the Esc key, only close the share dialog if the lost changes warning dialog isn't there.
        if (e.keyCode === 27 && $.dialog === 'share' && $('.mega-dialog.confirmation:not(.hidden)').length === 0) {
            showLoseChangesWarning().done(closeDialog);
            return false;
        }
    });

    var showShareDlg = function() {
        const scl = mBroadcaster.addListener('statechange', () => {

            if ($.dialog === 'fingerprint-dialog') {
                closeDialog();
            }

            if ($.dialog === 'share-add') {
                $('.cancel-add-share').trigger('click');
            }

            console.assert($.dialog === 'share');
            closeDialog();
        });

        $dialog.rebind('dialog-closed.share', () => {
            $dialog.off('dialog-closed.share');

            mBroadcaster.removeListener(scl);
            mega.keyMgr.removeShareSnapshot(target);
        });

        $.hideContextMenu();

        $.addContactsToShare = {};// GLOBAL VARIABLE, add contacts to a share
        $.changedPermissions = {};// GLOBAL VARIABLE, changed permissions shared dialog
        $.removedContactsFromShare = {};// GLOBAL VARIABLE, removed contacts from a share
        $.shareDialog = 'share';

        // @todo refactor!
        // eslint-disable-next-line no-use-before-define
        fillShareDlg(target).catch(dump);

        // Show the share dialog
        return $dialog.removeClass('hidden');
    };

    const fillShareDlg = async(h) => {
        if (!M.d[h]) {
            await dbfetch.get(h);
        }
        const node = M.getNodeByHandle(h);
        const {shares, name, td, tf} = node;
        assert(name);

        var shareKeys = Object.keys(shares || {});

        $('.item-type-icon-90', $dialog).attr('class', `item-type-icon-90 icon-${folderIcon(node)}-90`);

        // This is shared folder, not just folder link
        if (shares && !(shares.EXP && shareKeys.length === 1) || M.ps[h]) {
            $('.remove-share', $dialog).removeClass('disabled');
        }
        else {
            $('.remove-share', $dialog).addClass('disabled');
        }

        // Fill the shared folder's name
        const $folderName = $('.share-dialog-folder-name', $dialog)
            .text(name)
            .removeClass('simpletip')
            .removeAttr('data-simpletip')
            .removeAttr('data-simpletipposition');

        if ($folderName.get(0).offsetWidth < $folderName.get(0).scrollWidth) {
            $folderName
                .addClass('simpletip')
                .attr('data-simpletip', name)
                .attr('data-simpletipposition', 'top');
        }

        // Fill the shared folder's info
        $('.share-dialog-folder-info', $dialog).text(fm_contains(tf, td, false));

        // Render the content of access list in share dialog
        renderShareDialogAccessList();

        return $dialog;
    };

    Promise.resolve(mega.fileRequestCommon.storage.isDropExist(target))
        .then((res) => {
            if (res.length) {
                return mega.fileRequest.showRemoveWarning(res);
            }
        })
        .then(() => mega.keyMgr.setShareSnapshot(target))
        .then(() => M.safeShowDialog('share', showShareDlg))
        .catch(dump);
};

/**
 * Initializes the share dialog to add more people
 *
 * @param {array} alreadyAddedContacts  exclude contacts array
 */
MegaData.prototype.initShareAddDialog = function(alreadyAddedContacts, $extraContent) {
    "use strict";

    // If chat is not ready.
    if (!megaChatIsReady) {
        if (megaChatIsDisabled) {
            console.error('Mega Chat is disabled, cannot proceed');
        }
        else {
            // Waiting for chat_initialized broadcaster.
            loadingDialog.show();
            mBroadcaster.once('chat_initialized',
                              this.initShareAddDialog.bind(this, alreadyAddedContacts, $extraContent));
        }
        return false;
    }

    loadingDialog.hide();

    var dialogPlacer = document.createElement('div');
    $.contactPickerSelected = alreadyAddedContacts; // Global variable for the selected item from the contacts picker

    var closeShareAddDialog = function() {
        closeDialog();

        ReactDOM.unmountComponentAtNode(dialogPlacer);
        dialogPlacer.remove();

        fm_showoverlay();
        renderShareDialogAccessList();
    };

    // Detect the new added contact whether in the remove list or not
    var notRmContacts = function(handle) {
        if ($.removedContactsFromShare && $.removedContactsFromShare[handle]) {
            delete $.removedContactsFromShare[handle];
            return false;
        }
        return true;
    };

    var $shareAddDialog = $extraContent;
    $('.add-share', $shareAddDialog).addClass('disabled');

    $('.cancel-add-share', $shareAddDialog).rebind('click', function() {
        closeShareAddDialog();
    });

    $('.add-share', $shareAddDialog).rebind('click', function() {
        // Add more people to share
        if (!$(this).hasClass('disabled') && !$(this).parents('.share-add-dialog').is('.error')) {
            loadingDialog.pshow();

            var addedContacts = $.contactPickerSelected.filter(function(item) {
                return alreadyAddedContacts.indexOf(item) === -1;
            });

            var removedContacts = alreadyAddedContacts.filter(function(item) {
                return $.contactPickerSelected.indexOf(item) === -1;
            });

            // Is there any existing contacts from the picker list planned for adding to share
            addedContacts.forEach(function(item) {
                if (notRmContacts(item)) {
                    $.addContactsToShare[item] = {
                        u: M.getUserByHandle(item).m,
                        r: 1
                    };
                }
            });

            // Is there any existing contacts from the picker list planned for removing from share
            removedContacts.forEach(function(item) {
                if ($.addContactsToShare[item]) {
                    delete $.addContactsToShare[item];
                }
                else {
                    $.removedContactsFromShare[item] = {
                        'selectedNodeHandle': $.selected[0],
                        'userEmailOrHandle': item,
                        'userHandle': item
                    };
                }
            });

            // Is there any new contacts planned for adding to share
            var $newContacts = $('.token-input-list-mega .token-input-token-mega', $shareAddDialog);
            if ($newContacts.length) {
                var emailText = $('.share-message textarea', $shareAddDialog).val();
                if (emailText === '') {
                    emailText = l[17738];
                }

                for (var i = 0; i < $newContacts.length; i++) {
                    var newContactEmail = $($newContacts[i]).contents().eq(1).text();
                    var newContactHandle = M.findOutgoingPendingContactIdByEmail(newContactEmail)
                        || '#new_' + MurmurHash3(newContactEmail);
                    if (notRmContacts(newContactHandle)) {
                        $.addContactsToShare[newContactHandle] = {
                            u: newContactEmail,
                            r: 1,
                            msg: emailText
                        };
                    }
                }
            }

            loadingDialog.phide();
            closeShareAddDialog();
        }

        return false;
    });

    var extraContentDidMount = function() {
        // Initializes the component of adding new contacts to share
        M.initAddByEmailComponent(alreadyAddedContacts);
        onIdle(() => {
            $('.contacts-search-header input', '.mega-dialog.share-add-dialog .share-add-dialog-top').focus();
        });
    };

    var prop = {
        className: 'mega-dialog share-add-dialog',
        pickerClassName: 'share-add-dialog-top',
        customDialogTitle: l[23710],
        selected: alreadyAddedContacts,
        showSelectedNum: true,
        disableFrequents: true,
        notSearchInEmails: false,
        autoFocusSearchField: false,
        selectCleanSearchRes: false,
        disableDoubleClick: true,
        selectedWidthSize: 62,
        emptySelectionMsg: l[23751],
        newEmptySearchResult: true,
        newNoContact: true,
        highlightSearchValue: true,
        closeDlgOnClickOverlay: false,
        emailTooltips: true,
        extraContent: $extraContent[0],
        onExtraContentDidMount: extraContentDidMount,
        onSelected: function(nodes) {
            $.contactPickerSelected = nodes;

            var $shareAddDialog = $('.mega-dialog.share-add-dialog');

            // Control the add button enable / disable
            if (JSON.stringify(clone($.contactPickerSelected).sort()) === JSON.stringify(alreadyAddedContacts.sort())
                && $('.token-input-list-mega .token-input-token-mega', $shareAddDialog).length === 0) {
                $('.add-share', $shareAddDialog).addClass('disabled');
            }
            else {
                $('.add-share', $shareAddDialog).removeClass('disabled');

                var $rmContacts = alreadyAddedContacts.filter(uHandle => !$.contactPickerSelected.includes(uHandle));
                for (var i = 0; i < $rmContacts.length; i++) {
                    // Remove it from multi-input tokens
                    var sharedIndex = $.sharedTokens.indexOf(M.getUserByHandle($rmContacts[i]).m || '');
                    if (sharedIndex > -1) {
                        $.sharedTokens.splice(sharedIndex, 1);
                    }
                }
            }
        },
        onClose: function() {
            closeShareAddDialog();
        }
    };

    // Render the add more people share dialog from reactjs
    var dialog = React.createElement(StartGroupChatDialogUI.StartGroupChatWizard, prop);
    ReactDOM.render(dialog, dialogPlacer);

    M.safeShowDialog('share-add', $('.mega-dialog.share-add-dialog'));
};

/**
 * Initializes the component of adding new contacts to the shared folder in the share add dialog.
 *
 * @param {array} alreadyAddedContacts  Array of already added contacts
 */
MegaData.prototype.initAddByEmailComponent = function(alreadyAddedContacts) {
    'use strict';

    var $shareAddDialog = $('.mega-dialog.share-add-dialog');

    // Hide the personal message by default. This gets triggered when a new contact is added
    $('.share-message', $shareAddDialog).addClass('hidden');

    // Clear text area message
    $('.share-message textarea', $shareAddDialog).val('');

    // Update drop down list / token input details
    initShareDialogMultiInput(alreadyAddedContacts);

    $('.multiple-input .token-input-token-mega', $shareAddDialog).remove();
    initPerfectScrollbar($('.multiple-input', $shareAddDialog));

    // Personal message
    $('.share-message textarea', $shareAddDialog).rebind('focus', function() {
        $('.share-message', $shareAddDialog).addClass('focused');
    });

    $('.share-message textarea', $shareAddDialog).rebind('keypress', function(e) {
        e.stopPropagation();
    });

    $('.share-message textarea', $shareAddDialog).rebind('blur', function() {
        $('.share-message', $shareAddDialog).removeClass('focused');
    });
};

/**
 * Return tooltip label for undecripted node depending on node type and shared or owned
 * @param {Object} node The current node.
 */
MegaData.prototype.getUndecryptedLabel = function(node) {
    'use strict';

    if (self.nullkeys && self.nullkeys[node.h]) {
        return l.allownullkeys_tooltip;
    }

    const isShared = M.getNodeRoot(node.p) !== M.RootID;

    if (node.t) {
        return isShared ? l[8595] : l.undecryptable_folder_tooltip;
    }
    return isShared ? l[8602] : l.undecryptable_file_tooltip;
};

MegaData.prototype.sortBy = function(fn, d) {
    'use strict';

    if (!d) {
        d = 1;
    }
    this.v.sort(function(a, b) {
        if (a.t > b.t) {
            return -1;
        }
        else if (a.t < b.t) {
            return 1;
        }

        return fn(a, b, d);
    });
    this.sortfn = fn;
    this.sortd = d;
};

MegaData.prototype.sort = function() {
    this.sortBy(this.sortfn, this.sortd);
};

MegaData.prototype.sortReverse = function() {
    var d = 1;
    if (this.sortd > 0) {
        d = -1;
    }

    this.sortBy(this.sortfn, d);
};

MegaData.prototype.doFallbackSort = function(a, b, d) {
    'use strict';

    if (a.ts !== b.ts) {
        return (a.ts < b.ts ? -1 : 1) * d;
    }

    return this.compareStrings(a.h, b.h, d);
};

MegaData.prototype.doFallbackSortWithName = function(a, b, d) {
    'use strict';

    if (a.name !== b.name) {
        return this.compareStrings(a.name, b.name, d);
    }

    return M.doFallbackSort(a, b, d);
};

MegaData.prototype.getSortByNameFn = function() {

    var self = this;

    return function(a, b, d) {
        // reusing the getNameByHandle code for converting contact's name/email to renderable string
        var itemA = self.getNameByHandle(a.h);
        var itemB = self.getNameByHandle(b.h);

        if (itemA !== itemB) {
            return M.compareStrings(itemA, itemB, d);
        }

        return M.doFallbackSort(itemA, itemB, d);
    };
};

MegaData.prototype.getSortByNameFn2 = function(d) {
    'use strict';

    return (a, b) => {
        const nameA = a.nickname ? `${a.nickname} ${a.name}` : a.name;
        const nameB = b.nickname ? `${b.nickname} ${b.name}` : b.name;

        if (nameA !== nameB) {
            return this.compareStrings(nameA, nameB, d);
        }

        return M.doFallbackSort(a, b, d);
    };
};

MegaData.prototype.sortByName = function(d) {
    'use strict';

    this.sortfn = M.getSortByNameFn2(d);
    this.sortd = d;
    this.sort();
};

MegaData.prototype.getSortByEmail = function() {
    "use strict";

    return function(a, b, d) {
        if (typeof a.m === 'string' && typeof b.m === 'string') {
            return M.compareStrings(a.m, b.m, d);
        }
        return -1;
    };
}
MegaData.prototype.sortByEmail = function(d) {
    "use strict";

    this.sortfn = this.getSortByEmail();
    this.sortd = d;
    this.sort();
};

MegaData.prototype.sortByModTime = function(d) {
    this.sortfn = this.sortByModTimeFn();
    this.sortd = d;
    this.sort();
};

MegaData.prototype.sortByModTimeFn = function() {

    "use strict";

    return (a, b, d) => {

        // folder not having mtime, so sort by Name.
        if (!a.mtime || !b.mtime) {
            return M.doFallbackSortWithName(a, b, d);
        }

        var time1 = a.mtime - a.mtime % 60;
        var time2 = b.mtime - b.mtime % 60;
        if (time1 !== time2) {
            return (time1 < time2 ? -1 : 1) * d;
        }

        return M.doFallbackSortWithName(a, b, d);
    };
};

MegaData.prototype.sortByModTimeFn2 = function() {
    'use strict';

    return (a, b, d) => {
        const timeA = a.mtime || a.ts || 0;
        const timeB = b.mtime || b.ts || 0;

        if (timeA && timeB && timeA !== timeB) {
            return timeA < timeB ? -d : d;
        }

        return M.doFallbackSortWithName(a, b, d);
    };
};

MegaData.prototype.sortByModTimeFn3 = function() {
    'use strict';

    return (a, b, d) => {
        const timeA = a.mtime || a.ts || 0;
        const timeB = b.mtime || b.ts || 0;

        if (timeA && timeB && timeA !== timeB) {
            return timeA < timeB ? -d : d;
        }
        return this.compareStrings(a.h, b.h, d);
    };
};

MegaData.prototype.sortByDateTime = function(d) {
    this.sortfn = this.getSortByDateTimeFn();
    this.sortd = d;
    this.sort();
};

MegaData.prototype.getSortByDateTimeFn = function(type) {

    var sortfn;

    sortfn = function(a, b, d) {
        var getMaxShared = function _getMaxShared(shares) {
            var max = 0;
            for (var i in shares) {
                if (i !== 'EXP') {
                    max = Math.max(max, shares[i].ts - shares[i].ts % 60);
                }
            }
            return max;
        };

        var time1 = a.ts - a.ts % 60;
        var time2 = b.ts - b.ts % 60;

        if (M.currentdirid === 'out-shares' || type === 'out-shares') {
            time1 = M.ps[a.h] ? getMaxShared(M.ps[a.h]) : getMaxShared(a.shares);
            time2 = M.ps[b.h] ? getMaxShared(M.ps[b.h]) : getMaxShared(b.shares);
        }

        if ((M.currentdirid === 'public-links' && !$.dialog) || type === 'public-links') {
            var largeNum = 99999999999 * d;

            if (a.shares === undefined && M.su.EXP[a.h]) {
                a = M.d[a.h];
            }
            if (b.shares === undefined && M.su.EXP[b.h]) {
                b = M.d[b.h];
            }

            time1 = (a.shares && a.shares.EXP) ? a.shares.EXP.ts : largeNum;
            time2 = (b.shares && b.shares.EXP) ? b.shares.EXP.ts : largeNum;
        }

        if (time1 !== time2) {
            return (time1 < time2 ? -1 : 1) * d;
        }

        return M.doFallbackSortWithName(a, b, d);
    };

    return sortfn;
};

MegaData.prototype.sortByRts = function(d) {
    'use strict';
    this.sortfn = this.getSortByRtsFn();
    this.sortd = d;
    this.sort();
};

MegaData.prototype.getSortByRtsFn = function() {
    'use strict';

    var sortfn;

    sortfn = function(a, b, d) {
        var time1 = a.rts - a.rts % 60 || 0;
        var time2 = b.rts - b.rts % 60 || 0;
        if (time1 !== time2) {
            return (time1 < time2 ? -1 : 1) * d;
        }

        return M.doFallbackSortWithName(a, b, d);
    };

    return sortfn;
};

MegaData.prototype.sortByFav = function(d) {
    "use strict";

    var fn = this.sortfn = this.sortByFavFn(d);
    this.sortd = d;

    if (!d) {
        d = 1;
    }

    // label sort is not doing folder sorting first. therefore using view sort directly to avoid.
    this.v.sort(function(a, b) {
        return fn(a, b, d);
    });
};

MegaData.prototype.sortByFavFn = function(d) {
    "use strict";

    return function(a, b) {
        if ((a.t & M.IS_FAV || a.fav) && (b.t & M.IS_FAV || b.fav)) {
            return M.doFallbackSortWithFolder(a, b, d);
        }
        if (a.t & M.IS_FAV || a.fav) {
            return -1 * d;
        }
        else if (b.t & M.IS_FAV || b.fav) {
            return d;
        }
        else {
            return M.doFallbackSortWithFolder(a, b, d);
        }
    };
};

MegaData.prototype.sortBySize = function(d) {
    this.sortfn = this.getSortBySizeFn();
    this.sortd = d;
    this.sort();
};

MegaData.prototype.getSortBySizeFn = function() {
    'use strict';

    var nameSort = Object.create(null);
    nameSort['1'] = this.getSortByNameFn2(1);
    nameSort['-1'] = this.getSortByNameFn2(-1);

    return function(a, b, d) {

        var aSize = a.s || a.tb || 0;
        var bSize = b.s || b.tb || 0;
        if (aSize === bSize) {
            // zeros or equal in general
            return nameSort[d](a, b);
        }
        return (aSize < bSize ? -1 : 1) * d;
    };
};

MegaData.prototype.sortByType = function(d) {
    this.sortfn = function(a, b, d) {
        if (typeof a.name === 'string' && typeof b.name === 'string') {
            var type1 = filetype(a.name);
            var type2 = filetype(b.name);

            if (type1 !== type2) {
                return M.compareStrings(type1, type2, d);
            }
        }

        return M.doFallbackSortWithName(a, b, d);
    };
    this.sortd = d;
    this.sort();
};

MegaData.prototype.sortByOwner = function(d) {
    this.sortfn = function(a, b, d) {
        var usera = Object(M.d[a.su]);
        var userb = Object(M.d[b.su]);

        if (typeof usera.name === 'string' && typeof userb.name === 'string') {

            // If nickname exist, use nickname for sorting
            var namea = usera.nickname || usera.name;
            var nameb = userb.nickname || userb.name;

            namea = namea === nameb ? namea + a.su : namea;
            nameb = namea === nameb ? nameb + b.su : nameb;

            return namea.localeCompare(nameb) * d;
        }

        return M.doFallbackSort(usera, userb, d);
    };
    this.sortd = d;
    this.sort();
};

MegaData.prototype.sortByAccess = function(d) {
    this.sortfn = function(a, b, d) {
        if (typeof a.r !== 'undefined' && typeof b.r !== 'undefined' && a.r < b.r) {
            return -1 * d;
        }
        else {
            return 1 * d;
        }
    }
    this.sortd = d;
    this.sort();
};


MegaData.prototype.sortContacts = function(folders) {
    // in case of contacts we have custom sort/grouping:
    if (localStorage.csort) {
        this.csort = localStorage.csort;
    }
    if (localStorage.csortd) {
        this.csortd = parseInt(localStorage.csortd);
    }

    if (this.csort == 'shares') {
        folders.sort(function(a, b) {
            if (M.c[a.h] && M.c[b.h]) {
                if (a.name) {
                    return a.name.localeCompare(b.name);
                }
            }
            else if (M.c[a.h] && !M.c[b.h]) {
                return 1 * M.csortd;
            }
            else if (!M.c[a.h] && M.c[b.h]) {
                return -1 * M.csortd;
            }
            return 0;
        });
    }
    else if (this.csort == 'name') {
        folders.sort(function(a, b) {
            if (a.name) {
                return parseInt(a.name.localeCompare(b.name) * M.csortd);
            }
        });
    }
    else if (this.csort == 'chat-activity') {
        folders.sort(function(a, b) {
            var aTime = M.u[a.h].lastChatActivity;
            var bTime = M.u[b.h].lastChatActivity;

            if (aTime && bTime) {
                if (aTime > bTime) {
                    return 1 * M.csortd;
                }
                else if (aTime < bTime) {
                    return -1 * M.csortd;
                }
                else {
                    return 0;
                }
            }
            else if (aTime && !bTime) {
                return 1 * M.csortd;
            }
            else if (!aTime && bTime) {
                return -1 * M.csortd;
            }

            return 0;
        });
    }

    return folders;
};

MegaData.prototype.getSortStatus = function(u) {
    var status = megaChatIsReady && megaChat.getPresence(u);

    // To implement some kind of ordering we need to translate the actual UserPresence.PRESENCE.* state to an
    // integer that would be then used for sorting (e.g. ONLINE first = return 1, OFFLINE last, return 4)
    // PS: Because of chat is being loaded too late, we can't use the User.PRESENCE.* reference.
    if (status === 3) {
        // UserPresence.PRESENCE.ONLINE
        return 1;
    }
    else if (status === 4) {
        // UserPresence.PRESENCE.DND
        return 2;
    }
    else if (status === 2) {
        // UserPresence.PRESENCE.AWAY
        return 3;
    }
    else {
        return 4;
    }
};

MegaData.prototype.getSortByStatusFn = function(d) {

    var sortfn;

    sortfn = function(a, b, d) {
        var statusa = M.getSortStatus(a.u), statusb = M.getSortStatus(b.u);
        if (statusa < statusb) {
            return -1 * d;
        }
        else if (statusa > statusb) {
            return 1 * d;
        }
        else {
            // if status is the same for both, compare names.
            return M.compareStrings(
                M.getNameByHandle(a.h).toLowerCase(),
                M.getNameByHandle(b.h).toLowerCase(),
                d
            );
        }
    };

    return sortfn;
};

MegaData.prototype.sortByStatus = function(d) {
    this.sortfn = this.getSortByStatusFn(d);
    this.sortd = d;
    this.sort();
};

MegaData.prototype.getSortByVersionFn = function() {
    'use strict';

    return (a, b, d) => {
        const av = a.tvf || 0;
        const bv = b.tvf || 0;

        if (av < bv) {
            return -d;
        }
        if (av > bv) {
            return d;
        }

        const ab = a.tvb || 0;
        const bb = b.tvb || 0;

        if (ab < bb) {
            return -d;
        }
        if (ab > bb) {
            return d;
        }

        return M.doFallbackSortWithName(a, b, d);
    };
};

MegaData.prototype.sortByVersion = function(d) {
    'use strict';

    this.sortfn = this.getSortByVersionFn();
    this.sortd = d;
    this.sort();
};

MegaData.prototype.getSortByInteractionFn = function() {
    var self = this;

    var sortfn;

    sortfn = M.sortObjFn(
        function(r) {

            // Since the M.sort is using a COPY of the data,
            // we need an up-to-date .ts value directly from M.u[...]
            return Object(M.u[r.h]).ts;
        },
        d,
        function(a, b, d) {
            // fallback to string/name matching in case last interaction is the same
            return M.compareStrings(
                self.getNameByHandle(a.h).toLowerCase(),
                self.getNameByHandle(b.h).toLowerCase(),
                d
            );
        }
    );

    return sortfn;
};

MegaData.prototype.sortByInteraction = function(d) {
    this.sortfn = this.getSortByInteractionFn();
    this.sortd = d;
    this.sort();
};

MegaData.prototype.getSortByVerificationFn = function() {
    'use strict';

    return function(a, b, d) {
        const a_verifyState = (u_authring.Ed25519[a.h] || {}).method
                                >= authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON;
        const b_verifyState = (u_authring.Ed25519[b.h] || {}).method
                                >= authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON;
        if (a_verifyState < b_verifyState) {
            return -1 * Number(d);
        }
        else if (a_verifyState >= b_verifyState) {
            return 1 * Number(d);
        }
    };
};

MegaData.prototype.getSortByVerification = function(d) {
    'use strict';

    this.sortfn = this.getSortByVerificationFn();
    this.sortd = d;
    this.sort();
};

MegaData.prototype.doSort = function(n, d) {
    "use strict";
    $('.grid-table thead .arrow').removeClass('asc desc');
    $('.dropdown-section.sort-by .sprite-fm-mono.sort-arrow').removeClass('icon-up icon-down');
    $('.files-menu.context .submenu.sorting .dropdown-item.sort-grid-item').removeClass('selected');

    const sortIconClassPrefix = 'icon-';

    let sortItemClasses = 'selected';
    let arrowDirection = 'desc';
    let sortIconAddClass = 'up';
    let sortIconRemoveClass = 'down';

    if (d < 0) {
        arrowDirection = 'asc';
        sortItemClasses += ' inverted';
        sortIconAddClass = 'down';
        sortIconRemoveClass = 'up';
    }

    n = String(n).replace(/\W/g, '');

    $('.arrow.' + n + ':not(.is-chat)').addClass(arrowDirection);
    if (n === "name") {
        $('#name-sort-arrow.sprite-fm-mono.sort-arrow').addClass(sortIconClassPrefix + sortIconAddClass);
    }
    else if (n === "label") {
        $('#label-sort-arrow.sprite-fm-mono.sort-arrow').addClass(sortIconClassPrefix + sortIconAddClass);
    }

    const sortItemPrefix = '.dropdown-item.sort-grid-item.sort-';
    let subMenuSortClass = '';

    if (n === 'ts') {
        subMenuSortClass = sortItemPrefix + 'timeAd';
    }
    else if (n === 'mtime') {
        subMenuSortClass = sortItemPrefix + 'timeMd';
    }
    else if (n === 'date') {
        subMenuSortClass =  sortItemPrefix + 'sharecreated,'
                            + sortItemPrefix + 'timeAd';
    }
    else {
        subMenuSortClass = sortItemPrefix + n;
    }

    const $selectedSortItem = $(subMenuSortClass, '.files-menu.context .submenu.sorting');

    $selectedSortItem.addClass(sortItemClasses);

    $('i.sort-arrow', $selectedSortItem)
        .addClass(sortIconClassPrefix + sortIconAddClass)
        .removeClass(sortIconClassPrefix + sortIconRemoveClass);

    this.sortmode = {n: n, d: d};

    if (typeof this.sortRules[n] === 'function') {
        this.sortRules[n](d);

        if (this.fmsorting) {
            mega.config.set('sorting', this.sortmode);
        }
        else {
            fmsortmode(this.currentdirid, n, d);
        }
    }
    else if (d) {
        console.warn("Cannot sort by " + n);
    }
};

MegaData.prototype.setLastColumn = function(col) {
    "use strict";
    return;
};

MegaData.prototype.sortByLabel = function(d) {
    "use strict";

    var fn = this.sortfn = this.sortByLabelFn(d);
    this.sortd = d;

    if (!d) {
        d = 1;
    }

    // label sort is not doing folder sorting first. therefore using view sort directly to avoid.
    this.v.sort(function(a, b) {
        return fn(a, b, d);
    });
};

MegaData.prototype.sortByLabelFn = function(d, isTree) {
    "use strict";

    // sorting with labels
    return function(a, b) {
        if (a.lbl && b.lbl) {
            if (a.lbl !== b.lbl) {
                return (a.lbl < b.lbl ? -1 : 1) * d;
            }
            else {
                // after sorting with labels, if this is not tree sorting, sort again with folder
                if (!isTree) {
                    return M.doFallbackSortWithFolder(a, b);
                }
                else {
                    // if this is tree, skip folder sorting and sort by name;
                    return M.doFallbackSortWithName(a, b, 1);
                }
            }
        }
        else if (a.lbl) {
            if (d < 0){
                return a.lbl * d;
            }
            else {
                return -a.lbl * d;
            }
        }
        else if (b.lbl) {
            if (d < 0){
                return -b.lbl * d;
            }
            else {
                return b.lbl * d;
            }
        }
        else {
            // if this items are not set with labels, if this is not tree sorting, sorting it with folder.
            if (!isTree) {
                return M.doFallbackSortWithFolder(a, b);
            }
            else {
                // if this is tree, skip folder sorting and sort by name;
                return M.doFallbackSortWithName(a, b, 1);
            }
        }
    };
};

MegaData.prototype.doFallbackSortWithFolder = function(a, b) {
    "use strict";

    if (a.t > b.t) {
        return -1;
    }
    else if (a.t < b.t) {
        return 1;
    }
    // even direction is desc, sort name by asc.
    return M.doFallbackSortWithName(a, b, 1);
};

MegaData.prototype.getSortBySharedWithFn = function() {
    'use strict';

    return function(a, b, d) {

        var aShareNames = [];
        var bShareNames = [];

        for (var i in a.shares) {
            const aShareName = M.getNameByHandle(i); // 'EXP' could get an empty name as returned
            if (a.shares[i] && aShareName) {
                aShareNames.push(aShareName);
            }
        }
        for (var j in b.shares) {
            const bShareName = M.getNameByHandle(j); // 'EXP' could get an empty name as returned
            if (b.shares[j] && bShareName) {
                bShareNames.push(bShareName);
            }
        }
        aShareNames = aShareNames.sort().join();
        bShareNames = bShareNames.sort().join();

        if (aShareNames !== bShareNames) {
            return M.compareStrings(aShareNames, bShareNames, d);
        }
        return M.doFallbackSortWithName(a, b, d);
    };
};

MegaData.prototype.sortBySharedWith = function(d) {
    'use strict';

    var fn = this.sortfn = this.getSortBySharedWithFn();
    this.sortd = d;

    if (!d) {
        d = 1;
    }

    // label sort is not doing folder sorting first. therefore using view sort directly to avoid.
    this.v.sort(function(a, b) {
        return fn(a, b, d);
    });
};

/**
 * Sort by playtime
 * @param {Number} d sort direction
 * @returns {void}
 */
MegaData.prototype.sortByPlaytime = function(d) {
    'use strict';

    var fn = this.sortfn = this.sortByPlaytimeFn(d);
    this.sortd = d;

    if (!d) {
        d = 1;
    }

    // playtime sort is not doing folder sorting first. therefore using view sort directly to avoid.
    this.v.sort((a, b) => {
        return fn(a, b, d);
    });
};

/**
 * Sort nodes having playtime always first and then the rest including folders.
 * @param {Number} d sort direction
 * @returns {Function} sort compare function
 */
MegaData.prototype.sortByPlaytimeFn = function(d) {
    "use strict";

    return function(a, b) {
        const aPlayTime = MediaAttribute(a).data.playtime;
        const bPlayTime = MediaAttribute(b).data.playtime;

        if (aPlayTime !== undefined && bPlayTime !== undefined) {
            if (aPlayTime === bPlayTime) {
                return M.doFallbackSortWithName(a, b, d);
            }
            return (aPlayTime < bPlayTime ? -1 : 1) * d;
        }
        else if (aPlayTime) {
            return d < 0 ? aPlayTime * d : -aPlayTime * d;
        }
        else if (bPlayTime) {
            return d < 0 ? -bPlayTime * d : bPlayTime * d;
        }

        return M.doFallbackSortWithFolder(a, b);
    };
};

MegaData.prototype.getDownloadFolderNodes = function(n, md, nodes, paths) {

    var subids = this.getNodesSync(n, false, false, true);

    for (var j = 0; j < subids.length; j++) {
        var p = this.getPath(subids[j]);
        var path = '';

        for (var k = 0; k < p.length; k++) {
            if (this.d[p[k]] && this.d[p[k]].t) {
                path = M.getSafeName(this.d[p[k]].name) + '/' + path;
            }
            if (p[k] == n) {
                break;
            }
        }

        if (!this.d[subids[j]].t) {
            nodes.push(subids[j]);
            paths[subids[j]] = path;
        }
        else {
            console.log('0 path', path);
        }
    }
};

/** like addToTransferTable, but can take a download object */
MegaData.prototype.putToTransferTable = function(node, ttl) {
    var handle = node.h || node.dl_id;
    node.name = node.name || node.n;

    if (d) {
        var isDownload = node.owner instanceof ClassFile;
        console.assert(this.isFileNode(node) || isDownload, 'Invalid putToTransferTable node.');
    }

    var gid = 'dl_' + handle;
    var isPaused = uldl_hold || dlQueue.isPaused(gid);

    var state = '';
    var pauseTxt = '';
    var isFailed = false;
    if (isPaused) {
        state = 'transfer-paused';
        pauseTxt = l[1651];
    }
    if (dlmanager.isOverQuota) {
        pauseTxt = '';
    }

    else if (node.failed || node.dl_failed) {
        isFailed = true;
    }

    var dowloadedSize = node.loaded || 0;
    var rightRotate = '';
    var leftRotate = '';

    if (dowloadedSize > 0 && node.s > 0) {
        var deg = 360 * dowloadedSize / node.s;
        if (deg <= 180) {
            rightRotate = 'style="transform: rotate(' + deg + 'deg);"';
        }
        else {
            rightRotate = 'style="transform: rotate(180deg);"';
            leftRotate = 'style="transform: rotate(' + (deg - 180) + 'deg);"';
        }
    }

    this.addToTransferTable(gid, ttl,
        '<tr id="dl_' + htmlentities(handle) + '" class="transfer-queued transfer-download ' + state + '">'
        + '<td><div class="transfer-type download sprite-fm-mono-after icon-down-after">'
        + '<ul><li class="right-c"><p ' + rightRotate + '>'
        + '<span></span></p></li><li class="left-c"><p ' + leftRotate + '><span></span></p></li></ul>'
        + '</div></td>'
        + '<td><span class="item-type-icon icon-' + fileIcon(node) + '-24"></span>'
        + '<span class="tranfer-filetype-txt">' + htmlentities(node.name) + '</span></td>'
        + '<td>' + filetype(node) + '</td>'
        + '<td class="transfer-size">' + bytesToSize(node.s) + '</td>'
        + '<td><span class="downloaded-size">' + bytesToSize(dowloadedSize) + '</span></td>'
        + '<td><span class="eta"></span><span class="speed">' + pauseTxt + '</span></td>'
        + '<td><span class="transfer-status">' + l[7227] + '</span></td>'
        + '<td class="grid-url-field">'
        + '<a class="link-transfer-status transfer-pause"><i class="sprite-fm-mono icon-pause"></i></a>'
        + '<a class="clear-transfer-icon"><i class="sprite-fm-mono icon-close-component"></i></a></td>'
        + '<td><span class="row-number"></span></td>'
        + '</tr>');

    if (isPaused) {
        fm_tfspause('dl_' + handle);
    }
    if (isFailed) {
        M.dlerror(node, node.lasterror || l[135]);
    }
    if (ttl) {
        ttl.left--;
    }
};

MegaData.prototype.addDownload = function(n, z, preview) {
    "use strict";

    if (M.isInvalidUserStatus()) {
        return;
    }

    var args = toArray.apply(null, arguments);
    // fetch all nodes needed by M.getNodesSync
    dbfetch.coll(n)
        .always(function () {
            M.addDownloadSync.apply(M, args);
        });

};

MegaData.prototype.addDownloadSync = function(n, z, preview) {
    var args = toArray.apply(null, arguments);
    var webdl = function() {
        dlmanager.getMaximumDownloadSize()
            .done(function(size) {
                dlmanager.maxDownloadSize = size;

                M.addWebDownload.apply(M, args);
                args = undefined;
            });
    };

    // @TODO: Remove this bypass once the new download method public albums is implemented
    if (pfcol) {
        return webdl();
    }

    if (!folderlink && (z || preview || !fmconfig.dlThroughMEGAsync)) {
        return webdl();
    }
    // if in folder link and logged-in and download using mSync is set to 0
    if (folderlink && u_type) {
        if (!fmconfig.dlThroughMEGAsync) {
            return webdl();
        }
    }

    dlmanager.isMEGAsyncRunning(0x02010100)
        .done(function (sync) {
            var dlAuth = M.RootID;
            if (!folderlink) {
                var ommitedEsid = base64urldecode(u_sid);
                ommitedEsid = ommitedEsid.substr(0, ommitedEsid.length - 6);
                dlAuth = base64urlencode(ommitedEsid);
            }
            var cmd = {
                a: 'd',
                auth: dlAuth
            };
            var files = [];

            try {

                var addNodeToArray = function(arr, node) {
                    if (!node) {
                        return;
                    }
                    if (!node.a && node.k) {
                        if (!node.t) {
                            arr.push({
                                t: node.t,
                                h: node.h,
                                p: node.p,
                                n: base64urlencode(to8(M.getSafeName(node.name))),
                                s: node.s,
                                c: node.hash,
                                ts: node.mtime || node.ts,
                                k: a32_to_base64(node.k),
                                rewind: node.rewind
                            });
                        }
                        else {
                            arr.push({
                                t: node.t,
                                h: node.h,
                                p: node.p,
                                n: base64urlencode(to8(M.getSafeName(node.name))),
                                ts: node.mtime || node.ts,
                                k: a32_to_base64(node.k),
                                rewind: node.rewind
                            });
                        }
                    }
                };

                var recursivelyLoadNodes = function(arr, nodes) {
                    if (!nodes) {
                        return;
                    }
                    for (var k = 0; k < nodes.length; k++) {
                        if (typeof nodes[k] === 'string') {
                            addNodeToArray(files, M.d[nodes[k]]);
                            if (M.d[nodes[k]].t) {
                                if (M.c[nodes[k]]) {
                                    recursivelyLoadNodes(arr, Object.keys(M.c[nodes[k]]));
                                }
                            }
                        }
                        else { // it's object
                            addNodeToArray(files, nodes[k]);
                            if (nodes[k].t && !nodes[k].rewind) {
                                // If its a rewind download, we need not add the children recursively here
                                recursivelyLoadNodes(arr, Object.keys(M.c[nodes[k].h]));
                            }
                        }
                    }
                };

                recursivelyLoadNodes(files, n);

            }
            catch (exx) {
                if (d) {
                    dlmanager.logger.error('Failed to load all nodes to pass to megaSync', exx);
                }
                return webdl();
            }

            if (!files.length) {
                console.error('No files');
                return webdl();
            }

            if (files[0].rewind) {
                cmd.a = 'gd';
            }

            cmd.f = files;

            sync.megaSyncRequest(cmd)
                .done(function() {
                    showToast('megasync-transfer', l[8635]);
                })
                .fail(
                function () {
                    sync.megaSyncIsNotResponding(webdl);

                }
                );
        })
        .fail(webdl);
};

MegaData.prototype.addWebDownload = function(n, z, preview, zipname) {
    delete $.dlhash;
    var path;
    var nodes = [];
    var paths = {};
    var zipsize = 0;
    var entries = [];
    let quiet = false;

    if (!is_extension && !preview && !z && dlMethod === MemoryIO) {
        var nf = [], cbs = [];
        for (var i in n) {
            if (this.d[n[i]] && this.d[n[i]].t) {
                var nn = [], pp = {};
                this.getDownloadFolderNodes(n[i], false, nn, pp);
                cbs.push(this.addDownload.bind(this, nn, 0x21f9A, pp, this.d[n[i]].name));
            }
            else {
                nf.push(n[i]);
            }
        }

        quiet = n && M.d[n[0]] && M.d[n[0]].t && M.d[n[0]].tb;
        n = nf;

        if (cbs.length) {
            for (var i in cbs) {
                Soon(cbs[i]);
            }
        }
    }
    if (z === 0x21f9A) {
        nodes = n;
        paths = preview;
        preview = false;
        quiet = true;
    }
    else {
        for (var i in n) {
            if (this.d[n[i]]) {
                if (this.d[n[i]].t) {
                    this.getDownloadFolderNodes(n[i], !!z, nodes, paths);
                }
                else {
                    nodes.push(n[i]);
                }
            }
            else if (this.isFileNode(n[i])) {
                nodes.push(n[i]);
            }
        }
    }

    if (z) {
        z = ++dlmanager.dlZipID;

        if (!zipname && n.length === 1) {
            const {name} = M.getNodeByHandle(n[0]);
            if (name) {
                zipname = M.getSafeName(name).replace(/\.\w{2,5}$/, '');
            }
        }

        if (!zipname) {
            const parent = this.getNodeParent(n[0]);
            const {name} = this.getNodeByHandle(parent);
            if (name) {
                zipname = M.getSafeName(name);
            }
        }

        zipname = `${zipname || `Archive-${Math.random().toString(16).slice(-4)}`}.zip`;
    }
    else {
        z = false;
    }
    if (!$.totalDL) {
        $.totalDL = 0;
    }
    // a variable to store the current download batch size. as $.totalDL wont be cleared on failure
    // due to MaxDownloadSize exceeding (and it should not be cleared). We need only to subtract the
    // current batch size.
    var currDownloadSize = 0;

    var p = '';
    var pauseTxt = '';

    if (uldl_hold) {
        p = 'transfer-paused';
        pauseTxt = l[1651];
    }

    var ttl = this.getTransferTableLengths();
    let errorStatus = null;
    for (var k in nodes) {
        /* jshint -W089 */
        if (!nodes.hasOwnProperty(k) || !this.isFileNode((n = this.d[nodes[k]]))) {
            n = nodes[k];
            if (this.isFileNode(n)) {
                dlmanager.logger.info('Using plain provided node object.');
            }
            else {
                dlmanager.logger.error('** CHECK THIS **', 'Invalid node', k, nodes[k]);
                continue;
            }
        }
        path = paths[nodes[k]] || '';
        $.totalDL += n.s;
        currDownloadSize += n.s;

        var $tr = !z && $('.transfer-table #dl_' + htmlentities(n.h));
        if ($tr.length) {
            if (!$tr.hasClass('transfer-completed')) {
                if ($tr.hasClass('transfer-error') && !entries.length) {
                    errorStatus = $('.transfer-status', $tr).text();
                }
                continue;
            }
            $tr.remove();
        }
        var entry = {
            ...n,
            size: n.s,
            nauth: n.nauth || n_h,
            id: n.h,
            key: n.k,
            n: n.name,
            t: n.mtime || n.ts,
            zipid: z,
            zipname: zipname,
            preview: preview,
            p: n.path || path,
            ph: undefined,
            onDownloadProgress: this.dlprogress.bind(this),
            onDownloadComplete: this.dlcomplete.bind(this),
            onBeforeDownloadComplete: this.dlbeforecomplete.bind(this),
            onDownloadError: this.dlerror.bind(this),
            onDownloadStart: this.dlstart.bind(this)
        };

        if (n.rewind) {
            entry.customRequest = 'gd';
        }

        entries.push({node: n, entry: entry});
    }

    if (errorStatus) {
        showToast('download', errorStatus);
    }

    if (!entries.length) {
        if (d) {
            dlmanager.logger.warn('Nothing to download.');
        }
        if (dlmanager.isOverQuota) {
            dlmanager.showOverQuotaDialog();
        }
        else if (!currDownloadSize && !quiet) {
            dlmanager.showNothingToDownloadDialog();
        }
        return;
    }

    if ($.totalDL > dlmanager.maxDownloadSize) {
        if (d) {
            console.log('Downloads exceed max size', entries.length, entries);
        }
        // subtract the current batch size from the stored total
        $.totalDL -= currDownloadSize;
        if (!fmconfig.dlThroughMEGAsync) {
            var msgMsg = l[18213];
            var msgSubMsg = l[18214];
            msgDialog('confirmation', 'File Size is too big',
                msgMsg,
                msgSubMsg,
                function (activateMsync) {
                    if (activateMsync) {
                        mega.config.setn('dlThroughMEGAsync', 1);
                    }
                });
            return;
        }
        else {
            // this means the setting is ON to user MEGASync. but we got here because either
            // MEGASync is not installed (or working), or there were an error when we tried to use MEGASync.
            return dlmanager.showMEGASyncOverlay(true);
        }
    }

    var tempEntry = !z && new Array(entries.length);
    for (var e = 0; e < entries.length; e++) {
        n = entries[e].node;

        dl_queue.push(entries[e].entry);
        zipsize += n.s;

        if (!z) {
            this.putToTransferTable(n, ttl);
            tempEntry[e] = entries[e].entry;
        }
    }
    tfsheadupdate({
        a: z ? `dl_${entries[0].entry.zipid}` : Object.values(entries).map((e) => {
            return `dl_${e.entry.zipid ? e.entry.zipid : e.entry.id}`;
        })
    });
    if (z) {
        mega.tpw.addDownloadUpload(mega.tpw.DOWNLOAD, entries[0].entry, zipsize);
    }
    else {
        if (!preview) {
            mega.tpw.addDownloadUpload(mega.tpw.DOWNLOAD, tempEntry);
        }
        tempEntry = null;
    }

    if (z && zipsize) {
        this.addToTransferTable('zip_' + z, ttl,
            '<tr id="zip_' + z + '" class="transfer-queued transfer-download ' + p + '">'
            + '<td><div class="transfer-type download sprite-fm-mono-after icon-down-after">'
            + '<ul><li class="right-c"><p><span></span></p></li><li class="left-c"><p><span></span></p></li></ul>'
            + '</div></td>'
            + '<td><span class="item-type-icon icon-' + fileIcon({name: 'archive.zip'}) + '-24"></span>'
            + '<span class="tranfer-filetype-txt">' + htmlentities(zipname) + '</span></td>'
            + '<td>' + filetype({name: 'archive.zip'}) + '</td>'
            + '<td class="transfer-size">' + bytesToSize(zipsize) + '</td>'
            + '<td><span class="downloaded-size">' + bytesToSize(0) + '</span></td>'
            + '<td><span class="eta"></span><span class="speed">' + pauseTxt + '</span></td>'
            + '<td><span class="transfer-status">' + l[7227] + '</span></td>'
            + '<td class="grid-url-field">'
            + '<a class="link-transfer-status transfer-pause"><i class="sprite-fm-mono icon-pause"></i></a>'
            + '<a class="clear-transfer-icon"><i class="sprite-fm-mono icon-close-component"></i></a></td>'
            + '<td><span class="row-number"></span></td>'
            + '</tr>');


        if (uldl_hold) {
            fm_tfspause('zip_' + z);
        }

        api_req({a: 'log', e: 99655, m: 'ZipIO Download started.'});
        mBroadcaster.sendMessage('trk:event', 'download', 'started', 'zip');
    }

    if (!preview) {
        this.onDownloadAdded(entries.length, uldl_hold, z, zipsize);
    }

    delete $.dlhash;
};

MegaData.prototype.onDownloadAdded = function(added, isPaused, isZIP, zipSize) {
    if (!$.transferHeader) {
        M.addTransferPanelUI();
    }
    delay('fm_tfsupdate', fm_tfsupdate); // this will call $.transferHeader();

    if (!isZIP || zipSize) {
        this.addDownloadToast = ['d', isZIP ? 1 : added, isPaused];
    }
    M.openTransfersPanel();
    initTreeScroll();

    if ((dlmanager.isDownloading = Boolean(dl_queue.length))) {
        $('.transfer-pause-icon').removeClass('disabled');
        $('.transfer-clear-completed').removeClass('disabled');
        $('.transfer-clear-all-icon').removeClass('disabled');
    }
};

MegaData.prototype.dlprogress = function(id, perc, bl, bt, kbps, dl_queue_num, force) {
    var st;
    var original_id = id;

    if (dl_queue[dl_queue_num].zipid) {
        id = 'zip_' + dl_queue[dl_queue_num].zipid;
        var tl = 0;
        var ts = 0;
        for (var i in dl_queue) {
            if (dl_queue[i].zipid == dl_queue[dl_queue_num].zipid) {
                if (!st || st > dl_queue[i].st) {
                    st = dl_queue[i].st;
                }
                ts += dl_queue[i].size;
                if (dl_queue[i].complete) {
                    tl += dl_queue[i].size;
                }
                // TODO: check this for suitable GP use
            }
        }
        bt = ts;
        bl = tl + bl;
    }
    else {
        id = 'dl_' + id;
        st = dl_queue[dl_queue_num].st;
    }

    if (!bl) {
        return false;
    }
    if (!$.transferprogress) {
        $.transferprogress = Object.create(null);
    }
    if (kbps == 0) {
        if (!force && (perc != 100 || $.transferprogress[id])) {
            return false;
        }
    }
    tfsheadupdate({t: id});
    if (!dl_queue[dl_queue_num].preview) {
        mega.tpw.updateDownloadUpload(mega.tpw.DOWNLOAD, original_id, perc, bl, bt, kbps, dl_queue_num, st);
    }

    var $tr = $('.transfer-table #' + id);
    if (!$tr.hasClass('transfer-started')) {
        $tr.find('.transfer-status').text('');
        $tr.addClass('transfer-started');
        $tr.removeClass('transfer-initiliazing transfer-queued');
        $('.transfer-table').prepend($tr);
        delay('fm_tfsupdate', fm_tfsupdate); // this will call $.transferHeader();
    }

    // var eltime = (new Date().getTime()-st)/1000;
    var bps = kbps * 1000;
    var retime = bps && (bt - bl) / bps;
    if (bt) {
        // $.transferprogress[id] = Math.floor(bl/bt*100);
        $.transferprogress[id] = [bl, bt, bps];
        dl_queue[dl_queue_num].loaded = bl;

        if (!uldl_hold) {
            var slideshowid = window.slideshowid && slideshow_handle();
            if (slideshowid === dl_queue[dl_queue_num].id && !previews[slideshowid]) {
                var $overlay = $('.media-viewer-container');
                var $chart = $overlay.find('.viewer-progress');

                $overlay.find('.viewer-error').addClass('hidden');
                $overlay.find('.viewer-pending').addClass('hidden');

                var deg = 360 * perc / 100;
                if (deg <= 180) {
                    $chart.find('.left-chart p').css('transform', 'rotate(' + deg + 'deg)');
                    $chart.find('.right-chart p').removeAttr('style');
                }
                else {
                    $chart.find('.left-chart p').css('transform', 'rotate(180deg)');
                    $chart.find('.right-chart p').css('transform', 'rotate(' + (deg - 180) + 'deg)');
                }
            }

            $tr.find('.transfer-status').text(perc + '%');
            var transferDeg = 360 * perc / 100;
            if (transferDeg <= 180) {
                $tr.find('.right-c p').css('transform', 'rotate(' + transferDeg + 'deg)');
            }
            else {
                $tr.find('.right-c p').css('transform', 'rotate(180deg)');
                $tr.find('.left-c p').css('transform', 'rotate(' + (transferDeg - 180) + 'deg)');
            }
            if (retime > 0) {
                var title = '';
                try {
                    title = new Date((unixtime() + retime) * 1000).toLocaleString();
                }
                catch (ex) {
                }
                $tr.find('.eta')
                    .text(secondsToTime(retime))
                    .removeClass('unknown')
                    .attr('title', title);
            }
            else {
                $tr.find('.eta').addClass('unknown').text('');
            }
            $('.downloaded-size', $tr).text(bytesToSize(bl, 1));
            if (bps > 0) {
                $tr.removeClass('transfer-error');
                $('.speed', $tr).text(bytesToSpeed(bps, 1)).removeClass('unknown');
            }
            else {
                $tr.find('.speed').addClass('unknown').text('');
            }

            delay('percent_megatitle', percent_megatitle, 50);
        }
    }
};

MegaData.prototype.dlcomplete = function(dl) {
    var id = dl.id, z = dl.zipid;

    if (dl.hasResumeSupport) {
        dlmanager.remResumeInfo(dl).dump();
    }

    tfsheadupdate({f: `dl_${z ? z : id}`});
    mega.tpw.finishDownloadUpload(mega.tpw.DOWNLOAD, dl);


    var slideshowid = slideshow_handle();
    if (slideshowid == id && !previews[slideshowid]) {
        var $overlay = $('.media-viewer-container');
        $overlay.find('.viewer-pending').addClass('hidden');
        $overlay.find('.viewer-error').addClass('hidden');
        $overlay.find('.viewer-progress p').css('transform', 'rotate(180deg)');
    }

    if (z) {
        id = 'zip_' + z;

        api_req({a: 'log', e: 99656, m: 'ZipIO Download completed.'});
        mBroadcaster.sendMessage('trk:event', 'download', 'completed', 'zip');
    }
    else {
        id = 'dl_' + id;
    }

    var $tr = $('.transfer-table #' + id);
    $tr.removeClass('transfer-started').addClass('transfer-completed');
    $tr.find('.left-c p, .right-c p').css('transform', 'rotate(180deg)');
    $tr.find('.transfer-status').text(l[1418]);
    $tr.find('.eta, .speed').text('').removeClass('unknown');
    $tr.find('.downloaded-size').html($tr.find('.transfer-size').text());

    if ($.transferprogress && $.transferprogress[id]) {
        if (!$.transferprogress['dlc']) {
            $.transferprogress['dlc'] = 0;
        }
        $.transferprogress['dlc'] += $.transferprogress[id][1];
        delete $.transferprogress[id];
    }

    delay('tfscomplete', function() {
        M.resetUploadDownload();
        $.tresizer();
    });
};

MegaData.prototype.dlbeforecomplete = function() {
};

MegaData.prototype.dlerror = function(dl, error) {
    var x;
    var errorstr;
    var gid = dlmanager.getGID(dl);
    var $overlay = $('.media-viewer-container');

    if (d) {
        dlmanager.logger.error('dlerror', gid, error);
    }
    else {
        if (error === EOVERQUOTA) {
            if (!dl.log509 && !dl.logOverQuota && Object(u_attr).p) {
                dl.logOverQuota = 1;
                api_req({a: 'log', e: 99615, m: 'PRO user got EOVERQUOTA'});
            }
        }
        // else if (error !== EAGAIN) {
        //     srvlog('onDownloadError :: ' + error + ' [' + hostname(dl.url) + '] ' + (dl.zipid ? 'isZIP' : ''));
        // }
    }
    let overquota = false;
    switch (error) {
        case ETOOMANYCONNECTIONS:
            errorstr = l[18];
            break;
        case ESID:
            errorstr = l[19];
            break;
        case EBLOCKED:
            errorstr = l[20705];
            break;
        case ETOOMANY:
        case EACCESS:
            errorstr = l[20228];
            break;
        case ENOENT:
            errorstr = l[22];
            break;
        case EKEY:
            errorstr = l[24];
            break;
        case EOVERQUOTA:
            errorstr = l[20666];
            overquota = true;
            break;
        // case EAGAIN:               errorstr = l[233]; break;
        // case ETEMPUNAVAIL:         errorstr = l[233]; break;
        default:
            errorstr = l[x = 233];
            break;
    }
    tfsheadupdate(overquota ? {o: gid} : {e: gid});
    mega.tpw.errorDownloadUpload(mega.tpw.DOWNLOAD, dl, errorstr, overquota);


    var slideshowid = slideshow_handle();
    if (slideshowid === dl.id && !previews[slideshowid]) {
        $('.img-wrap', $overlay).addClass('hidden');
        $('.viewer-pending', $overlay).addClass('hidden');
        $('.viewer-progress', $overlay).addClass('vo-hidden');
        $('.viewer-error', $overlay).removeClass('hidden');
        $('.viewer-error-txt', $overlay).text(errorstr);
    }

    if (errorstr) {
        var prog = Object(GlobalProgress[gid]);

        dl.failed = new Date;
        if (x != 233 || !prog.speed || !(prog.working || []).length) {
            /**
             * a chunk may fail at any time, don't report a temporary error while
             * there is network activity associated with the download, though.
             */
            if (page === 'download') {
                if (error === EOVERQUOTA) {
                    $('.download.eta-block .span').text('');
                    $('.download.speed-block span').text('');
                    $('.download .pause-transfer').removeClass('hidden').addClass('active')
                        .find('span').text(l[1649]);
                    $('.download.download-page').addClass('overquota');
                }
                else {
                    $('.download.download-page').removeClass('overquota');
                }
            }
            else {
                var $tr = $('.transfer-table tr#' + gid);

                $tr.addClass('transfer-error');
                $tr.find('.eta, .speed').text('').addClass('unknown');

                if (error === EOVERQUOTA) {
                    $tr.find('.transfer-status').addClass('overquota');

                    if (page === 'fm/dashboard') {
                        delay('obq-update.dashboard', () => dashboardUI());
                    }
                }
            }

            switch (error) {
                case EACCESS:
                case ETOOMANY:
                case EBLOCKED:
                    dlFatalError(dl, errorstr);
                    delete dlmanager.onDownloadFatalError;
                    break;
                default:
                    setTransferStatus(dl, errorstr);
            }
        }
    }
};

MegaData.prototype.dlstart = function(dl) {
    var id = (dl.zipid ? 'zip_' + dl.zipid : 'dl_' + dl.dl_id);

    if (this.tfsdomqueue[id]) {
        // flush the transfer from the DOM queue
        addToTransferTable(id, this.tfsdomqueue[id]);
        delete this.tfsdomqueue[id];
    }

    $('.transfer-table #' + id)
        .addClass('transfer-initiliazing')
        .find('.transfer-status').text(l[1042]);

    dl.st = Date.now();
    ASSERT(typeof dl_queue[dl.pos] === 'object', 'No dl_queue entry for the provided dl...');
    ASSERT(typeof dl_queue[dl.pos] !== 'object' || dl.n == dl_queue[dl.pos].n, 'No matching dl_queue entry...');
    if (typeof dl_queue[dl.pos] === 'object') {
        fm_tfsupdate(); // this will call $.transferHeader()
        this.dlprogress(id, 0, 0, 0, 0, dl.pos);

    }
};

MegaData.prototype.doFlushTransfersDynList = function(aNumNodes) {
    aNumNodes = Object.keys(this.tfsdomqueue).slice(0, aNumNodes | 0);

    if (aNumNodes.length) {
        for (var i = 0, l = aNumNodes.length; i < l; ++i) {
            var item = aNumNodes[i];

            addToTransferTable(item, this.tfsdomqueue[item], 1);
            delete this.tfsdomqueue[item];
        }

        $.tresizer();
    }
};

MegaData.prototype.tfsResizeHandler = SoonFc(function() {

    const T = M.getTransferTableLengths();

    if (T) {

        if (d) {
            console.log('resize.tfsdynlist', JSON.stringify(T));
        }

        if (T.left > 0) {
            M.doFlushTransfersDynList(T.left + 3);
        }
    }
});

MegaData.prototype.getTransferTableLengths = function() {
    "use strict";

    var te = this.getTransferElements();
    if (!te) {
        return false;
    }
    var used = te.domTable.querySelectorAll('tr').length;
    var size = (Math.ceil(te.domScrollingTable.offsetHeight / 32) || 27) + 1;
    return { size: size, used: used, left: size - used };
};

MegaData.prototype.getTransferElements = function() {
    'use strict';
    const obj = Object.create(null);
    obj.domTransfersBlock = document.querySelector('.fm-transfers-block');
    if (!obj.domTransfersBlock) {
        return false;
    }
    obj.domTableWrapper = obj.domTransfersBlock.querySelector('.transfer-table-wrapper');
    obj.domTransferHeader = obj.domTransfersBlock.querySelector('.fm-transfers-header');
    obj.domPanelTitle = obj.domTransferHeader.querySelector('.transfer-panel-title');
    obj.domUploadBlock = obj.domPanelTitle.querySelector('.upload');
    obj.domUploadProgressText = obj.domUploadBlock.querySelector('.transfer-progress-txt');
    obj.domDownloadBlock = obj.domPanelTitle.querySelector('.download');
    obj.domDownloadProgressText = obj.domDownloadBlock.querySelector('.transfer-progress-txt');
    obj.domTableEmptyTxt = obj.domTableWrapper.querySelector('.transfer-panel-empty-txt');
    obj.domScrollingTable = obj.domTableWrapper.querySelector('.transfer-scrolling-table');
    obj.domTable = obj.domScrollingTable.querySelector('.transfer-table tbody');
    obj.domDownloadChart = obj.domDownloadBlock.querySelector('.progress-chart');
    obj.domUploadChart = obj.domUploadBlock.querySelector('.progress-chart');

    Object.defineProperty(this, 'getTransferElements', {
        value() {
            return obj;
        }
    });

    return obj;
};

function addToTransferTable(gid, elem, q) {
    var te = M.getTransferElements();
    var target = gid[0] === 'u'
        ? $('tr.transfer-upload.transfer-queued:last', te.domTable)
        : $('tr.transfer-download.transfer-queued:last', te.domTable);

    if (target.length) {
        target.after(elem);
    }
    else {
        if (gid[0] != 'u') {
            target = $('tr.transfer-upload.transfer-queued:first', te.domTable);
        }

        if (target.length) {
            target.before(elem);
        }
        else {
            target = $('tr.transfer-completed:first', te.domTable);

            if (target.length) {
                target.before(elem);
            }
            else {
                $(te.domTable).append(elem);
            }
        }
    }
    /*if ($.mSortableT) {
     $.mSortableT.sortable('refresh');
     }*/
    if (!q) {
        delay('fm_tfsupdate', fm_tfsupdate);
    }
}
MegaData.prototype.addToTransferTable = function(gid, ttl, elem) {
    var T = ttl || this.getTransferTableLengths();
    if (T === false) {
        return;
    }

    if (d > 1) {
        var logger = (gid[0] === 'u' ? ulmanager : dlmanager).logger;
        logger.info('Adding Transfer', gid, JSON.stringify(T));
    }

    if (this.tfsResizeHandler) {
        M.getTransferElements()
            .domScrollingTable
            .addEventListener('ps-y-reach-end', M, {passive: true});
        mBroadcaster.addListener('tfs-dynlist-flush', M);

        $(window).rebind('resize.tfsdynlist', this.tfsResizeHandler);
        this.tfsResizeHandler = null;
    }

    if (T.left > 0) {
        addToTransferTable(gid, elem, true);
    }
    else {
        var fit;

        if (gid[0] !== 'u') {
            // keep inserting downloads as long there are uploads
            var dl = $('.transfer-table tr.transfer-download.transfer-queued:last');

            if (dl.length) {
                dl = dl.prevAll().length;

                fit = (dl && dl + 1 < T.used);
            }
            else {
                fit = !document.querySelector('.transfer-table tr.transfer-download');
            }

            if (fit) {
                addToTransferTable(gid, elem);
            }
        }
        else {
            // Keep inserting uploads as long downloads are overquota...
            // XXX: Check whether there is a noticeable performance degradation...

            if (document.querySelector('.transfer-table tr.transfer-download .transfer-status.overquota')) {
                fit = true;
                addToTransferTable(gid, elem);
            }
        }

        if (!fit) {
            M.tfsdomqueue[gid] = elem;
        }
    }
};

var __ul_id = 8000;
MegaData.prototype.addUpload = function(u, ignoreWarning, emptyFolders, target) {
    'use strict'; /* jshint -W074 */

    if (M.isInvalidUserStatus()) {
        return;
    }

    var flag = 'ulMegaSyncAD';

    if (u.length > 999 && !ignoreWarning && !localStorage[flag]) {
        var showMEGAsyncDialog = function(button, syncData) {
            const tag = `addUpload.${makeUUID()}`;

            $('.download-button.download').safeHTML(button);
            $('.megasync-upload-overlay').removeClass('hidden');

            var $chk = $('.megasync-upload-overlay .checkdiv');
            var hideMEGAsyncDialog = function() {
                delay.cancel(tag);
                $('.megasync-upload-overlay').addClass('hidden');
                $(document).off('keyup.megasync-upload');
                $('.download-button.continue, .fm-dialog-close').off('click');
                $('.download-button.download').off('click');
                $chk.off('click.dialog');
                $chk = undefined;
            };
            var onclick = function() {
                hideMEGAsyncDialog();
                M.addUpload(u, true, emptyFolders, target);
            };
            $(document).rebind('keyup.megasync-upload', onclick);
            $('.download-button.continue, .fm-dialog-close').rebind('click', onclick);
            $('.download-button.download').rebind('click', () => {
                hideMEGAsyncDialog();

                if (!syncData) {
                    mega.redirect('mega.io', 'desktop', false, false, false);
                }
                // if the user is running MEGAsync 3.0+
                else if (!syncData.verNotMeet) {
                    // Check whether the user logged in MEGAsync does match here
                    if (syncData.u === u_handle) {
                        // Let MEGAsync open the local file selector.
                        megasync.uploadFile(M.currentdirid);
                    }
                }
            });
            $chk.rebind('click.dialog', function() {
                if ($chk.hasClass('checkboxOff')) {
                    $chk.removeClass('checkboxOff').addClass('checkboxOn');
                    localStorage[flag] = 1;
                }
                else {
                    $chk.removeClass('checkboxOn').addClass('checkboxOff');
                    delete localStorage[flag];
                }
            });

            if (syncData && syncData.u !== u_handle) {
                $('.megasync-title span', '.megasync-upload-overlay').text(l.msync_upload_wrong_user_title);
                $('.megasync-info', '.megasync-upload-overlay').safeHTML(l.megasync_upload_wrong_user);
            }
            else {
                $('.megasync-title span', '.megasync-upload-overlay').text(l[19639]);
                $('.megasync-info', '.megasync-upload-overlay').safeHTML(l[12488]);
            }
            delay(tag, () => {
                if (!elementIsVisible(document.querySelector('.megasync-upload-overlay'))) {
                    onclick();
                }
            }, 2000);
        };
        dlmanager.isMEGAsyncRunning('3.0', 1)
            .done(function(ms, syncData) {
                showMEGAsyncDialog(u_handle === syncData.u ? l[8912] : l.megasync_check_logins, syncData);
            })
            .fail(function() {
                showMEGAsyncDialog(l.desktopapp_dialog_btn);
            });
        return;
    }
    var toChat;
    var added = 0;
    var ul_id;
    var pause = '';
    var pauseTxt = '';
    var ephemeral = M.isFileDragPage(page);
    var ttl = this.getTransferTableLengths();

    target = target || this.currentdirid;
    target = M.isCustomView(target).nodeID || target;

    if (String(target).startsWith('chat')) {
        toChat = true;
    }
    else if (String(target).length !== 8 && String(target).length !== 11) {
        target = this.lastSeenCloudFolder || this.RootID;
    }
    console.assert(ephemeral || this.RootID, 'Unexpected M.addUpload() invocation...');

    if (uldl_hold) {
        pause = 'transfer-paused';
        pauseTxt = l[1651];
    }

    // Foreach the queue and start uploading
    var startUpload = function(u) {
        u.sort(function(a, b) {
            return a.size < b.size ? 1 : -1;
        });

        for (var i = u.length; i--;) {
            var f = u[i];
            var filesize = f.size;

            ul_id = ++__ul_id;
            f.target = f.target || target;
            f.id = ul_id;

            var gid = 'ul_' + ul_id;
            var template = (
                '<tr id="' + gid + '" class="transfer-queued transfer-upload ' + pause + '">'
                + '<td><div class="transfer-type upload sprite-fm-mono-after icon-up-after">'
                + '<ul><li class="right-c"><p><span></span></p></li>'
                + '<li class="left-c"><p><span></span></p></li></ul>'
                + '</div></td>'
                + '<td><span class="item-type-icon icon-' + fileIcon({ name: f.name }) + '-24"></span>'
                + '<span class="tranfer-filetype-txt">' + htmlentities(f.name) + '</span></td>'
                + '<td>' + filetype(f.name) + '</td>'
                + '<td class="transfer-size">' + bytesToSize(filesize) + '</td>'
                + '<td><span class="uploaded-size">' + bytesToSize(0) + '</span></td>'
                + '<td><span class="eta"></span><span class="speed">' + pauseTxt + '</span></td>'
                + '<td><span class="transfer-status">' + l[7227] + '</span></td>'
                + '<td class="grid-url-field">'
                + '<a class="link-transfer-status transfer-pause"><i class="sprite-fm-mono icon-pause"></i></a>'
                + '<a class="clear-transfer-icon"><i class="sprite-fm-mono icon-close-component"></i></a></td>'
                + '<td><span class="row-number"></span></td>'
                + '</tr>');
            this.addToTransferTable(gid, ttl || f, template);

            if (typeof f._replaces === 'number') {
                // We need to create a version for a pending upload, hold it up until it finishes.
                ulmanager.holdUntilUploadFinished(f, f._replaces, true);
                delete f._replaces;
            }
            else {
                ul_queue.push(f);
            }

            if (ttl) {
                ttl.left--;
            }
            added++;

            // When dragging files to create an ephemeral, uldl_hold is set at the time of showing the terms dialog.
            if (!ephemeral && uldl_hold) {
                fm_tfspause('ul_' + ul_id);
            }

            if (toChat) {
                f.chatid = target;
            }
        }
        // unfortunately, looping again in reversed order
        // for (var ur = 0; ur < u.length; ur++) {
        //    mega.tpw.addDownloadUpload(mega.tpw.UPLOAD, u[ur]);
        // }
        tfsheadupdate({
            a: u.map((u) => {
                return `ul_${u.id}`;
            })
        });
        mega.tpw.addDownloadUpload(mega.tpw.UPLOAD, u);

        if (!added) {
            ulmanager.logger.warn('Nothing added to upload.');
            return;
        }
        if (!$.transferHeader) {
            M.addTransferPanelUI();
        }
        if (ephemeral && !Object(u_attr).terms) {
            ulQueue.pause();
            uldl_hold = true;
        }
        else {
            M.showTransferToast('u', added);
            M.openTransfersPanel();
            delay('fm_tfsupdate', fm_tfsupdate); // this will call $.transferHeader()
        }

        if ((ulmanager.isUploading = Boolean(ul_queue.length))) {
            $('.transfer-pause-icon').removeClass('disabled');
            $('.transfer-clear-completed').removeClass('disabled');
            $('.transfer-clear-all-icon').removeClass('disabled');

            M.onFileManagerReady(function() {

                if (ulmanager.ulOverStorageQuota) {
                    ulmanager.ulShowOverStorageQuotaDialog();
                }

                if (mBroadcaster.hasListener('upload:start')) {
                    var data = Object.create(null);

                    for (var i = u.length; i--;) {
                        var f = u[i];

                        data[f.id] = {
                            uid: f.id,
                            size: f.size,
                            name: f.name,
                            chat: f.chatid,
                            // store the minimal expected file attributes for this upload
                            efa: (is_image(f) ? 2 : 0) + (MediaInfoLib.isFileSupported(f) ? 1 : 0)
                        };

                        // keep a global record for possible createnodethumbnail() calls at any later stage...
                        ulmanager.ulEventData[f.id] = data[f.id];
                    }

                    mBroadcaster.sendMessage('upload:start', data);
                }
            });
        }
    }.bind(this);

    // Prepare uploads by creating their target path beforehand as needed for the new fileconflict logic
    var paths = Object.create(null);
    var queue = Object.create(null);
    var files = [];

    if (toChat) {
        toChat = M.myChatFilesFolder.name;
        paths[toChat] = null;
        files = u;
    }
    else {
        for (var i = u.length; i--;) {
            var file = u[i];

            if (file.path) {
                paths[file.path] = null;

                var path = M.getSafePath(file.path)[0];
                if (path) {
                    if (!queue[path]) {
                        queue[path] = [];
                    }
                    queue[path].push(file);
                    continue;
                }
            }

            files.push(file);
        }

        if (emptyFolders) {
            for (var x = emptyFolders.length; x--;) {
                paths[emptyFolders[x]] = null;
            }
        }
    }

    var uuid = makeUUID();
    var makeDirPromise = mega.promise;

    if (d) {
        ulmanager.logger.info('[%s] Pre-upload preparation...', uuid, u.length, [u]);
        console.time('makeDirPromise-' + uuid);
    }

    var dequeue = function(name) {
        var files = queue[name] || false;

        if (d) {
            ulmanager.logger.info('Skipping uploads under "%s"...', name, files);
        }

        for (var i = files.length; i--;) {
            delete paths[files[i].path];
        }

        delete queue[name];
    };

    var makeDirProc = function() {
        var conflicts = [];
        var folders = Object.keys(queue);

        if (d) {
            console.time('makeDirProc-' + uuid);
        }

        for (var i = folders.length; i--;) {
            var name = folders[i];
            var found = fileconflict.getNodeByName(target, name);

            if (found) {
                conflicts.push([{t: 1, name: name}, found]);
            }
        }

        if (d && conflicts.length) {
            ulmanager.logger.info('[%s] Resolving folder conflicts...', uuid, conflicts.concat());
        }

        (function _foreach() {
            var entry = conflicts.pop();

            if (entry) {
                var node = entry[1];
                entry = entry[0];

                fileconflict.prompt('upload', entry, node, conflicts.length, target)
                    .always(function(file, name, action, repeat) {
                        if (file === -0xBADF) {
                            if (d) {
                                console.timeEnd('makeDirProc-' + uuid);
                            }
                            return makeDirPromise.reject(EBLOCKED);
                        }

                        if (action === fileconflict.DONTCOPY) {
                            dequeue(entry.name);

                            if (repeat) {
                                while ((entry = conflicts.pop())) {
                                    dequeue(entry[0].name);
                                }
                            }
                        }
                        else {
                            console.assert(action === fileconflict.REPLACE, 'Invalid action...');

                            if (repeat) {
                                conflicts = [];
                            }
                        }

                        onIdle(_foreach);
                    });
            }
            else {
                u = Array.prototype.concat.apply([], Object.values(queue).concat(files));
                M.createFolders(paths, toChat ? M.cf.p || M.RootID : target).always(function(res) {
                    if (d && res !== paths) {
                        ulmanager.logger.debug('Failed to create paths hierarchy...', res);
                    }
                    if (res[toChat]) {
                        M.myChatFilesFolder.set(res[toChat]).dump('cf');
                    }
                    makeDirPromise.resolve();
                });

                if (d) {
                    console.timeEnd('makeDirProc-' + uuid);
                }
            }
        })();
    };

    var ulOpSize = 0; // how much bytes we're going to upload

    for (var j = u.length; j--;) {
        ulOpSize += u[j].size;
    }

    M.onFileManagerReady(function() {
        if (target === undefined) {
            // On ephemeral was undefined
            target = M.RootID;
        }
        dbfetch.get(String(target)).finally(() => {
            makeDirProc();
            // M.checkGoingOverStorageQuota(ulOpSize).done(makeDirProc);
        });
    });

    makeDirPromise.then(() => {
        var targets = Object.create(null);

        for (var i = u.length; i--;) {
            var file = u[i];

            if (toChat) {
                file.target = paths[toChat] || M.RootID;
            }
            else if (paths[file.path]) {
                file.target = paths[file.path];
            }
            else if (!file.target) {
                file.target = target;
            }

            targets[file.target] = 1;
        }

        return dbfetch.geta(Object.keys(targets)).then((r) => {
            // loadingDialog.hide();

            if (!M.c[target] && String(target).length !== 11 && !toChat) {
                if (d) {
                    ulmanager.logger.warn("Error dbfetch'ing target %s", target, r);
                }
                target = M.currentdirid;
            }

            var to = toChat ? u[0].target : target;
            var op = fileversioning.dvState ? 'replace' : 'upload';

            return fileconflict.check(u, to, op, toChat ? fileconflict.KEEPBOTH : 0);
        });
    }).then(startUpload).catch((ex) => ex !== EBLOCKED && tell(ex)).finally(() => {
        if (d) {
            console.timeEnd('makeDirPromise-' + uuid);
        }
    });
};

/**
 * Create new file on the cloud
 * @param {String} fileName a string with the file name to create.
 * @param {String} dest The handle where the file will be created.
 * @return {MegaPromise} megaPromise to be resolved/rejected once the operation is finished.
 */
MegaData.prototype.addNewFile = function(fileName, dest) {
    'use strict';
    // eslint-disable-next-line local-rules/hints
    var addFilePromise = new MegaPromise();
    dest = dest || M.currentdirid || M.RootID;
    dest = dest.split('/').pop();

    if ([8, 11].indexOf(String(dest).length) === -1) {
        return addFilePromise.reject(EACCESS);
    }
    if (!fileName) {
        return addFilePromise.reject('File Name is empty');
    }
    if (M.c[dest]) {
        // Check if a node (file or folder) with the same name already exists.
        for (var handle in M.c[dest]) {
            if (M.d[handle] && M.d[handle].name === name) {
                return addFilePromise.reject('A node with the same name already exists');
            }
        }
    }

    var nFile = new File([''], fileName, { type: "text/plain" });
    nFile.target = dest;
    nFile.id = ++__ul_id;
    nFile.path = '';
    nFile.isCreateFile = true;
    nFile.promiseToInvoke = addFilePromise;


    ul_queue.push(nFile);
    return addFilePromise;
};

// eslint-disable-next-line complexity
MegaData.prototype.ulprogress = function(ul, perc, bl, bt, bps) {
    'use strict';
    var id = ul.id;
    var domElement = ul.domElement;

    if (!domElement || !domElement.parentNode) {
        var $tr = $('#ul_' + id);
        delay('fm_tfsupdate', fm_tfsupdate); // this will call $.transferHeader()

        $tr.find('.transfer-status').text('');
        $tr.removeClass('transfer-initiliazing transfer-queued');
        $tr.addClass('transfer-started');
        // eslint-disable-next-line local-rules/jquery-replacements
        $($tr.closest('table')).prepend($tr);

        domElement = ul.domElement = document.getElementById('ul_' + id);
        if (!domElement) {
            console.error('DOM Element not found...', id, ul);
            return false;
        }

        domElement._elmStatus = domElement.querySelector('.transfer-status');
        domElement._elmSentSize = domElement.querySelector('.uploaded-size');
        domElement._elmRProgress = domElement.querySelector('.right-c p');
        domElement._elmLProgress = domElement.querySelector('.left-c p');
        domElement._elmTimeLeft = domElement.querySelector('.eta');
        domElement._elmSpeed = domElement.querySelector('.speed');
    }

    if (!bl || !ul.starttime || uldl_hold) {
        return false;
    }

    $.transferprogress['ul_' + id] = [bl, bt, bps];
    delay('percent_megatitle', percent_megatitle, 50);

    if (domElement._elmRProgress) {
        var transferDeg = 360 * perc / 100;
        if (transferDeg <= 180) {
            domElement._elmRProgress.style.transform = 'rotate(' + transferDeg + 'deg)';
        }
        else {
            domElement._elmRProgress.style.transform = 'rotate(180deg)';
            domElement._elmLProgress.style.transform = 'rotate(' + (transferDeg - 180) + 'deg)';
        }
    }

    if (domElement._elmStatus) {
        domElement._elmStatus.textContent = perc + '%';
    }

    if (domElement._elmSentSize) {
        if (perc > 99) {
            domElement._elmSentSize.textContent = bytesToSize(bt, 2);
        }
        else {
            domElement._elmSentSize.textContent = bytesToSize(bl, 1, -1);
        }
    }

    if (domElement._elmTimeLeft) {
        var retime = bps > 1000 ? (bt - bl) / bps : -1;
        if (retime > 0) {
            if (!domElement._elmTimeLeft.textContent) {
                domElement._elmTimeLeft.classList.remove('unknown');
            }
            domElement._elmTimeLeft.textContent = secondsToTime(retime);
        }
        else {
            domElement._elmTimeLeft.classList.add('unknown');
            domElement._elmTimeLeft.textContent = '';
        }
    }

    if (domElement._elmSpeed) {
        if (bps > 0) {
            if (!domElement._elmSpeed.textContent) {
                domElement._elmSpeed.classList.remove('unknown');
            }
            domElement._elmSpeed.textContent = bytesToSpeed(bps, 1);
        }
        else {
            domElement._elmSpeed.classList.add('unknown');
            domElement._elmSpeed.textContent = '';
        }
    }

    if (ul._gotTransferError && bps > 0) {
        ul._gotTransferError = false;
        domElement.classList.remove('transfer-error');
    }
    tfsheadupdate({t: `ul_${id}`});
    mega.tpw.updateDownloadUpload(mega.tpw.UPLOAD, id, perc, bl, bt, bps, ul.pos, ul.starttime);
};

// Handle upload error
MegaData.prototype.ulerror = function(ul, error) {
    'use strict';

    if (d) {
        console.error('Upload error', ul, error, api_strerror(error));
    }
    var overquota = true;

    if (error === EOVERQUOTA) {
        ulQueue.pause();
        if (!is_megadrop) {
            M.showOverStorageQuota(-1).catch(nop);
        }
    }
    else if (error === EGOINGOVERQUOTA) {
        M.checkGoingOverStorageQuota(-1);
    }
    else {
        overquota = false;
    }

    if (ul) {
        var id = ul.id;
        var target = ul.target;

        var errStr = api_strerror(error);

        this.ulfinalize(ul, errStr);
        tfsheadupdate(overquota ? {o: `ul_${id}`} : {e: `ul_${id}`});
        mega.tpw.errorDownloadUpload(mega.tpw.UPLOAD, ul, errStr, overquota);


        if (ul.owner) {
            ul.owner.destroy();
        }
        else {
            oDestroy(ul);
        }
        mBroadcaster.sendMessage('upload:error', id, error);
        mBroadcaster.sendMessage('trk:event', 'upload', 'error', 'code', error);

        if (error === EOVERQUOTA) {
            if (mBroadcaster.hasListener('upload:error')) {
                ul_queue.filter(isQueueActive)
                    .forEach(function(ul) {
                        mBroadcaster.sendMessage('upload:error', ul.id, error);
                    });
            }
            ulmanager.abort(null);
            const tfse = M.getTransferElements();
            const $rows = $("tr[id^='ul_']", tfse.domTable);
            $rows.addClass('transfer-error overquota').removeClass('transfer-completed');
            $('.transfer-status', $rows).text(l[1010]);

            // Inform user that upload File request is not available anymore
            if (is_megadrop) {
                mBroadcaster.sendMessage('FileRequest:overquota', error);
            }
        }
        else {
            if (error < 0) {
                const $ulRow = $(`#ul_${id}`);
                $ulRow.addClass('transfer-error').removeClass('transfer-completed');
                if (error === EOVERQUOTA) {
                    $ulRow.addClass('overquota');
                }
            }

            // Target is not exist on M.d anymore, target is deleted.
            if (error === EACCESS && !M.d[target]) {
                ulmanager.ulClearTargetDeleted(target);
            }
        }
    }
    else if (!overquota) {
        if (error === ESHAREROVERQUOTA) {
            msgDialog('warninga', l[135], l[8435]);
        }
        else {
            msgDialog('warninga', l[135], l[47], api_strerror(error));
        }
    }
};

MegaData.prototype.ulcomplete = function(ul, h, faid) {
    'use strict';

    // If there is no start time, initialise the upload and set percentage to 100, e.g. with deduplicated uploads
    if (h && !ul.isCreateFile && typeof ul.starttime === 'undefined') {
        M.ulstart(ul);
        M.ulprogress(ul, 100, ul.size, ul.size, 0);
    }

    mBroadcaster.sendMessage('upload:completion', ul.id, h || -0xBADF, faid, ul.chatid);

    if (ul.skipfile) {
        showToast('megasync', l[372] + ' "' + ul.name + '" (' + l[1668] + ')');
    }

    tfsheadupdate({f: `ul_${ul.id}`});
    mega.tpw.finishDownloadUpload(mega.tpw.UPLOAD, ul, h);

    this.ulfinalize(ul, ul.skipfile ? l[1668] : l[1418], h);
};

MegaData.prototype.ulfinalize = function(ul, status, h) {
    'use strict';
    if (ul.promiseToInvoke) {
        ul.promiseToInvoke.resolve(h);
        ul_queue[ul.pos] = Object.freeze({});
        percent_megatitle();
        return;
    }

    var id = ul.id;
    var $tr = $('#ul_' + id);

    $tr.removeClass('transfer-started').addClass('transfer-completed');
    $('.link-transfer-status', $tr).addClass('hidden');
    $tr.find('.left-c p, .right-c p').css('transform', 'rotate(180deg)');
    $tr.find('.transfer-status').text(status);
    $tr.find('.eta, .speed').text('').removeClass('unknown');
    $('.uploaded-size', $tr).text(bytesToSize(ul.size, 2));
    ul_queue[ul.pos] = Object.freeze({});

    if ($.transferprogress && $.transferprogress['ul_' + id]) {
        if (!$.transferprogress['ulc']) {
            $.transferprogress['ulc'] = 0;
        }
        $.transferprogress['ulc'] += $.transferprogress['ul_' + id][1];
        delete $.transferprogress['ul_' + id];
    }

    // If File request windows exists and upload
    if (id && is_megadrop) {
        mega.fileRequestUpload.onItemUploadCompletion(id);
    }
    else if (h) {
        // @todo better error handling..
        M.confirmNodesAtLocation(h).catch(tell);
    }

    delay('tfscomplete', function() {
        M.resetUploadDownload();
        $.tresizer();
    });
};

MegaData.prototype.ulstart = function(ul) {
    var id = ul.id;

    if (d) {
        ulmanager.logger.log('ulstart', id);
    }

    if (!$.transferprogress) {
        $.transferprogress = Object.create(null);
    }

    $('.transfer-status', $('#ul_' + id).addClass('transfer-initiliazing')).text(l[1042]);

    ul.starttime = new Date().getTime();
    fm_tfsupdate();// this will call $.transferHeader()
    this.ulprogress(ul, 0, 0, 0);
    mBroadcaster.sendMessage('trk:event', 'upload', 'started');
};

MegaData.prototype.openTransfersPanel = function openTransfersPanel() {
    'use strict';

    $.tresizer();
    $('.nw-fm-left-icon.transfers').addClass('transfering');
    // Start the new transfer right away even if the queue is paused?
    // XXX: Remove fm_tfspause calls at M.addDownload/addUpload to enable this
    /*if (uldl_hold) {
        uldl_hold = false;
        dlQueue.resume();
        ulQueue.resume();
        $('.transfer-pause-icon').removeClass('active').find('span').text(l[6993]);
        $('.nw-fm-left-icon.transfers').removeClass('paused');
    }*/
    // $(window).trigger('resize'); // this will call initTreeScroll();

    if ($('table.transfer-table tr').length > 1) {
        $('.transfer-clear-all-icon').removeClass('hidden');
    }
};

MegaData.prototype.showTransferToast = function showTransferToast(t_type, t_length, isPaused) {
    'use strict';

    t_type = t_type ? t_type : 'd';

    // If the user is viewing a slideshow
    if (window.slideshowid && page !== 'download') {

        let icons = ['upload'];
        const text = document.createElement('span');
        text.className = 'message';
        let buttons = [];

        // Upload message
        if (t_type === 'u') {
            // Plural message
            if (t_length > 1) {
                text.textContent = l[12480].replace('%1', t_length);
            }
            // Singular message
            else {
                text.textContent = l[7223];
            }
        }
        // Download message
        else {
            icons = ['download'];
            // Plural message
            if (t_length > 1) {
                text.textContent = l[12481].replace('%1', t_length);
            }
            // Singular message
            else {
                text.textContent = l[7222];
            }
        }

        // Add (paused) to the message
        if (uldl_hold || isPaused) {
            const b = document.createElement('b');
            b.textContent = ` (${l[1651]}) `;
            text.appendChild(b);
        }

        // Only display the "Show me" button in the toast if the user is logged in
        if (self.fminitialized && u_type) {
            buttons.push({
                text: l[7224],
                onClick: () => {
                    // Hide the toast and overlay, open the transfers page
                    window.toaster.main.hideAll();
                    const el = document.querySelector('.viewer-overlay');
                    if (el) {
                        el.classList.add('hidden');
                    }
                    $('.nw-fm-left-icon.transfers').trigger('click');
                }
            });
        }

        // Show the toast
        window.toaster.main.show({
            content: text,
            buttons,
            icons
        });
    }
};

// @see filedrag.js
MegaData.prototype.isFileDragPage = function(page) {
    'use strict';

    return page === 'start' || page === 'login' || page === 'register';
};

// report a transient upload error
function onUploadError(ul, errorstr, reason, xhr, isOverQuota) {
    'use strict';

    if (!ul || !ul.id) {
        return;
    }

    if (d) {
        ulmanager.logger.error('onUploadError', ul.id, ul.name, errorstr, reason, hostname(ul.posturl));
    }

    if (is_mobile) {
        mobile.uploadOverlay.error(ul, errorstr);
        return;
    }

    tfsheadupdate(isOverQuota ? {o: `ul_${ul.id}`} : {e: `ul_${ul.id}`});
    mega.tpw.errorDownloadUpload(mega.tpw.UPLOAD, { id: ul.id }, errorstr, isOverQuota);

    ul._gotTransferError = true;
    const $ulRow = $(`#ul_${ul.id}`);
    $ulRow.addClass('transfer-error');
    $('.transfer-status', $ulRow).text(errorstr);
    if (isOverQuota) {
        $ulRow.addClass('overquota');
    }
}


function resetOverQuotaTransfers(ids) {
    $('#' + ids.join(',#'))
        .addClass('transfer-queued')
        .find('.transfer-status')
        .removeClass('overquota')
        .text(l[7227]);

    tfsheadupdate({t: ids});
    mega && mega.tpw && mega.tpw.resetErrorsAndQuotasUI(mega.tpw.DOWNLOAD);
}

function fm_tfspause(gid, overquota) {
    'use strict';
    var transferType;
    if (ASSERT(typeof gid === 'string' && "zdu".indexOf(gid[0]) !== -1, 'Ivalid GID to pause')) {
        if (gid[0] === 'u') {
            ulQueue.pause(gid);
            transferType = mega.tpw.UPLOAD;
        }
        else {
            dlQueue.pause(gid);
            transferType = mega.tpw.DOWNLOAD;
        }

        if (page === 'download') {
            if (overquota === true) {
                setTransferStatus(gid, l[20666]);
                $('.download.download-page').addClass('overquota');
            }
            $('.download .pause-transfer').removeClass('hidden').addClass('active')
                .find('span').text(l[1649]);
            $('.download.download-page').addClass('paused-transfer');
            $('.download.eta-block .dark-numbers').text('');
            $('.download.eta-block .light-txt').text(l[1651]);
            $('.download.speed-block .dark-numbers').text('');
            $('.download.speed-block .light-txt').safeHTML('&mdash; ' + l['23062.k']);
        }
        else {
            var $tr = $('#' + gid);

            if ($tr.hasClass('transfer-started')) {
                $tr.find('.eta').text('').addClass('unknown');
            }
            $tr.find('.speed').text(l[1651]).addClass('unknown');
            $tr.addClass('transfer-paused');
            $tr.removeClass('transfer-started');

            let $transLink = $('.link-transfer-status', $tr);
            $transLink.removeClass('transfer-pause').addClass('transfer-play');
            $('i', $transLink).removeClass('icon-pause').addClass('icon-play-small');

            if (overquota === true) {
                $tr.addClass('transfer-error');
                if (gid[0] === 'u') {
                    $tr.addClass('overquota');
                }
                $tr.find('.transfer-status').addClass('overquota').text(l[1673]);
                tfsheadupdate({o: gid});
                mega.tpw.errorDownloadUpload(transferType, { id: gid.split('_').pop() }, l[1673], overquota);
            }
            else {
                $tr.addClass('transfer-queued');
                $tr.removeClass('transfer-error');
                $tr.find('.transfer-status').text(l[7227]);
                tfsheadupdate({p: gid});
                mega.tpw.pauseDownloadUpload(transferType, { id: gid.split('_').pop() });
            }
        }
        return true;
    }
    return false;
}

function fm_tfsresume(gid) {
    'use strict';
    if (ASSERT(typeof gid === 'string' && "zdu".indexOf(gid[0]) !== -1, 'Invalid GID to resume')) {

        var $tr = $('#' + gid);
        tfsheadupdate({r: gid});
        if (gid[0] === 'u') {
            mega.tpw.resumeDownloadUpload(mega.tpw.UPLOAD, { id: gid.split('_').pop() });

            ulQueue.resume(gid);

            $tr.removeClass('transfer-paused');

            let $transLink = $('.link-transfer-status', $tr);
            $transLink.removeClass('transfer-play').addClass('transfer-pause');
            $('i', $transLink).removeClass('icon-play-small').addClass('icon-pause');
        }
        else {
            mega.tpw.resumeDownloadUpload(mega.tpw.DOWNLOAD, { id: gid.split('_').pop() });

            if (page === 'download'
                && $('.download.download-page').hasClass('overquota')
                || $tr.find('.transfer-status').hasClass('overquota')) {

                if (page === 'download') {
                    $('.download .pause-transfer').removeClass('hidden').addClass('active');
                    $('.download.download-page').addClass('paused-transfer');
                }

                if (dlmanager.isOverFreeQuota) {
                    return dlmanager.showOverQuotaRegisterDialog();
                }

                return dlmanager.showOverQuotaDialog();
            }
            dlQueue.resume(gid);

            if (page === 'download') {
                $('.download .pause-transfer').removeClass('active').find('span').text(l[9112]);
                $('.download.download-page').removeClass('paused-transfer');
                $('.download.speed-block .light-txt').safeHTML('&mdash; ' + l['23062.k']);
            }
            else {
                $tr.removeClass('transfer-paused');

                let $transLink = $('.link-transfer-status', $tr);
                $transLink.removeClass('transfer-play').addClass('transfer-pause');
                $('i', $transLink).removeClass('icon-play-small').addClass('icon-pause');

                if ($('tr.transfer-started, tr.transfer-initiliazing', $tr.closest('table')).length) {
                    $('.speed, .eta', $tr).removeClass('unknown').text('');
                }
                else {
                    $('.transfer-status', $tr.addClass('transfer-initiliazing')).text(l[1042]);
                }
            }
        }
        if (uldl_hold) {
            dlQueue.resume();
            ulQueue.resume();
            uldl_hold = false;
        }
        return true;
    }
    return false;
}

function fm_tfsupdate() {
    'use strict';
    /* jshint -W074 */

    var i = 0;
    var u = 0;

    var tfse = M.getTransferElements();
    if (!tfse) {
        return false;
    }
    var domTable = tfse.domTable;

    var domCompleted = domTable.querySelectorAll('tr.transfer-completed');
    var completedLen = domCompleted.length;
    if (completedLen) {
        var ttl    = M.getTransferTableLengths();
        var parent = domCompleted[0].parentNode;

        if (ttl.used > 10 && completedLen + 4 > ttl.size || M.pendingTransfers > 50 + ttl.used * 4) {
            // Remove completed transfers filling the whole table
            while (completedLen--) {
                parent.removeChild(domCompleted[completedLen]);
            }
            mBroadcaster.sendMessage('tfs-dynlist-flush');
        }
        else if (M.pendingTransfers) {
            // Move completed transfers to the bottom
            while (completedLen--) {
                parent.appendChild(domCompleted[completedLen]);
            }
        }
    }
    if ($.transferHeader) {
        $.transferHeader(tfse);
    }

    var $trs = domTable.querySelectorAll('tr:not(.transfer-completed)');
    i = $trs.length;
    while (i--) {
        if ($trs[i].classList.contains('transfer-upload')) {
            ++u;
        }
    }
    i = $trs.length - u;
    for (var k in M.tfsdomqueue) {
        if (k[0] === 'u') {
            ++u;
        }
        else {
            ++i;
        }
    }

    M.pendingTransfers = i + u;
    tfsheadupdate();
}

function tfsheadupdate(update) {
    'use strict';
    const processStats = function(tRemain, tBytes, tDoneBytes, tOq, tErr, blocks) {
        if (tOq) {
            blocks.block.classList.add('overquota');
            blocks.text.textContent = l.tfw_header_overquota;
        }
        else if (tErr) {
            blocks.block.classList.add('error');
            blocks.text.textContent = l.tfw_header_error;
        }
        else if (tRemain) {
            blocks.text.textContent = String(l[20808] || '').replace('{0}', tRemain > 999 ? '999+' : tRemain);
            blocks.block.classList.remove('error', 'overquota');
        }
        else {
            blocks.text.textContent = l.tfw_header_complete;
            blocks.block.classList.remove('error', 'overquota');
        }
        let perc = tDoneBytes / tBytes;
        perc = isNaN(perc) ? 0 : Math.round(perc * 100);
        const fullDeg = 360;
        const deg = fullDeg * perc / 100;
        const leftChart = blocks.chart.querySelector('.left-chart');
        const rightChart = blocks.chart.querySelector('.right-chart');
        const leftSpan = leftChart.getElementsByTagName('span')[0];
        if (perc < 50) {
            leftChart.classList.add('low-percent-clip');
            rightChart.classList.add('low-percent-clip');
            leftSpan.style.transform = `rotate(${180 + deg}deg)`;
        }
        else {
            leftChart.classList.remove('low-percent-clip');
            rightChart.classList.remove('low-percent-clip');
            leftSpan.style.transform = `rotate(${deg - 180}deg)`;
        }
    };

    if (!tfsheadupdate.stats) {
        tfsheadupdate.stats = Object.create(null);
        // Transfer ids by type
        tfsheadupdate.stats.dl = Object.create(null);
        tfsheadupdate.stats.ul = Object.create(null);
        // Total transfers by type
        tfsheadupdate.stats.adl = 0;
        tfsheadupdate.stats.aul = 0;
        // Total errored transfers by type
        tfsheadupdate.stats.edl = 0;
        tfsheadupdate.stats.eul = 0;
        // Total overquota transfers by type
        tfsheadupdate.stats.odl = 0;
        tfsheadupdate.stats.oul = 0;
        // Total finished transfers by type
        tfsheadupdate.stats.fdl = 0;
        tfsheadupdate.stats.ful = 0;
        tfsheadupdate.checkState = (type, id, state) =>
            tfsheadupdate.stats[type]
            && tfsheadupdate.stats[type][id]
            && tfsheadupdate.stats[type][id] === state ? -1 : 0;
    }
    if (update) {
        tfsheadcalc(update);
    }

    const tfse = M.getTransferElements();
    if (!tfse) {
        return;
    }

    const blocks = Object.create(null);
    const { adl, aul, edl, eul, odl, oul, fdl, ful } = tfsheadupdate.stats;
    let { dl_done, ul_done, dl_total, ul_total } = getTransfersPercent();
    if (!dl_total && !dl_done) {
        dl_total = 1;
        dl_done = 1;
    }
    if (!ul_total && !ul_done) {
        ul_total = 1;
        ul_done = 1;
    }
    if (aul) {
        blocks.block = tfse.domUploadBlock;
        blocks.text = tfse.domUploadProgressText;
        blocks.chart = tfse.domUploadChart;
        processStats(
            aul - ful,
            ul_total,
            ul_done,
            oul,
            eul,
            blocks
        );
        tfse.domUploadBlock.classList.remove('hidden');
    }
    else {
        tfse.domUploadBlock.classList.add('hidden');
    }
    if (adl) {
        blocks.block = tfse.domDownloadBlock;
        blocks.text = tfse.domDownloadProgressText;
        blocks.chart = tfse.domDownloadChart;
        processStats(
            adl - fdl,
            dl_total,
            dl_done,
            odl,
            edl,
            blocks
        );
        tfse.domDownloadBlock.classList.remove('hidden');
    }
    else {
        tfse.domDownloadBlock.classList.add('hidden');
    }
}

function tfsheadcalc(update) {
    'use strict';
    const STATE = {
        TEMP: 0,
        INIT: 1,
        PROGRESS: 2,
        PAUSE: 3,
        ERROR: 4,
        OVERQUOTA: 5,
        FINISH: 6,
    };
    const updateStats = (type, id, key, change, state) => {
        if (state !== STATE.INIT && typeof tfsheadupdate.stats[type][id] === 'undefined') {
            return;
        }
        tfsheadupdate.stats[type][id] = state;
        if (typeof tfsheadupdate.stats[`${key}${type}`] !== 'undefined') {
            tfsheadupdate.stats[`${key}${type}`] += change;
        }
    };

    const key = Object.keys(update)[0];
    if (Array.isArray(update[key])) {
        for (const id of update[key]) {
            const patch = Object.create(null);
            patch[key] = id;
            tfsheadcalc(patch);
        }
        return;
    }
    update[key] = update[key].replace('zip_', 'dl_').replace('LOCKed_', '');
    const type = update[key].split('_')[0];
    const o = tfsheadupdate.checkState(type, update[key], STATE.OVERQUOTA);
    const e = tfsheadupdate.checkState(type, update[key], STATE.ERROR);
    if (typeof tfsheadupdate.stats[type][update[key]] === 'undefined' && ['t', 'f', 'p', 'r'].includes(key)) {
        // Update for an unknown transfer so add it first.
        tfsheadcalc({a: update[key]});
    }

    switch (key) {
        case 't': {
            // Transfer transferring
            updateStats(type, update.t, 'o', o, STATE.TEMP);
            updateStats(type, update.t, 'e', e, STATE.TEMP);
            updateStats(type, update.t, 'n', 1, STATE.PROGRESS);
            break;
        }
        case 'f': {
            // Finish transfer
            updateStats(type, update.f, key, 1, STATE.FINISH);
            break;
        }
        case 'e': {
            // Error transfer
            updateStats(type, update.e, 'o', o, STATE.TEMP);
            updateStats(type, update.e, key, 1 + e, STATE.ERROR);
            break;
        }
        case 'o': {
            // Overquota transfer
            updateStats(type, update.o, 'e', e, STATE.TEMP);
            updateStats(type, update.o, key, 1 + o, STATE.OVERQUOTA);
            break;
        }
        case 'p': {
            // Pause transfer
            updateStats(type, update.p, 'e', e, STATE.TEMP);
            updateStats(type, update.p, 'o', o, STATE.TEMP);
            updateStats(type, update.p, 'n', 1, STATE.PAUSE);
            break;
        }
        case 'r': {
            // Resume transfer
            updateStats(type, update.r, 'n', 1, STATE.PROGRESS);
            break;
        }
        case 'c': {
            // Cancel transfer
            const f = tfsheadupdate.checkState(type, update.c, STATE.FINISH);
            updateStats(type, update.c, 'o', o, STATE.TEMP);
            updateStats(type, update.c, 'e', e, STATE.TEMP);
            updateStats(type, update.c, 'f', f, STATE.TEMP);
            updateStats(type, update.c, 'a', -1, STATE.TEMP);
            delete tfsheadupdate.stats[type][update.c];
            break;
        }
        default:
            if (tfsheadupdate.stats[type]) {
            const id = update[key];
            if (
                typeof tfsheadupdate.stats[type][id] !== "undefined"
                && tfsheadupdate.checkState(type, id, STATE.FINISH)
            ) {
                // If the user downloads the same finished download reset the stats and add it again.
                updateStats(type, id, 'f', -1, STATE.TEMP);
                updateStats(type, id, 'a', -1, STATE.TEMP);
                delete tfsheadupdate.stats[type][id];
                updateStats(type, id, key, 1, STATE.INIT);
            }
            else if (typeof tfsheadupdate.stats[type][id] === 'undefined') {
                // If we haven't received an update for this transfer before add it.
                updateStats(type, id, key, 1, STATE.INIT);
            }
        }
    }
}

/**
 * buildtree
 *
 * Re-creates tree DOM elements in given order i.e. { ascending, descending }
 * for given parameters i.e. { name, [last interaction, status] },
 * Sorting for status and last interaction are available only for contacts.
 * @param {Object} n The ufs-like node.
 * @param {String} [dialog] dialog identifier or force rebuild constant.
 * @param {String} [stype] what to sort.
 * @param {Object} [sSubMap] Internal use
 * @returns {MegaPromise}
 */
MegaData.prototype.buildtree = function(n, dialog, stype, sSubMap) {
    'use strict';

    if (!n) {
        console.error('Invalid node passed to M.buildtree');
        return false;
    }

    var folders = [];
    var _ts_l = (typeof treesearch !== 'undefined' && treesearch) ? treesearch.toLowerCase() : undefined;
    var _tf;
    var _a = 'treea_';
    var _li = 'treeli_';
    var _sub = 'treesub_';
    var rebuild = false;
    var curItemHandle;
    var buildnode;
    var containsc;
    var i;
    var node;
    var name;
    var html;
    var prefix;
    var inshares = n.h === 'shares';
    var outshares = n.h === 'out-shares';
    var publiclinks = n.h === 'public-links';
    var treeType;
    var expand = function(i, e) {
        if (i) {
            e.firstElementChild.classList.add('expanded');
        }
    };
    var labelhash = [];
    var cvtree = {};
    var firstRun = sSubMap === undefined;

    /*
     * XXX: Initially this function was designed to render new nodes only,
     * but due to a bug the entire tree was being rendered/created from
     * scratch every time. Trying to fix this now is a pain because a lot
     * of the New-design code was made with that bug in place and therefore
     * with the assumption the tree panels are recreated always.
     */

    if (dialog === this.buildtree.FORCE_REBUILD) {
        rebuild = true;
        dialog = undefined;
    }

    stype = stype || M.currentTreeType || "cloud-drive";
    if (!dialog || rebuild) { // dialog should not be filtered unless it is forced.
        _tf = M.filterTreePanel[stype + '-label'];
    }

    if (firstRun) {

        sSubMap = 0;
        firstRun = true;

        if (d) {
            console.time('buildtree');
        }
    }

    /* eslint-disable local-rules/jquery-replacements */
    if (n.h === M.RootID && !sSubMap) {
        var wrapperClass = '.js-myfile-tree-panel';

        if (folderlink) {
            n = {h: ''};
            wrapperClass = '.js-other-tree-panel';
        }
        i = escapeHTML(n.h);
        if (typeof dialog === 'undefined') {

            // Clear folder link tree pane
            if (!folderlink && rebuild
                && (node = document.querySelector('.js-other-tree-panel .content-panel.cloud-drive ul'))) {
                node.remove();
            }

            if (rebuild || $('.content-panel.cloud-drive ul').length === 0) {
                $(`${wrapperClass} .content-panel.cloud-drive .tree`)
                    .safeHTML(`<ul id="treesub_${i}"></ul>`);
            }
        }
        else {
            $('.' + dialog + ' .cloud-drive .dialog-content-block').html('<ul id="mctreesub_' + i + '"></ul>');
        }
    }
    else if (inshares) {
        if (typeof dialog === 'undefined') {
            $('.content-panel.shared-with-me').html('<ul id="treesub_shares"></ul>');
        }
        else {
            $('.' + dialog + ' .shared-with-me .dialog-content-block').html('<ul id="mctreesub_shares"></ul>');
        }
        stype = "shared-with-me";
    }
    else if (outshares) {
        $('.content-panel.out-shares').html('<ul id="treesub_os_out-shares"></ul>');
        stype = "out-shares";
        cvtree = M.getOutShareTree();
    }
    else if (publiclinks) {
        $('.content-panel.public-links').html('<ul id="treesub_pl_public-links"></ul>');
        stype = "public-links";
        cvtree = M.getPublicLinkTree();
    }
    else if (n.h === M.BackupsId) {
        if (typeof dialog === 'undefined') {
            const lPaneButton = document.querySelector('.js-lp-myfiles .js-backups-btn');

            if (lPaneButton.classList.contains('hidden')) {
                lPaneButton.classList.remove('hidden');
            }
        }
        stype = "backups";
    }
    else if (n.h === M.RubbishID) {
        if (typeof dialog === 'undefined') {
            $('.content-panel.rubbish-bin').html('<ul id="treesub_' + escapeHTML(M.RubbishID) + '"></ul>');
        }
        else {
            $('.' + dialog + ' .rubbish-bin .dialog-content-block')
                .html('<ul id="mctreesub_' + escapeHTML(M.RubbishID) + '"></ul>');
        }
        stype = "rubbish-bin";
    }
    else if ('utils' in s4 && (n.h === 's4' || n.s4 && n.p === M.RootID)) {
        s4.utils.renderContainerTree(dialog);
        stype = 's4';
    }
    /* eslint-enable local-rules/jquery-replacements */

    prefix = stype;
    // Detect copy and move dialogs, make sure that right DOMtree will be sorted.
    // copy and move dialogs have their own trees and sorting is done independently
    if (dialog) {
        if ($.copyDialog) {
            prefix = 'Copy' + stype;
        }
        else if ($.moveDialog) {
            prefix = 'Move' + stype;
        }
        else if ($.selectFolderDialog) {
            prefix = 'SelectFolder' + stype;
        }
        else if ($.saveAsDialog) {
            prefix = 'SaveAs' + stype;
        }
    }

    const btd = d > 2;
    if (btd) {
        console.group('BUILDTREE for "' + n.h + '"');
    }

    if (n.h && n.h.indexOf('os_') === 0) {
        treeType = 'os';
        n.h = n.h.substr(3);
    }
    else if (n.h && n.h.indexOf('pl_') === 0) {
        treeType = 'pl';
        n.h = n.h.substr(3);
    }

    var tree = this.tree[n.h] || cvtree;

    if (tree) {
        folders = obj_values(tree);

        if (inshares) {
            folders = folders
                .filter(function(n) {
                    return !M.d[n.p];
                });
        }

        if (outshares || publiclinks) {
            // Remove child duplication on the tree.
            folders = folders
                .filter(function(n) {
                    var folderParents = {};
                    while (n && n.p !== M.RootID) {
                        folderParents[n.p] = 1;
                        n = M.d[n.p];
                    }

                    for (var i in folders) {
                        if (folderParents[folders[i].h]) {
                            return false;
                        }
                    }
                    return true;
                });
        }

        if (btd) {
            console.debug('Building tree', folders.map(function(n) {
                return n.h
            }));
        }

        const stp = prefix === 'cloud-drive' && folderlink ? 'folder-link' : prefix;
        const sortDirection = Object(M.sortTreePanel[stp]).dir || 1;
        let sortFn = M.getSortByNameFn2(sortDirection);

        switch (Object(M.sortTreePanel[stp]).by) {
            case 'fav':
                sortFn = M.sortByFavFn(sortDirection);
                break;
            case 'created':
                var type;

                if (outshares || publiclinks) {
                    type = stype;
                }

                sortFn = function (a, b) {
                    return M.getSortByDateTimeFn(type)(a, b, sortDirection);
                };
                break;
            case 'label':
                sortFn = M.sortByLabelFn(sortDirection, true);
                break;
        }

        folders.sort(sortFn);

        // In case of copy and move dialogs
        if (typeof dialog !== 'undefined') {
            _a = 'mctreea_';
            _li = 'mctreeli_';
            _sub = 'mctreesub_';
        }

        // Special prefixs for Out-shares and Public links
        var typefix = '';

        if (stype === 'out-shares' || treeType === 'os') {
            _a += 'os_';
            _li += 'os_';
            _sub += 'os_';
            typefix = 'os_';
        }
        else if (stype === 'public-links' || treeType === 'pl') {
            _a += 'pl_';
            _li += 'pl_';
            _sub += 'pl_';
            typefix = 'pl_';
        }

        if (folders.length && (node = document.getElementById(_a + n.h))) {
            // render > if new folders found on an empty folder
            if (!node.classList.contains('contains-folders')) {
                node.classList.add('contains-folders');
            }
        }
        const tn = fmconfig.treenodes || Object.create(null);
        const dn = $.openedDialogNodes || Object.create(null);

        for (var idx = 0; idx < folders.length; idx++) {
            buildnode = false;
            curItemHandle = folders[idx].h;
            containsc = this.tree[curItemHandle] || '';
            name = folders[idx].name;

            if (folders[idx].s4 && folders[idx].p === M.RootID) {
                continue;
            }

            if (curItemHandle === M.RootID || tn[typefix + curItemHandle] || dialog && dn[curItemHandle]) {

                if (containsc) {
                    buildnode = true;
                }
                else {
                    fmtreenode(typefix + curItemHandle, false);
                }
            }

            if ((node = document.getElementById(_li + curItemHandle))) {

                if ((node = node.querySelector('.nw-fm-tree-item'))) {

                    if (containsc) {
                        node.classList.add('contains-folders');
                    }
                    else {
                        node.classList.remove('contains-folders');
                    }
                }
            }
            else {
                node = this.tree$tmpl.cloneNode(true);
                node.id = _li + curItemHandle;
                if (_tf) {
                    node.classList.add('tree-item-on-filter-hidden');
                }
                node = node.lastElementChild;
                if (!node) {
                    console.warn('Tree template error...', [node]);
                    continue;
                }
                node.id = _sub + curItemHandle;
                if (buildnode) {
                    node.classList.add('opened');
                }

                node = node.parentNode.firstElementChild;
                node.id = _a + curItemHandle;
                if (buildnode) {
                    node.classList.add('expanded');
                }
                if (containsc) {
                    node.classList.add('contains-folders');
                }
                if (M.currentdirid === curItemHandle) {
                    node.classList.add('opened');
                }
                if (folders[idx].t & M.IS_LINKED) {
                    node.classList.add('linked');
                }

                var titleTooltip = [];
                if (folders[idx].t & M.IS_TAKENDOWN) {
                    titleTooltip.push(l[7705]);
                }
                if (missingkeys[curItemHandle]) {
                    node.classList.add('undecryptable');
                    titleTooltip.push(M.getUndecryptedLabel(node));
                    name = l[8686];
                }
                if (titleTooltip.length) {
                    node.setAttribute('title', titleTooltip.map(escapeHTML).join("\n"));
                }

                if (folders[idx].lbl) {
                    var labelClass = M.getLabelClassFromId(folders[idx].lbl);

                    if (!labelClass) {
                        console.error('Invalid label %s for %s (%s)', folders[idx].lbl, curItemHandle, name);
                    }
                    else {
                        node.classList.add('labeled');
                        var nodeLabel = node.querySelector('.colour-label-ind');
                        nodeLabel.classList.add(labelClass);
                        nodeLabel.classList.remove('hidden');
                    }
                }
                node = node.querySelector('.nw-fm-tree-folder');

                if (folders[idx].s4 || M.tree.s4 && M.tree.s4[folders[idx].p]) {
                    node.className = 'nw-fm-tree-icon-wrap sprite-fm-mono icon-bucket-filled';
                }
                else if (folders[idx].su || Object(M.c.shares[curItemHandle]).su) {
                    node.classList.add('inbound-share');
                }
                else if (folders[idx].t & M.IS_SHARED) {
                    node.classList.add('shared-folder');
                }
                else if (mega.fileRequest.publicFolderExists(curItemHandle, true)) {
                    node.classList.add('file-request-folder');
                }
                else if (curItemHandle === M.CameraId) {
                    node.classList.add('camera-folder');
                }
                else if (curItemHandle === M.cf.h) {
                    node.classList.add('chat-folder');
                }
                node.textContent = name;
                html = node.parentNode.parentNode;

                if (folders[idx - 1] && (node = document.getElementById(_li + folders[idx - 1].h))) {
                    if (btd) {
                        console.debug('Buildtree, ' + curItemHandle + ' after ' + _li + folders[idx - 1].h, name);
                    }
                    $(node).after(html);
                }
                else {
                    node = document.getElementById(_sub + n.h);

                    if (idx === 0 && (i = node && node.querySelector('li:not(.s4-static-item)'))) {
                        if (btd) {
                            console.debug('Buildtree, ' + curItemHandle + ' before ' + _sub + n.h, name);
                        }
                        $(i).before(html);
                    }
                    else {
                        if (btd) {
                            console.debug('Buildtree, ' + curItemHandle + ' append ' + _sub + n.h, name);
                        }
                        $(node).append(html);
                    }
                }
            }

            if (_ts_l) {
                node = document.getElementById(_li + curItemHandle);
                if (node) {
                    if (_tf) {
                        node.classList.add('tree-item-on-filter-hidden');
                    }
                    else {
                        node.classList.remove('tree-item-on-filter-hidden');
                    }
                }
                if (name.toLowerCase().indexOf(_ts_l) === -1) {
                    if (node) {
                        node.classList.add('tree-item-on-search-hidden');
                    }
                }
                else {
                    $(document.getElementById(_a + curItemHandle))
                        .parents('li').removeClass('tree-item-on-search-hidden').each(expand)
                        .parents('ul').addClass('opened');
                }

                if (firstRun) {
                    sSubMap = this.getSearchedTreeHandles(curItemHandle, _ts_l);
                }

                buildnode = sSubMap[curItemHandle];
            }

            if (_tf && _tf[folders[idx].lbl]) {
                labelhash[curItemHandle] = true;
            }
            // need to add function for hide parent folder for color
            if (buildnode) {

                if (!_ts_l) {
                    sSubMap++;
                }

                M.buildtree(folders[idx], dialog, stype, sSubMap);
            }
        }// END of for folders loop

        for (var h in labelhash) {
            if (labelhash[h]) {
                $(document.querySelector('#' + _li + h)).removeClass('tree-item-on-filter-hidden')
                    .parents('li').removeClass('tree-item-on-filter-hidden');
            }
        }
    }

    if (btd) {
        console.groupEnd();
    }

    if (firstRun) {
        if (d) {
            console.timeEnd('buildtree');
        }

        if (_ts_l) {
            mBroadcaster.sendMessage('treesearch', _ts_l, stype);
        }
    }
};

/**
 * getSearchedTreeHandles
 *
 * Search tree of given handle and return object of subfolders that has name contains search terms,
 * Value of the result is shown how deep the subfolder is located from given parent node(handle).
 * this will return empty object if search result is empty.
 *
 * @param {String} [h] Parent node handle to starts search.
 * @param {String} [term] Search term.
 * @param {Number} [deepness] Internal use
 * @param {*} [res] internal
 * @returns {Object}
 */
MegaData.prototype.getSearchedTreeHandles = function(h, term, deepness, res) {
    "use strict";

    if (!deepness) {
        deepness = 1;
    }

    res = res || Object.create(null);

    if (!M.tree[h]) {
        return res;
    }

    if (deepness === 1) {
        term = term.toLowerCase();
    }

    const fHandles = Object.keys(M.tree[h]);

    for (let i = fHandles.length; i--;) {

        this.getSearchedTreeHandles(fHandles[i], term, deepness + 1, res);

        if (res[fHandles[i]] || String(M.tree[h][fHandles[i]].name).toLowerCase().includes(term)) {

            res[h] = deepness;
            res[fHandles[i]] = deepness + 1;
        }
    }

    return res;
};

MegaData.prototype.buildtree.FORCE_REBUILD = 34675890009;

MegaData.prototype.initTreePanelSorting = function() {
    "use strict";

    // Sorting sections for tree panels, dialogs, and per field.
    // XXX: do NOT change the order, add new entries at the tail, and ask before removing anything..
    const sections = [
        'folder-link', 'contacts', 'conversations', 'backups',
        'shared-with-me', 'cloud-drive', 'rubbish-bin',
        'out-shares', 'public-links', 's4'
    ];
    const byType = ['name', 'status', 'last-interaction', 'label', 'created', 'fav', 'ts', 'mtime'];
    const dialogs = ['Copy', 'Move', 'SelectFolder', 'SaveAs'];

    const bitmap = Object.create(null);
    this.sortTreePanel = Object.create(null);

    const store = () => {
        let res = '';
        const bitdef = Object.keys(bitmap);

        for (let i = 0; i < bitdef.length; i++) {
            const k = bitdef[i];
            const v = bitmap[k];
            const by = v.by;
            const dir = v.dir || 1;

            if (!by || by === v.byDefault && dir > 0) {
                // defaults, do not store.
                continue;
            }

            const b1 = String.fromCharCode(i);
            const b2 = String.fromCharCode(byType.indexOf(by) << 1 | (dir < 0 ? 1 : 0));

            res += b1 + b2;
        }

        mega.config.set('xtp', res.length ? res : undefined);
    };

    const validate = (p, va = ['by', 'dir']) => {
        assert(va.indexOf(p) !== -1, 'Invalid property, must be one of ' + va);
    };

    const handler = {
        get(target, prop) {
            validate(prop);

            if (Reflect.has(target, prop)) {
                return Reflect.get(target, prop);
            }
            return prop === 'by' ? target.byDefault : 1;
        },
        set(target, prop, value) {
            validate(prop);
            validate(value, prop === 'by' ? byType : [-1, 1]);

            if (Reflect.set(target, prop, value)) {
                delay('sortTreePanel:store', store, 1408);
                return true;
            }
        }
    };

    const setSortTreePanel = (type, byDefault, dialog) => {
        const key = (dialog || '') + type;

        bitmap[key] = Object.create(null);
        Object.defineProperty(bitmap[key], 'byDefault', {value: byDefault});
        Object.defineProperty(this.sortTreePanel, key, {value: new Proxy(bitmap[key], handler)});
    };

    for (let x = 0; x < sections.length; ++x) {
        const type = sections[x];
        const by = type === 'contacts' ? "status" : "name";

        setSortTreePanel(type, by);

        for (let y = 0; y < dialogs.length; ++y) {
            setSortTreePanel(type, by, dialogs[y]);
        }
    }
    Object.freeze(this.sortTreePanel);

    if (d) {
        console.info('xtp.bitmap', [bitmap]);
    }

    const xtp = mega.config.get('xtp');
    if (xtp) {
        const bitdef = Object.keys(bitmap);

        for (let i = 0; i < xtp.length; i += 2) {
            const b1 = xtp.charCodeAt(i);
            const b2 = xtp.charCodeAt(i + 1);
            const map = bitmap[bitdef[b1]];

            map.by = byType[b2 >> 1];
            map.dir = b2 & 1 ? -1 : 1;
        }
    }
};

var treesearch = false;

MegaData.prototype.treeSearchUI = function() {
    "use strict";

    $('.nw-fm-tree-header').off('click');
    $('.nw-fm-search-icon').off('click');
    $('.nw-fm-tree-header input').off('keyup').off('blur');

    // Items are NOT available in left panel and not result of search, hide search
    if (!$('.fm-tree-panel .content-panel.active').find('ul li, .nw-contact-item').length
        && !$('.nw-fm-tree-header').hasClass('filled-input')) {
        $('.nw-fm-tree-header input').prop('readonly', true);
        $('.nw-fm-search-icon').hide();
    }
    else { // There's items available

        // Left panel header click, show search input box
        $('.nw-fm-tree-header').rebind('click', function(e) {
            var $self = $(this);

            var targetClass = $(e.target).attr('class');
            var filledInput = $self.attr('class');
            var $input = $self.find('input');

            // If plus button is clicked
            if (targetClass && (targetClass.indexOf('button') > -1)) {
                return false;
            }
            // Search icon visible
            else if (targetClass && (targetClass.indexOf('nw-fm-search-icon') > -1)) {

                // Remove previous search text
                if (filledInput && (filledInput.indexOf('filled-input') > -1)) {
                    $self.removeClass('filled-input');
                }
            }
            else {
                $self.addClass('focused-input');
                $input.trigger("focus");
            }
        }); // END left panel header click

        // Make a search
        !M.chat && $('.nw-fm-search-icon').show().rebind('click', function() {
            var $self = $(this);
            var $input = $self.prev();

            if ($input.val() === '') {
                $input.trigger('focus');
            }
            else {
                treesearch = false;
                M.redrawTree();
                $input.val('');
                $input.trigger('blur').trigger('cleared');
            }
        });

        $('.nw-fm-tree-header input')
            .prop('readonly', false)
            .rebind('keyup', function(e) {
                var $self = $(this);
                var $parentElem = $self.parent();

                delay('treesearch:keyup', function() {
                    if (e.keyCode === 27) {
                        $parentElem.removeClass('filled-input');
                        $self.val('');
                        $self.trigger("blur");
                        treesearch = false;
                    }
                    else {
                        $parentElem.addClass('filled-input');
                        treesearch = $self.val();
                    }

                    if ($self.val() === '') {
                        $parentElem.removeClass('filled-input');
                    }
                    var force = treesearch ? false : true;
                    M.redrawTree(force);
                });
            })
            .rebind('blur', function() {
                var $self = $(this);

                if ($self.val() === '') {
                    $self.parent('.nw-fm-tree-header').removeClass('focused-input filled-input');
                }
                else {
                    $self.parent('.nw-fm-tree-header').removeClass('focused-input');
                }
            });
    }
};

MegaData.prototype.treeFilterUI = function() {
    /**
     * React on user input when new filtering criteria is picked
     */
    'use strict';

    $('.fm-left-panel .dropdown-colour-item').rebind('click', function() {
        var $self = $(this);
        var type = M.currentTreeType;

        if ($self.parents('.labels').hasClass("disabled")) {
            return false;
        }

        $self.toggleClass('active');

        var $selectedColors = $('.fm-left-panel .dropdown-colour-item.active');

        delete M.filterTreePanel[type + '-label'];
        if ($selectedColors.length > 0) {
            M.filterTreePanel[type + '-label'] = {};
            for (var i = 0; i < $selectedColors.length; i++) {
                var data = $($selectedColors[i]).data();
                M.filterTreePanel[type + '-label'][data.labelId] = {
                    id:data.labelId,
                    txt: M.getLabelClassFromId(data.labelId)
                };
            }
        }
        M.redrawTree();
    });

    /**
     * React on user click close on filter block
     */
    $('.fm-left-panel .filter-block.tree .close').rebind('click', function() {
        var type = M.currentTreeType;
        delete M.filterTreePanel[type + '-label'];
        M.redrawTree();
    });
};

MegaData.prototype.redrawTreeFilterUI = function() {
    'use strict';

    var fltIndicator = '<div class="colour-label-ind %1"></div>';
    var $filterBlock = $('.nw-tree-panel-filter-tag');
    var type = M.currentTreeType;

    $filterBlock.addClass('hidden').find('.content').empty();
    for (var i in M.filterTreePanel[type + '-label']){
        if (M.filterTreePanel[type + '-label'][i]){
            $filterBlock.removeClass('hidden');
            $filterBlock.find('.content')
                .append(fltIndicator.replace('%1', M.filterTreePanel[type + '-label'][i].txt));
        }
    }
};

MegaData.prototype.treeSortUI = function() {
    /**
     * Show/hide sort dialog in left panel
     */
    'use strict';

    $('.nw-tree-panel-arrows').rebind('click', function() {
        var $self = $(this);
        var menu;
        var type;
        var sortTreePanel;
        var $sortMenuItems;
        var dirClass;
        var sortMenuPos;

        // Show sort menu
        if (!$self.hasClass('active')) {
            $.hideContextMenu();

            $self.addClass('active');

            menu = $('.nw-sorting-menu');
            menu.removeClass('hidden');

            type = M.currentTreeType;

            if (type === 'settings') {
                type = M.lastActiveTab || 'cloud-drive';
            }

            $('.dropdown-item', menu).removeClass('hidden');
            $('hr', menu).removeClass('hidden');
            $('.dropdown-section.labels', menu).removeClass('hidden');
            $('.filter-by', menu).removeClass('hidden');

            if (type === 'shared-with-me') {
                menu.find('*[data-by=created]').addClass('hidden');
            }

            sortMenuPos = $self.offset().top - 9;

            if (sortMenuPos < 3) {
                sortMenuPos = 3;
                menu.find('.dropdown-dark-arrow').css({
                    'top': $self.offset().top - sortMenuPos + 1
                });
            }
            else {
                menu.find('.dropdown-dark-arrow').removeAttr('style');
            }

            menu.css({
                'top': sortMenuPos,
                'right': '-' + (menu.outerWidth() - 3) + 'px'
            });

            sortTreePanel = M.sortTreePanel[type === 'cloud-drive' && folderlink ? 'folder-link' : type];

            if (d && !sortTreePanel) {
                console.error('No sortTreePanel for "%s"', type);
            }

            $sortMenuItems = $('.dropdown-item', menu).removeClass('active');
            $('.sort-arrow', $sortMenuItems).removeClass('icon-up icon-down');

            if (sortTreePanel) {
                var $selectedItem = $sortMenuItems.filter('*[data-by="' + sortTreePanel.by + '"]');

                dirClass = sortTreePanel.dir === 1 ? 'icon-up' : 'icon-down';
                $selectedItem.addClass('active');
                $('.sort-arrow', $selectedItem).removeClass('icon-up icon-down').addClass(dirClass);
            }

            // reset and restore filter UI from previous actions.
            var filterTreePanel = M.filterTreePanel[type + '-label'];
            var $filterMenuItems = $('.dropdown-colour-item', menu);
            $filterMenuItems.noTransition(function() {
                $filterMenuItems.removeClass('active');
                if (filterTreePanel) {
                    $filterMenuItems
                        .filter(function() {
                            for (var i in filterTreePanel) {
                                if ($(this).data('labelTxt').toLowerCase() === filterTreePanel[i].txt) {
                                    return true;
                                }
                            }
                            return false;
                        })
                        .addClass('active');
                }
            });

            if (M.isLabelExistTree()) {
                // lbl is exist enable filter on DOM.
                menu.find('.dropdown-item-label').add('.fm-left-panel .filter-by .labels')
                    .removeClass('static disabled');
            }
            else {
                // lbl is not exist disable filter on DOM.
                menu.find('.dropdown-item-label').add('.fm-left-panel .filter-by .labels')
                    .addClass('static disabled');
            }

            return false; // Prevent bubbling
        }

        // Hide sort menu
        else {
            $self.removeClass('active');
            $('.nw-sorting-menu').addClass('hidden');
        }
    });

    /**
     * React on user input when new sorting criteria is picked
     */
    $('.fm-left-panel .dropdown-item').rebind('click', function() {
        var $self = $(this);
        var data = $self.data();
        var type = M.currentTreeType;

        if ($self.hasClass("static")) {
            return false;
        }

        if (type === 'settings') {
            type = M.lastActiveTab || 'cloud-drive';
        }

        if (type === 'cloud-drive' && folderlink) {
            // @todo should we rather fix M.currentTreeType / M.treePanelType() ?!
            type = 'folder-link';
        }

        if (M.sortTreePanel[type]) {
            $('.nw-sorting-menu').addClass('hidden');
            $('.nw-tree-panel-arrows').removeClass('active');

            if (data.by) {
                M.sortTreePanel[type].by = data.by;
            }
            if ($self.hasClass('active')) {// Change sort direction
                M.sortTreePanel[type].dir *= -1;
            }

            var fav = function(el) {
                return el.fav;
            };

            // Check is there a need for sorting at all
            if (data.by === 'fav') {
                if (!M.v.some(fav)) {
                    return false;
                }
            }
            else if (data.by === 'label') {
                if (!M.isLabelExistTree()) {
                    return false;
                }
            }

            M.redrawTree();
        }
    });
};

MegaData.prototype.treePanelType = function() {
    'use strict';

    let active = document.querySelector('.nw-fm-left-icon.active');

    return active ? active.attributes.name.value : 'unknown';
};

/**
 * redrawTree
 *
 * Re-creates tree DOM elements.
 * if f variable is true or undefined rebuild the tree.
 * if f variable is false, apply DOM update only;
 * @param {Boolean} f force rebuild.
 */

MegaData.prototype.redrawTree = function(f) {
    'use strict';

    $('li.tree-item-on-search-hidden').removeClass('tree-item-on-search-hidden');

    var force = M.buildtree.FORCE_REBUILD;
    if (f === false) {
        force = undefined;
    }

    if (M.currentrootid === M.RootID || String(M.currentdirid).match("^search/")) {
        M.buildtree(M.d[M.RootID], force);
    }
    /*
    else if (M.currentrootid === M.InboxID) {
        M.buildtree(M.d[M.InboxID], force);
    }
    */
    else if (M.currentrootid === M.RubbishID) {
        M.buildtree({h: M.RubbishID}, force);
    }
    else if (M.currentrootid === 'shares') {
        M.buildtree({h: 'shares'}, force);
    }
    else if (M.currentrootid === 'out-shares') {
        M.buildtree({h: 'out-shares'}, force);
    }
    else if (M.currentrootid === 'public-links') {
        M.buildtree({h: 'public-links'}, force);
    }

    M.addTreeUIDelayed(2);
    $('.nw-fm-tree-item').noTransition(function() {
        M.onTreeUIOpen(M.currentdirid, false);
    });
    // M.redrawTreeFilterUI();
};

/**
 * Check filter is available on current tree
 * @param {String} [handle] handle for what to check. if empty using currentrootid.
 * @returns boolean
 */
MegaData.prototype.checkFilterAvailable = function(handle) {
    "use strict";

    var t = this.tree;
    var result = false;
    handle = typeof handle === 'undefined' ? M.currentrootid : handle;

    $.each(t[handle], function(index, item) {
        if (item.lbl > 0) {
            result = true;
        }
        if (t[item.h] && M.checkFilterAvailable(item.h)) {
            result = true;
        }
    });
    return result;
};

/**
 * Check current viewing tree has label or not
 * @param {String} [handle] specify tree handle, if not check current tree
 * @returns boolean
 */
MegaData.prototype.isLabelExistTree = function(handle) {
    "use strict";

    handle = handle ? handle : M.currentrootid;
    var ct = M.tree[handle];

    if (handle === 'out-shares') {
        ct = M.getOutShareTree();
    }
    else if (handle === 'public-links') {
        ct = M.getPublicLinkTree();
    }

    for (var h in ct) {
        if (ct[h].lbl > 0 || (M.tree[h] && M.isLabelExistTree(h))) {
            return true;
        }
    }
    return false;
};

/**
 * Create tree of public-link's children. Same structure as M.tree
 * @return {Object}
 */
MegaData.prototype.getPublicLinkTree = function() {

    'use strict';

    var pltree = {};
    for (var h in M.su.EXP) {
        if (M.d[h].t) {
            pltree[h] = Object.assign({}, M.d[h]);
            pltree[h].t = this.getTreeValue(M.d[h]);
        }
    }
    return pltree;
};

/**
 * Create tree of out-share's children. Same structure as M.tree
 * @return {Object}
 */
MegaData.prototype.getOutShareTree = function() {

    'use strict';

    var ostree = {};
    for (var suh in M.su) {
        if (suh !== 'EXP') {
            for (var h in M.su[suh]) {
                if (M.d[h]) {
                    ostree[h] = Object.assign({}, M.d[h]);
                    ostree[h].t = this.getTreeValue(M.d[h]);
                }
            }
        }
    }
    return ostree;
};

/**
 * Get t value of custom view trees
 * @return {MegaNode} An ufs-node
 */
MegaData.prototype.getTreeValue = function(n) {

    'use strict';

    var t = n.t;
    if (n.fav) {
        t |= M.IS_FAV;
    }
    if (M.su.EXP && M.su.EXP[n.h]) {
        t |= M.IS_LINKED;
    }
    if (M.getNodeShareUsers(n, 'EXP').length || M.ps[n.h]) {
        t |= M.IS_SHARED;
    }
    if (M.getNodeShare(n).down === 1) {
        t |= M.IS_TAKENDOWN;
    }
    return t;
};

/**
 * Initializes tree panel
 */
MegaData.prototype.addTreeUI = function() {
    "use strict";

    if (d) {
        console.time('treeUI');
    }
    var $treePanel = $('.fm-tree-panel');
    var $treeItem = $(folderlink ? '.nw-fm-tree-item' : '.nw-fm-tree-item:visible', $treePanel);

    $treeItem.draggable(
        {
            revert: true,
            containment: 'document',
            revertDuration: 200,
            distance: 10,
            scroll: false,
            cursorAt: {right: 88, bottom: 58},
            helper: function(e, ui) {
                $(this).draggable("option", "containment", [72, 42, $(window).width(), $(window).height()]);
                return M.getDDhelper();
            },
            start: function(e, ui) {
                $.treeDragging = true;
                $.hideContextMenu(e);
                var html = '';
                var id = $(e.target).attr('id');
                if (id) {
                    id = id.replace(/treea_+|(os_|pl_)/g, '');
                }
                if (id && M.d[id]) {
                    html = ('<div class="tree-item-dragger nw-fm-tree-item">' +
                            '<span class="nw-fm-tree-folder ' + fileIcon(M.d[id]) + '"></span>' +
                            '<span class="item-name">' +
                                escapeHTML(M.d[id].name) + '</span>' +
                            '</div>'
                    );
                }
                $('#draghelper .dragger-icon').remove();
                $('#draghelper .dragger-content').html(html);
                $('body').addClass('dragging');
                $.draggerHeight = $('#draghelper .dragger-content').outerHeight();
                $.draggerWidth = $('#draghelper .dragger-content').outerWidth();
            },
            drag: function(e, ui) {
                //console.log('tree dragging',e);
                if (ui.position.top + $.draggerHeight - 28 > $(window).height()) {
                    ui.position.top = $(window).height() - $.draggerHeight + 26;
                }
                if (ui.position.left + $.draggerWidth - 58 > $(window).width()) {
                    ui.position.left = $(window).width() - $.draggerWidth + 56;
                }
            },
            stop: function(e, u) {
                $.treeDragging = false;
                $('body').removeClass('dragging').removeClassWith("dndc-");
            }
        });

    $(
        '.fm-tree-panel .nw-fm-tree-item,' +
        '.js-fm-left-panel .js-lpbtn.cloud-drive,' +
        '.js-fm-left-panel .js-lpbtn.s4,' +
        '.rubbish-bin,' +
        '.fm-breadcrumbs,' +
        '.nw-fm-left-icons-panel .nw-fm-left-icon,' +
        '.shared-with-me tr,' +
        '.nw-conversations-item,' +
        'ul.conversations-pane > li,' +
        '.messages-block'
    ).filter(":visible").droppable({
        tolerance: 'pointer',
        drop: function(e, ui) {
            $.doDD(e, ui, 'drop', 1);
        },
        over: function(e, ui) {
            $.doDD(e, ui, 'over', 1);
        },
        out: function(e, ui) {
            $.doDD(e, ui, 'out', 1);
        }
    });

    $treeItem.rebind('click.treeUI contextmenu.treeUI', function(e) {

        var $this = $(this);
        var id = $this.attr('id').replace('treea_', '');
        var tmpId = id;
        var cv = M.isCustomView(id);

        id = cv ? cv.nodeID : id;

        if (e.type === 'contextmenu') {
            $('.nw-fm-tree-item').removeClass('dragover');
            $this.addClass('dragover');

            var $uls = $this.parents('ul').find('.selected');

            if ($uls.length > 1) {
                $.selected = $uls.attrs('id')
                    .map(function(id) {
                        return id.replace(/treea_+|(os_|pl_)/g, '');
                    });
            }
            else {
                $.selected = [id];

                Soon(function() {
                    $this.addClass('hovered');
                });
            }
            return !!M.contextMenuUI(e, 1);
        }

        var $target = $(e.target);
        if ($target.hasClass('nw-fm-tree-arrow')) {
            M.onTreeUIExpand(tmpId);
        }
        else if (e.shiftKey) {
            $this.addClass('selected');
        }
        else {
            // plain click, remove all .selected from e.shiftKey
            $('#treesub_' + M.currentrootid + ' .nw-fm-tree-item').removeClass('selected');

            if ($target.hasClass('opened')) {
                M.onTreeUIExpand(tmpId);
            }
            if (e.ctrlKey) {
                $.ofShowNoFolders = true;
            }

            id = cv ? cv.prefixPath + id : id;

            if (M.dyh && cv && cv.type === 's4' && cv.subType !== 'container') {
                id = M.dyh('folder-id', id);
            }

            $.hideTopMenu();
            M.openFolder(id, e.ctrlKey)
                .then(() => {
                    // If the side Info panel is visible, update the information in it
                    if (!cv) {
                        mega.ui.mInfoPanel.reRenderIfVisible([id]);
                    }
                });
        }

        return false;
    });

    /**
     * Let's shoot two birds with a stone, when nodes are moved we need a resize
     * to let dynlist refresh - plus, we'll implicitly invoke initTreeScroll.
     */
    $(window).trigger('resize');

    if (d) {
        console.timeEnd('treeUI');
    }
};

/**
 * Invokes debounced tree panel initialization.
 */
MegaData.prototype.addTreeUIDelayed = function(ms) {
    'use strict';

    delay('treeUI', function() {
        M.addTreeUI();
    }, ms || 30);
};

/**
 * Handles expanding of tree panel elements.
 * @param {String} id An ufs-node's handle
 * @param {Boolean} [force]
 */
MegaData.prototype.onTreeUIExpand = function(id, force) {
    "use strict";

    this.buildtree({h: id});

    var $tree = $('#treea_' + id);

    if ($tree.hasClass('expanded') && !force) {
        fmtreenode(id, false);
        $('#treesub_' + id).removeClass('opened');
        $tree.removeClass('expanded');
    }
    else if ($tree.hasClass('contains-folders')) {
        fmtreenode(id, true);
        $('#treesub_' + id).addClass('opened')
            .find('.tree-item-on-search-hidden')
            .removeClass('tree-item-on-search-hidden');
        $tree.addClass('expanded');
    }

    M.addTreeUIDelayed();
};

/**
 * Handles opening of tree panel elemement.
 * @param {String} id An ufs-node's handle
 * @param {Object} [event] Event triggering action
 * @param {Boolean} [ignoreScroll] Whether scroll element into view.
 */
MegaData.prototype.onTreeUIOpen = function(id, event, ignoreScroll) {
    "use strict";

    id = String(id);
    const cv = M.isCustomView(id);
    var id_r = this.getNodeRoot(id);
    var id_s = id.split('/')[0];
    var target;
    var scrollTo = false;
    var stickToTop;
    if (d) {
        console.group('onTreeUIOpen', id, event, ignoreScroll);
        console.time('onTreeUIOpen');
    }

    if (id_r === 'shares') {
        this.onSectionUIOpen('shared-with-me');
    }
    else if (id_r === 's4' || cv && cv.type === 's4') {
        this.onSectionUIOpen('s4');
    }
    else if (cv) {
        this.onSectionUIOpen(id_r || id_s);
    }
    else if (this.InboxID && id_r === this.InboxID) {
        this.onSectionUIOpen('backups');
    }
    else if (id_r === this.RootID) {
        this.onSectionUIOpen('cloud-drive');
    }
    else if (id_s === 'chat') {
        this.onSectionUIOpen('conversations');
    }
    else if (id_s === 'user-management') {
        this.onSectionUIOpen('user-management');
    }
    else if (id_r === 'account') {
        this.onSectionUIOpen('account');
    }
    else if (id_r === 'dashboard') {
        this.onSectionUIOpen('dashboard');
    }
    else if (this.RubbishID && id_r === this.RubbishID) {
        this.onSectionUIOpen('rubbish-bin');
    }
    else if (id_s === 'transfers') {
        this.onSectionUIOpen('transfers');
    }
    else if (id_s === 'recents') {
        this.onSectionUIOpen('recents');
    }
    else if (M.isDynPage(id_s)) {
        this.onSectionUIOpen(id_s);
    }
    else if (M.isGalleryPage(id_s)) {
        this.onSectionUIOpen(id_s);
    }

    if (!fminitialized) {
        if (d) {
            console.groupEnd();
            console.timeEnd('onTreeUIOpen');
        }
        return false;
    }

    if (!event) {
        var ids = this.getPath(id);
        let i = ids.length;
        while (i-- > 1) {
            if (this.d[ids[i]] && ids[i].length === 8) {
                this.onTreeUIExpand(ids[i], 1);
            }
        }
        if (ids[0] === this.RootID) {
            this.onSectionUIOpen('cloud-drive');
        }
    }
    if ($.hideContextMenu) {
        $.hideContextMenu(event);
    }

    const elms = document.querySelectorAll('.fm-tree-panel .nw-fm-tree-item');
    for (let i = elms.length; i--;) {
        elms[i].classList.remove('selected', 'on-gallery');
    }

    if (cv) {
        target = document.querySelector(`#treea_${cv.prefixTree}${id.split('/')[1]}`);

        if (target && id.startsWith('discovery')) {
            target.classList.add('on-gallery');
        }

        if (cv.type === 's4') {
            let linkName = cv.containerID;

            if (cv.subType === 'bucket') {
                linkName =  cv.nodeID;
            }
            else if (['keys', 'policies', 'users', 'groups'].includes(cv.subType)) {
                linkName += `_${cv.subType}`;
            }

            target = document.getElementById(`treea_${linkName}`);
        }
    }
    else {
        target = document.getElementById(`treea_${id_s}`);
    }

    if (target) {
        target.classList.add('selected');
        if ((fmconfig.uiviewmode | 0) && fmconfig.viewmode === 2 ||
            typeof fmconfig.viewmodes !== 'undefined' && typeof fmconfig.viewmodes[id] !== 'undefined'
            && fmconfig.viewmodes[id] === 2) {
            target.classList.add('on-gallery');
        }
    }

    if (!ignoreScroll) {

        if (!folderlink && id === this.RootID) {
            stickToTop = false;
            scrollTo = document.querySelector('.js-clouddrive-btn');
        }
        else if (id === id_r || id === 'recents') {
            stickToTop = true;
            scrollTo = document.querySelector('.js-lpbtn.active');
        }
        else if (target) {
            scrollTo = target;
        }

        const ps = scrollTo && scrollTo.closest('.ps--active-y');
        let isVisible = true;

        if (ps) {
            const t = ps.scrollTop;
            const b = t + ps.offsetHeight;
            let et = scrollTo.offsetTop;

            if (!scrollTo.classList.contains('js-lpbtn')) {

                let p = scrollTo.parentElement;

                while (p && !p.classList.contains('fm-tree-panel')) {

                    if (p.tagName === 'LI') {
                        et += p.offsetTop;
                    }

                    p = p.parentElement;
                }
            }

            const eb = et + scrollTo.offsetHeight;

            stickToTop = stickToTop === undefined ? et < t : stickToTop;
            isVisible = eb <= b && et >= t;
        }

        if (ps && !isVisible) {
            setTimeout(function() {
                scrollTo.scrollIntoView(stickToTop);
            }, 50);
        }
    }

    this.addTreeUIDelayed();

    if (d) {
        console.timeEnd('onTreeUIOpen');
        console.groupEnd();
    }
};

MegaData.prototype.reset = function() {
    'use strict';

    this.v = [];
    this.d = Object.create(null);
    this.c = Object.create(null);
    this.h = Object.create(null);
    this.t = Object.create(null);
    this.su = Object.create(null);
    this.ps = Object.create(null);
    this.opc = Object.create(null);
    this.ipc = Object.create(null);
    this.tree = Object.create(null);
    this.c.shares = Object.create(null);
    this.c.contacts = Object.create(null);
    this.cfInflightR = Object.create(null);
    this.filterLabel = Object.create(null);
    this.filterTreePanel = Object.create(null);

    // M.d & M.c for chat
    this.chd = Object.create(null);
    this.chc = Object.create(null);

    this.suba = Object.create(null);
    if (typeof MegaDataMap !== 'undefined') {
        this.u = new MegaDataMap();
    }

    this.nn = false;
    this.sn = false;
    this.cf = false;
    this.filter = false;
    this.sortfn = false;
    this.sortd = false;
    this.rendered = false;
    this.RootID = undefined;
    this.RubbishID = undefined;
    this.InboxID = undefined;
    this.viewmode = 0; // 0 list view, 1 block view
    this.currentdirid = false;
    this.currentrootid = false;
    this.currentCustomView = false;
    this.recentsRender = null;

    var tree$tmpl = document.getElementById('template-tree-item');
    this.tree$tmpl = tree$tmpl && tree$tmpl.firstElementChild.cloneNode(true) || document.createElement('li');

    mBroadcaster.sendMessage("MegaDataReset");

    return this;
};

Object.freeze(MegaData.prototype);

var megasync = (function() {

    var ns = {};


    var megasyncUrl = '';
    var httpMegasyncUrl = "http://127.0.0.1:6341/";
    var ShttpMegasyncUrl = "https://localhost.megasyncloopback.mega.nz:6342/";
    var enabled = false;
    var version = 0;
    var lastDownload;
    var queuedCounter = 0; // a counter to count how many times we got [queued] status from MEGAsync
    var unknownCounter = 0; // a counter to count how many times we got [res=0] status from MEGAsync
    var canceledCounter = 0; // a counter to count how many times we got [res=7] status from MEGAsync
    var currStatus = l[17794]; // 'Initializing'; // download status from MEGAsync
    var lastCheckTime;
    var lastCheckStatus;
    var defaultStatusThreshold = 15 * 60000; // 15 minutes
    var statusThresholdWhenDifferentUsr = 30000; // 0.5 minutes
    var defaultStatusThresholdForFailed = 15000; // 15 sec
    var currBid = -1;
    function getNewBid() {
        currBid = Math.random().toString().substr(2);
        return currBid;
    }
    var retryTimer;
    var clients = {
        windows: 'https://127.0.0.1/MEGAsyncSetup64.exe',
        windows_x32: 'https://127.0.0.1/MEGAsyncSetup32.exe',
        mac: 'https://127.0.0.1/MEGAsyncSetup.dmg',
        mac_silicon: 'https://127.0.0.1/MEGAsyncSetupArm64.dmg',
        linux: "https://mega.io/desktop"
    };
    var usemsync = localStorage.usemsync;

    let userOS;

    /** a function to switch the url to communicate with MEGASync */
    function switchMegasyncUrlToHttpWhenPossible() {

        if (!ua || !ua.details || !ua.details.browser || !ua.details.version) {
            return ShttpMegasyncUrl;
        }

        if (ua.details.browser === 'Internet Explorer'
            || ua.details.browser === 'Safari'
            || ua.details.browser === 'Edge') {
            return ShttpMegasyncUrl;
        }
        else if (ua.details.browser === 'Chrome') {
            if (parseInt(ua.details.version) >= 30) {
                return httpMegasyncUrl;
            }
            else {
                return ShttpMegasyncUrl;
            }
        }
        else if (ua.details.browser === 'Firefox') {
            if (parseInt(ua.details.version) >= 55) {
                return httpMegasyncUrl;
            }
            else {
                return ShttpMegasyncUrl;
            }
        }
        else if (ua.details.browser === 'Opera') {
            if (parseInt(ua.details.version) >= 28) {
                return httpMegasyncUrl;
            }
            else {
                return ShttpMegasyncUrl;
            }
        }
        else if (ua.details.browser === 'Edgium') {
            return httpMegasyncUrl;
        }
        else {
            return httpMegasyncUrl;
        }

    }

    /**
     * The user attempted to download the current file using
     * MEGASync *but* they don't have it running (and most likely not installed)
     * show we show them a dialog for and we attempt to download the client.
     *
     * If the user has Linux we close the dialog and open a new window at https://mega.io/desktop.
     *
     * @return {void}
     */
    function showDownloadDialog() {

        if (!lastDownload){
            // An error happened but did not try to download
            // so we can discard this error
            return;
        }
        var $overlay = $('.megasync-overlay');
        var url = ns.getMegaSyncUrl();
        if ($overlay.hasClass('downloading')) {
            return true;
        }
        const os = userOS || ns.getUserOS();
        if (os === 'linux') {
            window.open(ns.getMegaSyncUrl(os), '_blank', 'noopener,noreferrer');
            return;
        }

        retryTimer = setInterval(function() {

            // The user closed our modal, so we stop checking if the
            // user has MEGASync running
            if ($('.megasync-overlay:visible').length === 0) {
                lastDownload = null;
                return clearInterval(retryTimer);
            }
            SyncAPI({a: "v"});
        }, 1000);

        $overlay.removeClass('hidden').addClass('downloading');
        $('body').addClass('overlayed');

        $('.megasync-close, .megasync-close-txt', $overlay).rebind('click', function(e) {
            $overlay.addClass('hidden').removeClass('downloading');
            $('body').removeClass('overlayed');
            $('body').off('keyup.msd');
            lastDownload = null;
            return clearInterval(retryTimer);
        });

        $('body').rebind('keyup.sdd', function(e) {
            if (e.keyCode === 27) {
                $overlay.addClass('hidden');
                $('body').removeClass('overlayed');
                lastDownload = null;
                return clearInterval(retryTimer);
            }
        });

        window.location = url;
    }

    // API Related things {{{
    var handler = {
        v: function(version) {

            enabled = true;
            version = version;
            if (lastDownload) {
                ns.download(lastDownload[0], lastDownload[1]);
                lastDownload = null;
            }
        },
        error: function(next, ev, closeFlag) {
            enabled = false;
            next = (typeof next === "function") ? next : function() {};
            if (closeFlag) {
                megaSyncIsNotResponding(next.bind(this, ev || new Error("Internal error")));
            }
            else {
                next(ev || new Error("Internal error"));
                megaSyncIsNotResponding();
            }
        }
    };

    function megaSyncIsNotResponding(nextIfYes) {
        if (lastCheckStatus && lastCheckTime) {
            api_req({ a: 'log', e: 99800, m: 'MEGASync is not responding' });
            msgDialog(
                'confirmation',
                'MEGA Desktop App is not responding',
                l[17795],
                l[17796],
                function(disableMsync) {
                    if (disableMsync) {
                        lastCheckStatus = null;
                        lastCheckTime = null;
                        ns.periodicCheck();
                        if (nextIfYes && typeof nextIfYes === 'function') {
                            nextIfYes();
                        }
                    }
                    else if (page === "download") {
                        setTransferStatus(0, l[17795]);
                    }
                }
            );
        }
        else {
            showDownloadDialog();
        }
    }

    /**
     * Perform an http request to the running MEGAsync instance.
     *
     * @param {Object}   args    parameters to send.
     * @param {Function} resolve on promise's resolve (Optional)
     * @param {Function} reject  on promise's reject (Optional)
     * @return {MegaPromise}
     */
    function megaSyncRequest(args, resolve, reject) {
        // var timeout = (args.a === 'v') ? 250 : 0;
        var timeout = 0;
        try {
            args = JSON.stringify(args);
        }
        catch (ex) {
            if (typeof reject === 'function') {
                reject(ex);
            }
            return MegaPromise.reject(ex);
        }

        if (!megasyncUrl) {
            megasyncUrl = switchMegasyncUrlToHttpWhenPossible();
        }

        if (megasyncUrl === ShttpMegasyncUrl) {
            // not supported any more.
            const errMsg = 'Browser doesn\'t support Mega Desktop integration';
            if (typeof reject === 'function') {
                reject(errMsg);
            }
            return MegaPromise.reject(errMsg);
        }

        var promise = M.xhr({
            url: megasyncUrl,
            data: args,
            type: 'json'  ,
            timeout: timeout // fasten the no-response cases
        });

        if (typeof resolve === 'function') {
            promise.done(function() {
                try {
                    resolve.apply(null, arguments);
                }
                catch (ex) {
                    if (typeof reject === 'function') {
                        reject(ex);
                    }
                    else {
                        throw ex;
                    }
                }
            });
        }

        if (typeof reject === 'function') {
            promise.fail(reject);
        }

        return promise;
    }

    function SyncAPI(args, next, closeFlag) {

        megaSyncRequest(args, function(ev, response) {
            api_handle(next, response, args);
        }, function(ev) {
            if (args && args.a === 'v') {
                lastCheckStatus = 0;
                lastCheckTime = Date.now();
            }
            handler.error(next, ev, closeFlag);
        });
    }

    function api_handle(next, response, requestArgs) {
        "use strict";
        var $topBar;
        next = (typeof next === "function") ? next : function () { };
        var _uploadTick = function _upTick() {
            if (currBid === requestArgs.bid) {
                megasync.uploadStatus(requestArgs.bid);
            }
        };
        var _statusTick = function _stTick() {
            megasync.downloadStatus(requestArgs.h);
        };

        if (response === 0) {
            if (requestArgs.a === "l" ) {
                if (page === "download") {
                    // Download added to MEGAsync
                    showToast('megasync-transfer', l[8635], l[865], null, ns.transferManager);
                    currStatus = l[17794]; // 'Initializing';
                    queuedCounter = 0;
                    unknownCounter = 0;
                    canceledCounter = 0;
                    return megasync.downloadStatus(requestArgs.h);
                }
                else {
                    showToast('megasync-transfer upload',
                        // 'Download sent to MEGASync',
                        l[17797],
                        l[865], l[823], ns.transferManager,
                        function () { loadSubPage('fm/account/transfers'); }); // Download added to MEGAsync
                }
            }
            else if (requestArgs.a === "ufi" || requestArgs.a === "ufo") { // is upload file MEGAsync request
                return _uploadTick();
            }
            else if (requestArgs.a === "sp") {
                return next(null, response);
            }
            else if (requestArgs.a === "s") {
                return next(null, response);
            }
        }
        else if (requestArgs.a === "sp" && $.isNumeric(response)) {
            return next(null, response);
        }
        else if (typeof response !== "object") {
            lastDownload = null;
            return handler.error(next);
        }
        else {
            if (requestArgs.a === "t") { // is get status request

                if (d > 1) {
                    console.info("status: " + response.s + " progress: " + response.p + "  total: " + response.t
                        + "  speed: " + response.v);
                }

                if (response.s && response.s == 2) { // allow implied convert
                    // this means we are in status [STATE_ACTIVE = 2] which is not final
                    // then send a new update status request after a 1 sec
                    var prec = (response.p * 100) / response.t;
                    dlprogress(requestArgs.h, prec.toPrecision(3), response.p, response.t, response.v);
                    if (currStatus !== l[17592]) { // 'Downloading with MEGAsync .'
                        currStatus = l[17592]; // 'Downloading with MEGAsync .'
                        $topBar = $('.download.download-page').removeClass('paused');
                        $('.download.eta-block .light-txt', $topBar).text(currStatus);
                    }
                    setTimeout(_statusTick, 1000);
                }
                else if (response.s && response.s == 1) { // allow implied convert
                    // STATE_QUEUED = 1
                    // we will wait for 2 sec x 2 times.
                    // then if we found that this is queued down in a list in megaSync then we update UI
                    // and stop fetching status.
                    if (queuedCounter++ < 2) {
                        setTimeout(_statusTick, 2000);
                    }
                    else if (currStatus !== l[17593]) {
                        $('.download.progress-bar').width('100%');
                        $('.download.download-page').removeClass('downloading').addClass('download-complete');
                        currStatus = l[17593];
                        $topBar = $('.download.download-page');
                        $('.download.eta-block .light-txt', $topBar).text(currStatus);
                    }
                }
                else if (response.s && response.s == 0) { // allow implied convert
                    // unknow STATE
                    // we will wait for 5 sec x 10 times.
                    // then if we kept getting this Res, we update UI and stop fetching status.
                    if (unknownCounter++ < 10) {
                        setTimeout(_statusTick, 5000);
                    }
                    else {
                        setTransferStatus(0, l[17591]);
                    }
                }
                else if (response.s && response.s == 6) { // allow implied convert
                    // STATE_COMPLETED = 6
                    dlprogress(-0xbadf, 100, response.t, response.t);
                    $('.download.download-page').removeClass('paused');
                    $('.download.progress-bar').width('100%');
                    $('.download.download-page').removeClass('downloading').addClass('download-complete');
                    var $pageScrollBlock = $('.bottom-page.scroll-block');
                    $pageScrollBlock.addClass('resumable');
                    if (window.dlpage_ph) {
                        $('.open-in-folder').removeClass('hidden').rebind('click', function() {
                            ns.megaSyncRequest({a: 'sf', h: dlpage_ph}).dump();
                            return false;
                        });
                    }
                }
                else if (response.s && response.s == 7) {
                    setTransferStatus(0, l[17586]);
                    // give it one more try, since if user opened the a file link to download and this file
                    // is already getting downloaded, then the first response is 7 then it's OK
                    // because MEGAsync means that the new download is canceled.
                    if (canceledCounter++ < 1) {
                        setTimeout(_statusTick, 1000);
                    }
                }
                else if (response.s && response.s == 3) { // allow implied convert
                    // this means we are in status [STATE_PAUSED = 3] which is not final (PAUSED)
                    // then send a new update status request after longer timeout 3 sec
                    if (currStatus !== l[17594]) {
                        currStatus = l[17594];
                        $topBar = $('.download.download-page').addClass('paused');
                        $('.download.eta-block .light-txt', $topBar).text(currStatus);
                    }
                    setTimeout(_statusTick, 3000);
                }
                else if (response.s && response.s == 4) { // allow implied convert
                    // this means we are in status [STATE_RETRYING = 4] which is not final (retry)
                    // then send a new update status request after longer timeout 3 sec
                    if (currStatus !== l[17603]) {
                        currStatus = l[17603];
                        $topBar = $('.download.download-page').addClass('paused');
                        $('.download.eta-block .light-txt', $topBar).text(currStatus);
                    }
                    setTimeout(_statusTick, 3000);
                }
                else if (response.s && response.s == 5) { // allow implied convert
                    // this means we are in status [STATE_COMPLETING = 5] which is not final
                    // then send a new update status request
                    if (currStatus !== l[17604]) {
                        currStatus = l[17604];
                        $topBar = $('.download.download-page').addClass('paused');
                        $('.download.eta-block .light-txt', $topBar).text(currStatus);
                    }
                    setTimeout(_statusTick, 1000);
                }
                else if (response.s && response.s == 8) { // allow implied convert
                    // this means we are in status [STATE_FAILED = 8] which is final
                    // then stop
                    setTransferStatus(0, l[17605]);
                }
                else {
                    // no response !! ,or value out of range [0,8]
                    // we will wait for 5 sec x 10 times.
                    // then if we kept getting this Res, we update UI and stop fetching status.
                    if (unknownCounter++ < 10) {
                        setTimeout(_statusTick, 5000);
                    }
                    else {
                        setTransferStatus(0, l[17606]);
                    }
                }
            }
            else if (requestArgs.a === "v") { // is get version MEGAsync request
                 if (response.u) {
                    ns.currUser = response.u;
                }
                 lastCheckStatus = response;
                 lastCheckTime = Date.now();
            }
            else if (requestArgs.a === "uss") { // is get upload status MEGAsync request
                var response = (response.length) ? response[0] : response;
                if (response.s && response.s == 1) { // selection done
                    var toastTxt = '';
                    var folderP = 0;
                    if (response.fo) {
                        toastTxt = `${mega.icu.format(l.folder_trans_manager, response.fo)}
                         \u00A0${l.total_files_trans_manager.replace('%1', response.fi)}`;
                        }
                        else {
                        toastTxt = mega.icu.format(l[17883], response.fi);
                    }

                    showToast('megasync-transfer upload', toastTxt, l[865], l[823],
                        ns.transferManager,
                        function () { loadSubPage('fm/account/transfers'); }); // Upload added toMEGAsync
                }
                else if (response.s == 0) { // selection not done yet
                    setTimeout(_uploadTick, 2000);
                }
            }

        }
        return next(null, response);
    }

    ns.getUserOS = () => {
        const pf = navigator.platform.toUpperCase();
        if (pf.includes('MAC')) {
            os = "mac";
        }
        else if (pf.includes('LINUX')) {
            os = 'linux';
        }
        else {
            os = "windows";
        }
        userOS = os;
        return os;
    };

    /**
     * Return the most likely Sync Client URL
     * for the current client. This method check the user's
     * Operating System and return the candidates URL.
     *
     * @return {Array}
     */
    ns.getMegaSyncUrl = function(os) {
        os = userOS || ns.getUserOS();
        return clients[os] ||  clients['windows'];
    };

    /**
     * Talk to MEGASync client and tell it to download
     * the following file
     *
     * @param {String} pubKey      Public Key (of the file)
     * @param {String} privKey     Private Key of the file
     *
     * @return {Boolean} Always return true
     */
    ns.download = function(pubKey, privKey, next, closeFlag) {
        lastDownload = [pubKey, privKey];
        SyncAPI({a: "l", h: pubKey, k: privKey}, next, closeFlag);
        return true;
    };

    ns.isInstalled = function (next) {
        if ((!fmconfig.dlThroughMEGAsync && page !== "download" && page !== 'fm/account/transfers' && !folderlink)
            || (!is_livesite && !usemsync)) {
            next(true, false, true); // next with error=true and isworking=false, off=true
        }
        else if (!lastCheckStatus || !lastCheckTime) {
            if (lastCheckTime) {
                var tDif = Date.now() - lastCheckTime;
                if (tDif >= defaultStatusThresholdForFailed) {
                    SyncAPI({ a: "v" }, next);
                }
                else {
                    next(true, lastCheckStatus);
                }
            }
            else {
                SyncAPI({ a: "v" }, next);
            }
        }
        else {
            var myNow = Date.now();
            var diff = myNow - lastCheckTime;
            if (diff >= defaultStatusThreshold) {
                SyncAPI({ a: "v" }, next);
            }
            else {
                // we found before that MEGAsync is working but with a different logged-in users.

                if (lastCheckStatus && (!ns.currUser || ns.currUser !== u_handle)
                    && diff >= statusThresholdWhenDifferentUsr) {
                    SyncAPI({ a: "v" }, next);
                }
                else if (typeof next === "function") {
                    next(null, lastCheckStatus);
                }
            }

        }
    };

    ns.uploadFile = function (handle, next) {
        SyncAPI({ a: "ufi", h: handle, bid: getNewBid() }, next);
    };

	ns.uploadFolder = function(handle,next) {
        SyncAPI({ a: "ufo", h: handle, bid: getNewBid() }, next);
    };

	ns.syncFolder = function(handle,next) {
        SyncAPI({a: "s",h:handle}, next);
    };
    ns.syncPossible = function (handle, next) {
        SyncAPI({ a: "sp", h: handle }, next);
    };
    ns.syncPossibleA = function(handle) {
        return new Promise((resolve) => {
            SyncAPI({ a: "sp", h: handle }, (error, response) => resolve({error, response}));
        });
    };

	ns.downloadStatus = function(handle,next) {
        SyncAPI({"a":"t","h":handle}, next);
    };
    ns.uploadStatus = function (bid, next) {
        SyncAPI({ a: "uss", bid: bid }, next);
    };
    ns.transferManager = function (next) {
        SyncAPI({ a: "tm", t: 0 }, next);
    };

    ns.megaSyncRequest = megaSyncRequest;
    ns.megaSyncIsNotResponding = megaSyncIsNotResponding;

    var periodicCheckTimeout;

    ns.periodicCheck = function() {
        if (periodicCheckTimeout) {
            clearTimeout(periodicCheckTimeout);
        }
        ns.isInstalled(function(err, is, off) {
            if (!err || is) {
                if (megasync.currUser === u_handle) {
                    window.useMegaSync = 2;
                    periodicCheckTimeout = setTimeout(ns.periodicCheck, defaultStatusThreshold);
                }
                else {
                    window.useMegaSync = 3;
                    periodicCheckTimeout = setTimeout(ns.periodicCheck, statusThresholdWhenDifferentUsr);
                }
            }
            else {
                window.useMegaSync = 4;
                if (off) {
                    return;
                }
                periodicCheckTimeout = setTimeout(ns.periodicCheck, statusThresholdWhenDifferentUsr);
            }
        });
    };
    if ((is_livesite && !is_mobile) || usemsync) {
        mBroadcaster.once('fm:initialized', ns.periodicCheck);
    }
    else {
        ns.periodicCheck = function() { };
    }

    return ns;
})();

/**
 * Helper tool based on html/js/download.js & crypto.js to retrieve meta data for a specific node (file or folder link)
 * For direct parsing and handling of links, please see: LinkInfoHelper.extractMegaLinksFromString
 *
 * @param node_handle {String}
 * @param node_key {String}
 * @param is_dir {Boolean}
 * @param [is_chatlink] {Boolean}
 * @param [is_contactlink] {Boolean}
 * @param [url] {String}
 * @constructor
 */
var LinkInfoHelper = function(node_handle, node_key, is_dir, is_chatlink, is_contactlink, url) {
    "use strict";
    this.node_handle = node_handle;
    this.node_key = node_key;
    this.is_dir = is_dir;
    this.is_chatlink = is_chatlink;
    this.is_contactlink = is_contactlink;
    this._url = url;
    this.info = Object.create(null);
};

LinkInfoHelper._CACHE = {};

/** @property LinkInfoHelper.MEGA_LINKS_REGEXP_COMPILED */
lazy(LinkInfoHelper, 'MEGA_LINKS_REGEXP_COMPILED', () => {
    'use strict';
    const res = [];
    const MEGA_LINKS_REGEXP = [
        "\\b(?:mega\\.co\\.nz|mega\\.nz)/(C!)([\\w#-]+)",
        "\\b(?:mega\\.co\\.nz|mega\\.nz)/#(!|F!)([\\w!-]+)",
        "\\b(?:mega\\.co\\.nz|mega\\.nz)/(chat)/([\\w#-]+)",
        "\\b(?:mega\\.co\\.nz|mega\\.nz)/(file|folder)/([\\w#-]+)",
    ];

    for (let i = 0; i < MEGA_LINKS_REGEXP.length; ++i) {
        let rex = MEGA_LINKS_REGEXP[i];

        if (d && !is_livesite) {
            rex = rex.replace('|mega\\.nz', `|mega\\.nz|${location.host.replace(/(\W)/g, '\\$1')}`);
        }

        res.push(new RegExp(rex, "gmi"));
    }
    return res;
});

/**
 * Returns true/false if the passed URL is a valid mega link
 *
 * @param url
 * @returns {Boolean}
 */
LinkInfoHelper.isMegaLink = function(url) {
    "use strict";
    if (!url || !url.match) {
        return false;
    }

    for (let i = LinkInfoHelper.MEGA_LINKS_REGEXP_COMPILED.length; i--;) {
        if (url.match(LinkInfoHelper.MEGA_LINKS_REGEXP_COMPILED[i])) {
            return true;
        }
    }
};

/**
 * Returns an array of LinkInfoHelpers (in-memory - per url cached) that can be accessed to retrieve link info
 *
 * @param s {String} any string that may contain MEGA URLs
 * @returns {Array}
 */
LinkInfoHelper.extractMegaLinksFromString = function(s) {
    "use strict";
    var found = [];

    if (s.substr) {
        let m;
        for (let i = LinkInfoHelper.MEGA_LINKS_REGEXP_COMPILED.length; i--;) {
            const regExp = LinkInfoHelper.MEGA_LINKS_REGEXP_COMPILED[i];

            while ((m = regExp.exec(s)) !== null) {
                // This is necessary to avoid infinite loops with zero-width matches
                if (m.index === regExp.lastIndex) {
                    regExp.lastIndex++;
                }
                const [, type, data] = m;

                if (type === "F!" || type === "!" || type === "file" || type === "folder") {
                    const is_dir = type === "F!" || type === 'folder';
                    const [handle, key] = data.split(/[^\w-]/);
                    const cacheKey = `${handle}:${key}`;

                    if (!LinkInfoHelper._CACHE[cacheKey]) {
                        LinkInfoHelper._CACHE[cacheKey] = new LinkInfoHelper(handle, key, is_dir, false, false, m[0]);
                    }

                    found.push(
                        LinkInfoHelper._CACHE[cacheKey]
                    );
                }
                else if (type === "chat") {
                    // is chat
                    const [chatHandle, chatKey] = data.split(/[^\w-]/);
                    const chatCacheKey = `${chatHandle}:${chatKey}`;

                    if (!LinkInfoHelper._CACHE[chatCacheKey]) {
                        LinkInfoHelper._CACHE[chatCacheKey] = new LinkInfoHelper(chatHandle, chatKey, false, true);
                    }

                    found.push(
                        LinkInfoHelper._CACHE[chatCacheKey]
                    );
                }
                else if (type === "C!") {
                    // is chat
                    const contactHash = data;
                    const contactHashKey = `C!${contactHash}`;

                    if (!LinkInfoHelper._CACHE[contactHashKey]) {
                        LinkInfoHelper._CACHE[contactHashKey] = new LinkInfoHelper(
                            contactHash,
                            undefined,
                            false,
                            false,
                            true
                        );
                    }

                    found.push(
                        LinkInfoHelper._CACHE[contactHashKey]
                    );
                }
                else if (d) {
                    console.warn('Unhandled link...', m);
                }
            }
        }
    }
    return found;
};

/**
 * Tells whether the data for this link has been retrieved.
 */
LinkInfoHelper.prototype.isDataAvailable = function() {
    'use strict';

    if (this.failed) {
        return -1;
    }

    if (this.is_contactlink) {
        return !!this.info.e;
    }

    if (this.is_chatlink) {
        return !!this.info.ct;
    }

    // public file/folder-link
    return !!this.info.at;
};

/**
 * Retrieve info for the current link
 *
 * @returns {MegaPromise}
 */
LinkInfoHelper.prototype.retrieve = async function() {
    "use strict";

    if (this._promise || this.failed || this.info.at || this.info.ct) {
        return this._promise;
    }
    const key = base64_to_a32(String(this.node_key).trim()).slice(0, 8);

    const fail = (ex) => {
        this.failed = ex || true;
    };
    const ready = () => {
        this._loaded = true;
    };

    if (this.is_chatlink) {
        if (window.is_chatlink && is_chatlink.pnh === this.node_handle) {
            this.info.ncm = is_chatlink.ncm;
            this.info.ct = is_chatlink.ct;
            this._promise = Promise.resolve();
            return ready();
        }

        this._promise = api.send({a: 'mcphurl', v: Chatd.VERSION, ph: this.node_handle})
            .then((res) => {
                this.info.ncm = res.ncm;
                this.info.ct = res.ct;
                this.info.mr = res.mr;
            })
            .catch(fail)
            .finally(ready);
    }
    else if (this.is_contactlink) {
        this._promise = api.send({a: 'clg', 'cl': this.node_handle})
            .then((res) => {
                this.info.e = res.e;
                this.info.fn = res.fn;
                this.info.ln = res.ln;
                this.info.h = res.h;
            })
            .catch(fail)
            .finally(ready);
    }
    else if (this.is_dir) {
        // dir handling
        this._promise = api.send({a: 'pli', ph: this.node_handle})
            .then((res) => {
                this.info.s = res.s;
                this.info.user = res.u;
                this.info.at = res.attrs;
                this.info.size = res.s[0];
                this.info.name = 'unknown';
                this.info.dirs_count = res.s[2];
                this.info.files_count = res.s[1];

                if (res.k && res.k.split) {
                    this.info.rid = res.k.split(":")[0];
                    this.info.k = base64_to_a32(String(res.k.split(":")[1]).trim()).slice(0, 8);
                }
                if (this.info.k) {
                    const decr_meta = tryCatch(() => {
                        const actual_key = decrypt_key(new sjcl.cipher.aes(key), this.info.k);
                        return dec_attr(base64_to_ab(this.info.at), actual_key);
                    }, false)();

                    if (decr_meta) {
                        this.info.name = decr_meta.n && M.getSafeName(decr_meta.n) || this.info.name;
                    }
                }
            })
            .catch(fail)
            .finally(ready);
    }
    else {
        this._promise = api.send({a: 'g', p: this.node_handle})
            .then((res) => {
                this.info.k = key;
                this.info.at = res.at;
                this.info.fa = res.fa;
                this.info.size = res.s;
                this.info.name = 'unknown';

                const meta = dec_attr(base64_to_ab(this.info.at), key);
                if (meta.n) {
                    const name = meta.n && M.getSafeName(meta.n) || this.info.name;
                    this.info.name = name;
                    this.info.icon = fileIcon({name});
                }
            })
            .catch(fail)
            .finally(ready);
    }

    return this._promise;
};

/**
 * Like retrieve, but internally would call .retrieve IF needed. Please use this as the main way of accessing/getting
 * link info
 *
 * @returns {MegaPromise}
 */
LinkInfoHelper.prototype.getInfo = async function() {
    "use strict";

    if (!this.isDataAvailable()) {
        await this.retrieve()
            .catch((ex) => {
                this.failed = ex || this.failed || true;
            });
    }

    if (this.failed) {
        if (d) {
            console.warn('LinkInfoHelper data retrieval failed.', this.failed, [this]);
        }
    }
    else if (this.is_chatlink) {
        if (this.info.topic === undefined && this.node_key) {
            const fakeRoom = {
                'ct': this.info.ct,
                'publicChatHandle': this.node_handle,
                'chatId': `fakeChat#${this.node_handle}`
            };

            const ph = new strongvelope.ProtocolHandler(null, null, null, null, strongvelope.CHAT_MODE.PUBLIC);
            ph.chatRoom = fakeRoom;
            ph.unifiedKey = base64urldecode(this.node_key);

            fakeRoom.protocolHandler = ph;
            await megaChat.plugins.chatdIntegration.decryptTopic(fakeRoom).catch(dump);
            this.info.topic = fakeRoom.topic || '';
        }
        else if (!this.info.topic) {
            this.info.topic = '';
        }
    }
    else if (!this.is_dir && this.info.at) {
        this.info.h = this.node_handle;
        const n = new MegaNode(this.info);
        const v = is_video(n);

        if (v || is_image(n)) {
            this.info.preview_text = l[16274];

            if (fileext(n.name) === 'pdf') {
                this.info.preview_text = l[17489];
            }
            else if (v) {
                this.info.preview_text = l[17732];
            }
        }

        if (this.info.fa) {
            // load thumbnail
            this.info.preview_url = await getImage(n).catch(nop);
        }
        this.info.n = n;
    }

    return this.info;
};


/**
 * Opens a preview of the current mega link
 *
 * @returns {MegaPromise}
 */
LinkInfoHelper.prototype.openPreview = async function() {
    "use strict";

    if (!this.info.at) {
        await this.getInfo();
    }

    slideshow({
        k: this.info.k,
        fa: this.info.fa,
        h: this.node_handle,
        name: this.info.name,
        link: `${this.node_handle}!${this.node_key}`
    });
};


/**
 * Returns true/false if the link info meta is loaded and ready
 *
 * @returns {Boolean}
 */
LinkInfoHelper.prototype.hadLoaded = function() {
    "use strict";
    return !!this._promise && this._loaded > 0;
};

/**
 * Returns true if the link info is now being loaded
 *
 * @returns {Boolean}
 */
LinkInfoHelper.prototype.startedLoading = function() {
    "use strict";
    return !!this._promise;
};

/**
 * Returns true if the current link have a preview
 *
 * @returns {Boolean}
 */
LinkInfoHelper.prototype.havePreview = function() {
    "use strict";
    return !!this.info.preview_url;
};


/**
 * Returns the actual (absolute) url
 *
 * @returns {String|*}
 */
LinkInfoHelper.prototype.getLink = function() {
    "use strict";
    if (!this._url || !String(this._url).includes('://')) {

        if (this.is_contactlink) {
            this._url = `${getBaseUrl()}/C!${this.node_handle}`;
        }
        else if (this.is_chatlink) {
            this._url = `${getBaseUrl()}/chat/${this.node_handle}#${this.node_key}`;
        }
        else {
            this._url = `${getBaseUrl()}/#${this.is_dir ? "F" : ""}!${this.node_handle}!${this.node_key}`;
        }
    }
    return this._url;
};

// Note: Referral Program is called as affiliate program at begining, so all systemic names are under word affiliate
// i.e. affiliate === referral

(function(global) {
    'use strict';

    var AffiliateData = function() {

        // Two of one-off actions for affiliate program
        this.id = u_attr && u_attr['^!affid'] || ''; // User never register aff will have '' as affid

        this.lastupdate = 0;
        this.signupList = [];
        this.creditList = {active: []};
        this.balance = {
            available: 0, // Available amount to redeem
            pending: 0, // Pending amount to process
            redeemed: 0, // Redeemed amount include fees
            redemptionFees: 0, // Fees that deducted on redemptions e.g. banking fee.

            // local currency values
            localAvailable: 0,
            localPending: 0,
            localTotal: 0,
            localRedeemed: 0,
            localRedemptionFees: 0,
            localCurrency: "EUR" // in theory this shouldn't be shown anywhere, so just passing a random currency
        };
    };

    /**
     * Getting Affiliate ID for user's unique link
     * @param {Boolean} noUA Flag to not trigger setUA function, and just for get redeemable status
     * @returns {Promise} Promise that resolve once process is done.
     */
    AffiliateData.prototype.getID = function(noUA) {

        var self = this;

        return new Promise(function(resolve, reject) {

            loadingDialog.show();

            api_req({a: 'affid'}, {
                affiliate: self,
                callback: function(res, ctx) {

                    if (typeof res === 'object') {

                        ctx.affiliate.redeemable = res.s;

                        loadingDialog.hide();

                        // Setting affid to user attr.
                        if (noUA) {
                            resolve();
                        }
                        else {
                            self.setUA('id', res.id).then(resolve).catch(reject);
                        }
                    }
                    else {
                        if (d) {
                            console.error('Affiliation ID retrieval failed. ', res);
                        }
                        reject(res);
                    }
                }
            });
        });
    };

    /**
     * Setting User Attribute for affiliate programme
     * @param {String} type Type of UA to update
     * @param {String|Boolean|Number} value Type of UA to update
     * @returns {Promise} Promise that resolve once process is done.
     */
    AffiliateData.prototype.setUA = function(type, value) {

        var self = this;

        // Allowed user attribute updatable on affiliate
        var allowed = ['id'];

        if (allowed.indexOf(type) < 0) {
            if (d) {
                console.error('The type of UA entered is not allowed to update on this function. type:' + type);
            }

            return Promise.reject();
        }

        return new Promise(function(resolve, reject) {

            loadingDialog.show();

            // Setting it to user attr.
            mega.attr.set('aff' + type, value, -2, 1).done(function() {
                self[type] = value;
                loadingDialog.hide();
                resolve();
            }).fail(function(res) {
                if (d) {
                    console.error('Set user attribute `aff' + type + '` failed. ', res);
                }
                reject();
            });
        });
    };

    /**
     * Getting Affiliate Balace for the user
     * @returns {Promise} Promise that resolve once process is done.
     */
    AffiliateData.prototype.getBalance = function() {

        var self = this;

        loadingDialog.show();

        var affbPromise = new Promise(function(resolve, reject) {
            api_req({a: 'affb'}, {
                affiliate: self,
                callback: function(res, ctx) {

                    if (typeof res === 'object') {
                        ctx.affiliate.balance = {
                            available: res.a, // Available amount to redeem
                            pending: res.p, // Pending amount to process
                            redeemed: res.r, // Redeemed amount include fees
                            redemptionFees: res.f, // Fees that deducted on redemptions e.g. banking fee.

                            // local currency values
                            localAvailable: res.la,
                            localPending: res.lp,
                            localTotal: res.lt,
                            localRedeemed: res.lr,
                            localRedemptionFees: res.lf,
                            localCurrency: res.c
                        };

                        // NOTE: So actually redeemed amount for user is redeemed - redemptionFees.
                        // ctx.affiliate.balance.actualRedeemedForUser = res.r - res.f;

                        resolve();
                    }
                    else {
                        if (d) {
                            console.error('Affiliation Balance retrieval failed. ', res);
                        }
                        reject(res);
                    }
                }
            });
        });

        var utpPromise = new Promise(function(resolve, reject) {

            api_req({a: 'utp'}, {
                affiliate: self,
                callback: function(res, ctx) {
                    if (typeof res === 'object') {
                        ctx.affiliate.utpCount = res.length;
                        resolve();
                    }
                    else {
                        if (d) {
                            console.error('Account payment history retrieval failed. ', res);
                        }
                        reject(res);
                    }
                }
            });
        });

        var promises = [affbPromise, utpPromise];

        return Promise.all(promises).then(function() {
            loadingDialog.hide();
        });
    };

    /**
     * Getting Affiliation list that signed up with current user and possibly get creditize
     * @returns {Promise} Promise that resolve once process is done.
     */
    AffiliateData.prototype.getSignupList = function() {

        var self = this;

        return new Promise(function(resolve, reject) {

            loadingDialog.show();

            api_req({a: 'affsl'}, {
                affiliate: self,
                callback: function(res, ctx) {
                    loadingDialog.hide();

                    if (typeof res === 'object') {
                        resolve(res);
                        ctx.affiliate.signupList = res;
                    }
                    else {
                        if (d) {
                            console.error('Affiliation Signup List retrieval failed. ', res);
                        }
                        reject(res);
                    }
                }
            });
        });
    };

    /**
     * Getting list of affiliation that is creditized.
     * @returns {Promise} Promise that resolve once process is done.
     */
    AffiliateData.prototype.getCreditList = function() {

        loadingDialog.show();

        var self = this;

        var proPromise = new Promise(function(resolve) {

            pro.loadMembershipPlans(function() {
                resolve();
            });
        });

        var affclPromise = new Promise(function(resolve, reject) {

            api_req({a: 'affcl'}, {
                affiliate: self,
                callback: function(res, ctx) {
                    loadingDialog.hide();

                    if (typeof res === 'object') {
                        ctx.affiliate.creditList = {};
                        ctx.affiliate.creditList.active = res.a;
                        ctx.affiliate.creditList.pending = res.p;
                        ctx.affiliate.creditList.activeAmount = res.at;
                        ctx.affiliate.creditList.pendingAmount = res.pt;
                        ctx.affiliate.creditList.activeLocalAmount = res.lat;
                        ctx.affiliate.creditList.pendingLocalAmount = res.lpt;
                        ctx.affiliate.creditList.localCurrency = res.c;

                        resolve(res);
                    }
                    else {
                        if (d) {
                            console.error('Affiliation Credit List retrieval failed. ', res);
                        }
                        reject(res);
                    }
                }
            });
        });

        var promises = [proPromise, affclPromise];

        return Promise.all(promises);
    };

    /**
     * Generate affiliate url with given page.
     * @param {String} targetPage Mega url chose/entered by user.
     * @returns {Promise} Promise that resolve once process is done.
     */
    AffiliateData.prototype.getURL = function(targetPage) {

        return new Promise(function(resolve, reject) {

            var _formatURL = function() {
                if (targetPage === 'help') {
                    return `${l.mega_help_host}?aff=${M.affiliate.id}`;
                }
                targetPage = targetPage ? `/${targetPage}?` : '/?';
                return `https://mega.io${targetPage}aff=${M.affiliate.id}`;
            };
            if (M.affiliate.id) {
                resolve(_formatURL());
            }
            else {
                M.affiliate.getID().then(function() {
                    resolve(_formatURL());
                }, function(res) {
                    reject(res);
                });
            }
        });
    };

    /*
     * Redemption Relates - Phase 2
     */

    AffiliateData.prototype.getRedemptionMethods = function() {

        var self = this;

        // Gateway info is already in memory do not stress api anymore
        if (this.redeemGateways) {
            return Promise.resolve();
        }

        return new Promise(function(resolve, reject) {

            loadingDialog.show();

            api_req({a: 'affrm'}, {
                affiliate: self,
                callback: function(res, ctx) {

                    loadingDialog.hide();

                    if (typeof res === 'object') {

                        ctx.affiliate.redeemGateways = {};

                        var sortCountry = function(a, b) {
                            return M.getCountryName(a).localeCompare(M.getCountryName(b), locale);
                        };

                        var checkCountry = c => M.getCountryName(c) !== null;

                        for (var i = res.length; i--;) {

                            res[i].data.cc = res[i].data.cc.filter(checkCountry).sort(sortCountry);
                            ctx.affiliate.redeemGateways[res[i].gateway] = res[i];
                        }
                        resolve(res);
                    }
                    else {
                        reject(res);
                    }
                }
            });
        });
    };

    AffiliateData.prototype.redeemStep1 = function() {

        var self = this;

        return new Promise(function(resolve, reject) {

            loadingDialog.show();

            var req = Object.assign({a: 'affr1'}, affiliateRedemption.requests.first);
            // var req = Object.assign({a: 'affr1'}, {c: "ZMW", cc: "NZ", m: 0, p: 18});
            if (affiliateRedemption.requests.first.m === 0) {
                req = Object.assign({a: 'affr1',
                                     extra: {al: affiliateRedemption.plan.chosenPlan}},
                                    affiliateRedemption.requests.first);
            }

            api_req(req, {
                affiliate: self,
                callback: function(res) {

                    loadingDialog.hide();

                    // Only MEGAstatus 0 ~ 4 mean success
                    if (typeof res === 'object' && res.MEGAstatus >= 0 && res.MEGAstatus < 5) {
                        resolve(res);
                    }
                    else {
                        if (d) {
                            if (res.MEGAstatus) {
                                // TODO handling MEGAstatus
                                console.error('Gateway error occurs, response:' + res.MEGAstatus);
                            }
                            else {
                                console.error('Requesting redemption 1 failed: ' + res);
                            }
                        }
                        reject(res);
                    }
                }
            });
        });
    };

    AffiliateData.prototype.redeemStep2 = function() {

        var self = this;

        return new Promise(function(resolve, reject) {

            loadingDialog.show();

            var req = Object.assign({a: 'affr2'}, affiliateRedemption.requests.second);

            api_req(req, {
                affiliate: self,
                callback: function(res) {

                    loadingDialog.hide();

                    // Only MEGAstatus 0 ~ 4 mean success
                    if (typeof res === 'object' && res.MEGAstatus >= 0 && res.MEGAstatus < 5) {
                        resolve(res);
                    }
                    else {
                        if (d) {
                            if (res.MEGAstatus) {

                                console.error('Gateway error occurs, response:' + res.MEGAstatus);
                                res.close = true;
                            }
                            else {
                                console.error('Requesting redemption 2 failed: ' + res);
                            }
                        }

                        reject(res);
                    }
                }
            });
        });
    };

    AffiliateData.prototype.getExtraAccountDetail = function() {

        var self = this;

        return new Promise(function(resolve, reject) {

            loadingDialog.show();

            var req = Object.assign({
                a: 'afftrc',
                rid: affiliateRedemption.req1res[0].rid
            }, affiliateRedemption.requests.second);

            api_req(req, {
                affiliate: self,
                callback: function(res) {

                    loadingDialog.hide();

                    // Only MEGAstatus 0 ~ 4 mean success
                    if (typeof res === 'object' && res.MEGAstatus >= 0 && res.MEGAstatus < 5) {
                        resolve(res);
                    }
                    else {
                        if (res.MEGAstatus) {

                            console.error('Gateway error occurs, response:' + res.MEGAstatus);
                            res.close = true;
                        }
                        else {
                            console.error('Requesting redemption 2 failed: ' + res);
                        }

                        reject(res);
                    }
                }
            });
        });
    };

    AffiliateData.prototype.getRedeemAccountInfo = function() {

        var self = this;

        return new Promise(function(resolve) {

            var method = affiliateRedemption.requests.first.m;

            mega.attr.get(u_attr.u, 'redeemaccinfo' + method, false, true).always(function(res) {

                if (typeof res !== 'object') {
                    res = false;
                }

                for (var k in res) {
                    res[k] = from8(res[k]);
                }

                self.redeemAccDefaultInfo = res;
                resolve(res);
            });
        });
    };

    AffiliateData.prototype.setRedeemAccountInfo = function(method, values) {

        loadingDialog.show();

        var self = this;

        return new Promise(function(resolve) {

            var setValues = {};

            for (var k in values) {
                setValues[k] = to8(values[k]);
            }

            mega.attr.set('redeemaccinfo' + method, setValues, false, true).done(function() {

                self.redeemAccDefaultInfo = values;
                loadingDialog.hide();
                resolve();
            });
        });
    };

    AffiliateData.prototype.getRedemptionHistory = function() {

        var self = this;

        return new Promise(function(resolve, reject) {

            loadingDialog.show();

            api_req({a: 'affrh'}, {
                affiliate: self,
                callback: function(res, ctx) {

                    loadingDialog.hide();

                    if (typeof res === 'object') {

                        // Default sort by time
                        res.r.sort(function(a, b) {

                            if (a.ts > b.ts) {
                                return -1;
                            }
                            else if (a.ts < b.ts) {
                                return 1;
                            }

                            return 0;
                        });

                        ctx.affiliate.redemptionHistory = res;
                        resolve(res);
                    }
                    else {
                        reject(res);
                    }
                }
            });
        });
    };

    AffiliateData.prototype.getFilteredRedempHistory = function(filter) {

        if (filter === 'all') {
            return this.redemptionHistory.r;
        }

        return this.redemptionHistory.r.filter(function(item) {

            const s = item.hasOwnProperty('state')
                ? item.state
                : item.s;
            switch (filter) {
                case 'processing':
                    return s > 0 && s < 4;
                case 'complete':
                    return s === 4 || s === 400;
                case 'failed':
                    return s > 4 && s !== 400;
            }

            return false;
        });
    };

    AffiliateData.prototype.getRedemptionDetail = function(rid, state) {

        var self = this;

        var redi = this.redemptionHistory.r.findIndex(function(history) {
            return rid === history.rid;
        });

        // We have this redmeption detail already do not bother api again
        if (this.redemptionHistory.r[redi].det || this.redemptionHistory.r[redi].dn) {
            return Promise.resolve(this.redemptionHistory.r[redi]);
        }

        return new Promise(function(resolve, reject) {

            loadingDialog.show();

            api_req({a: 'affrd', rid: rid}, {
                affiliate: self,
                callback: function(res, ctx) {

                    loadingDialog.hide();

                    if (state) {
                        res[0].state = state;
                    }
                    if (typeof res === 'object') {

                        ctx.affiliate.redemptionHistory.r[redi]
                            = Object.assign(ctx.affiliate.redemptionHistory.r[redi], res[0]);
                        resolve(ctx.affiliate.redemptionHistory.r[redi]);
                    }
                    else {
                        reject(res);
                    }
                }
            });
        });
    };

    /*
     * Ends of Redemption Relates
     */

    /**
     * Pulling data for filling affiliate page.
     * @returns {Promise} Promise that resolve once process is done.
     */
    AffiliateData.prototype.getAffiliateData = function(force) {

        var refreshData = force || (this.lastupdate < Date.now() - 10000);

        var promises = refreshData && [
            this.getID(true),
            this.getBalance(),
            this.getRedemptionHistory(),
            this.getSignupList(),
            this.getCreditList()
        ] || [];

        return Promise.all(promises);
    };

    /**
     * Function to place Affiliate data when user visit affiliate pages
     * @param {String} value affiliation id.
     * @param {Number} type affiliation type. 1: ref-link, 2: public link, 3: chat link, 4: contact link.
     * @returns {void}
     */
    AffiliateData.prototype.storeAffiliate = function(value, type) {
        sessionStorage.affid = value;
        sessionStorage.affts = Date.now();
        sessionStorage.afftype = type;

        this.persist();
    };

    AffiliateData.prototype.persist = function() {
        const WAIT_TIME = 2e4;
        const tag = 'AffiliateData:persist.deferred';

        if (this.persist.running) {
            return;
        }
        this.persist.running = true;

        delay(tag, async() => {
            const holders = {
                cookie: 1, download: 1, file: 1, folder: 1,
                privacy: 1, takedown: 1, terms: 1,
                filerequest: 1
            };
            let hold = pfid || holders[page] || String(page).includes('chat');
            if (!hold) {
                // Hold showing the cookie dialog for this if the FM was just loaded (e.g. less than 20 seconds ago)
                hold = window.loadfm && Date.now() - loadfm.loaded < WAIT_TIME;
            }

            if (hold) {
                if (d) {
                    console.warn('Holding showing cookie-dialog for affiliate-tags...', sessionStorage.affid);
                }
                mBroadcaster.once('pagechange', SoonFc(60, () => {
                    this.persist.running = false;
                    this.persist();
                }));
                return;
            }

            if (sessionStorage.affid && 'csp' in window) {
                const storage = localStorage;

                if (d) {
                    console.info('Dispatching cookie-dialog for affiliate-tags...', sessionStorage.affid);
                }
                await csp.init();

                if (csp.has('analyze')) {
                    if (sessionStorage.affid) {
                        storage.affid = sessionStorage.affid;
                        storage.affts = sessionStorage.affts;
                        storage.afftype = sessionStorage.afftype;
                        delete sessionStorage.affid;
                        delete sessionStorage.affts;
                        delete sessionStorage.afftype;
                    }
                }
                else {
                    delete storage.affid;
                    delete storage.affts;
                    delete storage.afftype;
                }
            }

            this.persist.running = false;
        }, WAIT_TIME / 3);
    };

    /**
     * @name window.AffiliateData
     * @global
     */
    Object.defineProperty(global, 'AffiliateData', {value: AffiliateData});

    /**
     * @name mega.affid
     * @mega
     */
    Object.defineProperty(mega, 'affid', {
        get: function() {
            const storage = sessionStorage.affid ? sessionStorage : localStorage;
            if (storage.affid) {
                return { id: storage.affid, t: storage.afftype || 2, ts: Math.floor(storage.affts / 1000) };
            }
            return false;
        }
    });
})(self);

mBroadcaster.once('startMega', () => {
    'use strict';

    const provider = 1; // CJ (one for now...)
    const validPeriod = 86400 * 28; // event ID valid for 28 days (in seconds)

    const parse = tryCatch((v) => JSON.parse(v));

    /**
     * Try to get the event from web storage. If the event doesn't exist or
     * is older than the valid period, return null.
     *
     * @returns {object|null} event object or null if not valid.
     */
    const getEvent = () => {
        const storage = localStorage.eAff ? localStorage : sessionStorage;

        let event = storage.eAff;
        if (!event) {
            return null;
        }

        event = parse(event);
        if (!event || !event.provider || !event.id) {
            delete storage.eAff; // Remove the unexpected
            return null;
        }

        // If date exists check expiry
        if (event.ts && Math.floor(Date.now() / 1000) - event.ts > validPeriod) {
            // Remove expired event data
            delete storage.eAff;
            return null;
        }

        return event;
    };

    /**
     * Clear the event from local and session storage.
     *
     * @returns {void}
     */
    const clearEvent = () => {
        delete sessionStorage.eAff;
        delete localStorage.eAff;
    };

    /**
     * Save the event to the user's attribute, then clear the stored value from storage.
     *
     * @param {object} eAff External affiliate object
     *
     * @returns {void}
     */
    const setAttr = (eAff) => {
        if (!eAff) {
            return;
        }

        const attr = `${eAff.ts},${eAff.provider},${eAff.id}`;

        mega.attr.set2(null, 'eaffid', attr, mega.attr.PRIVATE_UNENCRYPTED, true).then(clearEvent).catch(nop);
    };

    if (sessionStorage.cjevent) {
        sessionStorage.eAff = JSON.stringify({
            provider,
            ts: unixtime(),
            id: sessionStorage.cjevent
        });
        delete sessionStorage.cjevent;

        if ('csp' in window) {
            csp.init().then(() => {
                // @todo shall we force showing the dialog, when the user may previously dismissed granting 'analyze'?..

                if (csp.has('analyze') && sessionStorage.eAff) {
                    localStorage.eAff = sessionStorage.eAff;
                    delete sessionStorage.eAff;
                }
            });
        }
        else if (d) {
            console.warn('CSP unexpectedly not available');
        }
    }

    const data = getEvent();
    if (!data) {
        return;
    }
    if (!u_type) {
        mBroadcaster.once('login2', () => {
            setAttr(data);
        });
    }
    else {
        setAttr(data);
    }
});

// Note: Referral Program is called as affiliate program at begining, so all systemic names are under word affiliate
// i.e. affiliate === referral

// Can't set chosenPlan to min plan, as pro.minPlan hasn't been created yet.
var affiliateRedemption = {
    currentStep: 0,
    requests: {
        first: {},
        second: {}
    },
    req1res: {},
    dynamicInputs: {},
    plan : {
        chosenPlan: undefined,
        planName: '',
        planStorage: -1,
        planQuota: -1,
        planDuration: undefined,
        planPriceRedeem: -1,
        planCostMonthly: -1,
        planCostYearly: -1,
    },
};

affiliateRedemption.getMethodString = function(type) {

    'use strict';

    return ({0: l.redemption_method_pro_plan, 1: l[23301], 2: l[6802]})[type];
};

affiliateRedemption.reset = function() {

    'use strict';

    this.currentStep = 0;
    this.requests = {
        first: {},
        second: {}
    };
    this.req1res = {};
    this.dynamicInputs = {};

    this.stopTimer();
};

affiliateRedemption.close = function(force) {

    'use strict';

    if (is_mobile) {
        mobile.affiliate.closeRedeemPage();
    }
    else {
        affiliateUI.redemptionDialog.hide(force);
    }
};

affiliateRedemption.getRedemptionStatus = function(code, proSuccessful) {

    'use strict';

    if (proSuccessful !== undefined) {
        return proSuccessful
            ? {c: '', s: l[25002], class: 'complete', m: l[23373]}
            : {c: 'red', s: l[22819], class: 'failed', m: l[23369]};
    }

    switch (code) {
        case 1:
        case 2:
        case 3:
            return {c: 'orange', s: l[22833], class: 'processing', m: l[23371], bm: l[23370]};
        case 4:
            return {c: '', s: l[25002], class: 'complete', m: l[23372], bm: l[23373]};
        case 5:
        case 6:
            return {c: 'red', s: l[22819], class: 'failed', m: l[23369]};
        default:
            return {c: 'red', s: l[22819], class: 'failed', m: ''};
    }
};

affiliateRedemption.processSteps = function() {

    'use strict';

    var self = this;
    var steps;

    if (is_mobile) {
        steps = [
            [],
            ['__processBlock1'],
            ['__processBlock2'],
            ['__processBlock3'],
            this.requests.first.m === 2 ? [] : [ '__processBlock4'], // If this is Bitcoin skip Block 4
            ['__processBlock5']
        ];

        this.$rdmUI = mobile.affiliate.$page;
    }
    else {
        steps = [
            ['__processBlock1'],
            this.requests.first.m === 0 ? ['__processBlock2', '__processBlock3'] : ['__processBlock2'],
            ['__processBlock3'],
            this.requests.first.m === 2 ? [] : [ '__processBlock4'], // If this is Bitcoin skip Block 4
            ['__processBlock5']
        ];

        this.$rdmUI = affiliateUI.redemptionDialog.$dialog;
    }
    return Promise.all(steps[this.currentStep].map((func) => {
        return self[func]();
    })).catch(function(ex) {

        if (ex) {

            if (d) {
                console.error('Requesting redeem failed, step: ' + self.currentStep, ex);
            }

            var mainMessage = l[200];
            var subMessage = '';

            var __errorForTfw = function() {

                // List of error with default messgage
                var redeemErrors = {
                    '-1': '', // Generic error when we don't know what went wrong.
                    '-2': 'Transaction is declined', // Gateway declined to process the transaction.
                    '-3': 'Invalid request', // An invalid request was made.
                    '-4': 'Time limit exceeded', // The user/mega took to long to do something.
                    '-5': 'Too many requests', // too many requests are being made at once.
                };

                if (typeof ex === 'object') {
                    subMessage = ex.keys || ex.msg || redeemErrors[ex.MEGAstatus] || '';
                }

                if (typeof subMessage === 'object') {
                    subMessage = subMessage.join('<br>');
                }
            };

            if (self.requests.first.m === 1) {
                __errorForTfw();
            }
            else if (self.requests.first.m === 2 && typeof ex === 'object') {
                mainMessage += ' ' + (ex.MEGAstatus === -2 ? l[23535] : l[253]);
            }

            if (ex === ETEMPUNAVAIL) {
                mainMessage += ' ' + l[253];
            }

            loadingDialog.hide('redeemRequest');

            // Oops something went wrong for api side errors
            msgDialog('warninga', '', mainMessage, subMessage, function() {

                loadingDialog.hide('redeemRequest');
                self.$rdmUI.removeClass('arrange-to-back');

                if (ex.close) {
                    self.close(true);
                }
            });
        }
        // This is internal validation error so no error message required
        else {
            if (d) {
                console.error('Input validation failed, step: ' + self.currentStep);
            }

            loadingDialog.hide('redeemRequest');
        }

        return false;
    });
};

affiliateRedemption.__processBlock1 = function() {

    'use strict';

    // Update chosenPlan default to the min available pro plan, as it has now been created
    const minPlanNum = pro.filter.affMin[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];
    affiliateRedemption.plan.chosenPlan = affiliateRedemption.plan.chosenPlan || minPlanNum;

    this.requests.first.m = $('.payment-type .radioOn input', this.$dialog).val() | 0;
    const $nextBtn = $('.next-btn', this.$dialog);
    $nextBtn.addClass('disabled');
};

affiliateRedemption.__processBlock2 = function() {

    'use strict';

    var method = this.requests.first.m;
    var activeMethodMin = M.affiliate.redeemGateways[method].min || 50;
    let value;
    let megaInput;
    let errored;

    if (affiliateRedemption.requests.first.m === 0) {
        value = this.plan.planPriceRedeem;
    }
    else if (affiliateRedemption.requests.first.m === 2){
        megaInput = $('#affiliate-redemption-amount', this.$dialog).data('MegaInputs');
        value = megaInput ? megaInput.getValue() : 0;
    }
    if (!value){

        msgDialog('warninga', '', l[23318]);
        errored = true;
    }
    else if (value < activeMethodMin){

        msgDialog('warninga', '', l[23319].replace('%1', formatCurrency(activeMethodMin)));
        errored = true;
    }
    else if (value > M.affiliate.balance.available) {

        msgDialog('warninga', '', l[23320]);
        errored = true;
    }

    if (errored) {

        if (megaInput) {
            megaInput.$input.trigger('blur');
        }

        return Promise.reject();
    }

    this.requests.first.p = value;

    if (method === 2) {
        return M.affiliate.getRedeemAccountInfo();
    }
};

affiliateRedemption.__processBlock3 = function() {

    'use strict';

    var self = this;

    // If this is Bitcoin, record bitcoin address to second request
    if (this.requests.first.m === 2) {

        var bitcoinAddress = $('#affi-bitcoin-address', this.$step).val().trim();
        var megaInput = $('#affi-bitcoin-address', this.$step).data('MegaInputs');

        // No address entered
        if (!bitcoinAddress) {

            if (megaInput) {
                megaInput.showError(l[23321]);
                Ps.update(this.$step.children('.ps').get(0));
            }
            else {
                msgDialog('warninga', '', l[23321]);
            }

            this.$rdmUI.removeClass('arrange-to-back');

            return Promise.reject();
        }
        // This is not valid bitcoin address format
        else if (validateBitcoinAddress(bitcoinAddress)) {

            if (megaInput) {
                megaInput.showError(l[23322]);
            }
            else {
                msgDialog('warninga', '', l[23322]);
            }

            $('#affi-bitcoin-address', this.$step).trigger('blur');

            this.$rdmUI.removeClass('arrange-to-back');

            return Promise.reject();
        }

        this.requests.second.extra = {an: $('#affi-bitcoin-address', this.$step).val()};
    }

    if (is_mobile) {

        this.requests.first.cc = $('#affi-country', this.$step).val();
        this.requests.first.c = $('#affi-currency', this.$step).val();
    }
    else if (this.requests.first.m === 0){
        this.requests.first.cc = u_attr.country || "GB";
        this.requests.first.c = M.affiliate.balance.localCurrency;
    }
    else {
        this.requests.first.cc = $('#affi-country .option.active', this.$step).data('type');
        this.requests.first.c = $('#affi-currency .option.active', this.$step).data('type');
    }

    if ($('#affi-save-bitcoin', this.$step).prop('checked')) {
        this.updateAccInfo();
    }

    return Promise.all([
        M.affiliate.redeemStep1(),
        this.requests.first.m % 2 === 0 ? false : M.affiliate.getRedeemAccountInfo()

    ]).then(function(res) {

        self.req1res = res;
    }, function(ex) {

        delete self.requests.first.cc;
        delete self.requests.first.c;
        return Promise.reject(ex);
    });
};

affiliateRedemption.__processBlock4 = function() {

    'use strict';

    if (!this.validateDynamicAccInputs()) {
        return Promise.reject();
    }

    this.recordSecondReqValues();

    if ($('.save-data-checkbox .checkdiv:visible', this.$step).hasClass('checkboxOn')) {
        this.updateAccInfo();
    }
};

affiliateRedemption.__processBlock5 = function() {

    'use strict';

    // Rquest ID set on this phase due to Bitcoin skip step 3.
    this.requests.second.rid = this.req1res[0].rid;

    return M.affiliate.redeemStep2();
};

affiliateRedemption.recordSecondReqValues = function() {

    'use strict';

    var self = this;

    // Pass validation, now start record it.
    this.requests.second.extra = {
        an: $('#affi-account-name', this.$rdmUI).val(),
        details: []
    };

    // Record account type
    if (this.req1res[0].data.length > 1) {

        var $accountType = $('#account-type', this.$rdmUI);
        var activeTypeValue = $accountType.hasClass('dropdown-input') ?
            $('.option.active', $accountType).data('type') : $accountType.val();

        this.requests.second.extra.type = this.req1res[0].data[activeTypeValue][0];
        this.requests.second.extra.title = this.req1res[0].data[activeTypeValue][1];
    }
    else {
        this.requests.second.extra.type = this.req1res[0].data[0][0];
        this.requests.second.extra.title = this.req1res[0].data[0][1];
    }

    // Lets use UI input to order it as UI shows.
    var $dynamicInputsWrapper = $('.affi-dynamic-acc-info', this.$rdmUI);
    var uiSelectString = is_mobile ? '.affi-dynamic-acc-select select, .affi-dynamic-acc-input input' :
        '.affi-dynamic-acc-select, .affi-dynamic-acc-input';
    var $dynamicInputListFromUI = $(uiSelectString, $dynamicInputsWrapper);

    // Dynamic input recording
    for (var i = 0; i < $dynamicInputListFromUI.length; i++) {

        var hashedID = $dynamicInputListFromUI[i].id;
        var item = this.dynamicInputs[hashedID];
        var $input = item[1];

        if (item[0] === 't') {

            self.requests.second.extra.details.push({
                k: item[2],
                lk: $input.attr('title'),
                v: $input.val()
            });
        }
        else if (item[0] === 's') {

            var $activeItem;
            var activeValue;

            if ($input.hasClass('dropdown-input')) {

                $activeItem = $('.option.active', $input);
                activeValue = $activeItem.data('type');
            }
            else {
                $activeItem = $('option:selected', $input);
                activeValue = $input.val();
            }

            self.requests.second.extra.details.push({
                k: item[2],
                lk: $input.attr('title'),
                v: activeValue,
                lv: $activeItem.text()
            });
        }
    }
};

affiliateRedemption.clearDynamicInputs = function() {

    'use strict';

    // Clear dynamic input deleted from dom
    for (var i in this.dynamicInputs) {

        if (this.dynamicInputs.hasOwnProperty(i)) {

            var $newElem = $("#" + i, this.$rdmUI);

            if ($newElem.length === 0) {
                delete this.dynamicInputs[i];
            }
        }
    }
};

affiliateRedemption.validateDynamicAccInputs = function() {

    'use strict';

    var fillupCheck = true;
    var formatCheck = true;

    // Account holder name and account type are not actual dynamic input but it is part of it, so validate here
    var $an = $('#affi-account-name', this.$rdmUI);
    var $at = $('#account-type', this.$rdmUI);

    var accountNameAndType = {0: ['t', $an]};

    if ($at.length) {
        accountNameAndType[1] = ['s', $at];
    }

    var dynamicInputs = Object.assign(accountNameAndType, this.dynamicInputs);

    var __validateInput = function(item) {

        var $input = item[1];

        if (item[0] === 't') {

            var megaInput = $input.data('MegaInputs');

            if ($input.val().trim() === '') {

                if (megaInput) {
                    megaInput.showError();
                }
                else {
                    $input.parent().addClass('error');
                }

                fillupCheck = false;
            }
            else if ($input.data('_vr') && $input.val().match(new RegExp($input.data('_vr'))) === null) {

                if (megaInput) {
                    megaInput.showError();
                }
                else {
                    $input.parent().addClass('error');
                }

                formatCheck = false;
            }
        }
        else if (item[0] === 's') {

            // If active item has value '', it is default value like "Please select". Warn user to enter value.
            if ($input.hasClass('dropdown-input')) {

                var $activeItem = $('.active', $input);

                if (!$activeItem.length || $activeItem.data('type') === '') {

                    $input.parent().addClass('error');
                    fillupCheck = false;
                }
            }
            else if (!$input.val()) {

                $input.parent().addClass('error');
                fillupCheck = false;
            }
        }
    };

    // Lets validate dynamic inputs
    for (var i in dynamicInputs) {

        if (dynamicInputs.hasOwnProperty(i)) {
            __validateInput(dynamicInputs[i]);
        }
    }

    // Reason for not using MegaInputs show error for message is due to when there is verification,
    // MegaInputs's message block alreayd taken by the example.
    if (!fillupCheck) {
        msgDialog('error', '', l[23323]);
    }
    else if (!formatCheck) {
        msgDialog('error', '', l[23324]);
    }

    return fillupCheck && formatCheck;
};

affiliateRedemption.startTimer = function() {

    'use strict';

    // It already has timer we do not need to do something further
    if (this.timerInterval) {
        return;
    }

    var self = this;
    var $timer = $('.timing', this.$rdmUI);
    var $timerBlock = $('span', $timer);
    var time = 900; // 15 mins
    var timeArray = secondsToTime(time).split(':');
    var prevTime = Date.now() / 1000 | 0;

    $timer.removeClass('hidden');
    $timerBlock.text(l[23247].replace('[m]', timeArray[1]).replace('[s]', timeArray[2]));
    $timerBlock.parent().removeClass('orange');

    this.timerInterval = setInterval(function() {

        // To prevent Mobile safari out-focus interval stopping issue. use timer to find out how much is jumped.
        var now = Date.now() / 1000 | 0;
        var diff = now - prevTime;

        time -= diff;
        prevTime = now;
        timeArray = secondsToTime(time).split(':');

        if (time < 1) {

            $timerBlock.text(l[23248].replace('[s]', 0));

            self.stopTimer(false);

            msgDialog('warninga', '', l[23325], false, function() {
                self.close(true);
            });
        }
        else if (time < 60) {

            $timerBlock.text(l[23248].replace('[s]', timeArray[2]));
            $timerBlock.parent().addClass('orange');
        }
        else {
            $timerBlock.text(l[23247].replace('[m]', timeArray[1]).replace('[s]', timeArray[2]));
        }
    }, 1000);
};

affiliateRedemption.stopTimer = function(hide) {

    'use strict';

    if (hide === undefined || hide) {
        $('.timing', this.$rdmUI).addClass('hidden');
    }

    clearInterval(this.timerInterval);
    delete this.timerInterval;
};

affiliateRedemption.fillBasicHistoryInfo = function($wrapper, item, status) {

    'use strict';

    const proSuccessful = item.gw === 0
        ? status === 4
        : undefined;

    var itemStatus = this.getRedemptionStatus(item.s, proSuccessful);

    var la = parseFloat(item.la);
    var lf = parseFloat(item.lf);
    var a = parseFloat(item.a);
    var f = parseFloat(item.f);
    let receivedAmount = a - f;
    if (proSuccessful === false || item.s === 5 || item.s === 6) {
        receivedAmount = 0;
    }

    $('.receipt', $wrapper).text(item.ridd);
    $('.date', $wrapper).text(time2date(item.ts, 1));
    $('.method', $wrapper).text(this.getMethodString(item.gw));
    $('.status', $wrapper).removeClass('red').addClass(itemStatus.c).text(itemStatus.s);
    $('.country', $wrapper).text(M.getCountryName(item.cc));
    $('.currency', $wrapper).text(item.c);

    if (item.c === 'EUR') {
        $('.request-amount', $wrapper).text(formatCurrency(a));
        $('.fee-charged', $wrapper).text(formatCurrency(f));
        $('.recived-amount', $wrapper).text(formatCurrency(receivedAmount));
    }
    else if (item.c === 'XBT') {
        $('.request-amount', $wrapper).safeHTML('<span class="euro">' + formatCurrency(a) + '</span>' +
            '<span class="local">BTC ' + parseFloat(la).toFixed(8) + '</span>');
        $('.fee-charged', $wrapper).safeHTML('<span class="euro">' + formatCurrency(f) + '</span>' +
            '<span class="local">BTC ' + parseFloat(lf).toFixed(8) + '</span>');
        $('.recived-amount', $wrapper).safeHTML('<span class="euro">' + formatCurrency(a - f) + '</span>' +
            '<span class="local">BTC ' + parseFloat(la - lf).toFixed(8) + '</span>');
    }
    else {
        $('.request-amount', $wrapper).safeHTML('<span class="euro">' + formatCurrency(a) +
            '</span><span class="local">' + formatCurrency(la, item.c, 'code') + '</span>');
        $('.fee-charged', $wrapper).safeHTML('<span class="euro">' + formatCurrency(f) +
            '</span><span class="local">' + formatCurrency(lf, item.c, 'code') + '</span>');
        $('.recived-amount', $wrapper).safeHTML('<span class="euro">' + formatCurrency(receivedAmount) +
            '</span><span class="local">' + formatCurrency(receivedAmount, item.c, 'code') + '</span>');
    }

    $('.status-message', $wrapper).safeHTML(item.gw === 2 && itemStatus.bm || itemStatus.m);
};

affiliateRedemption.redemptionAccountDetails = function($wrapper, method, data) {

    'use strict';

    data = data || this.requests.second;

    $('.receipt', $wrapper).text(data.ridd);
    $('.method', $wrapper).text(this.getMethodString(method));

    // Dynamic account details
    var html = '<span class="strong full-size">' + l[23310] + '</span>';
    var itemTemplate = '<span class="grey">%1</span><span class="%3">%2</span>';

    var extra = data.extra || data;
    var safeArgs = [];

    // If this is Bitcoin redemption show only Bitcoin address here
    if (method === 2) {

        $('.currency', $wrapper).text('BTC');

        html += itemTemplate.replace('%1', l[23361]).replace('%2', extra.an)
            .replace('%3', 'bitcoin-address');
    }
    else if (method === 1) {

        itemTemplate = itemTemplate.replace('%3', '');

        html += itemTemplate.replace('%1', l[23362]).replace('%2', extra.an);
        html += itemTemplate.replace('%1', l[23394]).replace('%2', extra.title);

        var details = extra.det || data.extra.details;

        for (var i = 0; i < details.length; i++) {
            html += itemTemplate.replace('%1', '@@').replace('%2', '@@');
            safeArgs.push(details[i].lk, (details[i].lv || details[i].v));
        }
    }
    else if (method === 0) {
        html += itemTemplate.replace('%1', l[23362]).replace('%2', u_attr.email);
    }

    safeArgs.unshift(html);

    var $details = $('.account-details', $wrapper);

    $details.safeHTML.apply($details, safeArgs);
};

affiliateRedemption.updateAccInfo = function() {

    'use strict';

    var self = this;
    let accInfo;

    if (this.requests.first.m === 1) {
        this.recordSecondReqValues();

        // Flatten account info
        accInfo = Object.assign(
            {ccc: this.requests.first.cc + this.requests.first.c},
            this.requests.second.extra
        );

        const {details} = this.requests.second.extra;

        for (var i = 0; i < details.length; i++) {
            accInfo[details[i].k] = details[i].v;
        }

        delete accInfo.details;
        delete accInfo.title;
    }
    else if (this.requests.first.m === 2) {
        accInfo = this.requests.second.extra;
    }

    this.$rdmUI.addClass('arrange-to-back');

    M.affiliate.setRedeemAccountInfo(this.requests.first.m, accInfo).then(function() {

        let toastMsg = '';

        if (self.requests.first.m === 1) {
            toastMsg = l[23363];
        }
        else if (self.requests.first.m === 2) {
            toastMsg = l.referral_bitcoin_update_success;
        }

        self.$rdmUI.removeClass('arrange-to-back');
        showToast('settings', toastMsg);
        $('#affi-save-bitcoin, #affi-save-info', self.$rdmUI).prop('checked', false);
    });
};

class MegaGesture {

    constructor(options) {

        this.options = options;
        this.touchDistance = 0;
        this.minSwipeDistanceX = options.minSwipeDistanceX || 250 / window.devicePixelRatio;
        this.minSwipeDistanceY = options.minSwipeDistanceY || 250 / window.devicePixelRatio;

        const body = options.iframeDoc ? options.iframeDoc.body : document.body;

        this._rgOpt = {capture: true};
        this._registerGesture = () => {
            body.removeEventListener('touchstart', this._registerGesture, this._rgOpt);

            if (!this.domNode || !this.domNode.megaGesture) {

                if ((this.domNode = this.domNode || this.options.domNode || false).parentNode ||
                     this.domNode === this.options.iframeDoc) {

                    this.domNode.addEventListener('touchend', this);
                    this.domNode.addEventListener('touchstart', this);
                    this.domNode.addEventListener('touchmove', this, {passive: false});

                    this.domNode.megaGesture = true;
                }
                else if (d) {
                    console.warn('MegaGesture initialization failed.', this.domNode, [this]);
                }
            }
        };
        body.addEventListener('touchstart', this._registerGesture, this._rgOpt);
    }

    // This is the handleEvent method, it will be called for each event listener
    handleEvent(event) {
        this[`_handle${event.type}`](event);
    }

    _handletouchstart(ev) {

        this.action = null;
        this.activeScroll = false;

        switch (ev.touches.length) {

            case 1:
                this._handleOneTouchStart(ev);
                break;
            case 2:
                this._handleTwoTouchStart(ev);
                break;
        }

        if (typeof this.options.onTouchStart === 'function') {
            this.options.onTouchStart(ev);
        }
    }

    _handleOneTouchStart(ev) {

        const touch = ev.touches[0];

        this.xStart = touch.clientX;
        this.yStart = touch.clientY;

        // Set real scroll nodes if `options.scrollNodes` is passed
        this.activeScroll = this._getActiveScrollNodes(ev);
    }

    _getActiveScrollNodes(ev) {

        if (!this.domNode || typeof this.options.scrollNodes !== 'object'
            || !(this.options.scrollNodes.x || this.options.scrollNodes.y)) {
            return false;
        }

        const xScrollNodes = [].concat(this.options.scrollNodes.x || []);
        const yScrollNodes = [].concat(this.options.scrollNodes.y || []);

        // Get real scrollable area in flexbox layout mode
        const _getScrollableArea = (scrollNodeX, scrollNodeY, node, res) => {

            if (typeof node !== 'object') {
                return false;
            }

            res = res || Object.create(null);

            // Return X scroll node If scrolling exists and the node is not "inline"
            if (scrollNodeX && node.scrollWidth > node.clientWidth && node.clientWidth !== 0) {
                res.x = node;
            }

            // Return y scroll node If scrolling exists and the node is not "inline"
            if (scrollNodeY && node.scrollHeight > node.clientHeight && node.clientHeight !== 0) {
                res.y = node;
            }

            // We got all we want let's get out of here
            if ((!!scrollNodeX === !!res.x || scrollNodeX === node)
                && (!!scrollNodeY === !!res.y || scrollNodeY === node)) {
                return res;
            }

            // Check parent node for scrolling
            return _getScrollableArea(scrollNodeX, scrollNodeY, node.parentNode, res);
        };

        let xNode;
        let yNode;

        // Set real active X scroll node
        for (var i = xScrollNodes.length; i--;) {
            if (xScrollNodes[i].contains(ev.target)) {
                xNode = xScrollNodes[i];
                break;
            }
        }

        // Set real active Y scroll node
        for (var j = yScrollNodes.length; j--;) {
            if (yScrollNodes[j].contains(ev.target)) {
                yNode = yScrollNodes[j];
                break;
            }
        }

        return _getScrollableArea(xNode, yNode, ev.target);
    }

    _handleTwoTouchStart(ev) {

        this.xStart = null;
        this.yStart = null;

        const ft = ev.touches[0];
        const st = ev.touches[1];

        this.touchDistance = Math.hypot(ft.clientX - st.clientX, ft.clientY - st.clientY);
    }

    _handletouchmove(ev) {

        switch (ev.touches.length) {

            case 1:
                this._handleOneTouchMove(ev);
                break;
            case 2:
                this._handleTwoTouchMove(ev);
                break;
        }
    }

    _handleOneTouchMove(ev) {

        this._handleScrollEvent(ev);

        if (!this.action && typeof this.options.onTouchMove === 'function') {
            this.options.onTouchMove(ev);
        }
    }

    _handleScrollEvent(ev) {

        if (this.action || !(this.activeScroll && (this.activeScroll.x || this.activeScroll.y))) {
            return false;
        }

        const touch = ev.changedTouches && ev.changedTouches[0] || false;
        let diff = 0;
        let clientSize = 0;
        let scrollStart = 0;
        let scrollSize = 0;

        if (this.activeScroll.x) {
            diff = this.xStart - touch.clientX;
            clientSize = this.activeScroll.x.clientWidth;
            scrollStart = this.activeScroll.x.scrollLeft;
            scrollSize = this.activeScroll.x.scrollWidth;
        }
        else {
            diff = this.yStart - touch.clientY;
            clientSize = this.activeScroll.y.clientHeight;
            scrollStart = this.activeScroll.y.scrollTop;
            scrollSize = this.activeScroll.y.scrollHeight;
        }

        // Prevent swipting when scroll positions are not on block edges
        if (scrollStart > 0 && diff < 0
            || scrollSize > clientSize + Math.ceil(scrollStart + 1) && diff > 0) {

            this.action = 'onScroll';
        }
    }

    _handleTwoTouchMove(ev) {

        const prevTouchDistance = this.touchDistance;
        const ft = ev.touches[0];
        const st = ev.touches[1];

        this.touchDistance = Math.hypot(ft.clientX - st.clientX, ft.clientY - st.clientY);

        // Prevent swipe gestures
        this.action = 'pinchZoom';

        if (typeof this.options.onPinchZoom === 'function') {

            // Prevent native
            ev.preventDefault();

            this.options.onPinchZoom(ev, this.touchDistance / prevTouchDistance);
        }
    }

    _handletouchend(ev) {

        if (typeof this.options.onTouchEnd === 'function') {
            this.options.onTouchEnd(ev);
        }

        // if other action is already taken ignore this
        if (this.action) {

            ev.stopPropagation();

            return;
        }

        const touch = ev.changedTouches && ev.changedTouches[0] || false;

        const xNext = touch.clientX;
        const yNext = touch.clientY;

        const xDiff = this.xStart - xNext;
        const yDiff = this.yStart - yNext;

        if (Math.abs(xDiff) > Math.abs(yDiff)) {

            if (xDiff > this.minSwipeDistanceX) {
                this.action = 'onSwipeLeft';
            }
            else if (xDiff < -this.minSwipeDistanceX) {
                this.action = 'onSwipeRight';
            }
            else if (Math.abs(xDiff) > 2 || Math.abs(yDiff) > 2) {
                this.action = 'onDragging';
            }
        }
        else if (yDiff > this.minSwipeDistanceY) {
            this.action = 'onSwipeUp';
        }
        else if (yDiff < -this.minSwipeDistanceY) {
            this.action = 'onSwipeDown';
        }
        else if (Math.abs(xDiff) > 2 || Math.abs(yDiff) > 2) {
            this.action = 'onDragging';
        }

        this.xStart = null;
        this.yStart = null;

        if (this.action && typeof this.options[this.action] === 'function') {

            tryCatch(() => this.options[this.action](ev))();

            // Stop other touch event or another gesture
            ev.stopPropagation();
        }

        this.action = null;
        this.activeScroll = false;
        this.touchDistance = 0;
    }

    destroy() {
        // Clear first init touchstart listener if megaGeture has not been fired previously
        document.body.removeEventListener('touchstart', this._registerGesture, this._rgOpt);

        if (this.domNode) {
            this.domNode.removeEventListener('touchstart', this);
            this.domNode.removeEventListener('touchmove', this);
            this.domNode.removeEventListener('touchend', this);
            delete this.domNode.megaGesture;
        }
    }
}

mBroadcaster.once('startMega:mobile', () => {
    'use strict';

    if (is_touchable) {

        mega.ui.mainlayoutGesture = new MegaGesture({
            get domNode() {
                return mainlayout;
            },
            onSwipeLeft: () => history.forward(),
            onSwipeRight: () => history.back()
        });
    }
});

lazy(window, 'is_touchable', () => {

    'use strict';

    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
});
