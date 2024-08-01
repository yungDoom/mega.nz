/* Bundle Includes:
 *   js/attr.js
 *   js/ui/nicknames.js
 *   js/mega.js
 *   js/megaPromise.js
 *   js/reqstatclient.js
 *   js/mDB.js
 *   js/mouse.js
 *   js/datastructs.js
 *   js/idbkvstorage.js
 *   js/sharedlocalkvstorage.js
 *   js/tlvstore.js
 *   js/vendor/nacl-fast.js
 */

/**
 * mega.attr.* related code
 */

(function _userAttributeHandling(global) {
    "use strict";

    var ns = Object.create(null);
    var _inflight = Object.create(null);
    var logger = MegaLogger.getLogger('user-attribute');
    var ATTRIB_CACHE_NON_CONTACT_EXP_TIME = 2 * 60 * 60;
    var REVOKE_INFLIGHT = !1; // Lyubo is not happy so disabled for now :)

    var ATTR_REQ_CHANNEL = {
        '*keyring': 6,
        '*!authring': 6,
        '*!authRSA': 6,
        '*!authCu255': 6,
        '+puCu255': 6,
        '+sigCu255': 6,
        '+puEd255': 6,
        '+sigPubk': 6
    };
    const DEBUG = window.d > 2;

    // Attribute types (scope)
    ns.PUBLIC = 1;
    ns.PRIVATE = -1;
    ns.PRIVATE_UNENCRYPTED = -2;

    /**
     * Assemble property name on Mega API.
     *
     * @private
     * @param attribute {String}
     *     Name of the attribute.
     * @param pub {Boolean|Number}
     *     True for public attributes (default: true).
     *     -1 for "system" attributes (e.g. without prefix)
     *     -2 for "private non encrypted attributes"
     *     False for private encrypted attributes
     * @param nonHistoric {Boolean}
     *     True for non-historic attributes (default: false).  Non-historic attributes will overwrite the value, and
     *     not retain previous values on the API server.
     * @param encodeValues {Boolean|undefined}
     *     If true, the object's values will be encoded to a UTF-8 byte array (Uint8Array) then encoded as a
     *     String containing 8 bit representations of the bytes before being passed to the TLV encoding/encrypting
     *     library. This is useful if the values contain special characters. The SDK is compatible with reading these.
     * @return {String}
     */
    var buildAttribute = ns._buildAttribute = function (attribute, pub, nonHistoric, encodeValues) {

        if (encodeValues) {
            attribute = '>' + attribute;
        }

        if (nonHistoric === true || nonHistoric === 1) {
            attribute = '!' + attribute;
        }

        if (pub === true || pub === undefined) {
            attribute = '+' + attribute;
        }
        else if (pub === -2) {
            attribute = '^' + attribute;
        }
        else if (pub !== -1) {
            attribute = '*' + attribute;
        }

        return attribute;
    };

    /**
     * Assemble property name for database.
     *
     * @private
     * @param userHandle {String}
     *     Mega's internal user handle.
     * @param attribute {String}
     *     Name of the attribute.
     * @return {String}
     */
    var buildCacheKey = ns._buildCacheKey = function(userHandle, attribute) {
        return userHandle + "_" + attribute;
    };

    /**
     * Revoke a pending attribute retrieval if it gets overwritten/invalidated meanwhile.
     * @param {String} cacheKey The key obtained from buildCacheKey()
     * @returns {Boolean} Whether it was revoked
     * @private
     */
    var revokeRequest = function(cacheKey) {
        if (_inflight[cacheKey]) {
            if (REVOKE_INFLIGHT) {
                if (DEBUG) {
                    logger.info('Revoking Inflight Request...', cacheKey);
                }
                _inflight[cacheKey].revoked = true;
            }
            else if (DEBUG) {
                logger.info('Invalidating Inflight Request...', cacheKey);
            }
            delete _inflight[cacheKey];
            return true;
        }
        return false;
    };

    /**
     * Converts an object with key/value pairs where the values may have special characters (Javascript stores strings
     * as UTF-16) which may take up 2+ bytes. First it converts the values to UTF-8 encoding, then encodes those bytes
     * to their 8 bit string representation. This object can then be sent directly to the TLV encoding library and
     * encrypted as each string character is 8 bits.
     * @param {Object} attribute An object with key/value pairs, the values being either ASCII strings or regular
     *                           JavaScript Strings with UTF-16 characters
     * @returns {Object} Returns the object with converted values
     * @deprecated
     * @see {@link tlvstore.encrypt} / {@link tlvstore.decrypt}
     */
    ns.encodeObjectValues = function(attribute) {

        var encodedAttribute = {};
        var encoder = new TextEncoder('utf-8');

        Object.keys(attribute).forEach(function(key) {

            // Encode to UTF-8 and store as Uint8Array bytes
            var value = attribute[key];
            var byteArray = encoder.encode(value);
            var encodedString = '';

            // Encode from bytes back to String in 8 bit characters
            for (var i = 0; i < byteArray.length; i++) {
                encodedString += String.fromCharCode(byteArray[i]);
            }

            // Store the encoded string
            encodedAttribute[key] = encodedString;
        });

        return encodedAttribute;
    };

    /**
     * Converts an object's values (with key/value pairs where the values have 8 bit characters) back to a byte array
     * then converts that back to its normal JavaScript string representation
     * @param {Object} attribute An object with key/value pairs
     * @returns {Object} Returns the object with converted values
     * @deprecated
     * @see {@link tlvstore.encrypt} / {@link tlvstore.decrypt}
     */
    ns.decodeObjectValues = function(attribute) {

        var decodedAttribute = {};
        var decoder = new TextDecoder('utf-8');

        Object.keys(attribute).forEach(function(key) {

            var value = attribute[key];
            var decodedBytes = [];

            // Encode from 8 bit characters back to bytes
            for (var i = 0; i < value.length; i++) {
                decodedBytes.push(value.charCodeAt(i));
            }

            // Create Uint8Array for the TextDecoder then decode
            var byteArray = new Uint8Array(decodedBytes);
            var regularString = decoder.decode(byteArray);

            // Store the decoded string
            decodedAttribute[key] = regularString;
        });

        return decodedAttribute;
    };

    /**
     * Retrieves a user attribute.
     *
     * @param userhandle {String}
     *     Mega's internal user handle.
     * @param attribute {String}
     *     Name of the attribute.
     * @param pub {Boolean|Number}
     *     True for public attributes (default: true).
     *     -1 for "system" attributes (e.g. without prefix)
     *     -2 for "private non encrypted attributes"
     *     False for private encrypted attributes
     * @param nonHistoric {Boolean}
     *     True for non-historic attributes (default: false).  Non-historic
     *     attributes will overwrite the value, and not retain previous
     *     values on the API server.
     * @param callback {Function}
     *     Callback function to call upon completion (default: none).
     * @param ctx {Object}
     *     Context, in case higher hierarchies need to inject a context
     *     (default: none).
     * @param chathandle {String} pass chathandle in case this is an anonymous user previewing a specific pub chat
     * @param decodeValues {Boolean|undefined}
     *     If true, the object's values will be decoded from String containing 8 bit representations of bytes to a
     *     UTF-8 byte array then decoded back to regular JavaScript Strings (UTF-16). This is useful if the values
     *     contain special characters. The SDK is compatible with reading these.
     *
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     *     Can be used to use promises instead of callbacks for asynchronous
     *     dependencies.
     */
    ns.get = function _getUserAttribute(
            userhandle, attribute, pub, nonHistoric, callback, ctx, chathandle, decodeValues) {

        if (typeof userhandle !== 'string' || base64urldecode(userhandle).length !== 8) {
            return MegaPromise.reject(EARGS);
        }
        attribute = buildAttribute(attribute, pub, nonHistoric, decodeValues);

        // Prevent firing API requests when API already gave the attribute value with 'ug'
        if ((attribute[0] === '^' || attribute[0] === '+') && userhandle in M.u) {

            const data = Object(window.u_attr).u === userhandle && u_attr[attribute]
                || M.getUserByHandle(userhandle)[attribute];

            if (data) {
                if (DEBUG) {
                    logger.info('Attribute "%s" supplied from memory.', buildCacheKey(userhandle, attribute));
                }
                if (callback) {
                    callback(data, {u: userhandle, ua: attribute});
                }
                return MegaPromise.resolve(data);
            }
        }

        var self = this;
        var myCtx = ctx || {};
        var args = toArray.apply(null, arguments);

        // Assemble property name on Mega API.
        var cacheKey = buildCacheKey(userhandle, attribute);

        if (_inflight[cacheKey]) {
            if (DEBUG) {
                logger.warn('Attribute retrieval "%s" already pending,...', cacheKey);
            }
            return _inflight[cacheKey];
        }

        // Make the promise to execute the API code.
        var thePromise = new MegaPromise();
        _inflight[cacheKey] = thePromise;

        /**
         * Check whether the request was revoked meanwhile and pipe it to retrieve fresh data
         * @returns {Boolean}
         * @private
         */
        var isRevoked = function() {
            if (thePromise.revoked) {
                logger.info('Attribute retrieval got revoked...', cacheKey);

                if (_inflight[cacheKey]) {
                    logger.info('Another inflight request got set for "%s", reusing for revoked one.', cacheKey);
                }

                thePromise.linkDoneAndFailTo(_inflight[cacheKey] || mega.attr.get.apply(mega.attr, args));
                return true;
            }
            return false;
        };

        /**
         * mega.attr.get::settleFunctionDone
         *
         * Fullfill the promise with the result/attribute value from either API or cache.
         *
         * @param {Number|Object} res    The result/attribute value.
         * @param {Boolean} cached Whether it came from cache.
         */
        var settleFunctionDone = function _settleFunctionDone(res, cached) {
            var tag = cached ? 'Cached ' : '';
            res = Object(res).hasOwnProperty('av') ? res.av : res;

            // Another conditional, the result value may have been changed.
            if (typeof res !== 'number') {

                // If it's a private attribute container
                if (attribute.charAt(0) === '*') {

                    // Base64 URL decode, decrypt and convert back to object key/value pairs
                    res = self.handleLegacyCacheAndDecryption(res, thePromise, attribute);

                    // If the decodeValues flag is on, decode the 8 bit chars in the string to a UTF-8 byte array then
                    // convert back to a regular JavaScript String (UTF-16)
                    if (attribute[1] === '>' || attribute[2] === '>') {
                        res = self.decodeObjectValues(res);
                    }
                }

                // Otherwise if a non-encrypted private attribute, base64 decode the data
                else if (attribute.charAt(0) === '^') {
                    res = base64urldecode(res);
                }

                if (DEBUG || is_karma) {
                    var loggerValueOutput = pub ? JSON.stringify(res) : '-- hidden --';
                    if (loggerValueOutput.length > 256) {
                        loggerValueOutput = loggerValueOutput.substr(0, 256) + '...';
                    }
                    logger.info(tag + 'Attribute "%s" for user "%s" is %s.',
                        attribute, userhandle, loggerValueOutput);
                }
                thePromise.resolve(res);
            }
            else {
                // Got back an error (a number).
                if (DEBUG || is_karma) {
                    logger.warn(tag + 'attribute "%s" for user "%s" could not be retrieved: %d!',
                        attribute, userhandle, res);
                }
                thePromise.reject(res);
            }

            // remove pending promise cache
            console.assert(!isRevoked(), 'The attribute retrieval should not have been revoked at this point...');
            delete _inflight[cacheKey];

            // Finish off if we have a callback.
            if (callback) {
                callback(res, myCtx);
            }
        };

        /**
         * mega.attr.get::settleFunction
         *
         * Process result from `uga` API request, and cache it.
         *
         * @param {Number|Object} res The received result.
         */
        var settleFunction = function _settleFunction(res) {
            if (isRevoked()) {
                return;
            }

            // v3-style reply?..
            if (Array.isArray(res)) {
                if (res.length === 2) {
                    const [st, result] = res;

                    if (typeof st !== 'number') {
                        logger.warn(`Unexpected 'st' for %s...`, attribute, res);
                        res = result;
                    }
                    else if (st === 0) {
                        res = result;
                    }
                    else {
                        logger.warn('Got v3-style error for %s...', attribute, res);
                        res = st;
                    }
                }
                else {
                    logger.error('Unexpected response for %s...', attribute, res);
                }
            }

            // Cache all returned values, except errors other than ENOENT
            if (typeof res !== 'number' || res === ENOENT) {
                var exp = 0;
                // Only add cache expiration for attributes of non-contacts, because
                // contact's attributes would be always in sync (using actionpackets)
                if (userhandle !== u_handle && (!M.u[userhandle] || M.u[userhandle].c !== 1)) {
                    exp = unixtime();
                }
                attribCache.setItem(cacheKey, JSON.stringify([res, exp]));

                if (res.v) {
                    self._versions[cacheKey] = res.v;
                }
            }

            settleFunctionDone(res);
        };

        // Assemble context for this async API request.
        myCtx.u = userhandle;
        myCtx.ua = attribute;
        myCtx.callback = settleFunction;

        /**
         * mega.attr.get::doApiReq
         *
         * Perform a `uga` API request If we are unable to retrieve the entry
         * from the cache. If a MegaPromise is passed as argument, we'll wait
         * for it to complete before firing the api rquest.
         *
         * settleFunction will be used to process the api result.
         *
         * @param {MegaPromise|Number} [promise] Optional promise to wait for.
         */
        var doApiReq = function _doApiReq(promise) {
            if (isRevoked()) {
                if (promise === -0xdeadbeef) {
                    logger.warn('Attribute "%s" got revoked while removing a cached entry!', cacheKey);
                }
                return;
            }
            if (promise instanceof MegaPromise) {
                promise.always(function() {
                    doApiReq(-0xdeadbeef);
                });
            }
            else {
                if (chathandle) {
                    api_req(
                        {'a': 'mcuga', "ph": chathandle, 'u': userhandle, 'ua': attribute, 'v': 1},
                        myCtx,
                        ATTR_REQ_CHANNEL[attribute]
                    );
                }
                else {
                    api_req(
                        {'a': 'uga', 'u': userhandle, 'ua': attribute, 'v': 1},
                        myCtx,
                        ATTR_REQ_CHANNEL[attribute]
                    );
                }
            }
        };

        // check the cache first!
        attribCache.getItem(cacheKey)
            .fail(doApiReq)
            .done(function __attribCacheGetDone(v) {
                var result;

                if (isRevoked()) {
                    return;
                }

                try {
                    var res = JSON.parse(v);

                    if ($.isArray(res)) {
                        var exp = res[1];

                        // Pick the cached entry as long it has no expiry or it hasn't expired
                        if (!exp || exp > (unixtime() - ATTRIB_CACHE_NON_CONTACT_EXP_TIME)) {
                            if (res[0].av) {
                                result = res[0].av;
                                if (res[0].v) {
                                    self._versions[cacheKey] = res[0].v;
                                }
                            }
                            else {
                                // legacy support, e.g. for cached attribute values
                                result = res[0];
                            }
                        }
                    }
                }
                catch (ex) {
                    logger.error(ex);
                }

                if (result === undefined) {
                    doApiReq(attribCache.removeItem(cacheKey));
                }
                else {
                    settleFunctionDone(result, true);
                }
            });

        return thePromise;
    };

    /**
     * Removes a user attribute for oneself.
     * Note: THIS METHOD IS LEFT HERE FOR DEVELOPMENT AND TESTING PURPOSES, PLEASE DON'T USE FOR PRODUCTION FEATURES.
     *
     * @deprecated
     *
     * @param attribute {string}
     *     Name of the attribute.
     * @param pub {Boolean|Number}
     *     True for public attributes (default: true).
     *     -1 for "system" attributes (e.g. without prefix)
     *     -2 for "private non encrypted attributes"
     *     False for private encrypted attributes
     * @param nonHistoric {bool}
     *     True for non-historic attributes (default: false).  Non-historic
     *     attributes will overwrite the value, and not retain previous
     *     values on the API server.
     * @param encodeValues {Boolean|undefined}
     *     If true and used in combination with the private/encrypted flag (* attribute), the object's values will be
     *     encoded to UTF-8 as a byte array (Uint8Array) then encoded as a String containing the 8 bit representations
     *     of the bytes before being passed to the TLV encoding/encrypting functions. These functions will convert
     *     these 8 bit strings back to bytes before encryption. This feature is useful if the object values contain
     *     special characters. The SDK is compatible with reading these attributes.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     */
    ns.remove = promisify(function(resolve, reject, attribute, pub, nonHistoric, encodeValues) {
        if (arguments.length > 3) {
            attribute = buildAttribute(attribute, pub, nonHistoric, encodeValues);
        }
        var cacheKey = buildCacheKey(u_handle, attribute);

        if (d) {
            console.warn("Removing attribute %s, I really hope you know what you are doing!", attribute);
        }

        if (attribute[0] === '^') {
            delete u_attr[attribute];
        }

        attribCache.removeItem(cacheKey)
            .always(() => {
                api.screq({a: 'upr', ua: attribute, v: 1})
                    .then(({result}) => {

                        if (this._versions[cacheKey] && typeof result === 'string') {
                            this._versions[cacheKey] = result;
                        }
                        logger.info(`Removed user attribute "%s", result: ${result}`, attribute);
                        resolve(result);
                    })
                    .catch((ex) => {
                        logger.warn('Error removing user attribute "%s", result: %s!', attribute, ex);
                        reject(ex);
                    })
                    .finally(() => {
                        // Revoke pending attribute retrieval, if any.
                        revokeRequest(cacheKey);
                    });
            });
    });

    // @private set2 helper
    ns.set2response = function(attribute, res) {
        let error = typeof res === 'number' || res instanceof Error;
        if (!error) {
            const {result} = res.batch ? res.batch.pop() : res;

            res = result;
            error = typeof result === 'number' && result < 0;
        }
        if (error) {
            logger.warn(`Error setting user attribute "${attribute}", result: ${res}!`);
            throw res;
        }

        return res;
    };

    // send commands and attribute updates in batched mode
    // @see {@link mega.attr.set}
    ns.set2 = async function(cmds, attribute, value, pub, nonHistoric, useVersion, options) {
        let savedValue = value;
        const attrName = attribute;

        options = {
            utf8: false,
            mode: tlvstore.BLOCK_ENCRYPTION_SCHEME.AES_GCM_12_16,
            ...options
        };
        attribute = buildAttribute(attribute, pub, nonHistoric, options.utf8);

        if (attribute[0] === '^') {
            savedValue = base64urlencode(value);
        }
        else if (attribute[0] === '*') {
            savedValue = tlvstore.encrypt(value, options.utf8, u_k, options.mode);
        }
        const cacheKey = buildCacheKey(u_handle, attribute);

        revokeRequest(cacheKey);
        attribCache.removeItem(cacheKey, false);

        const req = {a: 'up', [attribute]: savedValue};

        if (useVersion) {
            let version = this._versions[cacheKey];

            if (!version) {
                await Promise.resolve(this.get(u_handle, attrName, pub, nonHistoric)).catch(nop);

                version = this._versions[cacheKey];
            }

            req[attribute] = version ? [savedValue, version] : [savedValue];
            req.a = 'upv';
        }

        if (cmds && !Array.isArray(cmds)) {
            cmds = [cmds];
        }
        let res = await api.screq(cmds ? [...cmds, req] : req).catch(echo);

        if (res === EEXPIRED && useVersion && this._conflictHandlers[attribute]) {
            logger.error(
                `Server returned version conflict for attribute "${attribute}"`, this._versions[cacheKey]
            );
            attribCache.removeItem(cacheKey, false);

            const attrVal = await this.get(u_handle, attrName, pub, nonHistoric, false, false, false, options.utf8);
            const valObj = {
                localValue: value,
                mergedValue: value,
                remoteValue: attrVal,
                latestVersion: this._versions[cacheKey]
            };
            const matched = this._conflictHandlers[attribute].some((cb, index) => cb(valObj, index));

            if (matched) {
                res = await this.set2(attrName, valObj.mergedValue, pub, nonHistoric, true, options);
            }
        }
        const result = this.set2response(attribute, res);

        attribCache.setItem(cacheKey, JSON.stringify([{av: savedValue, v: result[attribute]}, 0]));
        if (result[attribute]) {
            this._versions[cacheKey] = result[attribute];
        }
        logger.info(`Setting user attribute "${attribute}"`, result, [res]);

        return res;
    };

    /**
     * Stores a user attribute for oneself.
     *
     * @param attribute {string}
     *     Name of the attribute. The max length is 16 characters. Note that the SDK only reads the first 8 chars. Also
     *     note that the prefix characters such as *, +, ^, ! or > may be added so usually you have less to work with.
     * @param value {object}
     *     Value of the user attribute. Public properties are of type {string},
     *     private ones have to be an object with key/value pairs.
     * @param pub {Boolean|Number}
     *     True for public attributes (default: true).
     *     -1 for "system" attributes (e.g. without prefix)
     *     -2 for "private non encrypted attributes"
     *     False for private encrypted attributes
     * @param nonHistoric {Boolean}
     *     True for non-historic attributes (default: false).  Non-historic
     *     attributes will overwrite the value, and not retain previous
     *     values on the API server.
     * @param callback {Function}
     *     Callback function to call upon completion (default: none). This callback
     *     function expects two parameters: the attribute `name`, and its `value`.
     *     In case of an error, the `value` will be undefined.
     * @param ctx {Object}
     *     Context, in case higher hierarchies need to inject a context
     *     (default: none).
     * @param mode {Integer|undefined}
     *     Encryption mode. One of tlvstore.BLOCK_ENCRYPTION_SCHEME (to use default AES_GCM_12_16 pass undefined).
     * @param useVersion {Boolean|undefined}
     *     If true is passed, 'upv' would be used instead of 'up' (which means that conflict handlers and all
     *     versioning logic may be used for setting this attribute)
     * @param encodeValues {Boolean|undefined}
     *     If true and used in combination with the private/encrypted flag (* attribute), the object's values will be
     *     encoded to UTF-8 as a byte array (Uint8Array) then encoded as a String containing the 8 bit representations
     *     of the bytes before being passed to the TLV encoding/encrypting functions. These functions will convert
     *     these 8 bit strings back to bytes before encryption. This feature is useful if the object values contain
     *     special characters. The SDK is compatible with reading these attributes.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     *     Can be used to use promises instead of callbacks for asynchronous
     *     dependencies.
     * @deprecated
     */
    ns.set = function _setUserAttribute(
            attribute, value, pub, nonHistoric, callback, ctx, mode, useVersion, encodeValues) {

        var self = this;
        var myCtx = ctx || {};
        var savedValue = value;
        var attrName = attribute;

        // Prepare all data needed for the call on the Mega API.
        if (mode === undefined) {
            mode = tlvstore.BLOCK_ENCRYPTION_SCHEME.AES_GCM_12_16;
        }

        // Format to get the right prefixes
        attribute = buildAttribute(attribute, pub, nonHistoric, encodeValues);

        // If encrypted/private attribute, the value should be a key/value property container
        if (attribute[0] === '*') {

            // If encode flag is on, encode the object values to UTF-8 then 8 bit strings so TLV blockEncrypt can parse
            if (attribute[1] === '>' || attribute[2] === '>') {
                value = self.encodeObjectValues(value);
            }

            // Encode to TLV, encrypt it then Base64 URL encode it so it can be stored API side
            savedValue = base64urlencode(
                tlvstore.blockEncrypt(
                    tlvstore.containerToTlvRecords(value), u_k, mode, false
                )
            );
        }

        // Otherwise if a non-encrypted private attribute, base64 encode the data
        else if (attribute[0] === '^') {
            savedValue = base64urlencode(value);
        }

        // Make the promise to execute the API code.
        var thePromise = new MegaPromise();

        var cacheKey = buildCacheKey(u_handle, attribute);

        // Revoke pending attribute retrieval, if any.
        revokeRequest(cacheKey);

        // clear when the value is being sent to the API server, during that period
        // the value should be retrieved from the server, because of potential
        // race conditions
        attribCache.removeItem(cacheKey, false);

        var settleFunction = function(res) {
            if (typeof res !== 'number') {
                attribCache.setItem(cacheKey, JSON.stringify([{"av": savedValue, "v": res[attribute]}, 0]));
                if (res[attribute]) {
                    self._versions[cacheKey] = res[attribute];
                }

                logger.info('Setting user attribute "'
                    + attribute + '", result: ' + res);
                thePromise.resolve(res);
            }
            else {
                if (res === EEXPIRED && useVersion) {
                    var conflictHandlerId = attribute;

                    if (
                        !self._conflictHandlers[conflictHandlerId] ||
                        self._conflictHandlers[conflictHandlerId].length === 0
                    ) {
                        logger.error('Server returned version conflict for attribute "'
                            + attribute + '", result: ' + res + ', local version:', self._versions[cacheKey]);
                        thePromise.reject(res);
                    }
                    else {
                        // ensure that this attr's value is not cached and up-to-date.
                        attribCache.removeItem(cacheKey, false);

                        self.get(
                            u_handle,
                            attrName,
                            pub,
                            nonHistoric,
                            false,
                            false,
                            false,
                            encodeValues
                        )
                            .done(function(attrVal) {
                                var valObj = {
                                    'localValue': value,
                                    'remoteValue': attrVal,
                                    'mergedValue': value,
                                    'latestVersion': self._versions[cacheKey]
                                };

                                var matched = self._conflictHandlers[conflictHandlerId].some(function(cb, index) {
                                    return cb(valObj, index);
                                });

                                if (matched) {
                                    thePromise.linkDoneAndFailTo(
                                        self.set(
                                            attrName,
                                            valObj.mergedValue,
                                            pub,
                                            nonHistoric,
                                            callback,
                                            ctx,
                                            mode,
                                            useVersion,
                                            encodeValues
                                        )
                                    );
                                }

                            })
                            .fail(function(failResult) {
                                logger.error(
                                    "This should never happen:", attribute, res, failResult, self._versions[cacheKey]
                                );
                                thePromise.reject(failResult);
                            });
                    }

                }
                else {
                    logger.warn('Error setting user attribute "'
                        + attribute + '", result: ' + res + '!');
                    thePromise.reject(res);
                }
            }

            // Finish off if we have a callback.
            if (callback) {
                callback(res, myCtx);
            }
        };

        if (window.is_chatlink) {
            switch (attrName) {
                case 'authRSA':
                case 'authring':
                case 'authCu255':
                    if (d) {
                        logger.warn('Leaving attribute "%s" into memory-only mode.', attribute);
                    }
                    // @todo smartly sync/merge those attributes when the (full reg.) user moves away from the chat-link
                    queueMicrotask(() => settleFunction([]));
                    return thePromise;
            }
        }

        // Assemble context for this async API request.
        myCtx.ua = attribute;
        myCtx.callback = settleFunction;


        // Fire it off.
        var apiCall = {'a': 'up', 'i': requesti};

        if (useVersion) {
            var version = self._versions[cacheKey];

            apiCall['a'] = 'upv';
            if (version) {
                apiCall[attribute] = [
                    savedValue,
                    version
                ];

                api_req(apiCall, myCtx, ATTR_REQ_CHANNEL[attribute]);
            }
            else {
                // retrieve version/data from cache or server?
                self.get(u_handle, attrName, pub, nonHistoric).always(function() {
                    version = self._versions[cacheKey];

                    apiCall['a'] = 'upv';
                    if (version) {
                        apiCall[attribute] = [
                            savedValue,
                            version
                        ];
                    }
                    else {
                        apiCall[attribute] = [
                            savedValue
                        ];
                    }
                    api_req(apiCall, myCtx, ATTR_REQ_CHANNEL[attribute]);
                });

            }
        }
        else {
            apiCall[attribute] = savedValue;

            api_req(apiCall, myCtx, ATTR_REQ_CHANNEL[attribute]);
        }


        return thePromise;
    };

    ns._versions = Object.create(null);
    ns._conflictHandlers = Object.create(null);

    ns.registerConflictHandler = function (attributeName, pub, nonHistoric, encodeValues, mergeFn) {
        var attributeId = buildAttribute(attributeName, pub, nonHistoric, encodeValues);

        if (!this._conflictHandlers[attributeId]) {
            this._conflictHandlers[attributeId] = [];
        }
        this._conflictHandlers[attributeId].push(mergeFn);
    };

    /**
     * An internal list of queued setArrayAttribute operations
     *
     * @type {Array}
     * @private
     */
    ns._queuedSetArrayAttributeOps = [];


    /**
     * QueuedSetArrayAttribute is used to represent an instance of a "set" op in an queue of QueuedSetArrayAttribute's.
     * Every QueuedSetArrayAttribute can contain multiple changes to multiple keys.
     * This is done transparently in mega.attr.setArrayAttribute.
     *
     * @private
     * @param {String} attr - see mega.attr.setArrayAttribute
     * @param {String} attributeName see mega.attr.setArrayAttribute
     * @param {String} k initial k to be changed
     * @param {String} v initial value to be used for the change
     * @param {String} pub see mega.attr.setArrayAttribute
     * @param {String} nonHistoric see mega.attr.setArrayAttribute
     * @constructor
     */
    var QueuedSetArrayAttribute = function(attr, attributeName, k, v, pub, nonHistoric) {
        var self = this;
        self.attr = attr;
        self.attributeName = attributeName;
        self.pub = pub;
        self.nonHistoric = nonHistoric;
        self.ops = [];
        self.state = QueuedSetArrayAttribute.STATE.QUEUED;

        var proxyPromise = new MegaPromise();
        proxyPromise.always(function() {
            // logger.debug("finished: ", proxyPromise.state(), self.toString());

            self.state = QueuedSetArrayAttribute.STATE.DONE;
            array.remove(self.attr._queuedSetArrayAttributeOps, self);

            if (self.attr._queuedSetArrayAttributeOps.length > 0) {
                // execute now
                self.attr._nextQueuedSetArrayAttributeOp();
            }
        });

        self.queueSubOp(k, v);

        self.promise = proxyPromise;
        self.attr._queuedSetArrayAttributeOps.push(self);
        if (self.attr._queuedSetArrayAttributeOps.length === 1) {
            // execute now
            self.attr._nextQueuedSetArrayAttributeOp();
        }
    };

    QueuedSetArrayAttribute.STATE = {
        'QUEUED': 1,
        'EXECUTING': 2,
        'DONE': 3
    };

    /**
     * Internal method, that is used for adding subOps, e.g. an QueuedSetArrayAttribute can contain multiple
     * changes to a key.
     *
     * @private
     * @param {String} k
     * @param {String} v
     */
    QueuedSetArrayAttribute.prototype.queueSubOp = function(k, v) {
        var self = this;
        self.ops.push([k, v]);
        logger.debug("QueuedSetArrayAttribute queued sub op", k, v, self.toString());
    };

    /**
     * Debugging purposes only
     *
     * @returns {String}
     */
    QueuedSetArrayAttribute.prototype.toString = function() {
        var self = this;

        var setOps = [];

        self.ops.forEach(function(entry) {
            setOps.push(entry[0] + "=" + entry[1]);
        });

        return "QueuedSetArrayAttribute: " + buildAttribute(self.attributeName, self.pub, self.nonHistoric) + "(" +
            setOps.join(",")
            + ")";
    };

    /**
     * Execute this QueuedSetArrayAttribute changes and send them to the server.
     *
     * @returns {MegaPromise|*}
     */
    QueuedSetArrayAttribute.prototype.exec = function() {
        var self = this;

        var proxyPromise = self.promise;
        self.state = QueuedSetArrayAttribute.STATE.EXECUTING;

        logger.debug("QueuedSetArrayAttribute executing: ", self.toString());

        var _setArrayAttribute = function(r) {
            if (r === EINTERNAL) {
                r = {};
            }
            else if (typeof r === 'number') {
                logger.error("Found number value for attribute: ", self.attributeName, " when trying to use it as " +
                    "attribute array. Halting .setArrayAttribute");
                proxyPromise.reject(r);
                return;
            }
            var arr = r ? r : {};
            self.ops.forEach(function(entry) {
                arr[entry[0]] = entry[1];
            });

            var serializedValue = arr;

            proxyPromise.linkDoneAndFailTo(
                self.attr.set(
                    self.attributeName,
                    serializedValue,
                    self.pub,
                    self.nonHistoric,
                    undefined,
                    undefined,
                    undefined,
                    true
                )
            );
        };

        self.attr.get(u_handle, self.attributeName, self.pub, self.nonHistoric)
            .done(function(r) {
                try {
                    if (r === -9) {
                        _setArrayAttribute({});
                        proxyPromise.reject(r);
                    }
                    else {
                        _setArrayAttribute(r);
                    }
                }
                catch (e) {
                    logger.error("QueuedSetArrayAttribute failed, because of exception: ", e);
                    proxyPromise.reject(e, r);
                }
            })
            .fail(function(r) {
                if (r === -9) {
                    try {
                        _setArrayAttribute({});
                    }
                    catch (e) {
                        logger.error("QueuedSetArrayAttribute failed, because of exception: ", e);
                    }
                    proxyPromise.reject(r);
                }
                else {
                    proxyPromise.reject(r);
                }
            });

        return proxyPromise;
    };

    /**
     * Try to execute next op, if such is available.
     *
     * @type {Function}
     * @private
     */
    ns._nextQueuedSetArrayAttributeOp = SoonFc(function() {
        var self = this;
        var found = false;
        self._queuedSetArrayAttributeOps.forEach(function(op) {
            if (!found && op.state === QueuedSetArrayAttribute.STATE.QUEUED) {
                found = op;
            }
        });

        if (found) {
            found.exec();
        }
    }, 75);


    ns.QueuedSetArrayAttribute = QueuedSetArrayAttribute;

    /**
     * Update the value (value) of a specific key (subkey) in an "array attribute".
     * Important note: `setArrayAttribtues` are cleverly throttled to not flood the API, but also, while being queued,
     * multiple .setArrayAttribute('a', ...) -> .setArrayAttribute('a', ...), etc, may be executed in one single API
     * call.
     * For the developer, this is going to be transparently handled, since any .setArrayAttribute returns a promise and
     * that promise would be synced with the internal queueing mechanism, so the only thing he/she needs to take care
     * is eventually define a proper execution flow using promises.
     *
     * @param {String} attributeName see mega.attr.set
     * @param {String} subkey generic
     * @param {String} value generic
     * @param {Integer|undefined|false} pub  see mega.attr.set
     * @param {Integer|undefined|false} nonHistoric  see mega.attr.set
     * @returns {MegaPromise|*}
     */
    ns.setArrayAttribute = function(attributeName, subkey, value, pub, nonHistoric) {
        var self = this;
        var found = false;
        self._queuedSetArrayAttributeOps.forEach(function(op) {
            if (
                !found &&
                op.state === QueuedSetArrayAttribute.STATE.QUEUED &&
                op.attributeName === attributeName &&
                op.pub === pub &&
                op.nonHistoric === nonHistoric
            ) {
                found = op;
            }
        });

        if (found && found.state === QueuedSetArrayAttribute.STATE.QUEUED) {
            found.queueSubOp(subkey, value);
            return found.promise;
        }
        else {
            var op = new QueuedSetArrayAttribute(self, attributeName, subkey, value, pub, nonHistoric);
            return op.promise;
        }
    };

    /**
     * Get a specific `subkey`'s value from an "array attribute"
     *
     * @param {String} userId see mega.attr.get
     * @param {String} attributeName the actual attribtue name
     * @param {String} subkey the actual subkey stored in that array attribute
     * @param {Integer|undefined|false} pub see mega.attr.get
     * @param {Integer|undefined|false} nonHistoric see mega.attr.get
     * @returns {MegaPromise}
     */
    ns.getArrayAttribute = function(userId, attributeName, subkey, pub, nonHistoric) {
        var self = this;

        var proxyPromise = new MegaPromise();

        var $getPromise = self.get(userId, attributeName, pub, nonHistoric)
            .done(function(r) {
                try {
                    var arr = r ? r : {};
                    proxyPromise.resolve(
                        arr[subkey]
                    );
                }
                catch (e) {
                    proxyPromise.reject(e, r);
                }
            });

        proxyPromise.linkFailTo($getPromise);

        return proxyPromise;
    };

    /**
     * Handle BitMap attributes
     *
     * @param attrName
     * @param version
     */
    ns.handleBitMapAttribute = function(attrName, version) {
        var attributeStringName = attrName.substr(2);
        var bitMapInstance = attribCache.bitMapsManager.get(attributeStringName);
        if (bitMapInstance.getVersion() !== version) {
            mega.attr.get(
                u_handle,
                attributeStringName,
                attrName.substr(0, 2) === '+!' ? true : -2,
                true
            ).done(function(r) {
                bitMapInstance.mergeFrom(r, false);
                bitMapInstance.setVersion(version);
                attribCache.setItem(`${u_handle}_${attrName}`, JSON.stringify([bitMapInstance.toString(), 0]));
            });
        }
    };

    /**
     * Handles legacy cache & decryption of attributes that use tlvstore
     *
     * @param {String|Object} res The payload to decrypt.
     * @param {MegaPromise} [thePromise] Promise to signal rejections.
     * @param {String} [attribute] Attribute name we're decrypting.
     * @returns {*} the actual res (if altered)
     * @deprecated
     * @see {@link tlvstore.encrypt} / {@link tlvstore.decrypt}
     */
    ns.handleLegacyCacheAndDecryption = function(res, thePromise, attribute) {
        if (typeof res !== 'object') {
            try {
                var clearContainer = tlvstore.blockDecrypt(
                    base64urldecode(res),
                    u_k
                );
                res = tlvstore.tlvRecordsToContainer(clearContainer, true);

                if (res === false) {
                    throw new Error('TLV Record decoding failed.');
                }
            }
            catch (e) {
                if (d) {
                    logger.error('Could not decrypt private user attribute %s: %s', attribute, e.message, e);
                }
                res = EINTERNAL;

                if (thePromise) {
                    thePromise.reject(res);
                }
            }
        }

        return res;
    };

    var uaPacketParserHandler = Object.create(null);

    /**
     * Process action-packet for attribute updates.
     *
     * @param {String}  attrName          Attribute name
     * @param {String}  userHandle        User handle
     * @param {Boolean} [ownActionPacket] Whether the action-packet was issued by oneself
     * @param {String}  [version]         version, as returned by the API
     */
    ns.uaPacketParser = function uaPacketParser(attrName, userHandle, ownActionPacket, version) {
        var cacheKey = userHandle + "_" + attrName;

        if (this._versions[cacheKey] === version) {
            // dont invalidate if we have the same version in memory.
            return;
        }

        // Revoke pending attribute retrieval, if any.
        revokeRequest(cacheKey);

        logger.debug('uaPacketParser: Invalidating cache entry "%s"', cacheKey);

        // XXX: Even if we're using promises here, this is guaranteed to resolve synchronously atm,
        //      so if this ever changes we'll need to make sure it's properly adapted...

        if (window.u_attr && userHandle === window.u_handle && attrName[0] === '^') {
            delete u_attr[attrName];
        }

        var removeItemPromise = attribCache.removeItem(cacheKey);

        removeItemPromise
            .always(function _uaPacketParser() {
                if (typeof uaPacketParserHandler[attrName] === 'function') {
                    uaPacketParserHandler[attrName](userHandle);
                }
                else if (
                    (attrName.substr(0, 2) === '+!' || attrName.substr(0, 2) === '^!') &&
                    attribCache.bitMapsManager.exists(attrName.substr(2))
                ) {
                    mega.attr.handleBitMapAttribute(attrName, version);
                }
                else if (DEBUG) {
                    logger.debug('uaPacketParser: No handler for "%s"', attrName);
                }
            });

        return removeItemPromise;
    };

    mBroadcaster.once('boot_done', function() {
        uaPacketParserHandler['firstname'] = function(userHandle) {
            if (M.u[userHandle]) {
                M.u[userHandle].firstName = M.u[userHandle].lastName = "";
                M.syncUsersFullname(userHandle);
            }
            else if (d) {
                console.warn('uaPacketParser: Unknown user %s handling first/lastname', userHandle);
            }
        };
        uaPacketParserHandler.lastname = uaPacketParserHandler.firstname;

        uaPacketParserHandler['+a'] = function(userHandle) {
            useravatar.refresh(userHandle).catch(dump);
        };
        uaPacketParserHandler['*!authring'] = function() {
            if (!mega.keyMgr.generation) {
                authring.getContacts('Ed25519');
            }
        };
        uaPacketParserHandler['*!authRSA'] = function() {
            authring.getContacts('RSA');
        };
        uaPacketParserHandler['*!authCu255'] = function() {
            if (!mega.keyMgr.generation) {
                authring.getContacts('Cu25519');
            }
        };
        uaPacketParserHandler['+puEd255'] = function(userHandle) {
            // pubEd25519 key was updated! force fingerprint regen.
            delete pubEd25519[userHandle];
            crypt.getPubEd25519(userHandle);
        };
        uaPacketParserHandler['*!fmconfig'] = function() {
            if (fminitialized) {
                mega.config.fetch().dump('fmconfig.sync');
            }
        };
        uaPacketParserHandler['*!>alias'] = function() {
            nicknames.updateNicknamesFromActionPacket();
        };
        uaPacketParserHandler['birthday'] = function(userHandle) {
            mega.attr.get(userHandle, 'birthday', -1, false, function(res) {
                u_attr['birthday'] = from8(base64urldecode(res));
                if (fminitialized && page === 'fm/account') {
                    accountUI.account.profiles.renderBirthDay();
                }
            });
        };
        uaPacketParserHandler['birthmonth'] = function(userHandle) {
            mega.attr.get(userHandle, 'birthmonth', -1, false, function(res) {
                u_attr['birthmonth'] = from8(base64urldecode(res));
                if (fminitialized && page === 'fm/account') {
                    accountUI.account.profiles.renderBirthMonth();
                }
            });
        };
        uaPacketParserHandler['birthyear'] = function(userHandle) {
            mega.attr.get(userHandle, 'birthyear', -1, false, function(res) {
                u_attr['birthyear'] = from8(base64urldecode(res));
                if (fminitialized && page === 'fm/account') {
                    accountUI.account.profiles.renderBirthYear();
                }
            });
        };
        uaPacketParserHandler['country'] = function(userHandle) {
            mega.attr.get(userHandle, 'country', -1, false, function(res) {
                u_attr['country'] = from8(base64urldecode(res));
                if (fminitialized && page === 'fm/account') {
                    accountUI.account.profiles.renderCountry();
                    accountUI.account.profiles.bindEvents();
                }
            });
        };
        uaPacketParserHandler['^!prd'] = function() {
            mBroadcaster.sendMessage('attr:passwordReminderDialog');
            // if page is session history and new password action detected. update session table.
            if (fminitialized && page === 'fm/account/security' && accountUI.security) {
                accountUI.security.session.update(1);
            }
        };
        uaPacketParserHandler['^!dv'] = function() {
            if (fminitialized && M.account) {
                delay('fv:uvi^dv', fileversioning.updateVersionInfo.bind(fileversioning), 4e3);
            }
        };
        uaPacketParserHandler['^clv'] = function(userHandle) {
            mega.attr.get(userHandle, 'clv', -2, 0, function(res, ctx) {
                u_attr[ctx.ua] = res;

                if (fminitialized && page === 'fm/account') {
                    accountUI.account.qrcode.render(M.account, res);
                }
            });
        };
        uaPacketParserHandler['^!rubbishtime'] = function(userHandle) {
            if (u_attr.flags.ssrs > 0) {
                mega.attr.get(userHandle, 'rubbishtime', -2, 1, function(res, ctx) {
                    u_attr[ctx.ua] = res;

                    if (fminitialized && M.account) {
                        M.account.ssrs = parseInt(res);
                        if (page === 'fm/account/file-management') {
                            accountUI.fileManagement.rubsched.render(M.account);
                        }
                    }
                });
            }
        };
        uaPacketParserHandler['^!usl'] = function() {
            if (fminitialized && u_type) {
                M.getStorageState(true).always(M.checkStorageQuota.bind(M, 2e3));
            }
        };
        uaPacketParserHandler['*!rp'] = function() {
            if (fminitialized) {
                mBroadcaster.sendMessage('attr:rp');
            }
        };
        uaPacketParserHandler['^!enotif'] = function() {
            mega.enotif.handleAttributeUpdate();
        };
        uaPacketParserHandler['^!affid'] = function(userHandle) {
            mega.attr.get(userHandle, 'affid', -2, 1, function(res, ctx) {
                u_attr[ctx.ua] = res;

                if (fminitialized) {
                    M.affiliate.id = res;
                }
            });
        };
        uaPacketParserHandler['^!webtheme'] = function(userHandle) {

            mega.attr.get(userHandle, 'webtheme', -2, 1, function(res, ctx) {

                u_attr[ctx.ua] = res;

                if (is_fm()) {
                    mega.ui.setTheme(res | 0);
                }
            });
        };

        uaPacketParserHandler['^!ps'] = function(userHandle) {
            mega.attr.get(userHandle, 'ps', -2, 1, function(res, ctx) {
                u_attr[ctx.ua] = res;

                if (fminitialized && megaChatIsReady && typeof pushNotificationSettings !== 'undefined') {
                    pushNotificationSettings.init();
                }
            });
        };
        uaPacketParserHandler['^!csp'] = () => 'csp' in window && csp.init();

        uaPacketParserHandler['*!cam'] = function(userHandle) {

            mega.attr.get(userHandle, "cam", false, true, (res, ctx) => {

                u_attr[ctx.ua] = base64urlencode(
                    tlvstore.blockEncrypt(
                        tlvstore.containerToTlvRecords(res), u_k, tlvstore.BLOCK_ENCRYPTION_SCHEME.AES_GCM_12_16
                    )
                );

                if (fminitialized) {

                    M.CameraId = base64urlencode(res.h);
                    M.SecondCameraId = base64urlencode(res.sh);

                    M.cameraUploadUI();
                    mega.gallery.nodeUpdated = true;

                    if (M.isGalleryPage()) {
                        galleryUI();
                    }
                }
            });
        };

        uaPacketParserHandler['^!bak'] = (userHandle) => {

            mega.attr.get(userHandle, 'bak', -2, 1, (res, ctx) => {

                u_attr[ctx.ua] = res;

                if (fminitialized) {
                    M.BackupsId = base64urlencode(u_attr[ctx.ua]);
                }
            });
        };

        uaPacketParserHandler['^!keys'] = (userHandle) => {
            if (d) {
                console.log(`*** KEYS UPDATED for ${userHandle}`);
            }

            if (userHandle === u_handle && !pfid && 'keyMgr' in mega) {

                const shouldLoad = fminitialized || !mega.keyMgr.generation;

                if (shouldLoad) {
                    mega.keyMgr.fetchKeyStore()
                        .catch((ex) => {
                            console.error('key-manager error', ex);
                        });
                }
            }
        };

        if (d) {
            global._uaPacketParserHandler = uaPacketParserHandler;
        }
    });

    /**
     * Create helper factory.
     * @param {String} attribute Name of the attribute.
     * @param {Boolean|Number} pub
     *     True for public attributes (default: true).
     *     -1 for "system" attributes (e.g. without prefix)
     *     -2 for "private non encrypted attributes"
     * @param {Boolean} nonHistoric
     *     True for non-historic attributes (default: false).  Non-historic
     *     attributes will overwrite the value, and not retain previous
     *     values on the API server.
     * @param {String} storeKey An object key to store the data under
     * @param {Function} [decode] Function to post-process the value before returning it
     * @param {Function} [encode] Function to pre-process the value before storing it
     * @return {Object}
     */
    ns.factory = function(attribute, pub, nonHistoric, storeKey, decode, encode) {
        var key = buildAttribute(attribute, pub, nonHistoric);
        if (this.factory[key]) {
            return this.factory[key];
        }

        if (typeof encode !== 'function') {
            encode = function(value) {
                return JSON.stringify(value);
            };
        }
        if (typeof decode !== 'function') {
            decode = function(value) {
                return JSON.parse(value);
            };
        }
        var log = new MegaLogger('factory[' + key + ']', false, logger);

        var cacheValue = function(value) {
            cacheValue.last = decode(value[storeKey]);

            if (key[0] === '*') {
                value = base64urlencode(
                    tlvstore.blockEncrypt(
                        tlvstore.containerToTlvRecords(value), u_k, tlvstore.BLOCK_ENCRYPTION_SCHEME.AES_GCM_12_16
                    )
                );
            }
            else if (key[0] === '^') {
                value = base64urlencode(value);
            }

            if (typeof u_attr === 'object') {
                u_attr[key] = value;
            }

            return cacheValue.last;
        };
        cacheValue.last = false;

        var factory = {
            notify: function() {
                for (var i = this.notify.queue.length; i--;) {
                    this.notify.queue[i](cacheValue.last);
                }
            },
            change: function(callback) {
                this.notify.queue.push(tryCatch(callback));
                return this;
            },
            remove: function() {
                return mega.attr.remove(attribute, pub, nonHistoric);
            },

            set: promisify(function(resolve, reject, value) {
                var store = {};
                store[storeKey] = encode(value);

                cacheValue(store);
                log.debug('storing value', store);

                mega.attr.set(attribute, store, pub, nonHistoric).then(resolve).catch(reject);
            }),

            get: promisify(function(resolve, reject, force) {
                if (!force && Object(u_attr).hasOwnProperty(key)) {
                    var value = u_attr[key] || false;

                    if (value) {
                        if (key[0] === '*') {
                            value = mega.attr.handleLegacyCacheAndDecryption(value);
                        }
                        else if (key[0] === '^') {
                            value = base64urldecode(value);
                        }
                    }

                    log.debug('cached value', value);
                    value = value[storeKey];

                    if (value) {
                        cacheValue.last = decode(value);
                        return resolve(cacheValue.last);
                    }
                }

                mega.attr.get(u_handle, attribute, pub, nonHistoric)
                    .then(function(value) {
                        log.debug('got value', value);
                        resolve(cacheValue(value));
                    })
                    .catch(reject);
            })
        };

        factory.notify.queue = [];

        if (uaPacketParserHandler[key]) {
            return log.warn('exists');
        }

        uaPacketParserHandler[key] = function() {
            if (fminitialized && u_type) {
                cacheValue.last = false;
                if (typeof u_attr === 'object') {
                    delete u_attr[key];
                }
                factory.get(true).always(factory.notify.bind(factory));
            }
        };

        this.factory[key] = factory;
        return Object.freeze(factory);
    };

    /**
     * An attribute factory that eases handling folder creation/management, e.g. My chat files
     * @param {String} attribute Name of the attribute.
     * @param {Boolean|Number} pub
     *     True for public attributes (default: true).
     *     -1 for "system" attributes (e.g. without prefix)
     *     -2 for "private non encrypted attributes"
     * @param {Boolean} nonHistoric
     *     True for non-historic attributes (default: false).  Non-historic
     *     attributes will overwrite the value, and not retain previous
     *     values on the API server.
     * @param {String} storeKey An object key to store the data under
     * @param {String|Array} name The folder name, if an array it's [localized, english]
     * @param {Function} [decode] Function to post-process the value before returning it
     * @param {Function} [encode] Function to pre-process the value before storing it
     * @return {Object}
     */
    ns.getFolderFactory = function(attribute, pub, nonHistoric, storeKey, name, decode, encode) {
        if (!Array.isArray(name)) {
            name = [name];
        }
        var localeName = name[0] || name[1];
        var englishName = name[1] || localeName;
        var log = new MegaLogger('fldFactory[' + englishName + ']', false, logger);

        // listen for attribute changes.
        var onchange = function(handle) {
            // XXX: caching the value under the global `M` is meant for compatibility
            // with legacy synchronous code, any new logic should stick to promises.
            M[attribute] = handle;
            dbfetch.node([handle]).always(function(res) {
                M[attribute] = res[0] || M[attribute];
                if (M[attribute].p === M.RubbishID) {
                    M[attribute] = false;
                } else if (M[attribute].name !== localeName) {
                    M.rename(M[attribute].h, localeName).catch(dump);
                }
                if (d) {
                    log.info("Updating folder...", M[attribute]);
                }
            });
        };
        var ns = Object.create(null);
        var factory = this.factory(attribute, pub, nonHistoric, storeKey, decode, encode).change(onchange);

        // Initialization logic, invoke just once when needed.
        ns.init = function() {
            factory.get().then(factory.notify.bind(factory)).catch(function() {
                // attribute not set, lookup for a legacy folder node
                var keys = Object.keys(M.c[M.RootID] || {});

                for (var i = keys.length; i--;) {
                    var n = M.getNodeByHandle(keys[i]);

                    if (n.name === englishName || n.name === localeName) {
                        if (d) {
                            log.info('Found existing folder, migrating to attribute...', n.h, n);
                        }
                        factory.set(n.h).dump(attribute);
                        if (n.name !== localeName) {
                            M.rename(n.h, localeName).catch(dump);
                        }
                        break;
                    }
                }
            });
        };

        // Retrieve folder node, optionally specifying whether if should be created if it does not exists.
        ns.get = promisify(function(resolve, reject, create) {
            factory.get().then(function(h) { return dbfetch.node([h]); }).always(function(res) {
                var node = res[0];
                if (node && node.p !== M.RubbishID) {
                    return resolve(node);
                }

                if (!create) {
                    return reject(node || ENOENT);
                }

                var target = typeof create === 'string' && create || M.RootID;
                M.createFolder(target, ns.name).always(function(target) {
                    if (!M.d[target]) {
                        if (d) {
                            log.warn("Failed to create folder...", target, api_strerror(target));
                        }
                        return reject(target);
                    }

                    ns.set(target).always(resolve.bind(null, M.d[target]));
                });
            });
        });

        // Store folder handle.
        ns.set = function(handle) {
            return handle === Object(M[attribute]).h ? Promise.resolve(EEXIST)
                : factory.set(handle).then(factory.notify.bind(factory));
        };

        // Get notified about changes.
        ns.change = function(cb) {
            factory.change(cb);
            return this;
        };

        Object.defineProperty(ns, 'name', {
            get: function() {
                return Object(M[attribute]).name || localeName || englishName;
            }
        });

        return Object.freeze(ns);
    };

    ns.registerConflictHandler(
        "lstint",
        false,
        true,
        false,
        function(valObj) {
            var remoteValues = valObj.remoteValue;
            var localValues = valObj.localValue;
            // merge and compare any changes from remoteValues[u_h] = {type: timestamp} -> mergedValues
            Object.keys(remoteValues).forEach(function(k) {
                // not yet added to local values, merge
                if (!localValues[k]) {
                    valObj.mergedValue[k] = remoteValues[k];
                }
                else {
                    // exists in local values
                    var remoteData = remoteValues[k].split(":");
                    var remoteTs = parseInt(remoteData[1]);

                    var localData = localValues[k].split(":");
                    var localTs = parseInt(localData[1]);
                    if (localTs > remoteTs) {
                        // local timestamp is newer then the remote one, use local
                        valObj.mergedValue[k] = localValues[k];
                    }
                    else if (localTs < remoteTs) {
                        // remote timestamp is newer, use remote
                        valObj.mergedValue[k] = remoteValues[k];
                    }
                }
            });

            // add any entries which exists locally, but not remotely.
            Object.keys(localValues).forEach(function(k) {
                if (!remoteValues[k]) {
                    valObj.mergedValue[k] = localValues[k];
                }
            });

            // logger.debug("merged: ", valObj.localValue, valObj.remoteValue, valObj.mergedValue);


            return true;
        });

    ns.registerConflictHandler(
        "alias",
        false,
        true,
        true,
        function(valObj) {
            valObj.mergedValue = $.extend({}, valObj.localValue, valObj.remoteValue, nicknames._dirty);

            // logger.debug("merged: ", valObj.localValue, valObj.remoteValue, valObj.mergedValue);

            return true;
        });

    if (d) {
        ns._inflight = _inflight;
    }

    if (is_karma) {
        ns._logger = logger;
        mega.attr = ns;
    }
    else {
        Object.defineProperty(mega, 'attr', {
            value: Object.freeze(ns)
        });
    }
    ns = undefined;

})(self);

/**
 * Namespace for contact nicknames/aliases related functionality (setting nicknames, displaying them for contacts etc)
 */
var nicknames = {

    /**
     * Initial load of nicknames { userhandle : nickname, ... } from 'ug' request
     */
    cache: false,

    /**
     * List of nicknames (handle -> nickname) that are in progress of saving (e.g. not yet confirmed by the server)
     */
    _dirty: {},

    /**
     * Gets the user's nickname if it's available
     * @param {String|Object} user The Base64 string of the user handle, or a user object
     * @returns {string} Returns the user's name if set, otherwise returns FirstName LastName,
     *                  or FirstName if the last name is not set
     */
    getNickname: function(user) {
        'use strict';
        if (typeof user === 'string') {
            user = M.getUserByHandle(user);
        }
        if (user) {
            // Set format to FirstName LastName (or just FirstName if the last name is not set)
            return String(user.nickname || user.fullname || user.name || user.m).trim();
        }

        return '';
    },

    /**
     * Gets the user's nickname and name if the nickname is available
     * @param {String} userId The Base64 string of the user handle
     * @returns {String} Returns the display name in format Nickname (FirstName LastName), or FirstName LastName,
     *                   or FirstName if the last name is not set
     */
    getNicknameAndName: function(userId) {

        'use strict';

        if (M.u && typeof M.u[userId] !== 'undefined') {
            // M.u[userId].c === 1 is because we only want those to appear for contacts.

            // Set format to FirstName LastName (or just FirstName if the last name is not set)
            var userName = (M.u[userId].name || M.u[userId].m).trim();

            // Check if a nickname for this contact exists
            if (M.u[userId].nickname !== '') {

                // If name is available use format: Nickname (FirstName LastName)
                userName = M.u[userId].nickname + ' (' + userName + ')';
            }

            return userName;
        }

        return '';
    },

    /**
     * Decrypt contact nicknames stored on the API if they exist
     * @param {String} privateAttribute The encrypted u_attr['*!>alias'] attribute data
     */
    decryptAndCacheNicknames: function(privateAttribute) {

        'use strict';

        try {
            // Try decode, decrypt, convert from TLV into a JS object
            this.cache = tlvstore.decrypt(privateAttribute);
        }
        catch (ex) {
            this.cache = Object.create(null);
            console.error('Failed to decrypt contact nicknames', ex);
        }
    },

    /**
     * Update nicknames in the UI when an action packet has been received saying they were updated
     */
    updateNicknamesFromActionPacket: function() {

        'use strict';

        // Get nicknames (*!>alias attribute)
        mega.attr.get(
                u_handle,   // User handle
                'alias',    // Attribute name without prefixes
                false,      // Non public
                true,       // Non historic
                false,      // Callback not needed
                false,      // Context not needed
                false,      // Chat handle not needed
                true        // Decode values
            )
            .always(function(contactNicknames) {

                // Make sure it existed and decrypted to an object
                if (typeof contactNicknames !== 'object') {
                    return false;
                }
                const users = [];

                // Loop through all the properties in M.u
                M.u.keys().forEach(function(key) {

                    // If an active contact
                    if (typeof M.u[key] !== 'undefined' && M.u[key].h) {

                        // Use if set or use empty string so it will get updated in the UI if they had it set before
                        var newNickname = (typeof contactNicknames[key] !== 'undefined') ? contactNicknames[key] : '';
                        // Set the nickname in the UI (will automagically update)
                        var oldNickname = M.u[key].nickname;
                        if (oldNickname !== newNickname) {
                            M.u[key].nickname = newNickname;
                            users.push(key);
                        }

                    }
                });

                useravatar.refresh(users).catch(dump);
            });
    },

    /**
     * A dialog to set the contact's nickname
     */
    setNicknameDialog: {

        /** Cache of the jQuery selector for the dialog */
        $dialog: null,

        /** The contact's user handle (base64 encoded string) */
        contactUserHandle: null,

        /**
         * Initialise the dialog
         * @param {String} contactUserHandle The contact's user handle (base64 encoded string)
         */
        init: function(contactUserHandle) {

            'use strict';

            // Init global selectors
            this.$dialog = $('.contact-nickname-dialog');
            this.$megaInput = new mega.ui.MegaInputs($('#nickname-input',this.$dialog)).$input;

            // Set user handle for use later
            this.contactUserHandle = contactUserHandle;

            // Init functionality
            this.setNicknameDialogTitle();
            this.prefillUserNickname();
            this.initTextSave();
            this.initCancelAndCloseButtons();
            this.initSaveButton();
            this.showDialog();
            this.initInputFocus();
        },

        /**
         * Setup the nickname dialog title
         */
        setNicknameDialogTitle: function() {

            'use strict';

            var $nicknameDialogTitle = $('#contact-nickname-dialog-title', this.$dialog);

            if (typeof M.u[this.contactUserHandle] === 'undefined' || M.u[this.contactUserHandle].nickname === '') {
                $nicknameDialogTitle.text(l.set_nickname_label);
            }
            else {
                $nicknameDialogTitle.text(l.edit_nickname_label);
            }
        },

        /**
         * Automatically fill in the user's current nickname if it is set
         */
        prefillUserNickname: function() {

            'use strict';

            var $input = this.$megaInput;
            var inputValue = '';

            // If the contact exists
            if (typeof M.u[this.contactUserHandle] !== 'undefined') {

                // If the nickname is set, use that
                if (M.u[this.contactUserHandle].nickname !== '') {
                    inputValue = M.u[this.contactUserHandle].nickname;
                }
                else {
                    // Otherwise if the contact details are available, pre-populate with their first and last name
                    var firstName = M.u[this.contactUserHandle].firstName;
                    var lastName = M.u[this.contactUserHandle].lastName;

                    inputValue = (firstName + ' ' + lastName).trim();
                }
            }

            // Show the nickname, name or empty string in the text field
            $input.val(inputValue);
        },

        /**
         * Initialise the code to bind the save button to enter key
         */
        initTextSave: function() {

            'use strict';

            var $input = this.$megaInput;
            var $saveButton = this.$dialog.find('.save-button');

            // Set the keyup handler
            $input.rebind('keyup.inputchange', function(event) {

                // If Enter key is pressed, trigger Save action
                if (event.which === 13) {
                    $saveButton.trigger('click');
                }
            });
        },

        /**
         * Initialise the Cancel and Close buttons
         */
        initCancelAndCloseButtons: function() {

            'use strict';

            var $cancelButton = this.$dialog.find('.cancel-button');
            var $closeIconButton = this.$dialog.find('button.js-close');
            var $input = this.$megaInput;
            var self = this;

            // On click of the Cancel or Close icon
            $cancelButton.add($closeIconButton).rebind('click.closeDialog', function() {

                // Clear the entered value
                $input.val('');

                // Close the dialog
                self.closeDialog();
            });
        },

        /**
         * Initialise the Save button
         */
        initSaveButton: function() {

            'use strict';

            var $saveButton = this.$dialog.find('.save-button');
            var $nicknameInput = this.$megaInput;
            var contactUserHandle = this.contactUserHandle;
            var self = this;

            // On Save button click
            $saveButton.rebind('click.saveNickname', function() {

                // A flag for whether to update the API or not. If they entered a blank nickname and that nickname did
                // not exist before, then the API won't be updated, but if if did exist before then it will be deleted.
                var updateApi = false;

                // Get the nickname and trim it
                var nickname = $nicknameInput.val().trim();

                // If the nickname is empty
                if (nickname.length < 1) {

                    // If the nickname previously existed, delete it
                    if (M.u[contactUserHandle].nickname !== '') {
                        M.u[contactUserHandle].nickname = '';
                        useravatar.refresh(contactUserHandle).catch(dump);
                        updateApi = true;
                    }
                }
                else {
                    // Set the nickname
                    M.u[contactUserHandle].nickname = nickname;
                    useravatar.refresh(contactUserHandle).catch(dump);
                    updateApi = true;
                }

                // If the API should be updated with the new attribute or have it removed
                if (updateApi) {
                    nicknames._dirty[contactUserHandle] = M.u[contactUserHandle].nickname;

                    // Get all the contacts with nicknames
                    var contactNicknames = self.getNicknamesForAllContacts();

                    // If there are nicknames, save them to a private encrypted attribute
                    var promise;
                    if (Object.keys(contactNicknames).length > 0) {
                        promise = self.saveNicknamesToApi(contactNicknames);
                    }
                    else {
                        promise = self.removeNicknamesFromApi();
                    }
                    promise.always(function() {
                        // versioned attributes would proxy their second .get and merge requests and the original
                        // promise would wait before getting resolve/rejected (so that merge/set had finished
                        // successfully)
                        delete nicknames._dirty[contactUserHandle];
                    });
                }

                // Hide the dialog
                self.closeDialog();
            });
        },

        /**
         * Get a list of contact nicknames to be saved
         * @returns {Object} Returns an object containing mappings of contact handles to nicknames
         */
        getNicknamesForAllContacts: function() {

            'use strict';

            var contactNicknames = {};

            // Loop through the keys in M.u
            M.u.keys().forEach(function(key) {

                // If an active contact and they have a nickname, add it
                if (typeof M.u[key] !== 'undefined' && M.u[key].nickname !== '') {
                    contactNicknames[key] = M.u[key].nickname;
                }
            });

            return contactNicknames;
        },

        /**
         * Save the nicknames object to the API which will be TLV encoded and encrypted
         * @param {Object} contactNicknames An object containing mappings of contact handles to nicknames
         * @returns {MegaPromise}
         */
        saveNicknamesToApi: function(contactNicknames) {

            'use strict';

            loadingDialog.show();

            // Set the attribute API side to *!>alias
            return mega.attr.set(
                'alias',            // Attribute name
                contactNicknames,   // Data to save
                false,              // Set to private and encrypted
                true,               // Set to non-historic, this won't retain previous values on API server
                false,              // No callback required
                false,              // No context required
                undefined,          // Use default AES_GCM_12_16 encryption mode
                true,              // Do not use versioning
                true                // Set to encode values as UTF-8
            )
            .always(function() {
                loadingDialog.hide();
            });
        },

        /**
         * Remove the nicknames object from the API
         *
         * @returns {MegaPromise}
         */
        removeNicknamesFromApi: function() {

            'use strict';

            loadingDialog.show();

            // Set the attribute API side to *!>alias
            return mega.attr.set(
                'alias',            // Attribute name
                {},   // Data to save
                false,              // Set to private and encrypted
                true,               // Set to non-historic, this won't retain previous values on API server
                false,              // No callback required
                false,              // No context required
                undefined,          // Use default AES_GCM_12_16 encryption mode
                true,              // Do not use versioning
                true                // Set to encode values as UTF-8
                )
                .always(function() {
                    loadingDialog.hide();
                });
        },

        /**
         * When the dialog has opened, put the cursor into the text field
         */
        initInputFocus: function() {

            'use strict';

            this.$megaInput.trigger('focus');
        },

        /**
         * Show the dialog
         */
        showDialog: function() {

            'use strict';

            this.$dialog.removeClass('hidden');
            fm_showoverlay();
        },

        /**
         * Close the dialog
         */
        closeDialog: function() {

            'use strict';

            this.$dialog.addClass('hidden');
            fm_hideoverlay();
        }
    }
};

var newnodes = [];
var currsn;     // current *network* sn (not to be confused with the IndexedDB/memory state)
var fminitialized = false;
var requesti = makeid(10);
var folderlink = false;
var dumpsremaining;
var workers; // worker pool
var fmdb = false; // the FM DB engine (cf. mDB.js)
var ufsc = false; // global ufs-size-cache instance
var mclp = false; // promise waiting for mc to load

Object.defineProperties(window, {
    // How many nodes are written on a single DB transaction (per table)
    FMDB_FLUSH_THRESHOLD: {
        value: parseInt(localStorage.fmdbbl) || 9087
    },
    // How many nodes can be awaiting in memory before applying back-pressure.
    BACKPRESSURE_FMDB_LIMIT: {
        value: parseInt(localStorage.fmdbpl) || 290784
    },
    // How many nodes can be awaiting decryption (per worker) before applying back-pressure.
    BACKPRESSURE_WORKER_LIMIT: {
        value: 8192
    },
    // Maximum number of bytes that can be retained in internal buffers before applying backpressure.
    BACKPRESSURE_HIGHWATERMARK: {
        value: 0x2000000
    },
    // Time to wait (in seconds) when applying backpressure
    BACKPRESSURE_WAIT_TIME: {
        value: 420 / 1000
    },
    allownullkeys: {
        get() {
            "use strict";
            localStorage.allownullkeys = 1;
            return M.reload();
        }
    }
});

/** @property mega.shouldApplyNetworkBackPressure */
lazy(mega, 'shouldApplyNetworkBackPressure', () => {
    'use strict';

    if (mega.flags.nobp || parseInt(localStorage.nobp)) {
        if (d) {
            console.info('Disabling network back-pressure.', mega.flags.nobp);
        }
        Object.defineProperty(mega, 'nobp', {value: true});
        return () => false;
    }

    return (aContentLength) => {
        const nobp = BACKPRESSURE_HIGHWATERMARK > aContentLength;

        if (mega.nobp !== false) {
            mega.nobp = nobp;
        }

        return !nobp;
    };
});

/** @property mega.is */
lazy(mega, 'is', () => {
    'use strict';
    const obj = {
        /**
         * @name loading
         * @memberOf mega.is
         */
        get loading() {
            return !!(mega.state & window.MEGAFLAG_LOADINGCLOUD);
        }
    };

    return Object.freeze(Object.setPrototypeOf(obj, null));
});

/** @property window.mLoadingSpinner */
lazy(self, 'mLoadingSpinner', () => {
    'use strict';
    const callers = new Map();
    const domNode = document.querySelector('.fmdb-loader');

    return freeze({
        show(id = 'main', title = 'Background activity') {
            if (!callers.size) {
                if (domNode) {
                    domNode.setAttribute('title', title);
                }
                document.documentElement.classList.add('fmdb-working');
            }
            const store = callers.get(id) || {title, count: 0};
            const res = ++store.count;

            callers.set(id, store);
            return res;
        },

        hide(id = 'main', force = false) {
            let res = 0;
            const store = !force && callers.get(id);

            if (!store || store.count < 2) {
                callers.delete(id);
            }
            else {
                res = --store.count;
                callers.set(id, store);
            }

            if (callers.size) {
                const [[, {title}]] = callers;

                if (domNode) {
                    domNode.setAttribute('title', title);
                }
            }
            else {
                document.documentElement.classList.remove('fmdb-working');
            }

            return res;
        },

        clear() {
            callers.clear();
            return this.hide();
        }
    });
});

if (typeof loadingDialog === 'undefined') {
    window.loadingDialog = Object.create(null);

    // New subject value to specify loading dialog subject.
    // Loading dialog with subject will not disappear until it hided with the subject
    $.loadingSubject = Object.create(null);

    loadingDialog.nest = 0;
    /**
     * Show overlay and loading spinner
     * @param {String} subject Subject of overlay
     * @param {String} label Loading text label with description
     * @returns {void}
     */
    loadingDialog.show = function(subject, label) {
        'use strict';

        var $overlay;
        var $spinner;

        subject = subject || 'common';

        if (!this.quiet) {
            $overlay = $('.dark-overlay:not(.mobile)', 'body');
            $spinner = $('.loading-spinner:not(.manual-management)', 'body');

            if (label) {
                $overlay.addClass('white');
                $('.status-txt', $spinner).text(label).addClass('loading');
            }

            $overlay.removeClass('hidden');
            $spinner.removeClass('hidden').addClass('active');
            this.active = true;

            // Even there is current on going loading pregress bar, if loading dialog is called show spinner
            $('.main-loader', $spinner).removeClass('hidden');

            // Prevent scrolling for mobile web
            if (is_mobile && $overlay.length && $spinner.length) {
                document.getElementById('loading-overlay').addEventListener('touchmove', function(e){
                    e.preventDefault();
                }, {passive: false});

                document.getElementById('loading-spinner').addEventListener('touchmove', function(e){
                    e.preventDefault();
                }, {passive: false});
            }
        }

        $.loadingSubject[subject] = 1;
    };
    loadingDialog.hide = function(subject) {
        'use strict';

        var $overlay;
        var $spinner;

        subject = subject || 'common';

        delete $.loadingSubject[subject];

        if (!loadingInitDialog.active && (Object.keys($.loadingSubject).length === 0 || subject === 'force')) {
            $overlay = $('.dark-overlay:not(.mobile)', 'body');
            $spinner = $('.loading-spinner:not(.manual-management)', 'body');

            $overlay.removeClass('white').addClass('hidden');
            $spinner.removeClass('active').addClass('hidden');
            $('.status-txt.loading', $spinner).removeClass('loading');

            this.nest = 0;
            this.active = false;
            $.loadingSubject = Object.create(null);
        }
    };
    loadingDialog.pshow = function() {
        'use strict';

        if (!this.nest++) {
            this.show('--dont-mess-with-me');
        }
    };
    loadingDialog.phide = function() {
        'use strict';

        if (--this.nest < 1) {
            this.hide('--dont-mess-with-me');
            this.nest = 0;
        }
        return !this.nest;
    };
    loadingDialog.quiet = false;
    loadingDialog.showProgress = function(progress) {

        'use strict';

        // Do not interrupt init dialog
        if (loadingInitDialog && loadingInitDialog.active) {
            return;
        }

        const $spinner = $('.loading-spinner:not(.manual-management)').removeClass('hidden');

        // If there is no current loadingDialog, make spinner disapears
        if (!loadingDialog.active) {
            $('.main-loader', $spinner).addClass('hidden');
        }

        $('.loader-progressbar', $spinner).addClass('active');

        if (progress) {
            $('.loader-percents', $spinner).css('transform', `scaleX(${progress / 100})`);
        }
    };
    loadingDialog.hideProgress = function() {

        'use strict';

        // Do not interrupt init dialog
        if (loadingInitDialog && loadingInitDialog.active) {
            return;
        }

        const $spinner = $('.loading-spinner:not(.manual-management)');

        $('.loader-progressbar', $spinner).removeClass('active');

        // awaiting 300 fadeout animation
        setTimeout(() => {

            // If there is another active loading dialog do not interrupt it.
            if (!loadingDialog.active) {
                $spinner.addClass('hidden');
            }
            $('.loader-percents', $spinner).css('transform', '');
        }, 301);
    };
}

if (typeof loadingInitDialog === 'undefined') {
    window.loadingInitDialog = Object.create(null);
    loadingInitDialog.progress = false;
    loadingInitDialog.active = false;
    loadingInitDialog.show = function() {
        var $loadingSpinner = $('.loading-spinner');

        // Folder link load
        if (pfid) {
            $loadingSpinner.find('.step1').text(l[8584]);   // Requesting folder data
            $loadingSpinner.find('.step2').text(l[8585]);   // Receiving folder data
            $loadingSpinner.find('.step3').text(l[8586]);   // Decrypting folder data
        }
        else {
            // Regular account load
            $loadingSpinner.find('.step1').text(l[8577]);   // Requesting account data
            $loadingSpinner.find('.step2').text(l[8578]);   // Receiving account data
            $loadingSpinner.find('.step3').text(l[8579]);   // Decrypting
        }

        // On mobile, due to reduced screen size we just want a simpler single step with the text 'Loading'
        if (is_mobile) {
            $loadingSpinner.find('.step1').text(l[1456]);
        }

        this.hide();
        $('.light-overlay').removeClass('hidden');
        $('body').addClass('loading');
        $('.loading-spinner:not(.manual-management)').removeClass('hidden').addClass('init active');
        this.active = true;
    };
    loadingInitDialog.step1 = function() {
        $('.loading-info li.loading').addClass('loaded').removeClass('loading');
        $('.loading-info li.step1').addClass('loading');
    };
    loadingInitDialog.step2 = function(progress) {
        'use strict';
        if (!this.active) {
            return;
        }
        if (this.progress === false) {

            // Don't show step 2 loading if on mobile
            if (!is_mobile) {
                $('.loading-info li.loading').addClass('loaded').removeClass('loading');
                $('.loading-info li.step2').addClass('loading');
            }
            $('.loader-progressbar').addClass('active');

            // Load performance report
            mega.loadReport.ttfb          = Date.now() - mega.loadReport.stepTimeStamp;
            mega.loadReport.stepTimeStamp = Date.now();

            // If the PSA is visible reposition the account loading bar
            if (typeof psa !== 'undefined') {
                psa.repositionAccountLoadingBar();
            }
        }
        if (progress) {
            $('.loader-percents').css('transform', `scaleX(${progress * 0.5 / 100})`);
        }
        this.progress = true;
    };
    loadingInitDialog.step3 = function(progress, delayStep) {
        'use strict';

        if (this.progress) {

            // Don't show step 3 loading if on mobile
            if (progress === 1 && !is_mobile) {

                $('.loading-info li.loading').addClass('loaded').removeClass('loading');
                $('.loading-info li.step3').addClass('loading');
            }

            if (!this.loader) {
                this.loader = document.getElementsByClassName('loader-percents')[0];
            }

            if (typeof this.progress !== 'number') {
                this.progress = 0;
            }

            // This trying moving backward, nope sorry you cannot do this.
            if (this.progress > progress || !this.loader) {
                return;
            }

            // only update UI with 0.5% step
            if (this.progress + 1 <= progress) {

                this.progress = progress | 0;
                this.loader.classList.remove('delay-loader');
                this.loader.style.transform = `scaleX(${(this.progress * 0.5 + 50) / 100})`;

                requestAnimationFrame(() => {

                    if (this.progress >= 99 || this.progress === false) {

                        const elm = document.getElementsByClassName('loader-progressbar')[0];

                        if (elm) {
                            elm.classList.remove('active');
                            elm.style.bottom = 0;
                        }
                    }
                    else if (this.loader && delayStep && this.progress < delayStep) {

                        this.loader.classList.add('delay-loader');
                        this.loader.style.transform = `scaleX(${(delayStep * 0.5 + 50) / 100})`;
                    }
                });
            }
        }
    };
    loadingInitDialog.hide = function(subject) {
        'use strict';
        this.loader = null;
        this.active = false;
        this.progress = false;
        $('.light-overlay').addClass('hidden');
        $('body').removeClass('loading');
        if ($.loadingSubject && Object.keys($.loadingSubject).length === 0) {
            $('.loading-spinner:not(.manual-management)').addClass('hidden').removeClass('init active');
        }
        $('.loading-info li').removeClass('loading loaded');
        $('.loader-progressbar').removeClass('active');
        $('.loader-percents').width('0%').removeAttr('style');

        // Implicitly hide the former dialog, as per the linked dependency.
        window.loadingDialog.hide(subject);
    };
}

// execute actionpacket
// actionpackets are received and executed strictly in order. receiving and
// execution run concurrently (a connection drop while the execution is
// ongoing invalidates the IndexedDB state and forces a reload!)
var scq = Object.create(null);           // hash of [actionpacket, [nodes]]
var scqtail = 0;                         // next scq index to process
var scqhead = 0;                         // next scq index to write
var scloadtnodes = false;                // if `t` packet requires nodes in memory
var scinflight = false;                  // don't run more than one execsc() "thread"
var sccount = 0;                         // number of actionpackets processed at connection loss
var scfetches = Object.create(null);     // holds pending nodes to be retrieved from fmdb
var scfsubtree = Object.create(null);    // fetch entire subtree as needed by some action-packets
var scwaitnodes = Object.create(null);   // supplements scfetches per scqi index
var nodesinflight = Object.create(null); // number of nodes being processed in the worker for scqi
var nodes_scqi_order = 0;                // variable to count the node arrival order before sending to workers

// enqueue nodes needed to process packets
function sc_fqueue(handle, packet) {
    "use strict";

    if (handle && (!M.c[handle] || scfsubtree[handle])) {
        if (scwaitnodes[packet.scqi]) {
            scwaitnodes[packet.scqi]++;
        }
        else {
            scwaitnodes[packet.scqi] = 1;
        }
        if (!scfetches[handle]) {
            scfetches[handle] = [];
        }
        scfetches[handle].push(packet.scqi);
        return 1;
    }
    return 0;
}

// queue 't' packet nodes for db retrieval
function sc_fqueuet(scni, packet) {
    "use strict";

    var result  = 0;

    if (scloadtnodes) {
        var scnodes = scq[scni] && scq[scni][1];

        if (scnodes && scnodes.length) {
            packet = packet || scq[scni][0];

            if (!packet) {
                console.error('sc_fqueuet: invalid packet!');
            }
            else {
                if (d > 1) {
                    console.debug('sc_fqueuet', scni, packet, clone(scnodes));
                }
                for (var i = scnodes.length; i--;) {
                    result += sc_fqueue(scnodes[i].p, packet);
                }
            }
        }
    }

    return result;
}

// fetch from db the queued scfetches
async function sc_fetcher() {
    "use strict";

    if ($.scFetcherRunning) {
        if (d > 1) {
            console.debug('sc_fetcher already running...');
        }
        return;
    }

    const queue = scfetches;
    const handles = Object.keys(queue);
    const fsubtree = scfsubtree;
    scfetches = Object.create(null);
    scfsubtree = Object.create(null);

    if (!handles.length) {
        return queueMicrotask(resumesc);
    }
    $.scFetcherRunning = true;

    if (d) {
        console.info('Retrieving from DB nodes required to parse action-packets...', handles);
    }
    // console.time('sc:fetcher');

    while (handles.length) {
        const bunch = handles.splice(0, 8192);
        await dbfetch.geta(bunch).catch(dump);

        // Retrieve all needed subtrees and file versions if any, and then finish the batch processing
        const subtree = new Set();

        for (let i = bunch.length; i--;) {
            const n = M.d[bunch[i]];

            if (n) {
                if (n.t) {
                    if (fsubtree[n.h]) {
                        // entire subtree
                        subtree.add(n.h);
                    }
                }
                else if (n.tvf) {
                    // file versions
                    subtree.add(n.h);
                }
            }
        }

        if (subtree.size) {
            await dbfetch.tree([...subtree]).catch(dump);
        }

        for (let i = bunch.length; i--;) {
            const h = bunch[i];
            for (let p = queue[h].length; p--;) {
                const scqi = queue[h][p];
                if (!--scwaitnodes[scqi]) {
                    delete scwaitnodes[scqi];
                }
            }
        }

        queueMicrotask(resumesc);
    }
    // console.timeEnd('sc:fetcher');

    $.scFetcherRunning = false;
    queueMicrotask(sc_fetcher);
}

/**
 * function to start fetching nodes needed for the action packets
 * @param {Number} scni         id of action packe in scq
 */
function startNodesFetching(scni) {
    "use strict";
    if (!--nodesinflight[scni]) {
        delete nodesinflight[scni];

        if (scloadtnodes && scq[scni] && scq[scni][0] && sc_fqueuet(scni)) {
            // fetch required nodes from db
            delay('scq:fetcher.dsp', sc_fetcher, 90);
        }
        else {
            // resume processing, if appropriate and needed
            resumesc();
        }
    }
}

// enqueue parsed actionpacket
function sc_packet(a) {
    "use strict";

    if (getsc.timer) {
        // a timer is running for 48 seconds, parsing action-packets should
        // take less than that, but in case it does not...let's stop it.
        getsc.stop();
    }

    // set scq slot number
    a.scqi = scqhead;

    if (d > 1) {
        console.debug('sc_packet', loadfm.fromapi, scloadtnodes, a.a, a);
    }

    // check if this packet needs nodes to be present,
    // unless `fromapi` where nodes are placed in memory already as received.
    if (window.fmdb && (!loadfm.fromapi || !fmdb.memoize))
    {
        scloadtnodes = true;

        switch (a.a) {
            case 'd':
                scfsubtree[a.n] = 1;
            /* falls through */
            case 's':
            case 's2':
            case 'fa':
            case 'u':
                sc_fqueue(a.n, a);
            /* falls through */
            case 'ph':
                sc_fqueue(a.h, a); // s, s2, ph
                break;
            case 't':
                // If no workers, all scnodes should be ready
                // OR the scnodes are ready but not the ap set yet
                if (!decWorkerPool.ok || scq[scqhead] && !scq[scqhead][0]) {
                    sc_fqueuet(scqhead, a);
                }
                break;
        }

        delay('scq:fetcher.dsp', sc_fetcher, 90);
    }

    if ((a.a === 's' || a.a === 's2') && a.k && !self.secureKeyMgr) {
        /**
         * There are two occasions where `crypto_process_sharekey()` must not be called:
         *
         * 1. `a.k` is symmetric (AES), `a.u` is set and `a.u != u_handle`
         *    (because the resulting sharekey would be rubbish)
         *
         * 2. `a.k` is asymmetric (RSA), `a.u` is set and `a.u != u_handle`
         *    (because we either get a rubbish sharekey or an RSA exception from asmcrypto)
         */
        let prockey = false;

        if (a.k.length > 43) {
            if (!a.u || a.u === u_handle) {
                // RSA-keyed share command targeted to u_handle: run through worker
                prockey = !a.o || a.o !== u_handle;

                if (prockey) {
                    rsasharekeys[a.n] = true;
                }
            }
        }
        else {
            prockey = (!a.o || a.o === u_handle);
        }

        if (prockey) {
            if (decWorkerPool.ok && rsasharekeys[a.n]) {
                decWorkerPool.postPacket(a, scqhead++);
                return;
            }

            const k = crypto_process_sharekey(a.n, a.k);

            if (k === false) {
                console.warn(`Failed to decrypt RSA share key for ${a.n}: ${a.k}`);
            }
            else {
                a.k = k;
                crypto_setsharekey(a.n, k, true);
            }
        }
    }

    if (a.a === 't') {
        startNodesFetching(scqhead);
    }

    // other packet types do not warrant the worker detour
    if (scq[scqhead]) scq[scqhead++][0] = a;
    else scq[scqhead++] = [a, []];

    // resume processing if needed
    resumesc();
}

// submit nodes from `t` actionpacket to worker
function sc_node(n) {
    "use strict";

    crypto_rsacheck(n);

    if (!decWorkerPool.ok) {
        crypto_decryptnode(n);
        if (scq[scqhead]) scq[scqhead][1].push(n);
        else scq[scqhead] = [null, [n]];
        // sc_packet() call will follow
        return;
    }

    if (nodesinflight[scqhead]) {
        nodesinflight[scqhead]++;
    }
    else {
        nodesinflight[scqhead] = 2;
        nodes_scqi_order = 0; // reset the order var
    }

    n.scni = scqhead;       // set scq slot number (sc_packet() call will follow)
    n.scqp = nodes_scqi_order++; // storing arrival order
    decWorkerPool.postNode(n, scqhead % decWorkerPool.length);
}

// inter-actionpacket state, gets reset in getsc()
var scsharesuiupd;
var scpubliclinksuiupd;
var scContactsSharesUIUpdate;
var loadavatars = [];
var scinshare = Object.create(null);
var sckeyrequest = Object.create(null);

// sc packet parser
var scparser = Object.create(null);
scparser.$common = Object.create(null);
scparser.$helper = Object.create(null);
scparser[requesti] = Object.create(null);

/**
 * Add a new sc parser handler
 * @param {String} type The packet type, s2, la, t, etc
 * @param {Object|Function|String} handler The handler descriptor
 * If handler is a function, it is meant to parse packets not triggered locally, otherwise
 * must be an object with either an 'r' (triggered remotely), 'l' (triggered locally), or 'b'oth.
 */
scparser.$add = function(type, handler) {
    if (typeof handler === 'function') {
        handler = {r: handler};
    }
    if (handler.b) {
        scparser.$common[type] = handler.b;
    }
    if (handler.r) {
        scparser[type] = handler.r;
    }
    if (handler.l) {
        scparser[requesti][type] = handler.l;
    }
};

scparser.$helper.c = function(a) {
    // contact notification
    process_u(a.u);

    scparser.$notify(a);

    if (megaChatIsReady) {
        $.each(a.u, function(k, v) {
            if (v.c !== 0) {
                // load all keys.
                crypt.getPubRSA(v.u);
                crypt.getPubCu25519(v.u);
                crypt.getPubEd25519(v.u);
            }
            megaChat[v.c === 0 || (v.c === 2 && v.c !== u_handle) ? "processRemovedUser" : "processNewUser"](v.u);
        });
    }
};

scparser.$add('c', {
    r: function(a) {
        scparser.$helper.c(a);

        // contact is deleted on remote computer, remove contact from contacts left panel
        if (fminitialized && a.u[0].c === 0) {

            $.each(a.u, function(k, v) {
                var userHandle = v.u;

                // hide the context menu if it is currently visible and this contact was removed.
                if ($.selected && ($.selected[0] === userHandle)) {

                    // was selected
                    if (selectionManager) {
                        selectionManager.clear_selection();
                    }
                    $.selected = [];

                    if ($('.dropdown.body.files-menu').is(":visible")) {
                        $.hideContextMenu();
                    }
                }
            });
        }
    },
    l: function(a) {
        scparser.$helper.c(a);
    }
});

scparser.$add('s', {
    r: function(a) {
        if (folderlink) {
            return;
        }

        var n, i;
        var prockey = false;

        if (a.o === u_handle) {
            // if access right are undefined, then share is deleted
            if (typeof a.r === 'undefined') {
                if (a.okd && d) {
                    console.warn(`Ignoring okd for ${a.n}...`, a);
                }
                M.delNodeShare(a.n, a.u);

                if (a.p) {
                    M.deletePendingShare(a.n, a.p);
                }
                else if (!pfid && fminitialized && a.u in M.u) {
                    setLastInteractionWith(a.u, `0:${unixtime()}`);

                    if (a.ou !== u_handle) {
                        notify.notifyFromActionPacket({a: 'dshare', n: a.n, u: a.o, orig: a.ou, rece: a.u});
                    }
                }
            }
            else {
                const shares = Object(M.d[a.n]).shares || {};

                if (self.secureKeyMgr) {

                    if (a.u) {
                        M.nodeShare(a.n, {h: a.n, r: a.r, u: a.u, ts: a.ts});
                    }
                    else {
                        if (d) {
                            console.debug(`Got share action-packet for pending contact: ${a.n}*${a.p}`, [a]);
                        }
                        console.assert(a.a === 's2', `INVALID SHARE, missing user-handle for ${a.n}`, a);
                    }
                }
                else if (a.u in shares || a.ha === crypto_handleauth(a.n)) {

                    // I updated or created my share
                    const k = decrypt_key(u_k_aes, base64_to_a32(a.ok));

                    if (k) {
                        crypto_setsharekey(a.n, k);

                        if (d) {
                            console.assert(a.u || a.a === 's2', 'INVALID SHARE, missing user handle', a);
                        }

                        if (a.u) {
                            M.nodeShare(a.n, {h: a.n, r: a.r, u: a.u, ts: a.ts});
                        }
                        else if (a.a === 's2' && fmdb) {
                            // this must be a pending share, store ownerkey
                            fmdb.add('ok', {h: a.n, d: {k: a.ok, ha: a.ha}});
                        }
                    }
                }
            }
        }
        else {
            if (a.n && typeof a.k !== 'undefined' && !u_sharekeys[a.n] && !self.secureKeyMgr) {
                if (Array.isArray(a.k)) {
                    // a.k has been processed by the worker
                    crypto_setsharekey(a.n, a.k);
                    prockey = true;
                }
                else if (d) {
                    // XXX: misdirected actionpackets?
                    console.warn('Got share action-packet with invalid key, wait for it.', a.n, a.k, [a]);
                }
            }

            if (a.u === 'EXP') {

                mega.Share.ExportLink.pullShareLink(a.h, true).catch(dump);
            }

            if ('o' in a) {
                if (!('r' in a)) {
                    // share deletion
                    n = M.d[a.n];

                    if (n) {
                        if (a.u === u_handle) {
                            // incoming share
                            if (d) {
                                console.log('Incoming share ' + a.n + " revoked.", n.su, M.d[n.p]);
                            }

                            if (M.d[n.p]) {
                                // inner share: leave nodes intact, just remove .r/.su
                                delete n.r;
                                delete n.su;
                                delete n.sk;
                                delete M.c.shares[a.n];
                                // mega.keyMgr.deleteShares([a.n]).catch(dump);

                                if (M.tree.shares) {
                                    delete M.tree.shares[a.n];
                                }

                                if (fmdb) {
                                    fmdb.del('s', a.u + '*' + a.n);
                                }
                                M.nodeUpdated(n);
                            }
                            else {
                                // toplevel share: delete entire tree
                                // (the API will have removed all subshares at this point)
                                M.delNode(a.n);
                            }
                        }
                        else {
                            if (a.o === u_handle) {
                                M.delNodeShare(a.n, a.u);
                            }
                        }
                    }

                    if (!folderlink && a.u !== 'EXP' && fminitialized) {
                        if (a.ou !== u_handle) {
                            notify.notifyFromActionPacket({
                                a: 'dshare',
                                n: a.n,
                                u: a.o,
                                orig: a.ou,
                                rece: a.u
                            });
                        }
                    }
                }
                else {
                    if (d) {
                        console.log('Inbound share, preparing for receiving its nodes');
                    }

                    // if the parent node already exists, all we do is setting .r/.su
                    // we can skip the subsequent tree; we already have the nodes
                    if (n = M.d[a.n]) {
                        n.r = a.r;
                        n.su = a.o;
                        M.nodeUpdated(n);

                        scinshare.skip = true;
                    }
                    else {
                        scinshare.skip = false;
                        scinshare.h = a.n;
                        scinshare.r = a.r;
                        scinshare.sk = a.k;
                        scinshare.su = a.o;

                        if (!folderlink && fminitialized) {
                            notify.notifyFromActionPacket({
                                a: 'share',
                                n: a.n,
                                u: a.o
                            });
                        }
                    }
                }
            }
        }

        if (prockey) {
            var nodes = M.getNodesSync(a.n, true);

            for (i = nodes.length; i--;) {
                if (n = M.d[nodes[i]]) {
                    if (typeof n.k === 'string') {
                        crypto_decryptnode(n);
                        newnodes.push(M.d[n.h]);
                    }
                }
            }
        }

        if (fminitialized) {
            sharedUInode(a.n);
        }
        scsharesuiupd = true;
        scContactsSharesUIUpdate = a.o ? a.o : false;
    },
    l: function(a) {
        // share modification
        // (used during share dialog removal of contact from share list)
        // is this a full share delete?
        if (a.r === undefined) {
            // fill DDL with removed contact
            if (a.u && M.u[a.u] && M.u[a.u].m && !is_mobile) {
                var email = M.u[a.u].m;
                var contactName = M.getNameByHandle(a.u);

                addToMultiInputDropDownList('.share-multiple-input', [{id: email, name: contactName}]);
                addToMultiInputDropDownList('.add-contact-multiple-input', [{id: email, name: contactName}]);
            }
        }

        if (fminitialized) {
            // a full share contains .h param
            sharedUInode(a.h);
        }
        scsharesuiupd = true;
    }
});

scparser.$add('s2', {
    r: function(a) {
        // 's2' still requires the logic for 's'
        this.s(a);

        processPS([a]);
    },
    l: function(a) {
        // 's2' still requires the logic for 's'
        this.s(a);

        // store ownerkey
        if (fmdb && !self.secureKeyMgr) {
            fmdb.add('ok', {h: a.n, d: {k: a.ok, ha: a.ha}});
        }
        processPS([a]);
    }
});

scparser.$add('t', function(a, scnodes) {
    // node tree
    // the nodes have been pre-parsed and stored in scnodes
    if (scinshare.skip) {
        // FIXME: do we still need to notify anything here?
        scinshare.skip = false;
        return;
    }

    let i;
    const ufsc = new UFSSizeCache();
    let rootNode = scnodes.length && scnodes[0] || false;
    let share = M.d[rootNode.h];

    // is this tree a new inshare with root scinshare.h? set share-relevant
    // attributes in its root node.
    if (scinshare.h) {
        for (i = scnodes.length; i--;) {
            if (scnodes[i].h === scinshare.h) {
                scnodes[i].su = scinshare.su;
                scnodes[i].r = scinshare.r;
                scnodes[i].sk = scinshare.sk;
                rootNode = scnodes[i];

                // XXX: With Infinity, we may did retrieve the node API-side prior to parsing "t" ...
                share = M.d[rootNode.h];

                if (share) {
                    // save r/su/sk, we'll break next...
                    M.addNode(rootNode);
                }
            }
            else if (M.d[scnodes[i].h]) {
                ufsc.feednode(scnodes[i]);
                delete scnodes[i];
            }
        }
        scinshare.h = false;
    }
    if (share) {
        // skip repetitive notification of (share) nodes
        if (d) {
            console.debug('skipping repetitive notification of (share) nodes');
        }
        return;
    }

    // notification logic
    if (fminitialized && !pfid && a.ou !== u_handle
        && rootNode && rootNode.p && !rootNode.su) {

        const targetid = rootNode.p;
        const pnodes = [];

        for (i = 0; i < scnodes.length; i++) {
            if (scnodes[i] && scnodes[i].p === targetid) {
                pnodes.push({
                    h: scnodes[i].h,
                    t: scnodes[i].t
                });
            }
        }

        notify.notifyFromActionPacket({
            a: a.ou ? 'put' : 'puu',
            n: targetid,
            u: a.ou,
            f: pnodes
        });
    }

    const mns = $.moveNodeShares;
    for (i = 0; i < scnodes.length; i++) {
        if (scnodes[i]) {

            M.addNode(scnodes[i]);
            ufsc.feednode(scnodes[i]);

            if (mns) {
                const {h} = scnodes[i];
                const share = mns[h];

                if (share) {

                    // eslint-disable-next-line guard-for-in
                    for (const su in share) {
                        M.nodeShare(h, share[su], true);

                        if (su === 'EXP') {
                            scpubliclinksuiupd = true;
                        }
                        else {
                            scsharesuiupd = true;
                        }
                    }

                    delete mns[h];
                }
            }
        }
    }

    ufsc.save(rootNode);

    if (d > 1) {
        // f2 if set must be empty since the nodes must have been processed through workers.
        console.assert(!a.t || !a.t.f2 || !a.t.f2.length, 'Check this...');
    }

    if (fminitialized && !is_mobile) {
        // update versioning info.
        i = scnodes.length > 1 && Object(scnodes[1]).h || rootNode.h;
        if (i) {
            // TODO: ensure this is backward compatible...
            fileversioning.updateFileVersioningDialog(i);
        }
    }

    if (fminitialized) {
        M.storageQuotaCache = null;
    }
});

scparser.$add('opc', (a) => {
    'use strict';

    // outgoing pending contact
    processOPC([a]);

    if (fminitialized && M.chat && megaChatIsReady
        && megaChat.routingSection === "contacts"
        && megaChat.routingSubSection === "sent") {

        mBroadcaster.sendMessage('fmViewUpdate:opc');
    }
});

scparser.$add('ipc', {
    b: function(a) {
        // incoming pending contact
        processIPC([a]);

        if (fminitialized && megaChatIsReady) {
            mBroadcaster.sendMessage('fmViewUpdate:ipc');
        }

        notify.notifyFromActionPacket(a);
    }
});

scparser.$add('ph', (a) => {
    'use strict';

    // exported link
    processPH([a]);

    // not applicable - don't return anything, or it will show a blank notification
    if (typeof a.up !== 'undefined' && typeof a.down !== 'undefined') {
        notify.notifyFromActionPacket(a);
    }
    scpubliclinksuiupd = true;
});

scparser.$add('upci', {
    b: function(a) {
        'use strict';
        // update to incoming pending contact request
        if (a.s) {
            M.delIPC(a.p);

            if (fminitialized) {
                onIdle(() => {
                    mBroadcaster.sendMessage('fmViewUpdate:ipc');
                });
            }
        }
    }
});

scparser.$add('upco', {
    b: function(a) {
        'use strict';

        // update to outgoing pending contact request
        if (a.s) {
            // Have status of pending share
            const {p, m} = a;

            M.delOPC(p);
            M.delIPC(p);

            // Delete all matching pending shares
            for (var k in M.ps) {
                M.delPS(p, k);
            }

            if (fminitialized) {
                onIdle(() => {
                    mBroadcaster.sendMessage('fmViewUpdate:opc');
                });

                removeFromMultiInputDDL('.share-multiple-input', {id: m, name: m});
                removeFromMultiInputDDL('.add-contact-multiple-input', {id: m, name: m});
            }
        }

        // if the status is accepted ('2'), then this will be followed
        // by a contact packet and we do not need to notify
        if (a.s !== 2) {
            notify.notifyFromActionPacket(a).catch(dump);
        }
    }
});

scparser.$add('puh', {
    b: function(a) {
        "use strict";
        if (!folderlink) {
            mega.fileRequestCommon.actionHandler.processPublicUploadHandle(a);
        }
    }
});

scparser.$add('pup', {
    b: function(a) {
        "use strict";
        if (!folderlink) {
            mega.fileRequestCommon.actionHandler.processPublicUploadPage(a);
        }
    }
});

scparser.$add('se', {
    b: function(a) {
        if (!folderlink) {
            processEmailChangeActionPacket(a);
        }
    }
});

scparser.$add('pk', {
    b: function() {
        'use strict';
        if (folderlink) {
            return;
        }

        delay('fetch-pending-share-keys', () => {

            mega.keyMgr.fetchPendingInShareKeys().catch(dump);
        });
    }
});

scparser.$add('ua', (a) => {
    'use strict';

    if (Array.isArray(a.ua)) {
        let gotCu255 = false;
        const {st, ua, u: usr, v = false} = a;

        // public-folder allowed -- which ones we can parse under folder-links
        const pfa = new Set(['*!fmconfig', '^!csp', '^!webtheme', '^!prd']);

        // triggered locally?
        const local = st === api.currst;
        const parse = (name) => !local && name !== '^!stbmp' || name === 'firstname' || name === 'lastname';

        for (let idx = 0; idx < ua.length; ++idx) {
            const name = ua[idx];
            const version = v[idx];
            const ck = `${usr}_${name}`;

            if (local) {
                if (version && !mega.attr._versions[ck]) {
                    mega.attr._versions[ck] = version;
                }
            }
            else if (pfid && !pfa.has(name)) {
                if (d) {
                    console.info(`Ignoring ua-packet ${name}...`, JSON.stringify(a));
                }
                continue;
            }

            gotCu255 = gotCu255 || String(name).includes('Cu255');

            if (name === '+a') {
                loadavatars.push(usr);
            }
            else if (name[0] === '%') {
                // business-related attribute, per 'upsub'
                attribCache.removeItem(ck, false);
            }
            else if (parse(name)) {
                mega.attr.uaPacketParser(name, usr, local, version);
            }
        }

        // in case of business master
        // first, am i a master?
        if (!pfid && window.u_attr && Object(u_attr.b).m) {

            if (Object.hasOwnProperty.call(M.suba, usr) || u_attr.b.bu === usr) {
                M.require('businessAcc_js', 'businessAccUI_js')
                    .then(() => {
                        const business = new BusinessAccount();
                        business.updateSubUserInfo(usr, ua);
                    });
            }

            if (gotCu255) {

                delay('complete-pending-out-shares', () => {
                    if (d) {
                        console.warn('Trying to complete out-shares from business admin...');
                    }
                    mega.keyMgr.completePendingOutShares().catch(dump);
                });
            }
        }
    }
});

scparser.$add('sd', {
    b: function() {
        "use strict";

        if (fminitialized && page === 'fm/account/security') {
            // need to wait until session history is refreshed.
            tSleep(3).then(() => {
                accountUI.security.session.update(true);
            });
        }
    }
});

scparser.$add('fa', function(a) {
    // file attribute change/addition
    var n = M.d[a.n];
    if (n) {
        n.fa = a.fa;
        M.nodeUpdated(n);

        mBroadcaster.sendMessage('fa:ready', a.n, a.fa);
    }
});

scparser.$add('k', function(a) {
    // key request
    if (a.sr) {
        crypto_procsr(a.sr);
    }
    if (a.cr) {
        crypto_proccr(a.cr);
    }
    else if (!pfid && a.n) {
        if (!sckeyrequest[a.h]) {
            sckeyrequest[a.h] = [];
        }
        sckeyrequest[a.h].push(...a.n);
    }

    scsharesuiupd = true;
});

scparser.$add('u', function(a) {
    // update node attributes
    const n = M.d[a.n];
    if (n) {
        let oldattr;

        // key update - no longer supported
        // API sends keys only for backwards compatibility
        // if (a.k) n.k = a.k;

        // attribute update - replaces all existing attributes!
        if (a.at) {
            oldattr = crypto_clearattr(n);
            oldattr.u = n.u;
            oldattr.ts = n.ts;
            n.a = a.at;
        }

        // owner update
        if (a.u) {
            n.u = a.u;
        }

        // timestamp update
        if (a.ts) {
            n.ts = a.ts;
        }

        // try to decrypt new attributes
        crypto_decryptnode(n);

        // we got a new attribute string, but it didn't pass muster?
        // revert to previous state (effectively ignoring the SC command)
        if (a.at && n.a) {
            if (d) {
                console.warn(`Ignored bad attribute update for node ${a.n}`, a, n);
            }
            crypto_restoreattr(n, oldattr);
            delete n.a;
        }
        else {
            // success - check what changed and redraw
            if (a.at && fminitialized) {
                if (oldattr.lbl !== n.lbl) {
                    M.labelDomUpdate(n.h, n.lbl);
                }
                if (oldattr.fav !== n.fav) {
                    M.favouriteDomUpdate(n, n.fav);
                }
                if (oldattr.name !== n.name) {
                    M.onRenameUIUpdate(n.h, n.name);
                }
                if (M.dyh) {
                    M.dyh('check-node-update', n, oldattr);
                }
            }

            // save modified node
            M.nodeUpdated(n);
        }
    }
});

scparser.$add('d', function(a) {
    var fileDeletion = (M.d[a.n] && !M.d[a.n].t);
    var topVersion = null;
    if (fileDeletion) {
        topVersion = fileversioning.getTopNodeSync(a.n);
    }

    // This is node move
    if (a.m) {
        if (d) {
            console.time(`sc:d.${a.n}`);
        }
        $.moveNodeShares = $.moveNodeShares || Object.create(null);
        (function _checkMoveNodeShare(h) {
            const n = M.d[h];
            if (n) {
                if (n.shares) {
                    $.moveNodeShares[h] = n.shares;
                }
                if (n.t && M.c[h]) {
                    Object.keys(M.c[h]).forEach(_checkMoveNodeShare);
                }
            }
        })(a.n);
        if (d) {
            console.timeEnd(`sc:d.${a.n}`);
        }
    }

    // node deletion
    M.delNode(a.n, false, !!a.m);

    // was selected, now clear the selected array.
    if ($.selected && ($.selected[0] === a.n)) {
        $.selected = [];
    }
    if (!pfid && a.ou) {
        scparser.$notify(a);
    }
    if (!is_mobile) {
        if (fileDeletion && !a.v) {// this is a deletion of file.
            if (M.d[topVersion]) {
                fileversioning.updateFileVersioningDialog(topVersion);
            }
            else {
                fileversioning.closeFileVersioningDialog(a.n);
            }
        }
    }

    // Remove all upload in queue that target deleted node
    if (fminitialized && ul_queue.length > 0) {
        ulmanager.ulClearTargetDeleted(a.n);
    }

    if (!a.m && fminitialized && !pfid && !is_mobile) {
        M.storageQuotaCache = null;
        delay('checkLeftStorageBlock', () => M.checkLeftStorageBlock().catch(dump));
    }
});

scparser.$add('la', function() {
    'use strict';

    // last seen/acknowledged notification sn
    notify.markAllNotificationsAsSeen(true);
});

scparser.$add('usc', function() {
    if (folderlink) {
        return;
    }
    // user state cleared - mark local DB as invalid
    return fm_fullreload();
});

// Payment received
scparser.$add('psts', function(a) {
    'use strict';

    onIdle(() => {
        watchdog.notify('psts', (a.r === 's' && a.p) | 0);
    });

    if (fminitialized && !pfid) {
        pro.processPaymentReceived(a);
    }

    this.sqac(a);
});

// Storage quota allowance changed.
scparser.$add('sqac', (a) => {
    'use strict';

    if (d) {
        console.info(a.a, [a]);
    }

    if (ulmanager.ulOverStorageQuota) {
        eventlog(99701, a.a, true);

        delay('sqac:ul-resume', () => {
            ulmanager.ulResumeOverStorageQuotaState();
        });
    }

    if (dlmanager.isOverQuota) {

        delay('sqac:dl-resume', () => {
            dlmanager._onOverquotaDispatchRetry();
        });
    }

    // If a user is on FM, update the account status with this packet.
    if (fminitialized) {

        delay('sqac:ui-update', () => {

            if (!pfid) {

                if (page.indexOf('fm/account') === 0) {

                    accountUI();
                }
                else if (page === 'fm/dashboard') {

                    dashboardUI(true);
                }
                else {
                    M.accountData(() => {
                        if (mega.rewindUi && mega.rewindUi.sidebar.active) {
                            mBroadcaster.sendMessage('rewind:accountUpgraded');
                        }
                    });
                }
            }
            if (u_attr) {
                delete u_attr.tq;
            }
            M.storageQuotaCache = null;

            if ($.topMenu) {

                topMenu();
            }
            else if (!pfid) {

                M.checkLeftStorageBlock();
            }

            M.checkStorageQuota(2e3);
        });
    }
});

// Payment reminder
scparser.$add('pses', function(a) {
    'use strict';
    if (!folderlink) {
        notify.notifyFromActionPacket(a).catch(dump);
    }
});

// Payment card status
scparser.$add('cce', () => {
    'use strict';

    // assuming that this AP will come only to PRO/Business accounts.
    if (fminitialized && !folderlink) {

        delay('cce-action-packet', () => {
            M.updatePaymentCardState().catch(dump);
        }, 2000);
    }
});

scparser.mcsmp = a => {
    'use strict';
    if (folderlink) {
        return;
    }
    if (megaChatIsReady) {
        megaChat._queuedMcsmPackets[a.id] = {data: a, type: 'mcsmp'};
    }
    else if (Array.isArray(loadfm.chatmcsm)) {
        loadfm.chatmcsm.push(a);
    }

    if (fmdb) {
        delete a.a;
        fmdb.add('mcsm', {id: a.id, d: a});
    }
};

scparser.mcsmr = a => {
    'use strict';
    if (folderlink) {
        return;
    }
    if (megaChatIsReady) {
        megaChat._queuedMcsmPackets[a.id] = {data: a, type: 'mcsmr'};
    }
    else if (Array.isArray(loadfm.chatmcsm)) {
        loadfm.chatmcsm = loadfm.chatmcsm.filter(s => s.id !== a.id);
    }

    if (fmdb) {
        fmdb.del('mcsm', a.id);
    }
};

scparser.mcpc = scparser.mcc = function (a) {
    if (folderlink) {
        return;
    }
    if (megaChatIsReady) {
        megaChat._queuedMccPackets.push(a);
    }
    else if (Array.isArray(loadfm.chatmcf)) {
        // Merge if exists.
        // This can happen in case some data came from fmdb, but there were still queued ap's (mcpc for
        // added/removed participants). If this doesn't merge the chatmcf entry, this would end up removing the
        // 'ck', since mcpc doesn't contain 'ck' properties and the chat would render useless (no key).
        var i = loadfm.chatmcf.length;
        while (i--) {
            var entry = loadfm.chatmcf[i];
            if (entry.id === a.id) {
                delete a.a;
                Object.assign(entry, a);
                a = entry;
                break;
            }
        }
        if (i < 0) {
            loadfm.chatmcf.push(a);
        }
    }
    else {
        console.error('unable to parse mcc packet');
        const {owner, actors} = mBroadcaster.crossTab;
        eventlog(
            99779,
            JSON.stringify([
                1,
                buildVersion && buildVersion.website || 'dev',
                sessionStorage.updateRequiredBy | 0,
                loadfm.chatmcf === null ? 'null' : typeof loadfm.chatmcf,
                u_type | 0,
                (!!owner) | 0,
                Object(actors).length | 0
            ])
        );
    }

    if (fmdb) {
        delete a.a;
        fmdb.add('mcf', {id: a.id, d: a});
    }
};

// MEGAchat archive/unarchive
scparser.mcfc = scparser.mcfpc = function(a) {
    'use strict';
    if (folderlink) {
        return;
    }
    if (window.megaChatIsReady) {
        var room = megaChat.getChatById(a.id);
        if (room) {
            return room.updateFlags(a.f, true);
        }
    }

    if (!loadfm.chatmcfc) {
        loadfm.chatmcfc = {};
    }
    loadfm.chatmcfc[a.id] = a.f;
};


scparser.$add('_sn', function(a) {
    // sn update?
    if (d) {
        console.info(` --- New SN: ${a.sn}`);
    }
    onIdle(() => setsn(a.sn));

    // rewrite accumulated RSA keys to AES to save CPU & bandwidth & space
    crypto_node_rsa2aes();

    // rewrite accumulated RSA keys to AES to save CPU & bandwidth & space
    crypto_share_rsa2aes();

    // reset state
    scinshare = Object.create(null);

    if (megaChatIsReady) {
        megaChat.onSnActionPacketReceived();
    }
});

scparser.$add('_fm', function() {
    // completed initial processing, enable UI
    crypto_fixmissingkeys(missingkeys);
    delay('reqmissingkeys', crypto_reqmissingkeys, 4e3);
    loadfm_done();
});

// sub-user status change in business account
scparser.$add('ssc', process_businessAccountSubUsers_SC);

// business account change which requires reload (such as payment against expired account)
scparser.$add('ub', function() {
    "use strict";
    if (!folderlink) {
        fm_fullreload(null, 'ub-business').catch(dump);
    }
});

// Pro Flexi account change which requires reload (such as payment against expired account)
scparser.$add('upf', () => {
    "use strict";
    if (!folderlink) {
        fm_fullreload(null, 'upf-proflexi').catch(dump);
    }
});

// Sets handlers
scparser.$add('asp', (data) => {
    'use strict';
    if (folderlink) {
        return;
    }
    mega.sets.parseAsp(data);
});
scparser.$add('asr',(data) => {
    'use strict';
    if (folderlink) {
        return;
    }
    mega.sets.parseAsr(data);
});
scparser.$add('aep', (data) => {
    'use strict';
    if (folderlink) {
        return;
    }
    mega.sets.parseAep(data);
});
scparser.$add('aer', (data) => {
    'use strict';
    if (folderlink) {
        return;
    }
    mega.sets.parseAer(data);
});
scparser.$add('ass', (data) => {
    'use strict';
    mega.sets.parseAss(data);
});

scparser.$notify = function(a) {
    // only show a notification if we did not trigger the action ourselves
    if (!pfid && u_attr && a.ou !== u_attr.u) {
        notify.notifyFromActionPacket(a);
    }
};

scparser.$call = function(a, scnodes) {
    'use strict';

    // eslint-disable-next-line local-rules/hints
    try {
        if (scparser.$common[a.a]) {
            // no matter who triggered it
            scparser.$common[a.a](a);
        }
        else if (scparser[a.i]) {
            // triggered locally
            if (scparser[a.i][a.a]) {
                scparser[a.i][a.a](a);
            }
        }
        else if (scparser[a.a]) {
            // triggered remotely or cached.
            scparser[a.a](a, scnodes);
        }
        else if (d) {
            console.debug(`Ignoring unsupported SC command ${a.a}`, a);
        }
    }
    catch (ex) {
        console.error('scparser', ex);
        reportError(ex);
    }
};

// perform post-execution UI work
// eslint-disable-next-line complexity
scparser.$finalize = async() => {
    'use strict';

    // scq ran empty - nothing to do for now
    if (d && sccount) {
        console.info(`${sccount} SC command(s) processed.`);
    }

    if (!fminitialized || !sccount) {
        sccount = 0;
        scinflight = false;
        return;
    }

    if (newnodes.length) {

        delay('ui:fm.updated', () => M.updFileManagerUI().catch(dump), 80);
    }
    delay('thumbnails', fm_thumbnails, 3200);

    if (loadavatars.length) {
        useravatar.refresh(loadavatars).catch(dump);
        loadavatars = [];
    }

    // Update Info panel UI
    if (!is_mobile) {
        delay('infoPanel', mega.ui.mInfoPanel.reRenderIfVisible.bind(mega.ui.mInfoPanel, $.selected));
    }

    if (scsharesuiupd) {
        onIdle(() => {
            M.buildtree({h: 'shares'}, M.buildtree.FORCE_REBUILD);
            M.buildtree({h: 'out-shares'}, M.buildtree.FORCE_REBUILD);

            if (M.currentrootid === 'shares' || M.currentrootid === 'out-shares') {

                M.openFolder(M.currentdirid, true).catch(dump);
            }
            else if (megaChatIsReady && M.chat && megaChat.routingSection === "contacts") {
                const id = String(M.currentdirid).substr(14);
                mBroadcaster.sendMessage(`fmViewUpdate:${id}`);
            }

            if ($.dialog === 'share') {
                // Re-render the content of access list in share dialog
                renderShareDialogAccessList();
            }
        });

        scsharesuiupd = false;
    }

    if (scpubliclinksuiupd) {
        onIdle(() => {
            M.buildtree({h: 'public-links'}, M.buildtree.FORCE_REBUILD);

            if (M.currentrootid === 'public-links') {
                M.openFolder(M.currentdirid, true);
            }
        });

        scpubliclinksuiupd = false;
    }

    if (!pfid && $.len(sckeyrequest)) {
        const keyof = (h) => crypto_keyok(M.d[h]);

        if (d) {
            console.debug('Supplying requested keys...', sckeyrequest);
        }

        // eslint-disable-next-line guard-for-in
        for (const h in sckeyrequest) {
            const n = sckeyrequest[h].filter(keyof);
            const cr = crypto_makecr(n, [h], true);

            if (cr[2].length) {
                api_req({a: 'k', cr, i: requesti});
            }
        }

        sckeyrequest = Object.create(null);
    }

    if (`chat/contacts/${scContactsSharesUIUpdate}` === M.currentdirid) {
        onIdle(((handle) => {
            mBroadcaster.sendMessage(`fmViewUpdate:${handle}`);
        }).bind(null, scContactsSharesUIUpdate));

        scContactsSharesUIUpdate = false;
    }

    sccount = 0;
    scinflight = false;
    queueMicrotask(resumesc);
};

// if no execsc() thread is running, check if one should be, and start it if so.
function resumesc() {
    "use strict";

    if (!scinflight && scq[scqtail]) {
        scinflight = true;
        execsc();
    }
}

// execute actionpackets from scq[scqtail] onwards
function execsc() {
    "use strict";

    let tickcount = 0;
    const tick = Date.now();

    do {
        let pkt = false;
        let lock = true;
        let i = scqtail;

        while (scq[i] && scq[i][0] && !scwaitnodes[i] && !nodesinflight[i]) {
            if (pkt) {
                const a = scq[i][0];

                if (a.i !== pkt.i) {
                    lock = false;
                    break;
                }
            }

            pkt = scq[i++][0];

            if (!pkt.i || pkt.i === requesti) {
                lock = false;
                break;
            }
        }

        if (lock) {
            return scparser.$finalize();
        }
        const [a, scnodes] = scq[scqtail];

        // If there is any listener waiting for acknowledge from API, dispatch it.
        if ((a.i || a.st) && a.i !== requesti) {
            const q = a.i && scq[scqtail + 1];
            const v = api.ack({...a, scnodes}, a.i, q && (q[0].i === a.i || a.st && a.st === q[0].st));

            switch (v) {
                case 7:
                    if (d) {
                        api.webLockSummary();
                        console.info(`Awaiting API response for SC command '${a.a}..${a.st}..${a.i}'`);
                    }
                    return;
                case 5:
                    a.i = requesti;
                    break;
            }
        }

        delete scq[scqtail++];
        delete a.scqi;

        if (d) {
            console.info(`Received SC command "${a.a}"${a.i === requesti ? ' (triggered locally)' : ''}`, a);
            console.assert(a.i !== requesti || !a.st || a.st === api.currst, `${a.i} < ${a.st} != ${api.currst}`);
        }

        // process action-packet
        scparser.$call(a, scnodes);

        if (a.st) {
            api.catchup(a);
        }

        sccount++;
        tickcount++;
    } while (Date.now() - tick < 200);

    if (d) {
        console.log(`Processed ${tickcount} SC commands in the past 200 ms`);
    }
    onIdle(execsc);
}

// a node was updated significantly: write to DB and redraw
function fm_updated(n) {
    "use strict";

    M.nodeUpdated(n);

    if (fminitialized) {
        removeUInode(n.h);
        newnodes.push(n);
        if (M.megaRender) {
            M.megaRender.revokeDOMNode(n.h, true);
        }
        delay('ui:fm.updated', () => M.updFileManagerUI().catch(dump), 30);
    }
}

function initworkerpool() {
    "use strict";

    // Allow all 0 keys to be used (for those users that used a bad client that want to retrieve their files)
    const allowNullKeys = localStorage.getItem('allownullkeys') ? 1 : undefined;
    if (allowNullKeys) {
        self.allowNullKeys = allowNullKeys;
    }
    const {secureKeyMgr} = self;
    if (secureKeyMgr && d) {
        console.info('Secure Keys Management.', mega.keyMgr.generation);
    }

    const workerStateData = {
        d,
        u_k,
        u_privk,
        u_handle,
        secureKeyMgr,
        allowNullKeys,
        usk: window.u_attr && u_attr['*~usk']
    };

    // re/initialize workers (with state for a user account fetch, if applies)
    decWorkerPool.init(worker_procmsg, 8, !pfid && workerStateData);

    if (d) {
        console.debug('initworkerpool', decWorkerPool);
    }
}

/**
 * Queue a DB invalidation-plus-reload request to the FMDB subsystem.
 * If it isn't up, reload directly.
 *
 * The server-side tree-cache may be wiped,
 * e.g., because it's too old or damaged (otherwise, we could run into an endless loop)
 *
 * @param {Boolean|MEGAPIRequest} [light] Perform a light reload, without tree-cache wiping.
 * @param {String} [logMsg] optional event-log message, if light != true
 * @returns {Promise<void>} undefined
 */
async function fm_fullreload(light, logMsg) {
    "use strict";

    // FIXME: properly encapsulate ALL client state in an object
    // that supports destruction.
    // (at the moment, if we wipe the DB and then call loadfm(),
    // there will be way too much attribute, key and chat stuff already
    // churning away - we simply cannot just delete their databases
    // without restarting them.
    // until then - it's the sledgehammer method; can't be anything
    // more surgical :(
    if (light !== true) {
        if (light instanceof MEGAPIRequest) {
            light.abort();
        }

        if (logMsg === 'ETOOMANY' && mega.loadReport.mode < 2 && !sessionStorage.lightTreeReload) {
            sessionStorage.lightTreeReload = 1;
        }
        else {
            localStorage.force = 1;
            delete sessionStorage.lightTreeReload;
        }

    }

    if (window.loadingDialog) {
        // 1141: 'Please be patient.'
        loadingInitDialog.hide('force');
        loadingDialog.show('full-reload', l[1141]);
        loadingDialog.show = loadingDialog.hide = nop;
    }

    // stop further SC processing
    window.execsc = nop;

    // and error reporting, if any
    window.onerror = null;

    // nuke w/sc connection
    getsc.stop(-1, 'full-reload');
    window.getsc = nop;
    getsc.validate = nop;

    return Promise.allSettled([
        fmdb && fmdb.invalidate(),
        logMsg && eventlog(99624, logMsg)
    ]).then(() => location.reload(true));
}

// this receives the ok elements one by one as per the filter rule
// to facilitate the decryption of outbound shares, the API now sends ok before f
function tree_ok0(ok) {
    "use strict";

    if (self.secureKeyMgr) {
        if (d > 2) {
            console.warn('Secure environment, moving on...', ok);
        }
        return;
    }

    if (fmdb) {
        fmdb.add('ok', { h : ok.h, d : ok });
    }

    // bind outbound share root to specific worker, post ok element to that worker
    // FIXME: check if nested outbound shares are returned with all shareufskeys!
    // if that is not the case, we need to bind all ok handles to the same worker
    if (decWorkerPool.ok) {
        decWorkerPool.postNode(ok);
    }
    else if (crypto_handleauthcheck(ok.h, ok.ha)) {
        if (d) {
            console.log(`Successfully decrypted sharekeys for ${ok.h}`);
        }
        const key = decrypt_key(u_k_aes, base64_to_a32(ok.k));
        crypto_setsharekey2(ok.h, key);
    }
    else {
        console.error(`handleauthcheck() failed for ${ok.h}`);
    }
}

/**
 * Emplace node into M.d and M.c
 *
 * @param {Object}  node   The node to add
 * @param {Boolean} [noc]  Whether adding to M.c should be skipped, only used by fetchchildren!
 */
function emplacenode(node, noc) {
    "use strict";

    if (node.p) {
        // we have to add M.c[sharinguserhandle] records explicitly as
        // node.p has ceased to be the sharing user handle
        if (node.su) {
            if (!M.c[node.su]) {
                M.c[node.su] = Object.create(null);
            }
            M.c[node.su][node.h] = node.t + 1;
        }
        if (!noc) {
            if (!M.c[node.p]) {
                M.c[node.p] = Object.create(null);
            }
            M.c[node.p][node.h] = node.t + 1;
        }

        if (node.hash) {
            if (!M.h[node.hash]) {
                M.h[node.hash] = new Set();
            }
            M.h[node.hash].add(node.h);
        }
    }
    else if (node.t > 1 && node.t < 5) {
        M[['RootID', 'InboxID', 'RubbishID'][node.t - 2]] = node.h;
    }
    else {
        if (d) {
            console.error("Received parent-less node of type " + node.t + ": " + node.h);
        }

        srvlog2('parent-less', node.t, node.h);
    }

    if (!node.h || node.h.length !== 8) {
        if (d && !node.h) {
            console.error('Invalid node placement.', node);
        }
        M.d[node.h] = node;
    }
    else {
        M.d[node.h] = Object.setPrototypeOf(node, MegaNode.prototype);
    }
}

// this receives the node objects one by one as per the filter rule
function tree_node(node) {
    "use strict";

    if (pfkey && !M.RootID) {
        // set up the workers for folder link decryption
        if (decWorkerPool.ok) {
            decWorkerPool.signal({
                d,
                pfkey,
                n_h: node.h,
                secureKeyMgr: self.secureKeyMgr,
                allowNullKeys: self.allowNullKeys
            });
        }
        else {
            crypto_setsharekey2(node.h, base64_to_a32(pfkey));
        }

        M.RootID = node.h;
    }
    else if (M.d[node.h] && (M.d[node.h].name || M.d[node.h].k === undefined)) {
        // already decrypted
        return;
    }

    if (!mega.keyMgr.secure) {
        crypto_rsacheck(node);

        // RSA share key? need to rewrite, too.
        if (node.sk && node.sk.length > 43) {
            rsasharekeys[node.h] = true;
        }
    }

    // children inherit their parents' worker bindings; unbound inshare roots receive a new binding
    // unbound nodes go to a random worker (round-robin assignment)
    if (decWorkerPool.ok) {
        decWorkerPool.postNode(node);
    }
    else {
        crypto_decryptnode(node);
        worker_procmsg({data: node});
    }
}

// this receives the remainder of the JSON after the filter was applied
function tree_residue(data) {
    "use strict";
    assert(this instanceof MEGAPIRequest);

    if (!decWorkerPool.inflight) {
        decWorkerPool.inflight = new Set();
    }
    decWorkerPool.inflight.add(this);

    if (!this.residual.length) {
        this.residual.push(mega.promise);
    }

    // store the residual f response for perusal once all workers signal that they're done
    this.residual.push(...data);

    // request an "I am done" confirmation ({}) from all workers
    if (decWorkerPool.ok) {
        dumpsremaining = decWorkerPool.length;
        decWorkerPool.signal({});
    }
    else {
        dumpsremaining = 1;
        worker_procmsg({ data: { done: 1 } });
    }
}

// process worker responses (decrypted nodes, processed actionpackets, state dumps...)
function worker_procmsg(ev) {
    "use strict";

    if (ev.data.scqi >= 0) {
        // enqueue processed actionpacket
        if (scq[ev.data.scqi]) scq[ev.data.scqi][0] = ev.data;
        else scq[ev.data.scqi] = [ev.data, []];

        // resume processing, if appropriate and needed
        resumesc();
    }
    else if (ev.data.h) {
        // enqueue or emplace processed node
        if (ev.data.t < 2 && !crypto_keyok(ev.data)) {
            // report as missing
            console.assert(typeof ev.data.k === 'string', `Key-less? node ${ev.data.h}`, ev.data);
            tryCatch(() => crypto_reportmissingkey(ev.data))();
        }

        if (ev.data.scni >= 0) {
            const node = ev.data;
            const {scni, scqp} = node;

            // enqueue processed node
            if (!scq[scni]) {
                scq[scni] = [null, []];
            }
            if (scq[scni][1]) {
                scq[scni][1][scqp] = node;
            }

            delete node.scni;
            delete node.scqp;

            startNodesFetching(scni);
        }
        else {
            // maintain special incoming shares index
            if (ev.data.su) {
                M.c.shares[ev.data.h] = { su : ev.data.su, r : ev.data.r, t: ev.data.h };

                if (u_sharekeys[ev.data.h]) {
                    M.c.shares[ev.data.h].sk = a32_to_base64(u_sharekeys[ev.data.h][0]);
                }
            }

            if (ufsc.cache && ev.data.p) {
                ufsc.feednode(ev.data);
            }

            const ok = fmdb && !fmdb.crashed;
            const emplace = mega.nobp || !ok || fminitialized || fmdb && fmdb.memoize || M.isInRoot(ev.data, true);

            if (ok) {
                fmdb.add('f', {
                    h : ev.data.h,
                    p : ev.data.p,
                    s : ev.data.s >= 0 ? ev.data.s : -ev.data.t,
                    t : ev.data.t ? 1262304e3 - ev.data.ts : ev.data.ts,
                    c : ev.data.hash || '',
                    fa: ev.data.fa || '',
                    d : ev.data
                });
            }

            if (emplace) {
                emplacenode(ev.data);
            }
        }
    }
    else if (ev.data[0] === 'console') {
        if (d) {
            var args = ev.data[1];
            args.unshift('[nodedec worker]');
            console.log.apply(console, args);
        }
    }
    else if (ev.data[0] === 'srvlog2') {
        srvlog2.apply(null, ev.data[1]);
    }
    else if (ev.data.done) {
        if (d) {
            console.log(`Worker ${dumpsremaining} done, ${ev.data.jobs} jobs completed.`);
        }

        if (ev.data.sharekeys) {
            for (const h in ev.data.sharekeys) {
                const sk = ev.data.sharekeys[h];

                if (!u_sharekeys[h] || u_sharekeys[h][0] !== sk) {

                    crypto_setsharekey(h, sk);
                }
            }
        }

        if (!--dumpsremaining) {
            // store incoming shares
            for (const h in M.c.shares) {
                if (u_sharekeys[h]) {
                    M.c.shares[h].sk = a32_to_base64(u_sharekeys[h][0]);
                }

                if (fmdb) {
                    fmdb.add('s', {
                        o_t: `${M.c.shares[h].su}*${h}`,
                        d: M.c.shares[h]
                    });
                }
            }

            if (decWorkerPool.inflight) {
                for (const api of decWorkerPool.inflight) {

                    if (api.residual[0]) {
                        api.residual[0].resolve();
                    }
                    else if (d) {
                        console.error('Were two api4 channels running concurrently?', api.residual);
                    }
                }
                decWorkerPool.inflight = null;
            }
        }
    }
    else {
        console.error("Unidentified nodedec worker response:", ev.data);
    }
}

function loadfm(force) {
    "use strict";
    assert(!is_chatlink);

    if (force) {
        localStorage.force = true;
        loadfm.loaded = false;
    }
    if (loadfm.loaded) {
        Soon(loadfm_done.bind(this, -0x800e0fff));
    }
    else {
        if (is_fm()) {
            loadingDialog.hide();
            loadingInitDialog.show();
            loadingInitDialog.step1();
        }
        if (!loadfm.loading) {
            if (!decWorkerPool.ok) {
                initworkerpool();
            }
            M.reset();

            fminitialized  = false;
            loadfm.loading = true;

            // is this a folder link? or do we have no valid cache for this session?
            if (pfid) {
                fmdb = false;
                fetchfm(false).catch(tell);
            }
            else if (!u_k_aes) {
                console.error('No master key found... please contact support@mega.nz');
            }
            else {
                const f_table_schema = '&h, p, s, c, t, fa';
                fmdb = FMDB(u_handle, {
                    // channel 0: transactional by _sn update
                    f      : f_table_schema,   // nodes - handle, parent, size (negative size: type), checksum
                    s      : '&o_t',           // shares - origin/target; both incoming & outgoing
                    ok     : '&h',             // ownerkeys for outgoing shares - handle
                    mk     : '&h',             // missing node keys - handle
                    u      : '&u',             // users - handle
                    ph     : '&h',             // exported links - handle
                    tree   : '&h',             // tree folders - handle
                    suba   : '&s_ac',          // sub_accounts of master business account
                    opc    : '&p',             // outgoing pending contact - id
                    ipc    : '&p',             // incoming pending contact - id
                    ps     : '&h_p',           // pending share - handle/id
                    mcf    : '&id',            // chats - id
                    mcsm   : '&id',            // scheduled meetings - id
                    asp    : '&id, ts, cts',   // Element Sets (set)
                    aep    : '&id, ts, s, h',  // Element Sets (elements)
                    ua     : '&k',             // user attributes - key (maintained by IndexedBKVStorage)
                    _sn    : '&i',             // sn - fixed index 1
                    puf    : '&ph',            // public upload folder - handle
                    pup    : '&p',             // public upload page - handle

                    // channel 1: non-transactional (maintained by IndexedDBKVStorage)
                }, {});

                if (d) {
                    console.time(`get-tree(f:db)`);
                }

                fmdb.init(localStorage.force)
                    .catch(dump)
                    .then(fetchfm)
                    .catch((ex) => {
                        console.error(ex);
                        siteLoadError(ex, 'loadfm');
                    })
                    .finally(() => {
                        if (d) {
                            api.webLockSummary();
                            console.timeEnd(`get-tree(f:db)`);
                        }
                    });
            }
        }
    }
}

async function fetchfm(sn) {
    "use strict";

    // we always intially fetch historical actionpactions
    // before showing the filemanager
    initialscfetch = true;

    // Initialize ufs size cache
    ufsc = new UFSSizeCache();

    // Get the media codecs list ready
    mclp = MediaInfoLib.getMediaCodecsList();

    // worker pending state dump counter
    dumpsremaining = 0;

    // erase existing RootID
    // reason: tree_node must set up the workers as soon as the first node of a folder
    // link arrives, and this is how it knows that it is the first node.
    M.RootID = false;

    if (window.pfcol) {
        console.assert(!window.fmdb);
        console.assert(loadfm.loading);
        console.assert(!loadfm.loaded);

        api.req({ a: 'aft', v: 2 }, 1)
            .then(({ result: { e, n, s, sn } }) => {
                const res = mega.sets.getPublicSetTree(s, e, n, sn);
                loadfm_callback(res);
            })
            .catch((ex) => {
                folderreqerr(false, ex);
                dump(`Could not load collection... Error: ${ex}`);
            });

        return;
    }

    if (!is_mobile) {
        // activate/prefetch attribute cache at this early stage
        await attribCache.load();
    }

    if (typeof sn === 'string' && sn.length === 11) {
        currsn = sn;
        return dbfetchfm();
    }

    /** @property mega.loadReport.mode */
    Object.defineProperty(mega.loadReport, 'mode', {value: 2, writable: false});

    if (!pfid) {
        // dbToNet holds the time wasted trying to read local DB, and having found we have to query the server.
        mega.loadReport.dbToNet = Date.now() - mega.loadReport.startTime;
        mega.loadReport.stepTimeStamp = Date.now();
    }

    // no cache requested or available - get from API.
    // load tree for active GLOBAL context - either we load a folderlink or the
    // user tree, they never coexist, there is no encapsulation/separation of state.
    const payload = {a: 'f', c: 1, r: 1};
    const options = {
        channel: 4,
        dedup: false,
        progress(pcn) {
            window.loadingInitDialog.step2(parseInt(pcn));

            if (pcn > 99 && !mega.loadReport.ttlb) {
                // Load performance report -- time to last byte
                mega.loadReport.ttlb = Date.now() - mega.loadReport.stepTimeStamp;
                mega.loadReport.stepTimeStamp = Date.now();

                mega.loadReport.ttlb += mega.loadReport.ttfb;
                mega.loadReport.ttfm = mega.loadReport.stepTimeStamp;
            }
        }
    };

    // we disallow treecache usage if this is a forced reload
    if (!localStorage.force) {
        payload.ca = 1;
    }
    else if (mBroadcaster.crossTab.owner) {
        delete localStorage.force;
    }

    if (fmdb && mega.infinity) {
        payload.inc = parseInt(localStorage.inclvl) | 1;
    }
    else if (!pfid) {

        // Decide whether to show MEGA Lite mode dialog or not
        tryCatch(() => mega.lite.recommendLiteMode())();
    }

    return api.req(payload, options)
        .then(({result}) => {
            if (!mega.infinity) {
                decWorkerPool.cleanup();

                if (!pfid) {
                    mega.lite.abort();
                }
            }
            loadfm.fromapi = true;
            return dbfetchfm(result);
        });
}

function dbfetchfm(residual) {
    "use strict";
    var tables = {
        tree: function(r) {
            for (var i = r.length; i--;) {
                ufsc.addTreeNode(r[i], true);
            }
            if (d) {
                console.debug('processed %d tree nodes.', r.length);
            }
        },
        opc: processOPC,
        ipc: processIPC,
        ps: function(r) {
            if (r.length) {
                processPS(r, true);
                // processPS may invokes nodeShare(), that uses acquire.
                return dbfetch.acquire(r.map(n => n.h));
            }
        },
        puf: function _(r) {
            if (r.length) {
                if (d) {
                    console.log('#file-request - dbfetchfm - puf', r);
                }
                return mega.fileRequest.processPuHandleFromDB(r);
            }
        },
        pup: function(r) {
            if (r.length) {
                if (d) {
                    console.log('#file-request - dbfetchfm - pup', r);
                }
                return mega.fileRequest.processPuPageFromDB(r);
            }
        },
        suba: process_suba,
        mcf: 1,
        mcsm: 2
    };
    var tableProc = function(t) {
        return function(r) {
            if (tables[t] === 1) {
                if (r.length > 0) {
                    // only set chatmcf is there is anything returned
                    // if not, this would force the chat to do a 'mcf' call
                    loadfm.chatmcf = r;
                }
                else {
                    loadfm.chatmcf = -1;
                }
            }
            else if (tables[t] === 2) {
                loadfm.chatmcsm = r.length > 0 ? r : -1;
            }
            else {
                return tables[t](r, true);
            }
        };
    };
    loadingInitDialog.step2();

    const isFromAPI = !!loadfm.fromapi;
    const loadReport = isFromAPI ? nop : (key) => {
        const now = Date.now();
        mega.loadReport[key] = now - mega.loadReport.stepTimeStamp;
        mega.loadReport.stepTimeStamp = now;
    };
    const finish = () => {

        if (isFromAPI) {
            window.loadingInitDialog.step3(1, 20);
            return tSleep(0.3, residual || false).then(loadfm_callback);
        }

        return getsc(true);
    };

    if (!window.fmdb) {
        console.assert(isFromAPI);
        return onIdle(finish);
    }

    if (isFromAPI) {
        // Tree nodes are already in memory.
        delete tables.tree;
    }

    if (d) {
        console.time('dbfetchfm');
    }

    return Promise.all([fmdb.get('ok'), dbfetch.init()])
        .then(([ok]) => {
            process_ok(ok, true);

            loadReport('recvNodes');
            return Promise.all([fmdb.get('mk'), fmdb.get('u'), fmdb.get('s')]);
        })
        .then(([mk, users, shares]) => {
            var promises = [];

            crypto_missingkeysfromdb(mk);
            mega.loadReport.pn1 = Date.now() - mega.loadReport.stepTimeStamp;

            process_u(users, true);
            loadReport('pn2');
            // @todo deprecate those pn1-pn5 ...
            loadReport('pn3');

            const r = shares;
            for (var i = r.length; i--;) {
                if (r[i].su) {
                    // this is an inbound share
                    M.c.shares[r[i].t] = r[i];

                    if (r[i].sk) {
                        crypto_setsharekey(r[i].t, base64_to_a32(r[i].sk), true);
                    }
                }
                else {
                    // this is an outbound share
                    promises.push(M.nodeShare(r[i].h, r[i], true));
                }
            }
            loadReport('pn4');

            if (promises.length) {
                // handle all outbound shares through a single promise.
                // if an ENOENT happens, this won't halt the process...
                promises = [Promise.allSettled(promises)];
            }

            for (var j = 0, it = Object.keys(tables); j < it.length; ++j) {
                var t = it[j];
                promises.push(fmdb.get(t).then(tableProc(t)).catch(dump));
            }
            loadReport('pn5');

            return Promise.all(promises);
        })
        .then((r) => {
            if (d) {
                console.info('All settled, %d operations completed to load from DB.', r.length);
                console.timeEnd('dbfetchfm');
            }

            if (!isFromAPI) {
                mega.loadReport.mode = 1;
                mega.loadReport.procNodeCount = Object.keys(M.d || {}).length;
                loadReport('procNodes');
            }

            if (!mBroadcaster.crossTab.owner && window.fmdb) {
                // on a secondary tab, prevent writing to DB once we have read its contents
                fmdb.crashed = 666;
                fmdb.pending = [[]];
            }
            console.assert(window.fmdb, 'check what is going on here...');
        })
        .then(finish);
}

// returns tree type h is in
// FIXME: make result numeric
function treetype(h) {
    "use strict";

    for (;;) {
        if (!M.d[h]) {
            return h;
        }

        if (h === M.InboxID) {
            return 'inbox';
        }

        // root node reached?
        if (M.d[h].t > 1) {
            return 'cloud';
        }

        // incoming share reached? (does not need to be the outermost one)
        if (M.d[h].su) {
            return 'shares';
        }

        if ('contacts shares messages opc ipc '.indexOf(M.d[h].p + ' ') >= 0) {
            return M.d[h].p;
        }

        h = M.d[h].p;
    }
}

// determine whether a node is shared
async function shared(h) {
    "use strict";

    if (!M.d[h]) {
        await dbfetch.acquire(h);
    }
    return shared.is(h);
}

shared.is = function(h) {
    'use strict';

    while (M.d[h]) {
        if (M.ps[h] || M.d[h].shares) {
            return h;
        }
        h = M.d[h].p;
    }
    return false;
};

// returns sharing user (or false if not in an inshare)
function sharer(h) {
    "use strict";

    while (h && M.d[h]) {
        if (M.d[h].su) {
            return M.d[h].su;
        }

        h = M.d[h].p;
    }

    return false;
}

// FIXME: remove alt
function ddtype(ids, toid, alt) {
    "use strict";

    if (folderlink) {
        return false;
    }

    var r = false, totype = treetype(toid);

    for (var i = ids.length; i--; ) {
        var fromid = ids[i];

        if (fromid === toid || !M.d[fromid]) return false;

        var fromtype = treetype(fromid);

        if (fromtype === 'inbox' || treetype(toid) === 'inbox') {

            return false;
        }

        if (totype == 'cloud') {
            if (fromtype == 'cloud') {
                // within and between own trees, always allow move ...
                if (M.isCircular(fromid, toid)) {
                    // ... except of a folder into itself or a subfolder
                    return false;
                }

                r = 'move';
            }
            else if (fromtype == 'shares') {
                r = toid === M.RubbishID ? 'copydel' : 'copy';
            }
        }
        else if (totype == 'contacts') {
            if (toid == 'contacts') {
                // never allow move to own contacts
                return false;
            }

            // to a contact, always allow a copy (inbox drop)
            r = 'copy';
        }
        else if (totype === 'shares' && M.getNodeRights(toid)) {
            if (fromtype == 'shares') {
                if (sharer(fromid) === sharer(toid)) {
                    if (M.isCircular(fromid, toid)) {
                        // prevent moving/copying of a folder into iself or a subfolder
                        return false;
                    }

                    //r = (M.getNodeRights(fromid) > 1) ? 'move' : 'copy'; //commented out by khaled - fixing Bug #7697
                    if (M.getNodeRights(fromid) > 1) { // added by khaled
                        r = 'move';
                    }
                    else {
                        return false;  // fixing Bug #7697, dont allow drag and drop if permission <2
                    }
                }
                else {
                    r = 'copy';
                }
            }
            else if (fromtype == 'cloud') {
                // from cloud to a folder with write permission, always copy
                r = 'copy';
            }
        }
        else {
            return false;
        }
    }

    // FIXME: do not simply return the operation allowed for the last processed fromid
    return r;
}

/**
 * Share a node with other users.
 *
 * Recreate target/users list and call appropriate api_setshare function.
 * @param {String} nodeId
 *     Selected node id
 * @param {Array} targets
 *     List of JSON_Object containing user email or user handle and access permission,
 *     i.e. `{ u: <user_email>, r: <access_permission> }`.
 * @returns {Promise}
 */
async function doShare(nodeId, targets) {
    'use strict';

    if (!nodeId || !targets || !targets.length) {
        console.error('Invalid parameters for doShare()', nodeId, targets);
        throw EARGS;
    }

    // Get complete children directory structure for root node with id === nodeId
    const childNodesId = mega.keyMgr.getShareSnapshot(nodeId);
    assert(childNodesId, 'Share-snapshot lost.');

    // Search by email only don't use handle cause user can re-register account
    const users = await Promise.all(targets.map((t) => crypt.getRSAPubKeyAttribute(t.u).catch(() => false)));

    // Create new lists of users, active (with user handle) and non existing (pending)
    for (let i = targets.length; i--;) {
        const {pubk, u: userHandle} = users[i];
        const {u: email, r: accessRights} = targets[i];

        const target = {r: accessRights, u: email};
        if (pubk) {
            target.u = userHandle;

            // M.u[].c might be 0 for invisible/removed, or undefined for pending contact
            if (!(userHandle in M.u && M.u[userHandle].c)) {
                target.m = email;

                // this was never correct..
                // target.k = pubk;
            }
        }

        targets[i] = target;
    }

    let res = await api_setshare(nodeId, targets, childNodesId).catch(echo);

    if (!res.r) {
        res = {r: [res]};
    }
    window.loadingDialog.hide();

    for (let i = res.r.length; i--;) {
        if (res.r[i] !== 0) {
            throw new Error(`Share operation failed, ${JSON.stringify(res.r[i])}`);
        }
    }

    // @todo is this still needed (here) ?
    for (const i in res.u) {
        M.addUser(res.u[i]);
    }

    onIdle(() => {
        // Render the outgoing shares page after set the new share node
        if (M.currentrootid === 'out-shares') {
            M.openFolder(M.currentdirid, true);
        }
    });

    return res;
}

// moving a foreign node (one that is not owned by u_handle) from an outshare
// to a location not covered by any u_sharekey requires taking ownership
// and re-encrypting its key with u_k.
// moving a tree to a (possibly nested) outshare requires a full set of keys
// to be provided. FIXME: record which keys are known to the API and exclude
// those that are to reduce API traffic.
function processmove(apireq) {
    'use strict';

    if (d > 2) {
        console.log('processmove', apireq);
    }

    var root = {};
    var tsharepath = M.getShareNodesSync(apireq.t);
    var nsharepath = M.getShareNodesSync(apireq.n, root, true);
    var movingnodes = false;

    // is the node to be moved in an outshare (or possibly multiple nested ones)?
    if (nsharepath.length && root.handle) {
        // yes, it is - are we moving to an outshare?
        if (!tsharepath.length) {
            // we are not - check for any foreign nodes being moved
            movingnodes = M.getNodesSync(apireq.n, true);

            // update all foreign nodes' keys and take ownership
            api_updfkey(movingnodes).catch(dump);
        }
    }
    tsharepath = M.getShareNodesSync(apireq.t, null, true);

    // is the target location in any shares? add CR element.
    if (tsharepath.length) {
        if (!movingnodes) {
            movingnodes = M.getNodesSync(apireq.n, true);
        }

        apireq.cr = crypto_makecr(movingnodes, tsharepath, true);
    }

    return apireq;
}

function process_f(f, updateVersioning) {
    "use strict";

    for (let i = 0; i < f.length; i++) {
        const n = f[i];

        if (updateVersioning) {
            // this is a response from updating versioning, clear the previous versions first.
            if (M.d[n.h]) {
                M.delNode(n.h);
                ufsc.delNode(n.h);
            }

            n.fv = 1;
        }

        M.addNode(n);
        ufsc.addNode(n);
    }
}

/**
 * Handle incoming pending contacts
 *
 * @param {Array} a action-packets
 * @param {Boolean} [ignoreDB] do not persist
 */
function processIPC(a, ignoreDB) {
    'use strict';

    for (let i = 0; i < a.length; ++i) {
        const ipc = a[i];
        const {dts, m, p} = ipc;

        // Deletion of incomming pending contact request, user who sent request, canceled it
        if (dts) {
            M.delIPC(p);

            if (fminitialized) {

                // Update token.input plugin
                removeFromMultiInputDDL('.share-multiple-input', {id: m, name: m});
            }
        }
        else {
            // Update ipc status
            M.addIPC(ipc, ignoreDB);

            if (fminitialized) {
                // Don't prevent contact creation when there's already IPC available
                // When user add contact who already sent IPC, server will automatically create full contact
                const name = M.getNameByHandle(p);

                // Update token.input plugin
                addToMultiInputDropDownList('.share-multiple-input', [{id: m, name}]);
            }
        }
    }
}

/**
 * Handle outgoing pending contacts
 *
 * @param {Array} a action-packets
 * @param {Boolean} [ignoreDB] do not persist
 */
function processOPC(a, ignoreDB) {
    'use strict';

    for (let i = 0; i < a.length; ++i) {
        const opc = a[i];
        const {dts, m, p} = opc;

        if (dts) {
            M.delOPC(p);

            if (fminitialized) {

                // Update tokenInput plugin
                removeFromMultiInputDDL('.share-multiple-input', {id: m, name: m});
                removeFromMultiInputDDL('.add-contact-multiple-input', {id: m, name: m});
            }
        }
        else {
            // Search through M.opc to find duplicated e-mail with .dts
            // If found remove deleted opc
            // And update sent-request grid
            for (var k in M.opc) {
                if (M.opc[k].dts && M.opc[k].m === m) {
                    delete M.opc[k];
                    break;
                }
            }
            M.addOPC(opc, ignoreDB);

            if (fminitialized) {
                const name = M.getNameByHandle(p);

                // Update tokenInput plugin
                addToMultiInputDropDownList('.share-multiple-input', [{id: m, name}]);
                addToMultiInputDropDownList('.add-contact-multiple-input', [{id: m, name}]);
            }
        }
    }
}

/**
 * processPH
 *
 * Process export link (public handle) action packet and 'f' tree response.
 * @param {Object} publicHandles The Public Handles action packet i.e. a: 'ph'.
 */
function processPH(publicHandles) {
    'use strict';
    var nodeId;
    var publicHandleId;
    var UiExportLink = fminitialized && !is_mobile && new mega.UI.Share.ExportLink();

    for (var i = publicHandles.length; i--; ) {
        var value = publicHandles[i];

        nodeId = value.h;
        if (!M.d[nodeId]) continue;

        if (fmdb) {
            if (value.d) {
                fmdb.del('ph', nodeId);
            }
            else {
                fmdb.add('ph', { h : nodeId });
            }
        }

        publicHandleId = value.ph;

        // remove exported link, down: 1
        if (value.d) {
            M.delNodeShare(nodeId, 'EXP');

            if (fminitialized && M.currentdirid === 'public-links') {
                removeUInode(nodeId, value.p);

                if (typeof selectionManager !== 'undefined') {
                    selectionManager.remove_from_selection(nodeId);
                }
            }

            if (UiExportLink) {
                UiExportLink.removeExportLinkIcon(nodeId);
            }
        }
        else {
            var share = clone(value);
            delete share.a;
            delete share.i;
            delete share.n;
            delete share.st;
            delete share.usn;
            share.u = 'EXP';
            share.r = 0;

            if (M.d[nodeId].ph !== publicHandleId) {
                M.d[nodeId].ph = publicHandleId;
                M.nodeUpdated(M.d[nodeId]);
            }

            M.nodeShare(share.h, share);

            if (UiExportLink) {
                UiExportLink.addExportLinkIcon(nodeId);
            }
        }

        if (is_mobile) {
            mobile.cloud.updateLinkIcon(nodeId);
        }

        if (UiExportLink && (value.down !== undefined)) {
            UiExportLink.updateTakenDownItem(nodeId, value.down);
        }

        if (fminitialized && M.recentsRender) {
            M.recentsRender.nodeChanged(nodeId);
        }
    }
}

/**
 * Handle pending shares
 *
 * @param {array.<JSON_objects>} pending shares
 */
function processPS(pendingShares, ignoreDB) {
    'use strict';
    for (let i = 0; i < pendingShares.length; ++i) {
        const ps = pendingShares[i];

        // From gettree
        if (ps.h) {
            M.addPS(ps, ignoreDB);
        }
        // Situation different from gettree, s2 from API response, doesn't have .h attr instead have .n
        else {
            const timeStamp = ps.ts;
            const nodeHandle = ps.n;
            const shareRights = ps.r;
            const pendingContactId = ps.p;
            const contactName = M.getNameByHandle(pendingContactId);

            // shareRights is undefined when user denies pending contact request
            // .op is available when user accepts pending contact request and
            // remaining pending share should be updated to full share
            if ((typeof shareRights === 'undefined') || ps.op) {
                M.delPS(pendingContactId, nodeHandle);

                if (ps.op) {
                    M.nodeShare(nodeHandle, {
                        h: ps.n,
                        o: ps.n,
                        p: ps.p,
                        u: ps.u,
                        r: ps.r,
                        ts: ps.ts
                    });
                }

                if (fminitialized && M.opc && M.opc[ps.p]) {
                    // Update tokenInput plugin
                    addToMultiInputDropDownList('.share-multiple-input', [{
                            id: M.opc[pendingContactId].m,
                            name: contactName
                        }]);
                    addToMultiInputDropDownList('.add-contact-multiple-input', [{
                            id: M.opc[pendingContactId].m,
                            name: contactName
                        }]);
                }
            }
            else {
                // Add the pending share to state
                M.addPS({
                    'h':nodeHandle,
                    'p':pendingContactId,
                    'r':shareRights,
                    'ts':timeStamp
                }, ignoreDB);

                if (M.d[nodeHandle] && M.d[nodeHandle].t) {
                    // Update M.IS_SHARED flag
                    ufsc.addTreeNode(M.d[nodeHandle]);
                }
            }

            if (fminitialized) {
                sharedUInode(nodeHandle);
            }
        }
    }
}

/**
 * Updates contact/user data in global variable M.u, local dB and taking care of items in share and add contacts
 * dialogs dropdown
 *
 * @param {Object} users Information about users (properties defined in js/fm/megadata.js)
 */
function process_u(users, ignoreDB) {
    "use strict";

    // If nicknames private encrypted attribute is set.
    if (nicknames.cache === false && Object(u_attr).hasOwnProperty('*!>alias')) {
        nicknames.decryptAndCacheNicknames(u_attr['*!>alias']);
    }

    for (var i = 0; i < users.length; i++) {

        var userEmail = users[i].m;
        var userHandle = users[i].u;
        var userStatus = users[i].c;

        // If this user had a nickname in the past, don't delete it if they are now added as a contact
        // Or if the nickname is set in the initial 'ug' API request, then set it
        users[i].nickname = userHandle in M.u && M.u[userHandle].nickname || nicknames.cache[userHandle] || '';

        if (userStatus === 1) {
            users[i].h = userHandle;
            users[i].t = 1;
            users[i].p = 'contacts';

            M.addNode(users[i], ignoreDB);

            var contactName = M.getNameByHandle(userHandle);

            // Update token.input plugin
            addToMultiInputDropDownList('.share-multiple-input', [{id: userEmail, name: contactName}]);
            addToMultiInputDropDownList('.add-contact-multiple-input', [{id: userEmail, name: contactName}]);
        }
        else if (M.d[userHandle]) {
            M.delNode(userHandle, ignoreDB);

            // Update token.input plugin
            removeFromMultiInputDDL('.share-multiple-input', {id: userEmail, name: userEmail});
            removeFromMultiInputDDL('.add-contact-multiple-input', {id: userEmail, name: userEmail});
        }

        // Update user attributes M.u
        M.addUser(users[i], ignoreDB);

        // If a contact, sync data objs M.d and M.u
        if (userStatus === 1) {
            M.d[userHandle] = M.u[userHandle];
        }
    }
}

/**
 * a function to parse the JSON object received holding information about sub-accounts of a business account.
 * This object will exist only in business accounts.
 * @param {String[]} suba    the object to parse, it must contain an array of sub-accounts ids (can be empty)
 * @param {Boolean} ignoreDB if we want to skip DB updating
 */
function process_suba(suba, ignoreDB) {
    "use strict";
    if (!suba || !suba.length) {
        return;
    }

    M.onFileManagerReady(() => {

        M.require('businessAcc_js', 'businessAccUI_js').done(() => {

            // the response is an array of users's handles (Masters). this means at least it will contain
            // the current user handle.
            // later-on we need to iterate on all of them. For now we dont know how to treat sub-masters yet
            // --> we will target only current users's subs
            const bAccount = new BusinessAccount();
            // if (!suba || !suba[u_handle]) {
            //    return;
            // }
            // suba = suba[u_handle];
            if (suba.length) {
                for (var k = 0; k < suba.length; k++) {
                    bAccount.parseSUBA(suba[k], ignoreDB);
                }
            }
            // else {
            //    bAccount.parseSUBA(null, true); // dummy call to flag that this is a master B-account
            // }
        });
    });
}

/**
 * A function to precess the action packets received related to business account sub-users
 * @param {Object} packet
 */
function process_businessAccountSubUsers_SC(packet) {
    "use strict";
    // we dont process these action packets on mobile
    if (is_mobile) {
        return;
    }
    if (!packet) { // no packet
        return;
    }
    if (!M.suba) { // no sub-users in memory
        return;
    }
    if (!packet.a) { // no packet type/operation
        return;
    }
    if (!packet.u) { // no user handle
        return;
    }

    var subUser = M.suba[packet.u];
    if (!subUser) { // sub-user not found --> it's new one
        subUser = Object.create(null);
        subUser.u = packet.u;
    }

    var valChanged = false;

    if ('s' in packet && packet.s !== subUser.s) { // new status
        subUser.s = packet.s;
        valChanged = true;
    }
    if (packet.e && packet.e !== subUser.e) { // new email
        subUser.e = packet.e;
        valChanged = true;
    }
    if (packet.firstname && packet.firstname !== subUser.firstname) { // new first-name
        subUser.firstname = packet.firstname;
        valChanged = true;
    }
    if (packet.lastname && packet.lastname !== subUser.lastname) { // new last-name
        subUser.lastname = packet.lastname;
        valChanged = true;
    }
    if (packet.position && packet.position !== subUser.position) { // new position
        subUser.position = packet.position;
        valChanged = true;
    }
    if (packet.idnum && packet.idnum !== subUser.idnum) { // new id number
        subUser.idnum = packet.idnum;
        valChanged = true;
    }
    if (packet.phonenum && packet.phonenum !== subUser.phonenum) { // new phone number
        subUser.phonenum = packet.phonenum;
        valChanged = true;
    }
    if (packet.location && packet.location !== subUser.location) { // new location
        subUser.location = packet.location;
        valChanged = true;
    }
    if (valChanged) {
        M.require('businessAcc_js', 'businessAccUI_js').done(
            function() {
                var bAccount = new BusinessAccount();
                bAccount.parseSUBA(subUser, false, true);
            }
        );
    }
}

function process_ok(ok, ignoreDB) {
    "use strict";

    for (var i = ok.length; i--; ) {
        if (ok[i].ha === crypto_handleauth(ok[i].h))
        {
            if (fmdb && !pfkey && !ignoreDB) {
                fmdb.add('ok', { h : ok[i].h, d : ok[i] });
            }
            crypto_setsharekey(ok[i].h, decrypt_key(u_k_aes, base64_to_a32(ok[i].k)), ignoreDB);
        }
    }
}


function processMCF(mcfResponse, ignoreDB) {
    'use strict';

    if (mcfResponse === EEXPIRED || mcfResponse === EINTERNAL) {
        return;
    }

    // Process mcf response from API (i.e. gettree) or indexedDB
    if (Array.isArray(mcfResponse)) {
        for (var i = mcfResponse.length; i--;) {
            var chatRoomInfo = mcfResponse[i];

            if (fmdb && !pfkey && !ignoreDB) {
                fmdb.add('mcf', {id: chatRoomInfo.id, d: chatRoomInfo});
            }

            if (typeof Chat !== 'undefined') {
                Chat.mcf[chatRoomInfo.id] = chatRoomInfo;
            }
        }
    }
    else if (d) {
        console.error('Unexpected mcf response.', mcfResponse);
    }
}

function processMCSM(mcsm, ignoreDB) {
    'use strict';

    if (Array.isArray(mcsm)) {
        for (let i = 0; i < mcsm.length; i++) {
            const scheduledMeeting = mcsm[i];
            if (fmdb && !pfkey && !ignoreDB) {
                fmdb.add('mcsm', { id: scheduledMeeting.id, d: scheduledMeeting });
            }
            if (typeof Chat !== 'undefined') {
                Chat.mcsm[scheduledMeeting.id] = scheduledMeeting;
            }
        }
    }
}

function folderreqerr(c, e) {
    'use strict';

    var title = (pfcol) ? l.album_broken_link_title : l[1043];
    var message = null;
    var submessage = false;

    u_reset();
    loadingInitDialog.hide();

    if ($.dialog) {
        return mBroadcaster.once('closedialog', SoonFc(90, () => folderreqerr(c, e)));
    }

    if (typeof e === 'object' && e.err < 0) {
        if (e.u === 7) {
            if (e.l === 2) {
                const link = 'https://www.stopitnow.org.uk/concerned-about-your-own-thoughts-or-behaviour/' +
                    'concerned-about-use-of-the-internet/self-help/understanding-the-behaviour/?utm_source=mega' +
                    '&utm_medium=banner&utm_campaign=mega_warning';
                message = l.etd_link_removed_title;
                submessage = `${l.etd_link_removed_body}<br><br>` +
                    `<a class="clickurl" href="${link}" target="_blank" data-eventid="500245">` +
                        l.etd_link_removed_button +
                    `</a>`;
                eventlog(500243);
                if (is_mobile) {
                    message = [message, 'icon sprite-mobile-fm-mono icon-alert-circle-thin-outline', false, submessage];
                }
            }
            else {
                message = l[23243];
                if (is_mobile) {
                    message = [title, 'icon sprite-mobile-fm-mono icon-alert-circle-thin-outline', false, message];
                }
            }
        }
        else {
            e = e.err;
        }
    }

    // If desktop site show "Folder link unavailable" dialog
    parsepage(pages.placeholder);

    // Make sure error code is an integer
    const errorCode = parseInt(e);

    if (!is_mobile) {
        if (errorCode === EARGS) {
            if (pfcol) {
                title = l.album_broken_link_title;
                message = l.album_broken_link_text;
            }
            else {
                title = l[20198];
                message = l[20199];
            }
        }
        else if (errorCode === EEXPIRED) {
            message = l[20856]; // Your link has expired
        }
        else if (pfcol) {
            message = l.album_broken_link_text;
        }
        else if (!message) {
            message = l[1044] + '<ul><li>' + l[1045] + '</li><li>' + l[247] + '</li><li>' + l[1046] + '</li>';
        }

        msgDialog('warninga', title, message, submessage, () => {

            // If the user is logged-in, he'll be redirected to the cloud
            loadSubPage('login');
        });
    }
    else {
        // Show file/folder not found page
        mobile.notFound.show(message || parseInt(e && e.err || e));
    }
}

/**
 * Initialize the chat subsystem.
 * @param {*} [action] Specific action procedure to follow
 * @returns {Promise} promise fulfilled on completion.
 */
function init_chat(action) {
    'use strict';
    return new Promise(function(resolve, reject) {
        var __init_chat = function() {
            var result = false;

            if ((is_chatlink || u_type || is_eplusplus) && !megaChatIsReady) {
                if (d) {
                    console.info('Initializing the chat...');
                }
                var _chat = new Chat();

                // `megaChatIsDisabled` might be set if `new Karere()` failed (Ie, in older browsers)
                if (!window.megaChatIsDisabled) {
                    window.megaChat = _chat;
                    megaChat.init().then(resolve).catch(reject);
                    resolve = null;
                }
            }

            if (!loadfm.loading) {
                window.loadingInitDialog.hide();
            }

            if (resolve) {
                resolve(result);
            }
        };

        if (window.megaChatIsReady) {
            $.tresizer();
            return __init_chat();
        }
        var mclp = MediaInfoLib.getMediaCodecsList();

        if (action === 0x104DF11E5) {
            M.require('chat')
                .always(function() {
                    mclp.always(__init_chat);
                });
        }
        else if (is_chatlink) {
            mclp.always(__init_chat);
        }
        else if (pfid) {
            if (d) {
                console.log('Will not initialize the chat (folder-link)');
            }

            resolve(EACCESS);
        }
        else {
            authring.onAuthringReady('chat').then(__init_chat);
        }
    });
}

function loadfm_callback(res) {
    'use strict';

    if ((parseInt(res) | 0) < 0 || res === undefined) {
        window.loadingInitDialog.hide();

        // tell the user we were unable to retrieve the cloud drive contents, upon clicking OK redirect to /support
        msgDialog('warninga', l[1311], l[16892], api_strerror(res), loadSubPage.bind(null, 'support'));
        return;
    }

    mega.loadReport.recvNodes     = Date.now() - mega.loadReport.stepTimeStamp;
    mega.loadReport.stepTimeStamp = Date.now();

    if (pfkey) {
        folderlink = pfid;

        // Hide the parent, to prevent dbfetch from trying to retrieve it.
        Object(M.d[M.RootID]).p = '';

        // Check if the key for a folder-link was correct
        if (missingkeys[M.RootID]) {
            window.loadingInitDialog.hide();

            loadfm.loaded = false;
            loadfm.loading = false;

            parsepage(pages.placeholder);
            mega.ui.setTheme();

            const n = M.d[M.RootID];
            if (n && typeof n.k === 'string' && !n.k) {
                eventlog(99977, JSON.stringify([1, pfid, M.RootID]));
            }

            return mKeyDialog(pfid, true, true).catch(() => loadSubPage('start'));
        }

        M.affiliate.storeAffiliate(folderlink, 2);
    }

    if (res.noc) {
        mega.loadReport.noc = res.noc;
    }
    if (res.tct) {
        mega.loadReport.tct = res.tct;
    }
    if (res.ok && !res.ok0) {
        // this is a legacy cached tree without an ok0 element
        process_ok(res.ok);
    }
    if (res.u) {
        process_u(res.u);
    }
    if (res.opc) {
        processOPC(res.opc);
    }
    if (res.suba) {
        if (!is_mobile) {
            process_suba(res.suba);
        }
    }
    if (res.ipc) {
        processIPC(res.ipc);
    }
    if (res.ps) {
        processPS(res.ps);
    }
    if (res.mcf) {
        // save the response to be processed later once chat files were loaded
        loadfm.chatmcf = res.mcf.c || res.mcf;
        if (res.mcf.pc) {
            loadfm.chatmcf = (loadfm.chatmcf || []).concat(res.mcf.pc);
        }
        // cf will include the flags (like whether it is archived) and chatid,
        // so it needs to combine it before processing it.
        var mergeCfToChatmcf = function(entry) {
            for (var i = 0; i < loadfm.chatmcf.length; i++) {
                if (loadfm.chatmcf[i].id === entry.id) {
                    loadfm.chatmcf[i].f = entry.f;
                }
            }
        };

        if (res.mcf.cf) {
            for (var i = 0; i < res.mcf.cf.length; i++) {
                mergeCfToChatmcf(res.mcf.cf[i]);
            }
        }
        if (res.mcf.pcf) {
            for (var i = 0; i < res.mcf.pcf.length; i++) {
                mergeCfToChatmcf(res.mcf.pcf[i]);
            }
        }
        // ensure the response is saved in fmdb, even if the chat is disabled or not loaded yet
        processMCF(loadfm.chatmcf);
    }

    if (res.aesp) {
        tryCatch(() => {
            const a = res.aesp;

            if ((a.s && a.s.length) | (a.e && a.e.length) | (a.p && a.p.length)) {

                mega.sets.resetDB(res.aesp);
            }
        })();
    }

    if (res.mcsm) {
        loadfm.chatmcsm = res.mcsm;
        processMCSM(loadfm.chatmcsm);
    }
    useravatar.refresh().catch(dump);

    if (localStorage['treefixup$' + u_handle]) {
        // We found inconsistent tree nodes and forced a reload, log it.
        eventlog(99695);
    }

    if (res.f) {
        process_f(res.f);
    }

    // If we have shares, and if a share is for this node, record it on the nodes share list
    if (res.s) {
        if (d) {
            console.info(`[f.s(${res.s.length})] %s`, res.s.map(n => `${n.h}*${n.u}`).sort());
        }
        for (let i = res.s.length; i--;) {
            M.nodeShare(res.s[i].h, res.s[i]);
        }
    }

    // Handle public/export links. Why here? Make sure that M.d already exists
    if (res.ph) {
        processPH(res.ph);
    }

    // Handle versioning nodes
    if (res.f2) {
        process_f(res.f2, true);
    }

    // This package is sent on hard refresh if owner have enabled or disabled PUF
    if (res.uph) {
        mega.fileRequest.processUploadedPuHandles(res.uph).dump('processUPH');
    }

    // decrypt hitherto undecrypted nodes
    crypto_fixmissingkeys(missingkeys);

    if (res.cr) {
        crypto_procmcr(res.cr);
    }

    if (res.sr) {
        crypto_procsr(res.sr);
    }
    setsn(currsn = res.sn);

    mega.loadReport.procNodeCount = Object.keys(M.d || {}).length;
    mega.loadReport.procNodes = Date.now() - mega.loadReport.stepTimeStamp;
    mega.loadReport.stepTimeStamp = Date.now();

    window.loadingInitDialog.step3(20, 35);

    // Time to save the ufs-size-cache, from which M.tree nodes will be created and being
    // those dependent on in-memory-nodes from the initial load to set flags such as SHARED.
    return (async() => ufsc.save())().catch(dump)
        .finally(() => {
            // commit transaction and set sn
            setsn(res.sn);
            currsn = res.sn;

            window.loadingInitDialog.step3(35, 40);

            if (window.pfcol) {
                return loadfm_done(-0x800e0fff);
            }

            // retrieve the initial batch of action packets, if any,
            // we'll then complete the process using loadfm_done()
            getsc(true);
        });
}

/**
 * Function to be invoked when the cloud has finished loading,
 * being the nodes loaded from either server or local cache.
 */
function loadfm_done(mDBload) {

    window.loadingInitDialog.step3(56, 85);

    mDBload = mDBload || !loadfm.fromapi;

    loadfm.loaded = Date.now();
    loadfm.loading = false;
    loadfm.fromapi = false;

    if (d > 1) {
        console.warn('loadfm_done called.', is_fm());
    }

    mega.loadReport.procAPs       = Date.now() - mega.loadReport.stepTimeStamp;
    mega.loadReport.stepTimeStamp = Date.now();

    if (!pfid && u_type == 3) {

        // Ensure tree nodes consistency...
        const blk = {
            t: Object.keys(M.tree[M.RootID] || {}),
            c: Object.keys(M.c[M.RootID] || {}).filter((h) => M.c[M.RootID][h] > 1)
        };
        const {t: {length: tl}, c: {length: cl}} = blk;

        if (tl !== cl) {
            const res = [];
            const src = tl < cl ? 'c' : 't';
            const dst = tl < cl ? 't' : 'c';

            for (let i = blk[src].length; i--;) {
                const h = blk[src][i];

                if (!blk[dst].includes(h)) {
                    const n = M.getNodeByHandle(h);

                    if (!n.s4) {
                        res.push({h, p: n.p, path: M.getNamedPath(h)});
                    }
                }
            }

            if (res.length) {
                console.group(`%cTREE NODES MISMATCH (${dst} < ${src})`, 'font-size:13px', [blk]);
                console.table(res);
                console.groupEnd();
                eventlog(99696, JSON.stringify([1, res.length, tl, cl]));
            }
        }

        // load/initialise the authentication system
        authring.initAuthenticationSystem();
    }

    // This function is invoked once the M.openFolder()'s promise (through renderfm()) is fulfilled.
    var _completion = function() {

        window.loadingInitDialog.step3(100);

        if ((location.host === 'mega.nz' || !megaChatIsDisabled) && !is_mobile) {

            if (!pfid && !loadfm.chatloading && (u_type === 3 || is_eplusplus)) {
                loadfm.chatloading = true;

                M.require('chat')
                    .always(function() {

                        if (typeof ChatRoom !== 'undefined') {

                            if (loadfm.chatmcf) {
                                processMCF(loadfm.chatmcf, true);
                                loadfm.chatmcf = null;
                            }
                            if (loadfm.chatmcsm) {
                                processMCSM(loadfm.chatmcsm, true);
                                loadfm.chatmcsm = null;
                            }
                            init_chat();
                        }
                        else {
                            // FIXME: this won't be reached because the request will fail silently
                            console.error('Chat resources failed to load...');
                        }

                        loadfm.chatloading = false;
                        loadfm.chatloaded  = Date.now();
                    });
            }
        }

        // Check Business (or Pro Flexi) account is expired on initial phase in desktop web
        if (!is_mobile && u_attr && (u_attr.b || u_attr.pf)) {

            M.require('businessAcc_js', 'businessAccUI_js').done(() => {

                var business_ui = new BusinessAccountUI();

                if (u_attr.b && u_attr.b.m) {
                    business_ui.showWelcomeDialog();
                }

                // the function will check if the account is expired
                business_ui.showExp_GraceUIElements();
            });
        }

        // check if this a Business sub-user that needs to send his key
        if (u_attr && u_attr.b && !u_attr.b.m && u_attr.b.s !== -1) {

            M.require('businessAcc_js', 'businessAccUI_js').done(() => {

                const business_ui = new BusinessAccountUI();

                business_ui.showVerifyDialog();

            });
        }

        onIdle(() => {
            window.loadingInitDialog.hide();

            // Reposition UI elements right after hiding the loading overlay,
            // without waiting for the lazy $.tresizer() triggered by MegaRender
            fm_resize_handler(true);

            // Securing previously generated public album data to use later in the importing procedure
            if (sessionStorage.albumLinkImport) {
                $.albumImport = Object.values(mega.gallery.albums.store)
                    .find(({ p }) => !!p && p.ph === sessionStorage.albumLinkImport);
                delete sessionStorage.albumLinkImport;
            }
        });

        // -0x800e0fff indicates a call to loadfm() when it was already loaded
        if (mDBload !== -0x800e0fff && !is_mobile) {
            onIdle(function _initialNotify() {

                // If this was called from the initial fm load via gettree or db load, we should request the
                // latest notifications. These must be done after the first getSC call.
                if (!folderlink) {
                    notify.getInitialNotifications();
                }
            });

            if (mBroadcaster.crossTab.owner && !mega.loadReport.sent) {
                mega.loadReport.sent = true;

                var r = mega.loadReport;
                var tick = Date.now() - r.aliveTimeStamp;

                r.totalTimeSpent = Date.now() - mega.loadReport.startTime;

                r = [
                    r.mode, // 1: DB, 2: API
                    r.recvNodes, r.procNodes, r.procAPs,
                    r.fmConfigFetch, r.renderfm,
                    r.dbToNet | 0, // see mDB.js comment
                    r.totalTimeSpent,
                    Object.keys(M.d || {}).length, // total account nodes
                    r.procNodeCount, // nodes before APs processing
                    buildVersion.timestamp || -1, // -- VERSION TAG --
                    navigator.hardwareConcurrency | 0, // cpu cores
                    folderlink ? 1 : 0,
                    pageLoadTime, // secureboot's resources load time
                    r.ttfb | 0, // time-to-first-byte (for gettree)
                    r.noc | 0, // tree not cached
                    r.tct | 0, // tree compute time
                    r.recvAPs, // time waiting to receive APs
                    r.EAGAINs, // -3/-4s while loading
                    r.e500s, // http err 500 while loading
                    r.errs, // any other errors while loading
                    decWorkerPool.ok && decWorkerPool.length || -666,
                    r.ttlb | 0, // time to last byte
                    r.ttfm | 0, // time to fm since ttlb
                    u_type === 3 ? (mBroadcaster.crossTab.owner ? 1 : 0) : -1, // master, or slave tab?
                    r.pn1, r.pn2, r.pn3, r.pn4, r.pn5, // procNodes steps
                    Object.keys(M.tree || {}).length, // total tree nodes
                    r.invisibleTime | 0, // time spent as background tab
                ];

                if (d) {
                    console.debug('loadReport', r, tick, document.hidden);
                }

                if (!(tick > 2100) && !document.hidden) {
                    api_req({a: 'log', e: 99626, m: JSON.stringify(r)});
                }
            }

            if (mDBload) {
                useravatar.refresh().catch(dump);
            }
        }
        if ($.closeMsgDialog) {
            delete $.closeMsgDialog;
            closeMsg();
        }
        clearInterval(mega.loadReport.aliveTimer);
        mega.state &= ~window.MEGAFLAG_LOADINGCLOUD;

        watchdog.notify('loadfm_done');
    };

    return Promise.allSettled([mclp, u_type > 2 && mega.config.fetch()])
        .then(() => {
            let promise = null;

            window.loadingInitDialog.step3(85, 100);

            mega.loadReport.fmConfigFetch = Date.now() - mega.loadReport.stepTimeStamp;
            mega.loadReport.stepTimeStamp = Date.now();

            // are we actually on an #fm/* page?
            if (page !== 'start' && is_fm() || $('.fm-main.default').is(":visible")) {
                promise = M.initFileManager();

                mega.loadReport.renderfm = Date.now() - mega.loadReport.stepTimeStamp;
                mega.loadReport.stepTimeStamp = Date.now();

                // load report - time to fm after last byte received
                mega.loadReport.ttfm = Date.now() - mega.loadReport.ttfm;

                // setup fm-notifications such as 'full' or 'almost-full' if needed.
                if (!pfid && u_type) {
                    M.getStorageState().always((res) => {
                        // 0: Green, 1: Orange (almost full), 2: Red (full)
                        if (res >= 1) {
                            M.checkStorageQuota(50);
                        }
                    });
                    M.myChatFilesFolder.init();
                    M.getMyBackups().catch(dump);
                    M.getCameraUploads().catch(dump);
                }
            }
            else {
                mega.loadReport.ttfm = -1;
                mega.loadReport.renderfm = -1;
            }

            mclp = Promise.resolve();
            return promise;
        })
        .then(_completion)
        .catch((ex) => {
            const eno = typeof ex === 'number' && ex < 0;
            if (eno) {
                ex = api_strerror(ex);
            }

            // give time for window.onerror to fire 'cd2' before showing the blocking confirm-dialog
            setTimeout(() => siteLoadError(ex, 'loadfm'), 2e3);

            // reach window.onerror
            if (!eno) {
                reportError(ex);
            }
        });
}

function fmtreenode(id, e)
{
    if (M.getNodeRoot(id) === 'contacts')
        return false;
    var treenodes = {};
    if (typeof fmconfig.treenodes !== 'undefined')
        treenodes = fmconfig.treenodes;
    if (e)
        treenodes[id] = 1;
    else
    {
        $('#treesub_' + id + ' .expanded').each(function(i, e)
        {
            var id2 = $(e).attr('id');
            if (id2)
            {
                id2 = id2.replace('treea_', '');
                $('#treesub_' + id2).removeClass('opened');
                $('#treea_' + id2).removeClass('expanded');
                delete treenodes[id2];
            }
        });
        delete treenodes[id];
    }
    mega.config.set('treenodes', treenodes);

    M.treenodes = JSON.stringify(treenodes);
}

function fmsortmode(id, n, d)
{
    var sortmodes = {};
    if (typeof fmconfig.sortmodes !== 'undefined')
        sortmodes = fmconfig.sortmodes;
    if (n === 'name' && d > 0 && id !== "contacts") {
        // don't delete for "contacts" section, since "status" is the default there.
        delete sortmodes[id];
    }
    else if (n === "status" && d > 0 && id === "contacts") {
        // DO delete for "contacts" section, since "status" is the default there, so default is already d > 1.
        delete sortmodes[id];
    }
    else
        sortmodes[id] = {n: n, d: d};
    mega.config.set('sortmodes', sortmodes);
}

function fmviewmode(id, e)
{
    var viewmodes = {};
    if (typeof fmconfig.viewmodes !== 'undefined')
        viewmodes = fmconfig.viewmodes;
    if (e === 2) {
        viewmodes[id] = 2;
    }
    else if (e)
        viewmodes[id] = 1;
    else
        viewmodes[id] = 0;
    mega.config.set('viewmodes', viewmodes);
}

/** @property window.thumbnails */
lazy(self, 'thumbnails', () => {
    'use strict';
    return new ThumbManager(200, 'otf.thumbs');
});

/** @property fm_thumbnails.exclude */
lazy(fm_thumbnails, 'exclude', () => {
    'use strict';
    const res = {
        recents: 5
    };
    return Object.setPrototypeOf(res, null);
});

function fm_thumbnails(mode, nodeList, callback)
{
    'use strict';

    const pwd = M.currentdirid;
    const exclude = fm_thumbnails.exclude[pwd];
    if ((M.gallery || M.chat || M.albums) && mode !== 'standalone' || exclude > 6) {
        return;
    }
    nodeList = (mode === 'standalone' ? nodeList : false) || M.v;

    let count = 0;
    const transparent = {WEBP: 1, PNG: 1, SVG: 1, GIF: 1};
    const max = M.rmItemsInView ? Math.max(M.rmItemsInView | 0, 48) : Infinity;
    const treq = [];

    const onTheFly =
        !is_mobile && M.viewmode && mode !== 'standalone' && !exclude
        && !mega.config.get('noflytn') ? Object.create(null) : false;

    // check if the node is rendered within/near the view-port.
    const isVisible = (n) => {
        return pwd === M.currentdirid && (mode === 'standalone' || isVisible.dom(n));
    };
    isVisible.dom = M.megaRender
        ? (n) => n.seen && M.megaRender && M.megaRender.isDOMNodeVisible(n.h)
        : (n) => elementIsVisible(document.getElementById(n.h));

    const setSrcAttribute = (n, uri) => {
        if (isVisible(n)) {
            uri = uri || thumbnails.get(n.fa);

            if (uri) {
                let imgNode = document.getElementById(n.h);

                if (imgNode && (imgNode = imgNode.querySelector('img'))) {
                    n.seen = 2;
                    imgNode.setAttribute('src', uri);
                    imgNode.parentNode.parentNode.classList.add('thumb');
                }
            }
        }
    };

    // enqueue thumbnail retrieval.
    const queue = (n) => {
        let type = ':0*';
        const fa = String(n.fa);

        if (onTheFly && fa.includes(':1*') && !transparent[fileext(n.name, true, true)] || !fa.includes(type)) {
            type = ':1*';

            if (onTheFly) {
                onTheFly[fa] = n;
            }
        }

        if (fa.includes(type)) {
            type = type[1] | 0;

            if (thumbnails.queued(n, type)) {

                if (!treq[type]) {
                    treq[type] = Object.create(null);
                }
                treq[type][fa] = n;

                if (++count > max) {
                    // break
                    return true;
                }
            }
            else if (n.seen !== 2) {
                setSrcAttribute(n);
            }
        }
    };


    if (d) {
        console.time('fm_thumbnails');
    }

    for (let i = 0; i < nodeList.length; i++) {
        const n = nodeList[i];

        if (n && n.fa && !missingkeys[n.h]) {
            if (isVisible(n) && queue(n)) {
                break;
            }

            if (mode === 'standalone' && typeof callback === 'function') {
                if (thumbnails.has(n.fa)) {
                    onIdle(callback.bind(null, n));
                }
                else if (thumbnails.pending[n.fa]) {
                    thumbnails.pending[n.fa].push(callback.bind(null, n));
                }
            }
        }
    }

    if (count > 0) {
        if (d) {
            console.log('Requesting %d thumbs (%d loaded)', count, thumbnails.loaded, treq);
        }
        thumbnails.loaded += count;

        // add, render, and deduplicate new thumbnail.
        const append = (fa, uri) => {
            if (d > 1) {
                console.info(`Rendering thumbnail ${fa}, ${uri}`);
            }
            thumbnails.add(fa, uri, (n) => setSrcAttribute(n, uri));
        };

        // re-queue thumbnail retrieval.
        const requeue = (handle, data, callback) => {
            treq[0][handle] = data;

            delay('fm:thumbnails.requeue', () => {
                api_getfileattr(treq[0], 0, callback).catch(dump);
                treq[0] = {};
            }, 1e3);
        };

        // validate we can render a node
        const validate = (fa, uint8) => {
            let valid = true;

            if (uint8 === 0xDEAD || uint8 && !uint8.byteLength || !thumbnails.each(fa, (n) => isVisible(n))) {
                valid = false;
                thumbnails.decouple(fa);
            }

            return valid;
        };

        // handle thumbnail retrieval.
        const onload = async(ctx, fa, uint8) => {
            if (!validate(fa, uint8)) {
                return;
            }

            if (onTheFly[fa]) {
                const blob = await webgl.getDynamicThumbnail(uint8, {ats: 1}).catch(nop);

                if (blob) {
                    append(fa, URL.createObjectURL(blob));

                    if (thumbnails.db) {
                        thumbnails.db.add(fa, blob);
                    }
                }
                else {
                    if (d) {
                        console.debug(`Failed to generate on-the-fly thumbnail for ${fa}`);
                    }
                    requeue(fa, onTheFly[fa], onload);
                }

                onTheFly[fa] = null;
            }
            else {
                append(fa, mObjectURL([uint8.buffer || uint8], 'image/jpeg'));
            }
        };

        queueMicrotask(async() => {

            if (treq[1]) {
                let proceed = true;

                if (onTheFly) {
                    await thumbnails.query(
                        Object.keys(treq[1]).filter(h => !!onTheFly[h]),
                        (h) => {
                            delete treq[1][h];
                            delete onTheFly[h];
                            return validate(h);
                        },
                        (h, buf) => onload(0, h, buf)
                    ).catch(dump);

                    proceed = $.len(treq[1]) > 0;
                }

                if (proceed) {
                    api_getfileattr(treq[1], 1, onload);
                }
            }

            if (treq[0]) {
                api_getfileattr(treq[0], 0, onload);
            }
            treq[0] = {};
        });
    }

    if (d) {
        console.timeEnd('fm_thumbnails');
    }
}


mBroadcaster.once('boot_done', function() {
    "use strict";

    var uad = ua.details || false;
    var browser = String(uad.browser || '');

    if (!browser || browser === "Safari" || /edge|explorer/i.test(browser)) {
        if (d) {
            console.info('Disabling paste proxy on this browser...', browser, [uad]);
        }
        return;
    }

    // Didn't found a better place for this, so I'm leaving it here...
    // This is basically a proxy of on paste, that would trigger a new event, which would receive the actual
    // File object, name, etc.
    $(document).on('paste', function(event) {
        const {clipboardData, originalEvent = false} = event;
        let {items} = clipboardData || originalEvent.clipboardData || {};

        if (!items && originalEvent.clipboardData) {
            // safari
            items = originalEvent.clipboardData.files;
        }
        var fileName = false;

        var blob = null;
        if (items) {
            if (ua.details.browser === "Firefox" && items.length === 2) {
                // trying to paste an image, but .. FF does not have support for that. (It adds the file icon as
                // the image, which is a BAD UX, so .. halt now!)
                return;
            }
            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("text/rtf") === 0) {
                    // halt execution, this is a Rich text formatted clipboard data, which may also contain an image,
                    // so we need to halt here, otherwise it may be threated as image, instead of text
                    return;
                }
                else if (items[i].type.indexOf("image") === 0) {
                    if (items[i] instanceof File) {
                        // Safari, using .files
                        blob = items[i];
                    }
                    else {
                        blob = items[i].getAsFile();
                    }
                }
                else if (items[i].kind === "string") {
                    items[i].getAsString(function(str) {
                        fileName = str;
                    });
                }
            }
        }

        if (blob !== null) {
            if (fileName) {
                // we've got the name of the file...
                blob.name = fileName;
            }

            if (!blob.name) {
                // no name found..generate dummy name.
                var ext = blob.type.replace("image/", "").toLowerCase();
                fileName = blob.name = "image." + (ext === "jpeg" ? "jpg" : ext);
            }

            var simulatedEvent = new $.Event("pastedimage");
            $(window).trigger(simulatedEvent, [blob, fileName]);

            // was this event handled and preventing default? if yes, prevent the raw event from pasting the
            // file name text
            if (simulatedEvent.isDefaultPrevented()) {
                event.preventDefault();
                return false;
            }
        }
    });
});

mega.commercials = Object.create(null);
mega.commercials.init = nop;
mega.commercials.createMobileBottomBarSlots = nop;
mega.commercials.updateOverlays = nop;
mega.commercials.mobileFmTabHander = nop;
mega.commercials.updateCommCookies = nop;
mega.commercials.getComms = nop;

mega.commercials.addCommsToBottomBar = (node) => {
    'use strict';
    return node;
};

/**
 * Mega Promise
 *
 * Polyfill + easier to debug variant of Promises which are currently implemented in some of the cutting edge browsers.
 *
 * The main goals of using this, instead of directly using native Promises are:
 * - stack traces
 * - .done, .fail
 * - all js exceptions will be logged (in the console) and thrown as expected
 *
 * Note: for now, we will use $.Deferred to get this functionality out of the box and MegaPromise will act as a bridge
 * between the original Promise API and jQuery's Deferred APIs.
 *
 * Implementation note: .progress is currently not implemented.
 */


/**
 * Mega Promise constructor
 *
 * @returns {MegaPromise}
 * @constructor
 * @deprecated DO NOT USE FOR NEW CREATED CODE!
 */
function MegaPromise(fn) {
    var self = this;

    this.$deferred = new $.Deferred();

    if (fn) {
        var resolve = function() {
            self.resolve.apply(self, arguments);
        };
        var reject = function() {
            self.reject.apply(self, arguments);
        };

        try {
            fn(resolve, reject);
        }
        catch (ex) {
            reject(ex);
        }
    }

    if (MegaPromise.debugPendingPromisesTimeout > 0) {
        var preStack = M.getStack();
        setTimeout(function() {
            if (self.state() === 'pending') {
                console.error("Pending promise found: ", self, preStack);
            }
        }, MegaPromise.debugPendingPromisesTimeout);
    }

    if (MegaPromise.debugPreStack === true) {
        self.stack = M.getStack();
    }
}

/**
 * Set this to any number (millisecond) and a timer would check if all promises are resolved in that time. If they are
 * still in 'pending' state, they will trigger an error (this is a debugging helper, not something that you should
 * leave on in production code!)
 *
 * @type {boolean|Number}
 */
MegaPromise.debugPendingPromisesTimeout = false;

/**
 * Set this to true, to enable all promises to store a pre-stack in .stack.
 *
 * @type {boolean}
 */
MegaPromise.debugPreStack = false;

/**
 * Convert Native and jQuery promises to MegaPromises, by creating a MegaPromise proxy which will be attached
 * to the actual underlying promise's .then callbacks.
 *
 * @param p
 * @returns {MegaPromise}
 * @private
 */
MegaPromise.asMegaPromiseProxy  = function(p) {
    var $promise = new MegaPromise();

    p.then(
        function megaPromiseResProxy() {
            $promise.resolve.apply($promise, arguments);
        },
        MegaPromise.getTraceableReject($promise, p));

    return $promise;
};

/**
 * Common function to be used as reject callback to promises.
 *
 * @param promise {MegaPromise}
 * @returns {function}
 * @private
 */
MegaPromise.getTraceableReject = function($promise, origPromise) {
    'use strict';
    // Save the current stack pointer in case of an async call behind
    // the promise.reject (Ie, onAPIProcXHRLoad shown as initial call)
    const debug = window.d > 3;
    const preStack = debug && M.getStack();

    return function __mpTraceableReject(aResult) {
        if (debug) {
            var postStack = M.getStack();
            if (typeof console.group === 'function') {
                console.group('PROMISE REJECTED');
            }
            console.debug('Promise rejected: ', aResult, origPromise);
            console.debug('pre-Stack', preStack);
            console.debug('post-Stack', postStack);
            if (typeof console.groupEnd === 'function') {
                console.groupEnd();
            }
        }
        try {
            if (typeof $promise === 'function') {
                $promise.apply(origPromise, arguments);
            }
            else {
                $promise.reject.apply($promise, arguments);
            }
        }
        catch(e) {
            console.error('Unexpected promise error: ', e, preStack);
        }
    };
};

MegaPromise.prototype.benchmark = function(uniqueDebuggingName) {
    var self = this;
    MegaPromise._benchmarkTimes = MegaPromise._benchmarkTimes || {};
    MegaPromise._benchmarkTimes[uniqueDebuggingName] = Date.now();

    self.always(function() {
        console.error(
            uniqueDebuggingName,
            'finished in:',
            Date.now() - MegaPromise._benchmarkTimes[uniqueDebuggingName]
        );
        delete MegaPromise._benchmarkTimes[uniqueDebuggingName];
    });

    // allow chaining.
    return self;
};

/**
 * By implementing this method, MegaPromise will be compatible with .when/.all syntax.
 *
 * jQuery: https://github.com/jquery/jquery/blob/10399ddcf8a239acc27bdec9231b996b178224d3/src/deferred.js#L133
 *
 * @returns {jQuery.Deferred}
 */
MegaPromise.prototype.promise = function() {
    return this.$deferred.promise();
};

/**
 * Alias of .then
 *
 * @param res
 *     Function to be called on resolution of the promise.
 * @param [rej]
 *     Function to be called on rejection of the promise.
 * @returns {MegaPromise}
 */
MegaPromise.prototype.then = function(res, rej) {

    return MegaPromise.asMegaPromiseProxy(this.$deferred.then(res, rej));
};

/**
 * Alias of .done
 *
 * @param res
 * @returns {MegaPromise}
 */
MegaPromise.prototype.done = function(res) {
    this.$deferred.done(res);
    return this;
};

/**
 * Alias of .state
 *
 * @returns {String}
 */
MegaPromise.prototype.state = function() {
    return this.$deferred.state();
};

/**
 * Alias of .fail
 *
 * @param rej
 * @returns {MegaPromise}
 */
MegaPromise.prototype.fail = function(rej) {
    this.$deferred.fail(rej);
    return this;
};


/**
 * Alias of .fail
 *
 * @param rej
 * @returns {MegaPromise}
 */
MegaPromise.prototype.catch = MegaPromise.prototype.fail;

/**
 * Alias of .resolve
 *
 * @returns {MegaPromise}
 */
MegaPromise.prototype.resolve = function() {
    this.$deferred.resolve.apply(this.$deferred, arguments);
    return this;
};

/**
 * Alias of .reject
 *
 * @returns {MegaPromise}
 */
MegaPromise.prototype.reject = function() {
    this.$deferred.reject.apply(this.$deferred, arguments);
    return this;
};

/**
 * Alias of .always
 *
 * @returns {MegaPromise}
 */
MegaPromise.prototype.always = function() {
    this.$deferred.always.apply(this.$deferred, arguments);
    return this;
};

/**
 * Alias of .always
 *
 * @returns {MegaPromise}
 */
MegaPromise.prototype.wait = function(callback) {
    'use strict';

    this.$deferred.always((...args) => {

        queueMicrotask(() => callback(...args));
    });
    return this;
};

/**
 * Alias of .wait
 *
 * @returns {MegaPromise}
 */
MegaPromise.prototype.finally = MegaPromise.prototype.wait;

/**
 * Invoke promise fulfilment through try/catch and reject it if there's some exception...
 * @param {Function} resolve The function to invoke on fulfilment
 * @param {Function} [reject] The function to invoke on rejection/caught exceptions
 * @returns {MegaPromise}
 */
MegaPromise.prototype.tryCatch = function(resolve, reject) {
    'use strict';
    reject = reject || function() {};
    return this.done(tryCatch(resolve, reject)).fail(reject);
};

/**
 * Alias of .always
 *
 * @returns {MegaPromise}
 */
MegaPromise.prototype.unpack = function(callback) {
    // callback = tryCatch(callback);

    this.$deferred.always(function(result) {
        if (result.__unpack$$$) {
            // flatten an n-dimensional array.
            for (var i = result.length; i--;) {
                // pick the first argument for each member
                result[i] = result[i][0];
            }
            result = Array.prototype.concat.apply([], result);
        }
        callback(result);
    });
    return this;
};

/**
 * Link the `targetPromise`'s state to the current promise. E.g. when targetPromise get resolved, the current promise
 * will get resolved too with the same arguments passed to targetPromise.
 *
 * PS: This is a simple DSL-like helper to save us from duplicating code when using promises :)
 *
 * @param targetPromise
 * @returns {MegaPromise} current promise, helpful for js call chaining
 */
MegaPromise.prototype.linkDoneTo = function(targetPromise) {
    var self = this;

    if (targetPromise instanceof MegaPromise) {
        // Using MegaPromise.done since it's more lightweight than the thenable
        // which creates a new deferred instance proxied back to MegaPromise...
        targetPromise.done(function() {
            self.resolve.apply(self, arguments);
        });
    }
    else {
        targetPromise.then(function() {
            self.resolve.apply(self, arguments);
        });
    }

    return this;
};

/**
 * Link the `targetPromise`'s state to the current promise. E.g. when targetPromise get rejected, the current promise
 * will get rejected too with the same arguments passed to targetPromise.
 * PS: This is a simple DSL-like helper to save us from duplicating code when using promises :)
 *
 *
 * @param targetPromise
 * @returns {MegaPromise} current promise, helpful for js call chaining
 */
MegaPromise.prototype.linkFailTo = function(targetPromise) {
    var self = this;

    if (targetPromise instanceof MegaPromise) {
        // Using MegaPromise.fail since it's more lightweight than the thenable
        // which creates a new deferred instance proxied back to MegaPromise...
        targetPromise.fail(function() {
            self.reject.apply(self, arguments);
        });
    }
    else {
        targetPromise.then(undefined, function() {
            self.reject.apply(self, arguments);
        });
    }

    return this;
};

/**
 * Link the `targetPromise`'s state to the current promise (both done and fail, see .linkDoneTo and .linkFailTo)
 *
 * PS: This is a simple DSL-like helper to save us from duplicating code when using promises :)
 *
 * @param targetPromise
 * @returns {MegaPromise} current promise, helpful for js call chaining
 */
MegaPromise.prototype.linkDoneAndFailTo = function(targetPromise) {
    'use strict';

    if (targetPromise instanceof MegaPromise) {
        this.linkDoneTo(targetPromise);
        this.linkFailTo(targetPromise);
    }
    else {
        if (!(targetPromise instanceof Promise)) {
            targetPromise = Promise.resolve(targetPromise);
        }
        targetPromise.then((res) => this.resolve(res))
            .catch((ex) => {
                this.reject(ex);
            });
    }
    return this;
};

/**
 * Link promise's state to a function's value. E.g. if the function returns a promise that promise's state will be
 * linked to the current fn. If it returns a non-promise-like value it will resolve/reject the current promise's value.
 *
 * PS: This is a simple DSL-like helper to save us from duplicating code when using promises :)
 *
 * @returns {MegaPromise} current promise, helpful for js call chaining
 */
MegaPromise.prototype.linkDoneAndFailToResult = function(cb, context, args) {
    var self = this;

    var ret = cb.apply(context, args);

    if (ret instanceof MegaPromise) {
        self.linkDoneTo(ret);
        self.linkFailTo(ret);
    }
    else {
        self.resolve(ret);
    }

    return self;
};

/**
 * Development helper, that will dump the result/state change of this promise to the console
 *
 * @param [msg] {String} optional msg
 * @returns {MegaPromise} current promise, helpful for js call chaining
 */
MegaPromise.prototype.dumpToConsole = function(msg) {
    var self = this;

    if (d) {
        self.then(
            function () {
                console.log("success: ", msg ? msg : arguments, !msg ? null : arguments);
            }, function () {
                console.error("error: ", msg ? msg : arguments, !msg ? null : arguments);
            }
        );
    }

    return self;
};
MegaPromise.prototype.dump = MegaPromise.prototype.dumpToConsole;

/**
 * Check if what we have is *potentially* another Promise implementation (Native, Bluebird, Q, etc)
 * @param {*|Object} p What we expect to be a promise.
 * @returns {Boolean} whether it is
 */
MegaPromise.isAnotherPromise = function(p) {
    'use strict';
    return !(p instanceof MegaPromise) && typeof Object(p).then === 'function';
};

/**
 * Implementation of Promise.all/$.when, with a little bit more flexible way of handling different type of promises
 * passed in the `promisesList`
 *
 * @returns {MegaPromise}
 */
MegaPromise.all = function(promisesList) {
    'use strict';

    var _jQueryPromisesList = promisesList.map(function(p) {
        if (MegaPromise.isAnotherPromise(p)) {
            p = MegaPromise.asMegaPromiseProxy(p);
        }

        if (d) {
            console.assert(p instanceof MegaPromise);
        }
        return p;
    });

    var promise = new MegaPromise();

    $.when.apply($, _jQueryPromisesList)
        .done(function megaPromiseResProxy() {
            promise.resolve(toArray.apply(null, arguments));
        })
        .fail(MegaPromise.getTraceableReject(promise));

    return promise;
};

/**
 * Implementation of Promise.all/$.when, with a little bit more flexible way of handling different type of promises
 * passed in the `promisesList`.
 *
 * Warning: This method will return a "master promise" which will only get resolved when ALL promises had finished
 * processing (e.g. changed their state to either resolved or rejected). The only case when the master promise will get,
 * rejected is if there are still 'pending' promises in the `promisesList` after the `timeout`
 *
 * @param promisesList {Array}
 * @param [timeout] {Integer} max ms to way for the master promise to be resolved before rejecting it
 * @returns {MegaPromise}
 */
MegaPromise.allDone = function(promisesList, timeout) {
    // IF empty, resolve immediately
    if (promisesList.length === 0) {
        return MegaPromise.resolve();
    }
    var masterPromise = new MegaPromise();
    var totalLeft = promisesList.length;
    var results = [];
    results.__unpack$$$ = 1;

    var alwaysCb = function() {
        results.push(toArray.apply(null, arguments));

        if (--totalLeft === 0) {
            masterPromise.resolve(results);
        }
    };

    for (var i = promisesList.length; i--;) {
        var v = promisesList[i];

        if (MegaPromise.isAnotherPromise(v)) {
            v = MegaPromise.asMegaPromiseProxy(v);
        }

        if (v instanceof MegaPromise) {
            v.done(alwaysCb);
            v.fail(alwaysCb);
        }
        else {
            if (d) {
                console.warn('non-promise provided...', v);
            }
            alwaysCb(v);
        }
    }

    if (timeout) {
        var timeoutTimer = setTimeout(function () {
            masterPromise.reject(results);
        }, timeout);

        masterPromise.always(function () {
            clearTimeout(timeoutTimer);
        });
    }

    return masterPromise;
};

/**
 * alias of Promise.resolve, will create a new promise, resolved with the arguments passed to this method
 *
 * @returns {MegaPromise}
 */
MegaPromise.resolve = function() {
    var p = new MegaPromise();
    p.resolve.apply(p, arguments);

    return p;
};


/**
 * alias of Promise.reject, will create a new promise, rejected with the arguments passed to this method
 *
 * @returns {MegaPromise}
 */
MegaPromise.reject = function() {
    var p = new MegaPromise();
    p.reject.apply(p, arguments);

    return p;
};

/**
 * Development helper tool to delay .resolve/.reject of a promise.
 *
 * @param ms {Number} milliseconds to delay the .resolve/.reject
 */
MegaPromise.prototype.fakeDelay = function(ms) {
    var self = this;
    if (self._fakeDelayEnabled) {
        return;
    }

    var origResolve = self.resolve;
    var origReject = self.reject;
    self.resolve = function() {
        var args = arguments;
        setTimeout(function() {
            origResolve.apply(self, args);
        }, ms);

        return self;
    };
    self.reject = function() {
        var args = arguments;
        setTimeout(function() {
            origReject.apply(self, args);
        }, ms);

        return self;
    };

    self._fakeDelayEnabled = true;

    return self;
};

/** @property mega.requestStatusMonitor */
lazy(mega, 'requestStatusMonitor', () => {
    'use strict';

    return new class RequestStatusMonitor extends MEGAKeepAliveStream {

        constructor() {
            const handlers = {
                onchunk(chunk) {
                    this.framing(chunk);
                }
            };
            super(handlers);
            this.buffer = false;
        }

        framing(data) {

            if (this.buffer) {

                // we have unprocessed data - append new
                const temp = new Uint8Array(this.buffer.byteLength + data.byteLength);
                temp.set(new Uint8Array(this.buffer), 0);
                temp.set(new Uint8Array(data), this.buffer.byteLength);
                this.buffer = temp.buffer;
            }
            else {
                this.buffer = data.buffer || data;
            }

            for (;;) {
                const t = this.process(this.buffer);

                if (!t) {
                    break;
                }

                if (t === this.buffer.byteLength) {

                    this.buffer = false;
                    break;
                }

                // residual data present - chop
                this.buffer = this.buffer.slice(t);
            }
        }

        process(buffer) {

            // incomplete?
            if (buffer.byteLength < 2) {
                return 0;
            }

            const u8 = new Uint8Array(buffer);
            const users = u8[0] + (u8[1] << 8);

            if (!users) {

                if (d) {
                    this.logger.log("*** No operation in progress");
                }

                loadingDialog.hideProgress();

                return 2;
            }

            if (u8[0] === 45 && u8.byteLength < 4) {
                const err = String.fromCharCode.apply(null, u8) | 0;

                if (err === ESID) {
                    this.abort(api_strerror(err));
                    return buffer.byteLength;
                }
            }

            let offset = 2 + 8 * users;

            // incomplete?
            if (buffer.byteLength < offset + 2) {
                return 0;
            }

            const ops = u8[offset] + (u8[offset + 1] << 8);

            // incomplete?
            if (buffer.byteLength < offset + 2 + ops + 3 * 4) {
                return 0;
            }

            let description = `User ${ab_to_base64(buffer.slice(2, 10))}`;

            if (users > 1) {
                description += ', affecting ';

                for (let i = 1; i < users; i++) {
                    description += `${ab_to_base64(buffer.slice(2 + 8 * i, 10 + 8 * i))},`;
                }
            }

            description += ' is executing a ';

            for (let i = 0; i < ops; i++) {
                if (i) {
                    description += '/';
                }

                if (String.fromCharCode(u8[offset + 2 + i]) === 'p') {
                    description += 'file or folder creation';
                }
                else {
                    description += 'UNKNOWN operation';
                }
            }

            offset += 2 + ops;

            const view = new DataView(buffer);
            const start = view.getUint32(offset, true);
            const curr = view.getUint32(offset + 4, true);
            const end = view.getUint32(offset + 8, true);

            const progress = curr / end * 100;
            loadingDialog.showProgress(progress);

            if (d) {
                description += ` since ${start}, ${progress}% [${curr}/${end}]`;
                this.logger.log(description);
            }

            return offset + 3 * 4;
        }

        schedule(running) {
            if (running) {
                return;
            }

            // retry with capped randomised exponential backoff
            if (this.backoff < 6e5) {
                this.backoff += 2e3 + -Math.log(Math.random()) * 5e3;
            }

            return super.schedule(this.backoff / 1e3);
        }

        init() {
            const {u_sid} = window;
            if (!u_sid) {
                if (d) {
                    this.logger.warn('Session no longer valid.');
                }
                return;
            }

            this.setURL(`${apipath}cs/rs?sid=${u_sid}`).restart('initialization');
        }
    };
});

mBroadcaster.once('startMega', () => {
    'use strict';

    if (is_iframed) {
        return;
    }

    api.observe('setsid', () => {
        mega.requestStatusMonitor.init();
    });
});

// FM IndexedDB layer (using Dexie.js - https://github.com/dfahlander/Dexie.js)
// (indexes and payload are obfuscated using AES ECB - FIXME: use CBC for the payload)

// DB name is fm_ + encrypted u_handle (folder links are not cached yet - FIXME)
// init() checks for the presence of a valid _sn record and wipes the DB if none is found
// pending[] is an array of write transactions that will be streamed to the DB
// setting pending[]._sn opens a new transaction, so always set it last

// - small updates run as a physical IndexedDB transaction
// - large updates are written on the fly, but with the _sn cleared, which
//   ensures integrity, but invalidates the DB if the update can't complete

// plainname: the base name that will be obfuscated using u_k
// schema: the Dexie database schema
// channelmap: { tablename : channel } - tables that do not map to channel 0
// (only channel 0 operates under an _sn-triggered transaction regime)
function FMDB(plainname, schema, channelmap) {
    'use strict';

    if (!(this instanceof FMDB)) {
        return new FMDB(plainname, schema, channelmap);
    }

    // DB Instance.
    this.db = false;

    // DB name suffix, derived from u_handle and u_k
    this.name = false;

    // DB schema - https://github.com/dfahlander/Dexie.js/wiki/TableSchema
    Object.defineProperty(this, 'schema', {value: freeze(schema)});

    // the table names contained in the schema (set at open)
    this.tables = null;

    // if we have non-transactional (write-through) tables, they are mapped
    // to channel numbers > 0 here
    this.channelmap = channelmap || {};

    // pending obfuscated writes [channel][tid][tablename][action_autoincrement] = [payloads]
    this.pending = [[]];

    // current channel tid being written to (via .add()/.del()) by the application code
    this.head = [0];

    // current channel tid being sent to IndexedDB
    this.tail = [0];

    // -1: idle, 0: deleted sn and writing (or write-through), 1: transaction open and writing
    this.state = -1;

    // upper limit when pending data needs to start to get flushed.
    this.limit = FMDB_FLUSH_THRESHOLD;

    // flag indicating whether there is a pending write
    this.writing = false;

    // [tid, tablename, action] of .pending[] hash item currently being written
    this.inflight = false;

    // the write is complete and needs be be committed (either because of _sn or write-through)
    this.commit = false;

    // a DB error occurred, do not touch IndexedDB for the rest of the session
    this.crashed = true;

    // DB invalidation process: callback and ready flag
    this.inval_cb = false;
    this.inval_ready = false;

    // whether multi-table transactions work (1) or not (0) (Apple, looking at you!)
    this.cantransact = -1;

    // a flag to know if we have sn set in database. -1 = we don't know, 0 = not set, 1 = is set
    this.sn_Set = -1;

    // @see {@link FMDB.compare}
    this._cache = Object.create(null);

    // initialise additional channels
    for (var i in this.channelmap) {
        i = this.channelmap[i];
        this.head[i] = 0;
        this.tail[i] = 0;
        this.pending[i] = [];
    }

    // protect user identity post-logout
    this.name = ab_to_base64(this.strcrypt((plainname + plainname).substr(0, 16)));

    // console logging
    this.logger = MegaLogger.getLogger('FMDB');
    this.logger.options.printDate = 'rad' in mega;
    this.logger.options.levelColors = {
        'ERROR': '#fe000b',
        'DEBUG': '#005aff',
        'WARN':  '#d66d00',
        'INFO':  '#2c6a4e',
        'LOG':   '#5b5352'
    };

    // if (d) Dexie.debug = "dexie";
}

tryCatch(function() {
    'use strict';

    // Check for indexedDB 2.0 + binary keys support.
    Object.defineProperty(FMDB, 'iDBv2', {value: indexedDB.cmp(new Uint8Array(0), 0)});
}, false)();

// options
FMDB.$useBinaryKeys = FMDB.iDBv2 ? 1 : 0;
FMDB.$usePostSerialz = 2;

// @private increase to drop/recreate *all* databases.
FMDB.version = 1;

/** @property FMDB.perspex -- @private persistence prefix */
lazy(FMDB, 'perspex', () => {
    'use strict';
    return `.${(mega.infinity << 5 | FMDB.iDBv2 << 4 | FMDB.$usePostSerialz | FMDB.version).toString(16)}`;
});

/** @property fmdb.memoize */
lazy(FMDB.prototype, 'memoize', () => {
    'use strict';
    // leave cloud nodes in memory?..
    return parseInt(localStorage.cnize) !== 0;
});

// set up and check fm DB for user u
// calls result(sn) if found and sn present
// wipes DB an calls result(false) otherwise
FMDB.prototype.init = async function(wipe) {
    "use strict";
    assert(!this.db && !this.opening, 'Something went wrong... FMDB is already ongoing...');

    // prefix database name with options/capabilities, plus making it dependent on the current schema.
    const dbpfx = `fm32${FMDB.perspex.substr(1)}${MurmurHash3(JSON.stringify(this.schema), 0x6f01f).toString(16)}`;

    this.crashed = false;
    this.inval_cb = false;
    this.inval_ready = false;

    if (d) {
        this.logger.log('Collecting database names...');
    }
    this.opening = true;

    return Promise.race([tSleep(3, EEXPIRED), Dexie.getDatabaseNames()])
        .then((r) => {
            if (r === EEXPIRED) {
                this.logger.warn('getDatabaseNames() timed out...');
            }
            const dbs = [];

            for (let i = r && r.length; i--;) {
                // drop only fmX related databases and skip slkv's
                if (r[i][0] !== '$' && r[i].substr(0, dbpfx.length) !== dbpfx
                    && r[i].substr(-FMDB.perspex.length) !== FMDB.perspex) {

                    dbs.push(r[i]);
                }
            }

            if (dbs.length) {
                if (d) {
                    this.logger.info(`Deleting obsolete databases: ${dbs.join(', ')}`);
                }

                return Promise.race([tSleep(5), Promise.allSettled(dbs.map(n => Dexie.delete(n)))]);
            }
        })
        .then((res) => res && self.d && this.logger.debug(res))
        .catch((ex) => this.logger.warn(ex && ex.message || ex, [ex]))
        .then(() => {
            this.db = new Dexie(dbpfx + this.name, {chromeTransactionDurability: 'relaxed'});

            this.db.version(1).stores(this.schema);
            this.tables = Object.keys(this.schema);

            return Promise.race([tSleep(15, ETEMPUNAVAIL), this.get('_sn').catch(dump)]);
        })
        .then((res) => {
            if (res === ETEMPUNAVAIL) {
                if (d) {
                    this.logger.warn('Opening the database timed out.');
                }
                throw res;
            }
            const [sn] = res || [];

            if (!wipe && sn && sn.length === 11) {
                if (d) {
                    this.logger.info(`DB sn: ${sn}`);
                }
                return sn;
            }
            if (!mBroadcaster.crossTab.owner || this.crashed) {

                throw new Error(`unusable (${this.crashed | 0})`);
            }

            if (d) {
                this.logger.log("No sn found in DB, wiping...");
            }

            // eslint-disable-next-line local-rules/open -- no, this is not a window.open() call.
            return this.db.delete().then(() => this.db.open());
        })
        .catch((ex) => {
            const {db, logger} = this;

            onIdle(() => db.delete().catch(nop));
            logger.warn('Marking DB as crashed.', ex);

            this.db = false;
            this.crashed = 2;
        })
        .finally(() => {
            this.opening = false;
        });
};

// send failure event
FMDB.prototype.evento = function(message) {
    'use strict';
    message = String(message).split('\n')[0].substr(0, 380);
    if (message.includes('not allow mutations')) {
        // Ignore spammy Firefox in PBM.
        return;
    }
    const eid = 99724;
    const once = !eventlog.sent || eventlog.sent[eid] > 0;

    eventlog(eid, message, once);

    queueMicrotask(() => {
        if (eventlog.sent) {
            eventlog.sent[eid] = 1;
        }
    });
};

// drop database
FMDB.prototype.drop = async function fmdb_drop() {
    'use strict';

    if (this.db) {
        await this.invalidate();
        await this.db.delete().catch(dump);
        this.db = null;
    }
};

// check if data for table is currently being written.
FMDB.prototype.hasPendingWrites = function(table) {
    'use strict';

    if (!table) {
        return this.writing;
    }
    var ch = this.channelmap[table] || 0;
    var ps = this.pending[ch][this.tail[ch]] || false;

    return this.tail[ch] !== this.head[ch] && ps[table];
};

/** check whether we're busy with too many pending writes */
Object.defineProperty(FMDB.prototype, 'busy', {
    get: function() {
        'use strict';
        const limit = BACKPRESSURE_FMDB_LIMIT;
        const pending = this.pending[0];

        let count = 0;
        let i = pending.length;
        while (i--) {
            const t = pending[i] && pending[i].f;

            for (let {h} = t || !1; h >= 0; h--) {
                if (t[h]) {
                    count += t[h].size || t[h].length || 0;
                    if (count > limit) {
                        if (d) {
                            console.debug('fmdb.busy', count);
                        }
                        return true;
                    }
                }
            }
        }
        return false;
    }
});

// enqueue a table write - type 0 == addition, type 1 == deletion
// IndexedDB activity is triggered once we have a few thousand of pending rows or the sn
// (writing the sn - which is done last - completes the transaction and starts a new one)
FMDB.prototype.enqueue = function fmdb_enqueue(table, row, type) {
    "use strict";

    let c;
    let lProp = 'size';
    const ch = this.channelmap[table] || 0;

    // if needed, create new transaction at index fmdb.head
    if (!(c = this.pending[ch][this.head[ch]])) {
        c = this.pending[ch][this.head[ch]] = Object.create(null);
    }

    // if needed, create new hash of modifications for this table
    // .h = head, .t = tail (last written to the DB)
    if (!c[table]) {
        // even indexes hold additions, odd indexes hold deletions
        c[table] = { t : -1, h : type };
        c = c[table];
    }
    else {
        // (we continue to use the highest index if it is of the requested type
        // unless it is currently in flight)
        // increment .h(head) if needed
        c = c[table];
        if ((c.h ^ type) & 1) c.h++;
    }

    if (c[c.h]) {
        if (this.useMap[table]) {
            if (type & 1) {
                c[c.h].add(row);
            }
            else {
                c[c.h].set(row.h, row);
            }
        }
        else {
            c[c.h].push(row);
            lProp = 'length';
        }
    }
    else if (this.useMap[table]) {
        if (type & 1) {
            c[c.h] = new Set([row]);
        }
        else {
            c[c.h] = new Map([[row.h, row]]);
        }
    }
    else {
        c[c.h] = [row];
        lProp = 'length';
    }

    // force a flush when a lot of data is pending or the _sn was updated
    // also, force a flush for non-transactional channels (> 0)
    if (ch || table[0] === '_' || c[c.h][lProp] > this.limit) {
        //  the next write goes to a fresh transaction
        if (!ch) {
            fmdb.head[ch]++;
        }
        fmdb.writepending(fmdb.head.length - 1);
    }
};

/**
 * Serialize data before storing it into indexedDB
 * @param {String} table The table this dta belongs to
 * @param {Object} row Object to serialize.
 * @returns {Object} The input data serialized
 */
FMDB.prototype.serialize = function(table, row) {
    'use strict';

    if (row.d) {
        if (this.stripnode[table]) {
            // this node type is stripnode-optimised: temporarily remove redundant elements
            // to create a leaner JSON and save IndexedDB space
            var j = row.d;  // this references the live object!
            var t = this.stripnode[table](j);   // remove overhead
            row.d = JSON.stringify(j);          // store lean result

            // Restore overhead (In Firefox, Object.assign() is ~63% faster than for..in)
            Object.assign(j, t);
        }
        else {
            // otherwise, just stringify it all
            row.d = JSON.stringify(row.d);
        }
    }

    // obfuscate index elements as base64-encoded strings, payload as ArrayBuffer
    for (var i in row) {
        if (i === 'd') {
            row.d = this.strcrypt(row.d);
        }
        else if (table !== 'f' || i !== 't') {
            row[i] = this.toStore(row[i]);
        }
    }

    return row;
};

FMDB.prototype.getError = function(ex) {
    'use strict';
    const error = ex && ex.inner || ex || !1;
    const message = `~${error.name || ''}: ${error.message || ex && ex.message || ex}`;
    return {error, message};
};

FMDB.prototype._transactionErrorHandled = function(ch, ex) {
    'use strict';
    const tag = '$fmdb$fail$state';
    const state = sessionStorage[tag] | 0;
    const {error, message} = this.getError(ex);

    let res = false;
    let eventMsg = `$wptr:${message.substr(0, 99)}`;

    if (this.inflight) {
        if (d) {
            console.assert(this.inflight instanceof Error);
        }
        if (this.inflight instanceof Error) {
            eventMsg += ` >> ${this.inflight}`;
        }
        this.inflight = false;
    }
    this.evento(eventMsg);

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        if (d) {
            this.logger.info("Transaction %s, retrying...", error.name, ex);

            if (mega.loadReport) {
                this.logger.info('loadReport', JSON.stringify(mega.loadReport));
            }
        }
        const {loading} = mega.is;

        res = true;
        sessionStorage[tag] = 1 + state;

        switch (state) {
            case 0:
            case 1:
            case 2:
                if (mega.loadReport && mega.loadReport.invisibleTime > 0 || !loading) {
                    sessionStorage[tag]--;
                }
                if (!this.crashed) {
                    this.state = -1;
                    this.writing = 0;
                    this.writepending(ch);
                    break;
                }
                if (!loading) {
                    res = false;
                    break;
                }
            /* fallthrough */
            case 3:
                if (!mega.nobp) {
                    localStorage.nobp = 1;
                    fm_fullreload(true);
                    break;
                }
            /* fallthrough */
            case 4:
                fm_fullreload(null, 'DB-crash');
                break;
            default:
                res = false; // let the DB crash.
                break;
        }
    }

    return res;
};

// FIXME: auto-retry smaller transactions? (need stats about transaction failures)
// ch - channel to operate on
FMDB.prototype.writepending = function fmdb_writepending(ch) {
    "use strict";

    // exit loop if we ran out of pending writes or have crashed
    if (this.inflight || ch < 0 || this.crashed || this.writing) {
        return;
    }

    // signal when we start/finish to save stuff
    if (!ch) {
        if (this.tail[ch] === this.head[ch] - 1) {
            mLoadingSpinner.show('fmdb', 'Storing account into local database...');
        }
        else if (this.tail[ch] === this.head[ch]) {
            mLoadingSpinner.hide('fmdb', true);
            this.pending[ch] = this.pending[ch].filter(Boolean);
            this.tail[ch] = this.head[ch] = 0;
            this._cache = Object.create(null);
        }
    }

    // iterate all channels to find pending writes
    if (!this.pending[ch][this.tail[ch]]) {
        return this.writepending(ch - 1);
    }

    if (this.tail[ch] >= this.head[ch]) {
        return;
    }

    var fmdb = this;

    if (d > 1) {
        fmdb.logger.warn('writepending()', ch, fmdb.state,
            Object(fmdb.pending[0][fmdb.tail[0]])._sn, fmdb.cantransact);
    }

    if (!ch && fmdb.state < 0 && fmdb.cantransact) {

        // if the write job is on channel 0 and already complete (has _sn set),
        // we execute it in a single transaction without first clearing sn
        fmdb.state = 1;
        fmdb.writing = 1;
        fmdb.db.transaction('rw!', fmdb.tables, () => {
            if (d) {
                fmdb.logger.info("Transaction started");
                console.time('fmdb-transaction');
            }
            fmdb.commit = false;
            fmdb.cantransact = 1;

            if (fmdb.sn_Set && !fmdb.pending[0][fmdb.tail[0]]._sn && currsn) {
                fmdb.db._sn.clear().then(function() {
                    fmdb.sn_Set = 0;
                    dispatchputs();
                });
            }
            else {
                dispatchputs();
            }
        }).then(() => {
            // transaction completed: delete written data
            delete fmdb.pending[0][fmdb.tail[0]++];

            if (d) {
                fmdb.logger.log("HEAD = " + fmdb.head[0] + " --- Tail = " + fmdb.tail[0]);
            }

            fmdb.state = -1;
            if (d) {
                fmdb.logger.info("Transaction committed");
                console.timeEnd('fmdb-transaction');
            }
            fmdb.writing = 0;
            fmdb.writepending(ch);
        }).catch((ex) => {
            if (d) {
                console.timeEnd('fmdb-transaction');
            }

            if (this.inval_cb && ex.name === 'DatabaseClosedError') {

                return this.inval_cb();
            }

            if (fmdb.cantransact < 0) {
                fmdb.logger.error("Your browser's IndexedDB implementation is bogus, disabling transactions.");
                fmdb.cantransact = 0;
                fmdb.writing = 0;
                fmdb.writepending(ch);
            }
            else if (!fmdb._transactionErrorHandled(ch, ex)) {
                // FIXME: retry instead? need statistics.
                fmdb.logger.error("Transaction failed, marking DB as crashed", ex);
                fmdb.state = -1;
                fmdb.invalidate();
            }
        });
    }
    else {
        if (d) {
            console.error('channel 1 Block ... invoked');
        }
        // we do not inject write-through operations into a live transaction
        if (fmdb.state > 0) {
            dispatchputs();
        }
        else {
            // the job is incomplete or non-transactional - set state to "executing
            // write without transaction"
            fmdb.state = 0;

            if (ch) {
                // non-transactional channel: go ahead and write

                dispatchputs();
            }
            else {
                // mark db as "writing" until the sn cleaning have completed,
                // this flag will be reset on dispatchputs() once fmdb.commit is set
                fmdb.writing = 2;
                // we clear the sn (the new sn will be written as the last action in this write job)
                // unfortunately, the DB will have to be wiped in case anything goes wrong
                var sendOperation = function() {
                    fmdb.commit = false;
                    fmdb.writing = 3;

                    dispatchputs();
                };
                if (currsn) {
                    fmdb.db._sn.clear().then(
                        function() {
                            if (d) {
                                console.error('channel 1 + Sn cleared');
                            }
                            fmdb.sn_Set = 0;
                            sendOperation();
                        }
                    ).catch(function(e) {
                        fmdb.logger.error("SN clearing failed, marking DB as crashed", e);
                        fmdb.state = -1;
                        fmdb.invalidate();

                        fmdb.evento(`$wpsn:${e}`);
                    });
                }
                else {
                    sendOperation();
                }

            }
        }
    }

    // start writing all pending data in this transaction to the DB
    // conclude/commit the (virtual or real) transaction once _sn has been written
    function dispatchputs() {
        if (fmdb.inflight) return;

        if (fmdb.commit) {
            // invalidation commit completed?
            if (fmdb.inval_ready) {
                if (fmdb.inval_cb) {
                    // fmdb.db.close();
                    fmdb.inval_cb();    // caller must not reuse fmdb object
                }
                return;
            }

            // the transaction is complete: delete from pending
            if (!fmdb.state) {
                // we had been executing without transaction protection, delete the current
                // transaction and try to dispatch the next one immediately
                if (!ch) delete fmdb.pending[0][fmdb.tail[0]++];

                fmdb.commit = false;
                fmdb.state = -1;
                fmdb.writing = false;
                fmdb.writepending(ch);
            }

            // if we had a real IndexedDB transaction open, it will commit
            // as soon as the browser main thread goes idle

            // I wont return, because this is relying on processing _sn table as the last
            // table in the current pending operations..

            // return;
        }

        var tablesremaining = false;

        // this entirely relies on non-numeric hash keys being iterated
        // in the order they were added. FIXME: check if always true
        for (var table in fmdb.pending[ch][fmdb.tail[ch]]) { // iterate through pending tables, _sn last
            var t = fmdb.pending[ch][fmdb.tail[ch]][table];

            // do we have at least one update pending? (could be multiple)
            if (t[t.h]) {
                tablesremaining = true;

                // locate next pending table update (even/odd: put/del)
                while (t.t <= t.h && !t[t.t]) t.t++;

                // all written: advance head
                if (t.t == t.h) t.h++;

                if (fmdb.crashed && !(t.t & 1)) {
                    if (d) {
                        fmdb.logger.warn('The DB is crashed, halting put...');
                    }
                    return;
                }

                if (d) {
                    fmdb.logger.debug("DB %s with %s element(s) on table %s, channel %s, state %s",
                                      t.t & 1 ? 'del' : 'put', t[t.t].size || t[t.t].length, table, ch, fmdb.state);
                }

                // if we are on a non-transactional channel or the _sn is being updated,
                // request a commit after the operation completes.
                if (ch || table[0] == '_') {
                    fmdb.commit = true;
                    fmdb.sn_Set = 1;
                }

                // record what we are sending...
                fmdb.inflight = true;

                // is this an in-band _sn invalidation, and do we have a callback set? arm it.
                if (fmdb.inval_cb && t.t & 1 && table[0] === '_') {
                    fmdb.inval_ready = true;
                }

                // ...and send update off to IndexedDB for writing
                write(table, t[t.t], t.t++ & 1 ? 'bulkDelete' : 'bulkPut');

                // we don't send more than one transaction (looking at you, Microsoft!)
                if (!fmdb.state) {
                    fmdb.inflight = t;
                    return;
                }
            }
            else {
                // if we are non-transactional and all data has been written for this
                // table, we can safely delete its record
                if (!fmdb.state && t.t == t.h) {
                    delete fmdb.pending[ch][fmdb.tail[ch]][table];
                }
            }
        }

        // if we are non-transactional, this deletes the "transaction" when done
        // (as commit will never be set)
        if (!fmdb.state && !tablesremaining) {
            delete fmdb.pending[ch][fmdb.tail[ch]];

            fmdb.writing = null;
            fmdb.writepending(fmdb.head.length - 1);
        }
    }

    // bulk write operation
    function write(table, data, op) {
        if ('size' in data) {
            // chrome90: 5ms per 1m
            data = [...data.values()];
        }
        const limit = window.fminitialized ? fmdb.limit >> 3 : data.length + 1;

        if (FMDB.$usePostSerialz) {
            if (d) {
                console.time('fmdb-serialize');
            }

            if (op === 'bulkPut') {
                if (!data[0].d || fmdb._raw(data[0])) {
                    for (let x = data.length; x--;) {
                        fmdb.serialize(table, data[x]);
                    }
                }
                else if (d) {
                    fmdb.logger.debug('No data serialization was needed, retrying?', data);
                }
            }
            else if (!(data[0] instanceof ArrayBuffer)) {
                for (let j = data.length; j--;) {
                    data[j] = fmdb.toStore(data[j]);
                }
            }

            if (d) {
                console.timeEnd('fmdb-serialize');
            }
        }

        if (data.length < limit) {
            fmdb.db[table][op](data).then(writeend).catch(writeerror);
            return;
        }

        var idx = 0;
        (function bulkTick() {
            var rows = data.slice(idx, idx += limit);

            if (rows.length) {
                if (d > 1) {
                    var left = idx > data.length ? 0 : data.length - idx;
                    fmdb.logger.log('%s for %d rows, %d remaining...', op, rows.length, left);
                }
                fmdb.db[table][op](rows).then(bulkTick).catch(writeerror);
            }
            else {
                data = undefined;
                writeend();
            }
        })();
    }

    // event handler for bulk operation completion
    function writeend() {
        if (d) {
            fmdb.logger.log('DB write successful'
                + (fmdb.commit ? ' - transaction complete' : '') + ', state: ' + fmdb.state);
        }

        // if we are non-transactional, remove the written data from pending
        // (we have to keep it for the transactional case because it needs to
        // be visible to the pending updates search that getbykey() performs)
        if (!fmdb.state) {
            delete fmdb.inflight[fmdb.inflight.t - 1];
            fmdb.inflight = false;

            // in non-transactional loop back when the browser is idle so that we'll
            // prevent unnecessarily hanging the main thread and short writes...
            if (!fmdb.commit) {
                if (loadfm.loaded) {
                    onIdle(dispatchputs);
                }
                else {
                    tSleep(3).then(dispatchputs);
                }
                return;
            }
        }

        // loop back to write more pending data (or to commit the transaction)
        fmdb.inflight = false;
        dispatchputs();
    }

    // event handler for bulk operation error
    function writeerror(ex) {
        if (ex instanceof Dexie.BulkError) {
            fmdb.logger.error('Bulk operation error, %s records failed.', ex.failures.length, ex);
        }
        else {
            fmdb.logger.error('Unexpected error in bulk operation...', ex);
        }

        if (fmdb.state > 0 && !fmdb.crashed) {
            if (d) {
                fmdb.logger.info('We are transactional, attempting to retry...');
            }
            fmdb.inflight = ex;
            return;
        }

        fmdb.state = -1;
        fmdb.inflight = false;

        // If there is an invalidation request pending, dispatch it.
        if (fmdb.inval_cb) {
            console.assert(fmdb.crashed, 'Invalid state, the DB must be crashed already...');
            fmdb.inval_cb();
        }
        else {
            fmdb.invalidate();
        }

        if (d) {
            fmdb.logger.warn('Marked DB as crashed...', ex.name);
        }

        fmdb.evento(ex);
    }
};

/**
 * Encrypt Unicode string with user's master key
 * @param {String} s The unicode string
 * @returns {ArrayBuffer} encrypted buffer
 * @todo use CBC instead of ECB!
 */
FMDB.prototype.strcrypt = function fmdb_strcrypt(s) {
    "use strict";

    if (d && String(s).length > 0x10000) {
        (this.logger || console)
            .warn('The data you are trying to write is too large and will degrade the performance...', [s]);
    }

    var len = (s = '' + s).length;
    var bytes = this.utf8length(s);
    if (bytes === len) {
        var a32 = new Int32Array(len + 3 >> 2);
        for (var i = len; i--;) {
            a32[i >> 2] |= s.charCodeAt(i) << 8 * (i & 3);
        }
        return this._crypt(u_k_aes, a32);
    }

    return this._crypt(u_k_aes, this.to8(s, bytes));
};

/**
 * Decrypt buffer with user's master key
 * @param {ArrayBuffer} buffer Encrypted buffer
 * @returns {String} unicode string
 * @see {@link FMDB.strcrypt}
 */
FMDB.prototype.strdecrypt = function fmdb_strdecrypt(buffer) {
    "use strict";

    if (buffer.byteLength) {
        var s = this.from8(this._decrypt(u_k_aes, buffer));
        for (var i = s.length; i--;) {
            if (s.charCodeAt(i)) {
                return s.substr(0, i + 1);
            }
        }
    }
    return '';
};

// @private legacy version
FMDB.prototype.strcrypt0 = function fmdb_strcrypt(s) {
    "use strict";

    if (d && String(s).length > 0x10000) {
        console.warn('The data you are trying to write is too huge and will degrade the performance...');
    }

    var a32 = str_to_a32(to8(s));
    for (var i = (-a32.length) & 3; i--; ) a32.push(0);
    return a32_to_ab(encrypt_key(u_k_aes, a32)).buffer;
};

// @private legacy version
FMDB.prototype.strdecrypt0 = function fmdb_strdecrypt(ab) {
    "use strict";

    if (!ab.byteLength) return '';
    var a32 = [];
    var dv = new DataView(ab);
    for (var i = ab.byteLength/4; i--; ) a32[i] = dv.getUint32(i*4);
    var s = from8(a32_to_str(decrypt_key(u_k_aes, a32)));
    for (var i = s.length; i--; ) if (s.charCodeAt(i)) return s.substr(0, i+1);
};


// TODO: @lp/@diego we need to move this to some other place...
FMDB._mcfCache = {};

// tables storing pending writes as Map() instances.
FMDB.prototype.useMap = Object.assign(Object.create(null), {f: true, tree: true});

// remove fields that are duplicated in or can be inferred from the index to reduce database size
FMDB.prototype.stripnode = Object.freeze({
    f : function(f) {
        'use strict';
        var t = { h : f.h, t : f.t, s : f.s };

        // Remove pollution from the ufs-size-cache
        // 1. non-folder nodes does not need tb/td/tf
        if (!f.t) {
            delete f.tb;
            delete f.td;
            delete f.tf;
        }
        // 2. remove Zero properties from versioning nodes inserted everywhere...
        if (f.tvb === 0) delete f.tvb;
        if (f.tvf === 0) delete f.tvf;

        // Remove properties used as indexes
        delete f.h;
        delete f.t;
        delete f.s;

        t.ts = f.ts;
        delete f.ts;

        if (f.hash) {
            t.hash = f.hash;
            delete f.hash;
        }

        if (f.fa) {
            t.fa = f.fa;
            delete f.fa;
        }

        // Remove other garbage
        if ('seen' in f) {
            t.seen = f.seen;
            delete f.seen; // inserted by the dynlist
        }

        if (f.shares) {
            t.shares = f.shares;
            delete f.shares; // will be populated from the s table
        }

        if (f.fav !== undefined && !(f.fav | 0)) {
            delete f.fav;
        }
        if (f.lbl !== undefined && !(f.lbl | 0)) {
            delete f.lbl;
        }

        if (f.p) {
            t.p = f.p;
            delete f.p;
        }

        if (f.ar) {
            t.ar = f.ar;
            delete f.ar;
        }

        if (f.u === u_handle) {
            t.u = f.u;
            f.u = '~';
        }

        return t;
    },

    tree: function(f) {
        'use strict';
        var t = {h: f.h};
        delete f.h;
        if (f.td !== undefined && !f.td) {
            delete f.td;
        }
        if (f.tb !== undefined && !f.tb) {
            delete f.tb;
        }
        if (f.tf !== undefined && !f.tf) {
            delete f.tf;
        }
        if (f.tvf !== undefined && !f.tvf) {
            delete f.tvf;
        }
        if (f.tvb !== undefined && !f.tvb) {
            delete f.tvb;
        }
        if (f.lbl !== undefined && !(f.lbl | 0)) {
            delete f.lbl;
        }
        return t;
    },

    ua: function(ua) {
        'use strict';
        delete ua.k;
    },

    u: function(usr) {
        'use strict';
        delete usr.u;
        delete usr.h;
        delete usr.p;
        delete usr.t;
        delete usr.m2;
        delete usr.ats;
        delete usr.name;
        delete usr.pubk;
        delete usr.avatar;
        delete usr.nickname;
        delete usr.presence;
        delete usr.lastName;
        delete usr.firstName;
        delete usr.presenceMtime;
    },

    mcf: function(mcf) {
        'use strict';
        // mcf may contain 'undefined' values, which should NOT be set, otherwise they may replace the mcfCache
        var cache = {};
        var keys = ['id', 'cs', 'g', 'u', 'ts', 'ct', 'ck', 'f', 'm', 'mr'];
        for (var idx = keys.length; idx--;) {
            var k = keys[idx];

            if (mcf[k] !== undefined) {
                cache[k] = mcf[k];
            }
        }
        // transient properties, that need to be resetted
        cache.n = mcf.n || undefined;

        FMDB._mcfCache[cache.id] = Object.assign({}, FMDB._mcfCache[mcf.id], cache);
        Object.assign(mcf, FMDB._mcfCache[cache.id]);

        var t = {id: mcf.id, ou: mcf.ou, n: mcf.n, url: mcf.url};
        delete mcf.id;
        delete mcf.ou;
        delete mcf.url;
        delete mcf.n;

        if (mcf.g === 0) {
            t.g = 0;
            delete mcf.g;
        }
        if (mcf.m === 0) {
            t.m = 0;
            delete mcf.m;
        }
        if (mcf.f === 0) {
            t.f = 0;
            delete mcf.f;
        }
        if (mcf.cs === 0) {
            t.cs = 0;
            delete mcf.cs;
        }

        if (mcf.u) {
            t.u = mcf.u;
            mcf.u = '';

            for (var i = t.u.length; i--;) {
                mcf.u += t.u[i].u + t.u[i].p;
            }
        }

        return t;
    }
});

// re-add previously removed index fields to the payload object
FMDB.prototype.restorenode = Object.freeze({
    ok : function(ok, index) {
        'use strict';
        ok.h = index.h;
    },

    f : function(f, index) {
        'use strict';
        f.h = index.h;
        f.p = index.p;
        f.ts = index.t < 0 ? 1262304e3 - index.t : index.t;
        if (index.c) {
            f.hash = index.c;
        }
        if (index.fa) {
            f.fa = index.fa;
        }
        if (index.s < 0) f.t = -index.s;
        else {
            f.t = 0;
            f.s = parseFloat(index.s);
        }
        if (!f.ar && f.k && typeof f.k == 'object') {
            f.ar = Object.create(null);
        }
        if (f.u === '~') {
            f.u = u_handle;
        }
    },
    tree : function(f, index) {
        'use strict';
        f.h = index.h;
    },

    ph : function(ph, index) {
        'use strict';
        ph.h = index.h;
    },

    ua : function(ua, index) {
        'use strict';
        ua.k = index.k;
    },

    u: function(usr, index) {
        'use strict';
        usr.u = index.u;

        if (usr.c === 1) {
            usr.t = 1;
            usr.h = usr.u;
            usr.p = 'contacts';
        }
    },

    h: function(out, index) {
        'use strict';
        out.h = index.h;
        out.hash = index.c;
    },

    mk : function(mk, index) {
        'use strict';
        mk.h = index.h;
    },

    mcf: function(mcf, index) {
        'use strict';
        mcf.id = index.id;

        mcf.m = mcf.m || 0;
        mcf.g = mcf.g || 0;
        mcf.f = mcf.f || 0;
        mcf.cs = mcf.cs || 0;

        if (typeof mcf.u === 'string') {
            var users = [];
            for (var i = 0; i < mcf.u.length; i += 12) {
                users.push({
                    p: mcf.u[11 + i] | 0,
                    u: mcf.u.substr(i, 11)
                });
            }
            mcf.u = users;
        }

        FMDB._mcfCache[mcf.id] = mcf;
    }
});

// enqueue IndexedDB puts
// sn must be added last and effectively (mostly actually) "commits" the "transaction"
// the next addition will then start a new "transaction"
// (large writes will not execute as an IndexedDB transaction because IndexedDB can't)
FMDB.prototype.add = function fmdb_add(table, row) {
    "use strict";

    if (this.crashed) return;

    this.enqueue(table, row, 0);
};

// enqueue IndexedDB deletions
FMDB.prototype.del = function fmdb_del(table, index) {
    "use strict";

    if (this.crashed) return;

    this.enqueue(table, index, 1);
};

// non-transactional read with subsequent deobfuscation, with optional prefix filter
// (must NOT be used for dirty reads - use getbykey() instead)
FMDB.prototype.get = async function fmdb_get(table, chunked) {
    "use strict";
    if (this.crashed > 1) {
        // a read operation failed previously
        return [];
    }

    if (d) {
        this.logger.log("Fetching entire table %s...", table, chunked ? '(chunked)' : '');
    }

    if (chunked) {
        const limit = 8192;
        const {keyPath} = this.db[table].schema.primKey;

        let res = await this.db[table].orderBy(keyPath).limit(limit).toArray();
        while (res.length) {
            let last = res[res.length - 1][keyPath].slice(0);

            this.normaliseresult(table, res);
            last = chunked(res, last) || last;

            res = res.length >= limit && await this.db[table].where(keyPath).above(last).limit(limit).toArray();
        }
        return;
    }

    const r = await this.db[table].toArray().catch(dump);
    if (r) {
        this.normaliseresult(table, r);
    }
    else {
        if (d && !this.crashed) {
            this.logger.error("Read operation failed, marking DB as read-crashed");
        }
        await this.invalidate(1);
    }

    return r || [];
};

FMDB.prototype.normaliseresult = function fmdb_normaliseresult(table, r) {
    "use strict";

    var t;
    for (var i = r.length; i--; ) {
        try {
            if (!r[i]) {
                // non-existing bulkGet result.
                r.splice(i, 1);
                continue;
            }

            if (this._raw(r[i])) {
                // not encrypted.
                if (d > 1) {
                    console.assert(FMDB.$usePostSerialz);
                }
                r[i] = r[i].d;
                continue;
            }

            t = r[i].d ? JSON.parse(this.strdecrypt(r[i].d)) : {};

            if (this.restorenode[table]) {
                // restore attributes based on the table's indexes
                for (var p in r[i]) {
                    if (p !== 'd' && (table !== 'f' || p !== 't')) {
                        r[i][p] = this.fromStore(r[i][p]);
                    }
                }
                this.restorenode[table](t, r[i]);
            }

            r[i] = t;
        }
        catch (ex) {
            if (d) {
                this.logger.error("IndexedDB corruption: " + this.strdecrypt(r[i].d), ex);
            }
            r.splice(i, 1);
        }
    }
};

// non-transactional read with subsequent deobfuscation, with optional key filter
// (dirty reads are supported by scanning the pending writes after the IndexedDB read completes)
// anyof and where are mutually exclusive, FIXME: add post-anyof where filtering?
// eslint-disable-next-line complexity
FMDB.prototype.getbykey = async function fmdb_getbykey(table, index, anyof, where, limit) {
    'use strict';
    let bulk = false;
    let options = false;
    if (typeof index !== 'string') {
        options = index;
        index = options.index;
        anyof = anyof || options.anyof;
        where = where || options.where;
        limit = limit || options.limit;
    }

    if (this.crashed > 1 || anyof && !anyof[1].length) {
        return [];
    }

    let p = false;
    const ch = this.channelmap[table] || 0;
    const writing = this.writing || this.head[ch] !== this.tail[ch];
    const debug = d && (x => (m, ...a) => this.logger.warn(`[${x}] ${m}`, ...a))(Math.random().toString(28).slice(-7));

    if (debug) {
        debug(`Fetching table ${table}...${writing ? '\u26a1' : ''}`, options || where || anyof && anyof.flat());
    }

    let i = 0;
    let t = this.db[table];

    if (!index) {
        // No index provided, fallback to primary key
        index = t.schema.primKey.keyPath;
    }

    if (table === 'f' && index === 'h' && mega.infinity) {
        p = [];

        if (anyof && (anyof[0] === 'p' || anyof[0] === 'h')) {
            p.push(...anyof[1]);
        }
    }

    if (anyof) {
        // encrypt all values in the list
        for (i = anyof[1].length; i--;) {
            anyof[1][i] = this.toStore(anyof[1][i]);
        }

        if (anyof[1].length > 1) {
            if (!limit && anyof[0] === t.schema.primKey.keyPath) {
                bulk = true;
                t = t.bulkGet(anyof[1]);
            }
            else if (options.offset) {
                t = t.where(anyof[0]).anyOf(anyof[1]);
            }
            else {
                let flat = a => a.flat();
                if (limit) {
                    flat = (lmt => a => a.flat().slice(0, lmt))(limit);
                    limit = false;
                }
                t = Promise.all(anyof[1].map(k => t.where(anyof[0]).equals(k).toArray())).then(flat);
            }
        }
        else {
            t = t.where(anyof[0]).equals(anyof[1][0]);
        }
    }
    else if (options.query) {
        // Perform custom user-provided query
        t = options.query(t);
    }
    else if (where) {
        for (let k = where.length; k--;) {
            // encrypt the filter values (logical AND is commutative, so we can reverse the order)
            if (typeof where[k][1] === 'string') {
                if (p && where[k][0] === 'p') {
                    p.push(where[k][1]);
                }
                if (!this._cache[where[k][1]]) {
                    this._cache[where[k][1]] = this.toStore(where[k][1]);
                }
                where[k][1] = this._cache[where[k][1]];
            }

            // apply filter criterion
            if (i) {
                t = t.and(where[k][0]);
            }
            else {
                t = t.where(where[k][0]);
                i = 1;
            }

            t = t.equals(where[k][1]);
        }
    }

    if (options.offset) {
        t = t.offset(options.offset);
    }

    if (limit) {
        t = t.limit(limit);
    }

    t = options.sortBy ? t.sortBy(options.sortBy) : t.toArray ? t.toArray() : t;

    // eslint-disable-next-line complexity
    const r = await t.then((r) => {
        // now scan the pending elements to capture and return unwritten updates
        // FIXME: typically, there are very few or no pending elements -
        // determine if we can reduce overall CPU load by replacing the
        // occasional scan with a constantly maintained hash for direct lookups?
        let j, f, k;
        let match = 0;
        const isMap = this.useMap[table];
        const pending = this.pending[ch];
        const matches = Object.create(null);
        const lProp = isMap ? 'size' : 'length';

        if (bulk) {
            for (let i = r.length; i--;) {
                if (!r[i]) {
                    // non-existing bulkGet result.
                    r.splice(i, 1);
                }
            }
        }
        const dbRecords = !!r.length;

        console.time(`dirty-${pending.length}`);

        // iterate transactions in reverse chronological order
        for (let tid = pending.length; tid--;) {
            const t = pending[tid] && pending[tid][table];

            // any updates pending for this table?
            if (t && (t[t.h] && t[t.h][lProp] || t[t.h - 1] && t[t.h - 1][lProp])) {
                // debugger
                // examine update actions in reverse chronological order
                // FIXME: can stop the loop at t.t for non-transactional writes
                for (let a = t.h; a >= 0; a--) {
                    /* eslint-disable max-depth */
                    if (t[a]) {
                        const data = isMap ? [...t[a].values()] : t[a];

                        if (a & 1) {
                            // no need to record a deletion unless we got db entries
                            if (dbRecords) {
                                // deletion - always by bare index
                                for (j = data.length; j--;) {
                                    f = this._value(data[j]);

                                    if (typeof matches[f] == 'undefined') {
                                        // boolean false means "record deleted"
                                        matches[f] = false;
                                        match++;
                                    }
                                }
                            }
                        }
                        else {
                            // addition or update - index field is attribute
                            // iterate updates in reverse chronological order
                            // (updates are not commutative)
                            for (j = data.length; j--;) {
                                const update = data[j];

                                f = this._value(update[index]);
                                if (typeof matches[f] == 'undefined') {
                                    // check if this update matches our criteria, if any
                                    if (where) {
                                        for (k = where.length; k--;) {
                                            if (!this.compare(table, where[k][0], where[k][1], update)) {
                                                break;
                                            }
                                        }

                                        // mismatch detected - record it as a deletion
                                        if (k >= 0) {
                                            // no need to record a deletion unless we got db entries
                                            if (dbRecords) {
                                                match++;
                                                matches[f] = false;
                                            }
                                            continue;
                                        }
                                    }
                                    else if (options.query) {
                                        // If a custom query was made, notify there was a
                                        // pending update and whether if should be included.
                                        if (!(options.include && options.include(update, index))) {
                                            // nope - record it as a deletion
                                            matches[f] = false;
                                            match++;
                                            continue;
                                        }
                                    }
                                    else if (anyof) {
                                        // does this update modify a record matched by the anyof inclusion list?
                                        for (k = anyof[1].length; k--;) {
                                            if (this.compare(table, anyof[0], anyof[1][k], update)) {
                                                break;
                                            }
                                        }

                                        // no match detected - record it as a deletion
                                        if (k < 0) {
                                            // no need to record a deletion unless we got db entries
                                            if (dbRecords) {
                                                match++;
                                                matches[f] = false;
                                            }
                                            continue;
                                        }
                                    }

                                    match++;
                                    matches[f] = update;
                                }
                            }
                        }
                    }
                }
            }
        }
        console.timeEnd(`dirty-${pending.length}`);

        // scan the result for updates/deletions/additions arising out of the matches found
        if (match) {
            if (debug) {
                debug('pending matches', match, r.length);
            }

            for (i = r.length; i--;) {
                // if this is a binary key, convert it to string
                f = this._value(r[i][index]);

                if (typeof matches[f] !== 'undefined') {
                    if (matches[f] === false) {
                        // a returned record was deleted or overwritten with
                        // keys that fall outside our where clause
                        r.splice(i, 1);
                    }
                    else {
                        // a returned record was overwritten and still matches
                        // our where clause
                        r[i] = this.clone(matches[f]);
                        matches[f] = undefined;
                    }
                }
            }

            // now add newly written records
            for (t in matches) {
                if (matches[t]) {
                    r.push(this.clone(matches[t]));
                }
            }
        }

        // filter out matching records
        if (where) {
            for (i = r.length; i--;) {
                for (k = where.length; k--;) {
                    if (!this.compare(table, where[k][0], where[k][1], r[i])) {
                        r.splice(i, 1);
                        break;
                    }
                }
            }
        }

        // Apply user-provided filtering, if any
        if (options.filter) {
            r = options.filter(r);
        }

        if (r.length) {
            this.normaliseresult(table, r);
        }
        return r;
    }).catch((ex) => {
        if (debug && !this.crashed) {
            debug("Read operation failed, marking DB as read-crashed", ex);
        }
    });

    if (!r) {
        await this.invalidate(1);
    }
    else if (p.length) {
        const s = new Set();

        // prepare to request missing nodes.
        for (let x, i = r.length; i--;) {
            const n = r[i];

            if ((x = p.indexOf(n.h)) >= 0) {
                s.add(n.p);
                p.splice(x, 1);
            }

            if ((x = p.indexOf(n.p)) >= 0) {
                p.splice(x, 1);
            }
        }

        for (let i = r.length; i--;) {
            if (s.has(r[i].h)) {
                s.delete(r[i].h);
            }
        }
        p.push(...s);

        if (p.length) {
            await api.tree(p);
        }
    }
    return r || [];
};

// invokes getbykey in chunked mode
FMDB.prototype.getchunk = async function(table, options, onchunk) {
    'use strict';
    if (typeof options === 'function') {
        onchunk = options;
        options = Object.create(null);
    }
    options.limit = options.limit || 1e4;

    var mng = options.offset === undefined;
    if (mng) {
        options.offset = -options.limit;
    }

    while (true) {
        if (mng) {
            options.offset += options.limit;
        }
        const {limit} = options;
        const r = await this.getbykey(table, options);

        if (onchunk(r) === false) {
            return EAGAIN;
        }

        if (r.length < limit) {
            break;
        }
    }
};

// simple/fast/non-recursive object cloning
FMDB.prototype.clone = function fmdb_clone(o) {
    'use strict';

    o = {...o};

    if (!o.d || 'byteLength' in o.d) {

        for (const k in o) {

            if (o[k] && o[k].byteLength) {

                o[k] = o[k].slice(0);
            }
        }
    }

    return o;
};

/**
 * Encrypt 32-bit words using AES ECB...
 * @param {sjcl.cipher.aes} cipher AES cipher
 * @param {TypedArray} input data
 * @returns {ArrayBuffer} encrypted data
 * @private
 */
FMDB.prototype._crypt = function(cipher, input) {
    'use strict';
    var a32 = new Int32Array(input.buffer);
    var i32 = new Int32Array(a32.length + 3 & ~3);
    for (var i = 0; i < a32.length; i += 4) {
        var u = cipher.encrypt([a32[i], a32[i + 1], a32[i + 2], a32[i + 3]]);
        i32[i] = u[0];
        i32[i + 1] = u[1];
        i32[i + 2] = u[2];
        i32[i + 3] = u[3];
    }
    return i32.buffer;
};

/**
 * Decrypt 32-bit words using AES ECB...
 * @param {sjcl.cipher.aes} cipher AES cipher
 * @param {ArrayBuffer} buffer Encrypted data
 * @returns {ArrayBuffer} decrypted data
 * @private
 */
FMDB.prototype._decrypt = function(cipher, buffer) {
    'use strict';
    var u32 = new Uint32Array(buffer);
    for (var i = 0; i < u32.length; i += 4) {
        var u = cipher.decrypt([u32[i], u32[i + 1], u32[i + 2], u32[i + 3]]);
        u32[i + 3] = u[3];
        u32[i + 2] = u[2];
        u32[i + 1] = u[1];
        u32[i] = u[0];
    }
    return u32.buffer;
};

/**
 * Converts UTF-8 string to Unicode
 * @param {ArrayBuffer} buffer Input buffer
 * @returns {String} Unicode string.
 */
FMDB.prototype.from8 = function(buffer) {
    'use strict';

    var idx = 0;
    var str = '';
    var ptr = new Uint8Array(buffer);
    var len = ptr.byteLength;
    while (len > idx) {
        var b = ptr[idx++];
        if (!b) {
            return str;
        }
        if (!(b & 0x80)) {
            str += String.fromCharCode(b);
            continue;
        }

        var l = ptr[idx++] & 63;
        if ((b & 0xE0) === 0xC0) {
            str += String.fromCharCode((b & 31) << 6 | l);
            continue;
        }

        var h = ptr[idx++] & 63;
        if ((b & 0xF0) === 0xE0) {
            b = (b & 15) << 12 | l << 6 | h;
        }
        else {
            b = (b & 7) << 18 | l << 12 | h << 6 | ptr[idx++] & 63;
        }

        if (b < 0x10000) {
            str += String.fromCharCode(b);
        }
        else {
            var ch = b - 0x10000;
            str += String.fromCharCode(0xD800 | ch >> 10, 0xDC00 | ch & 0x3FF);
        }
    }

    return str;
};

/**
 * Converts Unicode string to UTF-8
 * @param {String} str Input string
 * @param {Number} [len] bytes to allocate
 * @returns {Uint8Array} utf-8 bytes
 */
FMDB.prototype.to8 = function(str, len) {
    'use strict';
    var p = 0;
    var u8 = new Uint8Array((len || this.utf8length(str)) + 3 & ~3);

    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u > 55295 && u < 57344) {
            u = 0x10000 + ((u & 0x3FF) << 10) | str.charCodeAt(++i) & 0x3FF;
        }
        if (u < 128) {
            u8[p++] = u;
        }
        else if (u < 2048) {
            u8[p++] = 0xC0 | u >> 6;
            u8[p++] = 0x80 | u & 63;
        }
        else if (u < 65536) {
            u8[p++] = 0xE0 | u >> 12;
            u8[p++] = 0x80 | u >> 6 & 63;
            u8[p++] = 0x80 | u & 63;
        }
        else {
            u8[p++] = 0xF0 | u >> 18;
            u8[p++] = 0x80 | u >> 12 & 63;
            u8[p++] = 0x80 | u >> 6 & 63;
            u8[p++] = 0x80 | u & 63;
        }
    }
    return u8;
};

/**
 * Calculate the length required for Unicode to UTF-8 conversion
 * @param {String} str Input string.
 * @returns {Number} The length
 */
FMDB.prototype.utf8length = function(str) {
    'use strict';

    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u > 55295 && u < 57344) {
            u = 0x10000 + ((u & 0x3FF) << 10) | str.charCodeAt(++i) & 0x3FF;
        }
        if (u < 128) {
            ++len;
        }
        else if (u < 2048) {
            len += 2;
        }
        else if (u < 65536) {
            len += 3;
        }
        else {
            len += 4;
        }
    }
    return len;
};

/**
 * Check for needle into haystack
 * @param {Array} haystack haystack
 * @param {String|ArrayBuffer} needle needle
 * @returns {Boolean} whether is found.
 */
FMDB.prototype.exists = function(haystack, needle) {
    'use strict';
    for (var i = haystack.length; i--;) {
        if (this.equal(haystack[i], needle)) {
            return true;
        }
    }
    return false;
};

/**
 * Check whether two indexedDB-stored values are equal.
 * @param {ArrayBuffer} a1 first item to compare
 * @param {ArrayBuffer} a2 second item to compere
 * @returns {Boolean} true if both are deep equal
 */
FMDB.prototype.equal = function(a1, a2) {
    'use strict';
    const len = a1.byteLength;

    if (len === a2.byteLength) {
        a1 = new Uint8Array(a1);
        a2 = new Uint8Array(a2);

        let i = 0;
        while (i < len) {
            if (a1[i] !== a2[i]) {
                return false;
            }
            ++i;
        }

        return true;
    }

    return false;
};

/**
 * Check whether two indexedDB-stored values are equal.
 * @param {String} a1 first item to compare
 * @param {String} a2 second item to compere
 * @returns {Boolean} true if both are deep equal
 */
FMDB.prototype.equals = function(a1, a2) {
    'use strict';
    return a1 === a2;
};

/**
 * Validate store-ready entry
 * @param {Object} entry An object
 * @returns {Boolean} whether it is..
 * @private
 */
FMDB.prototype._raw = function(entry) {
    'use strict';
    return entry.d && entry.d.byteLength === undefined;
};

/**
 * Get raw value for encrypted record.
 * @param {String|ArrayBuffer} value Input
 * @returns {String} raw value
 * @private
 */
FMDB.prototype._value = function(value) {
    'use strict';

    if (value instanceof ArrayBuffer) {
        value = this.fromStore(value.slice(0));
    }

    return value;
};

/**
 * store-agnostic value comparison.
 * @param {String} table The DB table
 * @param {String} key The row index.
 * @param {String|ArrayBuffer} value item to compare (always encrypted)
 * @param {Object} store Store containing key. (*may* not be encrypted)
 * @returns {Boolean} true if both are deep equal
 */
FMDB.prototype.compare = function(table, key, value, store) {
    'use strict';
    let eq = store[key];

    if (this._raw(store)) {

        if (!this._cache[eq]) {
            this._cache[eq] = this.toStore(eq);
        }
        eq = this._cache[eq];
    }

    return this.equal(value, eq);
};

/**
 * indexedDB data serialization.
 * @param {String} data Input string
 * @returns {*|String} serialized data (as base64, unless we have binary keys support)
 */
FMDB.prototype.toStore = function(data) {
    'use strict';
    return ab_to_base64(this.strcrypt(data));
};

/**
 * indexedDB data de-serialization.
 * @param {TypedArray|ArrayBuffer|String} data Input data
 * @returns {*} de-serialized data.
 */
FMDB.prototype.fromStore = function(data) {
    'use strict';
    return this.strdecrypt(base64_to_ab(data));
};

// convert to encrypted-base64
FMDB.prototype.toB64 = FMDB.prototype.toStore;
// convert from encrypted-base64
FMDB.prototype.fromB64 = FMDB.prototype.fromStore;

if (FMDB.$useBinaryKeys) {
    FMDB.prototype.toStore = FMDB.prototype.strcrypt;
    FMDB.prototype.fromStore = FMDB.prototype.strdecrypt;
}
else {
    FMDB.prototype.equal = FMDB.prototype.equals;

    if (!FMDB.$usePostSerialz) {
        FMDB.prototype.compare = FMDB.prototype.equal;
        console.warn('Fix FMDB._value()....');
    }
}

if (!FMDB.$usePostSerialz) {
    FMDB.prototype.add = function fmdb_adds(table, row) {
        'use strict';
        if (!this.crashed) {
            this.enqueue(table, this.serialize(table, row), 0);
        }
    };
    FMDB.prototype.del = function fmdb_dels(table, index) {
        "use strict";
        if (!this.crashed) {
            this.enqueue(table, this.toStore(index), 1);
        }
    };
}

// @private
FMDB.prototype._bench = function(v, m) {
    'use strict';
    var i;
    var a = Array(1e6);
    var s =
        '\u0073\u0061\u006d\u0070\u006c\u0065\u0020\u0074\u0072\u0061\u006e\u0073\u006c\u0061' +
        '\u0074\u0065\u003a\u0020\u5c11\u91cf\u002c\u0020\u6837\u54c1\u002c\u0020\uff08\u533b' +
        '\u751f\u6216\u79d1\u5b66\u5bb6\u68c0\u6d4b\u7528\u7684\uff09\u6837\u672c\uff0c\u8bd5';

    s = typeof v === 'string' ? v : v && JSON.stringify(v) || s;

    var enc = 'strcrypt' + (m === undefined ? '' : m);
    var dec = 'strdecrypt' + (m === undefined ? '' : m);

    onIdle(function() {
        console.time(enc);
        for (i = a.length; i--;) {
            a[i] = fmdb[enc](s);
        }
        console.timeEnd(enc);
    });

    onIdle(function() {
        console.time(dec);
        for (i = a.length; i--;) {
            fmdb[dec](a[i]);
        }
        console.timeEnd(dec);
    });

    onIdle(function() {
        console.assert(m !== undefined || fmdb.from8(a[1]).split('\0')[0] === s);
        console.groupEnd();
    });
    console.group('please wait...');
};


// reliably invalidate the current database (delete the sn)
FMDB.prototype.invalidate = promisify(function(resolve, reject, readop) {
    'use strict';

    if (d) {
        console.group(' *** invalidating fmdb *** ', this.crashed);
        console.trace();
    }

    if (this.crashed) {
        return resolve();
    }

    var channels = Object.keys(this.pending);

    // erase all pending data
    for (var i = channels.length; i--;) {
        this.head[i] = 0;
        this.tail[i] = 0;
        this.pending[i] = [];
    }
    this._cache = Object.create(null);

    // clear the writing flag for the next del() call to pass through
    this.writing = null;

    // enqueue the final _sn deletion that will mark the DB as invalid
    this.del('_sn', 1);

    // prevent further reads or writes
    this.crashed = readop ? 2 : 1;

    // timeout invalidation process if it does not complete in a timely manner...
    let timer;
    (timer = tSleep(9))
        .then(() => {
            this.logger.error('FMDB invalidation timed out, moving on...');
            tryCatch(() => this.inval_cb())();
            return tSleep(2).then(resolve);
        })
        .catch(dump);

    // set completion callback
    this.inval_cb = function() {
        // XXX: Just invalidating the DB may causes a timeout trying to open it on the next page load, since we
        // do attempt to delete it when no sn is found, which would take a while to complete for large accounts.
        // This is currently the 20% of hits we do receive through 99724 so from now on we will hold the current
        // session until the DB has been deleted.
        if (readop || !this.db) {
            onIdle(resolve);
        }
        else {
            this.db.delete().finally(resolve);
        }

        this.pending = [[]];
        mLoadingSpinner.hide('fmdb');

        if (d) {
            console.groupEnd();
        }

        if (timer) {
            timer.abort();
            timer = null;
        }
    };
});


function mDBcls() {
    if (fmdb && fmdb.db) {
        fmdb.db.close();
    }
    fmdb = null;
}


// --------------------------------------------------------------------------

/**
 * Wrapper around Dexie that remembers and removes deprecated databases.
 * @param {String} aUniqueID Unique Identified for this database.
 * @see {@link MegaDexie.getDBName} for additional parameters.
 * @details as part of this constructor, {aPayLoad} must be the schema if provided.
 * @constructor
 */
class MegaDexie extends Dexie {
    constructor(aUniqueID, ...args) {
        const dbname = MegaDexie.getDBName(...args);
        super(dbname, {chromeTransactionDurability: 'relaxed'});

        this.__dbUniqueID = this.__fromUniqueID(aUniqueID + args[0]);
        this.__rememberDBName(dbname);

        if (args[3]) {
            // Schema given.
            this.version(1).stores(args[3]);
        }

        if (d) {
            this._uname = args[0];
        }

        const b = (this.__dbUniqueID & 0xdf).toString(16);
        this.logger = new MegaLogger(() => `${this[Symbol.toStringTag]}(${this})`, {
            levelColors: {
                ERROR: `#${b}2222`,
                DEBUG: `#4444${b}`,
                WARN: `#${b}${b}33`,
                INFO: `#00${b}00`,
                LOG: '#444'
            }
        });

        this.onerror = null;
        Object.defineProperty(this, '__bulkPutQueue', {value: Object.create(null)});
        Object.defineProperty(this, '__ident_0', {value: `megadexie.${this.__dbUniqueID}-${++mIncID}`});
    }

    get [Symbol.toStringTag]() {
        return 'MegaDexie';
    }

    toString() {
        return String(this._uname || this.name || this.__ident_0);
    }

    put(table, data) {

        if (this.__bulkPutQueue[table]) {

            // @todo deduplicate? benchmark!
            this.__bulkPutQueue[table].push(data);
        }
        else {
            this.__bulkPutQueue[table] = [data];
            Object.defineProperty(this.__bulkPutQueue[table], 'promise', {value: mega.promise});
        }

        delay(this.__ident_0 + table, () => {
            const queue = this.__bulkPutQueue[table];
            delete this.__bulkPutQueue[table];

            if (!(queue && queue.length)) {
                this.logger.assert(false, 'invalid queue state.', queue);
                return;
            }

            if (d) {
                this.logger.debug(`Storing ${queue.length} entries...`);
            }

            const release = (res, error) => {
                queue.length = 0;
                queue.promise[error ? 'reject' : 'resolve'](error || res);
            };

            this.fireOperationPromise(() => this[table].bulkPut(queue).then(release))
                .catch((ex) => {
                    let res = 0;
                    let failure = new MEGAException(ex.inner || ex, this, ex.name);

                    if (this.onerror) {
                        res = this.onerror(ex);
                        if (res) {
                            failure = null;
                        }
                    }

                    this.error = ex;
                    return release(res, failure);
                });
        }, 911);

        return this.__bulkPutQueue[table].promise;
    }

    async fireOperationPromise(aOperationCallback) {

        return aOperationCallback()
            .catch(async(ex) => {
                if (d) {
                    this.logger.error(ex);
                }

                if (ex.name === 'DatabaseClosedError') {
                    // eslint-disable-next-line local-rules/open
                    const res = await this.open().then(aOperationCallback);

                    if (d) {
                        this.logger.info('DB closed unexpectedly and re-opened, resuming operation...', res);
                    }
                    return res;
                }

                throw ex;
            });
    }

    async export() {
        return MegaDexie.export(this);
    }

    async import(blob) {
        return MegaDexie.import(blob, this);
    }

    static async import(aFile, aDBInstance) {
        const buf = aFile.name.endsWith('.gz') ? await M.decompress(aFile) : await M.toArrayBuffer(aFile);
        const len = buf.byteLength;
        assert(len > 0x10000);

        const view = new DataView(buf);
        assert(view.getUint32(0) === 0x13064D44, 'Invalid file.');
        assert(view.getUint8(len - 17) === 0xEF, 'File corrupted(?)');

        let offset = 8;
        const tde = new TextDecoder();
        const readValue = () => {
            const b = view.getUint8(offset);
            const l = b >> 4;
            const t = b & 15;

            const size = view[`getUint${l << 3}`](++offset, true);
            offset += l;

            let data = buf.slice(offset, offset + size);
            if (t > 1) {
                data = tde.decode(data);

                switch (t) {
                    case 2:
                        data = parseInt(data, 36);
                        break;
                    case 4:
                        data = JSON.parse(data);
                        break;
                }
            }

            offset += size;
            return data;
        };
        const settings = readValue();
        assert('schema' in settings);

        const key = [
            view.getInt32(len - 16, true),
            view.getInt32(len - 12, true),
            view.getInt32(len - 8, true),
            view.getInt32(len - 4, true)
        ];
        const {u_k: uk1, u_k_aes: uk2} = window;
        const keyMatch = JSON.stringify(uk1) === JSON.stringify(key);

        if (aDBInstance) {
            // @todo re-encrypt'em(?)
            assert(keyMatch, 'Key mismatch, cannot import.');
        }
        else {
            if (!keyMatch) {
                u_k = key;
                u_k_aes = new sjcl.cipher.aes(u_k);
            }
            const name = `DBImport${Math.random().toString(36)}`;

            if (settings.schema.lru) {
                // eslint-disable-next-line no-use-before-define
                aDBInstance = await LRUMegaDexie.create(name);
            }
            else {
                aDBInstance = new MegaDexie('DBIMPORT', name, 'imp_', true, settings.schema);
            }

            if (!keyMatch) {
                u_k = uk1;
                u_k_aes = uk2;
            }
        }

        offset = 0x10000;
        while (view.getUint8(offset) !== 0xEF) {
            const bulk = [];
            const table = readValue();

            while (view.getUint8(offset) !== 0xFF) {
                const data = {};

                while (view.getUint8(offset) !== 0xFE) {
                    const key = readValue();
                    data[key] = readValue();
                }

                offset++;
                bulk.push(data);
            }

            offset++;
            await aDBInstance[table].bulkPut(bulk);
        }

        return aDBInstance;
    }

    static async export(aDBInstance) {
        let offset = 0;
        let buf = new Uint8Array(0x1000000);
        const tde = new TextEncoder();
        const gbl = (n) => n < 256 ? 1 : n < 65536 ? 2 : 4;
        const rnd = (s, b = 0x100000) => (s + b & -b) >>> 0;
        const types = {buffer: 1, number: 2, string: 3, object: 4};
        const put = (data, offset) => {
            if (typeof data === 'number') {
                data = new window[`Uint${gbl(data) << 3}Array`]([data]);
            }
            if (offset + data.byteLength > buf.byteLength) {
                const tmp = new Uint8Array(rnd(buf.byteLength + data.byteLength));
                tmp.set(buf);
                buf = tmp;
            }
            buf.set(new Uint8Array(data.buffer || data), offset);
            return offset + data.byteLength;
        };
        const add = (data, pos) => {
            let t = data.byteLength >= 0 ? 'buffer' : typeof data;
            if (t !== 'buffer') {
                if (t === 'number') {
                    data = data.toString(36);
                }
                else if (t !== 'string') {
                    t = 'object';
                    data = JSON.stringify(data);
                }
                data = tde.encode(data);
            }

            const j = gbl(data.byteLength);
            const p = put(data, put(data.byteLength, put(j << 4 | types[t], pos || offset)));
            if (!pos) {
                offset = p;
            }
        };

        add('MDBv01');
        offset = 0x10000;

        const {tables} = aDBInstance;
        const schema = Object.create(null);

        assert(aDBInstance instanceof Dexie && tables.length);

        for (let i = 0; i < tables.length; ++i) {
            const s = [];
            const table = tables[i];
            const {db, name, schema: {primKey, indexes = false}} = table;

            if (primKey) {
                s.push(primKey.unique ? `&${primKey.name}` : primKey.src);
            }
            if (indexes.length) {
                s.push(...indexes.map((i) => i.src));
            }

            add(name);
            schema[name] = s.join(', ');

            const res = await db[name].toArray();
            for (let i = res.length; i--;) {
                const e = res[i];

                for (const k in e) {
                    add(k);
                    add(e[k]);
                }

                put(0xfe, offset++);
            }

            put(0xff, offset++);
        }

        add({schema}, 8);
        buf = buf.slice(0, put(new Uint32Array(u_k), put(0xef, offset)));

        const {_uname, name} = aDBInstance;
        const data = await M.compress(buf).catch(nop);
        const filename = `mega-dbexport.${_uname || name || aDBInstance}`;

        return M.saveAs(data || buf, data ? `${filename}.gz` : filename);
    }
}

/**
 * Helper to create common database names.
 * @param {String} aName The main name.
 * @param {String} [aIdent] Identity (added to the db name as-is)
 * @param {Boolean} [aTagUser] Whether this database is user-specific
 * @param {*} [aPayload] Some serializable data to randomize the db name
 * @param {*} [aPersistent] Whether this database is persistent, true by default.
 * @returns {String} encrypted database name
 */
MegaDexie.getDBName = function(aName, aIdent, aTagUser, aPayload, aPersistent) {
    'use strict';
    if (typeof u_k_aes === 'undefined') {
        if (window.u_k) {
            throw new Error('Invalid account state.');
        }
        window.u_k_aes = new sjcl.cipher.aes(str_to_a32('' + ua).slice(-4));
        console.warn('MegaDexie.getDBName: Adding temporal key for non-logged user.');
    }
    var pex = aPersistent === false ? '' : FMDB.perspex;
    aPayload = aPayload && MurmurHash3(JSON.stringify(aPayload)).toString(16) || '';
    return (aIdent || '') + FMDB.prototype.toB64(aPayload + aName + (aTagUser ? u_handle : '')) + pex;
};

/**
 * The missing Dexie.bulkUpdate
 * @param {String} [table] Optional Dexie table
 * @param {Array} bulkData Bulk data
 * @returns {Promise} promise
 */
MegaDexie.prototype.bulkUpdate = promisify(function(resolve, reject, table, bulkData) {
    'use strict';

    if (typeof table !== 'string') {
        bulkData = table;
        table = this.tables;
        table = table.length === 1 && table[0].name;
    }

    if (!bulkData.length) {
        return resolve(bulkData);
    }
    table = this.table(table);

    var i;
    var keyPath;
    var anyOf = [];
    var schema = table.schema;
    var indexes = schema.indexes;

    for (i = 0; i < indexes.length; ++i) {
        if (indexes[i].unique) {
            keyPath = indexes[i].keyPath;
            break;
        }
    }

    for (i = bulkData.length; i--;) {
        var v = bulkData[i][keyPath || schema.primKey.keyPath];

        if (FMDB.prototype.exists(anyOf, v)) {
            bulkData.splice(i, 1);
        }
        else {
            anyOf.push(v);
        }
    }

    (keyPath ? table.where(keyPath).anyOf(anyOf).toArray() : table.bulkGet(anyOf))
        .then(function(r) {
            var toUpdate = [];

            keyPath = keyPath || schema.primKey.keyPath;
            for (var i = r.length; i--;) {
                for (var j = r[i] && bulkData.length; j--;) {
                    if (FMDB.prototype.equal(r[i][keyPath], bulkData[j][keyPath])) {
                        delete bulkData[j][keyPath];
                        toUpdate.push([r[i], bulkData.splice(j, 1)[0]]);
                        break;
                    }
                }
            }

            var tasks = toUpdate.map(function(u) {
                return table.where(":id").equals(u[0][schema.primKey.keyPath]).modify(u[1]);
            });
            if (bulkData.length) {
                tasks.push(table.bulkPut(bulkData));
            }
            return Promise.all(tasks);
        })
        .then(resolve)
        .catch(reject);
});

/**
 * Remember newly opened database.
 * @param {String} aDBName The database being opened.
 * @returns {void}
 * @private
 */
MegaDexie.prototype.__rememberDBName = function(aDBName) {
    'use strict';
    var aUniqueID = this.__dbUniqueID;

    MegaDexie.__knownDBNames.get(aUniqueID)
        .then(function(s) {
            if (s) {
                if (s.v === aDBName) {
                    return;
                }
                Dexie.delete(s.v).then(nop).catch(dump);
            }
            return MegaDexie.__knownDBNames.put({k: aUniqueID, t: Date.now() - 1589e9, v: aDBName});
        })
        .catch(nop);

    this.__checkStaleDBNames();
};

/**
 * Forget database.
 * @returns {void}
 * @private
 */
MegaDexie.prototype.__forgetDBName = function() {
    'use strict';
    MegaDexie.__knownDBNames.delete(this.__dbUniqueID).then(nop).catch(dump);
};

MegaDexie.prototype.__checkStaleDBNames = function() {
    'use strict';

    if (MegaDexie.__staleDBsChecked) {
        return;
    }

    var canQueryDatabases = typeof Object(window.indexedDB).databases === 'function';
    MegaDexie.__staleDBsChecked = canQueryDatabases ? true : -1;

    if (canQueryDatabases) {
        tSleep(40).then(() => {
            var databases = [];

            if (d) {
                console.debug('Checking stale databases...');
            }

            Promise.resolve(indexedDB.databases())
                .then(function(r) {
                    for (var i = r.length; i--;) {
                        console.assert(r[i].name);
                        if (r[i].name) {
                            databases.push(r[i].name);
                        }
                    }

                    return databases.length ? MegaDexie.__knownDBNames.toArray() : Promise.resolve([]);
                })
                .then(function(r) {
                    var stale = [];

                    for (var i = r.length; i--;) {
                        if (databases.indexOf(r[i].v) < 0) {
                            if (d) {
                                console.warn('Found stale database...', r[i].v);
                            }
                            stale.push(r[i].k);
                        }
                    }

                    if (stale.length) {
                        MegaDexie.__knownDBNames.bulkDelete(stale).then(nop).catch(dump);
                    }
                    else {
                        console.debug('Yay, no stale databases found.');
                    }
                })
                .catch(nop);
        });
    }
};

/**
 * Hash unique identifier
 * @param {Number|String} aUniqueID Unique Identifier for database.
 * @returns {Number} hash
 * @private
 */
MegaDexie.prototype.__fromUniqueID = function(aUniqueID) {
    'use strict';
    return MurmurHash3('mega' + aUniqueID + window.u_handle, -0x9fffee);
};

/**
 * Deletes the database.
 * @returns {Promise} promise
 */
MegaDexie.prototype.delete = function() {
    'use strict';
    this.__forgetDBName();
    return Dexie.prototype.delete.apply(this, arguments);
};

/**
 * Open the database.
 * @returns {Promise} promise
 */
MegaDexie.prototype.open = function() {
    'use strict';
    this.__rememberDBName(this.name);
    return Dexie.prototype.open.apply(this, arguments);
};

/**
 * @name __knownDBNames
 * @memberOf MegaDexie
 */
lazy(MegaDexie, '__knownDBNames', function() {
    'use strict';
    var db = new Dexie('$kdbn', {addons: []});
    db.version(1).stores({k: '&k'});
    return db.table('k');
});

/**
 * @name getDatabaseNames
 * @memberOf MegaDexie
 */
lazy(MegaDexie, 'getDatabaseNames', () => {
    'use strict';
    if (typeof Object(window.indexedDB).databases === 'function') {
        return async() => {
            const dbs = await indexedDB.databases();
            return dbs.map(obj => obj.name);
        };
    }
    return async() => {
        const dbs = await MegaDexie.__knownDBNames.toArray();
        return dbs.map(obj => obj.v);
    };
});

/**
 * Creates a new database layer, which may change at anytime, and thus with
 * the only assertion the instance returned will have set/get/remove methods
 * @param {String} name Database name.
 * @param {Boolean|Number} binary mode
 * @returns {*} database instance.
 */
MegaDexie.create = function(name, binary) {
    'use strict';
    binary = binary && SharedLocalKVStorage.DB_MODE.BINARY;
    return new SharedLocalKVStorage.Utils.DexieStorage('mdcdb:' + name, binary);
};

// --------------------------------------------------------------------------

class LRUMegaDexie extends MegaDexie {
    constructor(name, options = 4e3) {
        options = typeof options === 'number' ? {limit: options} : options;

        super('LRUMMDB', name, options.pfx || 'lru_', true, {
            lru: '&k',
            data: '&h, ts'
        });

        this.options = options;

        if (LRUMegaDexie.wSet) {
            LRUMegaDexie.wSet.add(this);
        }

        LRUMegaDexie.hookErrorHandlers(this);
    }

    get [Symbol.toStringTag]() {
        return 'LRUMegaDexie';
    }

    async setup(options = false, key = null) {

        if (key) {
            const algo = {
                ...key.algorithm,
                tagLength: 32,
                iv: options.iv || new Uint32Array(u_k_aes._key[0].slice(4, 7))
            };
            const view = new DataView(algo.iv.buffer);
            let ctr = Math.random() * 0x1000000 >>> 0;

            Object.defineProperties(this, {
                encrypt: {
                    value: async(data) => {
                        view.setUint32(0, ++ctr, true);
                        const encrypted = new Uint8Array(data.byteLength + 8);
                        const payload = new DataView(encrypted.buffer, 0, 4);
                        payload.setUint32(0, ctr, true);
                        algo.additionalData = payload;
                        encrypted.set(new Uint8Array(await crypto.subtle.encrypt(algo, key, data)), 4);
                        return encrypted.buffer;
                    }
                },
                decrypt: {
                    value: async(data) => {
                        const payload = new DataView(data, 0, 4);
                        const ctr = payload.getUint32(0, true);
                        view.setUint32(0, ctr, true);
                        algo.additionalData = payload;
                        return crypto.subtle.decrypt(algo, key, new DataView(data, 4))
                            .catch((ex) => {
                                const msg = `LRUMegaDexie(${this}) decrypt error: ${ex.message || ex.name}`;
                                throw new MEGAException(msg, ex, ex.name || 'DataCloneError');
                            });
                    }
                }
            });
        }

        return this.update(options);
    }

    async update(options) {
        this.options = Object.assign({}, (await this.lru.get('options') || {}).value, this.options, options);

        delete this.options.iv;
        const promises = [this.lru.put({k: 'options', value: Object.setPrototypeOf(this.options, null)})];

        for (const k in this.options) {
            promises.push(this.lru.put({k, value: this.options[k]}));
        }

        this.drain();
        await Promise.all(promises);
        return this;
    }

    async find(h) {
        return this.data.exists(h);
    }

    async has(h) {
        return !!await this.find(h);
    }

    async get(h) {
        // @todo FIXME improve Collection.modify() to NOT retrieve WHOLE rows
        // const coll = this.data.where('h').equals(h);
        // const {data} = await coll.first() || false;
        // return data && (await Promise.all([coll.modify({ts: Date.now()}), this.decrypt(data)]))[1];

        const {data} = await this.data.get(h) || false;
        if (data) {
            this.put('data', {h, data, ts: Date.now()}).catch(dump);
            return this.decrypt(data);
        }
    }

    async set(h, data) {
        assert(data.byteLength > 16);
        data = await this.encrypt(data);
        delay(this.name, () => this.drain(), 4e3);
        return this.put('data', {h, data, ts: Date.now()});
    }

    async bulkGet(bulk, err = {}) {
        const now = Date.now();
        const res = Object.create(null);

        if (bulk) {
            bulk = await this.fireOperationPromise(() => this.data.bulkGet(bulk));
        }
        else {
            bulk = await this.fireOperationPromise(() => this.data.orderBy('ts').toArray());
        }

        for (let i = bulk.length; i--;) {
            const e = bulk[i];

            if (e) {
                const value = await this.decrypt(e.data)
                    .catch((ex) => {
                        err[e.h] = {ts: new Date(e.ts).toISOString(), bytes: e.data.byteLength, ex};
                    });

                if (value) {
                    e.ts = now;
                    res[e.h] = value;
                    continue;
                }
            }

            bulk.splice(i, 1);
        }


        if (d && $.len(err)) {
            console.group(`LRUMegaDexie.bulkGet(${this}) errors found...`);
            console.table(err);
            console.groupEnd();
        }

        this.data.bulkPut(bulk)
            .catch((ex) => {
                if (d) {
                    console.warn(`${this}: ${ex}`, ex);
                }
                return bulk.map((e) => this.put('data', e));
            });

        return res;
    }

    drain() {
        this.data.count()
            .then(count => count > this.options.limit && this.data.orderBy('ts').limit(count / 10 | 1).primaryKeys())
            .then(keys => keys && this.data.bulkDelete(keys))
            .catch(dump);
    }

    encrypt(data) {
        return data;
    }

    decrypt(data) {
        return data;
    }
}

/** @property LRUMegaDexie.create */
lazy(LRUMegaDexie, 'create', () => {
    'use strict';
    const parity = lazy(Object.create(null), 'key', () => {
        return crypto.subtle.importKey(
            "raw",
            new Uint32Array(u_k_aes._key[0].slice(0, 4)),
            {name: "AES-GCM"},
            false,
            ["encrypt", "decrypt"]
        );
    });

    const extend = (obj) => {
        if (obj instanceof LRUMap) {
            const {get, set} = obj;

            Object.defineProperties(obj, {
                get: {
                    value: async function(...args) {
                        return get.apply(this, args);
                    }
                },
                bulkGet: {
                    value: async function(bulk) {
                        return bulk.reduce((target, e) => {
                            const value = get.call(this, e);
                            if (value) {
                                target[e] = value;
                            }
                            return target;
                        }, Object.create(null));
                    }
                },
                set: {
                    value: async function(...args) {
                        return set.apply(this, args);
                    }
                },
                find: {
                    value: async function(keys) {
                        const res = [];
                        for (let i = keys.length; i--;) {
                            if (this.has(keys[i])) {
                                res.push(keys[i]);
                            }
                        }
                        return res;
                    }
                }
            });
        }

        return obj;
    };

    return async(name, options) => {
        const db = await new LRUMegaDexie(name, options).setup(options, await parity.key).catch(dump);
        if (d && !db) {
            console.warn('LRU cannot be backed by DB, using memory-only instead...', name);
        }
        return extend(db || new LRUMap(Math.max(256, (options && options.limit || options) >> 3)));
    };
});

Object.defineProperties(LRUMegaDexie, {
    wSet: {
        value: self.d > 0 && new IWeakSet()
    },
    errorHandler: {
        value: (ev) => {
            'use strict';
            const dbname = ev.target && ev.target.name || 'unk';
            const message = String(((ev.target || ev).error || ev.inner || ev).message || ev.type || ev);

            if (d) {
                console.warn(`LRUMegaDexie(${dbname}) error:${ev.type || ev.name}`, message, [ev]);
            }

            if (ev.type !== 'close' && !/\s(?:clos[ei]|delet[ei])/.test(message)) {
                eventlog(99748, message.split('\n')[0].substr(0, 300), true);
            }

            // drop all LRU-based databases.
            LRUMegaDexie.drop().catch(dump);
        }
    },
    hookErrorHandlers: {
        value: (lru) => {
            'use strict';
            if (!lru.idbdb) {
                return lru.on('ready', () => LRUMegaDexie.hookErrorHandlers(lru));
            }
            const {onabort, onerror} = lru.idbdb;

            lru.idbdb.onabort = lru.idbdb.onerror = (ev) => {
                LRUMegaDexie.errorHandler(ev);
                return ev.type === 'abort' ? onabort && onabort(ev) : onerror && onerror(ev);
            };

            lru.on('close', lru.onerror = LRUMegaDexie.errorHandler);
        }
    },
    drop: {
        value: async() => {
            'use strict';
            const dbs = await MegaDexie.getDatabaseNames();
            return Promise.all(dbs.filter(n => n.startsWith('lru_')).map(n => Dexie.delete(n)));
        }
    },
    verify: {
        value: async() => {
            'use strict';
            const stats = {};

            for (const db of LRUMegaDexie.wSet) {
                const err = {};
                const res = await db.bulkGet(0, err);
                const nid = `${db.name} (${db._uname})`;
                const ecn = $.len(err);
                const cnt = $.len(res) + ecn;

                let bytes = 0;
                let errors = 0;

                if (ecn) {
                    bytes = Object.values(err)
                        .reduce((n, o) => {
                            n += o.bytes;
                            return n;
                        }, 0);
                    errors = `${ecn} (${parseFloat(ecn * 100 / cnt).toFixed(2)}%, ${bytesToSize(bytes)})`;
                }

                for (const k in res) {
                    bytes += res[k].byteLength;
                }

                if (bytes > 1e6) {
                    bytes = `${bytes} (${bytesToSize(bytes)})`;
                }
                stats[nid] = {bytes, records: cnt, errors};
            }
            console.table(stats);
        }
    },
    size: {
        get() {
            'use strict';
            const {promise} = mega;

            let name;
            const seen = {total: {bytes: 0}};
            const store = (row) => {
                const {byteLength} = row.data;
                seen[name].bytes += byteLength;
                seen.total.bytes += byteLength;
            };

            (async(obj) => {
                for (const db of obj) {
                    name = `${db.name} (${db._uname})`;
                    seen[name] = {bytes: 0};
                    await db.data.each(store);
                }
                console.table(seen);
                promise.resolve(seen.total);
            })(LRUMegaDexie.wSet);

            return promise;
        }
    }
});

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------

/**
 * Helper functions to retrieve nodes from indexedDB.
 * @name dbfetch
 * @memberOf window
 */
Object.defineProperty(self, 'dbfetch', (function() {
    'use strict';
    const node_inflight = new Set();
    const tree_inflight = Object.create(null);

    const getNode = (h, cb) => {
        if (M.d[h]) {
            return cb(M.d[h]);
        }
        fmdb.getbykey('f', 'h', ['h', [h]])
            .always(function(r) {
                if (r.length) {
                    emplacenode(r[0], true);
                }
                cb(M.d[h]);
            });

    };

    const emplace = (r, noc) => {
        for (let i = r.length; i--;) {
            emplacenode(r[i], noc);
        }
    };

    const showLoading = (h) => {
        $.dbOpenHandle = h;
        document.documentElement.classList.add('wait-cursor');
    };
    const hideLoading = (h) => {
        if ($.dbOpenHandle === h) {
            $.dbOpenHandle = false;
            document.documentElement.classList.remove('wait-cursor');
        }
    };

    const dbfetch = Object.assign(Object.create(null), {
        /**
         * Retrieve root nodes only, on-demand node loading mode.
         * or retrieve whole 'f' table in chunked mode.
         * @returns {Promise} fulfilled on completion
         * @memberOf dbfetch
         */
        async init() {

            if (M.RootID || !mBroadcaster.crossTab.owner) {
                // fetch the whole cloud on slave tabs..
                return M.RootID || fmdb.get('f', (res) => emplace(res));
            }

            // fetch the three root nodes
            const r = await fmdb.getbykey('f', 'h', ['s', ['-2', '-3', '-4']]);

            emplace(r);
            if (!r.length || !M.RootID) {
                if (sessionStorage.dbcrpt) {
                    delete sessionStorage.dbcrpt;
                    throw new Error('indexedDB corruption!');
                }

                if (d) {
                    console.warn('Force-reloading due to indexedDB corruption...', r);
                }
                sessionStorage.dbcrpt = 1;
                return fm_fullreload(true);
            }

            // fetch all top-level nodes
            emplace(await fmdb.getbykey('f', 'h', ['p', [M.RootID, M.InboxID, M.RubbishID]]));
        },

        /**
         * Check whether a node is currently loading from DB.
         * @param {String} handle The ufs-node handle
         * @returns {Boolean} whether it is.
         */
        isLoading: function(handle) {
            return !!(tree_inflight[handle] || node_inflight.lock || node_inflight.size && node_inflight.has(handle));
        },

        /**
         * Fetch all children; also, fetch path to root; populates M.c and M.d in streaming mode
         *
         * @param {String} handle Node handle
         * @param {MegaPromise} [waiter] waiting parent
         * @returns {*|MegaPromise}
         * @memberOf dbfetch
         */
        open: promisify((resolve, reject, handle, waiter) => {
            const fail = (ex) => {
                reject(ex);
                hideLoading(handle);
                queueMicrotask(() => {
                    if (tree_inflight[handle] === waiter) {
                        delete tree_inflight[handle];
                    }
                    waiter.reject(ex);
                });
            };
            const done = (res) => {
                if (resolve) {
                    resolve(res);
                }
                hideLoading(handle);
                queueMicrotask(() => {
                    if (tree_inflight[handle] === waiter) {
                        delete tree_inflight[handle];
                    }
                    waiter.resolve(handle);
                });
            };

            // Dear ESLint, this is not a window.open call.
            // eslint-disable-next-line local-rules/open
            let ready = (n) => dbfetch.open(n.p).catch(nop);

            if (typeof handle !== 'string' || handle.length !== 8) {
                return resolve(handle);
            }
            var silent = waiter === undefined;

            if (silent) {
                waiter = mega.promise;
                waiter.catch(nop);
            }
            else {
                showLoading(handle);
            }

            if (tree_inflight[handle]) {
                if (M.c[handle]) {
                    queueMicrotask(resolve);
                    resolve = null;
                }
                return tree_inflight[handle].then(done).catch(fail);
            }
            tree_inflight[handle] = waiter;

            getNode(handle, (n) => {
                if (!n) {
                    return fail(ENOENT);
                }
                if (!n.t || M.c[n.h]) {
                    return ready(n).finally(done);
                }
                if (!silent) {
                    showLoading(handle);
                }

                let promise;
                const opts = {
                    limit: 4,
                    offset: 0,
                    where: [['p', handle]]
                };
                const ack = (res) => {
                    if (ready) {
                        promise = ready(n).finally(resolve);
                        ready = resolve = null;
                    }
                    else if (res) {
                        promise.finally(() => {
                            newnodes = newnodes.concat(res);
                            queueMicrotask(() => {
                                M.updFileManagerUI().dump(`dbf-open-${opts.i || handle}`);
                            });
                        });
                    }
                    return promise;
                };

                if (d) {
                    opts.i = `${makeid(9)}.${handle}`;
                }

                fmdb.getchunk('f', opts, (r) => {
                    if (!opts.offset) {
                        M.c[n.h] = M.c[n.h] || Object.create(null);
                    }

                    opts.offset += opts.limit;
                    if (opts.limit < 4096) {
                        opts.limit <<= 2;
                    }

                    emplace(r);
                    ack(r);

                }).catch(dump).finally(() => (promise || ack()).finally(done));
            });
        }),

        /**
         * Fetch all children; also, fetch path to root; populates M.c and M.d
         *
         * @param {String} parent  Node handle
         * @returns {Promise} none
         * @memberOf dbfetch
         */
        async get(parent) {

            if (d > 1) {
                console.warn('dbfetch.get(%s)', parent);
            }

            if (typeof parent !== 'string') {
                throw new Error(`Invalid parent, cannot fetch children for ${parent}`);
            }

            // is this a user handle or a non-handle? no fetching needed.
            while (parent.length === 8) {

                // has the parent been fetched yet?
                if (!M.d[parent]) {
                    const r = await fmdb.getbykey('f', 'h', ['h', [parent]]);
                    if (r.length > 1) {
                        console.error(`Unexpected number of result for node ${parent}`, r.length, r);
                    }

                    // providing a 'true' flag so that the node isn't added to M.c,
                    // otherwise crawling back to the parent won't work properly.
                    emplace(r, true);

                    if (!M.d[parent]) {
                        // no parent found?!
                        break;
                    }
                }

                // have the children been fetched yet?
                if (M.d[parent].t && !M.c[parent]) {
                    // no: do so now.
                    await this.tree([parent], 0);

                    if (!M.c[parent]) {
                        if (d) {
                            console.error(`Failed to fill M.c for folder node ${parent}...!`, M.d[parent]);
                        }
                        eventlog(99667);
                        break;
                    }
                }

                // crawl back to root (not necessary until we start purging from memory)
                parent = M.d[parent].p;
            }
        },

        /**
         * Fetch all children; also, fetch path to root; populates M.c and M.d
         * same as fetchchildren/dbfetch.get, but takes an array of handles.
         *
         * @param {Array} handles ufs-node handles
         * @returns {Promise} settle
         * @memberOf dbfetch
         */
        async geta(handles) {
            let bulk = handles.filter(h => !M.d[h]);

            if (bulk.length) {
                if (fmdb.hasPendingWrites('f')) {
                    if (d) {
                        fmdb.logger.warn('Holding data retrieval until there are no pending writes...', bulk);
                    }
                    // @todo we have to do something about the dirty-reads procedure becoming a nefarious bottleneck
                    do {

                        await tSleep(4);
                    }
                    while (fmdb.hasPendingWrites('f'));
                }
                emplace(await fmdb.getbykey('f', 'h', ['h', bulk]), true);
            }

            bulk = handles.filter(h => M.d[h] && M.d[h].t && !M.c[h]);
            if (bulk.length) {
                await this.tree(bulk, 0);
            }

            bulk = new Set();
            for (let i = handles.length; i--;) {
                const n = M.d[handles[i]];
                if (n && n.p) {
                    bulk.add(n.p);
                }
            }
            return bulk.size && this.geta([...bulk]);
        },

        /**
         * Fetch entire subtree.
         *
         * @param {Array} parents  Node handles
         * @param {Number} [level] Recursion level, optional
         * @returns {Promise}
         * @memberOf dbfetch
         */
        async tree(parents, level = -1) {
            if (!fmdb) {
                throw new Error('Invalid operation, FMDB is not available.');
            }
            const inflight = new Set();
            const {promise} = mega;

            // check which parents have already been fetched - no need to fetch those
            // (since we do not purge loaded nodes, the presence of M.c for a node
            // means that all of its children are guaranteed to be in memory.)
            while (parents.length) {
                const p = [];
                for (let i = parents.length; i--;) {
                    const h = parents[i];
                    if (tree_inflight[h]) {
                        inflight.add(tree_inflight[h]);
                    }
                    else if (!M.c[h]) {
                        tree_inflight[h] = promise;
                        p.push(h);
                    }
                }

                if (p.length) {

                    // fetch children of all unfetched parents
                    const r = await fmdb.getbykey('f', 'h', ['p', [...p]]);

                    // store fetched nodes
                    for (let i = p.length; i--;) {
                        delete tree_inflight[p[i]];

                        // M.c should be set when *all direct* children have
                        // been fetched from the DB (even if there are none)
                        M.c[p[i]] = M.c[p[i]] || Object.create(null);
                    }

                    emplace(r);
                    p.length = 0;
                }

                if (level--) {
                    // extract parents from children
                    for (let i = parents.length; i--;) {
                        for (const h in M.c[parents[i]]) {
                            // with file versioning, files can have children, too!
                            if (M.d[h].t || M.d[h].tvf) {
                                p.push(h);
                            }
                        }
                    }
                }

                parents = p;
            }

            promise.resolve();
            return inflight.size ? Promise.allSettled([...inflight, promise]) : promise;
        },

        /**
         * Throttled version of {@link dbfetch.get} to issue a single DB request for a bunch of node retrievals at once.
         * @param {String|Array} h uts-node handle, or an array of them.
         * @returns {Promise<void>} promise
         */
        async acquire(h) {
            if (Array.isArray(h)) {
                h.forEach(node_inflight.add, node_inflight);
            }
            else {
                node_inflight.add(h);
            }

            if (d > 1) {
                console.debug('acquiring node', h);
            }
            let backoff = 32 + Math.random() * 88;

            do {
                if (backoff < 4e3) {
                    backoff *= 1.6;
                }
                await tSleep(backoff / 1e3);
            }
            while (node_inflight.lock);

            if (node_inflight.size) {
                const handles = [...node_inflight];

                node_inflight.clear();
                node_inflight.lock = true;

                if (d) {
                    console.warn('acquiring nodes...', handles);
                }

                await this.geta(handles);
                node_inflight.lock = false;
            }
        },

        /**
         * Retrieve nodes by handle.
         * WARNING: emplacenode() is not used, it's up to the caller if so desired.
         *
         * @param {Array} handles
         * @returns {Promise}
         * @memberOf dbfetch
         */
        async node(handles) {
            const result = [];

            for (let i = handles.length; i--;) {
                if (M.d[handles[i]]) {
                    result.push(M.d[handles[i]]);
                    handles.splice(i, 1);
                }
            }

            if (!handles.length || !fmdb) {
                if (d && handles.length) {
                    console.warn('Unknown nodes: ' + handles);
                }
                return result;
            }

            const r = await fmdb.getbykey('f', 'h', ['h', [...handles]]);
            if (d && handles.length < 2 && r.length > 1) {
                console.error('Unexpected DB reply, more than a single node returned.');
            }

            return result.length ? [...result, ...r] : r;
        },

        /**
         * Retrieve a node by its hash.
         *
         * @param hash
         * @returns {Promise}
         * @memberOf dbfetch
         */
        async hash(hash) {
            if (M.h[hash]) {
                for (const h of M.h[hash]) {
                    if (M.d[h]) {
                        return M.d[h];
                    }
                }
            }

            const [n] = await fmdb.getbykey('f', 'c', false, [['c', hash]], 1);
            if (n) {
                // got the hash and a handle it belong to
                if (!M.h[hash]) {
                    M.h[hash] = new Set();
                }
                M.h[hash].add(n.h);
            }
            return n;
        },

        async media(limit = 2e3, onchunk = null) {
            if (fmdb) {
                if (typeof limit === 'function') {
                    onchunk = limit;
                    limit = 2e3;
                }

                const options = {
                    limit,
                    query(t) {
                        return t.where('fa').notEqual(fmdb.toStore(''));
                    }
                };

                if (onchunk) {
                    return fmdb.getchunk('f', options, onchunk);
                }

                delete options.limit;
                return fmdb.getbykey('f', options);
            }
        },

        /**
         * Fetch all children recursively; also, fetch path to root
         *
         * @param {Array} handles
         * @returns {Promise}
         * @memberOf dbfetch
         */
        async coll(handles) {
            if (!fmdb) {
                return;
            }

            // fetch nodes and their path to root
            await this.acquire(handles);

            const folders = [];
            for (let i = handles.length; i--;) {
                const n = M.d[handles[i]];
                if (n && (n.t || n.tvf)) {
                    folders.push(n.h);
                }
            }

            if (folders.length) {
                await dbfetch.tree(folders);
            }
        }
    });

    return {value: Object.freeze(dbfetch)};
})());

/* Collect entropy from mouse motion and key press events
 * Note that this is coded to work with either DOM2 or Internet Explorer
 * style events.
 * We don't use every successive mouse movement event.
 * Instead, we use some bits from random() to determine how many
 * subsequent mouse movements we ignore before capturing the next one.
 *
 * Collected entropy is used to salt asmCrypto's PRNG.
 *
 * mouse motion event code originally from John Walker
 * key press timing code thanks to Nigel Johnstone */

var lastactive = Date.now();

var bioSeed = new Uint32Array(256);
var bioCounter = 0;

var mouseMoveSkip = 0; // Delay counter for mouse entropy collection

// ----------------------------------------

if (window.performance !== undefined && window.performance.now !== undefined) {
    // Though `performance.now()` SHOULD be accurate to a microsecond,
    // spec says it's implementation-dependant (http://www.w3.org/TR/hr-time/#sec-DOMHighResTimeStamp)
    // That's why 16 least significan bits are returned
    var timeValue = function() {
        return (window.performance.now() * 1000) & 0xffff
    };
}
else {
    if (d) {
        console.warn("Entropy collector uses low-precision Date.now()");
    }
    var timeValue = function() {
        return Date.now() & 0xffff
    };
}

function keyPressEntropy(e) {
    'use strict';
    lastactive = Date.now();

    bioSeed[bioCounter++ & 255] ^= (e.keyCode << 16) | timeValue();

    if (typeof onactivity === 'function') {
        delay('ev:on.activity', onactivity, 800);
    }
}

var mouseApiRetryT = false;

function mouseMoveEntropy(e) {
    'use strict';
    lastactive = Date.now();

    var v = (((e.screenX << 8) | (e.screenY & 255)) << 16) | timeValue();

    if (saveRandSeed.needed) {
        if (bioCounter < 45) {
            // `bioCounter` is incremented once per 4 move events in average
            // 45 * 4 = 180 first move events should provide at about 270 bits of entropy
            // (conservative estimation is 1.5 bits of entropy per move event)
            asmCrypto.random.seed(new Uint32Array([v]));
        }
        else {
            if (d) {
                console.log("Got the first seed for future PRNG reseeding");
            }
            saveRandSeed();
        }
    }

    if (mouseMoveSkip-- <= 0) {
        bioSeed[bioCounter++ & 255] ^= v;

        mouseMoveSkip = (Math.random() * 8) | 0;

        if ((bioCounter & 255) === 0) {
            if (d) {
                console.log("Reseeding PRNG with collected entropy");
            }
            asmCrypto.random.seed(bioSeed);
            saveRandSeed();
        }
    }

    if (mouseApiRetryT < lastactive) {
        mouseApiRetryT = lastactive + 4e3;
        api.retry();
    }

    if (typeof onactivity === 'function') {
        delay('ev:on.activity', onactivity, 700);
    }
}

// Store some random bits for reseeding RNG in the future
function saveRandSeed() {
    'use strict';
    // @todo move this out of localStorage..
    tryCatch(() => {
        const randseed = new Uint8Array(32);
        asmCrypto.getRandomValues(randseed);
        localStorage.randseed = base64urlencode(asmCrypto.bytes_to_string(randseed));
    })();
    saveRandSeed.needed = false;
}
saveRandSeed.needed = !localStorage.randseed;

// ----------------------------------------

function eventsEnd() {
    if (document.removeEventListener) {
        document.removeEventListener("mousemove", mouseMoveEntropy, false);
        document.removeEventListener("keypress", keyPressEntropy, false);
    }
    else if (document.detachEvent) {
        document.detachEvent("onmousemove", mouseMoveEntropy);
        document.detachEvent("onkeypress", keyPressEntropy);
    }
}

// Start collection of entropy.

function eventsCollect() {
    'use strict';
    if (!d) {
        asmCrypto.random.skipSystemRNGWarning = true;
    }

    if (localStorage.randseed) {
        if (d) {
            console.log("Initially seeding PRNG with a stored seed");
        }
        asmCrypto.random.seed(asmCrypto.string_to_bytes(base64urldecode(localStorage.randseed)));
    }

    if (mega.getRandomValues.strong) {
        if (d > 1) {
            console.log("Initially seeding PRNG with strong random values");
        }
        asmCrypto.random.seed(mega.getRandomValues(384));
    }

    if ((document.implementation.hasFeature("Events", "2.0"))
        && document.addEventListener) // Document Object Model (DOM) 2 events
    {
        document.addEventListener("mousemove", mouseMoveEntropy, false);
        document.addEventListener("keypress", keyPressEntropy, false);
    }
    else if (document.attachEvent) // IE 5 and above event model
    {
        document.attachEvent("onmousemove", mouseMoveEntropy);
        document.attachEvent("onkeypress", keyPressEntropy);
    }
}

// keyboard/mouse entropy
mBroadcaster.once('boot_done', eventsCollect);

/**
 * MEGA Data Structures
 * Modern/unified way of handling/monitoring/syncing data changes required for the Webclient to work in a more:
 * 1. easy to use by us (developers)
 * 2. reactive/optimised way
 */

(function _dataStruct(global) {
'use strict';

var dsIncID = 0;

var VALUE_DESCRIPTOR = {configurable: true, value: null};
function _defineValue(target, prop, value) {
    VALUE_DESCRIPTOR.value = value;
    Object.defineProperty(target, prop, VALUE_DESCRIPTOR);
    VALUE_DESCRIPTOR.value = null;
}

var VNE_DESCRIPTOR = {configurable: true, writable: true, value: null};
function _defineNonEnum(target, prop, value) {
    VNE_DESCRIPTOR.value = value;
    Object.defineProperty(target, prop, VNE_DESCRIPTOR);
    VNE_DESCRIPTOR.value = null;
}

function _cmp(a, b) {
    return a === b || a === null && b === undefined || b === null && a === undefined;
}

function _timing(proto, min, max) {
    min = min || 10;
    max = max || 70;
    var wrap = function(f, m) {
        return function(...args) {
            var t = performance.now();
            var r = m.apply(this, args);
            if ((t = performance.now() - t) > min) {
                var fn = t > max ? 'error' : 'warn';
                console[fn]('[timing] %s.%s: %fms', this, f, t, [this], args);
            }
            return r;
        };
    };
    proto = proto.prototype || proto;
    var keys = Object.keys(proto);

    console.warn('timing %s...', Object(proto.constructor).name || '', keys);

    for (var i = keys.length; i--;) {
        if (typeof proto[keys[i]] === 'function') {
            proto[keys[i]] = wrap(keys[i], proto[keys[i]]);
        }
    }

    return proto;
}

const _warnOnce = SoonFc(400, function _warnOnce(where, ...args) {
    const prop = `__warn_once_${MurmurHash3(args[0], -0x7ff)}`;

    if (!where[prop]) {
        _defineNonEnum(where, prop, 1);
        console.warn.apply(console, args);
    }
});

function returnFalse() {
    return false;
}
function returnTrue() {
    return true;
}

function MegaDataEvent(src, target) {
    if (typeof src === 'object') {
        this.originalEvent = src;

        if (src.defaultPrevented || src.defaultPrevented === undefined
            && src.returnValue === false || src.isDefaultPrevented && src.isDefaultPrevented()) {

            this.isDefaultPrevented = returnTrue;
        }
    }
    else {
        src = {type: src};
    }

    this.type = src.type;
    this.target = src.target || target;
}

inherits(MegaDataEvent, null);

MegaDataEvent.prototype.isDefaultPrevented = returnFalse;
MegaDataEvent.prototype.isPropagationStopped = returnFalse;

MegaDataEvent.prototype.preventDefault = function() {
    this.isDefaultPrevented = returnTrue;
    if (this.originalEvent) {
        this.originalEvent.preventDefault();
    }
};

MegaDataEvent.prototype.stopPropagation = function() {
    this.isPropagationStopped = returnTrue;
    if (this.originalEvent) {
        this.originalEvent.stopPropagation();
    }
};

// Very simple replacement for jQuery.event
function MegaDataEmitter() {
    /* dummy */
}

inherits(MegaDataEmitter, null);

_defineValue(MegaDataEmitter, 'seen', Object.create(null));
_defineValue(MegaDataEmitter, 'expando', '__event_emitter_' + (Math.random() * Math.pow(2, 56) - 1));

/** @function MegaDataEmitter.getEmitter */
_defineValue(MegaDataEmitter, 'getEmitter', function(event, target) {
    var emitter = target[MegaDataEmitter.expando];
    if (!emitter) {
        emitter = Object.create(null);
        _defineValue(target, MegaDataEmitter.expando, emitter);
    }
    var pos;
    var src = event.type && event;
    var types = String(event.type || event).split(/\s+/).filter(String);
    var namespaces = Array(types.length);

    for (var i = types.length; i--;) {
        namespaces[i] = '';
        if ((pos = types[i].indexOf('.')) >= 0) {
            namespaces[i] = types[i].substr(pos + 1).split('.').sort().join('.');
            types[i] = types[i].substr(0, pos);
        }
    }
    return {types: types, namespaces: namespaces, event: src || types[0], events: emitter};
});

/** @function MegaDataEmitter.wrapOne */
_defineValue(MegaDataEmitter, 'wrapOne', function(handler) {
    return function _one(event) {
        this.off(event, _one);
        return handler.apply(this, arguments);
    };
});

MegaDataEmitter.prototype.off = function(event, handler) {
    if (event instanceof MegaDataEvent) {
        event.currentTarget.off(event.type + (event.namespace ? '.' + event.namespace : ''), handler);
        return this;
    }

    var emitter = MegaDataEmitter.getEmitter(event, this);
    for (var j = emitter.types.length; j--;) {
        var type = emitter.types[j];
        var namespace = emitter.namespaces[j];
        var handlers = emitter.events[type] || [];

        for (var i = handlers.length; i--;) {
            var tmp = handlers[i];

            if (type === tmp.type
                && (!handler || handler.pid === tmp.pid)
                && (!namespace || namespace === tmp.namespace)) {

                handlers.splice(i, 1);
            }
        }

        if (!handlers.length) {
            delete emitter.events[type];
        }
    }

    return this;
};

MegaDataEmitter.prototype.one = function(event, handler, data) {
    return this.on(event, handler, data, true);
};

MegaDataEmitter.prototype.on = function(event, handler, data, one) {
    var emitter = MegaDataEmitter.getEmitter(event, this);
    var events = emitter.events;

    handler = one ? MegaDataEmitter.wrapOne(handler) : handler;
    if (!handler.pid) {
        handler.pid = ++dsIncID;
    }

    for (var i = emitter.types.length; i--;) {
        var type = emitter.types[i];
        var namespace = emitter.namespaces[i];

        if (!events[type]) {
            events[type] = [];
        }

        events[type].push({
            type: type,
            data: data,
            pid: handler.pid,
            handler: handler,
            namespace: namespace
        });

        if (d) {
            MegaDataEmitter.seen[type] = 1;
        }
    }
    return this;
};

// eslint-disable-next-line complexity
MegaDataEmitter.prototype.trigger = function(event, data) {
    var emitter = MegaDataEmitter.getEmitter(event, this);

    event = new MegaDataEvent(emitter.event, this);
    event.data = data;

    // @todo require all trigger() calls to provide an array to prevent checking for isArray()
    data = data ? Array.isArray(data) ? data : [data] : [];
    data = [event, ...data];

    let idx = 0;
    let res, tmp;
    var type = emitter.types[0];
    var namespace = emitter.namespaces[0];
    const handlers = [...(emitter.events[type] || [])];
    while ((tmp = handlers[idx++]) && !event.isPropagationStopped()) {
        event.currentTarget = this;
        event.namespace = namespace;

        if ((!namespace || namespace === tmp.namespace)
            && (res = tmp.handler.apply(this, data)) !== undefined) {

            event.result = res;
            if (res === false) {
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }

    if (!event.isDefaultPrevented()) {
        tmp = this['on' + type];

        if (typeof tmp === 'function') {
            event.result = tmp.apply(this, data);
            if (event.result === false) {
                event.preventDefault();
            }
        }
    }

    if (event.originalEvent && event.result !== undefined) {
        event.originalEvent.returnValue = event.result;
    }

    return event.result;
};

MegaDataEmitter.prototype.rebind = function(event, handler) {
    return this.off(event).on(event, handler);
};
MegaDataEmitter.prototype.bind = MegaDataEmitter.prototype.on;
MegaDataEmitter.prototype.unbind = MegaDataEmitter.prototype.off;

Object.freeze(MegaDataEmitter);

/**
 * Simple map-like implementation that tracks changes
 *
 * @param [parent]
 * @param [defaultData]
 * @constructor
 */
function MegaDataMap(parent, defaultData) {
    // MegaDataEmitter.call(this);

    /** @property MegaDataMap._parent */
    _defineNonEnum(this, '_parent', parent || false);

    /** @property MegaDataMap._dataChangeIndex */
    _defineNonEnum(this, '_dataChangeIndex', 0);
    /** @property MegaDataMap._dataChangeListeners */
    _defineNonEnum(this, '_dataChangeListeners', []);
    /** @property MegaDataMap._dataChangeTrackedId */
    _defineNonEnum(this, '_dataChangeTrackedId', ++dsIncID);

    /** @property MegaDataMap._data */
    _defineNonEnum(this, '_data', defaultData || {});
    Object.setPrototypeOf(this._data, null);

    if (d > 1) {
        if (!MegaDataMap.__instancesOf) {
            MegaDataMap.__instancesOf = new WeakMap();
        }
        MegaDataMap.__instancesOf.set(this, Object.getPrototypeOf(this));
    }
}

inherits(MegaDataMap, MegaDataEmitter);

/** @property MegaDataMap.__ident_0 */
lazy(MegaDataMap.prototype, '__ident_0', function() {
    return this.constructor.name + '.' + ++dsIncID;
});

/** @function MegaDataMap.prototype._schedule */
lazy(MegaDataMap.prototype, '_schedule', function() {
    let task = null;
    const callTask = () => {
        if (task) {
            queueMicrotask(task);
            task = null;
        }
    };
    return (callback) => {
        if (!task) {
            queueMicrotask(callTask);
        }
        task = () => callback.call(this);
    };
});

Object.defineProperty(MegaDataMap.prototype, 'length', {
    get: function() {
        return Object.keys(this._data).length;
    },
    configurable: true
});

_defineValue(MegaDataMap.prototype, 'valueOf', function() {
    return this.__ident_0;
});

MegaDataMap.prototype.trackDataChange = function(...args) {
    var self = this;
    this._schedule(function _trackDataChange() {
        var that = self;

        do {
            args.unshift(that);

            if (that === self) {
                that._dispatchChangeListeners(args);
            }
            else {
                that._enqueueChangeListenersDsp(args);
            }

        } while ((that = that._parent) instanceof MegaDataMap);
    });
};

MegaDataMap.prototype.addChangeListener = function(cb) {
    if (d) {
        var h = this._dataChangeListeners;
        if (d > 1 && h.length > 200) {
            _warnOnce(this, '%s: Too many handlers added(%d)! race?', this, h.length, [this]);
        }
        console.assert(h.indexOf(cb) < 0, 'handler exists');

        if (typeof cb === 'function') {
            console.assert(!cb.__mdmChangeListenerID, 'reusing handler');
        }
        else {
            console.assert(typeof cb.handleChangeEvent === 'function', 'invalid instance');
        }
    }

    if (typeof cb === 'function') {
        /** @property Function.__mdmChangeListenerID */
        _defineValue(cb, '__mdmChangeListenerID', dsIncID + 1);
    }

    this._dataChangeListeners.push(cb);
    return ++dsIncID;
};

MegaDataMap.prototype.removeEventHandler = function(handler) {
    var result = false;
    var listeners = this._dataChangeListeners;

    if (d) {
        console.assert(handler && typeof handler.handleChangeEvent === 'function');
    }

    for (var i = listeners.length; i--;) {
        if (listeners[i] === handler) {
            listeners.splice(i, 1);
            ++result;
        }
    }

    return result;
};

MegaDataMap.prototype.removeChangeListener = function(cb) {
    var cId = cb && cb.__mdmChangeListenerID || cb;

    if (d) {
        console.assert(cId > 0, 'invalid listener id');
    }

    if (cId > 0) {
        var listeners = this._dataChangeListeners;

        for (var i = listeners.length; i--;) {
            if (listeners[i].__mdmChangeListenerID === cId) {
                _defineValue(listeners[i], '__mdmChangeListenerID', 'nop');
                listeners.splice(i, 1);

                if (d > 1) {
                    while (--i > 0) {
                        console.assert(listeners[i].__mdmChangeListenerID !== cId);
                    }
                }

                return true;
            }
        }
    }

    return false;
};

MegaDataMap.prototype._enqueueChangeListenersDsp = function(args) {
    delay(`mdm:cl:q.${this.__ident_0}`, () => this._dispatchChangeListeners(args), 40);
};

MegaDataMap.prototype._dispatchChangeListeners = function(args) {
    var listeners = this._dataChangeListeners;

    if (d > 3) {
        console.debug('%s: dispatching %s awaiting listeners', this, listeners.length, [this]);
    }
    this._dataChangeIndex++;

    for (var i = listeners.length; i--;) {
        var result;
        var listener = listeners[i];

        if (typeof listener === 'function') {
            result = listener.apply(this, args);
        }
        else if (listener) {
            result = listener.handleChangeEvent.apply(listener, args);
        }

        if (result === 0xDEAD) {
            this.removeChangeListener(listener);
        }
    }
};

// eslint-disable-next-line local-rules/misc-warnings
MegaDataMap.prototype.forEach = function(cb) {
    // this._data is a dict, so no guard-for-in needed
    // eslint-disable-next-line guard-for-in
    for (var k in this._data) {
        if (cb(this._data[k], k) === false) {
            break;
        }
    }
};
MegaDataMap.prototype.every = function(cb) {
    var self = this;
    return self.keys().every(function(k) {
        return cb(self._data[k], k);
    });
};
MegaDataMap.prototype.some = function(cb) {
    var self = this;
    return self.keys().some(function(k) {
        return cb(self._data[k], k);
    });
};

MegaDataMap.prototype.map = function(cb) {
    var self = this;
    var res = [];
    self.forEach(function(v, k) {
        var intermediateResult = cb(v, k);
        if (intermediateResult !== null && intermediateResult !== undefined) {
            res.push(intermediateResult);
        }
    });
    return res;
};

MegaDataMap.prototype.keys = function() {
    return Object.keys(this._data);
};

MegaDataMap.prototype.size = function() {
    return this.keys().length;
};

MegaDataMap.prototype.destroy = tryCatch(function() {
    var self = this;
    Object.keys(self).map(function(k) {
        return self._removeDefinedProperty(k);
    });
    Object.freeze(this);
});

MegaDataMap.prototype.clear = tryCatch(function() {
    Object.keys(this).map((k) => {
        return this._removeDefinedProperty(k);
    });
    this.trackDataChange();
});

MegaDataMap.prototype.setObservable = function(k, defaultValue) {
    Object.defineProperty(this, k, {
        get: function() {
            return this.get(k, defaultValue);
        },
        set: function(value) {
            this.set(k, value, false, defaultValue);
        },
        enumerable: true
    });
};

MegaDataMap.prototype.exists = function(keyValue) {
    return keyValue in this._data;
};

MegaDataMap.prototype.set = function(k, v, ignoreTrackDataChange) {
    if (d) {
        console.assert(k !== undefined && k !== false, "missing key");
    }

    if (v instanceof MegaDataMap && !v._parent) {
        _defineNonEnum(v, '_parent', this);
    }

    if (_cmp(this._data[k], v) === true) {
        return false;
    }

    this._data[k] = v;

    if (k in this) {
        this[k] = v;
    }
    else {
        Object.defineProperty(this, k, {
            get: function() {
                return this._data[k];
            },
            set: function(value) {
                if (value !== this._data[k]) {
                    this._data[k] = value;
                    this.trackDataChange(this._data, k, v);
                }
            },
            enumerable: true,
            configurable: true
        });
    }

    if (!ignoreTrackDataChange) {
        this.trackDataChange(this._data, k, v);
    }
};

MegaDataMap.prototype.remove = function(k) {
    var v = this._data[k];

    if (v instanceof MegaDataMap && v._parent === this) {
        _defineNonEnum(v, '_parent', null);
    }

    this._removeDefinedProperty(k);
    this.trackDataChange(this._data, k, v);
};

/** @function MegaDataMap.prototype._removeDefinedProperty */
_defineValue(MegaDataMap.prototype, '_removeDefinedProperty', function(k) {
    if (k in this) {
        Object.defineProperty(this, k, {
            writable: true,
            value: undefined,
            configurable: true
        });
        delete this[k];
    }
    if (k in this._data) {
        delete this._data[k];
    }
});

/** @function MegaDataMap.prototype.toJS */
_defineValue(MegaDataMap.prototype, 'toJS', function() {
    return this._data;
});

_defineValue(MegaDataMap.prototype, 'hasOwnProperty', function(prop) {
    return prop in this._data;
});

_defineValue(MegaDataMap.prototype, 'propertyIsEnumerable', function(prop) {
    return this.hasOwnProperty(prop);
});



/**
 * Plain Object-like container for storing data, with the following features:
 * - track changes ONLY on predefined list of properties
 *
 * @param {Object} [trackProperties] properties to observe for changes
 * @param {Object} [defaultData] default/initial data
 * @constructor
 */
function MegaDataObject(trackProperties, defaultData) {
    MegaDataMap.call(this, null, defaultData);

    if (trackProperties) {
        for (var k in trackProperties) {
            if (Object.hasOwnProperty.call(trackProperties, k)) {
                this.setObservable(k, trackProperties[k]);
            }
        }
    }

    /*
    if (d && typeof Proxy === 'function') {
        var slave = Object.create(Object.getPrototypeOf(this));
        Object.setPrototypeOf(this, new Proxy(slave, {
            defineProperty: function(target, property, descriptor) {
                if (String(property).startsWith('jQuery')) {
                    debugger
                    console.assert(false);
                }
                Object.defineProperty(target, property, descriptor);
                return true;
            }
        }));
    }*/
}

inherits(MegaDataObject, MegaDataMap);

MegaDataObject.prototype.set = function(k, v, ignoreDataChange, defaultVal) {
    var notSet = !(k in this._data);

    if (notSet || _cmp(this._data[k], v) !== true) {
        if (notSet && _cmp(defaultVal, v) === true) {
            // this._data[...] is empty and defaultVal == newVal, DON'T track updates.
            return false;
        }

        if (!ignoreDataChange) {
            this.trackDataChange(this._data, k, v);
        }
        this._data[k] = v;
    }
};

MegaDataObject.prototype.get = function(k, defaultVal) {
    return this._data && k in this._data ? this._data[k] : defaultVal;
};


/**
 * MegaDataSortedMap
 * @param keyField
 * @param sortField
 * @param parent
 * @constructor
 */
function MegaDataSortedMap(keyField, sortField, parent) {
    MegaDataMap.call(this, parent);

    /** @property MegaDataSortedMap._parent */
    _defineNonEnum(this, '_parent', parent || false);
    /** @property MegaDataSortedMap._sortedVals */
    _defineNonEnum(this, '_sortedVals', []);
    /** @property MegaDataSortedMap._keyField */
    _defineNonEnum(this, '_keyField', keyField);
    /** @property MegaDataSortedMap._sortField */
    _defineNonEnum(this, '_sortField', sortField);
}

inherits(MegaDataSortedMap, MegaDataMap);

Object.defineProperty(MegaDataSortedMap.prototype, 'length', {
    get: function() {
        return this._sortedVals.length;
    },
    configurable: true
});

// eslint-disable-next-line local-rules/misc-warnings
MegaDataSortedMap.prototype.forEach = function(cb) {
    for (var i = 0; i < this._sortedVals.length; ++i) {
        var k = this._sortedVals[i];
        cb(this._data[k], k);
    }
};

MegaDataSortedMap.prototype.replace = function(k, newValue) {
    if (this._data[k] === newValue) {
        // already the same, save some CPU and do nothing.
        return true;
    }

    if (k in this._data) {
        // cleanup
        if (newValue[this._keyField] !== k) {
            this.removeByKey(k);
        }
        this.push(newValue);
        return true;
    }

    return false;
};

/** @property MegaDataSortedMap._comparator */
lazy(MegaDataSortedMap.prototype, '_comparator', function() {
    var self = this;

    if (this._sortField === undefined) {
        return indexedDB.cmp.bind(indexedDB);
    }

    if (typeof self._sortField === "function") {
        return function(a, b) {
            return self._sortField(self._data[a], self._data[b]);
        };
    }

    return function(a, b) {
        var sortFields = self._sortField.split(",");

        for (var i = 0; i < sortFields.length; i++) {
            var sortField = sortFields[i];
            var ascOrDesc = 1;
            if (sortField[0] === '-') {
                ascOrDesc = -1;
                sortField = sortField.substr(1);
            }

            var _a = self._data[a][sortField];
            var _b = self._data[b][sortField];

            if (_a !== undefined && _b !== undefined) {
                if (_a < _b) {
                    return -1 * ascOrDesc;
                }
                if (_a > _b) {
                    return ascOrDesc;
                }
                return 0;
            }
        }
        return 0;
    };
});

MegaDataSortedMap.prototype.push = function(v) {
    var self = this;

    var keyVal = v[self._keyField];

    if (keyVal in self._data) {
        self.removeByKey(keyVal);
    }

    self.set(keyVal, v, true);

    var minIndex = 0;
    var maxIndex = this._sortedVals.length - 1;
    var currentIndex;
    var currentElement;
    var cmp = self._comparator;

    var result = false;
    while (minIndex <= maxIndex) {
        currentIndex = (minIndex + maxIndex) / 2 | 0;
        currentElement = this._sortedVals[currentIndex];

        var cmpResult = cmp(currentElement, keyVal);
        if (cmpResult === -1) {
            minIndex = currentIndex + 1;
        }
        else if (cmpResult === 1) {
            maxIndex = currentIndex - 1;
        }
        else {
            result = true;
            break;
        }
    }

    if (!result) {
        if (currentElement === undefined) {
            // first
            self._sortedVals.push(keyVal);
        }
        else {
            self._sortedVals.splice(cmp(currentElement, keyVal) === -1 ? currentIndex + 1 : currentIndex, 0, keyVal);
        }

        self.trackDataChange();
    }
    else {
        // found another item in the list, with the same order value, insert after
        self._sortedVals.splice(currentIndex, 0, keyVal);
    }
    return self._sortedVals.length;
};

MegaDataSortedMap.prototype.removeByKey = MegaDataSortedMap.prototype.remove = function(keyValue) {
    if (keyValue in this._data) {
        array.remove(this._sortedVals, keyValue);
        this._removeDefinedProperty(keyValue);
        this.trackDataChange();
        return true;
    }
    return false;
};

MegaDataSortedMap.prototype.exists = function(keyValue) {
    return keyValue in this._data;
};

MegaDataSortedMap.prototype.keys = function() {
    return this._sortedVals;
};

MegaDataSortedMap.prototype.values = function() {
    var res = [];
    // eslint-disable-next-line local-rules/misc-warnings
    this.forEach(function(v) {
        res.push(v);
    });

    return res;
};

MegaDataSortedMap.prototype.getItem = function(num) {
    return this._data[this._sortedVals[num]];
};

MegaDataSortedMap.prototype.indexOfKey = function(value) {
    return this._sortedVals.indexOf(value);
};

MegaDataSortedMap.prototype.clear = function() {
    _defineNonEnum(this, '_sortedVals', []);
    _defineNonEnum(this, '_data', Object.create(null));
    if (this.trackDataChange) {
        this.trackDataChange();
    }
};

/**
 * Simplified version of `Array.prototype.splice`, only supports 2 args (no adding/replacement of items) for now.
 *
 * @param {Number} start first index to start from
 * @param {Number} deleteCount number of items to delete
 * @returns {Array} array of deleted item ids
 */
MegaDataSortedMap.prototype.splice = function(start, deleteCount) {
    var deletedItemIds = this._sortedVals.splice(start, deleteCount);

    for (var i = deletedItemIds.length; i--;) {
        this._removeDefinedProperty(deletedItemIds[i]);
    }

    this.trackDataChange();

    return deletedItemIds;
};

/**
 * Returns a regular array (not a sorted map!) of values sliced as with `Array.prototype.slice`
 *
 * @param {Number} begin first index to start from
 * @param {Number} end last index where to end the "slice"
 * @returns {Array} array of removed IDs
 */
MegaDataSortedMap.prototype.slice = function(begin, end) {
    var results = this._sortedVals.slice(begin, end);
    for (var i = results.length; i--;) {
        results[i] = this._data[results[i]];
    }
    return results;
};

var testMegaDataSortedMap = function() {
    var arr1 = new MegaDataSortedMap("id", "orderValue,ts");
    arr1.push({
        'id': 1,
        'ts': 1,
        'orderValue': 1
    });

    arr1.push({
        'id': 2,
        'ts': 3,
        'orderValue': 2
    });
    arr1.push({
        'id': 3,
        'ts': 2
    });

    arr1.forEach(function(v, k) {
        console.error(v, k);
    });
    return arr1;
};


/**
 * Generic "MegaDataBitMap" manager that manages a list of all registered (by unique name) MegaDataBitMaps
 *
 * @constructor
 */
function MegaDataBitMapManager() {
    this._bitmaps = Object.create(null);
}

inherits(MegaDataBitMapManager, null);

/**
 * Register a MegaDataBitMap
 * @param {String} name
 * @param {MegaDataBitMap} megaDataBitMap
 */
MegaDataBitMapManager.prototype.register = function(name, megaDataBitMap) {
    if (this._bitmaps[name] !== undefined) {
        console.error("Tried to register a MegaDataBitMap that already exists (at least with that name).");
        return;
    }
    this._bitmaps[name] = megaDataBitMap;
};

/**
 * Check if an MegaDataBitMap with a specific `name` exists.
 *
 * @param {String} name
 * @returns {Boolean}
 */
MegaDataBitMapManager.prototype.exists = function(name) {
    return typeof(this._bitmaps[name]) !== 'undefined';
};

/**
 * Get the instance of a specific by `name` MegaDataBitMap
 *
 * @param {String} name
 * @returns {*}
 */
MegaDataBitMapManager.prototype.get = function(name) {
    return this._bitmaps[name];
};

/**
 * MegaDataBitMaps are array, that are stored as attributes (on the MEGA API side), which hold 0s and 1s for a specific
 * (predefined, ordered set of) keys.
 * Once the data is .commit()'ed adding new keys should always be done at the end of the array.
 * No keys should be removed, because that would mess up the values stored in the user attribute, since all keys are
 * only available on the client side, the data is mapped via the key index (e.g. key1 = 0, key2 = 1, keyN = N - 1).
 *
 * @param {String} name Should be unique.
 * @param {Boolean} isPub should the attribute be public or private?
 * @param {Array} keys Array of keys
 * @constructor
 */
function MegaDataBitMap(name, isPub, keys) {
    MegaDataObject.call(this, array.to.object(keys, 0));

    this.name = name;
    this._keys = keys;
    this._isPub = isPub;
    this._data = new Uint8Array(keys.length);
    this._updatedMask = new Uint8Array(keys.length);
    this._version = null;
    this._commitProc = 0;

    attribCache.bitMapsManager.register(name, this);

    this._readyPromise = new Promise((resolve, reject) => {
        mega.attr.get(u_handle, name, this.isPublic() ? true : -2, true)
            .then(r => {
                if (typeof r !== 'string') {
                    throw r;
                }
                this.mergeFrom(r, false);
                resolve();
            })
            .catch(ex => {
                if (ex === ENOENT) {
                    return resolve(ex);
                }
                // -9 is ok, means the attribute does not exists on the server
                console.error("mega.attr.get failed:", ex);
                reject(ex);
            });
    });
}

inherits(MegaDataBitMap, MegaDataObject);

Object.defineProperty(MegaDataBitMap.prototype, 'length', {
    get: function() {
        return this._data.length;
    },
    enumerable: false,
    configurable: true
});

/**
 * Returns a list of keys that are currently registered with this MegaDataBitMap instance.
 *
 * @returns {Array}
 */
MegaDataBitMap.prototype.keys = function() {
    return this._keys;
};

/**
 * Flip the value of `key` from 0 -> 1 or from 1 -> 0
 * Calling this function would trigger a change event.
 * Calling this function would NOT persist the data on the server, until the .commit() method is called.
 *
 * @param {String} key
 * @returns {Boolean}
 */
MegaDataBitMap.prototype.toggle = function(key) {
    const keyIdx = this._keys.indexOf(key);
    if (keyIdx === -1) {
        return false;
    }

    this.set(key, this._data[keyIdx] ? 0 : 1);
};

/**
 * Reset the internal "updated mask" to mark all keys as commited.
 * Mainly used internally by `MegaDataBitMap.prototype.commit()`
 */
MegaDataBitMap.prototype.commited = function() {
    this._updatedMask = new Uint8Array(this._keys.length);
};

/**
 * Change the value of `key` to `v` (can be either 0 or 1, integer).
 * Calling this function would trigger a change event.
 * Calling this function would NOT persist the data on the server, until the .commit() method is called.
 *
 * @param {String} key
 * @param {Number} v Can be either 0 or 1
 * @param {Boolean} ignoreDataChange If true, would not trigger a change event
 * @param {Number} defaultVal By default, the default value is supposed to be 0, but any other value can be passed here
 * @returns {Promise|void} The Promise resolves when the value is set in the MegaDataBitMap.
 */
MegaDataBitMap.prototype.set = function(key, v, ignoreDataChange, defaultVal) {
    if (typeof(v) !== 'number' && v !== 1 && v !== 0) {
        console.error("MegaDataBitMap...set was called with non-zero/one value as 2nd argument.");
        return;
    }

    return this._readyPromise.then(() => {
        this.setSync(key, v, ignoreDataChange, defaultVal);
    });
};

/**
 * Synchronous setter. Prefer using MegaDataBitMap.set().
 * Can use instead if you are aware of the state of this._readyPromise
 *
 * @param {String} key The bit map key to set
 * @param {Number} v Can be either 0 or 1
 * @param {Boolean} ignoreDataChange If true, would not trigger a change event
 * @param {Number} defaultVal By default, the default value is supposed to be 0, but any other value can be passed here
 * @returns {boolean|void} False if no change
 * @see MegaDataBitMap.prototype.set
 */
MegaDataBitMap.prototype.setSync = function(key, v, ignoreDataChange, defaultVal = 0) {
    const keyIdx = this._keys.indexOf(key);
    if (keyIdx === -1) {
        return false;
    }

    if (
        typeof this._data[keyIdx] === 'undefined'
        && typeof defaultVal !== 'undefined'
        && _cmp(defaultVal, v) === true
        || this._data[keyIdx] === v /* already the same value... */
    ) {
        // self._data[...] is empty and defaultVal == newVal, DON'T track updates.
        return false;
    }

    this._data[keyIdx] = v;
    this._updatedMask[keyIdx] = 1;

    if (!ignoreDataChange) {
        this.trackDataChange(this._data, key, v);
    }
};

/**
 * Returns the promise that will be resolved when the MegaDataBitMap has finished requesting the attribute from
 * the server initially
 *
 * @returns {Promise} The initialisation promise
 */
MegaDataBitMap.prototype.isReady = function() {
    return this._readyPromise;
};

MegaDataBitMap.prototype.get = async function(key, defaultVal = false) {
    await this._readyPromise;
    return this.getSync(key, defaultVal);
};

/**
 * Synchronous getter. Prefer using MegaDataBitMap.get().
 * Can use instead if you are aware of the state of this._readyPromise
 *
 * @param {string} key Key for the value to fetch
 * @param {*|boolean} defaultVal Default value if the key is not set
 * @returns {*|boolean} The current value of the key
 * @see MegaDataBitMap.prototype.get
 */
MegaDataBitMap.prototype.getSync = function(key, defaultVal = false) {
    const keyIdx = this._keys.indexOf(key);
    if (keyIdx === -1) {
        throw key;
    }

    return this._data && typeof this._data[keyIdx] !== 'undefined' ? this._data[keyIdx] : defaultVal;
};

/**
 * Merge the current MegaDataBitMap value with a {String} `str`.
 * Merging is done the following way:
 * - IF a value of a key, passed by `str` differs from the one in the current instance:
 *  a) if was marked as 'dirty' (not commited, via the update mask) it would not be merged (its assumed that any data,
 *  stored in 'dirty' state and not commited is the most up to date one)
 *  b) the local value for that key would be updated, following a change event
 *
 * @param {String} str String, containing 0 and 1 chars to be parsed as Uint8Array with 0 and 1s
 * @param {Boolean} requiresCommit Pass true, to mark all changes in the update mask (e.g. they would be schedulled for
 * sending to the server on the next .commit() call)
 */
MegaDataBitMap.prototype.mergeFrom = function(str, requiresCommit) {
    let targetLength = str.length;
    if (this._keys.length > str.length) {
        targetLength = this._keys.length;
    }
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        const newVal = str.charCodeAt(i);
        if (this._data[i] !== newVal) {
            if (this._updatedMask[i] && this._updatedMask[i] === 1) {
                // found uncommited change, would leave (and not merge), since in that case, we would assume that
                // since changes are commited (almost) immediately after the .set()/.toggle() is done, then this
                // was just changed and its newer/up to date then the one from the server.
            }
            else {
                this._data[i] = newVal;
                this.trackDataChange(
                    this._data,
                    this._keys[i],
                    newVal
                );
                if (requiresCommit) {
                    this._updatedMask[i] = 1;
                }
            }
        }
    }
    if (!requiresCommit && this._commitProc) {
        if (this._commitProc === 2) {
            onIdle(() => this.safeCommit());
        }
        this._commitProc = 0;
    }

    // resize if needed.
    if (this._keys.length > targetLength) {
        this._data.fill(false, this._keys.length, targetLength - this._keys.length);
    }
};

/**
 * Convert to a base64urlencoded string
 *
 * @returns {String}
 */
_defineValue(MegaDataBitMap.prototype, 'toString', function() {
    return base64urlencode(String.fromCharCode.apply(null, this._data));
});

/**
 * Convert the mask to a base64urlencoded string
 *
 * @returns {String}
 */
MegaDataBitMap.prototype.maskToString = function() {
    return base64urlencode(
        String.fromCharCode.apply(null, this._updatedMask)
    );
};

/**
 * Convert to a 0 and 1 string (separated by ",") including key names.
 *
 * @returns {String}
 */
MegaDataBitMap.prototype.toDebugString = function() {
    const res = [];
    for (let i = 0; i < this._data.length; i++) {
        res.push(`${this._keys[i]} -> ${this._data[i]}`);
    }
    return res.join(', ');
};

/**
 * Set the current version of the attribute (received and controlled by the API)
 *
 * @param ver
 * @returns {String}
 */
MegaDataBitMap.prototype.setVersion = function(ver) {
    return this._version = ver;
};

/**
 * Get the current version of the attribute (received and controlled by the API)
 *
 * @returns {String|undefined}
 */
MegaDataBitMap.prototype.getVersion = function() {
    return this._version;
};

/**
 * Was this attribute marked as public?
 *
 * @returns {Boolean}
 */
MegaDataBitMap.prototype.isPublic = function() {
    return this._isPub;
};

/**
 * Commits all changes which were marked as changed.
 * All changed keys/bits would be overwritten on the server
 * All non-changed keys/bits, may be altered in case another commit (by another client) had changed them. In that case,
 * a change event would be triggered.
 *
 * @returns {Promise}
 */
MegaDataBitMap.prototype.commit = mutex('mdbm-commit', function(resolve, reject) {
    if (!this._updatedMask.includes(1)) {
        return resolve(false);
    }
    if (this._commitProc) {
        this._commitProc = 2;
        return resolve(2);
    }
    const n = `${this.isPublic() ? '+' : '^'}!${this.name}`;
    const m = this.maskToString();
    const cacheKey = `${u_handle}_${n}`;
    attribCache.setItem(cacheKey, JSON.stringify([this.toString(), 0]));
    this._commitProc = 1;
    this.commited();
    api_req(
        {
            a: 'usma',
            n,
            ua: this.toString(),
            m,
        },
        {
            callback: (response) => {
                if (typeof response === 'number') {
                    // There was an error so resume the mask state
                    const maskString = base64urldecode(m);
                    for (let i = 0; i < maskString.length; i++) {
                        this._updatedMask[i] = this._updatedMask[i] || maskString.charCodeAt(i);
                    }
                    reject(response);
                }
                else {
                    // Action packet will update this data structure.
                    resolve(response);
                }
            }
        }
    );
});

/**
 * Commit the MegaDataBitMap with basic handling of the resulting promise
 *
 * @returns {void} void
 */
MegaDataBitMap.prototype.safeCommit = function() {
    this.commit().then(nop).catch(dump);
};

/**
 * Initialise a new MegaDataBitMap from string
 * Only used for testing some stuff.
 *
 * @param {String} name
 * @param {Boolean} isPub
 * @param {Array} keys
 * @param {String} base64str
 * @param {*} [parent]
 * @returns {MegaDataBitMap}
 */
MegaDataBitMap.fromString = function(name, isPub, keys, base64str, parent) {
    const str = base64urldecode(base64str);
    let targetLength = str.length;
    if (keys.length > str.length) {
        targetLength = keys.length;
    }
    const buf = new ArrayBuffer(targetLength); // 2 bytes for each char
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    const mdbm = new MegaDataBitMap(name, isPub, keys, parent);
    mdbm._data = new Uint8Array(buf, 0, buf.byteLength);
    if (keys.length > buf.length) {
        mdbm._data.fill(false, keys.length, buf.length - keys.length);
    }
    return mdbm;
};


/**
 * Mark all bits/keys as 0s (would not commit the changes).
 */
MegaDataBitMap.prototype.reset = function() {
    const keys = this.keys();
    for (let i = 0; i < keys.length; i++) {
        this.set(keys[i], 0);
    }
};

/**
 * Experiments, tests and examples
 *
 * @returns {MegaDataBitMap}
 */
var testMegaDataBitMap = function() {
    var keys = [
        'key1',
        'key2',
        'key3',
    ];
    var arr1 = new MegaDataBitMap("arr1", false, keys);

    arr1.toggle('key2');

    arr1.commited();

    var arr2 = MegaDataBitMap.fromString("arr2", false, keys, arr1.toString());
    assert(arr2.toString() === arr1.toString());

    console.error(arr2._updatedMask.toString());
    arr2.toggle('key1');
    console.error(arr2._updatedMask.toString());
    arr1.mergeFrom(arr2.toString());
    return arr1;
};

/**
 * Bitmap based on an integer.
 * @param attribute {String}
 *     Name of the attribute.
 * @param map An array of keys to use for identifying each bit.
 * @param pub {Boolean|Number}
 *     True for public attributes (default: true).
 *     -1 for "system" attributes (e.g. without prefix)
 *     -2 for "private non encrypted attributes"
 *     False for private encrypted attributes
 * @param nonHistoric {Boolean}
 *     True for non-historic attributes (default: false).  Non-historic attributes will overwrite the value, and
 *     not retain previous values on the API server.
 * @param autoSaveTimeout {int} Autosave after x millisecond.
 * @constructor
 */
function MegaIntBitMap(attribute, map, pub, nonHistoric, autoSaveTimeout) {
    this.value = undefined;
    this.attribute = attribute;
    this.map = map;
    this.pub = pub;
    this.nonHistoric = nonHistoric;
    this.isReadyPromise = null;
    this.autoSaveTimeout = autoSaveTimeout;
    this.autoSaveTimer = null;
}

/**
 * Get a bit based on its key.
 * @param key The bit key.
 * @returns {MegaPromise}
 */
MegaIntBitMap.prototype.get = function(key) {
    var self = this;
    return new MegaPromise(function(resolve, reject) {
        self.isReady().then(function() {
            var mask;
            if (Array.isArray(key)) {
                var bitKey;
                var result = {};
                for (var i = 0; i < key.length; i++) {
                    bitKey = key[i];
                    mask = self.getMask(bitKey);
                    if (!mask) {
                        reject("Invalid Key");
                        return false;
                    }
                    result[bitKey] = self.value & mask ? true : false;
                }
                resolve(result);
            } else {
                mask = self.getMask(key);
                if (!mask) {
                    reject("Invalid Key");
                    return false;
                }
                resolve(self.value & mask ? true : false);
            }

        }, reject);
    });
};

/**
 * Set a bit/bits based on a key/keys.
 * @param key object|string The bit key or map of bit keys -> newState
 * @param newValue {bool|void} The new state if previous parameter is a bit key.
 * @returns {MegaPromise}
 */
MegaIntBitMap.prototype.set = function(key, newValue) {
    var self = this;
    return new MegaPromise(function(resolve, reject) {
        self.isReady().then(function() {
            var mask;
            // jscs:disable disallowImplicitTypeConversion
            if (typeof key === 'object') {
                var bitKey;
                var updatedValue = self.value;
                var keys = Object.keys(key);
                for (var i = 0; i < keys.length; i++) {
                    bitKey = keys[i];
                    mask = self.getMask(bitKey);
                    if (!mask) {
                        reject("Invalid Key");
                        return false;
                    }
                    updatedValue = key[bitKey] ? (updatedValue | mask) : (updatedValue & (~mask));
                }
                self.value = updatedValue;
            } else {
                mask = self.getMask(key);
                if (!mask) {
                    reject("Invalid Key");
                    return false;
                }
                self.value = newValue ? (self.value | mask) : (self.value & (~mask));
            }
            // jscs:enable disallowImplicitTypeConversion
            self.valueChanged();
            resolve(self.value);
        }, reject);
    });
};

/**
 * Get all bits.
 * @returns {MegaPromise}
 */
MegaIntBitMap.prototype.getAll = function() {
    var self = this;
    return new MegaPromise(function(resolve, reject) {
        self.isReady().then(function() {
            var all = {};
            for (var i = 0; i < self.map.length; i++) {
                all[self.map[i]] = self.value & (1 << i) ? true : false;
            }
            resolve(all);
        }, reject);
    });
};

/**
 * Set all bits that we know about.
 * @param newValue The new state for all known bits.
 * @returns {MegaPromise}
 */
MegaIntBitMap.prototype.setAll = function(newValue) {
    var self = this;
    return new MegaPromise(function(resolve, reject) {
        self.isReady().then(function() {
            // jscs:disable disallowImplicitTypeConversion
            var mask = ~(0xFFFFFF << self.map.length);
            self.value = newValue ? self.value | mask : self.value & (~mask);
            // jscs:enable disallowImplicitTypeConversion
            self.valueChanged();
            resolve(self.value);
        }, reject);
    });
};

/**
 * Get a mask from a key.
 * @param key The bit key.
 */
MegaIntBitMap.prototype.getMask = function(key) {
    var idx = this.map.indexOf(key);
    if (idx >= 0) {
        return 1 << idx;
    }
    return false;
};

/**
 * Load attribute.
 * @returns {MegaPromise}
 */
MegaIntBitMap.prototype.load = function() {
    var self = this;
    return new MegaPromise(function(resolve, reject) {
        mega.attr.get(u_attr.u, self.attribute, self.pub, self.nonHistoric).then(function(value) {
            self.value = parseInt(value);
            resolve();
        }, function(value) {
            if (value === ENOENT) {
                self.value = 0;
                resolve();
            } else {
                reject.apply(null, arguments);
            }
        });
    });
};

/**
 * Save Attribute.
 * @returns {MegaPromise}
 */
MegaIntBitMap.prototype.save = function() {
    return mega.attr.set(
        this.attribute,
        this.value,
        this.pub,
        this.nonHistoric
    );
};

/**
 * Wait till ready.
 * @returns {MegaPromise}
 */
MegaIntBitMap.prototype.isReady = function() {
    if (this.isReadyPromise === null) {
        var self = this;
        this.isReadyPromise = new MegaPromise(function(resolve, reject) {
            self.load().then(resolve, reject);
        });
    }
    return this.isReadyPromise;
};

/**
 * Directly set all the bits by providing an int.
 * @param newValue {int} The new value
 * @returns {MegaPromise}
 */
MegaIntBitMap.prototype.setValue = function(newValue) {
    var self = this;
    return new MegaPromise(function(resolve, reject) {
        self.isReady().then(function() {
            self.value = newValue;
            self.valueChanged();
            resolve(self.value);
        }, reject);
    });
};

/**
 * Track value changed.
 * Note: Call this whenever the value is changed.
 */
MegaIntBitMap.prototype.valueChanged = function() {
    if (this.autoSaveTimeout) {
        var self = this;
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(function() {
            clearTimeout(self.autoSaveTimer);
            self.save();
        }, self.autoSaveTimeout);
    }
};

/**
 * Triggered when the attribute is updated, thus updating our internal value.
 * @return {MegaPromise}
 */
MegaIntBitMap.prototype.handleAttributeUpdate = function() {
    this.isReadyPromise = null;
    return this.isReady();
};

// ----------------------------------------------------------------------------------------

Object.defineProperty(global, 'MegaDataMap', {value: MegaDataMap});
Object.defineProperty(global, 'MegaDataObject', {value: MegaDataObject});
Object.defineProperty(global, 'MegaDataSortedMap', {value: MegaDataSortedMap});

/** @constructor MegaDataEvent */
Object.defineProperty(global, 'MegaDataEvent', {value: MegaDataEvent});
/** @constructor MegaDataEmitter */
Object.defineProperty(global, 'MegaDataEmitter', {value: MegaDataEmitter});

Object.defineProperty(global, 'MegaIntBitMap', {value: MegaIntBitMap});
Object.defineProperty(global, 'MegaDataBitMap', {value: MegaDataBitMap});
Object.defineProperty(global, 'MegaDataBitMapManager', {value: MegaDataBitMapManager});

if (d) {
    if (d > 2) {
        _timing(MegaDataMap);
        _timing(MegaDataObject);
        _timing(MegaDataEmitter);
        _timing(MegaDataSortedMap);
    }
    global._timing = _timing;
    global.testMegaDataBitMap = testMegaDataBitMap;
    global.testMegaDataSortedMap = testMegaDataSortedMap;
}

})(self);

/**
 * IndexedDB Key/Value Storage
 */

// (the name must exist in the FMDB schema with index 'k')
function IndexedDBKVStorage(name) {
    'use strict';

    this.name = name;
    this.dbcache = Object.create(null);     // items that reside in the DB
    this.newcache = Object.create(null);    // new items that are pending flushing to the DB
    this.delcache = Object.create(null);    // delete items that are pending deletion from the DB
}

inherits(IndexedDBKVStorage, null);

// sets fmdb reference and prefills the memory cache from the DB
// (call this ONCE as soon as the user-specific IndexedDB is open)
// (this is robust against an undefined fmdb reference)
IndexedDBKVStorage.prototype.load = async function() {
    'use strict';
    if (window.is_eplusplus) {
        const pfx = `e++${this.name}!`;
        const store = await M.getPersistentDataEntries(pfx, true).catch(dump) || {};
        const keys = Object.keys(store);
        for (let i = keys.length; i--;) {
            if (store[keys[i]]) {
                this.dbcache[keys[i].substr(pfx.length)] = store[keys[i]];
            }
            else if (d) {
                console.warn('Malformed data in entry.', keys[i], store[keys[i]]);
            }
        }
    }
    else if (window.fmdb) {
        const r = await fmdb.get(this.name).catch(dump) || [];
        for (let i = r.length; i--;) {
            this.dbcache[r[i].k] = r[i].v;
        }
    }
};

// flush new items / deletions to the DB (in channel 0, this should
// be followed by call to setsn())
// will be a no-op if no fmdb set
IndexedDBKVStorage.prototype.flush = function() {
    'use strict';
    let v = 0;
    const {fmdb} = window;

    for (const k in this.delcache) {
        if (is_eplusplus) {
            M.delPersistentData('e++' + this.name + '!' + k).always(nop);
        }
        else if (fmdb) {
            ++v;
            fmdb.del(this.name, k);
        }
        delete this.dbcache[k];
    }

    for (const k in this.newcache) {
        if (is_eplusplus) {
            M.setPersistentData('e++' + this.name + '!' + k, this.newcache[k]).always(nop);
        }
        else if (fmdb) {
            ++v;
            fmdb.add(this.name, {k: k, d: {v: this.newcache[k]}});
        }
        this.dbcache[k] = this.newcache[k];
    }

    this.delcache = Object.create(null);
    this.newcache = Object.create(null);

    return v;
};

// set item in DB/cache
// (must only be called in response to an API response triggered by an actionpacket)
IndexedDBKVStorage.prototype.setItem = function __IDBKVSetItem(k, v) {
    'use strict';
    console.assert(v !== undefined);

    return new MegaPromise((resolve) => {
        delete this.delcache[k];

        if (this.dbcache[k] !== v) {
            this.newcache[k] = v;
            this.saveState();
        }
        resolve([k, v]);
    });
};

// get item - if not found, promise will be rejected
IndexedDBKVStorage.prototype.getItem = function __IDBKVGetItem(k) {
    'use strict';
    var self = this;
    return new MegaPromise(function(resolve, reject) {
        if (!self.delcache[k]) {

            if (self.newcache[k] !== undefined) {
                // record recently (over)written
                return resolve(self.newcache[k]);
            }

            // record available in DB
            if (self.dbcache[k] !== undefined) {
                return resolve(self.dbcache[k]);
            }
        }

        // record deleted or unavailable
        reject();
    });
};

// remove item from DB/cache
// (must only be called in response to an API response triggered by an actionpacket)
IndexedDBKVStorage.prototype.removeItem = function __IDBKVRemoveItem(k, save) {
    'use strict';

    this.delcache[k] = true;
    delete this.newcache[k];

    // if save = false we do defer to the upcoming setItem() call, to prevent unnecessary DB ops.
    if (save !== false) {
        this.saveState();
    }

    return MegaPromise.resolve();
};

// enqueue explicit flush
IndexedDBKVStorage.prototype.saveState = function() {
    'use strict';

    delay('attribcache:savestate', () => {
        const {fmdb, currsn} = window;

        if (d) {
            console.debug('attribcache:savestate(%s)...', currsn, fminitialized);
        }

        if (fminitialized && currsn || is_eplusplus) {
            const v = this.flush();

            if (v && fmdb) {
                setsn(currsn);
            }
        }
    }, 2600);
};

// Clear DB Table and in-memory contents.
IndexedDBKVStorage.prototype.clear = promisify(function __IDBKVClear(resolve, reject) {
    'use strict';
    var self = this;
    console.error("This function should not be used under normal conditions...");
    self.constructor.call(this, this.name);

    if (is_eplusplus) {
        M.getPersistentDataEntries('e++' + this.name + '!')
            .then(function(r) {
                return Promise.allSettled(r.map(function(k) {
                    return M.delPersistentData(k);
                }));
            })
            .then(resolve).catch(reject);
        return;
    }

    if (window.fmdb && Object(fmdb.db).hasOwnProperty(this.name)) {
        return fmdb.db[this.name].clear().then(resolve).catch(reject);
    }

    reject();
});

if (!is_karma) {
    Object.freeze(IndexedDBKVStorage.prototype);
}
Object.freeze(IndexedDBKVStorage);

var attribCache = false;
mBroadcaster.once('boot_done', function() {
    'use strict';
    attribCache = new IndexedDBKVStorage('ua');
    attribCache.bitMapsManager = new MegaDataBitMapManager();

    // We no longer need this for anything else.
    window.IndexedDBKVStorage = null;
});

/**
 * Shared, Local Key Value Storage.
 * To be used for storing local (non-api persisted data, mostly non-critical data).
 *
 * @param name {String}
 * @param manualFlush {bool} by default disabled, note: NOT tested/used yet.
 * @param [broadcaster] {Object} mBroadcaster-like object in case you don't want to use the global mBroadcaster
 * and watchdog (useful for unit tests - see test/utilities/fakebroadcaster.js)
 *
 * @constructor
 */
var SharedLocalKVStorage = function(name, manualFlush, broadcaster) {
    var self = this;

    if (!broadcaster) {
        broadcaster = mBroadcaster;
    }
    self.broadcaster = broadcaster;

    // intentionally using '.wdog' instead of '.watchdog', because a self.wdog (where 'self' is not defined),
    // would basically cause our code to use the global 'watchdog' object, which can cause a lot of hard to track
    // issues!
    if (typeof broadcaster.watchdog !== 'undefined') {
        self.wdog = broadcaster.watchdog;
    }
    else {
        self.wdog = watchdog;
    }


    self.name = name;
    self.manualFlush = manualFlush;

    const id = broadcaster.id || broadcaster.crossTab && broadcaster.crossTab.origin.toString(36);
    self.logger = new MegaLogger(`SharedLocalKVStorage[${name}:${id}]`);
    self.debug = window.d > 0 && d;

    self.persistAdapter = null;

    self._queuedSetOperations = Object.create(null);

    self._listeners = {};
    self._initPersistance();

    Object.defineProperty(this, 'isMaster', {
        get: function() {
            return !!self.broadcaster.crossTab.owner;
        },
        set: function() {
            throw new Error(".isMaster is read only!");
        }
    });
};

inherits(SharedLocalKVStorage, MegaDataEmitter);

/**
 * Worst case scenario of an inactive tab, that is heavily throttled by Chrome, so we need to set the query time out
 * when running in realworld cases to a bit higher value.
 */
SharedLocalKVStorage.DEFAULT_QUERY_TIMEOUT = (
    mega.chrome ? 10000 : 1000
);

SharedLocalKVStorage._replyToQuery = function(watchdog, token, query, value) {
    watchdog.notify('Q!Rep!y', {
        query: query,
        token: token,
        value: value
    });
};

SharedLocalKVStorage._clearQueuedSetRecord = (self, key, target) => {
    'use strict';
    assert(self instanceof SharedLocalKVStorage);

    if (self._queuedSetOperations[key]) {
        const index = self._queuedSetOperations[key].indexOf(target);
        if (d) {
            console.assert(index >= 0, `Cannot find ${key}'s`, target);
        }

        if (index > -1) {
            self._queuedSetOperations[key].splice(index, 1);

            if (!self._queuedSetOperations[key].length) {
                delete self._queuedSetOperations[key];

                if (self.debug) {
                    self.logger.debug(`SetQueue ran empty for ${key}`);
                }
            }

            if (self.debug && !$.len(self._queuedSetOperations)) {
                self.logger.debug(`SetQueue emptied.`);
            }
        }
    }
    else if (self.debug) {
        self.logger.warn(`SetQueue is missing ${key}`);
    }
};

SharedLocalKVStorage.prototype.triggerOnChange = function(k, v) {
    var self = this;
    self.trigger('onChange', [k, v]);
};

SharedLocalKVStorage.prototype._setupPersistance = function() {
    'use strict';
    var self = this;
    console.assert(!this.persistAdapter, 'a previous persist adapter exists ?!..');

    // clear any old/previously added event handlers in case this function is called after a master change
    [
        'watchdog:Q!slkv_get_' + self.name,
        `watchdog:Q!slkv_getby_${this.name}`,
        'watchdog:Q!slkv_keys_' + self.name,
        'watchdog:Q!slkv_set_' + self.name,
        `watchdog:Q!slkv_clear_${this.name}`,
        `watchdog:Q!slkv_destroy_${this.name}`,
        'watchdog:slkv_mchanged_' + self.name,
        'crossTab:owner'
    ].forEach(function(k) {
        if (self._listeners[k]) {
            self.broadcaster.removeListener(self._listeners[k]);
            delete self._listeners[k];
        }
        // self.wdog.removeEventHandler(k);
    }) ;


    var listenersMap = {};

    if (self.broadcaster.crossTab.owner) {
        // i'm the cross tab master
        self.persistAdapter = new SharedLocalKVStorage.Utils.DexieStorage(
            self.name,
            self.manualFlush,
            self.wdog.wdID
        );

        listenersMap["watchdog:Q!slkv_keys_" + self.name] = function (args) {
            var token = args.data.reply;
            assert(token, 'token is missing for: ' + JSON.stringify(args));

            self.keys(args.data.p).then((keys) => {
                SharedLocalKVStorage._replyToQuery(self.wdog, token, "Q!slkv_keys_" + self.name, keys);
            }).catch(dump);
        };

        listenersMap[`watchdog:Q!slkv_destroy_${this.name}`] = (args) => {
            const token = args.data.reply;

            this.destroy()
                .catch(dump)
                .finally(() => {
                    SharedLocalKVStorage._replyToQuery(this.wdog, token, `Q!slkv_destroy_${this.name}`, 0xDEAD);
                });
        };

        listenersMap[`watchdog:Q!slkv_clear_${this.name}`] = (args) => {
            const token = args.data.reply;

            this.clear()
                .catch(dump)
                .finally(() => {
                    SharedLocalKVStorage._replyToQuery(this.wdog, token, `Q!slkv_clear_${this.name}`, 0xDEADBEEF);
                });
        };

        listenersMap["watchdog:Q!slkv_get_" + self.name] = function(args) {
            var token = args.data.reply;
            self.getItem(args.data.k)
                .then((response) => {
                    if (self.debug > 1) {
                        self.logger.debug("Sending slkv_get reply: ", args.data.k, response);
                    }
                    SharedLocalKVStorage._replyToQuery(self.wdog, token, "Q!slkv_get_" + self.name, response);
                })
                .catch(() => {
                    SharedLocalKVStorage._replyToQuery(self.wdog, token, "Q!slkv_get_" + self.name, undefined);
                });
        };

        listenersMap[`watchdog:Q!slkv_getby_${this.name}`] = (args) => {
            const {reply: token, pfx} = args.data;

            this.eachPrefixItem(pfx)
                .then((response) => {
                    SharedLocalKVStorage._replyToQuery(this.wdog, token, `Q!slkv_getby_${this.name}`, response);
                })
                .catch((ex) => {
                    if (this.debug && ex !== ENOENT || this.debug > 1) {
                        this.logger.warn(`slkv_getby_${this.name}:${pfx}`, ex);
                    }
                    SharedLocalKVStorage._replyToQuery(this.wdog, token, `Q!slkv_getby_${this.name}`, undefined);
                });
        };

        listenersMap["watchdog:Q!slkv_set_" + self.name] = function(args) {
            var token = args.data.reply;

            var result;

            if (typeof args.data.v === 'undefined') {
                result = self.removeItem(args.data.k, {
                    'origin': args.origin
                });
            }
            else {
                result = self.setItem(args.data.k, args.data.v, {
                    'origin': args.origin
                });
            }

            result
                .done(function(response) {
                    SharedLocalKVStorage._replyToQuery(self.wdog, token, "Q!slkv_set_" + self.name, response);
                })
                .fail(function() {
                    SharedLocalKVStorage._replyToQuery(self.wdog, token, "Q!slkv_set_" + self.name, undefined);
                });
        };
    }
    else {
        self.persistAdapter = false;

        listenersMap["watchdog:slkv_mchanged_" + self.name] = function(args) {
            if (args.data.meta.origin !== self.wdog.origin) {
                self.triggerOnChange(args.data.k, args.data.v);
            }
        };

        listenersMap['crossTab:owner'] = () => {
            // .setMaster was locally called.
            if (!self.persistAdapter) {
                self._setupPersistance();
            }
        };
    }


    Object.keys(listenersMap).forEach(function(k) {
        self._listeners[k] = self.broadcaster.addListener(k, listenersMap[k]);
    });
};

SharedLocalKVStorage.prototype._initPersistance = function() {
    var self = this;

    self._setupPersistance();

    if (this.debug) {
        self.rebind("onChange.logger" + self.name, function(e, k, v) {
            self.logger.debug("Got onChange event:", k, v);
        });
    }

    this._leavingListener = this.broadcaster.addListener('crossTab:leaving', ({origin, data}) => {
        const didOwnerLeave = !!data.owner;
        const didBecomeOwner = didOwnerLeave && data.election === this.broadcaster.crossTab.origin;

        if (this.debug) {
            const msg = `Tab '${origin.toString(36)}' leaved, checking ownership...`;
            this.logger.log(msg, {didOwnerLeave, didBecomeOwner, origin}, data);
        }

        // master had changed?
        if (didOwnerLeave) {
            if (didBecomeOwner) {
                console.assert(this.broadcaster.crossTab.owner, 'I was expecting to become owner...');
                if (!this.persistAdapter) {
                    this._setupPersistance();
                }
            }

            const setItem = (k, data) => {
                const {targetValue, resolve, reject} = data;

                if (d) {
                    this.logger.debug(`Re-setting value for '${k}'`, targetValue);
                }

                this.setItem(k, targetValue)
                    .then(resolve)
                    .catch(reject)
                    .finally(() => {
                        SharedLocalKVStorage._clearQueuedSetRecord(this, k, data);
                    });
            };

            // master had changed, do I've any queued ops that were not executed? re-send them!
            for (const k in this._queuedSetOperations) {
                const pending = this._queuedSetOperations[k];

                for (let i = 0; i < pending.length; ++i) {
                    setItem(k, pending[i]);
                }
            }
        }
    });
};


SharedLocalKVStorage.prototype.getItem = function(k) {
    var self = this;

    if (self.broadcaster.crossTab.owner) {
        return this.persistAdapter.getItem(k);
    }
    else {
        // request using cross tab from master
        var promise = new MegaPromise();

        self.wdog.query("slkv_get_" + self.name, SharedLocalKVStorage.DEFAULT_QUERY_TIMEOUT, false, {'k': k}, true)
            .then((response) => {
                if (response && response[0]) {
                    promise.resolve(response[0]);
                }
                else {
                    promise.reject();
                }
            })
            .catch((ex) => {
                self.logger.warn("getItem request failed: ", k, ex);
                promise.reject(ex);
            });

        return promise;
    }
};

SharedLocalKVStorage.prototype.eachPrefixItem = function __SLKVEachItem(pfx, each) {
    'use strict';

    if (this.broadcaster.crossTab.owner) {
        return this.persistAdapter.eachPrefixItem(pfx, each);
    }

    return new MegaPromise((resolve, reject) => {

        this.wdog.query(`slkv_getby_${this.name}`, SharedLocalKVStorage.DEFAULT_QUERY_TIMEOUT, false, {pfx}, true)
            .then(([res]) => {
                if (!res) {
                    return reject(ENOENT);
                }
                if (each) {
                    for (const k in res) {
                        each(res[k], k);
                    }
                }
                resolve(res);
            })
            .catch(reject);
    });
};

SharedLocalKVStorage.prototype.dump = function(prefix) {
    'use strict';
    return this.eachPrefixItem(prefix || '', dump).dump(`${this.name}.dump(${prefix || ''})`);
};

SharedLocalKVStorage.prototype.keys = function(prefix) {
    var self = this;

    if (self.broadcaster.crossTab.owner) {
        return self.persistAdapter.keys(prefix);
    }
    else {
        // request using cross tab from master
        var promise = new MegaPromise();

        self.wdog.query(
            "slkv_keys_" + self.name,
            SharedLocalKVStorage.DEFAULT_QUERY_TIMEOUT,
            false,
            {
                'p': prefix
            },
            true
        ).then((response) => {
            if (response && response[0]) {
                promise.resolve(response[0]);
            }
            else {
                promise.reject(EINCOMPLETE);
            }
        }).catch((ex) => {
            promise.reject(ex);
        });

        return promise;
    }

};


SharedLocalKVStorage.prototype.setItem = function(k, v, meta) {
    'use strict';
    var self = this;
    if (self.broadcaster.crossTab.owner) {
        var fn = "setItem";
        if (typeof v === 'undefined') {
            fn = "removeItem";
        }

        if (!meta) {
            // if triggered locally, by the master, there is no 'meta', so lets add our wdID
            meta = {
                'origin': self.wdog.origin
            };
        }
        else {
            // if i'm not the one who triggered the change, trigger a local on change event.
            self.triggerOnChange(k, v);
        }
        // Notify via watchdog that there was a change!
        // doing it immediately (and not after .done), because of Chrome's delay of indexedDB operations
        if (self.broadcaster.crossTab.peers) {
            this.wdog.notify(`slkv_mchanged_${self.name}`, {k, v, meta});
        }

        return self.persistAdapter[fn](k, v);
    }

    return new MegaPromise((resolve, reject) => {

        if (!this._queuedSetOperations[k]) {
            this._queuedSetOperations[k] = [];
        }
        const op = {resolve, reject, targetValue: v};
        this._queuedSetOperations[k].push(op);

        this.wdog.query(`slkv_set_${this.name}`, SharedLocalKVStorage.DEFAULT_QUERY_TIMEOUT, false, {k, v}, true)
            .then(resolve)
            .catch(reject)
            .finally(() => {
                SharedLocalKVStorage._clearQueuedSetRecord(self, k, op);
            });
    });
};

SharedLocalKVStorage.prototype.removeItem = function(k, meta) {
    var self = this;
    if (self.broadcaster.crossTab.owner) {
        return self.setItem(k, undefined, meta);
    }
    else {
        var promise = new MegaPromise();
        self.wdog.query(
            "slkv_set_" + self.name,
            SharedLocalKVStorage.DEFAULT_QUERY_TIMEOUT,
            false,
            {
                'k': k,
                'v': undefined
            },
            true
        )
            .then(() => {
                promise.resolve();
            })
            .catch(() => {
                promise.reject();
            });
        return promise;
    }
};

SharedLocalKVStorage.prototype.clear = function() {
    'use strict';

    if (this.debug) {
        this.logger.warn('Cleaning instance...', [this]);
    }

    if (this.broadcaster.crossTab.owner) {
        return this.persistAdapter.clear();
    }

    return new MegaPromise((resolve, reject) => {
        this.wdog.query(`slkv_clear_${this.name}`, SharedLocalKVStorage.DEFAULT_QUERY_TIMEOUT, false, false, true)
            .then(resolve)
            .catch(reject);
    });
};

SharedLocalKVStorage.prototype.destroy = function() {
    'use strict';
    var self = this;

    if (self.debug) {
        self.logger.warn('Destroying instance...', [this]);
    }

    if (self._leavingListener) {
        self.broadcaster.removeListener(self._leavingListener);
    }

    if (self.debug) {
        self.off(`onChange.logger${self.name}`);
    }

    if (self.broadcaster.crossTab.owner) {
        return this.persistAdapter.destroy();
    }

    return new MegaPromise((resolve, reject) => {
        self.wdog.query(`slkv_destroy_${this.name}`, SharedLocalKVStorage.DEFAULT_QUERY_TIMEOUT, false, false, true)
            .then(resolve)
            .catch(reject);
    });
};

SharedLocalKVStorage.DB_MODE = {
    'MANUAL_FLUSH': 1,
    'NO_MEMOIZE': 2,
    'FORCE_MEMOIZE': 4,
    'BINARY': 8,
};
SharedLocalKVStorage.DB_STATE = {
    'NOT_READY': 0,
    'READY': 1,
    'INITIALISING': 2,
    'FAILED': 3,
};

SharedLocalKVStorage.encrypt = function(val) {
    'use strict';

    return FMDB.prototype.toStore(JSON.stringify(val));
};
SharedLocalKVStorage.decrypt = function(val) {
    'use strict';

    try {
        return JSON.parse(FMDB.prototype.fromStore(val));
    }
    catch (e) {
        return "";
    }
};

SharedLocalKVStorage.Utils = Object.create(null);

SharedLocalKVStorage.Utils.lazyInitCall = function(proto, method, master, fn) {
    'use strict';
    if (fn === undefined) {
        fn = master;
        master = true;
    }
    proto[method] = function __SLKVLazyInitCall(...args) {
        if (master && !mBroadcaster.crossTab.owner) {
            // the method shall dealt with it.
            return fn.apply(this, arguments);
        }

        return new Promise((resolve, reject) => {
            const name = this.__slkvLazyInitMutex || (this.__slkvLazyInitMutex = `lIMutex${makeUUID().slice(-13)}`);
            mutex.lock(name).then((unlock) => {
                const onReadyState = () => {
                    delete this.__slkvLazyInitMutex;
                    return (this[method] = fn).apply(this, args).then(resolve).catch(reject);
                };

                if (Object.hasOwnProperty.call(this, '__slkvLazyInitReady')) {
                    return onReadyState().finally(unlock);
                }

                this.lazyInit()
                    .then(() => {
                        Object.defineProperty(this, '__slkvLazyInitReady', {value: 1});
                        return onReadyState();
                    })
                    .finally(unlock);
            }).catch(reject);
        });
    };

    return proto[method];
};

SharedLocalKVStorage.Utils._requiresMutex = function SLKVMutexWrapper(origFunc, methodName) {
    'use strict';
    return function __SLKVMutexWrapper(...args) {
        const name = this.__mutexLockName || (this.__mutexLockName = `slkv${makeUUID().slice(-13)}`);
        return new MegaPromise((resolve, reject) => {
            mutex.lock(name)
                .then((unlock) => {
                    const wrap = (dsp) => (arg) => {
                        if (d > 3) {
                            this.logger.warn('Releasing lock(%s) from %s...', name, methodName);
                            console.timeEnd(name);
                        }
                        unlock().then(() => dsp(arg)).catch(reject);
                    };
                    if (d > 3) {
                        this.logger.warn('Lock(%s) acquired for %s...', name, methodName, [this, ...args]);
                        console.time(name);
                    }
                    origFunc.apply(this, args).then(wrap(resolve)).catch(wrap(reject));
                })
                .catch(reject);
        });
    };
};

SharedLocalKVStorage.Utils.DexieStorage = function(name, options) {
    'use strict';

    this.name = name;
    this.dbState = SharedLocalKVStorage.DB_STATE.NOT_READY;
    this.logger = new MegaLogger("SLKVDStorage[" + name + "]");

    this.binary = options & SharedLocalKVStorage.DB_MODE.BINARY;
    this.manualFlush = options & SharedLocalKVStorage.DB_MODE.MANUAL_FLUSH;
    this.memoize = !(options & SharedLocalKVStorage.DB_MODE.NO_MEMOIZE);

    if (this.binary) {
        this.memoize = options & SharedLocalKVStorage.DB_MODE.FORCE_MEMOIZE;
        this._encryptValue = this._encryptBinaryValue;
        this._decryptValue = this._decryptBinaryValue;
    }

    this._reinitCache();
};
inherits(SharedLocalKVStorage.Utils.DexieStorage, MegaDataEmitter);

/**
 * Database connection.
 * @name db
 * @memberOf SharedLocalKVStorage.Utils.DexieStorage.prototype
 */
lazy(SharedLocalKVStorage.Utils.DexieStorage.prototype, 'db', function() {
    'use strict';
    return new MegaDexie('SLKV', this.name, 'slkv_', true, {kv: '++i, &k'});
});

SharedLocalKVStorage.Utils._requiresDbReady = function SLKVDBConnRequired(fn) {
    'use strict';
    return function __requiresDBConnWrapper(...args) {

        if (this.dbState === SharedLocalKVStorage.DB_STATE.READY) {
            return fn.apply(this, arguments);
        }

        var self = this;
        var promise = new MegaPromise();

        if (!u_handle) {
            promise.reject();
            return promise;
        }

        var success = function() {
            promise.linkDoneAndFailTo(fn.apply(self, args));
        };

        var failure = function(ex) {
            self.logger.warn(ex);
            self.dbState = SharedLocalKVStorage.DB_STATE.FAILED;
            promise.reject("DB_FAILED");
        };

        // lazy db init
        if (self.dbState === SharedLocalKVStorage.DB_STATE.NOT_READY) {
            self.dbState = SharedLocalKVStorage.DB_STATE.INITIALISING;

            self.dbLoadingPromise = new MegaPromise();

            self.db.open().then(self._OpenDB.bind(self)).then(function(r) {
                self.logger.info('DB Ready, %d records loaded.', r.length, r);
            }).catch(failure).finally(function() {
                var p = self.dbLoadingPromise;
                delete self.dbLoadingPromise;

                if (d > 1) {
                    self.db.$__OwnerInstance = self;
                }

                if (self.dbState === SharedLocalKVStorage.DB_STATE.FAILED) {
                    return p.reject("DB_OPEN_FAILED");
                }
                self.dbState = SharedLocalKVStorage.DB_STATE.READY;

                success();
                p.resolve();
            }).catch(failure);
        }
        else if (self.dbState === SharedLocalKVStorage.DB_STATE.INITIALISING) {
            // DB open is in progress.
            self.dbLoadingPromise.then(success).catch(failure);
        }
        else {
            promise.reject("DB_FAILED");
        }

        return promise;
    };
};

SharedLocalKVStorage.Utils.DexieStorage.prototype._encryptKey = SharedLocalKVStorage.encrypt;
SharedLocalKVStorage.Utils.DexieStorage.prototype._decryptKey = SharedLocalKVStorage.decrypt;
SharedLocalKVStorage.Utils.DexieStorage.prototype._encryptValue = SharedLocalKVStorage.encrypt;
SharedLocalKVStorage.Utils.DexieStorage.prototype._decryptValue = SharedLocalKVStorage.decrypt;

// @private
SharedLocalKVStorage.Utils.DexieStorage.prototype._encryptBinaryValue = function(value) {
    'use strict';
    var pad = -value.byteLength & 15;
    if (pad) {
        var tmp = new Uint8Array(value.byteLength + pad);
        tmp.set(value);
        value = tmp;
    }
    return [pad, FMDB.prototype._crypt(u_k_aes, value)];
};

// @private
SharedLocalKVStorage.Utils.DexieStorage.prototype._decryptBinaryValue = function(value) {
    'use strict';
    var pad = value[0];
    value = FMDB.prototype._decrypt(u_k_aes, value[1]);
    return pad ? value.slice(0, -pad) : value;
};

SharedLocalKVStorage.Utils.DexieStorage.prototype._OpenDB = function() {
    'use strict';
    var self = this;

    if (!this.memoize) {
        return Promise.resolve([]);
    }
    return self.db.kv.toArray()
        .then(function(r) {
            for (var i = 0; i < r.length; ++i) {
                self.dbcache[self._decryptKey(r[i].k)] = self._decryptValue(r[i].v);
            }
            return r;
        });
};

// flush new items / deletions to the DB (in channel 0, this should
// be followed by call to setsn())
// will be a no-op if no fmdb set
SharedLocalKVStorage.Utils.DexieStorage.prototype.flush = function() {
    'use strict';
    var self = this;
    var masterPromise = new MegaPromise();

    var debug = function(o) {
        return o.map(function(o) {
            return self._decryptKey(o.k) + ':' + self._decryptValue(o.v);
        });
    };

    var done = onIdle.bind(null, function() {
        if (!self.memoize) {
            self._reinitCache();
        }
        masterPromise.resolve();
    });

    var bulkDelete = Object.keys(self.delcache)
        .map(function(k) {
            delete self.dbcache[k];
            return self.db.kv.where('k').equals(self._encryptKey(k)).delete();
        });

    var bulkPut = Object.keys(self.newcache)
        .map(function(k) {
            self.dbcache[k] = self.newcache[k];
            return {
                k: self._encryptKey(k),
                v: self._encryptValue(self.newcache[k])
            };
        });

    self.delcache = Object.create(null);
    self.newcache = Object.create(null);

    Promise.all(bulkDelete)
        .then(function() {
            return self.db.bulkUpdate(bulkPut);
        })
        .then(done)
        .catch(function(ex) {
            if (d || is_karma) {
                self.db.kv.toArray()
                    .then(function(o) {
                        self.logger.error("flush failed", ex.message, [ex], debug(bulkPut), debug(o));
                        masterPromise.reject(ex);
                    });
            }
            else {
                masterPromise.reject(ex);
            }
        });

    return masterPromise;
};


SharedLocalKVStorage.Utils.DexieStorage.prototype.setItem = function __SLKVSetItem(k, v) {
    'use strict';
    console.assert(v !== undefined);

    delete this.delcache[k];
    this.newcache[k] = v;

    if (this.manualFlush) {
        return MegaPromise.resolve();
    }

    return this.flush();
};

// get item - if not found, promise will be rejected
SharedLocalKVStorage.Utils.DexieStorage.prototype.getItem = function __SLKVGetItem(k) {
    'use strict';
    var self = this;
    return new MegaPromise(function(resolve, reject) {

        if (!self.delcache[k]) {
            if (self.newcache[k] !== undefined) {
                // record recently (over)written
                return resolve(self.newcache[k]);
            }

            // record available in DB
            if (self.dbcache[k] !== undefined) {
                return resolve(self.dbcache[k]);
            }
        }

        if (self.memoize) {
            // record deleted or unavailable
            return reject();
        }

        self.db.kv.where('k').equals(self._encryptKey(k)).toArray()
            .then(function(r) {
                if (!r.length) {
                    // record deleted or unavailable
                    return reject();
                }

                resolve(self._decryptValue(r[0].v));
            })
            .catch(reject);
    });
};

SharedLocalKVStorage.Utils.DexieStorage.prototype.keys = function __SLKVKeys(prefix) {
    'use strict';
    var self = this;
    return new MegaPromise(function(resolve, reject) {
        var filter = function(k) {
            return (prefix ? k.startsWith(prefix) : true) && self.delcache[k] === undefined;
        };

        if (self.memoize) {
            var keys = Object.keys(Object.assign({}, self.dbcache, self.newcache));
            return resolve(keys.filter(filter));
        }

        self.db.kv.orderBy('k').keys()
            .then(function(keys) {
                resolve(keys.map(self._decryptKey.bind(self)).filter(filter));
            })
            .catch(reject);
    });
};

// check if item exists
SharedLocalKVStorage.Utils.DexieStorage.prototype.hasItem = function __SLKVHasItem(k) {
    'use strict';
    var self = this;
    return new MegaPromise(function(resolve, reject) {
        if (!self.delcache[k] && (self.newcache[k] !== undefined || self.dbcache[k] !== undefined)) {
            return resolve();
        }

        if (self.memoize) {
            return reject();
        }

        self.db.kv.where('k').equals(self._encryptKey(k)).keys()
            .then(function(r) {
                if (r.length) {
                    return resolve();
                }
                reject();
            })
            .catch(reject);
    });
};

SharedLocalKVStorage.Utils.DexieStorage.prototype.removeItem = function __SLKVRemoveItem(k, expunge) {
    'use strict';
    var self = this;
    expunge = expunge === true;
    if (d) {
        this.logger.debug(`removeItem(${JSON.stringify(k)})`, expunge, this.memoize, this.manualFlush);
    }

    if (!expunge && self.memoize && this.newcache[k] === undefined && this.dbcache[k] === undefined) {
        return MegaPromise.reject();
    }

    this.delcache[k] = true;
    delete this.newcache[k];
    delete this.dbcache[k];

    if (!expunge) {
        return this.flush();
    }

    return new MegaPromise(function(resolve, reject) {
        self.flush().then(function() {
            return self.db.kv.count();
        }).then(function(num) {
            if (d && !num) {
                console.assert(!$.len(Object.assign({}, self.dbcache, self.newcache)));
            }
            return num ? num : self._destroy();
        }).then(resolve).catch(reject);
    });
};

/**
 * Iterate over all items, with prefix.
 *
 * Note: Case sensitive.
 *
 * @param {String} prefix that would be used for filtering the data
 * @param {Function} [each] callback(value, key)
 * @returns {MegaPromise} promise
 */
SharedLocalKVStorage.Utils.DexieStorage.prototype.eachPrefixItem = function __SLKVEachItem(prefix, each) {
    'use strict';
    return new MegaPromise((resolve, reject) => {

        let count = 0;
        const res = Object.create(null);

        if (this.memoize) {
            Object.assign(res, this.dbcache, this.newcache);

            for (const key in res) {
                if (this.delcache[key] || !key.startsWith(prefix)) {
                    delete res[key];
                }
                else {
                    if (each) {
                        each(res[key], key);
                    }
                    ++count;
                }
            }

            return count ? resolve(res) : reject(ENOENT);
        }

        this.db.kv.toArray()
            .then((r) => {

                for (let i = r.length; i--;) {
                    const k = this._decryptKey(r[i].k);

                    if (k.startsWith(prefix)) {
                        res[k] = this._decryptValue(r[i].v);

                        if (each) {
                            each(res[k], k);
                        }
                        ++count;
                    }
                }

                return count ? resolve(res) : reject(ENOENT);
            })
            .catch(reject);
    });
};

/**
 * Drops the local db
 */
SharedLocalKVStorage.Utils.DexieStorage.prototype.destroy = function __SLKVDestroy() {
    'use strict';
    return new MegaPromise((resolve, reject) => {

        this._reinitCache();
        this.dbState = SharedLocalKVStorage.DB_STATE.NOT_READY;

        return 'db' in this ? this.db.delete().then(resolve).catch(reject) : resolve();
    });
};

/**
 * Re/Initialises the local in memory cache
 */
SharedLocalKVStorage.Utils.DexieStorage.prototype._reinitCache = function __SLKVReinitCache() {
    'use strict';
    this.dbcache = Object.create(null);     // items that reside in the DB
    this.newcache = Object.create(null);    // new items that are pending flushing to the DB
    this.delcache = Object.create(null);    // delete items that are pending deletion from the DB
};


/**
 * Clear DB contents.
 * @returns {MegaPromise}
 */
SharedLocalKVStorage.Utils.DexieStorage.prototype.clear = function __SLKVClear() {
    var self = this;

    var promise = new MegaPromise();

    self.db.kv.clear()
        .catch(function (e) {
            self.logger.error("clear failed: ", arguments, e.stack);
            self._reinitCache();
            promise.reject(e);
        })
        .finally(function () {
            self._reinitCache();
            promise.resolve();
        });

    return promise;
};

SharedLocalKVStorage.Utils.DexieStorage.prototype.close = function __SLKVClose() {
    var self = this;
    var oldState = self.dbState;
    self.dbState = SharedLocalKVStorage.DB_STATE.NOT_READY;
    if (oldState === SharedLocalKVStorage.DB_STATE.READY) {
        self.db.close();
    }
    self.db = null;
    self._reinitCache();
};

/**
 * So that the code in the file is more easy to debug via IDEs, the
 * SharedLocalKVStorage.Utils.DexieStorage._requiresDbReady wrapper is going to wrap the required functions in runtime
 * Guarantee that promise-returning methods are executed one after another.
 */
(function __monkeyPatch(proto) {
    'use strict';
    // eslint-disable-next-line local-rules/misc-warnings
    Object.keys(proto)
        .filter(function(n) {
            return n[0] !== '_';
        })
        .forEach(function(methodName) {
            var origFunc = SharedLocalKVStorage.Utils._requiresDbReady(proto[methodName], methodName);

            if (methodName !== 'flush') {
                if (methodName === 'destroy' /* || ... */) {
                    // to be used under an already acquired lock.
                    Object.defineProperty(proto, '_' + methodName, {value: proto[methodName]});
                }
                origFunc = SharedLocalKVStorage.Utils._requiresMutex(origFunc, methodName);
            }

            proto[methodName] = origFunc;

            var short = methodName.replace(/[A-Z].*/, '');
            if (short !== methodName) {
                Object.defineProperty(proto, short, {value: proto[methodName]});
            }
        });
})(SharedLocalKVStorage.Utils.DexieStorage.prototype);

/**
 * @fileOverview
 * Storage of key/value pairs in a "container".
 */

/** @property window.tlvstore */
lazy(self, 'tlvstore', () => {
    "use strict";

    /**
     * @description
     * <p>Storage of key/value pairs in a "container".</p>
     *
     * <p>
     * Stores a set of key/value pairs in a binary container format suitable for
     * encrypted storage of private attributes</p>
     *
     * <p>
     * TLV records start with the key as a "tag" (ASCII string), terminated by a
     * NULL character (\u0000). The length of the payload is encoded as a 16-bit
     * unsigned integer in big endian format (2 bytes), followed by the payload
     * (as a byte string). The payload *must* contain 8-bit values for each
     * character only!</p>
     */
    const ns = {
        _logger: MegaLogger.getLogger('tlvstore')
    };
    const hasOwn = {}.hasOwnProperty;
    const SYMBOL = Symbol('~~TLV~~');

    const getKey = (key) => {
        if (Array.isArray(key)) {
            // Key is in the form of an array of four 32-bit words.
            key = new Uint32Array(key);
            const u8 = new Uint8Array(key.byteLength);
            const dv = new DataView(u8.buffer);

            for (let i = 0; i < key.length; ++i) {
                dv.setUint32(i * 4, key[i], false);
            }
            key = u8;
        }
        else if (typeof key === 'string') {
            key = Uint8Array.from(key, ch => ch.charCodeAt(0));
        }

        return key;
    };

    const te = new TextEncoder();
    const td = new TextDecoder();

    /**
     * Generates a binary encoded TLV record from a key-value pair.
     *
     * @param key {string}
     *     ASCII string label of record's key.
     * @param value {string}
     *     Byte string payload of record.
     * @param {Boolean} utf8 Require UTF-8 conversion.
     * @returns {string}
     *     Single binary encoded TLV record.
     * @private
     */
    ns.toTlvRecord = function(key, value, utf8) {
        if (utf8) {
            value = asmCrypto.bytes_to_string(te.encode(value));
        }
        if (value.length > 65535) {
            if (typeof eventlog === 'function') {
                eventlog(99772, JSON.stringify([1, 1, key.length, value.length, utf8 | 0]), true);
            }
            this._logger.warn(`TLV-record ${key} did overflow.`, utf8);
        }
        const length = Math.min(65535, value.length);
        return `${key}\u0000${String.fromCharCode(length >>> 8)}${String.fromCharCode(length & 0xff)}${value}`;
    };

    /**
     * Generates a binary encoded TLV element from a key-value pair.
     * There is no separator in between and the length is fixted 2 bytes.
     * If the length of the value is bigger than 0xffff, then it will use 0xffff
     * as the length, and append the value after.
     *
     * @param key {string}
     *     ASCII string label of record's key.
     * @param value {string}
     *     Byte string payload of record.
     * @returns {string}
     *     Single binary encoded TLV record.
     * @private
     */
    ns.toTlvElement = function(key, value) {
        var length = String.fromCharCode(value.length >>> 8)
                   + String.fromCharCode(value.length & 0xff);
        if (value.length > 0xffff) {
            length = String.fromCharCode(0xff)
                   + String.fromCharCode(0xff);
        }
        return key + length + value;
    };

    /**
     * Generates a binary encoded TLV record container from an object containing
     * key-value pairs.
     *
     * @param container {object}
     *     Object containing (non-nested) key-value pairs. The keys have to be ASCII
     *     strings, the values byte strings.
     * @param {Boolean} [utf8] Require UTF-8 conversion.
     * @returns {string}
     *     Single binary encoded container of TLV records.
     */
    ns.containerToTlvRecords = function(container, utf8) {
        var result = '';
        let safe = true;
        for (var key in container) {
            if (hasOwn.call(container, key)) {
                const type = typeof container[key];

                if (type !== 'string') {
                    this._logger.error(`Invalid type for element '${key}'. Expected string but got ${type}.`);
                    return false;
                }
                if (safe !== true) {
                    if (typeof eventlog === 'function') {
                        eventlog(99772, JSON.stringify([1, 3, result.length]));
                    }
                    this._logger.error(`Cannot store ${key}, previous element did overflow.`);
                    return false;
                }
                const record = ns.toTlvRecord(key, container[key], utf8);

                result += record;
                safe = record.length < 65538 + key.length;
            }
        }
        return result;
    };


    /**
     * Splits and decodes a TLV record off of a container into a key-value pair and
     * returns the record and the rest.
     *
     * @param tlvContainer {String}
     *     Single binary encoded container of TLV records.
     * @returns {Object|Boolean}
     *     Object containing two elements: `record` contains an array of two
     *     elements (key and value of the decoded TLV record) and `rest` containing
     *     the remainder of the tlvContainer still to decode. In case of decoding
     *     errors, `false` is returned.
     */
    ns.splitSingleTlvRecord = function(tlvContainer) {
        var keyLength = tlvContainer.indexOf('\u0000');
        var key = tlvContainer.substring(0, keyLength);
        var valueLength = (tlvContainer.charCodeAt(keyLength + 1)) << 8
                        | tlvContainer.charCodeAt(keyLength + 2);
        var value = tlvContainer.substring(keyLength + 3, keyLength + valueLength + 3);

        // @todo what if the value did not overflow but was exactly 65535 bytes (?)..
        if (valueLength === 0xffff) {
            value = tlvContainer.substring(keyLength + 3);
            valueLength = value.length;
        }
        var rest = tlvContainer.substring(keyLength + valueLength + 3);

        // Consistency checks.
        if ((valueLength !== value.length)
                || (rest.length !== tlvContainer.length - (keyLength + valueLength + 3))) {
            ns._logger.info('Inconsistent TLV decoding. Maybe content UTF-8 encoded?');

            return false;
        }

        return { 'record': [key, value], 'rest': rest };
    };

    /**
     * Splits and decodes a TLV element off of a container into a key-value pair and
     * returns the element and the rest.
     * Note: if the length is 0xffff, which means the appended value is longer than 0xffff,
     * it means the rest is the value.
     *
     * @param tlvContainer {String}
     *     Single binary encoded container of TLV elements.
     * @returns {Object|Boolean}
     *     Object containing two parts: `element` contains an array of two
     *      (key and value of the decoded TLV element) and `rest` containing
     *     the remainder of the tlvContainer still to decode. In case of decoding
     *     errors, `false` is returned.
     */
    ns.splitSingleTlvElement = function(tlvContainer) {
        var keyLength = 1;
        var key = tlvContainer.substring(0, keyLength);
        var valueLength = (tlvContainer.charCodeAt(keyLength)) << 8
                        | tlvContainer.charCodeAt(keyLength + 1);
        var value = tlvContainer.substring(keyLength + 2, keyLength + valueLength + 2);

        if (valueLength === 0xffff) {
            value = tlvContainer.substring(keyLength + 2);
            valueLength = value.length;
        }
        var rest = tlvContainer.substring(keyLength + valueLength + 2);
        // Consistency checks.
        if ((valueLength !== value.length)
                || (rest.length !== tlvContainer.length - (keyLength + valueLength + 2))) {
            ns._logger.info('Inconsistent TLV decoding. Maybe content UTF-8 encoded?');

            return false;
        }

        return { 'record': [key, value], 'rest': rest };
    };

    /**
     * Decodes a binary encoded container of TLV records into an object
     * representation.
     *
     * @param tlvContainer {String}
     *     Single binary encoded container of TLV records.
     * @param [utf8LegacySafe] {Boolean}
     *     Single binary encoded container of TLV records.
     * @returns {Object|Boolean}
     *     Object containing (non-nested) key-value pairs. `false` in case of
     *     failing TLV decoding.
     */
    ns.tlvRecordsToContainer = function(tlvContainer, utf8LegacySafe) {
        let rest = tlvContainer;
        let container = Object.create(null);

        if (!rest.charCodeAt(0) && rest.length > 65538) {
            this._logger.warn('tlv-record overflow fix-up.', [rest]);

            if (typeof eventlog === 'function') {
                eventlog(99772, JSON.stringify([1, 7, rest.length]), true);
            }

            return {'': rest.substr(3)};
        }

        while (rest.length > 0) {
            var result = ns.splitSingleTlvRecord(rest);
            if (result === false) {
                container = false;
                break;
            }
            container[result.record[0]] = result.record[1];
            rest = result.rest;
        }

        if (utf8LegacySafe && (container === false)) {
            // Treat the legacy case and first UTF-8 decode the container content.
            ns._logger.info('Retrying to decode TLV container legacy style ...');

            return ns.tlvRecordsToContainer(from8(tlvContainer), false);
        }

        return container;
    };


    /**
     * "Enumeration" of block cipher encryption schemes for private attribute
     * containers.
     *
     * @property AES_CCM_12_16 {integer}
     *     AES in CCM mode, 12 byte IV/nonce and 16 byte MAC.
     * @property AES_CCM_10_16 {integer}
     *     AES in CCM mode, 10 byte IV/nonce and 16 byte MAC.
     * @property AES_CCM_10_08 {integer}
     *     AES in CCM mode, 10 byte IV/nonce and 8 byte MAC.
     * @property AES_GCM_12_16 {integer}
     *     AES in CCM mode, 12 byte IV/nonce and 16 byte MAC.
     * @property AES_GCM_10_08 {integer}
     *     AES in CCM mode, 10 byte IV/nonce and 8 byte MAC.
     */
    ns.BLOCK_ENCRYPTION_SCHEME = {
        AES_CCM_12_16: 0x00,
        AES_CCM_10_16: 0x01,
        AES_CCM_10_08: 0x02,
        AES_GCM_12_16_BROKEN: 0x03, // Same as 0x00 (not GCM, due to a legacy bug).
        AES_GCM_10_08_BROKEN: 0x04, // Same as 0x02 (not GCM, due to a legacy bug).
        AES_GCM_12_16: 0x10,
        AES_GCM_10_08: 0x11
    };


    /**
     * Parameters for supported block cipher encryption schemes.
     */
    ns.BLOCK_ENCRYPTION_PARAMETERS = {
        0x00: {nonceSize: 12, macSize: 16, cipher: 'AES_CCM'}, // BLOCK_ENCRYPTION_SCHEME.AES_CCM_12_16
        0x01: {nonceSize: 10, macSize: 16, cipher: 'AES_CCM'}, // BLOCK_ENCRYPTION_SCHEME.AES_CCM_10_16
        0x02: {nonceSize: 10, macSize:  8, cipher: 'AES_CCM'}, // BLOCK_ENCRYPTION_SCHEME.AES_CCM_10_08
        0x03: {nonceSize: 12, macSize: 16, cipher: 'AES_CCM'}, // Same as 0x00 (due to a legacy bug).
        0x04: {nonceSize: 10, macSize:  8, cipher: 'AES_CCM'}, // Same as 0x02 (due to a legacy bug).
        0x10: {nonceSize: 12, macSize: 16, cipher: 'AES_GCM'}, // BLOCK_ENCRYPTION_SCHEME.AES_GCM_12_16
        0x11: {nonceSize: 10, macSize:  8, cipher: 'AES_GCM'}  // BLOCK_ENCRYPTION_SCHEME.AES_GCM_10_08
    };


    /**
     * Encrypts clear text data to an authenticated ciphertext, armoured with
     * encryption mode indicator and IV.
     *
     * @param clearText {String}
     *     Clear text as byte string.
     * @param {String|Array|ArrayBufferLike} key
     *     Encryption key as byte string.
     * @param mode {Number}
     *     Encryption mode as an integer. One of tlvstore.BLOCK_ENCRYPTION_SCHEME.
     * @param [utf8Convert] {Boolean}
     *     Perform UTF-8 conversion of clear text before encryption (default: false).
     * @returns {String}
     *     Encrypted data block as byte string, incorporating mode, nonce and MAC.
     */
    ns.blockEncrypt = function(clearText, key, mode, utf8Convert) {

        const {nonceSize, macSize, cipher} = this.BLOCK_ENCRYPTION_PARAMETERS[mode];
        const nonce = mega.getRandomValues(nonceSize);

        const clearBytes = asmCrypto.string_to_bytes(clearText, utf8Convert);
        const cipherBytes = asmCrypto[cipher].encrypt(clearBytes, getKey(key), nonce, undefined, macSize);

        return String.fromCharCode(mode) + asmCrypto.bytes_to_string(nonce) + asmCrypto.bytes_to_string(cipherBytes);
    };


    /**
     * Decrypts an authenticated cipher text armoured with a mode indicator and IV
     * to clear text data.
     *
     * @param cipherText {String}
     *     Encrypted data block as byte string, incorporating mode, nonce and MAC.
     * @param key {String}
     *     Encryption key as byte string.
     * @param [utf8Convert] {Boolean}
     *     Perform UTF-8 conversion of clear text after decryption (default: false).
     * @returns {String}
     *     Clear text as byte string.
     */
    ns.blockDecrypt = function(cipherText, key, utf8Convert) {

        var mode = cipherText.charCodeAt(0);
        var nonceSize = ns.BLOCK_ENCRYPTION_PARAMETERS[mode].nonceSize;
        var nonceBytes = asmCrypto.string_to_bytes(cipherText.substring(1, nonceSize + 1));
        var cipherBytes = asmCrypto.string_to_bytes(cipherText.substring(nonceSize + 1));
        var tagSize = ns.BLOCK_ENCRYPTION_PARAMETERS[mode].macSize;
        var cipher = asmCrypto[ns.BLOCK_ENCRYPTION_PARAMETERS[mode].cipher];

        const clearBytes = cipher.decrypt(cipherBytes, getKey(key), nonceBytes, undefined, tagSize);
        return asmCrypto.bytes_to_string(clearBytes, utf8Convert);
    };

    /**
     * Encrypts data to an authenticated ciphertext, armoured with encryption mode indicator and IV.
     *
     * @param {String|Object} payload plain string or key/value pairs to encrypt
     * @param {Boolean} [utf8] Whether to take UTF-8 into account (default: true)
     * @param {Array|String|Uint8Array|*} [key] Encryption key.
     * @param {Number} [mode] Encryption scheme, AES GCM 12/16 by default.
     * @returns {String} encrypted payload.
     * @memberOf tlvstore
     */
    ns.encrypt = function(payload, utf8, key, mode) {
        utf8 = utf8 !== false;

        if (typeof payload !== 'object') {
            payload = {'': String(payload)};
        }
        payload = this.containerToTlvRecords(payload, utf8);

        if (key !== SYMBOL) {
            if (mode === undefined) {
                mode = this.BLOCK_ENCRYPTION_SCHEME.AES_GCM_12_16;
            }
            payload = this.blockEncrypt(payload, getKey(key || self.u_k), mode);
        }

        return base64urlencode(payload);
    };

    /**
     * Decrypts an authenticated cipher text armoured with a mode indicator and IV.
     *
     * @param {String} payload Encrypted cipher text payload
     * @param {Boolean} [utf8] Whether to take UTF-8 into account (default: true)
     * @param {Array|String|Uint8Array} [key] Encryption key.
     * @returns {String|Object} decrypted payload as initially provided, string or key/value pairs
     * @memberOf tlvstore
     */
    ns.decrypt = function(payload, utf8, key) {
        const obj = Object.create(null);

        utf8 = utf8 !== false;
        payload = base64urldecode(payload);

        if (key !== SYMBOL) {
            payload = this.blockDecrypt(payload, getKey(key || self.u_k));
        }

        while (payload.length > 0) {
            const res = ns.splitSingleTlvRecord(payload);
            if (!res) {
                return false;
            }
            let [key, value] = res.record;

            if (utf8) {
                value = td.decode(Uint8Array.from(value, ch => ch.charCodeAt(0)));
            }
            obj[key] = value;

            payload = res.rest;
        }

        return obj[''] || obj;
    };

    /**
     * Generates an encoded TLV record container from an object containing key-value pairs.
     * @param {String|Object} payload plain string or key/value pairs to encode.
     * @param {Boolean} [utf8] Whether to take UTF-8 into account (default: true)
     * @returns {String} Single binary encoded container of TLV records.
     * @memberOf tlvstore
     */
    ns.encode = function(payload, utf8) {
        return this.encrypt(payload, utf8, SYMBOL);
    };

    /**
     * Decodes a binary encoded container of TLV records into an object representation.
     * @param {String} payload Single binary encoded container of TLV records.
     * @param {Boolean} [utf8] Whether to take UTF-8 into account (default: true)
     * @return {Object|String} original plain string or key/value pairs encoded.
     * @memberOf tlvstore
     */
    ns.decode = function(payload, utf8) {
        return this.decrypt(payload, utf8, SYMBOL);
    };


    if (!window.is_karma) {
        Object.setPrototypeOf(ns, null);
        return Object.freeze(ns);
    }

    return ns;
});

(function(nacl) {
'use strict';

// Ported in 2014 by Dmitry Chestnykh and Devi Mandiri.
// Public domain.
//
// Implementation derived from TweetNaCl version 20140427.
// See for details: http://tweetnacl.cr.yp.to/

/* jshint newcap: false */

var gf = function(init) {
  var i, r = new Float64Array(16);
  if (init) for (i = 0; i < init.length; i++) r[i] = init[i];
  return r;
};

//  Pluggable, initialized in high-level API below.
var randombytes = function(/* x, n */) { throw new Error('no PRNG'); };

var _0 = new Uint8Array(16);
var _9 = new Uint8Array(32); _9[0] = 9;

var gf0 = gf(),
    gf1 = gf([1]),
    _121665 = gf([0xdb41, 1]),
    D = gf([0x78a3, 0x1359, 0x4dca, 0x75eb, 0xd8ab, 0x4141, 0x0a4d, 0x0070, 0xe898, 0x7779, 0x4079, 0x8cc7, 0xfe73, 0x2b6f, 0x6cee, 0x5203]),
    D2 = gf([0xf159, 0x26b2, 0x9b94, 0xebd6, 0xb156, 0x8283, 0x149a, 0x00e0, 0xd130, 0xeef3, 0x80f2, 0x198e, 0xfce7, 0x56df, 0xd9dc, 0x2406]),
    X = gf([0xd51a, 0x8f25, 0x2d60, 0xc956, 0xa7b2, 0x9525, 0xc760, 0x692c, 0xdc5c, 0xfdd6, 0xe231, 0xc0a4, 0x53fe, 0xcd6e, 0x36d3, 0x2169]),
    Y = gf([0x6658, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666]),
    I = gf([0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83]);

function ts64(x, i, h, l) {
  x[i]   = (h >> 24) & 0xff;
  x[i+1] = (h >> 16) & 0xff;
  x[i+2] = (h >>  8) & 0xff;
  x[i+3] = h & 0xff;
  x[i+4] = (l >> 24)  & 0xff;
  x[i+5] = (l >> 16)  & 0xff;
  x[i+6] = (l >>  8)  & 0xff;
  x[i+7] = l & 0xff;
}

function vn(x, xi, y, yi, n) {
  var i,d = 0;
  for (i = 0; i < n; i++) d |= x[xi+i]^y[yi+i];
  return (1 & ((d - 1) >>> 8)) - 1;
}

function crypto_verify_16(x, xi, y, yi) {
  return vn(x,xi,y,yi,16);
}

function crypto_verify_32(x, xi, y, yi) {
  return vn(x,xi,y,yi,32);
}

function core_salsa20(o, p, k, c) {
  var j0  = c[ 0] & 0xff | (c[ 1] & 0xff)<<8 | (c[ 2] & 0xff)<<16 | (c[ 3] & 0xff)<<24,
      j1  = k[ 0] & 0xff | (k[ 1] & 0xff)<<8 | (k[ 2] & 0xff)<<16 | (k[ 3] & 0xff)<<24,
      j2  = k[ 4] & 0xff | (k[ 5] & 0xff)<<8 | (k[ 6] & 0xff)<<16 | (k[ 7] & 0xff)<<24,
      j3  = k[ 8] & 0xff | (k[ 9] & 0xff)<<8 | (k[10] & 0xff)<<16 | (k[11] & 0xff)<<24,
      j4  = k[12] & 0xff | (k[13] & 0xff)<<8 | (k[14] & 0xff)<<16 | (k[15] & 0xff)<<24,
      j5  = c[ 4] & 0xff | (c[ 5] & 0xff)<<8 | (c[ 6] & 0xff)<<16 | (c[ 7] & 0xff)<<24,
      j6  = p[ 0] & 0xff | (p[ 1] & 0xff)<<8 | (p[ 2] & 0xff)<<16 | (p[ 3] & 0xff)<<24,
      j7  = p[ 4] & 0xff | (p[ 5] & 0xff)<<8 | (p[ 6] & 0xff)<<16 | (p[ 7] & 0xff)<<24,
      j8  = p[ 8] & 0xff | (p[ 9] & 0xff)<<8 | (p[10] & 0xff)<<16 | (p[11] & 0xff)<<24,
      j9  = p[12] & 0xff | (p[13] & 0xff)<<8 | (p[14] & 0xff)<<16 | (p[15] & 0xff)<<24,
      j10 = c[ 8] & 0xff | (c[ 9] & 0xff)<<8 | (c[10] & 0xff)<<16 | (c[11] & 0xff)<<24,
      j11 = k[16] & 0xff | (k[17] & 0xff)<<8 | (k[18] & 0xff)<<16 | (k[19] & 0xff)<<24,
      j12 = k[20] & 0xff | (k[21] & 0xff)<<8 | (k[22] & 0xff)<<16 | (k[23] & 0xff)<<24,
      j13 = k[24] & 0xff | (k[25] & 0xff)<<8 | (k[26] & 0xff)<<16 | (k[27] & 0xff)<<24,
      j14 = k[28] & 0xff | (k[29] & 0xff)<<8 | (k[30] & 0xff)<<16 | (k[31] & 0xff)<<24,
      j15 = c[12] & 0xff | (c[13] & 0xff)<<8 | (c[14] & 0xff)<<16 | (c[15] & 0xff)<<24;

  var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7,
      x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14,
      x15 = j15, u;

  for (var i = 0; i < 20; i += 2) {
    u = x0 + x12 | 0;
    x4 ^= u<<7 | u>>>(32-7);
    u = x4 + x0 | 0;
    x8 ^= u<<9 | u>>>(32-9);
    u = x8 + x4 | 0;
    x12 ^= u<<13 | u>>>(32-13);
    u = x12 + x8 | 0;
    x0 ^= u<<18 | u>>>(32-18);

    u = x5 + x1 | 0;
    x9 ^= u<<7 | u>>>(32-7);
    u = x9 + x5 | 0;
    x13 ^= u<<9 | u>>>(32-9);
    u = x13 + x9 | 0;
    x1 ^= u<<13 | u>>>(32-13);
    u = x1 + x13 | 0;
    x5 ^= u<<18 | u>>>(32-18);

    u = x10 + x6 | 0;
    x14 ^= u<<7 | u>>>(32-7);
    u = x14 + x10 | 0;
    x2 ^= u<<9 | u>>>(32-9);
    u = x2 + x14 | 0;
    x6 ^= u<<13 | u>>>(32-13);
    u = x6 + x2 | 0;
    x10 ^= u<<18 | u>>>(32-18);

    u = x15 + x11 | 0;
    x3 ^= u<<7 | u>>>(32-7);
    u = x3 + x15 | 0;
    x7 ^= u<<9 | u>>>(32-9);
    u = x7 + x3 | 0;
    x11 ^= u<<13 | u>>>(32-13);
    u = x11 + x7 | 0;
    x15 ^= u<<18 | u>>>(32-18);

    u = x0 + x3 | 0;
    x1 ^= u<<7 | u>>>(32-7);
    u = x1 + x0 | 0;
    x2 ^= u<<9 | u>>>(32-9);
    u = x2 + x1 | 0;
    x3 ^= u<<13 | u>>>(32-13);
    u = x3 + x2 | 0;
    x0 ^= u<<18 | u>>>(32-18);

    u = x5 + x4 | 0;
    x6 ^= u<<7 | u>>>(32-7);
    u = x6 + x5 | 0;
    x7 ^= u<<9 | u>>>(32-9);
    u = x7 + x6 | 0;
    x4 ^= u<<13 | u>>>(32-13);
    u = x4 + x7 | 0;
    x5 ^= u<<18 | u>>>(32-18);

    u = x10 + x9 | 0;
    x11 ^= u<<7 | u>>>(32-7);
    u = x11 + x10 | 0;
    x8 ^= u<<9 | u>>>(32-9);
    u = x8 + x11 | 0;
    x9 ^= u<<13 | u>>>(32-13);
    u = x9 + x8 | 0;
    x10 ^= u<<18 | u>>>(32-18);

    u = x15 + x14 | 0;
    x12 ^= u<<7 | u>>>(32-7);
    u = x12 + x15 | 0;
    x13 ^= u<<9 | u>>>(32-9);
    u = x13 + x12 | 0;
    x14 ^= u<<13 | u>>>(32-13);
    u = x14 + x13 | 0;
    x15 ^= u<<18 | u>>>(32-18);
  }
   x0 =  x0 +  j0 | 0;
   x1 =  x1 +  j1 | 0;
   x2 =  x2 +  j2 | 0;
   x3 =  x3 +  j3 | 0;
   x4 =  x4 +  j4 | 0;
   x5 =  x5 +  j5 | 0;
   x6 =  x6 +  j6 | 0;
   x7 =  x7 +  j7 | 0;
   x8 =  x8 +  j8 | 0;
   x9 =  x9 +  j9 | 0;
  x10 = x10 + j10 | 0;
  x11 = x11 + j11 | 0;
  x12 = x12 + j12 | 0;
  x13 = x13 + j13 | 0;
  x14 = x14 + j14 | 0;
  x15 = x15 + j15 | 0;

  o[ 0] = x0 >>>  0 & 0xff;
  o[ 1] = x0 >>>  8 & 0xff;
  o[ 2] = x0 >>> 16 & 0xff;
  o[ 3] = x0 >>> 24 & 0xff;

  o[ 4] = x1 >>>  0 & 0xff;
  o[ 5] = x1 >>>  8 & 0xff;
  o[ 6] = x1 >>> 16 & 0xff;
  o[ 7] = x1 >>> 24 & 0xff;

  o[ 8] = x2 >>>  0 & 0xff;
  o[ 9] = x2 >>>  8 & 0xff;
  o[10] = x2 >>> 16 & 0xff;
  o[11] = x2 >>> 24 & 0xff;

  o[12] = x3 >>>  0 & 0xff;
  o[13] = x3 >>>  8 & 0xff;
  o[14] = x3 >>> 16 & 0xff;
  o[15] = x3 >>> 24 & 0xff;

  o[16] = x4 >>>  0 & 0xff;
  o[17] = x4 >>>  8 & 0xff;
  o[18] = x4 >>> 16 & 0xff;
  o[19] = x4 >>> 24 & 0xff;

  o[20] = x5 >>>  0 & 0xff;
  o[21] = x5 >>>  8 & 0xff;
  o[22] = x5 >>> 16 & 0xff;
  o[23] = x5 >>> 24 & 0xff;

  o[24] = x6 >>>  0 & 0xff;
  o[25] = x6 >>>  8 & 0xff;
  o[26] = x6 >>> 16 & 0xff;
  o[27] = x6 >>> 24 & 0xff;

  o[28] = x7 >>>  0 & 0xff;
  o[29] = x7 >>>  8 & 0xff;
  o[30] = x7 >>> 16 & 0xff;
  o[31] = x7 >>> 24 & 0xff;

  o[32] = x8 >>>  0 & 0xff;
  o[33] = x8 >>>  8 & 0xff;
  o[34] = x8 >>> 16 & 0xff;
  o[35] = x8 >>> 24 & 0xff;

  o[36] = x9 >>>  0 & 0xff;
  o[37] = x9 >>>  8 & 0xff;
  o[38] = x9 >>> 16 & 0xff;
  o[39] = x9 >>> 24 & 0xff;

  o[40] = x10 >>>  0 & 0xff;
  o[41] = x10 >>>  8 & 0xff;
  o[42] = x10 >>> 16 & 0xff;
  o[43] = x10 >>> 24 & 0xff;

  o[44] = x11 >>>  0 & 0xff;
  o[45] = x11 >>>  8 & 0xff;
  o[46] = x11 >>> 16 & 0xff;
  o[47] = x11 >>> 24 & 0xff;

  o[48] = x12 >>>  0 & 0xff;
  o[49] = x12 >>>  8 & 0xff;
  o[50] = x12 >>> 16 & 0xff;
  o[51] = x12 >>> 24 & 0xff;

  o[52] = x13 >>>  0 & 0xff;
  o[53] = x13 >>>  8 & 0xff;
  o[54] = x13 >>> 16 & 0xff;
  o[55] = x13 >>> 24 & 0xff;

  o[56] = x14 >>>  0 & 0xff;
  o[57] = x14 >>>  8 & 0xff;
  o[58] = x14 >>> 16 & 0xff;
  o[59] = x14 >>> 24 & 0xff;

  o[60] = x15 >>>  0 & 0xff;
  o[61] = x15 >>>  8 & 0xff;
  o[62] = x15 >>> 16 & 0xff;
  o[63] = x15 >>> 24 & 0xff;
}

function core_hsalsa20(o,p,k,c) {
  var j0  = c[ 0] & 0xff | (c[ 1] & 0xff)<<8 | (c[ 2] & 0xff)<<16 | (c[ 3] & 0xff)<<24,
      j1  = k[ 0] & 0xff | (k[ 1] & 0xff)<<8 | (k[ 2] & 0xff)<<16 | (k[ 3] & 0xff)<<24,
      j2  = k[ 4] & 0xff | (k[ 5] & 0xff)<<8 | (k[ 6] & 0xff)<<16 | (k[ 7] & 0xff)<<24,
      j3  = k[ 8] & 0xff | (k[ 9] & 0xff)<<8 | (k[10] & 0xff)<<16 | (k[11] & 0xff)<<24,
      j4  = k[12] & 0xff | (k[13] & 0xff)<<8 | (k[14] & 0xff)<<16 | (k[15] & 0xff)<<24,
      j5  = c[ 4] & 0xff | (c[ 5] & 0xff)<<8 | (c[ 6] & 0xff)<<16 | (c[ 7] & 0xff)<<24,
      j6  = p[ 0] & 0xff | (p[ 1] & 0xff)<<8 | (p[ 2] & 0xff)<<16 | (p[ 3] & 0xff)<<24,
      j7  = p[ 4] & 0xff | (p[ 5] & 0xff)<<8 | (p[ 6] & 0xff)<<16 | (p[ 7] & 0xff)<<24,
      j8  = p[ 8] & 0xff | (p[ 9] & 0xff)<<8 | (p[10] & 0xff)<<16 | (p[11] & 0xff)<<24,
      j9  = p[12] & 0xff | (p[13] & 0xff)<<8 | (p[14] & 0xff)<<16 | (p[15] & 0xff)<<24,
      j10 = c[ 8] & 0xff | (c[ 9] & 0xff)<<8 | (c[10] & 0xff)<<16 | (c[11] & 0xff)<<24,
      j11 = k[16] & 0xff | (k[17] & 0xff)<<8 | (k[18] & 0xff)<<16 | (k[19] & 0xff)<<24,
      j12 = k[20] & 0xff | (k[21] & 0xff)<<8 | (k[22] & 0xff)<<16 | (k[23] & 0xff)<<24,
      j13 = k[24] & 0xff | (k[25] & 0xff)<<8 | (k[26] & 0xff)<<16 | (k[27] & 0xff)<<24,
      j14 = k[28] & 0xff | (k[29] & 0xff)<<8 | (k[30] & 0xff)<<16 | (k[31] & 0xff)<<24,
      j15 = c[12] & 0xff | (c[13] & 0xff)<<8 | (c[14] & 0xff)<<16 | (c[15] & 0xff)<<24;

  var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7,
      x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14,
      x15 = j15, u;

  for (var i = 0; i < 20; i += 2) {
    u = x0 + x12 | 0;
    x4 ^= u<<7 | u>>>(32-7);
    u = x4 + x0 | 0;
    x8 ^= u<<9 | u>>>(32-9);
    u = x8 + x4 | 0;
    x12 ^= u<<13 | u>>>(32-13);
    u = x12 + x8 | 0;
    x0 ^= u<<18 | u>>>(32-18);

    u = x5 + x1 | 0;
    x9 ^= u<<7 | u>>>(32-7);
    u = x9 + x5 | 0;
    x13 ^= u<<9 | u>>>(32-9);
    u = x13 + x9 | 0;
    x1 ^= u<<13 | u>>>(32-13);
    u = x1 + x13 | 0;
    x5 ^= u<<18 | u>>>(32-18);

    u = x10 + x6 | 0;
    x14 ^= u<<7 | u>>>(32-7);
    u = x14 + x10 | 0;
    x2 ^= u<<9 | u>>>(32-9);
    u = x2 + x14 | 0;
    x6 ^= u<<13 | u>>>(32-13);
    u = x6 + x2 | 0;
    x10 ^= u<<18 | u>>>(32-18);

    u = x15 + x11 | 0;
    x3 ^= u<<7 | u>>>(32-7);
    u = x3 + x15 | 0;
    x7 ^= u<<9 | u>>>(32-9);
    u = x7 + x3 | 0;
    x11 ^= u<<13 | u>>>(32-13);
    u = x11 + x7 | 0;
    x15 ^= u<<18 | u>>>(32-18);

    u = x0 + x3 | 0;
    x1 ^= u<<7 | u>>>(32-7);
    u = x1 + x0 | 0;
    x2 ^= u<<9 | u>>>(32-9);
    u = x2 + x1 | 0;
    x3 ^= u<<13 | u>>>(32-13);
    u = x3 + x2 | 0;
    x0 ^= u<<18 | u>>>(32-18);

    u = x5 + x4 | 0;
    x6 ^= u<<7 | u>>>(32-7);
    u = x6 + x5 | 0;
    x7 ^= u<<9 | u>>>(32-9);
    u = x7 + x6 | 0;
    x4 ^= u<<13 | u>>>(32-13);
    u = x4 + x7 | 0;
    x5 ^= u<<18 | u>>>(32-18);

    u = x10 + x9 | 0;
    x11 ^= u<<7 | u>>>(32-7);
    u = x11 + x10 | 0;
    x8 ^= u<<9 | u>>>(32-9);
    u = x8 + x11 | 0;
    x9 ^= u<<13 | u>>>(32-13);
    u = x9 + x8 | 0;
    x10 ^= u<<18 | u>>>(32-18);

    u = x15 + x14 | 0;
    x12 ^= u<<7 | u>>>(32-7);
    u = x12 + x15 | 0;
    x13 ^= u<<9 | u>>>(32-9);
    u = x13 + x12 | 0;
    x14 ^= u<<13 | u>>>(32-13);
    u = x14 + x13 | 0;
    x15 ^= u<<18 | u>>>(32-18);
  }

  o[ 0] = x0 >>>  0 & 0xff;
  o[ 1] = x0 >>>  8 & 0xff;
  o[ 2] = x0 >>> 16 & 0xff;
  o[ 3] = x0 >>> 24 & 0xff;

  o[ 4] = x5 >>>  0 & 0xff;
  o[ 5] = x5 >>>  8 & 0xff;
  o[ 6] = x5 >>> 16 & 0xff;
  o[ 7] = x5 >>> 24 & 0xff;

  o[ 8] = x10 >>>  0 & 0xff;
  o[ 9] = x10 >>>  8 & 0xff;
  o[10] = x10 >>> 16 & 0xff;
  o[11] = x10 >>> 24 & 0xff;

  o[12] = x15 >>>  0 & 0xff;
  o[13] = x15 >>>  8 & 0xff;
  o[14] = x15 >>> 16 & 0xff;
  o[15] = x15 >>> 24 & 0xff;

  o[16] = x6 >>>  0 & 0xff;
  o[17] = x6 >>>  8 & 0xff;
  o[18] = x6 >>> 16 & 0xff;
  o[19] = x6 >>> 24 & 0xff;

  o[20] = x7 >>>  0 & 0xff;
  o[21] = x7 >>>  8 & 0xff;
  o[22] = x7 >>> 16 & 0xff;
  o[23] = x7 >>> 24 & 0xff;

  o[24] = x8 >>>  0 & 0xff;
  o[25] = x8 >>>  8 & 0xff;
  o[26] = x8 >>> 16 & 0xff;
  o[27] = x8 >>> 24 & 0xff;

  o[28] = x9 >>>  0 & 0xff;
  o[29] = x9 >>>  8 & 0xff;
  o[30] = x9 >>> 16 & 0xff;
  o[31] = x9 >>> 24 & 0xff;
}

function crypto_core_salsa20(out,inp,k,c) {
  core_salsa20(out,inp,k,c);
}

function crypto_core_hsalsa20(out,inp,k,c) {
  core_hsalsa20(out,inp,k,c);
}

var sigma = new Uint8Array([101, 120, 112, 97, 110, 100, 32, 51, 50, 45, 98, 121, 116, 101, 32, 107]);
            // "expand 32-byte k"

function crypto_stream_salsa20_xor(c,cpos,m,mpos,b,n,k) {
  var z = new Uint8Array(16), x = new Uint8Array(64);
  var u, i;
  for (i = 0; i < 16; i++) z[i] = 0;
  for (i = 0; i < 8; i++) z[i] = n[i];
  while (b >= 64) {
    crypto_core_salsa20(x,z,k,sigma);
    for (i = 0; i < 64; i++) c[cpos+i] = m[mpos+i] ^ x[i];
    u = 1;
    for (i = 8; i < 16; i++) {
      u = u + (z[i] & 0xff) | 0;
      z[i] = u & 0xff;
      u >>>= 8;
    }
    b -= 64;
    cpos += 64;
    mpos += 64;
  }
  if (b > 0) {
    crypto_core_salsa20(x,z,k,sigma);
    for (i = 0; i < b; i++) c[cpos+i] = m[mpos+i] ^ x[i];
  }
  return 0;
}

function crypto_stream_salsa20(c,cpos,b,n,k) {
  var z = new Uint8Array(16), x = new Uint8Array(64);
  var u, i;
  for (i = 0; i < 16; i++) z[i] = 0;
  for (i = 0; i < 8; i++) z[i] = n[i];
  while (b >= 64) {
    crypto_core_salsa20(x,z,k,sigma);
    for (i = 0; i < 64; i++) c[cpos+i] = x[i];
    u = 1;
    for (i = 8; i < 16; i++) {
      u = u + (z[i] & 0xff) | 0;
      z[i] = u & 0xff;
      u >>>= 8;
    }
    b -= 64;
    cpos += 64;
  }
  if (b > 0) {
    crypto_core_salsa20(x,z,k,sigma);
    for (i = 0; i < b; i++) c[cpos+i] = x[i];
  }
  return 0;
}

function crypto_stream(c,cpos,d,n,k) {
  var s = new Uint8Array(32);
  crypto_core_hsalsa20(s,n,k,sigma);
  var sn = new Uint8Array(8);
  for (var i = 0; i < 8; i++) sn[i] = n[i+16];
  return crypto_stream_salsa20(c,cpos,d,sn,s);
}

function crypto_stream_xor(c,cpos,m,mpos,d,n,k) {
  var s = new Uint8Array(32);
  crypto_core_hsalsa20(s,n,k,sigma);
  var sn = new Uint8Array(8);
  for (var i = 0; i < 8; i++) sn[i] = n[i+16];
  return crypto_stream_salsa20_xor(c,cpos,m,mpos,d,sn,s);
}

/*
* Port of Andrew Moon's Poly1305-donna-16. Public domain.
* https://github.com/floodyberry/poly1305-donna
*/

var poly1305 = function(key) {
  this.buffer = new Uint8Array(16);
  this.r = new Uint16Array(10);
  this.h = new Uint16Array(10);
  this.pad = new Uint16Array(8);
  this.leftover = 0;
  this.fin = 0;

  var t0, t1, t2, t3, t4, t5, t6, t7;

  t0 = key[ 0] & 0xff | (key[ 1] & 0xff) << 8; this.r[0] = ( t0                     ) & 0x1fff;
  t1 = key[ 2] & 0xff | (key[ 3] & 0xff) << 8; this.r[1] = ((t0 >>> 13) | (t1 <<  3)) & 0x1fff;
  t2 = key[ 4] & 0xff | (key[ 5] & 0xff) << 8; this.r[2] = ((t1 >>> 10) | (t2 <<  6)) & 0x1f03;
  t3 = key[ 6] & 0xff | (key[ 7] & 0xff) << 8; this.r[3] = ((t2 >>>  7) | (t3 <<  9)) & 0x1fff;
  t4 = key[ 8] & 0xff | (key[ 9] & 0xff) << 8; this.r[4] = ((t3 >>>  4) | (t4 << 12)) & 0x00ff;
  this.r[5] = ((t4 >>>  1)) & 0x1ffe;
  t5 = key[10] & 0xff | (key[11] & 0xff) << 8; this.r[6] = ((t4 >>> 14) | (t5 <<  2)) & 0x1fff;
  t6 = key[12] & 0xff | (key[13] & 0xff) << 8; this.r[7] = ((t5 >>> 11) | (t6 <<  5)) & 0x1f81;
  t7 = key[14] & 0xff | (key[15] & 0xff) << 8; this.r[8] = ((t6 >>>  8) | (t7 <<  8)) & 0x1fff;
  this.r[9] = ((t7 >>>  5)) & 0x007f;

  this.pad[0] = key[16] & 0xff | (key[17] & 0xff) << 8;
  this.pad[1] = key[18] & 0xff | (key[19] & 0xff) << 8;
  this.pad[2] = key[20] & 0xff | (key[21] & 0xff) << 8;
  this.pad[3] = key[22] & 0xff | (key[23] & 0xff) << 8;
  this.pad[4] = key[24] & 0xff | (key[25] & 0xff) << 8;
  this.pad[5] = key[26] & 0xff | (key[27] & 0xff) << 8;
  this.pad[6] = key[28] & 0xff | (key[29] & 0xff) << 8;
  this.pad[7] = key[30] & 0xff | (key[31] & 0xff) << 8;
};

poly1305.prototype.blocks = function(m, mpos, bytes) {
  var hibit = this.fin ? 0 : (1 << 11);
  var t0, t1, t2, t3, t4, t5, t6, t7, c;
  var d0, d1, d2, d3, d4, d5, d6, d7, d8, d9;

  var h0 = this.h[0],
      h1 = this.h[1],
      h2 = this.h[2],
      h3 = this.h[3],
      h4 = this.h[4],
      h5 = this.h[5],
      h6 = this.h[6],
      h7 = this.h[7],
      h8 = this.h[8],
      h9 = this.h[9];

  var r0 = this.r[0],
      r1 = this.r[1],
      r2 = this.r[2],
      r3 = this.r[3],
      r4 = this.r[4],
      r5 = this.r[5],
      r6 = this.r[6],
      r7 = this.r[7],
      r8 = this.r[8],
      r9 = this.r[9];

  while (bytes >= 16) {
    t0 = m[mpos+ 0] & 0xff | (m[mpos+ 1] & 0xff) << 8; h0 += ( t0                     ) & 0x1fff;
    t1 = m[mpos+ 2] & 0xff | (m[mpos+ 3] & 0xff) << 8; h1 += ((t0 >>> 13) | (t1 <<  3)) & 0x1fff;
    t2 = m[mpos+ 4] & 0xff | (m[mpos+ 5] & 0xff) << 8; h2 += ((t1 >>> 10) | (t2 <<  6)) & 0x1fff;
    t3 = m[mpos+ 6] & 0xff | (m[mpos+ 7] & 0xff) << 8; h3 += ((t2 >>>  7) | (t3 <<  9)) & 0x1fff;
    t4 = m[mpos+ 8] & 0xff | (m[mpos+ 9] & 0xff) << 8; h4 += ((t3 >>>  4) | (t4 << 12)) & 0x1fff;
    h5 += ((t4 >>>  1)) & 0x1fff;
    t5 = m[mpos+10] & 0xff | (m[mpos+11] & 0xff) << 8; h6 += ((t4 >>> 14) | (t5 <<  2)) & 0x1fff;
    t6 = m[mpos+12] & 0xff | (m[mpos+13] & 0xff) << 8; h7 += ((t5 >>> 11) | (t6 <<  5)) & 0x1fff;
    t7 = m[mpos+14] & 0xff | (m[mpos+15] & 0xff) << 8; h8 += ((t6 >>>  8) | (t7 <<  8)) & 0x1fff;
    h9 += ((t7 >>> 5)) | hibit;

    c = 0;

    d0 = c;
    d0 += h0 * r0;
    d0 += h1 * (5 * r9);
    d0 += h2 * (5 * r8);
    d0 += h3 * (5 * r7);
    d0 += h4 * (5 * r6);
    c = (d0 >>> 13); d0 &= 0x1fff;
    d0 += h5 * (5 * r5);
    d0 += h6 * (5 * r4);
    d0 += h7 * (5 * r3);
    d0 += h8 * (5 * r2);
    d0 += h9 * (5 * r1);
    c += (d0 >>> 13); d0 &= 0x1fff;

    d1 = c;
    d1 += h0 * r1;
    d1 += h1 * r0;
    d1 += h2 * (5 * r9);
    d1 += h3 * (5 * r8);
    d1 += h4 * (5 * r7);
    c = (d1 >>> 13); d1 &= 0x1fff;
    d1 += h5 * (5 * r6);
    d1 += h6 * (5 * r5);
    d1 += h7 * (5 * r4);
    d1 += h8 * (5 * r3);
    d1 += h9 * (5 * r2);
    c += (d1 >>> 13); d1 &= 0x1fff;

    d2 = c;
    d2 += h0 * r2;
    d2 += h1 * r1;
    d2 += h2 * r0;
    d2 += h3 * (5 * r9);
    d2 += h4 * (5 * r8);
    c = (d2 >>> 13); d2 &= 0x1fff;
    d2 += h5 * (5 * r7);
    d2 += h6 * (5 * r6);
    d2 += h7 * (5 * r5);
    d2 += h8 * (5 * r4);
    d2 += h9 * (5 * r3);
    c += (d2 >>> 13); d2 &= 0x1fff;

    d3 = c;
    d3 += h0 * r3;
    d3 += h1 * r2;
    d3 += h2 * r1;
    d3 += h3 * r0;
    d3 += h4 * (5 * r9);
    c = (d3 >>> 13); d3 &= 0x1fff;
    d3 += h5 * (5 * r8);
    d3 += h6 * (5 * r7);
    d3 += h7 * (5 * r6);
    d3 += h8 * (5 * r5);
    d3 += h9 * (5 * r4);
    c += (d3 >>> 13); d3 &= 0x1fff;

    d4 = c;
    d4 += h0 * r4;
    d4 += h1 * r3;
    d4 += h2 * r2;
    d4 += h3 * r1;
    d4 += h4 * r0;
    c = (d4 >>> 13); d4 &= 0x1fff;
    d4 += h5 * (5 * r9);
    d4 += h6 * (5 * r8);
    d4 += h7 * (5 * r7);
    d4 += h8 * (5 * r6);
    d4 += h9 * (5 * r5);
    c += (d4 >>> 13); d4 &= 0x1fff;

    d5 = c;
    d5 += h0 * r5;
    d5 += h1 * r4;
    d5 += h2 * r3;
    d5 += h3 * r2;
    d5 += h4 * r1;
    c = (d5 >>> 13); d5 &= 0x1fff;
    d5 += h5 * r0;
    d5 += h6 * (5 * r9);
    d5 += h7 * (5 * r8);
    d5 += h8 * (5 * r7);
    d5 += h9 * (5 * r6);
    c += (d5 >>> 13); d5 &= 0x1fff;

    d6 = c;
    d6 += h0 * r6;
    d6 += h1 * r5;
    d6 += h2 * r4;
    d6 += h3 * r3;
    d6 += h4 * r2;
    c = (d6 >>> 13); d6 &= 0x1fff;
    d6 += h5 * r1;
    d6 += h6 * r0;
    d6 += h7 * (5 * r9);
    d6 += h8 * (5 * r8);
    d6 += h9 * (5 * r7);
    c += (d6 >>> 13); d6 &= 0x1fff;

    d7 = c;
    d7 += h0 * r7;
    d7 += h1 * r6;
    d7 += h2 * r5;
    d7 += h3 * r4;
    d7 += h4 * r3;
    c = (d7 >>> 13); d7 &= 0x1fff;
    d7 += h5 * r2;
    d7 += h6 * r1;
    d7 += h7 * r0;
    d7 += h8 * (5 * r9);
    d7 += h9 * (5 * r8);
    c += (d7 >>> 13); d7 &= 0x1fff;

    d8 = c;
    d8 += h0 * r8;
    d8 += h1 * r7;
    d8 += h2 * r6;
    d8 += h3 * r5;
    d8 += h4 * r4;
    c = (d8 >>> 13); d8 &= 0x1fff;
    d8 += h5 * r3;
    d8 += h6 * r2;
    d8 += h7 * r1;
    d8 += h8 * r0;
    d8 += h9 * (5 * r9);
    c += (d8 >>> 13); d8 &= 0x1fff;

    d9 = c;
    d9 += h0 * r9;
    d9 += h1 * r8;
    d9 += h2 * r7;
    d9 += h3 * r6;
    d9 += h4 * r5;
    c = (d9 >>> 13); d9 &= 0x1fff;
    d9 += h5 * r4;
    d9 += h6 * r3;
    d9 += h7 * r2;
    d9 += h8 * r1;
    d9 += h9 * r0;
    c += (d9 >>> 13); d9 &= 0x1fff;

    c = (((c << 2) + c)) | 0;
    c = (c + d0) | 0;
    d0 = c & 0x1fff;
    c = (c >>> 13);
    d1 += c;

    h0 = d0;
    h1 = d1;
    h2 = d2;
    h3 = d3;
    h4 = d4;
    h5 = d5;
    h6 = d6;
    h7 = d7;
    h8 = d8;
    h9 = d9;

    mpos += 16;
    bytes -= 16;
  }
  this.h[0] = h0;
  this.h[1] = h1;
  this.h[2] = h2;
  this.h[3] = h3;
  this.h[4] = h4;
  this.h[5] = h5;
  this.h[6] = h6;
  this.h[7] = h7;
  this.h[8] = h8;
  this.h[9] = h9;
};

poly1305.prototype.finish = function(mac, macpos) {
  var g = new Uint16Array(10);
  var c, mask, f, i;

  if (this.leftover) {
    i = this.leftover;
    this.buffer[i++] = 1;
    for (; i < 16; i++) this.buffer[i] = 0;
    this.fin = 1;
    this.blocks(this.buffer, 0, 16);
  }

  c = this.h[1] >>> 13;
  this.h[1] &= 0x1fff;
  for (i = 2; i < 10; i++) {
    this.h[i] += c;
    c = this.h[i] >>> 13;
    this.h[i] &= 0x1fff;
  }
  this.h[0] += (c * 5);
  c = this.h[0] >>> 13;
  this.h[0] &= 0x1fff;
  this.h[1] += c;
  c = this.h[1] >>> 13;
  this.h[1] &= 0x1fff;
  this.h[2] += c;

  g[0] = this.h[0] + 5;
  c = g[0] >>> 13;
  g[0] &= 0x1fff;
  for (i = 1; i < 10; i++) {
    g[i] = this.h[i] + c;
    c = g[i] >>> 13;
    g[i] &= 0x1fff;
  }
  g[9] -= (1 << 13);

  mask = (g[9] >>> ((2 * 8) - 1)) - 1;
  for (i = 0; i < 10; i++) g[i] &= mask;
  mask = ~mask;
  for (i = 0; i < 10; i++) this.h[i] = (this.h[i] & mask) | g[i];

  this.h[0] = ((this.h[0]       ) | (this.h[1] << 13)                    ) & 0xffff;
  this.h[1] = ((this.h[1] >>>  3) | (this.h[2] << 10)                    ) & 0xffff;
  this.h[2] = ((this.h[2] >>>  6) | (this.h[3] <<  7)                    ) & 0xffff;
  this.h[3] = ((this.h[3] >>>  9) | (this.h[4] <<  4)                    ) & 0xffff;
  this.h[4] = ((this.h[4] >>> 12) | (this.h[5] <<  1) | (this.h[6] << 14)) & 0xffff;
  this.h[5] = ((this.h[6] >>>  2) | (this.h[7] << 11)                    ) & 0xffff;
  this.h[6] = ((this.h[7] >>>  5) | (this.h[8] <<  8)                    ) & 0xffff;
  this.h[7] = ((this.h[8] >>>  8) | (this.h[9] <<  5)                    ) & 0xffff;

  f = this.h[0] + this.pad[0];
  this.h[0] = f & 0xffff;
  for (i = 1; i < 8; i++) {
    f = (((this.h[i] + this.pad[i]) | 0) + (f >>> 16)) | 0;
    this.h[i] = f & 0xffff;
  }

  mac[macpos+ 0] = (this.h[0] >>> 0) & 0xff;
  mac[macpos+ 1] = (this.h[0] >>> 8) & 0xff;
  mac[macpos+ 2] = (this.h[1] >>> 0) & 0xff;
  mac[macpos+ 3] = (this.h[1] >>> 8) & 0xff;
  mac[macpos+ 4] = (this.h[2] >>> 0) & 0xff;
  mac[macpos+ 5] = (this.h[2] >>> 8) & 0xff;
  mac[macpos+ 6] = (this.h[3] >>> 0) & 0xff;
  mac[macpos+ 7] = (this.h[3] >>> 8) & 0xff;
  mac[macpos+ 8] = (this.h[4] >>> 0) & 0xff;
  mac[macpos+ 9] = (this.h[4] >>> 8) & 0xff;
  mac[macpos+10] = (this.h[5] >>> 0) & 0xff;
  mac[macpos+11] = (this.h[5] >>> 8) & 0xff;
  mac[macpos+12] = (this.h[6] >>> 0) & 0xff;
  mac[macpos+13] = (this.h[6] >>> 8) & 0xff;
  mac[macpos+14] = (this.h[7] >>> 0) & 0xff;
  mac[macpos+15] = (this.h[7] >>> 8) & 0xff;
};

poly1305.prototype.update = function(m, mpos, bytes) {
  var i, want;

  if (this.leftover) {
    want = (16 - this.leftover);
    if (want > bytes)
      want = bytes;
    for (i = 0; i < want; i++)
      this.buffer[this.leftover + i] = m[mpos+i];
    bytes -= want;
    mpos += want;
    this.leftover += want;
    if (this.leftover < 16)
      return;
    this.blocks(buffer, 0, 16);
    this.leftover = 0;
  }

  if (bytes >= 16) {
    want = bytes - (bytes % 16);
    this.blocks(m, mpos, want);
    mpos += want;
    bytes -= want;
  }

  if (bytes) {
    for (i = 0; i < bytes; i++)
      this.buffer[this.leftover + i] = m[mpos+i];
    this.leftover += bytes;
  }
};

function crypto_onetimeauth(out, outpos, m, mpos, n, k) {
  var s = new poly1305(k);
  s.update(m, mpos, n);
  s.finish(out, outpos);
  return 0;
}

function crypto_onetimeauth_verify(h, hpos, m, mpos, n, k) {
  var x = new Uint8Array(16);
  crypto_onetimeauth(x,0,m,mpos,n,k);
  return crypto_verify_16(h,hpos,x,0);
}

function crypto_secretbox(c,m,d,n,k) {
  var i;
  if (d < 32) return -1;
  crypto_stream_xor(c,0,m,0,d,n,k);
  crypto_onetimeauth(c, 16, c, 32, d - 32, c);
  for (i = 0; i < 16; i++) c[i] = 0;
  return 0;
}

function crypto_secretbox_open(m,c,d,n,k) {
  var i;
  var x = new Uint8Array(32);
  if (d < 32) return -1;
  crypto_stream(x,0,32,n,k);
  if (crypto_onetimeauth_verify(c, 16,c, 32,d - 32,x) !== 0) return -1;
  crypto_stream_xor(m,0,c,0,d,n,k);
  for (i = 0; i < 32; i++) m[i] = 0;
  return 0;
}

function set25519(r, a) {
  var i;
  for (i = 0; i < 16; i++) r[i] = a[i]|0;
}

function car25519(o) {
  var i, v, c = 1;
  for (i = 0; i < 16; i++) {
    v = o[i] + c + 65535;
    c = Math.floor(v / 65536);
    o[i] = v - c * 65536;
  }
  o[0] += c-1 + 37 * (c-1);
}

function sel25519(p, q, b) {
  var t, c = ~(b-1);
  for (var i = 0; i < 16; i++) {
    t = c & (p[i] ^ q[i]);
    p[i] ^= t;
    q[i] ^= t;
  }
}

function pack25519(o, n) {
  var i, j, b;
  var m = gf(), t = gf();
  for (i = 0; i < 16; i++) t[i] = n[i];
  car25519(t);
  car25519(t);
  car25519(t);
  for (j = 0; j < 2; j++) {
    m[0] = t[0] - 0xffed;
    for (i = 1; i < 15; i++) {
      m[i] = t[i] - 0xffff - ((m[i-1]>>16) & 1);
      m[i-1] &= 0xffff;
    }
    m[15] = t[15] - 0x7fff - ((m[14]>>16) & 1);
    b = (m[15]>>16) & 1;
    m[14] &= 0xffff;
    sel25519(t, m, 1-b);
  }
  for (i = 0; i < 16; i++) {
    o[2*i] = t[i] & 0xff;
    o[2*i+1] = t[i]>>8;
  }
}

function neq25519(a, b) {
  var c = new Uint8Array(32), d = new Uint8Array(32);
  pack25519(c, a);
  pack25519(d, b);
  return crypto_verify_32(c, 0, d, 0);
}

function par25519(a) {
  var d = new Uint8Array(32);
  pack25519(d, a);
  return d[0] & 1;
}

function unpack25519(o, n) {
  var i;
  for (i = 0; i < 16; i++) o[i] = n[2*i] + (n[2*i+1] << 8);
  o[15] &= 0x7fff;
}

function A(o, a, b) {
  for (var i = 0; i < 16; i++) o[i] = a[i] + b[i];
}

function Z(o, a, b) {
  for (var i = 0; i < 16; i++) o[i] = a[i] - b[i];
}

function M(o, a, b) {
  var v, c,
     t0 = 0,  t1 = 0,  t2 = 0,  t3 = 0,  t4 = 0,  t5 = 0,  t6 = 0,  t7 = 0,
     t8 = 0,  t9 = 0, t10 = 0, t11 = 0, t12 = 0, t13 = 0, t14 = 0, t15 = 0,
    t16 = 0, t17 = 0, t18 = 0, t19 = 0, t20 = 0, t21 = 0, t22 = 0, t23 = 0,
    t24 = 0, t25 = 0, t26 = 0, t27 = 0, t28 = 0, t29 = 0, t30 = 0,
    b0 = b[0],
    b1 = b[1],
    b2 = b[2],
    b3 = b[3],
    b4 = b[4],
    b5 = b[5],
    b6 = b[6],
    b7 = b[7],
    b8 = b[8],
    b9 = b[9],
    b10 = b[10],
    b11 = b[11],
    b12 = b[12],
    b13 = b[13],
    b14 = b[14],
    b15 = b[15];

  v = a[0];
  t0 += v * b0;
  t1 += v * b1;
  t2 += v * b2;
  t3 += v * b3;
  t4 += v * b4;
  t5 += v * b5;
  t6 += v * b6;
  t7 += v * b7;
  t8 += v * b8;
  t9 += v * b9;
  t10 += v * b10;
  t11 += v * b11;
  t12 += v * b12;
  t13 += v * b13;
  t14 += v * b14;
  t15 += v * b15;
  v = a[1];
  t1 += v * b0;
  t2 += v * b1;
  t3 += v * b2;
  t4 += v * b3;
  t5 += v * b4;
  t6 += v * b5;
  t7 += v * b6;
  t8 += v * b7;
  t9 += v * b8;
  t10 += v * b9;
  t11 += v * b10;
  t12 += v * b11;
  t13 += v * b12;
  t14 += v * b13;
  t15 += v * b14;
  t16 += v * b15;
  v = a[2];
  t2 += v * b0;
  t3 += v * b1;
  t4 += v * b2;
  t5 += v * b3;
  t6 += v * b4;
  t7 += v * b5;
  t8 += v * b6;
  t9 += v * b7;
  t10 += v * b8;
  t11 += v * b9;
  t12 += v * b10;
  t13 += v * b11;
  t14 += v * b12;
  t15 += v * b13;
  t16 += v * b14;
  t17 += v * b15;
  v = a[3];
  t3 += v * b0;
  t4 += v * b1;
  t5 += v * b2;
  t6 += v * b3;
  t7 += v * b4;
  t8 += v * b5;
  t9 += v * b6;
  t10 += v * b7;
  t11 += v * b8;
  t12 += v * b9;
  t13 += v * b10;
  t14 += v * b11;
  t15 += v * b12;
  t16 += v * b13;
  t17 += v * b14;
  t18 += v * b15;
  v = a[4];
  t4 += v * b0;
  t5 += v * b1;
  t6 += v * b2;
  t7 += v * b3;
  t8 += v * b4;
  t9 += v * b5;
  t10 += v * b6;
  t11 += v * b7;
  t12 += v * b8;
  t13 += v * b9;
  t14 += v * b10;
  t15 += v * b11;
  t16 += v * b12;
  t17 += v * b13;
  t18 += v * b14;
  t19 += v * b15;
  v = a[5];
  t5 += v * b0;
  t6 += v * b1;
  t7 += v * b2;
  t8 += v * b3;
  t9 += v * b4;
  t10 += v * b5;
  t11 += v * b6;
  t12 += v * b7;
  t13 += v * b8;
  t14 += v * b9;
  t15 += v * b10;
  t16 += v * b11;
  t17 += v * b12;
  t18 += v * b13;
  t19 += v * b14;
  t20 += v * b15;
  v = a[6];
  t6 += v * b0;
  t7 += v * b1;
  t8 += v * b2;
  t9 += v * b3;
  t10 += v * b4;
  t11 += v * b5;
  t12 += v * b6;
  t13 += v * b7;
  t14 += v * b8;
  t15 += v * b9;
  t16 += v * b10;
  t17 += v * b11;
  t18 += v * b12;
  t19 += v * b13;
  t20 += v * b14;
  t21 += v * b15;
  v = a[7];
  t7 += v * b0;
  t8 += v * b1;
  t9 += v * b2;
  t10 += v * b3;
  t11 += v * b4;
  t12 += v * b5;
  t13 += v * b6;
  t14 += v * b7;
  t15 += v * b8;
  t16 += v * b9;
  t17 += v * b10;
  t18 += v * b11;
  t19 += v * b12;
  t20 += v * b13;
  t21 += v * b14;
  t22 += v * b15;
  v = a[8];
  t8 += v * b0;
  t9 += v * b1;
  t10 += v * b2;
  t11 += v * b3;
  t12 += v * b4;
  t13 += v * b5;
  t14 += v * b6;
  t15 += v * b7;
  t16 += v * b8;
  t17 += v * b9;
  t18 += v * b10;
  t19 += v * b11;
  t20 += v * b12;
  t21 += v * b13;
  t22 += v * b14;
  t23 += v * b15;
  v = a[9];
  t9 += v * b0;
  t10 += v * b1;
  t11 += v * b2;
  t12 += v * b3;
  t13 += v * b4;
  t14 += v * b5;
  t15 += v * b6;
  t16 += v * b7;
  t17 += v * b8;
  t18 += v * b9;
  t19 += v * b10;
  t20 += v * b11;
  t21 += v * b12;
  t22 += v * b13;
  t23 += v * b14;
  t24 += v * b15;
  v = a[10];
  t10 += v * b0;
  t11 += v * b1;
  t12 += v * b2;
  t13 += v * b3;
  t14 += v * b4;
  t15 += v * b5;
  t16 += v * b6;
  t17 += v * b7;
  t18 += v * b8;
  t19 += v * b9;
  t20 += v * b10;
  t21 += v * b11;
  t22 += v * b12;
  t23 += v * b13;
  t24 += v * b14;
  t25 += v * b15;
  v = a[11];
  t11 += v * b0;
  t12 += v * b1;
  t13 += v * b2;
  t14 += v * b3;
  t15 += v * b4;
  t16 += v * b5;
  t17 += v * b6;
  t18 += v * b7;
  t19 += v * b8;
  t20 += v * b9;
  t21 += v * b10;
  t22 += v * b11;
  t23 += v * b12;
  t24 += v * b13;
  t25 += v * b14;
  t26 += v * b15;
  v = a[12];
  t12 += v * b0;
  t13 += v * b1;
  t14 += v * b2;
  t15 += v * b3;
  t16 += v * b4;
  t17 += v * b5;
  t18 += v * b6;
  t19 += v * b7;
  t20 += v * b8;
  t21 += v * b9;
  t22 += v * b10;
  t23 += v * b11;
  t24 += v * b12;
  t25 += v * b13;
  t26 += v * b14;
  t27 += v * b15;
  v = a[13];
  t13 += v * b0;
  t14 += v * b1;
  t15 += v * b2;
  t16 += v * b3;
  t17 += v * b4;
  t18 += v * b5;
  t19 += v * b6;
  t20 += v * b7;
  t21 += v * b8;
  t22 += v * b9;
  t23 += v * b10;
  t24 += v * b11;
  t25 += v * b12;
  t26 += v * b13;
  t27 += v * b14;
  t28 += v * b15;
  v = a[14];
  t14 += v * b0;
  t15 += v * b1;
  t16 += v * b2;
  t17 += v * b3;
  t18 += v * b4;
  t19 += v * b5;
  t20 += v * b6;
  t21 += v * b7;
  t22 += v * b8;
  t23 += v * b9;
  t24 += v * b10;
  t25 += v * b11;
  t26 += v * b12;
  t27 += v * b13;
  t28 += v * b14;
  t29 += v * b15;
  v = a[15];
  t15 += v * b0;
  t16 += v * b1;
  t17 += v * b2;
  t18 += v * b3;
  t19 += v * b4;
  t20 += v * b5;
  t21 += v * b6;
  t22 += v * b7;
  t23 += v * b8;
  t24 += v * b9;
  t25 += v * b10;
  t26 += v * b11;
  t27 += v * b12;
  t28 += v * b13;
  t29 += v * b14;
  t30 += v * b15;

  t0  += 38 * t16;
  t1  += 38 * t17;
  t2  += 38 * t18;
  t3  += 38 * t19;
  t4  += 38 * t20;
  t5  += 38 * t21;
  t6  += 38 * t22;
  t7  += 38 * t23;
  t8  += 38 * t24;
  t9  += 38 * t25;
  t10 += 38 * t26;
  t11 += 38 * t27;
  t12 += 38 * t28;
  t13 += 38 * t29;
  t14 += 38 * t30;
  // t15 left as is

  // first car
  c = 1;
  v =  t0 + c + 65535; c = Math.floor(v / 65536);  t0 = v - c * 65536;
  v =  t1 + c + 65535; c = Math.floor(v / 65536);  t1 = v - c * 65536;
  v =  t2 + c + 65535; c = Math.floor(v / 65536);  t2 = v - c * 65536;
  v =  t3 + c + 65535; c = Math.floor(v / 65536);  t3 = v - c * 65536;
  v =  t4 + c + 65535; c = Math.floor(v / 65536);  t4 = v - c * 65536;
  v =  t5 + c + 65535; c = Math.floor(v / 65536);  t5 = v - c * 65536;
  v =  t6 + c + 65535; c = Math.floor(v / 65536);  t6 = v - c * 65536;
  v =  t7 + c + 65535; c = Math.floor(v / 65536);  t7 = v - c * 65536;
  v =  t8 + c + 65535; c = Math.floor(v / 65536);  t8 = v - c * 65536;
  v =  t9 + c + 65535; c = Math.floor(v / 65536);  t9 = v - c * 65536;
  v = t10 + c + 65535; c = Math.floor(v / 65536); t10 = v - c * 65536;
  v = t11 + c + 65535; c = Math.floor(v / 65536); t11 = v - c * 65536;
  v = t12 + c + 65535; c = Math.floor(v / 65536); t12 = v - c * 65536;
  v = t13 + c + 65535; c = Math.floor(v / 65536); t13 = v - c * 65536;
  v = t14 + c + 65535; c = Math.floor(v / 65536); t14 = v - c * 65536;
  v = t15 + c + 65535; c = Math.floor(v / 65536); t15 = v - c * 65536;
  t0 += c-1 + 37 * (c-1);

  // second car
  c = 1;
  v =  t0 + c + 65535; c = Math.floor(v / 65536);  t0 = v - c * 65536;
  v =  t1 + c + 65535; c = Math.floor(v / 65536);  t1 = v - c * 65536;
  v =  t2 + c + 65535; c = Math.floor(v / 65536);  t2 = v - c * 65536;
  v =  t3 + c + 65535; c = Math.floor(v / 65536);  t3 = v - c * 65536;
  v =  t4 + c + 65535; c = Math.floor(v / 65536);  t4 = v - c * 65536;
  v =  t5 + c + 65535; c = Math.floor(v / 65536);  t5 = v - c * 65536;
  v =  t6 + c + 65535; c = Math.floor(v / 65536);  t6 = v - c * 65536;
  v =  t7 + c + 65535; c = Math.floor(v / 65536);  t7 = v - c * 65536;
  v =  t8 + c + 65535; c = Math.floor(v / 65536);  t8 = v - c * 65536;
  v =  t9 + c + 65535; c = Math.floor(v / 65536);  t9 = v - c * 65536;
  v = t10 + c + 65535; c = Math.floor(v / 65536); t10 = v - c * 65536;
  v = t11 + c + 65535; c = Math.floor(v / 65536); t11 = v - c * 65536;
  v = t12 + c + 65535; c = Math.floor(v / 65536); t12 = v - c * 65536;
  v = t13 + c + 65535; c = Math.floor(v / 65536); t13 = v - c * 65536;
  v = t14 + c + 65535; c = Math.floor(v / 65536); t14 = v - c * 65536;
  v = t15 + c + 65535; c = Math.floor(v / 65536); t15 = v - c * 65536;
  t0 += c-1 + 37 * (c-1);

  o[ 0] = t0;
  o[ 1] = t1;
  o[ 2] = t2;
  o[ 3] = t3;
  o[ 4] = t4;
  o[ 5] = t5;
  o[ 6] = t6;
  o[ 7] = t7;
  o[ 8] = t8;
  o[ 9] = t9;
  o[10] = t10;
  o[11] = t11;
  o[12] = t12;
  o[13] = t13;
  o[14] = t14;
  o[15] = t15;
}

function S(o, a) {
  M(o, a, a);
}

function inv25519(o, i) {
  var c = gf();
  var a;
  for (a = 0; a < 16; a++) c[a] = i[a];
  for (a = 253; a >= 0; a--) {
    S(c, c);
    if(a !== 2 && a !== 4) M(c, c, i);
  }
  for (a = 0; a < 16; a++) o[a] = c[a];
}

function pow2523(o, i) {
  var c = gf();
  var a;
  for (a = 0; a < 16; a++) c[a] = i[a];
  for (a = 250; a >= 0; a--) {
      S(c, c);
      if(a !== 1) M(c, c, i);
  }
  for (a = 0; a < 16; a++) o[a] = c[a];
}

function crypto_scalarmult(q, n, p) {
  var z = new Uint8Array(32);
  var x = new Float64Array(80), r, i;
  var a = gf(), b = gf(), c = gf(),
      d = gf(), e = gf(), f = gf();
  for (i = 0; i < 31; i++) z[i] = n[i];
  z[31]=(n[31]&127)|64;
  z[0]&=248;
  unpack25519(x,p);
  for (i = 0; i < 16; i++) {
    b[i]=x[i];
    d[i]=a[i]=c[i]=0;
  }
  a[0]=d[0]=1;
  for (i=254;i>=0;--i) {
    r=(z[i>>>3]>>>(i&7))&1;
    sel25519(a,b,r);
    sel25519(c,d,r);
    A(e,a,c);
    Z(a,a,c);
    A(c,b,d);
    Z(b,b,d);
    S(d,e);
    S(f,a);
    M(a,c,a);
    M(c,b,e);
    A(e,a,c);
    Z(a,a,c);
    S(b,a);
    Z(c,d,f);
    M(a,c,_121665);
    A(a,a,d);
    M(c,c,a);
    M(a,d,f);
    M(d,b,x);
    S(b,e);
    sel25519(a,b,r);
    sel25519(c,d,r);
  }
  for (i = 0; i < 16; i++) {
    x[i+16]=a[i];
    x[i+32]=c[i];
    x[i+48]=b[i];
    x[i+64]=d[i];
  }
  var x32 = x.subarray(32);
  var x16 = x.subarray(16);
  inv25519(x32,x32);
  M(x16,x16,x32);
  pack25519(q,x16);
  return 0;
}

function crypto_scalarmult_base(q, n) {
  return crypto_scalarmult(q, n, _9);
}

function crypto_box_keypair(y, x) {
  randombytes(x, 32);
  return crypto_scalarmult_base(y, x);
}

function crypto_box_beforenm(k, y, x) {
  var s = new Uint8Array(32);
  crypto_scalarmult(s, x, y);
  return crypto_core_hsalsa20(k, _0, s, sigma);
}

var crypto_box_afternm = crypto_secretbox;
var crypto_box_open_afternm = crypto_secretbox_open;

function crypto_box(c, m, d, n, y, x) {
  var k = new Uint8Array(32);
  crypto_box_beforenm(k, y, x);
  return crypto_box_afternm(c, m, d, n, k);
}

function crypto_box_open(m, c, d, n, y, x) {
  var k = new Uint8Array(32);
  crypto_box_beforenm(k, y, x);
  return crypto_box_open_afternm(m, c, d, n, k);
}

var K = [
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd,
  0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
  0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
  0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
  0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe,
  0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
  0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1,
  0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
  0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
  0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
  0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483,
  0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210,
  0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
  0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
  0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
  0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926,
  0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
  0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8,
  0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
  0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
  0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
  0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910,
  0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53,
  0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
  0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
  0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
  0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60,
  0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
  0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9,
  0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
  0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
  0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
  0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6,
  0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493,
  0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
  0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
  0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
];

function crypto_hashblocks_hl(hh, hl, m, n) {
  var wh = new Int32Array(16), wl = new Int32Array(16),
      bh0, bh1, bh2, bh3, bh4, bh5, bh6, bh7,
      bl0, bl1, bl2, bl3, bl4, bl5, bl6, bl7,
      th, tl, i, j, h, l, a, b, c, d;

  var ah0 = hh[0],
      ah1 = hh[1],
      ah2 = hh[2],
      ah3 = hh[3],
      ah4 = hh[4],
      ah5 = hh[5],
      ah6 = hh[6],
      ah7 = hh[7],

      al0 = hl[0],
      al1 = hl[1],
      al2 = hl[2],
      al3 = hl[3],
      al4 = hl[4],
      al5 = hl[5],
      al6 = hl[6],
      al7 = hl[7];

  var pos = 0;
  while (n >= 128) {
    for (i = 0; i < 16; i++) {
      j = 8 * i + pos;
      wh[i] = (m[j+0] << 24) | (m[j+1] << 16) | (m[j+2] << 8) | m[j+3];
      wl[i] = (m[j+4] << 24) | (m[j+5] << 16) | (m[j+6] << 8) | m[j+7];
    }
    for (i = 0; i < 80; i++) {
      bh0 = ah0;
      bh1 = ah1;
      bh2 = ah2;
      bh3 = ah3;
      bh4 = ah4;
      bh5 = ah5;
      bh6 = ah6;
      bh7 = ah7;

      bl0 = al0;
      bl1 = al1;
      bl2 = al2;
      bl3 = al3;
      bl4 = al4;
      bl5 = al5;
      bl6 = al6;
      bl7 = al7;

      // add
      h = ah7;
      l = al7;

      a = l & 0xffff; b = l >>> 16;
      c = h & 0xffff; d = h >>> 16;

      // Sigma1
      h = ((ah4 >>> 14) | (al4 << (32-14))) ^ ((ah4 >>> 18) | (al4 << (32-18))) ^ ((al4 >>> (41-32)) | (ah4 << (32-(41-32))));
      l = ((al4 >>> 14) | (ah4 << (32-14))) ^ ((al4 >>> 18) | (ah4 << (32-18))) ^ ((ah4 >>> (41-32)) | (al4 << (32-(41-32))));

      a += l & 0xffff; b += l >>> 16;
      c += h & 0xffff; d += h >>> 16;

      // Ch
      h = (ah4 & ah5) ^ (~ah4 & ah6);
      l = (al4 & al5) ^ (~al4 & al6);

      a += l & 0xffff; b += l >>> 16;
      c += h & 0xffff; d += h >>> 16;

      // K
      h = K[i*2];
      l = K[i*2+1];

      a += l & 0xffff; b += l >>> 16;
      c += h & 0xffff; d += h >>> 16;

      // w
      h = wh[i%16];
      l = wl[i%16];

      a += l & 0xffff; b += l >>> 16;
      c += h & 0xffff; d += h >>> 16;

      b += a >>> 16;
      c += b >>> 16;
      d += c >>> 16;

      th = c & 0xffff | d << 16;
      tl = a & 0xffff | b << 16;

      // add
      h = th;
      l = tl;

      a = l & 0xffff; b = l >>> 16;
      c = h & 0xffff; d = h >>> 16;

      // Sigma0
      h = ((ah0 >>> 28) | (al0 << (32-28))) ^ ((al0 >>> (34-32)) | (ah0 << (32-(34-32)))) ^ ((al0 >>> (39-32)) | (ah0 << (32-(39-32))));
      l = ((al0 >>> 28) | (ah0 << (32-28))) ^ ((ah0 >>> (34-32)) | (al0 << (32-(34-32)))) ^ ((ah0 >>> (39-32)) | (al0 << (32-(39-32))));

      a += l & 0xffff; b += l >>> 16;
      c += h & 0xffff; d += h >>> 16;

      // Maj
      h = (ah0 & ah1) ^ (ah0 & ah2) ^ (ah1 & ah2);
      l = (al0 & al1) ^ (al0 & al2) ^ (al1 & al2);

      a += l & 0xffff; b += l >>> 16;
      c += h & 0xffff; d += h >>> 16;

      b += a >>> 16;
      c += b >>> 16;
      d += c >>> 16;

      bh7 = (c & 0xffff) | (d << 16);
      bl7 = (a & 0xffff) | (b << 16);

      // add
      h = bh3;
      l = bl3;

      a = l & 0xffff; b = l >>> 16;
      c = h & 0xffff; d = h >>> 16;

      h = th;
      l = tl;

      a += l & 0xffff; b += l >>> 16;
      c += h & 0xffff; d += h >>> 16;

      b += a >>> 16;
      c += b >>> 16;
      d += c >>> 16;

      bh3 = (c & 0xffff) | (d << 16);
      bl3 = (a & 0xffff) | (b << 16);

      ah1 = bh0;
      ah2 = bh1;
      ah3 = bh2;
      ah4 = bh3;
      ah5 = bh4;
      ah6 = bh5;
      ah7 = bh6;
      ah0 = bh7;

      al1 = bl0;
      al2 = bl1;
      al3 = bl2;
      al4 = bl3;
      al5 = bl4;
      al6 = bl5;
      al7 = bl6;
      al0 = bl7;

      if (i%16 === 15) {
        for (j = 0; j < 16; j++) {
          // add
          h = wh[j];
          l = wl[j];

          a = l & 0xffff; b = l >>> 16;
          c = h & 0xffff; d = h >>> 16;

          h = wh[(j+9)%16];
          l = wl[(j+9)%16];

          a += l & 0xffff; b += l >>> 16;
          c += h & 0xffff; d += h >>> 16;

          // sigma0
          th = wh[(j+1)%16];
          tl = wl[(j+1)%16];
          h = ((th >>> 1) | (tl << (32-1))) ^ ((th >>> 8) | (tl << (32-8))) ^ (th >>> 7);
          l = ((tl >>> 1) | (th << (32-1))) ^ ((tl >>> 8) | (th << (32-8))) ^ ((tl >>> 7) | (th << (32-7)));

          a += l & 0xffff; b += l >>> 16;
          c += h & 0xffff; d += h >>> 16;

          // sigma1
          th = wh[(j+14)%16];
          tl = wl[(j+14)%16];
          h = ((th >>> 19) | (tl << (32-19))) ^ ((tl >>> (61-32)) | (th << (32-(61-32)))) ^ (th >>> 6);
          l = ((tl >>> 19) | (th << (32-19))) ^ ((th >>> (61-32)) | (tl << (32-(61-32)))) ^ ((tl >>> 6) | (th << (32-6)));

          a += l & 0xffff; b += l >>> 16;
          c += h & 0xffff; d += h >>> 16;

          b += a >>> 16;
          c += b >>> 16;
          d += c >>> 16;

          wh[j] = (c & 0xffff) | (d << 16);
          wl[j] = (a & 0xffff) | (b << 16);
        }
      }
    }

    // add
    h = ah0;
    l = al0;

    a = l & 0xffff; b = l >>> 16;
    c = h & 0xffff; d = h >>> 16;

    h = hh[0];
    l = hl[0];

    a += l & 0xffff; b += l >>> 16;
    c += h & 0xffff; d += h >>> 16;

    b += a >>> 16;
    c += b >>> 16;
    d += c >>> 16;

    hh[0] = ah0 = (c & 0xffff) | (d << 16);
    hl[0] = al0 = (a & 0xffff) | (b << 16);

    h = ah1;
    l = al1;

    a = l & 0xffff; b = l >>> 16;
    c = h & 0xffff; d = h >>> 16;

    h = hh[1];
    l = hl[1];

    a += l & 0xffff; b += l >>> 16;
    c += h & 0xffff; d += h >>> 16;

    b += a >>> 16;
    c += b >>> 16;
    d += c >>> 16;

    hh[1] = ah1 = (c & 0xffff) | (d << 16);
    hl[1] = al1 = (a & 0xffff) | (b << 16);

    h = ah2;
    l = al2;

    a = l & 0xffff; b = l >>> 16;
    c = h & 0xffff; d = h >>> 16;

    h = hh[2];
    l = hl[2];

    a += l & 0xffff; b += l >>> 16;
    c += h & 0xffff; d += h >>> 16;

    b += a >>> 16;
    c += b >>> 16;
    d += c >>> 16;

    hh[2] = ah2 = (c & 0xffff) | (d << 16);
    hl[2] = al2 = (a & 0xffff) | (b << 16);

    h = ah3;
    l = al3;

    a = l & 0xffff; b = l >>> 16;
    c = h & 0xffff; d = h >>> 16;

    h = hh[3];
    l = hl[3];

    a += l & 0xffff; b += l >>> 16;
    c += h & 0xffff; d += h >>> 16;

    b += a >>> 16;
    c += b >>> 16;
    d += c >>> 16;

    hh[3] = ah3 = (c & 0xffff) | (d << 16);
    hl[3] = al3 = (a & 0xffff) | (b << 16);

    h = ah4;
    l = al4;

    a = l & 0xffff; b = l >>> 16;
    c = h & 0xffff; d = h >>> 16;

    h = hh[4];
    l = hl[4];

    a += l & 0xffff; b += l >>> 16;
    c += h & 0xffff; d += h >>> 16;

    b += a >>> 16;
    c += b >>> 16;
    d += c >>> 16;

    hh[4] = ah4 = (c & 0xffff) | (d << 16);
    hl[4] = al4 = (a & 0xffff) | (b << 16);

    h = ah5;
    l = al5;

    a = l & 0xffff; b = l >>> 16;
    c = h & 0xffff; d = h >>> 16;

    h = hh[5];
    l = hl[5];

    a += l & 0xffff; b += l >>> 16;
    c += h & 0xffff; d += h >>> 16;

    b += a >>> 16;
    c += b >>> 16;
    d += c >>> 16;

    hh[5] = ah5 = (c & 0xffff) | (d << 16);
    hl[5] = al5 = (a & 0xffff) | (b << 16);

    h = ah6;
    l = al6;

    a = l & 0xffff; b = l >>> 16;
    c = h & 0xffff; d = h >>> 16;

    h = hh[6];
    l = hl[6];

    a += l & 0xffff; b += l >>> 16;
    c += h & 0xffff; d += h >>> 16;

    b += a >>> 16;
    c += b >>> 16;
    d += c >>> 16;

    hh[6] = ah6 = (c & 0xffff) | (d << 16);
    hl[6] = al6 = (a & 0xffff) | (b << 16);

    h = ah7;
    l = al7;

    a = l & 0xffff; b = l >>> 16;
    c = h & 0xffff; d = h >>> 16;

    h = hh[7];
    l = hl[7];

    a += l & 0xffff; b += l >>> 16;
    c += h & 0xffff; d += h >>> 16;

    b += a >>> 16;
    c += b >>> 16;
    d += c >>> 16;

    hh[7] = ah7 = (c & 0xffff) | (d << 16);
    hl[7] = al7 = (a & 0xffff) | (b << 16);

    pos += 128;
    n -= 128;
  }

  return n;
}

function crypto_hash(out, m, n) {
  var hh = new Int32Array(8),
      hl = new Int32Array(8),
      x = new Uint8Array(256),
      i, b = n;

  hh[0] = 0x6a09e667;
  hh[1] = 0xbb67ae85;
  hh[2] = 0x3c6ef372;
  hh[3] = 0xa54ff53a;
  hh[4] = 0x510e527f;
  hh[5] = 0x9b05688c;
  hh[6] = 0x1f83d9ab;
  hh[7] = 0x5be0cd19;

  hl[0] = 0xf3bcc908;
  hl[1] = 0x84caa73b;
  hl[2] = 0xfe94f82b;
  hl[3] = 0x5f1d36f1;
  hl[4] = 0xade682d1;
  hl[5] = 0x2b3e6c1f;
  hl[6] = 0xfb41bd6b;
  hl[7] = 0x137e2179;

  crypto_hashblocks_hl(hh, hl, m, n);
  n %= 128;

  for (i = 0; i < n; i++) x[i] = m[b-n+i];
  x[n] = 128;

  n = 256-128*(n<112?1:0);
  x[n-9] = 0;
  ts64(x, n-8,  (b / 0x20000000) | 0, b << 3);
  crypto_hashblocks_hl(hh, hl, x, n);

  for (i = 0; i < 8; i++) ts64(out, 8*i, hh[i], hl[i]);

  return 0;
}

function add(p, q) {
  var a = gf(), b = gf(), c = gf(),
      d = gf(), e = gf(), f = gf(),
      g = gf(), h = gf(), t = gf();

  Z(a, p[1], p[0]);
  Z(t, q[1], q[0]);
  M(a, a, t);
  A(b, p[0], p[1]);
  A(t, q[0], q[1]);
  M(b, b, t);
  M(c, p[3], q[3]);
  M(c, c, D2);
  M(d, p[2], q[2]);
  A(d, d, d);
  Z(e, b, a);
  Z(f, d, c);
  A(g, d, c);
  A(h, b, a);

  M(p[0], e, f);
  M(p[1], h, g);
  M(p[2], g, f);
  M(p[3], e, h);
}

function cswap(p, q, b) {
  var i;
  for (i = 0; i < 4; i++) {
    sel25519(p[i], q[i], b);
  }
}

function pack(r, p) {
  var tx = gf(), ty = gf(), zi = gf();
  inv25519(zi, p[2]);
  M(tx, p[0], zi);
  M(ty, p[1], zi);
  pack25519(r, ty);
  r[31] ^= par25519(tx) << 7;
}

function scalarmult(p, q, s) {
  var b, i;
  set25519(p[0], gf0);
  set25519(p[1], gf1);
  set25519(p[2], gf1);
  set25519(p[3], gf0);
  for (i = 255; i >= 0; --i) {
    b = (s[(i/8)|0] >> (i&7)) & 1;
    cswap(p, q, b);
    add(q, p);
    add(p, p);
    cswap(p, q, b);
  }
}

function scalarbase(p, s) {
  var q = [gf(), gf(), gf(), gf()];
  set25519(q[0], X);
  set25519(q[1], Y);
  set25519(q[2], gf1);
  M(q[3], X, Y);
  scalarmult(p, q, s);
}

function crypto_sign_keypair(pk, sk, seeded) {
  var d = new Uint8Array(64);
  var p = [gf(), gf(), gf(), gf()];
  var i;

  if (!seeded) randombytes(sk, 32);
  crypto_hash(d, sk, 32);
  d[0] &= 248;
  d[31] &= 127;
  d[31] |= 64;

  scalarbase(p, d);
  pack(pk, p);

  for (i = 0; i < 32; i++) sk[i+32] = pk[i];
  return 0;
}

var L = new Float64Array([0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58, 0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde, 0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10]);

function modL(r, x) {
  var carry, i, j, k;
  for (i = 63; i >= 32; --i) {
    carry = 0;
    for (j = i - 32, k = i - 12; j < k; ++j) {
      x[j] += carry - 16 * x[i] * L[j - (i - 32)];
      carry = (x[j] + 128) >> 8;
      x[j] -= carry * 256;
    }
    x[j] += carry;
    x[i] = 0;
  }
  carry = 0;
  for (j = 0; j < 32; j++) {
    x[j] += carry - (x[31] >> 4) * L[j];
    carry = x[j] >> 8;
    x[j] &= 255;
  }
  for (j = 0; j < 32; j++) x[j] -= carry * L[j];
  for (i = 0; i < 32; i++) {
    x[i+1] += x[i] >> 8;
    r[i] = x[i] & 255;
  }
}

function reduce(r) {
  var x = new Float64Array(64), i;
  for (i = 0; i < 64; i++) x[i] = r[i];
  for (i = 0; i < 64; i++) r[i] = 0;
  modL(r, x);
}

// Note: difference from C - smlen returned, not passed as argument.
function crypto_sign(sm, m, n, sk) {
  var d = new Uint8Array(64), h = new Uint8Array(64), r = new Uint8Array(64);
  var i, j, x = new Float64Array(64);
  var p = [gf(), gf(), gf(), gf()];

  crypto_hash(d, sk, 32);
  d[0] &= 248;
  d[31] &= 127;
  d[31] |= 64;

  var smlen = n + 64;
  for (i = 0; i < n; i++) sm[64 + i] = m[i];
  for (i = 0; i < 32; i++) sm[32 + i] = d[32 + i];

  crypto_hash(r, sm.subarray(32), n+32);
  reduce(r);
  scalarbase(p, r);
  pack(sm, p);

  for (i = 32; i < 64; i++) sm[i] = sk[i];
  crypto_hash(h, sm, n + 64);
  reduce(h);

  for (i = 0; i < 64; i++) x[i] = 0;
  for (i = 0; i < 32; i++) x[i] = r[i];
  for (i = 0; i < 32; i++) {
    for (j = 0; j < 32; j++) {
      x[i+j] += h[i] * d[j];
    }
  }

  modL(sm.subarray(32), x);
  return smlen;
}

function unpackneg(r, p) {
  var t = gf(), chk = gf(), num = gf(),
      den = gf(), den2 = gf(), den4 = gf(),
      den6 = gf();

  set25519(r[2], gf1);
  unpack25519(r[1], p);
  S(num, r[1]);
  M(den, num, D);
  Z(num, num, r[2]);
  A(den, r[2], den);

  S(den2, den);
  S(den4, den2);
  M(den6, den4, den2);
  M(t, den6, num);
  M(t, t, den);

  pow2523(t, t);
  M(t, t, num);
  M(t, t, den);
  M(t, t, den);
  M(r[0], t, den);

  S(chk, r[0]);
  M(chk, chk, den);
  if (neq25519(chk, num)) M(r[0], r[0], I);

  S(chk, r[0]);
  M(chk, chk, den);
  if (neq25519(chk, num)) return -1;

  if (par25519(r[0]) === (p[31]>>7)) Z(r[0], gf0, r[0]);

  M(r[3], r[0], r[1]);
  return 0;
}

function crypto_sign_open(m, sm, n, pk) {
  var i, mlen;
  var t = new Uint8Array(32), h = new Uint8Array(64);
  var p = [gf(), gf(), gf(), gf()],
      q = [gf(), gf(), gf(), gf()];

  mlen = -1;
  if (n < 64) return -1;

  if (unpackneg(q, pk)) return -1;

  for (i = 0; i < n; i++) m[i] = sm[i];
  for (i = 0; i < 32; i++) m[i+32] = pk[i];
  crypto_hash(h, m, n);
  reduce(h);
  scalarmult(p, q, h);

  scalarbase(q, sm.subarray(32));
  add(p, q);
  pack(t, p);

  n -= 64;
  if (crypto_verify_32(sm, 0, t, 0)) {
    for (i = 0; i < n; i++) m[i] = 0;
    return -1;
  }

  for (i = 0; i < n; i++) m[i] = sm[i + 64];
  mlen = n;
  return mlen;
}

var crypto_secretbox_KEYBYTES = 32,
    crypto_secretbox_NONCEBYTES = 24,
    crypto_secretbox_ZEROBYTES = 32,
    crypto_secretbox_BOXZEROBYTES = 16,
    crypto_scalarmult_BYTES = 32,
    crypto_scalarmult_SCALARBYTES = 32,
    crypto_box_PUBLICKEYBYTES = 32,
    crypto_box_SECRETKEYBYTES = 32,
    crypto_box_BEFORENMBYTES = 32,
    crypto_box_NONCEBYTES = crypto_secretbox_NONCEBYTES,
    crypto_box_ZEROBYTES = crypto_secretbox_ZEROBYTES,
    crypto_box_BOXZEROBYTES = crypto_secretbox_BOXZEROBYTES,
    crypto_sign_BYTES = 64,
    crypto_sign_PUBLICKEYBYTES = 32,
    crypto_sign_SECRETKEYBYTES = 64,
    crypto_sign_SEEDBYTES = 32,
    crypto_hash_BYTES = 64;

nacl.lowlevel = {
  crypto_core_hsalsa20: crypto_core_hsalsa20,
  crypto_stream_xor : crypto_stream_xor,
  crypto_stream : crypto_stream,
  crypto_stream_salsa20_xor : crypto_stream_salsa20_xor,
  crypto_stream_salsa20 : crypto_stream_salsa20,
  crypto_onetimeauth : crypto_onetimeauth,
  crypto_onetimeauth_verify : crypto_onetimeauth_verify,
  crypto_verify_16 : crypto_verify_16,
  crypto_verify_32 : crypto_verify_32,
  crypto_secretbox : crypto_secretbox,
  crypto_secretbox_open : crypto_secretbox_open,
  crypto_scalarmult : crypto_scalarmult,
  crypto_scalarmult_base : crypto_scalarmult_base,
  crypto_box_beforenm : crypto_box_beforenm,
  crypto_box_afternm : crypto_box_afternm,
  crypto_box : crypto_box,
  crypto_box_open : crypto_box_open,
  crypto_box_keypair : crypto_box_keypair,
  crypto_hash : crypto_hash,
  crypto_sign : crypto_sign,
  crypto_sign_keypair : crypto_sign_keypair,
  crypto_sign_open : crypto_sign_open,

  crypto_secretbox_KEYBYTES : crypto_secretbox_KEYBYTES,
  crypto_secretbox_NONCEBYTES : crypto_secretbox_NONCEBYTES,
  crypto_secretbox_ZEROBYTES : crypto_secretbox_ZEROBYTES,
  crypto_secretbox_BOXZEROBYTES : crypto_secretbox_BOXZEROBYTES,
  crypto_scalarmult_BYTES : crypto_scalarmult_BYTES,
  crypto_scalarmult_SCALARBYTES : crypto_scalarmult_SCALARBYTES,
  crypto_box_PUBLICKEYBYTES : crypto_box_PUBLICKEYBYTES,
  crypto_box_SECRETKEYBYTES : crypto_box_SECRETKEYBYTES,
  crypto_box_BEFORENMBYTES : crypto_box_BEFORENMBYTES,
  crypto_box_NONCEBYTES : crypto_box_NONCEBYTES,
  crypto_box_ZEROBYTES : crypto_box_ZEROBYTES,
  crypto_box_BOXZEROBYTES : crypto_box_BOXZEROBYTES,
  crypto_sign_BYTES : crypto_sign_BYTES,
  crypto_sign_PUBLICKEYBYTES : crypto_sign_PUBLICKEYBYTES,
  crypto_sign_SECRETKEYBYTES : crypto_sign_SECRETKEYBYTES,
  crypto_sign_SEEDBYTES: crypto_sign_SEEDBYTES,
  crypto_hash_BYTES : crypto_hash_BYTES
};

/* High-level API */

function checkLengths(k, n) {
  if (k.length !== crypto_secretbox_KEYBYTES) throw new Error('bad key size');
  if (n.length !== crypto_secretbox_NONCEBYTES) throw new Error('bad nonce size');
}

function checkBoxLengths(pk, sk) {
  if (pk.length !== crypto_box_PUBLICKEYBYTES) throw new Error('bad public key size');
  if (sk.length !== crypto_box_SECRETKEYBYTES) throw new Error('bad secret key size');
}

function checkArrayTypes() {
  var t, i;
  for (i = 0; i < arguments.length; i++) {
     if ((t = Object.prototype.toString.call(arguments[i])) !== '[object Uint8Array]')
       throw new TypeError('unexpected type ' + t + ', use Uint8Array');
  }
}

function cleanup(arr) {
  for (var i = 0; i < arr.length; i++) arr[i] = 0;
}

nacl.util = {};

nacl.util.decodeUTF8 = function(s) {
  var i, d = unescape(encodeURIComponent(s)), b = new Uint8Array(d.length);
  for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
  return b;
};

nacl.util.encodeUTF8 = function(arr) {
  var i, s = [];
  for (i = 0; i < arr.length; i++) s.push(String.fromCharCode(arr[i]));
  return decodeURIComponent(escape(s.join('')));
};

nacl.util.encodeBase64 = function(arr) {
  if (typeof btoa === 'undefined') {
    return (new Buffer(arr)).toString('base64');
  } else {
    var i, s = [], len = arr.length;
    for (i = 0; i < len; i++) s.push(String.fromCharCode(arr[i]));
    return btoa(s.join(''));
  }
};

nacl.util.decodeBase64 = function(s) {
  if (typeof atob === 'undefined') {
    return new Uint8Array(Array.prototype.slice.call(new Buffer(s, 'base64'), 0));
  } else {
    var i, d = atob(s), b = new Uint8Array(d.length);
    for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
    return b;
  }
};

nacl.randomBytes = function(n) {
  var b = new Uint8Array(n);
  randombytes(b, n);
  return b;
};

nacl.secretbox = function(msg, nonce, key) {
  checkArrayTypes(msg, nonce, key);
  checkLengths(key, nonce);
  var m = new Uint8Array(crypto_secretbox_ZEROBYTES + msg.length);
  var c = new Uint8Array(m.length);
  for (var i = 0; i < msg.length; i++) m[i+crypto_secretbox_ZEROBYTES] = msg[i];
  crypto_secretbox(c, m, m.length, nonce, key);
  return c.subarray(crypto_secretbox_BOXZEROBYTES);
};

nacl.secretbox.open = function(box, nonce, key) {
  checkArrayTypes(box, nonce, key);
  checkLengths(key, nonce);
  var c = new Uint8Array(crypto_secretbox_BOXZEROBYTES + box.length);
  var m = new Uint8Array(c.length);
  for (var i = 0; i < box.length; i++) c[i+crypto_secretbox_BOXZEROBYTES] = box[i];
  if (c.length < 32) return false;
  if (crypto_secretbox_open(m, c, c.length, nonce, key) !== 0) return false;
  return m.subarray(crypto_secretbox_ZEROBYTES);
};

nacl.secretbox.keyLength = crypto_secretbox_KEYBYTES;
nacl.secretbox.nonceLength = crypto_secretbox_NONCEBYTES;
nacl.secretbox.overheadLength = crypto_secretbox_BOXZEROBYTES;

nacl.scalarMult = function(n, p) {
  checkArrayTypes(n, p);
  if (n.length !== crypto_scalarmult_SCALARBYTES) throw new Error('bad n size');
  if (p.length !== crypto_scalarmult_BYTES) throw new Error('bad p size');
  var q = new Uint8Array(crypto_scalarmult_BYTES);
  crypto_scalarmult(q, n, p);
  return q;
};

nacl.scalarMult.base = function(n) {
  checkArrayTypes(n);
  if (n.length !== crypto_scalarmult_SCALARBYTES) throw new Error('bad n size');
  var q = new Uint8Array(crypto_scalarmult_BYTES);
  crypto_scalarmult_base(q, n);
  return q;
};

nacl.scalarMult.scalarLength = crypto_scalarmult_SCALARBYTES;
nacl.scalarMult.groupElementLength = crypto_scalarmult_BYTES;

nacl.box = function(msg, nonce, publicKey, secretKey) {
  var k = nacl.box.before(publicKey, secretKey);
  return nacl.secretbox(msg, nonce, k);
};

nacl.box.before = function(publicKey, secretKey) {
  checkArrayTypes(publicKey, secretKey);
  checkBoxLengths(publicKey, secretKey);
  var k = new Uint8Array(crypto_box_BEFORENMBYTES);
  crypto_box_beforenm(k, publicKey, secretKey);
  return k;
};

nacl.box.after = nacl.secretbox;

nacl.box.open = function(msg, nonce, publicKey, secretKey) {
  var k = nacl.box.before(publicKey, secretKey);
  return nacl.secretbox.open(msg, nonce, k);
};

nacl.box.open.after = nacl.secretbox.open;

nacl.box.keyPair = function() {
  var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
  var sk = new Uint8Array(crypto_box_SECRETKEYBYTES);
  crypto_box_keypair(pk, sk);
  return {publicKey: pk, secretKey: sk};
};

nacl.box.keyPair.fromSecretKey = function(secretKey) {
  checkArrayTypes(secretKey);
  if (secretKey.length !== crypto_box_SECRETKEYBYTES)
    throw new Error('bad secret key size');
  var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
  crypto_scalarmult_base(pk, secretKey);
  return {publicKey: pk, secretKey: new Uint8Array(secretKey)};
};

nacl.box.publicKeyLength = crypto_box_PUBLICKEYBYTES;
nacl.box.secretKeyLength = crypto_box_SECRETKEYBYTES;
nacl.box.sharedKeyLength = crypto_box_BEFORENMBYTES;
nacl.box.nonceLength = crypto_box_NONCEBYTES;
nacl.box.overheadLength = nacl.secretbox.overheadLength;

nacl.sign = function(msg, secretKey) {
  checkArrayTypes(msg, secretKey);
  if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
    throw new Error('bad secret key size');
  var signedMsg = new Uint8Array(crypto_sign_BYTES+msg.length);
  crypto_sign(signedMsg, msg, msg.length, secretKey);
  return signedMsg;
};

nacl.sign.open = function(signedMsg, publicKey) {
  if (arguments.length !== 2)
    throw new Error('nacl.sign.open accepts 2 arguments; did you mean to use nacl.sign.detached.verify?');
  checkArrayTypes(signedMsg, publicKey);
  if (publicKey.length !== crypto_sign_PUBLICKEYBYTES)
    throw new Error('bad public key size');
  var tmp = new Uint8Array(signedMsg.length);
  var mlen = crypto_sign_open(tmp, signedMsg, signedMsg.length, publicKey);
  if (mlen < 0) return null;
  var m = new Uint8Array(mlen);
  for (var i = 0; i < m.length; i++) m[i] = tmp[i];
  return m;
};

nacl.sign.detached = function(msg, secretKey) {
  var signedMsg = nacl.sign(msg, secretKey);
  var sig = new Uint8Array(crypto_sign_BYTES);
  for (var i = 0; i < sig.length; i++) sig[i] = signedMsg[i];
  return sig;
};

nacl.sign.detached.verify = function(msg, sig, publicKey) {
  checkArrayTypes(msg, sig, publicKey);
  if (sig.length !== crypto_sign_BYTES)
    throw new Error('bad signature size');
  if (publicKey.length !== crypto_sign_PUBLICKEYBYTES)
    throw new Error('bad public key size');
  var sm = new Uint8Array(crypto_sign_BYTES + msg.length);
  var m = new Uint8Array(crypto_sign_BYTES + msg.length);
  var i;
  for (i = 0; i < crypto_sign_BYTES; i++) sm[i] = sig[i];
  for (i = 0; i < msg.length; i++) sm[i+crypto_sign_BYTES] = msg[i];
  return (crypto_sign_open(m, sm, sm.length, publicKey) >= 0);
};

nacl.sign.keyPair = function() {
  var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
  var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
  crypto_sign_keypair(pk, sk);
  return {publicKey: pk, secretKey: sk};
};

nacl.sign.keyPair.fromSecretKey = function(secretKey) {
  checkArrayTypes(secretKey);
  if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
    throw new Error('bad secret key size');
  var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
  for (var i = 0; i < pk.length; i++) pk[i] = secretKey[32+i];
  return {publicKey: pk, secretKey: new Uint8Array(secretKey)};
};

nacl.sign.keyPair.fromSeed = function(seed) {
  checkArrayTypes(seed);
  if (seed.length !== crypto_sign_SEEDBYTES)
    throw new Error('bad seed size');
  var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
  var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
  for (var i = 0; i < 32; i++) sk[i] = seed[i];
  crypto_sign_keypair(pk, sk, true);
  return {publicKey: pk, secretKey: sk};
};

nacl.sign.publicKeyLength = crypto_sign_PUBLICKEYBYTES;
nacl.sign.secretKeyLength = crypto_sign_SECRETKEYBYTES;
nacl.sign.seedLength = crypto_sign_SEEDBYTES;
nacl.sign.signatureLength = crypto_sign_BYTES;

nacl.hash = function(msg) {
  checkArrayTypes(msg);
  var h = new Uint8Array(crypto_hash_BYTES);
  crypto_hash(h, msg, msg.length);
  return h;
};

nacl.hash.hashLength = crypto_hash_BYTES;

nacl.verify = function(x, y) {
  checkArrayTypes(x, y);
  // Zero length arguments are considered not equal.
  if (x.length === 0 || y.length === 0) return false;
  if (x.length !== y.length) return false;
  return (vn(x, 0, y, 0, x.length) === 0) ? true : false;
};

nacl.setPRNG = function(fn) {
  randombytes = fn;
};

(function() {
  // Initialize PRNG if environment provides CSPRNG.
  // If not, methods calling randombytes will throw.
  var crypto;
  if (typeof window !== 'undefined') {
    // Browser.
    if (window.crypto && window.crypto.getRandomValues) {
      crypto = window.crypto; // Standard
    } else if (window.msCrypto && window.msCrypto.getRandomValues) {
      crypto = window.msCrypto; // Internet Explorer 11+
    }
    if (crypto) {
      nacl.setPRNG(function(x, n) {
        var i, v = new Uint8Array(n);
        crypto.getRandomValues(v);
        for (i = 0; i < n; i++) x[i] = v[i];
        cleanup(v);
      });
    }
  } else if (typeof require !== 'undefined') {
    // Node.js.
    crypto = require('crypto');
    if (crypto) {
      nacl.setPRNG(function(x, n) {
        var i, v = crypto.randomBytes(n);
        for (i = 0; i < n; i++) x[i] = v[i];
        cleanup(v);
      });
    }
  }
})();

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.nacl = window.nacl || {}));
